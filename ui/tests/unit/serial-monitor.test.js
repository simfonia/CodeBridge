import { describe, expect, test } from 'vitest';
import { loadClassicScript } from '../support/classic-script.js';

/**
 * 序列監視器（Serial Monitor）的單元測試。
 *
 * 驗證的是**前端決策層**：baud 變更要重啟、埠消失要自動關、
 * 純瀏覽器降級不可拋錯、事件資料要正確分流到終端機面板。
 * 真實序列埠的讀取已由 Rust 端的 `pump()` 測試涵蓋。
 */

const SCRIPT = 'src/lib/arduino/serial-monitor.js';

/** 假的 Tauri bridge，記錄所有 invoke 並可注入回應。 */
function createBridge(options = {}) {
  const calls = [];
  return {
    calls,
    available: options.available !== false,
    listeners: {},
    responses: Object.assign(
      {
        serial_monitor_start: { connected: true, port: 'COM3', baud: 9600, error: null },
        serial_monitor_stop: true,
        serial_monitor_send: 6,
        serial_monitor_status: { connected: false, port: '', baud: 9600, error: null }
      },
      options.responses || {}
    ),
    isAvailable() {
      return this.available;
    },
    invoke(command, args) {
      calls.push({ command, args: args || {} });
      if (options.errors && options.errors[command]) {
        return Promise.reject(options.errors[command]);
      }
      return Promise.resolve(this.responses[command]);
    },
    listen(event, handler) {
      this.listeners[event] = handler;
    }
  };
}

/** 記錄附加內容的假終端機面板。 */
function createTerminal() {
  const appended = [];
  return {
    appended,
    append: (line, kind) => appended.push({ line, kind }),
    appendLines: (lines, kind) => lines.forEach((line) => appended.push({ line, kind })),
    appendMessage: (key, fallback, replacements, kind) => appended.push({ line: key, kind }),
    open: () => {},
    clear: () => {}
  };
}

/** 載入模組並注入假環境。 */
async function loadMonitor(options = {}) {
  const bridge = options.bridge || createBridge();
  const terminal = options.terminal || createTerminal();
  // 注入的是**頂層屬性**：`loadClassicScript` 會把 sandbox 同時設為
  // `window` 與 `globalThis`，所以模組讀 `window.CodeBridgeTauri`
  // 讀到的就是這裡提供的物件。
  const sandbox = await loadClassicScript(SCRIPT, {
    CodeBridgeTauri: bridge,
    CodeBridgeTerminalPanel: terminal,
    getI18n: (key, fallback) => fallback || key
  });
  return { monitor: sandbox.CodeBridgeSerialMonitor, bridge, terminal, sandbox };
}

describe('序列監視器前端模組', () => {
  test('公開 API 齊備且事件名稱與後端一致', async () => {
    const { monitor } = await loadMonitor();
    expect(monitor.EVENTS.SERIAL_DATA).toBe('codebridge://serial-data');
    expect(monitor.EVENTS.SERIAL_STATE).toBe('codebridge://serial-state');
    ['init', 'start', 'stop', 'toggle', 'setBaud', 'setHex', 'setTimestamp', 'send', 'getState']
      .forEach((name) => expect(typeof monitor[name]).toBe('function'));
  });

  test('start 送出 port、baud、hex、resetOnOpen 並同步狀態', async () => {
    const { monitor, bridge } = await loadMonitor();
    const ok = await monitor.start({ port: 'COM3', baud: 9600, hex: false });
    expect(ok).toBe(true);
    const call = bridge.calls.find((item) => item.command === 'serial_monitor_start');
    expect(call.args).toEqual({ port: 'COM3', baud: 9600, hex: false, resetOnOpen: false });
    expect(monitor.getState().connected).toBe(true);
  });

  test('resetBoard 強制帶上 resetOnOpen:true（不論目前設定）', async () => {
    // 按鈕的語意就是「重新啟動板子」，必須真的做這件事；
    // 若沿用目前設定（預設 false），按了會沒反應。
    const { monitor, bridge } = await loadMonitor();
    await monitor.start({ port: 'COM3', baud: 9600 });
    await monitor.resetBoard();
    const last = bridge.calls.filter((c) => c.command === 'serial_monitor_start').pop();
    expect(last.args.resetOnOpen).toBe(true);
  });

  test('未連線時 resetBoard 回 false 且不發動後端', async () => {
    const { monitor, bridge } = await loadMonitor();
    expect(await monitor.resetBoard()).toBe(false);
    expect(bridge.calls).toHaveLength(0);
  });

  test('setResetOnOpen 是純前端切換', async () => {
    const { monitor, bridge } = await loadMonitor();
    await monitor.setResetOnOpen(true);
    expect(bridge.calls).toHaveLength(0);
    expect(monitor.getState().resetOnOpen).toBe(true);
  });

  test('沒有埠時不發動後端，直接回報失敗', async () => {
    const { monitor, bridge } = await loadMonitor();
    // 「尚未選擇序列埠」是最常見的阻擋點，不應送出無效請求。
    const ok = await monitor.start({ port: '', baud: 9600 });
    expect(ok).toBe(false);
    expect(bridge.calls.filter((item) => item.command === 'serial_monitor_start')).toHaveLength(0);
  });

  test('純瀏覽器（無 Tauri）時 start 回 false 而不拋錯', async () => {
    const bridge = createBridge({ available: false });
    const { monitor } = await loadMonitor({ bridge });
    const ok = await monitor.start({ port: 'COM3', baud: 9600 });
    expect(ok).toBe(false);
    expect(bridge.calls).toHaveLength(0);
  });

  test('後端錯誤以 i18n key 回報到終端機面板', async () => {
    const bridge = createBridge({ errors: { serial_monitor_start: 'SERIAL_ERROR_OPEN|找不到 COM3' } });
    const { monitor, terminal } = await loadMonitor({ bridge });
    const ok = await monitor.start({ port: 'COM3', baud: 9600 });
    expect(ok).toBe(false);
    expect(terminal.appended.some((item) => item.kind === 'error')).toBe(true);
  });

  test('baud 變更會先停止再以新 baud 重啟', async () => {
    const { monitor, bridge } = await loadMonitor();
    await monitor.start({ port: 'COM3', baud: 9600 });
    await monitor.setBaud(115200);
    const commands = bridge.calls.map((item) => item.command);
    // 序列埠的 baud 在開啟時綁定，無法熱改 —— 必須重啟。
    expect(commands).toContain('serial_monitor_stop');
    const lastStart = bridge.calls.filter((item) => item.command === 'serial_monitor_start').pop();
    expect(lastStart.args.baud).toBe(115200);
  });

  test('未連線時變更 baud 只記住設定，不發動後端', async () => {
    const { monitor, bridge } = await loadMonitor();
    await monitor.setBaud(57600);
    expect(bridge.calls).toHaveLength(0);
    expect(monitor.getState().baud).toBe(57600);
  });

  test('setHex 與 setTimestamp 是純前端切換，不重啟', async () => {
    const { monitor, bridge } = await loadMonitor();
    await monitor.start({ port: 'COM3', baud: 9600 });
    const before = bridge.calls.length;
    await monitor.setHex(true);
    await monitor.setTimestamp(true);
    expect(bridge.calls).toHaveLength(before);
    const state = monitor.getState();
    expect(state.hex).toBe(true);
    expect(state.timestamp).toBe(true);
  });

  test('資料事件以 data 樣式附加到終端機面板', async () => {
    const { monitor, terminal } = await loadMonitor();
    monitor.handleSerialData({ port: 'COM3', lines: ['第一行', '第二行'] });
    expect(terminal.appended).toHaveLength(2);
    expect(terminal.appended[0].kind).toBe('data');
  });

  test('時間戳只在開啟時加前綴', async () => {
    const { monitor, terminal } = await loadMonitor();
    monitor.handleSerialData({ port: 'COM3', lines: ['無時間戳'] });
    await monitor.setTimestamp(true);
    monitor.handleSerialData({ port: 'COM3', lines: ['有時間戳'] });
    expect(terminal.appended[0].line).toBe('無時間戳');
    // 時間戳格式為 HH:MM:SS.mmm，內容仍是原本的資料。
    expect(terminal.appended[1].line).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}\s+有時間戳$/);
  });

  test('其他埠的資料不混入（多埠並存時的過濾）', async () => {
    const { monitor, terminal } = await loadMonitor();
    await monitor.start({ port: 'COM3', baud: 9600 });
    monitor.handleSerialData({ port: 'COM9', lines: ['別的埠'] });
    expect(terminal.appended).toHaveLength(0);
  });

  // ---------------------------------------------------------------
  // onDataLine：序列繪圖的資料訂閱點
  // ---------------------------------------------------------------

  test('onDataLine 訂閱者會收到原始資料行（繪圖用）', async () => {
    const { monitor } = await loadMonitor();
    const received = [];
    monitor.onDataLine((line) => received.push(line));

    monitor.handleSerialData({ port: 'COM3', lines: ['23.5', '24.0'] });
    expect(received).toEqual(['23.5', '24.0']);
  });

  test('onDataLine 收到的是**未加時間戳**的原始行', async () => {
    // 繪圖要的是純數值；帶上 "14:32:05.123 " 前綴會讓每一行都變成垃圾行。
    const { monitor } = await loadMonitor();
    const received = [];
    monitor.onDataLine((line) => received.push(line));

    await monitor.setTimestamp(true);
    monitor.handleSerialData({ port: 'COM3', lines: ['23.5'] });
    expect(received).toEqual(['23.5']);
  });

  test('其他埠的資料不會通知繪圖訂閱者', async () => {
    const { monitor } = await loadMonitor();
    await monitor.start({ port: 'COM3', baud: 9600 });
    const received = [];
    monitor.onDataLine((line) => received.push(line));

    monitor.handleSerialData({ port: 'COM9', lines: ['別的埠'] });
    expect(received).toEqual([]);
  });

  test('沒有訂閱者時資料事件不會拋錯（Plotter 可缺席）', async () => {
    const { monitor, terminal } = await loadMonitor();
    expect(() => monitor.handleSerialData({ port: 'COM3', lines: ['x'] })).not.toThrow();
    // 終端機面板仍要照常收到資料 —— 繪圖是附加檢視，不是取代。
    expect(terminal.appended).toHaveLength(1);
  });

  test('_reset 會清掉資料訂閱者（避免測試間洩漏）', async () => {
    const { monitor } = await loadMonitor();
    const received = [];
    monitor.onDataLine((line) => received.push(line));
    monitor._reset();

    monitor.handleSerialData({ port: 'COM3', lines: ['23.5'] });
    expect(received).toEqual([]);
  });

  test('狀態事件更新連線旗標', async () => {
    const { monitor } = await loadMonitor();
    await monitor.start({ port: 'COM3', baud: 9600 });
    monitor.handleSerialState({ connected: false, port: 'COM3', baud: 9600, error: null });
    expect(monitor.getState().connected).toBe(false);
  });

  test('狀態事件帶回的 hex 會覆寫前端設定', async () => {
    // 上傳會暫停 Monitor 再重連，後端重連時會把 hex 帶回來。
    // 若前端不採納，使用者選了 HEX 會在一次上傳後悄悄失效。
    const { monitor } = await loadMonitor();
    await monitor.start({ port: 'COM3', baud: 9600, hex: false });
    monitor.handleSerialState({ connected: true, port: 'COM3', baud: 9600, hex: true, error: null });
    expect(monitor.getState().hex).toBe(true);
  });

  test('後端未提供 hex 欄位時保留前端設定', async () => {
    // 相容性：舊版後端沒有 hex 欄位，不可因此把使用者的設定清成 false。
    const { monitor } = await loadMonitor();
    await monitor.start({ port: 'COM3', baud: 9600, hex: true });
    monitor.handleSerialState({ connected: true, port: 'COM3', baud: 9600, error: null });
    expect(monitor.getState().hex).toBe(true);
  });

  test('上傳暫停中與使用者手動關閉是不同狀態', async () => {
    // 實機回報：「再次按上傳，沒有自動先關閉」—— 使用者看到「未連線」
    // 以為自動暫停失敗。其實有暫停，只是顯示成未連線。
    // 必須讓「上傳暫停中」有別於「未連線」，否則使用者會手動去關，
    // 然後撞上埠仍被佔用的錯誤。
    const { monitor } = await loadMonitor();
    await monitor.start({ port: 'COM3', baud: 9600 });

    monitor.handleSerialState({
      connected: false,
      port: 'COM3',
      baud: 0,
      hex: false,
      error: 'SERIAL_PAUSED_FOR_UPLOAD|'
    });
    const paused = monitor.getState();
    expect(paused.connected).toBe(false);
    expect(paused.pausedForUpload).toBe(true);

    // 使用者手動關閉 → 不是暫停狀態。
    await monitor.stop();
    expect(monitor.getState().pausedForUpload).toBe(false);
  });

  test('暫停狀態在重新連線後清除', async () => {
    const { monitor } = await loadMonitor();
    monitor.handleSerialState({
      connected: false,
      port: 'COM3',
      baud: 0,
      hex: false,
      error: 'SERIAL_PAUSED_FOR_UPLOAD|'
    });
    // 上傳結束後後端重連，狀態事件不再帶暫停標記。
    monitor.handleSerialState({ connected: true, port: 'COM3', baud: 9600, hex: false, error: null });
    const state = monitor.getState();
    expect(state.connected).toBe(true);
    expect(state.pausedForUpload).toBe(false);
  });

  test('埠從清單消失時自動關閉監視器', async () => {
    const { monitor, bridge } = await loadMonitor();
    await monitor.start({ port: 'COM3', baud: 9600 });
    // 拔線是不可逆事件：不自動關閉會讓 UI 永遠顯示「已連線」。
    monitor.handlePortsChanged({ ports: ['COM7'], change: 'removed' });
    expect(bridge.calls.filter((item) => item.command === 'serial_monitor_stop')).toHaveLength(1);
    expect(monitor.getState().connected).toBe(false);
  });

  test('send 在未連線時回 false', async () => {
    const { monitor, bridge } = await loadMonitor();
    const ok = await monitor.send('hello');
    expect(ok).toBe(false);
    expect(bridge.calls).toHaveLength(0);
  });

  test('send 送出訊息內容', async () => {
    const { monitor, bridge } = await loadMonitor();
    await monitor.start({ port: 'COM3', baud: 9600 });
    await monitor.send('hello');
    const call = bridge.calls.find((item) => item.command === 'serial_monitor_send');
    expect(call.args.text).toBe('hello');
  });

  test('資料事件帶回位元組數（診斷「板子沒印」vs「解碼成空」）', async () => {
    // 使用者回報「印出空白行」—— 他無法分辨板子完全沒送資料，
    // 還是送了資料但解碼成空。兩者畫面完全一樣。
    const { monitor } = await loadMonitor();
    await monitor.start({ port: 'COM3', baud: 9600 });
    expect(monitor.getState().receivedBytes).toBe(0);

    monitor.handleSerialData({ port: 'COM3', lines: ['x'], bytes: 128 });
    expect(monitor.getState().receivedBytes).toBe(128);
  });

  test('重新開啟時位元組數歸零', async () => {
    // 不歸零的話，新 session 會顯示上一個 session 的累積值，
    // 讓人誤以為「板子有在傳資料」，反而更難診斷。
    const { monitor } = await loadMonitor();
    await monitor.start({ port: 'COM3', baud: 9600 });
    monitor.handleSerialData({ port: 'COM3', lines: ['x'], bytes: 999 });
    await monitor.stop();
    await monitor.start({ port: 'COM3', baud: 9600 });
    expect(monitor.getState().receivedBytes).toBe(0);
  });

  test('舊版後端沒有 bytes 欄位時不影響其他行為', async () => {
    const { monitor, terminal } = await loadMonitor();
    await monitor.start({ port: 'COM3', baud: 9600 });
    monitor.handleSerialData({ port: 'COM3', lines: ['仍可顯示'] });
    expect(terminal.appended.some((item) => item.line === '仍可顯示')).toBe(true);
  });

  test('onChange 監聽器收到狀態快照', async () => {
    const { monitor } = await loadMonitor();
    const seen = [];
    monitor.onChange((state) => seen.push(state.connected));
    await monitor.start({ port: 'COM3', baud: 9600 });
    expect(seen[seen.length - 1]).toBe(true);
  });
});
