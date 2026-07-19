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
│   │   ├── main.ts      # 前端主入口
│   │   ├── app.ts       # 應用程式核心
│   │   ├── style.css    # 全域樣式
│   │   └── lib/
│   │       ├── blockly/     # Blockly 相關
│   │       │   ├── blocks/      # 積木定義
│   │       │   ├── generators/  # 程式碼產生器
│   │       │   └── core.js      # Blockly 核心設定
│   │       ├── components/  # Svelte 元件
│   │       ├── stores/      # 狀態管理
│   │       ├── i18n/        # 國際化
│   │       │   ├── zh-hant.ts   # 繁體中文
│   │       │   └── en.ts        # 英文
│   │       └── modules/     # 積木模組管理
│   │           └── core_manifest.json # 模組載入清單
│   └── public/
│       └── blockly/         # Blockly 靜態資源
│
├── resources/           # 應用資源
├── libraries/           # Arduino 函式庫快取
├── modules/             # 積木模組快取
├── log/
│   ├── todo.md          # 任務進度
│   ├── work/            # 工作日誌
│   └── mappings/        # 知識庫
├── backup/              # 備份資料夾
└── .git/              # Git 倉庫
```

## 核心技術
- **前端**：Svelte + TypeScript + Blockly v12.3.1 + Vite
- **後端**：Rust + Tauri 2.0
- **Arduino 整合**：Arduino CLI