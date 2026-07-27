/// CodeBridge Coding 模組 - 程式碼產生器
/// 負責將 coding 積木轉換為 Arduino C++ 程式碼

if (typeof Blockly.Arduino !== 'undefined') {
  // ============================================================
  // coding_comment - 註解
  // 有父積木（在任何容器內）：直接返回程式碼，接在上一個積木下面
  // 頂層（無父積木）：放入 includes_ bucket，避免跑到 loop() 裡面
  // ============================================================
  Blockly.Arduino.forBlock['coding_comment'] = function(block) {
    var comment = block.getFieldValue('COMMENT') || '';
    var parent = block.getParent();
    if (parent) {
      // Inside any container - return code directly
      return '// ' + comment + '\n';
    } else {
      // Top-level - put into includes_ bucket with ID marker
      var idMarker = ' ' + Blockly.Arduino.ID_MARKER + block.id + Blockly.Arduino.ID_MARKER_END;
      Blockly.Arduino.includes_['user_comment_' + block.id] = '// ' + comment + idMarker;
      return '';
    }
  };

  // ============================================================
  // coding_include - #include 函式庫引用
  // 放入 includes_ bucket，支援 ID 標記定位
  // ============================================================
  Blockly.Arduino.forBlock['coding_include'] = function(block) {
    var include = block.getFieldValue('INCLUDE') || '';
    var idMarker = ' ' + Blockly.Arduino.ID_MARKER + block.id + Blockly.Arduino.ID_MARKER_END;
    Blockly.Arduino.includes_['user_include_' + block.id] = '#include <' + include + '>' + idMarker;
    return '';
  };

  // ============================================================
  // coding_raw_statement - 原始 C++ 陳述式
  // 直接返回程式碼，由 scrub_ 處理 ID 標記
  // ============================================================
  Blockly.Arduino.forBlock['coding_raw_statement'] = function(block) {
    var code = block.getFieldValue('CODE') || '';
    return code + '\n';
  };

  // ============================================================
  // coding_raw_input - 原始 C++ 表達式 (值積木)
  // 回傳 [code, ORDER_ATOMIC]
  // ============================================================
  Blockly.Arduino.forBlock['coding_raw_input'] = function(block) {
    var code = block.getFieldValue('CODE') || '';
    return [code, Blockly.Arduino.ORDER_ATOMIC];
  };

  // ============================================================
  // coding_raw_definition - 全局作用域原始程式碼
  // 放入 global_vars_ bucket，支援 ID 標記定位
  // ============================================================
  Blockly.Arduino.forBlock['coding_raw_definition'] = function(block) {
    var code = block.getFieldValue('CODE') || '';
    var idMarker = ' ' + Blockly.Arduino.ID_MARKER + block.id + Blockly.Arduino.ID_MARKER_END;
    Blockly.Arduino.global_vars_['user_definition_' + block.id] = code + idMarker;
    return '';
  };

  // ============================================================
  // coding_raw_wrapper - 原始 C++ 包裹 (容器型)
  // 使用 getInputTargetBlock + blockToCode 處理內部陳述式
  // 內容使用 prefixLines 加上 INDENT 縮排
  // 放入 function_definitions_ bucket，支援 ID 標記定位
  // ============================================================
  Blockly.Arduino.forBlock['coding_raw_wrapper'] = function(block) {
    var header = block.getFieldValue('HEADER') || '';
    var footer = block.getFieldValue('FOOTER') || '';
    var contentBlock = block.getInputTargetBlock('CONTENT');
    var content = contentBlock ? Blockly.Arduino.prefixLines(Blockly.Arduino.blockToCode(contentBlock), Blockly.Arduino.INDENT) : '';
    var idMarker = ' ' + Blockly.Arduino.ID_MARKER + block.id + Blockly.Arduino.ID_MARKER_END;
    var code = header + idMarker + '\n' + content + footer + '\n';
    Blockly.Arduino.function_definitions_['user_wrapper_' + block.id] = code;
    return '';
  };
}