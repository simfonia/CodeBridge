/// CodeBridge Math 模組 - 正體中文訊息（Angel 風格基底）
/// 包含：分類名稱、積木文字、tooltips
/// Engineer 風格覆寫在 style/engineer.js

var MATH_ZH = {
  // 顏色

  // 分類名稱
  MATH_CATEGORY: '數學',

  // 內建積木訊息
  MATH_NUMBER: '%1',
  MATH_ARITHMETIC_HELPURL: '',
  MATH_SINGLE_HELPURL: '',

  // Tooltips
  MATH_NUMBER_TOOLTIP: '一個數字。',
  MATH_ARITHMETIC_TOOLTIP: '傳回兩個數字的運算結果。',
  MATH_SINGLE_TOOLTIP: '傳回一個數字的三角函數、對數或指數值。',
  MATH_ARITHMETIC_TOOLTIP_ADD: '傳回兩個數字的總和。',
  MATH_ARITHMETIC_TOOLTIP_MINUS: '傳回兩個數字的差。',
  MATH_ARITHMETIC_TOOLTIP_MULTIPLY: '傳回兩個數字的乘積。',
  MATH_ARITHMETIC_TOOLTIP_DIVIDE: '傳回兩個數字的商。',
  MATH_ARITHMETIC_TOOLTIP_POWER: '傳回第一個數字的第二個數字次方。',
  MATH_SINGLE_TOOLTIP_ROOT: '傳回一個數字的平方根。',
  MATH_SINGLE_TOOLTIP_ABS: '傳回一個數字的絕對值。',
  MATH_SINGLE_TOOLTIP_NEG: '傳回一個數字的負數。',
  MATH_SINGLE_TOOLTIP_LN: '傳回一個數字的自然對數。',
  MATH_SINGLE_TOOLTIP_LOG10: '傳回一個數字的以 10 為底的對數。',
  MATH_SINGLE_TOOLTIP_EXP: '傳回 e 的指定數次方。',
  MATH_SINGLE_TOOLTIP_POW10: '傳回 10 的指定數次方。',

  // Arduino Math Blocks - Angel
  ARDUINO_CONSTRAIN_MSG: '限制 %1 在 %2 和 %3 之間',
  ARDUINO_MAP_MSG: '將 %1 從 %2 - %3 範圍重新對應到 %4 - %5',
  ARDUINO_MATH_RANDOM_SEED_MSG: '設定隨機種子為 %1',
  ARDUINO_MATH_RANDOM_INT_MSG: '隨機數，介於 %1 和 %2 之間',

  // Tooltips
  ARDUINO_CONSTRAIN_TOOLTIP: '將一個數字限制在一個範圍內。參數：(要限制的值, 範圍下限, 範圍上限)。',
  ARDUINO_MAP_TOOLTIP: '將一個數字從一個範圍重新對應到另一個範圍。參數：(要對應的值, 原始範圍下限, 原始範圍上限, 目標範圍下限, 目標範圍上限)。',
  ARDUINO_MATH_RANDOM_SEED_TOOLTIP: '初始化偽亂數生成器。建議使用一個未連接的類比腳位作為種子。',
  ARDUINO_MATH_RANDOM_INT_TOOLTIP: '產生一個介於 min (包含) 和 max (不包含) 之間的偽亂數。',
};
