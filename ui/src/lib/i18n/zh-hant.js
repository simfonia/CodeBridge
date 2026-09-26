/// CodeBridge UI 翻譯 - 正體中文
/// 僅包含工具列、選單、對話框等 UI 文字
/// 積木文字、分類名稱、顏色、tooltips 屬於 blockly/messages/

var UI_ZH_HANT = {
    // 工具列
    TLB_FILE_NEW: '未命名專案',
    TLB_NEW: '新專案',
    TLB_OPEN: '開啟',
    TLB_SAVE: '儲存',
    TLB_SAVE_AS: '另存為',
    TLB_SETTINGS: '設定',
    TLB_DIAGNOSE: '環境診斷',
    TLB_SERIAL_REFRESH: '重新整理序列埠',
    TLB_SERIAL_PORT: '序列埠',
    TLB_NO_PORT: '未偵測到序列埠',
    TLB_RUN: '執行',
    TLB_STOP_PROGRAM: '停止程式',
    TLB_TERMINAL: '終端機',
    TLB_TERMINAL_TITLE: '序列監視器',
    TLB_PAUSE_SCROLL: '暫停捲動',
    TLB_CLEAR_CONSOLE: '清除主控台',
    TLB_CLOSE_PANEL: '關閉面板',
    TLB_TOGGLE_CODE: '切換程式碼',
    TLB_ARDUINO_PREVIEW: 'Arduino 程式碼預覽',
    TLB_DRAG_RESIZE: '拖曳調整大小',
    TLB_COPY_CODE: '複製程式碼',
    TLB_EXAMPLES: '範例',
    TLB_THEME_TOGGLE: '切換體驗風格（Engineer／Angel）',
    TLB_LANG_TOGGLE: '切換語系 (中文/English)',
    TLB_BLOCK_SEARCH: '搜尋積木',
    TLB_BLOCK_SEARCH_PLACEHOLDER: '搜尋積木...',
    TLB_BLOCK_SEARCH_CLEAR: '清除積木搜尋',
    TLB_BLOCK_SEARCH_NO_RESULTS: '找不到符合的積木',
    
    // Arduino CLI 工具鏈（B 方案：外部依賴 + 自動引導安裝）
    CLI_PANEL_TITLE: 'Arduino CLI 工具鏈',
    CLI_DETECTING: '正在偵測 Arduino CLI…',
    CLI_FOUND: '已偵測到 Arduino CLI',
    CLI_NOT_FOUND: '尚未安裝 Arduino CLI',
    CLI_NOT_FOUND_HINT: '安裝 Arduino CLI 後即可編譯與上傳程式。',
    CLI_INSTALL_COMMAND: '安裝指令',
    CLI_DOWNLOAD_PAGE: '下載說明',
    CLI_VERSION: '版本',
    CLI_PATH: '執行檔路徑',
    CLI_CONFIG_DIR: '設定目錄',
    CLI_DATA_DIR: '資料目錄',
    CLI_USER_DIR: '使用者目錄',
    CLI_SET_CUSTOM_PATH: '指定執行檔路徑',
    CLI_CLEAR_CUSTOM_PATH: '改用系統 PATH',
    CLI_SOURCE_USER_CONFIGURED: '使用者指定',
    CLI_SOURCE_SYSTEM_PATH: '系統 PATH',
    CLI_ERROR_CONFIGURED_PATH_MISSING: '指定的 Arduino CLI 路徑不存在',
    CLI_ERROR_NOT_FOUND: '找不到 Arduino CLI，請先安裝',
    CLI_ERROR_SPAWN_FAILED: '無法啟動 Arduino CLI',
    CLI_ERROR_COMMAND_FAILED: 'Arduino CLI 執行失敗',
    CLI_ERROR_INVALID_JSON: '無法解析 Arduino CLI 回應',
    
    // 編譯診斷
    CLI_DIAGNOSTIC_ERROR: '錯誤',
    CLI_DIAGNOSTIC_WARNING: '警告',
    CLI_DIAGNOSTIC_NOTE: '提示',
    
    // 長作業
    CLI_OPERATION_COMPILE: '編譯',
    CLI_OPERATION_UPLOAD: '上傳',
    CLI_OPERATION_CORE_INSTALL: '安裝開發板核心',
    CLI_OPERATION_CORE_UPDATE_INDEX: '更新核心索引',
    CLI_OPERATION_LIBRARY_INSTALL: '安裝函式庫',
    CLI_OPERATION_CANCEL: '取消',
    CLI_OPERATION_RUNNING: '執行中…',
    CLI_OPERATION_SUCCEEDED: '完成',
    CLI_OPERATION_FAILED: '失敗',
    CLI_OPERATION_CANCELLED: '已取消',
    CLI_OPERATION_TIMED_OUT: '逾時',
    
    // 尚未實作的階段
    SERIAL_MONITOR_NOT_IMPLEMENTED: '序列監視器將於後續階段提供',
    COMPILE_NOT_IMPLEMENTED: '編譯功能將於後續階段提供',
    
    // 練習模式
    PRACTICE_ENTER: '✍️ 練習',
    PRACTICE_EXIT: '❌ 退出練習',
    PRACTICE_TITLE: '✍️ 程式碼撰寫練習',
    PRACTICE_HINT: '💡 按 F2 顯示提示 | Enter 檢查 | Esc 退出',
    PRACTICE_PLACEHOLDER: '在這裡手寫程式碼...',
    PRACTICE_HINT_TITLE: '💡 提示',
    PRACTICE_CHEAT: '查看完整答案',
    PRACTICE_CHEAT_CLOSE: '關閉完整答案',
    PRACTICE_ANSWER_TITLE: '📄 完整答案',
    PRACTICE_READONLY_HINT: '請先退出練習模式才能編輯積木',
    PRACTICE_COMPLETE: '🎉 完成！你已經正確寫完所有程式碼！',
    
    // 訊息
    MSG_SAVE: '儲存',
    MSG_DONT_SAVE: '不儲存',
    MSG_CANCEL: '取消',
    MSG_CLOSE: '關閉'
};