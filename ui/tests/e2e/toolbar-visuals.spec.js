import { expect, test } from '@playwright/test';
import { installTauriMock, setUiLocale } from '../support/tauri-mock.js';

/**
 * 工具列視覺回歸測試。
 *
 * 這些問題都是「看起來不對但不會報錯」：深色主題下 hover 與 dirty 指示對比不足、
 * 黑色 PNG 圖示在深色背景上看不見。因此以計算樣式斷言顏色／filter，
 * 讓主題 token 一旦退步就立刻失敗。
 */

function parseRgb(value) {
  const match = String(value).match(/rgba?\(([^)]+)\)/);
  if (!match) return null;
  const parts = match[1].split(',').map((part) => parseFloat(part.trim()));
  return { r: parts[0], g: parts[1], b: parts[2] };
}

/** 以亮度距離判斷兩個顏色是否有可見差異（0 = 完全相同）。 */
function colourDistance(a, b) {
  const first = parseRgb(a);
  const second = parseRgb(b);
  if (!first || !second) return 0;
  return Math.abs(first.r - second.r) + Math.abs(first.g - second.g) + Math.abs(first.b - second.b);
}

async function readToolbarStyles(page) {
  return page.evaluate(() => {
    const dropdownItem = document.querySelector('#open-dropdown .dropdown-item');
    const dropdownPanel = document.getElementById('open-dropdown');
    const saveButton = document.getElementById('btn-save');
    const itemImage = dropdownItem.querySelector('img');
    const styles = (element) => getComputedStyle(element);
    return {
      preset: document.documentElement.getAttribute('data-codebridge-preset')
        || document.body.getAttribute('data-codebridge-preset')
        || (window.CodeBridgeTheme ? window.CodeBridgeTheme.getPreset() : null),
      dropdownItemBackground: styles(dropdownItem).backgroundColor,
      dropdownPanelBackground: styles(dropdownPanel).backgroundColor,
      saveBackground: styles(saveButton).backgroundColor,
      saveShadow: styles(saveButton).boxShadow,
      itemImageFilter: styles(itemImage).filter
    };
  });
}

test.describe('工具列視覺回歸', () => {
  test.beforeEach(async ({ page }) => {
    await setUiLocale(page, 'zh-hant');
    await installTauriMock(page);
  });

  test('Engineer：下拉項目 hover 與面板背景有明顯對比', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('codebridgeExperiencePreset', 'engineer'));
    await page.goto('/');
    await page.click('#btn-open');
    await page.hover('#open-dropdown .dropdown-item');

    const styles = await readToolbarStyles(page);
    expect(styles.preset).toBe('engineer');
    expect(colourDistance(styles.dropdownItemBackground, styles.dropdownPanelBackground)).toBeGreaterThan(40);
  });

  test('Engineer：下拉項目與箭頭的黑色圖示被反白', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('codebridgeExperiencePreset', 'engineer'));
    await page.goto('/');

    const styles = await readToolbarStyles(page);
    expect(styles.itemImageFilter).toContain('invert');
  });

  test('未儲存變更時儲存按鈕有高对比指示（Engineer 與 Angel 皆然）', async ({ page }) => {
    for (const preset of ['engineer', 'angel']) {
      await page.addInitScript((value) => {
        localStorage.clear();
        localStorage.setItem('codebridgeExperiencePreset', value);
      }, preset);
      await page.goto('/');

      await page.evaluate(() => {
        const workspace = Blockly.getMainWorkspace();
        const setup = workspace.getTopBlocks(true)
          .find((block) => block.type === 'initializes_setup');
        const delay = workspace.newBlock('arduino_delay');
        delay.initSvg();
        delay.render();
        setup.getInput('CONTENT').connection.connect(delay.previousConnection);
      });
      await expect.poll(async () => page.evaluate(
        () => document.getElementById('btn-save').classList.contains('is-dirty')
      )).toBe(true);

      const styles = await readToolbarStyles(page);
      // 指示色必須明顯不同於工具列底色，且帶有 ring 邊框
      expect(colourDistance(styles.saveBackground, 'rgb(18, 27, 43)')).toBeGreaterThan(20);
      expect(styles.saveShadow).not.toBe('none');

      await page.evaluate(() => localStorage.clear());
    }
  });
});
