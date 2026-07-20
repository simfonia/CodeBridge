/// CodeBridge 前端主入口
/// 負責初始化 Blockly 編輯器

// ============================================================
// 積木訊息定義（繁體中文 - Angel 風格基底）
// 色碼對齊 piBlockly
// ============================================================
const ZH_HANT_MESSAGES = {
  'ARDUINO_STRUCTURE_HUE': '#585858',
  'ARDUINO_CONTROL_HUE': '#016c8d',
  'ARDUINO_DIGITAL_IO_HUE': '#0f960a',
  'ARDUINO_ANALOG_IO_HUE': '#FF9800',
  'ARDUINO_TIME_HUE': '#1f039b',
  'ARDUINO_SERIAL_HUE': '#359AFF',
  'ARDUINO_IO_HUE': '#016c8d',
  'CODING_HUE': '#585858',
  'LOGIC_HUE': '#b198de',
  'LOOPS_HUE': '#7fcd81',
  'MATH_HUE': '#5C68A6',
  'TEXT_HUE': '#6a8871',
  'VARIABLES_HUE': '#ef9a9a',
  'ARRAY_HUE': '#d1972b',
  'FUNCTIONS_HUE': '#d22f73',

  'ARDUINO_CATEGORY': 'Arduino',
  'ARDUINO_STRUCTURE_CATEGORY': '結構',
  'ARDUINO_IO_CATEGORY': '輸入/輸出',
  'ARDUINO_TIME_CATEGORY': '時間',
  'ARDUINO_SERIAL_CATEGORY': '序列埠',
  'CODING_CATEGORY': '程式碼',
  'LOGIC_CATEGORY': '邏輯',
  'LOOPS_CATEGORY': '迴圈',
  'MATH_CATEGORY': '數學',
  'TEXT_CATEGORY': '文字',
  'VARIABLES_CATEGORY': '變數',
  'ARRAY_CATEGORY': '陣列',
  'FUNCTIONS_CATEGORY': '函式',

  'ARDUINO_PIN_LABEL': '腳位',

  'ARDUINO_PIN_MODE': '設定腳位 %1 為 %2',
  'ARDUINO_DIGITAL_WRITE': '數位寫入腳位 %1 狀態 %2',
  'ARDUINO_DIGITAL_READ': '數位讀取腳位 %1',
  'ARDUINO_ANALOG_WRITE': '類比寫入腳位 %1 值 %2',
  'ARDUINO_ANALOG_READ': '類比讀取腳位 %1',
  'ARDUINO_DELAY': '延遲 %1 毫秒',
  'ARDUINO_DELAY_MICROSECONDS': '延遲 %1 微秒',
  'ARDUINO_MILLIS': '取得開機毫秒數',
  'ARDUINO_MICROS': '取得開機微秒數',

  'ARDUINO_PIN_MODE_OUTPUT': '輸出',
  'ARDUINO_PIN_MODE_INPUT': '輸入',
  'ARDUINO_PIN_MODE_INPUT_PULLUP': '輸入拉高',
  'ARDUINO_DIGITAL_HIGH': '高',
  'ARDUINO_DIGITAL_LOW': '低',

  'ARDUINO_PIN_MODE_TOOLTIP': '設定指定腳位為輸入或輸出模式。',
  'ARDUINO_DIGITAL_WRITE_TOOLTIP': '設定指定腳位為高電位 (HIGH) 或低電位 (LOW)。',
  'ARDUINO_DIGITAL_READ_TOOLTIP': '讀取指定腳位的數位狀態（HIGH 或 LOW）。',
  'ARDUINO_ANALOG_WRITE_TOOLTIP': '在指定腳位上輸出 PWM 類比數值（0-255）。',
  'ARDUINO_ANALOG_READ_TOOLTIP': '讀取指定類比腳位的電壓值（0-1023）。',
  'ARDUINO_DELAY_TOOLTIP': '暫停程式執行指定的毫秒數。1000 毫秒 = 1 秒。',
  'ARDUINO_DELAY_MICROSECONDS_TOOLTIP': '暫停程式執行指定的微秒數。1000 微秒 = 1 毫秒。',
  'ARDUINO_MILLIS_TOOLTIP': '回傳 Arduino 開發板啟動以來的毫秒數。',
  'ARDUINO_MICROS_TOOLTIP': '回傳 Arduino 開發板啟動以來的微秒數。',

  'ARDUINO_SERIAL_BEGIN': '序列埠初始化 鮑率 %1',
  'ARDUINO_SERIAL_PRINT': '序列輸出 %1',
  'ARDUINO_SERIAL_PRINTLN': '序列輸出換行 %1',
  'ARDUINO_SERIAL_AVAILABLE': '序列埠可讀取位元組數',
  'ARDUINO_SERIAL_READ': '序列埠讀取一個位元組',
  'ARDUINO_SERIAL_PRINT_NEWLINE': '序列輸出空一行',

  'ARDUINO_SERIAL_BEGIN_TOOLTIP': '初始化序列通訊並設定傳輸速率（鮑率）。常見值：9600。',
  'ARDUINO_SERIAL_PRINT_TOOLTIP': '透過序列埠輸出資料（不換行）。',
  'ARDUINO_SERIAL_PRINTLN_TOOLTIP': '透過序列埠輸出資料並換行。',
  'ARDUINO_SERIAL_AVAILABLE_TOOLTIP': '取得序列埠緩衝區中可讀取的位元組數。',
  'ARDUINO_SERIAL_READ_TOOLTIP': '讀取序列埠的第一個可用的位元組（-1 表示無資料）。',

  'INITIALIZES_SETUP_APPENDTEXT': 'void setup()',
  'INITIALIZES_LOOP_APPENDTEXT': 'void loop()',
  'INITIALIZES_SETUP_TOOLTIP': 'Arduino 的 setup() 函式。此處的程式碼只在開發板啟動時執行一次。',
  'INITIALIZES_LOOP_TOOLTIP': 'Arduino 的 loop() 函式。此處的程式碼會不斷重複執行。',

  'CONTROLS_IF_MSG_IF': '如果',
  'CONTROLS_IF_MSG_THEN': '則',
  'CONTROLS_IF_MSG_ELSEIF': '否則如果',
  'CONTROLS_IF_MSG_ELSE': '否則',
  'CONTROLS_IF_TOOLTIP': '如果條件成立則執行指定的程式碼。',
  'LOGIC_COMPARE_MESSAGE': '%1 %2 %3',
  'LOGIC_OPERATION_MESSAGE': '%1 %2 %3',
  'LOGIC_NEGATE_MESSAGE': '不成立 (%1)',
  'LOGIC_OPERATION_AND': '且',
  'LOGIC_OPERATION_OR': '或',
  'LOGIC_BOOLEAN_TRUE': '真',
  'LOGIC_BOOLEAN_FALSE': '假',

  'CONTROLS_FOR_MESSAGE': '用 %1 從 %2 到 %3 每次 %4',
  'CONTROLS_FOR_TOOLTIP': '讓變數從起始值到結束值遞增，每次執行指定的程式碼。',
  'CONTROLS_WHILE_MESSAGE': '當 %1 成立時',
  'CONTROLS_WHILE_TOOLTIP': '當條件成立時，重複執行指定的程式碼。',
  'CONTROLS_FLOW_STATEMENTS_MESSAGE': '跳出迴圈',
  'CONTROLS_FLOW_STATEMENTS_TOOLTIP': '跳出當前的迴圈。',
  'CONTROLS_REPEAT_MESSAGE': '重複 %1 次',
  'CONTROLS_REPEAT_TOOLTIP': '重複執行指定的程式碼若干次。',

  'ARDUINO_CONSTRAIN': '限制 %1 在 %2 到 %3 之間',
  'ARDUINO_MAP': '映射 %1 從 %2~%3 到 %4~%5',
  'ARDUINO_MATH_RANDOM_SEED': '設定亂數種子為 %1',
  'ARDUINO_MATH_RANDOM_INT': '隨機整數 %1 到 %2',
  'MATH_NUMBER': '數值 %1',
  'MATH_ARITHMETIC': '%1 %2 %3',
  'MATH_SINGLE': '%1 %2',
  'MATH_TRIG': '%1 %2',
  'MATH_MODULO': '%1 除以 %2 的餘數',
  'MATH_CHANGE': '將 %1 增加 %2',
  'MATH_CONSTRAIN_TOOLTIP': '將數值限制在指定的範圍內（包含邊界）。',
  'MATH_MAP_TOOLTIP': '將數值從一個範圍映射到另一個範圍。',
  'MATH_RANDOM_SEED_TOOLTIP': '設定亂數產生器的種子值，使亂數序列可重現。',
  'MATH_RANDOM_INT_TOOLTIP': '回傳一個在指定範圍內的隨機整數（包含邊界）。',

  'TEXT_STRING': '字串 %1',
  'TEXT_STRING_TOOLTIP': '輸入一段文字。',
  'TEXT_LENGTH': '字串 %1 的長度',
  'TEXT_LENGTH_TOOLTIP': '計算字串中的字元數（包含空格）。',
  'TEXT_ISEMPTY': '字串 %1 是否為空',
  'TEXT_ISEMPTY_TOOLTIP': '檢查字串是否為空字串。',
  'TEXT_INDEXOF': '在 %1 中尋找 %2 的第 %3 個',
  'TEXT_INDEXOF_TOOLTIP': '在字串中尋找指定文字的位置。',
  'TEXT_CHARAT': '字串 %1 的第 %2 個字元',
  'TEXT_CHARAT_TOOLTIP': '取得字串中指定位置的字元。',
  'TEXT_SUBSTRING': '字串 %1 的第 %2 到 %3',
  'TEXT_SUBSTRING_TOOLTIP': '取得字串中指定範圍的子字串。',
  'TEXT_APPEND': '將 %2 附加到 %1',
  'TEXT_APPEND_TOOLTIP': '將文字附加到變數的末尾。',
  'TEXT_JOIN': '連接 %1',
  'TEXT_JOIN_TOOLTIP': '將多段文字連接成一個字串。',

  'VARIABLES_SET': '設定 %1 為 %2',
  'VARIABLES_SET_TOOLTIP': '將變數設定為指定的值。',
  'VARIABLES_GET': '變數 %1',
  'VARIABLES_GET_TOOLTIP': '取得變數的值。',

  'CODING_COMMENT_MESSAGE': '註解 %1',
  'CODING_INCLUDE_MESSAGE': '引用函式庫 %1',
  'CODING_RAW_STATEMENT_MESSAGE': '原始程式碼 %1',
  'CODING_RAW_INPUT_MESSAGE': '原始運算式 %1',
  'CODING_RAW_DEFINITION_MESSAGE': '原始定義 %1',
  'CODING_RAW_WRAPPER_TOP_MESSAGE': '原始包裝（頂部）%1',
  'CODING_RAW_WRAPPER_BOTTOM_MESSAGE': '原始包裝（底部）%1',
};

// ============================================================
// Engineer 風格覆寫（C++ 語法）
// ============================================================
const ENGINEER_STYLE = {
  'ARDUINO_PIN_MODE': 'pinMode(%1, %2)',
  'ARDUINO_DIGITAL_WRITE': 'digitalWrite(%1, %2)',
  'ARDUINO_DIGITAL_READ': 'digitalRead(%1)',
  'ARDUINO_ANALOG_WRITE': 'analogWrite(%1, %2)',
  'ARDUINO_ANALOG_READ': 'analogRead(%1)',
  'ARDUINO_DELAY': 'delay(%1)',
  'ARDUINO_DELAY_MICROSECONDS': 'delayMicroseconds(%1)',
  'ARDUINO_MILLIS': 'millis()',
  'ARDUINO_MICROS': 'micros()',
  'ARDUINO_PIN_MODE_OUTPUT': 'OUTPUT',
  'ARDUINO_PIN_MODE_INPUT': 'INPUT',
  'ARDUINO_PIN_MODE_INPUT_PULLUP': 'INPUT_PULLUP',
  'ARDUINO_DIGITAL_HIGH': 'HIGH',
  'ARDUINO_DIGITAL_LOW': 'LOW',
  'ARDUINO_SERIAL_BEGIN': 'Serial.begin(%1)',
  'ARDUINO_SERIAL_PRINT': 'Serial.print(%1)',
  'ARDUINO_SERIAL_PRINTLN': 'Serial.println(%1)',
  'ARDUINO_SERIAL_AVAILABLE': 'Serial.available()',
  'ARDUINO_SERIAL_READ': 'Serial.read()',
  'ARDUINO_SERIAL_PRINT_NEWLINE': 'Serial.println()',
  'INITIALIZES_SETUP_APPENDTEXT': 'void setup()',
  'INITIALIZES_LOOP_APPENDTEXT': 'void loop()',
  'LOGIC_OPERATION_AND': '&&',
  'LOGIC_OPERATION_OR': '||',
  'LOGIC_BOOLEAN_TRUE': 'true',
  'LOGIC_BOOLEAN_FALSE': 'false',
  'CONTROLS_IF_MSG_IF': 'if',
  'CONTROLS_IF_MSG_THEN': '',
  'CONTROLS_IF_MSG_ELSEIF': 'else if',
  'CONTROLS_IF_MSG_ELSE': 'else',
  'CONTROLS_FOR_MESSAGE': 'for(%1 = %2; %1 <= %3; %1 += %4)',
  'CONTROLS_WHILE_MESSAGE': 'while(%1)',
  'CONTROLS_FLOW_STATEMENTS_MESSAGE': 'break',
  'ARDUINO_CONSTRAIN': 'constrain(%1, %2, %3)',
  'ARDUINO_MAP': 'map(%1, %2, %3, %4, %5)',
  'ARDUINO_MATH_RANDOM_SEED': 'randomSeed(%1)',
  'ARDUINO_MATH_RANDOM_INT': 'random(%1, %2)',
  'MATH_CHANGE': '%1 += %2',
  'MATH_MODULO': '%1 %% %2',
};

// ============================================================
// 註冊積木訊息到 Blockly.Msg
// ============================================================
function initBlockMessages(style) {
  // 註冊所有訊息（加上 BKY_ 前綴）
  for (const key in ZH_HANT_MESSAGES) {
    if (ZH_HANT_MESSAGES.hasOwnProperty(key)) {
      Blockly.Msg['BKY_' + key] = ZH_HANT_MESSAGES[key];
      // 也註冊無前綴版本（供 imperative 積木直接使用）
      Blockly.Msg[key] = ZH_HANT_MESSAGES[key];
    }
  }

  // 如果是 Engineer 風格，疊加覆寫
  if (style === 'engineer') {
    for (const key in ENGINEER_STYLE) {
      if (ENGINEER_STYLE.hasOwnProperty(key)) {
        Blockly.Msg['BKY_' + key] = ENGINEER_STYLE[key];
        Blockly.Msg[key] = ENGINEER_STYLE[key];
      }
    }
  }
}

// ============================================================
// 風格切換
// ============================================================
function setBlockStyle(style) {
  // 重新載入語系基底
  for (const key in ZH_HANT_MESSAGES) {
    if (ZH_HANT_MESSAGES.hasOwnProperty(key)) {
      Blockly.Msg['BKY_' + key] = ZH_HANT_MESSAGES[key];
      Blockly.Msg[key] = ZH_HANT_MESSAGES[key];
    }
  }

  // 如果是 Engineer，疊加覆寫
  if (style === 'engineer') {
    for (const key in ENGINEER_STYLE) {
      if (ENGINEER_STYLE.hasOwnProperty(key)) {
        Blockly.Msg['BKY_' + key] = ENGINEER_STYLE[key];
        Blockly.Msg[key] = ENGINEER_STYLE[key];
      }
    }
  }

  // 更新工作區
  const ws = Blockly.getMainWorkspace();
  if (ws) {
    ws.refreshToolboxSelection_();
    // 觸發積木重新渲染
    Blockly.Events.fire(new Blockly.Events.Ui(null, 'themeChange'));
  }
}

// ============================================================
// 初始化 Blockly 工作區
// ============================================================
function initBlockly() {
    const blocklyDiv = document.getElementById('blocklyDiv');
    const toolboxXml = document.getElementById('toolbox-xml');
    
    // 讀取 toolbox XML
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
// 程式碼生成與顯示
// ============================================================
function updateCode(workspace) {
    let code = '';
    if (typeof Blockly.Arduino !== 'undefined' && Blockly.Arduino.workspaceToCode) {
        code = Blockly.Arduino.workspaceToCode(workspace);
    } else {
        // Fallback: 使用舊的 generateArduinoCode
        code = generateArduinoCode(workspace);
    }
    
    const codeContent = document.getElementById('codeContent');
    if (codeContent) {
        codeContent.textContent = code;
        // 套用語法高亮
        if (typeof hljs !== 'undefined') {
            codeContent.innerHTML = hljs.highlight(code, { language: 'arduino' }).value;
        }
    }
}

// Fallback 程式碼生成（當 Blockly.Arduino.workspaceToCode 不可用時）
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
// 語系切換功能
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

// ============================================================
// 雙風格切換功能
// ============================================================
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
        
        // 使用新風格切換系統
        setBlockStyle(newTheme);
        console.log('Theme switched to:', newTheme);
    }
    
    // 初始狀態
    updateLabels(themeToggle.checked);
    
    // checkbox change event
    themeToggle.addEventListener('change', function() {
        applyTheme(this.checked);
    });
    
    // 點擊選單項目時切換
    if (menuItem) {
        menuItem.addEventListener('click', function(e) {
            if (e.target.closest('.switch')) return;
            themeToggle.checked = !themeToggle.checked;
            applyTheme(themeToggle.checked);
        });
    }
}

// ============================================================
// 程式碼面板收合功能
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
// 面板拖曳調整寬度功能
// ============================================================
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
        if (typeof Blockly !== 'undefined') {
            Blockly.svgResize(Blockly.getMainWorkspace());
        }
    }
    
    resizer.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

// ============================================================
// 初始化應用程式
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('CodeBridge initializing...');
    
    // 1. 初始化積木訊息（預設 Engineer 風格）
    const savedTheme = localStorage.getItem('codebridgeTheme') || 'engineer';
    initBlockMessages(savedTheme);
    
    // 2. 初始化 i18n (UI 文字)
    if (window.CodeBridgeI18n) {
        window.CodeBridgeI18n.init();
    }
    
    // 3. 初始化 Blockly
    const workspace = initBlockly();
    
    // 4. 監聽積木變更
    workspace.addChangeListener(function() {
        updateCode(workspace);
    });
    
    // 5. 初始程式碼生成
    updateCode(workspace);
    
    // 6. 初始化語系切換
    initLangToggle();
    
    // 7. 初始化面板功能
    initThemeToggle();
    initCodeToggle();
    initPanelResizer();
    
    console.log('CodeBridge initialized successfully');
});