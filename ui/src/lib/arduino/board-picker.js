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
            element.appendChild(createNotice('TLB_BLOCK_SEARCH_NO_RESULTS', '找不到符合的開發板，請調整搜尋字串'));
            return;
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
        close();
        return true;
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
        visibleBoards: visibleBoards,
        matches: matches,
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

