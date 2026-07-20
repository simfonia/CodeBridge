/// CodeBridge 序列通訊積木定義

// ============================================================
// Serial.begin 積木
// ============================================================
Blockly.Blocks['arduino_serial_begin'] = {
  init: function() {
    this.jsonInit({
      type: 'arduino_serial_begin',
      message0: '%{BKY_ARDUINO_SERIAL_BEGIN}',
      args0: [
        {
          type: 'input_value',
          name: 'BAUD',
          check: 'Number'
        }
      ],
      previousStatement: true,
      nextStatement: true,
      colour: '%{BKY_ARDUINO_SERIAL_HUE}',
      tooltip: '%{BKY_ARDUINO_SERIAL_BEGIN_TOOLTIP}',
      helpUrl: ''
    });
  }
};

// ============================================================
// Serial.print 積木
// ============================================================
Blockly.Blocks['arduino_serial_print'] = {
  init: function() {
    this.jsonInit({
      type: 'arduino_serial_print',
      message0: '%{BKY_ARDUINO_SERIAL_PRINT}',
      args0: [
        {
          type: 'input_value',
          name: 'VALUE',
          check: ['Number', 'String']
        }
      ],
      previousStatement: true,
      nextStatement: true,
      colour: '%{BKY_ARDUINO_SERIAL_HUE}',
      tooltip: '%{BKY_ARDUINO_SERIAL_PRINT_TOOLTIP}',
      helpUrl: ''
    });
  }
};

// ============================================================
// Serial.println 積木
// ============================================================
Blockly.Blocks['arduino_serial_println'] = {
  init: function() {
    this.jsonInit({
      type: 'arduino_serial_println',
      message0: '%{BKY_ARDUINO_SERIAL_PRINTLN}',
      args0: [
        {
          type: 'input_value',
          name: 'VALUE',
          check: ['Number', 'String']
        }
      ],
      previousStatement: true,
      nextStatement: true,
      colour: '%{BKY_ARDUINO_SERIAL_HUE}',
      tooltip: '%{BKY_ARDUINO_SERIAL_PRINTLN_TOOLTIP}',
      helpUrl: ''
    });
  }
};

// ============================================================
// Serial.available 積木
// ============================================================
Blockly.Blocks['arduino_serial_available'] = {
  init: function() {
    this.jsonInit({
      type: 'arduino_serial_available',
      message0: '%{BKY_ARDUINO_SERIAL_AVAILABLE}',
      output: 'Number',
      colour: '%{BKY_ARDUINO_SERIAL_HUE}',
      tooltip: '%{BKY_ARDUINO_SERIAL_AVAILABLE_TOOLTIP}',
      helpUrl: ''
    });
  }
};

// ============================================================
// Serial.read 積木
// ============================================================
Blockly.Blocks['arduino_serial_read'] = {
  init: function() {
    this.jsonInit({
      type: 'arduino_serial_read',
      message0: '%{BKY_ARDUINO_SERIAL_READ}',
      output: 'Number',
      colour: '%{BKY_ARDUINO_SERIAL_HUE}',
      tooltip: '%{BKY_ARDUINO_SERIAL_READ_TOOLTIP}',
      helpUrl: ''
    });
  }
};

// ============================================================
// Serial.println() (no args) 積木 - 輸出空一行
// ============================================================
Blockly.Blocks['arduino_serial_print_newline'] = {
  init: function() {
    this.jsonInit({
      type: 'arduino_serial_print_newline',
      message0: '%{BKY_ARDUINO_SERIAL_PRINT_NEWLINE}',
      previousStatement: true,
      nextStatement: true,
      colour: '%{BKY_ARDUINO_SERIAL_HUE}',
      tooltip: '',
      helpUrl: ''
    });
  }
};