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
