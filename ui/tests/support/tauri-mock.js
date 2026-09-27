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
      errors: {}
    }, config.cli || {});

    window.__TAURI__ = {
      core: {
        invoke(command, args) {
          const payload = args || {};
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
          if (command === 'compile_start' || command === 'upload_start' ||
              command === 'upload_ready' || command === 'operation_cancel') {
            window.__MOCK_CLI_CALLS__.push({ command, args: payload });
            const cli = window.__MOCK_CLI__;
            const forced = cli.errors[command];
            if (forced) return fail(forced, '');
            if (command === 'compile_start') return respond(cli.compileStart);
            if (command === 'upload_start') return respond(cli.uploadStart);
            if (command === 'upload_ready') return respond(cli.uploadReady);
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
  }, { files: options.files || {} });
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
