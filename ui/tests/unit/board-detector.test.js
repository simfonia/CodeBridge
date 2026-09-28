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
      if (command === 'get_serial_ports') return Promise.resolve(['COM3', 'COM7']);
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

describe('board-detector 初始快照', () => {
  test('init 会主動拉取当前序列埠（事件可能在 init 前就發出）', async () => {
    // 事件遗失：Rust 在 setup() 就啟動 watcher，第一次 emit 在數十毫秒內；
    // 而前端要等 Blockly 載入后才註寫 listener－事件在統命前發出就永久遺失。
    // 解法：事件管「後續變化」，初始快照管「當前狀態」。
    const { sandbox, bridge } = await loadDetector();
    sandbox.CodeBridgeBoardDetector.init({ select: createSelect(), store: createStore() });

    // 序列埠下拉應與 init 結果一致（非空清單）。
    expect(bridge.calls).toContain('get_serial_ports');
  });

  test('初始快照不動使用者已選的埠', async () => {
    // 2026-09-28：序列埠狀態只存在於下拉與 localStorage 偏好埠。
    // 初始快照不得覆寫使用者眼前的選擇 —— 那正是「UI 顯示 A、上傳燒到 B」
    // 這類不一致的來源。
    const { sandbox, bridge, select } = await loadDetector();
    sandbox.CodeBridgeBoardDetector.init({ select, store: createStore() });
    // 使用者先手動選了 COM3（mock 快照含 COM3/COM7）。
    select.choose('COM3');
    await flushAsync();
    await flushAsync();
    await flushAsync();

    // 快照回填後仍維持 COM3。
    expect(select.value).toBe('COM3');
  });

  test('主動拉取到的序列埠會顯示在下拉菜單', async () => {
    const { sandbox, bridge, select } = await loadDetector();
    sandbox.CodeBridgeBoardDetector.init({ select, store: createStore() });
    await flushAsync();

    expect(select.values()).toEqual(['COM3', 'COM7']);
  });
});

describe('board-detector 序列埠選取', () => {
  test('埠清單變化時填入下拉選項並啟用選擇器', async () => {
    const { sandbox, bridge, select } = await loadDetector();
    sandbox.CodeBridgeBoardDetector.init({ select, store: createStore() });
    emitPorts(bridge, ['COM3', 'COM7']);

    expect(select.disabled).toBe(false);
    // 真的有埠時**不該**出現「未偵測到序列埠」——
    // 使用者明明插著板子，卻看到這個選項會以為沒偵測到。
    expect(select.values()).toEqual(['COM3', 'COM7']);
  });

  test('沒有任何埠時顯示「未偵測到序列埠」提示', async () => {
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

  test('拔掉板子時顯示「未偵測到」提示且保留原選擇', async () => {
    // 拔線後要讓使用者知道板子不見了（否則會以為還插著而一直按執行），
    // 但仍保留原選擇，讓重插時不需要重選。
    const { sandbox, bridge, select } = await loadDetector();
    sandbox.CodeBridgeBoardDetector.init({ select, store: createStore() });
    emitPorts(bridge, ['COM3']);
    expect(select.value).toBe('COM3');

    emitPorts(bridge, [], 'removed');

    // 第一項必須是「未偵測到序列埠」的提示，而不是直接消失。
    expect(select.values()[0]).toBe('');
    expect(select.values()).toContain('COM3');
    expect(select.value).toBe('COM3');
  });
});

describe('board-detector 手動選板', () => {
  test('手動選定的 fqbn 優先於自動偵測結果', async () => {
    // 2026-09-28 回歸：使用者從面板選了 UNO，按上傳卻報
    // 「尚未選擇開發板」。因為選板結果寫在別處，而 getState() 只反映
    // 後端偵測 —— 沒有對應 core 時偵測不到，就永遠是空。
    //
    // 手動選擇必須是自動偵測之上的覆寫層：使用者知道自己在用什麼板。
    const { sandbox, bridge, select } = await loadDetector();
    sandbox.CodeBridgeBoardDetector.init({ select, store: createStore() });
    emitPorts(bridge, ['COM3']);
    // 後端只認得 COM3 是 Uno。
    bridge.listeners['codebridge://board-detected']({
      payload: { boards: [{ port: 'COM3', fqbn: 'arduino:avr:uno', name: 'Uno' }], unknown: [] }
    });
    expect(sandbox.CodeBridgeBoardDetector.getState().fqbn).toBe('arduino:avr:uno');

    sandbox.CodeBridgeBoardDetector.setManualFqbn('arduino:avr:mega');

    expect(sandbox.CodeBridgeBoardDetector.getState().fqbn).toBe('arduino:avr:mega');
  });

  test('手動選板在偵測不到板子時仍然有效', async () => {
    // 情境：使用者插了 clone 板，後端認不出（unknown），但他知道自己用什麼。
    const { sandbox, bridge, select } = await loadDetector();
    sandbox.CodeBridgeBoardDetector.init({ select, store: createStore() });
    emitPorts(bridge, ['COM4']);
    bridge.listeners['codebridge://board-detected']({
      payload: { boards: [], unknown: ['COM4'] }
    });
    expect(sandbox.CodeBridgeBoardDetector.getState().fqbn).toBe('');

    sandbox.CodeBridgeBoardDetector.setManualFqbn('arduino:avr:uno');

    expect(sandbox.CodeBridgeBoardDetector.getState().fqbn).toBe('arduino:avr:uno');
  });

  test('傳入空字串可清除手動選擇，回到自動偵測', async () => {
    const { sandbox, bridge, select } = await loadDetector();
    sandbox.CodeBridgeBoardDetector.init({ select, store: createStore() });
    emitPorts(bridge, ['COM3']);
    bridge.listeners['codebridge://board-detected']({
      payload: { boards: [{ port: 'COM3', fqbn: 'arduino:avr:uno', name: 'Uno' }], unknown: [] }
    });
    sandbox.CodeBridgeBoardDetector.setManualFqbn('arduino:avr:mega');

    sandbox.CodeBridgeBoardDetector.setManualFqbn('');

    expect(sandbox.CodeBridgeBoardDetector.getState().fqbn).toBe('arduino:avr:uno');
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

describe('board-detector 重新整理', () => {
  test('refresh 呼叫後端重新掃描並套用結果', async () => {
    const { sandbox, bridge, select } = await loadDetector({ refreshPorts: ['COM5'] });
    sandbox.CodeBridgeBoardDetector.init({ select, store: createStore() });

    await sandbox.CodeBridgeBoardDetector.refresh();

    expect(bridge.calls).toContain('refresh_serial_ports');
    // 有可用埠時不顯示「未偵測到序列埠」placeholder。
    expect(select.values()).toEqual(['COM5']);
  });

  test('refresh 在純瀏覽器環境安全失敗', async () => {
    const { sandbox, bridge } = await loadDetector({ available: false });
    sandbox.CodeBridgeBoardDetector.init({ select: createSelect(), store: createStore() });
    await expect(sandbox.CodeBridgeBoardDetector.refresh()).resolves.toBe(false);
    expect(bridge.calls).toEqual([]);
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
function flushAsync() {
  return new Promise((resolve) => setImmediate(resolve));
}

function emitPorts(bridge, ports, change = 'initial') {
  bridge.listeners['codebridge://serial-ports-changed']({
    payload: { ports, change, added: ports, removed: [] }
  });
}
