/// CodeBridge Arduino 核心積木產生器

if (typeof Blockly.Arduino !== 'undefined') {
  // ============================================================
  // Setup 產生器
  // ============================================================
  Blockly.Arduino.forBlock['initializes_setup'] = function(block: any) {
    const content = Blockly.Arduino.statementToCode(block, 'CONTENT');
    const code = 'void setup() {\n' + content + '}\n';
    return code;
  };

  // ============================================================
  // Loop 產生器
  // ============================================================
  Blockly.Arduino.forBlock['initializes_loop'] = function(block: any) {
    const content = Blockly.Arduino.statementToCode(block, 'CONTENT');
    const code = 'void loop() {\n' + content + '}\n';
    return code;
  };

  // ============================================================
  // pinMode 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_pin_mode'] = function(block: any) {
    const pin = Blockly.Arduino.valueToCode(block, 'PIN', Blockly.Arduino.ORDER_ATOMIC);
    const mode = block.getFieldValue('MODE');
    return `pinMode(${pin}, ${mode});\n`;
  };

  // ============================================================
  // digitalWrite 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_digital_write'] = function(block: any) {
    const pin = Blockly.Arduino.valueToCode(block, 'PIN', Blockly.Arduino.ORDER_ATOMIC);
    const value = block.getFieldValue('VALUE');
    return `digitalWrite(${pin}, ${value});\n`;
  };

  // ============================================================
  // digitalRead 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_digital_read'] = function(block: any) {
    const pin = Blockly.Arduino.valueToCode(block, 'PIN', Blockly.Arduino.ORDER_ATOMIC);
    return [`digitalRead(${pin})`, Blockly.Arduino.ORDER_ATOMIC];
  };

  // ============================================================
  // analogWrite 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_analog_write'] = function(block: any) {
    const pin = Blockly.Arduino.valueToCode(block, 'PIN', Blockly.Arduino.ORDER_ATOMIC);
    const value = Blockly.Arduino.valueToCode(block, 'VALUE', Blockly.Arduino.ORDER_ATOMIC);
    return `analogWrite(${pin}, ${value});\n`;
  };

  // ============================================================
  // analogRead 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_analog_read'] = function(block: any) {
    const pin = Blockly.Arduino.valueToCode(block, 'PIN', Blockly.Arduino.ORDER_ATOMIC);
    return [`analogRead(${pin})`, Blockly.Arduino.ORDER_ATOMIC];
  };

  // ============================================================
  // delay 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_delay'] = function(block: any) {
    const time = Blockly.Arduino.valueToCode(block, 'TIME', Blockly.Arduino.ORDER_ATOMIC);
    return `delay(${time});\n`;
  };

  // ============================================================
  // delayMicroseconds 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_delay_microseconds'] = function(block: any) {
    const time = Blockly.Arduino.valueToCode(block, 'TIME', Blockly.Arduino.ORDER_ATOMIC);
    return `delayMicroseconds(${time});\n`;
  };

  // ============================================================
  // millis 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_millis'] = function(block: any) {
    return ['millis()', Blockly.Arduino.ORDER_ATOMIC];
  };

  // ============================================================
  // micros 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_micros'] = function(block: any) {
    return ['micros()', Blockly.Arduino.ORDER_ATOMIC];
  };
}