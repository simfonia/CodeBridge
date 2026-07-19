/// CodeBridge Arduino 積木定義
/// 參考 piBlockly 作法，建立 Arduino 專用積木

// Arduino 影子積木 - 腳位輸入
Blockly.Blocks['arduino_pin_shadow'] = {
    init: function() {
        this.jsonInit({
            type: 'arduino_pin_shadow',
            message0: '%1',
            args0: [
                {
                    type: 'field_input',
                    name: 'PIN',
                    text: '2',
                    spellcheck: false
                }
            ],
            output: 'Number'
        });
    }
};

// pinMode 積木
Blockly.Blocks['arduino_pin_mode'] = {
    init: function() {
        this.jsonInit({
            message0: '設定腳位 %1 為 %2',
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
                        ['輸入', 'INPUT'],
                        ['輸出', 'OUTPUT'],
                        ['輸入拉高', 'INPUT_PULLUP']
                    ]
                }
            ],
            previousStatement: true,
            nextStatement: true,
            colour: 180
        });
    }
};

// digitalWrite 積木
Blockly.Blocks['arduino_digital_write'] = {
    init: function() {
        this.jsonInit({
            message0: '數位寫入腳位 %1 狀態 %2',
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
                        ['高', 'HIGH'],
                        ['低', 'LOW']
                    ]
                }
            ],
            previousStatement: true,
            nextStatement: true,
            colour: 180
        });
    }
};

// digitalRead 積木
Blockly.Blocks['arduino_digital_read'] = {
    init: function() {
        this.jsonInit({
            message0: '數位讀取腳位 %1',
            args0: [
                {
                    type: 'input_value',
                    name: 'PIN',
                    check: ['Number', 'String']
                }
            ],
            output: 'Number',
            colour: 180
        });
    }
};

// analogWrite 積木
Blockly.Blocks['arduino_analog_write'] = {
    init: function() {
        this.jsonInit({
            message0: '類比寫入腳位 %1 值 %2',
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
            colour: 180
        });
    }
};

// analogRead 積木
Blockly.Blocks['arduino_analog_read'] = {
    init: function() {
        this.jsonInit({
            message0: '類比讀取腳位 %1',
            args0: [
                {
                    type: 'input_value',
                    name: 'PIN',
                    check: ['Number', 'String']
                }
            ],
            output: 'Number',
            colour: 180
        });
    }
};

// delay 積木
Blockly.Blocks['arduino_delay'] = {
    init: function() {
        this.jsonInit({
            message0: '延遲 %1 毫秒',
            args0: [
                {
                    type: 'input_value',
                    name: 'TIME',
                    check: 'Number'
                }
            ],
            previousStatement: true,
            nextStatement: true,
            colour: 180
        });
    }
};

// Serial.print 積木
Blockly.Blocks['arduino_serial_print'] = {
    init: function() {
        this.jsonInit({
            message0: '序列輸出 %1',
            args0: [
                {
                    type: 'input_value',
                    name: 'VALUE',
                    check: ['Number', 'String']
                }
            ],
            previousStatement: true,
            nextStatement: true,
            colour: 180
        });
    }
};

// 註冊積木
function registerArduinoBlocks() {
    // 積木已透過 Blockly.Blocks 定義
    console.log('Arduino blocks registered');
}