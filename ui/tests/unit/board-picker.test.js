import { describe, expect, test } from 'vitest';
import { loadClassicScript } from '../support/classic-script.js';

/**
 * T2-E：板子選擇面板的單元測試。
 *
 * 驗證的是「面板的搜尋過濾與選取決策」：分頁切換、搜尋比對、
 * 選取後如何寫回 metadata。這些都是純邏輯，不需要真實 Tauri 或硬體。
 */

/** 假的按鈕，只記錄監聽器與停用狀態。 */
function createButton() {
  return {
    disabled: false,
    title: '',
    listeners: {},
    addEventListener(name, handler) { this.listeners[name] = handler; },
    click() { if (this.listeners.click) this.listeners.click({ target: this }); }
  };
}

/** 假的 input，記錄 value 與監聽器。 */
function createInput() {
  return {
    value: '',
    placeholder: '',
    listeners: {},
    addEventListener(name, handler) { this.listeners[name] = handler; },
    /** 模擬使用者輸入。 */
    type(text) {
      this.value = text;
      if (this.listeners.input) this.listeners.input({ target: this });
    },
    focus() { this.focused = true; }
  };
}

/** 可寫入的假 store，module 會直接更新其 meta。 */
function createStore(initialMeta = {}) {
  const meta = Object.assign({ fqbn: null, port: null }, initialMeta);
  return {
    meta,
    getState: () => ({ meta }),
    setMeta(next) { Object.assign(meta, next); }
  };
}

/** 假的清單容器，支援 appendChild／removeChild（面板每輪 render 都會清空重建）。 */
function createListBox() {
  const children = [];
  return {
    innerHTML: '',
    get children() { return children.slice(); },
    appendChild(child) { children.push(child); return child; },
    removeChild(child) {
      const index = children.indexOf(child);
      if (index !== -1) children.splice(index, 1);
      return child;
    }
  };
}

/** 測試用的開發板清單（對應後端 `board_list_all` 的回應形狀）。 */
const BOARDS = [
  { name: 'Arduino Uno', fqbn: 'arduino:avr:uno' },
  { name: 'Arduino Nano', fqbn: 'arduino:avr:nano' },
  { name: 'Arduino Mega', fqbn: 'arduino:avr:mega' }
];

/**
 * 建立假的 document：提供面板需要的節點，並記錄建立的清單項。
 *
 * `items` 收集面板每次 render 產生的清單項，讓測試能驗證「畫面上實際
 * 顯示了哪些板子」而不只是內部狀態。
 */
function createDocument(buttons = {}) {
  const overlay = {
    hidden: true,
    children: [],
    listeners: {},
    querySelector: () => null,
    addEventListener(name, handler) { this.listeners[name] = handler; },
    appendChild(child) { this.children.push(child); }
  };
  // 面板每輪 render 都會重新取得清單容器，因此這裡必須是**同一個實例**，
  // 否則測試會讀到空的新容器，看不到任何渲染結果。
  const listBox = buttons.list || createListBox();
  const selectButton = buttons.selectBoard || createButton();
  const searchField = buttons.search || createInput();
  const closeButton = buttons.close || createButton();
  const doc = {
    appended: null,
    body: { appendChild(node) { doc.appended = node; } },
    getElementById(id) {
      if (id === 'btn-select-board') return selectButton;
      if (id === 'cb-board-search') return searchField;
      if (id === 'cb-board-list') return listBox;
      if (id === 'cb-board-panel') return overlay;
      if (id === 'cb-board-close') return closeButton;
      return null;
    },
    createElement(tag) {
      const node = {
        tagName: tag,
        textContent: '',
        value: '',
        className: '',
        dataset: {},
        children: [],
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        getAttribute(name) {
          return this.attributes[name] === undefined ? null : this.attributes[name];
        },
        appendChild(child) { this.children.push(child); return child; },
        addEventListener(name, handler) {
          this.__listeners = this.__listeners || {};
          this.__listeners[name] = handler;
        },
        click() {
          if (this.__listeners && this.__listeners.click) this.__listeners.click({ target: this });
        }
      };
      return node;
    }
  };
  return doc;
}

async function loadPicker(overrides = {}) {
  const bridge = {
    calls: [],
    available: overrides.available !== false,
    boards: overrides.boards || BOARDS,
    boardError: overrides.boardError || null,
    isAvailable() { return this.available; },
    invoke(command) {
      this.calls.push(command);
      if (command === 'board_list_all') {
        if (this.boardError) return Promise.reject(this.boardError);
        return Promise.resolve({ boards: this.boards });
      }
      return Promise.reject(command + '|mock');
    },
    describeError(error) {
      const parts = String(error).split('|');
      return { key: parts[0], detail: parts[1] || '' };
    }
  };
  const buttons = { selectBoard: createButton(), search: createInput() };
  // 假 `board-detector`：面板的選板結果交給它，上傳也從它讀取。
  // 這裡刻意做成「可見的單一來源」，讓測試能驗證面板有沒有真的交出去。
  const detector = overrides.detector || {
    fqbn: '',
    setManualFqbn(fqbn) { this.fqbn = fqbn || ''; },
    getState() { return { fqbn: this.fqbn, port: 'COM3' }; }
  };
  const sandbox = await loadClassicScript('src/lib/arduino/board-picker.js', {
    CodeBridgeTauri: bridge,
    CodeBridgeBoardDetector: detector,
    getI18n: (key, fallback) => fallback || key
  });
  const doc = createDocument(buttons);
  sandbox.document = doc;
  sandbox.CodeBridgeProjectStore = overrides.store || createStore(overrides.meta);
  sandbox.CodeBridgeBoardDetector = detector;
  // 真實應用程式啟動時會呼叫 init() 綁定搜尋框與按鈕；測試也照做，
  // 否則輸入框的監聽器不存在，搜尋過濾不可能生效。
  sandbox.CodeBridgeBoardPicker.init();
  return { sandbox, bridge, doc, buttons, detector };
}

/** 依 fqbn 找出面板清單中的對應項目（preset 列的按鈕也在容器內，故以屬性定位）。 */
function boardItem(doc, fqbn) {
  return doc.getElementById('cb-board-list').children
    .find((item) => item.getAttribute('data-fqbn') === fqbn);
}

/**
 * 面板目前畫面上的 fqbn 清單。
 *
 * 只取「清單項」（class 含 `cb-board-item`）—— 常用開發板快捷列的按鈕
 * 也在同一個容器內，但那是捷徑而非完整清單。
 */
function renderedFqbn(doc) {
  const list = doc.getElementById('cb-board-list');
  return list.children
    .filter((item) => String(item.className).includes('cb-board-item'))
    .map((item) => item.getAttribute('data-fqbn'))
    .filter((fqbn) => Boolean(fqbn));
}

/** 面板清單容器當前的純文字內容（用於驗證提示列）。 */
function renderedText(doc) {
  return doc.getElementById('cb-board-list').children
    .map((item) => item.textContent)
    .join('\n');
}

/** 面板清單容器當前帶有 is-active 的項目。 */
function activeItems(doc) {
  return doc.getElementById('cb-board-list').children
    .filter((item) => String(item.className).includes('is-active'));
}

describe('board-picker 載入', () => {
  test('open 會向後端索取開發板清單', async () => {
    const { sandbox, bridge } = await loadPicker();
    await sandbox.CodeBridgeBoardPicker.open();
    expect(bridge.calls).toContain('board_list_all');
  });

  test('載入後顯示所有開發板', async () => {
    const { sandbox, doc } = await loadPicker();
    await sandbox.CodeBridgeBoardPicker.open();
    expect(renderedFqbn(doc)).toEqual([
      'arduino:avr:uno',
      'arduino:avr:nano',
      'arduino:avr:mega'
    ]);
  });

  test('清單項同時顯示名稱與 FQBN', async () => {
    // 只顯示 FQBN 對高中生沒有判斷依據；兩者並列才能確認是不是同一顆板。
    const { sandbox, doc } = await loadPicker();
    await sandbox.CodeBridgeBoardPicker.open();
    expect(renderedText(doc)).toContain('Arduino Uno');
    expect(renderedText(doc)).toContain('arduino:avr:uno');
  });

  test('開啟時聚焦搜尋框，讓使用者可直接輸入', async () => {
    const { sandbox, buttons } = await loadPicker();
    await sandbox.CodeBridgeBoardPicker.open();
    expect(buttons.search.focused).toBe(true);
  });

  test('重複開啟不會重複向後端索取', async () => {
    const { sandbox, bridge } = await loadPicker();
    await sandbox.CodeBridgeBoardPicker.open();
    await sandbox.CodeBridgeBoardPicker.open();
    const calls = bridge.calls.filter((call) => call === 'board_list_all');
    expect(calls.length).toBe(1);
  });
});

describe('board-picker 搜尋過濾', () => {
  test('依名稱不分大小寫過濾', async () => {
    const { sandbox, doc, buttons } = await loadPicker();
    await sandbox.CodeBridgeBoardPicker.open();
    buttons.search.type('nano');
    expect(renderedFqbn(doc)).toEqual(['arduino:avr:nano']);
  });

  test('依 FQBN 過濾（使用者可能貼上文件中的 FQBN）', async () => {
    const { sandbox, doc, buttons } = await loadPicker();
    await sandbox.CodeBridgeBoardPicker.open();
    buttons.search.type('avr:mega');
    expect(renderedFqbn(doc)).toEqual(['arduino:avr:mega']);
  });

  test('清空搜尋後回復完整清單', async () => {
    const { sandbox, doc, buttons } = await loadPicker();
    await sandbox.CodeBridgeBoardPicker.open();
    buttons.search.type('nano');
    buttons.search.type('');
    expect(renderedFqbn(doc)).toHaveLength(3);
  });

  test('沒有符合項時顯示空結果提示且不選任何板子', async () => {
    const { sandbox, doc, buttons } = await loadPicker();
    await sandbox.CodeBridgeBoardPicker.open();
    buttons.search.type('zzzz-no-such-board');
    // 沒有任何可選項 —— 不可因為搜不到就自動挑一個。
    expect(renderedFqbn(doc)).toEqual([]);
    // 但必須給出下一步的指引，而不是一片空白。
    expect(renderedText(doc).length).toBeGreaterThan(0);
    // 常用開發板快捷列仍然存在，讓使用者不必知道 FQBN 怎麼拼。
    expect(doc.getElementById('cb-board-list').children
      .some((item) => String(item.className).includes('cb-board-presets'))).toBe(true);
  });

  test('切換分頁不清空搜尋關鍵字', async () => {
    // 分頁只影響「來源範圍」，不影響關鍵字；使用者切頁後仍找同一個字。
    const { sandbox, doc, buttons } = await loadPicker();
    await sandbox.CodeBridgeBoardPicker.open();
    buttons.search.type('nano');
    sandbox.CodeBridgeBoardPicker.setFilter('all');
    expect(renderedFqbn(doc)).toEqual(['arduino:avr:nano']);
  });
});

describe('board-picker 選取開發板', () => {
  test('點擊清單項會把 fqbn 交給 board-detector 並關閉面板', async () => {
    // 2026-09-28 回歸：使用者選了 UNO 卻報「尚未選擇開發板」。
    // 根因是面板把 fqbn 寫進專案 meta，而上傳讀的是 board-detector ——
    // 兩個地方各記一份，選板結果到不了上傳。面板現在只交給 detector。
    const { sandbox, doc, detector } = await loadPicker();
    await sandbox.CodeBridgeBoardPicker.open();

    boardItem(doc, 'arduino:avr:mega').click();

    expect(detector.getState().fqbn).toBe('arduino:avr:mega');
    expect(sandbox.CodeBridgeBoardPicker.isOpen()).toBe(false);
  });

  test('選取後重新選到其他板子時會覆寫舊值', async () => {
    // 手動選板是使用者的明確意圖，必須能改 —— 這與自動偵測的規則相反。
    const detector = {
      fqbn: 'arduino:avr:uno',
      setManualFqbn(fqbn) { this.fqbn = fqbn || ''; },
      getState() { return { fqbn: this.fqbn, port: 'COM3' }; }
    };
    const { sandbox, doc } = await loadPicker({ detector });
    await sandbox.CodeBridgeBoardPicker.open();

    boardItem(doc, 'arduino:avr:nano').click();

    expect(detector.getState().fqbn).toBe('arduino:avr:nano');
  });

  test('目前選取的板子會標示為 active', async () => {
    const detector = {
      fqbn: 'arduino:avr:nano',
      setManualFqbn(fqbn) { this.fqbn = fqbn || ''; },
      getState() { return { fqbn: this.fqbn, port: 'COM3' }; }
    };
    const { sandbox, doc } = await loadPicker({ detector });
    await sandbox.CodeBridgeBoardPicker.open();

    const active = activeItems(doc);
    expect(active).toHaveLength(1);
    expect(active[0].getAttribute('data-fqbn')).toBe('arduino:avr:nano');
  });

  test('Escape 關閉面板且不改動 metadata', async () => {
    const store = createStore({ fqbn: 'arduino:avr:uno' });
    const { sandbox, doc } = await loadPicker({ store });
    await sandbox.CodeBridgeBoardPicker.open();

    doc.getElementById('cb-board-panel').__onKeyDown({ key: 'Escape', preventDefault() {} });

    expect(sandbox.CodeBridgeBoardPicker.isOpen()).toBe(false);
    expect(store.meta.fqbn).toBe('arduino:avr:uno');
  });
});

describe('board-picker 錯誤處理', () => {
  test('CLI 不可用時開啟面板不拋出例外', async () => {
    const { sandbox } = await loadPicker({ available: false });
    await expect(sandbox.CodeBridgeBoardPicker.open()).resolves.toBe(false);
  });

  test('後端錯誤時顯示錯誤訊息而非空白面板', async () => {
    const { sandbox, doc } = await loadPicker({ boardError: 'CLI_ERROR_NOT_FOUND|' });
    await sandbox.CodeBridgeBoardPicker.open();
    expect(renderedText(doc).length > 0).toBe(true);
    expect(sandbox.CodeBridgeBoardPicker.getState().error).toBeTruthy();
  });

  test('無法辨識的序列埠仍可手動選板', async () => {
    // 沒有對應 core 的板子偵測不到 FQBN；使用者必須仍能手動指定，
    // 否則這類板子完全無法編譯。
    const { sandbox, doc } = await loadPicker();
    await sandbox.CodeBridgeBoardPicker.open({ unknownPorts: ['COM7'] });
    expect(renderedFqbn(doc).length).toBeGreaterThan(0);
  });
});

describe('board-picker 核心安裝入口', () => {
  /** 載入時注入假的 core 服務，記錄搜尋與安裝呼叫。 */
  async function loadWithCore(overrides = {}) {
    const loaded = await loadPicker(overrides);
    loaded.coreCalls = [];
    // 契約對齊真實 `core.js` 的 `search()`：**回傳已映射的陣列**，
    // 每筆含 id / installed / recommended，而非原始 CLI 的 {platforms}。
    loaded.sandbox.CodeBridgeCore = {
      search(term) {
        loaded.coreCalls.push({ command: 'search', term });
        return Promise.resolve(overrides.platforms || [
          { id: 'arduino:avr', name: 'Arduino AVR Boards', installed: false, recommended: true }
        ]);
      },
      install(id) {
        loaded.coreCalls.push({ command: 'install', id });
        return Promise.resolve({ package: id });
      }
    };
    return loaded;
  }

  test('清單為空時提供安裝核心的按鈕', async () => {
    // CodeBridge 與使用者的 Arduino IDE 隔離，首次使用時清單一定是空的。
    // 若只顯示「尚未安裝核心」而沒有任何入口，使用者就完全卡住了。
    const { sandbox } = await loadWithCore({ boards: [] });
    await sandbox.CodeBridgeBoardPicker.open();

    const hasAction = sandbox.CodeBridgeBoardPicker.getState().canInstallCore;
    expect(hasAction).toBe(true);
  });

  test('點擊後搜尋可安裝的核心並列出結果', async () => {
    const { sandbox, coreCalls } = await loadWithCore({ boards: [] });
    await sandbox.CodeBridgeBoardPicker.open();
    await sandbox.CodeBridgeBoardPicker.installCore();

    expect(coreCalls.some((call) => call.command === 'search')).toBe(true);
  });

  test('安裝完成後重新載入板子清單', async () => {
    const { sandbox, coreCalls } = await loadWithCore({ boards: [] });
    await sandbox.CodeBridgeBoardPicker.open();
    await sandbox.CodeBridgeBoardPicker.installCore();

    expect(coreCalls.some((call) => call.command === 'install')).toBe(true);
  });

  test('安裝失敗時保留錯誤訊息，不中斷面板', async () => {
    const { sandbox } = await loadWithCore({ boards: [], platforms: [] });
    await sandbox.CodeBridgeBoardPicker.open();

    // 搜尋不到任何核心時不應拋出例外。
    await expect(sandbox.CodeBridgeBoardPicker.installCore()).resolves.toBeDefined();
  });
});

describe('board-picker 無結果提示與引導', () => {
  test('搜尋無結果時顯示「開發板」字樣而非「積木」', async () => {
    // 這是實際回報的缺陷：提示列沿用了積木搜尋的 i18n key，
    // 使用者在選開發板時看到「找不到符合的積木」，完全不知所云。
    const { sandbox, buttons } = await loadPicker();
    await sandbox.CodeBridgeBoardPicker.open();
    buttons.search.type('zzz-no-such-board');

    const text = renderedText(sandbox.document);
    expect(text).not.toContain('積木');
    expect(text).toContain('開發板');
  });

  test('清單為空且尚未搜尋時提示如何選擇，而非只說找不到', async () => {
    // 使用者第一次開啟面板時不該只看到「找不到」——他根本還沒搜尋。
    const { sandbox } = await loadPicker({ boards: [] });
    await sandbox.CodeBridgeBoardPicker.open();
    expect(renderedText(sandbox.document).length).toBeGreaterThan(0);
  });

  test('提供常用板子快捷建議，讓使用者不必知道板子名稱', async () => {
    // 高中生手上多為 UNO／Nano clone，卻未必知道 FQBN 怎麼拼。
    // 面板應直接列出常見選擇，而不是要使用者猜字串。
    const { sandbox } = await loadPicker();
    await sandbox.CodeBridgeBoardPicker.open();
    const presets = sandbox.CodeBridgeBoardPicker.presets();
    expect(presets.length).toBeGreaterThan(0);
    expect(presets.some((preset) => /uno/i.test(preset.name))).toBe(true);
  });

  test('無法辨識的埠會顯示可操作的說明（該選哪塊板）', async () => {
    // CH340 clone 不在官方 VID 清單內，自動偵測必然失敗；
    // 面板必須說明「手動選擇即可正常上傳」，否則學生會卡住。
    const { sandbox } = await loadPicker();
    await sandbox.CodeBridgeBoardPicker.open({ unknownPorts: ['COM4'] });
    expect(sandbox.CodeBridgeBoardPicker.getState().unknownPorts).toEqual(['COM4']);
  });
});

