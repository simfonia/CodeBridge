/// CodeBridge Array 模組 - Arduino 產生器（對齊 piBlockly）
Blockly.Arduino.forBlock['array_declare_global'] = function(block) {
  var type = block.getFieldValue('TYPE');
  var variableName = block.getFieldValue('VAR');
  var size = Blockly.Arduino.valueToCode(
    block,
    'SIZE',
    Blockly.Arduino.ORDER_ATOMIC
  ) || '1';
  Blockly.Arduino.global_vars_['array_declare_global_' + variableName] =
    type + ' ' + variableName + '[' + size + '];';
  return '';
};

Blockly.Arduino.forBlock['array_declare_local'] = function(block) {
  var type = block.getFieldValue('TYPE');
  var variableName = block.getFieldValue('VAR');
  var size = Blockly.Arduino.valueToCode(
    block,
    'SIZE',
    Blockly.Arduino.ORDER_ATOMIC
  ) || '1';
  return type + ' ' + variableName + '[' + size + '];\n';
};

Blockly.Arduino.forBlock['array_get'] = function(block) {
  var variableName = block.getFieldValue('VAR');
  var index = Blockly.Arduino.valueToCode(
    block,
    'INDEX',
    Blockly.Arduino.ORDER_ATOMIC
  ) || '0';
  return [variableName + '[' + index + ']', Blockly.Arduino.ORDER_ATOMIC];
};

Blockly.Arduino.forBlock['array_set'] = function(block) {
  var variableName = block.getFieldValue('VAR');
  var index = Blockly.Arduino.valueToCode(
    block,
    'INDEX',
    Blockly.Arduino.ORDER_ATOMIC
  ) || '0';
  var value = Blockly.Arduino.valueToCode(
    block,
    'VALUE',
    Blockly.Arduino.ORDER_ATOMIC
  ) || '0';
  return variableName + '[' + index + '] = ' + value + ';\n';
};

Blockly.Arduino.forBlock['array_length'] = function(block) {
  var variableName = block.getFieldValue('VAR');
  var code = 'sizeof(' + variableName + ') / sizeof(' + variableName + '[0])';
  return [code, Blockly.Arduino.ORDER_ATOMIC];
};