import { beforeEach, describe, expect, test, vi } from 'vitest';
import { loadClassicScript } from '../support/classic-script.js';

/**
 * 假的 CodeBridgeTauri bridge。
 *
 * 只記錄 `invoke` 呼叫並以 `responses` 表決回傳值，讓測試能驗證
 * 「呼叫了哪個 command、payload 有哪些欄位」——這正是前後端契約的核心。
 * `events` 記錄 `listen` 訂閱，讓測試能確認事件名稱沒有拼錯。
 */
function createBridge(options = {}) {
  const calls = [];
  const listeners = {};
  const responses = Object.assign({}, options.responses);
  return {
    calls,
    listeners,
    available: options.available !== false,
    isAvailable() { return this.available; },
    invoke(command, args) {
      calls.push({ command, args });
      if (Object.prototype.hasOwnProperty.call(responses, command)) {
        return Promise.resolve(responses[command]);
      }
      return Promise.reject(command + '|mock');
    },
    listen(name, handler) {
      listeners[name] = handler;
      return Promise.resolve(() => {});
    },
    describeError(error) {
      const parts = String(error).split('|');
      return { key: parts[0], detail: parts[1] || '' };
    }
  };
}

/** 記憶體 store，只提供編譯控制器實際使用的 `getState()`。 */
function createStore(state) {
  return { getState: () => state };
}

/** 假的 document，只支援診斷標記所需的 `querySelectorAll` / `querySelector`。 */
function createDocument(lines) {
  return {
    querySelectorAll(selector) {
      return lines.filter((line) => selector.split(', ').some((part) => line.matches(part)));
    },
    querySelector(selector) {
      return lines.find((line) => line.matches(selector)) || null;
    }
  };
}

/** 沒有程式碼面板時的空 document，讓 init 的清除動作安全運作。 */
const EMPTY_DOCUMENT = createDocument([]);

function createCodeLine(index, classes = '') {
  const node = {
    index: index,
    className: classes,
    title: '',
    scrolled: false,
    matches(selector) {
      if (selector.indexOf('[data-line-index="') !== -1) {
        return this.index === Number(selector.replace(/\D+/g, ''));
      }
      // 只處理 `.code-line.diag-*` 這類選擇器
      return selector.split(', ').some((part) => {
        const wanted = part.replace('.code-line.', '');
        return part.indexOf('.code-line.') === 0 && this.className.split(' ').indexOf(wanted) !== -1;
      });
    },
    classList: {
      add(name) {
        if (node.className.split(' ').indexOf(name) === -1) {
          node.className = (node.className + ' ' + name).trim();
        }
      },
      remove(name) {
        node.className = node.className.split(' ')
          .filter((item) => item && item !== name)
          .join(' ');
      }
    },
    scrollIntoView() { node.scrolled = true; },
    setAttribute(name, value) {
      if (name === 'title') node.title = value;
      node.attributes = node.attributes || {};
      node.attributes[name] = value;
    }
  };
  return node;
}

/** 記錄呼叫的假終端機面板。 */
function createTerminal() {
  const records = [];
  return {
    records,
    open: vi.fn(),
    close: vi.fn(),
    append: (line, kind) => records.push({ type: 'line', line, kind }),
    appendLines: (lines, kind) => records.push({ type: 'lines', lines, kind }),
    appendMessage: (key, fallback, replacements, kind) => records.push({ type: 'message', key, fallback, replacements, kind }),
    clear: vi.fn(),
    onChange: vi.fn(),
    init: vi.fn()
  };
}

async function loadController(setup) {
  const bridge = createBridge(setup.bridge);
  const terminal = createTerminal();
  const store = createStore(setup.state || { path: '', name: 'Blink', meta: {} });
  const sandbox = await loadClassicScript('src/lib/arduino/compile-controller.js', {
    document: setup.document || EMPTY_DOCUMENT,
    console
  });
  const controller = sandbox.CodeBridgeCompile;
  controller._reset();
  sandbox.window.CodeBridgeTauri = bridge;
  sandbox.window.CodeBridgeTerminalPanel = terminal;
  sandbox.window.CodeBridgeProject = { getState: () => store.getState() };
  sandbox.window.CodeBridgePlainCode = setup.plainCode;
  // 假的 toast：避免測試輸出被 console.warn 污染，並可驗證錯誤提示的 key。
  const toast = { shown: [], showKey(key, options) { toast.shown.push({ key, options }); } };
  sandbox.window.CodeBridgeToast = toast;
  controller.init({ store, getCode: () => setup.code || '' });
  return { controller, bridge, terminal, store, toast };
}

const READY_STATE = { path: '', name: 'Blink', meta: { fqbn: 'arduino:avr:uno', port: 'COM3' } };

describe('編譯控制器', () => {
  let controller;
  let bridge;
  let terminal;

  beforeEach(async () => {
    const loaded = await loadController({
      state: READY_STATE,
      code: 'void setup() {}\nvoid loop() {}',
      plainCode: { strip: (code) => code.replace('__BLOCKLY_ID:z1__', '') },
      bridge: { responses: { compile_start: 'op-compile', upload_ready: true, upload_start: 'op-upload', operation_cancel: true } }
    });
    controller = loaded.controller;
    bridge = loaded.bridge;
    terminal = loaded.terminal;
  });

  test('init 會訂閱進度與診斷兩個後端事件', () => {
    expect(Object.keys(bridge.listeners).sort()).toEqual([
      'codebridge://compile-diagnostics',
      'codebridge://operation-status'
    ]);
  });


  test('run 依序呼叫 compile_start 與 upload_start', async () => {
    const started = await controller.run();

    expect(started).toBe(true);
    expect(bridge.calls.map((call) => call.command)).toEqual(['compile_start', 'upload_ready', 'upload_start']);
    expect(controller.getState().operationId).toBe('op-upload');
  });

  test('送出的 payload 來自 plain code 且不含 ID marker', async () => {
    await controller.run();

    const compile = bridge.calls[0];
    expect(compile.args.code).toBe('void setup() {}\nvoid loop() {}');
    expect(compile.args.fqbn).toBe('arduino:avr:uno');
    expect(compile.args.projectId).toBe('untitled');
    expect(compile.args.projectName).toBe('Blink');
  });

  test('run 會自動展開終端機面板並寫入開始訊息', async () => {
    await controller.run();

    expect(terminal.open).toHaveBeenCalled();
    expect(terminal.records[0]).toMatchObject({ type: 'message', key: 'CLI_COMPILE_STARTING' });
  });

  test('作業進行中再次 run 會被忽略（單飛）', async () => {
    const first = controller.run();
    const second = await controller.run();

    expect(second).toBe(false);
    expect(bridge.calls.filter((call) => call.command === 'compile_start')).toHaveLength(1);
    await first;
  });

  test('未選開發板時不發動編譯並提示錯誤', async () => {
    const loaded = await loadController({
      state: { path: '', name: 'Blink', meta: { port: 'COM3' } },
      code: 'void loop() {}',
      plainCode: { strip: (code) => code }
    });

    expect(await loaded.controller.run()).toBe(false);
    expect(loaded.bridge.calls).toHaveLength(0);
    expect(loaded.toast.shown.map((item) => item.key)).toContain('CLI_ERROR_NO_FQBN');
  });

  test('未選序列埠時編譯但不上傳', async () => {
    const loaded = await loadController({
      state: { path: '', name: 'Blink', meta: { fqbn: 'arduino:avr:uno' } },
      code: 'void loop() {}',
      plainCode: { strip: (code) => code },
      bridge: { responses: { compile_start: 'op-compile', upload_ready: true } }
    });

    expect(await loaded.controller.run()).toBe(false);
    expect(loaded.bridge.calls.map((call) => call.command)).toEqual(['compile_start', 'upload_ready']);
    expect(loaded.toast.shown.map((item) => item.key)).toContain('CLI_ERROR_NO_PORT');
  });

  test('upload_ready 為 false 時不嘗試上傳', async () => {
    const loaded = await loadController({
      state: READY_STATE,
      code: 'void loop() {}',
      plainCode: { strip: (code) => code },
      bridge: { responses: { compile_start: 'op-compile', upload_ready: false } }
    });

    expect(await loaded.controller.run()).toBe(false);
    expect(loaded.bridge.calls.map((call) => call.command)).toEqual(['compile_start', 'upload_ready']);
  });

  test('空程式碼不發動編譯', async () => {
    const loaded = await loadController({
      state: READY_STATE,
      code: '   \n  ',
      plainCode: { strip: (code) => code }
    });

    expect(await loaded.controller.run()).toBe(false);
    expect(loaded.bridge.calls).toHaveLength(0);
    expect(loaded.toast.shown.map((item) => item.key)).toContain('DRAFT_ERROR_EMPTY_CODE');
  });


  test('stop 會取消進行中的作業並放開單飛鎖', async () => {
    const running = controller.run();
    await Promise.resolve();
    await Promise.resolve();
    expect(controller.isBusy()).toBe(true);

    const cancelled = await controller.stop();

    expect(cancelled).toBe(true);
    expect(bridge.calls.some((call) => call.command === 'operation_cancel')).toBe(true);
    expect(terminal.records.some((r) => r.key === 'CLI_OPERATION_CANCELLED')).toBe(true);
    await running;
  });

  test('沒有進行中的作業時 stop 不發動後端', async () => {
    expect(await controller.stop()).toBe(false);
    expect(bridge.calls).toHaveLength(0);
  });

  test('projectId 由專案路徑推導，並去除後端不接受的字元', () => {
    expect(controller.resolveProjectId({ path: 'C:/proj/Blink.cbg' })).toBe('Blink');
    // 全非 ASCII 的名稱會被清成空字串，退回 untitled
    expect(controller.resolveProjectId({ path: 'C:/proj/我的 專案.cbg' })).toBe('untitled');
    // 只有底線的檔名去掉前後底線後仍有內容
    expect(controller.resolveProjectId({ path: 'C:/proj/___weird___.cbg' })).toBe('weird');
    expect(controller.resolveProjectId({ path: 'C:/proj/____.cbg' })).toBe('untitled');
    expect(controller.resolveProjectId({ path: '' })).toBe('untitled');
    expect(controller.resolveProjectId(null)).toBe('untitled');
  });

  test('projectId 會把非法字元換成底線且長度受限於 64', () => {
    const id = controller.resolveProjectId({ path: 'C:/proj/a-b_c 123.cbg' });

    expect(id).toBe('a-b_c_123');
    expect(controller.resolveProjectId({ path: 'C:/proj/' + 'x'.repeat(200) + '.cbg' }).length).toBe(64);
  });
});

describe('編譯控制器的診斷標記', () => {
  let codeLines;
  let controller;

  beforeEach(async () => {
    codeLines = [0, 1, 2].map((index) => createCodeLine(index));
    const loaded = await loadController({
      state: READY_STATE,
      code: 'void loop() {}',
      plainCode: { strip: (code) => code },
      bridge: { responses: { compile_start: 'op-compile', upload_ready: false } },
      document: createDocument(codeLines)
    });
    controller = loaded.controller;
  });

  test('只標記自己草稿的診斷，函式庫核心檔的警告略過', () => {
    const marked = controller.applyDiagnostics('Blink.ino', [
      { file: 'Blink.ino', line: 2, column: 5, severity: 'error', message: "expected ';' before '}'" },
      { file: 'Wire.h', line: 2, column: 1, severity: 'warning', message: 'deprecated' }
    ]);

    expect(marked).toBe(1);
    expect(codeLines[1].className).toBe('diag-error');
    expect(codeLines[1].title).toBe("expected ';' before '}'");
    expect(codeLines[0].className).toBe('');
    expect(codeLines[2].className).toBe('');
  });

  test('1-based 行號對應到 0-based 的 data-line-index', () => {
    controller.applyDiagnostics('Blink.ino', [
      { file: 'Blink.ino', line: 1, column: 1, severity: 'warning', message: 'w' }
    ]);

    expect(codeLines[0].className).toBe('diag-warning');
  });

  test('note 等級使用 diag-note 樣式', () => {
    controller.applyDiagnostics('Blink.ino', [
      { file: 'Blink.ino', line: 3, column: 1, severity: 'note', message: 'n' }
    ]);

    expect(codeLines[2].className).toBe('diag-note');
  });

  test('超出範圍或格式不良的診斷被安全忽略', () => {
    expect(controller.applyDiagnostics('Blink.ino', [
      { file: 'Blink.ino', line: 99, column: 1, severity: 'error', message: 'oob' },
      { file: 'Blink.ino', line: 0, column: 1, severity: 'error', message: 'zero' },
      { file: 'Blink.ino', line: 'abc', column: 1, severity: 'error', message: 'nan' },
      null
    ])).toBe(0);
  });

  test('沒有 inoFileName 時不做任何標記', () => {
    expect(controller.applyDiagnostics(null, [
      { file: 'Blink.ino', line: 1, column: 1, severity: 'error', message: 'x' }
    ])).toBe(0);
  });

  test('重新套用診斷前會清掉舊標記', () => {
    controller.applyDiagnostics('Blink.ino', [
      { file: 'Blink.ino', line: 1, column: 1, severity: 'error', message: 'a' }
    ]);
    expect(codeLines[0].className).toBe('diag-error');

    controller.applyDiagnostics('Blink.ino', [
      { file: 'Blink.ino', line: 2, column: 1, severity: 'error', message: 'b' }
    ]);
    expect(codeLines[0].className).toBe('');
    expect(codeLines[1].className).toBe('diag-error');
  });

  test('handleCompileDiagnostics 標記面板、寫入終端機並結束 busy', async () => {
    const loaded = await loadController({
      state: READY_STATE,
      code: 'void loop() {}',
      plainCode: { strip: (code) => code },
      bridge: { responses: { compile_start: 'op-compile', upload_ready: false } },
      document: createDocument(codeLines)
    });

    const running = loaded.controller.run();
    await Promise.resolve();
    await Promise.resolve();
    expect(loaded.controller.isBusy()).toBe(true);

    loaded.controller.handleCompileDiagnostics({
      operationId: 'op-compile',
      inoFileName: 'Blink.ino',
      diagnostics: [{ file: 'Blink.ino', line: 3, column: 1, severity: 'error', message: 'boom' }]
    });

    expect(codeLines[2].className).toBe('diag-error');
    expect(loaded.controller.isBusy()).toBe(false);
    expect(loaded.controller.getState().diagnostics).toHaveLength(1);
    expect(loaded.terminal.records.some((r) => r.type === 'line' && r.line === 'Blink.ino:3:1 boom')).toBe(true);
    await running;
  });

  test('忽略其他作業（例如 Board Manager）的事件', async () => {
    const running = controller.run();
    await Promise.resolve();
    await Promise.resolve();

    controller.handleOperationStatus({ operationId: 'other-op', lastLine: 'downloading core' });
    controller.handleCompileDiagnostics({
      operationId: 'other-op',
      inoFileName: 'Blink.ino',
      diagnostics: [{ file: 'Blink.ino', line: 1, column: 1, severity: 'error', message: 'x' }]
    });

    expect(codeLines[0].className).toBe('');
    expect(controller.isBusy()).toBe(true);
    await running;
  });
});
