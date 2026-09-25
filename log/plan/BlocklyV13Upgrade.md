# Blockly v13 升級紀錄

## 目標

將 CodeBridge 從 Blockly 12.3.1 升級至 npm stable 13.3.0，保留現有 UMD script 載入、Arduino generator、code buckets、block ID marker、XML 與雙語／雙風格架構。

## 完成項目

- [x] 備份 12.3.1 core、Python generator 與全部外掛
- [x] 更新 core 與 Python generator 至 13.3.0
- [x] 更新 field colour、multiline input、scroll options、minimap、modal 至 13.3.0
- [x] 加入 Blockly 13.3.0 英文與繁中基礎訊息
- [x] 在 HTML 載入時保存兩種基礎訊息 snapshot
- [x] loader 改以 `Blockly.setLocale()` 套用基礎語系
- [x] 明確使用 Thrasos renderer
- [x] 以 `sounds: false` 停用所有 Blockly 操作音效
- [x] 建立固定資源 hash 清單
- [x] 以 Edge headless 驗證初始化、ARIA、XML 與 Arduino 產碼
- [x] 建立 Vitest 資源 hash 契約與 Playwright runtime／migration 測試
- [x] 建立 Windows CI，使用系統 Edge 執行前端 Blockly contract

## 相容性決策

1. 保留 UMD 全域 `Blockly`，不在本次升級同時改為 ESM／Svelte module runtime。
2. 保留 `Blockly.Blocks[...]` 與 `Blockly.Arduino.forBlock[...]` 註冊方式。
3. 保留 block type 與 XML 結構，不進行 block ID 重新命名。
4. Core-only Blockly v13 必須搭配官方 `msg/*.js`；缺少基礎訊息時，工作區 ARIA 初始化會在 `WORKSPACE_LABEL_MANY_STACKS.replace()` 失敗。
5. Blockly v13 的 `controls_if` 與 `text_join` 需要官方 standard blocks bundle 註冊 mutator extensions；CodeBridge 在覆寫 block 前先載入 `blocks_compressed.js`。
6. v12 `controls_if` mutation 使用 `elseifCount`／`elseCount`，v13 改用 `elseif`／`else`；所有產品 XML 輸入統一經 `CodeBridgeBlocklyXml` 轉換。
7. `Thrasos` 是 renderer，不是公開 theme；CodeBridge 使用 `Blockly.Themes.Classic` theme 搭配 `renderer: 'thrasos'`。
8. Blockly 停用音效的正式 injection option 是 `sounds`（複數），不是 `sound`。

## 驗證結果

- `Blockly.VERSION === "13.3.0"`
- workspace renderer 為 `thrasos`
- workspace `options.hasSounds === false`
- 45 個 Blockly block definitions 完成註冊
- 43 個 Arduino generators 完成註冊
- v12 XML fixture 可載入 `initializes_setup`、`initializes_loop`、`arduino_pin_shadow`、`arduino_pin_mode`、`arduino_delay` 與 `math_number`
- 可產生 `pinMode(13, OUTPUT);`、`delay(100);`、`void setup()` 與 `void loop()`
- v13 ARIA focus target role 為 `figure` 且 label 已產生
- Edge headless 無 console warning／error 或 page error
- Vite production build 通過
- Vitest 資源契約 3 tests 通過
- Playwright system Edge contract 7 tests 通過
- v12 `controls_if`／`text_join`／for／text／workspace comment XML fixtures 與 generator golden 通過
- 風格切換後 migrated `controls_if` 仍保留 IF0／DO0／IF1／DO1／ELSE
- GitHub Actions Windows CI 會執行 asset、runtime／migration 與 production build
- npm audit 為 0 vulnerabilities

## 回退點

`C:\Workspace\CodeBridge\backup\blockly-12.3.1_20260925_155656`
