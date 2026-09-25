/// CodeBridge Variables 模組 - Arduino 產生器
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

  Blockly.Arduino.forBlock['variables_declare_global'] = function(block) {
    var variableName = getVariableName(block);
    var type = block.getFieldValue('TYPE');
    var value = getValue(block, 'VALUE') || getDefaultValue(type);
    var definition = type + ' ' + variableName + ' = ' + value + ';';
    Blockly.Arduino.global_vars_['variables_declare_global_' + variableName] = definition;
    return '';
  };

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
