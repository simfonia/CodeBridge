/// CodeBridge Engineer 風格覆寫
/// 跨模組的 C++ 語法覆寫，切換風格時統一載入

var ENGINEER_STYLE = {
  // Arduino 核心
  ARDUINO_PIN_LABEL: 'pin',
  ARDUINO_PIN_MODE: 'pinMode(%1, %2)',
  ARDUINO_DIGITAL_WRITE: 'digitalWrite(%1, %2)',
  ARDUINO_DIGITAL_READ: 'digitalRead(%1)',
  ARDUINO_ANALOG_WRITE: 'analogWrite(%1, %2)',
  ARDUINO_ANALOG_READ: 'analogRead(%1)',
  ARDUINO_DELAY: 'delay(%1)',
  ARDUINO_DELAY_MICROSECONDS: 'delayMicroseconds(%1)',
  ARDUINO_MILLIS: 'millis()',
  ARDUINO_MICROS: 'micros()',

  // 下拉選項
  ARDUINO_PIN_MODE_OUTPUT: 'OUTPUT',
  ARDUINO_PIN_MODE_INPUT: 'INPUT',
  ARDUINO_PIN_MODE_INPUT_PULLUP: 'INPUT_PULLUP',
  ARDUINO_DIGITAL_HIGH: 'HIGH',
  ARDUINO_DIGITAL_LOW: 'LOW',

  // 序列
  ARDUINO_SERIAL_BEGIN: 'Serial.begin(%1)',
  ARDUINO_SERIAL_PRINT: 'Serial.print(%1)',
  ARDUINO_SERIAL_PRINTLN: 'Serial.println(%1)',
  ARDUINO_SERIAL_AVAILABLE: 'Serial.available()',
  ARDUINO_SERIAL_READ: 'Serial.read()',
  ARDUINO_SERIAL_PRINT_NEWLINE: 'Serial.println()',

  // 結構
  INITIALIZES_SETUP_APPENDTEXT: 'void setup()',
  INITIALIZES_LOOP_APPENDTEXT: 'void loop()',

  // 邏輯（對齊 piBlockly Engineer 風格）
  CONTROLS_IF_MSG_IF: 'if',
  CONTROLS_IF_MSG_THEN: '',
  CONTROLS_IF_MSG_ELSEIF: 'else if',
  CONTROLS_IF_MSG_ELSE: 'else',
  // controls_if mutator 積木訊息
  CONTROLS_IF_IF_TITLE_IF: 'if',
  CONTROLS_IF_ELSEIF_TITLE_ELSEIF: 'else if',
  CONTROLS_IF_ELSE_TITLE_ELSE: 'else',


  LOGIC_OPERATION_AND: '&&',
  LOGIC_OPERATION_OR: '||',
  LOGIC_BOOLEAN_TRUE: 'true',
  LOGIC_BOOLEAN_FALSE: 'false',
  LOGIC_NEGATE_LABEL: '!%1',

  // 迴圈（對齊 piBlockly Engineer 風格）
  CONTROLS_FOR_MESSAGE: 'for (int %1 = %2; %3 %4 %5; %6 %7 %8) {',
  CONTROLS_WHILE_MESSAGE: 'while (%1) {',
  CONTROLS_FLOW_STATEMENTS_MESSAGE: '%1',

  // 數學（對齊 piBlockly Engineer 風格）
  MATH_SINGLE_OP_ABSOLUTE: 'abs',
  MATH_SINGLE_OP_ROOT: 'sqrt',
  ARDUINO_CONSTRAIN_MSG: 'constrain( %1, %2, %3 )',
  ARDUINO_MAP_MSG: 'map( %1, %2, %3, %4, %5 )',
  ARDUINO_MATH_RANDOM_SEED_MSG: 'randomSeed( %1 )',
  ARDUINO_MATH_RANDOM_INT_MSG: 'random( %1, %2 )',

  // 文字（對齊 piBlockly Engineer 風格）
  TEXT_TEXT: '"%1"',
  TEXT_APPEND_MESSAGE: '%1 += %2',
  TEXT_JOIN_MESSAGE: 'join',
  TEXT_JOIN_TITLE_CREATEWITH: '',
  TEXT_LENGTH_MESSAGE: '%1.length()',

  // 變數（對齊 piBlockly Engineer 風格）
  VARIABLES_DECLARE_GLOBAL_MESSAGE: 'Global %1 %2 = %3',
  VARIABLES_DECLARE_LOCAL_MESSAGE: 'Local %1 %2 = %3',
  VARIABLES_SET_MESSAGE: '%1 = %2',

  // 陣列（對齊 piBlockly Engineer 風格）
  ARRAY_DECLARE_GLOBAL_TITLE: 'Global Array',
  ARRAY_DECLARE_LOCAL_TITLE: 'Local Array',
  ARRAY_GET_BRACKET_OPEN: '[',
  ARRAY_GET_BRACKET_CLOSE: ']',
  ARRAY_SET_BRACKET_OPEN: '[',
  ARRAY_SET_BRACKET_CLOSE_EQUALS: '] = ',
  ARRAY_LENGTH_TITLE: 'length of Array',

  // 函式（對齊 piBlockly Engineer 風格）
  CUSTOM_FUNCTIONS_DEFNORETURN_MESSAGE: 'void %1 (%2) {',
  CUSTOM_FUNCTIONS_DEFRETURN_MESSAGE: '%1 %2 (%3) {',
  CUSTOM_FUNCTIONS_CALLNORETURN_MESSAGE: '%1()',
  CUSTOM_FUNCTIONS_CALLRETURN_MESSAGE: '%1()',
  CUSTOM_FUNCTIONS_MUTATORCONTAINER_MESSAGE: 'function inputs',
  CUSTOM_FUNCTIONS_MUTATORARG_MESSAGE: 'parameter',
  CUSTOM_FUNCTIONS_RETURN_MESSAGE: 'return %1',
};
