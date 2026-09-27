/// CodeBridge 工具列行為
/// 職責：依 data-action 派發按鈕行為、渲染最近專案與範例清單、
///       同步 dirty 指示（檔名圖示 + 儲存按鈕高亮）與視窗關閉提醒。
/// 位置：ui/src/lib/ui/toolbar.js
///
/// 按鈕對應關係由 ui/src/lib/ui/toolbar-registry.js 宣告；
/// practice-mode.js 自行綁定的按鈕（practice-mode / practice-cheat）不在此重複綁定。

var CodeBridgeToolbarUI = (function() {
    'use strict';

    var context = null;
    var examples = [];

    function store() {
        return context.store;
    }

    function projectIO() {
        return window.CodeBridgeProjectIO;
    }

    /// 編譯／上傳控制器（T2-C 起存在；未載入時視為不可用）。
    function compile() {
        return window.CodeBridgeCompile;
    }

    /// 終端機面板（T2-C 起存在）。
    function terminal() {
        return window.CodeBridgeTerminalPanel;
    }

    function text(key, fallback) {
        if (typeof getI18n === 'function') return getI18n(key, fallback);
        return fallback || key;
    }

    function requireDesktop() {
        if (window.CodeBridgeTauri.isAvailable()) return true;
        window.CodeBridgeToast.showKey('MSG_DESKTOP_REQUIRED', { type: 'error' });
        return false;
    }

    // ---------------------------------------------------------------
    // dirty 指示
    // ---------------------------------------------------------------
    function applyState(state) {
        var label = document.getElementById('current-filename');
        var icon = document.getElementById('project-state-icon');
        var breadcrumb = document.getElementById('file-breadcrumb');

        if (label) label.textContent = state.name || text('TLB_FILE_NEW', 'Untitled Project');
        if (icon) {
            icon.src = state.isDirty
                ? 'src/icons/pen-duotone.png'
                : 'src/icons/load_project_24dp_1F1F1F.png';
            icon.style.opacity = state.isDirty ? '1' : '0.5';
            icon.title = state.isDirty ? text('TLB_UNSAVED_TITLE', 'Unsaved changes') : '';
        }

        // 檔名膠囊：已存檔專案可點擊以在檔案總管中顯示，tooltip 顯示來源位置。
        // 內建範例沒有本機路徑（隨程式打包），只顯示來源標籤且不可點擊。
        if (breadcrumb) {
            var located = state.sourcePath || state.sourceLabel;
            breadcrumb.title = located
                ? (state.canReveal ? located : text('TLB_SOURCE_EXAMPLE', 'Built-in example') + '：' + located)
                : text('TLB_NO_PATH_TO_REVEAL', 'Not saved yet');
            breadcrumb.classList.toggle('is-linked', Boolean(state.canReveal));
        }

        // 儲存按鈕的提示責任：
        // - 已存檔（有路徑）的專案：dirty 時高亮 save，因為它真的會寫回原檔。
        // - 未命名專案（內建範例、新專案）：dirty 提示改由 save-as 承擔。
        //   此時按 save 其實也會開存檔對話框，把提示放在 save 上會誤導使用者
        //   以為「只是存檔」，而實際上正要選擇一個位置。
        var save = document.getElementById('btn-save');
        var saveAs = document.getElementById('btn-save-as');
        if (save) {
            save.classList.toggle('is-dirty', state.isDirty && !state.isUntitled);
            if (state.isUntitled) {
                save.title = text('TLB_SAVE_FIRST', 'Not saved yet — choose a location');
            } else {
                save.title = state.isDirty
                    ? text('TLB_UNSAVED_TITLE', 'Unsaved changes')
                    : text('TLB_SAVE', 'Save');
            }
        }
        if (saveAs) {
            saveAs.classList.toggle('is-dirty', state.isDirty && state.isUntitled);
            if (state.isUntitled && state.isDirty) {
                saveAs.title = text('TLB_SAVE_AS_NEEDED', 'Choose where to save this project');
            }
        }

        // 儲存／開啟後最近清單會變動，因此狀態每次變化都重繪。
        renderRecents();
    }

    // ---------------------------------------------------------------
    // 最近專案 / 範例清單
    // ---------------------------------------------------------------
    function renderRecents() {
        var list = document.getElementById('recent-projects');
        var empty = document.getElementById('recent-empty');
        if (!list) return;

        list.innerHTML = '';
        var recents = store().getRecents();
        if (empty) empty.style.display = recents.length ? 'none' : '';

        recents.forEach(function(item) {
            var row = document.createElement('div');
            row.className = 'dropdown-item recent-item';
            row.setAttribute('data-action', 'open-recent');
            row.setAttribute('data-path', item.path);
            row.setAttribute('title', item.path);

            var icon = document.createElement('img');
            icon.className = 'recent-icon';
            icon.src = 'src/icons/recent.png';
            icon.alt = '';
            row.appendChild(icon);

            var name = document.createElement('span');
            name.textContent = item.name || item.path;
            row.appendChild(name);

            var remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'recent-remove';
            remove.setAttribute('data-action', 'remove-recent');
            remove.setAttribute('data-path', item.path);
            remove.setAttribute('title', text('TLB_REMOVE_RECENT', 'Remove from recent list'));
            remove.textContent = '×';
            row.appendChild(remove);

            list.appendChild(row);
        });
    }

    function renderExamples() {
        var list = document.getElementById('examples-list');
        var empty = document.getElementById('examples-empty');
        if (!list) return;

        list.innerHTML = '';
        if (empty) empty.style.display = examples.length ? 'none' : '';

        examples.forEach(function(example, index) {
            var row = document.createElement('div');
            row.className = 'dropdown-item';
            row.setAttribute('data-action', 'load-example');
            row.setAttribute('data-index', String(index));
            row.textContent = example.title || example.name || example.file;
            list.appendChild(row);
        });
    }

    // ---------------------------------------------------------------
    // 動作派發
    // ---------------------------------------------------------------
    function closeDropdowns() {
        document.querySelectorAll('.toolbar-dropdown.is-open').forEach(function(dropdown) {
            dropdown.classList.remove('is-open');
        });
    }

    function toggleDropdown(target) {
        var dropdown = target.closest('.toolbar-dropdown');
        if (!dropdown) return;
        dropdown.classList.toggle('is-open');
    }

    function saveAndClose() {
        closeDropdowns();
        return projectIO().save({ saveAs: false });
    }

    var ACTIONS = {
        // 檔名膠囊：在檔案總管中顯示目前專案檔
        'reveal-project': function() {
            return projectIO().revealInFileManager();
        },
        'new-project': function() {
            closeDropdowns();
            return projectIO().newProject();
        },
        // 點擊按鈕本身只展開選單；下拉內的「開啟檔案…」才啟動對話框
        'open-project': function(event, element) {
            if (!requireDesktop()) return;
            if (element.id === 'btn-open') {
                toggleDropdown(element);
                return;
            }
            closeDropdowns();
            return projectIO().confirmDiscardIfDirty().then(function(allowed) {
                if (!allowed) return false;
                return projectIO().openProjectDialog();
            });
        },
        'save-project': function() { return saveAndClose(); },
        'save-project-as': function() {
            if (!requireDesktop()) return;
            return projectIO().save({ saveAs: true });
        },
        'copy-code': function() { return projectIO().copyCode(); },
        'open-example': function(event, element) { toggleDropdown(element); },
        'load-example': function(event, element) {
            var index = parseInt(element.getAttribute('data-index'), 10);
            closeDropdowns();
            if (isNaN(index) || !examples[index]) return;
            return projectIO().openExample(examples[index]);
        },
        'open-recent': function(event, element) {
            var path = element.getAttribute('data-path');
            closeDropdowns();
            if (!path) return;
            return projectIO().confirmDiscardIfDirty().then(function(allowed) {
                if (!allowed) return false;
                return projectIO().openPath(path);
            });
        },
        'remove-recent': function(event, element) {
            event.stopPropagation();
            store().removeRecent(element.getAttribute('data-path'));
            renderRecents();
        },
        'clear-recents': function() {
            store().clearRecents();
            renderRecents();
        },
        // 編譯／上傳：委派給 compile controller（單飛由該模組負責）。
        'run-program': function() { return compile().run(); },
        // 「停止」的語意是**取消目前的編譯或上傳作業**；上傳完成後沒有常駐
        // 程序可停（序列監視器屬 T3）。tooltip 由 TLB_STOP_HINT 說明。
        // 'stop-program' 已移除（2026-09-27）：作業已有逾時上限，無需中途取消。
        // 終端機面板
        'toggle-terminal': function() { return terminal().toggle(); },
        'terminal-pause': function() { return terminal().togglePaused(); },
        'terminal-clear': function() { return terminal().clear(); },
        'terminal-close': function() { return terminal().close(); }
    };

    function onClick(event) {
        // 事件採委派監聽，currentTarget 會是 document，因此一律以匹配到的元素為準。
        var element = event.target.closest('[data-action]');
        if (!element) return;
        var action = element.getAttribute('data-action');
        var handler = ACTIONS[action];
        if (handler) {
            event.preventDefault();
            handler(event, element);
        }
    }

    function onDocumentClickOutside(event) {
        if (event.target.closest && event.target.closest('.toolbar-dropdown')) return;
        closeDropdowns();
    }

    /// 檔名膠囊是 role="button"，需支援鍵盤 Enter／Space 觸發。
    function onActionKeyDown(event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        var element = event.target.closest && event.target.closest('[data-action][role="button"]');
        if (!element) return;
        var handler = ACTIONS[element.getAttribute('data-action')];
        if (!handler) return;
        event.preventDefault();
        handler(event, element);
    }

    function onBeforeUnload(event) {
        if (!store().isDirty()) return undefined;
        event.preventDefault();
        event.returnValue = '';
        return '';
    }

    return {
        init: function(options) {
            context = options || {};
            store().subscribe(applyState);
            applyState(store().getState());
            renderRecents();
            document.addEventListener('click', onClick);
            document.addEventListener('click', onDocumentClickOutside);
            document.addEventListener('keydown', onActionKeyDown);
            window.addEventListener('beforeunload', onBeforeUnload);

            return projectIO().loadExamples().then(function(list) {
                examples = list;
                renderExamples();
            });
        },
        refreshRecents: renderRecents,
        applyState: applyState,
        getExamples: function() { return examples; }
    };

})();

if (typeof window !== 'undefined') {
    window.CodeBridgeToolbarUI = CodeBridgeToolbarUI;
}
