/**
 * 在頁面載入前注入假的 Tauri runtime 與記憶體檔案系統。
 *
 * Playwright 測試跑在純瀏覽器（Vite dev server），沒有真實 Tauri，
 * 因此以 window.__TAURI__ stub 驗證專案 I/O 流程（開啟／儲存／最近清單）。
 */
export async function installTauriMock(page, options = {}) {
  await page.addInitScript((config) => {
    const files = Object.assign({}, config.files);

    function respond(value) {
      return Promise.resolve(value);
    }

    function fail(key, detail) {
      return Promise.reject(key + '|' + detail);
    }

    window.__MOCK_CBG_FILES__ = files;
    window.__MOCK_OPEN_PATH__ = null;
    window.__MOCK_SAVE_PATH__ = null;
    window.__MOCK_CLOSED__ = false;
    window.__MOCK_REVEALED__ = [];
    window.__MOCK_EVENT_HANDLERS__ = {};
    // Arduino CLI 工具鏈（T2-C）：記錄前端送出的 command 與 payload，
    // 讓 E2E 測試能驗證 compile/upload 流程而不需要真實硬體。
    window.__MOCK_CLI_CALLS__ = [];
    window.__MOCK_CLI__ = Object.assign({
      compileStart: 'op-compile',
      uploadReady: true,
      uploadStart: 'op-upload',
      cancelResult: true,
      // 開發板清單（T2-E）：預設給三款常見板子，讓面板 E2E 不需真實 CLI。
      boards: [
        { name: 'Arduino Uno', fqbn: 'arduino:avr:uno' },
        { name: 'Arduino Nano', fqbn: 'arduino:avr:nano' },
        { name: 'Arduino Mega', fqbn: 'arduino:avr:mega' }
      ],
      // 可安裝的核心（T2-E 首次使用流程）。
      platforms: [
        { id: 'arduino:avr', name: 'Arduino AVR Boards', version: '1.8.8' }
      ],
      installedPlatforms: [],
      // 序列埠：預設給一個 COM 口，讓序列監視器 E2E 不需真實硬體。
      // `get_serial_ports` 是啟動快照（`board-detector` 的 `pullInitialPorts`），
      // 缺了它序列埠下拉永遠是空的 —— 「按了開啟卻說沒有埠」。
      ports: ['COM3'],

      // 序列監視器（T3）：預設未連線，連線後的狀態由 mock 自行維護，
      // 讓 E2E 可以驗證「開啟 → 資料 → 關閉」的完整流程。
      serialConnected: false,
      serialPort: 'COM3',
      serialBaud: 9600,
      serialSent: [],
      // 設定中心（T3 階段 1）：預設共用系統目錄，來源為 systemDefault。
      dirs: {
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
      },
      errors: {}
    }, config.cli || {});

    window.__TAURI__ = {
      core: {
        invoke(command, args) {
          const payload = args || {};
          const cli = window.__MOCK_CLI__;
          if (command === 'project_save') {
            files[payload.path] = payload.contents;
            return respond(null);
          }
          if (command === 'project_read') {
            if (!Object.prototype.hasOwnProperty.call(files, payload.path)) {
              return fail('PROJECT_ERROR_NOT_FOUND', payload.path);
            }
            return respond(files[payload.path]);
          }
          if (command === 'project_exists') {
            return respond(Object.prototype.hasOwnProperty.call(files, payload.path));
          }
          if (command === 'project_reveal') {
            window.__MOCK_REVEALED__.push(payload.path);
            return respond(null);
          }
          if (command === 'app_close') {
            window.__MOCK_CLOSED__ = true;
            return respond(null);
          }
          // 序列埠啟動快照（`board-detector` 的 `pullInitialPorts`）。
          // **必須放在白名單判斷之前** —— 它不屬於 CLI 工具鏈，
          // 放進白名單會讓 `compile-flow` 等既有測試記錄到多餘的呼叫。
          if (command === 'get_serial_ports') return respond(cli.ports || []);
          // 內建範例（2026-09-28）：改由 Rust 掃描 `resources/examples/`
          // （對齊 #WaveCode），前端不再 fetch `examples/manifest.json`。
          // 這裡以記憶體檔案模擬掃描結果。
          if (command === 'list_examples') {
            const examples = Object.keys(files)
              .filter((name) => name.endsWith('.cbg') && name.includes('__examples__'))
              .sort();
            return respond(examples.map((name) => ({
              name: name.split('__examples__/').pop().replace(/^\d+[-_]/, '').replace(/\.cbg$/, ''),
              file: name,
              path: name
            })));
          }
          if (command === 'read_example') {
            if (!Object.prototype.hasOwnProperty.call(files, payload.path)) {
              return fail('PROJECT_ERROR_NOT_FOUND', payload.path);
            }
            return respond(files[payload.path]);
          }
          if (command === 'compile_start' || command === 'upload_start' ||
              command === 'upload_ready' || command === 'operation_cancel' ||
              command === 'board_list_all' || command === 'refresh_serial_ports' ||
              command === 'core_list' || command === 'core_search' ||
              command === 'core_install' ||
              command === 'toolchain_get_dirs' || command === 'toolchain_set_dirs' ||
              command === 'serial_monitor_start' || command === 'serial_monitor_stop' ||
              command === 'serial_monitor_send') {
            window.__MOCK_CLI_CALLS__.push({ command, args: payload });
            const forced = cli.errors[command];
            if (forced) return fail(forced, '');
            if (command === 'compile_start') return respond(cli.compileStart);
            if (command === 'upload_start') return respond(cli.uploadStart);
            if (command === 'upload_ready') return respond(cli.uploadReady);
            if (command === 'toolchain_get_dirs') return respond(cli.dirs);
            if (command === 'toolchain_set_dirs') {
              // 套用後回報「隔離／共用」的真實樣貌，讓 E2E 能驗證來源標籤切換。
              const source = payload.isolated ? 'appIsolated' : 'systemDefault';
              const root = payload.isolated
                ? 'C:/Users/me/.codebridge/arduino'
                : 'C:/Users/me/AppData/Local/Arduino15';
              cli.dirs = {
                cliPath: payload.cliPath !== undefined ? payload.cliPath : cli.dirs.cliPath,
                cliSource: payload.cliPath ? 'userConfigured' : 'systemPath',
                cliError: null,
                isolated: Boolean(payload.isolated),
                configDir: { value: root, source: source },
                dataDir: { value: root + '/data', source: source },
                userDir: { value: root + '/user', source: source },
                downloadsDir: { value: root + '/staging', source: source },
                buildRoot: {
                  value: payload.buildRoot || 'C:/Users/me/.codebridge/sketches',
                  source: payload.buildRoot ? 'userConfigured' : 'appIsolated'
                },
                settingsPath: 'C:/Users/me/.codebridge/settings.json'
              };
              return respond(cli.dirs);
            }
            if (command === 'board_list_all') return respond({ boards: cli.boards });
            if (command === 'refresh_serial_ports') return respond(cli.ports || []);
            if (command === 'core_list') return respond({ platforms: cli.installedPlatforms });
            if (command === 'core_search') return respond({ platforms: cli.platforms });
            if (command === 'core_install') {
              const id = payload.package;
              if (cli.installedPlatforms.indexOf(id) === -1) cli.installedPlatforms.push(id);
              // 允許測試在安裝後提供板子清單（模擬「安裝 avr 後 Uno／Nano 可用」）。
              if (typeof cli.onCoreInstalled === 'function') cli.onCoreInstalled(id);
              return respond({ package: id, stdout: 'done' });
            }
            // 序列監視器（T3）：mock 自行維護連線狀態，
            // 讓 E2E 能驗證「開啟 → 收到資料 → 關閉」的完整流程。
            if (command === 'serial_monitor_start') {
              cli.serialConnected = true;
              cli.serialPort = payload.port;
              cli.serialBaud = payload.baud;
              return respond({ connected: true, port: cli.serialPort, baud: cli.serialBaud, error: null });
            }
            if (command === 'serial_monitor_stop') {
              cli.serialConnected = false;
              return respond(true);
            }
            if (command === 'serial_monitor_send') {
              if (!cli.serialConnected) return fail('SERIAL_MONITOR_NOT_RUNNING', '');
              cli.serialSent.push(payload.text);
              return respond(payload.text.length + 1);
            }
            if (command === 'serial_monitor_status') {
              return respond({
                connected: cli.serialConnected,
                port: cli.serialPort,
                baud: cli.serialBaud,
                error: null
              });
            }
            return respond(cli.cancelResult);
          }
          return fail('MSG_UNKNOWN_ERROR', command);
        }
      },
      dialog: {
        open() {
          return respond(window.__MOCK_OPEN_PATH__);
        },
        save() {
          return respond(window.__MOCK_SAVE_PATH__);
        }
      },
      event: {
        listen(name, handler) {
          window.__MOCK_EVENT_HANDLERS__[name] = handler;
          return respond(() => {
            delete window.__MOCK_EVENT_HANDLERS__[name];
          });
        }
      }
    };
    // **必須一併傳入 `cli`**：`installTauriMock(page, { cli })` 是既有公開
    // 參數，若這裡不傳，`config.cli` 在頁面內恆為 undefined，
    // 呼叫端設定的 `ports`／`boards` 等覆寫全部靜默失效。
  }, { files: options.files || {}, cli: options.cli || {} });
}

/** 送出假的 Tauri 事件（例如 Rust 攔截視窗關閉後送出的 request-close）。 */
export async function emitMockEvent(page, name, payload = null) {
  await page.evaluate((event) => {
    const handler = window.__MOCK_EVENT_HANDLERS__[event.name];
    if (handler) handler({ payload: event.payload });
  }, { name, payload });
}

/** 設定下一次「開啟」對話框要回傳的路徑（null 代表使用者取消）。 */
export async function setOpenPath(page, path) {
  await page.evaluate((value) => {
    window.__MOCK_OPEN_PATH__ = value;
  }, path);
}

/** 設定下一次「另存新檔」對話框要回傳的路徑。 */
export async function setSavePath(page, path) {
  await page.evaluate((value) => {
    window.__MOCK_SAVE_PATH__ = value;
  }, path);
}

/** 強制 UI 語系，避免測試結果依賴執行環境的系統語言。 */
export async function setUiLocale(page, locale = 'zh-hant') {
  await page.addInitScript((value) => {
    try {
      window.localStorage.setItem('codebridgeLang', value);
    } catch (error) {
      // 隱私模式等情況下略過，測試會以瀏覽器語系為準
    }
  }, locale);
}

/** 讀取 mock 檔案系統的內容。 */
export async function readMockFiles(page) {
  return page.evaluate(() => Object.assign({}, window.__MOCK_CBG_FILES__));
}

/** 讀取前端送給 Arduino CLI 工具鏈的所有 invoke 呼叫。 */
export async function readCliCalls(page) {
  return page.evaluate(() => (window.__MOCK_CLI_CALLS__ || []).map((call) => ({
    command: call.command,
    args: call.args
  })));
}

/** 調整 CLI mock 的回傳值（例如讓 upload_ready 回 false）。 */
export async function setCliResponse(page, overrides) {
  await page.evaluate((patch) => {
    Object.assign(window.__MOCK_CLI__, patch);
  }, overrides);
}

/** 讓某個 CLI command 以指定的 `KEY|detail` 錯誤失敗。 */
export async function setCliError(page, command, errorKey) {
  await page.evaluate((payload) => {
    window.__MOCK_CLI__.errors[payload.command] = payload.errorKey;
  }, { command, errorKey });
}
