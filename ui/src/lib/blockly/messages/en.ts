/// CodeBridge Block Messages - English
/// Natural language text for all blocks (Angel style base)
/// Colors aligned with piBlockly: ARDUINO=#016c8d, STRUCTURE=#585858, DIGITAL_IO=#0f960a, ANALOG_IO=#FF9800, TIME=#1f039b, SERIAL=#359AFF

export const EN_MESSAGES: Record<string, string> = {
  // ============================================================
  // Color Definitions (aligned with piBlockly)
  // ============================================================
  'ARDUINO_STRUCTURE_HUE': '#585858',
  'ARDUINO_CONTROL_HUE': '#016c8d',
  'ARDUINO_DIGITAL_IO_HUE': '#0f960a',
  'ARDUINO_ANALOG_IO_HUE': '#FF9800',
  'ARDUINO_TIME_HUE': '#1f039b',
  'ARDUINO_SERIAL_HUE': '#359AFF',
  'ARDUINO_IO_HUE': '#016c8d',
  'CODING_HUE': '#585858',
  'LOGIC_HUE': '#b198de',
  'LOOPS_HUE': '#7fcd81',
  'MATH_HUE': '#5C68A6',
  'TEXT_HUE': '#6a8871',
  'VARIABLES_HUE': '#ef9a9a',
  'ARRAY_HUE': '#d1972b',
  'FUNCTIONS_HUE': '#d22f73',

  // ============================================================
  // Toolbox Category Names
  // ============================================================
  'ARDUINO_CATEGORY': 'Arduino',
  'ARDUINO_STRUCTURE_CATEGORY': 'Structure',
  'ARDUINO_IO_CATEGORY': 'I/O',
  'ARDUINO_TIME_CATEGORY': 'Time',
  'ARDUINO_SERIAL_CATEGORY': 'Serial',
  'CODING_CATEGORY': 'Coding',
  'LOGIC_CATEGORY': 'Logic',
  'LOOPS_CATEGORY': 'Loops',
  'MATH_CATEGORY': 'Math',
  'TEXT_CATEGORY': 'Text',
  'VARIABLES_CATEGORY': 'Variables',
  'ARRAY_CATEGORY': 'Array',
  'FUNCTIONS_CATEGORY': 'Functions',

  // ============================================================
  // Shadow Blocks
  // ============================================================
  'ARDUINO_PIN_LABEL': 'pin',

  // ============================================================
  // Arduino Core Blocks
  // ============================================================
  'ARDUINO_PIN_MODE': 'set pin %1 to %2',
  'ARDUINO_DIGITAL_WRITE': 'digital write pin %1 state %2',
  'ARDUINO_DIGITAL_READ': 'digital read pin %1',
  'ARDUINO_ANALOG_WRITE': 'analog write pin %1 value %2',
  'ARDUINO_ANALOG_READ': 'analog read pin %1',
  'ARDUINO_DELAY': 'delay %1 ms',
  'ARDUINO_DELAY_MICROSECONDS': 'delay %1 us',
  'ARDUINO_MILLIS': 'get millis',
  'ARDUINO_MICROS': 'get micros',

  // === Dropdown Options ===
  'ARDUINO_PIN_MODE_OUTPUT': 'output',
  'ARDUINO_PIN_MODE_INPUT': 'input',
  'ARDUINO_PIN_MODE_INPUT_PULLUP': 'input pull-up',
  'ARDUINO_DIGITAL_HIGH': 'high',
  'ARDUINO_DIGITAL_LOW': 'low',

  // === Tooltips ===
  'ARDUINO_PIN_MODE_TOOLTIP': 'Set the specified pin to INPUT or OUTPUT mode.',
  'ARDUINO_DIGITAL_WRITE_TOOLTIP': 'Set the specified pin to HIGH or LOW.',
  'ARDUINO_DIGITAL_READ_TOOLTIP': 'Read the digital state (HIGH or LOW) of the specified pin.',
  'ARDUINO_ANALOG_WRITE_TOOLTIP': 'Output a PWM analog value (0-255) on the specified pin.',
  'ARDUINO_ANALOG_READ_TOOLTIP': 'Read the voltage value (0-1023) from the specified analog pin.',
  'ARDUINO_DELAY_TOOLTIP': 'Pause the program for the specified number of milliseconds. 1000 ms = 1 second.',
  'ARDUINO_DELAY_MICROSECONDS_TOOLTIP': 'Pause the program for the specified number of microseconds. 1000 us = 1 ms.',
  'ARDUINO_MILLIS_TOOLTIP': 'Returns the number of milliseconds since the Arduino board started.',
  'ARDUINO_MICROS_TOOLTIP': 'Returns the number of microseconds since the Arduino board started.',

  // ============================================================
  // Serial Communication Blocks
  // ============================================================
  'ARDUINO_SERIAL_BEGIN': 'serial begin baud %1',
  'ARDUINO_SERIAL_PRINT': 'serial print %1',
  'ARDUINO_SERIAL_PRINTLN': 'serial println %1',
  'ARDUINO_SERIAL_AVAILABLE': 'serial available bytes',
  'ARDUINO_SERIAL_READ': 'serial read one byte',
  'ARDUINO_SERIAL_PRINT_NEWLINE': 'serial print new line',

  // === Tooltips ===
  'ARDUINO_SERIAL_BEGIN_TOOLTIP': 'Initialize serial communication and set the baud rate. Common value: 9600.',
  'ARDUINO_SERIAL_PRINT_TOOLTIP': 'Print data to the serial port (no newline).',
  'ARDUINO_SERIAL_PRINTLN_TOOLTIP': 'Print data to the serial port with a newline.',
  'ARDUINO_SERIAL_AVAILABLE_TOOLTIP': 'Get the number of bytes available to read from the serial buffer.',
  'ARDUINO_SERIAL_READ_TOOLTIP': 'Read the first available byte from the serial port (-1 if no data).',

  // ============================================================
  // Structure Blocks
  // ============================================================
  'INITIALIZES_SETUP_APPENDTEXT': 'void setup()',
  'INITIALIZES_LOOP_APPENDTEXT': 'void loop()',
  'INITIALIZES_SETUP_TOOLTIP': 'The Arduino setup() function. Code here runs once when the board starts.',
  'INITIALIZES_LOOP_TOOLTIP': 'The Arduino loop() function. Code here runs repeatedly.',

  // ============================================================
  // Logic Blocks
  // ============================================================
  'CONTROLS_IF_MSG_IF': 'if',
  'CONTROLS_IF_MSG_THEN': 'then',
  'CONTROLS_IF_MSG_ELSEIF': 'else if',
  'CONTROLS_IF_MSG_ELSE': 'else',
  'CONTROLS_IF_TOOLTIP': 'If the condition is true, execute the specified code.',
  'LOGIC_COMPARE_MESSAGE': '%1 %2 %3',
  'LOGIC_OPERATION_MESSAGE': '%1 %2 %3',
  'LOGIC_NEGATE_MESSAGE': 'not (%1)',
  'LOGIC_OPERATION_AND': 'and',
  'LOGIC_OPERATION_OR': 'or',
  'LOGIC_BOOLEAN_TRUE': 'true',
  'LOGIC_BOOLEAN_FALSE': 'false',
  'LOGIC_COMPARE_EQ': '=',
  'LOGIC_COMPARE_NEQ': '≠',
  'LOGIC_COMPARE_LT': '<',
  'LOGIC_COMPARE_LTE': '≤',
  'LOGIC_COMPARE_GT': '>',
  'LOGIC_COMPARE_GTE': '≥',

  // ============================================================
  // Loop Blocks
  // ============================================================
  'CONTROLS_FOR_MESSAGE': 'count %1 from %2 to %3 by %4',
  'CONTROLS_FOR_TOOLTIP': 'Count a variable from start to end, incrementing each step.',
  'CONTROLS_WHILE_MESSAGE': 'while %1',
  'CONTROLS_WHILE_TOOLTIP': 'Repeat the code while the condition is true.',
  'CONTROLS_FLOW_STATEMENTS_MESSAGE': 'break out of loop',
  'CONTROLS_FLOW_STATEMENTS_TOOLTIP': 'Break out of the current loop.',
  'CONTROLS_REPEAT_MESSAGE': 'repeat %1 times',
  'CONTROLS_REPEAT_TOOLTIP': 'Repeat the specified code a fixed number of times.',

  // ============================================================
  // Math Blocks
  // ============================================================
  'ARDUINO_CONSTRAIN': 'constrain %1 between %2 and %3',
  'ARDUINO_MAP': 'map %1 from %2~%3 to %4~%5',
  'ARDUINO_MATH_RANDOM_SEED': 'random seed %1',
  'ARDUINO_MATH_RANDOM_INT': 'random integer %1 to %2',
  'MATH_NUMBER': 'number %1',
  'MATH_ARITHMETIC': '%1 %2 %3',
  'MATH_SINGLE': '%1 %2',
  'MATH_TRIG': '%1 %2',
  'MATH_ONLIST': '%1 %2',
  'MATH_MODULO': '%1 modulo %2',
  'MATH_CHANGE': 'increase %1 by %2',
  'MATH_CONSTRAIN_TOOLTIP': 'Constrain a number between a min and max value (inclusive).',
  'MATH_MAP_TOOLTIP': 'Map a number from one range to another.',
  'MATH_RANDOM_SEED_TOOLTIP': 'Set the random seed to make the random sequence reproducible.',
  'MATH_RANDOM_INT_TOOLTIP': 'Return a random integer between min and max (inclusive).',

  // ============================================================
  // Text Blocks
  // ============================================================
  'TEXT_STRING': 'string %1',
  'TEXT_STRING_TOOLTIP': 'Enter a text string.',
  'TEXT_LENGTH': 'length of %1',
  'TEXT_LENGTH_TOOLTIP': 'Count the number of characters in the string (including spaces).',
  'TEXT_ISEMPTY': '%1 is empty',
  'TEXT_ISEMPTY_TOOLTIP': 'Check if the string is empty.',
  'TEXT_INDEXOF': 'in %1 find %2 at occurrence %3',
  'TEXT_INDEXOF_TOOLTIP': 'Find the position of text in a string.',
  'TEXT_CHARAT': 'character %2 of %1',
  'TEXT_CHARAT_TOOLTIP': 'Get the character at a specific position in the string.',
  'TEXT_SUBSTRING': 'substring of %1 from %2 to %3',
  'TEXT_SUBSTRING_TOOLTIP': 'Get a portion of the string.',
  'TEXT_APPEND': 'append %2 to %1',
  'TEXT_APPEND_TOOLTIP': 'Append text to the end of a variable.',
  'TEXT_JOIN': 'join %1',
  'TEXT_JOIN_TOOLTIP': 'Join multiple text strings into one.',

  // ============================================================
  // Variable Blocks
  // ============================================================
  'VARIABLES_SET': 'set %1 to %2',
  'VARIABLES_SET_TOOLTIP': 'Set the variable to the specified value.',
  'VARIABLES_GET': 'variable %1',
  'VARIABLES_GET_TOOLTIP': 'Get the value of the variable.',

  // ============================================================
  // Coding Blocks (aligned with piBlockly)
  // ============================================================
  'CODING_COMMENT_MESSAGE': 'comment %1',
  'CODING_INCLUDE_MESSAGE': 'include library %1',
  'CODING_RAW_STATEMENT_MESSAGE': 'raw code %1',
  'CODING_RAW_INPUT_MESSAGE': 'raw expression %1',
  'CODING_RAW_DEFINITION_MESSAGE': 'raw definition %1',
  'CODING_RAW_WRAPPER_TOP_MESSAGE': 'raw wrapper (top) %1',
  'CODING_RAW_WRAPPER_BOTTOM_MESSAGE': 'raw wrapper (bottom) %1',
};