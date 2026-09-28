/// CodeBridge 序列繪圖 — 面板控制器
/// 職責：管理左右分欄的開闔、繪圖排程、圖例渲染、分隔條拖曳與窄視窗降級。
/// 位置：ui/src/lib/plot/plot-panel.js
///
/// # 佈局決策：為什麼是「左右分欄」而不是切頁
///
/// 高中生在除錯時需要**同時**確認兩件事：程式有沒有印出預期的字（文字），
/// 以及數值變化是否合理（曲線）。Arduino IDE 2.0 的 Plotter 是獨立視窗，
/// 但對教學場景來說多一個視窗就多一份「視窗被我關掉了」的心智負擔。
/// 因此開啟繪圖時把終端機面板**垂直分成左右兩欄**：左＝Monitor 文字、
/// 右＝Plotter 波形。
///
/// # 為什麼要自動撐高
///
/// 終端機預設 200px。扣掉標題列（32）、序列控制列（~28）與輸入行（~28）後，
/// canvas 只剩約 110px，折線會被壓成看不出波形的一條線。
/// 因此開啟繪圖時若高度不足就自動撐到 320px，關閉時還原。
///
/// # 為什麼「自動撐高」與「使用者拖曳的高度」必須分開記錄
///
/// 若直接呼叫 `setHeight(320)`，使用者辛苦拖到 500px 的高度就被改掉了；
/// 反之若在關閉時無條件還原，使用者在開繪圖期間手動調到 400px 也會被還原成
/// 200px。兩者都會讓使用者覺得「面板在跟我作對」。
/// 因此只有**當我們自己執行過自動撐高**時才在關閉時還原，且只還原一次。

var CodeBridgePlotPanel = (function() {
    'use strict';

    /// 開啟繪圖時的最小可用高度。
    var MIN_PLOT_HEIGHT = 320;

    /// 低於此寬度時兩欄各剩一點都用不了 → 改成上下堆疊。
    var STACK_BREAKPOINT = 560;

    /// 分隔條可讓任一欄縮到這麼小（再小文字就無法閱讀）。
    var MIN_PANE_WIDTH = 260;

    var open = false;
    var paused = false;
    /// 是否由我們執行過自動撐高（決定關閉時要不要還原）。
    var autoRaised = false;
    /// 自動撐高前的原始高度；null 代表原本就是 CSS 預設值。
    var restoreHeight = null;
    var listeners = [];
    var frameHandle = null;

    var store = null;
    var parser = null;
    var renderer = null;

    function byId(id) {
        return typeof document === 'undefined' ? null : document.getElementById(id);
    }

    function monitor() { return window.CodeBridgeSerialMonitor; }
    function terminalPanel() { return window.CodeBridgeTerminalPanel; }

    function text(key, fallback) {
        if (typeof getI18n === 'function') return getI18n(key, fallback);
        return fallback || key;
    }

    /// 依賴注入點：測試與載入順序都靠它取得模組。
    function parseModule() { return window.CodeBridgePlotParse; }
    function storeModule() { return window.CodeBridgePlotStore; }
    function renderModule() { return window.CodeBridgePlotRender; }

    function ensureCore() {
        if (store) return true;
        if (!parseModule() || !storeModule() || !renderModule()) return false;
        parser = parseModule().createParser();
        store = storeModule().createStore();
        return true;
    }

    function getState() {
        var defaults = storeModule() ? storeModule().DEFAULT_WINDOW : 600;
        var state = {
            open: open,
            paused: paused,
            autoRaised: autoRaised,
            windowSize: store ? store.getState().windowSize : defaults,
            sampleCount: 0,
            seriesCount: 0,
            series: [],
            droppedLines: 0
        };
        if (store) {
            var inner = store.getState();
            state.sampleCount = inner.sampleCount;
            state.seriesCount = inner.seriesCount;
            state.droppedLines = inner.droppedLines;
            state.series = store.seriesList().map(function(series) {
                return { label: series.label, visible: series.visible };
            });
        }
        return state;
    }

    function onChange(listener) {
        if (typeof listener !== 'function') return;
        listeners.push(listener);
    }

    function emit() {
        var snapshot = getState();
        listeners.forEach(function(listener) {
            try { listener(snapshot); } catch (error) { /* 訂閱者錯誤不得影響面板 */ }
        });
    }

    /// 排程一幀後重繪。
    ///
    /// **為什麼需要 rAF**：序列埠最高可達數百 Hz，若每次資料事件都同步重畫，
    /// 主執行緒會被 canvas 填補操作塞滿，導致 Blockly 工作區的拖曳開始卡頓。
    /// rAF 會把同一幀內的所有請求合併成一次重畫。
    function scheduleDraw() {
        if (frameHandle !== null) return;
        var raf = (typeof requestAnimationFrame === 'function')
            ? requestAnimationFrame
            : function(callback) { return setTimeout(callback, 16); };
        frameHandle = raf(function() {
            frameHandle = null;
            draw();
        });
    }

    function draw() {
        if (!open || !store || !renderer) return false;
        var canvas = byId('plotCanvas');
        if (!canvas) return false;
        // 每幀重測尺寸：分隔條拖曳與視窗縮放都會改變版面。
        renderer.resize();
        var size = renderer.getSize();
        var windowState = store.getState();
        var drawn = renderer.draw(store.window(windowState.windowSize, size.width));
        renderLegend();
        syncStatus();
        return drawn;
    }

    // ---------------------------------------------------------------
    // 圖例
    // ---------------------------------------------------------------

    function renderLegend() {
        var host = byId('plotLegend');
        if (!host || !store) return;
        var series = store.seriesList();
        // 只有變動時才重建 DOM：資料事件可達數百 Hz，
        // 每次都重建圖例會讓畫面閃爍並拖慢整個面板。
        var signature = series.map(function(item) {
            return item.label + (item.visible ? ':1' : ':0');
        }).join('|');
        if (host.getAttribute('data-signature') === signature) return;
        host.setAttribute('data-signature', signature);
        while (host.firstChild) host.removeChild(host.firstChild);

        series.forEach(function(item) {
            var chip = document.createElement('button');
            chip.type = 'button';
            // 圖例是「色塊 + 文字」雙重編碼，不單靠顏色辨識（色盲友善）。
            chip.className = 'plot-legend-item' + (item.visible ? '' : ' is-off');
            var swatch = document.createElement('span');
            swatch.className = 'plot-legend-swatch';
            if (renderer) swatch.style.background = renderer.colorFor(item.label);
            var label = document.createElement('span');
            label.className = 'plot-legend-label';
            label.textContent = item.label;
            chip.appendChild(swatch);
            chip.appendChild(label);
            chip.setAttribute('data-plot-series', item.label);
            chip.addEventListener('click', function() { toggleSeries(item.label); });
            host.appendChild(chip);
        });
    }

    function toggleSeries(label) {
        if (!store) return false;
        var visible = store.toggleVisible(label);
        renderLegend();
        scheduleDraw();
        emit();
        return visible;
    }

    // ---------------------------------------------------------------
    // 資料流入
    // ---------------------------------------------------------------

    function handleDataLine(line) {
        // 關閉時不收集：記憶體與 CPU 都沒有必要為看不見的畫面付出。
        if (!open || paused) return 0;
        if (!ensureCore()) return 0;
        var serial = monitor();
        // HEX 顯示的是位元組串（`48 65 6C`），解析沒有意義，
        // 而且會把圖表畫成滿版雜訊。交由 UI 顯示提示即可。
        if (serial && serial.getState && serial.getState().hex) return 0;
        var points = parser.parseLine(line);
        if (points.length === 0) return 0;
        var stored = store.push(points, Date.now());
        if (stored > 0) {
            // 圖例**同步**更新，不跟著 rAF 走：它反映的是資料結構的變化，
            // 晚一幀出現會讓使用者以為「資料進來了但沒畫出來」。
            // 只有 canvas 重繪才需要 rAF 節流。
            renderLegend();
            syncStatus();
            scheduleDraw();
            emit();
        }
        return stored;
    }

    /// 監看狀態變化（HEX 切換、斷線等）。
    function handleMonitorChange() {
        if (!open) return;
        scheduleDraw();
    }

    function syncStatus() {
        var status = byId('plot-status');
        if (!status) return;
        var serial = monitor();
        var state = serial && serial.getState ? serial.getState() : null;
        if (!open) {
            status.textContent = '';
            status.setAttribute('data-tone', 'idle');
            return;
        }
        if (state && state.hex) {
            status.textContent = text('PLOT_HEX_HINT', 'HEX 模式下不繪圖，請關閉 HEX');
            status.setAttribute('data-tone', 'warn');
            return;
        }
        if (state && !state.connected) {
            status.textContent = state.pausedForUpload
                ? text('PLOT_PAUSED_UPLOAD', '上傳中暫停，稍後自動續畫')
                : text('PLOT_WAITING', '等待資料…');
            status.setAttribute('data-tone', 'idle');
            return;
        }
        var inner = store ? store.getState() : null;
        status.textContent = inner && inner.sampleCount === 0
            ? text('PLOT_WAITING', '等待資料…')
            : '';
        status.setAttribute('data-tone', 'idle');
    }

    // ---------------------------------------------------------------
    // 開闔與版面
    // ---------------------------------------------------------------

    function bodyElement() { return byId('terminalBody'); }
    function plotPane() { return byId('plotPane'); }

    /// 依容器寬度套用左右分欄或上下堆疊。
    ///
    /// **為什麼需要降級**：視窗很窄時兩欄各剩一點，
    /// 左邊文字被擠到換行、右邊曲線只剩幾個像素，兩邊都不能用。
    function syncLayout() {
        var body = bodyElement();
        if (!body) return;
        body.classList.toggle('is-split', open);
        var pane = plotPane();
        if (pane) pane.style.display = open ? 'flex' : 'none';
        if (!open) {
            body.classList.remove('is-stacked');
            return;
        }
        var stacked = Number(body.offsetWidth) > 0
            && Number(body.offsetWidth) < STACK_BREAKPOINT;
        body.classList.toggle('is-stacked', stacked);
    }

    /// 開啟繪圖：分欄 + 必要時自動撐高 + 確保有資料來源。
    function openPlot() {
        if (open) return true;
        if (!ensureCore()) return false;
        var canvas = byId('plotCanvas');
        if (canvas && !renderer) renderer = renderModule().createRenderer(canvas);

        open = true;
        // 解析器的「上一個標籤」是跨連線的狀態，開新面板要清掉，
        // 否則新連線的純數值會沿用舊連線的 series 名稱。
        if (parser) parser.reset();

        raiseForPlot();
        syncLayout();
        bindControls();
        // 繪圖與監看共用同一條序列連線：使用者只想看圖時，
        // 不該還得再按一次「開啟監視器」。
        var serial = monitor();
        if (serial && serial.getState && !serial.getState().connected) {
            if (typeof serial.start === 'function') serial.start({});
        }
        scheduleDraw();
        emit();
        return true;
    }

    /// 高度不足時自動撐高，記住原值以便還原。
    function raiseForPlot() {
        if (autoRaised) return;
        var panel = terminalPanel();
        if (!panel || typeof panel.setHeight !== 'function') return;
        var area = byId('terminalArea');
        var current = area ? Number(area.offsetHeight) || 0 : 0;
        // 已經夠高（使用者自己拖過）就完全不動 —— 尊重使用者的版面選擇。
        if (current >= MIN_PLOT_HEIGHT) return;
        restoreHeight = current > 0 ? current : null;
        autoRaised = true;
        panel.setHeight(MIN_PLOT_HEIGHT);
        notifyWorkspaceResize();
    }

    function restoreHeightIfNeeded() {
        if (!autoRaised) return;
        autoRaised = false;
        var panel = terminalPanel();
        if (panel && typeof panel.setHeight === 'function') {
            // null 會讓終端機面板改回 CSS 預設值（移除 inline style）。
            panel.setHeight(restoreHeight);
        }
        restoreHeight = null;
        notifyWorkspaceResize();
    }

    /// 終端機面板位於 `#blocklyArea` 內部，改變高度必須讓 Blockly 重算。
    ///
    /// 走 `terminal-panel` 提供的 `notifyWorkspaceResize()`（若存在），
    /// 否則退回全域鉤子 —— 由 main.js 在啟動時注入。
    /// 不可自己直接呼叫 `Blockly.svgResize`：那會讓本模組與 Blockly 產生
    /// 不必要的相依，且單元測試環境沒有 Blockly。
    function notifyWorkspaceResize() {
        var panel = terminalPanel();
        if (panel && typeof panel.notifyWorkspaceResize === 'function') {
            panel.notifyWorkspaceResize();
            return;
        }
        if (typeof window.CodeBridgePlotPanelNotifyResize === 'function') {
            window.CodeBridgePlotPanelNotifyResize();
        }
    }

    function closePlot() {
        if (!open) return false;
        open = false;
        paused = false;
        syncLayout();
        restoreHeightIfNeeded();
        syncStatus();
        emit();
        return true;
    }

    function toggle() {
        return open ? closePlot() : openPlot();
    }

    function clear() {
        if (!store) return false;
        store.clear();
        if (parser) parser.reset();
        if (renderer) renderer.clear();
        scheduleDraw();
        emit();
        return true;
    }

    /// 暫停／繼續收集資料。
    ///
    /// 暫停是**凍結畫面**而不是清空資料：使用者暫停是要比較兩段波形，
    /// 清掉資料就失去意義了。
    function togglePause() {
        paused = !paused;
        syncControls();
        if (!paused) scheduleDraw();
        emit();
        return paused;
    }

    function setWindow(size) {
        if (!ensureCore()) return false;
        var applied = store.setWindow(size);
        var select = byId('plotWindowSelect');
        if (select) select.value = String(applied);
        scheduleDraw();
        emit();
        return applied;
    }
    // ---------------------------------------------------------------
    // 控制列與初始化
    // ---------------------------------------------------------------

    /// 依狀態同步控制列外觀（開關鈕、暫停鈕、視窗長度下拉）。
    function syncControls() {
        var toggle = byId('btn-plotter');
        if (toggle) {
            toggle.setAttribute('data-active', open ? 'true' : 'false');
            var label = text(open ? 'PLOT_CLOSE' : 'PLOT_OPEN', open ? '關閉繪圖' : '開啟繪圖');
            toggle.textContent = label;
            toggle.title = label;
        }
        var pauseButton = byId('btn-plot-pause');
        if (pauseButton) {
            pauseButton.setAttribute('data-active', paused ? 'true' : 'false');
            var pauseLabel = text(paused ? 'PLOT_RESUME' : 'PLOT_PAUSE', paused ? '繼續' : '暫停');
            pauseButton.textContent = pauseLabel;
            pauseButton.title = pauseLabel;
        }
        var select = byId('plotWindowSelect');
        if (select && store) select.value = String(store.getState().windowSize);
        var clearButton = byId('btn-plot-clear');
        if (clearButton) {
            var clearLabel = text('PLOT_CLEAR', '清除');
            clearButton.textContent = clearLabel;
            clearButton.title = clearLabel;
        }
        syncStatus();
    }

    /// 填入視窗長度選項（3 / 10 / 30 秒，值與 store 的常數一致）。
    function renderWindowOptions() {
        var select = byId('plotWindowSelect');
        if (!select || select.__plotOptionsRendered || !storeModule()) return;
        select.__plotOptionsRendered = true;
        while (select.firstChild) select.removeChild(select.firstChild);
        storeModule().WINDOW_CHOICES.forEach(function(value) {
            var option = document.createElement('option');
            option.value = String(value);
            // 秒數只是呈現，值仍是點數 —— 兩者不可混為一談。
            option.textContent = String(Math.round(value / 60)) + 's';
            select.appendChild(option);
        });
    }

    /// 綁定分隔條拖曳（只在水平分欄時有意義）。
    function bindDivider() {
        var divider = byId('plotDivider');
        if (!divider || divider.__plotBound) return;
        divider.__plotBound = true;
        var dragging = false;
        var startX = 0;
        var startFlex = 0;

        function onMouseDown(event) {
            var body = bodyElement();
            if (!body || body.classList.contains('is-stacked')) return;
            dragging = true;
            startX = event.clientX || 0;
            var left = byId('terminalTextPane');
            startFlex = left ? Number(left.offsetWidth) || 0 : 0;
            divider.setAttribute('data-dragging', 'true');
            if (event.preventDefault) event.preventDefault();
        }

        function onMouseMove(event) {
            if (!dragging) return;
            var body = bodyElement();
            var total = Number(body.offsetWidth) || 0;
            if (total <= 0) return;
            // 右欄也要保底寬度：左欄吃光等於關掉繪圖。
            var next = startFlex + ((event.clientX || 0) - startX);
            var maxLeft = total - MIN_PANE_WIDTH;
            next = Math.max(MIN_PANE_WIDTH, Math.min(maxLeft, next));
            body.style.setProperty('--plot-left-width', next + 'px');
            scheduleDraw();
        }

        function onMouseUp() {
            if (!dragging) return;
            dragging = false;
            divider.setAttribute('data-dragging', 'false');
        }

        divider.addEventListener('mousedown', onMouseDown);
        if (typeof document !== 'undefined') {
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }
    }

    /// 綁定控制列（冪等，重複 init 不會重複綁）。
    function bindControls() {
        var select = byId('plotWindowSelect');
        if (select && !select.__plotBound) {
            select.__plotBound = true;
            select.addEventListener('change', function() { setWindow(select.value); });
        }
        syncControls();
    }

    function init() {
        var serial = monitor();
        if (serial && typeof serial.onDataLine === 'function') {
            serial.onDataLine(handleDataLine);
        }
        if (serial && typeof serial.onChange === 'function') {
            serial.onChange(handleMonitorChange);
        }
        renderWindowOptions();
        bindControls();
        bindDivider();
        // 容器寬度變化（視窗縮放、程式預覽面板收合）會影響分欄決策。
        if (typeof ResizeObserver === 'function') {
            var body = bodyElement();
            if (body) {
                var observer = new ResizeObserver(function() {
                    syncLayout();
                    scheduleDraw();
                });
                observer.observe(body);
            }
        }
        syncLayout();
        syncStatus();
        return getState();
    }

    return {
        MIN_PLOT_HEIGHT: MIN_PLOT_HEIGHT,
        STACK_BREAKPOINT: STACK_BREAKPOINT,
        init: init,
        open: openPlot,
        close: closePlot,
        toggle: toggle,
        clear: clear,
        togglePause: togglePause,
        toggleSeries: toggleSeries,
        setWindow: setWindow,
        handleDataLine: handleDataLine,
        handleMonitorChange: handleMonitorChange,
        syncLayout: syncLayout,
        syncControls: syncControls,
        getState: getState,
        onChange: onChange,
        /// 僅供單元測試重置模組狀態（不影響 DOM）。
        _reset: function() {
            open = false;
            paused = false;
            autoRaised = false;
            restoreHeight = null;
            listeners = [];
            frameHandle = null;
            store = null;
            parser = null;
            renderer = null;
        }
    };
})();

if (typeof window !== 'undefined') {
    window.CodeBridgePlotPanel = CodeBridgePlotPanel;
}
