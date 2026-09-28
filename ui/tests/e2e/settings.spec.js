import { test, expect } from '@playwright/test';
import { installTauriMock, setUiLocale } from '../support/tauri-mock.js';

/**
 * 設定中心「進階 › 路徑」的端對端行為。
 *
 * 重點在「當前值 + 來源」是否真的同時出現 ——
 * 使用者看不到自己已裝的核心時，這兩者是唯一能讓他自行判斷的資訊。
 */

test.describe('設定中心路徑頁', () => {
  /**
   * 開啟設定中心：齒輪 → 選單中的「環境診斷」。
   *
   * 齒輪本身**不可**直接開啟對話框 —— 它是 `toolbar.js` 的 dropdown 觸發器，
   * 攔截它的點擊會讓整個下拉選單失效（theme-runtime 有測試鎖住這條）。
   */
  async function openSettings(page) {
    await page.locator('#btn-settings-root').click();
    await page.locator('#btn-diagnose').click();
  }

  test.beforeEach(async ({ page }) => {
    await installTauriMock(page);
    await setUiLocale(page, 'zh-hant');
    await page.goto('/');
    await page.waitForSelector('#blocklyDiv .injectionDiv');
  });

  test('從選單開啟設定中心並顯示每個目錄的值與來源', async ({ page }) => {
    await openSettings(page);
    await expect(page.locator('#codebridge-settings')).toBeVisible();
    // 共用模式（預設）→ 來源必須是 systemDefault，不是「使用者指定」。
    await expect(page.locator('#cb-setting-data-value')).toContainText('Arduino15');
    await expect(page.locator('#cb-settings-body .cb-setting-source').first())
      .toContainText('共用系統目錄');
  });

  test('切換獨立目錄後來源標籤跟著變', async ({ page }) => {
    await openSettings(page);
    await page.locator('#cb-setting-isolated').check();
    await page.locator('#cb-settings-save').click();
    await expect(page.locator('#cb-setting-data-value')).toContainText('.codebridge/arduino');
    await expect(page.locator('#cb-settings-body .cb-setting-source').first())
      .toContainText('CodeBridge 專屬目錄');
  });

  test('開啟時會送出 toolchain_get_dirs', async ({ page }) => {
    await openSettings(page);
    await expect(page.locator('#codebridge-settings')).toBeVisible();
    const calls = await page.evaluate(() => window.__MOCK_CLI_CALLS__ || []);
    expect(calls.some((call) => call.command === 'toolchain_get_dirs')).toBe(true);
  });

  test('關閉鈕可關閉對話框', async ({ page }) => {
    await openSettings(page);
    await page.locator('#cb-settings-close').click();
    await expect(page.locator('#codebridge-settings')).toBeHidden();
  });

  test('齒輪仍可切換下拉選單（不可被設定中心吃掉）', async ({ page }) => {
    // 回歸鎖定：2026-09-29 曾在齒輪上呼叫 stopPropagation()，導致下拉選單整個失效。
    await page.locator('#btn-settings-root').click();
    const dropdown = page.locator('#btn-settings-root').locator('xpath=..')
      .locator('.dropdown-content');
    await expect(dropdown).toBeVisible();
  });

  test('CLI 路徑欄位預填目前生效的路徑', async ({ page }) => {
    await openSettings(page);
    await expect(page.locator('#cb-setting-cli-path')).toHaveValue('C:/tools/arduino-cli.exe');
  });
});

/**
 * 版面契約（2026-09-29 使用者回報）。
 *
 * 症狀是「字級一樣、項目沒分隔、文字太大跑到面板外」。
 * **真正的根因不是字級設計，而是 CSS 少了一個結尾大括號**，
 * 導致整段 `.cb-setting-*` 被巢狀在 `.cb-dialog-button.is-primary:hover` 內而全數失效。
 * 因此這組測試的重點是「樣式有沒有真的套上去」，而不是某個像素值。
 */
test.describe('設定中心版面契約', () => {
  test.beforeEach(async ({ page }) => {
    await installTauriMock(page);
    await setUiLocale(page, 'zh-hant');
    await page.goto('/');
    await page.waitForSelector('#blocklyDiv .injectionDiv');
    await page.locator('#btn-settings-root').click();
    await page.locator('#btn-diagnose').click();
    await page.locator('#cb-settings-body .cb-setting-group-title').first().waitFor();
  });

  test('分區標題有套用樣式（巢狀遺漏時 font-size 會是繼承值）', async ({ page }) => {
    const styles = await page.evaluate(() => {
      const title = document.querySelector('.cb-setting-group-title');
      const cs = getComputedStyle(title);
      return {
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        text: title.textContent
      };
    });
    expect(styles.fontSize).toBe('15px');
    expect(Number(styles.fontWeight)).toBeGreaterThanOrEqual(600);
    expect(styles.text).toContain('工具鏈');
  });

  test('字級有三層主從，不是全部一樣大', async ({ page }) => {
    const sizes = await page.evaluate(() => {
      const pick = (sel) => {
        const node = document.querySelector(sel);
        return node ? getComputedStyle(node).fontSize : null;
      };
      return {
        group: pick('.cb-setting-group-title'),
        label: pick('.cb-setting-label'),
        path: pick('.cb-setting-path'),
        source: pick('.cb-setting-source')
      };
    });
    // 分區標題 > 欄位名 = 路徑 > 來源標籤
    expect(Number(sizes.group.replace('px', '')))
      .toBeGreaterThan(Number(sizes.label.replace('px', '')));
    expect(Number(sizes.label.replace('px', '')))
      .toBeGreaterThan(Number(sizes.source.replace('px', '')));
    expect(Number(sizes.path.replace('px', '')))
      .toBeGreaterThan(Number(sizes.source.replace('px', '')));
  });

  test('項目之間有分隔線', async ({ page }) => {
    const borders = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.cb-setting-group .cb-setting-row'));
      return rows.slice(0, -1).map((row) => getComputedStyle(row).borderBottomStyle);
    });
    expect(borders.length).toBeGreaterThan(0);
    // 至少要有非 none 的分隔（虛線或實線皆可）
    expect(borders.some((style) => style !== 'none')).toBe(true);
  });

  test('內容不超出對話框（巢狀遺漏時 max-width 會失效而被 420px 限制）', async ({ page }) => {
    const overflow = await page.evaluate(() => {
      const dialog = document.querySelector('.cb-settings-dialog');
      const body = document.getElementById('cb-settings-body');
      const dialogRect = dialog.getBoundingClientRect();
      // 找出任何右邊界超出對話框內容區的元素
      const escaping = Array.from(body.querySelectorAll('*'))
        .filter((node) => node.getBoundingClientRect().right > dialogRect.right + 1)
        .map((node) => node.id || node.className);
      return {
        dialogWidth: Math.round(dialogRect.width),
        viewportWidth: window.innerWidth,
        escaping,
        bodyScrollable: body.scrollHeight > 0
      };
    });
    // 對話框應展開到接近設計寬度，而不是被 .cb-dialog 的 420px 夾住
    expect(overflow.dialogWidth).toBeGreaterThan(420);
    expect(overflow.dialogWidth).toBeLessThanOrEqual(overflow.viewportWidth);
    expect(overflow.escaping).toEqual([]);
  });

  test('長路徑會換行而不是撐破容器', async ({ page }) => {
    await page.evaluate(() => {
      const code = document.getElementById('cb-setting-data-value');
      code.textContent = 'C:/very/long/path/that/has/no/spaces/and/keeps/going/'
        + 'and/going/and/going/and/going/and/going/and/going/and/going/Arduino15';
    });
    const ok = await page.evaluate(() => {
      const dialog = document.querySelector('.cb-settings-dialog').getBoundingClientRect();
      const code = document.getElementById('cb-setting-data-value').getBoundingClientRect();
      return code.right <= dialog.right + 1;
    });
    expect(ok).toBe(true);
  });

  test('分區標題與按鈕列不會被捲走', async ({ page }) => {
    const fixed = await page.evaluate(() => {
      const title = document.querySelector('.cb-settings-title-probe') || document.getElementById('cb-settings-title');
      const before = title.getBoundingClientRect().top;
      document.getElementById('cb-settings-body').scrollTop = 9999;
      const after = title.getBoundingClientRect().top;
      return Math.abs(before - after) < 1;
    });
    expect(fixed).toBe(true);
  });
});
