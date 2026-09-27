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

    /// 取得可寫入的專案 store。
    ///
    /// `window.CodeBridgeProject` 是**工廠**（提供 `createStore`），沒有
    /// `setMeta`；真正的 store 實例由 main.js 掛在 `window.CodeBridgeProjectStore`。
    function store() {
        if (context && context.store) return context.store;
        return window.CodeBridgeProjectStore || null;
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

    function currentMeta() {
        var target = store();
        if (!target || typeof target.getState !== 'function') return {};
        var state = target.getState();
        return (state && state.meta) || {};
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
            fqbn: fqbnForPort(port),
            metaFqbn: currentMeta().fqbn || '',
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

    /// 把序列埠寫回專案 metadata（存進 .cbg，下次開檔仍在）。
    ///
    /// **不覆寫已存在的 FQBN**：偵測到的板子是「現在插著的硬體」，而 meta.fqbn
    /// 是「專案原本要燒進哪顆晶片」。自動切板只在使用者從未選過板子時填入；
    /// 否則會把上傳前比對的基準抹掉 —— 每次都變成「相同」，等於沒有比對。
    /// 使用者想改板子時應由板子選擇面板明確操作。
    function applyToMeta(port) {
        var target = store();
        if (!target || typeof target.setMeta !== 'function') return;
        var meta = currentMeta();
        var patch = { port: port || (meta.port || null) };
        if (!meta.fqbn) {
            var detected = fqbnForPort(port);
            if (detected) patch.fqbn = detected;
        }
        target.setMeta(patch);
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

        // 選取依序考慮：專案既有的 port → 偏好埠 → 目前選擇 → 第一個埠。
        // 專案 metadata 優先，因為開啟 .cbg 時裡頭已記錄了該用哪個埠，
        // 自動選取不該在使用者開檔後就覆寫它。
        var target = choosePort(available, previous || currentMeta().port || '', readPreferred());
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

    /// 套用目前選取埠對應的板子。
    function applyBoardForCurrentPort() {
        var element = select();
        if (!element) return;
        applyToMeta(element.value);
    }

    /// 處理 `codebridge://serial-ports-changed`。
    function handlePortsChanged(payload) {
        if (!payload) return;
        var element = select();
        var previous = element ? element.value : '';
        ports = Array.isArray(payload.ports) ? payload.ports.slice() : [];
        renderOptions(ports);
        if (element && element.value !== previous) {
            // 自動切換到不同埠 → 套用新埠的板子。
            applyBoardForCurrentPort();
        }
        emit();
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
        applyBoardForCurrentPort();
        emit();
    }

    /// 使用者手動選擇序列埠：記為偏好並套用該埠的板子。
    function handleUserSelection() {
        var element = select();
        if (!element) return;
        writePreferred(element.value);
        applyToMeta(element.value);
        emit();
    }

    /// 上傳前比對板子：偵測到的 FQBN 與專案記錄的不一致時詢問使用者。
    ///
    /// 為什麼需要確認：使用者可能插上 A 板、卻仍留著 B 板的專案設定。
    /// 直接上傳會把程式寫進錯誤的晶片，且事後難以察覺。
    /// 後端 `verify_build` 也會擋下 FQBN 不符的 build，但那是在 avrdude
    /// 階段才回報錯誤；此處提早確認可給使用者改選板子的機會。
    ///
    /// 以下情況一律放行（不詢問）：
    /// - 沒有選取序列埠 → 由 `CLI_ERROR_NO_PORT` 負責回報。
    /// - 偵測不到 FQBN（沒安裝對應 core）→ 無從比對，應讓使用者自行決定。
    function verifyBoardForUpload() {
        var element = select();
        var port = element ? element.value : '';
        var detected = fqbnForPort(port);
        var expected = currentMeta().fqbn || '';

        if (!port || !detected || !expected) return Promise.resolve(true);
        // 兩者一致 → 沒有風險，直接放行，不打扰使用者。
        if (detected === expected) return Promise.resolve(true);

        var confirm = window.CodeBridgeConfirm;
        if (!confirm || typeof confirm.ask !== 'function') return Promise.resolve(true);

        // 顯示板名比顯示 FQBN 更容易讓高中生判斷「是不是同一顆晶片」。
        var detectedName = boardNames[port] || detected;
        var message = text('MSG_BOARD_MISMATCH', '偵測到的開發板（%1）與目前的設定（%2）不同，確定要上傳嗎？')
            .replace('%1', detectedName)
            .replace('%2', expected);

        return confirm.ask({
            message: message,
            options: [
                { value: true, labelKey: 'MSG_CONTINUE', variant: 'primary' },
                { value: false, labelKey: 'MSG_CANCEL' }
            ]
        }).then(function(answer) {
            return answer === true;
        }).catch(function() {
            // 對話框不可用時不阻擋上傳（後端仍有 build 驗證把關）。
            return true;
        });
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
        return getState();
    }

    return {
        EVENTS: EVENTS,
        PREFERRED_PORT_KEY: PREFERRED_PORT_KEY,
        init: init,
        refresh: refresh,
        verifyBoardForUpload: verifyBoardForUpload,
        getState: getState,
        onChange: onChange,
        fqbnForPort: fqbnForPort,
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
            listeners = [];
        }
    };
})();

if (typeof window !== 'undefined') {
    window.CodeBridgeBoardDetector = CodeBridgeBoardDetector;
}

