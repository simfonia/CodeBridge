/// CodeBridge 前端主入口
/// 負責初始化 Blockly 編輯器和 Tauri 整合

import { invoke } from '@tauri-apps/api/core';
import { initCodeBridgeBlockly } from './lib/blockly/index';

// 初始化應用程式
async function init() {
    console.log('[CodeBridge] Initializing...');

    // 1. 取得版本資訊
    try {
        const version = await invoke<string>('get_version');
        console.log(`[CodeBridge] Version: ${version}`);
    } catch (error) {
        console.error('[CodeBridge] Failed to get version:', error);
    }

    // 2. 初始化 Blockly 系統
    //    預設使用繁體中文 + Angel 風格
    const config = initCodeBridgeBlockly('zh-hant', 'angel');

    // 3. 注入 Blockly 工作區
    const workspaceElement = document.getElementById('blocklyWorkspace');
    if (workspaceElement && typeof Blockly !== 'undefined') {
        const workspace = Blockly.inject(workspaceElement, {
            toolbox: config.toolbox,
            theme: config.theme,
            grid: {
                spacing: 20,
                length: 3,
                colour: '#ccc',
                snap: true,
            },
            zoom: {
                controls: true,
                wheel: true,
                startScale: 1.0,
                maxScale: 3,
                minScale: 0.3,
                scaleSpeed: 1.2,
            },
            trashcan: true,
        });

        console.log('[CodeBridge] Blockly workspace initialized.');
    } else {
        console.warn('[CodeBridge] Blockly workspace element not found or Blockly not loaded.');
    }
}

// DOM 載入完成後初始化
document.addEventListener('DOMContentLoaded', init);