/// CodeBridge Math 模組 - English messages (Angel style base)
/// Includes: category names, block text, tooltips
/// Engineer style overrides in style/engineer.js

var MATH_EN = {
  // Colors

  // Category name
  MATH_CATEGORY: 'Math',

  // Built-in block messages
  MATH_NUMBER: '%1',
  MATH_ARITHMETIC_HELPURL: '',
  MATH_SINGLE_HELPURL: '',

  // Tooltips
  MATH_NUMBER_TOOLTIP: 'A number.',
  MATH_ARITHMETIC_TOOLTIP: 'Returns the result of an arithmetic operation on two numbers.',
  MATH_SINGLE_TOOLTIP: 'Returns a trigonometric, logarithmic, or exponential value of a number.',
  MATH_ARITHMETIC_TOOLTIP_ADD: 'Returns the sum of two numbers.',
  MATH_ARITHMETIC_TOOLTIP_MINUS: 'Returns the difference of two numbers.',
  MATH_ARITHMETIC_TOOLTIP_MULTIPLY: 'Returns the product of two numbers.',
  MATH_ARITHMETIC_TOOLTIP_DIVIDE: 'Returns the quotient of two numbers.',
  MATH_ARITHMETIC_TOOLTIP_POWER: 'Returns the first number raised to the power of the second number.',
  MATH_SINGLE_TOOLTIP_ROOT: 'Returns the square root of a number.',
  MATH_SINGLE_TOOLTIP_ABS: 'Returns the absolute value of a number.',
  MATH_SINGLE_TOOLTIP_NEG: 'Returns the negation of a number.',
  MATH_SINGLE_TOOLTIP_LN: 'Returns the natural logarithm of a number.',
  MATH_SINGLE_TOOLTIP_LOG10: 'Returns the base 10 logarithm of a number.',
  MATH_SINGLE_TOOLTIP_EXP: 'Returns e to the power of the specified number.',
  MATH_SINGLE_TOOLTIP_POW10: 'Returns 10 to the power of the specified number.',

  // Arduino Math Blocks - Angel
  ARDUINO_CONSTRAIN_MSG: 'limit %1 between %2 and %3',
  ARDUINO_MAP_MSG: 'remap %1 from range %2 - %3 to %4 - %5',
  ARDUINO_MATH_RANDOM_SEED_MSG: 'set random seed to %1',
  ARDUINO_MATH_RANDOM_INT_MSG: 'random number between %1 and %2',

  // Tooltips
  ARDUINO_CONSTRAIN_TOOLTIP: 'Constrains a number to be within a range. Parameters: (value, min, max).',
  ARDUINO_MAP_TOOLTIP: 'Re-maps a number from one range to another. Parameters: (value, fromLow, fromHigh, toLow, toHigh).',
  ARDUINO_MATH_RANDOM_SEED_TOOLTIP: 'Initializes the pseudo-random number generator. Using an unconnected analog pin as a seed is recommended.',
  ARDUINO_MATH_RANDOM_INT_TOOLTIP: 'Generates a pseudo-random number between min (inclusive) and max (exclusive).',
};
