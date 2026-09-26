/// CodeBridge 工具列按鈕 registry
/// 職責：宣告每個工具列／終端機按鈕的識別與實作狀態。
/// 位置：ui/src/lib/ui/toolbar-registry.js
///
/// 為什麼需要 registry：
/// - `index.html` 的每個 .toolbar-btn / .terminal-tool-btn 都必須有 data-action，
///   且在 registry 中有對應項目，避免「有按鈕卻沒有任何事件處理」。
/// - 未實作的按鈕在 HTML 中必須帶 disabled，並在 registry 標記 implemented:false，
///   由 ui/tests/unit/toolbar-buttons.test.js 驗證兩者一致。
/// - 新增按鈕時若不實作，必須刻意更新測試中的 FROZEN_UNIMPLEMENTED_IDS，
///   讓「留一個沒反應的按鈕」變成需要明確決策的變更。

var CodeBridgeToolbar = (function() {
    'use strict';

    var actions = {
        'settings-menu': { id: 'btn-settings-root', implemented: true, handledBy: 'css', labelKey: 'TLB_SETTINGS' },
        'open-project': { id: 'btn-open', implemented: true, handledBy: 'toolbar', labelKey: 'TLB_OPEN', requiresDesktop: true },
        'open-example': { id: 'btn-examples', implemented: true, handledBy: 'toolbar', labelKey: 'TLB_EXAMPLES' },
        'new-project': { id: 'btn-new', implemented: true, handledBy: 'toolbar', labelKey: 'TLB_NEW' },
        'save-project-as': { id: 'btn-save-as', implemented: true, handledBy: 'toolbar', labelKey: 'TLB_SAVE_AS', requiresDesktop: true },
        'save-project': { id: 'btn-save', implemented: true, handledBy: 'toolbar', labelKey: 'TLB_SAVE', requiresDesktop: true },
        'copy-code': { id: 'btn-copy-code', implemented: true, handledBy: 'toolbar', labelKey: 'TLB_COPY_CODE' },
        'practice-mode': { id: 'btn-practice', implemented: true, handledBy: 'practice', labelKey: 'PRACTICE_ENTER' },
        'practice-cheat': { id: 'btn-cheat', implemented: true, handledBy: 'practice', labelKey: 'PRACTICE_CHEAT' },

        // 以下按鈕本輪不實作（Serial／Terminal／Compile 依賴 Arduino CLI T2、T3）
        'refresh-serial': { id: 'btn-refresh-serial', implemented: false, handledBy: 'none', labelKey: 'TLB_SERIAL_REFRESH' },
        'run-program': { id: 'btn-run', implemented: false, handledBy: 'none', labelKey: 'TLB_RUN' },
        'stop-program': { id: 'btn-stop', implemented: false, handledBy: 'none', labelKey: 'TLB_STOP_PROGRAM' },
        'toggle-terminal': { id: 'btn-terminal', implemented: false, handledBy: 'none', labelKey: 'TLB_TERMINAL' },
        'terminal-pause': { id: 'btn-pause-terminal', implemented: false, handledBy: 'none', labelKey: 'TLB_PAUSE_SCROLL' },
        'terminal-clear': { id: 'btn-clear-terminal', implemented: false, handledBy: 'none', labelKey: 'TLB_CLEAR_CONSOLE' },
        'terminal-close': { id: 'btn-close-terminal', implemented: false, handledBy: 'none', labelKey: 'TLB_CLOSE_PANEL' }
    };

    function findByElement(element) {
        if (!element) return null;
        var actionName = element.getAttribute('data-action');
        return actionName && actions[actionName] ? actions[actionName] : null;
    }

    function list() {
        return Object.keys(actions).map(function(action) {
            return { action: action, id: actions[action].id, implemented: actions[action].implemented };
        });
    }

    return {
        actions: actions,
        findByElement: findByElement,
        list: list
    };
})();

if (typeof window !== 'undefined') {
    window.CodeBridgeToolbar = CodeBridgeToolbar;
}
