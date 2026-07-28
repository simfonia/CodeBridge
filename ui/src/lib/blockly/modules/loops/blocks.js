/// CodeBridge Loops 模組 - 積木定義
/// 對齊 piBlockly 的 blocks/loops.js
/// 3 個自訂積木：controls_while, controls_for, controls_flow_statements

// ============================================================
// controls_while - while 迴圈
// ============================================================
Blockly.Blocks['controls_while'] = {
  init: function() {
    this.jsonInit({
      "message0": "%{BKY_CONTROLS_WHILE_MESSAGE}",
      "args0": [
        {
          "type": "input_value",
          "name": "BOOL",
          "check": "Boolean"
        }
      ],
      "message1": "  %1",
      "args1": [
        {
          "type": "input_statement",
          "name": "DO"
        }
      ],
      "inputsInline": true,
      "message2": "}",
      "previousStatement": true,
      "nextStatement": true,
      "colour": "%{BKY_LOOPS_HUE}",
      "tooltip": "%{BKY_CONTROLS_WHILE_TOOLTIP}",
      "helpUrl": ""
    });
  }
};

// ============================================================
// controls_for - for 迴圈
// 8 個佔位符：VAR, FROM, VAR_LABEL_1, COMPARE_OP, TO, VAR_LABEL_2, STEP_OP, BY
// 包含 onchange 自動切換 <= / >= 與 += / -=
// 包含 updateLabels 同步變數名稱到 VAR_LABEL_1 / VAR_LABEL_2
// ============================================================
Blockly.Blocks['controls_for'] = {
  init: function() {
    this.jsonInit({
      "message0": "%{BKY_CONTROLS_FOR_MESSAGE}",
      "args0": [
        {
          "type": "field_variable",
          "name": "VAR",
          "variable": "i"
        },
        {
          "type": "input_value",
          "name": "FROM",
          "check": "Number"
        },
        {
          "type": "field_label",
          "name": "VAR_LABEL_1",
          "text": "i"
        },
        {
          "type": "field_label",
          "name": "COMPARE_OP",
          "text": " <= "
        },
        {
          "type": "input_value",
          "name": "TO",
          "check": "Number"
        },
        {
          "type": "field_label",
          "name": "VAR_LABEL_2",
          "text": "i"
        },
        {
          "type": "field_label",
          "name": "STEP_OP",
          "text": " += "
        },
        {
          "type": "input_value",
          "name": "BY",
          "check": "Number"
        }
      ],
      "message1": "%1",
      "args1": [
        {
          "type": "input_statement",
          "name": "DO"
        }
      ],
      "message2": "}",
      "inputsInline": true,
      "previousStatement": true,
      "nextStatement": true,
      "colour": "%{BKY_LOOPS_HUE}",
      "tooltip": "%{BKY_CONTROLS_FOR_TOOLTIP}",
      "helpUrl": ""
    });

    // 同步變數名稱到 VAR_LABEL_1 / VAR_LABEL_2
    var updateLabels = function(block) {
      var varName = block.getField('VAR').getText();
      block.setFieldValue(varName, 'VAR_LABEL_1');
      block.setFieldValue(varName, 'VAR_LABEL_2');
    };

    // 變數重新命名時同步更新 Label
    this.getField('VAR').setValidator(function(newVarId) {
      var block = this.getSourceBlock();
      setTimeout(function() {
        updateLabels(block);
        block.render();
      }, 0);
      return newVarId;
    });

    // 初始顯示變數 i
    setTimeout(function() {
      updateLabels(this);
      this.render();
    }.bind(this), 0);
  },

  // 自動切換 <= / >= 與 += / -=
  onchange: function(event) {
    if (!this.workspace || this.workspace.isFlyout || !event.recordUndo) {
      return;
    }
    if (event.type === Blockly.Events.BLOCK_CHANGE &&
        (event.blockId === this.getInputTargetBlock('FROM') && this.getInputTargetBlock('FROM') !== null ||
         event.blockId === this.getInputTargetBlock('TO') && this.getInputTargetBlock('TO') !== null)) {
      var fromBlock = this.getInputTargetBlock('FROM');
      var toBlock = this.getInputTargetBlock('TO');
      var fromValue = NaN;
      var toValue = NaN;
      if (fromBlock && fromBlock.type === 'math_number') {
        fromValue = parseFloat(fromBlock.getFieldValue('NUM'));
      }
      if (toBlock && toBlock.type === 'math_number') {
        toValue = parseFloat(toBlock.getFieldValue('NUM'));
      }
      if (!isNaN(fromValue) && !isNaN(toValue)) {
        if (fromValue < toValue) {
          this.setFieldValue(' <= ', 'COMPARE_OP');
          this.setFieldValue(' += ', 'STEP_OP');
        } else if (fromValue > toValue) {
          this.setFieldValue(' >= ', 'COMPARE_OP');
          this.setFieldValue(' -= ', 'STEP_OP');
        } else {
          this.setFieldValue(' <= ', 'COMPARE_OP');
          this.setFieldValue(' += ', 'STEP_OP');
        }
      }
      this.render();
    }
  }
};

// ============================================================
// controls_flow_statements - break / continue
// ============================================================
Blockly.Blocks['controls_flow_statements'] = {
  init: function() {
    this.jsonInit({
      "message0": "%{BKY_CONTROLS_FLOW_STATEMENTS_MESSAGE}",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "FLOW",
          "options": [
            ["break", "BREAK"],
            ["continue", "CONTINUE"]
          ]
        }
      ],
      "previousStatement": true,
      "nextStatement": true,
      "colour": "%{BKY_LOOPS_HUE}",
      "tooltip": "%{BKY_CONTROLS_FLOW_STATEMENTS_TOOLTIP}",
      "helpUrl": ""
    });
  }
};
