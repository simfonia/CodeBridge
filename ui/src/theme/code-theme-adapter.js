/// CodeBridge 程式碼預覽主題 adapter。
(function() {
    'use strict';

    window.CodeBridgeCodeTheme = {
        apply: function(visualTheme) {
            document.documentElement.dataset.codebridgeVisualTheme = visualTheme;
        }
    };
})();
