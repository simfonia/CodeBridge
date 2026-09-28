import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { emitMockEvent, installTauriMock, readMockFiles, setOpenPath, setSavePath, setUiLocale } from '../support/tauri-mock.js';

const BLINK_PATH = 'C:/projects/Blink.cbg';

const BLINK_PROJECT = [
  '<?xml version="1.0" encoding="UTF-8"?>',
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

/**
 * 內建範例的記憶體檔案。
 *
 * 2026-09-28 起範例改由 Rust 掃描 `resources/examples/`（對齊 #WaveCode），
 * 檔名帶數字前綴以固定排序，顯示名稱則由 Rust 端剝掉前綴後提供。
 * `__examples__` 是 mock 用的資源目錄前綴，讓 `list_examples` 能辨認。
 *
 * **直接讀磁碟上的真實範例**，而不是在測試裡重抄一份 XML：
 * 手抄的 fixture 會與真正打包給使用者的範例分歧（積木欄位名一改就
 * 靜默失效，症狀是「範例開不起來」而非測試紅燈）。
 */
const BLINK_EXAMPLE_PATH = 'app://__examples__/01_blink.cbg';
const SERIAL_EXAMPLE_PATH = 'app://__examples__/02_serial-hello.cbg';

const RESOURCE_EXAMPLES = new URL('../../../src-tauri/resources/examples/', import.meta.url);

const EXAMPLE_FILES = {
  [BLINK_EXAMPLE_PATH]: readFileSync(new URL('01_blink.cbg', RESOURCE_EXAMPLES), 'utf8'),
  [SERIAL_EXAMPLE_PATH]: readFileSync(new URL('02_serial-hello.cbg', RESOURCE_EXAMPLES), 'utf8')
};

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

  test('所有工具列按鈕皆已實作，不留無反應的按鈕', async ({ page }) => {
    await installTauriMock(page);
    await page.goto('/');

    const disabled = await page.evaluate(() => Array.from(
      document.querySelectorAll('.toolbar-btn[disabled], .terminal-tool-btn[disabled]')
    ).map((element) => element.id).sort());

    // 編譯／上傳與終端機按鈕於 T2-C 上線；序列埠重新整理與開發板自動偵測
    // 於 T2-D 上線；序列監視器於 T3 上線。工具列已無未實作按鈕 ——
    // 留下無反應的按鈕比沒有更糟。
    //
    // **例外**：`btn-serial-send` 與 `btn-serial-reset` 在序列監視器
    // **未連線**時停用。這是「依狀態停用」而非「尚未實作」——
    // 語意與 registry 的 `implemented` 完全不同。若把它們算進未實作，
    // 就會逼出一個永遠能按、但送不出東西的按鈕，那才是真正的無反應。
    // 靜態 `disabled` 已從 HTML 移除（初始值刻意留空），
    // 此處捕捉的是執行期 `syncControls()` 依狀態設定的停用。
    expect(disabled.filter((id) => id !== 'btn-serial-send' && id !== 'btn-serial-reset'))
      .toEqual([]);
  });

  test('序列監視器的按鈕在未連線時停用、連線後可用', async ({ page }) => {
    await installTauriMock(page);
    await setUiLocale(page, 'zh-hant');
    await page.goto('/');

    // **必須先展開終端機面板**：它預設收合，收合時位於 Blockly 之下，
    // Playwright 的點擊會被 `blocklyScrollbarHorizontal` 攔截。
    await page.locator('#terminal-toggle').click();
    // 序列埠下拉要等啟動快照（async）回來；未就緒時開啟會被擋下，
    // 輸入框就一直 disabled。
    await expect(page.locator('#serial-selector option[value="COM3"]')).toHaveCount(1,
      { timeout: 10000 });

    // 未連線：輸入框、送出鈕與「重新啟動開發板」都不可用，
    // 否則使用者會送出「石沉大海」的訊息或對空埠送指令。
    await expect(page.locator('#serial-input')).toBeDisabled();
    await expect(page.locator('#btn-serial-send')).toBeDisabled();
    await expect(page.locator('#btn-serial-reset')).toBeDisabled();

    await page.locator('#btn-serial-monitor').click();
    await expect(page.locator('#btn-serial-send')).toBeEnabled();
    await expect(page.locator('#serial-input')).toBeEnabled();
    await expect(page.locator('#btn-serial-reset')).toBeEnabled();
  });

  test('終端機按鈕可展開、暫停、清除與關閉面板', async ({ page }) => {
    await installTauriMock(page);
    await setUiLocale(page, 'zh-hant');
    await page.goto('/');

    const isCollapsed = () => page.evaluate(
      () => document.getElementById('terminalArea').classList.contains('collapsed')
    );

    // 初始收合
    expect(await isCollapsed()).toBe(true);

    // 一次點擊只切換一次（避免面板與 toolbar 重複綁定造成開→關抵銷）
    await page.click('#terminal-toggle');
    expect(await isCollapsed()).toBe(false);
    // 箭頭方向與 aria-expanded 需同步反映展開狀態
    await expect(page.locator('#terminal-toggle')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#terminal-toggle .arrow')).toHaveText('▼');

    // 暫停捲動：按鈕切為 active 且 tooltip 變成「繼續捲動」
    await page.click('#btn-pause-terminal');
    expect(await page.getAttribute('#btn-pause-terminal', 'title')).toBe('繼續捲動');
    await page.click('#btn-pause-terminal');
    expect(await page.getAttribute('#btn-pause-terminal', 'title')).toBe('暫停捲動');

    // 清除
    await page.evaluate(() => window.CodeBridgeTerminalPanel.append('hello'));
    await expect(page.locator('#terminalContent .terminal-line')).toHaveCount(1);
    await page.click('#btn-clear-terminal');
    await expect(page.locator('#terminalContent .terminal-line')).toHaveCount(0);

    // 關閉面板
    await page.click('#btn-close-terminal');
    expect(await isCollapsed()).toBe(true);

    // 再開一次，確認收合後仍可切換（三角鈕在收合時必須仍然可點）
    await expect(page.locator('#terminal-toggle')).toBeVisible();
    await page.click('#terminal-toggle');
    expect(await isCollapsed()).toBe(false);
    await expect(page.locator('#terminal-toggle .arrow')).toHaveText('▼');
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
    // 未命名專案沒有存檔路徑，dirty 提示改由 save-as 承擔（T2 行為調整）。
    expect(state.saveIsDirty).toBe(false);
    expect(state.icon).toContain('pen-duotone');
    expect(await page.evaluate(
      () => document.getElementById('btn-save-as').classList.contains('is-dirty')
    )).toBe(true);
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
    // 2026-09-28：命名空間改為 cbg:，且只序列化 format 與 app。
    // 專案名稱由**檔名**權威，因此不該出現在 XML metadata 裡。
    expect(files[BLINK_PATH]).toContain('cbg:format="1"');
    expect(files[BLINK_PATH]).toContain('cbg:app=');
    expect(files[BLINK_PATH]).toContain('initializes_setup');
    // 裝置狀態不得寫進檔案 —— 它描述的是使用者身邊的硬體。
    expect(files[BLINK_PATH]).not.toContain('cbg:port');
    expect(files[BLINK_PATH]).not.toContain('cbg:fqbn');
    expect(files[BLINK_PATH]).not.toContain('cbg:name');

    // 2026-09-28：存檔改用 Blockly.Xml.domToPrettyText()，輸出必須是
    // 多行縮排而非單行。單行檔對使用者等同不可讀（要手動編輯、要交作業、
    // 要版控），而 .cbg 是本產品的唯一真實來源，值得用可讀格式落地。
    const saved = files[BLINK_PATH];
    const savedLines = saved.split('\n');
    expect(savedLines.length, '存檔必須是多行格式').toBeGreaterThan(5);
    // 根元素帶 metadata 且獨佔第一行
    expect(savedLines[0]).toContain('cbg:format="1"');
    // 巢狀層級必須有遞增縮排（這是「多行」不只是「有換行」的關鍵）
    expect(saved).toMatch(/\n {2}<block /);
    expect(saved).toMatch(/\n {4}</);
    // 不可出現 XML 宣告
    expect(saved).not.toContain('<?xml');

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

  test('開啟範例不會動到使用者已選的序列埠下拉', async ({ page }) => {
    // 2026-09-28：序列埠／板型不再存進專案 metadata（那是使用者身邊的
    // 硬體狀態），而是住在下拉與 localStorage 偏好埠。開範例不該動它 ——
    // 使用者每換一個範例就要重選一次設備是很差的體驗。
    await installTauriMock(page, {
      files: EXAMPLE_FILES,
      cli: { ports: ['COM3', 'COM4'] }
    });
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.CodeBridgeProjectStore));
    await expect(page.locator('#serial-selector option[value="COM4"]')).toHaveCount(1);
    await page.locator('#serial-selector').selectOption('COM4');

    await page.click('#btn-examples');
    await page.locator('#examples-list .dropdown-item').first().click();
    await expect.poll(async () => (await dirtyState(page)).filename).toBe('blink');

    // 下拉維持使用者選的埠。
    await expect(page.locator('#serial-selector')).toHaveValue('COM4');
  });

  test('開空白專案也保留已選的設備', async ({ page }) => {
    await installTauriMock(page, { cli: { ports: ['COM3', 'COM4'] } });
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.CodeBridgeProjectStore));
    await expect(page.locator('#serial-selector option[value="COM4"]')).toHaveCount(1);
    await page.locator('#serial-selector').selectOption('COM4');

    await page.click('#btn-new');

    // 裝置狀態不在專案 metadata 裡，因此開新檔自然不會動到下拉。
    await expect(page.locator('#serial-selector')).toHaveValue('COM4');
  });

  test('內建範例可載入並成為未命名專案（檔名顯示範例名稱）', async ({ page }) => {
    await installTauriMock(page, { files: EXAMPLE_FILES });
    await page.goto('/');

    await page.click('#btn-examples');
    await expect(page.locator('#examples-list .dropdown-item')).toHaveCount(2);
    await page.locator('#examples-list .dropdown-item').first().click();

    // 顯示名稱由 Rust 端剝掉排序前綴（`01_`）而得，UI 不該出現 `01_blink`。
    await expect.poll(async () => (await dirtyState(page)).filename).toBe('blink');
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
    expect(files[BLINK_PATH]).toContain('cbg:format="1"');
    expect(files[BLINK_PATH]).not.toContain('cbg:name');
  });

  test('按下視窗 X：專案乾淨時直接關閉，不詢問', async ({ page }) => {
    await installTauriMock(page);
    await page.goto('/');

    await emitMockEvent(page, 'codebridge://request-close');
    await expect.poll(async () => page.evaluate(() => window.__MOCK_CLOSED__)).toBe(true);
    await expect(page.locator('#codebridge-confirm')).toBeHidden();
  });
});

test.describe('開啟後的 dirty 與保存提示', () => {
  test.beforeEach(async ({ page }) => {
    // 預先載入 BLINK 檔案，讓各測試能用 setOpenPath 走「開啟既有專案」流程。
    await installTauriMock(page, {
      files: Object.assign({ [BLINK_PATH]: BLINK_PROJECT }, EXAMPLE_FILES)
    });
    await setUiLocale(page, 'zh-hant');
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.Blockly && Blockly.getMainWorkspace()));
    await page.waitForTimeout(500);
  });

  test('開啟範例不會因 Blockly 正規化而立即變 dirty', async ({ page }) => {
    await page.locator('#btn-examples').click();
    await page.waitForTimeout(150);
    await page.locator('#examples-list .dropdown-item').first().click();
    // 足以超過 dirty 的 150ms debounce
    await page.waitForTimeout(700);

    const state = await dirtyState(page);
    expect(state.saveIsDirty).toBe(false);
    expect(state.icon).toBe('src/icons/load_project_24dp_1F1F1F.png');
  });

  test('開啟已存檔專案不會因 Blockly 正規化而變 dirty', async ({ page }) => {
    // beforeEach 已經載入頁面，這裡直接走開啟流程；
    // 不可重新 goto —— 那會讓殘留的暫存還原對話框蓋住工具列。
    await setOpenPath(page, BLINK_PATH);
    await openProject(page);
    await page.waitForTimeout(700);

    const state = await dirtyState(page);
    expect(state.saveIsDirty).toBe(false);
  });

  test('實際編輯份積未命名對館時以 save-as 為主提示', async ({ page }) => {
    await page.locator('#btn-examples').click();
    await page.waitForTimeout(150);
    await page.locator('#examples-list .dropdown-item').first().click();
    await page.waitForTimeout(600);
    await mutateWorkspace(page);
    await page.waitForTimeout(500);

    const hint = await page.evaluate(() => ({
      save: document.getElementById('btn-save').classList.contains('is-dirty'),
      saveAs: document.getElementById('btn-save-as').classList.contains('is-dirty'),
      saveTitle: document.getElementById('btn-save').title
    }));

    // 未命名專案：save 不高亮，提示改由 save-as 承擔
    expect(hint.save).toBe(false);
    expect(hint.saveAs).toBe(true);
    expect(hint.saveTitle).toContain('尚未存檔');
  });

  test('真正編輯後在開啟專案後會真的讓它變 dirty', async ({ page }) => {
    await setOpenPath(page, BLINK_PATH);
    await openProject(page);
    await page.waitForTimeout(600);
    expect((await dirtyState(page)).saveIsDirty).toBe(false);

    await mutateWorkspace(page);
    await page.waitForTimeout(500);
    expect((await dirtyState(page)).saveIsDirty).toBe(true);
  });
});

test.describe('啟動時的暫存還原', () => {
  test('有暫存時先問得使用者才還原', async ({ page }) => {
    const DRAFT_XML = '<xml xmlns="https://developers.google.com/blockly/xml">' +
      '<block type="initializes_setup" id="draft-setup" x="20" y="20">' +
      '<statement name="CONTENT"><block type="arduino_delay" id="draft-delay" x="20" y="20">' +
      '<value name="TIME"><shadow type="math_number" id="draft-num">' +
      '<field name="NUM">777</field></shadow></value></block></statement></block></xml>';
    await installTauriMock(page);
    await setUiLocale(page, 'zh-hant');
    await page.addInitScript((xml) => {
      localStorage.setItem('codebridgeProject', JSON.stringify({
        path: 'C:/projects/Draft.cbg', name: 'Draft',
        snapshot: '<xml xmlns="https://developers.google.com/blockly/xml"></xml>',
        meta: { format: 1, name: 'Draft' }
      }));
      // 暫存鍵為 codebridgeProjectDraft（見 project-store 的 STORAGE_KEYS）
      localStorage.setItem('codebridgeProjectDraft', xml);
    }, DRAFT_XML);
    await page.goto('/');
    await page.waitForFunction(() => Boolean(Blockly && Blockly.getMainWorkspace()));
    await page.waitForTimeout(400);

    // 應先出現詢問對話框，而不是直接還原。
    await expect(page.locator('#codebridge-confirm')).toBeVisible();
    const buttons = await page.locator('#cb-dialog-actions button').allTextContents();
    expect(buttons).toHaveLength(3);
    // 對話框未作答前不得自動載入暫存
    expect(await page.textContent('#codeContent')).not.toContain('777');

    // 選「載入暫存」後才還原
    await page.locator('#cb-dialog-actions button').nth(0).click();
    await page.waitForTimeout(700);
    expect(await page.textContent('#codeContent')).toContain('777');

    // 重新載入並選「開空白專案」：應注入預設積木而非暫存內容
    await page.reload();
    await page.waitForFunction(() => Boolean(Blockly && Blockly.getMainWorkspace()));
    await page.waitForTimeout(400);
    await page.locator('#codebridge-confirm').isVisible();
    await page.locator('#cb-dialog-actions button').nth(2).click();
    await page.waitForTimeout(700);
    expect(await page.textContent('#codeContent')).not.toContain('777');
  });
});
