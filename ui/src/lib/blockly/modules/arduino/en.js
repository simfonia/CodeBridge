/// CodeBridge Arduino Module - English Messages
/// Includes: colors, category names, block text, dropdown options, tooltips

var ARDUINO_EN = {
  // Colors
  ARDUINO_STRUCTURE_HUE: '#585858',
  ARDUINO_CONTROL_HUE: '#016c8d',
  ARDUINO_DIGITAL_IO_HUE: '#0f960a',
  ARDUINO_ANALOG_IO_HUE: '#FF9800',
  ARDUINO_TIME_HUE: '#1f039b',
  ARDUINO_SERIAL_HUE: '#359AFF',

  // Category names (only Arduino module's own)
  ARDUINO_CATEGORY: 'Arduino',
  ARDUINO_STRUCTURE_CATEGORY: 'Structure',
  ARDUINO_IO_CATEGORY: 'I/O',
  ARDUINO_TIME_CATEGORY: 'Time',
  ARDUINO_SERIAL_CATEGORY: 'Serial',

  // Shadow blocks
  ARDUINO_PIN_LABEL: 'pin',

  // Core blocks
  ARDUINO_PIN_MODE: 'set %1 to %2',
  ARDUINO_DIGITAL_WRITE: 'digital output %1 state %2',
  ARDUINO_DIGITAL_READ: 'digital input %1',
  ARDUINO_ANALOG_WRITE: 'analog output %1 = %2',
  ARDUINO_ANALOG_READ: 'analog input %1',
  ARDUINO_DELAY: 'delay %1 ms',
  ARDUINO_DELAY_MICROSECONDS: 'delay %1 us',
  ARDUINO_MILLIS: 'get millis',
  ARDUINO_MICROS: 'get micros',

  // Dropdown options
  ARDUINO_PIN_MODE_OUTPUT: 'output',
  ARDUINO_PIN_MODE_INPUT: 'input',
  ARDUINO_PIN_MODE_INPUT_PULLUP: 'input pull-up',
  ARDUINO_DIGITAL_HIGH: 'high',
  ARDUINO_DIGITAL_LOW: 'low',

  // Tooltips
  ARDUINO_PIN_MODE_TOOLTIP: 'Set the specified pin to INPUT or OUTPUT mode.',
  ARDUINO_DIGITAL_WRITE_TOOLTIP: 'Set the specified pin to HIGH or LOW.',
  ARDUINO_DIGITAL_READ_TOOLTIP: 'Read the digital state (HIGH or LOW) of the specified pin.',
  ARDUINO_ANALOG_WRITE_TOOLTIP: 'Output a PWM analog value (0-255) on the specified pin.',
  ARDUINO_ANALOG_READ_TOOLTIP: 'Read the voltage value (0-1023) from the specified analog pin.',
  ARDUINO_DELAY_TOOLTIP: 'Pause the program for the specified number of milliseconds. 1000 ms = 1 second.',
  ARDUINO_DELAY_MICROSECONDS_TOOLTIP: 'Pause the program for the specified number of microseconds. 1000 us = 1 ms.',
  ARDUINO_MILLIS_TOOLTIP: 'Returns the number of milliseconds since the Arduino board started.',
  ARDUINO_MICROS_TOOLTIP: 'Returns the number of microseconds since the Arduino board started.',

  // Serial communication
  ARDUINO_SERIAL_BEGIN: 'serial begin baud %1',
  ARDUINO_SERIAL_BAUD_300: '300',
  ARDUINO_SERIAL_BAUD_1200: '1200',
  ARDUINO_SERIAL_BAUD_2400: '2400',
  ARDUINO_SERIAL_BAUD_4800: '4800',
  ARDUINO_SERIAL_BAUD_9600: '9600',
  ARDUINO_SERIAL_BAUD_14400: '14400',
  ARDUINO_SERIAL_BAUD_19200: '19200',
  ARDUINO_SERIAL_BAUD_28800: '28800',
  ARDUINO_SERIAL_BAUD_38400: '38400',
  ARDUINO_SERIAL_BAUD_57600: '57600',
  ARDUINO_SERIAL_BAUD_115200: '115200',
  ARDUINO_SERIAL_PRINT: 'serial print %1',
  ARDUINO_SERIAL_PRINTLN: 'serial println %1',
  ARDUINO_SERIAL_AVAILABLE: 'serial available bytes',
  ARDUINO_SERIAL_READ: 'serial read one byte',
  ARDUINO_SERIAL_PRINT_NEWLINE: 'serial print new line',

  ARDUINO_SERIAL_BEGIN_TOOLTIP: 'Initialize serial communication and set the baud rate. Common value: 9600.',
  ARDUINO_SERIAL_PRINT_TOOLTIP: 'Print data to the serial port (no newline).',
  ARDUINO_SERIAL_PRINTLN_TOOLTIP: 'Print data to the serial port with a newline.',
  ARDUINO_SERIAL_AVAILABLE_TOOLTIP: 'Get the number of bytes available to read from the serial buffer.',
  ARDUINO_SERIAL_READ_TOOLTIP: 'Read the first available byte from the serial port (-1 if no data).',

  // Structure
  INITIALIZES_SETUP_APPENDTEXT: 'Setup (void setup)',
  INITIALIZES_LOOP_APPENDTEXT: 'Loop (void loop)',
  INITIALIZES_SETUP_TOOLTIP: 'The Arduino setup() function. Code here runs once when the board starts.',
  INITIALIZES_LOOP_TOOLTIP: 'The Arduino loop() function. Code here runs repeatedly.',
};