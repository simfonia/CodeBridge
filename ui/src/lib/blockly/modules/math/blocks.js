/// CodeBridge Math 模組 - 積木定義
/// 對齊 piBlockly 的 blocks/arduino.js (math 相關區段)
/// 4 個自訂積木 + 3 個內建積木覆寫（統一使用 colour: '%{BKY_...}'）

// ============================================================
// 內建積木覆寫（統一顏色）
// ============================================================
Blockly.Blocks['math_number'] = {
  init: function() {
    this.jsonInit({
      "message0": "%{BKY_MATH_NUMBER}",
      "args0": [
        {
          "type": "field_number",
          "name": "NUM",
          "value": 0
        }
      ],
      "output": "Number",
      "colour": "%{BKY_MATH_HUE}",
      "tooltip": "%{BKY_MATH_NUMBER_TOOLTIP}",
      "helpUrl": ""
    });
  }
};

Blockly.Blocks['math_arithmetic'] = {
  init: function() {
    this.jsonInit({
      "message0": "%1 %2 %3",
      "args0": [
        {
          "type": "input_value",
          "name": "A",
          "check": "Number"
        },
        {
          "type": "field_dropdown",
          "name": "OP",
          "options": [
            ["+", "ADD"],
            ["-", "MINUS"],
            ["\u00D7", "MULTIPLY"],
            ["\u00F7", "DIVIDE"],
            ["^", "POWER"]
          ]
        },
        {
          "type": "input_value",
          "name": "B",
          "check": "Number"
        }
      ],
      "inputsInline": true,
      "output": "Number",
      "colour": "%{BKY_MATH_HUE}",
      "tooltip": "%{BKY_MATH_ARITHMETIC_TOOLTIP}",
      "helpUrl": "%{BKY_MATH_ARITHMETIC_HELPURL}"
    });
  }
};

Blockly.Blocks['math_single'] = {
  init: function() {
    this.jsonInit({
      "message0": "%1 %2",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "OP",
          "options": [
            ["sqrt", "ROOT"],
            ["abs", "ABS"],
            ["-", "NEG"],
            ["ln", "LN"],
            ["log10", "LOG10"],
            ["e^", "EXP"],
            ["10^", "POW10"]
          ]
        },
        {
          "type": "input_value",
          "name": "NUM",
          "check": "Number"
        }
      ],
      "output": "Number",
      "colour": "%{BKY_MATH_HUE}",
      "tooltip": "%{BKY_MATH_SINGLE_TOOLTIP}",
      "helpUrl": "%{BKY_MATH_SINGLE_HELPURL}"
    });
  }
};

// ============================================================
// arduino_constrain - 限制範圍
// ============================================================
  Blockly.Blocks['arduino_constrain'] = {
    init: function() {
      this.jsonInit({
        "message0": "%{BKY_ARDUINO_CONSTRAIN_MSG}",
        "args0": [
          {
            "type": "input_value",
            "name": "VALUE",
            "check": ["Number", "String"]
          },
          {
            "type": "input_value",
            "name": "LOW",
            "check": "Number"
          },
          {
            "type": "input_value",
            "name": "HIGH",
            "check": "Number"
          }
        ],
        "inputsInline": true,
        "output": "Number",
        "colour": "%{BKY_MATH_HUE}",
        "tooltip": "%{BKY_ARDUINO_CONSTRAIN_TOOLTIP}",
        "helpUrl": ""
      });
    }
  };

  Blockly.Blocks['arduino_map'] = {
    init: function() {
      this.jsonInit({
        "message0": "%{BKY_ARDUINO_MAP_MSG}",
        "args0": [
          {
            "type": "input_value",
            "name": "VALUE",
            "check": ["Number", "String"]
          },
          {
            "type": "input_value",
            "name": "FROMLOW",
            "check": "Number"
          },
          {
            "type": "input_value",
            "name": "FROMHIGH",
            "check": "Number"
          },
          {
            "type": "input_value",
            "name": "TOLOW",
            "check": "Number"
          },
          {
            "type": "input_value",
            "name": "TOHIGH",
            "check": "Number"
          }
        ],
        "inputsInline": true,
        "output": "Number",
        "colour": "%{BKY_MATH_HUE}",
        "tooltip": "%{BKY_ARDUINO_MAP_TOOLTIP}",
        "helpUrl": ""
      });
    }
  };

  Blockly.Blocks['math_random_seed'] = {
    init: function() {
      this.jsonInit({
        "message0": "%{BKY_ARDUINO_MATH_RANDOM_SEED_MSG}",
        "args0": [
          {
            "type": "input_value",
            "name": "SEED",
            "check": "Number",
            "shadow": {
              "type": "arduino_analog_read",
              "inputs": {
                "PIN": {
                  "shadow": {
                    "type": "arduino_pin_shadow",
                    "fields": {
                      "PIN": "A0"
                    }
                  }
                }
              }
            }
          }
        ],
        "inputsInline": true,
        "previousStatement": true,
        "nextStatement": true,
        "colour": "%{BKY_MATH_HUE}",
        "tooltip": "%{BKY_ARDUINO_MATH_RANDOM_SEED_TOOLTIP}",
        "helpUrl": ""
      });
    }
  };

  Blockly.Blocks['math_random_int'] = {
    init: function() {
      this.jsonInit({
        "message0": "%{BKY_ARDUINO_MATH_RANDOM_INT_MSG}",
        "args0": [
          {
            "type": "input_value",
            "name": "MIN",
            "check": "Number",
            "shadow": {
              "type": "math_number",
              "fields": { "NUM": 0 }
            }
          },
          {
            "type": "input_value",
            "name": "MAX",
            "check": "Number",
            "shadow": {
              "type": "math_number",
              "fields": { "NUM": 100 }
            }
          }
        ],
        "inputsInline": true,
        "output": "Number",
        "colour": "%{BKY_MATH_HUE}",
        "tooltip": "%{BKY_ARDUINO_MATH_RANDOM_INT_TOOLTIP}",
        "helpUrl": ""
      });
    }
  };
