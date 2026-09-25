/// CodeBridge Functions 模組 - Arduino 產生器（對齊 piBlockly）
(function() {
  function getArguments(block, includeTypes) {
    var args = [];
    for (var i = 0; i < block.arguments_.length; i++) {
      args.push(
        includeTypes
          ? block.argTypes_[i] + ' ' + block.arguments_[i]
          : Blockly.Arduino.valueToCode(
              block,
              'ARG' + i,
              Blockly.Arduino.ORDER_NONE
            ) || 'null'
      );
    }
    return args.join(', ');
  }

  function defineFunction(block, returnType) {
    var functionName = block.getFieldValue('NAME');
    var argumentsText = getArguments(block, true);
    Blockly.Arduino.function_prototypes_['proto_' + functionName] =
      returnType + ' ' + functionName + '(' + argumentsText + ');';
    Blockly.Arduino.function_definitions_['def_' + functionName] =
      returnType + ' ' + functionName + '(' + argumentsText + ') {\n' +
      Blockly.Arduino.statementToCode(block, 'STACK') + '}\n';
    return null;
  }

  Blockly.Arduino.forBlock['custom_functions_defnoreturn'] = function(block) {
    return defineFunction(block, 'void');
  };

  Blockly.Arduino.forBlock['custom_functions_defreturn'] = function(block) {
    return defineFunction(block, block.getFieldValue('TYPE'));
  };

  Blockly.Arduino.forBlock['custom_functions_return'] = function(block) {
    var value = Blockly.Arduino.valueToCode(
      block,
      'VALUE',
      Blockly.Arduino.ORDER_ATOMIC
    ) || '';
    return 'return ' + value + ';\n';
  };

  Blockly.Arduino.forBlock['custom_functions_callnoreturn_manual'] = function(block) {
    return block.getFieldValue('NAME') + '(' + getArguments(block, false) + ');\n';
  };

  Blockly.Arduino.forBlock['custom_functions_callreturn_manual'] = function(block) {
    var code = block.getFieldValue('NAME') + '(' + getArguments(block, false) + ')';
    return [code, Blockly.Arduino.ORDER_ATOMIC];
  };
})();