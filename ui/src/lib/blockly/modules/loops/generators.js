/// CodeBridge Loops 模組 - 程式碼產生器
/// Arduino C++ 迴圈積木 (對齊 piBlockly)
///
/// 縮排處理：使用 statementToCode() 自動縮排，無需手動處理
/// 轉義字元：字串中使用 \n，不允許實體換行

if (typeof Blockly.Arduino !== 'undefined') {
  // ============================================================
  // controls_while - while 迴圈
  // ============================================================
  Blockly.Arduino.forBlock['controls_while'] = function(block) {
    var argument0 = Blockly.Arduino.valueToCode(block, 'BOOL',
        Blockly.Arduino.ORDER_NONE) || 'false';
    var branch = Blockly.Arduino.statementToCode(block, 'DO');
    return 'while (' + argument0 + ') {\n' + branch + '}\n';
  };

  // ============================================================
  // controls_for - for 迴圈
  // 參考 piBlockly generators/loops.js lines 54-118
  // 若 FROM/TO/BY 皆為數字字面值 → 生成簡單 for 迴圈
  // 若有非數字字面值 → 生成 generic for 迴圈 (快取變數)
  // ============================================================
  Blockly.Arduino.forBlock['controls_for'] = function(block) {
    var variable0 = Blockly.Arduino.variableDB_.getName(
        block.getFieldValue('VAR'), 'VARIABLE');
    var argument0 = Blockly.Arduino.valueToCode(block, 'FROM',
        Blockly.Arduino.ORDER_ASSIGNMENT) || '0';
    var argument1 = Blockly.Arduino.valueToCode(block, 'TO',
        Blockly.Arduino.ORDER_ASSIGNMENT) || '0';
    var increment = Blockly.Arduino.valueToCode(block, 'BY',
        Blockly.Arduino.ORDER_ASSIGNMENT) || '1';
    var branch = Blockly.Arduino.statementToCode(block, 'DO');
    var code = '';

    var isNumber = function(str) {
      return /^-?\d+(\.\d+)?$/.test(str);
    };

    // 若所有輸入皆為數字字面值，生成簡單 for 迴圈
    if (isNumber(argument0) && isNumber(argument1) && isNumber(increment)) {
      var fromNum = parseFloat(argument0);
      var toNum = parseFloat(argument1);
      var byNum = Math.abs(parseFloat(increment));

      var up = fromNum <= toNum;
      code = 'for (int ' + variable0 + ' = ' + fromNum + '; ' +
             variable0 + (up ? ' <= ' : ' >= ') + toNum + '; ' +
             variable0;

      if (byNum === 1) {
        code += (up ? '++' : '--');
      } else {
        code += (up ? ' += ' : ' -= ') + byNum;
      }
      code += ') {\n' + branch + '}\n';

    } else {
      // Generic case with variables
      var startVar = argument0;
      if (!argument0.match(/^\w+$/)) {
        startVar = Blockly.Arduino.variableDB_.getDistinctName(
            variable0 + '_start', 'VARIABLE');
        code += 'int ' + startVar + ' = ' + argument0 + ';\n';
      }
      var endVar = argument1;
      if (!argument1.match(/^\w+$/)) {
        endVar = Blockly.Arduino.variableDB_.getDistinctName(
            variable0 + '_end', 'VARIABLE');
        code += 'int ' + endVar + ' = ' + argument1 + ';\n';
      }
      var incVar = increment;
      if (!increment.match(/^\w+$/)) {
        incVar = Blockly.Arduino.variableDB_.getDistinctName(
            variable0 + '_inc', 'VARIABLE');
        code += 'int ' + incVar + ' = ' + increment + ';\n';
      }

      code += 'for (int ' + variable0 + ' = ' + startVar + '; ';
      code += '(' + incVar + ' > 0) ? ' +
              variable0 + ' <= ' + endVar + ' : ' +
              variable0 + ' >= ' + endVar + '; ';
      code += variable0 + ' += ' + incVar + ') {\n' +
              branch + '}\n';
    }

    return code;
  };

  // ============================================================
  // controls_flow_statements - break / continue
  // ============================================================
  Blockly.Arduino.forBlock['controls_flow_statements'] = function(block) {
    switch (block.getFieldValue('FLOW')) {
      case 'BREAK':
        return 'break;\n';
      case 'CONTINUE':
        return 'continue;\n';
    }
    throw new Error('Unknown flow statement.');
  };
}
