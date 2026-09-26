/// CodeBridge Array 模組 - 積木定義（對齊 piBlockly）
(function() {
  var typeOptions = [
    ['int', 'int'],
    ['float', 'float'],
    ['String', 'String'],
    ['bool', 'bool']
  ];

  function declarationDefinition(type, defaultName) {
    return {
      init: function() {
        this.appendDummyInput('ROW')
            .appendField(Blockly.Msg[type + '_TITLE'])
            .appendField(new Blockly.FieldDropdown(typeOptions), 'TYPE')
            .appendField(new Blockly.FieldTextInput(defaultName), 'VAR')
            .appendField('[');
        this.appendValueInput('SIZE').setCheck('Number');
        this.appendDummyInput('END').appendField(']');
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(CodeBridgeBlockPalette.getColourForRole('array'));
        this.setTooltip(Blockly.Msg[type + '_TOOLTIP']);
        this.setHelpUrl('');
      }
    };
  }

  Blockly.Blocks['array_declare_global'] = declarationDefinition(
    'ARRAY_DECLARE_GLOBAL',
    'myGlobalArray'
  );
  Blockly.Blocks['array_declare_local'] = declarationDefinition(
    'ARRAY_DECLARE_LOCAL',
    'myLocalArray'
  );

  Blockly.Blocks['array_get'] = {
    init: function() {
      this.appendDummyInput('ROW')
          .appendField(new Blockly.FieldTextInput('myArray'), 'VAR')
          .appendField(Blockly.Msg.ARRAY_GET_BRACKET_OPEN);
      this.appendValueInput('INDEX').setCheck('Number');
      this.appendDummyInput('END').appendField(Blockly.Msg.ARRAY_GET_BRACKET_CLOSE);
      this.setInputsInline(true);
      this.setOutput(true, null);
      this.setColour(CodeBridgeBlockPalette.getColourForRole('array'));
      this.setTooltip(Blockly.Msg.ARRAY_GET_TOOLTIP);
      this.setHelpUrl('');
    }
  };

  Blockly.Blocks['array_set'] = {
    init: function() {
      this.appendDummyInput('ROW')
          .appendField(new Blockly.FieldTextInput('myArray'), 'VAR')
          .appendField(Blockly.Msg.ARRAY_SET_BRACKET_OPEN);
      this.appendValueInput('INDEX').setCheck('Number');
      this.appendDummyInput('MIDDLE')
          .appendField(Blockly.Msg.ARRAY_SET_BRACKET_CLOSE_EQUALS);
      this.appendValueInput('VALUE').setCheck(null);
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(CodeBridgeBlockPalette.getColourForRole('array'));
      this.setTooltip(Blockly.Msg.ARRAY_SET_TOOLTIP);
      this.setHelpUrl('');
    }
  };

  Blockly.Blocks['array_length'] = {
    init: function() {
      this.appendDummyInput('ROW')
          .appendField(Blockly.Msg.ARRAY_LENGTH_TITLE)
          .appendField(new Blockly.FieldTextInput('myArray'), 'VAR');
      this.setInputsInline(true);
      this.setOutput(true, 'Number');
      this.setColour(CodeBridgeBlockPalette.getColourForRole('array'));
      this.setTooltip(Blockly.Msg.ARRAY_LENGTH_TOOLTIP);
      this.setHelpUrl('');
    }
  };
})();