import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, test } from 'vitest';
import { loadClassicScript } from '../support/classic-script.js';

const uiDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * 極簡 DOM 替身。
 *
 * 終端機面板只用到 `getElementById`、`classList`、`appendChild`、
 * `textContent` 與 `scrollHeight`；為了讓測試貼近真實契約
 * （附加的是文字節點、不是 HTML），這裡刻意實作出這些行為而不是全面模擬瀏覽器。
 */
function createElement(tag) {
  return {
    tagName: tag.toUpperCase(),
    className: '',
    textContent: '',
    title: '',
    scrollTop: 0,
    scrollHeight: 0,
    childElementCount: 0,
    children: [],
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
    // 極簡 style 物件：面板會以 inline `style.height` 記住使用者拖曳的高度，
    // 並在收合時用 removeProperty 移除（inline style 優先級高於 .collapsed 規則）。
    style: {
      height: '',
      removeProperty(name) { this[name] = ''; },
      getPropertyValue(name) { return this[name] || ''; }
    },
    get firstChild() { return this.children[0] || null; },
    setAttribute(name, value) {
      this.attributes = this.attributes || {};
      this.attributes[name] = String(value);
      if (name === 'title') this.title = String(value);
    },
    getAttribute(name) {
      return this.attributes && this.attributes[name] !== undefined
        ? this.attributes[name]
        : null;
    },
    querySelector(selector) {
      if (selector.charAt(0) === '.') {
        const wanted = selector.slice(1);
        return this.children.find((child) => child.className.split(' ').indexOf(wanted) !== -1) || null;
      }
      return null;
    },
    appendChild(node) {
      node.parentElement = this;
      this.children.push(node);
      this.childElementCount = this.children.length;
      // 以已附加的節點數模擬累積高度，方便驗證 auto-scroll。
      this.scrollHeight = this.children.length * 20;
      return node;
    },
    removeChild(node) {
      this.children = this.children.filter((child) => child !== node);
      this.childElementCount = this.children.length;
      this.scrollHeight = this.children.length * 20;
      return node;
    },
    set innerHTML(value) {
      this._html = value;
      if (value === '') {
        this.children = [];
        this.childElementCount = 0;
      }
    },
    get innerHTML() { return this._html || ''; }
  };
}

/** 建立 `#terminalArea` / `#terminalContent` / 四顆工具列按鈕的假 DOM。 */
function createDom() {
  const nodes = {};
  ['terminalArea', 'terminalContent', 'btn-pause-terminal',
    'btn-clear-terminal', 'btn-close-terminal'].forEach((id) => {
    nodes[id] = createElement(id.startsWith('btn-') ? 'button' : 'div');
  });
  // 三角收合鈕（與 #code-toggle 同一套互動，非工具列按鈕）
  nodes['terminal-toggle'] = createElement('div');
  nodes['terminal-toggle'].appendChild(createElement('span'));
  nodes['terminal-toggle'].children[0].className = 'arrow';
  nodes['terminal-toggle'].children[0].textContent = '▲';
  nodes.terminalArea.classList.add('collapsed');
  const document = {
    getElementById: (id) => nodes[id] || null,
    createElement: (tag) => createElement(tag),
    addEventListener: () => {}
  };
  return { nodes, document };
}

async function loadPanel(dom) {
  const sandbox = await loadClassicScript('src/lib/ui/terminal-panel.js', {
    document: dom.document
  });
  return { panel: sandbox.CodeBridgeTerminalPanel, nodes: dom.nodes };
}

function lines(nodes) {
  return nodes.terminalContent.children.map((node) => node.textContent);
}

describe('終端機面板', () => {  test('appendToLast 把文字追加到最後一行，不斷增行', () => {
    // 上傳心跳點不懂每次斷增一行：用戶要看的是「一行逐測延長的點」，
    // 其他輸出（例如 New upload port）仍要單獨成行。
    panel.append('開始上傳到 COM4，請勿斷開連線');
    panel.appendToLast('.');
    panel.appendToLast('.');

    expect(lines(nodes)).toHaveLength(1);
    expect(lines(nodes)[0]).toBe('開始上傳到 COM4，請勿斷開連線..');
  });

  test('appendToLast 後結的新行應取正確位置', () => {
    panel.append('第一行');
    panel.append('第二行');
    panel.appendToLast('.');

    expect(lines(nodes)).toHaveLength(2);
    expect(lines(nodes)[1]).toBe('第二行.');
  });

  test('空面板時 appendToLast 會建立第一行', () => {
    // 沒有既存行可追加時（清空終端機後的第一次心跳），建立一行並放進去，
    // 這樣後續的點才能接在它後面，而不是每次都憑空新增一行。
    panel.appendToLast('.');
    expect(lines(nodes)).toEqual(['.']);

    panel.appendToLast('.');
    expect(lines(nodes)).toEqual(['..']);
  });


  let dom;
  let panel;
  let nodes;

  beforeEach(async () => {
    dom = createDom();
    const loaded = await loadPanel(dom);
    panel = loaded.panel;
    nodes = loaded.nodes;
    panel._reset();
  });

  test('附加輸出行寫入文字節點，保留原始內容不解析 HTML', () => {
    panel.append('sketch/Blink.ino:7:5: error: expected `;\' before <int> (x < 3)');

    expect(lines(nodes)).toHaveLength(1);
    expect(lines(nodes)[0]).toBe('sketch/Blink.ino:7:5: error: expected `;\' before <int> (x < 3)');
    expect(nodes.terminalContent.children[0].className).toBe('terminal-line');
  });

  test('不同 severity 對應到不同的行樣式', () => {
    panel.append('boom', 'error');
    panel.append('careful', 'warn');
    panel.append('hint', 'info');
    panel.append('done', 'success');
    panel.append('> compile', 'command');

    expect(nodes.terminalContent.children.map((node) => node.className)).toEqual([
      'terminal-line terminal-line--error',
      'terminal-line terminal-line--warn',
      'terminal-line terminal-line--info',
      'terminal-line terminal-line--success',
      'terminal-line terminal-line--command'
    ]);
  });

  test('空行被忽略，appendLines 回傳實際附加的行數', () => {
    const appended = panel.appendLines(['a', '', null, 'b']);

    expect(appended).toBe(2);
    expect(lines(nodes)).toEqual(['a', 'b']);
  });

  test('超過上限時丟棄最舊的行，總行數仍持續累計', () => {
    for (let index = 0; index < panel.MAX_LINES + 5; index += 1) {
      panel.append('line ' + index);
    }

    const kept = lines(nodes);
    expect(kept).toHaveLength(panel.MAX_LINES);
    expect(kept[0]).toBe('line 5');
    expect(kept[kept.length - 1]).toBe('line ' + (panel.MAX_LINES + 4));
    expect(panel.getState().lineCount).toBe(panel.MAX_LINES + 5);
  });

  test('未暫停時自動捲到底部，暫停後不再捲動', () => {
    panel.append('one');
    expect(nodes.terminalContent.scrollTop).toBe(nodes.terminalContent.scrollHeight);

    panel.setPaused(true);
    const frozen = nodes.terminalContent.scrollTop;
    panel.append('two');

    expect(nodes.terminalContent.scrollTop).toBe(frozen);
    expect(panel.isPaused()).toBe(true);
  });

  test('暫停按鈕以 is-active 顯示「自動捲動開啟中」的按下狀態', () => {
    const button = nodes['btn-pause-terminal'];

    // 預設即自動捲動 → 按鈕為按下狀態
    panel.init();
    expect(button.classList.contains('is-active')).toBe(true);
    expect(button.classList.contains('is-paused')).toBe(false);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.title).toBe('暫停捲動');

    panel.setPaused(true);
    expect(button.classList.contains('is-active')).toBe(false);
    expect(button.classList.contains('is-paused')).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.title).toBe('繼續捲動');

    panel.setPaused(false);
    expect(button.classList.contains('is-active')).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.title).toBe('暫停捲動');
  });

  test('三角收合鈕的箭頭方向與 aria-expanded 反映目前狀態', () => {
    const toggle = nodes['terminal-toggle'];

    panel.init();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.querySelector('.arrow').textContent).toBe('▲');

    panel.open();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.querySelector('.arrow').textContent).toBe('▼');

    panel.close();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.querySelector('.arrow').textContent).toBe('▲');
  });


  test('開闔面板會切換 collapsed class', () => {
    expect(panel.isOpen()).toBe(false);

    panel.toggle();
    expect(nodes.terminalArea.classList.contains('collapsed')).toBe(false);
    expect(panel.isOpen()).toBe(true);

    panel.close();
    expect(nodes.terminalArea.classList.contains('collapsed')).toBe(true);
    expect(panel.isOpen()).toBe(false);
  });

  test('清除會同時清空 DOM 與行數', () => {
    panel.appendLines(['a', 'b']);
    panel.clear();

    expect(lines(nodes)).toEqual([]);
    expect(panel.getState().lineCount).toBe(0);
  });

  test('DOM 缺少 #terminalContent 時不丟例外（純瀏覽器降級）', async () => {
    const bare = await loadClassicScript('src/lib/ui/terminal-panel.js', {
      document: { getElementById: () => null, createElement: () => createElement('div') }
    });

    expect(bare.CodeBridgeTerminalPanel.append('x')).toBe(false);
    expect(bare.CodeBridgeTerminalPanel.appendMessage('K', 'fallback', [])).toBe(false);
  });

  test('init 只同步外觀，不綁定按鈕事件（避免與 toolbar 委派重複觸發）', () => {
    panel.init();

    const toggle = nodes['terminal-toggle'];
    expect(toggle.addEventListener).toBeUndefined();
    expect(nodes.terminalArea.classList.contains('collapsed')).toBe(true);
  });

  test('按鈕行為由 toolbar 的 data-action 委派驅動（單一責任歸屬）', async () => {
    const html = await readFile(join(uiDirectory, 'index.html'), 'utf8');
    // 終端機的收合與三顆工具列按鈕都必須宣告 data-action，才能被 toolbar 委派捕捉
    ['terminal-toggle', 'btn-pause-terminal', 'btn-clear-terminal', 'btn-close-terminal'].forEach((id) => {
      expect(html).toMatch(new RegExp('id="' + id + '"[^>]*data-action='));
    });

    // 收合鈕不再是工具列按鈕，避免與 #btn-run 同一區塊
    expect(html).not.toContain('id="btn-terminal"');
    expect(html).toMatch(/id="terminal-toggle"[^>]*class=/);

    // 面板本身不得綁定 click，否則一次點擊會開關兩次
    expect(panel.init.toString()).not.toContain('addEventListener');
  });

  test('狀態變更通知監聽者，且監聽者例外不影響面板', () => {
    const seen = [];
    panel.onChange(() => { throw new Error('boom'); });
    panel.onChange((state) => seen.push(state.lineCount));

    panel.append('one');
    panel.clear();

    expect(seen).toEqual([1, 0]);
  });

  test('appendMessage 以 %1 代入取代字元', () => {
    panel.appendMessage('CLI_COMPILE_STARTING', '開始編譯 %1…', ['Blink']);

    expect(lines(nodes)).toEqual(['開始編譯 Blink…']);
  });

  test('拖曳設定的高度不會讓收合失效', () => {
    // 還原原本的問題：拖曳後殘留的 inline `style.height` 優先級高於
    // `.collapsed { height: 0 }` 這條 CSS 規則，導致收合鈕看起來沒有反應。
    panel.open();
    panel.setHeight(320);
    expect(nodes.terminalArea.style.getPropertyValue('height')).toBe('320px');

    panel.close();
    // 收合時必須移除 inline style，讓 .collapsed 規則能生效
    expect(nodes.terminalArea.style.getPropertyValue('height')).toBe('');
    expect(nodes.terminalArea.classList.contains('collapsed')).toBe(true);

    // 重新展開時應自動套回上次的高度
    panel.open();
    expect(nodes.terminalArea.style.getPropertyValue('height')).toBe('320px');
  });

  test('對無效的高度值不會寫入高度', () => {
    panel.open();
    panel.setHeight(0);
    expect(nodes.terminalArea.style.getPropertyValue('height')).toBe('');

    panel.setHeight(NaN);
    expect(nodes.terminalArea.style.getPropertyValue('height')).toBe('');
  });
});
