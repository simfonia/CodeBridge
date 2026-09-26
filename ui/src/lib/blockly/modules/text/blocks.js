/// CodeBridge Text 模組 - 積木定義
/// 對齊 piBlockly 的 blocks/text.js
/// 2 個自訂積木 + 2 個內建積木覆寫（統一使用 colour: '%{BKY_...}'）

// ============================================================
// 內建積木覆寫（統一顏色）
// ============================================================
Blockly.Blocks['text'] = {
  init: function() {
    this.jsonInit({
      "message0": "%{BKY_TEXT_TEXT}",
      "args0": [
        {
          "type": "field_input",
          "name": "TEXT",
          "text": ""
        }
      ],
      "output": "String",
      "tooltip": "%{BKY_TEXT_TEXT_TOOLTIP}",
      "helpUrl": ""
    });
  this.setColour(CodeBridgeBlockPalette.getColourForRole('text'));
  }
};

Blockly.Blocks['text_join'] = {
  init: function() {
    this.jsonInit({
      "message0": "%{BKY_TEXT_JOIN_MESSAGE}",
      "output": "String",
      "tooltip": "%{BKY_TEXT_JOIN_TOOLTIP}",
      "helpUrl": "",
      "mutator": "text_join_mutator"
    });
  this.setColour(CodeBridgeBlockPalette.getColourForRole('text'));
  }
};

// ============================================================
// text_append - 附加文字到變數
// ============================================================
  Blockly.Blocks['text_append'] = {
    init: function() {
      this.jsonInit({
        "message0": "%{BKY_TEXT_APPEND_MESSAGE}",
        "args0": [
          {
            "type": "field_variable",
            "name": "VAR",
            "variable": "myString"
          },
          {
            "type": "input_value",
            "name": "TEXT",
            "check": ["String", "Number"]
          }
        ],
        "inputsInline": true,
        "previousStatement": true,
        "nextStatement": true,
        "tooltip": "%{BKY_TEXT_APPEND_TOOLTIP}",
        "helpUrl": ""
      });
    this.setColour(CodeBridgeBlockPalette.getColourForRole('text'));
    }
  };

  Blockly.Blocks['text_length'] = {
    init: function() {
      this.jsonInit({
        "message0": "%{BKY_TEXT_LENGTH_MESSAGE}",
        "args0": [
          {
            "type": "input_value",
            "name": "VALUE",
            "check": ["String", "Array"]
          }
        ],
        "inputsInline": true,
        "output": "Number",
        "tooltip": "%{BKY_TEXT_LENGTH_TOOLTIP}",
        "helpUrl": ""
      });
    this.setColour(CodeBridgeBlockPalette.getColourForRole('text'));
    }
  };
