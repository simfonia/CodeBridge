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
│   │   ├── main.ts      # 前端主入口（初始化 Blockly + Tauri）
│   │   ├── app.ts       # 應用程式核心
│   │   ├── style.css    # 全域樣式
│   │   └── lib/
│   │       ├── blockly/     # Blockly 相關（新架構）
│   │       │   ├── index.ts            # 主入口：initCodeBridgeBlockly()
│   │       │   ├── global.d.ts         # 全域 Blockly 型別定義
│   │       │   ├── blocks/             # 積木定義（模組化）
│   │       │   │   ├── index.ts        # 匯入所有積木模組
│   │       │   │   ├── pin.ts          # 影子積木 (arduino_pin_shadow)
│   │       │   │   ├── core.ts         # Arduino 核心 (pinMode, digitalWrite, delay...)
│   │       │   │   ├── serial.ts       # 序列通訊 (Serial.begin, print...)
│   │       │   │   └── ... (依移植進度擴充)
│   │       │   ├── generators/         # 程式碼產生器（對應 blocks/）
│   │       │   │   ├── index.ts        # 匯入所有產生器模組
│   │       │   │   ├── pin.ts          # 影子積木產生器
│   │       │   │   ├── core.ts         # 核心積木產生器
│   │       │   │   ├── serial.ts       # 序列通訊產生器
│   │       │   │   └── ...
│   │       │   ├── messages/           # 訊息管理（三層架構）
│   │       │   │   ├── index.ts        # 匯出入
│   │       │   │   ├── zh-hant.ts      # 繁體中文（所有積木自然語言）
│   │       │   │   ├── en.ts           # 英文（所有積木自然語言）
│   │       │   │   └── style/          # 風格覆寫層
│   │       │   │       ├── index.ts    # 套用/切換邏輯 (setBlockStyle)
│   │       │   │       └── engineer.ts # Engineer 風格 (C++ 語法覆寫)
│   │       │   ├── theme/              # Blockly 視覺主題
│   │       │   │   └── index.ts        # 主題定義
│   │       │   ├── toolbox/            # 工具箱分類
│   │       │   │   └── index.ts        # 工具箱 JSON 配置
│   │       │   ├── modules/            # 模組載入器（與 piBlockly-modules 對接）
│   │       │   │   ├── index.ts        # 模組管理器
│   │       │   │   └── loader.ts       # 動態載入 (本地/遠端)
│   │       │   └── _core.js            # 保留：程式碼籃子架構
│   │       ├── components/  # Svelte 元件
│   │       ├── stores/      # 狀態管理
│   │       ├── i18n/        # UI 介面國際化（獨立於積木訊息）
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
│   ├── plan/            # 計畫文件
│   │   ├── BlockStyles.md   # 雙風格積木實作計畫
│   │   └── ... (其他計畫)
│   ├── work/            # 工作日誌
│   └── mappings/        # 知識庫
├── backup/              # 備份資料夾
└── .git/              # Git 倉庫
```

## 注意：已棄用的舊檔案

以下舊檔案將在未來移除，目前保留以確保向後相容：
- `ui/src/lib/blockly/blocks.js` → 遷移至 `blocks/pin.ts` + `blocks/core.ts` + `blocks/serial.ts`
- `ui/src/lib/blockly/generators.js` → 遷移至 `generators/pin.ts` + `generators/core.ts` + `generators/serial.ts`
- `ui/src/lib/blockly/zh-hant.js` → 遷移至 `messages/zh-hant.ts`
- `ui/src/lib/blockly/en.js` → 遷移至 `messages/en.ts`

## 核心技術
- **前端**：Svelte + TypeScript + Blockly v12.3.1 + Vite
- **後端**：Rust + Tauri 2.0
- **Arduino 整合**：Arduino CLI