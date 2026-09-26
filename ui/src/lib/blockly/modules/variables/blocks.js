/// CodeBridge Variables 模組 - 積木定義
(function() {
  var typeOptions = [
    ['int', 'int'],
    ['float', 'float'],
    ['String', 'String'],
    ['bool', 'bool']
  ];

  function declareDefinition(messageKey, tooltipKey) {
    return {
      init: function() {
        this.jsonInit({
          message0: messageKey,
          args0: [
            { type: 'field_dropdown', name: 'TYPE', options: typeOptions },
            {
              type: 'field_variable',
              name: 'VAR',
              variable: '%{BKY_VARIABLES_DEFAULT_NAME}'
            },
            { type: 'input_value', name: 'VALUE', check: null }
          ],
          inputsInline: false,
          previousStatement: true,
          nextStatement: true,
          tooltip: tooltipKey,
          helpUrl: ''
        });
      this.setColour(CodeBridgeBlockPalette.getColourForRole('variables'));
      }
    };
  }

  Blockly.Blocks['variables_declare_global'] = declareDefinition(
    '%{BKY_VARIABLES_DECLARE_GLOBAL_MESSAGE}',
    '%{BKY_VARIABLES_DECLARE_GLOBAL_TOOLTIP}'
  );
  Blockly.Blocks['variables_declare_local'] = declareDefinition(
    '%{BKY_VARIABLES_DECLARE_LOCAL_MESSAGE}',
    '%{BKY_VARIABLES_DECLARE_LOCAL_TOOLTIP}'
  );

  Blockly.Blocks['variables_get'] = {
    init: function() {
      this.jsonInit({
        message0: '%1',
        args0: [{
          type: 'field_variable',
          name: 'VAR',
          variable: '%{BKY_VARIABLES_DEFAULT_NAME}'
        }],
        output: null,
        tooltip: '%{BKY_VARIABLES_GET_TOOLTIP}',
        helpUrl: ''
      });
    this.setColour(CodeBridgeBlockPalette.getColourForRole('variables'));
    }
  };

  Blockly.Blocks['variables_set'] = {
    init: function() {
      this.jsonInit({
        message0: '%{BKY_VARIABLES_SET_MESSAGE}',
        args0: [
          {
            type: 'field_variable',
            name: 'VAR',
            variable: '%{BKY_VARIABLES_DEFAULT_NAME}'
          },
          { type: 'input_value', name: 'VALUE', check: null }
        ],
        previousStatement: true,
        nextStatement: true,
        tooltip: '%{BKY_VARIABLES_SET_TOOLTIP}',
        helpUrl: ''
      });
    this.setColour(CodeBridgeBlockPalette.getColourForRole('variables'));
    }
  };
})();
