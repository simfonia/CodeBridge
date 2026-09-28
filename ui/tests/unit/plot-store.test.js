import { describe, expect, test } from 'vitest';
import { loadClassicScript } from '../support/classic-script.js';

/**
 * 序列繪圖的資料儲存（ring buffer）單元測試。
 *
 * 驗證的是**記憶體上限**與**時間窗切片**：webview 記憶體不可無限成長，
 * 而下抽樣必須保留尖峰（min/max 對包絡）而不是抽稀 —— 抽稀會讓峰值消失，
 * 那是誤導而非最佳化。
 */

const SCRIPT = 'src/lib/plot/plot-store.js';

/** 載入模組並取出公開 API（sandbox 上掛的是 `CodeBridgePlotStore`）。 */
async function loadStore() {
  const sandbox = await loadClassicScript(SCRIPT);
  return sandbox.CodeBridgePlotStore;
}

/** 餵入 n 筆遞增資料。 */
function feed(store, n, start = 0) {
  for (let i = 0; i < n; i += 1) {
    store.push([{ label: '1', value: i, index: 0 }], start + i);
  }
}

describe('序列繪圖：資料儲存（ring buffer）', () => {
  test('公開 API 齊備', async () => {
    const { createStore } = await loadStore();
    const store = createStore();
    ['push', 'seriesList', 'window', 'clear', 'toggleVisible',
      'setWindow', 'getState', 'reset'].forEach((name) => {
      expect(typeof store[name]).toBe('function');
    });
  });

  test('push 後可取得 series 清單', async () => {
    const { createStore } = await loadStore();
    const store = createStore();
    store.push([
      { label: 'temp', value: 23.5, index: 0 },
      { label: 'humid', value: 60, index: 1 }
    ], 0);

    const list = store.seriesList();
    expect(list.map((s) => s.label)).toEqual(['temp', 'humid']);
    expect(list[0].points.length).toBe(1);
    expect(list[1].points[0].value).toBe(60);
  });

  test('相同標籤會累積在同一個 series（顏色必須穩定）', async () => {
    const { createStore } = await loadStore();
    const store = createStore();
    store.push([{ label: 'temp', value: 1, index: 0 }], 0);
    store.push([{ label: 'temp', value: 2, index: 0 }], 1);

    const list = store.seriesList();
    expect(list.length).toBe(1);
    expect(list[0].points.map((p) => p.value)).toEqual([1, 2]);
  });

  test('超出容量時丟棄最舊的點（ring buffer 語意）', async () => {
    const { createStore } = await loadStore();
    const store = createStore({ maxPoints: 10 });
    feed(store, 25);

    const points = store.seriesList()[0].points;
    expect(points.length).toBe(10);
    // 最舊的 15 筆已被丟棄，保留最後 10 筆（15..24）。
    expect(points.map((p) => p.value)).toEqual([15, 16, 17, 18, 19, 20, 21, 22, 23, 24]);
  });

  test('null 值保留為斷線點（不可被當成 0 畫出直線）', async () => {
    const { createStore } = await loadStore();
    const store = createStore();
    store.push([{ label: '1', value: 1, index: 0 }], 0);
    store.push([{ label: '1', value: null, index: 0 }], 1);
    store.push([{ label: '1', value: 3, index: 0 }], 2);

    const points = store.seriesList()[0].points;
    expect(points.map((p) => p.value)).toEqual([1, null, 3]);
  });

  test('clear 清空所有資料與 series', async () => {
    const { createStore } = await loadStore();
    const store = createStore();
    feed(store, 5);
    store.clear();

    expect(store.seriesList()).toEqual([]);
    expect(store.getState().sampleCount).toBe(0);
  });

  test('時間窗切片只回傳最近 N 筆', async () => {
    const { createStore } = await loadStore();
    const store = createStore();
    feed(store, 100);

    const slice = store.window(10);
    expect(slice.points.length).toBe(10);
    expect(slice.points[0].value).toBe(90);
    expect(slice.points[9].value).toBe(99);
  });

  test('時間窗大於總點數時回傳全部（不得補空點）', async () => {
    const { createStore } = await loadStore();
    const store = createStore();
    feed(store, 5);

    expect(store.window(600).points.length).toBe(5);
  });

  test('下抽樣在點數超過像素寬度時保留 min/max 對包絡', async () => {
    const { createStore } = await loadStore();
    const store = createStore();
    feed(store, 100);

    const slice = store.window(600, 8);
    const values = slice.points.map((p) => p.value);

    // 高峰（50）必須被保留 —— 抽稀會讓它消失，那是誤導。
    expect(values).toContain(50);
    // 輸出點數不得超過像素寬度（每像素最多 2 個：min 與 max）。
    expect(slice.points.length).toBeLessThanOrEqual(16);
  });

  test('下抽樣後的最小／最大值與原始資料一致', async () => {
    const { createStore } = await loadStore();
    const store = createStore();
    feed(store, 100);

    const values = store.window(600, 8).points.map((p) => p.value);
    expect(Math.min(...values)).toBe(0);
    expect(Math.max(...values)).toBe(99);
  });

  test('點數少於像素寬度時不做任何取樣', async () => {
    const { createStore } = await loadStore();
    const store = createStore();
    feed(store, 10);

    const slice = store.window(600, 800);
    expect(slice.points.length).toBe(10);
    expect(slice.downsampled).toBe(false);
  });

  test('Y 軸範圍自適應且包含 0', async () => {
    const { createStore } = await loadStore();
    const store = createStore();
    store.push([{ label: '1', value: 40, index: 0 }], 0);
    store.push([{ label: '1', value: 60, index: 0 }], 1);

    const range = store.window(600).range;
    expect(range.min).toBe(0);
    expect(range.max).toBe(60);
  });

  test('Y 軸範圍涵蓋所有可見 series', async () => {
    const { createStore } = await loadStore();
    const store = createStore();
    store.push([
      { label: 'a', value: 10, index: 0 },
      { label: 'b', value: 300, index: 1 }
    ], 0);

    expect(store.window(600).range.max).toBe(300);
  });

  test('隱藏的 series 不影響 Y 軸範圍', async () => {
    const { createStore } = await loadStore();
    const store = createStore();
    store.push([
      { label: 'a', value: 10, index: 0 },
      { label: 'b', value: 300, index: 1 }
    ], 0);

    store.toggleVisible('b');
    expect(store.window(600).range.max).toBe(10);
    // 資料本身不可被隱藏動作清掉。
    expect(store.seriesList().find((s) => s.label === 'b').points.length).toBe(1);
  });

  test('沒有可見資料時 range 退為 0..1（不可為 NaN）', async () => {
    const { createStore } = await loadStore();
    const store = createStore();

    const range = store.window(600).range;
    expect(range.min).toBe(0);
    expect(range.max).toBe(1);
  });

  test('setWindow 記憶視窗長度，無效值退回預設', async () => {
    const { createStore, DEFAULT_WINDOW } = await loadStore();
    const store = createStore();
    store.setWindow(1800);
    expect(store.getState().windowSize).toBe(1800);
    // 不可讓視窗變成 NaN。
    store.setWindow(0);
    // 用常數斷言而非寫死數字，日後調預設值時這條測試不必跟著改。
    // （2026-09-28 預設由 600（10 秒）改為 200（3 秒）。）
    expect(store.getState().windowSize).toBe(DEFAULT_WINDOW);
    expect(DEFAULT_WINDOW, '預設時間窗對應 3 秒 @ 60Hz').toBe(200);
  });

  test('push 忽略 NaN 與非有限值（不可污染 ring buffer）', async () => {
    const { createStore } = await loadStore();
    const store = createStore();
    store.push([{ label: '1', value: Number.NaN, index: 0 }], 0);
    store.push([{ label: '1', value: Infinity, index: 0 }], 1);

    expect(store.seriesList()).toEqual([]);
  });

  test('接受字串數字並轉為數值', async () => {
    const { createStore } = await loadStore();
    const store = createStore();
    store.push([{ label: '1', value: '12.5', index: 0 }], 0);

    expect(store.seriesList()[0].points[0].value).toBe(12.5);
  });

  test('push 對空陣列與非陣列輸入安全', async () => {
    const { createStore } = await loadStore();
    const store = createStore();
    expect(() => store.push(null, 0)).not.toThrow();
    expect(() => store.push([], 0)).not.toThrow();
    expect(store.seriesList()).toEqual([]);
  });
});

