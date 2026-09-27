# Arduino CLI 編譯與上傳（Phase T2）

## 文件資訊
- 狀態：已核准，開始實作（2026-09-26）
- 對應程式碼：`src-tauri/src/arduino/*`、`src-tauri/src/commands.rs`、`src-tauri/src/lib.rs`、`ui/src/lib/arduino/*`、`ui/src/lib/ui/*`
- 前置：Phase T1（`log/work/2026-09-25.md`、`backup/arduino_cli_t1_20260925_234917/`）已完成環境偵測、命令 builder、JSON parser、diagnostics、operation registry
- 參考專案：`C:\Workspace\cocoya`（熱插拔輪詢、序列埠下拉、終端機、主題與 icon）

## Problem Statement
工具列 `btn-run` / `btn-stop` 與終端機面板仍是 `disabled` 死按鈕，`run_arduino_code` 只回 `COMPILE_NOT_IMPLEMENTED`。T1 已備妥 command builder 與 parser，但缺少：
1. **草稿落地**：`.ino` 從未寫入磁碟，`arduino-cli compile` 無輸入。
2. **串流與取消**：`ProcessRunner::run` 是批次式，`Operation.child` 是死碼；`core install` 級別的作業無法顯示進度、無法及時中止。
3. **pipeline 與事件**：`compile` / `upload` 沒有組裝層，沒有 `codebridge://operation-status` 與 `codebridge://compile-diagnostics` 的實際發送。
4. **板子與序列埠選擇**：沒有 FQBN UI，即使 compile 完成也無從上傳。
5. **編碼正確性**：Windows 下子進程（arduino-cli → avrdude / gcc）輸出可能非 UTF-8，webview 終端機將顯示亂碼。
6. **CSP**：`tauri.conf.json` 仍為 `csp: null`，啟用事件串流前必須處理。

## Solution
在既有 T1 基礎上補上五層：草稿落地（`draft.rs`）、串流 runner（`ChildProcess` seam）、compile/upload pipeline、Tauri 非同步 command + 事件、對齊 cocoya 的板子自動偵測 UI，並以 `encoding_rs` 做寬容解碼根治 cp950。

## Implementation Decisions

### 1. 草稿落地（`arduino/draft.rs`）
- 位置：`<app_data>/sketches/<projectId>/<Stem>.ino`（`ToolchainDirs::sketch_dir()` 已預留）。
- Arduino CLI 要求**資料夾名與 .ino 檔名相同**且為合法識別字，故需 `sanitize_stem()`：非法字元（含中文）轉 `_`，空字元退回 `sketch`，長度上限 32。
- `project_id` 必須符合 `^[A-Za-z0-9_-]{1,64}$`，防止路徑穿越。
- 寫入前 `remove_dir_all` 該專案草稿目錄再重建，清除過期 `.h` / `.cpp`。
- 一律 **UTF-8 無 BOM + LF**。marker（`// __BLOCKLY_ID:`）**永不落地**：前端送 `CodeBridgePlainCode.strip()` 結果。
- 錯誤碼：`DRAFT_ERROR_INVALID_PROJECT_ID` / `DRAFT_ERROR_EMPTY_CODE` / `DRAFT_ERROR_WRITE_FAILED`。

### 2. 行號契約（雙向定位的前提）
前端送出的字串與程式碼面板顯示的內容**逐行一致**（同一支 `strip()`），因此 compiler diagnostics 的 1-based 行號可直接對應 `.code-line[data-line-index]`（0-based）。需以單元測試守護：`strip()` 不得改變行數。

### 3. 串流 runner（`arduino/runner.rs`）
- `trait OutputSink { fn on_line(&mut self, stream: StreamKind, line: &str) }` + `BoundedSink`（`VecDeque`，cap 2000）。
- `trait ChildProcess { try_wait / kill / take_stdout / take_stderr }` + `RealChild` + `#[cfg(test)] ScriptedChild`。
  抽出此 trait 的目的：timeout / kill / 管線背壓**全部可純單元測試**，不依賴真實 CLI。
- `ProcessRunner::run_streamed(cli, req, sink, cancel)`：兩條 reader 執行緒 + `mpsc`；主迴圈 50ms `try_wait` 輪詢並檢查 cancel flag → `kill` → `cancelled = true`。
- `run()` 改為 `run_streamed` + `BoundedSink` 的薄包裝，**單一程式路徑**避免兩套死碼邏輯。

### 4. 編碼：根治 cp950（對齊 cocoya「Python 子進程編碼鐵律」）
cocoya `AGENTS.md:104-113` 的鐵律是「子進程 I/O 一律強制 UTF-8，雙平台根本解決，不依賴環境變數/locale」。CodeBridge 對應四個層次全部落實：

| 層 | cocoya 做法 | CodeBridge 做法 |
|---|---|---|
| 子進程啟動 | `PYTHONIOENCODING=utf-8` / `PYTHONUTF8=1` | `Command::env("LANG","C.UTF-8").env("LC_ALL","C.UTF-8")`（影響 avrdude / gcc 等工具鏈子程序） |
| 父端解碼 | `Popen(encoding="utf-8", errors="replace")` | **不可**用 `read_to_string`（遇非 UTF-8 直接丟失整段輸出）。改讀 `Vec<u8>`，交 `encoding.rs` 純函式寬容解碼 |
| 模板腳本 | `sys.stdout.reconfigure(encoding='utf-8')` | 草稿 `.ino` 一律 UTF-8 無 BOM |
| webview | `<meta charset="UTF-8">` | 已存在（`ui/index.html:4`），維持；終端機字型加 CJK fallback、`white-space: pre-wrap` |

`encoding.rs` 解碼策略：`UTF-8 strict → Big5/cp950 → GBK → windows-1252 → latin-1`，一律 replace 策略永不 panic。
新增依賴 **`encoding_rs = "0.8"`**（本輪唯一新 crate；成熟且支援 Big5/GBK/windows-1252）。
`decode_output(bytes) -> DecodedText { text, encoding: EncodingKind, replaced: bool }` 為純函式，可測試。`EncodingKind` 供終端機面板顯示編碼來源（除錯用）。

### 5. Pipeline（`arduino/pipeline.rs`）
- `compile_pipeline<R: ProcessRunner>(dirs, runner, req) -> CompileOutcome`、`upload_pipeline<R: ProcessRunner>(...) -> UploadOutcome`。
- 泛型化 runner → 以 `FakeProcessRunner` + 暫存目錄做完整流程測試，不需 Tauri App。
- FQBN 格式驗證 `vendor:architecture:board[:opts]`。
- **compile／upload 刻意不使用 `--json`**（見下方「實測修正」）：非 JSON 模式下 stdout 是進度與摘要、stderr 是 gcc/avrdude 診斷，正好對應終端機面板與可定位診斷。
- 成功判定以結束碼為準（實測 compile 失敗 `exit=1`）；取消與逾時分支必須**先於**成敗判斷。
- `parse_size_report()` 解析 Flash/RAM 用量，**不依賴訊息文字**（arduino-cli 跟著系統 locale 本地化），改以「一行含數字緊接 `%`」判定用量行。

#### 實測修正（arduino-cli 1.2.0，2026-09-26）
原設計的三項假設被實測推翻，已據此修正：

| 原假設 | 實測結果 | 修正 |
|---|---|---|
| `--json` 的 stdout 是最終 JSON、stderr 是進度 | **`--json` 模式下 stderr 完全為空**，整份輸出被包成一個 JSON 物件（含 `diagnostics` 原生陣列） | compile/upload 改用**非 JSON** 模式；`board/core/lib` 等查詢才用 `--json` |
| 成功與失敗由 JSON 的 `success` 欄位判斷 | 非 JSON 模式沒有該欄位，但結束碼可靠（失敗 `exit=1`） | 以 `RunResult::is_success()` 為準 |
| 需要 `SketchProgram` 解析 compile 回應 | 非 JSON 模式下 gcc 診斷就是 `path:line:col: error: msg`，正是既有 `diagnostics.rs` 的格式 | 移除 compile 對 JSON 的依賴；`used_libraries` 一併移除（無 JSON 即取不到依賴清單，留待後續機制） |

另注意：**成功編譯時 stderr 仍會有函式庫核心檔的警告**（例如 avr-gcc 對 `new.cpp` 的 unused parameter）。後端原樣保留並附上檔名，UI 需依 `diag.file !== inoFileName` 判斷能否跳轉。

### 6. 長作業與事件
- 移除 `Operation.child` 死碼（改由串流執行緒持有 `Child`），避免兩套 kill 路徑。
- `OperationStatus` 追加 `logs: Vec<String>`、`result: Option<Value>`。
- compile / upload **不設逾時**（`RunRequest::new` 預設 `None`），僅查詢類命令 60s。
- 事件 flush 採 cocoya `commands/mcu.rs:156-172` 的**雙門檻**：`200ms 或 64 行` 任一達成就 emit。
- 上傳前置：`AppState.last_builds: HashMap<projectId, BuildRecord{fqbn, build_path, ino_stem}>`。FQBN 變更或 build 遺失 → `CLI_ERROR_BUILD_STALE`。
- `AppState.port_lease`：編譯/上傳期間佔用序列埠；T3 Serial Monitor 沿用同一把鎖，實現「上傳前暫停 Monitor」。

### 7. 板子自動偵測（對齊 cocoya 熱插拔輪詢）
cocoya `src-tauri/src/lib.rs:84-109` 的做法是 Rust 背景執行緒輪詢 + 簽章 diff + `emit_to`，前端零計時器。CodeBridge 採**雙層**：

| 層 | 實作 | 週期 | 事件 |
|---|---|---|---|
| 序列埠層 | `serialport::available_ports()` | 1500ms，簽章 `port|vid|pid` diff 才發 | `codebridge://serial-ports-changed` |
| 板子層 | 埠變化時才呼叫 `arduino-cli board list` | 事件驅動 + in-flight 抑制 | `codebridge://board-detected`（port→fqbn） |

**與 cocoya 的差異（刻意）**：cocoya 用 Rust 內寫死的 `detect_board_id(vid,pid)` 表，只支援 5 款教學板；CodeBridge 面向通用 Arduino（數百種 FQBN），必須以 `arduino-cli board list` 的 `fqbn` / `matching_board` 為準（`parser.rs::DetectedBoard` 已提供）。無匹配時回空字串，交由前端提示手動選板 —— 降級語意與 cocoya 相同。
`port_signature()` / `should_emit()` 為純函式，可單元測試。

### 8. 序列埠下拉行為（移植 cocoya `ui/hardware.js` 已驗證的邊界處理）
- **偏好埠**：localStorage `codebridge_preferred_port`，**僅使用者手動點選時寫入**；autoSelect 第一埠不覆寫（否則拔線時自動選到 COM1 會蓋掉偏好）。
- 目前選取的埠消失：① 偏好埠若出現 → 跳回；② 否則退回第一個並自動切板。
- **偵測不到任何埠時仍保留已選取項**（避免下拉清單消失，且維持上傳/監看能力）。
- `port→VID:PID` 顯示於 tooltip；`port→fqbn` 自動填入 `meta.fqbn`。
- **上傳前板子比對**（cocoya `ui/base.js:324-336`）：`meta.fqbn` 與偵測 fqbn 不符 → 走既有 `CodeBridgeConfirm` 確認對話框（`MSG_BOARD_MISMATCH`）。

### 9. Preset 主題（Engineer 深色科技 / Angel 明亮糖果）
- **必修缺陷**：`style.css:284-331` 終端機面板寫死深色（`#1e1e1e` / `#2d2d30` / `#d4d4d4`），在 Angel 淺色 preset 下是突兀黑塊，違反 preset 契約。改用 `--cb-*` token：
  `--cb-terminal-bg` / `--cb-terminal-header-bg` / `--cb-terminal-border` / `--cb-terminal-text` / `--cb-terminal-error` / `--cb-terminal-info` / `--cb-terminal-success`。
- 新增 `.code-line.diag-error` / `.diag-warning` / `.diag-info` 的兩主題樣式（沿用既有 `.code-line.highlight-line` 寫法）。
- **icon 規則**：`presets.css:308-336` 已用 CSS `filter` 為 `.toolbar-btn img` / `#file-breadcrumb img` / `.dropdown-item img` / `.dropdown-header img` / `.toolbar-caret img` / `.terminal-tool-btn img` 統一著色。因此：
  1. 新 UI 元件必須沿用這些 class，icon 才自動適配兩套 preset。
  2. 只複製**黑色系（`_1F1F1F`）或不帶色碼**的圖示；cocoya 的彩色變體（`_FE2F89` / `_75FB4C` / `_EA3323`）在 engineer 下會被 filter 覆蓋，造成兩主題不一致。
- 視覺切換不得 clear/reload workspace（既有 `CodeBridgeTheme` 契約）。

### 10. Icon 來源（自 cocoya 複製）
| 用途 | 來源 | CodeBridge 現況 |
|---|---|---|
| 偵測板子 | `sync_24dp_EA3323.png` | ✅ 已有 |
| 板子面板標題 | `microchip-board.png` | ➕ 複製 |
| USB / 裝置連線 | `usb-bold.png` | ➕ 複製 |
| 終端機關閉 | `close-octagon.png` | ➕ 複製（現用文字 `×`） |
| 終端機開闔 | `terminal_24dp_1F1F1F.png` | ✅ 已有 |
| 清除 / 暫停 | `clear_log_24dp_1F1F1F.png` / `list_arrow_24dp_FE2F89.png` | ✅ 已有 |
| 執行 / 停止 / 重試 | `run_blocks_24dp_75FB4C.png` / `stop_24dp_EA3323.png` / `replay_circle_filled_24dp_FE2F89.png` | ✅ 已有 |
| 設定 | `dashboard_customize_24dp_1F1F1F.svg` | ✅ 已有 |

### 11. i18n
沿用 cocoya 語彙（`TLB_SERIAL_REFRESH: 偵測板子`、`TLB_NO_PORT: (無序列埠)`、`TLB_TERMINAL_TITLE: 終端機`）。
新增 `TLB_SELECT_BOARD` / `TLB_BOARD_SEARCH` / `TLB_BOARD_INSTALLED` / `TLB_BOARD_ALL` / `TLB_BOARD_NO_CORE` / `MSG_BOARD_MISMATCH` / `CLI_DETECTING_BOARD` / `CLI_BOARD_DETECTED` / `CLI_COMPILE_*` / `CLI_UPLOAD_*` / `CLI_SIZE_FLASH` / `CLI_SIZE_RAM` / `CLI_ERROR_NO_FQBN` / `CLI_ERROR_NO_PORT` / `CLI_ERROR_BUILD_STALE` / `CLI_ERROR_NO_CORE` / `DRAFT_ERROR_*` / `TLB_STOP_HINT`。
新增 `ui/tests/unit/i18n-keys.test.js` 驗證兩語系 key 集合完全一致（cocoya 無此測試，本專案補上）。
`btn-stop` 語意 = **取消目前的編譯或上傳作業**（上傳完成後無常駐程序），需於 tooltip 說明。

### 12. 安全
`tauri.conf.json` 補 production CSP（Tauri v2 需 `ipc: http://ipc.localhost`），結束 `csp: null`。

## Testing Decisions
- **Rust**（`cargo test`）：`draft.rs`（stem 轉換、檔名同名、無 BOM、LF、清殘留、路徑穿越）、`encoding.rs`（UTF-8 / Big5 / GBK / 混合位元組 / 全無效位元組）、`runner.rs`（`ScriptedChild` 行序、timeout、cancel、雙管線不死鎖）、`pipeline.rs`（草稿內容不含 `__BLOCKLY_ID__`、`--build-path`、diagnostics 解析、`BUILD_STALE`、非法 FQBN）、port watcher（簽章 diff）。
- **前端**（`vitest`）：`compile-controller`（strip 後送碼、單飛、取消、錯誤 key 解析、diagnostics 行 class、非本專案 .ino 不跳轉、非 Tauri 降級）、`board-detector`（偏好埠跳回、空埠保留原選取、自動切板、in-flight 抑制）、`terminal-panel`（雙門檻 flush、pause、clear、close）、`plain-code`（行數不變）、`toolbar-buttons`（凍結清單更新、補 `diagnose`）、`i18n-keys`（兩語系一致）。
- **E2E**（Playwright，純瀏覽器）：非 Tauri 環境 `btn-run` 維持 disabled 並有可翻譯提示。
- **真機 smoke**：本機已安裝 `arduino-cli 1.2.0` → 裝 `arduino:avr` core → 產生語法錯誤草稿驗證行號一致 → 實際上傳 Uno。
- 順序：`cargo test` → `npm run test:unit` → smoke → `npm test` → `npm run build` → `cargo build`。

## 分階段
| 階段 | 內容 |
|---|---|
| T2-A | Rust 核心：`encoding.rs`、`draft.rs`、`runner.rs` 串流、`pipeline.rs` |
| T2-B | Rust：`compile_start` / `upload_start`、`last_builds`、`port_lease`、port watcher、CSP |
| T2-C | 前端：`compile-controller.js`、`terminal-panel.js`、工具列按鈕、終端機 token 化 |
| T2-D | 前端：`board-detector.js`、板子選擇面板、`serial-selector`、`MSG_BOARD_MISMATCH` |
| T2-E | i18n、icon 複製、`FILE_STRUCTURE.md`、`log/todo.md`、工作日誌 |

## Out of Scope
- Board Manager / Library Manager 的安裝 UI（`btn-diagnose` 本輪維持 disabled，僅顯示安裝引導）
- Serial Monitor 實際資料流（T3；本輪只預留 `port_lease` 與鈕狀態）
- 匯出 `.ino`（貼到 IDE 的需求已由「複製程式碼」滿足）
- 序列 Plotter

## Further Notes
- 本輪唯一新增 crate 為 `encoding_rs`；`uuid` / `serialport` 已在 `Cargo.toml`。
- `diagnostics.rs` 既有註解已說明「檔案路徑不可能含有冒號＋空格」，Windows 磁碟機代號自然被排除；行號契約沿用此前提。
- `btn-diagnose` 在 `index.html` 有 `data-action` 但 `toolbar-registry.js` 無對應條目，本輪補齊（`implemented: false`）讓 registry 與 HTML 100% 一致。

## 實測抓到的兩個真實 Bug（整合測試的價值）
`src-tauri/tests/arduino_cli_smoke.rs` 對真實 `arduino-cli` 執行端對端驗證，抓到兩個單元測試完全無法發現的缺陷：

1. **`command::version()` 漏掉子命令 token**（T1 遺留）。
   症狀：arduino-cli 印出整頁 help 文字並以 **exit 0** 結束；`toolchain_detect` 因此會把 help 當成版本 JSON 而解析失敗。
   修法：`args` 補上 `version`；並新增 `every_builder_passes_its_subcommand_token` 逐一驗證所有 builder 都帶有子命令 token（原測試只斷言 `--format` 存在，因此漏掉了）。
2. **串流 runner 在子程序結束瞬間可能遺失最後幾行**。
   症狀：`version`（6 行輸出、結束極快）回傳**空的 stdout**，而 `board list`（輸出較大）正常 —— 典型的時序競爭。
   原因：`try_wait()` 回報結束時，reader 執行緒仍有「在途的行」沒送進 channel，`drain_remaining` 只抽得出已送達的部分。
   修法：結束前**先 join 所有 reader 執行緒再抽乾**。

此外，`VersionString` 的格式隨 CLI 版本而異（1.2.0 是 `"1.2.0"`，較新版是 `"arduino-cli Version: 1.5.0"`），解析端不得依賴字面格式。

## 已完成階段
- **T2-A（Rust 核心）**：`encoding.rs`、`draft.rs`、`runner.rs` 串流化、`pipeline.rs`、`command::version` 修正、`tests/arduino_cli_smoke.rs`。
  驗證：`cargo test` → 163 單元測試 + 4 整合測試全數通過。
- **T2-B（Tauri 命令與事件串流）**：`events.rs`（`FlushPolicy` 雙門檻節流、`EventSink`）、`compile_start` / `upload_start` / `upload_ready`、`AppState.last_builds` 與 `port_lease`、移除 `Operation.child` 死碼、`csp` + `devCsp`。
  驗證：`cargo test` → 178 單元測試 + 4 整合測試全數通過；`cargo build` 無新增警告。

### T2-B 的關鍵設計
1. **後端權威的 build 路徑**：`upload_start` 的 payload 只有 `projectId` / `fqbn` / `port`；build 目錄一律從 `AppState.last_builds` 查出。若讓前端傳入 `--input-dir`，惡意的 webview 就能要求把任意目錄的內容寫進晶片。
2. **雙門檻節流**（對齊 cocoya `commands/mcu.rs`）：`200ms` 或 `64 行` 任一達成就 emit。節流決策抽成純函式 `FlushPolicy::take_flush()`，因此不需要 Tauri app 就能完整測試。
3. **埠佔用鎖**：`port_lease` 在上傳前取得、**無論成功與否都釋放**，並對同一埠冪等（避免重複點擊自我阻塞）。T3 的 Serial Monitor 沿用同一把鎖。
4. **事件模組位置**：`events.rs` 刻意放在 `arduino/` 之外，讓 `arduino` 模組維持零 Tauri 依賴（可純單元測試、未來可換 host）。事件名稱集中在 `events::names`。
5. **CSP**：`csp`（正式）＋ `devCsp`（Vite HMR）雙軌取代 `csp: null`；Tauri v2 必須保留 `ipc:` / `http://ipc.localhost`，否則 IPC 與資產載入會被擋。
