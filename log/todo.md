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

## 待辦任務

### 2026-07-25：程式碼預覽修復 + 預設積木 + 風格切換 + 孤兒積木 + 程式碼定位
- [x] 建立 `_core.js`（Blockly.Arduino generator 核心）
- [x] 修改 `generators.js`（setup/loop 對齊 piBlockly 程式碼籃子）
- [x] 修改 `index.html`（載入 _core.js）
- [x] 修改 `main.js`（預設積木、renderCode、syncSelection、孤兒積木）
- [x] 修改 `loader.js`（setBlockStyle 工作區重新載入）
- [x] 修改 `style.css`（高亮行樣式）

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

### 後續任務
- [ ] 感測器與致動器模組移植（超音波、DHT、伺服馬達等）
- [ ] 設定選單語系/風格切換連接到 setBlockStyle()
- [ ] 整合 UI i18n 與積木訊息系統
- [ ] 驗證積木顯示、產生器輸出、風格切換正確性
