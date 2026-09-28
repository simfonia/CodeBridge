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
  // 2026-09-28 起 metadata 只承載 format 與 app。序列埠／開發板是
  // 「使用者身邊的硬體狀態」，不進檔案 —— 見 openReadyProject 的說明。
  '<xml xmlns="https://developers.google.com/blockly/xml" xmlns:cbg="https://codebridge.app/xml" cbg:format="1" cbg:app="0.2.0">',
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

/**
 * 開啟一個已具備完整前置條件的專案：工作區有程式碼，且序列埠下拉已選好。
 *
 * **為什麼要另外設定下拉**（2026-09-28 決策）：
 * 序列埠與開發板是使用者身邊的硬體，不是專案內容。它們不再存進 `.cbg`
 * metadata —— 舊做法曾造成「UI 顯示 COM4，但上傳報尚未選擇序列埠」，
 * 因為下拉（使用者眼前的真相）與 metadata（過期的記憶）不一致。
 *
 * 這裡走真實路徑：後端回報連接埠 → detector 填入下拉 → 使用者選取。
 * E2E 刻意不 stub `board-detector`，才能真正驗到上傳用的是下拉的值。
 */
async function openReadyProject(page) {
  await installTauriMock(page, {
    files: { [BLINK_PATH]: BLINK_PROJECT },
    // 板型對應走 `codebridge://board-detected` 事件（見 handleBoardsDetected），
    // 埠清單則由 `get_serial_ports` 帶回（見 pullInitialPorts）。
    // 給兩個埠，才能驗「上傳用的是使用者當下選的那個」。
    cli: { ports: ['COM3', 'COM4'] }
  });
  await setUiLocale(page, 'zh-hant');
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.CodeBridgeProject && window.CodeBridgeCompile));
  await page.evaluate(async (path) => {
    await window.CodeBridgeProjectIO.openPath(path);
  }, BLINK_PATH);
  await emitMockEvent(page, 'codebridge://board-detected', {
    // 兩個埠都要有板型對應：`fqbn` 由所選埠推導，缺了會擋在
    // `CLI_ERROR_NO_FQBN`，測不到「埠選對了沒」這件事。
    boards: [
      { port: 'COM3', fqbn: 'arduino:avr:uno', name: 'Arduino Uno' },
      { port: 'COM4', fqbn: 'arduino:avr:mega', name: 'Arduino Mega' }
    ],
    unknown: []
  });
  // 等偵測回填下拉後再選取，模擬使用者挑好開發板連接埠。
  await expect(page.locator('#serial-selector option[value="COM3"]')).toHaveCount(1);
  await page.locator('#serial-selector').selectOption('COM3');
  await page.waitForTimeout(300);
}
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
    // 停止鈕已于 2026-09-27 移除（作業已有逾時上限）。
    await expect(page.locator('#btn-stop')).toHaveCount(0);
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

  test('上傳燒到下拉當前選定的埠，即使與開檔時不同', async ({ page }) => {
    // 回歸測試（2026-09-28）。原始症狀：使用者眼前顯示 COM4，上傳卻燒到
    // 別的埠（或報「尚未選擇序列埠」）。根因是上傳讀了 `.cbg` metadata 裡的
    // port 快照，而下拉已被改過 —— 記憶與真相不一致。
    //
    // 這裡刻意改選 COM4 執行，斷言上傳用的是 COM4，也就是使用者看到的值。
    await openReadyProject(page);
    await page.locator('#serial-selector').selectOption('COM4');

    await page.locator('#btn-run').click();
    await emitCompileSucceeded(page);
    await page.waitForFunction(() => window.CodeBridgeCompile.getState().operationId === 'op-upload');

    const calls = await readCliCalls(page);
    const upload = calls.find((call) => call.command === 'upload_start');
    expect(upload.args.payload.port).toBe('COM4');
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

  // ============================================================
  // 核心／函式庫診斷分流（2026-09-28）
  // ============================================================

  test('終端機把使用者草稿的診斷與核心／函式庫的診斷分開呈現', async ({ page }) => {
    await openReadyProject(page);

    // 直接驗證分流函式 —— 這是本次修正的核心契約。
    const groups = await page.evaluate(() => window.CodeBridgeCompile.splitDiagnostics('Blink.ino', [
      { file: 'Blink.ino', line: 10, severity: 'error', message: 'expected ;' },
      { file: '/cores/arduino/new.cpp', line: 42, severity: 'warning', message: "unused parameter 'tag'" },
      { file: '/libraries/Wire/src/Wire.cpp', line: 7, severity: 'warning', message: 'lib warning' }
    ]));

    expect(groups.own, '使用者草稿的診斷要獨立成組').toHaveLength(1);
    expect(groups.own[0].message).toBe('expected ;');
    expect(groups.external, '核心與函式庫的診斷要另一組').toHaveLength(2);
    expect(groups.external.map((d) => d.file)).toEqual([
      '/cores/arduino/new.cpp',
      '/libraries/Wire/src/Wire.cpp'
    ]);
  });

  test('核心警告以摘要呈現，且不再冒充使用者錯誤', async ({ page }) => {
    await openReadyProject(page);

    await page.evaluate(() => {
      // 模擬真實情境：編譯成功，只有 AVR 核心自己的 unused parameter 警告。
      window.CodeBridgeCompile.renderDiagnostics('Blink.ino', [
        { file: '/cores/arduino/new.cpp', line: 42, column: 25, severity: 'warning',
          message: "unused parameter 'tag' [-Wunused-parameter]" }
      ]);
    });

    const output = await page.locator('#terminalContent').innerText();

    // 摘要標題必須出現，讓使用者知道「這些不是你的錯」
    expect(output).toContain('來自核心或函式庫的訊息');
    // 但也不能把原文藏起來 —— 學習者該知道工具鏈確實有噪音
    expect(output).toContain("unused parameter 'tag'");
  });

  test('使用者 .ino 的診斷仍原樣輸出，不被併進核心摘要', async ({ page }) => {
    await openReadyProject(page);

    await page.evaluate(() => {
      window.CodeBridgeCompile.renderDiagnostics('Blink.ino', [
        { file: 'Blink.ino', line: 3, column: 5, severity: 'error', message: "expected ';' before '}'" }
      ]);
    });

    const output = await page.locator('#terminalContent').innerText();
    expect(output).toContain("Blink.ino:3:5");
    expect(output).toContain("expected ';' before '}'");
    // 只有自己的診斷時不該出現核心摘要
    expect(output).not.toContain('來自核心或函式庫的訊息');
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
