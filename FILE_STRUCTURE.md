# CodeBridge 檔案結構規格

## 專案目錄 (`CodeBridge/`)

```
CodeBridge/
├── .gitignore           # Git 忽略檔案
├── package.json         # 根目錄 npm 配置
├── FILE_STRUCTURE.md    # 本檔案
├── AGENTS.md            # 專案規範
│
├── src-tauri/           # Tauri 後端 (Rust)
│   ├── Cargo.toml       # Rust 專案配置
│   ├── tauri.conf.json  # Tauri 應用配置
│   ├── icons/           # 應用圖示
│   └── src/
│       ├── main.rs      # 主入口
│       ├── lib.rs       # 應用程式邏輯
│       └── commands.rs  # Tauri 指令 (serial, arduino)
│
├── ui/                  # 前端 (TypeScript + Blockly)
│   ├── package.json     # 前端 npm 配置
│   ├── vite.config.js   # Vite 配置
│   ├── tsconfig.json    # TypeScript 配置
│   ├── index.html       # 應用入口
│   ├── src/
│   │   ├── main.js      # 主程式（Blockly init + UI 操作）
│   │   ├── i18n.js      # i18n 膠水層（語系偵測、DOM 替換）
│   │   ├── style.css    # 全域樣式
│   │   └── lib/
│   │       ├── blockly/         # Blockly 相關
│   │       │   ├── modules/     # 積木模組（以 toolbox 分類為單位）
│   │       │   │   ├── arduino/ # Arduino 模組（結構 + I/O + 時間 + 序列）
│   │       │   │   │   ├── zh-hant.js   # 繁體中文訊息（顏色、分類、積木文字、tooltips）
│   │       │   │   │   ├── en.js        # 英文訊息
│   │       │   │   │   ├── blocks.js    # 積木定義
│   │       │   │   │   └── generators.js# 程式碼產生器
│   │       │   │   └── common/  # 共用分類名稱（暫放，未來移植後搬入專屬模組）
│   │       │   │       ├── zh-hant.js   # 繁體中文分類名稱
│   │       │   │       └── en.js        # 英文分類名稱
│   │       │   ├── style/        # 跨模組風格
│   │       │   │   └── engineer.js # Engineer 風格覆寫（C++ 語法）
│   │       │   └── loader.js     # 模組載入器（語系選擇 + 風格切換）
│   │       ├── i18n/             # UI 翻譯（獨立於積木訊息）
│   │       │   ├── zh-hant.js    # 繁體中文 UI 文字（TLB_xxx, MSG_xxx）
│   │       │   └── en.js         # 英文 UI 文字
│   │       ├── components/       # Svelte 元件
│   │       ├── stores/           # 狀態管理
│   │       └── modules/          # 積木模組管理
│   │           └── core_manifest.json # 模組載入清單
│   └── public/
│       └── blockly/         # Blockly 靜態資源
│
├── resources/           # 應用資源
├── libraries/           # Arduino 函式庫快取
├── modules/             # 積木模組快取
├── log/
│   ├── todo.md          # 任務進度
│   ├── plan/            # 計畫文件
│   │   ├── BlockStyles.md   # 雙風格積木實作計畫
│   │   └── ... (其他計畫)
│   ├── work/            # 工作日誌
│   └── mappings/        # 知識庫
├── backup/              # 備份資料夾
└── .git/              # Git 倉庫
```

## 核心技術
- **前端**：Svelte + TypeScript + Blockly v12.3.1 + Vite
- **後端**：Rust + Tauri 2.0
- **Arduino 整合**：Arduino CLI