/// CodeBridge 風格切換邏輯
/// 提供 setBlockStyle() 函式，支援 Angel / Engineer 風格即時切換

import { ENGINEER_STYLE } from './engineer';
import { ZH_HANT_MESSAGES } from '../zh-hant';
import { EN_MESSAGES } from '../en';

export type BlockStyle = 'angel' | 'engineer';
export type BlockLocale = 'zh-hant' | 'en';

/**
 * 取得指定語系的基底訊息
 */
function getLocaleMessages(locale: BlockLocale): Record<string, string> {
  return locale === 'zh-hant' ? ZH_HANT_MESSAGES : EN_MESSAGES;
}

/**
 * 套用積木風格
 * 
 * 流程：
 * 1. 載入語系基底訊息（Angel 風格 = 自然語言）
 * 2. 如果是 Engineer 風格，疊加 C++ 語法覆寫
 * 3. 更新 Blockly.Msg
 * 4. 觸發工作區重新渲染（不需重載）
 * 
 * @param style 風格 ('angel' | 'engineer')
 * @param locale 語系 ('zh-hant' | 'en')
 * @param workspace Blockly 工作區實例（可選）
 */
export function setBlockStyle(
  style: BlockStyle,
  locale: BlockLocale,
  workspace?: any
): void {
  // 1. 載入語系基底訊息
  const localeMessages = getLocaleMessages(locale);
  Object.assign(Blockly.Msg, localeMessages);

  // 2. 如果是 Engineer 風格，疊加覆寫
  if (style === 'engineer') {
    Object.assign(Blockly.Msg, ENGINEER_STYLE);
  }

  // 3. 觸發工作區重新渲染
  if (workspace) {
    try {
      workspace.refreshToolboxSelection_();
      // 觸發所有積木重新渲染
      Blockly.Events.fire(new (Blockly.Events.getEventClass_('ui'))(null, 'themeChange'));
    } catch (e) {
      console.warn('Failed to refresh workspace after style change:', e);
    }
  }
}

/**
 * 初始化積木訊息（首次載入時呼叫）
 * 將所有訊息鍵加上 'BKY_' 前綴以符合 Blockly 的 %{BKY_...} 佔位符規範
 */
export function initBlockMessages(
  locale: BlockLocale,
  style: BlockStyle = 'angel'
): void {
  const localeMessages = getLocaleMessages(locale);
  
  // 將所有訊息以 BKY_ 前綴註冊到 Blockly.Msg
  for (const [key, value] of Object.entries(localeMessages)) {
    Blockly.Msg[`BKY_${key}`] = value;
  }

  // 如果是 Engineer 風格，疊加覆寫
  if (style === 'engineer') {
    for (const [key, value] of Object.entries(ENGINEER_STYLE)) {
      Blockly.Msg[`BKY_${key}`] = value;
    }
  }
}