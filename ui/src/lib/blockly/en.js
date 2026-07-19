// piblockly/media/user_modules/_core_hw_lib/en.tmp.js

export const MSG_PIBLOCKLY_HW_EN = {
  // Color Keys
  PIBLOCKLY_HW_COLOR_SENSORS: "#4A90E2",
  PIBLOCKLY_HW_COLOR_ACTUATORS: "#D9A443",
  PIBLOCKLY_HW_COLOR_AI: "#8BC34A",

  // Category Keys
  PIBLOCKLY_HW_CATEGORY: "Hardware",

  //Sensors
  PIBLOCKLY_HW_CATEGORY_SENSORS: "Sensors",

  // Actuators
  PIBLOCKLY_HW_CATEGORY_ACTUATORS: "Actuators",

  // Music
  PIBLOCKLY_HW_MUSIC_HUE: "#de57ad",
  PIBLOCKLY_HW_CATEGORY_MUSIC: "Music",

  PIBLOCKLY_HW_MUSIC_SET_TEMPO: "Set Music Tempo",
  PIBLOCKLY_HW_MUSIC_BPM: "BPM",
  PIBLOCKLY_HW_MUSIC_SET_TEMPO_TOOLTIP: "Sets the global tempo in Beats Per Minute (BPM) for music blocks.",
  PIBLOCKLY_HW_MUSIC_PLAY_NOTE: "Play Note",
  PIBLOCKLY_HW_MUSIC_PIN: "Pin",
  PIBLOCKLY_HW_MUSIC_FREQUENCY: "Frequency (Hz)",
  PIBLOCKLY_HW_MUSIC_NOTE_DURATION: "Duration:",
  PIBLOCKLY_HW_MUSIC_WHOLE_NOTE: "Whole Note",
  PIBLOCKLY_HW_MUSIC_HALF_NOTE: "Half Note",
  PIBLOCKLY_HW_MUSIC_QUARTER_NOTE: "Quarter Note",
  PIBLOCKLY_HW_MUSIC_EIGHTH_NOTE: "Eighth Note",
  PIBLOCKLY_HW_MUSIC_SIXTEENTH_NOTE: "Sixteenth Note",
  PIBLOCKLY_HW_MUSIC_THIRTYSECOND_NOTE: "Thirty-second Note",
  PIBLOCKLY_HW_MUSIC_PLAY_NOTE_TOOLTIP: "Plays a musical note on the specified pin with given frequency and duration. Can be dotted or triplet.",
  PIBLOCKLY_HW_MUSIC_DOTTED: "Dotted",
  PIBLOCKLY_HW_MUSIC_TRIPLET: "Triplet",
  PIBLOCKLY_HW_MUSIC_NOTE_TO_FREQUENCY: "Note to Frequency",
  PIBLOCKLY_HW_MUSIC_NOTE_TO_FREQUENCY_TOOLTIP: "Converts a musical note (e.g., C4, A#5) to its corresponding frequency in Hz.",
  PIBLOCKLY_HW_MUSIC_TONE: "Play tone on pin %1 with frequency %2 for duration (ms) %3 (non-blocking)",
  PIBLOCKLY_HW_MUSIC_TONE_TOOLTIP: "Generates a tone on the specified pin.",
  PIBLOCKLY_HW_MUSIC_NO_TONE: "Stop tone on pin %1",
  PIBLOCKLY_HW_MUSIC_NO_TONE_TOOLTIP: "Stops the tone playing on the specified pin.",
  PIBLOCKLY_HW_MUSIC_NOTE_NAME_REST: "Rest",
  PIBLOCKLY_HW_MUSIC_PLAY_MELODY_STRING_MESSAGE: "Play Melody String",
  PIBLOCKLY_HW_MUSIC_PLAY_MELODY_STRING_MESSAGE_PIN: "Play melody on pin",
  PIBLOCKLY_HW_MUSIC_PLAY_MELODY_STRING_MESSAGE_MELODY: "Melody:",
  PIBLOCKLY_HW_MUSIC_PLAY_MELODY_STRING_TOOLTIP: "Plays a melody defined by a string (e.g., C4Q,D4Q,E4H). Supports spaces or commas as delimiters; suggested newline every measure. Use R for rests, _T for triplets. Case-insensitive.",

  // AI
  PIBLOCKLY_HW_CATEGORY_AI: "AI",


  // Sensors
  // Common Category
  PIBLOCKLY_HW_CATEGORY_COMMON: "Common",

  // Ultrasonic Distance Block
  PIBLOCKLY_HW_ULTRASONIC_DISTANCE_MESSAGE:
    "HC-SR04 Ultrasonic Distance, Trig Pin %1, Echo Pin %2",
  PIBLOCKLY_HW_ULTRASONIC_DISTANCE_TOOLTIP:
    "Reads distance from HC-SR04 ultrasonic sensor",
  PIBLOCKLY_HW_ULTRASONIC_DISTANCE_HELPURL: "",

  // DHT Sensor Block
  PIBLOCKLY_HW_DHT_READ_MESSAGE: "Read DHT %1 on pin %2, Reading: %3",
  PIBLOCKLY_HW_DHT_READ_TOOLTIP:
    "Reads Temperature or Humidity from a DHT sensor. Requires the 'DHT sensor library' by Adafruit.",
  PIBLOCKLY_HW_DHT_TYPE_11: "DHT11",
  PIBLOCKLY_HW_DHT_TYPE_22: "DHT22",
  PIBLOCKLY_HW_DHT_READING_TEMP: "Temperature (°C)",
  PIBLOCKLY_HW_DHT_READING_HUMIDITY: "Humidity (%)",

  // MPU9250 Blocks
  PIBLOCKLY_HW_SENSORS_MPU9250: "MPU9250",
  "PIBLOCKLY_HW_MPU9250_INIT_MESSAGE": "Initialize MPU9250 (I2C) SDA %1 SCL %2 Accel Range %3 Gyro Range %4",
  "PIBLOCKLY_HW_MPU9250_INIT_TOOLTIP": "Initializes the MPU9250 sensor. Sets the I2C pins and starts the accelerometer, gyroscope, and magnetometer.",

  PIBLOCKLY_HW_MPU9250_ACCEL_FETCH: "Update the data of accelerometer",
  PIBLOCKLY_HW_MPU9250_ACCEL_3AXIS: "Accelerometer G value",
  PIBLOCKLY_HW_MPU9250_3AXIS_POST_FIX: "axis",

  PIBLOCKLY_HW_MPU9250_GYRO_FETCH: "Update the data of Gyroscope",
  PIBLOCKLY_HW_MPU9250_GYRO_3AXIS: "Gyroscope data",
  PIBLOCKLY_HW_MPU9250_3AXIS_POST_FIX_UNIT: "DPS",

  PIBLOCKLY_HW_MPU9250_MAG_FETCH: "Update the data of Magnetometer",
  PIBLOCKLY_HW_MPU9250_MAG_3AXIS: "Magnetometer data",
  PIBLOCKLY_HW_MPU9250_ACCEL_PITCH_ROLL: "Rotation angle",
  PIBLOCKLY_HW_MPU9250_PITCH_ROLL_PITCH: "Pitch",
  PIBLOCKLY_HW_MPU9250_PITCH_ROLL_ROLL: "Roll",

  PIBLOCKLY_HW_MPU9250_ACCEL_FETCH_TOOLTIP: "Updates the data from the MPU9250 accelerometer.",
  PIBLOCKLY_HW_MPU9250_ACCEL_3AXIS_TOOLTIP: "Gets the G-force values from the MPU9250 accelerometer along the X, Y, or Z axis.",
  PIBLOCKLY_HW_MPU9250_ACCEL_PITCH_ROLL_TOOLTIP: "Gets the Pitch or Roll angle from the MPU9250 accelerometer.",

  PIBLOCKLY_HW_MPU9250_MAG_FETCH_TOOLTIP: "Updates the data from the MPU9250 magnetometer.",
  PIBLOCKLY_HW_MPU9250_MAG_3AXIS_TOOLTIP: "Gets the magnetic field values from the MPU9250 magnetometer along the X, Y, or Z axis.",

  PIBLOCKLY_HW_MPU9250_GYRO_FETCH_TOOLTIP: "Updates the data from the MPU9250 gyroscope.",
  PIBLOCKLY_HW_MPU9250_GYRO_3AXIS_TOOLTIP: "Gets the angular velocity values from the MPU9250 gyroscope along the X, Y, or Z axis.",


  // MAX30105 Blocks
  PIBLOCKLY_HW_MAX30105_HELPURL: "",
  PIBLOCKLY_HW_MAX30105_TITLE: "MAX30105 SPO2",
  PIBLOCKLY_HW_MAX30105_TOOLTIP: "MAX30105 SPO2",
  PIBLOCKLY_HW_MAX30105_INIT_TOOLTIP: "Initializes the MAX30105 pulse oximeter sensor. Allows setting I2C pins and red LED brightness.",
  PIBLOCKLY_HW_MAX30105_INIT_MESSAGE:
    "Initialize MAX30105 (I2C) SDA %1 SCL %2 LED red brightness %3",
  PIBLOCKLY_HW_MAX30105_CHECK_TOOLTIP: "Checks if the MAX30105 sensor detects a finger, if the sensor is ready, or for heartbeat.",
  PIBLOCKLY_HW_MAX30105_GET_BEAT_RATE_TOOLTIP: "Gets the average beat rate from the MAX30105 pulse oximeter sensor.",
  PIBLOCKLY_HW_MAX30105_GET_SPO2_TOOLTIP: "Gets the SpO2 (blood oxygen saturation) reading from the MAX30105 pulse oximeter sensor.",
  PIBLOCKLY_HW_MAX30105_GET_TEMPERATURE_TOOLTIP: "Gets the temperature reading from the MAX30105 pulse oximeter sensor.",
  PIBLOCKLY_HW_MAX30105_SET_BEAT_RANGE_TOOLTIP: "Sets the reasonable beat rate detection range for the MAX30105 pulse oximeter sensor.",
  PIBLOCKLY_HW_MAX30105_SET_SPO2_CLEAR_TOOLTIP: "Resets the detected SpO2 value of the MAX30105 pulse oximeter sensor.",

  PIBLOCKLY_HW_MAX30105_LED: "red LED brightness",
  PIBLOCKLY_HW_MAX30105_CHECK: "detected",
  PIBLOCKLY_HW_MAX30105_CHECK_LIST: [
    ["finger", "IR"],
    ["MAX3010X", "READY"],
    ["HearBeat", "HB"],
  ],
  PIBLOCKLY_HW_MAX30105_CHECK_MESSAGE: "MAX30105 SPO2 detected %1 ?",
  PIBLOCKLY_HW_MAX30105_WARNING:
    'You have to set "' +
    "PIBLOCKLY_HW_MAX30105_TITLE" +
    " " +
    "PIBLOCKLY_HW_PROBBIE_INIT" +
    '" first.',
  PIBLOCKLY_HW_MAX30105_BEATRATE: "HearBeat rate",
  PIBLOCKLY_HW_MAX30105_AVG: "times average value",
  PIBLOCKLY_HW_MAX30105_GET_BEAT_RATE_MESSAGE:
    "MAX30105 SPO2 %1 times HearBeat rate average value",
  PIBLOCKLY_HW_MAX30105_SPO2: "SpO2",
  PIBLOCKLY_HW_MAX30105_TEMPERATURE: "temperature",
  PIBLOCKLY_HW_MAX30105_TEMP_LIST: [
    ["Celsius", "C"],
    ["Fahrenheit", "F"],
  ],
  PIBLOCKLY_HW_MAX30105_GET_TEMPERATURE_MESSAGE: "MAX30105 SPO2 temperature %1",
  PIBLOCKLY_HW_MAX30105_BEAT_RANGE: "set available heartbeat rate range:",
  PIBLOCKLY_HW_MAX30105_SET_BEAT_RANGE_MESSAGE:
    "MAX30105 SPO2 set available heartbeat rate range: %1 ~ %2",
  PIBLOCKLY_HW_MAX30105_SPO2_CLEAR: "reset SpO2 detected value",
  PIBLOCKLY_HW_PROBBIE_INIT: "Init",

  // PS2 Blocks
  PIBLOCKLY_HW_PS2: "PS2 Controller",
  PIBLOCKLY_HW_PS2_INITIAL: "Initial",
  PIBLOCKLY_HW_PS2_PRESSURES: "Pressures sensitivity",
  PIBLOCKLY_HW_PS2_RUMBLE: "Rumble",
  PIBLOCKLY_HW_PS2_READ_CONTROLLER: "Read controller once",
  PIBLOCKLY_HW_PS2_VIBRATE_N: "Off",
  PIBLOCKLY_HW_PS2_VIBRATE_Y: "On",
  PIBLOCKLY_HW_PS2_VIBRATE_VALUE: "Strength",
  PIBLOCKLY_HW_PS2_READ_MESSAGE:
    "Read PS2 controller state and set motor rumble %1 intensity %2",
  PIBLOCKLY_HW_PS2_BUTTON_PRESS: "is pressed",
  PIBLOCKLY_HW_PS2_BUTTON_PRESS_NEW: "is changed",
  PIBLOCKLY_HW_PS2_BUTTON_PRESS_JUST: "is just pressed",
  PIBLOCKLY_HW_PS2_BUTTON_RELEASE_JUST: "is just released",
  PIBLOCKLY_HW_PS2_ENABLED: "Enabled",
  PIBLOCKLY_HW_PS2_INITIAL_FUNC_MESSAGE: "PS2 Controller Enabled %1",
  PIBLOCKLY_HW_PS2_DISABLED: "Disabled",
  PIBLOCKLY_HW_PS2_STICK_LEFT: "Left stick",
  PIBLOCKLY_HW_PS2_STICK_RIGHT: "Right stick",
  PIBLOCKLY_HW_PS2_STICK_DIRECTION8: "8 directions",
  PIBLOCKLY_HW_PS2_STICK_DIRECTION4: "4 directions",
  PIBLOCKLY_HW_PS2_STICK_DIRECTION_UP: "↑",
  PIBLOCKLY_HW_PS2_STICK_DIRECTION_UPRIGHT: "↗",
  PIBLOCKLY_HW_PS2_STICK_DIRECTION_RIGHT: "→",
  PIBLOCKLY_HW_PS2_STICK_DIRECTION_DOWNRIGHT: "↘",
  PIBLOCKLY_HW_PS2_STICK_DIRECTION_DOWN: "↓",
  PIBLOCKLY_HW_PS2_STICK_DIRECTION_DOWNLEFT: "↙",
  PIBLOCKLY_HW_PS2_STICK_DIRECTION_LEFT: "←",
  PIBLOCKLY_HW_PS2_STICK_DIRECTION_LEFTUP: "↖",
  PIBLOCKLY_HW_PS2_STICK_DIRECTION_CENTER: "o",
  PIBLOCKLY_HW_PS2_STICK_DIRECTION_MESSAGE:
    "PS2 Controller %1 Stick %2 direction %3",
  PIBLOCKLY_HW_PS2_STATE: "Controller connected to board",
  PIBLOCKLY_HW_PS2_RECEIVER_STATE: "Receiver disconnected from board",
  PIBLOCKLY_HW_PS2_ANALOG_MAX: "Board analog input max value",
  PIBLOCKLY_HW_PS2_ANALOG_MAX_MESSAGE:
    "PS2 Controller Board analog input max value %1",
  PIBLOCKLY_HW_PS2_ANALOG_READ_LX: "Left Stick X axis analog value",
  PIBLOCKLY_HW_PS2_ANALOG_READ_LY: "Left Stick Y axis analog value",
  PIBLOCKLY_HW_PS2_ANALOG_READ_LA: "Left Stick direction angle",
  PIBLOCKLY_HW_PS2_ANALOG_READ_RX: "Right Stick X axis analog value",
  PIBLOCKLY_HW_PS2_ANALOG_READ_RY: "Right Stick Y axis analog value",
  PIBLOCKLY_HW_PS2_ANALOG_READ_RA: "Right Stick direction angle",
  PIBLOCKLY_HW_PS2_ANALOG_READ_MESSAGE: "PS2 Controller %1",
  PIBLOCKLY_HW_PS2_BUTTON_GREEN: "△ Green",
  PIBLOCKLY_HW_PS2_BUTTON_RED: "○ Red",
  PIBLOCKLY_HW_PS2_BUTTON_BLUE: "✕ Blue",
  PIBLOCKLY_HW_PS2_BUTTON_PINK: "☐ Pink",
  PIBLOCKLY_HW_PS2_BUTTON: "Button",
  PIBLOCKLY_HW_PS2_BUTTON_EVENT_MESSAGE: "PS2 Controller Button %1 %2",
  PIBLOCKLY_HW_PS2_PRESSURES_ANALOG: "Pressure sensitive analog value",
  PIBLOCKLY_HW_PS2_PRESSURES_READ_MESSAGE:
    "PS2 Controller Button %1 Pressure sensitive analog value",
  PIBLOCKLY_HW_PS2_INITIAL_MESSAGE:
    "PS2 Controller Initial CLK %1 CMD %2 CS %3 DAT %4 Pressures sensitivity %5 Rumble %6",

  "PIBLOCKLY_HW_PS2_INITIAL_TOOLTIP": "Initializes the PS2 controller sensor",
  "PIBLOCKLY_HW_PS2_READ_TOOLTIP": "Reads the latest state of the PS2 controller (buttons, joysticks). Can also set the controller's rumble motor on/off and its intensity (0-255).",
  "PIBLOCKLY_HW_PS2_BUTTON_EVENT_TOOLTIP": "Detects PS2 controller button events (press, release, etc.)",
  "PIBLOCKLY_HW_PS2_INITIAL_FUNC_TOOLTIP": "Enables or disables pressure sensitivity or rumble feedback for the PS2 controller",
  "PIBLOCKLY_HW_PS2_STICK_DIRECTION_TOOLTIP": "Detects the direction of the PS2 controller's joystick (left or right, 4-way or 8-way)",
  "PIBLOCKLY_HW_PS2_RECEIVER_STATE_TOOLTIP": "Checks if the PS2 controller receiver is connected to the board",
  "PIBLOCKLY_HW_PS2_STATE_TOOLTIP": "Checks if the PS2 controller is connected to the board",
  "PIBLOCKLY_HW_PS2_ANALOG_MAX_TOOLTIP": "Sets the maximum analog input value for the board, used for PS2 joystick readings",
  "PIBLOCKLY_HW_PS2_ANALOG_READ_TOOLTIP": "Reads the analog value or angle of the PS2 controller's joystick",
  "PIBLOCKLY_HW_PS2_PRESSURES_READ_TOOLTIP": "Reads the pressure sensitivity analog value of PS2 controller buttons",


  // Actuator
  // L293D Blocks
  PIBLOCKLY_HW_ACTUATORS_L293D: "L293D Motor Driver",
  PIBLOCKLY_HW_L293D_MOTOR_RUN_TITLE: "L293D DC Motor",
  PIBLOCKLY_HW_L293D_MOTOR_RUN_TOOLTIP: "L293D DC motor control",
  PIBLOCKLY_HW_L293D_MOTOR_RUN_MESSAGE: "L293D DC Motor %1 %2 Speed %3",
  PIBLOCKLY_HW_L293D_MOTOR_SPEED_MESSAGE: "L293D DC Motor %1 Speed %2 (-255 to 255)",
  PIBLOCKLY_HW_L293D_MOTOR_SPEED_TOOLTIP: "Controls L293D DC motor speed and direction using a single value from -255 (backward) to 255 (forward). 0 stops the motor.",
  PIBLOCKLY_HW_L293D_MOTOR_STOP_TITLE: "L293D DC Motor Stop",
  PIBLOCKLY_HW_L293D_MOTOR_STOP_TOOLTIP: "Stop the L293D DC motor",
  PIBLOCKLY_HW_L293D_MOTOR_STOP_MESSAGE: "L293D DC Motor %1 Stop",
  PIBLOCKLY_HW_L293D_STEPPER_INIT_TITLE: "L293D Stepper Initial",
  PIBLOCKLY_HW_L293D_STEPPER_INIT_TOOLTIP: "Initialize L293D stepper motor",
  PIBLOCKLY_HW_L293D_STEPPER_INIT_MESSAGE: "L293D Stepper Initial %1 %2",
  PIBLOCKLY_HW_L293D_STEPPER_SPEED_TITLE: "L293D Stepper Set Speed (RPM)",
  PIBLOCKLY_HW_L293D_STEPPER_SPEED_TOOLTIP:
    "Set the speed of the L293D stepper motor in RPM",
  PIBLOCKLY_HW_L293D_STEPPER_SPEED_MESSAGE: "L293D Stepper %1 Set Speed %2 RPM",
  PIBLOCKLY_HW_L293D_STEPPER_RUN_TITLE: "L293D Stepper Move Steps",
  PIBLOCKLY_HW_L293D_STEPPER_RUN_TOOLTIP:
    "Move the L293D stepper motor by a number of steps",
  PIBLOCKLY_HW_L293D_STEPPER_RUN_MESSAGE: "L293D Stepper %1 %2 Steps %3 %4",
  PIBLOCKLY_HW_L293D_STEPPER_STOP_TITLE: "L293D Stepper Stop",
  PIBLOCKLY_HW_L293D_STEPPER_STOP_TOOLTIP: "Stop the L293D stepper motor",
  PIBLOCKLY_HW_L293D_STEPPER_STOP_MESSAGE: "L293D Stepper %1 Stop",
  PIBLOCKLY_HW_L293D_SERVO_RUN_TITLE: "L293D Servo",
  PIBLOCKLY_HW_L293D_SERVO_RUN_TOOLTIP:
    "Control an L293D-connected servo motor",
  PIBLOCKLY_HW_L293D_SERVO_RUN_MESSAGE: "L293D Servo %1 Angle %2",
  PIBLOCKLY_HW_L293D_SERVO_DETACH_TITLE: "L293D Servo Detach",
  PIBLOCKLY_HW_L293D_SERVO_DETACH_TOOLTIP:
    "Detach the L293D-connected servo motor",
  PIBLOCKLY_HW_L293D_SERVO_DETACH_MESSAGE: "L293D Servo Detach %1",
  PIBLOCKLY_HW_L293D_DIRECTION_FORWARD: "Forward",
  PIBLOCKLY_HW_L293D_DIRECTION_BACKWARD: "Backward",
  PIBLOCKLY_HW_L293D_STEPPER_METHOD_SINGLE: "Single Coil",
  PIBLOCKLY_HW_L293D_STEPPER_METHOD_DOUBLE: "Double Coils",
  PIBLOCKLY_HW_L293D_STEPPER_METHOD_INTERLEAVE: "Interleave Coil",
  PIBLOCKLY_HW_L293D_STEPPER_METHOD_MICROSTEP: "Microstep",
  PIBLOCKLY_HW_L293D_SERVO_CHANNEL_1: "1",
  PIBLOCKLY_HW_L293D_SERVO_CHANNEL_2: "2",

  // PCA9685 Blocks
  PIBLOCKLY_HW_ACTUATORS_PCA9685: "PCA9685",
  PIBLOCKLY_HW_PCA9685_INIT: "Initialize PCA9685 (I2C) SDA %1 SCL %2",
  PIBLOCKLY_HW_PCA9685_PWM_CHANNEL: "PWM write channel",
  PIBLOCKLY_HW_PCA9685_PWM_VALUE: "value",
  PIBLOCKLY_HW_PCA9685_PWM_WRITE_MESSAGE:
    "PWM write channel %1 value %2 (0~4095)",
  PIBLOCKLY_HW_PCA9685_TOOLTIP: "PCA9685",
  PIBLOCKLY_HW_PCA9685_SERVO_PULSE_MIN: "Servo set pulse Min",
  PIBLOCKLY_HW_PCA9685_SERVO_PULSE_MAX: "Max",
  PIBLOCKLY_HW_PCA9685_SERVO_INIT_MESSAGE: "Servo set pulse Min %1 Max %2",
  PIBLOCKLY_HW_PCA9685_SERVO_CHANNEL: "Servo write channel",
  PIBLOCKLY_HW_PCA9685_SERVO_DEGREE: "degree",
  PIBLOCKLY_HW_PCA9685_SERVO_WRITE_MESSAGE:
    "Servo write channel %1 degree %2 (0~180)",

  PIBLOCKLY_HW_PCA9685_INIT_TOOLTIP: "Initializes the PCA9685 PWM controller. Allows setting I2C pins.",
  "PIBLOCKLY_HW_PCA9685_PWM_WRITE_TOOLTIP": "Sets the PWM value for a specific channel on the PCA9685 PWM controller.",
  "PIBLOCKLY_HW_PCA9685_SERVO_INIT_TOOLTIP": "Sets the minimum and maximum pulse width for the servo motor on the PCA9685 PWM controller.",
  "PIBLOCKLY_HW_PCA9685_SERVO_WRITE_TOOLTIP": "Sets the angle of the servo motor on a specific channel of the PCA9685 PWM controller.",


  // Servo Blocks
  PIBLOCKLY_HW_CATEGORY_SERVO: "Servo",
  PIBLOCKLY_HW_SERVO_ATTACH_MESSAGE: "attach servo on pin %1 as %2",
  PIBLOCKLY_HW_SERVO_ATTACH_TOOLTIP: "Attaches a servo object to a specified pin and gives it a name.",
  PIBLOCKLY_HW_SERVO_ATTACH_ADVANCED_MESSAGE: "attach servo on pin %1 as %2 (pulse min %3 max %4 μs)",
  PIBLOCKLY_HW_SERVO_ATTACH_ADVANCED_TOOLTIP: "Attaches a servo with custom pulse widths, allowing for servos beyond the standard 180-degree range. 'min' should be the pulse width for 0 degrees, and 'max' should be the pulse width for the servo's maximum angle (e.g., 270 degrees).",
  PIBLOCKLY_HW_SERVO_WRITE_MESSAGE: "set servo %1 angle to %2",
  PIBLOCKLY_HW_SERVO_WRITE_TOOLTIP: "Commands the servo to a specific angle. The effective range (e.g., 0-180, 0-270) depends on the servo model and the pulse widths defined in the attach block.",  PIBLOCKLY_HW_SERVO_WRITE_MICROS_MESSAGE: "set servo %1 pulse to %2 (μs)",
  PIBLOCKLY_HW_SERVO_WRITE_MICROS_TOOLTIP: "Sets the servo pulse in microseconds (e.g., 1000-2000).",
  PIBLOCKLY_HW_SERVO_READ_MESSAGE: "get angle from servo %1",
  PIBLOCKLY_HW_SERVO_READ_TOOLTIP: "Reads the last angle that was written to the servo.",
  PIBLOCKLY_HW_SERVO_DETACH_MESSAGE: "detach servo %1",
  PIBLOCKLY_HW_SERVO_DETACH_TOOLTIP: "Detaches the servo from its pin to save power and allow it to be turned by hand.",


  // Stepper Blocks
  PIBLOCKLY_HW_ACTUATORS_STEPPER: "Stepper",
  PIBLOCKLY_HW_STEPPER_INIT: "Stepper initial",
  PIBLOCKLY_HW_STEPPER_SET_SPEED: "set speed",
  PIBLOCKLY_HW_STEPPER_SET_SPEED_MESSAGE: "set speed %1",
  PIBLOCKLY_HW_STEPPER_SET_ACCEL: "set acceleration",
  PIBLOCKLY_HW_STEPPER_SET_ACCEL_MESSAGE: "set acceleration %1",
  PIBLOCKLY_HW_STEPPER_MOVE_TO: "move to",
  PIBLOCKLY_HW_STEPPER_MOVE_TO_MESSAGE: "move to %1",
  PIBLOCKLY_HW_STEPPER_MOVE: "move",
  PIBLOCKLY_HW_STEPPER_MOVE_MESSAGE: "move %1 steps",
  PIBLOCKLY_HW_STEPPER_RUN: "run",
  PIBLOCKLY_HW_STEPPER_STOP: "stop",
  PIBLOCKLY_HW_STEPPER_MOTOR_LABEL: "motor",
  PIBLOCKLY_HW_STEPPER_INTERFACE_LABEL: "interface",
  PIBLOCKLY_HW_STEPPER_STEPS_LABEL: "steps",
  PIBLOCKLY_HW_STEPPER_PIN1_LABEL: "pin1",
  PIBLOCKLY_HW_STEPPER_PIN2_LABEL: "pin2",
  PIBLOCKLY_HW_STEPPER_PIN3_LABEL: "pin3",
  PIBLOCKLY_HW_STEPPER_PIN4_LABEL: "pin4",
  PIBLOCKLY_HW_STEPPER_INIT_MESSAGE:
    "Stepper initial %1 %2 %3 steps %4 pin1 %5 pin2 %6 pin3 %7 pin4",

  "PIBLOCKLY_HW_STEPPER_INIT_TOOLTIP": "Initializes the stepper motor, setting motor type, interface type, steps per revolution, and connected pins.",
  "PIBLOCKLY_HW_STEPPER_SET_SPEED_TOOLTIP": "Sets the speed (RPM) of the stepper motor.",
  "PIBLOCKLY_HW_STEPPER_SET_ACCEL_TOOLTIP": "Sets the acceleration of the stepper motor.",
  "PIBLOCKLY_HW_STEPPER_MOVE_TO_TOOLTIP": "Moves the stepper motor to a specified position.",
  "PIBLOCKLY_HW_STEPPER_MOVE_TOOLTIP": "Moves the stepper motor by a specified number of steps.",
  "PIBLOCKLY_HW_STEPPER_RUN_TOOLTIP": "Starts the stepper motor running.",
  "PIBLOCKLY_HW_STEPPER_STOP_TOOLTIP": "Stops the stepper motor.",


  // AI
  // HuskyLens Category
  PIBLOCKLY_HW_CATEGORY_HUSKYLENS: "HuskyLens",

  PIBLOCKLY_HW_HUSKYLENS_SETUP: "Setup",
  PIBLOCKLY_HW_HUSKYLENS_READ: "Read",
  PIBLOCKLY_HW_HUSKYLENS_TRAINING: "AI Training",
  PIBLOCKLY_HW_HUSKYLENS_DISPLAY: "Display",
  PIBLOCKLY_HW_HUSKYLENS_SD: "SD Card",

  // HuskyLens Blocks
  PIBLOCKLY_HW_HUSKYLENS_INIT_TITLE: "HuskyLens I2C Init",
  PIBLOCKLY_HW_HUSKYLENS_INIT_TOOLTIP:
    "Initializes the HuskyLens sensor via I2C. Allows setting I2C pins. Requires 'HUSKYLENS' library by DFRobot.",

  PIBLOCKLY_HW_HUSKYLENS_UART_INIT_TITLE:
    "HuskyLens: Initialize via UART (Serial)",
  PIBLOCKLY_HW_HUSKYLENS_UART_INIT_TOOLTIP:
    "Initializes the HuskyLens sensor via UART (SoftwareSerial). Requires 'HUSKYLENS' library by DFRobot.",
  PIBLOCKLY_HW_HUSKYLENS_UART_INIT_MESSAGE:
    "HuskyLens: Initialize via UART (Serial) RX Pin %1 TX Pin %2",

  PIBLOCKLY_HW_HUSKYLENS_SET_ALGORITHM_TITLE: "Set HuskyLens algorithm to",
  PIBLOCKLY_HW_HUSKYLENS_SET_ALGORITHM_TOOLTIP:
    "Switches the active algorithm on the HuskyLens.",

  PIBLOCKLY_HW_HUSKYLENS_ALGORITHM_FACE_RECOGNITION: "Face Recognition",
  PIBLOCKLY_HW_HUSKYLENS_ALGORITHM_OBJECT_TRACKING: "Object Tracking",
  PIBLOCKLY_HW_HUSKYLENS_ALGORITHM_OBJECT_RECOGNITION: "Object Recognition",
  PIBLOCKLY_HW_HUSKYLENS_ALGORITHM_LINE_TRACKING: "Line Tracking",
  PIBLOCKLY_HW_HUSKYLENS_ALGORITHM_COLOR_RECOGNITION: "Color Recognition",
  PIBLOCKLY_HW_HUSKYLENS_ALGORITHM_TAG_RECOGNITION: "Tag Recognition",

  PIBLOCKLY_HW_HUSKYLENS_REQUEST_AND_CHECK_TITLE: "When HuskyLens has results",
  PIBLOCKLY_HW_HUSKYLENS_REQUEST_AND_CHECK_TOOLTIP:
    "Requests data from HuskyLens and loops through each detected result.",

  PIBLOCKLY_HW_HUSKYLENS_GET_RESULT_PROPERTY_TITLE: "Get",
  PIBLOCKLY_HW_HUSKYLENS_GET_PROPERTY_OF_RESULT: "of current result",
  PIBLOCKLY_HW_HUSKYLENS_GET_RESULT_PROPERTY_TOOLTIP:
    "Gets a specific property of the current result within the loop.",

  PIBLOCKLY_HW_HUSKYLENS_PROPERTY_X_CENTER: "X Center",
  PIBLOCKLY_HW_HUSKYLENS_PROPERTY_Y_CENTER: "Y Center",
  PIBLOCKLY_HW_HUSKYLENS_PROPERTY_WIDTH: "Width",
  PIBLOCKLY_HW_HUSKYLENS_PROPERTY_HEIGHT: "Height",
  PIBLOCKLY_HW_HUSKYLENS_PROPERTY_ID: "ID",
  PIBLOCKLY_HW_HUSKYLENS_PROPERTY_X_ORIGIN: "X Origin",
  PIBLOCKLY_HW_HUSKYLENS_PROPERTY_Y_ORIGIN: "Y Origin",
  PIBLOCKLY_HW_HUSKYLENS_PROPERTY_X_TARGET: "X Target",
  PIBLOCKLY_HW_HUSKYLENS_PROPERTY_Y_TARGET: "Y Target",

  PIBLOCKLY_HW_HUSKYLENS_SHOW_TEXT_TITLE: "HuskyLens: Display text",
  PIBLOCKLY_HW_HUSKYLENS_SHOW_TEXT_X: "at X",
  PIBLOCKLY_HW_HUSKYLENS_SHOW_TEXT_Y: "Y",
  PIBLOCKLY_HW_HUSKYLENS_SHOW_TEXT_TOOLTIP:
    "Display a custom text string on the HuskyLens screen at a specific coordinate.",
  PIBLOCKLY_HW_HUSKYLENS_SHOW_TEXT_MESSAGE:
    "HuskyLens: Display text %1 at X %2 Y %3",

  PIBLOCKLY_HW_HUSKYLENS_CLEAR_SCREEN_TITLE: "HuskyLens: Clear screen text",
  PIBLOCKLY_HW_HUSKYLENS_CLEAR_SCREEN_TOOLTIP:
    "Clears all custom text previously drawn on the HuskyLens screen.",

  PIBLOCKLY_HW_HUSKYLENS_LEARN_TITLE: "HuskyLens: Learn object with ID",
  PIBLOCKLY_HW_HUSKYLENS_LEARN_TOOLTIP:
    "Commands the HuskyLens to learn the current object and assign it the specified ID.",
  PIBLOCKLY_HW_HUSKYLENS_LEARN_MESSAGE: "HuskyLens: Learn object with ID %1",

  PIBLOCKLY_HW_HUSKYLENS_FORGET_TITLE: "HuskyLens: Forget all learned objects",
  PIBLOCKLY_HW_HUSKYLENS_FORGET_TOOLTIP:
    "Commands the HuskyLens to forget all learned objects from all algorithms.",

  PIBLOCKLY_HW_HUSKYLENS_GET_COUNT_TITLE: "HuskyLens: Get count of",
  PIBLOCKLY_HW_HUSKYLENS_COUNT_LEARNED_TOTAL: "Learned IDs (total)",
  PIBLOCKLY_HW_HUSKYLENS_COUNT_BLOCKS_SCREEN: "Blocks on screen",
  PIBLOCKLY_HW_HUSKYLENS_COUNT_ARROWS_SCREEN: "Arrows on screen",
  PIBLOCKLY_HW_HUSKYLENS_GET_COUNT_TOOLTIP:
    "Returns the total number of learned IDs, or the number of blocks/arrows currently detected on screen.",
  PIBLOCKLY_HW_HUSKYLENS_GET_COUNT_MESSAGE: "HuskyLens: Get count of %1",

  PIBLOCKLY_HW_HUSKYLENS_SET_NAME_TITLE: "HuskyLens: Set name",
  PIBLOCKLY_HW_HUSKYLENS_SET_NAME_FOR_ID: "for ID",
  PIBLOCKLY_HW_HUSKYLENS_SET_NAME_TOOLTIP:
    "Assigns a custom name to a specific learned ID.",
  PIBLOCKLY_HW_HUSKYLENS_SET_NAME_MESSAGE: "HuskyLens: Set name %1 for ID %2",

  PIBLOCKLY_HW_HUSKYLENS_SAVE_PHOTO_TITLE:
    "HuskyLens: Save screenshot to SD Card",
  PIBLOCKLY_HW_HUSKYLENS_SAVE_PHOTO_TOOLTIP:
    "Saves the current screen content as a photo to the SD Card.",
  PIBLOCKLY_HW_HUSKYLENS_SAVE_MODEL_TITLE:
    "HuskyLens: Save model to SD Card from slot",
  PIBLOCKLY_HW_HUSKYLENS_SAVE_MODEL_TOOLTIP:
    "Saves the current algorithm's data to the SD card from a specified model slot.",
  PIBLOCKLY_HW_HUSKYLENS_SAVE_MODEL_MESSAGE:
    "HuskyLens: Save model to SD Card from slot %1",

  PIBLOCKLY_HW_HUSKYLENS_LOAD_MODEL_TITLE:
    "HuskyLens: Load model from SD Card to slot",
  PIBLOCKLY_HW_HUSKYLENS_LOAD_MODEL_TOOLTIP:
    "Loads the algorithm's data from the SD card into a specified model slot.",
  PIBLOCKLY_HW_HUSKYLENS_LOAD_MODEL_MESSAGE:
    "HuskyLens: Load model from SD Card to slot %1",
};
