/// CodeBridge 模組載入器
/// 依序載入所有模組的 i18n → blocks → generators → style

(function() {
  'use strict';

  /**
   * 將模組訊息註冊到 Blockly.Msg
   * @param {Object} messages - 模組的 i18n 物件（如 ARDUINO_ZH）
   * @param {string} prefix - 是否加上 BKY_ 前綴
   */
  function registerMessages(messages, prefix) {
    if (!messages || typeof Blockly === 'undefined') return;
    for (var key in messages) {
      if (messages.hasOwnProperty(key)) {
        Blockly.Msg[key] = messages[key];
        if (prefix) {
          Blockly.Msg['BKY_' + key] = messages[key];
        }
      }
    }
  }

  /**
   * 載入語系基底（根據 localStorage 或瀏覽器語系）
   */
  function loadLocaleBase() {
    var saved = localStorage.getItem('codebridgeLang');
    var locale = saved || (navigator.language && navigator.language.startsWith('zh') ? 'zh-hant' : 'en');

    // v13 的工作區 ARIA 初始化依賴 Blockly 內建訊息；先套用官方基礎語系，
    // 再由 CodeBridge 模組訊息覆寫積木文字與分類名稱。
    var baseLocales = window.CodeBridgeBlocklyBaseLocales || {};
    if (baseLocales[locale] && typeof Blockly.setLocale === 'function') {
      Blockly.setLocale(baseLocales[locale]);
    }

    // 載入對應語系的模組訊息
    if (locale === 'zh-hant') {
      if (typeof ARDUINO_ZH !== 'undefined') {
        registerMessages(ARDUINO_ZH, true);
      }
      if (typeof CODING_ZH !== 'undefined') {
        registerMessages(CODING_ZH, true);
      }
      if (typeof LOGIC_ZH !== 'undefined') {
        registerMessages(LOGIC_ZH, true);
      }
      if (typeof LOOPS_ZH !== 'undefined') {
        registerMessages(LOOPS_ZH, true);
      }
      if (typeof MATH_ZH !== 'undefined') {
        registerMessages(MATH_ZH, true);
      }
      if (typeof TEXT_ZH !== 'undefined') {
        registerMessages(TEXT_ZH, true);
      }
      if (typeof VARIABLES_ZH !== 'undefined') {
        registerMessages(VARIABLES_ZH, true);
      }
      if (typeof ARRAY_ZH !== 'undefined') {
        registerMessages(ARRAY_ZH, true);
      }
      if (typeof FUNCTIONS_ZH !== 'undefined') {
        registerMessages(FUNCTIONS_ZH, true);
      }

      if (typeof COMMON_ZH !== 'undefined') {
        registerMessages(COMMON_ZH, true);
      }
    } else {
      if (typeof ARDUINO_EN !== 'undefined') {
        registerMessages(ARDUINO_EN, true);
      }
      if (typeof CODING_EN !== 'undefined') {
        registerMessages(CODING_EN, true);
      }
      if (typeof LOGIC_EN !== 'undefined') {
        registerMessages(LOGIC_EN, true);
      }
      if (typeof LOOPS_EN !== 'undefined') {
        registerMessages(LOOPS_EN, true);
      }
      if (typeof MATH_EN !== 'undefined') {
        registerMessages(MATH_EN, true);
      }
      if (typeof TEXT_EN !== 'undefined') {
        registerMessages(TEXT_EN, true);
      }
      if (typeof VARIABLES_EN !== 'undefined') {
        registerMessages(VARIABLES_EN, true);
      }
      if (typeof ARRAY_EN !== 'undefined') {
        registerMessages(ARRAY_EN, true);
      }
      if (typeof FUNCTIONS_EN !== 'undefined') {
        registerMessages(FUNCTIONS_EN, true);
      }
      if (typeof COMMON_EN !== 'undefined') {
        registerMessages(COMMON_EN, true);
      }
    }

    return locale;
  }

  /**
   * 套用 Engineer 風格覆寫
   */
  function applyEngineerStyle() {
    if (typeof ENGINEER_STYLE === 'undefined') return;
    for (var key in ENGINEER_STYLE) {
      if (ENGINEER_STYLE.hasOwnProperty(key)) {
        Blockly.Msg[key] = ENGINEER_STYLE[key];
        Blockly.Msg['BKY_' + key] = ENGINEER_STYLE[key];
      }
    }
  }

  /**
   * 切換風格
   * @param {string} style - 'engineer' 或 'angel'
   */
  window.setBlockStyle = function(style) {
    // 重新載入語系基底
    var saved = localStorage.getItem('codebridgeLang');
    var locale = saved || (navigator.language && navigator.language.startsWith('zh') ? 'zh-hant' : 'en');

    if (locale === 'zh-hant') {
      if (typeof ARDUINO_ZH !== 'undefined') {
        registerMessages(ARDUINO_ZH, true);
      }
      if (typeof CODING_ZH !== 'undefined') {
        registerMessages(CODING_ZH, true);
      }
      if (typeof LOGIC_ZH !== 'undefined') {
        registerMessages(LOGIC_ZH, true);
      }
      if (typeof VARIABLES_ZH !== 'undefined') {
        registerMessages(VARIABLES_ZH, true);
      }

      if (typeof LOOPS_ZH !== 'undefined') {
        registerMessages(LOOPS_ZH, true);
      }
      if (typeof MATH_ZH !== 'undefined') {
        registerMessages(MATH_ZH, true);
      }
      if (typeof TEXT_ZH !== 'undefined') {
        registerMessages(TEXT_ZH, true);
      }
      if (typeof ARRAY_ZH !== 'undefined') {
        registerMessages(ARRAY_ZH, true);
      }
      if (typeof FUNCTIONS_ZH !== 'undefined') {
        registerMessages(FUNCTIONS_ZH, true);
      }
      if (typeof COMMON_ZH !== 'undefined') {
        registerMessages(COMMON_ZH, true);
      }
    } else {
      if (typeof ARDUINO_EN !== 'undefined') {
        registerMessages(ARDUINO_EN, true);
      }
      if (typeof CODING_EN !== 'undefined') {
        registerMessages(CODING_EN, true);
      }
      if (typeof VARIABLES_EN !== 'undefined') {
        registerMessages(VARIABLES_EN, true);
      }

      if (typeof LOGIC_EN !== 'undefined') {
        registerMessages(LOGIC_EN, true);
      }
      if (typeof LOOPS_EN !== 'undefined') {
        registerMessages(LOOPS_EN, true);
      }
      if (typeof MATH_EN !== 'undefined') {
        registerMessages(MATH_EN, true);
      }
      if (typeof TEXT_EN !== 'undefined') {
        registerMessages(TEXT_EN, true);
      }
      if (typeof ARRAY_EN !== 'undefined') {
        registerMessages(ARRAY_EN, true);
      }
      if (typeof FUNCTIONS_EN !== 'undefined') {
        registerMessages(FUNCTIONS_EN, true);
      }
      if (typeof COMMON_EN !== 'undefined') {
        registerMessages(COMMON_EN, true);
      }
    }

    // 如果是 Engineer，疊加覆寫
    if (style === 'engineer') {
      applyEngineerStyle();
    }

    // 套用訊息後讓 Blockly 原地重繪；不可 clear/reload workspace，
    // 否則孤兒積木狀態可能在視覺切換時被寫回 XML。
    Blockly.Events.disable();
    try {
      Blockly.setLocale(Blockly.Msg);
    } finally {
      Blockly.Events.enable();
    }
    var ws = Blockly.getMainWorkspace();
    if (ws) {
      var toolboxXml = document.getElementById('toolbox-xml');
      if (toolboxXml) {
        ws.updateToolbox(toolboxXml.cloneNode(true));
        if (window.CodeBridgeBlockSearch) {
          window.CodeBridgeBlockSearch.refresh(ws);
        }
      }
      ws.updateAriaLabel();
    }
  };

  // 自動初始化
  window.CodeBridgeBlocklyLoader = {
    init: function() {
      var locale = loadLocaleBase();
      console.log('[CodeBridge] Blockly modules loaded, locale:', locale);
      return locale;
    }
  };
})();