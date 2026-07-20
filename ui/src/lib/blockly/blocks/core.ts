/// CodeBridge Arduino 核心積木定義
/// 使用 %{BKY_...} 佔位符引用訊息，支援 Angel / Engineer 風格切換

// ============================================================
// Setup 積木
// ============================================================
Blockly.Blocks['initializes_setup'] = {
  init: function() {
    this.jsonInit({
      type: 'initializes_setup',
      message0: '%{BKY_INITIALIZES_SETUP_APPENDTEXT}',
      message1: '%1',
      args1: [
        {
          type: 'input_statement',
          name: 'CONTENT'
        }
      ],
      nextStatement: true,
      colour: '%{BKY_ARDUINO_STRUCTURE_HUE}',
      tooltip: '%{BKY_INITIALIZES_SETUP_TOOLTIP}',
      helpUrl: ''
    });
  }
};

// ============================================================
// Loop 積木
// ============================================================
Blockly.Blocks['initializes_loop'] = {
  init: function() {
    this.jsonInit({
      type: 'initializes_loop',
      message0: '%{BKY_INITIALIZES_LOOP_APPENDTEXT}',
      message1: '%1',
      args1: [
        {
          type: 'input_statement',
          name: 'CONTENT'
        }
      ],
      previousStatement: true,
      colour: '%{BKY_ARDUINO_STRUCTURE_HUE}',
      tooltip: '%{BKY_INITIALIZES_LOOP_TOOLTIP}',
      helpUrl: ''
    });
  }
};

// ============================================================
// pinMode 積木
// ============================================================
Blockly.Blocks['arduino_pin_mode'] = {
  init: function() {
    this.jsonInit({
      type: 'arduino_pin_mode',
      message0: '%{BKY_ARDUINO_PIN_MODE}',
      args0: [
        {
          type: 'input_value',
          name: 'PIN',
          check: ['Number', 'String']
        },
        {
          type: 'field_dropdown',
          name: 'MODE',
          options: [
            ['%{BKY_ARDUINO_PIN_MODE_OUTPUT}', 'OUTPUT'],
            ['%{BKY_ARDUINO_PIN_MODE_INPUT}', 'INPUT'],
            ['%{BKY_ARDUINO_PIN_MODE_INPUT_PULLUP}', 'INPUT_PULLUP']
          ]
        }
      ],
      previousStatement: true,
      nextStatement: true,
      colour: '%{BKY_ARDUINO_CONTROL_HUE}',
      tooltip: '%{BKY_ARDUINO_PIN_MODE_TOOLTIP}',
      helpUrl: ''
    });
  }
};

// ============================================================
// digitalWrite 積木
// ============================================================
Blockly.Blocks['arduino_digital_write'] = {
  init: function() {
    this.jsonInit({
      type: 'arduino_digital_write',
      message0: '%{BKY_ARDUINO_DIGITAL_WRITE}',
      args0: [
        {
          type: 'input_value',
          name: 'PIN',
          check: ['Number', 'String']
        },
        {
          type: 'field_dropdown',
          name: 'VALUE',
          options: [
            ['%{BKY_ARDUINO_DIGITAL_HIGH}', 'HIGH'],
            ['%{BKY_ARDUINO_DIGITAL_LOW}', 'LOW']
          ]
        }
      ],
      previousStatement: true,
      nextStatement: true,
      colour: '%{BKY_ARDUINO_DIGITAL_IO_HUE}',
      tooltip: '%{BKY_ARDUINO_DIGITAL_WRITE_TOOLTIP}',
      helpUrl: ''
    });
  }
};

// ============================================================
// digitalRead 積木
// ============================================================
Blockly.Blocks['arduino_digital_read'] = {
  init: function() {
    this.jsonInit({
      type: 'arduino_digital_read',
      message0: '%{BKY_ARDUINO_DIGITAL_READ}',
      args0: [
        {
          type: 'input_value',
          name: 'PIN',
          check: ['Number', 'String']
        }
      ],
      output: 'Number',
      colour: '%{BKY_ARDUINO_DIGITAL_IO_HUE}',
      tooltip: '%{BKY_ARDUINO_DIGITAL_READ_TOOLTIP}',
      helpUrl: ''
    });
  }
};

// ============================================================
// analogWrite 積木
// ============================================================
Blockly.Blocks['arduino_analog_write'] = {
  init: function() {
    this.jsonInit({
      type: 'arduino_analog_write',
      message0: '%{BKY_ARDUINO_ANALOG_WRITE}',
      args0: [
        {
          type: 'input_value',
          name: 'PIN',
          check: ['Number', 'String']
        },
        {
          type: 'input_value',
          name: 'VALUE',
          check: 'Number'
        }
      ],
      previousStatement: true,
      nextStatement: true,
      colour: '%{BKY_ARDUINO_ANALOG_IO_HUE}',
      tooltip: '%{BKY_ARDUINO_ANALOG_WRITE_TOOLTIP}',
      helpUrl: ''
    });
  }
};

// ============================================================
// analogRead 積木
// ============================================================
Blockly.Blocks['arduino_analog_read'] = {
  init: function() {
    this.jsonInit({
      type: 'arduino_analog_read',
      message0: '%{BKY_ARDUINO_ANALOG_READ}',
      args0: [
        {
          type: 'input_value',
          name: 'PIN',
          check: ['Number', 'String']
        }
      ],
      output: 'Number',
      colour: '%{BKY_ARDUINO_ANALOG_IO_HUE}',
      tooltip: '%{BKY_ARDUINO_ANALOG_READ_TOOLTIP}',
      helpUrl: ''
    });
  }
};

// ============================================================
// delay 積木
// ============================================================
Blockly.Blocks['arduino_delay'] = {
  init: function() {
    this.jsonInit({
      type: 'arduino_delay',
      message0: '%{BKY_ARDUINO_DELAY}',
      args0: [
        {
          type: 'input_value',
          name: 'TIME',
          check: 'Number'
        }
      ],
      previousStatement: true,
      nextStatement: true,
      colour: '%{BKY_ARDUINO_TIME_HUE}',
      tooltip: '%{BKY_ARDUINO_DELAY_TOOLTIP}',
      helpUrl: ''
    });
  }
};

// ============================================================
// delayMicroseconds 積木
// ============================================================
Blockly.Blocks['arduino_delay_microseconds'] = {
  init: function() {
    this.jsonInit({
      type: 'arduino_delay_microseconds',
      message0: '%{BKY_ARDUINO_DELAY_MICROSECONDS}',
      args0: [
        {
          type: 'input_value',
          name: 'TIME',
          check: 'Number'
        }
      ],
      previousStatement: true,
      nextStatement: true,
      colour: '%{BKY_ARDUINO_TIME_HUE}',
      tooltip: '%{BKY_ARDUINO_DELAY_MICROSECONDS_TOOLTIP}',
      helpUrl: ''
    });
  }
};

// ============================================================
// millis 積木
// ============================================================
Blockly.Blocks['arduino_millis'] = {
  init: function() {
    this.jsonInit({
      type: 'arduino_millis',
      message0: '%{BKY_ARDUINO_MILLIS}',
      output: 'Number',
      colour: '%{BKY_ARDUINO_TIME_HUE}',
      tooltip: '%{BKY_ARDUINO_MILLIS_TOOLTIP}',
      helpUrl: ''
    });
  }
};

// ============================================================
// micros 積木
// ============================================================
Blockly.Blocks['arduino_micros'] = {
  init: function() {
    this.jsonInit({
      type: 'arduino_micros',
      message0: '%{BKY_ARDUINO_MICROS}',
      output: 'Number',
      colour: '%{BKY_ARDUINO_TIME_HUE}',
      tooltip: '%{BKY_ARDUINO_MICROS_TOOLTIP}',
      helpUrl: ''
    });
  }
};