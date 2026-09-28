/// CodeBridge Math 模組 - 積木定義
/// 對齊 piBlockly 的 blocks/arduino.js (math 相關區段)
/// 4 個自訂積木 + 3 個內建積木覆寫（統一使用 colour: '%{BKY_...}'）

// math_single 的運算選項。
//
// **為什麼在這裡集中定義**：`options` 在 jsonInit 裡是靜態陣列，無法依語系切換。
// 三角函數符號（sin／cos／tan）在數學語境中各國皆相同，因此刻意**不**走 i18n ——
// 翻了兩次語言介面卻看到 `sin` 變成別的字串，只會讓學生以為數學定義變了。
const SINGLE_OPTIONS = [
  ['sqrt', 'ROOT'],
  ['abs', 'ABS'],
  ['-', 'NEG'],
  ['ln', 'LN'],
  ['log10', 'LOG10'],
  ['e^', 'EXP'],
  ['10^', 'POW10'],
  // 三角函數：generator 早已支援（產出 `sin(x / 180.0 * PI)`），
  // 但下拉清單從未暴露 —— 有程式能力卻沒有入口，等於不存在。
  ['sin', 'SIN'],
  ['cos', 'COS'],
  ['tan', 'TAN']
];

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
      "tooltip": "%{BKY_MATH_NUMBER_TOOLTIP}",
      "helpUrl": ""
    });
  this.setColour(CodeBridgeBlockPalette.getColourForRole('math'));
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
      "tooltip": "%{BKY_MATH_ARITHMETIC_TOOLTIP}",
      "helpUrl": "%{BKY_MATH_ARITHMETIC_HELPURL}"
    });
  this.setColour(CodeBridgeBlockPalette.getColourForRole('math'));
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
          "options": SINGLE_OPTIONS
        },
        {
          "type": "input_value",
          "name": "NUM",
          "check": "Number"
        }
      ],
      "output": "Number",
      "tooltip": "%{BKY_MATH_SINGLE_TOOLTIP}",
      "helpUrl": "%{BKY_MATH_SINGLE_HELPURL}"
    });
  this.setColour(CodeBridgeBlockPalette.getColourForRole('math'));
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
        "tooltip": "%{BKY_ARDUINO_CONSTRAIN_TOOLTIP}",
        "helpUrl": ""
      });
    this.setColour(CodeBridgeBlockPalette.getColourForRole('math'));
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
        "tooltip": "%{BKY_ARDUINO_MAP_TOOLTIP}",
        "helpUrl": ""
      });
    this.setColour(CodeBridgeBlockPalette.getColourForRole('math'));
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
        "tooltip": "%{BKY_ARDUINO_MATH_RANDOM_SEED_TOOLTIP}",
        "helpUrl": ""
      });
    this.setColour(CodeBridgeBlockPalette.getColourForRole('math'));
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
        "tooltip": "%{BKY_ARDUINO_MATH_RANDOM_INT_TOOLTIP}",
        "helpUrl": ""
      });
    this.setColour(CodeBridgeBlockPalette.getColourForRole('math'));
    }
  };
