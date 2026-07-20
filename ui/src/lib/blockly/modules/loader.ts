/// CodeBridge 遠端模組載入器
/// 與 piBlockly-modules 對接，支援從網路動態載入積木模組

/**
 * 從指定 URL 載入 JavaScript 模組
 * 參考 piBlockly 的 module_loader.js 實作
 * 
 * @param url 模組 URL
 * @param suppressError 是否抑制錯誤輸出
 * @returns 載入的模組，失敗時回傳 null
 */
export async function loadRemoteModule(url: string, suppressError = false): Promise<any> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch module from ${url}: ${response.statusText}`);
    }
    const code = await response.text();
    const blob = new Blob([code], { type: 'text/javascript' });
    const moduleUrl = URL.createObjectURL(blob);
    const module = await import(moduleUrl);
    URL.revokeObjectURL(moduleUrl);
    return module;
  } catch (e) {
    if (!suppressError) {
      console.error('[CodeBridge] Error loading remote module:', url, e);
    }
    return null;
  }
}

/**
 * 載入遠端模組並註冊到 Blockly
 * 
 * 每個遠端模組應包含：
 * - registerBlocks(Blockly): 註冊積木
 * - registerGenerators(Blockly): 註冊產生器
 * - messages?: { zh-hant?: Record<string, string>, en?: Record<string, string> }
 * - toolbox?: any 工具箱 XML 字串或 JSON
 * 
 * @param baseUrl 模組基底 URL（例如 https://example.com/piblockly_hw_blocks/）
 * @param files 要載入的檔案清單（例如 ['blocks.js', 'generators.js']）
 */
export async function loadAndRegisterModule(
  baseUrl: string,
  files: string[]
): Promise<boolean> {
  try {
    for (const file of files) {
      const module = await loadRemoteModule(`${baseUrl}/${file}`);
      if (module) {
        if (typeof module.registerBlocks === 'function') {
          module.registerBlocks(Blockly);
          console.log(`[CodeBridge] Registered blocks from ${file}`);
        }
        if (typeof module.registerGenerators === 'function') {
          module.registerGenerators(Blockly);
          console.log(`[CodeBridge] Registered generators from ${file}`);
        }
        // 合併訊息
        if (module.messages?.zh_hant) {
          Object.assign(Blockly.Msg, module.messages.zh_hant);
        }
        if (module.messages?.en) {
          const { EN_MESSAGES } = await import('../messages/en');
          Object.assign(EN_MESSAGES, module.messages.en);
        }
      }
    }
    return true;
  } catch (e) {
    console.error('[CodeBridge] Failed to load and register module:', baseUrl, e);
    return false;
  }
}