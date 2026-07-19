/// CodeBridge 前端主入口
/// 負責初始化 Blockly 編輯器和 Tauri 整合

import { invoke } from '@tauri-apps/api/core';

// 初始化應用程式
async function init() {
    console.log('CodeBridge initializing...');
    
    // 取得版本資訊
    try {
        const version = await invoke<string>('get_version');
        console.log(`CodeBridge version: ${version}`);
    } catch (error) {
        console.error('Failed to get version:', error);
    }
}

// DOM 載入完成後初始化
document.addEventListener('DOMContentLoaded', init);