/// CodeBridge 序列監視器（前端）
/// 職責：把後端的序列資料事件轉成終端機面板的輸出，並管理開關、波特率、
///       HEX／時間戳顯示與開發者輸入行。
/// 位置：ui/src/lib/arduino/serial-monitor.js
///
/// 設計要點：
/// - **與編譯輸出共用同一個面板**（2026-09-28 決策）：高中生不會同時需要
///   看編譯 log 與序列輸出，Arduino IDE 也是單一面板。序列行以
///   `kind: 'data'` 與編譯行（`kind: 'command'`）視覺區隔。
/// - **baud 變更必須重啟**（2026-09-28 決策）：序列埠的 baud 在開啟時綁定，
///   沒有熱改的 API。丟失連線瞬間是唯一合理代價。
/// - **埠消失自動關閉**：拔線是不可逆事件，不自動關閉會讓 UI 永遠顯示「已連線」。
/// - **多埠過濾**：資料事件帶 port，只顯示目前監看的那個埠的輸出。
/// - **純瀏覽器降級**：沒有 Tauri runtime 時所有命令回 false 並提示，
///   絕不留下「按了沒反應」的按鈕。

var CodeBridgeSerialMonitor = (function() {
    'use strict';

    var EVENTS = {
        SERIAL_DATA: 'codebridge://serial-data',
        SERIAL_STATE: 'codebridge://serial-state'
    };

    /// 可選波特率（與 arduino 模組積木的 BAUD dropdown 一致）。
    /// **刻意不建 i18n key**：值本來就是數字，翻譯沒有意義，
    /// 兩處不一致只會讓學生在積木與面板間對不起來。
    var SUPPORTED_BAUDS = [300, 1200, 2400, 4800, 9600, 14400, 19200, 28800, 38400, 57600, 115200];

    /// 預設波特率；必須與後端 `serial_monitor::DEFAULT_BAUD` 一致。
    var DEFAULT_BAUD = 9600;

    var context = null;
    var connected = false;
    var port = '';
    var baud = DEFAULT_BAUD;
    var hex = false;
    var timestamp = false;
    /// 開啟監視器時是否以 DTR 重新啟動開發板（讓開機訊息重播）。
    var resetOnOpen = false;
    /// 累計收到的位元組數（診斷用：0 = 板子沒送資料）。
    var receivedBytes = 0;
    /// Monitor 是否因上傳而暫停（會自動重連，非使用者主動關閉）。
    var pausedForUpload = false;
    var listeners = [];

    function bridge() { return window.CodeBridgeTauri; }
    function terminal() { return window.CodeBridgeTerminalPanel; }

    function text(key, fallback) {
        if (typeof getI18n === 'function') return getI18n(key, fallback);
        return fallback || key;
    }

    function toast(key, fallback, type) {
        if (window.CodeBridgeToast && typeof window.CodeBridgeToast.showKey === 'function') {
            window.CodeBridgeToast.showKey(key, { type: type || 'error' });
        }
    }

    /// 把後端的 `KEY|detail` 錯誤轉為可顯示訊息。
    function reportError(error) {
        var raw = String(error === undefined || error === null ? '' : error);
        var parts = raw.split('|');
        var key = parts[0] || 'SERIAL_ERROR_OPEN';
        var detail = parts.slice(1).join('|');
        var message = text(key, key);
        if (detail) message = message + '：' + detail;
        toast(key, message, 'error');
        if (terminal()) terminal().appendMessage(key, message, detail ? [detail] : [], 'error');
    }

    function getState() {
        return {
            connected: connected,
            port: port,
            baud: baud,
            hex: hex,
            timestamp: timestamp,
            resetOnOpen: resetOnOpen,
            receivedBytes: receivedBytes,
            pausedForUpload: pausedForUpload,
            autoReconnect: true
        };
    }

    function emit() {
        var snapshot = getState();
        listeners.forEach(function(listener) {
            try { listener(snapshot); } catch (error) { /* 監聽器錯誤不得影響監視器 */ }
        });
    }

    function onChange(listener) {
        if (typeof listener !== 'function') return;
        listeners.push(listener);
    }

    /// 產生時間戳前綴（HH:MM:SS.mmm）。
    ///
    /// **毫秒是刻意的**：`Serial.print` 在 loop 裡每秒呼叫多次時，
    /// 只到秒會讓多行看起來同時發生，無法判斷實際間隔。
    function stamp() {
        var now = new Date();
        function pad(value, size) {
            var text = String(value);
            while (text.length < (size || 2)) text = '0' + text;
            return text;
        }
        return pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' +
            pad(now.getSeconds()) + '.' + pad(now.getMilliseconds(), 3);
    }

    /// 啟動監視器。
    function start(options) {
        var settings = options || {};
        var target = settings.port !== undefined ? settings.port : currentPort();
        // 使用者主動開啟 → 離開「上傳暫停中」狀態。
        pausedForUpload = false;
        // 每次開啟都是新的連線 → 位元組數歸零，否則新 session 會顯示
        // 上一個 session 的累積值，讓人誤以為「板子在傳資料」。
        receivedBytes = 0;
        if (!target) {
            // 沒有埠是最常見的阻擋點，不發動後端以免得到莫名其妙的錯誤。
            reportError('SERIAL_ERROR_NO_PORT|尚未選擇序列埠');
            return Promise.resolve(false);
        }
        if (!bridge() || !bridge().isAvailable()) {
            toast('SERIAL_MONITOR_DESKTOP_ONLY', text('SERIAL_MONITOR_DESKTOP_ONLY', ''), 'warning');
            return Promise.resolve(false);
        }

        var targetBaud = settings.baud !== undefined ? settings.baud : baud;
        var targetHex = settings.hex !== undefined ? settings.hex : hex;
        var targetReset = settings.resetOnOpen !== undefined ? settings.resetOnOpen : resetOnOpen;
        return bridge().invoke('serial_monitor_start', {
            port: target,
            baud: targetBaud,
            hex: targetHex,
            resetOnOpen: targetReset
        }).then(function() {
            connected = true;
            port = target;
            baud = targetBaud;
            hex = targetHex;
            resetOnOpen = targetReset;
            if (terminal()) terminal().open();
            emit();
            return true;
        }).catch(function(error) {
            connected = false;
            reportError(error);
            emit();
            return false;
        });
    }

    /// 停止監視器。
    function stop() {
        connected = false;
        // 使用者主動關閉 → 不是「上傳暫停中」。
        pausedForUpload = false;
        if (!bridge() || !bridge().isAvailable()) {
            emit();
            return Promise.resolve(false);
        }
        return bridge().invoke('serial_monitor_stop').then(function() {
            emit();
            return true;
        }).catch(function(error) {
            reportError(error);
            emit();
            return false;
        });
    }

    function toggle() {
        return connected ? stop() : start({});
    }

    /// 變更波特率；已連線時**重啟**監視器（序列埠 baud 無法熱改）。
    function setBaud(value) {
        var next = parseInt(value, 10);
        if (isNaN(next)) return Promise.resolve(false);
        if (SUPPORTED_BAUDS.indexOf(next) === -1) next = DEFAULT_BAUD;
        baud = next;
        if (!connected) {
            // 未連線時只記住設定：使用者會在下一次開啟時用到。
            emit();
            return Promise.resolve(true);
        }
        var previous = port;
        return stop().then(function() {
            return start({ port: previous, baud: next, hex: hex });
        });
    }

    /// 切換 HEX 顯示；**純前端設定**，不重啟。
    function setHex(value) {
        hex = Boolean(value);
        emit();
        return Promise.resolve(true);
    }

    /// 切換時間戳；**純前端設定**，不重啟。
    function setTimestamp(value) {
        timestamp = Boolean(value);
        emit();
        return Promise.resolve(true);
    }

    /// 切換「開啟時重新啟動開發板」。
    ///
    /// **為什麼需要這個開關**：CH340 之類的 USB-UART 晶片會硬體重組時脈，
    /// 所以用錯誤的 baud 讀到的**仍是正確文字而非亂碼**。使用者看到的
    /// 「沒有任何訊息」其實是開機訊息在他開啟監視器之前就印完了。
    /// 勾選後開啟 Monitor 會以 DTR 觸發板子重置，讓開機訊息重播
    /// （對齊 Arduino IDE 開啟 Serial Monitor 的行為）。
    function setResetOnOpen(value) {
        resetOnOpen = Boolean(value);
        emit();
        return Promise.resolve(true);
    }

    /// 重新啟動開發板（要求 Monitor 處於開啟狀態）。
    ///
    /// 讓使用者能隨時「重看一次開機訊息」，不必關閉再開。
    function resetBoard() {
        if (!connected) {
            reportError('SERIAL_MONITOR_NOT_RUNNING|序列監視器尚未開啟');
            return Promise.resolve(false);
        }
        // 刻意帶上 resetOnOpen：無論目前設定為何，這個按鈕的語意就是
        // 「重新啟動板子」，必須真的做這件事。
        return start({ port: port, baud: baud, hex: hex, resetOnOpen: true });
    }

    /// 送出開發者輸入行。
    function send(value) {
        var message = value === undefined || value === null ? '' : String(value);
        if (message === '') return Promise.resolve(false);
        if (!connected) {
            reportError('SERIAL_MONITOR_NOT_RUNNING|序列監視器尚未開啟');
            return Promise.resolve(false);
        }
        return bridge().invoke('serial_monitor_send', { text: message })
            .then(function() { return true; })
            .catch(function(error) {
                reportError(error);
                return false;
            });
    }

    /// 序列資料事件：附加到終端機面板。
    function handleSerialData(payload) {
        if (!payload) return;
        // 累計位元組數是**診斷關鍵**：使用者看到「印出空白行」時，
        // 0 bytes 代表板子根本沒送資料；有 bytes 但看不到字，代表是我們的
        // 解碼或波特率問題。沒有這個數字就只能在兩個假設之間來回猜。
        if (typeof payload.bytes === 'number') {
            receivedBytes = payload.bytes;
            updateByteCounter();
        }
        if (!Array.isArray(payload.lines)) return;
        // 多埠並存時只顯示正在監看的那個埠。
        if (connected && payload.port && payload.port !== port) return;
        if (!terminal()) return;
        payload.lines.forEach(function(line) {
            terminal().append(timestamp ? stamp() + ' ' + line : line, 'data');
        });
    }

    /// 更新狀態列上的位元組計數。
    ///
    /// **歸零時機刻意只有「開新連線」一種**：歸零在 `start()` 裡做。
    /// 使用者若預期「開合終端機面板」也會歸零，會得到失望 ——
    /// 面板的收合只是 UI 層的變化，序列連線完全沒有中斷，
    /// 累計位元組數**理應**繼續累加。文案刻意寫成「本次連線」，
    /// 讓「什麼時候會歸零」不必猜。
    function updateByteCounter() {
        var element = byId('serial-byte-count');
        if (!element) return;
        if (!connected) {
            element.textContent = '';
            element.setAttribute('data-visible', 'false');
            return;
        }
        element.setAttribute('data-visible', 'true');
        // 0 bytes 時特別標示「等待資料」：這是使用者最常見的困惑點
        // —— 他不知道「沒反應」是板子沒印，還是自己設錯了波特率。
        element.textContent = receivedBytes === 0
            ? text('SERIAL_WAITING_DATA', '等待資料…')
            : text('SERIAL_RECEIVED_BYTES', '本次連線已接收 %1 bytes')
                .replace('%1', String(receivedBytes));
        element.title = text('SERIAL_BYTES_HINT',
            '數字在「重新開啟監視器」、「重新啟動開發板」或「切換波特率」時歸零。'
            + '按開發板上的實體 RESET 鍵不會歸零 —— 那只是讓板子重新開機，序列連線並未中斷。'
            + '要看開機訊息，請用終端機面板的「清除」按鈕先清空畫面。');
    }

    /// 狀態事件。
    function handleSerialState(payload) {
        if (!payload) return;
        connected = Boolean(payload.connected);
        if (payload.port) port = payload.port;
        if (payload.baud) baud = payload.baud;
        if (typeof payload.hex === 'boolean') hex = payload.hex;
        // 後端會在暫停 Monitor 供上傳時帶上這個標記；狀態燈要能區分
        // 「上傳暫停中（馬上會自己接回來）」與「使用者關掉了」——
        // 否則使用者會以為自動暫停失敗，轉而手動關閉。
        pausedForUpload = typeof payload.error === 'string'
            && payload.error.indexOf('SERIAL_PAUSED_FOR_UPLOAD') === 0;
        emit();
    }

    /// 序列埠清單變化：埠消失時自動關閉。
    function handlePortsChanged(payload) {
        if (!connected || !payload || !Array.isArray(payload.ports)) return;
        if (payload.ports.indexOf(port) !== -1) return;
        // 拔線是不可逆事件；不關閉會讓 UI 永遠停在「已連線」。
        stop();
    }

    /// 目前工具列選取的序列埠。
    function currentPort() {
        if (context && context.port) return context.port;
        if (typeof document === 'undefined') return '';
        var element = document.getElementById('serial-selector');
        return element && element.value ? element.value : '';
    }

    // ---------------------------------------------------------------
    // DOM 綁定
    // ---------------------------------------------------------------

    function byId(id) {
        return typeof document === 'undefined' ? null : document.getElementById(id);
    }

    /// 填入波特率選項（值與 arduino 模組積木一致，因此不需 i18n）。
    function renderBaudOptions() {
        var select = byId('serial-baud-select');
        if (!select || select.__baudRendered) return;
        select.__baudRendered = true;
        while (select.firstChild) select.removeChild(select.firstChild);
        SUPPORTED_BAUDS.forEach(function(value) {
            var option = document.createElement('option');
            option.value = String(value);
            option.textContent = String(value);
            select.appendChild(option);
        });
        select.value = String(baud);
    }

    /// 依模組狀態同步所有控制列外觀。
    ///
    /// **單一同步點**：開關、狀態燈、輸入框的停用狀態全部由這裡決定，
    /// 不可各自為政 —— 否則「顯示已連線但輸入框是停用的」這種矛盾會出現。
    function syncControls() {
        var state = getState();
        renderBaudOptions();

        var button = byId('btn-serial-monitor');
        if (button) {
            button.setAttribute('data-active', state.connected ? 'true' : 'false');
            var label = state.connected ? 'SERIAL_STOP' : 'SERIAL_START';
            button.textContent = text(label, state.connected ? '關閉監視器' : '開啟監視器');
            button.title = button.textContent;
        }

        var status = byId('serial-status');
        if (status) {
            // 三態：已連線／上傳暫停中／未連線。
            // 「上傳暫停中」必須與「未連線」區分，否則使用者會以為
            // 自動暫停失敗，轉而手動關閉（然後撞上埠被佔用）。
            var key = state.connected
                ? 'SERIAL_CONNECTED'
                : (state.pausedForUpload ? 'SERIAL_PAUSED_FOR_UPLOAD' : 'SERIAL_DISCONNECTED');
            status.setAttribute('data-connected',
                state.connected ? 'true' : (state.pausedForUpload ? 'paused' : 'false'));
            var label = text(key, key);
            status.textContent = state.connected
                ? label + ' ' + state.port + ' @ ' + state.baud
                : label;
        }
        // 位元組計數是診斷關鍵：0 代表板子完全沒送資料，
        // 有數字但看不到字代表解碼或波特率的問題。
        updateByteCounter();

        // 輸入框只在連線時可用，避免送出「按了沒反應」的訊息。
        var input = byId('serial-input');
        if (input) input.disabled = !state.connected;
        var sendButton = byId('btn-serial-send');
        if (sendButton) sendButton.disabled = !state.connected;

        var baudSelect = byId('serial-baud-select');
        if (baudSelect) baudSelect.value = String(state.baud);
        var timestampToggle = byId('serial-timestamp-toggle');
        if (timestampToggle) timestampToggle.checked = state.timestamp;
        var hexToggle = byId('serial-hex-toggle');
        if (hexToggle) hexToggle.checked = state.hex;
        var resetToggle = byId('serial-reset-toggle');
        if (resetToggle) resetToggle.checked = state.resetOnOpen;
        // 「重新啟動開發板」只在已連線時可用 —— 未連線時按了也沒意義。
        var resetButton = byId('btn-serial-reset');
        if (resetButton) {
            resetButton.disabled = !state.connected;
            resetButton.title = text('SERIAL_RESET_BOARD', '重新啟動開發板');
        }
    }

    /// 綁定控制列事件（冪等，重複 init 不會重複綁）。
    function bindControls() {
        var select = byId('serial-baud-select');
        if (select && !select.__serialBound) {
            select.__serialBound = true;
            select.addEventListener('change', function() { setBaud(select.value); });
        }
        var timestampToggle = byId('serial-timestamp-toggle');
        if (timestampToggle && !timestampToggle.__serialBound) {
            timestampToggle.__serialBound = true;
            timestampToggle.addEventListener('change', function() {
                setTimestamp(timestampToggle.checked);
            });
        }
        var hexToggle = byId('serial-hex-toggle');
        if (hexToggle && !hexToggle.__serialBound) {
            hexToggle.__serialBound = true;
            hexToggle.addEventListener('change', function() { setHex(hexToggle.checked); });
        }
        var resetToggle = byId('serial-reset-toggle');
        if (resetToggle && !resetToggle.__serialBound) {
            resetToggle.__serialBound = true;
            resetToggle.addEventListener('change', function() {
                setResetOnOpen(resetToggle.checked);
            });
        }
        var resetButton = byId('btn-serial-reset');
        if (resetButton && !resetButton.__serialBound) {
            resetButton.__serialBound = true;
            resetButton.addEventListener('click', function() { resetBoard(); });
        }
        var input = byId('serial-input');
        if (input && !input.__serialBound) {
            input.__serialBound = true;
            // Enter 送出：不要求使用者另外去點按鈕。
            input.addEventListener('keydown', function(event) {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                submitInput();
            });
        }
    }

    /// 送出輸入行的內容並清空欄位。
    function submitInput() {
        var input = byId('serial-input');
        if (!input) return Promise.resolve(false);
        var value = input.value;
        input.value = '';
        return send(value);
    }

    function init(options) {
        context = options || {};
        bindControls();
        listeners.push(syncControls);
        syncControls();
        if (!bridge() || !bridge().isAvailable()) return getState();
        bridge().listen(EVENTS.SERIAL_DATA, handleSerialData);
        bridge().listen(EVENTS.SERIAL_STATE, handleSerialState);
        return getState();
    }

    return {
        EVENTS: EVENTS,
        SUPPORTED_BAUDS: SUPPORTED_BAUDS,
        DEFAULT_BAUD: DEFAULT_BAUD,
        init: init,
        start: start,
        stop: stop,
        toggle: toggle,
        setBaud: setBaud,
        setHex: setHex,
        setTimestamp: setTimestamp,
        setResetOnOpen: setResetOnOpen,
        resetBoard: resetBoard,
        send: send,
        submitInput: submitInput,
        syncControls: syncControls,
        getState: getState,
        onChange: onChange,
        handleSerialData: handleSerialData,
        handleSerialState: handleSerialState,
        handlePortsChanged: handlePortsChanged,
        /// 僅供單元測試重置模組狀態。
        _reset: function() {
            context = null;
            connected = false;
            port = '';
            baud = DEFAULT_BAUD;
            hex = false;
            timestamp = false;
            resetOnOpen = false;
            receivedBytes = 0;
            pausedForUpload = false;
            listeners = [];
        }
    };
})();

if (typeof window !== 'undefined') {
    window.CodeBridgeSerialMonitor = CodeBridgeSerialMonitor;
}
