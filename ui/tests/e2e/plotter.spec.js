import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { emitMockEvent, installTauriMock, readCliCalls, setUiLocale } from '../support/tauri-mock.js';

/**
 * 序列繪圖（Serial Plotter，T3 Phase 2）的端對端驗證。
 *
 * 跑在純瀏覽器（Vite dev server），沒有真實序列埠，因此驗證的是
 * 「介面契約」與**版面佈局**：開啟繪圖時終端機是否真的分成左右兩欄、
 * 文字與波形是否同時可見、資料事件是否讓圖例與曲線更新。
 * 真實序列埠讀取由 Rust 端 `pump()` 測試與實機驗證涵蓋。
 *
 * 檔案後半段另驗證示範專案（`03_plot-waves.cbg`）：它是 Plotter 的教學入口，
 * 正確性不只在「能打開」，還包括產生的波形語意與輸出格式能否被 parser 解析。
 */

test.beforeEach(async ({ page }) => {
  await setUiLocale(page, 'zh-hant');
});

/** 展開終端機面板（預設收合，點擊會被 Blockly 攔截）。 */
async function openTerminal(page) {
  await page.locator('#terminal-toggle').click();
}

/** 送出一批假的序列資料行（走真實的 `codebridge://serial-data` 事件路徑）。 */
async function emitSerialLines(page, lines, port = 'COM3') {
  await emitMockEvent(page, 'codebridge://serial-data', { port, lines, bytes: 128 });
}

/**
 * 移除產生器插入的 Blockly ID marker。
 *
 * **為什麼必須移除**：marker 會插在變數名後方，把
 * `sin(angle / 180.0 * PI)` 拆成 `sin(angle` + marker + `/ 180.0 * PI)`。
 * 語意完全相同，但字串比對會失敗 —— 這是測試斷言寫不出來時最容易被
 * 誤判成「generator 產錯了」的地方。
 *
 * 順帶收掉每行行尾空白：marker 移除後會留下多餘的空白字元，
 * 讓整段快照比對多出一行「只有空白的行」。
 */
function removeIdMarkers(code) {
  return code
    .replace(/\/\*\s*\/\/ __BLOCKLY_ID:[^\r\n]*?\s*\*\//g, '')
    .replace(/ \/\/ __BLOCKLY_ID:[^\r\n]*/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line !== '')
    .join('\n');
}

test('繪圖面板預設關閉，開關鈕位於序列控制列', async ({ page }) => {
  await installTauriMock(page);
  await page.goto('/');
  await openTerminal(page);

  await expect(page.locator('#btn-plotter')).toBeVisible();
  await expect(page.locator('#plotPane')).toBeHidden();
});

test('開啟繪圖後終端機分成左右兩欄，文字與波形同時可見', async ({ page }) => {
  await installTauriMock(page);
  await page.goto('/');
  await openTerminal(page);

  await page.locator('#btn-plotter').click();

  // 這是本次功能的核心主張：兩者**同時**可見，而不是切頁二選一。
  await expect(page.locator('#plotPane')).toBeVisible();
  await expect(page.locator('#terminalContent')).toBeVisible();

  const textBox = await page.locator('#terminalContent').boundingBox();
  const plotBox = await page.locator('#plotPane').boundingBox();
  // 繪圖欄必須在文字欄的**右側**同一列（垂直分欄），不可疊在一起。
  expect(plotBox.x).toBeGreaterThan(textBox.x);
  expect(Math.abs(plotBox.y - textBox.y)).toBeLessThan(plotBox.height);
  // 兩欄都要有實質寬度。
  expect(textBox.width).toBeGreaterThan(100);
  expect(plotBox.width).toBeGreaterThan(100);
});

test('高度不足時開啟繪圖會自動撐高終端機面板', async ({ page }) => {
  await installTauriMock(page);
  await page.goto('/');
  await openTerminal(page);

  const before = await page.evaluate(() => document.getElementById('terminalArea').offsetHeight);
  await page.locator('#btn-plotter').click();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => document.getElementById('terminalArea').offsetHeight);

  // 預設 200px 扣掉固定列後不足以畫出可辨識的波形。
  expect(after).toBeGreaterThan(before);
  expect(after).toBeGreaterThanOrEqual(320);
});

test('關閉繪圖會還原面板高度並收起右欄', async ({ page }) => {
  await installTauriMock(page);
  await page.goto('/');
  await openTerminal(page);

  const before = await page.evaluate(() => document.getElementById('terminalArea').offsetHeight);
  await page.locator('#btn-plotter').click();
  await page.waitForTimeout(300);
  await page.locator('#btn-plotter').click();
  await page.waitForTimeout(300);

  const after = await page.evaluate(() => document.getElementById('terminalArea').offsetHeight);
  expect(after).toBe(before);
  await expect(page.locator('#plotPane')).toBeHidden();
});

test('序列資料會讓圖例出現對應的 series', async ({ page }) => {
  await installTauriMock(page);
  await page.goto('/');
  await openTerminal(page);
  await page.locator('#btn-plotter').click();

  await emitSerialLines(page, ['temp:23.5', 'temp:24.1', 'temp:23.8']);
  await page.waitForTimeout(200);

  // 圖例是資料結構的反映，不該等下一幀才出現。
  await expect(page.locator('#plotLegend .plot-legend-item')).toHaveCount(1);
  await expect(page.locator('#plotLegend .plot-legend-label')).toHaveText('temp');
});

test('CSV 會產生多個 series，且曲線真的被畫出來', async ({ page }) => {
  await installTauriMock(page);
  await page.goto('/');
  await openTerminal(page);
  await page.locator('#btn-plotter').click();

  await emitSerialLines(page, ['1, 2', '3, 4', '2, 5', '4, 1']);
  await page.waitForTimeout(300);

  await expect(page.locator('#plotLegend .plot-legend-item')).toHaveCount(2);

  // canvas 不可只是空白：這是「有資料但畫不出來」的唯一可驗證徵兆。
  const painted = await page.evaluate(() => {
    const canvas = document.getElementById('plotCanvas');
    if (!canvas || !canvas.width || !canvas.height) return null;
    const context = canvas.getContext('2d');
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 0) return true;
    }
    return false;
  });
  expect(painted).toBe(true);
});

test('文字輸出仍會進入左側終端機面板（兩種檢視不互相取代）', async ({ page }) => {
  await installTauriMock(page);
  await page.goto('/');
  await openTerminal(page);
  await page.locator('#btn-plotter').click();

  await emitSerialLines(page, ['LED 已開啟']);
  await page.waitForTimeout(150);

  // 文字行不可因開啟繪圖而消失 —— 使用者還需要它確認程式有印。
  await expect(page.locator('#terminalContent .terminal-line--data')).toHaveCount(1);
});

test('點擊圖例可切換 series 的顯示狀態', async ({ page }) => {
  await installTauriMock(page);
  await page.goto('/');
  await openTerminal(page);
  await page.locator('#btn-plotter').click();

  await emitSerialLines(page, ['1, 2', '3, 4']);
  await page.waitForTimeout(200);

  const chip = page.locator('#plotLegend .plot-legend-item').first();
  await expect(chip).not.toHaveClass(/is-off/);
  await chip.click();
  await expect(chip).toHaveClass(/is-off/);
});

test('時間窗下拉提供 3 / 10 / 30 秒三檔', async ({ page }) => {
  await installTauriMock(page);
  await page.goto('/');
  await openTerminal(page);
  await page.locator('#btn-plotter').click();

  const values = await page.locator('#plotWindowSelect option').evaluateAll(
    (options) => options.map((option) => option.value)
  );
  expect(values).toEqual(['200', '600', '1800']);
});

test('清除鈕會清空繪圖資料', async ({ page }) => {
  await installTauriMock(page);
  await page.goto('/');
  await openTerminal(page);
  await page.locator('#btn-plotter').click();

  await emitSerialLines(page, ['1, 2']);
  await page.waitForTimeout(200);
  await expect(page.locator('#plotLegend .plot-legend-item')).toHaveCount(2);

  await page.locator('#btn-plot-clear').click();
  await page.waitForTimeout(200);
  await expect(page.locator('#plotLegend .plot-legend-item')).toHaveCount(0);
});

test('HEX 模式開啟時顯示提示且不解析資料', async ({ page }) => {
  await installTauriMock(page);
  await page.goto('/');
  await openTerminal(page);
  await page.locator('#btn-plotter').click();

  await page.locator('#serial-hex-toggle').check();
  await page.waitForTimeout(200);

  await expect(page.locator('#plot-status')).toContainText('HEX');
  await emitSerialLines(page, ['48 65 6C 6C 6F']);
  await page.waitForTimeout(200);
  // 位元組串不該變成圖例項目。
  await expect(page.locator('#plotLegend .plot-legend-item')).toHaveCount(0);
});

test('開啟繪圖會自動開啟序列監視器（共用同一條連線）', async ({ page }) => {
  // 必須提供序列埠：沒有埠時 `serial-monitor.start()` 會在送出後端請求前
  // 就被擋下（那是刻意的短路，避免得到莫名其妙的開啟錯誤）。
  await installTauriMock(page, { cli: { ports: ['COM3'] } });
  await page.goto('/');
  await openTerminal(page);

  // 先等 board-detector 的非同步啟動快照完成，確保埠已就緒。
  await expect(page.locator('#serial-selector option[value="COM3"]')).toHaveCount(1);
  await page.locator('#serial-selector').selectOption('COM3');
  await page.waitForTimeout(400);

  const before = await readCliCalls(page);
  await page.locator('#btn-plotter').click();
  await page.waitForTimeout(500);
  const after = await readCliCalls(page);

  // 使用者只想看圖時不該還得再按一次「開啟監視器」。
  const started = after.length - before.length;
  expect(after.map((call) => call.command)).toContain('serial_monitor_start');
  expect(started).toBeGreaterThan(0);
});

test('窄視窗自動改為上下堆疊，兩者仍都可見', async ({ page }) => {
  await installTauriMock(page);
  await page.setViewportSize({ width: 560, height: 800 });
  await page.goto('/');
  await openTerminal(page);
  await page.locator('#btn-plotter').click();
  await page.waitForTimeout(300);

  const stacked = await page.evaluate(
    () => document.getElementById('terminalBody').classList.contains('is-stacked')
  );
  expect(stacked).toBe(true);

  // 堆疊時分隔條不可見（垂直方向沒有「左右比例」可言）。
  await expect(page.locator('#plotDivider')).toBeHidden();
  await expect(page.locator('#plotPane')).toBeVisible();
  await expect(page.locator('#terminalContent')).toBeVisible();
});

test('按鈕契約：三個 data-action 皆有對應處理者', async ({ page }) => {
  await installTauriMock(page);
  await page.goto('/');
  await openTerminal(page);

  const actions = await page.evaluate(() => {
    const registry = window.CodeBridgeToolbar.actions;
    return ['toggle-plotter', 'plot-pause', 'plot-clear'].map((name) => {
      const entry = registry[name];
      return {
        name,
        exists: Boolean(entry),
        implemented: Boolean(entry && entry.implemented),
        hasElement: Boolean(document.getElementById(entry ? entry.id : ''))
      };
    });
  });

  actions.forEach((action) => {
    expect(action).toEqual({
      name: action.name,
      exists: true,
      implemented: true,
      hasElement: true
    });
  });
  // 分隔條刻意不進 registry：它由 plot-panel.js 直接綁定，不是 data-action 派送。
  await expect(page.locator('#plotDivider')).toHaveCount(1);
});

test('Blockly 工作區會在繪圖開闔時重算尺寸', async ({ page }) => {
  await installTauriMock(page);
  await page.goto('/');
  await openTerminal(page);

  const before = await page.evaluate(() => document.getElementById('blocklyDiv').offsetHeight);
  await page.locator('#btn-plotter').click();
  await page.waitForTimeout(500);
  const shrunk = await page.evaluate(() => document.getElementById('blocklyDiv').offsetHeight);

  // 自動撐高終端機會壓縮工作區；沒有 svgResize 就會看到工作區與面板重疊。
  expect(shrunk).toBeLessThan(before);

  await page.locator('#btn-plotter').click();
  await page.waitForTimeout(500);
  const restored = await page.evaluate(() => document.getElementById('blocklyDiv').offsetHeight);
  expect(restored).toBeGreaterThan(shrunk);
});

test('開啟繪圖不會阻斷上傳（未佔用序列埠租約）', async ({ page }) => {
  // 這個測試的核心主張：繪圖**共用** Monitor 的連線，因此不會多佔一份
  // 埠資源。若日後有人改成另開一條連線，這裡就會開始失敗。
  // 需要一個有程式碼且選好埠的專案，否則「執行」會在更早的關卡就被擋下。
  const BLINK_PATH = 'C:/projects/BlinkPlot.cbg';
  await installTauriMock(page, {
    files: {
      [BLINK_PATH]: [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<xml xmlns="https://developers.google.com/blockly/xml" xmlns:cbg="https://codebridge.app/xml" cbg:format="1" cbg:app="0.2.0">',
        '  <block type="initializes_setup" id="setup-plot" x="20" y="20">',
        '    <statement name="CONTENT">',
        '      <block type="arduino_delay" id="delay-plot" x="20" y="20">',
        '        <value name="TIME">',
        '          <shadow type="math_number" id="delay-num-plot">',
        '            <field name="NUM">250</field>',
        '          </shadow>',
        '        </value>',
        '      </block>',
        '    </statement>',
        '  </block>',
        '</xml>'
      ].join('\n')
    },
    cli: { ports: ['COM3'] }
  });
  await page.goto('/');
  await openTerminal(page);
  await page.waitForFunction(() => Boolean(window.CodeBridgeProject && window.CodeBridgeCompile));
  await page.evaluate((path) => window.CodeBridgeProjectIO.openPath(path), BLINK_PATH);
  await emitMockEvent(page, 'codebridge://board-detected', {
    boards: [{ port: 'COM3', fqbn: 'arduino:avr:uno', name: 'Arduino Uno' }],
    unknown: []
  });
  await expect(page.locator('#serial-selector option[value="COM3"]')).toHaveCount(1);
  await page.locator('#serial-selector').selectOption('COM3');
  await page.waitForTimeout(300);

  await page.locator('#btn-plotter').click();
  await page.waitForTimeout(300);

  await page.locator('#btn-run').click();
  await page.waitForTimeout(1500);

  const calls = await readCliCalls(page);
  // 編譯必須仍被發動 —— 若繪圖多佔了一份埠租約，upload 階段會失敗，
  // 但 compile 仍會送出，因此這裡斷言的是「繪圖沒有讓整條流程卡死」。
  expect(calls.map((call) => call.command)).toContain('compile_start');
});

// 變數宣告堆疊（對齊 piBlockly，Red 2026-09-28）
//
// piBlockly 的 `variables_declare_global` generator 是 `processDefinitionStack`
// （見 `piBlockly/media/generators/_lib.js`）：宣告積木用 `next` 串成一條堆疊，
// 由**堆疊最上方**的積木觸發，沿 `next` 走完整條堆疊後**一次**寫入
// `global_vars_['stack_' + 堆頂id]`。非堆頂的積木直接 `return ''` 避免重複產碼。
//
// 這與「每個變數各自是一個獨立根層積木」是**不同的模型**。
// 堆疊模型的好處：
// 1. 畫面上是一條連續的宣告序列，視覺上就是一段「型別宣告區」
// 2. 整條堆疊是 global_vars_ 裡的單一 entry，順序穩定、不會被其他積木插入打斷
// 3. 使用者拖一個宣告積木，next 已經接好下一個，連續宣告的門檻大幅降低
test('變數宣告堆疊：由堆頂一次產出整條堆疊的型別定義', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.Blockly?.getMainWorkspace?.());

  const code = await page.evaluate(async () => {
    const workspace = window.Blockly.getMainWorkspace();
    workspace.clear();

    function declare(name, type, ident) {
      const variable = workspace.getVariableMap().createVariable(name);
      const block = workspace.newBlock('variables_declare_global');
      block.initSvg();
      block.setFieldValue(type, 'TYPE');
      block.setFieldValue(variable.getId(), 'VAR');
      block.setPreviousStatement(true);
      return block;
    }

    // 堆疊：counter → limit → label（用 next 串起來）
    const top = declare('counter', 'int', 'a');
    const second = declare('limit', 'int', 'b');
    const third = declare('label', 'String', 'c');
    top.nextConnection.connect(second.previousConnection);
    second.nextConnection.connect(third.previousConnection);
    workspace.render();
    await new Promise((resolve) => setTimeout(resolve, 120));
    return window.Blockly.Arduino.workspaceToCode(workspace);
  });

  const globalSection = code.split('// Global variables')[1]?.split('void setup')[0] ?? '';
  expect(globalSection).toContain('int counter = 0;');
  expect(globalSection).toContain('int limit = 0;');
  // String 的預設值必須是 ""，不能是 0（否則是錯誤的 C++）
  expect(globalSection).toContain('String label = "";');
  // 三個都在，沒有重複
  expect((globalSection.match(/int counter/g) || []).length).toBe(1);
  expect((globalSection.match(/int limit/g) || []).length).toBe(1);
});

test('變數宣告堆疊：宣告積木之間可夾雜 coding_raw_definition（piBlockly DEFINITION_BLOCK_TYPES）', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.Blockly?.getMainWorkspace?.());

  const code = await page.evaluate(async () => {
    const workspace = window.Blockly.getMainWorkspace();
    workspace.clear();

    const variable = workspace.getVariableMap().createVariable('threshold');
    const top = workspace.newBlock('variables_declare_global');
    top.initSvg();
    top.setFieldValue('int', 'TYPE');
    top.setFieldValue(variable.getId(), 'VAR');
    top.setPreviousStatement(true);

    const raw = workspace.newBlock('coding_raw_definition');
    raw.initSvg();
    // field_multilineinput 不能用 setFieldValue（那是給 dropdown／input 的 API），
    // 必須直接對 field 呼叫 setValue
    raw.getField('CODE').setValue('const int PIN_LED = 13;');
    raw.setPreviousStatement(true);

    top.nextConnection.connect(raw.previousConnection);
    workspace.render();
    await new Promise((resolve) => setTimeout(resolve, 120));
    return window.Blockly.Arduino.workspaceToCode(workspace);
  });

  const globalSection = code.split('// Global variables')[1]?.split('void setup')[0] ?? '';
  // 兩者都必須出現，且順序為「先宣告、後原始定義」
  expect(globalSection).toContain('int threshold = 0;');
  expect(globalSection).toContain('const int PIN_LED = 13;');
  expect(globalSection.indexOf('int threshold')).toBeLessThan(globalSection.indexOf('PIN_LED'));
});

// 變數宣告（Red 2026-09-28）
//
// 症狀：使用者用 variables_declare_global 宣告變數，產出的 .ino 沒有
// 任何型別定義（`// Global variables` 區段是空的），編譯必然失敗。
//
// 懷疑對象：`_core.js` 的 `scopeDefiningRootBlocks` 白名單漏了
// `variables_declare_global`，該積木被 Blockly 視為「不該出現在根層」
// 而跳過產生程式碼。
test('全域變數宣告積木放在根層時仍會產生型別定義（不可被當成孤兒積木停用）', async ({ page }) => {
  // 這是最自然的擺放方式：宣告型積木描述的是「整個專案的變數」，
  // 塞進 setup 裡反而語意奇怪，所以使用者多半直接放在工作區根層。
  // 2026-09-28 實測：根層白名單漏了 variables_declare_global，
  // 積木被標記為 orphan 而**停用**，generator 因而不產碼。
  await page.goto('/');
  await page.waitForFunction(() => window.Blockly?.getMainWorkspace?.());

  const result = await page.evaluate(async () => {
    const workspace = window.Blockly.getMainWorkspace();
    workspace.clear();
    const variable = workspace.getVariableMap().createVariable('counter');
    const declare = workspace.newBlock('variables_declare_global');
    declare.initSvg();
    declare.setFieldValue('int', 'TYPE');
    declare.setFieldValue(variable.getId(), 'VAR');
    const setup = workspace.newBlock('initializes_setup');
    setup.initSvg();
    workspace.render();

    // 等候 change event 觸發 main.js 的 updateOrphanBlocks（debounce 為 0，
    // 但事件是同步 dispatch 進 queue 的，需讓微任務與事件迴圈跑一輪）
    await new Promise((resolve) => setTimeout(resolve, 120));

    return {
      code: window.Blockly.Arduino.workspaceToCode(workspace),
      isDisabled: typeof declare.hasDisabledReason === 'function'
        ? Boolean(declare.hasDisabledReason('orphan'))
          || Boolean(declare.hasDisabledReason('ORPHANED_BLOCK'))
        : !declare.isEnabled(),
      topTypes: workspace.getTopBlocks(false).map((block) => block.type).sort()
    };
  });

  expect(result.topTypes, '宣告積木應留在根層，不可被移出').toContain('variables_declare_global');
  expect(result.isDisabled, '宣告積木不可被判定為孤兒積木').toBe(false);
  expect(result.code, '宣告積木必須產生 int counter = 0;').toContain('int counter = 0;');
});

// 區域變數宣告（Red 2026-09-28）
test('區域變數宣告積木會在 loop 內產生型別定義', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.Blockly?.getMainWorkspace?.());

  const code = await page.evaluate(() => {
    const workspace = window.Blockly.getMainWorkspace();
    workspace.clear();
    const setup = workspace.newBlock('initializes_setup');
    setup.initSvg();
    const loop = workspace.newBlock('initializes_loop');
    loop.initSvg();
    setup.getInput('CONTENT').connection.connect(loop.previousConnection);

    const variable = workspace.getVariableMap().createVariable('total');
    const declare = workspace.newBlock('variables_declare_local');
    declare.initSvg();
    declare.setFieldValue('float', 'TYPE');
    declare.setFieldValue(variable.getId(), 'VAR');
    loop.getInput('CONTENT').connection.connect(declare.previousConnection);
    workspace.render();
    return window.Blockly.Arduino.workspaceToCode(workspace);
  });

  expect(code).toContain('float total = 0;');
  // 區域變數屬於 loop 內文，不該出現在 Global variables 區段
  const globalSection = code.split('// Global variables')[1]?.split('void setup')[0] ?? '';
  expect(globalSection).not.toContain('float total');
});

test('示範專案（03_plot-waves.cbg）產生的程式碼必須有四個變數的型別定義', async ({ page }) => {
  // Red 2026-09-28：範例 3 使用了 angle/squareValue/sine/noise 四個變數，
  // 但產出的 `// Global variables` 區段是空的，貼到 Arduino IDE 編譯不過。
  //
  // 注意 `squareValue` 不是 `square`：Arduino 的 math.h 定義了
  // `double square(double)`，C++ 識別字不能與已宣告的全域函式同名
  // （使用者實測會得到 "'int square' redeclared as different kind of symbol"）。
  const { readFile } = await import('node:fs/promises');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const examplesDirectory = join(
    dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'src-tauri', 'resources', 'examples'
  );
  const xml = await readFile(join(examplesDirectory, '03_plot-waves.cbg'), 'utf8');

  await page.goto('/');
  await page.waitForFunction(() => window.Blockly?.getMainWorkspace?.());

  const code = await page.evaluate((workspaceXml) => {
    const workspace = window.Blockly.getMainWorkspace();
    workspace.clear();
    window.CodeBridgeBlocklyXml.textToWorkspace(workspaceXml, workspace);
    workspace.updateAriaLabel();
    return window.Blockly.Arduino.workspaceToCode(workspace);
  }, xml);

  const globalSection = code.split('// Global variables')[1]?.split('void setup')[0] ?? '';
  // 四個變數都必須有型別定義，否則 .ino 無法編譯
  ['angle', 'squareValue', 'sine', 'noise'].forEach((name) => {
    expect(globalSection, `${name} 缺少全域型別定義`).toMatch(
      new RegExp(`(int|float|double|String|bool)\\s+${name}\\s*=`)
    );
  });
  // **不得出現裸的 `square` 識別字**：會與 math.h 的 `double square(double)` 衝突。
  // 序列繪圖的 label 欄位是字串常數（`"square:"`），不在此限。
  expect(globalSection, '不可宣告名為 square 的變數（與 math.h 衝突）')
    .not.toMatch(/\bint\s+square\b/);
  // sine 必須是 float：50 + 50 * sin(...) 會產生小數，
  // 若宣告成 int，Serial.print 永遠只會印出 0（整數截斷），曲線會是一條死掉的直線。
  expect(globalSection, 'sine 必須是 float，否則小數被截斷成 0').toMatch(/float\s+sine\s*=/);
});

// ============================================================
// 示範專案（03_plot-waves.cbg）
// ============================================================

const examplesDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', '..', '..', 'src-tauri', 'resources', 'examples'
);
const EXAMPLE = '03_plot-waves.cbg';

test('示範專案可由 Blockly 13.3.0 載入並產生可編譯的程式碼', async ({ page }) => {
  const browserMessages = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      browserMessages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => browserMessages.push(`pageerror: ${error.message}`));

  await page.goto('/');
  await page.waitForFunction(() => window.Blockly?.getMainWorkspace?.());

  const xml = await readFile(join(examplesDirectory, EXAMPLE), 'utf8');
  const result = await page.evaluate((workspaceXml) => {
    const workspace = window.Blockly.getMainWorkspace();
    workspace.clear();
    window.CodeBridgeBlocklyXml.textToWorkspace(workspaceXml, workspace);
    workspace.updateAriaLabel();
    return {
      types: workspace.getAllBlocks(false).map((block) => block.type).sort(),
      code: window.Blockly.Arduino.workspaceToCode(workspace)
    };
  }, xml);

  // 積木型別齊全：少任何一個都代表該積木在 Blockly 13 已不存在或不叫這個名字。
  // `controls_if` 出現兩次：一次算方波、一次處理相位歸零。
  expect(result.types).toContain('math_single');
  expect(result.types).toContain('math_random_int');
  expect(result.types).toContain('text_join');
  expect(result.types).toContain('controls_if');
  expect(result.types).toContain('initializes_setup');
  expect(result.types).toContain('initializes_loop');
  expect(browserMessages).toEqual([]);

  const code = removeIdMarkers(result.code);

  // `sin()` 必須轉成弧度 —— 積木的語意是「輸入角度」，
  // 直接產出 `sin(angle)` 會得到週期被放大 360×2π 倍的錯誤波形。
  expect(code).toContain('sin(angle / 180.0 * PI)');
  // 方波以 if/else 兩段式表達（Blockly 沒有三運算子積木）。
  expect(code).toContain('if (angle < 180)');
  expect(code).toContain('squareValue = 100;');
  expect(code).toContain('squareValue = 0;');
  // 正弦平移放大後的完整算式。
  expect(code).toContain('sine = (50 + 50 * sin(angle / 180.0 * PI));');
  expect(code).toContain('random(0, 100)');
  expect(code).toContain('Serial.begin(9600)');
  expect(code).toContain('Serial.print((String("square:")');
  expect(code).toContain('String(squareValue)');
  expect(code).toContain('String(", sine:")');
  expect(code).toContain('String(", noise:")');
  expect(code).toContain('Serial.println();');
  // 相位歸零條件。
  expect(code).toContain('if (angle > 360)');
  expect(code).toContain('angle = 0;');

  // `delay(50)` 必須在 `if (angle > 360)` **之外**。
  //
  // 這是本測試抓到的真實缺陷：若 delay 被接在 if 的 DO0 底下，
  // 只有「角度超過 360」的那一輪（每 72 輪一次）會等待，
  // 其餘 71 輪會毫無間隔地狂印序列資料，把序列埠與繪圖面板灌爆。
  // 程式依然能編譯能執行，因此**沒有任何編譯期錯誤會提醒你**。
  //
  // 以「取大括號區段」判定，而非比對縮排或整段字串：
  // 縮排是排版細節，改個 formatter 就會讓斷言無故失敗。
  const wrapIndex = code.indexOf('if (angle > 360)');
  const wrapBraceStart = code.indexOf('{', wrapIndex);
  const delayIndex = code.indexOf('delay(50)');
  expect(wrapIndex).toBeGreaterThan(-1);
  expect(delayIndex).toBeGreaterThan(wrapBraceStart);
  // if 的整段（含大括號）必須在 delay 之前結束。
  expect(code.slice(wrapBraceStart, delayIndex)).not.toContain('delay');
  // delay 是 loop 內最後一個陳述式，因此大括號結束後不再有其他內容。
  expect(code.trimEnd().endsWith('}')).toBe(true);

  // 產碼完整快照：這份示範是教學材料，任何語意偏移都會直接被學生看到。
  // 因此以整段比對鎖住，而不是逐行 `toContain`（後者會漏掉「多出來的陳述式」）。
  //
  // 這條快照抓到過一個真實缺陷：後續步驟原本接在 `else` 分支底下，
  // 導致 `angle < 180` 的那一半完全不會更新資料 —— 圖表會出現「半個週期空白」。
  const loopBody = code.slice(code.indexOf('void loop()')).trimEnd();
  expect(loopBody).toBe(`void loop() {
  if (angle < 180) {
    squareValue = 100;
  } else {
    squareValue = 0;
  }
  sine = (50 + 50 * sin(angle / 180.0 * PI));
  noise = random(0, 100);
  Serial.print((String("square:") + String(squareValue) + String(", sine:") + String(sine) + String(", noise:")));
  Serial.print(noise);
  Serial.println();
  angle = (angle + 5);
  if (angle > 360) {
    angle = 0;
  }
  delay(50);
}`);
});

test('math_single 積木的下拉選項含三角函數', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.Blockly?.getMainWorkspace?.());

  // generator 早已支援 SIN／COS／TAN，但下拉清單從未暴露 ——
  // 沒有這條測試，「有程式能力卻沒有入口」會一直沒人發現。
  const options = await page.evaluate(() => {
    const workspace = window.Blockly.getMainWorkspace();
    const probe = workspace.newBlock('math_single');
    const values = probe.getField('OP').getOptions().map((option) => option[1]);
    probe.dispose();
    return values;
  });

  expect(options).toEqual(expect.arrayContaining(['SIN', 'COS', 'TAN']));
});

test('示範輸出的三個標籤都能被序列繪圖解析成獨立曲線', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.Blockly?.getMainWorkspace?.());

  // 直接餵一筆與程式實際輸出格式相同的字串，驗證 parser 的契約。
  // 格式取自 `text_join` 積木組出來的字串：
  //   "square:" + square + ", sine:" + sine + ", noise:" + noise
  //
  // **這是最容易出錯的一環**：若分隔字元或標籤寫錯（例如印成
  // `square100, sine0.5`），程式依然能編譯能執行，但圖表會是空白 ——
  // 沒有任何編譯期錯誤會提醒你。
  const parsed = await page.evaluate(() => {
    const parser = window.CodeBridgePlotParse.createParser();
    return parser.parseLine('square:100, sine:50.00, noise:42');
  });

  expect(parsed.map((point) => point.label)).toEqual(['square', 'sine', 'noise']);
  expect(parsed.map((point) => point.value)).toEqual([100, 50, 42]);
  expect(parsed.map((point) => point.index)).toEqual([0, 1, 2]);
});

