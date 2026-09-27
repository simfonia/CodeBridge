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

/** 讓 mock bridge 的 promise 鏈走完（`proceedToUpload` 是非同步的）。 */
function flush() {
  return new Promise((resolve) => setImmediate(resolve));
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
    // 心跳點使用 appendToLast（不新增行），記录到最後一筆以便測試。
    appendToLast: (line) => {
      const last = records[records.length - 1];
      if (last && last.type === 'line') last.line += line;
      else records.push({ type: 'line', line, kind: 'info' });
    },
    appendLines: (lines, kind) => records.push({ type: 'lines', lines, kind }),
    appendMessage: (key, fallback, replacements, kind) => records.push({ type: 'message', key, fallback, replacements, kind }),
    // 真實清除紀錄：面板的 `clear()` 會清空 DOM，若 mock 只是空轉，
    // 「每次執行前清除上一輪」的測試就會永遠通過而失去防護作用。
    clear() { records.length = 0; },
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


  test('run 啟動編譯，收到完成事件後才上傳', async () => {
    // 流程：compile_start →（後端背景編譯）→ operation-status succeeded → upload。
    const started = await controller.run();
    expect(started).toBe(true);
    expect(bridge.calls.map((call) => call.command)).toEqual(['compile_start']);

    bridge.listeners['codebridge://operation-status']({
      operationId: 'op-compile', kind: 'compile', state: 'succeeded', lines: []
    });
    await flush();

    expect(bridge.calls.map((call) => call.command))
      .toEqual(['compile_start', 'upload_ready', 'upload_start']);
    expect(controller.getState().operationId).toBe('op-upload');
  });

  test('送出的 payload 來自 plain code 且不含 ID marker', async () => {
    await controller.run();

    const compile = bridge.calls[0];
    expect(compile.args.payload.code).toBe('void setup() {}\nvoid loop() {}');
    expect(compile.args.payload.fqbn).toBe('arduino:avr:uno');
    expect(compile.args.payload.projectId).toBe('untitled');
    expect(compile.args.payload.projectName).toBe('Blink');
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
    const result = await loaded.controller.run();

    expect(result).toBe(false);
    expect(loaded.bridge.calls).toEqual([]);
    // mock 的終端機用 `records` 收集；`appendMessage` 會帶 fallback 文案。
    const messages = loaded.terminal.records
      .filter((entry) => entry.type === 'message')
      .map((entry) => entry.fallback)
      .join('\n');
    expect(messages).toContain('開發板');
  });

  test('compile_start 與 upload_start 都以 { payload } 包裝送出', async () => {
    // 契約：Rust 端簽名為 `compile_start(payload: CompilePayload)`，
    // Tauri 要求參數包成 `{ payload: {...} }`。傳扁平物件會得到
    // 「command compile_start missing required key payload」——
    // 而且 mock 若不驗證形狀，E2E 完全測不出來。
    await controller.run();
    bridge.listeners['codebridge://operation-status']({
      operationId: 'op-compile', kind: 'compile', state: 'succeeded', lines: []
    });
    await flush();

    const compile = bridge.calls.find((call) => call.command === 'compile_start');
    expect(compile.args.payload).toBeDefined();
    expect(compile.args.payload.fqbn).toBe('arduino:avr:uno');
    expect(compile.args.payload.code).toContain('void setup()');
    // 頂層不應殘留扁平欄位，避免誤以為已包裝。
    expect(compile.args.fqbn).toBeUndefined();

    const upload = bridge.calls.find((call) => call.command === 'upload_start');
    expect(upload.args.payload).toBeDefined();
    expect(upload.args.payload.port).toBe('COM3');
    expect(upload.args.port).toBeUndefined();
  });

  test('upload_ready 保持扁平參數（Rust 端簽名非 payload 型別）', async () => {
    // `upload_ready(state, project_id, fqbn)` 是兩個獨立參數，不是 payload struct，
    // 因此必須維持扁平 —— 不能跟著 compile/upload 一起包裝。
    await controller.run();
    bridge.listeners['codebridge://operation-status']({
      operationId: 'op-compile', kind: 'compile', state: 'succeeded', lines: []
    });

    const ready = bridge.calls.find((call) => call.command === 'upload_ready');
    expect(ready.args.projectId).toBeTruthy();
    expect(ready.args.fqbn).toBe('arduino:avr:uno');
    expect(ready.args.payload).toBeUndefined();
  });

  test('run 不會立即查詢 upload_ready，必須等編譯完成事件', async () => {
    // 競態：`compile_start` 是 spawn_blocking，**立即**回傳 op id，
    // 但 `last_builds` 要等編譯成功才寫入。立刻查 upload_ready 必然得到 false，
    // 使用者看到「編譯成功卻沒上傳」且沒有任何錯誤訊息。
    await controller.run();

    expect(bridge.calls.map((call) => call.command))
      .toEqual(['compile_start']);
    // 尚未收到完成事件 → 不可送出 upload_start。
    expect(bridge.calls.map((call) => call.command)).not.toContain('upload_start');
  });

  test('收到編譯成功事件後才上傳', async () => {
    await controller.run();

    bridge.listeners['codebridge://operation-status']({
      operationId: 'op-compile',
      kind: 'compile',
      state: 'succeeded',
      lines: []
    });
    await flush();

    // 完成事件後才送出 upload_ready 與 upload_start。
    const commands = bridge.calls.map((call) => call.command);
    expect(commands).toContain('upload_ready');
    expect(commands).toContain('upload_start');
  });

  test('編譯失敗事件不觸發上傳', async () => {
    await controller.run();

    bridge.listeners['codebridge://operation-status']({
      operationId: 'op-compile',
      kind: 'compile',
      state: 'failed',
      message: 'CLI_ERROR_COMPILE_FAILED|bad syntax',
      lines: []
    });

    const commands = bridge.calls.map((call) => call.command);
    expect(commands).not.toContain('upload_start');
  });

  test('upload_ready 回 false 時必須提示使用者，不得靜默結束', async () => {
    // 靜默失敗是使用者最難-debug 的情況：畫面沒反應，也沒有錯誤。
    const loaded = await loadController({
      state: { path: '', name: 'Blink', meta: { fqbn: 'arduino:avr:uno', port: 'COM3' } },
      code: 'void setup() {}',
      plainCode: { strip: (c) => c },
      bridge: { responses: { compile_start: 'op-compile', upload_ready: false, upload_start: 'op-upload' } }
    });
    await loaded.controller.run();
    loaded.bridge.listeners['codebridge://operation-status']({
      operationId: 'op-compile', kind: 'compile', state: 'succeeded', lines: []
    });
    await new Promise((resolve) => setImmediate(resolve));

    const messages = loaded.terminal.records
      .filter((entry) => entry.type === 'message')
      .map((entry) => entry.key + ' ' + entry.fallback)
      .join('\n');
    expect(messages).toContain('CLI_ERROR_BUILD_STALE');
  });

  test('上傳期間保持 busy，收到 compile-diagnostics 不解除', async () => {
    // 事件順序是 operation-status → compile-diagnostics。若 compile-diagnostics
    // 無條件 setBusy(false)，上傳會被誤判為已結束（按鈕恢復、狀態顯示錯亂）。
    await controller.run();
    bridge.listeners['codebridge://operation-status']({
      operationId: 'op-compile', kind: 'compile', state: 'succeeded', lines: []
    });
    // `proceedToUpload` 內有多層 then（upload_ready → upload），要多 flush 幾次。
    await flush();
    await flush();
    bridge.listeners['codebridge://compile-diagnostics']({
      operationId: 'op-compile', inoFileName: 'Blink.ino', diagnostics: []
    });

    expect(controller.getState().busy).toBe(true);
  });

  test('上傳結束事件的作業識別在 `id` 欄位（非 operationId）', async () => {
    // 回歸：「上傳成功」從不顯示。
    // 後端的 OperationStatus 欄位是 `id`，而 OperationProgress 是 `operationId`；
    // 只讀 operationId 就沒法識別上傳的終態事件。
    await controller.run();
    bridge.listeners['codebridge://operation-status']({
      operationId: 'op-compile', kind: 'compile', state: 'succeeded', lines: []
    });
    await flush();
    await flush();

    bridge.listeners['codebridge://operation-status']({
      id: 'op-upload', kind: 'upload', state: 'succeeded', lastLine: null, message: null
    });
    await flush();

    const messages = terminal.records
      .filter((entry) => entry.type === 'message')
      .map((entry) => entry.key)
      .join('\n');
    expect(messages).toContain('CLI_UPLOAD_SUCCESS');
  });

  test('編詯的重複成功事件不會被該為「上傳成功」', async () => {
    // 回歸：「u4e0a傳成功」出現在「開始上傳」之前。
    // 原因：proceedToUpload 在 invoke('upload_ready') 之前就設 uploading = true，
    // 這段期間若結染的 status 事件重複達達（編詯已結束），
    // handleOperationStatus 看到 uploading && succeeded 就誤判為上傳結束。
    // 解法：用 operationId 精確比對。
    await controller.run();
    bridge.listeners['codebridge://operation-status']({
      operationId: 'op-compile', kind: 'compile', state: 'succeeded', lines: []
    });
    await flush();

    // 上傳尚未開始、也不岌成時，編詯的成功事件再來一次。
    bridge.listeners['codebridge://operation-status']({
      operationId: 'op-compile', kind: 'compile', state: 'succeeded', lines: []
    });
    await flush();
    await flush();

    const messages = terminal.records
      .filter((entry) => entry.type === 'message')
      .map((entry) => entry.key)
      .join('\n');
    expect(messages).not.toContain('CLI_UPLOAD_SUCCESS');
  });

  test('每次執行前清空終端機的上一輪話息', async () => {
    // 不清的後果：第二次執行時上一輪的「上傳成功」還留在上方，
    // 與本次的編詯輸出交雜，让使用者讀不出來次序。
    await controller.run();
    bridge.listeners['codebridge://operation-status']({
      operationId: 'op-compile', kind: 'compile', state: 'succeeded', lines: []
    });
    await flush();
    await flush();
    bridge.listeners['codebridge://operation-status']({
      operationId: 'op-upload', kind: 'upload', state: 'succeeded', lines: []
    });
    await flush();

    const firstRun = terminal.records.length;
    expect(firstRun).toBeGreaterThan(0);

    // 第二次執行：終端機應應在開始編詯後就被清空。
    await controller.run();
    const afterSecond = terminal.records.map((entry) => entry.key || entry.line || '');
    expect(afterSecond).not.toContain('CLI_UPLOAD_SUCCESS');
    expect(afterSecond).not.toContain('CLI_UPLOAD_STARTING');
    // 且已新增本次的開始編詯言語。
    expect(afterSecond).toContain('CLI_COMPILE_STARTING');
  });

  test('上傳期間每秒追加一個點以少用戶知道還活着', async () => {
    // avrdude 燕錄期間可能後面長時間沒輸出，
    // 用戶無法分辨是已結束還是卡住；逐秒加點給一個「還活着」的信號。
    await controller.run();
    bridge.listeners['codebridge://operation-status']({
      operationId: 'op-compile', kind: 'compile', state: 'succeeded', lines: []
    });
    await flush();
    await flush();

    const starting = terminal.records
      .filter((entry) => entry.type === 'message' && entry.key === 'CLI_UPLOAD_STARTING');
    expect(starting).toHaveLength(1);
    // 開始消息告謴不要拖延
    expect(String(starting[0].fallback)).toContain('請勿斷開');

    // 心跳綁該在上傳結束後停止
    expect(terminal.records.some((entry) => entry.line === '.')).toBe(false);
  });

  test('上傳期間心跳確實會跳（每秒一個點）', async () => {
    // 回歸：心跳從未啟動。兩個原因：
    // 1) sandbox 缺 setInterval -> 守占說未動
    // 2) doUpload 只等到 upload_start 回傳 id 就停止 -> 只跑數毫秒
    await controller.run();
    bridge.listeners['codebridge://operation-status']({
      operationId: 'op-compile', kind: 'compile', state: 'succeeded', lines: []
    });
    await flush();
    await flush();

    // 等實際 1.1 秒，心跳應跳至少一次。
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const dots = terminal.records.filter((entry) => String(entry.line || '').indexOf('.') !== -1).length;
    expect(dots).toBeGreaterThanOrEqual(1);

    // 收到上傳終態事件後心跳停止，不得続續加點。
    const before = terminal.records.filter((entry) => String(entry.line || '').indexOf('.') !== -1).length;
    bridge.listeners['codebridge://operation-status']({
      id: 'op-upload', kind: 'upload', state: 'succeeded', lines: []
    });
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const after = terminal.records.filter((entry) => String(entry.line || '').indexOf('.') !== -1).length;
    expect(after).toBe(before);
  });

  test('上傳作業結束後解除 busy，可再次執行', async () => {
    // 迴歸：`uploading` 設 true 後若沒人清回 false，busy 永遠維持，
    // 第二次按「執行」會被 `if (busy) return false` 擋下 —— 使用者症狀是
    // 「第一次上傳成功，之後按上傳完全沒反應」。
    await controller.run();
    bridge.listeners['codebridge://operation-status']({
      operationId: 'op-compile', kind: 'compile', state: 'succeeded', lines: []
    });
    await flush();
    await flush();
    expect(controller.getState().busy).toBe(true);

    // 上傳作業（op-upload）結束。
    bridge.listeners['codebridge://operation-status']({
      operationId: 'op-upload', kind: 'upload', state: 'succeeded', lines: []
    });
    await flush();

    expect(controller.getState().busy).toBe(false);
    // busy 解除後必須能再次執行。
    const second = await controller.run();
    expect(second).toBe(true);
  });

  test('上傳失敗也解除 busy', async () => {
    await controller.run();
    bridge.listeners['codebridge://operation-status']({
      operationId: 'op-compile', kind: 'compile', state: 'succeeded', lines: []
    });
    await flush();
    await flush();

    bridge.listeners['codebridge://operation-status']({
      operationId: 'op-upload', kind: 'upload', state: 'failed', message: 'upload failed', lines: []
    });
    await flush();

    expect(controller.getState().busy).toBe(false);
  });

  test('上傳成功時顯示明確的成功訊息', async () => {
    // 只有 CLI 的原始輸出（"New upload port: COM4 (serial)"）不算成功回饋，
    // 使用者分不出是成功還是失敗。
    await controller.run();
    bridge.listeners['codebridge://operation-status']({
      operationId: 'op-compile', kind: 'compile', state: 'succeeded', lines: []
    });
    await flush();
    await flush();

    bridge.listeners['codebridge://operation-status']({
      operationId: 'op-upload', kind: 'upload', state: 'succeeded', lines: []
    });
    await flush();

    const messages = terminal.records
      .filter((entry) => entry.type === 'message')
      .map((entry) => entry.key)
      .join('\n');
    expect(messages).toContain('CLI_UPLOAD_SUCCESS');
  });

  test('編譯完成（尚未上傳）不顯示上傳成功訊息', async () => {
    await controller.run();
    bridge.listeners['codebridge://operation-status']({
      operationId: 'op-compile', kind: 'compile', state: 'succeeded', lines: []
    });
    await flush();

    const messages = terminal.records
      .filter((entry) => entry.type === 'message')
      .map((entry) => entry.key)
      .join('\n');
    expect(messages).not.toContain('CLI_UPLOAD_SUCCESS');
  });

  test('未選序列埠時編譯但不上傳', async () => {
    const loaded = await loadController({
      state: { path: '', name: 'Blink', meta: { fqbn: 'arduino:avr:uno' } },
      code: 'void loop() {}',
      plainCode: { strip: (code) => code },
      bridge: { responses: { compile_start: 'op-compile', upload_ready: true } }
    });

    // 編譯成功後才檢查序列埠 —— 沒有 port 時不上傳並回報。
    await loaded.controller.run();
    loaded.bridge.listeners['codebridge://operation-status']({
      operationId: 'op-compile', kind: 'compile', state: 'succeeded', lines: []
    });
    await flush();

    expect(loaded.bridge.calls.map((call) => call.command))
      .toEqual(['compile_start', 'upload_ready']);
    expect(loaded.toast.shown.map((item) => item.key)).toContain('CLI_ERROR_NO_PORT');
    expect(loaded.controller.getState().busy).toBe(false);
  });

  test('upload_ready 為 false 時不嘗試上傳', async () => {
    const loaded = await loadController({
      state: READY_STATE,
      code: 'void loop() {}',
      plainCode: { strip: (code) => code },
      bridge: { responses: { compile_start: 'op-compile', upload_ready: false } }
    });

    await loaded.controller.run();
    loaded.bridge.listeners['codebridge://operation-status']({
      operationId: 'op-compile', kind: 'compile', state: 'succeeded', lines: []
    });
    await flush();

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

    // 編譯「失敗」→ 沒有待續上傳，diagnostics 事件應解除 busy。
    loaded.bridge.listeners['codebridge://operation-status']({
      operationId: 'op-compile', kind: 'compile', state: 'failed', lines: []
    });
    loaded.controller.handleCompileDiagnostics({
      operationId: 'op-compile',
      inoFileName: 'Blink.ino',
      diagnostics: [{ file: 'Blink.ino', line: 3, column: 1, severity: 'error', message: 'boom' }]
    });
    await running;

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
