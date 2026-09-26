/// CodeBridge 確認對話框
/// 職責：以自訂 overlay 提供確認／取消，以及未儲存變更的三選一流程。
/// 位置：ui/src/lib/ui/confirm-dialog.js
///
/// 為什麼不用 window.confirm：
/// - 無法翻譯（各作業系統語系不一致），也無法配合 Engineer／Angel 主題。
/// - 未儲存變更需要三個按鈕（儲存／不儲存／取消），原生 confirm 只有兩鍵。

var CodeBridgeConfirm = (function() {
    'use strict';

    var pendingResolve = null;

    function text(key, fallback) {
        if (typeof getI18n === 'function') return getI18n(key, fallback);
        return fallback || key;
    }

    function ensureOverlay() {
        var overlay = document.getElementById('codebridge-confirm');
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.id = 'codebridge-confirm';
        overlay.className = 'cb-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.hidden = true;
        overlay.innerHTML =
            '<div class="cb-dialog">' +
            '  <div class="cb-dialog-title" id="cb-dialog-title"></div>' +
            '  <div class="cb-dialog-message" id="cb-dialog-message"></div>' +
            '  <div class="cb-dialog-actions" id="cb-dialog-actions"></div>' +
            '</div>';
        document.body.appendChild(overlay);

        overlay.addEventListener('click', function(event) {
            // 點擊遮罩等同取消，避免使用者卡在對話框
            if (event.target === overlay) settle(null);
        });
        return overlay;
    }

    function settle(value) {
        var overlay = document.getElementById('codebridge-confirm');
        if (overlay) overlay.hidden = true;
        var resolve = pendingResolve;
        pendingResolve = null;
        if (resolve) resolve(value);
    }

    /// 顯示對話框；`options` 為 [{ value, labelKey, variant }]。
    function ask(details) {
        var config = details || {};
        var overlay = ensureOverlay();
        var titleElement = document.getElementById('cb-dialog-title');
        var messageElement = document.getElementById('cb-dialog-message');
        var actionsElement = document.getElementById('cb-dialog-actions');

        titleElement.textContent = text(config.titleKey, config.title || '');
        messageElement.textContent = config.message || text(config.messageKey, config.messageKey || '');
        actionsElement.innerHTML = '';

        (config.options || []).forEach(function(option) {
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'cb-dialog-button' + (option.variant ? ' is-' + option.variant : '');
            button.textContent = text(option.labelKey, option.label || option.value);
            button.addEventListener('click', function() { settle(option.value); });
            actionsElement.appendChild(button);
        });

        document.addEventListener('keydown', onKeyDown);
        overlay.hidden = false;
        var firstButton = actionsElement.querySelector('button');
        if (firstButton) firstButton.focus();

        return new Promise(function(resolve) { pendingResolve = resolve; });
    }

    function onKeyDown(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            settle(null);
            document.removeEventListener('keydown', onKeyDown);
        }
    }

    /// 未儲存變更確認：'save' | 'discard' | null（取消）。
    function askUnsaved(projectName) {
        var base = text('MSG_SAVE_CHANGES', 'Save the current changes first?');
        return ask({
            titleKey: 'TLB_UNSAVED_TITLE',
            message: projectName ? base + '（' + projectName + '）' : base,
            options: [
                { value: 'save', labelKey: 'MSG_SAVE', variant: 'primary' },
                { value: 'discard', labelKey: 'MSG_DONT_SAVE' },
                { value: null, labelKey: 'MSG_CANCEL' }
            ]
        });
    }

    return {
        ask: ask,
        askUnsaved: askUnsaved,
        close: function() { settle(null); }
    };
})();

if (typeof window !== 'undefined') {
    window.CodeBridgeConfirm = CodeBridgeConfirm;
}
