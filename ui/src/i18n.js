/// CodeBridge i18n 模組
/// 將翻譯註冊到 Blockly.Msg，使 %{BKY_...} 能被正確解析

const zhHant = {
    // 工具列
    TLB_FILE_NEW: '未命名專案',
    TLB_NEW: '新專案',
    TLB_OPEN: '開啟',
    TLB_SAVE: '儲存',
    TLB_SAVE_AS: '另存為',
    TLB_SETTINGS: '設定',
    TLB_DIAGNOSE: '環境診斷',
    TLB_SERIAL_REFRESH: '重新整理序列埠',
    TLB_SERIAL_PORT: '序列埠',
    TLB_NO_PORT: '未偵測到序列埠',
    TLB_RUN: '執行',
    TLB_STOP_PROGRAM: '停止程式',
    TLB_TERMINAL: '終端機',
    TLB_TERMINAL_TITLE: '序列監視器',
    TLB_PAUSE_SCROLL: '暫停捲動',
    TLB_CLEAR_CONSOLE: '清除主控台',
    TLB_CLOSE_PANEL: '關閉面板',
    TLB_TOGGLE_CODE: '切換程式碼',
    TLB_ARDUINO_PREVIEW: 'Arduino 程式碼預覽',
    TLB_INDENT: '縮排',
    TLB_INDENT_2: '2 空格',
    TLB_INDENT_4: '4 空格',
    TLB_DRAG_RESIZE: '拖曳調整大小',
    TLB_COPY_CODE: '複製程式碼',
    TLB_EXAMPLES: '範例',
    TLB_THEME_TOGGLE: '切換積木風格',
    TLB_LANG_TOGGLE: '切換語系 (中文/English)',
    
    // 訊息
    MSG_SAVE: '儲存',
    MSG_DONT_SAVE: '不儲存',
    MSG_CANCEL: '取消',
    MSG_CLOSE: '關閉'
};

const en = {
    TLB_FILE_NEW: 'Untitled Project',
    TLB_NEW: 'New',
    TLB_OPEN: 'Open',
    TLB_SAVE: 'Save',
    TLB_SAVE_AS: 'Save As',
    TLB_SETTINGS: 'Settings',
    TLB_DIAGNOSE: 'Diagnose',
    TLB_SERIAL_REFRESH: 'Refresh Serial Ports',
    TLB_SERIAL_PORT: 'Serial Port',
    TLB_NO_PORT: 'No serial port detected',
    TLB_RUN: 'Run',
    TLB_STOP_PROGRAM: 'Stop Program',
    TLB_TERMINAL: 'Terminal',
    TLB_TERMINAL_TITLE: 'Serial Monitor',
    TLB_PAUSE_SCROLL: 'Pause Scroll',
    TLB_CLEAR_CONSOLE: 'Clear Console',
    TLB_CLOSE_PANEL: 'Close Panel',
    TLB_TOGGLE_CODE: 'Toggle Code',
    TLB_ARDUINO_PREVIEW: 'Arduino Code Preview',
    TLB_INDENT: 'Indent',
    TLB_INDENT_2: '2 Spaces',
    TLB_INDENT_4: '4 Spaces',
    TLB_DRAG_RESIZE: 'Drag to Resize',
    TLB_COPY_CODE: 'Copy Code',
    TLB_EXAMPLES: 'Examples',
    TLB_THEME_TOGGLE: 'Toggle Block Style (Engineer/Angel)',
    TLB_LANG_TOGGLE: 'Switch Language (中文/English)',
    
    MSG_SAVE: 'Save',
    MSG_DONT_SAVE: 'Don\'t Save',
    MSG_CANCEL: 'Cancel',
    MSG_CLOSE: 'Close'
};

// 偵測瀏覽器語系 (預設 zh-Hant)
function detectLocale() {
    const lang = navigator.language || navigator.userLanguage || 'zh-TW';
    if (lang.startsWith('zh')) {
        return 'zh-hant';
    }
    return 'en';
}

// 初始化 i18n：註冊到 Blockly.Msg
function initI18n() {
    const locale = detectLocale();
    const messages = locale === 'zh-hant' ? zhHant : en;
    
    if (typeof Blockly !== 'undefined' && Blockly.Msg) {
        for (const key in messages) {
            if (messages.hasOwnProperty(key)) {
                Blockly.Msg[key] = messages[key];
            }
        }
        // 設定 Blockly 語系
        if (locale === 'zh-hant') {
            Blockly.Msg.LANG = 'zh-hant';
        } else {
            Blockly.Msg.LANG = 'en';
        }
    }
    
    // 回傳 messages 物件供 DOM 替換使用
    return messages;
}

// 替換 DOM 中的 %{BKY_...} 佔位符
function replaceBkyPlaceholders(messages) {
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );
    
    const nodesToReplace = [];
    while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.textContent && node.textContent.includes('%{BKY_')) {
            nodesToReplace.push(node);
        }
    }
    
    for (const node of nodesToReplace) {
        node.textContent = node.textContent.replace(
            /%\{BKY_([A-Z_0-9]+)\}/g,
            function(match, key) {
                return messages[key] !== undefined ? messages[key] : match;
            }
        );
    }
}

// 替換 title 屬性中的 %{BKY_...} 佔位符
function replaceBkyTitles(messages) {
    const elements = document.querySelectorAll('[title*="%{BKY_"]');
    for (const el of elements) {
        const title = el.getAttribute('title');
        if (title) {
            el.setAttribute('title', title.replace(
                /%\{BKY_([A-Z_0-9]+)\}/g,
                function(match, key) {
                    return messages[key] !== undefined ? messages[key] : match;
                }
            ));
        }
    }
}

// 公開初始化函式
window.CodeBridgeI18n = {
    init: function() {
        const messages = initI18n();
        replaceBkyPlaceholders(messages);
        replaceBkyTitles(messages);
        console.log('CodeBridge i18n initialized:', Blockly.Msg.LANG);
        return messages;
    }
};