/// CodeBridge Toast 提示
/// 職責：短暫顯示操作結果（已儲存、已複製、錯誤）。
/// 位置：ui/src/lib/ui/toast.js

var CodeBridgeToast = (function() {
    'use strict';

    var DEFAULT_DURATION = 2200;
    var currentTimer = null;

    function container() {
        var element = document.getElementById('codebridge-toast');
        if (!element) {
            element = document.createElement('div');
            element.id = 'codebridge-toast';
            element.className = 'cb-toast';
            element.setAttribute('role', 'status');
            element.hidden = true;
            document.body.appendChild(element);
        }
        return element;
    }

    function show(message, options) {
        var settings = options || {};
        var element = container();
        element.textContent = message;
        element.className = 'cb-toast' + (settings.type ? ' is-' + settings.type : '');
        element.hidden = false;

        if (currentTimer) clearTimeout(currentTimer);
        currentTimer = setTimeout(function() {
            element.hidden = true;
            currentTimer = null;
        }, settings.duration || DEFAULT_DURATION);
    }

    function showKey(key, options) {
        var message = (typeof getI18n === 'function') ? getI18n(key, key) : key;
        show(message, options);
    }

    return {
        show: show,
        showKey: showKey
    };
})();

if (typeof window !== 'undefined') {
    window.CodeBridgeToast = CodeBridgeToast;
}
