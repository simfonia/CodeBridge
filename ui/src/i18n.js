/// CodeBridge i18n 膠水層
/// 職責：語系偵測、載入 UI 翻譯、DOM 佔位符替換
/// 不包含任何翻譯資料本體（資料在 lib/i18n/*.js）
/// 不包含積木相關訊息（屬於 blockly/messages/）

// 偵測語系 (優先使用 localStorage，其次瀏覽器語系)
function detectLocale() {
    const saved = localStorage.getItem('codebridgeLang');
    if (saved === 'zh-hant' || saved === 'en') {
        return saved;
    }
    const lang = navigator.language || navigator.userLanguage || 'zh-TW';
    return lang.startsWith('zh') ? 'zh-hant' : 'en';
}

// 初始化 i18n：註冊 UI 翻譯到 Blockly.Msg
function initI18n() {
    const locale = detectLocale();
    const messages = locale === 'zh-hant' ? UI_ZH_HANT : UI_EN;
    
    if (typeof Blockly !== 'undefined' && Blockly.Msg) {
        for (const key in messages) {
            if (messages.hasOwnProperty(key)) {
                Blockly.Msg[key] = messages[key];
            }
        }
        Blockly.Msg.LANG = locale;
    }
    
    return messages;
}

// 替換 DOM 文字節點中的 %{BKY_...} 佔位符
function replaceBkyTextNodes(messages) {
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

// 替換 placeholder 屬性中的 %{BKY_...} 佔位符
function replaceBkyAttrPlaceholders(messages) {
    const elements = document.querySelectorAll('[placeholder*="%{BKY_"]');
    for (const el of elements) {
        const placeholder = el.getAttribute('placeholder');
        if (placeholder) {
            el.setAttribute('placeholder', placeholder.replace(
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
        replaceBkyTextNodes(messages);
        replaceBkyTitles(messages);
        replaceBkyAttrPlaceholders(messages);
        console.log('CodeBridge i18n initialized:', Blockly.Msg.LANG);
        return messages;
    }
};