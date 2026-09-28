# CodeBridge V2 總體開發規格

## 文件資訊
- 狀態：已採用，準備分階段實作
- 決策日期：2026-09-25
- 產品主線：CodeBridge
- 舊 piBlockly：Legacy，不再規劃 V2 功能

## Problem Statement

CodeBridge 已具備 Blockly、程式碼預覽、積木定位與手寫練習的基礎，但目前仍缺少穩定的模組 runtime、Arduino 工具鏈、專案管理、Board Manager、Library Manager、Serial Monitor 與 Serial Plotter。若核心程式與遠端硬體積木沒有清楚責任與版本契約，CodeBridge 的長期架構將受到 piBlockly 舊命名、舊 manifest 與舊 loader 設計干擾。

## Solution

CodeBridge 成為唯一持續開發的主程式，內建 C++ 語言、Coding 與 Arduino 基礎積木。建立新的 `codebridge-modules` repository，作為硬體、感測器、致動器、第三方函式庫與教學積木的獨立發行來源。舊 `piBlockly-modules` 僅作為遷移來源；既有 block type 在遷移期間保持不變，以確保舊 XML 可繼續開啟。

CodeBridge 透過 Arduino CLI 完成 core、library、compile、upload 與 board discovery；透過 Rust serialport 提供雙向 Serial Monitor；自行建立 Plot Data Parser、Series Store 與 Plot Renderer。

## User Stories

1. 作為初學者，作為單一桌面程式安裝 CodeBridge，以便不必先設定 VS Code 與多個 extension。
2. 作為 Blockly 使用者，在核心取得 setup、loop、控制結構、變數、陣列、文字、函式與 Arduino 基礎積木。
3. 作為硬體使用者，從 CodeBridge Modules 取得感測器與致動器積木。
4. 作為模組作者，使用版本化 manifest 與明確的模組契約開發及發布積木。
5. 作為既有 piBlockly 使用者，以既有 block type 開啟舊 XML 與遷移後模組。
6. 作為教師，預覽積木對應程式碼並由程式碼定位積木來源。
7. 作為學生，在隔離的練習環境手寫程式，不修改正式專案。
8. 作為使用者，編輯 `.ino`、XML 與專案 metadata。
9. 作為使用者，安裝、移除及升級 Arduino board core。
10. 作為使用者，搜尋、安裝及移除第三方 Arduino library。
11. 作為使用者，編譯並上傳目前 FQBN 的 sketch。
12. 作為使用者，從 compiler output 開啟錯誤行。
13. 作為使用者，透過 Serial Monitor 收發序列資料。
14. 作為使用者，將 CSV 或 label:value 資料繪製成 Serial Plotter。
15. 作為模組使用者，離線使用已驗證並快取的模組。
16. 作為模組使用者，模組更新失敗時自動繼續使用舊版本。
17. 作為維護者，透過 contract tests 驗證 manifest 到程式碼產生的完整流程。

## Implementation Decisions

### 產品與專案責任
- CodeBridge 是唯一主程式與核心積木來源。
- 原 piBlockly 專案轉為 Legacy，不再規劃 V2 功能。
- 新建 `codebridge-modules` repository，不在舊 pbm repository 原地升級。
- 新 repository 暫定產品名稱為 CodeBridge Modules，技術 catalog 使用 CodeBridge V2 schema。

### 模組責任邊界
- 核心：C++ 語言、Coding、Arduino setup/loop、pin shadow、I/O、時間、Serial 與共用 generator core。
- 遠端：感測器、致動器、特殊硬體、第三方 library 包裝積木、教學與領域模組。
- 核心與遠端必須遵守同一 module contract，差異只在發布來源。

### Generator 與資料流
- generator 註冊使用 `Blockly.Arduino.forBlock[]`。
- 保留 code buckets，並由 CodeBridge generator core 統一完成組裝。
- generator 產生內部 marked code、source mapping 與清除 marker 後的 plain code。
- plain code 寫入正式 `.ino`；marker 不得寫入磁碟。

### 模組 runtime
- runtime 依序驗證 manifest、相容性、checksum、i18n、blocks、generators 與 toolbox。
- 更新採原子切換；新版本驗證失敗時保留 active version。
- 重複 block type、缺少 generator、缺少 message key 或 toolbox 引用不存在 block 時拒絕載入。
- 支援內建、遠端與使用者本機模組來源。

### Arduino 工具鏈
- 使用 Arduino CLI 的 JSON 輸出管理 core、library、compile、upload 與 board discovery。
- CLI 程序以非同步 operation 管理進度、取消、stderr 與 timeout。
- 上傳前暫停同一序列埠的 Monitor，結束後依設定重新連線。
- 專案保存 FQBN、port、baud rate、library dependencies 與模組版本。

### Serial Monitor 與 Plotter
- 使用 Rust `serialport` 維護長連線與雙向資料流。
- Monitor 支援開關、timestamp、HEX、篩選、清理與重連。
- Plotter 支援 CSV、tab 與 `label:value`。
- plot data parser、ring buffer、downsampling 與 renderer 必須分離。

### 專案與編輯模式
- 專案由 Blockly XML 與 CodeBridge project metadata 組成為單一 `.cbg` 檔；`.ino` 由積木產生，不落地。
- **專案檔格式規格見 [`SPEC.md` §3](../../SPEC.md#3-cbg-專案檔格式)**，以下為摘要：
  - 檔案形狀：UTF-8 無 BOM、LF 行尾、多行縮排 XML（每層兩空格），由 `Blockly.Xml.domToPrettyText()` 產生。**不可**用 `domToText()` 壓成單行。
  - 根元素屬性順序固定為 `xmlns:cbg` → `cbg:format` → `cbg:app` → `xmlns`，且根元素必須在第一行。
  - metadata 只有 `cbg:format`（格式版本）與 `cbg:app`（寫檔版本，純診斷用）兩欄。
    `name`／`fqbn`／`port`／`baud`／`libraries` 已於 2026-09-28 移除：
    檔名才是權威、第三方 clone 板偵測不到 fqbn、序列埠屬本機環境狀態（曾造成上傳 bug）。
  - 教學說明一律寫在 Blockly 的 `<comment>`（積木註解或工作區註解）。
    **禁止** `<?xml ?>` 宣告與 `<!-- -->` XML 註解 —— Blockly 13.3.0 載入時會靜默丟棄，
    使用者一存檔就永久消失（`03_plot-waves.cbg` 曾因此遺失 23 行教學說明）。
  - 內建範例必須與使用者存檔的檔案形狀完全一致，由單元測試自動驗證。
- 視覺模式以 XML 為積木來源，產生 code 為產物。
- C++ 編輯模式的手動修改不得在未提示下被積木覆蓋。
- 練習模式使用隔離草稿，不修改 `.ino` 或 XML。

### 安全性
- 官方模組來源預設只允許 HTTPS。
- 下載後驗證 manifest、版本範圍與 checksum。
- 模組不能任意宣告本機檔案讀寫權限。
- Tauri 不得長期使用 `csp: null`；正式發行前建立明確 CSP。

## Testing Decisions
- 最高層 seam 為 `Remote manifest → download/validate → load workspace XML → generate code → mapping → diagnostics`。
- 測試外部行為，不鎖定模組內部 DOM id 或私有 helper。
- Generator tests 覆蓋 statement/value return type、code buckets、換行、縮排、library include 與 source mapping。
- Module contract tests 覆蓋 manifest schema、依賴順序、重複 ID、缺檔、離線 cache 與失敗回復。
- 舊 pbm block type 必須有 migration fixture，證明 XML round-trip。
- Arduino CLI tests 使用 command builder、JSON parser 與可替換 process runner。
- Serial tests 使用 loopback fixture；Plotter tests 驗證 parser、buffer 上限與大量資料效能。
- Practice tests 驗證正規化、分號提示、隔離及完成判定。

## Out of Scope
- 不在 CodeBridge 專案中重建舊 piBlockly VS Code／Arduino IDE 2 同步架構。
- 不承諾任意手寫 C++ 自動還原成 Blockly 積木。
- 不在第一階段建立 Tauri 之外的第二個正式 host。
- 不讓 CodeBridge 直接依賴 Arduino Community Edition 私有 module。
- 不在遷移前批次重命名所有舊 block type。

## Further Notes
- 舊 pbm 約 75 個 block definitions 與 73 個 generators 是遷移資產，不是新架構的包袱。
- 新模組 ID 使用 `codebridge.*`；既有 block type 保持原值，以維持 XML 相容。
- 新 repository 的 schema、CI、發布與文件必須獨立於 piBlockly 名稱。
