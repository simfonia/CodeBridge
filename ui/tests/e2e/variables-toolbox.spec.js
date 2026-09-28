import { expect, test } from '@playwright/test';

/**
 * Variables 分類的 toolbox 契約（對齊 piBlockly）
 *
 * **為什麼要鎖這個契約**
 *
 * CodeBridge 原本用 Blockly 內建的 `<category custom="VARIABLE">` 動態分類。
 * 該分類會為工作區裡的**每一個變數**各生一對 `variables_get` / `variables_set`，
 * 變數一多，flyout 就被同一批積木塞爆，而且永遠看不到
 * `variables_declare_global` / `variables_declare_local` 這兩顆宣告積木 ——
 * 學生看不到「原來要先宣告型別」，於是產生的 .ino 沒有任何型別定義。
 *
 * piBlockly 的做法（`piBlockly/media/toolbox.xml:301-307`）是固定 4 顆：
 * 建立變數按鈕 + declare_global + declare_local + get + set。
 * 本檔依此契約驗證 CodeBridge 與之一致。
 */

const EXPECTED_BLOCKS = [
  'variables_declare_global',
  'variables_declare_local',
  'variables_get',
  'variables_set'
];

/** 讀出 Variables 分類在 toolbox 內宣告的積木型別（依 XML 宣告順序）。 */
async function readToolboxVariableBlocks(page) {
  return page.evaluate(() => {
    const toolbox = document.getElementById('toolbox-xml');
    const category = Array.from(toolbox.querySelectorAll('category'))
      .find((node) => node.getAttribute('name') === '%{BKY_VARIABLES_CATEGORY}');
    if (!category) return null;
    return {
      isDynamic: category.hasAttribute('custom'),
      buttons: Array.from(category.querySelectorAll('button')).map((button) => ({
        text: button.getAttribute('text'),
        callbackKey: button.getAttribute('callbackKey')
      })),
      blocks: Array.from(category.querySelectorAll('block'))
        .map((block) => block.getAttribute('type'))
    };
  });
}

test.describe('Variables 分類的 toolbox 契約（對齊 piBlockly）', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.Blockly?.getMainWorkspace?.());
  });

  test('Variables 分類是固定分類，不是 Blockly 內建的動態分類', async ({ page }) => {
    const category = await readToolboxVariableBlocks(page);

    expect(category, '應能找到 Variables 分類').not.toBeNull();
    // `custom="VARIABLE"` 會讓 Blockly 依變數數量動態生成積木，正是要避免的
    expect(category.isDynamic, '不可使用 custom="VARIABLE" 動態分類').toBe(false);
  });

  test('Variables 分類永遠只有 4 顆積木，且含 global 與 local 兩個宣告積木', async ({ page }) => {
    const category = await readToolboxVariableBlocks(page);

    // 順序比照 piBlockly：宣告（全域/區域）在前，取用/指派在後
    expect(category.blocks).toEqual(EXPECTED_BLOCKS);
  });

  test('Variables 分類有「建立變數」按鈕並綁定 CREATE_VARIABLE', async ({ page }) => {
    const category = await readToolboxVariableBlocks(page);

    expect(category.buttons).toHaveLength(1);
    expect(category.buttons[0].callbackKey).toBe('CREATE_VARIABLE');
    // 沿用 Blockly 官方訊息（zh-hant 為「建立變數…」），不另訂文案
    expect(category.buttons[0].text).toBe('%{BKY_NEW_VARIABLE}');
  });

  test('CREATE_VARIABLE callback 已註冊，按鈕點擊後會真的建立變數', async ({ page }) => {
    // 若沒註冊，點按鈕不會有任何反應。
    //
    // **不檢查 callback 註冊表**：`registerButtonCallback` 存在 Workspace prototype 上，
    // 但註冊表是私有欄位且在 minified build 中已被改名，用它做斷言會直接失效。
    // 這裡只驗證「點按鈕 → 真的建立變數」這個公開行為 —— 那才是使用者看得到的事。
    //
    // 注意：v13 的 VariableMap 沒有 getVariables()（那是 v12 舊 API），要用 getAllVariables()。
    const names = () => page.evaluate(() => window.Blockly.getMainWorkspace()
      .getVariableMap().getAllVariables().map((item) => item.getName()));
    const before = await names();

    // 「建立變數」按鈕位於 **flyout 內**（點開 Variables 分類才會出現），
    // 不是 toolbox 的分類按鈕本身。
    await page.locator('.blocklyToolboxCategory').filter({ hasText: /變數|Variables/ })
      .first().click();
    await page.waitForTimeout(200);

    const createButton = page.locator('.blocklyFlyoutButton')
      .filter({ hasText: /建立變數|Create variable/ })
      .first();
    await expect(createButton, 'flyout 應有「建立變數」按鈕').toBeVisible();
    await createButton.click();

    // Blockly 的官方處理器會開啟輸入對話框。
    // 不依賴 class 命名（v13 的 minified build 與 v12 不同），改用可見的
    // text input —— 這是 Blockly.Prompt 在 v13 實際渲染的結構。
    const dialog = page.locator('input[type="text"]:visible, input:not([type]):visible').last();
    await dialog.waitFor({ state: 'visible', timeout: 8000 });
    await dialog.fill('toolboxProbe');

    // 確認對話框（Blockly 官方接受鈕）
    await page.evaluate(() => {
      const accept = document.querySelector('.blocklyButtonAccept')
        || Array.from(document.querySelectorAll('button'))
          .find((node) => /^(OK|確定|好)$/.test(node.textContent.trim()));
      if (accept) accept.click();
    });
    await page.waitForTimeout(300);

    const after = await names();
    expect(after, '點擊建立變數按鈕後應新增 toolboxProbe 變數').toContain('toolboxProbe');
    expect(before).not.toContain('toolboxProbe');
  });

  test('變數數量增加時，Variables 分類的積木數量不變（不會被塞爆）', async ({ page }) => {
    const baseline = await readToolboxVariableBlocks(page);

    // 建立 8 個變數，模擬「專案變數變多」的情境
    await page.evaluate(() => {
      const workspace = window.Blockly.getMainWorkspace();
      const map = workspace.getVariableMap();
      ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta']
        .forEach((name) => map.createVariable(name));
    });
    await page.waitForTimeout(200);

    const after = await readToolboxVariableBlocks(page);
    // dynamic 分類會讓這裡的數量跟著變數數量暴增
    expect(after.blocks).toEqual(baseline.blocks);
    expect(after.blocks).toHaveLength(4);
  });

  test('4 顆積木都能取得 variables 語意角色（配色正確）', async ({ page }) => {
    const roles = await page.evaluate((types) => {
      const palette = window.CodeBridgeBlockPalette;
      return types.map((type) => palette.getRoleForBlockType(type));
    }, EXPECTED_BLOCKS);

    // TYPE_PREFIX_ROLES 有 `variables_: 'variables'`，
    // 固定分類後這 4 顆會正式進入 palette 契約（dynamic 分類時不會）
    expect(roles).toEqual(['variables', 'variables', 'variables', 'variables']);
  });
});
