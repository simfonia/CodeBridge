# CodeBridge 任務進度

## 已完成任務

### 2026-07-20：piBlockly 積木移植 - 架構重構與 Phase 1
- [x] 分析 piBlockly 模組載入機制與架構
- [x] 確立 Locale + Style Overlay 雙風格方案
- [x] 建立新目錄結構：blocks/, generators/, messages/, theme/, toolbox/, modules/
- [x] 完成訊息系統：zh-hant.ts, en.ts, style/engineer.ts, style/index.ts
- [x] 完成核心積木移植：pin.ts, core.ts, serial.ts（使用 %{BKY_...} 佔位符）
- [x] 完成產生器移植：pin.ts, core.ts, serial.ts
- [x] 建立主題、工具箱、模組載入系統
- [x] 更新 main.ts 初始化流程
- [x] 備份舊檔案到 backup/

## 待辦任務

### Phase 2：基礎程式邏輯移植
- [ ] 邏輯積木（if/else, compare, operation, boolean）
- [ ] 迴圈積木（for, while, repeat）
- [ ] 數學積木（constrain, map, random）
- [ ] 變數積木
- [ ] 文字積木

### Phase 3：感測器與致動器移植
- [ ] 超音波 HC-SR04
- [ ] DHT 溫濕度感測器
- [ ] 伺服馬達
- [ ] 步進馬達
- [ ] 其他硬體模組

### UI 整合
- [ ] 設定選單語系/風格切換連接到 setBlockStyle()
- [ ] 整合 UI i18n 與積木訊息系統

### 測試與驗證
- [ ] 驗證積木顯示正確性
- [ ] 驗證產生器輸出正確性
- [ ] 驗證風格切換（Angel / Engineer）正確性
- [ ] 驗證語系切換（zh-hant / en）正確性