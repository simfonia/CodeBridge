/// CodeBridge 終端機面板
/// 職責：把編譯／上傳的逐行輸出附加到 `#terminalContent`，管理自動捲動、
///       暫停、清除與開闔，並維持兩套 preset 主題下的可讀性。
/// 位置：ui/src/lib/ui/terminal-panel.js
///
/// 設計要點：
/// - 每次附加都以 **單一文字節點** 寫入（`textContent`），不使用 innerHTML。
///   編譯輸出包含 gcc 的原始內容（可能含 `<`、`&`、反引號），用 innerHTML
///   會造成注入與版面破壞。
/// - 上限 `MAX_LINES`：首次安裝 board core 會吐出上千行下載進度，不設上限
///   會讓 webview 記憶體無限成長。
/// - **暫停捲動**只凍結「自動捲動」，使用者仍可手動捲動查看歷史；恢復時
///   不強制跳回底部（否則會把使用者正在看的內容吃掉）。
/// - 純瀏覽器環境（無 Tauri）也可操作，讓 Playwright 能驗證面板行為。

var CodeBridgeTerminalPanel = (function() {
    'use strict';

    /// 保留的最大行數；超出後丟棄最舊的行。
    var MAX_LINES = 2000;

    /// 已附加的行數（含已被丟棄的），供測試與除錯使用。
    var totalLines = 0;
    var paused = false;
    var open = false;
    var listeners = [];

    function panel() { return document.getElementById('terminalArea'); }
    function content() { return document.getElementById('terminalContent'); }
    function pauseButton() { return document.getElementById('btn-pause-terminal'); }

    function text(key, fallback) {
        if (typeof getI18n === 'function') return getI18n(key, fallback);
        return fallback || key;
    }

    /// 附加一行；`kind` 決定樣式（info／error／success／warn／command）。
    function append(line, kind) {
        var host = content();
        if (!host) return false;
        var value = line === undefined || line === null ? '' : String(line);
        if (value === '') return false;

        var row = document.createElement('div');
        row.className = 'terminal-line' + (kind ? ' terminal-line--' + kind : '');
        // textContent 而非 innerHTML：編譯輸出不可當成 HTML 解析。
        row.textContent = value;
        host.appendChild(row);

        totalLines += 1;
        trim();
        if (!paused) scrollToEnd();
        emit();
        return true;
    }

    /// 把文字追加到最後一行的末尾，**不新增行**。
    ///
    /// 用途：上傳期間的心跳點。每秒一個點若各自新增一行，畫面會被點淹沒，
    /// 完全看不出「還在燒」。後續接收到的其他輸出（例如 `New upload port`）
    /// 仍要單獨成行，因此只追加在相鄰的下一次 append。
    function appendToLast(line) {
        var host = content();
        if (!host) return false;
        var value = line === undefined || line === null ? '' : String(line);
        if (value === '') return false;

        var children = host.children;
        if (!children || children.length === 0) {
            // 還沒有任何行：建立第一行再追加，讓後續的點能接在它後面。
            var row = document.createElement('div');
            row.className = 'terminal-line terminal-line--info';
            row.textContent = value;
            host.appendChild(row);
            totalLines += 1;
            trim();
            if (!paused) scrollToEnd();
            emit();
            return true;
        }
        var last = children[children.length - 1];
        last.textContent = (last.textContent || '') + value;
        totalLines += 1;
        trim();
        if (!paused) scrollToEnd();
        emit();
        return true;
    }

    /// 附加多行；空字串會被忽略（避免連續空行佔滿面板）。
    function appendLines(lines, kind) {
        var appended = 0;
        (lines || []).forEach(function(line) {
            if (append(line, kind)) appended += 1;
        });
        return appended;
    }

    /// 附加一則帶前綴的訊息（使用 i18n key + `%1` 取代字元）。
    function appendMessage(key, fallback, replacements, kind) {
        var message = text(key, fallback);
        (replacements || []).forEach(function(replacement, index) {
            message = message.replace('%' + (index + 1), replacement);
        });
        return append(message, kind || 'info');
    }

    /// 丟棄最舊的行，維持記憶體上限。
    function trim() {
        var host = content();
        if (!host) return;
        while (host.childElementCount > MAX_LINES) {
            host.removeChild(host.firstChild);
        }
    }

    function scrollToEnd() {
        var host = content();
        if (!host) return;
        host.scrollTop = host.scrollHeight;
    }

    /// 使用者拖曳調整過的面板高度（px）；null 表示沿用 CSS 預設值。
    var userHeight = null;

    /// 套用（或移除）inline height。
    ///
    /// 為什麼一定要在收合時移除 inline style：
    /// `.collapsed { height: 0 }` 只是 CSS 規則，而 inline `style="height: Npx"`
    /// 的優先級高於任何樣式表規則。一旦拖曳過後留下 inline height，
    /// 之後點收合鈕只會切換 class，畫面高度不變 —— 對使用者來說就是
    /// 「開合按鈕失效」。因此收合時必須把 inline style 拿掉。
    function applyHeight() {
        var host = panel();
        if (!host) return;
        if (open && userHeight) {
            host.style.height = userHeight + 'px';
        } else {
            host.style.removeProperty('height');
        }
    }

    /// 設定面板高度（由拖曳調整棒呼叫）。
    function setHeight(px) {
        var value = Number(px);
        userHeight = isNaN(value) || value <= 0 ? null : value;
        applyHeight();
    }

    /// 工作區尺寸變更的監聽者（由 main.js 註冊為 `Blockly.svgResize`）。
    ///
    /// **為什麼需要**：終端機面板位於 `#blocklyArea` 內部，開闔會改變
    /// Blockly 工作區的可用高度。Blockly 的 SVG 只在 `inject()` 時量一次
    /// 尺寸也不會自己偵察容器變化 —— 沒呼叫 `svgResize` 的症狀是
    /// 「面板收合了，但工作區沒有變大，原本被蓋住的區域也沒有重繪回來」
    /// （使用者 2026-09-28 回報）。
    var resizeListeners = [];

    function onWorkspaceResize(listener) {
        if (typeof listener !== 'function') return;
        resizeListeners.push(listener);
    }

    function emitResize() {
        resizeListeners.forEach(function(listener) {
            try { listener(); } catch (error) { /* 監聽器錯誤不得影響面板開闔 */ }
        });
    }

    /// 通知外部「容器高度被別人改變了」。
    ///
    /// 序列繪圖開啟時會自動撐高終端機面板（見 plot-panel.js），
    /// 那不是面板自己的開闔動作，因此 `setOpen` 不會觸發這裡。
    /// 公開成方法讓外部可以沿用同一條 svgResize 路徑，
    /// 而不必自己去摸 Blockly。
    function notifyWorkspaceResize() {
        if (typeof setTimeout === 'function') {
            // 延遲一幀：等 CSS 高度套用後再量，量到的才是實際值。
            setTimeout(emitResize, 0);
        } else {
            emitResize();
        }
    }

    function setOpen(next) {
        var host = panel();
        if (!host) return;
        open = next;
        host.classList.toggle('collapsed', !open);
        applyHeight();
        if (open) scrollToEnd();
        syncToggle();
        // 高度變化後通知外部重算 Blockly 工作區尺寸（延遲一幀等 CSS 生效）。
        if (typeof setTimeout === 'function') {
            setTimeout(emitResize, 0);
        } else {
            emitResize();
        }
        emit();
    }

    /// 同步三角收合鈕：箭頭方向與 `aria-expanded` 需反映目前狀態，
    /// 否鍵盤與讀螢幕軟體的使用者會拿到錯誤資訊。
    function syncToggle() {
        var button = document.getElementById('terminal-toggle');
        if (!button) return;
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
        var arrow = button.querySelector('.arrow');
        if (arrow) arrow.textContent = open ? '▼' : '▲';
    }

    function toggle() { setOpen(!open); }

    function setPaused(next) {
        paused = Boolean(next);
        var button = pauseButton();
        if (button) {
            // `is-active` 代表「自動捲動**開啟中**」，也就是按鈕被按下的狀態。
            // 預設就是自動捲動，因此初始應為按下；暫停後才會浮起。
            // tooltip 一律描述「點下去會發生什麼」，與一般 toggle 鈕一致。
            button.classList.toggle('is-active', !paused);
            button.classList.toggle('is-paused', paused);
            button.setAttribute('aria-pressed', paused ? 'false' : 'true');
            button.title = paused
                ? text('TLB_SCROLL_RESUMED', '繼續捲動')
                : text('TLB_PAUSE_SCROLL', '暫停捲動');
        }
        emit();
    }

    function togglePaused() { setPaused(!paused); }

    function clear() {
        var host = content();
        if (!host) return;
        host.innerHTML = '';
        totalLines = 0;
        emit();
    }

    function getState() {
        return { open: open, paused: paused, lineCount: totalLines, maxLines: MAX_LINES };
    }

    function onChange(listener) {
        if (typeof listener !== 'function') return;
        listeners.push(listener);
    }

    function emit() {
        var state = getState();
        listeners.forEach(function(listener) {
            try { listener(state); } catch (error) { /* 監聽器錯誤不得影響面板 */ }
        });
    }

    /// 依當前狀態同步面板外觀（初始為收合、未暫停捲動）。
    ///
    /// **這裡刻意不綁定按鈕事件**：`#btn-terminal` 與三顆終端機工具列按鈕都帶有
    /// `data-action`，點擊已由 `toolbar.js` 的 document 委派統一處理。若面板再
    /// 直接 `addEventListener`，同一次點擊會觸發兩次（開→關），按鈕看起來像壞掉。
    /// 因此按鈕的唯一責任歸屬在 toolbar，面板只提供純方法。
    function init() {
        setOpen(open);
        setPaused(paused);
        return getState();
    }

    return {
        MAX_LINES: MAX_LINES,
        init: init,
        setHeight: setHeight,
        append: append,
        appendToLast: appendToLast,
        appendLines: appendLines,
        appendMessage: appendMessage,
        clear: clear,
        toggle: toggle,
        open: function() { setOpen(true); },
        close: function() { setOpen(false); },
        isOpen: function() { return open; },
        setPaused: setPaused,
        togglePaused: togglePaused,
        isPaused: function() { return paused; },
        scrollToEnd: scrollToEnd,
        getState: getState,
        onChange: onChange,
        onWorkspaceResize: onWorkspaceResize,
        /// 通知外部容器高度被外部改變（序列繪圖自動撐高時使用）。
        notifyWorkspaceResize: notifyWorkspaceResize,
        /// 僅供單元測試重置模組狀態（不影響 DOM）。
        _reset: function() { totalLines = 0; paused = false; open = false; userHeight = null; listeners = []; resizeListeners = []; }
    };
})();

if (typeof window !== 'undefined') {
    window.CodeBridgeTerminalPanel = CodeBridgeTerminalPanel;
}

