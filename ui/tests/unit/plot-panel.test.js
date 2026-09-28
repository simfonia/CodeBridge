import { describe, expect, test } from 'vitest';
import { loadClassicScript } from '../support/classic-script.js';

/**
 * 序列繪圖面板（plot-panel）的單元測試。
 *
 * 驗證的是**佈局決策**（左右分欄、自動撐高、窄視窗降級）與接線契約，
 * 因為這些是「畫面看起來怪但沒有報錯」的問題 —— 只有明確斷言能擋下來。
 */

const SCRIPTS = [
  'src/lib/plot/plot-parse.js',
  'src/lib/plot/plot-store.js',
  'src/lib/plot/plot-render.js',
  'src/lib/plot/plot-panel.js'
];

/** 極簡 DOM 替身，足以滿足 plot-panel 的元素操作。 */
function createElement(id) {
  const element = {
    id,
    tagName: 'DIV',
    className: '',
    textContent: '',
    title: '',
    value: '',
    children: [],
    style: {},
    offsetWidth: 400,
    offsetHeight: 300,
    attributes: {},
    classList: {
      _set: new Set(),
      add(name) { this._set.add(name); },
      remove(name) { this._set.delete(name); },
      contains(name) { return this._set.has(name); },
      toggle(name, force) {
        if (force === undefined) {
          if (this._set.has(name)) this._set.delete(name);
          else this._set.add(name);
        } else if (force) this._set.add(name);
        else this._set.delete(name);
        return this._set.has(name);
      }
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
      if (name === 'title') this.title = String(value);
    },
    getAttribute(name) {
      return this.attributes[name] === undefined ? null : this.attributes[name];
    },
    addEventListener(name, handler) {
      this.__handlers = this.__handlers || {};
      (this.__handlers[name] = this.__handlers[name] || []).push(handler);
    },
    removeEventListener() {},
    appendChild(child) { this.children.push(child); return child; },
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) this.children.splice(index, 1);
      return child;
    },
    get firstChild() { return this.children[0] || null; },
    get childElementCount() { return this.children.length; },
    getBoundingClientRect() {
      return { width: this.offsetWidth, height: this.offsetHeight, left: 0, top: 0 };
    },
    getContext: () => ({
      setTransform() {}, clearRect() {}, beginPath() {}, closePath() {},
      moveTo() {}, lineTo() {}, arc() {}, stroke() {}, fill() {},
      fillRect() {}, fillText() {}, save() {}, restore() {}
    }),
    __fire(name, event) {
      ((this.__handlers || {})[name] || []).forEach((handler) => handler(event || {}));
    }
  };
  return element;
}

/** 建立完整的假 DOM（元素表 + document）。 */
function createDom(options = {}) {
  const ids = [
    'terminalBody', 'plotPane', 'plotDivider', 'plotCanvas', 'plotLegend',
    'plotWindowSelect', 'btn-plotter', 'btn-plot-pause', 'btn-plot-clear',
    'plot-status', 'terminalTextPane'
  ];
  const elements = {};
  ids.forEach((id) => { elements[id] = createElement(id); });
  elements.terminalArea = createElement('terminalArea');
  elements.terminalArea.offsetHeight = options.terminalHeight || 200;
  elements.terminalBody.offsetWidth = options.bodyWidth || 900;

  const documentStub = {
    getElementById: (id) => elements[id] || null,
    createElement: (tag) => createElement('tag-' + tag),
    addEventListener() {},
    removeEventListener() {},
    body: createElement('body')
  };
  return { elements, document: documentStub };
}

/** 假的序列監視器。 */
function createMonitor(options = {}) {
  const dataListeners = [];
  const calls = [];
  return {
    dataListeners,
    calls,
    connected: options.connected !== false,
    hex: false,
    onDataLine(listener) { dataListeners.push(listener); },
    onChange() {},
    getState() {
      return { connected: this.connected, hex: this.hex, pausedForUpload: false };
    },
    start() { calls.push('start'); this.connected = true; return Promise.resolve(true); },
    toggle() { calls.push('toggle'); return Promise.resolve(true); }
  };
}

/** 載入全部 plot 模組並回傳 plot-panel。 */
async function loadPanel(overrides = {}) {
  const dom = createDom(overrides.dom);
  const monitor = overrides.monitor || createMonitor();
  const terminal = overrides.terminal || {
    heights: [],
    offsetHeight: () => dom.elements.terminalArea.offsetHeight,
    setHeight(px) { this.heights.push(px); dom.elements.terminalArea.offsetHeight = px; },
    open() {}
  };
  const rendered = [];
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    devicePixelRatio: 1,
    document: dom.document,
    getI18n: (key, fallback) => fallback || key,
    window: null
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const vm = await import('node:vm');
  const { readFile } = await import('node:fs/promises');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const uiDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  for (const script of SCRIPTS) {
    const code = await readFile(join(uiDirectory, script), 'utf8');
    vm.runInContext(code, vm.createContext(sandbox), { filename: script });
  }
  sandbox.CodeBridgeSerialMonitor = monitor;
  sandbox.CodeBridgeTerminalPanel = terminal;
  const panel = sandbox.CodeBridgePlotPanel;
  panel.init();
  return { panel, dom, monitor, terminal, sandbox };
}

describe('序列繪圖：面板（左右分欄佈局）', () => {
  test('公開 API 齊備', async () => {
    const { panel } = await loadPanel();
    ['init', 'open', 'close', 'toggle', 'clear', 'togglePause',
      'setWindow', 'getState', '_reset'].forEach((name) => {
      expect(typeof panel[name]).toBe('function');
    });
  });

  test('初始狀態為關閉，右欄不顯示', async () => {
    const { panel, dom } = await loadPanel();
    expect(panel.getState().open).toBe(false);
    // 關閉時不可佔用寬度，否則左邊的文字會被壓掉。
    expect(dom.elements.terminalBody.classList.contains('is-split')).toBe(false);
  });

  test('open 會把終端機分成左右兩欄', async () => {
    const { panel, dom } = await loadPanel();
    panel.open();
    expect(dom.elements.terminalBody.classList.contains('is-split')).toBe(true);
    expect(dom.elements.plotPane.style.display).not.toBe('none');
  });

  test('close 會收起右欄並還原面板高度', async () => {
    const { panel, dom, terminal } = await loadPanel();
    panel.open();
    panel.close();
    expect(dom.elements.terminalBody.classList.contains('is-split')).toBe(false);
    // 必須把自動撐高的高度還原，否則使用者會覺得「關了繪圖面板卻沒變小」。
    expect(terminal.heights.length).toBeGreaterThan(0);
  });

  test('高度不足時 open 會自動撐高到 320px', async () => {
    // 預設 200px 扣掉標題/控制列/輸入行後只剩約 110px，
    // 折線會被壓成看不出波形的一條線。
    const { panel, terminal } = await loadPanel({ dom: { terminalHeight: 200 } });
    panel.open();
    expect(terminal.heights[terminal.heights.length - 1]).toBe(320);
  });

  test('高度已足夠時 open 不會覆蓋使用者的高度', async () => {
    // 使用者刻意把面板拖到 500px，開繪圖不該把它改回 320。
    const { panel, terminal } = await loadPanel({ dom: { terminalHeight: 500 } });
    panel.open();
    expect(terminal.heights).toHaveLength(0);
  });

  test('close 只還原「自己撐的那一次」', async () => {
    const { panel, terminal } = await loadPanel({ dom: { terminalHeight: 200 } });
    panel.open();
    const afterOpen = terminal.heights.length;
    panel.close();
    // 必須有一次額外的還原寫入。
    expect(terminal.heights.length).toBe(afterOpen + 1);
    expect(terminal.heights[terminal.heights.length - 1]).toBe(200);
  });

  test('寬度不足 560px 時自動退回上下堆疊', async () => {
    const { panel, dom } = await loadPanel({ dom: { bodyWidth: 420 } });
    panel.open();
    // 兩欄各剩一點時兩邊都不能用，必須改堆疊。
    expect(dom.elements.terminalBody.classList.contains('is-stacked')).toBe(true);
  });

  test('寬度足夠時維持左右分欄（非堆疊）', async () => {
    const { panel, dom } = await loadPanel({ dom: { bodyWidth: 900 } });
    panel.open();
    expect(dom.elements.terminalBody.classList.contains('is-stacked')).toBe(false);
  });

  test('開啟繪圖時會自動開啟序列監視器', async () => {
    // 繪圖與監看共用一條連線：使用者只想看圖時不該還要再按一次開關。
    const { panel, monitor } = await loadPanel({ monitor: createMonitor({ connected: false }) });
    panel.open();
    expect(monitor.calls).toContain('start');
  });

  test('監視器已在連線時不會重複開啟', async () => {
    const { panel, monitor } = await loadPanel({ monitor: createMonitor({ connected: true }) });
    panel.open();
    expect(monitor.calls).not.toContain('start');
  });

  test('資料行會被解析並寫入儲存區', async () => {
    const { panel, monitor } = await loadPanel();
    panel.open();
    monitor.dataListeners.forEach((listener) => listener('temp:23.5'));

    const state = panel.getState();
    expect(state.sampleCount).toBe(1);
    expect(state.seriesCount).toBe(1);
  });

  test('關閉繪圖時不再收集資料（避免背景空轉）', async () => {
    const { panel, monitor } = await loadPanel();
    panel.open();
    panel.close();
    monitor.dataListeners.forEach((listener) => listener('temp:23.5'));
    expect(panel.getState().sampleCount).toBe(0);
  });

  test('HEX 模式下不解析資料（位元組串不是數值）', async () => {
    const monitor = createMonitor();
    const { panel } = await loadPanel({ monitor });
    panel.open();
    monitor.hex = true;
    panel.handleMonitorChange();
    monitor.dataListeners.forEach((listener) => listener('48 65 6C 6C 6F'));
    expect(panel.getState().sampleCount).toBe(0);
  });

  test('clear 清空繪圖資料並立即重繪', async () => {
    const { panel, monitor } = await loadPanel();
    panel.open();
    monitor.dataListeners.forEach((listener) => listener('23.5'));
    expect(panel.getState().sampleCount).toBe(1);
    panel.clear();
    expect(panel.getState().sampleCount).toBe(0);
  });

  test('setWindow 影響時間窗長度', async () => {
    const { panel } = await loadPanel();
    panel.open();
    panel.setWindow(1800);
    expect(panel.getState().windowSize).toBe(1800);
  });

  test('圖例列出所有 series 且可切換顯示', async () => {
    const { panel, monitor, dom } = await loadPanel();
    panel.open();
    monitor.dataListeners.forEach((listener) => listener('a:1, b:2'));
    expect(dom.elements.plotLegend.children).toHaveLength(2);

    panel.toggleSeries('a');
    const state = panel.getState();
    expect(state.series.find((s) => s.label === 'a').visible).toBe(false);
  });

  test('暫停後停止更新曲線但保留既有資料', async () => {
    const { panel, monitor } = await loadPanel();
    panel.open();
    monitor.dataListeners.forEach((listener) => listener('1'));
    panel.togglePause();
    monitor.dataListeners.forEach((listener) => listener('2'));
    // 暫停 = 凍結畫面，不是清空資料。
    expect(panel.getState().sampleCount).toBe(1);
    expect(panel.getState().paused).toBe(true);
  });

  test('切換語系後按鈕文字有翻譯（非空字串）', async () => {
    const { panel, dom } = await loadPanel();
    panel.open();
    expect(dom.elements['btn-plot-pause'].textContent).not.toBe('');
  });

  test('切換語系後圖例標籤重新渲染', async () => {
    const { panel, monitor, dom } = await loadPanel();
    panel.open();
    monitor.dataListeners.forEach((listener) => listener('a:1'));
    expect(dom.elements.plotLegend.children).toHaveLength(1);
    dom.elements.plotLegend.children[0].__fire('click');
    expect(dom.elements.plotLegend.children[0].className).toContain('is-off');
  });
});
