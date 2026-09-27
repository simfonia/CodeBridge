import { expect, test } from '@playwright/test';
import {
  emitMockEvent,
  installTauriMock,
  readCliCalls,
  setCliResponse,
  setUiLocale
} from '../support/tauri-mock.js';

/**
 * T2-C 編譯／上傳流程的端對端驗證。
 *
 * 這些測試跑在純瀏覽器（Vite dev server），沒有真實 Arduino CLI 與硬體，
 * 因此以 `window.__TAURI__` stub 驗證「前端是否把正確的 command 與 payload
 * 送到後端」、「終端機面板是否正確呈現」、「診斷是否對應到程式碼面板的行」。
 * 真實編譯與上傳的驗證屬於 Rust 端的 `arduino_cli_smoke.rs` 與 T2-E 桌機驗證。
 */

const BLINK_PATH = 'C:/projects/Blink.cbg';

const BLINK_PROJECT = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<xml xmlns="https://developers.google.com/blockly/xml" xmlns:cbp="https://codebridge.app/xml" cbp:format="1" cbp:name="Blink" cbp:fqbn="arduino:avr:uno" cbp:port="COM3">',
  '  <block type="initializes_setup" id="setup-from-file" x="20" y="20">',
  '    <statement name="CONTENT">',
  '      <block type="arduino_delay" id="delay-from-file" x="20" y="20">',
  '        <value name="TIME">',
  '          <shadow type="math_number" id="delay-num-from-file">',
  '            <field name="NUM">250</field>',
  '          </shadow>',
  '        </value>',
  '      </block>',
  '    </statement>',
  '  </block>',
  '</xml>'
].join('\n');

/** 開啟一個帶有 fqbn 與 port 的既有專案，讓編譯流程具備完整前置條件。 */

/**
 * 模擬後端的編詯完成事件。
 *
 * 必要的原因：`compile_start` 是從面任務，立即回傳 op id，
 * 但 `last_builds` 要等編詯成功才填。前端因此等待
 * `operation-status: succeeded` 才接續上傳 —— 模擬必須主動發那個事件。
 */
async function emitCompileSucceeded(page, operationId = 'op-compile') {
  await emitMockEvent(page, 'codebridge://operation-status', {
    operationId, kind: 'compile', state: 'succeeded', lines: []
  });
}

async function openReadyProject(page) {
  await installTauriMock(page, { files: { [BLINK_PATH]: BLINK_PROJECT } });
  await setUiLocale(page, 'zh-hant');
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.CodeBridgeProject && window.CodeBridgeCompile));
  await page.evaluate(async (path) => {
    await window.CodeBridgeProjectIO.openPath(path);
  }, BLINK_PATH);
  await page.waitForTimeout(300);
}

function terminalLines(page) {
  return page.evaluate(() => Array.from(
    document.querySelectorAll('#terminalContent .terminal-line'),
    (node) => node.textContent
  ));
}

test.describe('編譯／上傳流程', () => {
  test('執行與停止按鈕已啟用且帶有 tooltip', async ({ page }) => {
    await openReadyProject(page);

    await expect(page.locator('#btn-run')).toBeEnabled();
    await expect(page.locator('#btn-run')).toHaveAttribute('title', /編譯|執行/);
    await expect(page.locator('#btn-stop')).toBeEnabled();
  });

  test('按下執行會依序送出 compile_start、upload_ready 與 upload_start', async ({ page }) => {
    await openReadyProject(page);

    await page.locator('#btn-run').click();
    // 後端編詯完成後才有 last_builds，前端因此等後上傳。
    await emitCompileSucceeded(page);
    await page.waitForFunction(() => window.CodeBridgeCompile.getState().operationId === 'op-upload');

    const calls = await readCliCalls(page);
    expect(calls.map((call) => call.command)).toEqual([
      'compile_start', 'upload_ready', 'upload_start'
    ]);

    const compile = calls[0];
    // Tauri 契約：Rust 稿名為 compile_start(payload: CompilePayload)，
    // 前端必須包成 { payload: {...} }。
    expect(compile.args.payload.fqbn).toBe('arduino:avr:uno');
    expect(compile.args.payload.projectId).toBe('Blink');
    expect(compile.args.payload.code).toContain('delay(250)');
    // ID marker 永遠不得寫入磁碟（行號契約的前提）
    expect(compile.args.payload.code).not.toContain('__BLOCKLY_ID');

    expect(calls[2].args.payload.port).toBe('COM3');
  });

  test('執行時終端機自動展開並顯示編譯與上傳訊息', async ({ page }) => {
    await openReadyProject(page);

    await page.locator('#btn-run').click();
    await page.waitForFunction(() => window.CodeBridgeCompile.isBusy());
    await emitCompileSucceeded(page);

    await expect(page.locator('#terminalArea')).not.toHaveClass(/collapsed/);
    const lines = (await terminalLines(page)).join('\n');
    expect(lines).toContain('開始編譯');
    expect(lines).toContain('開始上傳到 COM3');
  });

  test('燒錄中按停止不會取消（避免把板子寫壞）', async ({ page }) => {
    // 中斷燒錄會讓 flash 內容半尾；板子不會報廢（bootloader 區段不受影響），
    // 重新燒一次即可還原，但對使用者來說「板子寫壞」本身就是傷害。
    await openReadyProject(page);
    await page.locator('#btn-run').click();
    await emitCompileSucceeded(page);
    await page.waitForFunction(() => window.CodeBridgeCompile.getState().operationId === 'op-upload');

    await page.locator('#btn-stop').click();
    await page.waitForTimeout(300);

    const calls = await readCliCalls(page);
    expect(calls.map((call) => call.command)).not.toContain('operation_cancel');
  });

  test('編譯中按停止會送出 operation_cancel', async ({ page }) => {
    // 編譯階段中止不影響任何硬體，因此仍允許取消。
    await openReadyProject(page);
    await page.locator('#btn-run').click();
    await page.waitForFunction(() => window.CodeBridgeCompile.isBusy());
    await page.locator('#btn-stop').click();

    await page.waitForFunction(
      () => window.__MOCK_CLI_CALLS__.some((call) => call.command === 'operation_cancel')
    );
    const calls = await readCliCalls(page);
    const cancel = calls.find((call) => call.command === 'operation_cancel');
    expect(cancel.args.id).toBe('op-compile');
  });

  test('沒有作業進行時按停止不會呼叫後端', async ({ page }) => {
    await openReadyProject(page);

    await page.locator('#btn-stop').click();
    await page.waitForTimeout(150);

    const calls = await readCliCalls(page);
    expect(calls.filter((call) => call.command === 'operation_cancel')).toHaveLength(0);
  });

  test('upload_ready 為 false 時不送出 upload_start', async ({ page }) => {
    await openReadyProject(page);
    await setCliResponse(page, { uploadReady: false });

    await page.locator('#btn-run').click();
    await emitCompileSucceeded(page);
    await page.waitForTimeout(300);

    const calls = await readCliCalls(page);
    expect(calls.map((call) => call.command)).toEqual(['compile_start', 'upload_ready']);
  });


  test('後端編譯失敗時以終端機與 toast 呈現錯誤並解除 busy', async ({ page }) => {
    await openReadyProject(page);
    await setCliResponse(page, { errors: { compile_start: 'CLI_ERROR_INVALID_FQBN' } });

    await page.locator('#btn-run').click();
    await page.waitForFunction(
      () => window.__MOCK_CLI_CALLS__.length > 0 && !window.CodeBridgeCompile.isBusy()
    );

    const lines = (await terminalLines(page)).join('\n');
    expect(lines).toContain('開發板設定不正確');
    await expect(page.locator('.cb-toast').first()).toBeVisible();
  });

  test('compile-diagnostics 事件會標記程式碼面板對應的行', async ({ page }) => {
    await openReadyProject(page);
    await page.locator('#btn-run').click();
    await page.waitForFunction(() => window.CodeBridgeCompile.isBusy());
    // 先發編詯失敗，避開前端在成功後接續上傳。
    await emitMockEvent(page, 'codebridge://operation-status', {
      operationId: 'op-compile', kind: 'compile', state: 'failed', lines: []
    });

    const lineIndex = await page.evaluate(() => {
      const nodes = document.querySelectorAll('#codeContent .code-line[data-line-index]');
      return nodes.length > 2 ? 2 : nodes.length - 1;
    });
    const compileOperationId = await page.evaluate(() => window.CodeBridgeCompile.getState().compileOperationId);

    await emitMockEvent(page, 'codebridge://compile-diagnostics', {
      operationId: compileOperationId,
      inoFileName: 'Blink.ino',
      success: false,
      diagnostics: [
        { file: 'Blink.ino', line: lineIndex + 1, column: 3, severity: 'error', message: "expected ';' before '}'" },
        { file: 'SPI.h', line: 12, column: 1, severity: 'warning', message: 'library warning' }
      ]
    });

    await expect(
      page.locator(`#codeContent .code-line[data-line-index="${lineIndex}"]`)
    ).toHaveClass(/diag-error/);

    // 函式庫核心檔的診斷不得標記到使用者程式碼
    const marked = await page.evaluate(() => document.querySelectorAll(
      '#codeContent .code-line.diag-error, #codeContent .code-line.diag-warning, #codeContent .code-line.diag-note'
    ).length);
    expect(marked).toBe(1);

    // 診斷事件同時解除 busy，讓使用者可以再按一次執行
    await expect.poll(() => page.evaluate(() => window.CodeBridgeCompile.isBusy())).toBe(false);
  });

  test('清除診斷標記會移除所有 severity 的樣式', async ({ page }) => {
    await openReadyProject(page);
    await page.locator('#btn-run').click();
    await page.waitForFunction(() => window.CodeBridgeCompile.getState().compileOperationId);
    const compileOperationId = await page.evaluate(() => window.CodeBridgeCompile.getState().compileOperationId);

    // 一次事件帶兩種 severity，模擬 gcc 同時回報錯誤與提示
    await emitMockEvent(page, 'codebridge://compile-diagnostics', {
      operationId: compileOperationId,
      inoFileName: 'Blink.ino',
      success: false,
      diagnostics: [
        { file: 'Blink.ino', line: 2, column: 1, severity: 'error', message: 'boom' },
        { file: 'Blink.ino', line: 3, column: 1, severity: 'note', message: 'hint' }
      ]
    });
    await expect(page.locator('#codeContent .code-line.diag-error')).toHaveCount(1);
    await expect(page.locator('#codeContent .code-line.diag-note')).toHaveCount(1);

    await page.evaluate(() => window.CodeBridgeCompile.clearDiagnosticMarks());
    await expect(page.locator('#codeContent .code-line.diag-error')).toHaveCount(0);
    await expect(page.locator('#codeContent .code-line.diag-note')).toHaveCount(0);
  });

  test('operation-status 事件會把進度附加到終端機', async ({ page }) => {
    await openReadyProject(page);
    await page.locator('#btn-run').click();
    await page.waitForFunction(() => window.CodeBridgeCompile.isBusy());

    await emitMockEvent(page, 'codebridge://operation-status', {
      operationId: 'op-compile',
      kind: 'compile',
      kindLabel: 'CLI_OPERATION_COMPILE',
      state: 'running',
      step: 2,
      stepCount: 3,
      lastLine: 'Compiling sketch...'
    });

    await expect.poll(async () => (await terminalLines(page)).join('\n'))
      .toContain('Compiling sketch...');
  });

  test('後端一次 flush 送出的多行會全部依序附加到終端機', async ({ page }) => {
    // T2-D 前置：舊後端只保留「最後一行」，中間行全部遺失。
    // 現在 payload 以 lines 陣列送出整批，終端機必須完整呈現。
    await openReadyProject(page);
    await page.locator('#btn-run').click();
    await page.waitForFunction(() => window.CodeBridgeCompile.isBusy());

    await emitMockEvent(page, 'codebridge://operation-status', {
      operationId: 'op-compile',
      kind: 'compile',
      kindLabel: 'CLI_OPERATION_COMPILE',
      state: 'running',
      lines: [
        { text: 'Using board: arduino:avr:uno', stream: 'stdout' },
        { text: 'Compiling sketch...', stream: 'stderr' },
        { text: 'Sketch uses 1918 bytes', stream: 'stdout' }
      ],
      lineCount: 3
    });

    await expect.poll(async () => (await terminalLines(page)).join('\n'))
      .toContain('Sketch uses 1918 bytes');
    const output = (await terminalLines(page)).join('\n');
    expect(output).toContain('Using board: arduino:avr:uno');
    expect(output).toContain('Compiling sketch...');
    // 行序必須與後端送出順序一致。
    expect(output.indexOf('Using board')).toBeLessThan(output.indexOf('Compiling sketch'));
    expect(output.indexOf('Compiling sketch')).toBeLessThan(output.indexOf('Sketch uses 1918'));
  });

  test('stderr 的輸出以錯誤樣式呈現，stdout 為一般樣式', async ({ page }) => {
    await openReadyProject(page);
    await page.locator('#btn-run').click();
    await page.waitForFunction(() => window.CodeBridgeCompile.isBusy());

    await emitMockEvent(page, 'codebridge://operation-status', {
      operationId: 'op-compile',
      kind: 'compile',
      state: 'running',
      lines: [
        { text: 'normal output', stream: 'stdout' },
        { text: 'compiler warning', stream: 'stderr' }
      ]
    });

    await expect.poll(async () => (await terminalLines(page)).join('\n'))
      .toContain('compiler warning');
    const classes = await page.evaluate(() => Array.from(
      document.querySelectorAll('#terminalContent .terminal-line')
    ).map((node) => ({ text: node.textContent, className: node.className })));
    const normal = classes.find((entry) => entry.text === 'normal output');
    const warning = classes.find((entry) => entry.text === 'compiler warning');
    expect(normal.className).toContain('terminal-line--info');
    expect(warning.className).toContain('terminal-line--error');
  });

  test('其他作業（例如安裝開發板核心）的事件不混入本次輸出', async ({ page }) => {
    await openReadyProject(page);
    await page.locator('#btn-run').click();
    await page.waitForFunction(() => window.CodeBridgeCompile.isBusy());

    await emitMockEvent(page, 'codebridge://operation-status', {
      operationId: 'board-install',
      kind: 'core_install',
      state: 'running',
      lastLine: 'downloading arduino:avr'
    });
    await page.waitForTimeout(200);

    expect((await terminalLines(page)).join('\n')).not.toContain('downloading arduino:avr');
  });
});
