import { describe, expect, test } from 'vitest';
import { createMemoryStorage, loadClassicScript } from '../support/classic-script.js';

const BLOCKLY_XML = '<?xml version="1.0" encoding="UTF-8"?>\n<xml xmlns="https://developers.google.com/blockly/xml">\n  <block type="initializes_setup" id="setup1"></block>\n</xml>\n';

async function loadProjectModule(storage) {
  const sandbox = await loadClassicScript('src/lib/project/project-store.js', {
    localStorage: storage || createMemoryStorage()
  });
  return sandbox.CodeBridgeProject;
}

function createStore(storage) {
  return { storage: storage || createMemoryStorage() };
}

describe('.cbg 專案 metadata 序列化', () => {
  test('副檔名與格式版本為單一常數來源', async () => {
    const project = await loadProjectModule();
    expect(project.EXT).toBe('.cbg');
    expect(project.FORMAT_VERSION).toBe(1);
  });

  test('命名空間用 cbg: 前綴，與副檔名一致', async () => {
    // 原本用 `cbp:`（CodeBridge Project 的隨手縮寫），與 `.cbg` 副檔名不一致。
    // 兩者在 XML 技術上等價，但可讀性上應與副檔名對齊。
    const project = await loadProjectModule();
    const text = project.serialize(BLOCKLY_XML, {});
    expect(text).toContain('xmlns:cbg="https://codebridge.app/xml"');
    expect(text).toContain('cbg:format="1"');
  });

  test('只序列化 format 與 app 兩個欄位', async () => {
    // 2026-09-28 設計決策（與使用者討論後定案）：
    // - `name`：檔名才是權威，存進檔案只會在檔案被改名後產生不一致
    // - `fqbn`：第三方 clone 板偵測不到 fqbn，記錄下來也無法驗證
    // - `port` / `baud`：本機環境狀態，不是專案特性（且曾造成上傳 bug）
    // - `libraries`：`#include` 已承載，且從無程式碼使用
    const project = await loadProjectModule();
    const text = project.serialize(BLOCKLY_XML, {
      name: 'Blink', fqbn: 'arduino:avr:uno', port: 'COM3', baud: 9600, libraries: ['Servo']
    });
    expect(text).toContain('cbg:format="1"');
    expect(text).toContain('cbg:app=');
    ['name', 'fqbn', 'port', 'baud', 'libraries'].forEach((key) => {
      expect(text, `cbg:${key} 不應再被序列化`).not.toContain(`cbg:${key}=`);
    });
    expect(text).not.toContain('COM3');
    expect(text).toContain('type="initializes_setup"');
  });

  test('serialize 具冪等性：重複注入結果一致', async () => {
    const project = await loadProjectModule();
    const once = project.serialize(BLOCKLY_XML, {});
    const twice = project.serialize(once, {});
    expect(twice).toBe(once);
  });

  test('serialize 會覆寫舊 metadata，不殘留已移除的欄位', async () => {
    // 從舊格式（帶 cbp:name 等）再序列化時，舊屬性必須被清掉。
    const project = await loadProjectModule();
    const legacy = BLOCKLY_XML.replace(
      '<xml xmlns="https://developers.google.com/blockly/xml">',
      '<xml xmlns="https://developers.google.com/blockly/xml" xmlns:cbp="https://codebridge.app/xml" cbp:format="1" cbp:name="Old" cbp:port="COM9">'
    );
    const text = project.serialize(legacy, {});
    expect(text).not.toContain('cbp:');
    expect(text).not.toContain('COM9');
  });

  test('parse 可還原 metadata 與原始積木 XML', async () => {
    const project = await loadProjectModule();
    const text = project.serialize(BLOCKLY_XML, {});
    const parsed = project.parse(text);
    expect(parsed.meta.format).toBe(1);
    expect(parsed.body).toContain('type="initializes_setup"');
  });

  test('metadata 值會跳脫雙引號，避免破壞 XML', async () => {
    const project = await loadProjectModule();
    const text = project.serialize(BLOCKLY_XML, { app: 'say "hi"' });
    expect(text).toContain('cbg:app="say &quot;hi&quot;"');
    expect(project.parse(text).meta.app).toBe('say "hi"');
  });

  test('未帶 metadata 的 XML 可解析，format 為 null', async () => {
    const project = await loadProjectModule();
    const parsed = project.parse(BLOCKLY_XML);
    expect(parsed.meta.format).toBeNull();
    expect(parsed.meta.app).toBeNull();
    expect(parsed.body).toContain('type="initializes_setup"');
  });

  test('未知格式版本由 isSupported 回報為不支援', async () => {
    const project = await loadProjectModule();
    const future = project.serialize(BLOCKLY_XML, {}).replace('cbg:format="1"', 'cbg:format="99"');
    expect(project.isSupported(project.parse(future).meta)).toBe(false);
    expect(project.isSupported(project.parse(BLOCKLY_XML).meta)).toBe(true);
  });

  test('舊格式（cbp:）的 .cbg 仍可開啟，metadata 被忽略', async () => {
    // CodeBridge 尚未發佈，但開發中可能仍有舊檔案。
    // 舊命名空間的 format 必須讀得到，name/port 等則直接忽略。
    const project = await loadProjectModule();
    const legacy = BLOCKLY_XML.replace(
      '<xml xmlns="https://developers.google.com/blockly/xml">',
      '<xml xmlns="https://developers.google.com/blockly/xml" xmlns:cbp="https://codebridge.app/xml" cbp:format="1" cbp:name="Old" cbp:port="COM9">'
    );
    const parsed = project.parse(legacy);
    expect(parsed.meta.format).toBe(1);
    expect(parsed.meta.app).toBeNull();
    expect(parsed.body).toContain('type="initializes_setup"');
    expect(parsed.body).not.toContain('cbp:');
  });

  test('nameFromPath 取得不含副檔名的專案名稱', async () => {
    const project = await loadProjectModule();
    expect(project.nameFromPath('C:\\projects\\Blink.cbg')).toBe('Blink');
  });
});

describe('專案狀態與 dirty 判斷', () => {
  test('新建專案為未命名且非 dirty', async () => {
    const project = await loadProjectModule();
    const store = project.createStore(createStore());
    store.markUntitled(BLOCKLY_XML);
    expect(store.getState()).toMatchObject({ path: null, name: null, isDirty: false, isUntitled: true });
  });

  test('未命名專案仍可帶顯示名稱（載入內建範例的情境）', async () => {
    const project = await loadProjectModule();
    const store = project.createStore(createStore());
    store.markUntitled(BLOCKLY_XML, project.emptyMeta(), 'Blink');
    expect(store.getState()).toMatchObject({ path: null, name: 'Blink', isUntitled: true });
  });

  test('未命名專案未提供名稱時退回未命名狀態', async () => {
    const project = await loadProjectModule();
    const store = project.createStore(createStore());
    store.markUntitled(BLOCKLY_XML);
    expect(store.getState().name).toBeNull();
  });

  // ---------------------------------------------------------------
  // metadata 不再承載裝置狀態（2026-09-28 設計決策）
  // ---------------------------------------------------------------

  test('meta 只有 format 與 app，不含 port / fqbn / name', async () => {
    // 裝置狀態（插在哪個埠、哪顆晶片）描述的是「使用者身邊的硬體」，
    // 不是專案內容。它們住在 board-detector 與下拉選單裡。
    //
    // 放進 meta 曾造成實際 bug：「UI 顯示 COM4 但上傳報尚未選擇序列埠」——
    // 因為下拉（使用者眼前的真相）與 meta（可能過期的記憶）不一致。
    const project = await loadProjectModule();
    const store = project.createStore(createStore());
    const meta = store.getState().meta;
    expect(Object.keys(meta).sort()).toEqual(['app', 'format']);
  });

  test('setMeta 仍可合併更新（供 app 版本等欄位使用）', async () => {
    const project = await loadProjectModule();
    const store = project.createStore(createStore());
    store.setMeta({ format: 1 });
    store.setMeta({ app: '0.2.0' });

    const meta = store.getState().meta;
    expect(meta.format).toBe(1);
    expect(meta.app).toBe('0.2.0');
  });

  test('setMeta 傳入 null 物件時清空全部欄位', async () => {
    // `setMeta()` 不帶參數是「重置」的既有語意，不可被合併邏輯破壞。
    const project = await loadProjectModule();
    const store = project.createStore(createStore());
    store.setMeta({ app: '0.2.0' });

    store.setMeta(null);

    expect(store.getState().meta.app).toBeNull();
  });

  test('工作區變更後標記 dirty，相同內容不重複標記', async () => {
    const project = await loadProjectModule();
    const store = project.createStore(createStore());
    store.markUntitled(BLOCKLY_XML);

    const changed = store.refresh(BLOCKLY_XML.replace('setup1', 'setup2'));
    expect(changed.isDirty).toBe(true);
    expect(store.isDirty()).toBe(true);
    expect(store.refresh(BLOCKLY_XML.replace('setup1', 'setup2')).changed).toBe(false);
  });

  test('undo 回原狀會自動清除 dirty（字串比對）', async () => {
    const project = await loadProjectModule();
    const store = project.createStore(createStore());
    store.markUntitled(BLOCKLY_XML);
    store.refresh(BLOCKLY_XML.replace('setup1', 'setup2'));
    expect(store.isDirty()).toBe(true);
    store.refresh(BLOCKLY_XML);
    expect(store.isDirty()).toBe(false);
  });

  test('儲存後帶入路徑並清除 dirty', async () => {
    const project = await loadProjectModule();
    const store = project.createStore(createStore());
    store.markUntitled(BLOCKLY_XML);
    store.refresh(BLOCKLY_XML.replace('setup1', 'setup2'));

    const state = store.markSaved({ path: 'C:\\p\\Blink.cbg', snapshot: BLOCKLY_XML.replace('setup1', 'setup2') });
    expect(state).toMatchObject({ path: 'C:\\p\\Blink.cbg', name: 'Blink', isDirty: false, isUntitled: false });
  });

  test('開啟檔案後清除 dirty 並以檔案名稱為專案名', async () => {
    const project = await loadProjectModule();
    const store = project.createStore(createStore());
    store.markUntitled(BLOCKLY_XML);
    store.refresh(BLOCKLY_XML.replace('setup1', 'setup9'));

    const state = store.markSaved({ path: 'C:\\p\\Fade.cbg', snapshot: BLOCKLY_XML });
    expect(state.name).toBe('Fade');
    expect(state.isDirty).toBe(false);
  });

  test('狀態變更會通知監聽者（UI 連動）', async () => {
    const project = await loadProjectModule();
    const store = project.createStore(createStore());
    const seen = [];
    store.subscribe((state) => seen.push(state.isDirty));

    store.markUntitled(BLOCKLY_XML);
    store.refresh(BLOCKLY_XML.replace('setup1', 'setup2'));
    expect(seen).toEqual([false, true]);
  });

  test('狀態可持久化，重新載入後仍保留路徑與乾淨狀態', async () => {
    const project = await loadProjectModule();
    const storage = createMemoryStorage();

    const first = project.createStore({ storage });
    first.markSaved({ path: 'C:\\p\\Blink.cbg', snapshot: BLOCKLY_XML });

    const second = project.createStore({ storage });
    expect(second.getState()).toMatchObject({ path: 'C:\\p\\Blink.cbg', name: 'Blink', isDirty: false });
  });

  test('未儲存草稿不會被當成已儲存狀態', async () => {
    const project = await loadProjectModule();
    const storage = createMemoryStorage();
    const store = project.createStore({ storage });
    store.markSaved({ path: 'C:\\p\\Blink.cbg', snapshot: BLOCKLY_XML });

    store.setDraft(BLOCKLY_XML.replace('setup1', 'draft'));
    const restored = project.createStore({ storage });
    expect(restored.getState().isDirty).toBe(false);
    expect(restored.getDraft()).toBe(BLOCKLY_XML.replace('setup1', 'draft'));
  });
});

describe('最近專案清單', () => {
  test('新增後置頂、重複路徑不重複、舊項目自動移除', async () => {
    const project = await loadProjectModule();
    const store = project.createStore(createStore());

    for (let index = 0; index < 12; index += 1) {
      store.addRecent({ path: `C:\\p\\P${index}.cbg`, name: `P${index}`, at: index });
    }
    store.addRecent({ path: 'C:\\p\\P0.cbg', name: 'P0', at: 99 });

    const recents = store.getRecents();
    expect(recents).toHaveLength(project.RECENTS_LIMIT);
    expect(recents[0].path).toBe('C:\\p\\P0.cbg');
    expect(recents.filter((item) => item.path === 'C:\\p\\P0.cbg')).toHaveLength(1);
  });

  test('可移除單筆與清空', async () => {
    const project = await loadProjectModule();
    const store = project.createStore(createStore());
    store.addRecent({ path: 'C:\\p\\A.cbg', name: 'A', at: 1 });
    store.addRecent({ path: 'C:\\p\\B.cbg', name: 'B', at: 2 });

    store.removeRecent('C:\\p\\A.cbg');
    expect(store.getRecents().map((item) => item.name)).toEqual(['B']);

    store.clearRecents();
    expect(store.getRecents()).toEqual([]);
  });

  test('損壞的 localStorage 內容不會讓程式崩潰', async () => {
    const project = await loadProjectModule();
    const storage = createMemoryStorage({ codebridgeRecentProjects: '{not json' });
    const store = project.createStore({ storage });
    expect(store.getRecents()).toEqual([]);
  });
});
