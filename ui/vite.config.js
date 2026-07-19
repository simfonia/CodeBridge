import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

/**
 * CodeBridge Vite 配置
 * 核心目標：在打包時保留原始 src 與 blockly 目錄結構，以維持與 Tauri 的相容性
 */
function copyCodeBridgeAssets() {
  return {
    name: 'copy-codebridge-assets',
    closeBundle: () => {
      const folders = ['src', 'blockly'];
      const distPath = resolve(__dirname, 'dist');
      
      folders.forEach(folder => {
        const src = resolve(__dirname, folder);
        const dest = resolve(distPath, folder);
        
        if (fs.existsSync(src)) {
          console.log(`[Vite] Copying static folder: ${folder} -> dist/${folder}`);
          fs.cpSync(src, dest, { recursive: true });
        }
      });
    }
  };
}

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      }
    }
  },
  plugins: [
    copyCodeBridgeAssets()
  ]
});