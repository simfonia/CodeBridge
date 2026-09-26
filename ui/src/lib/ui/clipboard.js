/// CodeBridge 剪貼簿
/// 職責：把 plain code 複製到系統剪貼簿，供貼到 Arduino IDE 使用。
/// 位置：ui/src/lib/ui/clipboard.js
///
/// 為什麼需要 fallback：
/// Tauri 的 WebView 對 navigator.clipboard 的 secure context 行為不一致，
/// 在部分平台上 writeText 會丟出 NotAllowedError，因此保留
/// execCommand('copy') + 暫存 textarea 的保底路徑。

var CodeBridgeClipboard = (function() {
    'use strict';

    function copyWithExecCommand(text) {
        var textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', 'readonly');
        textarea.style.position = 'fixed';
        textarea.style.top = '-1000px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);

        var selection = document.getSelection();
        var previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        var succeeded = false;
        try {
            succeeded = document.execCommand('copy');
        } catch (error) {
            succeeded = false;
        }
        document.body.removeChild(textarea);

        if (previousRange && selection) {
            selection.removeAllRanges();
            selection.addRange(previousRange);
        }
        return succeeded;
    }

    /// 複製文字；回傳是否成功。
    function copy(text) {
        var value = String(text === null || text === undefined ? '' : text);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(value)
                .then(function() { return true; })
                .catch(function() { return copyWithExecCommand(value); });
        }
        return Promise.resolve(copyWithExecCommand(value));
    }

    return {
        copy: copy,
        copyWithExecCommand: copyWithExecCommand
    };
})();

if (typeof window !== 'undefined') {
    window.CodeBridgeClipboard = CodeBridgeClipboard;
}
