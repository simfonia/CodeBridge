/// CodeBridge Loops Module - English Messages (Angel style base)
/// Contains: category name, block labels, tooltips
/// Engineer style overrides in style/engineer.js
///
/// Note: controls_while / controls_for / controls_flow_statements are custom blocks,
/// using %{BKY_...} placeholders that correspond to the keys defined here.

var LOOPS_EN = {
  // Colors

  // Category name
  LOOPS_CATEGORY: 'Loops',

  // controls_while
  CONTROLS_WHILE_MESSAGE: 'while %1',
  CONTROLS_WHILE_TOOLTIP: 'While a condition is true, then do some statements.',

  // controls_for
  CONTROLS_FOR_MESSAGE: 'Count, variable %1 = %2 ; %3%4%5 ; each change (%6%7 %8)',
  CONTROLS_FOR_TOOLTIP: 'Loop with %1 from %2 to %3 by %4.',

  // controls_flow_statements
  CONTROLS_FLOW_STATEMENTS_MESSAGE: '%1 loop',
  CONTROLS_FLOW_STATEMENTS_TOOLTIP: 'Break out of the inner loop or continue with the next iteration.',
};
