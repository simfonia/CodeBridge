/// CodeBridge 序列通訊積木產生器

if (typeof Blockly.Arduino !== 'undefined') {
  // ============================================================
  // Serial.begin 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_serial_begin'] = function(block: any) {
    const baud = Blockly.Arduino.valueToCode(block, 'BAUD', Blockly.Arduino.ORDER_ATOMIC);
    return `Serial.begin(${baud});\n`;
  };

  // ============================================================
  // Serial.print 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_serial_print'] = function(block: any) {
    const value = Blockly.Arduino.valueToCode(block, 'VALUE', Blockly.Arduino.ORDER_ATOMIC);
    return `Serial.print(${value});\n`;
  };

  // ============================================================
  // Serial.println 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_serial_println'] = function(block: any) {
    const value = Blockly.Arduino.valueToCode(block, 'VALUE', Blockly.Arduino.ORDER_ATOMIC);
    return `Serial.println(${value});\n`;
  };

  // ============================================================
  // Serial.available 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_serial_available'] = function(block: any) {
    return ['Serial.available()', Blockly.Arduino.ORDER_ATOMIC];
  };

  // ============================================================
  // Serial.read 產生器
  // ============================================================
  Blockly.Arduino.forBlock['arduino_serial_read'] = function(block: any) {
    return ['Serial.read()', Blockly.Arduino.ORDER_ATOMIC];
  };

  // ============================================================
  // Serial.println() (no args) 產生器 - 輸出空一行
  // ============================================================
  Blockly.Arduino.forBlock['arduino_serial_print_newline'] = function(block: any) {
    return 'Serial.println();\n';
  };
}