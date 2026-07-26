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
- [ ] 移植 Coding 積木 → `modules/coding/`
- [ ] 移植邏輯積木（if/else, compare, operation, boolean）→ `modules/logic/`
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

### 後續任務
- [ ] 從網路匯入感測器與致動器模組（對齊#piBlockly匯入的#pbm）
- [ ] 程式碼撰寫導航員 Phase 4：測試與優化
