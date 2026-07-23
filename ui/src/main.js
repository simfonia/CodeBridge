/// CodeBridge 主程式
/// 職責：Blockly 初始化、程式碼生成、UI 功能

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
// 程式碼生成
// ============================================================
function updateCode(workspace) {
    let code = '';
    if (typeof Blockly.Arduino !== 'undefined' && Blockly.Arduino.workspaceToCode) {
        code = Blockly.Arduino.workspaceToCode(workspace);
    } else {
        code = generateArduinoCode(workspace);
    }
    
    const codeContent = document.getElementById('codeContent');
    if (codeContent) {
        codeContent.textContent = code;
        if (typeof hljs !== 'undefined') {
            codeContent.innerHTML = hljs.highlight(code, { language: 'arduino' }).value;
        }
    }
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
    const blocklyDiv = document.getElementById('blocklyDiv');
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
    
    // 4. 程式碼更新監聽
    workspace.addChangeListener(function() {
        updateCode(workspace);
    });
    updateCode(workspace);
    
    // 5. UI 功能
    initLangToggle();
    initThemeToggle();
    initCodeToggle();
    initPanelResizer();
    
    console.log('[CodeBridge] Initialized successfully');
});