/// CodeBridge Variables 模組 - Arduino 產生器
/// 對齊 piBlockly：media/generators/variables.js
if (typeof Blockly.Arduino !== 'undefined') {
  function getVariableName(block) {
    return Blockly.Arduino.variableDB_.getName(
      block.getFieldValue('VAR'),
      'VARIABLE'
    );
  }

  function getValue(block, inputName) {
    return Blockly.Arduino.valueToCode(
      block,
      inputName,
      Blockly.Arduino.ORDER_ATOMIC
    );
  }

  function getDefaultValue(type) {
    if (type === 'String') return '\"\"';
    if (type === 'bool') return 'false';
    return '0';
  }

  // ============================================================
  // variables_declare_global - 全域變數宣告
  //
  // 對齊 piBlockly：使用 `processDefinitionStack`，宣告積木以 next 串成
  // 堆疊，由堆頂一次產出整條堆疊並寫入 global_vars_ 的單一 entry。
  //
  // 不可改成「每顆積木各自寫一個 global_vars_ entry」：那會讓畫面上
  // 互相獨立的散落積木對應到程式碼中順序不保相鄰的宣告，
  // 且非堆頂積木也會各自產碼（需額外去重邏輯）。
  // 詳見 generators/_core.js 的 processDefinitionStack 說明。
  // ============================================================
  Blockly.Arduino.forBlock['variables_declare_global'] =
    Blockly.Arduino.processDefinitionStack;

  // ============================================================
  // variables_declare_local - 區域變數宣告
  //
  // 區域變數屬於「當下作用域」的陳述式，**不**進 global_vars_，
  // 因此不走堆疊處理器，直接回傳陳述式程式碼（與 piBlockly 一致）。
  // ============================================================
  Blockly.Arduino.forBlock['variables_declare_local'] = function(block) {
    var variableName = getVariableName(block);
    var type = block.getFieldValue('TYPE');
    var value = getValue(block, 'VALUE') || getDefaultValue(type);
    return type + ' ' + variableName + ' = ' + value + ';\n';
  };

  Blockly.Arduino.forBlock['variables_get'] = function(block) {
    return [getVariableName(block), Blockly.Arduino.ORDER_ATOMIC];
  };

  Blockly.Arduino.forBlock['variables_set'] = function(block) {
    var value = getValue(block, 'VALUE') || '0';
    return getVariableName(block) + ' = ' + value + ';\n';
  };
}
