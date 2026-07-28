/// CodeBridge Math 模組 - 程式碼產生器
/// 對齊 piBlockly 的 generators/math.js
/// 8 個產生器：math_number, math_arithmetic, math_single, arduino_constrain, arduino_map, math_random_seed, math_random_int

if (typeof Blockly.Arduino !== 'undefined') {
// =============================================================================
// MATH BLOCKS
// =============================================================================
Blockly.Arduino.forBlock['math_number'] = function(block) {
  var number = String(parseFloat(block.getFieldValue('NUM')));
  return [number, Blockly.Arduino.ORDER_ATOMIC];
};


Blockly.Arduino.forBlock['math_arithmetic'] = function(block) {
  var OPERATORS = {
    'ADD': [' + ', Blockly.Arduino.ORDER_ADDITION],
    'MINUS': [' - ', Blockly.Arduino.ORDER_SUBTRACTION],
    'MULTIPLY': [' * ', Blockly.Arduino.ORDER_MULTIPLICATION],
    'DIVIDE': [' / ', Blockly.Arduino.ORDER_DIVISION],
    'POWER': [null, Blockly.Arduino.ORDER_COMMA] // Handle power separately.
  };
  var tuple = OPERATORS[block.getFieldValue('OP')];
  var operator = tuple[0];
  var order = tuple[1];
  var argument0 = Blockly.Arduino.valueToCode(block, 'A', order) || '0';
  var argument1 = Blockly.Arduino.valueToCode(block, 'B', order) || '0';
  var result_code;
  // Power superscript is not supported in C++.
  if (!operator) {
    result_code = 'pow(' + argument0 + ', ' + argument1 + ')';
    return [result_code, Blockly.Arduino.ORDER_FUNCTION_CALL];
  }
  result_code = argument0 + operator + argument1;
  return [result_code, order];
};

Blockly.Arduino.forBlock['math_single'] = function(block) {
  var operator = block.getFieldValue('OP');
  var code;
  var arg;
  if (operator === 'NEG') {
    // Negation is a special case given its different operator precedence.
    arg = Blockly.Arduino.valueToCode(block, 'NUM',
        Blockly.Arduino.ORDER_UNARY_NEGATION) || '0';
    if (arg[0] === '-') {
      // '--x' should be 'x'.
      arg = arg.substring(1);
    } else {
      arg = '-' + arg;
    }
    code = arg;
    return [code, Blockly.Arduino.ORDER_UNARY_NEGATION];
  }
  if (operator === 'SIN' || operator === 'COS' || operator === 'TAN') {
    arg = Blockly.Arduino.valueToCode(block, 'NUM',
        Blockly.Arduino.ORDER_DIVISION) || '0';
  } else {
    arg = Blockly.Arduino.valueToCode(block, 'NUM',
        Blockly.Arduino.ORDER_NONE) || '0';
  }
  // First, handle cases which generate values that don't need parentheses
  // wrapping them.
  switch (operator) {
    case 'ABS':
      code = 'abs(' + arg + ')';
      break;
    case 'ROOT':
      code = 'sqrt(' + arg + ')';
      break;
    case 'LN':
      code = 'log(' + arg + ')';
      break;
    case 'LOG10':
      code = 'log10(' + arg + ')';
      break;
    case 'EXP':
      code = 'exp(' + arg + ')';
      break;
    case 'POW10':
      code = 'pow(10, ' + arg + ')';
      break;
    case 'ROUND':
      code = 'round(' + arg + ')';
      break;
    case 'ROUNDUP':
      code = 'ceil(' + arg + ')';
      break;
    case 'ROUNDDOWN':
      code = 'floor(' + arg + ')';
      break;
    case 'SIN':
      code = 'sin(' + arg + ' / 180.0 * PI)';
      break;
    case 'COS':
      code = 'cos(' + arg + ' / 180.0 * PI)';
      break;
    case 'TAN':
      code = 'tan(' + arg + ' / 180.0 * PI)';
      break;
  }
  if (code) {
    return [code, Blockly.Arduino.ORDER_FUNCTION_CALL];
  }
  // Second, handle cases which generate values that may need parentheses
  // wrapping them.
  switch (operator) {
    case 'ASIN':
      code = 'asin(' + arg + ') / PI * 180';
      break;
    case 'ACOS':
      code = 'acos(' + arg + ') / PI * 180';
      break;
    case 'ATAN':
      code = 'atan(' + arg + ') / PI * 180';
      break;
    default:
      throw new Error('Unknown math operator: ' + operator); 
  }
  return [code, Blockly.Arduino.ORDER_DIVISION];
};

// Arduino Math Blocks
Blockly.Arduino.forBlock['arduino_constrain'] = function(block) {
  var value = Blockly.Arduino.valueToCode(block, 'VALUE', Blockly.Arduino.ORDER_ATOMIC) || '0';
  var low = Blockly.Arduino.valueToCode(block, 'LOW', Blockly.Arduino.ORDER_ATOMIC) || '0';
  var high = Blockly.Arduino.valueToCode(block, 'HIGH', Blockly.Arduino.ORDER_ATOMIC) || '0';
  var code = 'constrain(' + value + ', ' + low + ', ' + high + ')';
  return [code, Blockly.Arduino.ORDER_ATOMIC];
};

Blockly.Arduino.forBlock['arduino_map'] = function(block) {
  var value = Blockly.Arduino.valueToCode(block, 'VALUE', Blockly.Arduino.ORDER_ATOMIC) || '0';
  var fromLow = Blockly.Arduino.valueToCode(block, 'FROMLOW', Blockly.Arduino.ORDER_ATOMIC) || '0';
  var fromHigh = Blockly.Arduino.valueToCode(block, 'FROMHIGH', Blockly.Arduino.ORDER_ATOMIC) || '1023';
  var toLow = Blockly.Arduino.valueToCode(block, 'TOLOW', Blockly.Arduino.ORDER_ATOMIC) || '0';
  var toHigh = Blockly.Arduino.valueToCode(block, 'TOHIGH', Blockly.Arduino.ORDER_ATOMIC) || '255';
  var code = 'map(' + value + ', ' + fromLow + ', ' + fromHigh + ', ' + toLow + ', ' + toHigh + ')';
  return [code, Blockly.Arduino.ORDER_ATOMIC];
};

Blockly.Arduino.forBlock['math_random_seed'] = function(block) {
  var seed = Blockly.Arduino.valueToCode(block, 'SEED', Blockly.Arduino.ORDER_ATOMIC) || '0';
  return 'randomSeed(' + seed + ');\n';
};

Blockly.Arduino.forBlock['math_random_int'] = function(block) {
  var min = Blockly.Arduino.valueToCode(block, 'MIN', Blockly.Arduino.ORDER_ATOMIC);
  var max = Blockly.Arduino.valueToCode(block, 'MAX', Blockly.Arduino.ORDER_ATOMIC);
  var code;
  if (min && max) {
    code = 'random(' + min + ', ' + max + ')';
  } else if (max) {
    code = 'random(' + max + ')';
  } else {
    code = 'random()';
  }
  return [code, Blockly.Arduino.ORDER_ATOMIC];
};
}
