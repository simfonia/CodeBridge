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

    /// 等待編譯完成後要執行的上傳前置參數；`null` 表示目前不接續上傳。
    ///
    /// **為什麼需要等待**：`compile_start` 是 `spawn_blocking`，**立即**回傳 op id，
    /// 但後端的 `last_builds` 要等編譯**成功結束**才寫入。若 `run()` 在收到
    /// op id 後立刻查 `upload_ready`，必然查不到而得到 `false` ——
    /// 使用者只會看到「編譯成功」卻沒有上傳，且沒有任何錯誤訊息。
    ///
    /// 事件順序（後端保證）：先 `operation-status`（build 已寫入）、
    /// 後 `compile-diagnostics`，因此在 `succeeded` 事件觸發上傳是安全的。
    var pendingUpload = null;

    /// 上傳是否已啟動（此時 busy 歸上傳流程所有）。
    ///
    /// 與 `pendingUpload` 分開是必要的：`handleOperationStatus` 一觸發上傳就會清空
    /// `pendingUpload`，若用同一個旗標判斷，`compile-diagnostics` 抵達時會誤以為
    /// 「沒有待續上傳」而解除 busy —— 但這時 avrdude 還在燒錄。
    var uploading = false;

    /// 上傳作業的識別；只有收到**這個 id** 的終態事件才算上傳結束。
    ///
    /// **為什麼不能用 `uploading` 布林值判斷**：`proceedToUpload` 必須在呼叫
    /// `upload_ready` 之前就設 `uploading = true`（避免期間被解除 busy），
    /// 這段時間裡 `upload_start` 還沒送出、也還沒有作業 id。若編譯的
    /// succeeded 事件重複抵達（後端節流 flush + 最終送出各一次），
    /// `uploading && succeeded` 就會**誤判為上傳結束** —— 症狀是
    /// 「上傳成功」出現在「開始上傳到 COM4」之前。
    var uploadOperationId = null;

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

    /// 目前使用者選擇的裝置（序列埠 + 開發板）。
    ///
    /// **一律取自 `board-detector`，不讀專案 metadata**（2026-09-28 決策）：
    /// 序列埠與開發板描述的是「使用者身邊的硬體」，不是專案內容。
    /// metadata 可能過期（啟動快照、下拉已換埠），曾造成
    /// 「UI 顯示 COM4 但上傳報尚未選擇序列埠」的實際 bug。
    /// 下拉是使用者眼前的真相 —— 燒到他看到的埠。
    ///
    /// `board-detector` 缺席時（例如純單元測試）退回 metadata，
    /// 避免一次重構讓所有既有測試失效。
    function currentDevice() {
        var detector = boardDetector();
        if (detector && typeof detector.getState === 'function') {
            var state = detector.getState() || {};
            return { port: state.port || '', fqbn: state.fqbn || '' };
        }
        var meta = currentMeta();
        return { port: meta.port || '', fqbn: meta.fqbn || '' };
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

    /// 取出事件自帶的作業識別。
    ///
    /// **後端對同一個事件名稱送了兩種 payload，欄位名不同**：
    /// - `OperationProgress`（節流 flush）→ 欄位 `operationId`
    /// - `OperationStatus`（作業結束）→ 欄位 **`id`**
    ///
    /// 只讀其中一個會漏掉另一種：早期只讀 `operationId` 時，上傳結束事件
    /// 帶的是 `id`，比對永遠失敗 →「上傳成功」從不顯示。
    function eventOperationId(payload) {
        if (!payload) return null;
        return payload.operationId || payload.id || null;
    }

    /// 判斷事件是否屬於本次流程。
    ///
    /// 後端可能同時在跑其他作業（例如安裝開發板核心），那些事件不該被畫進
    /// 終端機或標到程式碼面板。事件未帶 `operationId` 時一律視為相關
    /// （後端某些推播不帶識別），由呼叫端自行判斷。
    function isOwnOperation(id) {
        if (!id) return true;
        return id === activeOperationId || id === compileOperationId || id === uploadOperationId;
    }

    /// 處理 `codebridge://operation-status`：把後端推播的進度附加到終端機。
    ///
    /// 後端以 `lines` 送出「一次 flush 內累積的所有行」——節流期間的行不可丟棄，
    /// 否則終端機只會看到零星幾行，gcc 錯誤訊息大多落在被丟棄的區段。
    /// 同時保留對舊 `lastLine` 欄位的相容（單行 payload）。
    function handleOperationStatus(payload) {
        if (!payload) return;
        var eventId = eventOperationId(payload);
        if (!isOwnOperation(eventId)) return;
        if (terminal()) {
            var lines = Array.isArray(payload.lines) ? payload.lines : [];
            lines.forEach(function(line) {
                if (!line || !line.text) return;
                // stderr 是編譯器／avrdude 的進度與錯誤，一律以 error 樣式呈現。
                terminal().append(line.text, line.stream === 'stderr' ? 'error' : 'info');
            });
            if (lines.length === 0 && payload.lastLine) {
                terminal().append(payload.lastLine, payload.state === 'failed' ? 'error' : 'info');
            }
        }
        if (payload.state === 'succeeded' && payload.message) {
            toast(payload.kindLabel || 'CLI_OPERATION_SUCCEEDED', payload.message, 'success');
        } else if (payload.state === 'failed' && payload.message) {
            reportError('CLI_ERROR_COMPILE_FAILED', payload.message);
        }

        // 編譯成功後接續上傳。此時後端已把 build 寫入 `last_builds`
        // （`builds.insert` 在 emit 之前），因此 `upload_ready` 查得到。
        if (payload.state === 'succeeded' && pendingUpload) {
            var request = pendingUpload;
            pendingUpload = null;
            proceedToUpload(request);
            return;
        }

        if (payload.state === 'failed' || payload.state === 'cancelled') {
            // 編譯沒成功就不該上傳，清掉意圖避免之後誤觸。
            pendingUpload = null;
        }

        // 上傳作業收尾：解除 busy 與 `uploading`。
        //
        // 沒有這段的話 `uploading` 永遠停在 true、busy 永遠維持，
        // 使用者第二次按「執行」會被 `if (busy) return false` 靜默擋下，
        // 症狀是「第一次上傳成功，之後按上傳完全沒反應」。
        //
        // 判斷條件用 `uploading` 而非 `kind`：編譯的終態事件此時 `uploading`
        // 仍為 false（`proceedToUpload` 已在上面的分支接手），因此不會誤觸。
        if (uploading && uploadOperationId &&
            eventId === uploadOperationId && isTerminalState(payload.state)) {
            uploading = false;
            uploadOperationId = null;
            stopUploadHeartbeat();
            if (payload.state === 'succeeded') {
                // 明確的成功回饋：只有 CLI 原始輸出（"New upload port: ..."）
                // 使用者分不出成功還是失敗。
                if (terminal()) {
                    terminal().appendMessage('CLI_UPLOAD_SUCCESS', '上傳成功', [], 'command');
                }
                toast('CLI_UPLOAD_SUCCESS', '上傳成功', 'success');
            }
            setBusy(false, null);
        }
    }

    /// 作業是否已進入終態。
    function isTerminalState(state) {
        return state === 'succeeded' || state === 'failed' || state === 'cancelled';
    }

    /// 處理 `codebridge://compile-diagnostics`：標記程式碼面板並結束 busy 狀態。
    function handleCompileDiagnostics(payload) {
        if (!payload) return;
        if (!isOwnOperation(eventOperationId(payload))) return;
        lastDiagnostics = Array.isArray(payload.diagnostics) ? payload.diagnostics.slice() : [];
        applyDiagnostics(payload.inoFileName, lastDiagnostics);
        lastDiagnostics.forEach(appendDiagnostic);
        // 事件順序是 operation-status → compile-diagnostics。若這裡無條件
        // setBusy(false)，會在「上傳已啟動但尚未結束」時解除 busy ——
        // 執行按鈕恢復可用、使用者以為流程結束，而 avrdude 還在燒錄。
        // 有待續的上傳時由上傳流程負責收尾。
        if (!pendingUpload && !uploading) setBusy(false, null);
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
        // Device state comes from the dropdown the user is looking at, not metadata.
        var device = currentDevice();
        var fqbn = device.fqbn;
        var port = device.port;

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
            // 每次執行前清空上一輪的輸出。
            //
            // 不清的話，第二次執行時畫面上方還留著上一輪的「上傳成功」，
            // 與本輪的編譯輸出交錯在一起，讀起來像訊息順序錯亂。
            // 使用者要的是「這一輪發生了什麼」，不是「到目前為止的所有紀錄」——
            // 需要歷史紀錄時終端機本來就有捲動緩衝。
            terminal().clear();
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

        // **必須包成 `{ payload: {...} }`**：Rust 端簽名是
        // `compile_start(payload: CompilePayload)`，Tauri 依「參數名」取值，
        // 傳扁平物件會得到 `missing required key payload`。
        // 注意 `upload_ready(state, project_id, fqbn)` 是兩個獨立參數、
        // 非 struct，因此那裡**維持扁平**、不可跟著包裝。
        return bridge().invoke('compile_start', { payload: payload }).then(function(operationId) {
            activeOperationId = operationId;
            compileOperationId = operationId;
            // **不在這裡查 upload_ready**：編譯是背景作業，此刻 `last_builds`
            // 還是空的。記下意圖，等 `operation-status: succeeded` 再接續上傳。
            pendingUpload = { projectId: payload.projectId, fqbn: fqbn, port: port };
            return true;
        }).catch(function(error) {
            pendingUpload = null;
            var described = bridge().describeError(error);
            reportError(described.key, described.detail);
            setBusy(false, null);
            return false;
        });
    }

    /// 編譯成功後接續上傳（由 `handleOperationStatus` 在 succeeded 時觸發）。
    function proceedToUpload(request) {
        uploading = true;
        // 上一輪的 id 不能残留，否則新作業的事件會被誤判。
        uploadOperationId = null;
        return bridge().invoke('upload_ready', {
            projectId: request.projectId,
            fqbn: request.fqbn
        }).then(function(ready) {
            if (!ready) {
                // 不可靜默結束：使用者只看到「編譯成功」時會以為整個流程成功了。
                reportError('CLI_ERROR_BUILD_STALE', '編譯結果已失效，請重新編譯');
                return false;
            }
            if (!request.port) {
                reportError('CLI_ERROR_NO_PORT', '尚未選擇序列埠');
                return false;
            }
            return upload();
        }).catch(function(error) {
            var described = bridge().describeError(error);
            reportError(described.key, described.detail);
            return false;
        }).then(function(result) {
            if (!result) {
                uploading = false;
                setBusy(false, null);
            }
            return result;
        });
    }

    function boardDetector() { return window.CodeBridgeBoardDetector; }

    /// 上傳最近一次編譯結果。
    function upload() {
        var stateStore = store();
        var state = stateStore && stateStore.getState ? stateStore.getState() : {};
        // 裝置狀態取自使用者眼前的下拉，不讀 metadata（見 currentDevice）。
        var device = currentDevice();
        var fqbn = device.fqbn;
        var port = device.port;

        if (!fqbn) {
            reportError('CLI_ERROR_NO_FQBN', '請先選擇開發板');
            return Promise.resolve(false);
        }
        if (!port) {
            reportError('CLI_ERROR_NO_PORT', '請先選擇序列埠');
            return Promise.resolve(false);
        }
        if (terminal()) {
            terminal().appendMessage(
                'CLI_UPLOAD_STARTING',
                '開始上傳到 %1，請勿斷開連線',
                [port],
                'command'
            );
        }
        // 燒錄期間心跳：avrdude 可能長時間沒有輸出，
        // 畫面停在同一行會讓用戶分不清「還在燒」還是「卡住」。
        startUploadHeartbeat();
        return doUpload(state, fqbn, port).then(function(result) {
            // 不在這裡停心跳：`doUpload` 只等到 `upload_start` 回傳作業 id
            //（燒錄在背景進行），實際燒錄還要數秒。
            // 真正的收尾在 `handleOperationStatus` 收到上傳終態事件時。
            // 只有命令本身失敗才立即停止。
            if (!result) stopUploadHeartbeat();
            return result;
        }, function(error) {
            stopUploadHeartbeat();
            throw error;
        });
    }

    /// 上傳心跳的間隔（毫秒）。
    var UPLOAD_HEARTBEAT_MS = 1000;
    /// 心跳計時器；`null` 表示未啟動。
    var uploadHeartbeat = null;

    function startUploadHeartbeat() {
        stopUploadHeartbeat();
        if (typeof setInterval !== 'function') return;
        uploadHeartbeat = setInterval(function() {
            if (terminal() && terminal().appendToLast) terminal().appendToLast('.');
        }, UPLOAD_HEARTBEAT_MS);
    }

    function stopUploadHeartbeat() {
        if (uploadHeartbeat === null) return;
        clearInterval(uploadHeartbeat);
        uploadHeartbeat = null;
    }

    /// 實際送出 upload_start（已通過板子確認）。
    function doUpload(state, fqbn, port) {
        // 與 `compile_start` 同理：Rust 簽名是 `upload_start(payload: UploadPayload)`，
        // 必須包成 `{ payload: {...} }`。
        return bridge().invoke('upload_start', {
            payload: {
                projectId: resolveProjectId(state),
                fqbn: fqbn,
                port: port
            }
        }).then(function(operationId) {
            activeOperationId = operationId;
            // 記錄上傳作業的 id：只有收到這個 id 的終態事件
            // 才算上傳結束（見 uploadOperationId 註明）。
            uploadOperationId = operationId;
            return true;
        }).catch(function(error) {
            var described = bridge().describeError(error);
            reportError(described.key, described.detail);
            setBusy(false, null);
            return false;
        });
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
        // `stop` 已於 2026-09-27 移除（作業已有逾時上限）。
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
