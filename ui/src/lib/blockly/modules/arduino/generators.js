/// CodeBridge Arduino 模組 - 程式碼產生器

if (typeof Blockly.Arduino !== 'undefined') {
  // 影子積木
  Blockly.Arduino.forBlock['arduino_pin_shadow'] = function(block) {
    const pin = block.getFieldValue('PIN') || '';
    return [pin, Blockly.Arduino.ORDER_ATOMIC];
  };

  // Setup - 將內容放入 setups_ 籃子，記錄 block ID 供 finish() 定位
  Blockly.Arduino.forBlock['initializes_setup'] = function(block) {
    var contentBlock = block.getInputTargetBlock('CONTENT');
    var statements_content = contentBlock ? Blockly.Arduino.blockToCode(contentBlock) : '';
    Blockly.Arduino.setups_['user_code'] = statements_content;
    Blockly.Arduino.setupsBlockId_ = block.id;
    return '';
  };

  // Loop - 回傳內容給 finish() 組裝進 void loop()，記錄 block ID 供 finish() 定位
  Blockly.Arduino.forBlock['initializes_loop'] = function(block) {
    Blockly.Arduino.loopBlockId_ = block.id;
    var contentBlock = block.getInputTargetBlock('CONTENT');
    return contentBlock ? Blockly.Arduino.blockToCode(contentBlock) : '';
  };

  // pinMode
  Blockly.Arduino.forBlock['arduino_pin_mode'] = function(block) {
    const pin = Blockly.Arduino.valueToCode(block, 'PIN', Blockly.Arduino.ORDER_ATOMIC);
    const mode = block.getFieldValue('MODE');
    return 'pinMode(' + pin + ', ' + mode + ');\n';
  };

  // digitalWrite
  Blockly.Arduino.forBlock['arduino_digital_write'] = function(block) {
    const pin = Blockly.Arduino.valueToCode(block, 'PIN', Blockly.Arduino.ORDER_ATOMIC);
    const value = block.getFieldValue('VALUE');
    return 'digitalWrite(' + pin + ', ' + value + ');\n';
  };

  // digitalRead
  Blockly.Arduino.forBlock['arduino_digital_read'] = function(block) {
    const pin = Blockly.Arduino.valueToCode(block, 'PIN', Blockly.Arduino.ORDER_ATOMIC);
    return ['digitalRead(' + pin + ')', Blockly.Arduino.ORDER_ATOMIC];
  };

  // analogWrite
  Blockly.Arduino.forBlock['arduino_analog_write'] = function(block) {
    const pin = Blockly.Arduino.valueToCode(block, 'PIN', Blockly.Arduino.ORDER_ATOMIC);
    const value = Blockly.Arduino.valueToCode(block, 'VALUE', Blockly.Arduino.ORDER_ATOMIC);
    return 'analogWrite(' + pin + ', ' + value + ');\n';
  };

  // analogRead
  Blockly.Arduino.forBlock['arduino_analog_read'] = function(block) {
    const pin = Blockly.Arduino.valueToCode(block, 'PIN', Blockly.Arduino.ORDER_ATOMIC);
    return ['analogRead(' + pin + ')', Blockly.Arduino.ORDER_ATOMIC];
  };

  // delay
  Blockly.Arduino.forBlock['arduino_delay'] = function(block) {
    const time = Blockly.Arduino.valueToCode(block, 'TIME', Blockly.Arduino.ORDER_ATOMIC);
    return 'delay(' + time + ');\n';
  };

  // delayMicroseconds
  Blockly.Arduino.forBlock['arduino_delay_microseconds'] = function(block) {
    const time = Blockly.Arduino.valueToCode(block, 'TIME', Blockly.Arduino.ORDER_ATOMIC);
    return 'delayMicroseconds(' + time + ');\n';
  };

  // millis
  Blockly.Arduino.forBlock['arduino_millis'] = function(block) {
    return ['millis()', Blockly.Arduino.ORDER_ATOMIC];
  };

  // micros
  Blockly.Arduino.forBlock['arduino_micros'] = function(block) {
    return ['micros()', Blockly.Arduino.ORDER_ATOMIC];
  };

  // Serial.begin
  Blockly.Arduino.forBlock['arduino_serial_begin'] = function(block) {
    const baud = block.getFieldValue('BAUD') || '9600';
    return 'Serial.begin(' + baud + ');\n';
  };

  // Serial.print
  Blockly.Arduino.forBlock['arduino_serial_print'] = function(block) {
    const value = Blockly.Arduino.valueToCode(block, 'VALUE', Blockly.Arduino.ORDER_ATOMIC);
    return 'Serial.print(' + value + ');\n';
  };

  // Serial.println
  Blockly.Arduino.forBlock['arduino_serial_println'] = function(block) {
    const value = Blockly.Arduino.valueToCode(block, 'VALUE', Blockly.Arduino.ORDER_ATOMIC);
    return 'Serial.println(' + value + ');\n';
  };

  // Serial.available
  Blockly.Arduino.forBlock['arduino_serial_available'] = function(block) {
    return ['Serial.available()', Blockly.Arduino.ORDER_ATOMIC];
  };

  // Serial.read
  Blockly.Arduino.forBlock['arduino_serial_read'] = function(block) {
    return ['Serial.read()', Blockly.Arduino.ORDER_ATOMIC];
  };

  // Serial.println() (no args)
  Blockly.Arduino.forBlock['arduino_serial_print_newline'] = function(block) {
    return 'Serial.println();\n';
  };
}