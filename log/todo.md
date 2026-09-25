# CodeBridge 任務進度

## 已完成任務

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

## 待辦任務
### 積木移植（下一優先）
- [x] 移植 Coding 積木 → `modules/coding/`
- [x] 移植邏輯積木（if/else, compare, operation, boolean）→ `modules/logic/`
- [ ] 移植迴圈積木（for, while, repeat）→ `modules/loops/`
- [ ] 移植數學積木（constrain, map, random）→ `modules/math/`
- [ ] 移植變數積木 → `modules/variables/`
- [ ] 移植文字積木 → `modules/text/`
- [ ] 移植陣列積木 → `modules/array/`
- [ ] 移植函式積木 → `modules/functions/`

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

### 後續任務
- [ ] 從網路匯入感測器與致動器模組（對齊#piBlockly匯入的#pbm）

### 2026-07-26：啟用 Blockly 工作區註解
- [x] 診斷右鍵工作區缺少 'Add comment' 選項
- [x] 在  的  中加入  和 
- [ ] 驗證工作區註解功能在瀏覽器中正常運作
- [ ] 考慮工作區註解的保存/載入 (XML 序列化)

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
- [ ] 待驗證：toolbox 分類名稱正確顯示
- [ ] 待驗證：所有 3 個積木可拖入工作區
- [ ] 待驗證：程式碼生成正確 (while, for, break/continue)
- [ ] 待驗證：風格切換後分類名稱與積木文字正常
- [ ] 待驗證：孤兒積木檢測正常

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
