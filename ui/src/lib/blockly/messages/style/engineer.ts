/// CodeBridge Engineer 風格覆寫
/// 僅包含有直接 C++/Arduino API 對應的核心積木
/// 感測器/硬體積木不受影響（維持語系自然語言）

export const ENGINEER_STYLE: Record<string, string> = {
  // ============================================================
  // Arduino 核心積木 - 覆寫為 C++ 語法
  // ============================================================
  'ARDUINO_PIN_MODE': 'pinMode(%1, %2)',
  'ARDUINO_DIGITAL_WRITE': 'digitalWrite(%1, %2)',
  'ARDUINO_DIGITAL_READ': 'digitalRead(%1)',
  'ARDUINO_ANALOG_WRITE': 'analogWrite(%1, %2)',
  'ARDUINO_ANALOG_READ': 'analogRead(%1)',
  'ARDUINO_DELAY': 'delay(%1)',
  'ARDUINO_DELAY_MICROSECONDS': 'delayMicroseconds(%1)',
  'ARDUINO_MILLIS': 'millis()',
  'ARDUINO_MICROS': 'micros()',

  // === Dropdown 選項覆寫為 C++ 常數 ===
  'ARDUINO_PIN_MODE_OUTPUT': 'OUTPUT',
  'ARDUINO_PIN_MODE_INPUT': 'INPUT',
  'ARDUINO_PIN_MODE_INPUT_PULLUP': 'INPUT_PULLUP',
  'ARDUINO_DIGITAL_HIGH': 'HIGH',
  'ARDUINO_DIGITAL_LOW': 'LOW',

  // ============================================================
  // 序列通訊積木
  // ============================================================
  'ARDUINO_SERIAL_BEGIN': 'Serial.begin(%1)',
  'ARDUINO_SERIAL_PRINT': 'Serial.print(%1)',
  'ARDUINO_SERIAL_PRINTLN': 'Serial.println(%1)',
  'ARDUINO_SERIAL_AVAILABLE': 'Serial.available()',
  'ARDUINO_SERIAL_READ': 'Serial.read()',
  'ARDUINO_SERIAL_PRINT_NEWLINE': 'Serial.println()',

  // ============================================================
  // 結構積木（維持 C++ 語法）
  // ============================================================
  'INITIALIZES_SETUP_APPENDTEXT': 'void setup()',
  'INITIALIZES_LOOP_APPENDTEXT': 'void loop()',

  // ============================================================
  // 邏輯積木
  // ============================================================
  'LOGIC_OPERATION_AND': '&&',
  'LOGIC_OPERATION_OR': '||',
  'LOGIC_BOOLEAN_TRUE': 'true',
  'LOGIC_BOOLEAN_FALSE': 'false',
  'CONTROLS_IF_MSG_IF': 'if',
  'CONTROLS_IF_MSG_THEN': '',
  'CONTROLS_IF_MSG_ELSEIF': 'else if',
  'CONTROLS_IF_MSG_ELSE': 'else',

  // ============================================================
  // 迴圈積木
  // ============================================================
  'CONTROLS_FOR_MESSAGE': 'for(%1 = %2; %1 <= %3; %1 += %4)',
  'CONTROLS_WHILE_MESSAGE': 'while(%1)',
  'CONTROLS_FLOW_STATEMENTS_MESSAGE': 'break',

  // ============================================================
  // 數學積木
  // ============================================================
  'ARDUINO_CONSTRAIN': 'constrain(%1, %2, %3)',
  'ARDUINO_MAP': 'map(%1, %2, %3, %4, %5)',
  'ARDUINO_MATH_RANDOM_SEED': 'randomSeed(%1)',
  'ARDUINO_MATH_RANDOM_INT': 'random(%1, %2)',
  'MATH_CHANGE': '%1 += %2',
  'MATH_MODULO': '%1 %% %2',
};