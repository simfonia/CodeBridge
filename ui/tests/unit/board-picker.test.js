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
  const sandbox = await loadClassicScript('src/lib/arduino/board-picker.js', {
    CodeBridgeTauri: bridge,
    getI18n: (key, fallback) => fallback || key
  });
  const doc = createDocument(buttons);
  sandbox.document = doc;
  sandbox.CodeBridgeProjectStore = overrides.store || createStore(overrides.meta);
  // 真實應用程式啟動時會呼叫 init() 綁定搜尋框與按鈕；測試也照做，
  // 否則輸入框的監聽器不存在，搜尋過濾不可能生效。
  sandbox.CodeBridgeBoardPicker.init();
  return { sandbox, bridge, doc, buttons };
}

/** 面板目前畫面上的 fqbn 清單（只取清單容器的當前子節點）。 */
function renderedFqbn(doc) {
  const list = doc.getElementById('cb-board-list');
  return list.children
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
    expect(renderedFqbn(doc)).toEqual([]);
    expect(renderedText(doc).includes('搜尋')).toBe(true);
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
  test('點擊清單項會寫入 metadata 並關閉面板', async () => {
    const store = createStore();
    const { sandbox, doc } = await loadPicker({ store });
    await sandbox.CodeBridgeBoardPicker.open();

    doc.getElementById('cb-board-list').children[2].click();

    expect(store.meta.fqbn).toBe('arduino:avr:mega');
    expect(sandbox.CodeBridgeBoardPicker.isOpen()).toBe(false);
  });

  test('選取後重新選到其他板子時會覆寫舊值', async () => {
    // 手動選板是使用者的明確意圖，必須能改 —— 這與自動切板的規則相反。
    const store = createStore({ fqbn: 'arduino:avr:uno' });
    const { sandbox, doc } = await loadPicker({ store });
    await sandbox.CodeBridgeBoardPicker.open();

    doc.getElementById('cb-board-list').children[1].click();

    expect(store.meta.fqbn).toBe('arduino:avr:nano');
  });

  test('目前選取的板子會標示為 active', async () => {
    const { sandbox, doc } = await loadPicker({ meta: { fqbn: 'arduino:avr:nano' } });
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

