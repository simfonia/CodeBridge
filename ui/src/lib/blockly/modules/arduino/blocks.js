/// CodeBridge Arduino 模組 - 積木定義
/// 影子積木 + 結構 + I/O + 時間 + 序列通訊

/// `arduino_serial_begin` 的預設鮑率。
///
/// 9600 是初學者最常用的設定，Arduino IDE 的預設值也是它。
/// 獨立在模組層宣告，讓 serial-monitor 的 baud 清單與此保持一致
/// （見 `ui/tests/e2e/serial-monitor.spec.js`「波特率選項與積木的 BAUD 清單一致」）。
var DEFAULT_BAUD = '9600';

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
            tooltip: '',
            helpUrl: ''
        });
        this.setColour(CodeBridgeBlockPalette.getColourForRole('control'));
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
            tooltip: '%{BKY_INITIALIZES_SETUP_TOOLTIP}',
            helpUrl: ''
        });
        this.setColour(CodeBridgeBlockPalette.getColourForRole('structure'));
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
            tooltip: '%{BKY_INITIALIZES_LOOP_TOOLTIP}',
            helpUrl: ''
        });
        this.setColour(CodeBridgeBlockPalette.getColourForRole('structure'));
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
            tooltip: '%{BKY_ARDUINO_PIN_MODE_TOOLTIP}',
            helpUrl: ''
        });
        this.setColour(CodeBridgeBlockPalette.getColourForRole('control'));
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
            tooltip: '%{BKY_ARDUINO_DIGITAL_WRITE_TOOLTIP}',
            helpUrl: ''
        });
        this.setColour(CodeBridgeBlockPalette.getColourForRole('digital'));
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
            tooltip: '%{BKY_ARDUINO_DIGITAL_READ_TOOLTIP}',
            helpUrl: ''
        });
        this.setColour(CodeBridgeBlockPalette.getColourForRole('digital'));
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
            inputsInline: true,
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
            tooltip: '%{BKY_ARDUINO_ANALOG_WRITE_TOOLTIP}',
            helpUrl: ''
        });
        this.setColour(CodeBridgeBlockPalette.getColourForRole('analog'));
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
                    check: ['Number', 'String'],
                    shadow: {
                        type: 'arduino_pin_shadow'
                    }
                }
            ],
            output: 'Number',
            tooltip: '%{BKY_ARDUINO_ANALOG_READ_TOOLTIP}',
            helpUrl: ''
        });
        this.setColour(CodeBridgeBlockPalette.getColourForRole('analog'));
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
            tooltip: '%{BKY_ARDUINO_DELAY_TOOLTIP}',
            helpUrl: ''
        });
        this.setColour(CodeBridgeBlockPalette.getColourForRole('time'));
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
            tooltip: '%{BKY_ARDUINO_DELAY_MICROSECONDS_TOOLTIP}',
            helpUrl: ''
        });
        this.setColour(CodeBridgeBlockPalette.getColourForRole('time'));
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
            tooltip: '%{BKY_ARDUINO_MILLIS_TOOLTIP}',
            helpUrl: ''
        });
        this.setColour(CodeBridgeBlockPalette.getColourForRole('time'));
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
            tooltip: '%{BKY_ARDUINO_MICROS_TOOLTIP}',
            helpUrl: ''
        });
        this.setColour(CodeBridgeBlockPalette.getColourForRole('time'));
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
                    // **清單維持遞增**（便於掃描與記憶），但預設值是 9600。
                    //
                    // Blockly 的 field_dropdown 一律選第一個 option，所以「改預設」
                    // 與「維持遞增」是衝突的。解法是保持 options 原本不動，
                    // 在 jsonInit 之後用 setFieldValue 指定預設值 ——
                    // 這樣既不改變清單順序（下拉選單仍由小到大），
                    // 也不會讓「預設」綁死在清單的第一項。
                    //
                    // 9600 是最常見的初學者設定，Arduino IDE 預設值也是它。
                    options: [
                        ['%{BKY_ARDUINO_SERIAL_BAUD_300}', '300'],
                        ['%{BKY_ARDUINO_SERIAL_BAUD_1200}', '1200'],
                        ['%{BKY_ARDUINO_SERIAL_BAUD_2400}', '2400'],
                        ['%{BKY_ARDUINO_SERIAL_BAUD_4800}', '4800'],
                        ['%{BKY_ARDUINO_SERIAL_BAUD_9600}', '9600'],
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
            tooltip: '%{BKY_ARDUINO_SERIAL_BEGIN_TOOLTIP}',
            helpUrl: ''
        });
        this.setFieldValue(DEFAULT_BAUD, 'BAUD');
        this.setColour(CodeBridgeBlockPalette.getColourForRole('serial'));
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
            tooltip: '%{BKY_ARDUINO_SERIAL_PRINT_TOOLTIP}',
            helpUrl: ''
        });
        this.setColour(CodeBridgeBlockPalette.getColourForRole('serial'));
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
            tooltip: '%{BKY_ARDUINO_SERIAL_PRINTLN_TOOLTIP}',
            helpUrl: ''
        });
        this.setColour(CodeBridgeBlockPalette.getColourForRole('serial'));
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
            tooltip: '%{BKY_ARDUINO_SERIAL_AVAILABLE_TOOLTIP}',
            helpUrl: ''
        });
        this.setColour(CodeBridgeBlockPalette.getColourForRole('serial'));
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
            tooltip: '%{BKY_ARDUINO_SERIAL_READ_TOOLTIP}',
            helpUrl: ''
        });
        this.setColour(CodeBridgeBlockPalette.getColourForRole('serial'));
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
            tooltip: '',
            helpUrl: ''
        });
        this.setColour(CodeBridgeBlockPalette.getColourForRole('serial'));
    }
};