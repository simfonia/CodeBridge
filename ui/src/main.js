/// CodeBridge 主程式
/// 職責：Blockly 初始化、程式碼生成、UI 功能、程式碼定位、孤兒積木檢測

// ============================================================
// 全域狀態
// ============================================================
var blockToRangeMap = new Map(); // blockId → {start, end}
var lineDoms = [];               // 程式碼行 DOM 陣列

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
    
    const workspace = Blockly.inject(blocklyDiv, {
        toolbox: toolbox,
        scrollbars: true,
        trashcan: true,
        grid: {
            spacing: 20,
            colour: '#eee',
            snap: true
        }
    });
    
    return workspace;
}

// ============================================================
// 啟動時注入預設 setup + loop 積木
// ============================================================
function injectDefaultBlocks(workspace) {
    Blockly.Events.disable();
    try {
        var defaultXml = '<xml>' +
            '<block type="initializes_setup" x="20" y="20">' +
              '<next>' +
                '<block type="initializes_loop" x="20" y="100"></block>' +
              '</next>' +
            '</block>' +
            '</xml>';
        var dom = Blockly.utils.xml.textToDom(defaultXml);
        Blockly.Xml.domToWorkspace(dom, workspace);
    } finally {
        Blockly.Events.enable();
    }
}

// ============================================================
// 程式碼渲染（含 ID 標記解析）
// ============================================================
function renderCode(code) {
    const codeContent = document.getElementById('codeContent');
    if (!codeContent) return;

    var lines = code.split('\n');
    // 移除最後空行
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

    codeContent.innerHTML = '';
    blockToRangeMap.clear();
    lineDoms = [];

    lines.forEach(function(line, index) {
        // 從 Blockly.Arduino 讀取 ID 標記常數（避免硬編碼）
        var idMarker = (typeof Blockly !== 'undefined' && Blockly.Arduino && Blockly.Arduino.ID_MARKER) ? Blockly.Arduino.ID_MARKER : '// __BLOCKLY_ID:';
        var idMarkerEnd = (typeof Blockly !== 'undefined' && Blockly.Arduino && Blockly.Arduino.ID_MARKER_END) ? Blockly.Arduino.ID_MARKER_END : '__';
        // 收集所有 ID 標記
        var ids = [];
        var idRegex = new RegExp(idMarker + '([^\\s]+)' + idMarkerEnd, 'g');
        var idMatch;
        while ((idMatch = idRegex.exec(line)) !== null) {
            ids.push(idMatch[1]);
        }
        // 移除所有 ID 標記（換行前的那個，保留註解前的程式碼）
        var cleanLine = line.replace(new RegExp(' ' + idMarker + '[^\\s]+' + idMarkerEnd, 'g'), '');

        // 建立行容器
        var lineDiv = document.createElement('div');
        lineDiv.className = 'code-line';
        lineDiv.setAttribute('data-line-index', index);
        lineDoms.push(lineDiv);

        // 語法高亮
        if (cleanLine.length > 0) {
            var highlighted = hljs.highlight(cleanLine, { language: 'arduino' }).value;
            lineDiv.innerHTML = highlighted;
        } else {
            lineDiv.innerHTML = '&nbsp;';
        }

        // 更新範圍映射表
        ids.forEach(function(id) {
            if (!blockToRangeMap.has(id)) {
                blockToRangeMap.set(id, { start: index, end: index });
            } else {
                blockToRangeMap.get(id).end = index;
            }
        });

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
var scopeDefiningRootBlocks = [
    'initializes_setup',
    'initializes_loop',
    'coding_include',
    'coding_comment',
    'coding_raw_definition',
    'array_declare_global',
    'custom_functions_defreturn',
    'custom_functions_defnoreturn'
];

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
            textLeft.style.color = isEn ? '#666' : '#FE2F89';
            textLeft.style.fontWeight = isEn ? '400' : '700';
        }
        if (textRight) {
            textRight.style.color = isEn ? '#FE2F89' : '#666';
            textRight.style.fontWeight = isEn ? '700' : '400';
        }
    }
    
    updateLabels(langToggle.checked);
    
    langToggle.addEventListener('change', function() {
        const isEn = this.checked;
        const newLang = isEn ? 'en' : 'zh-hant';
        updateLabels(isEn);
        localStorage.setItem('codebridgeLang', newLang);
        // 儲存當前工作區 XML 到 sessionStorage，避免 reload 後遺失
        var ws = Blockly.getMainWorkspace();
        if (ws) {
            var xmlDom = Blockly.Xml.workspaceToDom(ws);
            var xmlText = Blockly.Xml.domToText(xmlDom);
            sessionStorage.setItem('codebridgeWorkspaceXml', xmlText);
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
    
    const savedTheme = localStorage.getItem('codebridgeTheme') || 'engineer';
    themeToggle.checked = (savedTheme === 'angel');
    
    function updateLabels(isAngel) {
        if (textLeft) {
            textLeft.style.color = isAngel ? '#666' : '#FE2F89';
            textLeft.style.fontWeight = isAngel ? '400' : '700';
        }
        if (textRight) {
            textRight.style.color = isAngel ? '#FE2F89' : '#666';
            textRight.style.fontWeight = isAngel ? '700' : '400';
        }
    }
    
    function applyTheme(isAngel) {
        const newTheme = isAngel ? 'angel' : 'engineer';
        updateLabels(isAngel);
        localStorage.setItem('codebridgeTheme', newTheme);
        if (typeof window.setBlockStyle === 'function') {
            window.setBlockStyle(newTheme);
        }
        console.log('Theme switched to:', newTheme);
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
    
    // 1. 載入積木訊息（根據語系 + 風格）
    if (window.CodeBridgeBlocklyLoader) {
        const locale = window.CodeBridgeBlocklyLoader.init();
        
        // 套用風格
        const savedTheme = localStorage.getItem('codebridgeTheme') || 'engineer';
        if (savedTheme === 'engineer' && typeof window.setBlockStyle === 'function') {
            window.setBlockStyle('engineer');
        }
    }
    
    // 2. UI i18n (工具列、選單)
    if (window.CodeBridgeI18n) {
        window.CodeBridgeI18n.init();
    }
    
    // 3. Blockly 工作區
    const workspace = initBlockly();
    
    // 4. 注入積木（優先使用 sessionStorage 中的暫存資料，否則注入預設）
    var savedXml = sessionStorage.getItem('codebridgeWorkspaceXml');
    if (savedXml) {
        sessionStorage.removeItem('codebridgeWorkspaceXml');
        Blockly.Events.disable();
        try {
            var dom = Blockly.utils.xml.textToDom(savedXml);
            Blockly.Xml.domToWorkspace(dom, workspace);
        } finally {
            Blockly.Events.enable();
        }
    } else {
        injectDefaultBlocks(workspace);
    }
    
    // 5. 程式碼更新監聽
    workspace.addChangeListener(function(event) {
        if (event && event.isUiEvent) return;
        updateCode(workspace);
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
    initCodeToggle();
    initPanelResizer();
    
    console.log('[CodeBridge] Initialized successfully');
});