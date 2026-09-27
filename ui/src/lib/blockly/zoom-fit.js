/// CodeBridge 縮放至符合內容（Zoom to Fit）控制項
/// 職責：在 Blockly 右下角縮放控制群組下方加一顆 fit 按鈕，把視圖調整成
///       剛好容納所有積木，並置中。
/// 位置：ui/src/lib/blockly/zoom-fit.js
///
/// 為什麼 Blockly 沒有內建這顆：
/// Blockly 13 的縮放控制項只建立三顆（zoomOut / zoomIn / zoomReset），
/// 其中 reset 只是回到 `startScale` 並置中，**不會**依內容計算比例。
/// `workspace.zoomToFit()` 方法存在，但官方沒有為它提供任何 UI。
///
/// 為什麼不直接塞進 Blockly 的控制群組 SVG：
/// Blockly 在每次 `svgResize` 都會重算整個群組的 `transform`，且只認得自己
/// 的三顆按鈕 —— 塞進去的第四顆會被重算時丟掉 transform 而疊到別的按鈕上。
/// 因此改以獨立控制項呈現，位置固定在工作區右上角。
/// 右下角已被 Blockly 的縮放群組與垃圾桶佔用，故不放在那裡。
///
/// 位置完全交由 CSS（`.blockly-zoom-fit` 的 `top/right` 搭配
/// `#blocklyDiv { position: relative }`），不需要 JS 量測：
/// 程式預覽面板收合時 `#blocklyArea` 會變寬，按鈕自然跟著往右移。

var CodeBridgeZoomFit = (function() {
    'use strict';

    var SVG_NS = 'http://www.w3.org/2000/svg';

    /// 與 Blockly 縮放控制項一致的按鈕尺寸（zoom controls 的 HEIGHT/WIDTH）。
    var BUTTON_SIZE = 32;

    var workspace = null;
    var button = null;

    function text(key, fallback) {
        if (typeof getI18n === 'function') return getI18n(key, fallback);
        return fallback || key;
    }

    /// 把視圖縮放並置中到剛好容納所有積木。
    ///
    /// Blockly 內建的 `zoomToFit()` 有兩個不適合直接使用的地方：
    /// 1. 它只在 `isMovable()` 為 true 時才動作，否則只印一句 console.warn，
    ///    使用者按了沒反應卻不知道原因。
    /// 2. 工作區沒有積木時 `getBlocksBoundingBox()` 回傳全 0 的方塊，
    ///    算出的比例會是 NaN 或極端值。
    /// 因此先做前置檢查，再委派給 Blockly 計算比例與置中。
    function zoomToFit() {
        if (!workspace) return false;
        if (typeof workspace.zoomToFit !== 'function') return false;

        if (!workspace.isMovable()) {
            workspace.setScale(1);
            workspace.scrollCenter();
            return false;
        }

        var box = workspace.getBlocksBoundingBox();
        if (!box || !(box.right - box.left > 0) || !(box.bottom - box.top > 0)) {
            // 沒有積木：回到 100% 並置中，避免縮到 minScale 的極小值。
            workspace.setScale(1);
            workspace.scrollCenter();
            return false;
        }

        workspace.zoomToFit();
        return true;
    }

    /// 建立「符合內容」按鈕的 SVG 內容（四角括號圖示，與 Blockly 風格一致）。
    function buildIcon() {
        var icon = document.createElementNS(SVG_NS, 'svg');
        icon.setAttribute('viewBox', '0 0 32 32');
        icon.setAttribute('width', String(BUTTON_SIZE));
        icon.setAttribute('height', String(BUTTON_SIZE));
        icon.setAttribute('aria-hidden', 'true');
        icon.setAttribute('focusable', 'false');

        var path = document.createElementNS(SVG_NS, 'path');
        // 四角括號：表示「把內容縮放進這個框」
        path.setAttribute('d', 'M7 12V7h5M25 12V7h-5M7 20v5h5M25 20v5h-5');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-width', '2.5');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        icon.appendChild(path);
        return icon;
    }

    function init(targetWorkspace) {
        if (button) return button;
        workspace = targetWorkspace || (window.Blockly && Blockly.getMainWorkspace && Blockly.getMainWorkspace());
        if (!workspace) return null;

        var host = document.getElementById('blocklyDiv');
        if (!host) return null;

        button = document.createElement('button');
        button.type = 'button';
        button.id = 'btn-zoom-fit';
        button.className = 'blockly-zoom-fit';
        button.title = text('TLB_ZOOM_FIT', '縮放至符合內容');
        button.setAttribute('aria-label', button.title);
        button.appendChild(buildIcon());
        button.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            zoomToFit();
        });
        host.appendChild(button);
        return button;
    }

    return {
        BUTTON_SIZE: BUTTON_SIZE,
        init: init,
        zoomToFit: zoomToFit,
        getButton: function() { return button; },
        /// 僅供單元測試重置。
        _reset: function() {
            if (button && button.parentNode) button.parentNode.removeChild(button);
            button = null;
            workspace = null;
        }
    };
})();

if (typeof window !== 'undefined') {
    window.CodeBridgeZoomFit = CodeBridgeZoomFit;
}
