/// CodeBridge Arduino 程式碼產生器
/// 使用 Blockly.Arduino.forBlock[] 註冊產生器

if (typeof Blockly.Arduino !== 'undefined') {
  // ============================================================
  // 影子積木產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_pin_shadow'] = function(block) {
    const pin = block.getFieldValue('PIN') || '';
    return [pin, Blockly.Arduino.ORDER_ATOMIC];
  };

  // ============================================================
  // Setup 產生器
  // ============================================================
  Blockly.Arduino.forBlock['initializes_setup'] = function(block) {
    const content = Blockly.Arduino.statementToCode(block, 'CONTENT');
    return 'void setup() {\n' + content + '}\n';
  };

  // ============================================================
  // Loop 產生器
  // ============================================================
  Blockly.Arduino.forBlock['initializes_loop'] = function(block) {
    const content = Blockly.Arduino.statementToCode(block, 'CONTENT');
    return 'void loop() {\n' + content + '}\n';
  };

  // ============================================================
  // pinMode 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_pin_mode'] = function(block) {
    const pin = Blockly.Arduino.valueToCode(block, 'PIN', Blockly.Arduino.ORDER_ATOMIC);
    const mode = block.getFieldValue('MODE');
    return 'pinMode(' + pin + ', ' + mode + ');\n';
  };

  // ============================================================
  // digitalWrite 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_digital_write'] = function(block) {
    const pin = Blockly.Arduino.valueToCode(block, 'PIN', Blockly.Arduino.ORDER_ATOMIC);
    const value = block.getFieldValue('VALUE');
    return 'digitalWrite(' + pin + ', ' + value + ');\n';
  };

  // ============================================================
  // digitalRead 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_digital_read'] = function(block) {
    const pin = Blockly.Arduino.valueToCode(block, 'PIN', Blockly.Arduino.ORDER_ATOMIC);
    return ['digitalRead(' + pin + ')', Blockly.Arduino.ORDER_ATOMIC];
  };

  // ============================================================
  // analogWrite 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_analog_write'] = function(block) {
    const pin = Blockly.Arduino.valueToCode(block, 'PIN', Blockly.Arduino.ORDER_ATOMIC);
    const value = Blockly.Arduino.valueToCode(block, 'VALUE', Blockly.Arduino.ORDER_ATOMIC);
    return 'analogWrite(' + pin + ', ' + value + ');\n';
  };

  // ============================================================
  // analogRead 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_analog_read'] = function(block) {
    const pin = Blockly.Arduino.valueToCode(block, 'PIN', Blockly.Arduino.ORDER_ATOMIC);
    return ['analogRead(' + pin + ')', Blockly.Arduino.ORDER_ATOMIC];
  };

  // ============================================================
  // delay 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_delay'] = function(block) {
    const time = Blockly.Arduino.valueToCode(block, 'TIME', Blockly.Arduino.ORDER_ATOMIC);
    return 'delay(' + time + ');\n';
  };

  // ============================================================
  // delayMicroseconds 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_delay_microseconds'] = function(block) {
    const time = Blockly.Arduino.valueToCode(block, 'TIME', Blockly.Arduino.ORDER_ATOMIC);
    return 'delayMicroseconds(' + time + ');\n';
  };

  // ============================================================
  // millis 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_millis'] = function(block) {
    return ['millis()', Blockly.Arduino.ORDER_ATOMIC];
  };

  // ============================================================
  // micros 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_micros'] = function(block) {
    return ['micros()', Blockly.Arduino.ORDER_ATOMIC];
  };

  // ============================================================
  // Serial.begin 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_serial_begin'] = function(block) {
    const baud = Blockly.Arduino.valueToCode(block, 'BAUD', Blockly.Arduino.ORDER_ATOMIC);
    return 'Serial.begin(' + baud + ');\n';
  };

  // ============================================================
  // Serial.print 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_serial_print'] = function(block) {
    const value = Blockly.Arduino.valueToCode(block, 'VALUE', Blockly.Arduino.ORDER_ATOMIC);
    return 'Serial.print(' + value + ');\n';
  };

  // ============================================================
  // Serial.println 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_serial_println'] = function(block) {
    const value = Blockly.Arduino.valueToCode(block, 'VALUE', Blockly.Arduino.ORDER_ATOMIC);
    return 'Serial.println(' + value + ');\n';
  };

  // ============================================================
  // Serial.available 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_serial_available'] = function(block) {
    return ['Serial.available()', Blockly.Arduino.ORDER_ATOMIC];
  };

  // ============================================================
  // Serial.read 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_serial_read'] = function(block) {
    return ['Serial.read()', Blockly.Arduino.ORDER_ATOMIC];
  };

  // ============================================================
  // Serial.println() (no args) 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_serial_print_newline'] = function(block) {
    return 'Serial.println();\n';
  };
}