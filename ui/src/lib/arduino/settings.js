/// CodeBridge 設定中心（進階 › 路徑）
/// 職責：讀寫路徑設定，並把「當前生效值 + 來源」呈現給使用者。
/// 位置：ui/src/lib/arduino/settings.js
///
/// 設計要點：
/// - **只送使用者真正更動的欄位**。後端把 `None` 解讀為「沿用現有」，
///   若前端把沒碰過的欄位送成 undefined 會變成 null，等於默默清掉設定。
/// - **畫面顯示後端回報的結果**，不是前端自己算的值：隔離目錄的實際
///   路徑只有後端知道，前端猜出來只會讓使用者看到一個不存在的目錄。
/// - 無 Tauri runtime（Vite dev server、Playwright）時降級為 null，
///   絕不拋錯 —— 設定中心只是輔助功能，不該讓整個 UI 崩潰。

var CodeBridgeSettings = (function() {
    'use strict';

    var lastReport = null;
    var opened = false;
    var overlay = null;

    function text(key, fallback) {
        if (typeof getI18n === 'function') return getI18n(key, fallback);
        return fallback || key;
    }

    /// Toast 通道；沿用 `CodeBridgeToast.show(msg, { type })` 的既有 API。
    function notify(message, type) {
        var sink = toasts();
        if (!sink || typeof sink.show !== 'function') return;
        sink.show(message, { type: type || 'info' });
    }

    function toasts() {
        return (typeof window !== 'undefined' && window.CodeBridgeToast) || null;
    }

    function bridge() {
        return (typeof window !== 'undefined' && window.CodeBridgeTauri) || null;
    }

    function available() {
        var api = bridge();
        return Boolean(api && typeof api.isAvailable === 'function' && api.isAvailable());
    }

    /// 後端的來源值 → i18n key。
    ///
    /// 未知值回退到 `systemDefault` 而非拋錯：後端新增一種來源時，
    /// 舊版前端不該整個設定頁開不起來。
    var SOURCE_KEYS = {
        systemDefault: 'DIR_SOURCE_SYSTEM_DEFAULT',
        appIsolated: 'DIR_SOURCE_APP_ISOLATED',
        userConfigured: 'DIR_SOURCE_USER_CONFIGURED'
    };

    function sourceKey(source) {
        return SOURCE_KEYS[source] || SOURCE_KEYS.systemDefault;
    }

    function describeError(error) {
        var api = bridge();
        if (api && typeof api.describeError === 'function') return api.describeError(error);
        var raw = typeof error === 'string' ? error : (error && error.message) || String(error || '');
        var separator = raw.indexOf('|');
        return separator === -1
            ? { key: raw || 'MSG_UNKNOWN_ERROR', detail: '' }
            : { key: raw.slice(0, separator), detail: raw.slice(separator + 1) };
    }

    function reportError(error) {
        var parts = describeError(error);
        var message = text(parts.key, parts.key);
        if (parts.detail) message += '（' + parts.detail + '）';
        notify(message, 'error');
        return message;
    }

    /// 讀取目前生效的所有路徑。
    function load() {
        var api = bridge();
        if (!available()) return Promise.resolve(null);
        return api.invoke('toolchain_get_dirs').then(function (report) {
            lastReport = report;
            if (typeof render === 'function') render(report);
            return report;
        }).catch(function (error) {
            reportError(error);
            return null;
        });
    }

    /// 寫入路徑設定。
    ///
    /// `changes` 中**不存在**的鍵代表「使用者沒動它」，一律不送；
    /// 空字串則是明確的「清除」（CLI 改回系統 PATH、產物目錄回預設）。
    function save(changes) {
        var api = bridge();
        if (!available()) return Promise.resolve(null);
        var payload = {};
        var patch = changes || {};
        if (Object.prototype.hasOwnProperty.call(patch, 'cliPath')) payload.cliPath = patch.cliPath;
        if (Object.prototype.hasOwnProperty.call(patch, 'isolated')) payload.isolated = patch.isolated;
        if (Object.prototype.hasOwnProperty.call(patch, 'buildRoot')) payload.buildRoot = patch.buildRoot;

        // 沒有任何更動就不必呼叫後端 —— 否則會平白產生一次寫檔。
        if (!Object.keys(payload).length) return Promise.resolve(lastReport);

        return api.invoke('toolchain_set_dirs', payload).then(function (report) {
            lastReport = report;
            if (typeof render === 'function') render(report);
            notify(text('SETTINGS_SAVED', 'Settings saved'), 'success');
            return report;
        }).catch(function (error) {
            // 失敗時保留舊報告：畫面必須繼續顯示「實際生效的值」，
            // 而不是使用者剛輸入但根本沒生效的字串。
            reportError(error);
            if (typeof render === 'function') render(lastReport);
            return lastReport;
        });
    }

    function getReport() {
        return lastReport;
    }

    function isOpen() {
        return opened;
    }


    /// 設定對話框的 overlay；延遲建立，純邏輯單元測試不需要 DOM。
    function ensureOverlay() {
        if (overlay) return overlay;
        if (typeof document === 'undefined') return null;
        var existing = document.getElementById('codebridge-settings');
        if (existing) {
            overlay = existing;
            return overlay;
        }
        overlay = document.createElement('div');
        overlay.id = 'codebridge-settings';
        overlay.className = 'cb-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.hidden = true;
        overlay.innerHTML =
            '<div class="cb-dialog cb-settings-dialog">' +
            '  <div class="cb-dialog-title" id="cb-settings-title"></div>' +
            '  <div class="cb-dialog-body" id="cb-settings-body"></div>' +
            '  <div class="cb-dialog-actions" id="cb-settings-actions"></div>' +
            '</div>';
        if (document.body) document.body.appendChild(overlay);
        return overlay;
    }

    function escapeHtml(value) {
        return String(value === undefined || value === null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /// 一個「當前值 + 來源」欄位。
    ///
    /// 兩個資訊缺一不可：只給值，使用者會問「為什麼是這個」；
    /// 只給來源，使用者不知道實際指到哪。計畫文件決策四。
    function dirRow(id, label, entry) {
        var item = entry || { value: '', source: 'systemDefault' };
        return '<div class="cb-setting-row">' +
            '  <label class="cb-setting-label" for="' + id + '">' + escapeHtml(label) + '</label>' +
            '  <div class="cb-setting-value">' +
            '    <code class="cb-setting-path" id="' + id + '-value">' + escapeHtml(item.value) + '</code>' +
            '    <span class="cb-setting-source">' +
            escapeHtml(text(sourceKey(item.source), item.source)) + '</span>' +
            '  </div>' +
            '</div>';
    }

    /// 一個分區（標題 + 項目群）。
    ///
    /// **為什麼要分區**：五個目錄欄位若平鋪在同一層，使用者會以為它們是
    /// 五個同等重要的設定；分區後「工具鏈（共用／隔離）」與「產物（永遠隔離）」
    /// 這兩件性質完全不同的事在視覺上就分得開。
    function group(titleKey, fallback, rows) {
        return '<section class="cb-setting-group">' +
            '  <h2 class="cb-setting-group-title">' +
            escapeHtml(text(titleKey, fallback)) + '</h2>' +
            rows +
            '</section>';
    }

    /// 依報告重繪對話框內容。
    function render(report) {
        var root = ensureOverlay();
        if (!root || !report) return;
        var body = document.getElementById('cb-settings-body');
        if (!body) return;

        var title = document.getElementById('cb-settings-title');
        if (title) title.textContent = text('SETTINGS_TITLE', 'Settings — Paths');

        var cliPath = escapeHtml(report.cliPath || '');
        var cliHint = report.cliError
            ? text(report.cliError, report.cliError)
            : text('SETTINGS_CLI_HINT', 'Leave blank to use the system PATH.');

        body.innerHTML =
            group('SETTINGS_GROUP_TOOLCHAIN', 'Toolchain',
                '<div class="cb-setting-row">' +
                '  <label class="cb-setting-label" for="cb-setting-cli-path">' +
                escapeHtml(text('SETTINGS_CLI_PATH', 'Arduino CLI executable')) + '</label>' +
                '  <div class="cb-setting-value">' +
                '    <input type="text" id="cb-setting-cli-path" class="cb-setting-input"' +
                '      placeholder="' +
                escapeHtml(text('SETTINGS_CLI_PATH_PLACEHOLDER', 'Leave blank to use system PATH')) +
                '" value="' + cliPath + '">' +
                '    <span class="cb-setting-hint">' + escapeHtml(cliHint) + '</span>' +
                '  </div>' +
                '</div>' +
                dirRow('cb-setting-config', text('CLI_CONFIG_DIR', 'Config directory'), report.configDir) +
                dirRow('cb-setting-data', text('CLI_DATA_DIR', 'Data directory'), report.dataDir) +
                dirRow('cb-setting-user', text('CLI_USER_DIR', 'User directory'), report.userDir) +
                dirRow('cb-setting-downloads', text('CLI_DOWNLOADS_DIR', 'Downloads directory'), report.downloadsDir)
            ) +
            group('SETTINGS_GROUP_OUTPUT', 'Output',
                dirRow('cb-setting-build', text('SETTINGS_BUILD_ROOT', 'Build directory'), report.buildRoot) +
                '<div class="cb-setting-row cb-setting-switch">' +
                '  <label class="cb-setting-label" for="cb-setting-isolated">' +
                escapeHtml(text('SETTINGS_ISOLATED', 'Use CodeBridge-specific directories')) + '</label>' +
                '  <input type="checkbox" id="cb-setting-isolated"' + (report.isolated ? ' checked' : '') + '>' +
                '</div>' +
                '<p class="cb-setting-note">' +
                escapeHtml(text('SETTINGS_SHARED_NOTE',
                    'When sharing, cores you installed in the Arduino IDE are used here directly.')) +
                '</p>'
            ) +
            group('SETTINGS_GROUP_FILE', 'Settings file',
                '<p class="cb-setting-path-note"><code>' +
                escapeHtml(report.settingsPath) + '</code></p>');

        var actions = document.getElementById('cb-settings-actions');
        if (!actions || actions.childElementCount) return;
        var saveButton = document.createElement('button');
        saveButton.type = 'button';
        saveButton.className = 'cb-dialog-button is-primary';
        saveButton.id = 'cb-settings-save';
        saveButton.textContent = text('SETTINGS_SAVE', 'Save');
        saveButton.addEventListener('click', function () {
            var cliInput = document.getElementById('cb-setting-cli-path');
            var isolatedInput = document.getElementById('cb-setting-isolated');
            var current = lastReport || {};
            var nextCli = cliInput ? cliInput.value.trim() : '';
            var changes = { isolated: Boolean(isolatedInput && isolatedInput.checked) };
            // CLI 欄位沒變就不送：避免每次存檔都白寫一次設定檔。
            if (nextCli !== (current.cliPath || '')) changes.cliPath = nextCli;
            save(changes);
        });
        var closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'cb-dialog-button';
        closeButton.id = 'cb-settings-close';
        closeButton.textContent = text('MSG_CLOSE', 'Close');
        closeButton.addEventListener('click', function () { close(); });
        actions.appendChild(saveButton);
        actions.appendChild(closeButton);
    }

    function open() {
        opened = true;
        var root = ensureOverlay();
        if (root) root.hidden = false;
        // 每次開啟都重讀：設定可能已被手動編輯或其他視窗改過。
        return load();
    }

    function close() {
        opened = false;
        var root = ensureOverlay();
        if (root) root.hidden = true;
    }

    /// 綁定開啟入口。
    ///
    /// **不可動 `btn-settings-root` 的點擊行為**：那顆按鈕同時是
    /// `toolbar.js` 的 dropdown 觸發器，`stopPropagation()` 會讓下拉選單
    /// 整個失效（theme-runtime 有測試鎖住這條）。
    /// 因此入口放在選單項目「環境診斷」上 —— 診斷本來就是設定中心
    /// 「進階 › 診斷」的職責（見 todo「btn-diagnose 由設定中心承載」）。
    function init() {
        if (typeof document === 'undefined') return;
        var entry = document.getElementById('btn-diagnose');
        if (!entry || entry.dataset.settingsBound === '1') return;
        entry.dataset.settingsBound = '1';
        // 診斷資訊由設定中心提供，移除 disabled 否則永遠點不開。
        entry.removeAttribute('disabled');
        entry.removeAttribute('aria-disabled');
        entry.addEventListener('click', function () {
            open();
        });
    }

    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && opened) close();
        });
    }

    return {
        init: init,
        open: open,
        close: close,
        isOpen: isOpen,
        load: load,
        save: save,
        getReport: getReport,
        sourceKey: sourceKey
    };
})();

if (typeof window !== 'undefined') {
    window.CodeBridgeSettings = CodeBridgeSettings;
}
