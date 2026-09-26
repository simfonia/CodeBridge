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

  test('serialize 注入 namespace 與 cbp metadata，並保留積木內容', async () => {
    const project = await loadProjectModule();
    const text = project.serialize(BLOCKLY_XML, { name: 'Blink', fqbn: 'arduino:avr:uno', port: 'COM3', baud: 9600 });
    expect(text).toContain('xmlns:cbp="https://codebridge.app/xml"');
    expect(text).toContain('cbp:format="1"');
    expect(text).toContain('cbp:name="Blink"');
    expect(text).toContain('cbp:fqbn="arduino:avr:uno"');
    expect(text).toContain('cbp:port="COM3"');
    expect(text).toContain('cbp:baud="9600"');
    expect(text).toContain('type="initializes_setup"');
  });

  test('serialize 具冪等性：重複注入結果一致', async () => {
    const project = await loadProjectModule();
    const once = project.serialize(BLOCKLY_XML, { name: 'Blink' });
    const twice = project.serialize(once, { name: 'Blink' });
    expect(twice).toBe(once);
  });

  test('serialize 會覆寫舊 metadata，不殘留上一個專案名稱', async () => {
    const project = await loadProjectModule();
    const first = project.serialize(BLOCKLY_XML, { name: 'Blink', port: 'COM3' });
    const second = project.serialize(first, { name: 'Fade', port: null });
    expect(second).toContain('cbp:name="Fade"');
    expect(second).not.toContain('cbp:port=');
    expect(second).not.toContain('COM3');
  });

  test('parse 可還原 metadata 與原始積木 XML', async () => {
    const project = await loadProjectModule();
    const text = project.serialize(BLOCKLY_XML, { name: 'Fade', fqbn: 'arduino:avr:nano' });
    const parsed = project.parse(text);
    expect(parsed.meta.format).toBe(1);
    expect(parsed.meta.name).toBe('Fade');
    expect(parsed.meta.fqbn).toBe('arduino:avr:nano');
    expect(parsed.body).toContain('type="initializes_setup"');
  });

  test('metadata 值會跳脫雙引號，避免破壞 XML', async () => {
    const project = await loadProjectModule();
    const text = project.serialize(BLOCKLY_XML, { name: 'say "hi"' });
    expect(text).toContain('cbp:name="say &quot;hi&quot;"');
    expect(project.parse(text).meta.name).toBe('say "hi"');
  });

  test('未帶 cbp metadata 的 XML 可解析，format 為 null', async () => {
    const project = await loadProjectModule();
    const parsed = project.parse(BLOCKLY_XML);
    expect(parsed.meta.format).toBeNull();
    expect(parsed.meta.name).toBeNull();
    expect(parsed.body).toContain('type="initializes_setup"');
  });

  test('未知格式版本由 isSupported 回報為不支援', async () => {
    const project = await loadProjectModule();
    const future = project.serialize(BLOCKLY_XML, { name: 'X' }).replace('cbp:format="1"', 'cbp:format="99"');
    expect(project.isSupported(project.parse(future).meta)).toBe(false);
    expect(project.isSupported(project.parse(BLOCKLY_XML).meta)).toBe(true);
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
