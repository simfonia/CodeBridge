# CodeBridge 任務進度

## 目錄

- [目前待辦](#目前待辦)
- [2026-09-26](#2026-09-26)
  - [工具列實作與 .cbg 專案](#2026-09-26工具列實作與-cbg-專案)
- [2026-09-25](#2026-09-25)
- [2026-07](#2026-07)

---

## 目前待辦

> 本節為**彙整視圖**，集結各日期章節中所有未完成項目。
> 各章節內仍保留原始清單以維持歷史紀錄，兩者若有差異以本章節為準。

### 工具列後續（2026-09-26 本輪凍結，需另開一輪）
- [ ] Phase 3 Serial Monitor / Terminal：`btn-refresh-serial`、`serial-selector`、`btn-terminal`、`btn-pause/clear/close-terminal`、Rust `open_serial_monitor` 串流（port/baud/重連/HEX/時間戳待討論）
- [ ] `btn-run` / `btn-stop`：等 Arduino CLI T2 compile/upload 完成後接 operation 事件串流
- [ ] Phase 4 `btn-diagnose` 與設定選單擴充（Board Manager / Library Manager / CLI 設定）
- [ ] `.cbg` Windows 副檔名註冊與雙擊開檔（argv 解析、NSIS/WiX 自訂腳本）
- [ ] 匯出 `.ino` 檔（選配；貼到 IDE 的需求已由「複製程式碼」滿足）
- [ ] 工具列組態治理：讓 `btn-exit-practice`、`btn-cheat-close` 也經過 `data-action` 契約（目前由 practice-mode.js 自行綁定）
- [ ] 總提供 `chevron-down` 與 `history` 圖示（下拉與最近專案圖示）

### 下一階段主線：Arduino CLI 工具鏈 Phase T2
- [ ] compile / upload 的草稿寫入（plain code 落地、marker 不寫入磁碟）
- [ ] operation 事件串流與 compiler diagnostics 雙向定位
- [ ] Phase UI-1：工具列板子選擇器與設定選單擴充（Board Manager / Library Manager / CLI 設定）
- [ ] 補明確 CSP（`tauri.conf.json` 目前仍為 `csp: null`，啟用 CLI 串流前必須處理）

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
- [ ] 將目前一次性的 Edge smoke test 納入長期 CI fixture
- [ ] 隨新模組增加更多 v12 XML 與 generator golden fixtures
- [ ] marked code 與 plain code 分離後，golden tests 改驗正式輸出不含 ID marker
- [ ] 若未來 Blockly 支援可安全建立 headless temporary block，可移除 `controls_for` 的暫時實例化 skip，改為更完整的欄位文字索引
- [ ] 若 Variables dynamic category 需要被搜尋，可新增 definition adapter，不直接掃描所有全域 block types
- [ ] 若需要真正的 runtime 整合測試，可考慮以 `arduino-cli` 官方 binary 作為 CI fixture，或維持目前的 `FakeProcessRunner` 純單元測試策略

---

# 2026-09-26

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
