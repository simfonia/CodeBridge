/// CodeBridge 模組管理器
/// 管理內建與遠端積木模組的載入

import { loadAndRegisterModule } from './loader';

export interface ModuleConfig {
  id: string;
  name: string;
  description: string;
  type: 'builtin' | 'remote';
  url?: string;
  files?: string[];
  enabled: boolean;
}

/**
 * 從 manifest 載入所有啟用的模組
 * 
 * @param manifestUrl manifest JSON 的路徑
 */
export async function loadModulesFromManifest(manifestUrl: string): Promise<void> {
  try {
    const response = await fetch(manifestUrl);
    if (!response.ok) {
      throw new Error(`Failed to load manifest: ${response.statusText}`);
    }
    const manifest = await response.json();
    const modules: ModuleConfig[] = manifest.modules || [];

    for (const mod of modules) {
      if (!mod.enabled) continue;

      if (mod.type === 'remote' && mod.url) {
        const files = mod.files || ['blocks.js', 'generators.js'];
        console.log(`[CodeBridge] Loading remote module: ${mod.name} (${mod.id})`);
        await loadAndRegisterModule(mod.url, files);
      }
      // builtin 模組已透過 blocks/index.ts 和 generators/index.ts 載入
    }
  } catch (e) {
    console.error('[CodeBridge] Failed to load modules from manifest:', e);
  }
}

export { loadRemoteModule, loadAndRegisterModule } from './loader';