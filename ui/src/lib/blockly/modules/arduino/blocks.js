/// CodeBridge Arduino 模組 - 積木定義
/// 影子積木 + 結構 + I/O + 時間 + 序列通訊

// ============================================================
// 影子積木 - 腳位輸入
// ============================================================
Blockly.Blocks['arduino_pin_shadow'] = {
    init: function() {
        this.jsonInit({
            type: 'arduino_pin_shadow',
            message0: '%{BKY_ARDUINO_PIN_LABEL} %1',
            args0: [
                {
                    type: 'field_input',
                    name: 'PIN',
                    text: '',
                    spellcheck: false
                }
            ],
            output: ['Number', 'String'],
            colour: '%{BKY_ARDUINO_CONTROL_HUE}',
            tooltip: '',
            helpUrl: ''
        });
    }
};

// ============================================================
// Setup
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
// Loop
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
// pinMode
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
// digitalWrite
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
// digitalRead
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
// analogWrite
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
// analogRead
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
// delay
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
// delayMicroseconds
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
// millis
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
// micros
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

// ============================================================
// Serial.begin（含常用鮑率下拉選單）
// ============================================================
Blockly.Blocks['arduino_serial_begin'] = {
    init: function() {
        this.jsonInit({
            type: 'arduino_serial_begin',
            message0: '%{BKY_ARDUINO_SERIAL_BEGIN}',
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'BAUD',
                    options: [
                        ['%{BKY_ARDUINO_SERIAL_BAUD_9600}', '9600'],
                        ['%{BKY_ARDUINO_SERIAL_BAUD_300}', '300'],
                        ['%{BKY_ARDUINO_SERIAL_BAUD_1200}', '1200'],
                        ['%{BKY_ARDUINO_SERIAL_BAUD_2400}', '2400'],
                        ['%{BKY_ARDUINO_SERIAL_BAUD_4800}', '4800'],
                        ['%{BKY_ARDUINO_SERIAL_BAUD_14400}', '14400'],
                        ['%{BKY_ARDUINO_SERIAL_BAUD_19200}', '19200'],
                        ['%{BKY_ARDUINO_SERIAL_BAUD_28800}', '28800'],
                        ['%{BKY_ARDUINO_SERIAL_BAUD_38400}', '38400'],
                        ['%{BKY_ARDUINO_SERIAL_BAUD_57600}', '57600'],
                        ['%{BKY_ARDUINO_SERIAL_BAUD_115200}', '115200']
                    ]
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
// Serial.print
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
// Serial.println
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
// Serial.available
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
// Serial.read
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
// Serial.println() (no args)
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