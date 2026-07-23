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

## 待辦任務

### 積木移植（下一優先）
- [ ] 移植邏輯積木（if/else, compare, operation, boolean）→ `modules/logic/`
- [ ] 移植迴圈積木（for, while, repeat）→ `modules/loops/`
- [ ] 移植數學積木（constrain, map, random）→ `modules/math/`
- [ ] 移植變數積木 → `modules/variables/`
- [ ] 移植文字積木 → `modules/text/`
- [ ] 移植陣列積木 → `modules/array/`
- [ ] 移植函式積木 → `modules/functions/`
- [ ] 移植 Coding 積木 → `modules/coding/`

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