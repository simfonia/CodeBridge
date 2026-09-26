/// CodeBridge Logic 模組 - 積木定義
/// 對齊 piBlockly 的 blocks/logic.js
/// controls_if 覆寫 Blockly 內建定義以統一顏色

// ============================================================
// controls_if - 條件判斷
// 使用完整 jsonInit 定義以支援 else/elseif 動態增減
// ============================================================
Blockly.Blocks['controls_if'] = {
  init: function() {
    this.jsonInit({
      "message0": "%{BKY_CONTROLS_IF_MSG_IF} %1",
      "args0": [
        {
          "type": "input_value",
          "name": "IF0",
          "check": "Boolean"
        }
      ],
      "message1": "%{BKY_CONTROLS_IF_MSG_THEN} %1",
      "args1": [
        {
          "type": "input_statement",
          "name": "DO0"
        }
      ],
      "nextStatement": true,
      "previousStatement": true,
      "tooltip": "%{BKY_CONTROLS_IF_TOOLTIP_1}",
      "mutator": "controls_if_mutator"
    });
  this.setColour(CodeBridgeBlockPalette.getColourForRole('logic'));
  }
};

// ============================================================
// controls_if_elseif / controls_if_else - mutator 積木（覆寫顏色）
// Blockly 內建使用 style: 'logic_blocks'，改為 colour 統一
// ============================================================
Blockly.Blocks['controls_if_elseif'] = {
  init: function() {
    this.jsonInit({
      "message0": "%{BKY_CONTROLS_IF_ELSEIF_TITLE_ELSEIF}",
      "previousStatement": null,
      "nextStatement": null,
      "enableContextMenu": false,
      "tooltip": "%{BKY_CONTROLS_IF_ELSEIF_TOOLTIP}"
    });
  this.setColour(CodeBridgeBlockPalette.getColourForRole('logic'));
  }
};

Blockly.Blocks['controls_if_else'] = {
  init: function() {
    this.jsonInit({
      "message0": "%{BKY_CONTROLS_IF_ELSE_TITLE_ELSE}",
      "previousStatement": null,
      "enableContextMenu": false,
      "tooltip": "%{BKY_CONTROLS_IF_ELSE_TOOLTIP}"
    });
  this.setColour(CodeBridgeBlockPalette.getColourForRole('logic'));
  }
};

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
      "tooltip": "%{BKY_LOGIC_COMPARE_TOOLTIP}",
      "helpUrl": "%{BKY_LOGIC_COMPARE_HELPURL}"
    });
  this.setColour(CodeBridgeBlockPalette.getColourForRole('logic'));
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
      "tooltip": "%{BKY_LOGIC_OPERATION_TOOLTIP}",
      "helpUrl": "%{BKY_LOGIC_OPERATION_HELPURL}"
    });
  this.setColour(CodeBridgeBlockPalette.getColourForRole('logic'));
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
      "tooltip": "%{BKY_LOGIC_NEGATE_TOOLTIP}",
      "helpUrl": ""
    });
  this.setColour(CodeBridgeBlockPalette.getColourForRole('logic'));
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
      "tooltip": "%{BKY_LOGIC_BOOLEAN_TOOLTIP}",
      "helpUrl": ""
    });
  this.setColour(CodeBridgeBlockPalette.getColourForRole('logic'));
  }
};