/// CodeBridge 影子積木產生器

if (typeof Blockly.Arduino !== 'undefined') {
  Blockly.Arduino.forBlock['arduino_pin_shadow'] = function(block: any) {
    const pin = block.getFieldValue('PIN') || '';
    return [pin, Blockly.Arduino.ORDER_ATOMIC];
  };
}