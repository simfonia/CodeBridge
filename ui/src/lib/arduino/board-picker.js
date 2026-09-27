/// CodeBridge 開發板選擇面板
/// 職責：列出可用開發板、提供搜尋過濾，並把使用者選定的 FQBN 寫回專案 metadata。
/// 位置：ui/src/lib/arduino/board-picker.js
///
/// 設計要點：
/// - **手動選板可以覆寫，自動切板不行**（兩者方向相反）：
///   `board-detector.js` 的自動切板只在 `meta.fqbn` 為空時填入；面板的選取
///   是使用者的明確意圖，必須能改掉既有值。
/// - **名稱與 FQBN 並列顯示**：只顯示 FQBN（`arduino:avr:uno`）對高中生
///   沒有判斷依據，兩者一起看才確認得了是不是同一顆晶片。
/// - **搜尋同時比對名稱與 FQBN**：使用者可能輸入「uno」，也可能直接貼文件
///   裡的 FQBN，兩種都得找得到。
/// - **清單只載入一次**：核心索引數百筆，重複請求既慢又無意義。

var CodeBridgeBoardPicker = (function() {
    'use strict';

    var FILTERS = {
        /// 已安裝的核心（預設）
        installed: 'installed',
        /// 全部已知開發板（含未安裝核心者）
        all: 'all'
    };

    var boards = [];
    var loaded = false;
    var isVisible = false;
    var filter = FILTERS.installed;
    var term = '';
    var errorKey = '';
    var unknownPorts = [];
    /// 核心是否正在安裝（避免重複點擊造成多次下載）。
    var installing = false;
    /// 由 `init(options)` 注入的依賴（目前只有 store）。
    var context = null;

    function bridge() { return window.CodeBridgeTauri; }

    function text(key, fallback) {
        if (typeof getI18n === 'function') return getI18n(key, fallback);
        return fallback || key;
    }

    /// 取得可寫入的專案 store。
    ///
    /// `window.CodeBridgeProject` 是**工廠**（提供 `createStore`），並非 store
    /// 實例 —— 它沒有 `setMeta`。真正的 store 由 main.js 建立並掛在
    /// `window.CodeBridgeProjectStore`，因此必須優先取用後者。
    /// 取不到時回 null：寧可無法寫入，也不要靜默寫到錯誤的目標。
    function store() {
        if (context && context.store) return context.store;
        return window.CodeBridgeProjectStore || null;
    }

    function currentMeta() {
        var target = store();
        if (!target || typeof target.getState !== 'function') return {};
        var state = target.getState();
        return (state && state.meta) || {};
    }

    function panel() { return document.getElementById('cb-board-panel'); }
    function listElement() { return document.getElementById('cb-board-list'); }
    function searchInput() { return document.getElementById('cb-board-search'); }

    function getState() {
        return {
            open: isVisible,
            filter: filter,
            term: term,
            loaded: loaded,
            error: errorKey,
            count: boards.length,
            installing: installing,
            /// 清單為空且核心服務可用時，面板要提供安裝入口 —— 否則使用者卡死。
            canInstallCore: canInstallCore(),
            unknownPorts: unknownPorts.slice()
        };
    }

    function isOpen() { return isVisible; }

    /// 名稱或 FQBN 任一包含關鍵字即符合（不分大小寫）。
    function matches(board, keyword) {
        if (!keyword) return true;
        var name = String(board.name || '').toLowerCase();
        var fqbn = String(board.fqbn || '').toLowerCase();
        var needle = String(keyword).toLowerCase();
        return name.indexOf(needle) !== -1 || fqbn.indexOf(needle) !== -1;
    }

    /// 套用搜尋關鍵字與分頁過濾。
    function visibleBoards() {
        return boards.filter(function(board) {
            if (!board || !board.fqbn) return false;
            return matches(board, term);
        });
    }

    /// 建立一個非互動的提示列（載入中／錯誤／無結果）。
    function createNotice(messageKey, fallback) {
        var item = document.createElement('li');
        item.className = 'cb-board-notice';
        item.textContent = text(messageKey, fallback);
        return item;
    }

    /// 常用開發板快捷建議（依名稱）。
    ///
    /// 為什麼需要：高中生手上的 UNO／Nano 多為第三廠 clone，其 USB 晶片
    /// （CH340／CP2102）不在 Arduino 官方 VID 白名單內，**自動偵測必然失敗**。
    /// 使用者得先知道「該選 Arduino Uno」才搜得到 FQBN，但「uno」怎麼拼
    /// 不是他需要知道的知識。因此直接把最常見的幾款列出並可一鍵選用。
    var PRESET_MATCHES = ['uno', 'nano', 'mega', 'micro', 'leonardo', 'esp32', 'pico'];

    /// 從已載入的清單中挑出對應到快捷建議的板子。
    function presets() {
        return PRESET_MATCHES.map(function(keyword) {
            return boards.find(function(board) {
                if (!board || !board.fqbn) return false;
                return String(board.name || '').toLowerCase().indexOf(keyword) !== -1;
            });
        }).filter(Boolean).map(function(board) {
            return { name: board.name, fqbn: board.fqbn };
        });
    }


    /// 建立「常用開發板」快捷列。
    ///
    /// 讓使用者不必知道 FQBN 怎麼拼，點一下就能選用最常見的板子。
    function createPresetRow() {
        var row = document.createElement('li');
        row.className = 'cb-board-presets';

        var label = document.createElement('div');
        label.className = 'cb-board-presets-label';
        label.textContent = text('TLB_BOARD_PRESETS', '常用開發板');
        row.appendChild(label);

        var buttons = document.createElement('div');
        buttons.className = 'cb-board-presets-items';
        presets().forEach(function(preset) {
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'cb-board-preset';
            button.textContent = preset.name;
            button.setAttribute('data-fqbn', preset.fqbn);
            button.addEventListener('click', function() { selectBoard(preset.fqbn); });
            buttons.appendChild(button);
        });
        row.appendChild(buttons);
        return row;
    }

    /// 核心服務（延後載入，讓面板在沒有該模組時仍能運作）。
    function core() { return window.CodeBridgeCore || null; }

    /// 是否提供核心安裝入口（服務存在且尚未有任何板子）。
    function canInstallCore() {
        return Boolean(core()) && boards.length === 0;
    }

    /// 搜尋並安裝 board core，讓「清單是空的」不再是死路。
    ///
    /// 首次使用者（或剛清空核心的使用者）會看到空的板子清單。若只顯示
    /// 「尚未安裝核心」而不提供任何入口，使用者就完全卡住了。
    ///
    /// 流程：搜尋可安裝核心 → 取第一個（優先推薦）→ 安裝 → 重載清單。
    /// 回傳結果物件而非拋出，讓呼叫端能決定要不要提示。
    function installCore(term) {
        var service = core();
        if (!service || typeof service.search !== 'function') {
            return Promise.resolve({ installed: false, reason: 'no-service' });
        }
        installing = true;
        errorKey = '';
        render();

        return service.search(term || 'arduino').then(function(platforms) {
            var candidates = (platforms || []).filter(function(item) {
                return item && item.id && !item.installed;
            });
            if (!candidates.length) {
                installing = false;
                render();
                return { installed: false, reason: 'none-available' };
            }
            // 推薦的核心排前面：高中生最常用 AVR（Uno／Nano）。
            candidates.sort(function(a, b) {
                return (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0);
            });
            var chosen = candidates[0];
            return service.install(chosen.id).then(function() {
                installing = false;
                // 安裝完必須重載，否則清單還是舊的空值。
                loaded = false;
                return openPanel({ unknownPorts: unknownPorts });
            }).then(function() {
                return { installed: true, id: chosen.id, name: chosen.name };
            });
        }).catch(function(error) {
            installing = false;
            errorKey = (error && error.message ? String(error.message) : '').split('|')[0]
                || 'CLI_ERROR_COMMAND_FAILED';
            render();
            return { installed: false, reason: 'error' };
        });
    }

    /// 建立「安裝核心」按鈕。
    ///
    /// 沒有它，首次使用者在空清單前會完全卡住 —— 看到「尚未安裝核心」
    /// 卻不知道去哪裡裝、也不知道要去哪個網址下載。
    function createInstallButton() {
        var wrapper = document.createElement('li');
        wrapper.className = 'cb-board-install';

        var label = document.createElement('div');
        label.className = 'cb-board-notice';
        label.textContent = text(
            'TLB_BOARD_EMPTY_HINT',
            '尚未安裝任何開發板核心。安裝後即可選用該板型的所有開發板。'
        );
        wrapper.appendChild(label);

        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'cb-board-install-button';
        button.textContent = installing
            ? text('CLI_OPERATION_CORE_INSTALL', '安裝中…')
            : text('TLB_BOARD_INSTALL_ACTION', '安裝 Arduino AVR Boards（Uno／Nano）');
        button.setAttribute('data-action', 'install-core');
        button.addEventListener('click', function() { installCore(); });
        wrapper.appendChild(button);
        return wrapper;
    }

    /// 重建清單。直接操作 DOM，不依賴 innerHTML 拼接。
    function render() {
        var element = listElement();
        if (!element) return;
        if (element.children && element.children.length) {
            while (element.children.length) {
                element.removeChild(element.children[0]);
            }
        } else {
            element.innerHTML = '';
        }

        if (errorKey) {
            element.appendChild(createNotice(errorKey, '無法載入開發板清單'));
            return;
        }
        if (!loaded) {
            element.appendChild(createNotice('CLI_DETECTING_BOARD', '正在載入開發板清單…'));
            return;
        }

        var visible = visibleBoards();
        if (!visible.length) {
            // 尚未搜尋就沒東西 = 使用者還沒裝任何核心，或清單是空的。
            if (!term) {
                if (canInstallCore()) {
                    // 有安裝入口就不是死路：直接給可操作的按鈕。
                    element.appendChild(createInstallButton());
                } else {
                    element.appendChild(createNotice(
                        'TLB_BOARD_EMPTY_HINT',
                        '尚未安裝任何開發板核心，請先到「設定 → 環境」安裝核心後再試'
                    ));
                }
            } else {
                // 搜尋無結果時要說明「開發板」而非沿用積木搜尋的字串，
                // 否則使用者在選板時會看到「找不到符合的積木」而不知所措。
                element.appendChild(createNotice(
                    'TLB_BOARD_SEARCH_NO_RESULTS',
                    '找不到符合「{0}」的開發板。可改用下方「常用開發板」快速選擇。'
                        .replace('{0}', term)
                ));
            }
            element.appendChild(createPresetRow());
            return;
        }

        if (unknownPorts.length) {
            // 自動偵測失敗不代表不能用 —— 說清楚這件事，使用者才知道下一步。
            element.appendChild(createNotice(
                'TLB_BOARD_UNKNOWN_HINT',
                '無法自動辨識插入的開發板（常見於第三廠板）。請手動選擇後即可正常編譯與上傳。'
            ));
        }
        if (!term) {
            element.appendChild(createPresetRow());
        }

        var selected = currentMeta().fqbn || '';
        visible.forEach(function(board) {
            var item = document.createElement('li');
            item.className = 'cb-board-item' + (board.fqbn === selected ? ' is-active' : '');
            item.setAttribute('data-fqbn', board.fqbn);
            // 名稱與 FQBN 並列，讓使用者確認得了他要的是哪一顆。
            item.textContent = board.name + '  ·  ' + board.fqbn;
            item.addEventListener('click', function() { selectBoard(board.fqbn); });
            element.appendChild(item);
        });
    }

    /// 套用使用者選定的開發板並關閉面板。
    ///
    /// 與自動切板相反：這裡**一定覆寫** `meta.fqbn`。使用者從清單點選
    /// 就是明確意圖，若因為「先前已有值」而不寫入，使用者將永遠無法改板子。
    function selectBoard(fqbn) {
        var target = store();
        if (!fqbn) return false;
        if (target && typeof target.setMeta === 'function') {
            target.setMeta({ fqbn: fqbn });
        }
        renderLabel(fqbn);
        close();
        return true;
    }

    /// 工具列的開發板標籤。
    ///
    /// 為什麼需要：下拉只顯示序列埠，選了哪塊板完全沒有回饋。上一版
    /// HTML 有 `#board-label` 元素卻從未寫入，使用者選完看不到結果，
    /// 只能靠「執行」後會不會報錯來猜。
    function renderLabel(fqbn) {
        if (typeof document === 'undefined') return;
        var label = document.getElementById('board-label');
        if (!label) return;
        if (!fqbn) {
            label.textContent = text('TLB_BOARD_NONE_SELECTED', '未選擇開發板');
            return;
        }
        var name = boardNameOf(fqbn) || fqbn;
        label.textContent = name;
        // 完整 FQBN 放在 title：高中生看名稱就夠，進階使用者可檢視原始值。
        label.setAttribute('title', fqbn);
    }

    /// 由 FQBN 找出板子名稱。
    function boardNameOf(fqbn) {
        var hit = boards.find(function(board) { return board && board.fqbn === fqbn; });
        return hit ? hit.name : '';
    }

    /// 面板關閉時依當前設定同步標籤（涵蓋「開檔載入既有 FQBN」的情境）。
    function syncLabel() {
        renderLabel(currentMeta().fqbn || '');
    }

    function setFilter(next) {
        filter = next === FILTERS.all ? FILTERS.all : FILTERS.installed;
        render();
        return filter;
    }

    function setTerm(next) {
        term = String(next || '');
        render();
    }

    function close() {
        isVisible = false;
        var element = panel();
        if (element) element.hidden = true;
    }

    function show() {
        isVisible = true;
        var element = panel();
        if (element) element.hidden = false;
    }

    function onKeyDown(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
        }
    }

    function onSearchInput(event) {
        setTerm(event && event.target ? event.target.value : '');
    }

    /// 開啟面板；必要時才向後端索取清單。
    ///
    /// `options.unknownPorts` 傳入無法辨識的序列埠，用於提示使用者手動選板。
    function openPanel(options) {
        if (!bridge() || !bridge().isAvailable()) return Promise.resolve(false);
        if (options && Array.isArray(options.unknownPorts)) {
            unknownPorts = options.unknownPorts.slice();
        }

        show();
        syncLabel();
        var input = searchInput();
        if (input) input.value = term;
        render();

        if (loaded) {
            if (input && typeof input.focus === 'function') input.focus();
            return Promise.resolve(true);
        }

        return bridge().invoke('board_list_all').then(function(result) {
            boards = (result && Array.isArray(result.boards)) ? result.boards.slice() : [];
            loaded = true;
            errorKey = '';
            render();
            var field = searchInput();
            if (field && typeof field.focus === 'function') field.focus();
            return true;
        }).catch(function(err) {
            // 面板已開啟，此處只標示錯誤並留在畫面上，不可拋出讓面板消失。
            errorKey = err && err.message ? String(err.message).split('|')[0] : 'MSG_UNKNOWN_ERROR';
            loaded = true;
            render();
            return true;
        });
    }

    /// 綁定按鈕與面板事件。idempotent。
    function init(options) {
        context = options || null;
        var button = document.getElementById('btn-select-board');
        if (button && !button.__boardPickerBound) {
            button.__boardPickerBound = true;
            button.addEventListener('click', function() { openPanel(); });
        }
        var input = searchInput();
        if (input && !input.__boardPickerBound) {
            input.__boardPickerBound = true;
            input.addEventListener('input', onSearchInput);
        }
        var element = panel();
        if (element && !element.__boardPickerBound) {
            element.__boardPickerBound = true;
            // 以屬性掛載，讓鍵盤處理不依賴 document 監聽（也便於測試）。
            element.__onKeyDown = onKeyDown;
            // 點擊遮罩等同關閉，避免使用者卡在面板裡。
            element.addEventListener('click', function(event) {
                if (event.target === element) close();
            });
        }
        var closeButton = document.getElementById('cb-board-close');
        if (closeButton && !closeButton.__boardPickerBound) {
            closeButton.__boardPickerBound = true;
            closeButton.addEventListener('click', function() { close(); });
        }
        return getState();
    }

    return {
        FILTERS: FILTERS,
        init: init,
        open: openPanel,
        close: close,
        isOpen: isOpen,
        getState: getState,
        setFilter: setFilter,
        setTerm: setTerm,
        selectBoard: selectBoard,
        renderLabel: renderLabel,
        syncLabel: syncLabel,
        installCore: installCore,
        visibleBoards: visibleBoards,
        matches: matches,
        presets: presets,
        /// 僅供單元測試重置模組狀態。
        _reset: function() {
            boards = [];
            loaded = false;
            isVisible = false;
            filter = FILTERS.installed;
            term = '';
            errorKey = '';
            unknownPorts = [];
            context = null;
        }
    };
})();

if (typeof window !== 'undefined') {
    window.CodeBridgeBoardPicker = CodeBridgeBoardPicker;
}

