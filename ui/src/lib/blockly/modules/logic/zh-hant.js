/// CodeBridge Logic 模組 - 繁體中文訊息（Angel 風格基底）
/// 包含：分類名稱、積木文字、tooltips
/// Engineer 風格覆寫在 style/engineer.js
///
/// 注意：controls_if 為 Blockly 核心積木，其 i18n key 由內建定義。
/// 不可在此設定 CONTROLS_IF_MSG_IF/ELSEIF/ELSE/THEN 等，否則會與內建佔位符衝突。
/// 僅 engineer.js 可安全覆寫這些 key。

var LOGIC_ZH = {
  // 顏色
  LOGIC_HUE: '#b198de',
  LOGIC_COMPARE_HUE: '#b198de',
  LOGIC_OPERATION_HUE: '#b198de',
  LOGIC_BOOLEAN_HUE: '#b198de',

  // 分類名稱
  LOGIC_CATEGORY: '邏輯',

  // controls_if tooltips（訊息不包含 % 佔位符，安全）
  CONTROLS_IF_IF_TOOLTIP: '新增、移除或重新排列區段，以重新配置此 if 積木。',
  CONTROLS_IF_ELSEIF_TOOLTIP: '為「如果」積木添加一個「否則如果」條件。',
  CONTROLS_IF_ELSE_TOOLTIP: '為「如果」積木添加一個「否則」條件。',
  CONTROLS_IF_TOOLTIP_1: '如果一個值為真，則執行一些語句。',
  CONTROLS_IF_TOOLTIP_2: '如果一個值為真，則執行第一塊語句。否則，執行第二塊語句。',
  CONTROLS_IF_TOOLTIP_3: '如果第一個值為真，則執行第一塊語句。否則，如果第二個值為真，則執行第二塊語句。',
  CONTROLS_IF_TOOLTIP_4: '如果第一個值為真，則執行第一塊語句。否則，如果第二個值為真，則執行第二塊語句。如果所有值都為假，則執行最後一塊語句。',

  // logic_compare
  LOGIC_COMPARE_LABEL: '%1 %2 %3',
  LOGIC_COMPARE_TOOLTIP: '比較兩個值。',
  LOGIC_COMPARE_HELPURL: '',

  // logic_operation（Angel 風格）
  LOGIC_OPERATION_LABEL: '%1 %2 %3',
  LOGIC_OPERATION_AND: '且',
  LOGIC_OPERATION_OR: '或',
  LOGIC_OPERATION_TOOLTIP: '返回兩個條件的邏輯運算結果。',
  LOGIC_OPERATION_HELPURL: '',

  // logic_negate（Angel 風格）
  LOGIC_NEGATE_LABEL: '非 %1',
  LOGIC_NEGATE_TOOLTIP: '如果輸入為假，則傳回真；如果輸入為真，則傳回假。',

  // logic_boolean（Angel 風格）
  LOGIC_BOOLEAN_TRUE: '真',
  LOGIC_BOOLEAN_FALSE: '假',
  LOGIC_BOOLEAN_TOOLTIP: '傳回「真」或「假」。',
};