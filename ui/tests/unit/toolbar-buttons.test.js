import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { loadClassicScript } from '../support/classic-script.js';

const uiDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const indexPath = join(uiDirectory, 'index.html');

/**
 * 本輪凍結的未實作按鈕。
 *
 * 這些按鈕在 index.html 中必須帶 `disabled`，使用者按下只會得到
 * 「僅桌面版可用」或「後續階段提供」的說明，不得出現無反應的按鈕。
 * 新增未實作按鈕時必須明確更新本清單，讓取捨是 conscious decision。
 */
const FROZEN_UNIMPLEMENTED_IDS = [
  'btn-clear-terminal',
  'btn-close-terminal',
  'btn-pause-terminal',
  'btn-refresh-serial',
  'btn-run',
  'btn-stop',
  'btn-terminal'
];

const IMPLEMENTED_ACTIONS = [
  'copy-code',
  'new-project',
  'open-example',
  'open-project',
  'practice-cheat',
  'practice-mode',
  'save-project',
  'save-project-as',
  'settings-menu'
];

function readAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return match ? match[1] : null;
}

/** 取出工具列與終端機工具列按鈕（不含下拉選單項目與練習模式文字按鈕）。 */
function parseToolbarButtons(html) {
  const pattern = /<(?:div|button)\s[^>]*class="[^"]*\b(?:toolbar-btn|terminal-tool-btn)\b[^"]*"[^>]*>/g;
  return Array.from(html.matchAll(pattern)).map((match) => ({
    tag: match[0],
    id: readAttribute(match[0], 'id'),
    action: readAttribute(match[0], 'data-action'),
    title: readAttribute(match[0], 'title'),
    disabled: /\sdisabled(\s|>|=)/.test(match[0])
  }));
}

function readMessageKeys(path) {
  return readFile(path, 'utf8').then((contents) => new Set(Array.from(contents.matchAll(/^\s{4}([A-Z][A-Z_0-9]*):/gm), (match) => match[1])));
}

describe('工具列按鈕契約', () => {
  test('每個工具列按鈕都必須宣告 data-action', async () => {
    const html = await readFile(indexPath, 'utf8');
    const missing = parseToolbarButtons(html).filter((button) => !button.action).map((button) => button.id);
    expect(missing).toEqual([]);
  });

  test('registry 涵蓋 index.html 全部工具列按鈕且無幽靈項目', async () => {
    const html = await readFile(indexPath, 'utf8');
    const sandbox = await loadClassicScript('src/lib/ui/toolbar-registry.js');
    const registry = sandbox.CodeBridgeToolbar.actions;

    const htmlIds = parseToolbarButtons(html).map((button) => button.id).sort();
    const registryIds = Object.keys(registry)
      .map((action) => registry[action].id)
      .sort();
    expect(registryIds).toEqual(htmlIds);
  });

  test('index.html 的 disabled 屬性與 registry 的實作狀態一致', async () => {
    const html = await readFile(indexPath, 'utf8');
    const sandbox = await loadClassicScript('src/lib/ui/toolbar-registry.js');
    const registry = sandbox.CodeBridgeToolbar.actions;
    const byId = {};
    Object.keys(registry).forEach((action) => {
      byId[registry[action].id] = registry[action];
    });

    const mismatches = parseToolbarButtons(html)
      .filter((button) => Boolean(button.disabled) === Boolean(byId[button.id].implemented))
      .map((button) => ({ id: button.id, implemented: byId[button.id].implemented, disabled: button.disabled }));
    expect(mismatches).toEqual([]);
  });

  test('未實作按鈕維持在凍結清單內（避免無反應按鈕）', async () => {
    const html = await readFile(indexPath, 'utf8');
    const disabledIds = parseToolbarButtons(html)
      .filter((button) => button.disabled)
      .map((button) => button.id)
      .sort();
    expect(disabledIds).toEqual(FROZEN_UNIMPLEMENTED_IDS);
  });

  test('本輪實作的按鈕清單明確且完整', async () => {
    const sandbox = await loadClassicScript('src/lib/ui/toolbar-registry.js');
    const implemented = Object.keys(sandbox.CodeBridgeToolbar.actions)
      .filter((action) => sandbox.CodeBridgeToolbar.actions[action].implemented)
      .sort();
    expect(implemented).toEqual(IMPLEMENTED_ACTIONS);
  });

  test('已實作按鈕都有 tooltip，且中英文語系皆有翻譯', async () => {
    const html = await readFile(indexPath, 'utf8');
    const sandbox = await loadClassicScript('src/lib/ui/toolbar-registry.js');
    const registry = sandbox.CodeBridgeToolbar.actions;
    const zhKeys = await readMessageKeys(join(uiDirectory, 'src', 'lib', 'i18n', 'zh-hant.js'));
    const enKeys = await readMessageKeys(join(uiDirectory, 'src', 'lib', 'i18n', 'en.js'));

    const problems = parseToolbarButtons(html)
      .filter((button) => registry[button.action] && registry[button.action].implemented)
      .map((button) => {
        const key = button.title ? (button.title.match(/%\{BKY_([A-Z_0-9]+)\}/) || [])[1] : null;
        if (!key) return { id: button.id, reason: 'missing-title' };
        if (!zhKeys.has(key) || !enKeys.has(key)) return { id: button.id, reason: 'missing-i18n', key };
        return null;
      })
      .filter(Boolean);
    expect(problems).toEqual([]);
  });

  test('專案相關文案已加入兩份語系檔', async () => {
    const zhKeys = await readMessageKeys(join(uiDirectory, 'src', 'lib', 'i18n', 'zh-hant.js'));
    const enKeys = await readMessageKeys(join(uiDirectory, 'src', 'lib', 'i18n', 'en.js'));
    const required = [
      'TLB_RECENT_PROJECTS',
      'TLB_RECENT_EMPTY',
      'TLB_CLEAR_RECENTS',
      'TLB_EXAMPLES_EMPTY',
      'TLB_UNSAVED_TITLE',
      'TLB_DESKTOP_ONLY',
      'MSG_SAVE_CHANGES',
      'MSG_COPIED',
      'MSG_COPY_FAILED'
    ];
    expect(required.filter((key) => !zhKeys.has(key))).toEqual([]);
    expect(required.filter((key) => !enKeys.has(key))).toEqual([]);
  });
});
