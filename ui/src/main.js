/// CodeBridge 主程式
/// 職責：Blockly 初始化、程式碼生成、UI 功能、程式碼定位、孤兒積木檢測

// ============================================================
// 全域狀態
// ============================================================
var blockToRangeMap = new Map(); // blockId → {start, end}
var lineDoms = [];               // 程式碼行 DOM 陣列
var currentMarkedCode = '';      // 最近一次產生的 marked code（含 ID 標記）
var projectStore = null;         // CodeBridgeProject store（.cbg 專案狀態）

/// dirty 判斷使用 debounce，避免拖曳積木時過度序列化工作區。
var dirtyTimer = null;
function scheduleDirtyCheck(workspace) {
    if (dirtyTimer) clearTimeout(dirtyTimer);
    dirtyTimer = setTimeout(function() {
        dirtyTimer = null;
        if (!projectStore || !window.CodeBridgeProjectIO) return;
        var snapshot = window.CodeBridgeProjectIO.serializeWorkspace();
        projectStore.refresh(snapshot);
        projectStore.setDraft(snapshot);
    }, 150);
}

// ============================================================
// Blockly 初始化
// ============================================================
function initBlockly() {
    const blocklyDiv = document.getElementById('blocklyDiv');
    const toolboxXml = document.getElementById('toolbox-xml');
    
    let toolbox;
    if (toolboxXml) {
        const serializer = new XMLSerializer();
        const xmlChildren = Array.from(toolboxXml.children);
        const xmlContent = xmlChildren.map(child => serializer.serializeToString(child)).join('\n');
        toolbox = '<xml>\n' + xmlContent + '\n</xml>';
    } else {
        toolbox = '<xml><category name="Arduino" colour="#016c8d"></category></xml>';
    }
    
    // Blockly v12+：必須手動註冊工作區註解的右鍵選單
    // 否則右鍵工作區空白處不會出現 "Add comment" 選項
    if (typeof Blockly.ContextMenuItems !== 'undefined' &&
        typeof Blockly.ContextMenuItems.registerCommentOptions === 'function') {
        Blockly.ContextMenuItems.registerCommentOptions();
    }

    // Blockly v13 明確選用 Thrasos renderer，避免未來預設 renderer 變更造成 UI 差異。
    // 同時停用 connect／disconnect／delete／drop 等所有 Blockly 操作音效。
    const activeVisualTheme = window.CodeBridgeTheme
        ? window.CodeBridgeTheme.getDefinition().visualTheme
        : 'technology-dark';
    const blocklyTheme = window.CodeBridgeBlocklyTheme
        ? window.CodeBridgeBlocklyTheme.getTheme(activeVisualTheme)
        : Blockly.Themes.Classic;
    const blocklyGridColour = window.CodeBridgeBlocklyTheme
        ? window.CodeBridgeBlocklyTheme.getGridColour()
        : '#26364d';
    const workspace = Blockly.inject(blocklyDiv, {
        toolbox: toolbox,
        theme: blocklyTheme,
        renderer: 'thrasos',
        sounds: false,
        scrollbars: true,
        trashcan: true,
        comments: true,
        workspaceComments: true,
        zoom: {
            controls: true,
            wheel: true,
            startScale: 1,
            maxScale: 3,
            minScale: 0.3,
            scaleSpeed: 1.2
        },
        grid: {
            spacing: 20,
            length: 0,
            colour: blocklyGridColour,
            snap: true
        }
    });
    
    return workspace;
}

// ============================================================
// 啟動時注入預設 setup + loop 積木
// ============================================================
function injectDefaultBlocks(workspace) {
    var defaultXml = '<xml>' +
        '<block type="initializes_setup" x="20" y="20">' +
          '<next>' +
            '<block type="initializes_loop" x="20" y="100"></block>' +
          '</next>' +
        '</block>' +
        '</xml>';
    CodeBridgeBlocklyXml.textToWorkspace(defaultXml, workspace);
    workspace.updateAriaLabel();
}

// ============================================================
// 程式碼渲染（含 ID 標記解析）
// ============================================================
function renderCode(code) {
    const codeContent = document.getElementById('codeContent');
    if (!codeContent) return;

    // ID 標記的解析與去除規則由 CodeBridgePlainCode 提供，
    // 讓預覽面板、複製到剪貼簿與 compile/upload 共用同一套實作。
    var plainCode = window.CodeBridgePlainCode;
    var patterns = plainCode.buildPatterns();

    codeContent.innerHTML = '';
    blockToRangeMap.clear();
    lineDoms = [];

    // 1. 分行處理 ID 標記（從原始程式碼中提取）
    var rawLines = code.split('\n');
    if (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') rawLines.pop();

    var cleanedLines = [];
    rawLines.forEach(function(line, index) {
        // 收集所有 ID 標記
        plainCode.extractIds(line).forEach(function(id) {
            if (!blockToRangeMap.has(id)) {
                blockToRangeMap.set(id, { start: index, end: index });
            } else {
                blockToRangeMap.get(id).end = index;
            }
        });
        // 移除所有 ID 標記
        cleanedLines.push(plainCode.stripLine(line, patterns));
    });

    // 2. 一次性高亮完整程式碼（確保跨行語法結構正確解析）
    var fullCode = cleanedLines.join('\n');
    var highlightedHtml = '';
    if (fullCode.length > 0) {
        var result = hljs.highlight(fullCode, { language: 'arduino' });
        highlightedHtml = result.value;
    }

    // 3. 分行處理 HTML，追蹤跨行標籤
    var hlLines = highlightedHtml.split('\n');
    if (hlLines.length > 0 && hlLines[hlLines.length - 1] === '') hlLines.pop();

    var tagStack = []; // 追蹤跨行開啟的 HTML 標籤

    hlLines.forEach(function(line, index) {
        // 建立行容器
        var lineDiv = document.createElement('div');
        lineDiv.className = 'code-line';
        lineDiv.setAttribute('data-line-index', index);
        lineDoms.push(lineDiv);

        if (line.length > 0) {
            // 關閉所有目前開啟的標籤（反向順序），再重新開啟
            // 確保每行的 HTML 結構完整，不因跨行 <span> 而斷裂
            var closeTags = '';
            for (var i = tagStack.length - 1; i >= 0; i--) {
                closeTags += '</' + tagStack[i] + '>';
            }
            var reopenTags = '';
            for (var i = 0; i < tagStack.length; i++) {
                reopenTags += '<' + tagStack[i] + '>';
            }

            lineDiv.innerHTML = closeTags + line + reopenTags;

            // 更新 tagStack：掃描此行中的 HTML 標籤
            var tagRegex = /<\/?([a-zA-Z0-9-]+)(?:\s[^>]*)?>/g;
            var match;
            while ((match = tagRegex.exec(line)) !== null) {
                var fullTag = match[0];
                var tagName = match[1];
                if (fullTag.startsWith('</')) {
                    // 關閉標籤：從 stack 中移除最後一個匹配
                    var idx = tagStack.lastIndexOf(tagName);
                    if (idx !== -1) {
                        tagStack.splice(idx, 1);
                    }
                } else if (!fullTag.endsWith('/>')) {
                    // 開啟標籤（非自閉合）
                    tagStack.push(tagName);
                }
            }
        } else {
            lineDiv.innerHTML = '&nbsp;';
        }

        codeContent.appendChild(lineDiv);
    });

    // 同步目前的選取狀態
    var selectedBlock = Blockly.getSelected ? Blockly.getSelected() : null;
    if (selectedBlock) {
        syncSelection(selectedBlock.id);
    }
}

// ============================================================
// 程式碼生成
// ============================================================
function updateCode(workspace) {
    var code = '';
    if (typeof Blockly.Arduino !== 'undefined' && Blockly.Arduino.workspaceToCode) {
        code = Blockly.Arduino.workspaceToCode(workspace);
    } else {
        code = generateArduinoCode(workspace);
    }
    // 保留 marked code 供「複製程式碼」使用；複製時才去除 ID 標記。
    currentMarkedCode = code;
    renderCode(code);
}

function generateArduinoCode(workspace) {
    const blocks = workspace.getTopBlocks(true);
    let code = '';
    for (const block of blocks) {
        if (Blockly.Arduino && Blockly.Arduino.forBlock && Blockly.Arduino.forBlock[block.type]) {
            const result = Blockly.Arduino.forBlock[block.type](block);
            if (typeof result === 'string') {
                code += result;
            }
        }
    }
    return code;
}

// ============================================================
// 程式碼定位：遞迴尋找可定位的父積木
// ============================================================
function findLocatableBlock(block) {
    if (!block) return null;
    // 如果是 value 積木（有 output），遞迴往上找父積木
    if (block.outputConnection) {
        var parent = block.getParent();
        if (parent) return findLocatableBlock(parent);
    }
    return block;
}

function syncSelection(blockId) {
    // 移除所有現有高亮
    document.querySelectorAll('.highlight-line').forEach(function(el) {
        el.classList.remove('highlight-line');
    });

    if (!blockId) return;

    // 遞迴尋找可定位的父積木
    var ws = Blockly.getMainWorkspace();
    if (!ws) return;
    var block = ws.getBlockById(blockId);
    if (!block) return;
    var locatableBlock = findLocatableBlock(block);
    if (!locatableBlock) return;

    var range = blockToRangeMap.get(locatableBlock.id);
    if (range && lineDoms.length > 0) {
        // 高亮範圍內的所有行
        for (var i = range.start; i <= range.end; i++) {
            if (lineDoms[i]) lineDoms[i].classList.add('highlight-line');
        }

        // 捲動到起始行
        var startLine = lineDoms[range.start];
        if (startLine) {
            startLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

// ============================================================
// 孤兒積木檢測
// ============================================================

function updateOrphanBlocks(event) {
    var ws = Blockly.getMainWorkspace();
    if (!ws) return;

    // 如果正在拖曳，稍後再處理
    if (ws.isDragging()) return;

    // 忽略 UI 事件或 disabled 狀態變更
    if (event.isUiEvent || (event.type === 'change' && event.element === 'disabled')) return;

    Blockly.Events.setGroup(true);
    try {
        var allBlocks = ws.getAllBlocks(true);

        // 先全部啟用
        allBlocks.forEach(function(block) {
            if (typeof block.setDisabledReason === 'function') {
                block.setDisabledReason(false, 'orphan');
            } else {
                block.setEnabled(true);
            }
        });

        // 檢查 top blocks 是否為允許的根層級類型
        // 使用 Blockly.Arduino.scopeDefiningRootBlocks（定義在 _core.js）
        var scopeDefiningRootBlocks = Blockly.Arduino.scopeDefiningRootBlocks || [];
        var topBlocks = ws.getTopBlocks(true);
        topBlocks.forEach(function(topBlock) {
            if (scopeDefiningRootBlocks.indexOf(topBlock.type) === -1) {
                // 不是允許的根層級積木，設為 disabled
                topBlock.getDescendants(false).forEach(function(desc) {
                    if (typeof desc.setDisabledReason === 'function') {
                        desc.setDisabledReason(true, 'orphan');
                    } else {
                        desc.setEnabled(false);
                    }
                });
            }
        });
    } finally {
        Blockly.Events.setGroup(false);
    }
}

// ============================================================
// 語系切換
// ============================================================
function initLangToggle() {
    const langToggle = document.getElementById('langToggle');
    const textLeft = document.getElementById('langTextLeft');
    const textRight = document.getElementById('langTextRight');
    const menuItem = document.getElementById('btn-lang-toggle');
    if (!langToggle) return;
    
    const currentLang = localStorage.getItem('codebridgeLang') || 
        (navigator.language && navigator.language.startsWith('zh') ? 'zh-hant' : 'en');
    langToggle.checked = (currentLang === 'en');
    
    function updateLabels(isEn) {
        if (textLeft) {
            textLeft.classList.toggle('is-selected', !isEn);
        }
        if (textRight) {
            textRight.classList.toggle('is-selected', isEn);
        }
    }
    
    updateLabels(langToggle.checked);
    
    langToggle.addEventListener('change', function() {
        const isEn = this.checked;
        const newLang = isEn ? 'en' : 'zh-hant';
        updateLabels(isEn);
        localStorage.setItem('codebridgeLang', newLang);
        // 切換語系會重載頁面，先把目前工作區寫入專案草稿避免遺失
        if (projectStore && window.CodeBridgeProjectIO) {
            projectStore.setDraft(window.CodeBridgeProjectIO.serializeWorkspace());
        }
        console.log('Language switched to:', newLang);
        location.reload();
    });
    
    if (menuItem) {
        menuItem.addEventListener('click', function(e) {
            if (e.target.closest('.switch')) return;
            langToggle.checked = !langToggle.checked;
            langToggle.dispatchEvent(new Event('change'));
        });
    }
}

// ============================================================
// 雙風格切換
// ============================================================
function initThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    const textLeft = document.getElementById('themeTextLeft');
    const textRight = document.getElementById('themeTextRight');
    const menuItem = document.getElementById('btn-theme-toggle');
    if (!themeToggle) return;
    
    const savedPreset = localStorage.getItem('codebridgeExperiencePreset') || 'engineer';
    themeToggle.checked = (savedPreset === 'angel');
    
    function updateLabels(isAngel) {
        if (textLeft) {
            textLeft.classList.toggle('is-selected', !isAngel);
        }
        if (textRight) {
            textRight.classList.toggle('is-selected', isAngel);
        }
    }
    
    function applyTheme(isAngel) {
        const preset = isAngel ? 'angel' : 'engineer';
        updateLabels(isAngel);
        if (window.CodeBridgeTheme && typeof window.CodeBridgeTheme.setPreset === 'function') {
            window.CodeBridgeTheme.setPreset(preset);
        }
        console.log('Experience preset switched to:', preset);
    }
    
    updateLabels(themeToggle.checked);
    
    themeToggle.addEventListener('change', function() {
        applyTheme(this.checked);
    });
    
    if (menuItem) {
        menuItem.addEventListener('click', function(e) {
            if (e.target.closest('.switch')) return;
            themeToggle.checked = !themeToggle.checked;
            themeToggle.dispatchEvent(new Event('change'));
        });
    }
}

// ============================================================
// 程式碼面板收合
// ============================================================
function initCodeToggle() {
    const codeToggle = document.getElementById('code-toggle');
    const codeArea = document.getElementById('codeArea');
    if (!codeToggle || !codeArea) return;
    
    codeToggle.addEventListener('click', function() {
        const isCollapsed = codeArea.classList.toggle('collapsed');
        codeToggle.querySelector('.arrow').textContent = isCollapsed ? '◀' : '▶';
        if (typeof Blockly !== 'undefined') {
            setTimeout(function() {
                Blockly.svgResize(Blockly.getMainWorkspace());
            }, 350);
        }
    });
}

// ============================================================
// 面板拖曳調整
// ============================================================
function initPanelResizer() {
    const resizer = document.getElementById('panel-resizer');
    const codeArea = document.getElementById('codeArea');
    const blocklyArea = document.getElementById('blocklyArea');
    if (!resizer || !codeArea) return;
    
    let isDragging = false;
    
    function onMouseDown(e) {
        if (codeArea.classList.contains('collapsed')) return;
        isDragging = true;
        startX = e.clientX;
        startWidth = codeArea.offsetWidth;
        resizer.classList.add('is-dragging');
        document.body.classList.add('resizing-panel');
        e.preventDefault();
    }
    
    let startX = 0;
    let startWidth = 0;
    
    function onMouseMove(e) {
        if (!isDragging) return;
        const dx = startX - e.clientX;
        const newWidth = Math.max(200, Math.min(800, startWidth + dx));
        codeArea.style.width = newWidth + 'px';
        blocklyArea.style.flex = '1 1 0';
    }
    
    function onMouseUp() {
        if (!isDragging) return;
        isDragging = false;
        resizer.classList.remove('is-dragging');
        document.body.classList.remove('resizing-panel');
        if (typeof Blockly !== 'undefined') {
            Blockly.svgResize(Blockly.getMainWorkspace());
        }
    }
    
    resizer.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

// ============================================================
// 初始化
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('[CodeBridge] Initializing...');
    
    // 1. 載入積木訊息（根據語系 + Engineer／Angel 體驗 preset）
    if (window.CodeBridgeTheme) {
        window.CodeBridgeTheme.init();
    }
    if (window.CodeBridgeBlocklyLoader) {
        window.CodeBridgeBlocklyLoader.init();
    }
    
    // 2. UI i18n (工具列、選單)
    if (window.CodeBridgeI18n) {
        window.CodeBridgeI18n.init();
    }
    
    // 3. Blockly 工作區
    const workspace = initBlockly();
    if (window.CodeBridgeTheme) {
        window.CodeBridgeTheme.attachWorkspace(workspace);
    }
    if (window.CodeBridgeBlockSearch) {
        window.CodeBridgeBlockSearch.init(workspace);
    }
    
    // 4. 專案狀態（.cbg）與工作區還原
    //    還原優先序：未儲存草稿 > 最後儲存的工作區快照 > 預設 setup + loop 積木。
    //    草稿與快照的差異由 store 以字串比對決定 dirty，因此使用者關掉分頁也不會遺失進度。
    projectStore = window.CodeBridgeProject.createStore();
    window.CodeBridgeProjectIO.init({
        store: projectStore,
        getWorkspace: function() { return workspace; },
        getCode: function() { return currentMarkedCode; },
        injectDefaultBlocks: function() { injectDefaultBlocks(workspace); },
        onWorkspaceReloaded: function() { updateCode(workspace); }
    });

    var initialState = projectStore.getState();
    var savedSnapshot = projectStore.getSnapshot();
    var draft = projectStore.getDraft();
    var restoreText = draft || savedSnapshot;

    if (restoreText) {
        CodeBridgeBlocklyXml.textToWorkspace(restoreText, workspace);
        workspace.updateAriaLabel();
    } else {
        injectDefaultBlocks(workspace);
    }

    // 建立乾淨基準（有路徑則沿用，路徑為空代表未命名專案），再比對現況標記 dirty。
    projectStore.markSaved({
        path: initialState.path,
        name: initialState.name,
        snapshot: savedSnapshot || window.CodeBridgeProjectIO.serializeWorkspace(),
        meta: initialState.meta
    });
    projectStore.refresh(window.CodeBridgeProjectIO.serializeWorkspace());
    
    // 5. 程式碼更新監聽 + dirty 判斷（debounce 150ms）
    workspace.addChangeListener(function(event) {
        if (event && event.isUiEvent) return;
        updateCode(workspace);
        scheduleDirtyCheck(workspace);
    });
    
    // 6. 孤兒積木檢測
    workspace.addChangeListener(updateOrphanBlocks);
    
    // 7. 程式碼定位監聽
    workspace.addChangeListener(function(event) {
        if (event.type === Blockly.Events.SELECTED) {
            syncSelection(event.newElementId);
        }
    });
    
    // 8. 初始程式碼生成
    updateCode(workspace);
    
    // 9. 練習模式初始化
    if (typeof initPracticeMode === 'function') {
        initPracticeMode(workspace);
    }
    
    // 10. UI 功能
    initLangToggle();
    initThemeToggle();
    if (window.CodeBridgeTheme) {
        window.CodeBridgeTheme.setPreset(window.CodeBridgeTheme.getPreset());
    }
    initCodeToggle();
    initPanelResizer();
    
    // 11. 工具列（.cbg 專案 I/O、dirty 指示、最近專案與範例）
    if (window.CodeBridgeToolbarUI) {
        window.CodeBridgeToolbarUI.init({ store: projectStore });
    }

    console.log('[CodeBridge] Initialized successfully');
});