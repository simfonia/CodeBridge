import { describe, expect, test } from 'vitest';
import { loadClassicScript } from '../support/classic-script.js';

/**
 * 設定中心（進階 › 路徑）的單元測試。
 *
 * 驗證的是**前端決策層**：每個欄位都要同時顯示「當前值 + 來源」、
 * 未帶參數的欄位必須原樣送（不能被 undefined 蓋掉）、
 * 純瀏覽器環境（無 Tauri）要降級而不是拋錯。
 * 持久化本身由 Rust 端的 `settings.rs` 測試涵蓋。
 */

const SCRIPT = 'src/lib/arduino/settings.js';

/** 假的 Tauri bridge，記錄所有 invoke 並可注入回應。 */
function createBridge(options = {}) {
  const calls = [];
  return {
    calls,
    available: options.available !== false,
    responses: Object.assign(
      {
        toolchain_get_dirs: {
          cliPath: 'C:/tools/arduino-cli.exe',
          cliSource: 'systemPath',
          cliError: null,
          isolated: false,
          configDir: { value: 'C:/Users/me/AppData/Local/Arduino15', source: 'systemDefault' },
          dataDir: { value: 'C:/Users/me/AppData/Local/Arduino15', source: 'systemDefault' },
          userDir: { value: 'C:/Users/me/AppData/Local/Arduino15/user', source: 'systemDefault' },
          downloadsDir: { value: 'C:/Users/me/AppData/Local/Arduino15/staging', source: 'systemDefault' },
          buildRoot: { value: 'C:/Users/me/.codebridge/sketches', source: 'appIsolated' },
          settingsPath: 'C:/Users/me/.codebridge/settings.json'
        }
      },
      options.responses || {}
    ),
    errors: options.errors || {},
    isAvailable() {
      return this.available;
    },
    invoke(command, args) {
      calls.push({ command, args: args || {} });
      if (this.errors[command]) return Promise.reject(this.errors[command]);
      return Promise.resolve(this.responses[command]);
    }
  };
}

/** 記錄 toast 的假元件，對齊 `CodeBridgeToast.show(msg, { type })`。 */
function createToasts() {
  const messages = [];
  return {
    messages,
    show(text, options) {
      messages.push({ text, type: (options && options.type) || 'info' });
    }
  };
}

/** 載入模組並注入假環境。 */
async function loadSettings(options = {}) {
  const bridge = options.bridge || createBridge();
  const toasts = options.toasts || createToasts();
  const sandbox = await loadClassicScript(SCRIPT, {
    CodeBridgeTauri: bridge,
    CodeBridgeToast: toasts,
    getI18n: (key, fallback) => fallback || key
  });
  return { settings: sandbox.CodeBridgeSettings, bridge, toasts, sandbox };
}

describe('設定中心路徑頁', () => {
  test('公開 API 齊備', async () => {
    const { settings } = await loadSettings();
    ['init', 'open', 'close', 'isOpen', 'load', 'save', 'getReport'].forEach((name) =>
      expect(typeof settings[name]).toBe('function')
    );
  });

  test('load 送出 toolchain_get_dirs 並回傳報告', async () => {
    const { settings, bridge } = await loadSettings();
    const report = await settings.load();
    expect(bridge.calls[0].command).toBe('toolchain_get_dirs');
    expect(report.dataDir.source).toBe('systemDefault');
  });

  test('report 同時帶出每個目錄的值與來源（決策四）', async () => {
    // 使用者需要自己回答「為什麼我看不到核心」，所以來源不能省。
    const { settings } = await loadSettings();
    const report = await settings.load();
    ['configDir', 'dataDir', 'userDir', 'downloadsDir', 'buildRoot'].forEach((key) => {
      expect(typeof report[key].value).toBe('string');
      expect(typeof report[key].source).toBe('string');
    });
  });
});


describe('設定寫入', () => {
  test('save 只送出使用者真正更動的欄位', async () => {
    // 送出 undefined 會讓後端把欄位清成 null —— 這是危險的隱性副作用。
    const { settings, bridge } = await loadSettings();
    await settings.load();
    bridge.calls.length = 0;
    await settings.save({ isolated: true });
    const call = bridge.calls.find((item) => item.command === 'toolchain_set_dirs');
    expect(call.args.isolated).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(call.args, 'cliPath')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(call.args, 'buildRoot')).toBe(false);
  });

  test('save 空字串的 CLI 路徑代表清除設定', async () => {
    const { settings, bridge } = await loadSettings();
    await settings.save({ cliPath: '' });
    const call = bridge.calls.find((item) => item.command === 'toolchain_set_dirs');
    expect(call.args.cliPath).toBe('');
  });

  test('save 成功後回報後端實際生效的值', async () => {
    // 畫面必須顯示後端回報的結果，而不是前端自己猜的值 ——
    // 隔離目錄的實際路徑只有後端知道。
    const bridge = createBridge({
      responses: {
        toolchain_set_dirs: {
          cliPath: null,
          cliSource: null,
          cliError: 'CLI_ERROR_NOT_FOUND',
          isolated: true,
          configDir: { value: 'C:/cb/arduino', source: 'appIsolated' },
          dataDir: { value: 'C:/cb/arduino/data', source: 'appIsolated' },
          userDir: { value: 'C:/cb/arduino/user', source: 'appIsolated' },
          downloadsDir: { value: 'C:/cb/arduino/downloads', source: 'appIsolated' },
          buildRoot: { value: 'C:/cb/sketches', source: 'appIsolated' },
          settingsPath: 'C:/cb/settings.json'
        }
      }
    });
    const { settings } = await loadSettings({ bridge });
    const report = await settings.save({ isolated: true });
    expect(report.isolated).toBe(true);
    expect(report.dataDir.source).toBe('appIsolated');
  });

  test('save 失敗時顯示錯誤且保留既有報告', async () => {
    const { settings, toasts, bridge } = await loadSettings({
      bridge: createBridge({ errors: { toolchain_set_dirs: 'SETTINGS_ERROR_WRITE_FAILED|denied' } })
    });
    await settings.load();
    const before = settings.getReport();
    const report = await settings.save({ isolated: true });
    expect(report).toBe(before);
    expect(toasts.messages.some((item) => item.type === 'error')).toBe(true);
    expect(bridge.calls.filter((c) => c.command === 'toolchain_set_dirs')).toHaveLength(1);
  });
});

describe('降級與來源對應', () => {
  test('sourceKey 把後端的來源值對應到 i18n key', async () => {
    const { settings } = await loadSettings();
    expect(settings.sourceKey('systemDefault')).toBe('DIR_SOURCE_SYSTEM_DEFAULT');
    expect(settings.sourceKey('appIsolated')).toBe('DIR_SOURCE_APP_ISOLATED');
    expect(settings.sourceKey('userConfigured')).toBe('DIR_SOURCE_USER_CONFIGURED');
  });

  test('未知來源不拋錯而是回退到 systemDefault', async () => {
    // 後端新增來源值時舊版前端不該整個壞掉。
    const { settings } = await loadSettings();
    expect(settings.sourceKey('somethingNew')).toBe('DIR_SOURCE_SYSTEM_DEFAULT');
  });

  test('無 Tauri 環境時 load 回傳 null 且不拋錯', async () => {
    const { settings } = await loadSettings({ bridge: createBridge({ available: false }) });
    expect(await settings.load()).toBeNull();
  });

  test('無 Tauri 環境時 save 回傳 null 且不發出任何呼叫', async () => {
    const bridge = createBridge({ available: false });
    const { settings } = await loadSettings({ bridge });
    expect(await settings.save({ isolated: true })).toBeNull();
    expect(bridge.calls).toHaveLength(0);
  });

  test('後端錯誤以訊息而非例外呈現', async () => {
    const { settings, toasts } = await loadSettings({
      bridge: createBridge({ errors: { toolchain_get_dirs: 'CLI_ERROR_NOT_FOUND|not found' } })
    });
    const report = await settings.load();
    expect(report).toBeNull();
    expect(toasts.messages.some((item) => item.type === 'error')).toBe(true);
  });
});

describe('對話框開關', () => {
  test('open/close 維護開啟狀態', async () => {
    const { settings } = await loadSettings();
    expect(settings.isOpen()).toBe(false);
    settings.open();
    expect(settings.isOpen()).toBe(true);
    settings.close();
    expect(settings.isOpen()).toBe(false);
  });

  test('open 會先載入最新報告（設定可能在別處被改過）', async () => {
    const { settings, bridge } = await loadSettings();
    bridge.calls.length = 0;
    await settings.open();
    expect(bridge.calls.some((call) => call.command === 'toolchain_get_dirs')).toBe(true);
  });
});
