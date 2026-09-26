/// CodeBridge Tauri IPC 橋接層
/// 職責：封裝 Tauri v2 呼叫、檔案選擇對話框、錯誤正規化與環境降級。
/// 位置：ui/src/lib/tauri/bridge.js
///
/// 設計要點：
/// - 前端全部是 classic script，因此不使用 ESM import；
///   透過 tauri.conf.json 的 `app.withGlobalTauri` 使用 window.__TAURI__。
/// - 純瀏覽器環境（Vite dev server、Playwright 測試）沒有 Tauri runtime，
///   `isAvailable()` 回 false，呼叫端必須自行降級為 disabled 或提示。
/// - Rust command 的錯誤格式為 `KEY|detail`，此處拆解為
///   { key, detail }，讓 UI 以 i18n key 顯示可翻譯訊息。

var CodeBridgeTauri = (function() {
    'use strict';

    var PROJECT_FILTER = { name: 'CodeBridge Project', extensions: ['cbg'] };

    function api() {
        return (typeof window !== 'undefined' && window.__TAURI__) || null;
    }

    function isAvailable() {
        var runtime = api();
        return Boolean(runtime && runtime.core && typeof runtime.core.invoke === 'function');
    }

    /// 將 Rust 回傳的字串錯誤拆解為 i18n key 與補充說明。
    function describeError(error) {
        if (!error) return { key: 'MSG_UNKNOWN_ERROR', detail: '' };
        var text = typeof error === 'string' ? error : (error.message || String(error));
        var separator = text.indexOf('|');
        if (separator === -1) return { key: text || 'MSG_UNKNOWN_ERROR', detail: '' };
        return {
            key: text.slice(0, separator),
            detail: text.slice(separator + 1)
        };
    }

    function errorMessageKey(error) {
        return describeError(error).key;
    }

    function invoke(command, args) {
        if (!isAvailable()) {
            return Promise.reject(new Error('TAURI_UNAVAILABLE|' + command));
        }
        return window.__TAURI__.core.invoke(command, args || {});
    }

    /// 開啟「開啟專案」對話框；使用者取消時回傳 null。
    function pickProjectToOpen() {
        if (!isAvailable() || !window.__TAURI__.dialog) {
            return Promise.reject(new Error('TAURI_UNAVAILABLE|dialog.open'));
        }
        return window.__TAURI__.dialog.open({
            multiple: false,
            directory: false,
            filters: [PROJECT_FILTER]
        }).catch(function() { return null; });
    }

    /// 開啟「另存新檔」對話框；使用者取消時回傳 null。
    function pickProjectSavePath(defaultName) {
        if (!isAvailable() || !window.__TAURI__.dialog) {
            return Promise.reject(new Error('TAURI_UNAVAILABLE|dialog.save'));
        }
        return window.__TAURI__.dialog.save({
            filters: [PROJECT_FILTER],
            defaultPath: (defaultName || 'untitled') + '.cbg'
        }).catch(function() { return null; });
    }

    /// 監聽 Rust 端事件（例如視窗關閉前請示是否儲存）。
    function listen(eventName, handler) {
        if (!isAvailable() || !window.__TAURI__.event) {
            return Promise.resolve(function() {});
        }
        return window.__TAURI__.event.listen(eventName, function(event) {
            handler(event && event.payload);
        });
    }

    return {
        PROJECT_FILTER: PROJECT_FILTER,
        isAvailable: isAvailable,
        invoke: invoke,
        describeError: describeError,
        errorMessageKey: errorMessageKey,
        pickProjectToOpen: pickProjectToOpen,
        pickProjectSavePath: pickProjectSavePath,
        listen: listen
    };
})();

if (typeof window !== 'undefined') {
    window.CodeBridgeTauri = CodeBridgeTauri;
}
