/// CodeBridge Logic 模組 - 積木定義
/// 對齊 piBlockly 的 blocks/logic.js
/// controls_if 使用 Blockly 內建定義，不需重複註冊

// ============================================================
// logic_compare - 比較運算子
// ============================================================
Blockly.Blocks['logic_compare'] = {
  init: function() {
    this.jsonInit({
      "message0": "%{BKY_LOGIC_COMPARE_LABEL}",
      "args0": [
        {
          "type": "input_value",
          "name": "A",
          "check": null
        },
        {
          "type": "field_dropdown",
          "name": "OP",
          "options": [
            ["==", "EQ"],
            ["!=", "NEQ"],
            ["<", "LT"],
            ["<=", "LTE"],
            [">", "GT"],
            [">=", "GTE"]
          ]
        },
        {
          "type": "input_value",
          "name": "B",
          "check": null
        }
      ],
      "inputsInline": true,
      "output": "Boolean",
      "style": "logic_blocks",
      "tooltip": "%{BKY_LOGIC_COMPARE_TOOLTIP}",
      "helpUrl": "%{BKY_LOGIC_COMPARE_HELPURL}"
    });
  }
};

// ============================================================
// logic_operation - 邏輯運算子 (and / or)
// ============================================================
Blockly.Blocks['logic_operation'] = {
  init: function() {
    this.jsonInit({
      "message0": "%{BKY_LOGIC_OPERATION_LABEL}",
      "args0": [
        {
          "type": "input_value",
          "name": "A",
          "check": "Boolean"
        },
        {
          "type": "field_dropdown",
          "name": "OP",
          "options": [
            ["%{BKY_LOGIC_OPERATION_AND}", "AND"],
            ["%{BKY_LOGIC_OPERATION_OR}", "OR"]
          ]
        },
        {
          "type": "input_value",
          "name": "B",
          "check": "Boolean"
        }
      ],
      "inputsInline": true,
      "output": "Boolean",
      "style": "logic_blocks",
      "tooltip": "%{BKY_LOGIC_OPERATION_TOOLTIP}",
      "helpUrl": "%{BKY_LOGIC_OPERATION_HELPURL}"
    });
  }
};

// ============================================================
// logic_negate - 邏輯否定
// ============================================================
Blockly.Blocks['logic_negate'] = {
  init: function() {
    this.jsonInit({
      "message0": "%{BKY_LOGIC_NEGATE_LABEL}",
      "args0": [
        {
          "type": "input_value",
          "name": "BOOL",
          "check": "Boolean"
        }
      ],
      "output": "Boolean",
      "style": "logic_blocks",
      "tooltip": "%{BKY_LOGIC_NEGATE_TOOLTIP}",
      "helpUrl": ""
    });
  }
};

// ============================================================
// logic_boolean - true / false
// ============================================================
Blockly.Blocks['logic_boolean'] = {
  init: function() {
    this.jsonInit({
      "message0": "%1",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "BOOL",
          "options": [
            ["%{BKY_LOGIC_BOOLEAN_TRUE}", "TRUE"],
            ["%{BKY_LOGIC_BOOLEAN_FALSE}", "FALSE"]
          ]
        }
      ],
      "output": "Boolean",
      "style": "logic_blocks",
      "tooltip": "%{BKY_LOGIC_BOOLEAN_TOOLTIP}",
      "helpUrl": ""
    });
  }
};