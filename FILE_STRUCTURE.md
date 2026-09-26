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
│       ├── lib.rs       # 應用程式邏輯、AppState、工具鏈 facade、事件名稱
│       ├── commands.rs  # Tauri 指令 (serial, toolchain, board, library, operation)
│       └── arduino/     # Arduino CLI 整合（B 方案：外部依賴 + 引導安裝）
│           ├── mod.rs           # 公開 facade：CodeBridgeToolchain、ToolchainStatus
│           ├── paths.rs         # CLI 路徑解析（使用者設定 → 系統 PATH）與隔離目錄
│           ├── command.rs       # 純函式 command builder（board/core/lib/compile/upload/monitor）
│           ├── parser.rs        # arduino-cli --json 回應解析（snake_case）
│           ├── runner.rs        # ProcessRunner trait + StdProcessRunner（逾時/取消/背壓管線）
│           ├── diagnostics.rs   # compiler_err 行號解析（gcc 冒號式與括號式）
│           └── operations.rs    # 長作業 registry（狀態、取消、prune）
│
├── ui/                  # 前端 (TypeScript + Blockly)
│   ├── package.json     # 前端 npm 配置
│   ├── vite.config.js   # Vite 配置
│   ├── tsconfig.json    # TypeScript 配置
│   ├── index.html       # 應用入口
│   ├── src/
│   │   ├── main.js      # 主程式（Blockly init + UI 操作）
│   │   ├── i18n.js      # i18n 膠水層（語系偵測、DOM 替換）
│   │   ├── style.css    # 功能佈局樣式（視覺色值由 styles/presets.css 提供）
│   │   ├── styles/
│   │   │   └── presets.css # Engineer 深色科技／Angel 明亮糖果語意 token 與 Blockly chrome
│   │   ├── theme/        # Engineer／Angel 體驗 preset 協調
│   │   │   ├── presets.js # Preset registry（visualTheme + blockStyle）
│   │   │   ├── theme-manager.js # 公開 CodeBridgeTheme interface、持久化與 fallback
│   │   │   ├── blockly-adapter.js # Blockly component theme、grid 與 block palette
│   │   │   └── code-theme-adapter.js # 程式碼預覽主題 adapter
│   │   └── lib/
│   │       ├── blockly/         # Blockly 相關
│   │       │   ├── generators/  # Generator 核心（對齊 piBlockly 架構）
│   │       │   │   └── _core.js # Blockly.Arduino generator 核心（init/finish/scrub_）
│   │       │   ├── modules/     # 積木模組（以 toolbox 分類為單位）
│       │       │   ├── toolbox-search.js # Toolbox 公開積木索引、搜尋框與 flyout 結果

│   │       │   │   ├── arduino/ # Arduino 模組（結構 + I/O + 時間 + 序列）
│   │       │   │   │   ├── zh-hant.js   # 繁體中文訊息（顏色、分類、積木文字、tooltips）
│   │       │   │   │   ├── en.js        # 英文訊息
│   │       │   │   │   ├── blocks.js    # 積木定義
│   │       │   │   │   └── generators.js# 程式碼產生器
│   │       │   │   ├── coding/  # Coding 模組（註解、引入、原始程式碼）
│   │       │   │   │   ├── zh-hant.js   # 繁體中文訊息
│   │       │   │   │   ├── en.js        # 英文訊息
│   │       │   │   │   ├── blocks.js    # 積木定義
│   │       │   │   │   └── generators.js# 程式碼產生器
│   │       │   │   ├── logic/   # Logic 模組（if/else, compare, operation, boolean）
│   │       │   │   │   ├── zh-hant.js   # 繁體中文訊息
│   │       │   │   │   ├── en.js        # 英文訊息
│   │       │   │   │   └── generators.js# 程式碼產生器（blocks 為 Blockly 內建）
│   │       │   │   ├── loops/   # Loops 模組（while, for, break/continue）
│   │       │   │   │   ├── zh-hant.js   # 繕體中文訊息（Angel 風格基底）
│   │       │   │   │   ├── en.js        # 英文訊息（Angel 風格基底）
│   │       │   │   │   ├── blocks.js    # 積木定義（controls_while, controls_for, controls_flow_statements）
│   │       │   │   │   └── generators.js# 程式碼產生器
│   │       │   │   ├── math/    # Math 模組（數字、運算、三角函數、constrain、map、random）
│   │       │   │   │   ├── zh-hant.js   # 繕體中文訊息（Angel 風格基底）
│   │       │   │   │   ├── en.js        # 英文訊息（Angel 風格基底）
│   │       │   │   │   ├── blocks.js    # 積木定義（arduino_constrain, arduino_map, math_random_seed, math_random_int）
│   │       │   │   │   └── generators.js# 程式碼產生器（包含 Blockly 內建 math_number, math_arithmetic, math_single）
│   │       │   │   ├── text/    # Text 模組（文字常值、join、append、length）
│   │       │   │   │   ├── zh-hant.js   # 繕體中文訊息（Angel 風格基底）
│   │       │   │   │   ├── en.js        # 英文訊息（Angel 風格基底）
│   │       │   │   │   ├── blocks.js    # 積木定義（text_append, text_length）
│   │       │   │   │   └── generators.js# 程式碼產生器（包含 Blockly 內建 text, text_join）
│   │       │   │   ├── variables/ # Variables 模組（全域／區域宣告、get、set）
│   │       │   │   │   ├── zh-hant.js   # 繁體中文訊息（Angel 風格基底）
│   │       │   │   │   ├── en.js        # 英文訊息（Angel 風格基底）
│   │       │   │   │   ├── blocks.js    # 積木定義（variables_declare_global/local, variables_get/set）
│   │       │   │   │   └── generators.js# 程式碼產生器

│   │       │   │   ├── array/      # Array 模組（全域／區域宣告、get、set、length）
│   │       │   │   │   ├── zh-hant.js   # 繁體中文訊息（Angel 風格基底）
│   │       │   │   │   ├── en.js        # 英文訊息（Angel 風格基底）
│   │       │   │   │   ├── blocks.js    # 積木定義（5 個 piBlockly 對齊積木）
│   │       │   │   │   └── generators.js# 程式碼產生器
│   │       │   │   ├── functions/  # Functions 模組（5 個公開積木 + 2 個 mutator helper）
│   │       │   │   │   ├── zh-hant.js   # 繁體中文訊息（Angel 風格基底）
│   │       │   │   │   ├── en.js        # 英文訊息（Angel 風格基底）
│   │       │   │   │   ├── blocks.js    # 函式定義、return、手動呼叫與參數 mutator
│   │       │   │   │   └── generators.js# 原型、定義、return 與呼叫產生器

│   │       │   │   └── common/      # 相容保留的共用訊息
│   │       │   │       ├── zh-hant.js   # 繁體中文分類名稱
│   │       │   │       └── en.js        # 英文分類名稱
│   │       │   ├── style/        # 跨模組風格
│   │       │   │   └── engineer.js # Engineer 風格覆寫（C++ 語法）
│   │       │   └── loader.js     # 模組載入器（語系選擇 + 風格切換）
│   │       ├── practice/         # 練習模式（程式碼撰寫導航員）
│   │       │   └── practice-mode.js # 練習模式核心（比對引擎 + 提示系統）
│   │       ├── i18n/             # UI 翻譯（獨立於積木訊息）
│   │       │   ├── zh-hant.js    # 繁體中文 UI 文字（TLB_xxx, MSG_xxx, PRACTICE_xxx）
│   │       │   └── en.js         # 英文 UI 文字
│   │       ├── components/       # Svelte 元件
│   │       ├── stores/           # 狀態管理
│   │       └── modules/          # 積木模組管理
│   │           └── core_manifest.json # 模組載入清單
│   └── public/
│       ├── favicon.ico      # 網站圖示（複製自 src-tauri/icons/icon.ico）
│       └── blockly/         # Blockly v13.3.0 靜態資源（core、msg、plugins）
│
├── resources/           # 應用資源
├── libraries/           # Arduino 函式庫快取
├── modules/             # 積木模組快取
├── log/
│   ├── todo.md          # 任務進度
│   ├── plan/            # 計畫文件
│   │   ├── BlockStyles.md       # 雙風格積木實作計畫
│   │   ├── CodeBridgeV2.md      # CodeBridge V2 總體規格（主線、工具鏈、序列與專案）
│   │   ├── CodeBridgeModulesRepository.md # 新 codebridge-modules repository 與遷移計畫
│   │   ├── BlocklyV13Upgrade.md # Blockly 13.3.0 升級、相容決策與驗證結果
│   │   ├── codingBlock.md       # Coding 模組移植計畫
│   │   ├── LoopsBlock.md        # Loops 模組移植計畫
│   │   └── ... (其他計畫)
│   ├── work/            # 工作日誌
│   └── mappings/        # 知識庫
├── backup/              # 備份資料夾
└── .git/              # Git 倉庫
```

## 核心技術
- **前端**：Svelte + TypeScript + Blockly v13.3.0 + Vite
- **後端**：Rust + Tauri 2.0
- **Arduino 整合**：Arduino CLI 採 **B 方案（外部依賴 + 引導安裝）**，不內嵌打包 GPL-3.0 執行檔；CodeBridge 負責 core、library、board discovery、compile 與 upload，並以 `--config-dir` 將資料隔離於 `<app_data>/arduino`
- **模組責任**：CodeBridge 提供 C++、Coding 與 Arduino 基礎核心積木；新的 `codebridge-modules` repository 提供硬體、感測器、致動器、第三方 library 與教學模組
- **舊 pbm 定位**：`C:\Workspace\piblockly-modules` 僅作為 migration source，不在原地升級為正式 CodeBridge repository
- **遠端模組契約**：CodeBridge Module Runtime 與新 repository 共用版本化 manifest、compatibility、checksum 與 dependency 驗證
- **序列功能**：Rust serialport 提供 Serial Monitor；Plot Data Parser 與圖表 renderer 提供 Serial Plotter

## 測試與 CI
- `ui/playwright.config.mjs`：system Edge Playwright 配置，自動啟動 Vite。
- `ui/tests/e2e/`：Engineer／Angel theme、Blockly runtime、v12 XML migration 與 generator golden tests。
- `ui/tests/fixtures/blockly-v12/`：可由 Blockly 13.3.0 載入的 setup/loop、controls、text、variables、array、functions 與 workspace comment fixtures。
- `ui/tests/unit/`：資源 manifest、bytes 與 SHA-256 測試。
- `.github/workflows/frontend-blockly.yml`：Windows + Node.js 24 + system Edge CI。
- `log/plan/BlocklyTesting.md`：測試 seam、命令與維護規則。
