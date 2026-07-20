/// CodeBridge 積木定義匯入
/// 載入所有內建模組的積木定義

import './pin';
import './core';
import './serial';

export function registerAllBlocks(): void {
  // 所有積木已透過 Blockly.Blocks 註冊
  console.log('[CodeBridge] All built-in blocks registered.');
}