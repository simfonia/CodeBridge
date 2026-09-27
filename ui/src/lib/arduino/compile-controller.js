/// CodeBridge 編譯／上傳控制器
/// 職責：把「按下執行」串成完整流程 —— 取 plain code → compile → 有舊 build 就
///       直接 upload、否則編譯完接著上傳；並把後端事件轉成終端機輸出與
///       程式碼面板的診斷標記。
/// 位置：ui/src/lib/arduino/compile-controller.js
///
/// 設計要點：
/// - **單飛（single-flight）**：`run()` 在作業進行中直接忽略後續呼叫。編譯會
///   佔用同一個暫存目錄與序列埠，重入會產生互相覆蓋的草稿。
/// - **送出的是 plain code**：`CodeBridgePlainCode.strip()` 的結果。這是行號
///   契約的基礎 —— 後端落地的 `.ino` 與程式碼面板逐行相同，compiler diagnostics
///   的行號才能直接對應。
/// - **只跳轉自己的草稿診斷**：gcc 在成功編譯時也會回報函式庫核心檔的警告，
///   這些行號與使用者的程式碼無關，依檔名過濾後才標記。
/// - **純瀏覽器降級**：沒有 Tauri runtime 時不發動 compile，改以 toast 說明，
///   絕不留下「按了沒反應」的按鈕。

var CodeBridgeCompile = (function() {
    'use strict';

    /// 未存檔專案使用的暫存識別。
    var UNSAVED_PROJECT_ID = 'untitled';

    /// 後端 `project_id` 上限（`^[A-Za-z0-9_-]{1,64}$`）。
    var MAX_PROJECT_ID_LENGTH = 64;

    var EVENTS = {
        OPERATION_STATUS: 'codebridge://operation-status',
        COMPILE_DIAGNOSTICS: 'codebridge://compile-diagnostics'
    };

    var context = null;
    var busy = false;
    var activeOperationId = null;
    // 編譯作業的識別單獨保存：upload 開始後 activeOperationId 會被覆寫，
    // 但 compile-diagnostics 事件仍會帶著編譯作業的 id 回來。
    var compileOperationId = null;
    var lastDiagnostics = [];
    var listeners = [];

    function bridge() { return window.CodeBridgeTauri; }
    function terminal() { return window.CodeBridgeTerminalPanel; }
    function project() { return window.CodeBridgeProject; }
    function plainCode() { return window.CodeBridgePlainCode; }

    function text(key, fallback) {
        if (typeof getI18n === 'function') return getI18n(key, fallback);
        return fallback || key;
    }

    function toast(key, fallback, type) {
        if (window.CodeBridgeToast && typeof window.CodeBridgeToast.showKey === 'function') {
            window.CodeBridgeToast.showKey(key, { type: type || 'error' });
            return;
        }
        if (typeof console !== 'undefined') console.warn(fallback || key);
    }

    function reportError(key, detail) {
        var message = text(key, key);
        if (detail) message = message + '：' + detail;
        toast(key, message, 'error');
        if (terminal()) {
            terminal().appendMessage(key, message, detail ? [detail] : [], 'error');
        }
    }

    /// 由專案路徑推導暫存識別；後端只接受 `[A-Za-z0-9_-]{1,64}`。
    function resolveProjectId(state) {
        var path = state && state.path ? state.path : '';
        if (!path) return UNSAVED_PROJECT_ID;
        var fileName = path.split(/[\\/]/).pop() || '';
        var stem = fileName.replace(/\.cbg$/i, '');
        var slug = stem.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
        // 後端拒絕超過 64 字元的識別，超長專案名一律截斷。
        return slug.slice(0, MAX_PROJECT_ID_LENGTH) || UNSAVED_PROJECT_ID;
    }

    /// 取得目前工作區的 plain code（已去除 ID marker）。
    function currentCode() {
        if (context && typeof context.getCode === 'function') {
            return context.getCode();
        }
        return '';
    }

    function isBusy() { return busy; }
    function getState() {
        return {
            busy: busy,
            operationId: activeOperationId,
            compileOperationId: compileOperationId,
            diagnostics: lastDiagnostics.slice()
        };
    }

    function onChange(listener) {
        if (typeof listener !== 'function') return;
        listeners.push(listener);
    }

    function emit() {
        var state = getState();
        listeners.forEach(function(listener) {
            try { listener(state); } catch (error) { /* 監聽器錯誤不得影響作業 */ }
        });
    }

    function setBusy(next, operationId) {
        busy = Boolean(next);
        activeOperationId = operationId || null;
        if (!busy) compileOperationId = null;
        emit();
    }

    function store() {
        if (context && context.store) return context.store;
        return project() ? project() : null;
    }

    function currentMeta() {
        var stateStore = store();
        if (!stateStore || typeof stateStore.getState !== 'function') return {};
        var state = stateStore.getState();
        return (state && state.meta) || {};
    }

    function projectName(state) {
        if (state && state.name) return state.name;
        var meta = currentMeta();
        return meta.name || 'sketch';
    }

    // ---------------------------------------------------------------
    // 診斷 → 程式碼面板
    // ---------------------------------------------------------------

    /// 清除先前的診斷標記。
    function clearDiagnosticMarks() {
        var nodes = document.querySelectorAll('.code-line.diag-error, .code-line.diag-warning, .code-line.diag-note');
        Array.prototype.forEach.call(nodes, function(node) {
            node.classList.remove('diag-error', 'diag-warning', 'diag-note');
        });
    }

    /// 把診斷標記到程式碼面板的對應行。
    ///
    /// `inoFileName` 是後端回報的草稿檔名（例如 `Blink.ino`）；只有檔名相同
    /// 的診斷才標記 —— 函式庫核心檔的警告與使用者程式碼無關，標記了只會誤導。
    /// 後端的 `line` 是 1-based，DOM 的 `data-line-index` 是 0-based。
    function applyDiagnostics(inoFileName, diagnostics) {
        clearDiagnosticMarks();
        if (!inoFileName || !Array.isArray(diagnostics)) return 0;
        var marked = 0;
        diagnostics.forEach(function(diagnostic) {
            if (!diagnostic || diagnostic.file !== inoFileName) return;
            var index = Number(diagnostic.line) - 1;
            if (isNaN(index) || index < 0) return;
            var node = document.querySelector('.code-line[data-line-index="' + index + '"]');
            if (!node) return;
            var className = diagnostic.severity === 'warning'
                ? 'diag-warning'
                : (diagnostic.severity === 'note' ? 'diag-note' : 'diag-error');
            node.classList.add(className);
            node.setAttribute('title', diagnostic.message || '');
            marked += 1;
            if (marked === 1) {
                if (typeof node.scrollIntoView === 'function') {
                    node.scrollIntoView({ block: 'center' });
                }
            }
        });
        return marked;
    }

    function severityKind(severity) {
        if (severity === 'warning') return 'warn';
        if (severity === 'note') return 'info';
        return 'error';
    }

    /// 附加一行編譯診斷到終端機。
    function appendDiagnostic(diagnostic) {
        if (!terminal() || !diagnostic) return;
        var line = diagnostic.file + ':' + diagnostic.line + ':' + (diagnostic.column || 0) +
            ' ' + diagnostic.message;
        terminal().append(line, severityKind(diagnostic.severity));
    }


    // ---------------------------------------------------------------
    // 事件處理
    // ---------------------------------------------------------------

    /// 判斷事件是否屬於本次流程。
    ///
    /// 後端可能同時在跑其他作業（例如安裝開發板核心），那些事件不該被畫進
    /// 終端機或標到程式碼面板。事件未帶 `operationId` 時一律視為相關
    /// （後端某些推播不帶識別），由呼叫端自行判斷。
    function isOwnOperation(eventOperationId) {
        if (!eventOperationId) return true;
        return eventOperationId === activeOperationId || eventOperationId === compileOperationId;
    }

    /// 處理 `codebridge://operation-status`：把後端推播的進度附加到終端機。
    function handleOperationStatus(payload) {
        if (!payload) return;
        if (!isOwnOperation(payload.operationId)) return;
        if (payload.lastLine && terminal()) {
            terminal().append(payload.lastLine, payload.state === 'failed' ? 'error' : 'info');
        }
        if (payload.state === 'succeeded' && payload.message) {
            toast(payload.kindLabel || 'CLI_OPERATION_SUCCEEDED', payload.message, 'success');
        } else if (payload.state === 'failed' && payload.message) {
            reportError('CLI_ERROR_COMPILE_FAILED', payload.message);
        }
    }

    /// 處理 `codebridge://compile-diagnostics`：標記程式碼面板並結束 busy 狀態。
    function handleCompileDiagnostics(payload) {
        if (!payload) return;
        if (!isOwnOperation(payload.operationId)) return;
        lastDiagnostics = Array.isArray(payload.diagnostics) ? payload.diagnostics.slice() : [];
        applyDiagnostics(payload.inoFileName, lastDiagnostics);
        lastDiagnostics.forEach(appendDiagnostic);
        setBusy(false, null);
    }

    // ---------------------------------------------------------------
    // 執行流程
    // ---------------------------------------------------------------

    /// 執行編譯；成功後若有序列埠則接著上傳。
    function run() {
        if (busy) return Promise.resolve(false);
        if (!bridge() || !bridge().isAvailable()) {
            toast('MSG_DESKTOP_REQUIRED', '編譯與上傳僅桌面版可用', 'error');
            return Promise.resolve(false);
        }

        var stateStore = store();
        var state = stateStore && stateStore.getState ? stateStore.getState() : {};
        var meta = currentMeta();
        var fqbn = meta.fqbn || '';
        var port = meta.port || '';

        if (!fqbn) {
            reportError('CLI_ERROR_NO_FQBN', '請先選擇開發板');
            return Promise.resolve(false);
        }

        var code = currentCode();
        if (!code || code.trim() === '') {
            reportError('DRAFT_ERROR_EMPTY_CODE', '工作區沒有可編譯的程式碼');
            return Promise.resolve(false);
        }

        if (terminal()) {
            terminal().open();
            terminal().appendMessage('CLI_COMPILE_STARTING', '開始編譯 %1…', [projectName(state)], 'command');
        }
        setBusy(true, null);

        var payload = {
            projectId: resolveProjectId(state),
            projectName: projectName(state),
            fqbn: fqbn,
            // 送出 plain code：marker 不得寫入磁碟，且行號契約依賴它。
            code: plainCode() ? plainCode().strip(code) : code,
            clean: false
        };

        return bridge().invoke('compile_start', payload).then(function(operationId) {
            activeOperationId = operationId;
            compileOperationId = operationId;
            return bridge().invoke('upload_ready', {
                projectId: payload.projectId,
                fqbn: fqbn
            });
        }).then(function(ready) {
            if (!ready) {
                // 沒有可用的編譯結果：等 compile-diagnostics 事件收尾即可。
                return false;
            }
            if (!port) {
                reportError('CLI_ERROR_NO_PORT', '尚未選擇序列埠');
                return false;
            }
            return upload();
        }).catch(function(error) {
            var described = bridge().describeError(error);
            reportError(described.key, described.detail);
            setBusy(false, null);
            return false;
        });
    }

    /// 上傳最近一次編譯結果。
    function upload() {
        var stateStore = store();
        var state = stateStore && stateStore.getState ? stateStore.getState() : {};
        var meta = currentMeta();
        var fqbn = meta.fqbn || '';
        var port = meta.port || '';

        if (!fqbn) {
            reportError('CLI_ERROR_NO_FQBN', '請先選擇開發板');
            return Promise.resolve(false);
        }
        if (!port) {
            reportError('CLI_ERROR_NO_PORT', '請先選擇序列埠');
            return Promise.resolve(false);
        }
        if (terminal()) {
            terminal().appendMessage('CLI_UPLOAD_STARTING', '開始上傳到 %1…', [port], 'command');
        }

        return bridge().invoke('upload_start', {
            projectId: resolveProjectId(state),
            fqbn: fqbn,
            port: port
        }).then(function(operationId) {
            activeOperationId = operationId;
            return true;
        }).catch(function(error) {
            var described = bridge().describeError(error);
            reportError(described.key, described.detail);
            setBusy(false, null);
            return false;
        });
    }

    /// 取消目前作業（等於「停止」按鈕的語意）。
    function stop() {
        if (!busy || !activeOperationId) return Promise.resolve(false);
        if (!bridge() || !bridge().isAvailable()) return Promise.resolve(false);
        var id = activeOperationId;
        return bridge().invoke('operation_cancel', { id: id }).then(function(cancelled) {
            if (cancelled && terminal()) {
                terminal().appendMessage('CLI_OPERATION_CANCELLED', '已取消 %1', [id], 'warn');
            }
            return cancelled;
        }).catch(function() { return false; });
    }

    // ---------------------------------------------------------------
    // 初始化
    // ---------------------------------------------------------------

    /// 訂閱後端事件並清掉前一次的診斷標記。
    function init(options) {
        context = options || {};
        clearDiagnosticMarks();
        if (terminal()) {
            terminal().init();
            terminal().onChange(function() { emit(); });
        }
        if (!bridge() || !bridge().isAvailable()) return getState();
        bridge().listen(EVENTS.OPERATION_STATUS, handleOperationStatus);
        bridge().listen(EVENTS.COMPILE_DIAGNOSTICS, handleCompileDiagnostics);
        return getState();
    }

    return {
        EVENTS: EVENTS,
        UNSAVED_PROJECT_ID: UNSAVED_PROJECT_ID,
        MAX_PROJECT_ID_LENGTH: MAX_PROJECT_ID_LENGTH,
        init: init,
        run: run,
        upload: upload,
        stop: stop,
        isBusy: isBusy,
        getState: getState,
        onChange: onChange,
        resolveProjectId: resolveProjectId,
        applyDiagnostics: applyDiagnostics,
        clearDiagnosticMarks: clearDiagnosticMarks,
        handleOperationStatus: handleOperationStatus,
        handleCompileDiagnostics: handleCompileDiagnostics,
        /// 僅供單元測試重置模組狀態。
        _reset: function() {
            context = null;
            busy = false;
            activeOperationId = null;
            compileOperationId = null;
            lastDiagnostics = [];
            listeners = [];
        }
    };
})();

if (typeof window !== 'undefined') {
    window.CodeBridgeCompile = CodeBridgeCompile;
}
