/// CodeBridge 工具箱定義
/// 對齊 piBlockly 的分類結構與顏色配置
/// 使用 Blockly v12 的 toolbox JSON 格式

export function getToolboxConfig(): any {
  return {
    kind: 'categoryToolbox',
    contents: [
      // ============================================================
      // Arduino 主分類
      // ============================================================
      {
        kind: 'category',
        name: '%{BKY_ARDUINO_CATEGORY}',
        colour: '%{BKY_ARDUINO_CONTROL_HUE}',
        contents: [
          // --- 結構 ---
          {
            kind: 'category',
            name: '%{BKY_ARDUINO_STRUCTURE_CATEGORY}',
            colour: '%{BKY_ARDUINO_STRUCTURE_HUE}',
            contents: [
              { kind: 'block', type: 'initializes_setup' },
              { kind: 'block', type: 'initializes_loop' },
            ],
          },
          // --- I/O ---
          {
            kind: 'category',
            name: '%{BKY_ARDUINO_IO_CATEGORY}',
            colour: '%{BKY_ARDUINO_CONTROL_HUE}',
            contents: [
              {
                kind: 'block', type: 'arduino_pin_mode',
                values: {
                  PIN: { kind: 'shadow', type: 'arduino_pin_shadow', fields: { PIN: '' } },
                },
              },
              {
                kind: 'block', type: 'arduino_digital_read',
                values: {
                  PIN: { kind: 'shadow', type: 'arduino_pin_shadow', fields: { PIN: '' } },
                },
              },
              {
                kind: 'block', type: 'arduino_digital_write',
                values: {
                  PIN: { kind: 'shadow', type: 'arduino_pin_shadow', fields: { PIN: '' } },
                },
              },
              {
                kind: 'block', type: 'arduino_analog_read',
                values: {
                  PIN: { kind: 'shadow', type: 'arduino_pin_shadow', fields: { PIN: 'A0' } },
                },
              },
              {
                kind: 'block', type: 'arduino_analog_write',
                values: {
                  PIN: { kind: 'shadow', type: 'arduino_pin_shadow', fields: { PIN: '~' } },
                  VALUE: { kind: 'shadow', type: 'math_number', fields: { NUM: 0 } },
                },
              },
            ],
          },
          // --- 時間 ---
          {
            kind: 'category',
            name: '%{BKY_ARDUINO_TIME_CATEGORY}',
            colour: '%{BKY_ARDUINO_TIME_HUE}',
            contents: [
              {
                kind: 'block', type: 'arduino_delay',
                values: {
                  TIME: { kind: 'shadow', type: 'math_number', fields: { NUM: 1000 } },
                },
              },
              {
                kind: 'block', type: 'arduino_delay_microseconds',
                values: {
                  TIME: { kind: 'shadow', type: 'math_number', fields: { NUM: 1000 } },
                },
              },
              { kind: 'block', type: 'arduino_millis' },
              { kind: 'block', type: 'arduino_micros' },
            ],
          },
          // --- 序列埠 ---
          {
            kind: 'category',
            name: '%{BKY_ARDUINO_SERIAL_CATEGORY}',
            colour: '%{BKY_ARDUINO_SERIAL_HUE}',
            contents: [
              { kind: 'block', type: 'arduino_serial_begin' },
              {
                kind: 'block', type: 'arduino_serial_print',
                values: {
                  VALUE: { kind: 'shadow', type: 'text', fields: { TEXT: 'Hello, World!' } },
                },
              },
              {
                kind: 'block', type: 'arduino_serial_println',
                values: {
                  VALUE: { kind: 'shadow', type: 'text', fields: { TEXT: 'Hello, World!' } },
                },
              },
              { kind: 'block', type: 'arduino_serial_available' },
              { kind: 'block', type: 'arduino_serial_read' },
            ],
          },
        ],
      },

      // ============================================================
      // Coding 分類
      // ============================================================
      {
        kind: 'category',
        name: '%{BKY_CODING_CATEGORY}',
        colour: '%{BKY_CODING_HUE}',
        contents: [
          { kind: 'block', type: 'coding_comment' },
          { kind: 'block', type: 'coding_include' },
          { kind: 'block', type: 'coding_raw_statement' },
          { kind: 'block', type: 'coding_raw_input' },
          { kind: 'block', type: 'coding_raw_definition' },
          { kind: 'block', type: 'coding_raw_wrapper' },
        ],
      },

      // ============================================================
      // 分隔線
      // ============================================================
      { kind: 'sep' },

      // ============================================================
      // 邏輯
      // ============================================================
      {
        kind: 'category',
        name: '%{BKY_LOGIC_CATEGORY}',
        colour: '%{BKY_LOGIC_HUE}',
        contents: [
          { kind: 'block', type: 'controls_if' },
          { kind: 'block', type: 'logic_compare' },
          { kind: 'block', type: 'logic_operation' },
          { kind: 'block', type: 'logic_negate' },
          { kind: 'block', type: 'logic_boolean' },
        ],
      },

      // ============================================================
      // 迴圈
      // ============================================================
      {
        kind: 'category',
        name: '%{BKY_LOOPS_CATEGORY}',
        colour: '%{BKY_LOOPS_HUE}',
        contents: [
          { kind: 'block', type: 'controls_while' },
          {
            kind: 'block', type: 'controls_for',
            values: {
              FROM: { kind: 'shadow', type: 'math_number', fields: { NUM: 1 } },
              TO: { kind: 'shadow', type: 'math_number', fields: { NUM: 10 } },
              BY: { kind: 'shadow', type: 'math_number', fields: { NUM: 1 } },
            },
          },
          { kind: 'block', type: 'controls_flow_statements' },
        ],
      },

      // ============================================================
      // 數學
      // ============================================================
      {
        kind: 'category',
        name: '%{BKY_MATH_CATEGORY}',
        colour: '%{BKY_MATH_HUE}',
        contents: [
          { kind: 'block', type: 'math_number' },
          { kind: 'block', type: 'math_arithmetic' },
          { kind: 'block', type: 'math_single' },
          {
            kind: 'block', type: 'arduino_constrain',
            values: {
              LOW: { kind: 'shadow', type: 'math_number', fields: { NUM: 0 } },
              HIGH: { kind: 'shadow', type: 'math_number', fields: { NUM: 255 } },
            },
          },
          {
            kind: 'block', type: 'arduino_map',
            values: {
              FROMLOW: { kind: 'shadow', type: 'math_number', fields: { NUM: 0 } },
              FROMHIGH: { kind: 'shadow', type: 'math_number', fields: { NUM: 1023 } },
              TOLOW: { kind: 'shadow', type: 'math_number', fields: { NUM: 0 } },
              TOHIGH: { kind: 'shadow', type: 'math_number', fields: { NUM: 255 } },
            },
          },
          {
            kind: 'block', type: 'arduino_math_random_seed',
            values: {
              SEED: {
                kind: 'shadow', type: 'arduino_analog_read',
                values: {
                  PIN: { kind: 'shadow', type: 'arduino_pin_shadow', fields: { PIN: 'A0' } },
                },
              },
            },
          },
          {
            kind: 'block', type: 'arduino_math_random_int',
            values: {
              MIN: { kind: 'shadow', type: 'math_number', fields: { NUM: 0 } },
              MAX: { kind: 'shadow', type: 'math_number', fields: { NUM: 100 } },
            },
          },
        ],
      },

      // ============================================================
      // 文字
      // ============================================================
      {
        kind: 'category',
        name: '%{BKY_TEXT_CATEGORY}',
        colour: '%{BKY_TEXT_HUE}',
        contents: [
          { kind: 'block', type: 'text' },
          { kind: 'block', type: 'text_join' },
          {
            kind: 'block', type: 'text_append',
            values: {
              TEXT: { kind: 'shadow', type: 'text' },
            },
          },
          { kind: 'block', type: 'text_length' },
        ],
      },

      // ============================================================
      // 分隔線
      // ============================================================
      { kind: 'sep' },

      // ============================================================
      // 變數
      // ============================================================
      {
        kind: 'category',
        name: '%{BKY_VARIABLES_CATEGORY}',
        colour: '%{BKY_VARIABLES_HUE}',
        custom: 'VARIABLE',
      },

      // ============================================================
      // 陣列
      // ============================================================
      {
        kind: 'category',
        name: '%{BKY_ARRAY_CATEGORY}',
        colour: '%{BKY_ARRAY_HUE}',
        contents: [
          {
            kind: 'block', type: 'array_declare_global',
            values: {
              SIZE: { kind: 'shadow', type: 'math_number', fields: { NUM: 10 } },
            },
          },
          {
            kind: 'block', type: 'array_declare_local',
            values: {
              SIZE: { kind: 'shadow', type: 'math_number', fields: { NUM: 10 } },
            },
          },
          {
            kind: 'block', type: 'array_get',
            values: {
              INDEX: { kind: 'shadow', type: 'math_number', fields: { NUM: 0 } },
            },
          },
          {
            kind: 'block', type: 'array_set',
            values: {
              INDEX: { kind: 'shadow', type: 'math_number', fields: { NUM: 0 } },
            },
          },
          { kind: 'block', type: 'array_length' },
        ],
      },

      // ============================================================
      // 函式
      // ============================================================
      {
        kind: 'category',
        name: '%{BKY_FUNCTIONS_CATEGORY}',
        colour: '%{BKY_FUNCTIONS_HUE}',
        contents: [
          { kind: 'block', type: 'custom_functions_defnoreturn' },
          { kind: 'block', type: 'custom_functions_defreturn' },
          { kind: 'block', type: 'custom_functions_return' },
          { kind: 'block', type: 'custom_functions_callnoreturn_manual' },
          { kind: 'block', type: 'custom_functions_callreturn_manual' },
        ],
      },
    ],
  };
}