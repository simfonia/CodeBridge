import { describe, expect, test } from 'vitest';
import { createMemoryStorage, loadClassicScript } from '../support/classic-script.js';

/**
 * T2-D：板子／序列埠自動偵測的單元測試。
 *
 * 驗證的是「前端拿到後端事件後的決策」：哪個埠該被選取、什麼時候自動切板、
 * 偏好埠如何跨 reload 保留。這些都是純邏輯，不需要真實 Tauri runtime 或硬體。
 */

/** 假的 select 元素，只支援選項管理與 change 事件。 */
function createSelect(initialValue = '') {
  const children = [];
  const element = {
    value: initialValue,
    disabled: true,
    title: '',
    listeners: {},
    /** 以 firstChild／removeChild 模擬真實 DOM 的子節點管理。 */
    get firstChild() {
      return children.length ? children[0] : null;
    },
    appendChild(option) {
      children.push(option);
      return option;
    },
    removeChild(option) {
      const index = children.indexOf(option);
      if (index !== -1) children.splice(index, 1);
      return option;
    },
    addEventListener(name, handler) {
      element.listeners[name] = handler;
    },
    /** 模擬使用者手動選擇（不同於程式直接設定 value）。 */
    choose(value) {
      element.value = value;
      if (element.listeners.change) element.listeners.change({ target: element });
    },
    values() {
      return children.map((option) => option.value);
    }
  };
  return element;
}

/** 記憶體文件，只提供 board-detector 實際會取的節點。 */
function createDocument(select) {
  return {
    getElementById(id) {
      if (id === 'serial-selector') return select;
      if (id === 'btn-refresh-serial') {
        return { disabled: true, title: '', addEventListener() {} };
      }
      return null;
    },
    createElement(tag) {
      return { tagName: tag, textContent: '', value: '', className: '', setAttribute() {} };
    }
  };
}

const BRIDGE_EVENTS = [
  'codebridge://board-detected',
  'codebridge://serial-ports-changed'
];

async function loadDetector(overrides = {}) {
  const bridge = {
    calls: [],
    listeners: {},
    rawListeners: {},
    available: overrides.available !== false,
    isAvailable() { return this.available; },
    invoke(command) {
      this.calls.push(command);
      if (command === 'refresh_serial_ports') {
        return Promise.resolve(overrides.refreshPorts || []);
      }
      return Promise.reject(command + '|mock');
    },
    listen(name, handler) {
      // 忠實重現 bridge.js：真實 listen 會剝出 event.payload 再交給 handler。
      // 若直接存放裸 handler，module 會收到 { payload: {...} } 而非 payload 本身。
      this.rawListeners[name] = handler;
      this.listeners[name] = (event) => handler(event && event.payload);
      return Promise.resolve(() => {});
    },
    describeError(error) {
      const parts = String(error).split('|');
      return { key: parts[0], detail: parts[1] || '' };
    }
  };
  const select = overrides.select || createSelect();
  const storage = createMemoryStorage(overrides.storage || {});
  const sandbox = await loadClassicScript('src/lib/arduino/board-detector.js', {
    CodeBridgeTauri: bridge,
    getI18n: (key, fallback) => fallback || key
  });
  sandbox.document = createDocument(select);
  sandbox.localStorage = storage;
  return { sandbox, bridge, select, storage };
}


describe('board-detector 事件訂閱', () => {
  test('init 會訂閱序列埠與板子兩種事件', async () => {
    const { sandbox, bridge, select } = await loadDetector();
    sandbox.CodeBridgeBoardDetector.init({ select, store: createStore() });
    expect(Object.keys(bridge.listeners).sort()).toEqual(BRIDGE_EVENTS);
  });

  test('純瀏覽器環境不訂閱事件，選擇器保持停用', async () => {
    const { sandbox, bridge, select } = await loadDetector({ available: false });
    sandbox.CodeBridgeBoardDetector.init({ select, store: createStore() });
    expect(Object.keys(bridge.listeners)).toEqual([]);
    expect(select.disabled).toBe(true);
  });
});

describe('board-detector 序列埠選取', () => {
  test('埠清單變化時填入下拉選項並啟用選擇器', async () => {
    const { sandbox, bridge, select } = await loadDetector();
    sandbox.CodeBridgeBoardDetector.init({ select, store: createStore() });
    emitPorts(bridge, ['COM3', 'COM7']);

    expect(select.disabled).toBe(false);
    expect(select.values()).toEqual(['', 'COM3', 'COM7']);
  });

  test('沒有任何埠時仍保留「未偵測到」placeholder 選項', async () => {
    const { sandbox, bridge, select } = await loadDetector();
    sandbox.CodeBridgeBoardDetector.init({ select, store: createStore() });
    emitPorts(bridge, []);

    expect(select.disabled).toBe(false);
    expect(select.values()).toEqual(['']);
  });

  test('首次掃描自動選取第一個埠', async () => {
    const { sandbox, bridge, select } = await loadDetector();
    sandbox.CodeBridgeBoardDetector.init({ select, store: createStore() });
    emitPorts(bridge, ['COM3', 'COM7']);
    expect(select.value).toBe('COM3');
  });

  test('目前選取的埠仍在時保留原選擇，不被第一個埠蓋掉', async () => {
    const { sandbox, bridge, select } = await loadDetector();
    sandbox.CodeBridgeBoardDetector.init({ select, store: createStore() });
    emitPorts(bridge, ['COM3', 'COM7']);
    select.choose('COM7');

    emitPorts(bridge, ['COM3', 'COM7', 'COM9'], 'added');
    expect(select.value).toBe('COM7');
  });

  test('選取的埠消失時改選第一個可用埠', async () => {
    const { sandbox, bridge, select } = await loadDetector();
    sandbox.CodeBridgeBoardDetector.init({ select, store: createStore() });
    emitPorts(bridge, ['COM3', 'COM7']);
    select.choose('COM7');

    emitPorts(bridge, ['COM3'], 'removed');
    expect(select.value).toBe('COM3');
  });

  test('手動選擇的埠會寫入 localStorage 作為偏好埠', async () => {
    const { sandbox, bridge, select, storage } = await loadDetector();
    sandbox.CodeBridgeBoardDetector.init({ select, store: createStore() });
    emitPorts(bridge, ['COM3', 'COM7']);
    select.choose('COM7');

    expect(storage.getItem('codebridgePreferredPort')).toBe('COM7');
  });

  test('沒有任何埠時保留已選取的埠（不清空選擇）', async () => {
    const { sandbox, bridge, select } = await loadDetector();
    sandbox.CodeBridgeBoardDetector.init({ select, store: createStore() });
    emitPorts(bridge, ['COM3']);
    expect(select.value).toBe('COM3');

    emitPorts(bridge, [], 'removed');
    expect(select.values()).toEqual(['COM3']);
    expect(select.value).toBe('COM3');
  });
});

describe('board-detector 偏好埠恢復', () => {
  test('偏好埠出現時跳回，即使目前停在別的埠', async () => {
    const { sandbox, bridge, select } = await loadDetector({
      storage: { codebridgePreferredPort: 'COM7' }
    });
    sandbox.CodeBridgeBoardDetector.init({ select, store: createStore() });
    emitPorts(bridge, ['COM3', 'COM7']);

    // 拔線期間自動選到 COM3
    emitPorts(bridge, ['COM3'], 'removed');
    expect(select.value).toBe('COM3');

    // 偏好埠重插 → 必須跳回
    emitPorts(bridge, ['COM3', 'COM7'], 'added');
    expect(select.value).toBe('COM7');
  });

  test('自動選取不會覆寫偏好埠', async () => {
    const { sandbox, bridge, select, storage } = await loadDetector({
      storage: { codebridgePreferredPort: 'COM7' }
    });
    sandbox.CodeBridgeBoardDetector.init({ select, store: createStore() });
    // 只有 COM3 時退回第一個，但偏好埠不該被改寫
    emitPorts(bridge, ['COM3']);

    expect(select.value).toBe('COM3');
    expect(storage.getItem('codebridgePreferredPort')).toBe('COM7');
  });
});

describe('board-detector 自動切板', () => {
  test('板子事件把目前選取埠的 FQBN 寫入專案 metadata', async () => {
    const store = createStore();
    const { sandbox, bridge, select } = await loadDetector();
    sandbox.CodeBridgeBoardDetector.init({ select, store });
    emitPorts(bridge, ['COM3']);
    bridge.listeners['codebridge://board-detected']({
      payload: { boards: [{ port: 'COM3', fqbn: 'arduino:avr:uno', name: 'Arduino Uno' }], unknown: [] }
    });

    expect(store.meta.port).toBe('COM3');
    expect(store.meta.fqbn).toBe('arduino:avr:uno');
  });

  test('無法辨識的埠不覆寫使用者已選的 FQBN', async () => {
    const store = createStore({ fqbn: 'arduino:avr:mega' });
    const { sandbox, bridge, select } = await loadDetector();
    sandbox.CodeBridgeBoardDetector.init({ select, store });
    emitPorts(bridge, ['COM3']);
    bridge.listeners['codebridge://board-detected']({ payload: { boards: [], unknown: ['COM3'] } });

    expect(store.meta.fqbn).toBe('arduino:avr:mega');
    expect(store.meta.port).toBe('COM3');
  });

  test('板子事件不影響非目前選取埠的既有 FQBN', async () => {
    const store = createStore({ fqbn: 'arduino:avr:mega', port: 'COM9' });
    const { sandbox, bridge, select } = await loadDetector();
    sandbox.CodeBridgeBoardDetector.init({ select, store });
    emitPorts(bridge, ['COM3', 'COM9']);
    bridge.listeners['codebridge://board-detected']({
      payload: { boards: [{ port: 'COM3', fqbn: 'arduino:avr:uno', name: 'Uno' }], unknown: [] }
    });

    expect(store.meta.port).toBe('COM9');
    expect(store.meta.fqbn).toBe('arduino:avr:mega');
  });

  test('自動切換序列埠不會改變專案已設定的 FQBN', async () => {
    // 自動切板只在 meta.fqbn 為空時填入：使用者已選的板子代表「這個專案
    // 要燒哪顆晶片」，自動偵測到的硬體不該靜默改掉它（改板子應由
    // 板子選擇面板明確操作）。否則上傳前比對會永遠是「相同」而形同虛設。
    const store = createStore();
    const { sandbox, bridge, select } = await loadDetector();
    sandbox.CodeBridgeBoardDetector.init({ select, store });
    emitPorts(bridge, ['COM3', 'COM7']);
    bridge.listeners['codebridge://board-detected']({
      payload: {
        boards: [
          { port: 'COM3', fqbn: 'arduino:avr:uno', name: 'Uno' },
          { port: 'COM7', fqbn: 'arduino:avr:nano', name: 'Nano' }
        ],
        unknown: []
      }
    });
    // 首次偵測：使用者尚未選過板子 → 填入
    expect(store.meta.fqbn).toBe('arduino:avr:uno');

    select.choose('COM7');
    expect(store.meta.port).toBe('COM7');
    // 已設定過 FQBN → 保持不變
    expect(store.meta.fqbn).toBe('arduino:avr:uno');
  });

  test('getState 回傳目前埠與 FQBN 供上傳前比對', async () => {
    const store = createStore();
    const { sandbox, bridge, select } = await loadDetector();
    sandbox.CodeBridgeBoardDetector.init({ select, store });
    emitPorts(bridge, ['COM3']);
    bridge.listeners['codebridge://board-detected']({
      payload: { boards: [{ port: 'COM3', fqbn: 'arduino:avr:uno', name: 'Uno' }], unknown: [] }
    });

    const state = sandbox.CodeBridgeBoardDetector.getState();
    expect(state.port).toBe('COM3');
    expect(state.fqbn).toBe('arduino:avr:uno');
  });
});

describe('board-detector 重新整理', () => {
  test('refresh 呼叫後端重新掃描並套用結果', async () => {
    const { sandbox, bridge, select } = await loadDetector({ refreshPorts: ['COM5'] });
    sandbox.CodeBridgeBoardDetector.init({ select, store: createStore() });

    await sandbox.CodeBridgeBoardDetector.refresh();

    expect(bridge.calls).toContain('refresh_serial_ports');
    expect(select.values()).toEqual(['', 'COM5']);
  });

  test('refresh 在純瀏覽器環境安全失敗', async () => {
    const { sandbox, bridge } = await loadDetector({ available: false });
    sandbox.CodeBridgeBoardDetector.init({ select: createSelect(), store: createStore() });
    await expect(sandbox.CodeBridgeBoardDetector.refresh()).resolves.toBe(false);
    expect(bridge.calls).toEqual([]);
  });
});

describe('board-detector 上傳前板子比對', () => {
  /** 載入時注入假的確認對話框，記錄提問次數並回傳指定答案。 */
  async function loadWithConfirm(answer) {
    const loaded = await loadDetector();
    const asked = [];
    loaded.sandbox.CodeBridgeConfirm = {
      ask(details) {
        asked.push(details);
        return Promise.resolve(answer);
      }
    };
    return Object.assign(loaded, { asked });
  }

  test('偵測到的 FQBN 與專案相同時直接放行，不打扰使用者', async () => {
    const store = createStore({ fqbn: 'arduino:avr:uno' });
    const { sandbox, bridge, select, asked } = await loadWithConfirm(false);
    sandbox.CodeBridgeBoardDetector.init({ select, store });
    emitPorts(bridge, ['COM3']);
    bridge.listeners['codebridge://board-detected']({
      payload: { boards: [{ port: 'COM3', fqbn: 'arduino:avr:uno', name: 'Uno' }], unknown: [] }
    });

    const allowed = await sandbox.CodeBridgeBoardDetector.verifyBoardForUpload();
    expect(allowed).toBe(true);
    expect(asked).toEqual([]);
  });

  test('偵測到的 FQBN 與專案不同時詢問使用者', async () => {
    const store = createStore({ fqbn: 'arduino:avr:mega' });
    const { sandbox, bridge, select, asked } = await loadWithConfirm(true);
    sandbox.CodeBridgeBoardDetector.init({ select, store });
    emitPorts(bridge, ['COM3']);
    bridge.listeners['codebridge://board-detected']({
      payload: { boards: [{ port: 'COM3', fqbn: 'arduino:avr:uno', name: 'Arduino Uno' }], unknown: [] }
    });

    const allowed = await sandbox.CodeBridgeBoardDetector.verifyBoardForUpload();
    expect(allowed).toBe(true);
    expect(asked.length).toBe(1);
    // 訊息要帶入兩邊的板子資訊，讓使用者判斷是同一顆晶片。
    expect(asked[0].message).toContain('Arduino Uno');
    expect(asked[0].message).toContain('arduino:avr:mega');
  });
  test('使用者取消時中止上傳', async () => {
    const store = createStore({ fqbn: 'arduino:avr:mega' });
    const { sandbox, bridge, select } = await loadWithConfirm(false);
    sandbox.CodeBridgeBoardDetector.init({ select, store });
    emitPorts(bridge, ['COM3']);
    bridge.listeners['codebridge://board-detected']({
      payload: { boards: [{ port: 'COM3', fqbn: 'arduino:avr:uno', name: 'Uno' }], unknown: [] }
    });

    const allowed = await sandbox.CodeBridgeBoardDetector.verifyBoardForUpload();
    expect(allowed).toBe(false);
  });

  test('無法辨識板子（無 FQBN）時不阻擋上傳', async () => {
    // 沒有對應 core 時無法比對；此時應讓使用者自行決定，不可擋下整個流程。
    const store = createStore({ fqbn: 'arduino:avr:uno' });
    const { sandbox, bridge, select, asked } = await loadWithConfirm(false);
    sandbox.CodeBridgeBoardDetector.init({ select, store });
    emitPorts(bridge, ['COM3']);
    bridge.listeners['codebridge://board-detected']({ payload: { boards: [], unknown: ['COM3'] } });

    const allowed = await sandbox.CodeBridgeBoardDetector.verifyBoardForUpload();
    expect(allowed).toBe(true);
    expect(asked).toEqual([]);
  });

  test('沒有選擇序列埠時不阻擋（另有 CLI_ERROR_NO_PORT 處理）', async () => {
    const store = createStore({ fqbn: 'arduino:avr:uno' });
    const { sandbox, asked } = await loadWithConfirm(false);
    sandbox.CodeBridgeBoardDetector.init({ select: createSelect(), store });

    const allowed = await sandbox.CodeBridgeBoardDetector.verifyBoardForUpload();
    expect(allowed).toBe(true);
    expect(asked).toEqual([]);
  });
});

/** 建立可寫入的假 store，module 會直接更新其 meta。 */
function createStore(initialMeta = {}) {
  const meta = Object.assign({ fqbn: null, port: null }, initialMeta);
  return {
    meta,
    getState: () => ({ meta }),
    setMeta(next) { Object.assign(meta, next); }
  };
}

/** 送出一次序列埠變化事件。 */
function emitPorts(bridge, ports, change = 'initial') {
  bridge.listeners['codebridge://serial-ports-changed']({
    payload: { ports, change, added: ports, removed: [] }
  });
}
