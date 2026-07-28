/// CodeBridge Text 模組 - 程式碼產生器
/// 對齊 piBlockly 的 generators/text.js
/// 4 個產生器：text, text_join, text_append, text_length

if (typeof Blockly.Arduino !== 'undefined') {
// =============================================================================
// TEXT BLOCKS
// =============================================================================
Blockly.Arduino.forBlock['text'] = function(block) {
  // Text value.
  var code = Blockly.Arduino.quote_(block.getFieldValue('TEXT'));
  return [code, Blockly.Arduino.ORDER_ATOMIC];
};

Blockly.Arduino.forBlock['text_join'] = function(block) {
  // Create a string made up of any number of elements of any type.
  if (block.itemCount_ === 0) {
    return ['""', Blockly.Arduino.ORDER_ATOMIC];
  } else if (block.itemCount_ === 1) {
    var element = Blockly.Arduino.valueToCode(block, 'ADD0',
        Blockly.Arduino.ORDER_NONE) || '""';
    var code = 'String(' + element + ')';
    return [code, Blockly.Arduino.ORDER_FUNCTION_CALL];
  } else {
    var elements = new Array(block.itemCount_);
    for (var i = 0; i < block.itemCount_; i++) {
      elements[i] = 'String(' + (Blockly.Arduino.valueToCode(block, 'ADD' + i,
          Blockly.Arduino.ORDER_NONE) || '""') + ')';
    }
    var code = elements.join(' + ');
    return [code, Blockly.Arduino.ORDER_ADDITION];
  }
};

Blockly.Arduino.forBlock['text_append'] = function(block) {
  // Append to a variable in place.
  var varName = Blockly.Arduino.variableDB_.getName(
      block.getFieldValue('VAR'), 'VARIABLE');
  var text = Blockly.Arduino.valueToCode(block, 'TEXT',
      Blockly.Arduino.ORDER_NONE) || '""';
  return varName + ' += ' + text + ';\n';
};

Blockly.Arduino.forBlock['text_length'] = function(block) {
  const value = Blockly.Arduino.valueToCode(block, 'VALUE', Blockly.Arduino.ORDER_MEMBER) || '""';
  const code = value + '.length()';
  return [code, Blockly.Arduino.ORDER_MEMBER];
};
}
