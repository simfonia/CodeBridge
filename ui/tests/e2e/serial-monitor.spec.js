import { expect, test } from '@playwright/test';
import { emitMockEvent, installTauriMock, readCliCalls, setUiLocale } from '../support/tauri-mock.js';

/**
 * 序列監視器（T3）的端對端驗證。
 *
 * 跑在純瀏覽器（Vite dev server），沒有真實序列埠，因此驗證的是
 * 「介面契約」：控制列是否呈現、開關是否正確呼叫後端、事件資料是否
 * 正確進入終端機面板、開發者輸入行是否可用。
 * 真實序列埠讀取由 Rust 端 `pump()` 測試與 T3 實機驗證涵蓋。
 */

test.beforeEach(async ({ page }) => {
  await setUiLocale(page, 'zh-hant');
});

/**
 * `arduino_serial_begin` 積木的鮑率欄位（2026-09-28 使用者回報修正）。
 *
 * 使用者要求：**預設值改成 9600，但下拉清單順序維持遞增不動**。
 *
 * 這兩件事在 Blockly 裡是衝突的 —— `field_dropdown` 一律選第一個 option。
 * 常見的錯誤解法是把 9600 搬到清單第一項，代價是清單順序被打亂
 * （9600, 300, 1200...），使用者往下拉時順序是亂的。
 * 正確解法是保留 options 原序、在 `jsonInit` 之後 `setFieldValue`。
 *
 * 所以這裡要同時斷言兩件事，缺一不可。
 */
test('Serial.begin 預設鮑率為 9600，且下拉清單維持遞增順序', async ({ page }) => {
  await installTauriMock(page);
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.Blockly?.getMainWorkspace?.()));

  const result = await page.evaluate(() => {
    const workspace = window.Blockly.getMainWorkspace();
    const block = workspace.newBlock('arduino_serial_begin');
    const value = block.getFieldValue('BAUD');
    // 下拉清單的實際順序（Blockly 由 options 陣列建構）
    const options = block.getField('BAUD').getOptions().map((o) => o[1]);
    block.dispose();
    return { value, options };
  });

  expect(result.value, '預設鮑率').toBe('9600');

  // 清單必須是嚴格遞增，且 9600 在其中
  const numeric = result.options.map(Number);
  expect(numeric, '清單保持遞增順序，未因改預設而重排').toEqual(
    [...numeric].sort((a, b) => a - b)
  );
  expect(result.options).toContain('9600');
  expect(result.options[0], '9600 沒有被搬到第一項').not.toBe('9600');
});

/**
 * 程式碼預覽面板的行號（2026-09-28 新增）。
 *
 * 行號用 CSS counter 實作（`#codeContent` 的 `counter-reset` 配對
 * `.code-line` 的 `counter-increment`），行號是 `::before` pseudo-element。
 *
 * **斷言方式的重要陷阱**：`getComputedStyle(el, '::before').content`
 * 回傳的是**未解析的 `counter(line)`**，不是算出來的數字 ——
 * 瀏覽器不會把 counter 展開成具體數值。所以不能斷言「content 包含 1」。
 *
 * 這裡分兩件事驗：
 * 1. `content` 是 `counter(line)`（而非 `none`）→ 證明行號樣式有套用；
 *    計數本身由 CSS 語意保證，不在測試裡重算。
 * 2. 行號**不在 DOM 文字裡** → 這是選用 counter 而非插入節點的關鍵好處，
 *    「複製程式碼」不會混入行號數字。
 */
test('程式碼預覽面板每行都有行號，且行號不混入程式碼文字', async ({ page }) => {
  await installTauriMock(page);
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.CodeBridgeProject));

  const lines = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#codeContent .code-line'));
    return rows.slice(0, 5).map((row, i) => {
      const style = getComputedStyle(row, '::before');
      return {
        index: row.getAttribute('data-line-index'),
        content: style.content,
        display: style.display,
        width: style.width,
        text: row.textContent
      };
    });
  });

  expect(lines.length, '預覽面板要有渲染出程式碼行').toBeGreaterThan(0);

  lines.forEach((row, i) => {
    expect(row.index, `第 ${i} 行的 data-line-index`).toBe(String(i));
    // 證明 ::before 真的產生了行號（content 非 none）
    expect(row.content, `第 ${i} 行要有行號 pseudo-element`).not.toBe('none');
    expect(row.content).toBe('counter(line)');
    // 行號不在文字內容裡，所以程式碼文字不會混入行號數字
    expect(row.text, `第 ${i} 行的文字不得混入行號`).not.toMatch(
      new RegExp(`^\\s*${i + 1}\\s`)
    );
  });
});

/**
 * 展開終端機面板。
 *
 * **必須展開**：面板預設收合，收合時位於 Blockly 工作區之下，
 * Playwright 的點擊會被 `blocklyScrollbarHorizontal` 攔截而逾時。
 */
async function openTerminal(page) {
  await page.locator('#terminal-toggle').click();
}

test('終端機面板含序列監視器控制列與開發者輸入行', async ({ page }) => {
  await installTauriMock(page);
  await page.goto('/');
  await openTerminal(page);

  await expect(page.locator('#serialControlBar')).toBeVisible();
  await expect(page.locator('#serial-baud-select')).toBeVisible();
  await expect(page.locator('#serial-timestamp-toggle')).toBeVisible();
  await expect(page.locator('#serial-hex-toggle')).toBeVisible();
  await expect(page.locator('#serialInputBar')).toBeVisible();
});

test('波特率選項與積木的 BAUD 清單一致', async ({ page }) => {
  await installTauriMock(page);
  await page.goto('/');
  await openTerminal(page);

  const values = await page.locator('#serial-baud-select option').evaluateAll(
    (options) => options.map((option) => option.value)
  );
  // 學生在積木上看到的波特率必須在面板上找得到，否則會以為設定不對應。
  expect(values).toEqual(['300', '1200', '2400', '4800', '9600', '14400',
    '19200', '28800', '38400', '57600', '115200']);
});

test('初始為未連線，開啟後狀態燈與按鈕同步更新', async ({ page }) => {
  await installTauriMock(page);
  await page.goto('/');
  await openTerminal(page);

  const status = page.locator('#serial-status');
  // `board-detector` 的啟動快照（`get_serial_ports`）是 async：
  // 序列埠下拉要等它回來才會有選項。太早點擊會得到「尚未選擇序列埠」——
  // 那不是功能缺陷，而是測試與非同步初始化的競態。
  await expect(page.locator('#serial-selector option[value="COM3"]')).toHaveCount(1,
    { timeout: 10000 });
  await expect(status).toHaveAttribute('data-connected', 'false');
  await expect(page.locator('#btn-serial-monitor')).toHaveAttribute('data-active', 'false');

  await page.locator('#btn-serial-monitor').click();
  // 若開啟失敗，終端機會留下原因 —— 一併斷言可避免「靜默無反應」回歸。
  const failure = await page.locator('#terminalContent').innerText();
  expect(failure, '序列監視器開啟失敗，終端機應留下原因').toBe('');
  await expect(status).toHaveAttribute('data-connected', 'true');
  await expect(page.locator('#btn-serial-monitor')).toHaveAttribute('data-active', 'true');
  // 連線時要顯示埠與波特率，使用者才能確認自己監看的到底是哪個埠。
  await expect(status).toContainText('COM3');
});

test('序列資料事件以 data 樣式進入終端機面板', async ({ page }) => {
  await installTauriMock(page);
  await page.goto('/');
  await openTerminal(page);
  // 開啟前必須等序列埠下拉就緒，否則開啟會被「尚未選擇序列埠」擋下。
  await expect(page.locator('#serial-selector option[value="COM3"]')).toHaveCount(1,
    { timeout: 10000 });

  await page.locator('#btn-serial-monitor').click();
  await emitMockEvent(page, 'codebridge://serial-data', {
    port: 'COM3',
    lines: ['LED 已開啟', '感測器值：42']
  });

  const dataLines = page.locator('#terminalContent .terminal-line--data');
  await expect(dataLines).toHaveCount(2);
  await expect(dataLines.first()).toHaveText('LED 已開啟');
});

test('時間戳開關會為資料加上時間前綴', async ({ page }) => {
  await installTauriMock(page);
  await page.goto('/');
  await openTerminal(page);
  // 開啟前必須等序列埠下拉就緒，否則開啟會被「尚未選擇序列埠」擋下。
  await expect(page.locator('#serial-selector option[value="COM3"]')).toHaveCount(1,
    { timeout: 10000 });

  await page.locator('#btn-serial-monitor').click();
  await page.locator('#serial-timestamp-toggle').check();
  await emitMockEvent(page, 'codebridge://serial-data', { port: 'COM3', lines: ['有時間戳'] });

  await expect(page.locator('#terminalContent .terminal-line--data').first())
    .toHaveText(/^\d{2}:\d{2}:\d{2}\.\d{3}\s+有時間戳$/);
});

test('開發者輸入行可送出訊息並清空欄位', async ({ page }) => {
  await installTauriMock(page);
  await page.goto('/');
  await openTerminal(page);
  // 開啟前必須等序列埠下拉就緒，否則開啟會被「尚未選擇序列埠」擋下，
  // 輸入框就一直是 disabled，`fill()` 會逾時。
  await expect(page.locator('#serial-selector option[value="COM3"]')).toHaveCount(1,
    { timeout: 10000 });

  await page.locator('#btn-serial-monitor').click();
  await page.locator('#serial-input').fill('開燈');
  await page.locator('#btn-serial-send').click();

  const sent = await page.evaluate(() => window.__MOCK_CLI__.serialSent);
  expect(sent).toEqual(['開燈']);
  // 送出後清空，避免連按時送出同一則訊息。
  await expect(page.locator('#serial-input')).toHaveValue('');
});

test('按 Enter 與點按鈕的送出行為一致', async ({ page }) => {
  await installTauriMock(page);
  await page.goto('/');
  await openTerminal(page);
  // 開啟前必須等序列埠下拉就緒，否則開啟會被「尚未選擇序列埠」擋下，
  // 輸入框就一直是 disabled，`fill()` 會逾時。
  await expect(page.locator('#serial-selector option[value="COM3"]')).toHaveCount(1,
    { timeout: 10000 });

  await page.locator('#btn-serial-monitor').click();
  await page.locator('#serial-input').fill('按Enter');
  await page.locator('#serial-input').press('Enter');

  const sent = await page.evaluate(() => window.__MOCK_CLI__.serialSent);
  expect(sent).toEqual(['按Enter']);
});

test('變更波特率會以新速率重啟監視器', async ({ page }) => {
  await installTauriMock(page);
  await page.goto('/');
  await openTerminal(page);
  // 開啟前必須等序列埠下拉就緒，否則開啟會被「尚未選擇序列埠」擋下。
  await expect(page.locator('#serial-selector option[value="COM3"]')).toHaveCount(1,
    { timeout: 10000 });

  await page.locator('#btn-serial-monitor').click();
  await page.locator('#serial-baud-select').selectOption('115200');

  // 序列埠的 baud 無法熱改 —— 必須看到 stop 後接著 start 的序列。
  const commands = (await readCliCalls(page)).map((call) => call.command);
  const lastStart = commands.lastIndexOf('serial_monitor_start');
  expect(commands.lastIndexOf('serial_monitor_stop')).toBeLessThan(lastStart);

  const calls = await readCliCalls(page);
  const start = calls.filter((call) => call.command === 'serial_monitor_start').pop();
  expect(start.args.baud).toBe(115200);
});

test('關閉監視器後回到未連線狀態', async ({ page }) => {
  await installTauriMock(page);
  await page.goto('/');
  await openTerminal(page);
  // 開啟前必須等序列埠下拉就緒，否則開啟會被「尚未選擇序列埠」擋下，
  // 第二次點擊只是又失敗一次，狀態燈永遠不會變。
  await expect(page.locator('#serial-selector option[value="COM3"]')).toHaveCount(1,
    { timeout: 10000 });

  await page.locator('#btn-serial-monitor').click();
  await page.locator('#btn-serial-monitor').click();
  await expect(page.locator('#serial-status')).toHaveAttribute('data-connected', 'false');
});

test('重新啟動開發板會以 resetOnOpen:true 重新開啟', async ({ page }) => {
  await installTauriMock(page);
  await page.goto('/');
  await openTerminal(page);
  await expect(page.locator('#serial-selector option[value="COM3"]')).toHaveCount(1,
    { timeout: 10000 });

  await page.locator('#btn-serial-monitor').click();
  // 按鈕的語意就是「重新啟動板子」，必須真的帶上 resetOnOpen，
  // 否則使用者按了會沒有任何反應。
  await page.locator('#btn-serial-reset').click();

  const calls = await readCliCalls(page);
  const last = calls.filter((call) => call.command === 'serial_monitor_start').pop();
  expect(last.args.resetOnOpen).toBe(true);
});

test('切換「開啟時重啟板」不會立即重啟，只影響下一次開啟', async ({ page }) => {
  await installTauriMock(page);
  await page.goto('/');
  await openTerminal(page);
  await expect(page.locator('#serial-selector option[value="COM3"]')).toHaveCount(1,
    { timeout: 10000 });

  // 尚未連線時切換開關 → 不應發動任何後端呼叫。
  await page.locator('#serial-reset-toggle').check();
  const before = (await readCliCalls(page))
    .filter((call) => call.command === 'serial_monitor_start').length;
  await page.locator('#btn-serial-monitor').click();

  const after = (await readCliCalls(page))
    .filter((call) => call.command === 'serial_monitor_start').length;
  expect(after).toBe(before + 1, '切換開關本身不該開啟，只有開啟鈕才會');
  const last = (await readCliCalls(page))
    .filter((call) => call.command === 'serial_monitor_start').pop();
  expect(last.args.resetOnOpen).toBe(true);
});

test('沒有序列埠時給出明確提示而非無反應', async ({ page }) => {
  await installTauriMock(page, { cli: { ports: [] } });
  await page.goto('/');
  await openTerminal(page);

  // 啟動快照回來後確認真的沒有任何埠。
  // 不可只斷言「下拉是空的」—— 快照尚未抵達時下拉本來也是空的，
  // 那樣斷言會通過但理由完全錯誤。
  await expect(page.locator('#serial-selector option[value="COM3"]')).toHaveCount(0);
  await expect(page.locator('#serial-selector')).toHaveValue('');

  await page.locator('#btn-serial-monitor').click();
  // 必須有可見的回饋；「按了沒反應」是最糟的除錯起點。
  await expect(page.locator('#terminalContent')).toContainText('尚未選擇序列埠');
});
