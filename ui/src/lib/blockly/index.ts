/// CodeBridge Blockly 主入口
/// 統整初始化：積木定義、產生器、訊息、主題、工具箱、模組載入

import { registerAllBlocks } from './blocks/index';
import { registerAllGenerators } from './generators/index';
import { initBlockMessages, setBlockStyle } from './messages/index';
import type { BlockStyle, BlockLocale } from './messages/index';
import { getDefaultTheme } from './theme/index';
import { getToolboxConfig } from './toolbox/index';

export type { BlockStyle, BlockLocale } from './messages/index';
export { setBlockStyle, initBlockMessages } from './messages/index';

/**
 * 初始化 CodeBridge Blockly 系統
 * 
 * 流程：
 * 1. 註冊所有內建模組的積木定義
 * 2. 註冊所有內建模組的產生器
 * 3. 初始化積木訊息（語系 + 風格）
 * 4. 回傳主題與工具箱配置
 * 
 * @param locale 語系（預設 'zh-hant'）
 * @param style 風格（預設 'angel'）
 * @returns { theme, toolbox } 供 Blockly.inject() 使用
 */
export function initCodeBridgeBlockly(
  locale: BlockLocale = 'zh-hant',
  style: BlockStyle = 'angel'
): { theme: any; toolbox: any } {
  // 1. 註冊積木
  registerAllBlocks();

  // 2. 註冊產生器
  registerAllGenerators();

  // 3. 初始化訊息
  initBlockMessages(locale, style);

  // 4. 回配置
  return {
    theme: getDefaultTheme(),
    toolbox: getToolboxConfig(),
  };
}