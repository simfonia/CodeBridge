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

  // 邏輯（未來模組）
  LOGIC_OPERATION_AND: '&&',
  LOGIC_OPERATION_OR: '||',
  LOGIC_BOOLEAN_TRUE: 'true',
  LOGIC_BOOLEAN_FALSE: 'false',
  CONTROLS_IF_MSG_IF: 'if',
  CONTROLS_IF_MSG_THEN: '',
  CONTROLS_IF_MSG_ELSEIF: 'else if',
  CONTROLS_IF_MSG_ELSE: 'else',

  // 迴圈（未來模組）
  CONTROLS_FOR_MESSAGE: 'for(%1 = %2; %1 <= %3; %1 += %4)',
  CONTROLS_WHILE_MESSAGE: 'while(%1)',
  CONTROLS_FLOW_STATEMENTS_MESSAGE: 'break',

  // 數學（未來模組）
  ARDUINO_CONSTRAIN: 'constrain(%1, %2, %3)',
  ARDUINO_MAP: 'map(%1, %2, %3, %4, %5)',
  ARDUINO_MATH_RANDOM_SEED: 'randomSeed(%1)',
  ARDUINO_MATH_RANDOM_INT: 'random(%1, %2)',
  MATH_CHANGE: '%1 += %2',
  MATH_MODULO: '%1 %% %2',
};