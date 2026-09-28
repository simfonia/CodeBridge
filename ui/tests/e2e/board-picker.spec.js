import { expect, test } from '@playwright/test';
import { emitMockEvent, installTauriMock, readCliCalls, setUiLocale } from '../support/tauri-mock.js';

/**
 * T2-E 開發板選擇面板的端對端驗證。
 *
 * 跑在純瀏覽器（Vite dev server），以 `window.__TAURI__` stub 提供開發板清單，
 * 驗證面板的實際 DOM 互動：開啟、搜尋過濾、選取後寫回專案。
 * 真實硬體驗證屬於桌機實機測試。
 */

/** 讀取面板目前顯示的開發板項目文字。 */
function readBoardLabels(page) {
  return page.locator('#cb-board-list .cb-board-item').allTextContents();
}

/**
 * 讀取目前使用者選擇的 fqbn。
 *
 * 2026-09-28 起裝置狀態的唯一持有者是 `board-detector`（不再存進專案
 * metadata）。這裡讀 detector 才是使用者真正會用到的那個值 —— 也才對得上
 * 原始症狀「選了 UNO，上傳卻報尚未選擇開發板」。
 */
function readProjectFqbn(page) {
  return page.evaluate(() => {
    const detector = window.CodeBridgeBoardDetector;
    return detector && detector.getState ? detector.getState().fqbn : '';
  });
}

/** 預先選定 fqbn，模擬「使用者已選過板子」的狀態。 */
function setProjectFqbn(page, fqbn) {
  return page.evaluate((value) => {
    window.CodeBridgeBoardDetector.setManualFqbn(value);
  }, fqbn);
}

test.describe('開發板選擇面板', () => {
  test.beforeEach(async ({ page }) => {
    await installTauriMock(page);
    await setUiLocale(page, 'zh-hant');
    await page.goto('/');
    await page.waitForSelector('#btn-select-board');
  });

  test('工具列顯示開發板按鈕', async ({ page }) => {
    await expect(page.locator('#btn-select-board')).toBeVisible();
  });

  test('點擊按鈕開啟面板並載入開發板清單', async ({ page }) => {
    await expect(page.locator('#cb-board-panel')).toBeHidden();

    await page.click('#btn-select-board');

    await expect(page.locator('#cb-board-panel')).toBeVisible();
    expect(await readBoardLabels(page)).toHaveLength(3);
  });

  test('清單同時顯示板名與 FQBN', async ({ page }) => {
    await page.click('#btn-select-board');
    const labels = await readBoardLabels(page);
    // 名稱與 FQBN 並列：只給 FQBN 學生無法判斷是不是自己手上的板子。
    expect(labels[0]).toContain('Arduino Uno');
    expect(labels[0]).toContain('arduino:avr:uno');
  });

  test('搜尋框依名稱過濾清單', async ({ page }) => {
    await page.click('#btn-select-board');
    await page.fill('#cb-board-search', 'nano');

    const labels = await readBoardLabels(page);
    expect(labels).toHaveLength(1);
    expect(labels[0]).toContain('Arduino Nano');
  });

  test('搜尋無結果時顯示提示而非空白清單', async ({ page }) => {
    await page.click('#btn-select-board');
    await page.fill('#cb-board-search', 'zzz-no-such-board');

    expect(await readBoardLabels(page)).toHaveLength(0);
    await expect(page.locator('#cb-board-list .cb-board-notice')).toBeVisible();
  });

  test('搜尋無結果時提示提到「開發板」而非「積木」', async ({ page }) => {
    // 回歸：曾沿用積木搜尋的 i18n key，使用者看到「找不到符合的積木」而不知所措。
    await page.click('#btn-select-board');
    await page.fill('#cb-board-search', 'zzz-no-such-board');

    const notice = await page.locator('#cb-board-list .cb-board-notice').first().textContent();
    expect(notice).not.toContain('積木');
    expect(notice).toContain('開發板');
  });

  test('提供常用開發板快捷按鈕，不必手動輸入名稱', async ({ page }) => {
    // 使用者手上的 UNO 多為第三廠 clone，自動偵測必然失敗；
    // 面板必須提供一鍵選用，而不是要他猜 FQBN 怎麼拼。
    await page.click('#btn-select-board');

    const presets = page.locator('#cb-board-list .cb-board-preset');
    await expect(presets.first()).toBeVisible();
    expect(await presets.count()).toBeGreaterThan(0);
  });

  test('點擊常用開發板即可完成選板', async ({ page }) => {
    await page.click('#btn-select-board');
    await page.locator('#cb-board-list .cb-board-preset', { hasText: 'Arduino Uno' }).click();

    expect(await readProjectFqbn(page)).toBe('arduino:avr:uno');
    await expect(page.locator('#cb-board-panel')).toBeHidden();
  });

  test('無法辨識的埠會說明手動選板仍可正常使用', async ({ page }) => {
    // CH340 clone 不在官方 VID 白名單內，自動辨識必然失敗。
    // 提示必須說清楚「仍可正常上傳」，否則學生會以為板子壞了。
    await page.evaluate(() => {
      window.CodeBridgeBoardPicker.open({ unknownPorts: ['COM4'] });
    });

    const notice = await page.locator('#cb-board-list .cb-board-notice').first().textContent();
    expect(notice).toContain('手動選擇');
  });

  test('選取開發板後上傳會用到選定的板型', async ({ page }) => {
    // 端對端鎖定 2026-09-28 的原始症狀：
    // 使用者從面板選了 Mega，按上傳卻報「尚未選擇開發板」。
    //
    // 這裡走完整路徑：面板選板 → compile-controller 讀 detector → 送 compile_start。
    // 只驗「選完 meta 有值」不夠 —— 那正是上一版失效的原因：
    // 值存在了，但上傳讀的是別處。
    await emitMockEvent(page, 'codebridge://board-detected', {
      // 後端**認不出**這顆板子（clone 板常見），自動偵測會是空的 ——
      // 正是使用者遇到的情境。
      boards: [],
      unknown: ['COM3']
    });
    await page.click('#btn-select-board');
    await page.locator('#cb-board-list .cb-board-item', { hasText: 'Arduino Mega' }).click();
    await expect(page.locator('#cb-board-panel')).toBeHidden();

    // 使用者選了板，上傳就必須帶著它。
    await page.locator('#btn-run').click();
    const calls = await readCliCalls(page);
    const compile = calls.find((call) => call.command === 'compile_start');
    expect(compile.args.payload.fqbn).toBe('arduino:avr:mega');
  });

  test('選取開發板後寫入專案並關閉面板', async ({ page }) => {    await page.click('#btn-select-board');
    await page.locator('#cb-board-list .cb-board-item', { hasText: 'Arduino Mega' }).click();

    expect(await readProjectFqbn(page)).toBe('arduino:avr:mega');
    await expect(page.locator('#cb-board-panel')).toBeHidden();
  });

  test('可覆寫先前選擇的開發板（手動選板優先於自動切板）', async ({ page }) => {
    await setProjectFqbn(page, 'arduino:avr:uno');
    await page.click('#btn-select-board');
    await page.locator('#cb-board-list .cb-board-item', { hasText: 'Arduino Nano' }).click();

    expect(await readProjectFqbn(page)).toBe('arduino:avr:nano');
  });

  test('目前開發板在清單中標示為選用狀態', async ({ page }) => {
    await setProjectFqbn(page, 'arduino:avr:nano');
    await page.click('#btn-select-board');

    await expect(page.locator('#cb-board-list .cb-board-item.is-active')).toHaveCount(1);
    await expect(page.locator('#cb-board-list .cb-board-item.is-active')).toContainText('Nano');
  });

  test('關閉鈕可關閉面板且不變更開發板', async ({ page }) => {
    await setProjectFqbn(page, 'arduino:avr:uno');
    await page.click('#btn-select-board');
    await page.click('#cb-board-close');

    await expect(page.locator('#cb-board-panel')).toBeHidden();
    expect(await readProjectFqbn(page)).toBe('arduino:avr:uno');
  });

  test('重新開啟面板會保留先前的搜尋字串', async ({ page }) => {
    await page.click('#btn-select-board');
    await page.fill('#cb-board-search', 'mega');
    await page.click('#cb-board-close');
    await page.click('#btn-select-board');

    await expect(page.locator('#cb-board-search')).toHaveValue('mega');
    expect(await readBoardLabels(page)).toHaveLength(1);
  });

  test('後端回報錯誤時面板顯示錯誤提示而非空白', async ({ page }) => {
    await page.evaluate(() => {
      window.__MOCK_CLI__.errors.board_list_all = 'CLI_ERROR_NOT_FOUND';
    });
    await page.click('#btn-select-board');

    await expect(page.locator('#cb-board-list .cb-board-notice')).toBeVisible();
  });

  test('核心清單為空時提供安裝按鈕（首次使用不被卡住）', async ({ page }) => {
    // CodeBridge 與使用者的 Arduino IDE 隔離，首次開啟時板子清單一定是空的。
    // 若只顯示一句提示而沒有入口，使用者就完全不知道該怎麼辦。
    await page.evaluate(() => {
      window.__MOCK_CLI__.boards = [];
    });
    await page.click('#btn-select-board');

    await expect(page.locator('#cb-board-list .cb-board-install-button')).toBeVisible();
  });

  test('安裝核心後板子清單可用', async ({ page }) => {
    // 首次使用：清單為空 → 出現安裝入口 → 安裝後清單可用。
    // mock 的 `board_list_all` 直接回傳 `boards`，因此安裝後由測試補上板子，
    // 模擬「安裝 avr 核心後 Uno／Nano 開始可用」。
    await page.evaluate(() => {
      const cli = window.__MOCK_CLI__;
      cli.boards = [];
      cli.onCoreInstalled = () => {
        cli.boards = [
          { name: 'Arduino Uno', fqbn: 'arduino:avr:uno' },
          { name: 'Arduino Nano', fqbn: 'arduino:avr:nano' }
        ];
      };
    });
    await page.click('#btn-select-board');
    await page.click('#cb-board-list .cb-board-install-button');

    // 安裝後清單應重新載入並出現可選的板子。
    await expect(page.locator('#cb-board-list .cb-board-item').first()).toBeVisible();
  });
});
