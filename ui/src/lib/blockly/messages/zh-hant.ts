/// CodeBridge 積木訊息 - 繁體中文
/// 所有積木的自然語言文字（Angel 風格基底）
/// 色碼對齊 piBlockly: ARDUINO=#016c8d, STRUCTURE=#585858, DIGITAL_IO=#0f960a, ANALOG_IO=#FF9800, TIME=#1f039b, SERIAL=#359AFF

export const ZH_HANT_MESSAGES: Record<string, string> = {
  // ============================================================
  // 顏色定義（對齊 piBlockly）
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
  // 工具箱分類名稱
  // ============================================================
  'ARDUINO_CATEGORY': 'Arduino',
  'ARDUINO_STRUCTURE_CATEGORY': '結構',
  'ARDUINO_IO_CATEGORY': '輸入/輸出',
  'ARDUINO_TIME_CATEGORY': '時間',
  'ARDUINO_SERIAL_CATEGORY': '序列埠',
  'CODING_CATEGORY': '程式碼',
  'LOGIC_CATEGORY': '邏輯',
  'LOOPS_CATEGORY': '迴圈',
  'MATH_CATEGORY': '數學',
  'TEXT_CATEGORY': '文字',
  'VARIABLES_CATEGORY': '變數',
  'ARRAY_CATEGORY': '陣列',
  'FUNCTIONS_CATEGORY': '函式',

  // ============================================================
  // 影子積木
  // ============================================================
  'ARDUINO_PIN_LABEL': '腳位',

  // ============================================================
  // Arduino 核心積木
  // ============================================================
  'ARDUINO_PIN_MODE': '設定腳位 %1 為 %2',
  'ARDUINO_DIGITAL_WRITE': '數位寫入腳位 %1 狀態 %2',
  'ARDUINO_DIGITAL_READ': '數位讀取腳位 %1',
  'ARDUINO_ANALOG_WRITE': '類比寫入腳位 %1 值 %2',
  'ARDUINO_ANALOG_READ': '類比讀取腳位 %1',
  'ARDUINO_DELAY': '延遲 %1 毫秒',
  'ARDUINO_DELAY_MICROSECONDS': '延遲 %1 微秒',
  'ARDUINO_MILLIS': '取得開機毫秒數',
  'ARDUINO_MICROS': '取得開機微秒數',

  // === Dropdown 選項 ===
  'ARDUINO_PIN_MODE_OUTPUT': '輸出',
  'ARDUINO_PIN_MODE_INPUT': '輸入',
  'ARDUINO_PIN_MODE_INPUT_PULLUP': '輸入拉高',
  'ARDUINO_DIGITAL_HIGH': '高',
  'ARDUINO_DIGITAL_LOW': '低',

  // === Tooltips ===
  'ARDUINO_PIN_MODE_TOOLTIP': '設定指定腳位為輸入或輸出模式。',
  'ARDUINO_DIGITAL_WRITE_TOOLTIP': '設定指定腳位為高電位 (HIGH) 或低電位 (LOW)。',
  'ARDUINO_DIGITAL_READ_TOOLTIP': '讀取指定腳位的數位狀態（HIGH 或 LOW）。',
  'ARDUINO_ANALOG_WRITE_TOOLTIP': '在指定腳位上輸出 PWM 類比數值（0-255）。',
  'ARDUINO_ANALOG_READ_TOOLTIP': '讀取指定類比腳位的電壓值（0-1023）。',
  'ARDUINO_DELAY_TOOLTIP': '暫停程式執行指定的毫秒數。1000 毫秒 = 1 秒。',
  'ARDUINO_DELAY_MICROSECONDS_TOOLTIP': '暫停程式執行指定的微秒數。1000 微秒 = 1 毫秒。',
  'ARDUINO_MILLIS_TOOLTIP': '回傳 Arduino 開發板啟動以來的毫秒數。',
  'ARDUINO_MICROS_TOOLTIP': '回傳 Arduino 開發板啟動以來的微秒數。',

  // ============================================================
  // 序列通訊積木
  // ============================================================
  'ARDUINO_SERIAL_BEGIN': '序列埠初始化 鮑率 %1',
  'ARDUINO_SERIAL_PRINT': '序列輸出 %1',
  'ARDUINO_SERIAL_PRINTLN': '序列輸出換行 %1',
  'ARDUINO_SERIAL_AVAILABLE': '序列埠可讀取位元組數',
  'ARDUINO_SERIAL_READ': '序列埠讀取一個位元組',
  'ARDUINO_SERIAL_PRINT_NEWLINE': '序列輸出空一行',

  // === Tooltips ===
  'ARDUINO_SERIAL_BEGIN_TOOLTIP': '初始化序列通訊並設定傳輸速率（鮑率）。常見值：9600。',
  'ARDUINO_SERIAL_PRINT_TOOLTIP': '透過序列埠輸出資料（不換行）。',
  'ARDUINO_SERIAL_PRINTLN_TOOLTIP': '透過序列埠輸出資料並換行。',
  'ARDUINO_SERIAL_AVAILABLE_TOOLTIP': '取得序列埠緩衝區中可讀取的位元組數。',
  'ARDUINO_SERIAL_READ_TOOLTIP': '讀取序列埠的第一個可用的位元組（-1 表示無資料）。',

  // ============================================================
  // 結構積木
  // ============================================================
  'INITIALIZES_SETUP_APPENDTEXT': 'void setup()',
  'INITIALIZES_LOOP_APPENDTEXT': 'void loop()',
  'INITIALIZES_SETUP_TOOLTIP': 'Arduino 的 setup() 函式。此處的程式碼只在開發板啟動時執行一次。',
  'INITIALIZES_LOOP_TOOLTIP': 'Arduino 的 loop() 函式。此處的程式碼會不斷重複執行。',

  // ============================================================
  // 邏輯積木
  // ============================================================
  'CONTROLS_IF_MSG_IF': '如果',
  'CONTROLS_IF_MSG_THEN': '則',
  'CONTROLS_IF_MSG_ELSEIF': '否則如果',
  'CONTROLS_IF_MSG_ELSE': '否則',
  'CONTROLS_IF_TOOLTIP': '如果條件成立則執行指定的程式碼。',
  'LOGIC_COMPARE_MESSAGE': '%1 %2 %3',
  'LOGIC_OPERATION_MESSAGE': '%1 %2 %3',
  'LOGIC_NEGATE_MESSAGE': '不成立 (%1)',
  'LOGIC_OPERATION_AND': '且',
  'LOGIC_OPERATION_OR': '或',
  'LOGIC_BOOLEAN_TRUE': '真',
  'LOGIC_BOOLEAN_FALSE': '假',
  'LOGIC_COMPARE_EQ': '=',
  'LOGIC_COMPARE_NEQ': '≠',
  'LOGIC_COMPARE_LT': '<',
  'LOGIC_COMPARE_LTE': '≤',
  'LOGIC_COMPARE_GT': '>',
  'LOGIC_COMPARE_GTE': '≥',

  // ============================================================
  // 迴圈積木
  // ============================================================
  'CONTROLS_FOR_MESSAGE': '用 %1 從 %2 到 %3 每次 %4',
  'CONTROLS_FOR_TOOLTIP': '讓變數從起始值到結束值遞增，每次執行指定的程式碼。',
  'CONTROLS_WHILE_MESSAGE': '當 %1 成立時',
  'CONTROLS_WHILE_TOOLTIP': '當條件成立時，重複執行指定的程式碼。',
  'CONTROLS_FLOW_STATEMENTS_MESSAGE': '跳出迴圈',
  'CONTROLS_FLOW_STATEMENTS_TOOLTIP': '跳出當前的迴圈。',
  'CONTROLS_REPEAT_MESSAGE': '重複 %1 次',
  'CONTROLS_REPEAT_TOOLTIP': '重複執行指定的程式碼若干次。',

  // ============================================================
  // 數學積木
  // ============================================================
  'ARDUINO_CONSTRAIN': '限制 %1 在 %2 到 %3 之間',
  'ARDUINO_MAP': '映射 %1 從 %2~%3 到 %4~%5',
  'ARDUINO_MATH_RANDOM_SEED': '設定亂數種子為 %1',
  'ARDUINO_MATH_RANDOM_INT': '隨機整數 %1 到 %2',
  'MATH_NUMBER': '數值 %1',
  'MATH_ARITHMETIC': '%1 %2 %3',
  'MATH_SINGLE': '%1 %2',
  'MATH_TRIG': '%1 %2',
  'MATH_ONLIST': '%1 %2',
  'MATH_MODULO': '%1 除以 %2 的餘數',
  'MATH_CHANGE': '將 %1 增加 %2',
  'MATH_CONSTRAIN_TOOLTIP': '將數值限制在指定的範圍內（包含邊界）。',
  'MATH_MAP_TOOLTIP': '將數值從一個範圍映射到另一個範圍。',
  'MATH_RANDOM_SEED_TOOLTIP': '設定亂數產生器的種子值，使亂數序列可重現。',
  'MATH_RANDOM_INT_TOOLTIP': '回傳一個在指定範圍內的隨機整數（包含邊界）。',

  // ============================================================
  // 文字積木
  // ============================================================
  'TEXT_STRING': '字串 %1',
  'TEXT_STRING_TOOLTIP': '輸入一段文字。',
  'TEXT_LENGTH': '字串 %1 的長度',
  'TEXT_LENGTH_TOOLTIP': '計算字串中的字元數（包含空格）。',
  'TEXT_ISEMPTY': '字串 %1 是否為空',
  'TEXT_ISEMPTY_TOOLTIP': '檢查字串是否為空字串。',
  'TEXT_INDEXOF': '在 %1 中尋找 %2 的第 %3 個',
  'TEXT_INDEXOF_TOOLTIP': '在字串中尋找指定文字的位置。',
  'TEXT_CHARAT': '字串 %1 的第 %2 個字元',
  'TEXT_CHARAT_TOOLTIP': '取得字串中指定位置的字元。',
  'TEXT_SUBSTRING': '字串 %1 的第 %2 到 %3',
  'TEXT_SUBSTRING_TOOLTIP': '取得字串中指定範圍的子字串。',
  'TEXT_APPEND': '將 %2 附加到 %1',
  'TEXT_APPEND_TOOLTIP': '將文字附加到變數的末尾。',
  'TEXT_JOIN': '連接 %1',
  'TEXT_JOIN_TOOLTIP': '將多段文字連接成一個字串。',

  // ============================================================
  // 變數積木
  // ============================================================
  'VARIABLES_SET': '設定 %1 為 %2',
  'VARIABLES_SET_TOOLTIP': '將變數設定為指定的值。',
  'VARIABLES_GET': '變數 %1',
  'VARIABLES_GET_TOOLTIP': '取得變數的值。',

  // ============================================================
  // Coding 積木（對齊 piBlockly）
  // ============================================================
  'CODING_COMMENT_MESSAGE': '註解 %1',
  'CODING_INCLUDE_MESSAGE': '引用函式庫 %1',
  'CODING_RAW_STATEMENT_MESSAGE': '原始程式碼 %1',
  'CODING_RAW_INPUT_MESSAGE': '原始運算式 %1',
  'CODING_RAW_DEFINITION_MESSAGE': '原始定義 %1',
  'CODING_RAW_WRAPPER_TOP_MESSAGE': '原始包裝（頂部）%1',
  'CODING_RAW_WRAPPER_BOTTOM_MESSAGE': '原始包裝（底部）%1',
};