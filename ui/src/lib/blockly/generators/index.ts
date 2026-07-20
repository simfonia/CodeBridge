/// CodeBridge 產生器匯入
/// 載入所有內建模組的產生器

import './pin';
import './core';
import './serial';

export function registerAllGenerators(): void {
  // 所有產生器已透過 Blockly.Arduino.forBlock 註冊
  console.log('[CodeBridge] All built-in generators registered.');
}