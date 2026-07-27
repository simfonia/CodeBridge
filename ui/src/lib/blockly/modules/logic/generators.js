/// CodeBridge Logic 模組 - 程式碼產生器
/// Arduino C++ 邏輯積木 (對齊 piBlockly)

if (typeof Blockly.Arduino !== 'undefined') {
  // ============================================================
  // controls_if - if/else if/else 條件陳述式
  // Blockly v12 內建 controls_if 無 getInputsCount 方法
  // 遍歷 inputList 計算 IF 區段數。
  // ============================================================
  Blockly.Arduino.forBlock['controls_if'] = function(block) {
    // 計算 IF 區段數：遍歷 inputList，計算名稱為 "IF" + 數字的輸入
    var ifCount = 0;
    for (var i = 0; i < block.inputList.length; i++) {
      var inputName = block.inputList[i].name;
      if (inputName && typeof inputName === 'string' && inputName.indexOf('IF') === 0 && inputName.length > 2) {
        ifCount = Math.max(ifCount, parseInt(inputName.substring(2), 10) + 1);
      }
    }
    if (ifCount < 1) ifCount = 1; // 至少一個 IF
    
    var code = 'if (';
    code += Blockly.Arduino.valueToCode(block, 'IF0', Blockly.Arduino.ORDER_NONE) || 'false';
    code += ') {\n';
    var do0 = Blockly.Arduino.statementToCode(block, 'DO0');
    if (do0) {
      code += do0;
    }
    for (var j = 1; j < ifCount; j++) {
      code += '} else if (';
      code += Blockly.Arduino.valueToCode(block, 'IF' + j, Blockly.Arduino.ORDER_NONE) || 'false';
      code += ') {\n';
      var doN = Blockly.Arduino.statementToCode(block, 'DO' + j);
      if (doN) {
        code += doN;
      }
    }
    var hasElse = block.getInputTargetBlock('ELSE') !== null;
    if (hasElse) {
      code += '} else {\n';
      var doElse = Blockly.Arduino.statementToCode(block, 'ELSE');
      if (doElse) {
        code += doElse;
      }
    }
    code += '}\n';
    return code;
  };

  // ============================================================
  // logic_compare - 比較運算子 (對齊 piBlockly)
  // ============================================================
  Blockly.Arduino.forBlock['logic_compare'] = function(block) {
    var OPERATORS = {
      'EQ': '==',
      'NEQ': '!=',
      'LT': '<',
      'LTE': '<=',
      'GT': '>',
      'GTE': '>='
    };
    var operator = OPERATORS[block.getFieldValue('OP')];
    var order = (operator === '==' || operator === '!=') ?
        Blockly.Arduino.ORDER_EQUALITY : Blockly.Arduino.ORDER_RELATIONAL;
    var argument0 = Blockly.Arduino.valueToCode(block, 'A', order) || '0';
    var argument1 = Blockly.Arduino.valueToCode(block, 'B', order) || '0';
    var code = argument0 + ' ' + operator + ' ' + argument1;
    return [code, order];
  };

  // ============================================================
  // logic_operation - 邏輯運算子 (and / or) (對齊 piBlockly)
  // ============================================================
  Blockly.Arduino.forBlock['logic_operation'] = function(block) {
    var operator = (block.getFieldValue('OP') === 'AND') ? '&&' : '||';
    var order = (operator === '&&') ? Blockly.Arduino.ORDER_LOGICAL_AND : Blockly.Arduino.ORDER_LOGICAL_OR;
    var argument0 = Blockly.Arduino.valueToCode(block, 'A', order);
    var argument1 = Blockly.Arduino.valueToCode(block, 'B', order);
    if (!argument0 && !argument1) {
      argument0 = 'false';
      argument1 = 'false';
    } else {
      var defaultArgument = (operator === '&&') ? 'true' : 'false';
      if (!argument0) {
        argument0 = defaultArgument;
      }
      if (!argument1) {
        argument1 = defaultArgument;
      }
    }
    var code = argument0 + ' ' + operator + ' ' + argument1;
    return [code, order];
  };

  // ============================================================
  // logic_negate - 邏輯否定 (!) (對齊 piBlockly)
  // ============================================================
  Blockly.Arduino.forBlock['logic_negate'] = function(block) {
    var order = Blockly.Arduino.ORDER_LOGICAL_NOT;
    var argument0 = Blockly.Arduino.valueToCode(block, 'BOOL', order) || 'true';
    var code = '!' + argument0;
    return [code, order];
  };

  // ============================================================
  // logic_boolean - true / false (對齊 piBlockly)
  // ============================================================
  Blockly.Arduino.forBlock['logic_boolean'] = function(block) {
    var code = (block.getFieldValue('BOOL') === 'TRUE') ? 'true' : 'false';
    return [code, Blockly.Arduino.ORDER_ATOMIC];
  };
}