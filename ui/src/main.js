/// CodeBridge 前端主入口
/// 負責初始化 Blockly 編輯器

// 初始化 Blockly 工作區
function initBlockly() {
    const blocklyDiv = document.getElementById('blocklyDiv');
    const toolboxXml = document.getElementById('toolbox-xml');
    
    // 讀取 toolbox XML
    let toolbox;
    if (toolboxXml) {
        // 取得 XML 內容
        const serializer = new XMLSerializer();
        const xmlChildren = Array.from(toolboxXml.children);
        const xmlContent = xmlChildren.map(child => serializer.serializeToString(child)).join('\n');
        toolbox = `<xml>\n${xmlContent}\n</xml>`;
    } else {
        toolbox = `<xml><category name="Arduino" colour="180"></category></xml>`;
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
    
    // 註冊 Arduino 產生器
    if (typeof Blockly.Arduino !== 'undefined') {
        // 產生器已由 blocks.js 載入
        console.log('Arduino generators loaded');
    }
    
    return workspace;
}

// Arduino 程式碼生成
function generateArduinoCode(workspace) {
    // 簡單的 Arduino 程式碼生成
    const blocks = workspace.getTopBlocks(true);
    let code = '';
    
    for (const block of blocks) {
        code += generateBlockCode(block);
    }
    
    return code;
}

function generateBlockCode(block) {
    const type = block.type;
    let code = '';
    
    switch (type) {
        case 'arduino_pin_mode':
            const pin = block.getFieldValue('PIN') || '13';
            const mode = block.getFieldValue('MODE');
            code = `pinMode(${pin}, ${mode});\n`;
            break;
        case 'arduino_digital_write':
            const pin2 = block.getFieldValue('PIN') || '13';
            const value = block.getFieldValue('VALUE');
            code = `digitalWrite(${pin2}, ${value});\n`;
            break;
        case 'arduino_digital_read':
            code = `digitalRead(${block.getFieldValue('PIN') || '13'});\n`;
            break;
        case 'arduino_analog_write':
            code = `analogWrite(${block.getFieldValue('PIN') || '9'}, ${block.getFieldValue('VALUE') || '128'});\n`;
            break;
        case 'arduino_analog_read':
            code = `analogRead(${block.getFieldValue('PIN') || 'A0'});\n`;
            break;
        case 'arduino_delay':
            code = `delay(${block.getFieldValue('TIME') || '1000'});\n`;
            break;
        case 'arduino_serial_print':
            code = `Serial.print(${block.getFieldValue('VALUE') || '""'});\n`;
            break;
        default:
            // 遞迴處理子積木
            const children = block.getChildren();
            for (const child of children) {
                code += generateBlockCode(child);
            }
    }
    
    return code;
}

// 程式碼生成與顯示
function updateCode(workspace) {
    const code = generateArduinoCode(workspace);
    const codeContent = document.getElementById('codeContent');
    if (codeContent) {
        codeContent.textContent = code;
        // 套用語法高亮
        if (typeof hljs !== 'undefined') {
            codeContent.innerHTML = hljs.highlight(code, { language: 'arduino' }).value;
        }
    }
}

// === 中英文語系切換功能 ===
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
    
    function applyLang(isEn) {
        const newLang = isEn ? 'en' : 'zh-hant';
        updateLabels(isEn);
        localStorage.setItem('codebridgeLang', newLang);
        console.log('Language switched to:', newLang);
        location.reload();
    }
    
    updateLabels(langToggle.checked);
    
    langToggle.addEventListener('change', function() {
        applyLang(this.checked);
    });
    
    if (menuItem) {
        menuItem.addEventListener('click', function(e) {
            if (e.target.closest('.switch')) return;
            langToggle.checked = !langToggle.checked;
            applyLang(langToggle.checked);
        });
    }
}

// === 雙風格切換功能 ===
function initThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    const textLeft = document.getElementById('themeTextLeft');
    const textRight = document.getElementById('themeTextRight');
    const menuItem = document.getElementById('btn-theme-toggle');
    if (!themeToggle) return;
    
    // 預設 Engineer 風格
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
        
        // 切換 Blockly 主題
        if (typeof Blockly !== 'undefined') {
            const ws = Blockly.getMainWorkspace();
            if (ws && ws.setTheme) {
                ws.setTheme(Blockly.Themes.Classic);
            }
        }
        console.log('Theme switched to:', newTheme);
    }
    
    // 初始狀態
    updateLabels(themeToggle.checked);
    
    // checkbox change event
    themeToggle.addEventListener('change', function() {
        applyTheme(this.checked);
    });
    
    // 點擊選單項目時切換 (因為 label pointer-events: none)
    if (menuItem) {
        menuItem.addEventListener('click', function(e) {
            if (e.target.closest('.switch')) return;
            themeToggle.checked = !themeToggle.checked;
            applyTheme(themeToggle.checked);
        });
    }
}

// === 程式碼面板收合功能 ===
function initCodeToggle() {
    const codeToggle = document.getElementById('code-toggle');
    const codeArea = document.getElementById('codeArea');
    const blocklyDiv = document.getElementById('blocklyDiv');
    if (!codeToggle || !codeArea) return;
    
    codeToggle.addEventListener('click', function() {
        const isCollapsed = codeArea.classList.toggle('collapsed');
        codeToggle.querySelector('.arrow').textContent = isCollapsed ? '◀' : '▶';
        // 觸發 Blockly 重新計算大小
        if (typeof Blockly !== 'undefined') {
            setTimeout(function() {
                Blockly.svgResize(Blockly.getMainWorkspace());
            }, 350);
        }
    });
}

// === 面板拖曳調整寬度功能 ===
function initPanelResizer() {
    const resizer = document.getElementById('panel-resizer');
    const codeArea = document.getElementById('codeArea');
    const blocklyArea = document.getElementById('blocklyArea');
    if (!resizer || !codeArea) return;
    
    let isDragging = false;
    let startX = 0;
    let startWidth = 0;
    
    function onMouseDown(e) {
        if (codeArea.classList.contains('collapsed')) return;
        isDragging = true;
        startX = e.clientX;
        startWidth = codeArea.offsetWidth;
        resizer.classList.add('is-dragging');
        document.body.classList.add('resizing-panel');
        e.preventDefault();
    }
    
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
        // 觸發 Blockly 重新計算大小
        if (typeof Blockly !== 'undefined') {
            Blockly.svgResize(Blockly.getMainWorkspace());
        }
    }
    
    resizer.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

// 初始化應用程式
document.addEventListener('DOMContentLoaded', function() {
    console.log('CodeBridge initializing...');
    
    // 初始化 i18n (必須在 Blockly 初始化之前，註冊翻譯到 Blockly.Msg)
    if (window.CodeBridgeI18n) {
        window.CodeBridgeI18n.init();
    }
    
    // 初始化 Blockly
    const workspace = initBlockly();
    
    // 監聽積木變更
    workspace.addChangeListener(function() {
        updateCode(workspace);
    });
    
    // 初始程式碼生成
    updateCode(workspace);
    
    // 初始化語系切換 (在 i18n 之後載入，取得當前語系狀態)
    initLangToggle();
    
    // 初始化面板功能
    initThemeToggle();
    initCodeToggle();
    initPanelResizer();
    
    console.log('CodeBridge initialized successfully');
});
