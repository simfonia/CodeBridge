import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

/**
 * Vite 熱更新的忽略契約（`ui/vite.config.js` 的 `server.watch.ignored`）
 *
 * **為什麼需要這個契約**
 *
 * `.cbg` 是 CodeBridge 的專案檔。使用者按存檔時路徑是**自己選的**，
 * 可能落在 `src-tauri/resources/examples/`、專案根目錄或任何子目錄。
 * 若 Vite 監看它們，改一個 .cbg 就會觸發整頁重載 ——
 * 而重載對使用者換不到任何東西（開發模式的前端走 `read_example` IPC，
 * 從不 fetch .cbg），**卻會把尚未存檔的積木布局整個洗掉**。
 *
 * 用日誌判斷不可靠（Vite 的 HMR log 會被緩衝，沒有輸出不代表沒觸發），
 * 因此這裡以「頁面是否真的 reload」為準 —— 那才是使用者感受到的行為。
 */

const uiDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const watchTarget = join(uiDirectory, 'src', 'style.css');
const cbgTargets = [
  join(uiDirectory, '..', 'src-tauri', 'resources', 'examples', '01_blink.cbg'),
  join(uiDirectory, 'probe-root.cbg'),
  join(uiDirectory, 'src', 'probe-ui.cbg')
];

/** 標記頁面載入次數；整頁 reload 會讓計數歸零後重新 +1。 */
async function withReloadCounter(page) {
  await page.addInitScript(() => {
    window.__LOAD_MARK__ = (window.__LOAD_MARK__ || 0) + 1;
  });
  await page.goto('/');
  await page.waitForFunction(() => window.Blockly?.getMainWorkspace?.());
  return async () => page.evaluate(() => window.__LOAD_MARK__);
}

/** 追加內容並回傳還原函式；檔案可能不存在（探測檔）。 */
async function touch(path, suffix) {
  const { writeFile, unlink, mkdir } = await import('node:fs/promises');
  const { dirname: dirOf } = await import('node:path');
  const original = await readFile(path, 'utf8').catch(() => null);
  if (original === null) {
    await mkdir(dirOf(path), { recursive: true });
    await writeFile(path, suffix, 'utf8');
    return () => unlink(path).catch(() => {});
  }
  await writeFile(path, original + suffix, 'utf8');
  return () => writeFile(path, original, 'utf8');
}

test.describe('Vite 熱更新的忽略契約', () => {
  test('改 .cbg 不會讓頁面整頁重載（任何位置都一樣）', async ({ page }) => {
    const loads = await withReloadCounter(page);
    const before = await loads();

    const restores = [];
    // 三個不同位置各放一個 .cbg，驗證規則是依副檔名而非目錄
    for (const [index, target] of cbgTargets.entries()) {
      restores.push(await touch(target, `<!-- probe${index} -->\n`));
    }
    await page.waitForTimeout(1200);
    const after = await loads();

    for (const restore of restores) await restore();

    expect(after, '改 .cbg 不應觸發頁面重載').toBe(before);
  });

  test('改 src/style.css 仍會觸發熱更新（忽略規則沒有過度攔截）', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.Blockly?.getMainWorkspace?.());

    // CSS 是熱更新（不整頁 reload），所以改用「樣式真的變了」來驗證，
    // 而不是載入計數 —— 那會把 CSS HMR 誤判為失敗。
    await page.evaluate(() => {
      window.__CSS_MARK__ = document.createElement('style');
      window.__CSS_MARK__.id = 'hmr-probe';
      document.head.appendChild(window.__CSS_MARK__);
    });

    const restore = await touch(watchTarget, '\n.hmr-probe-marker { color: rgb(1, 2, 3); }\n');
    await page.waitForTimeout(1200);
    const applied = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.className = 'hmr-probe-marker';
      document.body.appendChild(probe);
      const colour = getComputedStyle(probe).color;
      probe.remove();
      return colour;
    });
    await restore();

    expect(applied, 'src 的樣式變更仍應被 Vite 熱更新').toBe('rgb(1, 2, 3)');
  });
});
