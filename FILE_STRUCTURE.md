# CodeBridge 檔案結構規格

## 專案目錄 (`CodeBridge/`)

```
CodeBridge/
├── .gitignore           # Git 忽略檔案
├── .gitattributes       # 行尾規則（*.cbg 強制 LF，避免 Git 在 Windows 轉成 CRLF 違反 SPEC.md §3.1）
├── package.json         # 根目錄 npm 配置
├── SPEC.md              # 系統規格書（產品規格權威來源，含 .cbg 檔案格式規格）
├── FILE_STRUCTURE.md    # 本檔案
├── AGENTS.md            # 專案規範
│
├── src-tauri/           # Tauri 後端 (Rust)
│   ├── Cargo.toml       # Rust 專案配置
│   ├── tauri.conf.json  # Tauri 應用配置
│   ├── icons/           # 應用圖示
│   └── src/
│       ├── main.rs      # 主入口
│       ├── lib.rs       # 應用程式邏輯、AppState、工具鏈 facade、啟動 watcher、內建範例資源定位（select_examples_dir）
│       ├── commands.rs  # Tauri 指令 (serial, toolchain, board, library, operation) + 序列埠掃描與熱插拔 watcher + 序列監視器命令 + list_examples／read_example（掃描 resources/examples，不需 manifest.json）
│       ├── events.rs    # 事件名稱、FlushPolicy 節流、LineBuffer 行緩衝、PortInfo 簽章 diff、SerialData 批次事件
│       ├── serial_monitor.rs  # 序列監視器（LineFramer 位元組切行、HEX 編碼、pump 讀取迴圈、Session）
│       ├── project.rs     # .cbg 專案檔讀寫（副檔名白名單、UTF-8 無 BOM、BOM 容忍）
│       ├── capabilities/  # Tauri 2 權限宣告（core / dialog 最小權限）
│       ├── tests/         # 整合測試（arduino_cli_smoke.rs：對真實 arduino-cli 端對端驗證）
│       ├── arduino/     # Arduino CLI 整合（B 方案：外部依賴 + 引導安裝）
│           ├── mod.rs           # 公開 facade：CodeBridgeToolchain、ToolchainStatus
│           ├── paths.rs         # CLI 路徑解析（使用者設定 → 系統 PATH）與隔離目錄
│           ├── command.rs       # 純函式 command builder（board/core/lib/compile/upload/monitor）
│           ├── parser.rs        # arduino-cli --json 回應解析（snake_case）
│           ├── runner.rs        # ProcessRunner trait + StdProcessRunner（串流/逾時/取消/背壓管線）
│           ├── encoding.rs      # 子進程輸出寬容解碼（UTF-8 → Big5/cp950 → GBK → win1252）
│           ├── draft.rs         # 編譯草稿落地（.ino 寫入、stem 轉換、路徑穿越防護）
│           ├── pipeline.rs      # compile / upload 流程編排（泛型 runner，可完整單元測試）
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
│   │       │   │   │   ├── zh-hant.js   # 正體中文訊息（分類名稱、積木文字、tooltips；不含色碼）
│   │       │   │   │   ├── en.js        # 英文訊息
│   │       │   │   │   ├── blocks.js    # 積木定義（顏色由 CodeBridgeBlockPalette 語意角色提供）
│   │       │   │   │   └── generators.js# 程式碼產生器
│   │       │   │   ├── coding/  # Coding 模組（註解、引入、原始程式碼）
│   │       │   │   │   ├── zh-hant.js   # 正體中文訊息
│   │       │   │   │   ├── en.js        # 英文訊息
│   │       │   │   │   ├── blocks.js    # 積木定義
│   │       │   │   │   └── generators.js# 程式碼產生器
│   │       │   │   ├── logic/   # Logic 模組（if/else, compare, operation, boolean）
│   │       │   │   │   ├── zh-hant.js   # 正體中文訊息
│   │       │   │   │   ├── en.js        # 英文訊息
│   │       │   │   │   └── generators.js# 程式碼產生器（blocks 為 Blockly 內建）
│   │       │   │   ├── loops/   # Loops 模組（while, for, break/continue）
│   │       │   │   │   ├── zh-hant.js   # 正體中文訊息（Angel 風格基底）
│   │       │   │   │   ├── en.js        # 英文訊息（Angel 風格基底）
│   │       │   │   │   ├── blocks.js    # 積木定義（controls_while, controls_for, controls_flow_statements）
│   │       │   │   │   └── generators.js# 程式碼產生器
│   │       │   │   ├── math/    # Math 模組（數字、運算、三角函數、constrain、map、random）
│   │       │   │   │   ├── zh-hant.js   # 正體中文訊息（Angel 風格基底）
│   │       │   │   │   ├── en.js        # 英文訊息（Angel 風格基底）
│   │       │   │   │   ├── blocks.js    # 積木定義（arduino_constrain, arduino_map, math_random_seed, math_random_int）
│   │       │   │   │   └── generators.js# 程式碼產生器（包含 Blockly 內建 math_number, math_arithmetic, math_single）
│   │       │   │   ├── text/    # Text 模組（文字常值、join、append、length）
│   │       │   │   │   ├── zh-hant.js   # 正體中文訊息（Angel 風格基底）
│   │       │   │   │   ├── en.js        # 英文訊息（Angel 風格基底）
│   │       │   │   │   ├── blocks.js    # 積木定義（text_append, text_length）
│   │       │   │   │   └── generators.js# 程式碼產生器（包含 Blockly 內建 text, text_join）
│   │       │   │   ├── variables/ # Variables 模組（全域／區域宣告、get、set）
│   │       │   │   │   ├── zh-hant.js   # 正體中文訊息（Angel 風格基底）
│   │       │   │   │   ├── en.js        # 英文訊息（Angel 風格基底）
│   │       │   │   │   ├── blocks.js    # 積木定義（variables_declare_global/local, variables_get/set）
│   │       │   │   │   └── generators.js# 程式碼產生器

│   │       │   │   ├── array/      # Array 模組（全域／區域宣告、get、set、length）
│   │       │   │   │   ├── zh-hant.js   # 正體中文訊息（Angel 風格基底）
│   │       │   │   │   ├── en.js        # 英文訊息（Angel 風格基底）
│   │       │   │   │   ├── blocks.js    # 積木定義（5 個 piBlockly 對齊積木）
│   │       │   │   │   └── generators.js# 程式碼產生器
│   │       │   │   ├── functions/  # Functions 模組（5 個公開積木 + 2 個 mutator helper）
│   │       │   │   │   ├── zh-hant.js   # 正體中文訊息（Angel 風格基底）
│   │       │   │   │   ├── en.js        # 英文訊息（Angel 風格基底）
│   │       │   │   │   ├── blocks.js    # 函式定義、return、手動呼叫與參數 mutator
│   │       │   │   │   └── generators.js# 原型、定義、return 與呼叫產生器

│   │       │   │   └── common/      # 相容保留的共用訊息
│   │       │   │       ├── zh-hant.js   # 正體中文分類名稱
│   │       │   │       └── en.js        # 英文分類名稱
│   │       │   ├── style/        # 跨模組風格
│   │       │   │   └── engineer.js # Engineer 風格覆寫（C++ 語法）
│   │       │   └── loader.js     # 模組載入器（語系選擇 + 風格切換）
│   │       ├── tauri/           # Tauri IPC 橋接層
│   │       │   └── bridge.js    # invoke / 選檔對話框 / 錯誤正規化 / 環境降級
│   │       ├── project/         # .cbg 專案層（唯一真實來源為 Blockly XML，格式規格見 SPEC.md §3）
│   │       │   ├── plain-code.js    # 去除 ID marker 取得可寫檔與可貼 IDE 的 plain code
│   │       │   ├── project-store.js # .cbg metadata 序列化（cbg:format／cbg:app）、dirty 狀態、最近專案與草稿
│   │       │   └── project-io.js    # New/Open/Save/Save As/範例/複製 的流程編排（存檔用 domToPrettyText 多行格式）
│   │       ├── arduino/          # Arduino CLI 工具鏈（T2）
│   │       │   ├── compile-controller.js # 編譯／上傳狀態機、單飛、取消、診斷標記
│   │       │   ├── board-detector.js    # 板子／序列埠自動偵測（熱插拔、偏好埠、自動切板、上傳前比對）
│   │       │   ├── board-picker.js      # 開發板選擇面板（搜尋過濾、手動選板、錯誤降級）
│   │       │   └── serial-monitor.js    # 序列監視器（開關、baud、HEX、時間戳、開發者輸入行、多埠過濾、onDataLine 繪圖訂閱點）
│   │       ├── plot/             # 序列繪圖（T3 Phase 2，與序列監視器共用同一條連線）
│   │       │   ├── plot-parse.js    # 文字行 → 資料點（label:value / CSV / TSV / 布林 / 垃圾行忽略）
│   │       │   ├── plot-store.js    # ring buffer、時間窗切片、Y 軸範圍、min/max 對包絡下抽樣
│   │       │   ├── plot-render.js   # Canvas 2D 繪圖（格線、座標軸、折線、單點、斷線斷開、DPR）
│   │       │   └── plot-panel.js    # 左右分欄開闔、自動撐高、rAF 排程、圖例、分隔條、窄視窗堆疊
│   │       ├── ui/              # 工具列 UI 元件
│   │       │   ├── toolbar-registry.js # 按鈕 registry（id / implemented / handledBy）
│   │       │   ├── toolbar.js         # data-action 派發、dirty 指示、最近清單與範例
│   │       │   ├── terminal-panel.js   # 終端機輸出面板（附加、捲動、暫停、清除、開闔）
│   │       │   ├── confirm-dialog.js  # 可翻譯確認對話框（未儲存變更三選一）
│   │       │   ├── toast.js           # 短暫提示
│   │       │   └── clipboard.js       # 剪貼簿複製（含 execCommand fallback）
│   │       ├── practice/         # 練習模式（程式碼撰寫導航員）
│   │       │   └── practice-mode.js # 練習模式核心（比對引擎 + 提示系統）
│   │       ├── i18n/             # UI 翻譯（獨立於積木訊息）
│   │       │   ├── zh-hant.js    # 正體中文 UI 文字（TLB_xxx, MSG_xxx, PRACTICE_xxx）
│   │       │   └── en.js         # 英文 UI 文字
│   │       ├── components/       # Svelte 元件
│   │       ├── stores/           # 狀態管理
│   │       └── modules/          # 積木模組管理
│   │           └── core_manifest.json # 模組載入清單
│   └── public/
│       ├── favicon.ico      # 網站圖示（複製自 src-tauri/icons/icon.ico）
│       └── blockly/         # Blockly v13.3.0 靜態資源（core、msg、plugins、media 離線備份）
│
│   ├── resources/           # Tauri bundle 資源（打包時匣內的檔案）
│   │   └── examples/        # 內建範例 .cbg，由 Rust read_dir() 掃描（檔名數字前綴＝排序，不需 manifest.json）
│   │                        #   格式必須符合 SPEC.md §3：多行縮排、根元素 metadata 屬性在第一行、無 XML 宣告／XML 註解
│   │                        #   01_blink / 02_serial-hello / 03_plot-waves（序列繪圖示範：方波+正弦+隨機）
├── libraries/           # Arduino 函式庫快取
├── modules/             # 積木模組快取
├── log/
│   ├── todo.md          # 任務進度
│   ├── plan/            # 計畫文件
│   │   ├── BlockStyles.md       # 雙風格積木實作計畫
│   │   ├── CodeBridgeV2.md      # CodeBridge V2 總體規格（主線、工具鏈、序列與專案）
│   │   ├── CodeBridgeModulesRepository.md # 新 codebridge-modules repository 與遷移計畫
│   │   ├── BlocklyV13Upgrade.md # Blockly 13.3.0 升級、相容決策與驗證結果
│   │   │   ├── ExperienceThemeArchitecture.md # Engineer／Angel 體驗主題與語意 palette contract 架構
│   │   ├── codingBlock.md       # Coding 模組移植計畫
│   │   ├── LoopsBlock.md        # Loops 模組移植計畫
│   │   └── ... (其他計畫)
│   ├── work/            # 工作日誌
│   └── mappings/        # 知識庫
│   │   ├── ThemeModule.html # 體驗主題與 palette contract 用法
│   │   └── Toolbar.html    # 工具列、.cbg 專案與 bridge 公開 API 用法
├── temp/                # 暫存檔案（僅供開發暫用，不得寫入外部工具目錄）
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
- `ui/tests/support/`：`classic-script.js`（以 vm 載入 classic script 的單元測試幫手）與 `tauri-mock.js`（Tauri runtime 與記憶體檔案系統 stub）。
- `ui/playwright.config.mjs`：system Edge Playwright 配置，自動啟動 Vite。
- `ui/tests/e2e/`：Engineer／Angel theme、Blockly runtime、v12 XML migration 與 generator golden tests、工具列與 .cbg 專案流程（`toolbar.spec.js`）、編譯／上傳流程（`compile-flow.spec.js`）、序列監視器（`serial-monitor.spec.js`）、序列繪圖分欄佈局（`plotter.spec.js`）、工作區滾輪與終端機面板外觀（`workspace-wheel.spec.js`）。
- `ui/tests/fixtures/blockly-v12/`：可由 Blockly 13.3.0 載入的 setup/loop、controls、text、variables、array、functions 與 workspace comment fixtures。
- `ui/tests/unit/`：資源 manifest、bytes 與 SHA-256 測試、plain code 去除 marker、.cbg 專案狀態與 dirty、工具列按鈕契約、編譯控制器（`compile-controller.test.js`）、終端機面板（`terminal-panel.test.js`）、序列監視器（`serial-monitor.test.js`）與序列繪圖四個模組（`plot-parse` / `plot-store` / `plot-render` / `plot-panel`）。
- `src-tauri/tests/arduino_cli_smoke.rs`：對**真實** `arduino-cli` 的端對端整合測試（找不到 CLI 時自動跳過；只呼叫不需網路的子命令）。
- `cargo test`：Arduino CLI 模組單元測試（command builder、parser、diagnostics、encoding 寬容解碼、draft 落地、串流 runner、compile/upload pipeline）。
- `.github/workflows/frontend-blockly.yml`：Windows + Node.js 24 + system Edge CI。
- `log/plan/BlocklyTesting.md`：測試 seam、命令與維護規則。