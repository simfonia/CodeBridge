/// CodeBridge 開發板核心（board core）管理
/// 職責：搜尋與安裝可用的 board core，讓首次使用者不必手動設定 CLI。
/// 位置：ui/src/lib/arduino/core.js
///
/// 為什麼需要這個模組：CodeBridge 刻意與使用者的 Arduino IDE **完全隔離**
/// （避免污染 `%LOCALAPPDATA%\Arduino15`）。代價是使用者即使已在自己電腦上
/// 裝好核心，CodeBridge 也看不到 —— 首次開啟時板子清單會是空的。
/// 若沒有安裝入口，使用者會卡在「找不到開發板」而無從解決。

var CodeBridgeCore = (function() {
    'use strict';

    /// 搜尋時優先顯示的核心（依高中生常見程度排序）。
    var RECOMMENDED = [
        'arduino:avr',
        'esp32:esp32',
        'rp2040:rp2040',
        'arduino:mbed_nano',
        'arduino:samd'
    ];

    function bridge() { return window.CodeBridgeTauri; }

    function text(key, fallback) {
        if (typeof getI18n === 'function') return getI18n(key, fallback);
        return fallback || key;
    }

    /// 已安裝的核心。
    function list() {
        if (!bridge() || !bridge().isAvailable()) return Promise.resolve([]);
        return bridge().invoke('core_list').then(function(result) {
            return (result && Array.isArray(result.platforms)) ? result.platforms : [];
        }).catch(function() { return []; });
    }

    /// 搜尋可安裝的核心；已安裝的以 `installed` 標記。
    function search(term) {
        if (!bridge() || !bridge().isAvailable()) return Promise.resolve([]);
        return Promise.all([list(), searchAll(term)]).then(function(results) {
            var installed = {};
            results[0].forEach(function(item) {
                if (item && item.id) installed[item.id] = item;
            });
            return results[1].map(function(item) {
                return {
                    id: item.id,
                    name: item.name,
                    version: item.version,
                    installed: Boolean(installed[item.id]),
                    recommended: RECOMMENDED.indexOf(item.id) !== -1
                };
            });
        });
    }

    /// 呼叫後端搜尋（失敗時回空清單，不阻擋 UI）。
    function searchAll(term) {
        return bridge().invoke('core_search', { term: term || '' }).then(function(result) {
            return (result && Array.isArray(result.platforms)) ? result.platforms : [];
        }).catch(function() { return []; });
    }

    /// 安裝核心。
    ///
    /// `core install` 會下載數百 MB，因此**不可**設短逾時；後端用一般查詢
    /// 逾時（60 秒），實際上多數核心在 1–3 分鐘內完成。
    function install(id) {
        if (!bridge() || !bridge().isAvailable()) {
            return Promise.reject(new Error('TAURI_UNAVAILABLE|core_install'));
        }
        return bridge().invoke('core_install', { package: id });
    }

    return {
        RECOMMENDED: RECOMMENDED,
        list: list,
        search: search,
        install: install,
        displayName: function(item) {
            if (!item) return '';
            return item.name + '（' + item.id + '）';
        },
        describeError: function(error) {
            return text('CLI_ERROR_COMMAND_FAILED', '安裝核心失敗');
        }
    };
})();

if (typeof window !== 'undefined') {
    window.CodeBridgeCore = CodeBridgeCore;
}
