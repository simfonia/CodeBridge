/// CodeBridge Arduino 程式碼產生器
/// 使用 Blockly.Arduino.forBlock[] 註冊產生器

// Arduino 影子積木 - 腳位輸入
if (typeof Blockly.Arduino !== 'undefined') {
    Blockly.Arduino.forBlock['arduino_pin_shadow'] = function(block) {
        const pin = block.getFieldValue('PIN') || '2';
        return [pin, Blockly.Arduino.ORDER_ATOMIC];
    };

    // pinMode 積木
    Blockly.Arduino.forBlock['arduino_pin_mode'] = function(block) {
        const pin = Blockly.Arduino.valueToCode(block, 'PIN', Blockly.Arduino.ORDER_ATOMIC);
        const mode = block.getFieldValue('MODE');
        return `pinMode(${pin}, ${mode});\n`;
    };

    // digitalWrite 積木
    Blockly.Arduino.forBlock['arduino_digital_write'] = function(block) {
        const pin = Blockly.Arduino.valueToCode(block, 'PIN', Blockly.Arduino.ORDER_ATOMIC);
        const value = block.getFieldValue('VALUE');
        return `digitalWrite(${pin}, ${value});\n`;
    };

    // digitalRead 積木
    Blockly.Arduino.forBlock['arduino_digital_read'] = function(block) {
        const pin = Blockly.Arduino.valueToCode(block, 'PIN', Blockly.Arduino.ORDER_ATOMIC);
        return [`digitalRead(${pin})`, Blockly.Arduino.ORDER_ATOMIC];
    };

    // analogWrite 積木
    Blockly.Arduino.forBlock['arduino_analog_write'] = function(block) {
        const pin = Blockly.Arduino.valueToCode(block, 'PIN', Blockly.Arduino.ORDER_ATOMIC);
        const value = Blockly.Arduino.valueToCode(block, 'VALUE', Blockly.Arduino.ORDER_ATOMIC);
        return `analogWrite(${pin}, ${value});\n`;
    };

    // analogRead 積木
    Blockly.Arduino.forBlock['arduino_analog_read'] = function(block) {
        const pin = Blockly.Arduino.valueToCode(block, 'PIN', Blockly.Arduino.ORDER_ATOMIC);
        return [`analogRead(${pin})`, Blockly.Arduino.ORDER_ATOMIC];
    };

    // delay 積木
    Blockly.Arduino.forBlock['arduino_delay'] = function(block) {
        const time = Blockly.Arduino.valueToCode(block, 'TIME', Blockly.Arduino.ORDER_ATOMIC);
        return `delay(${time});\n`;
    };

    // Serial.print 積木
    Blockly.Arduino.forBlock['arduino_serial_print'] = function(block) {
        const value = Blockly.Arduino.valueToCode(block, 'VALUE', Blockly.Arduino.ORDER_ATOMIC);
        return `Serial.print(${value});\n`;
    };
}