import { expect, test } from '@playwright/test';
import { emitMockEvent, installTauriMock, readMockFiles, setOpenPath, setSavePath, setUiLocale } from '../support/tauri-mock.js';

const BLINK_PATH = 'C:/projects/Blink.cbg';

const BLINK_PROJECT = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<xml xmlns="https://developers.google.com/blockly/xml" xmlns:cbp="https://codebridge.app/xml" cbp:format="1" cbp:name="Blink" cbp:fqbn="arduino:avr:uno">',
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
 * 修改工作區：把一個 arduino_delay 接進 setup 積木。
 * 刻意不使用浮動積木，因為孤兒積木會被停用而不產生程式碼。
 */
async function mutateWorkspace(page) {
  await page.evaluate(() => {
    const workspace = Blockly.getMainWorkspace();
    const setup = workspace.getTopBlocks(true)
      .find((block) => block.type === 'initializes_setup');
    const delay = workspace.newBlock('arduino_delay');
    delay.initSvg();
    delay.render();
    setup.getInput('CONTENT').connection.connect(delay.previousConnection);
  });
  await page.waitForTimeout(400);
}

async function dirtyState(page) {
  return page.evaluate(() => ({
    filename: document.getElementById('current-filename').textContent,
    icon: document.getElementById('project-state-icon').getAttribute('src'),
    saveIsDirty: document.getElementById('btn-save').classList.contains('is-dirty')
  }));
}

async function openProject(page) {
  await page.click('#btn-open');
  await page.click('#btn-open-file');
  await expect.poll(async () => (await dirtyState(page)).filename).toBe('Blink');
}

test.describe('工具列與 .cbg 專案流程', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  // 固定語系，讓文案斷言不依賴執行環境的系統語言
  test.beforeEach(async ({ page }) => {
    await setUiLocale(page, 'zh-hant');
  });

  test('未實作的按鈕一律為 disabled，不提供無反應的按鈕', async ({ page }) => {
    await installTauriMock(page);
    await page.goto('/');

    const disabled = await page.evaluate(() => Array.from(
      document.querySelectorAll('.toolbar-btn[disabled], .terminal-tool-btn[disabled]')
    ).map((element) => element.id).sort());

    expect(disabled).toEqual([
      'btn-clear-terminal',
      'btn-close-terminal',
      'btn-pause-terminal',
      'btn-refresh-serial',
      'btn-run',
      'btn-stop',
      'btn-terminal'
    ]);
  });

  test('未儲存變更會標示 dirty 指示', async ({ page }) => {
    await installTauriMock(page);
    await page.goto('/');

    expect(await dirtyState(page)).toEqual({
      filename: '未命名專案',
      icon: 'src/icons/load_project_24dp_1F1F1F.png',
      saveIsDirty: false
    });

    await mutateWorkspace(page);

    const state = await dirtyState(page);
    expect(state.saveIsDirty).toBe(true);
    expect(state.icon).toContain('pen-duotone');
  });

  test('儲存會寫出 .cbg 內容、帶入檔名並清除 dirty', async ({ page }) => {
    await installTauriMock(page);
    await page.goto('/');
    await setSavePath(page, BLINK_PATH);
    await mutateWorkspace(page);

    await page.click('#btn-save');
    await expect.poll(async () => (await dirtyState(page)).saveIsDirty).toBe(false);

    const state = await dirtyState(page);
    expect(state.filename).toBe('Blink');
    expect(state.icon).toBe('src/icons/load_project_24dp_1F1F1F.png');

    const files = await readMockFiles(page);
    expect(files[BLINK_PATH]).toContain('cbp:format="1"');
    expect(files[BLINK_PATH]).toContain('cbp:name="Blink"');
    expect(files[BLINK_PATH]).toContain('initializes_setup');

    const recents = await page.evaluate(() => JSON.parse(localStorage.getItem('codebridgeRecentProjects')));
    expect(recents.map((item) => item.path)).toEqual([BLINK_PATH]);
  });

  test('開啟專案會載入 .cbg 並顯示檔名', async ({ page }) => {
    await installTauriMock(page, { files: { [BLINK_PATH]: BLINK_PROJECT } });
    await page.goto('/');
    await setOpenPath(page, BLINK_PATH);
    await openProject(page);

    const code = await page.textContent('#codeContent');
    expect(code).toContain('delay(250)');
  });

  test('有未儲存變更時新增專案會先詢問，取消則保留原專案', async ({ page }) => {
    await installTauriMock(page, { files: { [BLINK_PATH]: BLINK_PROJECT } });
    await page.goto('/');
    await setOpenPath(page, BLINK_PATH);
    await openProject(page);

    await mutateWorkspace(page);
    await page.click('#btn-new');
    await expect(page.locator('#codebridge-confirm')).toBeVisible();

    await page.getByRole('button', { name: '取消' }).click();
    await expect(page.locator('#codebridge-confirm')).toBeHidden();
    expect((await dirtyState(page)).filename).toBe('Blink');
  });

  test('最近專案清單可開啟先前儲存的檔案', async ({ page }) => {
    await installTauriMock(page);
    await page.goto('/');
    await setSavePath(page, BLINK_PATH);
    await mutateWorkspace(page);
    await page.click('#btn-save');
    await expect.poll(async () => (await dirtyState(page)).saveIsDirty).toBe(false);

    await page.click('#btn-open');
    await expect(page.locator('#recent-projects .recent-item')).toHaveCount(1);
    await page.locator('#recent-projects .recent-item').first().click();
    await expect.poll(async () => (await dirtyState(page)).filename).toBe('Blink');
  });

  test('複製程式碼貼到剪貼簿時不含 ID 標記', async ({ page }) => {
    await installTauriMock(page);
    await page.goto('/');
    await mutateWorkspace(page);

    await page.click('#btn-copy-code');
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain('void setup()');
    expect(clipboard).toContain('delay(');
    expect(clipboard).not.toContain('__BLOCKLY_ID');
  });

  test('內建範例可載入並成為未命名專案（檔名顯示範例名稱）', async ({ page }) => {
    await installTauriMock(page);
    await page.goto('/');

    await page.click('#btn-examples');
    await expect(page.locator('#examples-list .dropdown-item')).toHaveCount(2);
    await page.locator('#examples-list .dropdown-item').first().click();

    await expect.poll(async () => (await dirtyState(page)).filename).toBe('Blink');
    // 未命名（沒有路徑）→ 存檔時仍走 Save As
    const isUntitled = await page.evaluate(() => !localStorage.getItem('codebridgeProject').includes('path":"'));
    expect(isUntitled).toBe(true);

    const code = await page.textContent('#codeContent');
    expect(code).toContain('pinMode(13, OUTPUT)');
    expect(code).toContain('digitalWrite(13, HIGH)');
  });

  test('純瀏覽器環境（無 Tauri）會提示僅桌面版可用', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-save');

    await expect(page.locator('#codebridge-toast')).toBeVisible();
    await expect(page.locator('#codebridge-toast')).toContainText('桌面版');
  });

  test('檔名膠囊可點擊以在檔案總管中顯示，tooltip 為完整路徑', async ({ page }) => {
    await installTauriMock(page);
    await page.goto('/');
    await setSavePath(page, BLINK_PATH);
    await mutateWorkspace(page);
    await page.click('#btn-save');
    await expect.poll(async () => (await dirtyState(page)).saveIsDirty).toBe(false);

    await expect(page.locator('#file-breadcrumb')).toHaveAttribute('title', BLINK_PATH);
    await page.click('#file-breadcrumb');

    const revealed = await page.evaluate(() => window.__MOCK_REVEALED__);
    expect(revealed).toEqual([BLINK_PATH]);
  });

  test('未儲存的專案無法在檔案總管中顯示', async ({ page }) => {
    await installTauriMock(page);
    await page.goto('/');

    await expect(page.locator('#file-breadcrumb')).not.toHaveClass(/is-linked/);
    await page.click('#file-breadcrumb');

    expect(await page.evaluate(() => window.__MOCK_REVEALED__)).toEqual([]);
    await expect(page.locator('#codebridge-toast')).toContainText('尚未儲存');
  });

  test('按下視窗 X：有未儲存變更時詢問，取消則不關閉', async ({ page }) => {
    await installTauriMock(page);
    await page.goto('/');
    await mutateWorkspace(page);

    // Rust 攔截 CloseRequested 後送出的事件
    await emitMockEvent(page, 'codebridge://request-close');
    await expect(page.locator('#codebridge-confirm')).toBeVisible();

    await page.getByRole('button', { name: '取消' }).click();
    await expect(page.locator('#codebridge-confirm')).toBeHidden();
    expect(await page.evaluate(() => window.__MOCK_CLOSED__)).toBe(false);
  });

  test('按下視窗 X：選擇儲存會先存檔再關閉', async ({ page }) => {
    await installTauriMock(page);
    await page.goto('/');
    await setSavePath(page, BLINK_PATH);
    await mutateWorkspace(page);

    await emitMockEvent(page, 'codebridge://request-close');
    await page.getByRole('button', { name: '儲存', exact: true }).click();

    await expect.poll(async () => page.evaluate(() => window.__MOCK_CLOSED__)).toBe(true);
    const files = await readMockFiles(page);
    expect(files[BLINK_PATH]).toContain('cbp:name="Blink"');
  });

  test('按下視窗 X：專案乾淨時直接關閉，不詢問', async ({ page }) => {
    await installTauriMock(page);
    await page.goto('/');

    await emitMockEvent(page, 'codebridge://request-close');
    await expect.poll(async () => page.evaluate(() => window.__MOCK_CLOSED__)).toBe(true);
    await expect(page.locator('#codebridge-confirm')).toBeHidden();
  });
});
