# CodeBridge 任務進度

## 目錄

- [目前待辦](#目前待辦)
- [計畫文件](#計畫文件)
- [2026-09-29](#2026-09-29)
  - [T3 設定中心階段 1：settings.json 持久化與「進階 › 路徑」](#2026-09-29t3-設定中心階段-1settingsjson-持久化與進階--路徑)
- [2026-09-28](#2026-09-28)
  - [.cbg 檔案格式規格化與多行存檔](#2026-09-28cbg-檔案格式規格化與多行存檔)
  - [修正重整後使用者回報的兩個缺陷](#2026-09-28修正重整後使用者回報的兩個缺陷)
  - [序列繪圖（Serial Plotter）](#2026-09-28序列繪圖serial-plotter)
  - [.cbg 模式重整與上傳依賴端口重定案](#2026-09-28cbg-模式重整與上傳依賴端口重定案)
  - [序列監視器（Serial Monitor）](#2026-09-28序列監視器serial-monitor)
- [2026-09-27](#2026-09-27)
  - [T3 設定中心與核心目錄共用化（計畫）](#2026-09-27t3-設定中心與核心目錄共用化計畫)
  - [T2-E 使用者回報修正（三項阻擋性缺陷）](#2026-09-27t2-e-使用者回報修正三項阻擋性缺陷)
  - [T2-E 實機驗證（真實編譯）](#2026-09-27t2-e-實機驗證真實編譯--抓出每次編譯都失敗的嚴重缺陷)
  - [T2-E（開發板選擇面板）](#2026-09-27t2-e開發板選擇面板)
  - [T2-D（板子／序列埠自動偵測）](#2026-09-27t2-d板子序列埠自動偵測)
  - [T2-D 前置（EventSink 緩衝修正 + 序列埠 watcher）](#2026-09-27t2-d-前置eventsink-緩衝修正--序列埠-watcher)
- [2026-09-26](#2026-09-26)
  - [Arduino CLI 編譯與上傳（Phase T2-C：前端控制器與終端機）](#2026-09-26arduino-cli-編譯與上傳phase-t2-c前端控制器與終端機)
  - [工具列實作與 .cbg 專案](#2026-09-26工具列實作與-cbg-專案)
- [2026-09-25](#2026-09-25)
- [2026-07](#2026-07)

---

## 計畫文件

> **下一輪必讀**。動工前先讀對應計畫，避免重蹈覆轍。

| 計畫 | 檔案 | 狀態 |
|---|---|---|
| **TDD 守門精簡化（Test Gating）** | [`log/plan/TestGating_2026-09-30.md`](plan/TestGating_2026-09-30.md) | **CB-T1 完成（2026-09-30）** —— CI 已補跑 261 單元測試；CB-T2~T5 待實作 |
| **序列監視器（T3 Phase 1）** | [`log/plan/SerialMonitor.md`](plan/SerialMonitor.md) | **實作完成（2026-09-28）** —— 單元測試通過，待實機驗證 |
| **序列繪圖（T3 Phase 2）** | [`log/plan/SerialPlotter.md`](plan/SerialPlotter.md) | **實作完成（2026-09-28）** —— 左右分欄，單元與 E2E 全過，待實機驗證 |
| **T3 設定中心與核心目錄共用化** | [`log/plan/SettingsCenterAndCoreSharing.md`](plan/SettingsCenterAndCoreSharing.md) | **階段 1 已完成（2026-09-29）** —— 路徑共用 + settings.json 持久化 + 設定頁全數上線 |
| Arduino CLI 編譯與上傳（Phase T2） | [`log/plan/ArduinoCompileUpload.md`](plan/ArduinoCompileUpload.md) | 已完成（2026-09-27） |
| 工具列實作與 .cbg 專案 | [`log/plan/ToolbarImplementation.md`](plan/ToolbarImplementation.md) | 已完成 |
| Blockly v13 升級 | [`log/plan/BlocklyV13Upgrade.md`](plan/BlocklyV13Upgrade.md) | 已完成 |
| 體驗主題架構 | [`log/plan/ExperienceThemeArchitecture.md`](plan/ExperienceThemeArchitecture.md) | 已完成 |
| 程式碼視覺樣式 | [`log/plan/BlockStyles.md`](plan/BlockStyles.md) | 已完成 |

---

## 目前待辦

> 本節為**彙整視圖**，集結各日期章節中所有未完成項目。
> 各章節內仍保留原始清單以維持歷史紀錄，兩者若有差異以本章節為準。

### TDD 守門精簡化（2026-09-30 計畫，詳見 [`log/plan/TestGating_2026-09-30.md`](plan/TestGating_2026-09-30.md)）
> 背景：對齊 cocoya 的 TDD 守門檢查。問題不是測試不夠，而是「快的測試沒被 CI 驗、慢的測試被塞進日常守門」。
- [x] **CB-T1（P1）CI 補跑單元測試**（2026-09-30 完成）：`frontend-blockly.yml` 原本只跑 Playwright 全 14 支 spec 與 build，**`vitest run tests/unit`（261 例）從未在 CI 執行**；已於 `npm ci` 後插入 `Run frontend unit tests`（`npm run test:unit --prefix ui`），並修正 `AGENTS.md` 與 workflow 不符的敘述。驗證：unit 261/261、assets exit 0、YAML 解析步驟順序正確
- [x] **CB-T2（P1）心跳測試改可控計時器**（2026-09-30 完成）：原真的 `setTimeout(1100)` 等兩輪耗 **2227ms**（佔單元套件 78%）。`vi.useFakeTimers()` **無效**（`classic-script.js` 於載入時把計時器依值複製進 vm sandbox），改為在 `loadClassicScript(path, globals)` 注入可控 `setInterval/clearInterval`，測試手動觸發。單檔 2390ms → **210ms**；全量 261 例 2.86s → **0.756s**。已完成紅→綠→再紅三段驗證（暫時註解產品端 `startUploadHeartbeat()` 確認測試會紅，`expected null to be type of 'function'`，隨後 `git checkout` 復原）
- [x] **CB-T3（P2）分層測試腳本**（2026-09-30 完成）：`ui/package.json` 新增 `test:unit:fast`／`test:e2e`／`test:e2e:smoke`／`test:fast`；根目錄補 `test:unit`／`test:unit:fast`／`test:e2e`／`test:e2e:smoke`／`test:fast`／`cargo:check`（皆以 `--prefix ui` 轉發）。根 `npm test` 語意維持 unit + Playwright 全量
- [x] **CB-T4（P2）`scripts/test-related.mjs`**（2026-09-30 完成）：移植 cocoya 設計並改寫規則（產品檔與測試檔**分屬不同樹**，改以 `tests/unit/` 遞迴索引比對**檔名**；Blockly 模組升級 E2E；`.css` 升級 `theme-runtime`；Rust/Python 提示 `cargo:check`）。支援 `--dry`／`--unit-only`。實跑 L0：37/37、1.4s
- [x] **AGENTS.md 守門規範**（2026-09-30 完成，依使用者提議）：新增〈測試執行分層守門 (Test Gating)〉——L0/L1/L2/L3 對照表（含實測耗時）、L0 挑選規則、**計時器紅線**（vm sandbox 陷阱＋紅→綠→再紅要求）、AI 協作紀律。刻意排在 CB-T3／T4 之後，確保規範引用的指令皆已存在
- [x] **CB-T5（P3）清除測試輸出雜訊**（2026-09-30 完成）：根因不是「多餘 log」，而是 `ui/vite.config.js` 的 `copyCodeBridgeAssets` plugin **沒有 `apply` 限制**，vitest 每次結束（server `closeBundle`）都會觸發，把整個 `src/` 與 `blockly/` **遞迴複製進 `dist/`**（每次跑測試都發生）。加 `apply: 'build'` 後：測試不再輸出 `[Vite] Copying static folder` ×3，也不再產生無謂磁碟 I/O；`npm run build` 仍正常產出 `dist/src`、`dist/blockly`、`dist/index.html`（已實測）
- [x] **CI 拆分 unit／e2e（決策點 1，2026-09-30 完成）**：`unit`（4 steps，Vitest 261 例／約 0.7s）與 `blockly-contract`（`needs: unit`，7 steps，Blockly assets → Playwright 全量 → build → 失敗上傳 report）。代價：兩 job 各跑一次 `npm ci`（由 setup-node 的 npm cache 抵銷）。兩者皆阻塞式，任一紅燈即整體失敗
- [x] **CI 失敗 run #12 根因已確認並修復**（2026-09-30）：使用者提供日誌 → `npm error code EUSAGE`、`Missing: @emnapi/core@1.11.3 from lock file`／`@emnapi/runtime@1.11.3`。根因為 **`node-version: 24` 浮動版本 → npm 版本漂移**：舊 lock 只有 `@rolldown/binding-wasm32-wasi`（`cpu:["wasm32"]` 選用套件）底下的巢狀 `@emnapi/core@1.11.1`，npm 11.6.2 驗證通過、npm ≥11.19 要求頂層 `1.11.3` → EUSAGE。已用新版 npm 重建 lock（+28/−3：補頂層 1.11.3×2、修正 lock 內 `version: 0.1.0 → 0.2.0`），**npm 11.6.2 與 11.19.1 雙版 `ci --dry-run` 皆通過**，真實 `npm ci` exit 0、單元 261/261、build 產出完整
- [x] **CI run #13 紅燈已修**（2026-09-30）：lock 修復生效（`npm ci` 已 success），但新上線的 `unit` job 秒紅。根因：`ui/public/blockly/**` 官方資產在 `core.autocrlf=true` 環境（Actions 的 windows-latest）被轉成 CRLF，`VERSIONS.md` 的 bytes／SHA-256 對不上 —— 14 個資產 12 個不符。`.gitattributes` 加 `ui/public/blockly/** -text`，且必須放在檔案**最後**（git 屬性後者勝出，寫在 `*.js text` 之前會失效，本次踩過）。驗證：模擬 CI checkout（`git -c core.autocrlf=true clone`）後 14/14 PASS，且在該 clone 內 `npm ci` + 261/261 全綠
- [x] **CI run #14 全綠（2026-09-30）**：首次完全通過。`Frontend unit tests` ✅ 30 秒；`Frontend Blockly contract` ✅ 3 分 53 秒（`npm ci` 5s → Blockly assets 2s → **Playwright 全量 14 支 spec 3 分 21 秒** → build 1s）。證實 Playwright 在 Actions 的 system Edge 上可跑通
- [x] **夜間全量（nightly）決策：暫不採用**（2026-09-30）：E2E 實測 3 分 21 秒，本專案規模下每次 push 多等約 4 分鐘尚可接受；且 E2E 才剛在 CI 上線跑通，先讓它當幾次哨兵確認穩定，再評估是否把全量改到 `schedule` 排程（push/PR 只跑 unit ＋ `test:e2e:smoke`）
- [ ] 決策：是否將 `actions/*@v4` 升級　⚠️ **更正紀錄**：先前誤記為「升 v5」，實際查證（GitHub API，2026-09-30）最新為 **`actions/checkout` v7.0.1、`actions/setup-node` v7.0.0、`actions/upload-artifact` v7.0.1**，是**跨 3 個 major**。好處是消除 Node.js 20 deprecation 警告（v5+ 以 Node 24 為目標）；風險是跨 major 可能有破壞性變更（本專案只用單一 artifact 名稱 `playwright-report`，應相容）。**建議在 CI 連續綠燈一段時間後再一次升級並實測**，避免與其他變更同時發生而難以歸因

### 工具列後續（2026-09-26 本輪凍結，需另開一輪）
- [x] Phase 3 Serial Monitor：**已於 2026-09-28 完成**（port/baud/重連/HEX/時間戳/開發者輸入行），詳見 [序列監視器章節](#2026-09-28序列監視器serial-monitor)
- [ ] 序列監視器**實機驗證**（CH340 UNO clone 實測序列輸出、上傳前後自動重連）
      - 2026-09-28 第一輪：修正「Monitor 一開啟就死掉」（`Err(TimedOut)` 誤判為斷線）✅
      - 2026-09-28 第二輪：修正「埠未釋放」+「baud 錯誤無反應」+「上傳暫停無提示」✅
      - **待第三輪實機驗證**
- [x] Serial Plotter（序列繪圖）：**已於 2026-09-28 完成**（左右分欄、CSV/`label:value`/TSV/布林、ring buffer、min/max 下抽樣、圖例切換、時間窗 3/10/30s、窄視窗堆疊），詳見 [序列繪圖章節](#2026-09-28序列繪圖serial-plotter)
- [ ] Serial Plotter **實機驗證**（以真實感測器資料確認曲線與圖例正確）
- [x] **2026-09-28 第三輪使用者回報修正（5 項）**：
      - `Serial.begin` 預設鮑率改為 **9600**（清單順序維持遞增不動）✅
      - 程式預覽面板加入**行號**（CSS counter，不混入程式碼文字）✅
      - 序列繪圖時間窗預設由 10 秒改為 **3 秒** ✅
      - 修正「開啟繪圖按鈕狀態沒有切換」——`closePlot()` 只呼叫 `syncStatus()` 沒移除 `is-active` ✅
      - 核心／函式庫編譯警告**分流顯示**（方案 B）✅
- [x] `btn-run` / `btn-stop` 已於 T2-C 上線，並在 T2-D/T2-E 補齊板子／序列埠選擇與完整上傳流程（**已於 2026-09-27 完成並實機驗證通過**）
- [x] Phase 4 `btn-diagnose` 與設定選單擴充 → **已併入 T3 設定中心計畫**，詳見下方章節
- [ ] `.cbg` Windows 副檔名註冊與雙擊開檔（argv 解析、NSIS/WiX 自訂腳本）
- [ ] **打包後驗證內建範例**：`select_examples_dir()` 已處理開發與打包兩種資源佈局（包含空殼目錄陷阱），但尚未以打包版實測
- [ ] **實機確認手動選板後的上傳**：CH340 clone 板無法自動偵測（後端認不出），必須靠 `board-detector.manualFqbn` 覆寫層
- [ ] `APP_VERSION` 目前硬編為 `0.2.0`，應改為單一 package / Tauri version 來源（`cbg:app` 已引用此值）
- [ ] **實機驗證 Blockly 註解 round-trip**：開啟 `03_plot-waves.cbg` → 存檔 → 確認教學註解仍在
- [ ] 匯出 `.ino` 檔（選配；貼到 IDE 的需求已由「複製程式碼」滿足）
- [ ] 工具列組態治理：讓 `btn-exit-practice`、`btn-cheat-close` 也經過 `data-action` 契約（目前由 practice-mode.js 自行綁定）
- [ ] 總提供 `chevron-down` 與 `history` 圖示（下拉與最近專案圖示）

### 下一階段主線：Arduino CLI 工具鏈 Phase T2（2026-09-27 全數完成）
- [x] T2-C：前端 `compile-controller.js`、`terminal-panel.js`、工具列 `btn-run`/`btn-stop`/`btn-terminal` 上線
- [x] T2-D 前置：`LineBuffer` 修正 + `PortInfo` 簽章 diff + `serial-ports-changed` 事件與背景 watcher
- [x] T2-D 主體：`board-detector.js`（熱插拔、偏好埠、自動切板）、序列埠下拉與 `btn-refresh-serial`、`MSG_BOARD_MISMATCH` 上傳前比對
- [x] 板子選擇面板：`board-picker.js` 搜尋過濾、手動選板、常用板快捷列、核心安裝入口
- [x] 桌機實機編譯驗證：真實 `arduino-cli` 編譯成功，並修正「草稿資料夾名 ≠ 主檔名」導致**每次編譯都失敗**的嚴重缺陷
- [x] **實體上傳驗證**（**已於 2026-09-27 完成**）：使用者以第三廠 UNO clone（CH340，VID `0x1A86`）實測，編譯 924 bytes／2%、avrdude 寫入 flash 成功（`Device signature = 0x1e950f`）
- [x] ~~評估「匯入使用者既有核心」~~：**已於 2026-09-27 決策** —— 不做「匯入」，改為**預設共用** `arduino-cli` 系統目錄（官方慣例），保留獨立模式開關
- [x] 實機除錯（7 項使用者回報缺陷全數修正）：Tauri payload 包裝、編譯／上傳競態、`setMeta` 合併語意、開範例保留設備選擇、事件欄位名不一致、啟動即偵測、上傳心跳

### 下一階段主線：Phase T3 設定中心（計畫已核准，階段 1 部分完成）
- [ ] **先讀計畫**：[`log/plan/SettingsCenterAndCoreSharing.md`](plan/SettingsCenterAndCoreSharing.md)
- [x] **階段 1（路徑預設共用）**：`ArduinoCliDirs::probe()` 以 `arduino-cli config get` 為權威來源，`ToolchainDirs::shared()` 預設共用系統目錄，產物（`build_root`）仍隔離；真實 smoke 測試實測通過
- [x] 階段 1（**已於 2026-09-29 完成**）：`settings.json` 持久化（`AppSettings`）、`toolchain_get_dirs` / `toolchain_set_dirs`（回報**當前值 + 來源**）、`AppState.toolchain_dirs` 改 `RwLock`、設定對話框「進階 › 路徑」上線（`settings.js`），詳見 [T3 設定中心階段 1 章節](#2026-09-29t3-設定中心階段-1settingsjson-持久化與進階--路徑)
- [ ] 階段 1（未做）：`board-picker.canInstallCore()` 改為檢查 **CLI 是否可用**（CLI 缺失時顯示「請先到設定中心安裝」而非會失敗的按鈕）；首次啟動的環境檢查提示（可關閉）
- [ ] 階段 2：開發板管理器（`core_remove`、`core_update_index`；把 `board-picker` 的臨時安裝按鈕升級）
- [ ] 階段 3：函式庫管理器（`lib_search` / `lib_install` / `lib_remove`）
- [ ] 範圍限制：只做 CodeBridge 用得到的設定，**不做**通用 Arduino 環境管理器（不提供 `additional_urls` 編輯等）
- [x] `btn-diagnose` 的診斷資訊改由設定中心「進階 › 診斷」承載 —— **2026-09-29 已上線**（`btn-diagnose` 移除 `disabled`，點擊開啟設定中心路徑頁）
- [ ] T2-E 收尾：自 cocoya 複製 `microchip-board.png`／`usb-bold.png`／`close-octagon.png`、終端機面板與診斷樣式的 preset 微調
- [x] i18n 新 key（中英兩份已補齊）：`CLI_ERROR_*`、`DRAFT_ERROR_*`、`CLI_STREAM_*`、`CLI_COMPILE_STARTING`、`CLI_UPLOAD_STARTING`、`CLI_UPLOAD_SUCCESS`、`CLI_UPLOAD_BUSY_HINT`、`CLI_SIZE_*`、`TLB_BOARD_*` 等

### 已定案的產品問題（2026-09-27）
- [x] **停止鈕移除 + 逾時保護**：`compile` 上限 **5 分鐘**、`upload` 上限 **60 秒**（Rust `COMPILE_TIMEOUT` / `UPLOAD_TIMEOUT`）。作業不再永久停潛，不需中途取消的入口；且同時避開了「燒錄中斷」留下半尾 flash 的風險
  - 已從 `index.html`、`toolbar-registry.js`、`toolbar.js`、`compile-controller.stop()` 與相關測試中移除
  - 保留 `operation_cancel` 後端命令（T3 Serial Monitor 可能用得上），前端暫無呼叫端

### 主題架構後續（2026-09-26 palette contract）
- [ ] 第三方模組若要加入 palette contract，目前需自行宣告 `blockTypes` / `typePrefix`；可考慮併入 `core_manifest.json` 由 loader 自動呼叫 `registerModule()`
- [ ] 評估是否保留 piBlockly v12 XML migration（`ui/src/lib/blockly/xml-migration.js`）

### 模組匯入
- [ ] 從網路匯入感測器與致動器模組（對齊 #piBlockly 匯入的 #pbm）

### 待驗證（2026-07 Loops 模組）
- [ ] 所有 3 個 Loops 積木可拖入工作區（while / for / break/continue）
- [ ] 程式碼生成正確（while, for, break/continue）
- [ ] 風格切換後分類名稱與積木文字正常
- [ ] 孤兒積木檢測正常

### 待驗證（2026-07 Blockly 工作區註解）
- [ ] 工作區註解功能在瀏覽器中正常運作
- [ ] 工作區註解的保存／載入（XML 序列化）

### 品質與測試
- [x] ~~`toolbar.spec.js`「內建範例可載入」失敗~~：**已於 2026-09-27 修正**。命名來源統一為範例檔內的 `cbp:name`（`blink.cbg` 改為 `Blink`），並以 `project-io.js` 的 `parsed.meta.name || nameFromPath(file)` 作為唯一回退，不再依賴檔名大小寫
- [x] ~~`blockly-migration.spec.js` 的 `controls-for` 多 worker 偶發重複行~~：**已於 2026-09-27 驗證通過**。2026-09-27 以多 worker 全量執行 90 項 E2E 全部通過，未重現；若日後再出現，先以 `--workers=1` 對照並檢查 loops generator 的無狀態性
- [ ] 將目前一次性的 Edge smoke test 納入長期 CI fixture
- [ ] 隨新模組增加更多 v12 XML 與 generator golden fixtures
- [ ] marked code 與 plain code 分離後，golden tests 改驗正式輸出不含 ID marker
- [ ] 若未來 Blockly 支援可安全建立 headless temporary block，可移除 `controls_for` 的暫時實例化 skip，改為更完整的欄位文字索引
- [ ] 若 Variables dynamic category 需要被搜尋，可新增 definition adapter，不直接掃描所有全域 block types
- [ ] 若需要真正的 runtime 整合測試，可考慮以 `arduino-cli` 官方 binary 作為 CI fixture，或維持目前的 `FakeProcessRunner` 純單元測試策略

---

# 2026-09-29

## 2026-09-29：T3 設定中心階段 1：settings.json 持久化與「進階 › 路徑」

### 狀態

已完成。補上 2026-09-27 階段 1 留下的最後一塊：讓「共用／隔離」這個開關
真的**可以被使用者操作並跨啟動保留**，且畫面同時顯示「當前值 + 來源」。

### 已完成

- [x] **`src-tauri/src/settings.rs`（新增）**：`AppSettings { cliPath, isolated, buildRoot }`
  - 缺檔、壞檔、空檔一律退回預設，**不回傳錯誤** —— 設定檔壞掉不該讓
    CodeBridge 開不了機，使用者會連「重設設定」的逃生門都沒有
  - 容忍 UTF-8 BOM（使用者可能用記事本編輯過）與未知欄位
  - `save()` 採「寫 `.tmp` 再 rename」的置換式寫入，避免中途中斷產生半個 JSON
  - `resolved_build_root()`：空白字串視為未設定（使用者清空欄位是常見操作）
  - 10 項單元測試
- [x] **`AppState` 接上設定**（`lib.rs`）
  - 新增 `settings` / `app_data_dir` / `settings_path` 欄位
  - `AppState::new()` 先讀 `settings.json` 再組 `ToolchainDirs`；
    另提供 `from_settings()` 供測試與設定更新路徑使用
  - `with_isolation()` 移除（其職責已被 `settings.isolated` 取代）
  - `toolchain_dirs` 由 `ToolchainDirs` 改為 `Arc<RwLock<ToolchainDirs>>`
  - `build_root` 獨立套用 `settings.buildRoot`（產物隔離是獨立決策，不受共用開關影響）
  - 3 項整合測試（跨啟動保留、build_root 覆寫、首次啟動必須是共用）
- [x] **新命令**（`commands.rs`）
  - `toolchain_get_dirs`：回傳 `ToolchainDirsReport`，**每個目錄都帶 `source`**
    （`systemDefault` / `appIsolated` / `userConfigured`）—— 計畫文件決策四
  - `toolchain_set_dirs`：**先寫檔再套用**（寫失敗就不該讓記憶體與磁碟不一致），
    參數為 `Option<Option<T>>` 以區分「未提供」與「明確清除」
  - `refresh_dirs()`：設定變更後就地重建 `ToolchainDirs` 並 `ensure()` 目錄
  - `toolchain_set_cli_path()` 補上寫入 `settings.json`（原本只改記憶體，
    使用者重開就會發現設定自己消失）
  - `current_dirs()` helper：鎖中毒時退回隔離佈局，而非讓應用程式 panic
- [x] **`ui/src/lib/arduino/settings.js`（新增）**：設定對話框
  - 每個欄位顯示**當前值 + 來源**；CLI 路徑欄位預填目前生效的值
  - 「使用 CodeBridge 專屬目錄」開關 + 共用模式的說明文字
  - 顯示 `settings.json` 的實際位置（使用者要知道設定存到哪去了）
  - 入口為選單中的「環境診斷」（`btn-diagnose` 移除 `disabled`）
- [x] **i18n**（中英各 15 個 key）：`SETTINGS_*`、`DIR_SOURCE_*`、`SETTINGS_ERROR_*`
- [x] **CSS**（`style.css`）：`.cb-settings-dialog` 與 `.cb-setting-*` 系列
- [x] **測試**：`ui/tests/unit/settings.test.js`（14 項）+
      `ui/tests/e2e/settings.spec.js`（6 項）
- [x] `tauri-mock.js` 加入 `toolchain_get_dirs` / `toolchain_set_dirs` 模擬

### 技術深挖 (Technical Deep Dive)

#### 設定必須寫檔，不能只留在記憶體

原本的 `toolchain_set_cli_path()` 只改 `state.cli_path_override`。
症狀會是「設定可以改，但重開就消失」—— 那比沒有設定功能更令人困惑，
因為使用者會以為自己記錯了。`toolchain_set_dirs()` 因此強制
**先 `save()` 成功才更新執行期狀態**。

#### `Option<Option<T>>` 是刻意的，不是過度設計

前端「只送使用者真正更動的欄位」，後端就必須能區分三種狀態：

| 前端送出 | 語意 |
|---|---|
| 欄位不存在（`None`） | 使用者沒動它，**沿用現有值** |
| `Some("")` | 明確清除（CLI 改回系統 `PATH`、產物目錄回預設） |
| `Some("D:/x")` | 設成新值 |

若後端簽章是 `Option<String>`，第二種會被空字串過濾吃掉，
變成「清空欄位 = 沒反應」。

#### 前端不能自己算路徑

設定頁顯示的每一個目錄值都必須來自後端回報。切到隔離模式後，
實際目錄是 `<app_data>/arduino/data` 這種後端才知道的組法；
前端若自行拼接會顯示一個不存在的目錄，使用者照著去檔案總管找就找不到。
`save()` 的回傳值也直接取代本地推測值。

#### `stopPropagation()` 差點弄壞工具列下拉選單

初版把開啟對話框綁在齒輪鈕 `#btn-settings-root` 上並呼叫 `stopPropagation()`。
但那顆按鈕同時是 `toolbar.js` 的 dropdown 觸發器，攔截事件會讓
**整個下拉選單（主題切換、語言切換）全部失效**。
症狀：`theme-runtime.spec.js` 的兩項測試紅燈（dropdown 不可見、
`elementFromPoint` 命中的不是選單內容）。

改成把入口放在選單項目「環境診斷」上 —— 這也正好符合 todo 既定決策
「`btn-diagnose` 的診斷資訊改由設定中心承載」。已補回歸測試鎖住。

#### 編輯器插入位置差一個字元，讓函式掉出 IIFE

`dirRow()` 被插到 `})();` 之後（模組作用域），`text()` 因此不可見，
`render()` 拋 `ReferenceError: text is not defined`。
症狀很模糊：對話框開得起來但**內容全空**，而 `getReport()` 仍回傳正確資料
（`lastReport` 在 `render()` 之前就已賦值）。

**除錯教訓**：`load()` 的 `.catch()` 會把 `render()` 丟出的例外一起吞掉，
症狀是「靜默失敗」而非報錯。當預期副作用沒發生時，
應先在 `render()` 周圍臨時包 `try/catch` 把例外印出來，而不是猜。

### 使用者回報修正：設定中心版面（字級無主從、項目無分隔、文字溢出）

**回報**：設定對話框「字體大小一致沒有主從之分，項目也沒有清楚分隔，且文字太大跑到面板外了」。

#### 根因不是字級設計，而是少了一個結尾大括號

前一輪我用編輯器在 `style.css` 的 `.cb-dialog-button.is-primary:hover` 之後插入
`.cb-setting-*` 樣式時，**吃掉了該規則的結尾 `}`**。CSS 沒有語法錯誤檢查，
於是後面整段設定中心樣式都被巢狀成：

```css
.cb-dialog-button.is-primary:hover {
    background: var(--cb-primary-hover, #FE2F89);
    /* ↓ 後面 200 行全部變成這條規則的內容 */
    .cb-settings-dialog { max-width: 640px; }
    .cb-setting-path { ... }
    ...
}
```

巢狀選擇器在標準 CSS 中無效，瀏覽器**靜默忽略**整段 —— 沒有 console 錯誤、
沒有紅字，畫面看起來「樣式有寫但沒生效」。

這一點同時解釋了三個症狀：

| 使用者看到的 | 實際原因 |
|---|---|
| 字體大小一致、沒有主從 | `.cb-setting-*` 全部未套用，文字沿用瀏覽器預設 16px |
| 項目沒有清楚分隔 | 分隔線（`border-bottom`）同樣未套用 |
| 文字太大跑到面板外 | 瀏覽器預設 16px 撐破 420px 的對話框；且 `.cb-settings-dialog { max-width: 640px }` 也沒生效 |

**教訓**：CSS 沒有報錯機制，插入樣式後必須驗證「規則真的有套上」，
而不是看程式碼覺得寫了就行。已加兩道防護：
1. `temp/check_css_balance.py`（一次性工具，已用於掃描 `style.css` 與 `presets.css`，
   兩者現為 depth 0 平衡）
2. `settings.spec.js` 的「版面契約」6 項測試 —— 直接斷言 `getComputedStyle`
   的 `fontSize`／`borderBottomStyle`／實際寬度，而不是斷言選擇器存在

#### 版面重做

- **字級三層主從**：16px 對話框標題 → 15px/600 分區標題 → 13px 欄位名 → 12px 等寬路徑 → 11px 來源標籤／說明
- **分區**：原本五個目錄平鋪，語意上其實是兩件事 —— 「工具鏈（共用／隔離）」與「產物（永遠隔離）」。
  現以 `<section class="cb-setting-group">` + 底線分開。
- **項目分隔**：每列 `border-bottom: 1px dashed` + 7px 上下留白，最後一列不畫線
- **來源改為標籤**：`border-radius: 999px` 的小膠囊，貼在路徑下方，弱化以凸顯路徑
- **溢出修正**：`width: min(620px, calc(100vw - 48px))` + `max-height: calc(100vh - 80px)`；
  `.cb-setting-value { min-width: 0 }`（沒有它，長路徑會撐破 flex 容器）；
  路徑 `word-break: break-all` + `overflow-wrap: anywhere`
- **捲動位置**：捲動發生在 `.cb-dialog-body`，標題與按鈕列固定不動
- **窄視窗**：≤560px 改為單欄堆疊

### 驗證結果

- `cargo test`：**270 passed**
- `npx vitest run tests/unit`：**261 passed**（14 檔）
- `npx playwright test`：**175 passed**（3.2m，含新增 6 項版面契約）
- `npm run build`：成功
- CSS 大括號平衡檢查：`style.css` / `presets.css` 皆 depth 0

### 下次啟動方向 (Next Steps)

1. **實機驗證**（需使用者插板操作）：
   - 設定中心 › 進階 › 路徑 應顯示 `%LOCALAPPDATA%\Arduino15` 與「共用系統目錄」
   - 勾選「使用 CodeBridge 專屬目錄」→ 儲存 → 開發板清單應變空（行為正確切換）
   - 取消勾選 → 核心應重新出現；**重啟 CodeBridge 後設定必須保留**
   - 點「執行」確認編譯仍走同一套目錄（產物永遠在 `.codebridge/sketches`）
2. `board-picker.canInstallCore()` 改為檢查 **CLI 是否可用**（CLI 缺失時的按鈕是會失敗的）
3. 階段 2：開發板管理器（`core_remove`、`core_update_index`）

---

# 2026-09-28

## 2026-09-28：.cbg 檔案格式規格化與多行存檔

### 狀態

已完成。使用者回報兩項問題：（1）`03_plot-waves.cbg` 的 metadata 不符規範；
（2）`.cbg` 存檔時擠在 1 行，要求格式化成多行易讀格式。

### 已完成

- [x] **診斷 `03_plot-waves.cbg` metadata 不符的具體項目**（對照 `01_blink.cbg`）：
  1. 根元素屬性順序不同（`xmlns=` 在前 vs `serialize()` 產生的 `xmlns:cbg` 在前）
  2. 含 `<?xml version="1.0" encoding="UTF-8"?>` 宣告
  3. 根元素前有 23 行教學說明的 XML 註解
  4. `<statement>`／`<next>` 之間有 8 處行內 `<!-- -->` 註解
  5. CRLF 行尾（01/02 為無 BOM 單行）
  6. block 註解為 `pinned="false"`（01 為 `pinned="true"`）
- [x] **重寫 `03_plot-waves.cbg`**：改用 Blockly `<comment>` 承載全部教學說明
  （1 個工作區註解 + 7 個積木註解），移除 XML 宣告與全部 XML 註解，
  根元素屬性順序對齊 `serialize()` 輸出，LF 行尾，pretty 多行縮排（228 行）
- [x] **`01_blink.cbg` / `02_serial-hello.cbg` 同步 pretty 化**（58 / 33 行）
- [x] **存檔改用 `Blockly.Xml.domToPrettyText()`**
  （`ui/src/lib/project/project-io.js` 的 `serializeWorkspace()`）
- [x] **新建 `SPEC.md` 系統規格書**，`.cbg` 檔案格式為其中 §3 完整章節
- [x] `log/plan/CodeBridgeV2.md`「專案與編輯模式」加摘要與指向 SPEC.md 的連結
- [x] `AGENTS.md` 新增「.cbg 專案檔格式規範 (Critical)」章節 + Blockly v13 規範補一條
- [x] `FILE_STRUCTURE.md` / `README.md` 同步更新
- [x] **新增 `.gitattributes`**：`*.cbg text eol=lf`。
      沒有這條規則時 Windows 上的 Git 會把 `.cbg` 的 LF 轉成 CRLF 再提交，
      讓「使用者存檔產生 LF」與「git 取出變 CRLF」不一致，diff 全檔雜訊
      且違反 .cbg 格式規格（Rust `project_save()` 雖會再正規化，但 repo 內的檔案本身該是對的）
- [x] **測試**（red → green）：`project-store.test.js` 新增 `.cbg 檔案格式契約` describe 區塊，
  含「三個內建範例皆符合規格」測試（自動掃描 examples 目錄，違規即紅燈）
- [x] **E2E**：`toolbar.spec.js`「儲存會寫出 .cbg 內容」補多行縮排斷言
  （行數 > 5、根元素 metadata 在第一行、有 2/4 空格遞增縮排、無 XML 宣告）
- [x] **修正 Vite 熱更新**：`ui/vite.config.js` 的 `server.watch.ignored`
  原本寫成否定模式 `['!**/dist/**']`（行為與註解相反，等於忽略整個 workspace），
  改為正向模式並加入 `**/src-tauri/resources/**`：
  `.cbg` 是 Rust bundle 資源，開發模式前端走 IPC 讀取，
  改它們觸發整頁重載只會洗掉使用者未儲存的積木。已實測確認規則生效
- [x] **修正變數沒有型別定義**（使用者回報範例 3 產生的 .ino 無變數宣告）：
  - **根因一**：`scopeDefiningRootBlocks` 白名單漏了 `variables_declare_global`。
    `main.js` 的 `updateOrphanBlocks()` 會把白名單外的根層積木標記 orphan 而**停用**，
    停用積木不產碼 → `// Global variables` 空，且**無任何錯誤訊息**。
    修正：`_core.js` 補上該型別（與既有的 `array_declare_global` 對稱）
  - **根因二（使用者第二次回報：未完全對齊 piBlockly）**：原本是「每個變數各自一個
    獨立根層積木、各自寫一個 `global_vars_` entry」，**與 piBlockly 的模型不同**。
    piBlockly 的 `variables_declare_global` 與 `coding_raw_definition` **共用**
    `processDefinitionStack`（`piBlockly/media/generators/_lib.js`）：
    宣告積木以 `next` 串成連續堆疊，由堆頂一次產出整條堆疊、寫成單一 entry，
    非堆頂積木 `return ''` 避免重複產碼。
    修正：`_core.js` 新增 `DEFINITION_BLOCK_TYPES` / `globalVariableDefinition()` /
    `processDefinitionStack()`，兩個模組的 generator 改為引用它
  - **範例 3 補上四個宣告積木（堆疊式）**（原本只有 variables_get/set）。
    `sine` 必須是 `float` —— `50 + 50 * sin()` 若宣告為 `int` 會被截斷成 0，
    程式能跑但正弦曲線恆為 0，是最危險的靜默錯誤
  - **根因三（使用者第三次回報：真正對齊 piBlockly）**：
    `ui/index.html` 的 Variables 分類用 Blockly 內建的 `custom="VARIABLE"` **動態分類**，
    它會為工作區裡**每一個變數**各生一對 `variables_get`／`variables_set`，
    導致 ① 變數一多 flyout 被塞爆 ② **宣告積木（global／local）永遠不出現在 flyout**，
    學生看不到「要先宣告型別」→ 產生的 .ino 沒有型別定義。
    piBlockly（`media/toolbox.xml:301-307`）是**固定 4 顆 + 建立變數按鈕**。
    修正：`index.html` 改為固定 4 顆 + `<button callbackKey="CREATE_VARIABLE">`；
    `main.js` 補 `registerButtonCallback('CREATE_VARIABLE', ...)`
    （Blockly 動態分類會自動註冊，改固定分類後必須自行註冊，否則按鈕沒反應）
  - **測試**：`plotter.spec.js` 新增 5 項（堆疊一次產出 ×1、堆疊夾雜
    coding_raw_definition ×1、根層不被停用、區域宣告在 loop 內、
    示範專案四變數型別且 `sine` 為 `float`）；
    **新增 `variables-toolbox.spec.js` 6 項**（固定分類非動態、4 顆積木與順序、
    建立變數按鈕與 callbackKey、點擊按鈕真的建立變數、變數暴增時積木數不變、
    4 顆皆取得 variables 語意角色）
  - **文件**：`AGENTS.md` 新增「定義堆疊模型 (piBlockly 對齊)」「孤兒積木白名單」
    「變數分類：固定 4 顆積木 (piBlockly 對齊)」三章節；
    `SPEC.md` 積木契約表補「定義堆疊」「根層白名單」「變數分類」三列
  - **相容性**：`.cbg` 的 `variables_get`／`variables_set` XML 格式
    （`field name="VAR" id="..."`）未變，既有專案零遷移成本

### 技術深挖 (Technical Deep Dive)

#### 為什麼 XML 註解是危險的，而不是只是「不理想」

Blockly 13.3.0 的 `domToWorkspace()` 只處理**元素節點**（`mapSupportedXmlTags`
逐個 child 判斷 tagName），註解節點（nodeType 8）直接被跳過。
`workspaceToDom()` 反向也不會產生註解。

**結論：`<!-- ... -->` 裡的文字在載入的瞬間就消失了，只存在於原始檔案。**
使用者開啟範例 → 編輯 → 存檔，那 23 行教學說明就從檔案裡被洗掉了，
而且**沒有任何錯誤或警告**。對一個以教學為訴求的產品，這比壞掉更糟：
作者以為說明會傳下去，實際上第一位使用者就把它刪了。

因此規格把它列為 Critical 禁止事項，並要求教學說明一律寫在 Blockly 的 `<comment>`
（積木註解或直接掛在 `<xml>` 下的工作區註解），那是 Blockly 真正會序列化的結構。

#### 為什麼用 `domToPrettyText()` 而不是自己寫 formatter

Blockly 13.3.0 官方就提供 `Blockly.Xml.domToPrettyText(dom)`，實作是
「先 `domToText()` 展開自閉合標籤 → 以 `<` 切段逐片加兩空格縮排 →
合併同層單行元素 → 去開頭換行」。自己寫一個只會產生**與 Blockly 輸出不同**的格式，
而範例檔若與使用者存檔結果不一致，就會出現「範例開起來是 A，存出來是 B」的幽靈差異。

驗證方式：`temp/pretty-cbg.mjs` 逐字複刻該演算法（註明出處為 minified 檔的
對應行），用它產生三個範例檔，再由 E2E 測試證明這些檔案能被 Blockly 載入
並產生預期的程式碼（`plotter.spec.js` 的「示範專案可由 Blockly 13.3.0 載入」
與「示範輸出的三個標籤都能被序列繪圖解析成獨立曲線」）。

#### metadata 注入對多行格式的相容性

`project-store.js` 的 `findRootTag()` 用 `/<xml\b[^>]*>/` 找根標籤。
`[^>]*` 會跨行匹配，所以多行格式不會讓它抓不到根元素；
但 `serialize()` 是用 `text.replace(tag, injected)` 做**字串**替換，
若根標籤文字同時出現在內文（例如某個欄位剛好存了這段字串）就會誤替換。
目前 `domToPrettyText` 產出的根標籤必定在第一行且獨一無二，因此安全；
新增測試「多行格式可注入 metadata，且根元素仍是第一行」把這點鎖住。

### 驗證結果

- `npm run test:unit`：247 項全過
- `npx playwright test`：**156 項全過**（含新增 `variables-toolbox.spec.js` 6 項、
  `vite-watch.spec.js` 2 項）
- `npm run build`：成功

⚠️ **本輪踩到的自我傷害**：驗證 Vite 忽略規則時，我手動把 `<!-- probe -->` 寫進
`01_blink.cbg` 做對照，測試跑完卻忘了還原，被「內建範例格式契約」測試抓到。
**驗證用的探測一定要寫進 `temp/` 或用可還原的方式**，
`.cbg` 是被打包進產品的資源，不能拿來做實驗。

實際產出的 `// Global variables`：

```cpp
int angle = 0;
int square = 0;
float sine = 0;    // 必須 float，int 會讓 sin() 結果被截斷成 0
int noise = 0;
```

### 下次啟動方向 (Next Steps)

1. 實機驗證：開啟 `03_plot-waves.cbg` → 確認四個宣告積木在畫面上未變灰（未被停用）
2. 盤點其他模組是否也有「可擺根層但漏在白名單外」的積木型別
   （本輪只修了 `variables_declare_global`；`scopeDefiningRootBlocks` 僅 9 項）

---

## 2026-09-28：序列繪圖（Serial Plotter，T3 Phase 2）

### 狀態

已完成。計畫：[`log/plan/SerialPlotter.md`](../plan/SerialPlotter.md)。

### 已完成

- [x] **四個前端模組**（`ui/src/lib/plot/`），Rust 端**零改動**
  - `plot-parse.js`：文字行 → 資料點。支援 `label:value`、CSV、TSV、布林、負數與科學記號；垃圾行安靜忽略
  - `plot-store.js`：ring buffer（每 series 3600 點）、時間窗切片、Y 軸自適應含 0、**min/max 對包絡**下抽樣
  - `plot-render.js`：Canvas 2D 自繪（零新增 dependency）、DPR 縮放、斷線斷開、單點以圓點表示
  - `plot-panel.js`：左右分欄開闔、自動撐高、rAF 合併重繪、圖例、分隔條拖曳、窄視窗堆疊
- [x] **`serial-monitor.js` 新增 `onDataLine(listener)`**：繪圖的唯一接點，收到**未加時間戳**的原始行
- [x] **DOM 重構**：`index.html` 新增 `#terminalBody` 分欄容器、`#plotPane`、`#plotDivider`、`#plotToolbar`、`#plotCanvas`、`#plotLegend`
- [x] **CSS**：`style.css` 新增分欄／堆疊／圖例／canvas 樣式（沿用終端機深色系，零新增色碼）
- [x] **按鈕契約**：`btn-plotter` / `btn-plot-pause` / `btn-plot-clear` 全部 `implemented: true`
- [x] **i18n**：`PLOT_*` 共 12 個 key，中英對齊
- [x] `math_single` 補上 **SIN／COS／TAN** 下拉選項（generator 早已支援但積木未暴露）
- [x] **示範專案** `src-tauri/resources/examples/03_plot-waves.cbg`：方波 + 正弦 + 隨機雜訊
- [x] **測試**：Vitest 244 項（新增 76 項）、Playwright 19 項（Plotter 16 + 示範專案 3）

### 技術深挖 (Technical Deep Dive)

**為什麼零 Rust 改動**

`AppState::port_lease` 是單一持有者模型。Plotter 若在後端另開 plot session，必須複製整套租約協調、
上傳暫停／重連、埠消失自動關閉的邏輯 —— 那是已實測穩定化的程式碼，複製只會製造兩份會漂移的邏輯。
**Plotter 是 Monitor 資料流的圖形檢視，不是另一個裝置連線。** 因此只在前端加一個訂閱點。

**為什麼需要 `#terminalBody` 這一層**

`#terminalArea` 已是 `flex column`（標題／控制列在上，內容撐滿）。若直接把 `#plotPane` 放進去會變成
「標題 + 橫向雙欄 + 輸入行」錯位，輸入行會橫跨兩欄。多包一層把「文字區 + 輸入行」綁成左欄、
plotter 綁成右欄，語意才乾淨。`terminal-panel.js` 全用 `getElementById` 取得元素，多包一層不影響。

**自動撐高必須與使用者拖曳的高度分開記錄**

若直接 `setHeight(320)`，使用者拖到 500px 的高度就被改掉；反之若關閉時無條件還原，
使用者在開繪圖期間手動調到 400px 也會被還原成 200px。兩者都讓使用者覺得「面板在跟我作對」。
因此只有**當我們自己執行過自動撐高**時才在關閉時還原，且只還原一次（`autoRaised` 旗標）。

**下抽樣用 min/max 對包絡而不是抽稀**

「每 N 點取 1 點」會讓**尖峰直接消失**。對感測器資料而言峰值往往正是使用者要找的東西
（「剛才那一下尖峰是什麼？」）。因此每個像素 bucket 拆成 min 與 max 兩點輸出，
畫面縮小時仍能看見訊號的完整輪廓。

**踩到的坑：IIFE 內的函式名稱會遮蔽全域同名變數**

初版 `plot-render.js` 寫了 `function devicePixelRatio() { ... typeof devicePixelRatio ... }` ——
函式宣告提升讓 IIFE 內的函式**遮蔽**了全域的 `devicePixelRatio`，
`typeof devicePixelRatio` 永遠拿到函式本身而非 number，比例恆為 1。
症狀是高 DPI 螢幕上線條糊掉，而成因極難從畫面回推。修正為 `readPixelRatio()` + `globalThis` 取值。

**踩到的坑：圖例不該跟著 rAF 走**

初版把圖例更新放在 `draw()` 裡（rAF 回呼），導致資料進來後圖例晚一幀才出現。
圖例反映的是**資料結構變化**（不是像素重繪），必須同步更新；只有 canvas 重繪才需要 rAF 節流。

**踩到的坑：時間戳必須留在終端機那一側**

`onDataLine` 傳的是**未加時間戳**的原始行。帶上 `14:32:05.123 ` 前綴的話，
每一行都會被 parser 當成垃圾行丟掉，圖表永遠是空的。

**HEX 模式不繪圖**

HEX 顯示的是位元組串（`48 65 6C`），解析沒有意義且會把圖表畫成滿版雜訊。
因此 HEX 時跳過解析並在右欄顯示明確提示。

### 示範專案（03_plot-waves.cbg）：方波 + 正弦 + 隨機

Plotter 需要一個「一開啟就有東西看」的教學入口，因此新增內建範例。
每輪輸出 `square:100, sine:50.00, noise:42` 一行，繪圖會分成三條具名曲線。

**教學設計的三個刻意選擇**

1. **相位用看得見的 `angle` 變數，不用 `millis()`** ——
   「週期由相位決定」若藏在 `millis()` 裡學生看不到。
2. **先算波形、最後才推進相位** —— 讓每一筆資料都對應一個明確的角度。
3. **三個值都落在 0..100** —— 正弦若用原生的 -1..1 會被方波壓成一條看不見的線。

#### 踩到的坑 5：generator 支援 ≠ 積木有入口

組正弦波時發現 `math_single` 的下拉選項只有 sqrt／abs／ln／log10／e^／10^，**沒有 sin** ——
但 `generators.js` 早就有 `case 'SIN'` 產出 `sin(x / 180.0 * PI)`。
有程式能力卻沒有 UI 入口，等於功能不存在。

這類「generator 有、block 沒有」的落差沒有任何編譯期錯誤，
因此補了一條 E2E 斷言專門守住 `math_single` 的選項清單。

#### 踩到的坑 6：Blockly 的 if/else 是互斥分支，後續步驟不能接在 else 裡

示範第一次組出來的結構是「if/else 決定方波 → else 底下接正弦、隨機、印出、推進相位」。
看起來很自然，實際產生的 C++ 是：

```cpp
if (angle < 180) {
  square = 100;
} else {
  square = 0;
  sine = ...;      // ← 只有 angle >= 180 的那一半會跑到
  noise = ...;
  Serial.print(...);
}
```

也就是**半個週期完全沒有資料**。程式能編譯、能執行，只是圖表少了半圈。

正確做法是把後續步驟接在 **if 區塊的 `next`**（兩條分支之外），
讓兩條分支都執行完再往下走。這個缺陷是靠**整段產碼快照**抓到的 ——
逐行 `toContain` 完全看不出「少了一個大括號」。

#### 踩到的坑 7：Blockly 沒有三運算子積木

原本想把方波寫成 `angle < 180 ? 100 : 0`。但 `logic_operation` 的選項只有 AND／OR，
寫 `<field name="OP">IF</field>` 會得到兩條載入警告
（「Cannot set the dropdown's value to an unavailable option」與
「Ignoring non-existent input C」）。改用 `controls_if` 的 if/else 兩段式。

#### 踩到的坑 8：產碼快照必須先移除 ID marker 與行尾空白

Blockly 產生器會在變數名後插入 `/* // __BLOCKLY_ID:… */`，
把 `sin(angle / 180.0 * PI)` 拆成 `sin(angle` + marker + `/ 180.0 * PI)`。
語意相同但字串比對必失敗 —— 容易誤判成「generator 產錯了」。
移除 marker 後還會留下多餘的行尾空白，需一併收掉再做整段比對。

### 驗證結果

- `npm run test:unit`：Vitest **244 passed**（13 個檔案）
- `npx playwright test`：Plotter 專項 **16 passed**；全量 140 項通過
- `npm run build`：成功（`dist/src/lib/plot/` 已產生）
- `cargo test`：**257 + 7 passed**，0 failed（零回歸，Rust 未改動）
- 備份：`backup/plotter_20260928_142048`

### 下次啟動方向 (Next Steps)

1. **實機驗證**：以 CH340 UNO clone 燒錄一段 `Serial.print(x, ",")` 的程式，
   確認曲線、圖例標籤、時間窗切換與上傳暫停／續畫皆正確
2. 確認分隔條拖曳在 4K 螢幕上的手感（左右各最小 260px）
3. 工程／天使兩套 preset 下的繪圖區配色確認（目前沿用終端機深色系，理應無衝突）

---

## 2026-09-28：.cbg 模式重整與上傳依賴端口重定案

### 狀態

已完成，全數測試通過。

### 已完成

- [x] **metadata 精簡**：`META_FIELDS` 只保留 `app`；命名空間 `cbp:` → `cbg:`；舊 `cbp:` 檔仍可開啟
- [x] **裝置狀態移出檔案**：`name`／`fqbn`／`port`／`baud`／`libraries` 不再序列化
- [x] **上傳以下拉為準**：`compile-controller.currentDevice()` 讀 `board-detector.getState()`
- [x] **移除 `verifyBoardForUpload`**（使用者已確認）：`fqbn` 由所選埠推導，比較恆等
- [x] **內建範例改直接掃目錄**（對齊 #WaveCode）：Rust `list_examples`／`read_example`，
      範例搬至 `src-tauri/resources/examples/`，刪除 `manifest.json`
- [x] **Tauri resources**：`tauri.conf.json` 加入 `resources/examples/*`
- [x] **回歸測試**：單元（下拉優先於 metadata）與 E2E（開檔後改選 COM4，上傳燒 COM4）

### 技術深挖

**為什麼不能把裝置狀態寫進 .cbg**

原始痛點「UI 顯示 COM4，上傳卻報尚未選擇序列埠」的根因不是任何一邊會歸零，而是兩個來源
看不一樣：下拉 `#serial-selector`（使用者眼前的值）與 `meta.port`（打檔瞬間，可能老化）。
舊實作另有更惱人的體質——`pullInitialPorts` 只在下拉值「變化」時才寫入 meta，而使用者手動
選了同一個埠時 value 未變，導致 meta 不受更新、上傳拒絕。

新設計把裝置狀態從檔案移置來源，下拉即唯一來源；偏好埠改存 localStorage。

**為什麼範例改用 Rust 掃描**

靜態檔案伺服器沒有「列出目錄」的 API，`fetch('examples/')` 拿不到檔案清單，舊方案必須手維
`manifest.json`。改用 Tauri 資源目錄後 `fs::read_dir()` 真的能列檔，並以檔名前綴決定排序。

### 驗證結果

- Rust：253 + 7 passed
- Vitest：9 檔全過（182 項）
- Playwright：123 passed
- Build：成功

### 下次啟動方向 (Next Steps)

1. 打包後實測 `resources/examples/*` 的資源路徑（`select_examples_dir()` 已涵蓋兩種佈局）
2. `APP_VERSION` 改為單一 package / Tauri version 來源
3. 實機確認上傳與 Serial Monitor 在 COM4 上的實際行為

## 2026-09-28：修正重整後使用者回報的兩個缺陷

### 狀態

已完成，全數測試通過。使用者實測回報兩個缺陷，均已修正。

### 使用者回報

1. 新專案的積木下測試，選了 UNO 板，按上傳，出現「尚未選擇開發板」
2. 範例按鈕下拉：「目前沒有內建範例」

### 根因與修正

- [x] **選了板卻報未選擇開發板**：`board-picker` 仍把 fqbn 寫進 meta，但上傳讀
      `board-detector`（只從後端偵測推導）。新增 `manualFqbn` 覆寫層
      （`setManualFqbn()`），`getState().fqbn` 回傳 `manualFqbn || fqbnForPort(port)`。
      必要之處在於 CH340 clone 板後端認不出，自動偵測本來就是空的。
- [x] **範例清單永遠是空的**：`examples_dir()` 用 `is_dir()` 挑目錄，命中 Cargo 留下的
      空殼 `target/debug/examples/`。抽出 `select_examples_dir()` 改以「含 `.cbg`」為準。

### 技術深挖

**「單一來源」的重整不等於自動消滅第二個來源**

移除 `board-detector` 對 meta 的寫入，卻忘了 `board-picker` 還在寫。移除一條路徑
不等於建立單一來源——必須確認**所有**寫入者都改到新去處，否則只是把不一致換方向。

**自動偵測不能當作唯一真相**

後端認不出 clone 板時自動偵測本來就是空的，使用者的手動選擇才是這時候的真相。
「手動 > 自動」的覆寫層是必要的，不能想著「反正會自動偵測」。

**空殼目錄：存在 ≠ 可用**

`is_dir()` 只能證明目錄存在，不能證明裡面有東西。資源掃描類程式碼要用「內容符合
預期」當判準，這個陷阱特別容易出現在 build 工具產生的中間目錄上。

### 驗證結果

- Rust：257 + 7 passed（新增 4 項 `select_examples_dir` 測試）
- Vitest：9 檔全過（新增 3 項手動選板測試）
- Playwright：124 passed（新增「選板後上傳帶著選定板型」端對端測試）
- Build：成功

### 下次啟動方向 (Next Steps)

1. 實機確認選板後的上傳（尤其 CH340 clone 板無法自動偵測的情境）
2. 打包版確認範例清單
3. 實機確認 Serial Monitor 在 COM4 上的實際行為

## 2026-09-28：序列監視器（Serial Monitor）

### 狀態

**T3 Phase 1 實作完成。** 完整設計見
**[`log/plan/SerialMonitor.md`](../plan/SerialMonitor.md)**。

### 已確認的產品決策

| 決策點 | 結論 |
|---|---|
| 面板配置 | 編譯輸出與序列輸出**共用一個面板**（`#terminalContent`），以 `terminal-line--data` 視覺區隔 |
| 上傳後重連 | **預設自動重連為開啟** |
| baud 變更 | **自動重啟 Monitor**（序列埠 baud 在開啟時綁定，無熱改 API） |

### 已完成

- [x] Rust 端 `serial_monitor.rs`：`LineFramer`（回傳原始位元組）、`hex_encode` / `format_line`、
      `pump<R: Read>`（泛型化 `Read`，測試不需硬體）、`Session`、`MonitorConfig` / `MonitorStatus`
- [x] Tauri 命令：`serial_monitor_start` / `stop` / `send` / `status`
- [x] 事件：`codebridge://serial-data`（批次）、`codebridge://serial-state`
- [x] **埠租約協調**：`AppState` 新增 `serial_monitor` / `monitor_wants`；
      upload 前中斷 Monitor、終態後自動重連（150ms 冷卻）
- [x] 前端 `serial-monitor.js`：開關、baud、HEX、時間戳、開發者輸入行、多埠過濾
- [x] UI：控制列、輸入行、CSS、`toolbar.js` / registry 契約、`main.js` 初始化
- [x] i18n 中英各 19 個 key（移除 `SERIAL_MONITOR_NOT_IMPLEMENTED`）
- [x] 測試：Rust 26 項、Vitest 16 項、Playwright 10 項

### 實機除錯（2026-09-28）

- [x] **Monitor 一開啟就死掉**（使用者回報：上傳成功後立刻 `SERIAL_ERROR_READ|Operation timed out`、
      終端機永遠「未連線」、`Serial.println()` 無輸出）
      - 根因：`SerialPort::timeout(50ms)` 到期回 **`Err(TimedOut)`**，語意是「沒資料」不是「失敗」；
        原 `pump()` 把所有 `Err` 當斷線而 `break` → 板子安靜 50ms 就死
      - 修正：新增 `is_no_data()` 區分 `TimedOut`／`WouldBlock` 與真斷線
      - 補 3 項測試（假 reader 會回 `Err`），並明確斷言 `BrokenPipe`／`NotFound` 不算「沒資料」
- [x] 上傳重連時 HEX 設定遺失（`start_session` 的 `hex` 被寫死為 `false`）→ `hex` 移入 `MonitorConfig`
- [x] **埠未釋放**（使用者回報：手動關閉後仍「無法開啟序列埠」、切 baud 失敗、上傳前沒自動關閉）
      - 根因：`stop_monitor` / `release_port_for_upload` 只設 stop 旗標就返回，
        讀取 thread 仍活著、`SerialPort` 仍持有 Windows COM handle → `AccessDenied`
      - 修正：`AppState` 新增 `monitor_thread: JoinHandle`，停止路徑一律 **join**
        + `PORT_RELEASE_COOLDOWN_MS = 120ms` 冷卻
- [x] **baud 錯誤時完全沒反應**（資料卡在 `LineFramer` 緩衝，因錯 baud 下極少出現 `\n`）
      - 修正：新增 `IDLE_FLUSH_MS = 250`，閒置逾時強制切出殘餘位元組（對齊 Arduino IDE）
- [x] **「上傳暫停中」顯示成「未連線」** → 狀態燈改為三態（已連線／上傳暫停中／未連線）
- [x] **上傳後沒切回「已連線」** → `start_session` 補送 `SERIAL_STATE(connected)`；重連失敗改送 `failed`（原本 `let _ =` 完全靜默）
- [x] **連按上傳鈕沒視覺回饋** → `main.js` 將 `#btn-run` 的 `disabled`/`aria-busy` 綁到 `state.busy`（單飛保護本來就有效）
- [x] **收合終端機面板不重繪 Blockly** → `terminal-panel.js` 新增 `onWorkspaceResize`，`main.js` 註冊 `Blockly.svgResize`
- [x] **錯誤 baud 沒有訊息** → **非 bug，是 USB-UART 物理特性**（CH340 重組時脈，收到的仍是正確文字）。
      真正原因是開機訊息早已印完 → 新增 `reset_on_open`（DTR 觸發 UNO reset）、
      UI 開關「開啟時重啟板」+ 按鈕「重新啟動開發板」
- [x] **上傳鈕不會變灰** → `#btn-run` 是 `<div>`，而 HTML `disabled` **只對表單元素有效**：
      `div.disabled = true` 不會產生 `[disabled]` attribute，CSS 永遠匹配不到
      → 改為 `<button type="button">` + `.toolbar-btn` 補瀏覽器預設樣式 reset
- [x] **「印出空白行」無法診斷** → 畫面無法分辨「板子沒送資料」與「解碼成空」
      → `pump` 的 sink 改帶位元組數、`SerialData` 新增 `bytes`、
      狀態列顯示「等待資料…」／「已接收 N bytes」（每次開啟歸零）
- [x] **N bytes 但文字全空白** → `decode_output` 的 **Big5 分支是總函式**（任何位元組
      序列都能「成功」解碼），baud 不符的垃圾位元組被解成**控制字元**（0x00–0x1F），
      終端機裡完全不可見 → 新增 `make_control_chars_visible()` 轉成 `<0xNN>`
- [x] ⚠️ **更正錯誤判斷**：前三輪記錄的「CH340 硬體重組時脈，錯誤 baud 仍收到
      正確文字」是**錯的**。CH340 是 UART-to-USB 橋接器，baud 設定會下發給晶片
      設定取樣時脈，不符即產生垃圾位元組
- [x] **序列資料不該走 Big5 fallback**（使用者提問揭露）→ 新增序列專用 `decode_serial()`
      = UTF-8 → latin-1。Big5/GBK 只適用於**編譯器輸出**（Windows cp950）；
      序列資料固定是 UTF-8（Arduino `String` 內部），且 Big5 是總函式會把任何
      非 UTF-8 資料**猜成中文**，使用者看到無關漢字反而更難診斷
- [x] **DTR reset 在 clone 板無效** → 硬體限制（reset 電容線常被省略），非程式問題。
      tooltip 改為誠實說明並建議手按 RESET 鍵
- [x] **位元組歸零時機不明確** → 文案改為「本次連線已接收 N bytes」+
      tooltip 說明歸零條件（歸零只對應「開新連線」，面板收合不影響連線）
- [x] 計時 flaky：`pump_flushes_a_line...` 原本 sleep 300ms 對 250ms 門檻無餘裕
      （連跑三次失敗一次）→ 改用 `IDLE_FLUSH_MS * 3`

### 驗證結果

- `cargo test`：**247 passed**（+2）
- `npx vitest run tests/unit`：**179 passed**（+4）
- `npx playwright test --workers=1`：**122 passed**（全數通過）
- `npm run build`：成功
- 文件：[`log/plan/SerialMonitor.md`](../plan/SerialMonitor.md)、[`log/mappings/SerialMonitor.html`](../mappings/SerialMonitor.html)

### 下次啟動方向 (Next Steps)

1. **實機驗證**（必要）：CH340 UNO clone 實測序列輸出、上傳前後自動重連、拔線自動斷線
2. Serial Plotter（需另立計畫）
3. 回到 T3 設定中心階段 1 待做部分（`settings.json` 持久化）

---

# 2026-09-27

## 2026-09-27：T2-C/T2-B 工作區整理與全量驗證

### 已完成
- [x] 兩項「已知失敗」測試皆已修正並驗證（詳見文首「品質與測試」）
  - 範例命名：命名來源統一為範例檔內 `cbp:name`，`blink.cbg` 改為 `Blink`
  - `controls-for` 多 worker 偶發重複行：多 worker 全量 90 項全數通過，未重現
- [x] 工作區 52 個檔案的未提交變更整理為 6 個語意化 commit：
  1. `chore(release)` 版本號 0.1.0 → 0.2.0
  2. `feat(arduino)` Rust compile/upload 管線與 Tauri 事件串流（T2-A／T2-B）
  3. `feat(ui)` 前端編譯控制器與終端機面板（T2-C）
  4. `feat(blockly)` 離線 media 備份、滾輪縮放與縮放至符合內容
  5. `fix(project)` 開啟專案不再因 Blockly 註解正規化而誤判 dirty
  6. `docs` 檔案結構與日誌更新

### 技術深挖 (Technical Deep Dive)

#### 範例命名應該只有一個來源
先前 `toolbar.spec.js` 失敗的診斷是「`cbp:name` 是小寫 `blink`」，但真正的結構性問題是**命名有兩個來源**：範例檔內的 `cbp:name` 與 `manifest.json` 的 `id`／`title`。只要 `manifest.title` 是「Blink（LED 閃爍）」這類顯示用字串，就不適合當檔名來源。`project-io.js` 現在一律採 `parsed.meta.name || nameFromPath(example.file)`，`manifest.json` 退為純顯示用途，衝突從此不可能發生。

#### Blockly 註解正規化會讓「開檔即 dirty」
Blockly v13 載入工作區後會自動把註解補成 `pinned="true" h=… w=… x=… y=…`。這些屬性不是使用者的修改，卻會改變序列化結果 —— 直接字串比對會讓 save 按鈕在開檔瞬間就亮起。正規化時機不固定（實測 10ms～170ms，中間還有平靜期），靠 debounce 視窗收斂不可靠。解法是在**比對時**剝除易變屬性（`x` / `y` / `pinned`），基準快照本身保持完整（存檔與還原仍需要）。代價是單獨移動／縮放註解不會標記 dirty，註解屬呈現性質，可接受。

實作注意：不可用單一全域 regex 掃 `x|y|pinned`，因為移除第一個屬性後掃描位置已越過 `<comment` 開標籤，同一標籤內其餘屬性會漏掉。必須先取出整個 `<comment ...>` 標籤再逐屬性移除。

#### `git add` 與 `git commit` 併在同一命令列會互相交錯
以 `git add <paths>; git commit -m ...` 一次執行時，先前的 staged 內容會被一併帶進第一個 commit，導致 commit 訊息與實際內容不符（本次先產生了 `chore(release)` 卻含 16 個 Rust 檔案）。處置方式是 `git reset --soft HEAD~1` 後**每個 commit 分成兩次獨立工具呼叫**執行，並在每次之後以 `git show --stat` 驗證。

### 驗證結果
- `npx vitest run tests/unit`：**78 passed**（6 個檔案）
- `npx playwright test`（多 worker 全量）：**90 passed**（1.7 分鐘）
- `cargo test`：**178 passed** + 4 個真實 `arduino-cli` 整合測試 passed
- `npm run build`：成功（Vite 131ms）
- `git status`：工作區乾淨，master 領先 origin/master 6 個 commit

### 下次啟動方向 (Next Steps)
1. ~~T2-D 前置~~：**已於 2026-09-27 完成**（`LineBuffer` 修正 + 序列埠 watcher + signature-diff 事件）
2. ~~T2-D 主體~~：**已於 2026-09-27 完成**（`board-detector.js`、序列埠綁定、`btn-refresh-serial` 上線、`MSG_BOARD_MISMATCH`）
3. 板子選擇面板（搜尋 + 已安裝／全部分頁）仍待實作
4. T2-E：cocoya 圖示搬遷、preset 微調、桌機實機上傳驗證

## 2026-09-27：T3 設定中心與核心目錄共用化（計畫）

### 狀態
**計畫已核准，本輪只寫文件不動工。** 完整內容見
**[`log/plan/SettingsCenterAndCoreSharing.md`](plan/SettingsCenterAndCoreSharing.md)** —— 下一輪必讀。

### 決策摘要
- **預設共用** `arduino-cli` 系統目錄（`%LOCALAPPDATA%\Arduino15`），保留獨立模式開關
- 設定中心只做 CodeBridge 用得到的，**不做**通用 Arduino 環境管理器
- 分層：常用（開發板／函式庫管理器、序列埠）＋ 進階（路徑、獨立開關、診斷）
- 每欄位顯示**當前生效值 + 來源**
- CodeBridge 尚未發佈，可直接改變預設行為，不需遷移

### 關鍵依據（實機查證）
- 實測確認 CodeBridge 隔離目錄**零核心**，使用者已裝的 3 個核心在 `%LOCALAPPDATA%\Arduino15`
- 實測確認 IDE 2 與命令列 arduino-cli **本來就共用**同一目錄：`inventory.yaml` 同時有 IDE 2（2026-04-17）與 CLI（2026-09-27）寫入的 VID/PID 快取
- 因此隔離是**偏離官方慣例**，且沒有換來實際好處

### 核心設計：拆分「產物」與「工具鏈」
| 資源 | 處置 |
|---|---|
| `data` / `downloads` / `config` / `user`（核心、函式庫、200MB+） | **共用**系統預設 |
| `inventory.yaml`（VID/PID 快取） | **共用**（共用才有加速效果） |
| `build_root`（草稿暫存） | **維持隔離**（CodeBridge 產物） |
| `.cbg` 專案檔 | 本來就獨立 |

### 三階段
1. **階段 1**：路徑可設定 + 預設共用 —— 解決「看不到已裝核心」的阻擋性問題
2. **階段 2**：開發板管理器（`core_remove`、`core_update_index`）
3. **階段 3**：函式庫管理器（`lib_search` / `lib_install` / `lib_remove`）

### 後端尚缺命令
`toolchain_get_dirs`、`toolchain_set_dirs`、`core_remove`、`core_update_index`、
`lib_search`、`lib_install`、`lib_remove`（目前 `lib_list` 只有列表）

### 下次啟動方向 (Next Steps)
1. 讀 [`log/plan/SettingsCenterAndCoreSharing.md`](plan/SettingsCenterAndCoreSharing.md)
2. 實作階段 1，先寫 `ToolchainDirs::from_settings()` 的單元測試
3. 實機驗證：預設狀態下 `board_list_all` 能列出使用者已裝的 3 個核心

## 2026-09-27：T2-E 實機除錯（使用者回報的 6 項缺陷）

### 使用者回報的現象
1. 選了序列埠／開發板，執行其他動作後又「找不到」
2. UI 顯示 COM4，但報「尚未設置序列埠」
3. 選了 UNO 但工具列沒顯示
4. 編譯成功但沒上傳
5. 上傳成功後沒有明確訊息
6. 「上傳成功」出現在「開始上傳到 COM4」之前
7. Engineer 樣式下積木註解是白字亮黃背景，看不清

### 已完成
- [x] **Tauri payload 包裝**：`compile_start` / `upload_start` 需 `{ payload: {...} }`；`upload_ready` 維持扁平
- [x] **編譯／上傳競態**：`compile_start` 立即回 id 但 `last_builds` 要等成功才寫入 → 改為等 `operation-status: succeeded` 才接續上傳
- [x] **上傳靜默失敗**：`upload_ready` 回 false 時顯示 `CLI_ERROR_BUILD_STALE`
- [x] **`setMeta` 改為合併語意**：原本整個替換，導致板子與序列埠**互相清除**
- [x] **開範例保留設備選擇**：`keepDeviceMeta()`，範例 `.cbg` 不帶 fqbn/port 也不清空使用者選擇
- [x] **`probe()` 處理帶引號空字串**：`""` 導致 `create_dir_all` 報 os error 123
- [x] **`#board-label` 實作**：元素存在卻從未被寫入
- [x] **上傳結束解除 busy**：`uploading` 永遠為 true 導致第二次按執行沒反應
- [x] **上傳成功訊息**：`CLI_UPLOAD_SUCCESS`（中英）
- [x] **事件欄位名不一致**：後端同一事件送兩種 payload（`OperationProgress.operationId` / `OperationStatus.id`）→ `eventOperationId()` 同時讀兩者
- [x] **重複事件誤判**：用 `uploadOperationId` 精確比對取代布林值
- [x] **每次執行前清空終端機**
- [x] **積木註解配色**：選擇器從錯誤的 `.blocklyCommentTextarea` 改為 `.blocklyCommentText`，加入 preset token
- [x] **啟動時插著板子偵測不到**：watcher 首次事件在 listener 註冊前就發出 → `pullInitialPorts()` 補初始快照

### 技術深挖 (Technical Deep Dive)

#### 後端同一事件名稱送了兩種 payload，欄位名不同
```rust
sink.flush_now(Succeeded, true);      // OperationProgress → 欄位 operationId
emit_to(OPERATION_STATUS, status);    // OperationStatus  → 欄位 id
```
前端只讀 `operationId` → 上傳結束事件（帶 `id`）無法識別。症狀是「上傳成功」從不顯示；
而只用布林值判斷時，編譯的 succeeded 送兩次會導致「上傳成功」誤判出現。

**教訓**：跨語言的事件契約必須把「同一事件名可能對應多種 payload」當成常態，
欄位名要防禦性讀取（`payload.a || payload.b`）。

#### 事件遺失：watcher 比 listener 早
Rust 在 `setup()` 啟動 watcher，第一次 emit 在數十毫秒內；前端要等 Blockly 載入
（數百毫秒）才註冊 listener。啟動時就插著板子的使用者，**事件在訂閱前就發出 → 永久遺失**。
修法是「事件 + 初始快照」並存：事件管後續變化，`pullInitialPorts()` 管當前狀態。

#### `setMeta` 的整個替換語意造成互斥清除
`board-picker` 送 `{fqbn}`、`board-detector` 送 `{port}`，而 `setMeta` 是
`state.meta = meta`（整個取代）→ **兩者互相清除**。症狀是「UI 顯示 COM4（那是 DOM 值）
但 `meta.port` 已被清空」。改為合併語意，並保留 `setMeta(null)` 的重置語意。

#### 註解配色從未生效
選擇器寫成 `.blocklyCommentTextarea`，但 Blockly 13 實際產生 `.blocklyCommentText`。
整條規則從未匹配，因此維持預設的螢光黃底（`rgb(255,252,199)`）+ 白字。
**這種錯誤看程式碼完全看不出來** —— 選擇器拼錯不會報錯，只會靜默無效。

### 驗證結果
- `cargo test`：**211 passed** + 7 項真實 `arduino-cli` smoke
- Vitest：**146 passed**
- Playwright：**111 passed**
- `npm run build`：成功

### 下次啟動方向 (Next Steps)
1. T3 設定中心：設定對話框、獨立模式開關、開發板／函式庫管理器
2. 桌機實機回歸：開範例保留設備、啟動即偵測、註解配色

## 2026-09-27：T2-E 使用者回報修正（三項阻擋性缺陷）

### 使用者回報的現象
1. 插上板子，序列埠沒有自動輪詢偵測到 COM4
2. 開發板對話框顯示「尚未安裝任何開發板核心」，常用開發板也是空的
3. 插著板子時下拉清單有「未偵測到序列埠」；拔掉後反而不見了

### 已完成
- [x] **序列埠 watcher 被板子偵測阻塞**：`publish_detected_boards` 在 1500ms 輪詢迴圈裡同步呼叫 `arduino-cli board list`（逾時 60 秒），插拔板子時 UI 長時間無反應。改為獨立執行緒 + `BOARD_SCAN_INFLIGHT` 抑制 + 8 秒逾時
- [x] **下拉清單邏輯顛倒**：有可用埠時顯示 placeholder、拔掉時反而隱藏。改為「有埠→只列實際埠；無埠→先列『未偵測到』再列已移除的原選擇」
- [x] **首次使用無出路**：CodeBridge 隔離目錄沒有任何核心，面板只顯示提示。加入 `core_search`／`core_install` 後端命令、`core.js` 服務與「安裝核心」按鈕
- [x] 測試：單元 126 passed（+8）、board-picker E2E 17 passed（+2）

### 技術深挖 (Technical Deep Dive)

#### 根因一：watcher 被同步 CLI 呼叫卡住
```rust
loop {
    let current = scan_ports_detailed();     // 掃描序列埠
    if diff.change.should_emit() {
        publish_detected_boards(&app, &current);  // ← 同步啟動 CLI，最長 60 秒
    }
    std::thread::sleep(1500ms);               // ← 這 1500ms 根本沒機會跑
}
```
`board list` 要啟動子進程並掃描 USB。CLI 沒安裝／卡住時，序列埠掃描就整整停滯數十秒。修正為 `spawn_blocking` 獨立執行緒 + atomic in-flight 抑制 + 8 秒逾時（板子偵測是附帶功能，不該讓 UI 等）。

#### 根因二：我在寫測試時就把錯的行為當成規格
```javascript
emitPorts(bridge, ['COM3', 'COM7']);
expect(select.values()).toEqual(['', 'COM3', 'COM7']);  // ← 這行本身就不對
```
插著板子時清單裡不該有「未偵測到序列埠」。但因為我先寫了這行測試、再照著實作，於是**整條鏈路都建立在錯誤的規格上**，還加上了「保留原選擇」的合理化註解掩蓋問題。教訓：**TDD 的測試本身也必須被質疑** —— 尤其是把使用者可見的呈現形式（option 清單）寫成斷言時。

#### 根因三：隔離設計的代價終於爆了
CodeBridge 用 `%APPDATA%\com.codebridge.app\arduino\`（實測確認只有 `builtin` 工具，**零核心**），使用者裝在 `%LOCALAPPDATA%\Arduino15\` 的 3 個核心完全看不到。面板說「尚未安裝核心」是**正確診斷**，但沒有任何出路 —— 使用者卡死。加入安裝入口後，首次使用不再需要離開應用程式。

### 驗證結果
- `cargo test`：**206 passed** + 6 項真實 `arduino-cli` 測試
- Vitest：**126 passed**
- Playwright board-picker：**17 passed**

### 下次啟動方向 (Next Steps)
1. 執行全量 E2E
2. 實機驗證：安裝核心後 CodeBridge 能否正確選板並燒錄到 COM4
3. T2-E 其餘：preset 微調、cocoya 圖示搬遷

## 2026-09-27：T2-E 使用者回報修正（CH340 clone 無法自動辨識）

### 已完成
- [x] **修正錯誤 i18n key**：無結果提示沿用了積木搜尋的 `TLB_BLOCK_SEARCH_NO_RESULTS`，使用者選開發板時看到「找不到符合的**積木**」。改為開發板專用的 `TLB_BOARD_SEARCH_NO_RESULTS`
- [x] **新增常用開發板快捷列**：Uno／Nano／Mega／Micro／Leonardo／ESP32／Pico 一鍵選用，不必知道 FQBN 怎麼拼
- [x] **區分「沒搜尋」與「搜不到」**：前者提示安裝核心，後者提示改用快捷列
- [x] **無法辨識的埠顯示可操作說明**：「常見於第三廠板，請手動選擇後即可正常編譯與上傳」
- [x] i18n 中英各補 4 個 key；`presets.css` 加入快捷列樣式
- [x] 測試：單元 +4 項（122 total）、E2E +4 項

### 技術深挖 (Technical Deep Dive)

#### 實機驗證：CH340 clone 的真實行為
使用者插入第三廠 UNO（`USB-SERIAL CH340 (COM4)`，驅動 Status OK），`arduino-cli board list` 顯示「未知的」。實測確認根因：

```text
arduino:avr:uno 認得的 VID/PID（僅 5 組官方）
  0x2341/0x0043   0x2341/0x0001   0x2A03/0x0043   0x2341/0x0243   0x2341/0x006A
第三廠 UNO clone 實際是
  0x1A86/0x7523   ← CH340（WCH/Nanoxp），不在清單內
```

**關鍵實測**：`arduino-cli upload --fqbn arduino:avr:uno -p COM4` **完全不需要** VID/PID 匹配，成功燒錄（`Device signature = 0x1e950f (m328p)`、`writing flash 924 bytes`）。VID/PID 只影響「自動辨識板子」這一步。

**產品含意**：高中生手上的 UNO 幾乎都是 clone，因此「自動偵測失敗 → 手動選板」不是邊緣案例而是**主要路徑**。面板必須對這條路徑友善：說清楚「手動選完照樣能燒」，並提供一鍵選用。

#### 我犯的錯：沿用積木搜尋的 i18n key
`TLB_BLOCK_SEARCH_NO_RESULTS` 的值是「找不到符合的**積木**」。開發板面板沿用後，使用者在選板時看到完全不相干的訊息。這類錯誤靠「看程式碼」很難發現，靠**實際操作**才會浮現 —— 也是為什麼面板的文案必須由實際使用者驗證。

教訓：新增面板／功能時，提示列一律用該功能自己的 i18n 命名空間，勿圖省事沿用既有 key。

### 驗證結果
- Vitest：**122 passed**
- Playwright board-picker：**15 passed**（含新增 4 項）
- `cargo test`：**206 passed**

### 下次啟動方向 (Next Steps)
1. 執行全量 E2E
2. 日誌與 commit
3. T2-E 其餘：preset 微調、cocoya 圖示搬遷

## 2026-09-27：T2-E 實機驗證（真實編譯）—— 抓出「每次編譯都失敗」的嚴重缺陷

### 已完成
- [x] 環境盤點：`arduino-cli 1.2.0`、已裝 `arduino:avr` / `esp32` / `rp2040` 三個核心，**但沒有接實體開發板**（`board list` 回報「沒找到開發板」，系統無序列埠）
- [x] 新增真實編譯 smoke 測試（成功路徑 + 診斷行號契約），以 `CB_VERIFY_CONFIG_DIR` 啟用
- [x] **修正草稿路徑缺陷**：`build_root/<project_id>/` → `build_root/<project_id>/<stem>/`
- [x] 新增 2 條針對缺陷的回歸測試（ASCII 與中文專案名）
- [x] 新增 `purge_stale_sketches()`：改名後清除舊 stem 目錄

### 驗證結果
- `cargo test`：**206 passed**（+2 條新回歸測試）
- 真實編譯 smoke：**6 passed**（含真實 `arduino-cli` 編譯成功 884 bytes／2%）
- Vitest：**118 passed**
- `npm run build`：成功

### 技術深挖 (Technical Deep Dive)

#### 嚴重缺陷：CodeBridge 的每次真實編譯都會失敗
實機驗證第一個抓到的問題：草稿目錄用 `project_id`（`untitled`），主檔名用 sanitize 過的顯示名（`SmokeOk`），產出

```text
sketches/smoke_ok/SmokeOk.ino     ← 資料夾名 ≠ 主檔名
```

而 `arduino-cli` 有硬性規則「草稿資料夾名必須與主檔名完全相同」，因此回報
`Can't open sketch: main file missing from sketch` —— **所有專案、所有板子都編譯失敗**。

**為什麼 200+ 個單元測試全綠？** 既有測試只驗證 `ino_file_name() == stem`，**從未驗證資料夾名與檔名一致**。而假 runner 不檢查檔名規則，所以流程測試也抓不到。這是純邏輯測試的典型盲區：外部工具的**契約**必須用真實工具驗證。

#### 修法：多一層，同時滿足三個約束
直接把資料夾名改成 `stem` 會立刻打破兩項既有行為（都被測試抓到）：
1. 兩個同名專案會共用草稿目錄而互相覆蓋
2. 改名後舊目錄殘留，`build_path` 可能指到過期產物

因此路徑改為 `build_root/<project_id>/<stem>/<stem>.ino`：
- **最內層目錄名 == 主檔名** → 滿足 arduino-cli
- **外層 `project_id`** → 維持專案隔離
- **白名單驗證保留** → 安全邊界不變

另加 `purge_stale_sketches()` 清理同專案底下的其他 stem 目錄，解決改名殘留。

#### 隔離設計的代價
CodeBridge 刻意用隔離的 config dir（不污染使用者的 Arduino IDE），代價是**看不到使用者已安裝的 3 個核心** —— 必須在 CodeBridge 內重裝。這不是 bug，是取捨，但對首次使用者的體驗成本很高，值得評估是否提供「匯入既有核心」的選項。

#### `arduino-cli 1.2.0` 只有 `--config-dir`
實測確認 1.2.0 **沒有** `--data-dir` / `--user-dir` 旗標。T2 的 `GlobalFlags::prefix()` 只產生 `--config-dir` 是正確的相容做法。目錄隔離需透過 `arduino-cli.yaml` 的 `directories:` 設定。

### 無法驗證的部分（誠實記錄）
- **實體上傳**：環境無序列埠、無開發板，`upload` 流程無法實測。仍由假 runner 單元測試覆蓋。
- **板子偵測**：`board list` 回空，`board-detected` 事件在真實環境無法觸發。
- **桌機 UI**：未啟動 Tauri 應用手動操作。

### 下次啟動方向 (Next Steps)
1. 有硬體時驗證上傳流程
2. 評估「匯入使用者既有核心」以降低首次使用門檻
3. T2-E 其餘：preset 微調、cocoya 圖示搬遷

## 2026-09-27：T2-E（開發板選擇面板）

### 已完成
- [x] `ui/src/lib/arduino/board-picker.js`（`window.CodeBridgeBoardPicker`）
  - `board_list_all` 載入（只載入一次，核心索引數百筆不重複請求）
  - 搜尋同時比對名稱與 FQBN，不分大小寫
  - 選取寫回 `meta.fqbn` 並關閉面板；目前選用者標示 `is-active`
  - 載入中／錯誤／無結果三種狀態皆有提示列
  - Escape、遮罩點擊、關閉鈕三種關閉途徑
- [x] 工具列 `btn-select-board`（沿用既有 `hardware-chip-outline.png` 圖示）與 `board-label`
- [x] `index.html` 面板骨架、`presets.css` 樣式（僅用 `--cb-*` token，符合 Engineer／Angel preset 契約）
- [x] `main.js` 初始化、`toolbar-registry.js` 註冊 `select-board`
- [x] 測試：`board-picker.test.js`（17 項單元）、`board-picker.spec.js`（10 項 E2E）

### 技術深挖 (Technical Deep Dive)

#### 手動選板必須能覆寫既有值 —— 與自動切板方向相反
`board-detector.js` 的自動切板只在 `meta.fqbn` 為空時填入（否則會抹掉上傳前比對的基準）；面板的選取則**一定覆寫**。兩者看似矛盾，實則語意不同：自動切板是「推測硬體」，手動選板是「使用者明確指定」。若面板也拒絕覆寫，使用者將永遠無法改板子。

#### 名稱與 FQBN 必須並列
只顯示 `arduino:avr:uno` 對高中生沒有判斷依據；兩者並列才確認得了是不是自己手上的那塊板。搜尋也同時比對兩者，因為使用者可能輸入「uno」也可能直接貼文件中的 FQBN。

#### 搜尋字串在關閉／重開後保留
使用者搜到一半被打斷（插拔板子、誤按遮罩）時，重開面板若清空關鍵字就得重打一次。因此 `term` 是模組狀態而非 input 的暫存值。

#### 教訓：新增測試一律建新檔
本輪曾把 `board-picker` 的 E2E 內容寫進 `compile-flow.spec.js` 的 import 區塊，覆蓋了 T2-C 既有測試，已用 `git show HEAD:<path>` 還原。不要把既有 spec 的開頭當插入點。

### 驗證結果
- `npx vitest run tests/unit`：**118 passed**（8 個檔案）
- `npx playwright test`：**103 passed**
- `npm run build`：成功

### 下次啟動方向 (Next Steps)
1. 桌機實機編譯／上傳驗證（純瀏覽器 E2E 蓋不到真實 CLI 與硬體）
2. T2-E 其餘：preset 微調、cocoya 圖示搬遷

## 2026-09-27：T2-D（板子／序列埠自動偵測）

### 已完成
- [x] Rust 板子層事件
  - `BoardsDetected` / `BoardMatch` payload（port → fqbn 加上無法辨識的清單）
  - `from_matches()`：過濾空 port／fqbn、依埠名排序、同埠去重
  - `detect_boards()`：交叉比對 `board list` 與實際埠清單，差集即「無法辨識」
  - `publish_detected_boards()`：僅在埠**有變化**時呼叫 CLI（不可放進 1500ms 輪詢路徑）
  - CLI 不可用／查詢失敗時**不發事件**，保留使用者既有 FQBN
- [x] 前端 `ui/src/lib/arduino/board-detector.js`（`window.CodeBridgeBoardDetector`）
  - 訂閱 `serial-ports-changed` 與 `board-detected`
  - 序列埠下拉渲染（含板名顯示）、`btn-refresh-serial` 綁定與啟用
  - 偏好埠（localStorage `codebridgePreferredPort`）與自動選取的區分
  - 自動填入 `meta.fqbn`（**僅在使用者尚未選過板子時**）
  - `verifyBoardForUpload()`：上傳前板子比對
- [x] `compile-controller.js` 的 `upload()` 改為先過 `confirmBoard()` 再送出
- [x] i18n 中英各補 15 個 T2-D key（`TLB_SELECT_BOARD`／`MSG_BOARD_MISMATCH` 等）
- [x] `index.html` 載入 `board-detector.js`；`serial-selector` 與 `btn-refresh-serial` 移除 `disabled`
- [x] `toolbar-registry.js` 將 `refresh-serial` 標記為 `implemented: true`
- [x] `toolbar-buttons.test.js` 凍結清單清空（所有工具列按鈕皆已實作）
- [x] 測試：`board-detector.test.js`（23 項）

### 技術深挖 (Technical Deep Dive)

#### 自動切板會把上傳前比對的基準抹掉
初版 `applyToMeta()` 無條件把偵測到的 FQBN 寫回 `meta.fqbn`。這讓 `verifyBoardForUpload()` 的比對永遠是「相同」—— 因為 `expected` 與 `detected` 都是同一個值，等於沒有比對。**自動切板現在只在 `meta.fqbn` 為空（使用者從未選過板子）時填入**；使用者已選的板子代表「這個專案要燒哪顆晶片」，自動偵測到的硬體不該靜默改掉它。改板子必須由板子選擇面板明確操作。

這個缺陷是被自己寫的測試抓到的：「FQBN 不同時詢問使用者」通過，但「FQBN 相同時直接放行」失敗 —— 兩者同時成立就代表比對邏輯不存在。

#### 偏好埠與自動選取必須分開記錄
拔線時使用者可能只剩內建 COM1，自動選取會把選擇切過去。若把這個自動結果寫成「偏好」，重插原板時就再也跳不回去。因此只有**使用者手動選的**埠（`change` 事件）才寫入 localStorage；`choosePort()` 在偏好埠重新出現時優先跳回。

區分「使用者選的」與「自動選的」仰賴 DOM 語意：`change` 只在使用者互動時觸發，程式直接設定 `value` 不會。

#### `Element.remove()` 不能用來清空下拉
`renderOptions()` 初版用 `element.remove()` 清空選項，但那是把節點**從 DOM 摘掉**（等同 `Node.remove()`），會讓整個序列埠下拉從工具列消失。正確做法是 `while (element.firstChild) element.removeChild(...)`。這個錯誤在單元測試中浮現（fake select 的 `remove()` 語意不同），但根因在真實 DOM 一樣存在。

#### 沒有可用埠時只保留原選擇，不放 placeholder
一個埠都沒有時，若同時放「未偵測到序列埠」placeholder 與保留的原選擇，下拉會有兩個可選項，使用者會誤以為還有其他埠可選。因此 `keepPrevious` 時只顯示原選擇一項，並維持 `element.value`。

#### `board list` 不可放進輪詢路徑
watcher 每 1500ms 掃描一次序列埠，但 `arduino-cli board list` 需啟動子進程（數百毫秒），且 CLI 未安裝時會直接失敗。因此只在埠**簽章有變化**時才呼叫，並以事件推播結果。CLI 不可用時不發事件 —— 前端拿不到對應時應保留使用者已選的 FQBN，而不是清空。

### 驗證結果
- `cargo test`：**204 passed** + 4 個真實 `arduino-cli` 整合測試 passed
- `npx vitest run tests/unit`：**101 passed**（7 個檔案，含新增 23 項 board-detector 測試）
- `npm run build`：成功
- E2E 全量：92 項（T2-D 上線後工具列已無 disabled 按鈕，斷言同步更新）

### 下次啟動方向 (Next Steps)
1. 板子選擇面板（搜尋 + 已安裝／全部開發板分頁）尚未實作 —— 目前只能自動偵測，使用者無法手動選板
2. T2-E：cocoya 圖示搬遷、preset 微調、桌機實機編譯／上傳驗證

## 2026-09-27：T2-D 前置（EventSink 緩衝修正 + 序列埠 watcher）

### 已完成
- [x] 修正 `EventSink` 緩衝缺陷（`src-tauri/src/events.rs`）
  - 新增 `LineBuffer`（`VecDeque<ProgressLine>`，預設容量 512，可測）
  - `on_line` 改為 `buffer.push()` + `take_flush(buffer.pending_len())` —— 64 行門檻終於會觸發
  - `flush_now` 一次送出整批行，取代原本「只送最後一行」
  - `OperationProgress.last_line`／`stream` → `lines: Vec<ProgressLine>`（每行自帶 stream）
  - 空白行被忽略（避免終端機出現假進度）；`total_pushed` 與 `pending` 分開計數
- [x] 前端消費端配合（`ui/src/lib/arduino/compile-controller.js`）
  - `handleOperationStatus` 改為逐行附加 `payload.lines`，依 `stream` 決定 info／error 樣式
  - 保留對舊 `lastLine` 單行 payload 的相容
- [x] 序列埠／開發板 watcher（`src-tauri/src/events.rs` + `commands.rs` + `lib.rs`）
  - `PortInfo`（port + vid + pid）、`port_signature()`、`diff_ports()`、`PortChange`（Initial／Added／Removed／Replaced／Unchanged）
  - `PortChange::should_emit()`：`Unchanged` 不發事件
  - `SerialPortsChanged` payload、`PORT_POLL_INTERVAL_MS = 1500`
  - `commands::spawn_port_watcher()`：背景 `spawn_blocking` 迴圈，簽章 diff 後 emit `codebridge://serial-ports-changed` 並同步 `AppState.serial_ports` 快取
  - `scan_ports_detailed()` 取代原本只取名稱的 `scan_serial_ports()`
  - 於 Tauri `setup()` 啟動 watcher

### 技術深挖 (Technical Deep Dive)

#### `take_flush(1)` 讓雙門檻節流退化成單門檻
舊 `on_line` 永遠傳 `1` 作為 pending 行數，而 `1 >= 64` 恆為 false —— **行數門檻從未生效**，節流實際上只靠 200ms 時間門檻。更嚴重的是舊結構只保留 `last_line` 一行：兩次 flush 之間的所有中間行都被丟棄。實務上 gcc 的錯誤訊息、avrdude 的進度幾乎都落在被丟棄的區段，終端機只剩零星幾行。

修正方式是把緩衝獨立成 `LineBuffer`（不依賴 `AppHandle`），讓「保留哪些行、超過容量丟棄哪些、pending 如何影響門檻」都能在沒有 Tauri app 的情況下完整驗證。

#### 序列埠簽章必須包含 VID／PID
只比對埠名會漏掉最常見的換板情境：使用者從 COM3 拔下 Uno 插上 Nano，埠名不變。清單看似沒變，但 FQBN 必須重新判斷。因此簽章為 `port|vid|pid`，`PortChange::Replaced` 就是「埠名集合相同、簽章不同」的情況。

`serialport` 4.x 的 VID／PID 只在 `SerialPortType::UsbPort` 分支提供；內建 COM 口（`PciPort`）、藍牙埠與 `Unknown` 都視為 `None`。這代表部分機器上 `Replaced` 偵測能力會退化為「只比埠名」——這是 API 限制，非可修正的缺陷。

#### `Unchanged` 絕不可發事件
1500ms 一次的事件若無條件推送，前端會不斷重建 `serial-selector` 的選項，使用者剛選好的序列埠會被反覆重設。因此 `should_emit()` 讓 diff 結果直接決定是否 emit —— 這條規則寫成 `PortChange` 的方法而非 watcher 內的 if，讓意圖在型別層可見。

#### 首次掃描也要 emit
`diff_ports(current, None)` 回 `Initial` 而非 `Unchanged`：前端一開啟程式就需要完整清單，靜默等待「有變化」會讓下拉清單一直是空的。

### 驗證結果
- `cargo test`：**197 passed** + 4 個真實 `arduino-cli` 整合測試 passed（本輪開始時為 178 項）
- `cargo build`：成功（僅既有 `custom-protocol` cfg 警告）
- `npx vitest run tests/unit`：**78 passed**（6 個檔案）
- `npx playwright test`（多 worker 全量）：**92 passed**（2.0 分鐘，較前輪新增 2 項 compile-flow 測試）
- `npm run build`：成功（Vite 395ms）

### 下次啟動方向 (Next Steps)
1. ~~T2-D 前置~~：**已於本輪完成**（`LineBuffer` 修正 + 序列埠 watcher + signature-diff 事件）
2. **T2-D 主體**：`board-detector.js`、板子選擇面板、`serial-selector` 綁定、`MSG_BOARD_MISMATCH`
3. **板子層事件**：watcher 目前只推 `serial-ports-changed`；`board-detected`（port → fqbn）仍待實作
4. T2-E：cocoya 圖示搬遷、preset 微調、桌機實機上傳驗證

---

# 2026-09-26

## 2026-09-26：Arduino CLI 編譯與上傳（Phase T2-C：前端控制器與終端機）

### 已完成
- [x] 新增 `ui/src/lib/arduino/compile-controller.js`（`window.CodeBridgeCompile`）
  - `run()` / `upload()` / `stop()`、`isBusy()` / `getState()` / `onChange()`
  - 單飛（single-flight）：作業進行中忽略後續 `run()`
  - 流程：`compile_start` → `upload_ready` →（有舊 build 且有序列埠）`upload_start`
  - 送出前以 `CodeBridgePlainCode.strip()` 去除 ID marker，維持行號契約
  - 訂閱 `codebridge://operation-status` 與 `codebridge://compile-diagnostics`
  - `applyDiagnostics(inoFileName, diagnostics)` 雙向定位：1-based 行號 → 0-based `data-line-index`；只標記自己草稿（`<Stem>.ino`）的診斷
  - `resolveProjectId()` 由專案路徑推導 `[A-Za-z0-9_-]{1,64}` 識別
- [x] 新增 `ui/src/lib/ui/terminal-panel.js`（`window.CodeBridgeTerminalPanel`）
  - `append` / `appendLines` / `appendMessage`（`textContent`，不解析 HTML）
  - 自動捲動與暫停捲動、清除、開闔、`onChange` 通知
  - `MAX_LINES = 2000` 上限，超過丟棄最舊的行
- [x] 工具列上線：`btn-run` / `btn-stop` / `btn-terminal` / `btn-pause|clear|close-terminal` 移除 `disabled`；`toolbar-registry.js` 改為 `implemented: true`；`toolbar.js` 新增 6 個 `data-action`
- [x] `index.html` 載入兩個新 script（置於 toolbar 之前，確保 `init()` 時機正確）
- [x] `main.js` 以第 5 節初始化 `CodeBridgeCompile`（與 `ProjectIO` 共用 `store` / `getCode`）
- [x] `presets.css` 新增 `.terminal-line*` 與 `.code-line.diag-*` 樣式（Engineer / Angel 皆用 token）
- [x] i18n（zh-hant + en）補齊 15 個 key
- [x] 測試：`terminal-panel.test.js`（13）、`compile-controller.test.js`（21）、`compile-flow.spec.js`（11 E2E）、`toolbar-buttons.test.js` 更新

### 技術深挖 (Technical Deep Dive)
- **按鈕責任歸屬**：`#btn-terminal` 與三顆終端機工具列按鈕都帶 `data-action`，點擊已由 `toolbar.js` 的 document 委派處理。因此 `terminal-panel.js` **刻意不綁定 click**，否則同一次點擊會「開→關」互相抵銷，按鈕看起來像壞掉。這是與初版計畫的刻意偏離，並以單元測試鎖定。
- **`compileOperationId` 與 `activeOperationId` 分離**：`upload_start` 會覆寫 `activeOperationId`，但後端 `compile-diagnostics` 事件仍帶編譯作業的 id。若只比對 `activeOperationId`，上傳開始後回來的編譯診斷會被整個丟棄。`isOwnOperation()` 同時接受兩者。
- **`projectId` 長度截斷**：後端正則為 `^[A-Za-z0-9_-]{1,64}$`，超長專案名稱會被 `DRAFT_ERROR_INVALID_PROJECT_ID` 拒絕。單元測試抓到未截斷的缺陷，已加入 `MAX_PROJECT_ID_LENGTH`。
- **只標記自己草稿的診斷**：gcc 成功編譯時也會回報函式庫核心檔的警告，那些行號與使用者程式碼無關。依 `diagnostic.file === inoFileName` 過濾後才標記。
- **`setBusy(false)` 時清掉 `compileOperationId`**：避免上一輪的識別被下一輪的無關事件命中。
- **編輯工具的插入點陷阱**：`insert_line` 會插在該行「之前」，多次分塊建立檔案時容易吃掉原本的結尾大括號，造成語法仍合法但 `test()` 被巢狀在未閉合的函式內（vitest 顯示為 `No test found in suite`）。已用 `node --check` + 括號深度檢查逐檔驗證。

### 驗證結果
- `npx vitest run tests/unit`：**75 passed**（6 個檔案）
- `npx playwright test tests/e2e/compile-flow.spec.js`：**11 passed**
- `npm run build`：成功（Vite 183ms）
- `node --check`：`terminal-panel.js` / `compile-controller.js` / `toolbar.js` / `toolbar-registry.js` / `main.js` 全部通過

### 下次啟動方向 (Next Steps)
- 先修正 Rust `EventSink` 的緩衝（目前只保留一行且永遠 `take_flush(1)`，會遺失中間行、64 行門檻永遠不觸發），再做 T2-D 的 watcher
- T2-D：`board-detector.js`、板子選擇面板、`serial-selector` 綁定、`MSG_BOARD_MISMATCH`
- T2-E：cocoya 圖示搬遷、preset 微調、桌機實機編譯／上傳驗證

## 2026-09-26：Arduino CLI 編譯與上傳（Phase T2-B：Tauri 命令與事件串流）

### 已完成
- [x] 新增 `src-tauri/src/events.rs`：`FlushPolicy`（雙門檻 200ms／64 行，純函式）、`EventSink`（實作 `OutputSink` 並以 `emit_to` 推播）、`OperationProgress` payload、事件名稱集中管理。
- [x] 新增非同步命令 `compile_start` / `upload_start`（`spawn_blocking`）與 `upload_ready`；移除 `run_arduino_code` stub。
- [x] `AppState` 新增 `last_builds`（後端權威的 build 紀錄）與 `port_lease`（序列埠佔用鎖，T3 Monitor 沿用）。
- [x] 移除 `Operation.child` 死碼；`Operation` 新增 `line_count` / `result` / `push_line()`。
- [x] `RunResult` 新增 `line_count`；`StreamKind` 可序列化。
- [x] `tauri.conf.json` 補 `csp` 與 `devCsp`，結束 `csp: null`。

### 技術深挖 (Technical Deep Dive)
- **後端權威的 build 路徑**：`upload_start` 只接受 `projectId` / `fqbn` / `port`；build 目錄一律從 `last_builds` 查出，避免惡意 webview 指定 `--input-dir`。
- **死碼 `Operation.child` 是誘餌**：`Child` 無法安全跨執行緒共享，且會與串流 runner 內部的 kill 形成兩條路徑；正確做法是刪除而非接上。
- **節流策略抽成純函式**：`FlushPolicy::take_flush()` 可在無 Tauri app 的情況下完整驗證，`EventSink` 只剩薄層 emit。
- **事故與教訓**：曾以 `Get-Content | -replace | Set-Content -NoNewline` 批次取代字串，導致 `commands.rs` 的換行被完全抹除（334 行 → 1 行）。因該檔當時尚未被 git 追蹤修改，可用 `git checkout` 乾淨還原。**修改原始碼一律用 editor 工具或 Python `write_bytes()`。**

### 驗證結果
- `cargo test`：178 單元 + 4 整合測試全數通過（T2-A 為 163 + 4）。
- `cargo build`：成功，無新增警告。
- `npm run test:unit --prefix ui`：41 passed（前端未受影響）。

### 下次啟動方向 (Next Steps)
1. T2-C：`compile-controller.js`、`terminal-panel.js`、工具列執行／停止／終端機按鈕上線。
2. T2-D：`board-detector.js`、板子選擇面板、`MSG_BOARD_MISMATCH`。
3. T2-E：i18n 新 key、icon 複製、終端機面板 token 化。

## 2026-09-26：Arduino CLI 編譯與上傳（Phase T2-A：Rust 核心）

### 已完成
- [x] 撰寫 `log/plan/ArduinoCompileUpload.md`（含 cp950 根治、板子自動偵測、preset、i18n、icon 對策）。
- [x] 新增 `arduino/encoding.rs`：子進程輸出寬容解碼（UTF-8 → Big5/cp950 → GBK → windows-1252 → latin-1），根治 Windows webview 亂碼；對齊 #cocoya 的子進程編碼鐵律。
- [x] 新增 `arduino/draft.rs`：編譯草稿落地（stem 轉換、project id 白名單防路徑穿越、UTF-8 無 BOM + LF、清除舊草稿避免殘留 `.h`/`.cpp`）。
- [x] 改寫 `arduino/runner.rs` 為串流架構（`OutputSink`／`BoundedSink`／`run_streamed`），支援逐行進度、即時取消、逾時與管線背壓防護。
- [x] 新增 `arduino/pipeline.rs`：`compile_pipeline` / `upload_pipeline` / `verify_build` / `parse_size_report`，對 runner 泛型化以便完整單元測試。
- [x] 移除 `Operation.child` 死碼的準備（改由串流執行緒持有 `Child`）。
- [x] 新增 `src-tauri/tests/arduino_cli_smoke.rs`：對真實 arduino-cli 的端對端整合測試。
- [x] 修正 `command::version()` 遺漏子命令 token 的 T1 bug，並新增 `every_builder_passes_its_subcommand_token` 回歸保護。
- [x] 更新 `FILE_STRUCTURE.md`、工作日誌與本檔。

### 技術深挖 (Technical Deep Dive)
- **compile／upload 不使用 `--json`**：實測 arduino-cli 1.2.0 發現 `--json` 模式下 stderr 完全為空（連進度都被包進 JSON），終端機面板會一片空白。改用非 JSON 模式後分工正好符合需求：stdout 是人類可讀摘要，stderr 是 gcc/avrdude 診斷（正是既有 `diagnostics.rs` 的格式）。成功判定改用結束碼。
- **locale 會改變訊息文字**：`parse_size_report` 不比對「Sketch uses」等字面，改用「一行含數字緊接 `%`」的語言無關特徵。
- **成功編譯時 stderr 仍有函式庫警告**：後端原樣保留並附檔名，由 UI 依 `diag.file !== inoFileName` 決定能否跳轉。
- **整合測試抓到兩個單元測試抓不到的 bug**：`command::version()` 漏子命令 token（CLI 印 help 並 exit 0）；串流 runner 在子程序結束瞬間遺失在途的行（`version` 回傳空 stdout，`board list` 正常）。修法為結束前先 join reader 執行緒再抽乾。
- **Rust `\` 續行會吞掉下一行前導空白**：內嵌 Python 腳本時會破壞縮排而讓測試失效，改用 `concat!`。

### 驗證結果
- `cargo test`：163 單元測試 + 4 整合測試全數通過（基準 T1 為 93）。
- `cargo build`：成功，無新增警告。
- 真機 smoke：對 `arduino-cli 1.2.0` 實際執行成功與失敗兩種 compile，確認輸出分工、結束碼、build 產物與 locale 本地化行為。

### 下次啟動方向 (Next Steps)
1. T2-B：非同步 Tauri command 與事件串流、`last_builds`／`port_lease`、移除 `Operation.child`、補 CSP。
2. T2-C/T2-D：前端 compile controller、terminal 面板、板子自動偵測與選擇面板。
3. T2-E：i18n、icon 複製、終端機面板 token 化。

## 2026-09-26：CodeBridge Modules 語意積木 palette contract

### 已完成
- [x] 新增 `ui/src/theme/block-palette.js`，以 13 個語意角色取代 18 個 `*_HUE` message key 作為模組色碼唯一來源。
- [x] `blockly-adapter.js` 改為依 `block.type` 查語意角色取色，移除執行期色碼反查。
- [x] 新增 `CATEGORY_ROLES`，讓 Variables dynamic 分類也能對齊 Engineer／Angel palette。
- [x] 提供 `registerModule({id, role, typePrefix?, blockTypes?, colours})`，第三方模組可加入語意 palette contract。
- [x] 新增 4 個公開行為 contract：語意 manifest 覆蓋 toolbox 全部 block type、依 block type 重新著色、語系檔不再殘留 CodeBridge 專屬 `*_HUE`、第三方模組註冊。
### 相容層移除（專案未發佈，不保留 legacy）
- [x] 48 處 block 定義的 `colour: '%{BKY_XXX_HUE}'` 改為 `this.setColour(CodeBridgeBlockPalette.getColourForRole(role))`。
- [x] 刪除 9 個模組語系檔共 36 行 `*_HUE` 色碼 key 與「顏色」註解。
- [x] 刪除 `LEGACY_HUE_ROLES`、`syncLegacyHueMessages()`、`getRoleForMessageKey()`。
- [x] 刪除 `codebridgeTheme` 遷移與 `codebridgeBlockStyle` 第二鍵，持久化僅留 `codebridgeExperiencePreset`。
- [x] 刪除 toolbox XML 中 13 處硬編碼 `colour` 屬性，一律由 adapter 依語意角色設定。
- [x] `main.js` 主題切換移除 fallback 分支與雙鍵寫入。
### 技術深挖 (Technical Deep Dive)
- colour 是執行期狀態而非識別碼。舊色碼反查在 block 被手動改色後會染成錯誤角色；改用 `block.type` 後，顏色成為 block 的純函式結果。
- `jsonInit()` 只接受字串，無法在參數物件內呼叫函式取得色碼，因此顏色必須在 `jsonInit()` 之後以 `setColour()` 設定。
- Blockly 官方 `msg/en.js`、`msg/zh-hant.js` 自帶 `LOGIC_HUE`、`MATH_HUE`、`VARIABLES_HUE`（值為數字色碼），與 CodeBridge 模組的 `*_HUE` 無關，刪除模組定義後仍會存在。
- `getRoleForBlockType()` 依序檢查第三方註冊 → 精確 `TYPE_ROLES` → 第三方前綴 → 內建前綴，讓 `controls_for`（loops）之類例外不需特例程式碼。

### 驗證結果
- Theme suite：18 passed。
- 完整 `npm test`：35 passed。
- `npm run build`：成功。
- 備份：`backup/block_palette_20260926_090516`、`backup/remove_legacy_20260926_100401`。

### 下次啟動方向 (Next Steps)
> 當日已結案。以下項目已轉入文首「目前待辦」追蹤。

---

## 2026-09-26：工具列實作與 .cbg 專案（dirty 判斷）

### 已完成
- [x] Phase 0：`ui/src/lib/tauri/bridge.js` 建立 Tauri IPC 橋接層（`withGlobalTauri` + `capabilities/default.json`），純瀏覽器環境自動降級為 disabled 或 toast 提示。
- [x] Phase 1：`project-store.js` dirty（當前 XML vs 最後儲存 XML 字串比對）、`plain-code.js` 去除 ID marker、`confirm-dialog.js`、`toast.js`、`clipboard.js`；檔名圖示與 `#btn-save` 高亮連動、`beforeunload` 攔截、草稿自動還原。
- [x] `btn-copy-code`：複製去 marker 的 plain code，供貼到 Arduino IDE（含 execCommand fallback）。
- [x] Phase 2：`src-tauri/src/project.rs` 提供 `project_read/project_save/project_exists`（副檔名白名單、UTF-8 無 BOM、LF、BOM 容忍）；New / Open（含最近清單）/ Save / Save As / 範例全部實作。
- [x] 內建範例 `blink.cbg` 與 `serial-hello.cbg`（`ui/public/examples/`）。
- [x] 按鈕契約：未實作按鈕全部加入 `disabled`，以 `toolbar-registry.js` + `toolbar-buttons.test.js` 固定。

### 技術深挖 (Technical Deep Dive)
- `.cbp` 是 Code::Blocks 專案檔（舊名 `.cbproj`），C/C++ 教學學生會混淆；`.cbg` 無通用標準佔用，故採用 `.cbg`，且副檔名集中於 `CodeBridgeProject.EXT` 與 Rust `PROJECT_EXTENSION`。
- 專案只存空間 XML（結構上不落盤），不存 `.ino`：程式碼面板本身為唯讀，`coding_raw_*` 積木可承載任意手寫 C++，雙檔同步問題直接消失。
- metadata 收錄在根元素的 `cbp:` namespaced 屬性；Blockly 重建 XML 時不會保留自訂屬性，因此寫檔時必須重新注入（serialize 作為冪等函數會先剔除舊屬性）。
- dirty 以字串比對而非事件計數：undo 回原狀會自動清除 dirty，且 change listener 需避開 `isUiEvent`（與 `updateOrphanBlocks` 同條件）。
- 事件委派監聽器的 `event.currentTarget` 是 `document` 而非匹配元素，因此工具列動作簿一律使用 `event.target.closest('[data-action]')` 結果。
- `theme-runtime.spec.js` 原本以 `document.querySelector('.dropdown-content')` 取第一個下拉，新增下拉後會指到錯的元素；已改為從 `#btn-settings-root` 取對應 dropdown。

### 驗證結果
- `npm run test:unit`：Vitest 39 passed。
- `npm test`：Playwright 44 passed（含 `toolbar.spec.js` 9 項）。
- `cargo test`：90 passed（含 `project::tests` 5 項）。
- `npm run build`、`cargo build`：成功。
- 備份：`backup/toolbar_phase0_20260926_150000`。

### 下次啟動方向 (Next Steps)
> 本輪已結案；未實作項已轉入文首「目前待辦」的「工具列後續」小節追蹤。


# 2026-09-25

## 2026-09-25：產品方向調整(參考#piBlockly 及 #pbm)

### 已確認決策
- [x] 建立 `log/plan/CodeBridgeV2.md` 與 `log/plan/CodeBridgeModulesRepository.md`

### 核心積木
- [ ] 補齊內建 Language／Coding 積木：loops、math、variables、text、array、functions
- [ ] 將內建核心模組全面改為 manifest-driven contract
- [ ] 保留 `arduino_pin_shadow`、code buckets 與 `Blockly.Arduino.forBlock[]` 規範
- [ ] 核心與遠端模組共用同一 Module Runtime contract

### Module Runtime
- [ ] 實作內建、遠端、使用者模組三種來源
- [ ] 實作 manifest schema、相容範圍、checksum 與依賴驗證
- [ ] 實作 messages → blocks → generators → toolbox 的固定註冊順序
- [ ] 實作本地 cache、原子更新、rollback 與離線模式
- [ ] 拒絕重複 ID、重複 block type、缺 generator 與無效 toolbox reference

### Generator 與 Code
- [ ] 將 marked code、plain code 與 source mapping 正式分離
- [ ] 確保 Blockly ID marker 永不寫入正式 `.ino`
- [ ] 補齊核心與遠端模組的 block-to-code 定位測試
- [ ] 實作完整可編輯 C++ 模式與手動修改分歧狀態

### Project 與 Toolchain
- [ ] 定義 `.ino`、Blockly XML 與 CodeBridge project metadata
- [ ] 整合 Arduino CLI 環境偵測與 `--json` command builder
- [ ] 實作 Board Manager：core 搜尋、安裝、移除、升級與 board discovery
- [ ] 實作 Library Manager：library 搜尋、安裝、移除、升級與相依檢查
- [ ] 實作 compile、upload、operation progress、cancel 與 compiler diagnostics
- [ ] 上傳前暫停相同序列埠 Monitor，完成後依設定重連

### Serial
- [ ] 以 Rust serialport 實作雙向 Serial Monitor
- [ ] 支援 port、baud、timestamp、HEX、篩選、清理與重連
- [ ] 建立 CSV、tab、`label:value` Plot Data Parser
- [ ] 建立 ring buffer、pause、clear、reconnect 與 downsampling
- [ ] 評估並選定 uPlot 或其他即時圖表 renderer

### 品質與安全
- [ ] 建立最高層 module contract integration tests
- [ ] 建立舊 piBlockly XML migration fixtures
- [ ] 建立 generator golden tests 與 source mapping tests
- [ ] 為 Tauri 設定明確 CSP，移除正式發行版 `csp: null`
- [ ] 限制官方模組下載為 HTTPS，驗證 checksum 與 module compatibility

## 2026-09-25：Blockly 更新至 v13.3.0

### 已完成
- [x] 備份 Blockly 12.3.1 core、Python generator 與外掛
- [x] core、Python generator 與 5 個外掛更新至 13.3.0
- [x] 加入英文／繁中 Blockly 基礎訊息 snapshot
- [x] 修正 v13 ARIA 基礎訊息載入順序
- [x] 明確使用 Thrasos renderer 與 Classic theme
- [x] 停用所有 Blockly 操作音效（`sounds: false`）
- [x] 建立資源 SHA-256 清單與 v13 API mapping
- [x] 通過 Vite build 與 Edge headless runtime／v12 XML／Arduino 產碼驗證

### 後續
- [ ] 將目前一次性的 Edge smoke test 納入長期 CI fixture
- [ ] 隨 variables、array、functions 模組增加更多 v12 XML 與 generator golden fixtures

## 2026-09-25：Blockly 永久回歸測試與 CI

### 已完成
- [x] 加入 Vitest 5.0.1 與 Playwright Test 1.63.0，依賴 audit 為 0 vulnerabilities
- [x] 建立 system Edge runtime contract
- [x] 建立 v12 XML migration fixtures：setup/loop、controls_if、controls_for、text、workspace comment
- [x] 建立 generator golden tests
- [x] 建立 Blockly 資源 bytes／SHA-256 manifest tests
- [x] 建立 Windows GitHub Actions CI
- [x] 修復 v13 standard blocks／mutator 載入缺口
- [x] 建立 v12 controls_if mutation 輸入轉換層
- [x] 修復初始 XML 與 style reload 後 ARIA stack label

### 後續
- [ ] 補齊 variables、array、functions 時擴充各模組 XML fixtures
- [ ] marked code 與 plain code 分離後，golden tests 改驗正式輸出不含 ID marker

## 2026-09-25：補齊 Variables 模組與正式 v12 XML migration contract

### 已完成
- [x] 建立 Variables 模組：全域／區域變數宣告、variables_get、variables_set。
- [x] 建立正體中文／英文 Angel 訊息與 Engineer 風格 C++ 語法覆寫。
- [x] 將 Variables 分類從 common 模組移至專屬模組，並同步 toolbox、index.html 與 loader.js。
- [x] 建立含 variable model 的 v12 XML fixture，驗證 id、name、type 與 field_variable 綁定。
- [x] 建立 Variables generator golden contract，驗證 global_vars_、變數賦值與變數取值。
- [x] 更新 Blockly 13.3.0 runtime／module contract 與 Angel／Engineer 雙風格測試。

### 驗證結果
- Variables v12 migration fixture 通過。
- Blockly module asset contract：4 tests passed。
- Blockly runtime／雙風格 contract：2 tests passed。
- 全部 v12 migration／golden fixtures：7 tests passed。
- 待完成：完整 `npm test` 與 production build 驗證。

- [x] 完整 `npm test --prefix ui` 與 `npm run build --prefix ui` 驗證通過。

## 2026-09-25：新增 Array 與 Functions 模組

### 已完成
- [x] 依 piBlockly 對齊 5 個 Array 公開積木、型別、色彩、雙風格訊息與 Arduino C++ 產生器。
- [x] 依 piBlockly 對齊 5 個 Functions 公開積木與 2 個 mutator-only helper。
- [x] Functions mutation 保留 v12 XML 的 `mutation`／`arg name`／`arg type` 結構，並以 Blockly 13.3.0 API 實作 mutator lifecycle。
- [x] 函式原型與定義分別寫入 `function_prototypes_`／`function_definitions_`。
- [x] 將 Array／Functions 分類訊息從 common 移至專屬模組，並同步 toolbox、index.html、loader.js 與 Engineer style。
- [x] 新增 array.xml、functions.xml v12 migration fixtures 與 generator golden contracts。
- [x] 修正 ArrayBlock.md、FunctionsBlock.md 與 TextBlock.md 中根層級積木、helper 可見性、訊息數量及 v12 API 描述錯誤。

### 驗證結果
- Array v12 migration fixture 通過。
- Functions v12 mutation 與 generator golden fixture 通過。
- Blockly module asset contract：4 tests passed。
- Playwright runtime／migration／雙風格：12 tests passed。
- `npm test --prefix ui`：成功。
- `npm run build --prefix ui`：成功；僅有既有非 module UMD script bundling warnings。

### 技術深挖 (Technical Deep Dive)
- piBlockly Functions 原始碼含 Blockly v12 VariableMap／Procedures API；CodeBridge 保留公開 block type、field、input 與 mutation XML，但不移植已失效的自動 Procedures 同步。
- `array_declare_global` 與兩個函式定義是根層級積木；區域陣列宣告、陣列設定、return 與 statement 呼叫仍須置於合法 statement 容器。
- 手動呼叫積木依自身 mutation 產生參數，不依賴 Blockly 內建 Procedures 自動更新；compose 時以參數名稱保留既有 value connection。
- `custom_functions_return` 產生器不再手動加入兩個空格，函式本體縮排統一由 `statementToCode()` 處理。

### 下次啟動方向 (Next Steps)
1. 評估是否將 marked code 與 plain code 分离，讓 golden tests 直接驗證正式 `.ino` 不含 ID marker。
2. 後續新增自動同步型客製函式呼叫時，應先定義 Blockly 13 Procedures integration contract，不直接複製 piBlockly v12 API。

### 最終驗證補充
- 新增 toolbox／runtime block definition 契約：10 個公開 block reference 完整，12 個 Array／Functions block definitions（包含 2 個 mutator helper）皆可在 Blockly 13.3.0 執行期建立。
- 最終完整 `npm test --prefix ui`：Vitest 4 tests passed、Playwright 13 tests passed。
- 最終 `npm run build --prefix ui`：成功；警告僅為既有非 module UMD script bundling warnings。

## 2026-09-25：新增 Toolbox 積木搜尋框

### 已完成
- [x] 依 Cocoya 行為新增 Blockly toolbox 上方搜尋框。
- [x] 搜尋引擎以實際 toolbox language tree 建立公開 block definition 索引，不搜尋 mutator-only helper。
- [x] 支援 block type、Blockly message、tooltip、欄位文字與分類名稱搜尋，採不分大小寫的多關鍵字 AND 比對，最多顯示 30 筆。
- [x] 支援清除按鈕、Escape、無結果訊息、鍵盤 aria label 與 IME composition。
- [x] 點擊搜尋結果新增 block 後自動清空搜尋並隱藏 flyout。
- [x] `setBlockStyle()` 更新 toolbox 後自動重建索引並保留查詢字串。
- [x] 新增正體中文／英文搜尋 UI 訊息、Cocoya 風格 CSS 與 `CodeBridgeBlockSearch` 公開 API。
- [x] 新增 Playwright toolbox search contract，覆蓋 Array 搜尋、helper 排除、清除、無結果與雙風格刷新。

### 技術深挖 (Technical Deep Dive)
- Blockly 13.3.0 toolbox 根節點使用 `.blocklyToolbox`，因此同時保留 `.blocklyToolboxDiv` fallback，不能直接沿用 Cocoya 舊 selector。
- 搜尋不掃描整個 `Blockly.Blocks`，而是掃描目前 toolbox language tree 的公開 block item，避免把 `custom_functions_mutatorcontainer`／`custom_functions_mutatorarg` 等 helper 顯示為可拖入積木。
- `controls_for` 的既有 loops `setTimeout(updateLabels)` 會在暫時 block dispose 後執行；搜尋引擎跳過該 block 的暫時實例化，但保留其既有 message 索引，避免搜尋功能引入 browser pageerror。
- 分類名稱會由 language tree category 遞迴加入搜尋 blob，讓 Arduino／Array／Functions 等分類名稱也可被搜尋。

### 驗證結果
- `npm test --prefix ui`：Vitest 4 tests passed、Playwright 15 tests passed。
- `npm run build --prefix ui`：成功；僅有既有非 module UMD script bundling warnings。
- 新增 toolbox search runtime contract 無 browser console error／warning。

### 下次啟動方向 (Next Steps)
1. 若未來 Blockly 支援可安全建立 headless temporary block，可移除 `controls_for` 的暫時實例化 skip，改為更完整的欄位文字索引。
2. 若 Variables dynamic category 需要被搜尋，可新增 Blockly Variables dynamic dropdown 的 definition adapter，不直接掃描所有全域 block types。

## 2026-09-25：修正 value block 程式碼定位

### 問題與修正
- 問題：點選 `digitalRead()` 等 value block 時沒有高亮，也沒有錯誤訊息。原因是既有 `scrub_()` 只替 statement block 寫入 ID marker，`valueToCode()` 產生的 expression 沒有 block-to-source mapping。
- 修正：CodeBridge generator core 統一包裝 `valueToCode()`，對非 shadow、非 `math_number` 的 value block 加入合法 C++ block comment marker。
- `renderCode()` 與 migration golden cleanup 支援含特殊字元的 Blockly 13 block ID，並移除 block comment marker 後再交給 syntax highlighter。
- 保留 `math_number` 與 shadow block 不加 marker，避免破壞 `controls_for` 的數字字面值判斷與既有 simple-for 產碼。

### 測試
- 新增 `digital-read.xml` v12 fixture。
- 新增「點選 digitalRead value block 高亮生成行」回歸測試。
- `npm run test:blockly:fixtures --prefix ui`：10 tests passed。
- `npm run test:blockly:runtime --prefix ui`：6 tests passed。
- `npm run test:blockly:assets --prefix ui`：4 tests passed。
- `npm run build --prefix ui`：成功；僅有既有非 module UMD script bundling warnings。

### 技術深挖 (Technical Deep Dive)
- value marker 使用 `/* // __BLOCKLY_ID:<id>__ */`，可放在表達式內，不會破壞 `digitalRead()` 或 `Serial.print(digitalRead())` 的 C++ 語法。
- marker 只用於定位資料，renderCode 解析後會移除，不應出現在正式 `.ino`。
- Blockly 13 的 block ID 可能包含 `*` 等符號，因此清理 regex 不能再用排除 `*` 的字元集合。

## 2026-09-25：CodeBridge Engineer／Angel 體驗主題架構

### 已完成
- [x] Engineer 定義為 `technology-dark` 深色科技視覺 + Engineer C/C++ message overlay。
- [x] Angel 定義為 `candy-light` 明亮糖果視覺 + Angel 自然教學 message overlay。
- [x] 新增 `CodeBridgeTheme` 高階 interface，協調 visual theme、block style、儲存、fallback 與 Blockly workspace。
- [x] 新增 `codebridgeExperiencePreset` 與 `codebridgeBlockStyle`，舊 `codebridgeTheme` 自動遷移。
- [x] 新增集中式 CSS semantic tokens，涵蓋 UI、Blockly chrome、程式碼高亮、練習模式與提示面板。
- [x] Blockly adapter 依 visual theme 使用不同 component theme、grid 與 block palette。
- [x] `setBlockStyle()` 改為原地 `Blockly.setLocale()` 重繪，不再 clear/reload workspace。
- [x] toolbox search 與 workspace ARIA label 在 Engineer／Angel 切換後同步更新。
- [x] 新增 9 個 Playwright 公開行為 contract，覆蓋預設、切換、刷新、遷移、fallback、surface、資料安全與 palette。

### 技術深挖 (Technical Deep Dive)
- Engineer／Angel 對外是單一 preset，但內部保留 `visualTheme` 與 `blockStyle` seam，避免未來視覺與教學文字永久綁死。
- 舊 `setBlockStyle()` 的 clear/reload 會觸發孤兒積木 detector，將 `disabled-reasons="orphan"` 寫回 XML；主題切換改用 events-disabled 的原地 locale refresh，workspace XML 與產碼保持不變。
- Blockly 13 會在 block 建立時解析 `colour: "%{BKY_XXX_HUE}"`；Blockly adapter 因此同時更新 `*_HUE`、既有 block colour 與 toolbox XML colour，不改 block type 與 generator contract。
- 未知 `codebridgeExperiencePreset` 安全 fallback 到 Engineer；語系 `codebridgeLang` 與 preset 相互獨立。

### 驗證結果
- Theme runtime：9 tests passed。
- Blockly runtime：6 tests passed。
- v12 migration／golden：10 tests passed。
- Blockly assets：4 tests passed。
- 合計 29 tests passed。
- `npm run build --prefix ui`：成功；僅有既有非 module UMD script bundling warnings。

### 下次啟動方向 (Next Steps)
> 全部 3 項已於 2026-09-26 完成（見上方 2026-09-26 章節）。

---
## 2026-09-25：Arduino CLI 工具鏈 Phase T1（B 方案）

### 決策摘要
1. 授權決策採 **B 方案**：CodeBridge **不內嵌打包** `arduino-cli` 執行檔。`arduino-cli` 為 GPL-3.0，官方 README 明載商業情境需購買授權；內嵌分發會使 CodeBridge 承擔 GPL 義務並阻礙未來閉源商業化。改採「外部依賴 + 自動引導安裝」。
2. CLI 路徑解析優先序：使用者設定路徑 → 系統 PATH → 回報 `CLI_ERROR_NOT_FOUND` 並附安裝指令與官方網址。使用者設定的路徑若失效，**不靜默 fallback**，直接回報設定錯誤。
3. 設定隔離：所有 CLI 呼叫一律帶 `--config-dir <app_data>/arduino`，資料置於 `arduino/data`、使用者目錄 `arduino/user`、下載 `arduino/downloads`，草稿暫存於 `app_data/sketches`。不污染使用者的 `%LOCALAPPDATA%\Arduino15`。
4. 不使用 `tauri-plugin-shell` 執行 CLI，改用 `std::process::Command`（對齊 cocoya `mcu.rs`），以取得 stderr 管線、逐行解析與 `kill()` 取消能力。
5. `ProcessRunner` 抽為 trait，讓 command → 執行 → 解析全流程可在未安裝 arduino-cli 的環境下測試。
6. 編譯器診斷支援 gcc 的冒號式（`<path>:<line>:<col>:`）與括號式（`<path>(<line>,<col>)`）兩種格式，Windows 磁碟機冒號不會被誤判。

### 新增檔案
- `src-tauri/src/arduino/mod.rs`：公開 facade、`ToolchainStatus`、`InstallHint`、`CodeBridgeToolchain`。
- `src-tauri/src/arduino/paths.rs`：`CliHandle` / `CliSource` / `CliError` / `ToolchainDirs` 與 `resolve_cli`。
- `src-tauri/src/arduino/command.rs`：純函式 command builder，覆蓋 `version` / `board list|listall|search|details|attach` / `core list|search|install|uninstall|update-index` / `lib search|list|install|uninstall` / `compile` / `upload` / `monitor` / `config init|dump`。
- `src-tauri/src/arduino/parser.rs`：`--json` 回應解析，欄位依 CLI 實際的 snake_case 命名。
- `src-tauri/src/arduino/runner.rs`：`ProcessRunner` trait、`StdProcessRunner`、`RunRequest` / `RunResult`、雙管線背景讀取與 `try_wait` 輪詢逾時。
- `src-tauri/src/arduino/diagnostics.rs`：`Diagnostic` / `DiagnosticSeverity` 與行號解析。
- `src-tauri/src/arduino/operations.rs`：`OperationRegistry`（狀態、取消旗標、prune）。

### 修改檔案
- `src-tauri/src/lib.rs`：`AppState` 擴充（cli_path_override、board_manager_urls、operations、toolchain_dirs），啟動時建立隔離目錄，新增 `toolchain()` / `resolve_cli_for()` 與 `events` 事件名稱。
- `src-tauri/src/commands.rs`：改為唯讀查詢命令（`toolchain_detect`、`toolchain_set_cli_path`、`board_list_detected`、`board_list_all`、`board_details`、`core_list`、`lib_list`、`operation_status`、`operation_cancel`、`refresh_serial_ports`）。`run_arduino_code` / `open_serial_monitor` 改為明確回報未實作，避免留下可被呼叫的空殼。
- `ui/src/lib/i18n/zh-hant.js` + `en.js`：新增 `CLI_*`、`SERIAL_MONITOR_NOT_IMPLEMENTED`、`COMPILE_NOT_IMPLEMENTED` 共 44 個 key，中英完全對齊。
- `FILE_STRUCTURE.md`：補入 `src-tauri/src/arduino/` 結構與 B 方案說明。

### 技術深挖 (Technical Deep Dive)
#### arduino-cli 的 JSON 欄位是 snake_case
最初為 parser 的 struct 加上 `#[serde(rename_all = "camelCase")]` 會導致全部欄位解析為空——CLI 實際輸出 `installed_version`、`build_path`、`tools_dependencies` 等 snake_case 鍵。最終移除 camelCase 改用預設 snake_case，並對 `VersionString`（大寫開頭的特殊命名）使用顯式 `rename`。Tauri 傳給前端的 payload 則在 `commands.rs` 內以 `serde_json::json!` 手動組成 camelCase，兩層職責分離：解析層貼合 CLI、輸出層貼合前端。

#### gcc 行號解析不可由左往右掃描
`C:\path\sketch.ino:7:3: error: ...` 的磁碟機冒號會讓 naive 的 `rsplitn(3, ':')` 誤判。正確作法是逐一檢查每個 `": "` 候選點（檔名不可能含「冒號＋空格」），判斷其前綴是否以 `:<line>:<col>` 結尾；這同時排除了 `C:\`（冒號後接反斜線）。

#### 執行檔搜尋需同時接受目錄與檔案
`resolve_cli` 的 `path_override` 語意統一為「待搜尋目錄」，交由 `search_in_dir` 處理，避免出現「傳入目錄卻被當成執行檔」的陷阱。Windows 下需同時嘗試 `arduino-cli.exe` 與無副檔名的 `arduino-cli`（部分安裝方式產生 shim）。

#### 逾時採 try_wait 輪詢而非新 crate
以 50ms 間隔 `try_wait` 輪詢，逾時時 `kill()` 子程序，不需引入 `wait-timeout` 等額外依賴。stdout 與 stderr 各由獨立執行緒讀乾淨，避免輸出量大時子程序阻塞於滿管線造成死鎖。

#### 錯誤訊息對前端採 KEY|detail 格式
`describe()` 統一輸出 `CLI_ERROR_XXX|詳細訊息`，前端以 `KEY` 查 i18n、`詳細訊息` 作為補充。`RunResult::error()` 為非消耗版本，可在仍需讀取 stdout 時安全呼叫（`into_error()` 會消耗 self）。

### 驗證結果
- `cargo test --lib`：85 tests passed、0 failed、0 warnings。
- `npm run build --prefix ui`：成功（376ms）。
- `npx vitest run tests/unit/blockly-assets.test.js`：4 tests passed，無回歸。
- 中英 i18n key 數量一致（80 = 80），Rust 引用的 15 個 key 皆存在於語系檔。

### 下次啟動方向 (Next Steps)
1. 進入 Phase T2：compile / upload 的草稿寫入（plain code 落地、marker 不寫入磁碟）、operation 事件串流與 compiler diagnostics 雙向定位。
2. Phase UI-1：工具列板子選擇器與設定選單擴充（Board Manager / Library Manager / CLI 設定），讓 T1 的查詢命令有 UI 消費者。
3. `tauri.conf.json` 仍為 `csp: null`，啟用 CLI 串流前需補明確 CSP。
4. 若需要真正的 runtime 整合測試，可考慮以 `arduino-cli` 官方 binary 作為 CI fixture，或維持目前的 `FakeProcessRunner` 純單元測試策略。

---

# 2026-07

初期開發階段：架構建立、模組移植與練習模式。
所有模組移植均已完成；Loops 與工作區註解的待驗證項目已彙整至文首「目前待辦」。

### 2026-07-20：piBlockly 積木移植 - 架構重構與 Phase 1
- [x] 分析 piBlockly 模組載入機制與架構
- [x] 確立 Locale + Style Overlay 雙風格方案
- [x] 完成訊息系統、積木定義、產生器移植
- [x] 建立主題、工具箱、模組載入系統

### 2026-07-22：模組化重構（方案 A）
- [x] blocks.js 拆分為 modules/arduino/ 結構
- [x] generators.js 拆分為 modules/arduino/
- [x] i18n 三層架構：UI 翻譯（lib/i18n/）vs 積木訊息（modules/*/）
- [x] 建立 loader.js + style/engineer.js
- [x] 建立 modules/common/ 存放暫置分類名稱

### 2026-07-24：補上 setup()/loop() Angel 風格文字
- [x] 確認風格切換 localStorage 保留機制正常（main.js 第 124/141 行）
- [x] zh-hant.js: `INITIALIZES_SETUP_APPENDTEXT` → '初始化設定 (void setup)'
- [x] zh-hant.js: `INITIALIZES_LOOP_APPENDTEXT` → '重複執行 (void loop)'
- [x] en.js: `INITIALIZES_SETUP_APPENDTEXT` → 'Setup (void setup)'
- [x] en.js: `INITIALIZES_LOOP_APPENDTEXT` → 'Loop (void loop)'
- [x] engineer.js 無需修改，保留 void setup() / void loop()


### 2026-07-25：程式碼預覽修復 + 預設積木 + 風格切換 + 孤兒積木 + 程式碼定位
- [x] 建立 `_core.js`（Blockly.Arduino generator 核心）
- [x] 修改 `generators.js`（setup/loop 對齊 piBlockly 程式碼籃子）
- [x] 修改 `index.html`（載入 _core.js）
- [x] 修改 `main.js`（預設積木、renderCode、syncSelection、孤兒積木）
- [x] 修改 `loader.js`（setBlockStyle 工作區重新載入）
- [x] 修改 `style.css`（高亮行樣式）

---

### 積木移植清單（2026-07 當時規劃，現已全部完成）
- [x] 移植 Coding 積木 → `modules/coding/`
- [x] 移植邏輯積木（if/else, compare, operation, boolean）→ `modules/logic/`
- [x] 移植迴圈積木（for, while, repeat）→ `modules/loops/`
- [x] 移植數學積木（constrain, map, random）→ `modules/math/`
- [x] 移植變數積木 → `modules/variables/`
- [x] 移植文字積木 → `modules/text/`
- [x] 移植陣列積木 → `modules/array/`
- [x] 移植函式積木 → `modules/functions/`

### 注意事項
> **⚠️ 移植上述模組時，務必同步清理 `modules/common/zh-hant.js` 與 `modules/common/en.js`**
>
> 例如移植 logic 模組時：
> 1. 從 `modules/common/zh-hant.js` 移除 `LOGIC_CATEGORY`
> 2. 從 `modules/common/en.js` 移除 `LOGIC_CATEGORY`
> 3. 加入 `modules/logic/zh-hant.js` + `en.js` 定義該分類
> 4. 更新 `index.html` 載入順序

#### 縮排處理規範（2026-07-26 更新）
> **✅ 已統一使用 Blockly INDENT 功能，未來移植無需額外處理縮排**

**自動處理（無需擔心）：**
- setup() 和 loop() 內的程式碼：已透過 `finish()` 統一縮排
- 一般陳述式積木（如 pinMode、digitalWrite）：返回單行 + `\n`，不涉及縮排

**遵循 Blockly 標準模式：**
- **容器型積木**（if/else、for、while、自定義函式）：
  - 使用 `statementToCode(block, 'INPUT_NAME')` 取得子積木程式碼
  - Blockly 會自動加入縮排，**不要**手動處理
  ```javascript
  var statements = Blockly.Arduino.statementToCode(block, 'DO');  // ✅ 正確
  ```

- **數值/字串積木**：
  - 使用 `valueToCode(block, 'INPUT_NAME', ORDER)` 取得表達式
  - 返回陣列 `[code, order]`
  ```javascript
  var value = Blockly.Arduino.valueToCode(block, 'VALUE', Blockly.Arduino.ORDER_ATOMIC);
  return ['digitalRead(' + value + ')', Blockly.Arduino.ORDER_ATOMIC];  // ✅ 正確
  ```

**關鍵區別：**
| 方法 | 用途 | 縮排處理 |
|-----|------|---------|
| `statementToCode()` | 容器積木的陳述式輸入 | ✅ 自動加入縮排 |
| `blockToCode()` | 取得單一積木的原始程式碼 | ❌ 不含縮排 |
| `valueToCode()` | 取得表達式/數值 | ❌ 不含縮排 |

**移植檢查清單：**
1. ✅ 是否為 setup/loop 內容？→ 會自動縮排（已統一處理）
2. ✅ 是否為容器型積木（if/for/while/函式）？→ 使用 `statementToCode()`
3. ✅ 是否為數值/字串積木？→ 使用 `valueToCode()`
4. ❌ **不需要**在產生器中手動處理縮排（除非有特殊需求）

**參考實作：**
- `modules/arduino/generators.js` 第 11-22 行（setup/loop 使用 `blockToCode`）
- `modules/arduino/generators.js` 第 25-110 行（一般積木使用 `valueToCode`）

### 2026-07-26：程式碼撰寫導航員 - 實作 Phase 1~3
- [x] 審核並更新 pilot.md 為 v1.1
- [x] 建立 `ui/src/lib/practice/practice-mode.js`（比對引擎 + 提示系統）
- [x] 修改 `index.html`（加入練習模式 UI + script 載入）
- [x] 修改 `style.css`（加入練習模式樣式）
- [x] 修改 `main.js`（加入 initPracticeMode 呼叫）
- [x] 修改 `i18n/zh-hant.js` + `en.js`（加入 PRACTICE_xxx key）
- [x] 更新 `FILE_STRUCTURE.md`

### 2026-07-27：程式碼撰寫導航員 - 除錯與優化
- [x] 修正 F2 提示行號錯位問題（註解行處理）
- [x] 加入括號間距寬容處理（`setup( )` → `setup()`）
- [x] 加入 token 空白標準化（逗號、運算子、關鍵字）
- [x] 作弊窗改為可拖曳全域浮動視窗
- [x] 作弊窗內容改為保留縮排的原始程式碼
- [x] 作弊按鈕 tooltip 狀態切換
- [x] 移除程式碼預覽面板左上角重複的關閉按鈕
- [x] 進入練習模式時鎖定工作區（多層防護：readOnly + setEnabled + 灰色遮罩）
- [x] 行號 tooltip 顯示警告訊息
- [x] 修正 F2 提示邏輯（使用比對結果計算 currentLineIndex）

### 2026-07-26：啟用 Blockly 工作區註解
- [x] 診斷右鍵工作區缺少 'Add comment' 選項
- [x] 在 Blockly v13 的 `ContextMenuItems.registerCommentOptions()` 中加入工作區註解選項
- [ ] 驗證工作區註解功能在瀏覽器中正常運作
- [ ] 考慮工作區註解的保存／載入（XML 序列化）

### 2026-07-27：移植 Loops 模組 (Engineer 風格對齊 piBlockly)
- [x] 建立 `modules/loops/zh-hant.js`（Angel 風格基底訊息）
- [x] 建立 `modules/loops/en.js`（Angel 風格基底訊息）
- [x] 建立 `modules/loops/blocks.js`（3 個自訂積木：controls_while, controls_for, controls_flow_statements）
- [x] 建立 `modules/loops/generators.js`（3 個 Arduino 產生器）
- [x] 從 `modules/common/zh-hant.js` 移除 `LOOPS_CATEGORY`
- [x] 從 `modules/common/en.js` 移除 `LOOPS_CATEGORY`
- [x] 更新 `style/engineer.js`（3 個 loops key 對齊 piBlockly Engineer 風格）
- [x] 更新 `index.html`（加入 loops 模組 script 標籤）
- [x] 更新 `loader.js`（加入 LOOPS_ZH/LOOPS_EN 註冊）
- [x] 更新 `FILE_STRUCTURE.md`（加入 loops/ 目錄說明）
- [x] 待驗證：toolbox 分類名稱正確顯示
- [ ] 待驗證：所有 3 個積木可拖入工作區
- [ ] 待驗證：程式碼生成正確 (while, for, break/continue)
- [ ] 待驗證：風格切換後分類名稱與積木文字正常
- [ ] 待驗證：孤兒積木檢測正常

### 2026-07-27：後續任務
- [ ] 從網路匯入感測器與致動器模組（對齊 #piBlockly 匯入的 #pbm）
