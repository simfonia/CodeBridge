/// CodeBridge 板子／序列埠自動偵測
/// 職責：把後端的熱插拔事件轉成工具列的序列埠下拉與專案 FQBN。
/// 位置：ui/src/lib/arduino/board-detector.js
///
/// 設計要點：
/// - **事件驅動，非輪詢**：Rust 端每 1500ms 掃描一次序列埠，但只有簽章
///   （port|vid|pid）變化時才 emit。前端不重複計時，避免兩套節奏互相干擾。
/// - **偏好埠（preferred port）**：使用者手動選過的埠記在 localStorage，
///   拔線重插時自動跳回。自動選取**不會**覆寫偏好 —— 拔線期間自動選到的
///   其他埠（例如內建 COM1）只是暫時值，重插後必須回到使用者原本的選擇。
/// - **自動切板只在有 FQBN 時進行**：CLI 找不到對應 core 時不給 FQBN，
///   此時保留使用者已選的板子，改由 UI 提示手動選擇，不可把板子清空。
/// - **純瀏覽器降級**：沒有 Tauri runtime 時不訂閱事件、下拉保持停用。

var CodeBridgeBoardDetector = (function() {
    'use strict';

    var EVENTS = {
        SERIAL_PORTS_CHANGED: 'codebridge://serial-ports-changed',
        BOARD_DETECTED: 'codebridge://board-detected'
    };

    /// 偏好序列埠的 localStorage key。
    var PREFERRED_PORT_KEY = 'codebridgePreferredPort';

    var context = null;
    /// 目前已知的所有序列埠（後端給的排序）。
    var ports = [];
    /// port → fqbn 對應（由 BOARD_DETECTED 事件更新）。
    var boardMap = {};
    /// port → 板子顯示名。
    var boardNames = {};
    /// 無法辨識的埠（缺少對應 core）。
    var unknownPorts = [];
    /// 使用者最後手動選擇的埠；自動選取不覆寫。
    var preferredPort = '';
    /// 使用者從開發板面板手動選定的 fqbn（`board-picker.selectBoard` 呼叫）。
    ///
    /// 這是**自動偵測之上的覆寫層**：沒有它，使用者明確選了 UNO，
    /// `getState().fqbn` 卻仍只反映後端偵測結果 —— 選了板卻報
    /// 「尚未選擇開發板」。後端偵測需要對應 core 才認得出板子，
    /// 但使用者知道自己在用什麼板。
    var manualFqbn = '';
    var listeners = [];

    function bridge() { return window.CodeBridgeTauri; }

    function text(key, fallback) {
        if (typeof getI18n === 'function') return getI18n(key, fallback);
        return fallback || key;
    }

    function select() {
        if (context && context.select) return context.select;
        if (typeof document === 'undefined') return null;
        return document.getElementById('serial-selector');
    }

    function readPreferred() {
        if (preferredPort) return preferredPort;
        try {
            preferredPort = window.localStorage.getItem(PREFERRED_PORT_KEY) || '';
        } catch (error) {
            preferredPort = '';
        }
        return preferredPort;
    }

    function writePreferred(port) {
        preferredPort = port || '';
        if (!port) return;
        try {
            window.localStorage.setItem(PREFERRED_PORT_KEY, port);
        } catch (error) { /* 隱私模式不可寫入時略過 */ }
    }

    function fqbnForPort(port) {
        if (!port) return '';
        return boardMap[port] || '';
    }

    function getState() {
        var element = select();
        var port = element ? element.value : '';
        return {
            ports: ports.slice(),
            port: port,
            // 手動選擇優先於自動偵測：使用者從面板點選是明確意圖。
            fqbn: manualFqbn || fqbnForPort(port),
            manualFqbn: manualFqbn,
            unknownPorts: unknownPorts.slice(),
            preferredPort: readPreferred()
        };
    }

    function emit() {
        var snapshot = getState();
        listeners.forEach(function(listener) {
            try { listener(snapshot); } catch (error) { /* 監聽器錯誤不得影響偵測 */ }
        });
    }

    function onChange(listener) {
        if (typeof listener !== 'function') return;
        listeners.push(listener);
    }

    /// 決定選取哪個埠（純函式，便於測試與推理）。
    function choosePort(available, current, preferred) {
        // 一個埠都沒有：回傳空字串代表「沒有可用埠」，呼叫端據此保留既有
        // 選項與 element.value，不把下拉清成未選取狀態。
        if (!available.length) return '';
        if (current && available.indexOf(current) !== -1) {
            // 偏好埠重新出現時優先跳回（拔線期間可能停在其他埠）。
            if (preferred && preferred !== current && available.indexOf(preferred) !== -1) {
                return preferred;
            }
            return current;
        }
        if (preferred && available.indexOf(preferred) !== -1) return preferred;
        return available[0];
    }

    /// 重建下拉選項。
    ///
    /// 顯示規則（**順序不可對調**，否則使用者會看到相反的狀態）：
    /// - 有可用埠 → **只列實際的埠**。此時出現「未偵測到序列埠」會讓插著板子
    ///   的使用者以為沒偵測到。
    /// - 沒有任何埠 → 先列「未偵測到序列埠」讓使用者知道板子不見了，
    ///   再列原選擇（標為已移除），這樣重插時不必重選。
    function renderOptions(available) {
        var element = select();
        if (!element) return;
        // 記住既有選擇：重建過程會清空 element.value。
        var previous = element.value;
        // 清空既有選項。刻意不用 Element.remove()：那是把節點從 DOM 摘掉，
        // 會讓整個下拉從工具列消失。清空子節點才是本意。
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }

        if (!available.length) {
            var placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = text('TLB_NO_PORT', '未偵測到序列埠');
            element.appendChild(placeholder);

            // 保留原選擇，讓使用者看得到自己原本選的是哪一個；
            // 標成「已移除」以免誤以為板子還插著。
            if (previous) {
                var kept = document.createElement('option');
                kept.value = previous;
                kept.textContent = text('TLB_PORT_REMOVED', '%1（已移除）').replace('%1', previous);
                kept.setAttribute('data-removed', 'true');
                element.appendChild(kept);
            }
        } else {
            available.forEach(function(port) {
                var option = document.createElement('option');
                option.value = port;
                // 有辨識到的板名時一併顯示，省去使用者對照文件。
                var name = boardNames[port];
                option.textContent = name ? port + ' (' + name + ')' : port;
                element.appendChild(option);
            });
        }

        // 選取依序考慮：目前選擇 → 偏好埠（localStorage）→ 第一個埠。
        // 偏好埠不是專案 metadata —— 開啟 .cbg 不該改變使用者眼前的下拉。
        var target = choosePort(available, previous, readPreferred());
        if (target) {
            element.value = target;
        } else if (previous) {
            // 沒有可用埠但有原選擇：維持原值，不清成未選取。
            element.value = previous;
        } else {
            element.value = '';
        }
        element.disabled = false;
    }

    /// 處理 `codebridge://serial-ports-changed`。
    function handlePortsChanged(payload) {
        if (!payload) return;
        var element = select();
        var previous = element ? element.value : '';
        ports = Array.isArray(payload.ports) ? payload.ports.slice() : [];
        renderOptions(ports);
        emit();
    }

    /// 使用者從開發板面板手動選定開發板。
    ///
    /// **為什麼需要這一層**：後端 `board-detected` 只在對應 core 已安裝時
    /// 才認得出板子。使用者手動選了 UNO 卻仍報「尚未選擇開發板」，
    /// 是因為選板結果寫在別處（`board-picker` 過去寫 meta），而上傳讀的是
    /// 這裡。裝置狀態必須只有一個持有者，否則兩邊又不一致了。
    ///
    /// 傳入空字串可清除手動選擇，回到自動偵測。
    function setManualFqbn(fqbn) {
        var next = fqbn || '';
        if (next === manualFqbn) return getState();
        manualFqbn = next;
        emit();
        return getState();
    }

    /// 處理 `codebridge://board-detected`。
    function handleBoardsDetected(payload) {
        if (!payload) return;
        var map = {};
        var names = {};
        (payload.boards || []).forEach(function(item) {
            if (!item || !item.port || !item.fqbn) return;
            map[item.port] = item.fqbn;
            if (item.name) names[item.port] = item.name;
        });
        boardMap = map;
        boardNames = names;
        unknownPorts = Array.isArray(payload.unknown) ? payload.unknown.slice() : [];

        // 板名已知 → 重繪讓選項顯示板名。
        renderOptions(ports);
        emit();
    }

    /// 使用者手動選擇序列埠：記為偏好，供下次開啟時自動選取。
    function handleUserSelection() {
        var element = select();
        if (!element) return;
        writePreferred(element.value);
        emit();
    }

    /// 拉取一次當前序列埠清單（初始快照）。
    ///
    /// **為什麼需要**：Rust 在 `setup()` 就啟動 watcher，第一次 emit 發生在
    /// 數十毫秒內；而前端要等 Blockly 載入（數百毫秒）才註冊 listener。
    /// 啟動時就插著板子的使用者，事件在他訂閱前就發出 → **永久遺失**，
    /// 必須拔插或按偵測鈕才看得到。
    ///
    /// 事件與快照是互補的：事件管「後續變化」，快照管「當前狀態」，缺一不可。
    function pullInitialPorts() {
        if (!bridge() || !bridge().isAvailable()) return Promise.resolve([]);
        return bridge().invoke('get_serial_ports').then(function(result) {
            var list = Array.isArray(result) ? result : [];
            if (list.length) handlePortsChanged({ ports: list, change: 'initial' });
            return list;
        }).catch(function() { return []; });
    }

    /// 重新掃描序列埠（`btn-refresh-serial`）。
    function refresh() {
        if (!bridge() || !bridge().isAvailable()) return Promise.resolve(false);
        return bridge().invoke('refresh_serial_ports').then(function(result) {
            handlePortsChanged({
                ports: Array.isArray(result) ? result : [],
                change: 'initial'
            });
            return true;
        }).catch(function() { return false; });
    }

    /// 初始化：訂閱事件、綁定下拉與重新整理鈕。
    function init(options) {
        context = options || {};
        var element = select();
        if (!element) return getState();

        // change 只在使用者互動時觸發；程式直接設定 value 不會，因此可安全
        // 用它區分「使用者選的」與「自動選的」—— 這是偏好埠語意的基礎。
        if (!element.__boardDetectorBound) {
            element.__boardDetectorBound = true;
            element.addEventListener('change', handleUserSelection);
        }
        readPreferred();

        var button = typeof document !== 'undefined'
            ? document.getElementById('btn-refresh-serial')
            : null;
        if (button && !button.__boardDetectorBound) {
            button.__boardDetectorBound = true;
            button.addEventListener('click', function() { refresh(); });
            button.disabled = false;
        }

        if (!bridge() || !bridge().isAvailable()) return getState();
        bridge().listen(EVENTS.SERIAL_PORTS_CHANGED, handlePortsChanged);
        bridge().listen(EVENTS.BOARD_DETECTED, handleBoardsDetected);
        // 補一次當前狀態：watcher 的第一次事件可能在我們訂閱前就發出了。
        pullInitialPorts();
        return getState();
    }

    return {
        EVENTS: EVENTS,
        PREFERRED_PORT_KEY: PREFERRED_PORT_KEY,
        init: init,
        refresh: refresh,
        getState: getState,
        onChange: onChange,
        fqbnForPort: fqbnForPort,
        setManualFqbn: setManualFqbn,
        handlePortsChanged: handlePortsChanged,
        handleBoardsDetected: handleBoardsDetected,
        handleUserSelection: handleUserSelection,
        choosePort: choosePort,
        /// 僅供單元測試重置模組狀態。
        _reset: function() {
            context = null;
            ports = [];
            boardMap = {};
            boardNames = {};
            unknownPorts = [];
            preferredPort = '';
            manualFqbn = '';
            listeners = [];
        }
    };
})();

if (typeof window !== 'undefined') {
    window.CodeBridgeBoardDetector = CodeBridgeBoardDetector;
}

