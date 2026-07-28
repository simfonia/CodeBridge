/// CodeBridge Logic Module - English Messages (Angel style base)
/// Contains: category name, block labels, tooltips
/// Engineer style overrides in style/engineer.js
///
/// Note: controls_if is a Blockly core block, its i18n keys are built-in.
/// Do NOT set CONTROLS_IF_MSG_IF/ELSEIF/ELSE/THEN here, as they conflict with
/// built-in placeholder indices. Only engineer.js can safely override these keys.

var LOGIC_EN = {
  // Colors
  LOGIC_HUE: '#b198de',
  LOGIC_COMPARE_HUE: '#b198de',
  LOGIC_OPERATION_HUE: '#b198de',
  LOGIC_BOOLEAN_HUE: '#b198de',

  // Category name
  LOGIC_CATEGORY: 'Logic',

  // controls_if tooltips (safe, no % placeholders)
  CONTROLS_IF_IF_TOOLTIP: 'Add, remove, or reorder sections to reconfigure this if block.',
  CONTROLS_IF_ELSEIF_TOOLTIP: 'Add a condition to the if block.',
  CONTROLS_IF_ELSE_TOOLTIP: 'Add a final, catch-all condition to the if block.',
  CONTROLS_IF_TOOLTIP_1: 'If a value is true, then do some statements.',
  CONTROLS_IF_TOOLTIP_2: 'If a value is true, then do the first block of statements. Otherwise, do the second block of statements.',
  CONTROLS_IF_TOOLTIP_3: 'If the first value is true, then do the first block of statements. Otherwise, if the second value is true, do the second block of statements.',
  CONTROLS_IF_TOOLTIP_4: 'If the first values are true, then do the first block of statements. Otherwise, if the second value is true, do the second block of statements. If none of the values are true, do the last block of statements.',

  // controls_if mutator 積木訊息
  CONTROLS_IF_ELSEIF_TITLE_ELSEIF: 'else if',
  CONTROLS_IF_ELSE_TITLE_ELSE: 'else',

  // logic_compare
  LOGIC_COMPARE_LABEL: '%1 %2 %3',
  LOGIC_COMPARE_TOOLTIP: 'Compare two values.',
  LOGIC_COMPARE_HELPURL: '',

  // logic_operation (Angel style)
  LOGIC_OPERATION_LABEL: '%1 %2 %3',
  LOGIC_OPERATION_AND: 'and',
  LOGIC_OPERATION_OR: 'or',
  LOGIC_OPERATION_TOOLTIP: 'Return the result of a logical operation between two conditions.',
  LOGIC_OPERATION_HELPURL: '',

  // logic_negate (Angel style)
  LOGIC_NEGATE_LABEL: 'not %1',
  LOGIC_NEGATE_TOOLTIP: 'Returns true if the input is false, and vice versa.',

  // logic_boolean (Angel style)
  LOGIC_BOOLEAN_TRUE: 'true',
  LOGIC_BOOLEAN_FALSE: 'false',
  LOGIC_BOOLEAN_TOOLTIP: 'Returns true or false.',
};