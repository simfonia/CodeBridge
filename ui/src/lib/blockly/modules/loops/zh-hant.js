/// CodeBridge Loops 模組 - 繁體中文訊息（Angel 風格基底）
/// 包含：分類名稱、積木文字、tooltips
/// Engineer 風格覆寫在 style/engineer.js
///
/// 注意：controls_while / controls_for / controls_flow_statements 為自訂積木，
/// 使用 %{BKY_...} 佔位符對應此處的 key。

var LOOPS_ZH = {
  // 顏色
  LOOPS_HUE: '#7fcd81',

  // 分類名稱
  LOOPS_CATEGORY: '迴圈',

  // controls_while
  CONTROLS_WHILE_MESSAGE: '當 %1',
  CONTROLS_WHILE_TOOLTIP: '當條件為真時，重複執行一些語句。',

  // controls_for
  CONTROLS_FOR_MESSAGE: '計數，變數%1 = %2 ; %3%4%5 ; 每次變動(%6%7 %8) ',
  CONTROLS_FOR_TOOLTIP: '讓變數從開始值到結束值，按照指定的間隔計數，並執行指定的積木。',

  // controls_flow_statements
  CONTROLS_FLOW_STATEMENTS_MESSAGE: '%1 迴圈',
  CONTROLS_FLOW_STATEMENTS_TOOLTIP: '跳出(break)一層迴圈或繼續(continue)下一次迭代。',
};
