import { describe, expect, test } from 'vitest';
import { loadClassicScript } from '../support/classic-script.js';

/**
 * 序列繪圖的 Canvas 繪圖單元測試。
 *
 * 這裡 mock 掉 2D context，只驗證**繪圖契約**（呼叫了哪些繪圖操作、
 * 畫了幾條線、座標是否合法），不去驗像素。
 * 像素級驗證在沒有真實 canvas 的 Node 環境做不到，而且對本次需求毫無價值 ——
 * 真正要防的是「隱藏的 series 還在畫」「NaN 讓整張圖消失」這類邏輯錯誤。
 */

const SCRIPT = 'src/lib/plot/plot-render.js';

/** 記錄所有 2D context 操作的假 canvas。 */
function createCanvas(width = 400, height = 200) {
  const calls = [];
  const context = {
    calls,
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
    beginPath() { calls.push({ op: 'beginPath' }); },
    closePath() { calls.push({ op: 'closePath' }); },
    // 記錄「當下」的線寬：折線與格線用的是同一組方法，
    // 測試要靠線寬區分兩者，因此在呼叫點快照而非事後讀取。
    moveTo(x, y) { calls.push({ op: 'moveTo', x, y, lineWidth: this.lineWidth }); },
    lineTo(x, y) { calls.push({ op: 'lineTo', x, y, lineWidth: this.lineWidth }); },
    arc(x, y, r) { calls.push({ op: 'arc', x, y, r }); },
    stroke() { calls.push({ op: 'stroke', lineWidth: this.lineWidth }); },
    fill() { calls.push({ op: 'fill', fillStyle: this.fillStyle }); },
    fillRect(x, y, w, h) { calls.push({ op: 'fillRect', x, y, w, h }); },
    clearRect(x, y, w, h) { calls.push({ op: 'clearRect', x, y, w, h }); },
    fillText(text, x, y) { calls.push({ op: 'fillText', text, x, y }); },
    save() { calls.push({ op: 'save' }); },
    restore() { calls.push({ op: 'restore' }); },
    setTransform() { calls.push({ op: 'setTransform' }); },
    translate() { calls.push({ op: 'translate' }); },
    scale() { calls.push({ op: 'scale' }); }
  };
  return {
    width,
    height,
    style: {},
    getContext: () => context,
    getBoundingClientRect: () => ({ width, height, left: 0, top: 0 }),
    __calls: calls
  };
}

/** 建立切片資料。 */
function slice(series, range) {
  return {
    points: [],
    range: range || { min: 0, max: 100 },
    downsampled: false,
    series: series
  };
}

function seriesOf(label, values, visible = true) {
  return {
    label,
    visible,
    points: values.map((value, index) => ({ t: index, value, index }))
  };
}

async function loadRenderer(canvas, dpr = 1) {
  const sandbox = await loadClassicScript(SCRIPT, { devicePixelRatio: dpr });
  return sandbox.CodeBridgePlotRender.createRenderer(canvas);
}

/** 只挑出折線的 stroke（格線用 1px，折線用更粗的線寬）。 */
function polylines(canvas) {
  return canvas.__calls.filter(
    (call) => call.op === 'stroke' && call.lineWidth && call.lineWidth > 1
  );
}

describe('序列繪圖：Canvas 繪圖', () => {
  test('公開 API 齊備', async () => {
    const sandbox = await loadClassicScript(SCRIPT, { devicePixelRatio: 1 });
    const renderer = sandbox.CodeBridgePlotRender.createRenderer(createCanvas());
    ['draw', 'resize', 'clear', 'colorFor', 'destroy'].forEach((name) => {
      expect(typeof renderer[name]).toBe('function');
    });
  });

  test('canvas 尺寸不足時安全返回，不拋例外', async () => {
    const renderer = await loadRenderer(createCanvas(0, 0));
    expect(() => renderer.draw(slice([]))).not.toThrow();
  });

  test('沒有任何 series 時不畫折線', async () => {
    const canvas = createCanvas();
    const renderer = await loadRenderer(canvas);
    renderer.draw(slice([]));
    expect(polylines(canvas).length).toBe(0);
  });

  test('每個可見 series 畫一條線', async () => {
    const canvas = createCanvas();
    const renderer = await loadRenderer(canvas);
    renderer.draw(slice([
      seriesOf('a', [10, 20, 30]),
      seriesOf('b', [5, 15, 25]),
      seriesOf('c', [1, 2, 3])
    ]));

    expect(polylines(canvas)).toHaveLength(3);
  });

  test('隱藏的 series 不繪製', async () => {
    const canvas = createCanvas();
    const renderer = await loadRenderer(canvas);
    renderer.draw(slice([
      seriesOf('a', [10, 20, 30], true),
      seriesOf('b', [5, 15, 25], false)
    ]));

    expect(polylines(canvas)).toHaveLength(1);
  });

  test('繪圖前先清除畫布（否則舊曲線會殘留）', async () => {
    const canvas = createCanvas();
    const renderer = await loadRenderer(canvas);
    renderer.draw(slice([seriesOf('a', [1, 2, 3])]));

    expect(canvas.__calls.some((call) => call.op === 'clearRect')).toBe(true);
  });

  test('繪圖的座標全部落在畫布範圍內（不可出現 NaN）', async () => {
    const canvas = createCanvas(400, 200);
    const renderer = await loadRenderer(canvas);
    renderer.draw(slice([seriesOf('a', [0, 50, 100])]));

    const coords = canvas.__calls
      .filter((call) => call.op === 'lineTo' || call.op === 'moveTo')
      .flatMap((call) => [call.x, call.y]);

    expect(coords.length).toBeGreaterThan(0);
    coords.forEach((value) => {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThanOrEqual(401);
    });
  });

  test('null 斷線點不會畫出連到 y=0 的假直線', async () => {
    const canvas = createCanvas(400, 200);
    const renderer = await loadRenderer(canvas);
    // 10 → null → 30：斷線處必須斷開，不能畫出 V 字形掉到 0。
    // range 固定 0..100，因此 value 10 → y=166、value 30 → y=134。
    renderer.draw(slice([seriesOf('a', [10, null, 30])], { min: 0, max: 100 }));

    // 只看「非格線」的繪圖：格線永遠從 PADDING.left 開始、寬度固定，
    // 因此以 lineWidth > 1（折線專用）篩出真正的折線繪圖。
    const marks = canvas.__calls.filter((call) =>
      (call.op === 'moveTo' || call.op === 'lineTo') && call.lineWidth > 1
    );
    // 兩段有效資料各自獨立起筆 → 2 次 moveTo、0 次 lineTo。
    // 若錯誤地跨過 null 連線，會變成 1 次 moveTo + 1 次 lineTo。
    expect(marks.filter((call) => call.op === 'moveTo')).toHaveLength(2);
    expect(marks.filter((call) => call.op === 'lineTo')).toHaveLength(0);
  });

  test('devicePixelRatio 會放大後備緩衝並縮放座標', async () => {
    const canvas = createCanvas(400, 200);
    const renderer = await loadRenderer(canvas, 2);
    renderer.draw(slice([seriesOf('a', [10, 20])]));

    // 後備緩衝應為 2 倍，否則在高 DPI 螢幕上線條會糊掉。
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(400);
    expect(canvas.__calls.some((call) => call.op === 'setTransform')).toBe(true);
  });

  test('colorFor 依登錄順序穩定取色', async () => {
    const renderer = await loadRenderer(createCanvas());
    const first = renderer.colorFor(0);
    expect(renderer.colorFor(0)).toBe(first);
    expect(typeof first).toBe('string');
    expect(renderer.colorFor(1)).not.toBe(first);
  });

  test('clear 會清除畫布', async () => {
    const canvas = createCanvas();
    const renderer = await loadRenderer(canvas);
    renderer.draw(slice([seriesOf('a', [1, 2, 3])]));
    renderer.clear();
    expect(canvas.__calls.filter((call) => call.op === 'clearRect').length)
      .toBeGreaterThanOrEqual(2);
  });

  test('單點 series（只有一筆資料）也能畫出來', async () => {
    const canvas = createCanvas();
    const renderer = await loadRenderer(canvas);
    renderer.draw(slice([seriesOf('a', [42])]));

    // 單點沒有線段，必須用點表示，否則使用者會以為沒收到資料。
    expect(canvas.__calls.some((call) => call.op === 'arc' || call.op === 'fillRect'))
      .toBe(true);
  });
});

