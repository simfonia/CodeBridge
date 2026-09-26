/// CodeBridge Functions 模組 - 積木定義（對齊 piBlockly / Blockly 13）
(function() {
  var typeOptions = [
    ['int', 'int'],
    ['float', 'float'],
    ['String', 'String'],
    ['bool', 'bool']
  ];

  function readArguments(block, xmlElement) {
    block.arguments_ = [];
    block.argTypes_ = [];
    for (var i = 0; i < xmlElement.childNodes.length; i++) {
      var child = xmlElement.childNodes[i];
      if (child.nodeName.toLowerCase() === 'arg') {
        block.arguments_.push(child.getAttribute('name'));
        block.argTypes_.push(child.getAttribute('type'));
      }
    }
  }

  function mutationMixin() {
    return {
      mutationToDom: function() {
        var mutation = Blockly.utils.xml.createElement('mutation');
        mutation.setAttribute('name', this.getFieldValue('NAME'));
        for (var i = 0; i < this.arguments_.length; i++) {
          var argument = Blockly.utils.xml.createElement('arg');
          argument.setAttribute('name', this.arguments_[i]);
          argument.setAttribute('type', this.argTypes_[i]);
          mutation.appendChild(argument);
        }
        return mutation;
      },
      domToMutation: function(xmlElement) {
        readArguments(this, xmlElement);
        this.updateAfterMutation_();
      },
      decompose: function(workspace) {
        var container = workspace.newBlock('custom_functions_mutatorcontainer');
        container.initSvg();
        var connection = container.getInput('STACK').connection;
        for (var i = 0; i < this.arguments_.length; i++) {
          var argument = workspace.newBlock('custom_functions_mutatorarg');
          argument.initSvg();
          argument.setFieldValue(this.arguments_[i], 'NAME');
          argument.setFieldValue(this.argTypes_[i], 'TYPE');
          connection.connect(argument.previousConnection);
          connection = argument.nextConnection;
        }
        return container;
      },
      compose: function(container) {
        var connections = {};
        for (var i = 0; i < this.arguments_.length; i++) {
          var input = this.getInput('ARG' + i);
          if (input && input.connection && input.connection.targetConnection) {
            connections[this.arguments_[i]] = input.connection.targetConnection;
          }
        }
        this.arguments_ = [];
        this.argTypes_ = [];
        var argument = container.getInputTargetBlock('STACK');
        while (argument) {
          this.arguments_.push(argument.getFieldValue('NAME'));
          this.argTypes_.push(argument.getFieldValue('TYPE'));
          argument = argument.nextConnection && argument.nextConnection.targetBlock();
        }
        this.updateAfterMutation_(connections);
      }
    };
  }

  function manualCallDefinition(isStatement) {
    var definition = mutationMixin();
    definition.init = function() {
      this.appendDummyInput('TOPROW')
          .appendField(
            Blockly.Msg[isStatement
              ? 'CUSTOM_FUNCTIONS_CALLNORETURN_MESSAGE'
              : 'CUSTOM_FUNCTIONS_CALLRETURN_MESSAGE'].split('%1')[0]
          )
          .appendField(new Blockly.FieldTextInput('myFunction'), 'NAME');
      if (isStatement) {
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
      } else {
        this.setOutput(true, null);
      }
      this.arguments_ = [];
      this.argTypes_ = [];
      this.setColour('%{BKY_FUNCTIONS_HUE}');
      this.setTooltip(Blockly.Msg[isStatement
        ? 'FUNCTIONS_CALLNORETURN_TOOLTIP'
        : 'FUNCTIONS_CALLRETURN_TOOLTIP']);
      this.setHelpUrl('');
      this.setMutator(new Blockly.icons.MutatorIcon(
        ['custom_functions_mutatorarg'],
        this
      ));
      this.updateShape_();
    };
    definition.updateAfterMutation_ = function() {
      this.updateShape_();
    };
    definition.updateShape_ = function(connections) {
      for (var i = 0; this.getInput('ARG' + i); i++) {
        this.removeInput('ARG' + i);
      }
      if (this.getInput('END_ROW')) {
        this.removeInput('END_ROW');
      }
      for (i = 0; i < this.arguments_.length; i++) {
        var input = this.appendValueInput('ARG' + i)
            .setAlign(Blockly.ALIGN_RIGHT);
        input.appendField(i === 0 ? '(' : ',');
        if (connections && connections[this.arguments_[i]]) {
          input.connection.connect(connections[this.arguments_[i]]);
        }
      }
      this.appendDummyInput('END_ROW')
          .appendField(this.arguments_.length === 0 ? '()' : ')');
      this.setInputsInline(true);
    };
    return definition;
  }

  Blockly.Blocks['custom_functions_callnoreturn_manual'] =
    manualCallDefinition(true);
  Blockly.Blocks['custom_functions_callreturn_manual'] =
    manualCallDefinition(false);

  Blockly.Blocks['custom_functions_mutatorcontainer'] = {
    init: function() {
      this.appendDummyInput('ROW')
          .appendField(Blockly.Msg.CUSTOM_FUNCTIONS_MUTATORCONTAINER_MESSAGE);
      this.appendStatementInput('STACK');
      this.setColour('%{BKY_FUNCTIONS_HUE}');
      this.setTooltip(Blockly.Msg.FUNCTIONS_MUTATORCONTAINER_TOOLTIP);
      this.contextMenu = false;
    }
  };

  Blockly.Blocks['custom_functions_mutatorarg'] = {
    init: function() {
      this.appendDummyInput('ROW')
          .appendField(Blockly.Msg.CUSTOM_FUNCTIONS_MUTATORARG_MESSAGE)
          .appendField(new Blockly.FieldDropdown(typeOptions), 'TYPE')
          .appendField(new Blockly.FieldTextInput('x'), 'NAME');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour('%{BKY_FUNCTIONS_HUE}');
      this.setTooltip(Blockly.Msg.FUNCTIONS_MUTATORARG_TOOLTIP);
      this.contextMenu = false;
    }
  };

  function appendMessageFields(inputRow, message, hasReturnType) {
    var tokens = message.split(/(%[123])/g);
    tokens.forEach(function(token) {
      if (token === '%1') {
        inputRow.appendField(hasReturnType
          ? new Blockly.FieldDropdown(typeOptions)
          : new Blockly.FieldTextInput('myFunction'), hasReturnType ? 'TYPE' : 'NAME');
      } else if (token === '%2') {
        inputRow.appendField(hasReturnType
          ? new Blockly.FieldTextInput('myFunction')
          : new Blockly.FieldLabel(''), hasReturnType ? 'NAME' : 'PARAMS');
      } else if (token === '%3') {
        inputRow.appendField(new Blockly.FieldLabel(''), 'PARAMS');
      } else if (token) {
        inputRow.appendField(token);
      }
    });
  }

  function definitionMixin(hasReturnType) {
    var definition = mutationMixin();
    definition.init = function() {
      var message = Blockly.Msg[hasReturnType
        ? 'CUSTOM_FUNCTIONS_DEFRETURN_MESSAGE'
        : 'CUSTOM_FUNCTIONS_DEFNORETURN_MESSAGE'];
      var inputRow = this.appendDummyInput('TOPROW');
      appendMessageFields(inputRow, message, hasReturnType);
      this.appendStatementInput('STACK');
      this.appendDummyInput('BOTTOMROW').appendField('}');
      this.setColour('%{BKY_FUNCTIONS_HUE}');
      this.setTooltip(Blockly.Msg[hasReturnType
        ? 'FUNCTIONS_DEFRETURN_TOOLTIP'
        : 'FUNCTIONS_DEFNORETURN_TOOLTIP']);
      this.setHelpUrl('');
      this.arguments_ = [];
      this.argTypes_ = [];
      this.setMutator(new Blockly.icons.MutatorIcon(
        ['custom_functions_mutatorarg'],
        this
      ));
      this.setInputsInline(true);
    };
    definition.updateAfterMutation_ = function() {
      var parameters = [];
      for (var i = 0; i < this.arguments_.length; i++) {
        parameters.push(this.argTypes_[i] + ' ' + this.arguments_[i]);
      }
      this.setFieldValue(parameters.join(', '), 'PARAMS');
    };
    return definition;
  }

  Blockly.Blocks['custom_functions_defnoreturn'] = definitionMixin(false);
  Blockly.Blocks['custom_functions_defreturn'] = definitionMixin(true);

  Blockly.Blocks['custom_functions_return'] = {
    init: function() {
      this.appendValueInput('VALUE')
          .appendField(Blockly.Msg.CUSTOM_FUNCTIONS_RETURN_MESSAGE.split('%1')[0]);
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setColour('%{BKY_FUNCTIONS_HUE}');
      this.setTooltip(Blockly.Msg.FUNCTIONS_RETURN_TOOLTIP);
      this.setHelpUrl('');
      this.setOnChange(function() {
        if (!this.workspace || this.isInFlyout) return;
        var parent = this.getSurroundParent();
        if (!parent || !parent.type.startsWith('custom_functions_def')) {
          this.setWarningText(Blockly.Msg.FUNCTIONS_RETURN_OUTSIDE_WARNING);
        } else if (parent.type === 'custom_functions_defnoreturn') {
          this.setWarningText(Blockly.Msg.FUNCTIONS_RETURN_IN_VOID_WARNING);
        } else {
          this.setWarningText(null);
        }
      });
    }
  };
})();
