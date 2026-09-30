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
    // 2026-09-30 CB-T5：只在「真的在建置」時才複製。
    // 過去此 plugin 沒有 apply 限制，vitest 每次結束（server closeBundle）也會觸發，
    // 導致跑測試時把整個 src/ 與 blockly/ 遞迴複製進 dist/ —— 既有雜訊輸出，
    // 也是不必要的磁碟 I/O。apply: 'build' 讓它只在 `vite build` 生效。
    apply: 'build',
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
  ],
  // 排除傳統 script 載入的 blockly 模組檔案，避免 Vite 嘗試解析為 ES module
  optimizeDeps: {
    exclude: ['src/lib/blockly']
  },
  server: {
    watch: {
      /**
       * 忽略不影響前端開發的檔案，避免無謂的 HMR 與整頁重載。
       *
       * **為什麼忽略 `**\/*.cbg`**
       *
       * `.cbg` 是 CodeBridge 的專案檔（Blockly 工作區 XML）。使用者按存檔時
       * 路徑是**自己選的**，可能落在 `src-tauri/resources/examples/`、
       * 專案根目錄或任何子目錄 —— 所以不能用「特定目錄」來過濾，
       * 必須依副檔名判斷。
       *
       * 這些檔案對前端開發毫無意義：開發模式的前端走 `read_example` IPC
       * 從 Rust 端讀內建範例，從不 fetch .cbg；而使用者自己存檔的 .cbg
       * 只在下次開啟時才會被讀。**重載頁面換不到任何東西，
       * 卻會把使用者尚未存檔的積木布局整個洗掉** —— 代價遠大於收益。
       *
       * （Rust 端的重新編譯由 Tauri CLI 自己的 watcher 負責，與 Vite 無關。）
       */
      ignored: [
        '**/dist/**',
        '**/src-tauri/target/**',
        '**/*.cbg',
        '**/backup/**',
        '**/temp/**',
        '**/log/**',
        '**/.git/**'
      ]
    }
  }
});
