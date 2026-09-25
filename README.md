# CodeBridge

![Tauri](https://img.shields.io/badge/Tauri-2.0-blue)
![Blockly](https://img.shields.io/badge/Blockly-v13.3.0-green)
![Arduino](https://img.shields.io/badge/Arduino-C%2B%2B-red)

**CodeBridge** 是一個專為教學設計的視覺化 Arduino 程式開發環境，基於 Google Blockly 技術，讓使用者透過拖拉積木的方式產生 Arduino C++ 程式碼。

## 功能特色

### 雙風格積木系統
- **Engineer 模式**：顯示 C++ 語法（`pinMode()`, `digitalWrite()`），適合進階學習
- **Angel 模式**：顯示教學友善文字（`設定腳位為輸出`），適合初學者

### 雙語系支援
- 繁體中文 / English 即時切換
- 切換語系時自動保留工作區內容

### 程式碼預覽與定位
- 即時生成 Arduino C++ 程式碼
- 點擊積木自動高亮對應程式碼區塊
- 支援巢狀積木的遞迴定位（value 積木自動定位到父容器）

### 孤兒積木檢測
- 自動偵測並禁用游離在外的無效積木

### 模組化架構
- 支援動態載入積木模組

## 技術架構

### 前端
- **框架**：Svelte + TypeScript
- **視覺化編輯**：Blockly v13.3.0
- **建置工具**：Vite
- **程式碼高亮**：highlight.js (Arduino language)

### 後端
- **框架**：Rust + Tauri 2.0
- **通訊**：Tauri Commands (Serial, Arduino CLI)


## 安裝與執行

### 環境需求
- Node.js >= 22（Blockly v13.3.0 要求）
- Rust >= 1.70
- Tauri CLI >= 2.0

### 前端開發

```bash
cd ui
npm install
npm run dev
```

### 後端開發

```bash
# 安裝 Tauri CLI
cargo install tauri-cli

# 開發模式
npm run tauri dev
```

### 建置

```bash
npm run tauri build
```

## 開發指南

### 新增積木模組

1. 在 `ui/src/lib/blockly/modules/` 下建立新資料夾（如 `logic/`）
2. 建立 `blocks.js`（積木定義）、`generators.js`（產生器）、`zh-hant.js`、`en.js`（i18n）
3. 在 `ui/index.html` 中載入模組腳本
4. 在 `ui/src/lib/modules/core_manifest.json` 註冊模組

### 風格切換機制

- **Angel 模式**：直接使用 `zh-hant.js` / `en.js` 的原始文字
- **Engineer 模式**：載入 `style/engineer.js` 覆寫為 C++ 語法

### Generator 架構

參考 `generators/_core.js` 的程式碼籃子機制：
- `includes_`：`#include <...>`
- `macros_`：`#define`
- `global_vars_`：全域變數
- `setups_`：`void setup()` 內容
- `function_definitions_`：函式實作

## 功能截圖

（待補）

## 開發者

- **設計與實作**：simfonia 與 AI Agents 

## 授權

MIT License

## 相關連結

- [Blockly 官方文件](https://developers.google.com/blockly)
- [Tauri 官方文件](https://tauri.app/)
- [Arduino 官方網站](https://www.arduino.cc/)