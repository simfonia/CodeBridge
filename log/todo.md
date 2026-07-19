# CodeBridge 專案任務說明

## 概述
- CodeBridge 是 piBlockly 的 Tauri 桌面版分支
- 目標使用者：Arduino 初學者
- 核心功能：Blockly 視覺化 + 程式碼預覽及定位

## 技術規範
- 影子積木參考 piBlockly 作法
- 註冊 generator 使用 `Blockly.Arduino.forBlock[]`
- 參考 cocoya Tauri 架構

## 任務清單:
- [x] 1. 建立專案骨架 (Tauri + Svelte + Vite)
- [x] 2. 建立UI，移植 Blockly 前端程式碼
- [ ] 3. 移植 piBlockly 核心積木群(C++及Arduino API)
- [ ] 4. 實作積木模組動態載入(對齊#piBlockly,已可從網路下載#pbm，使用者擴充功能)
- [ ] 5. 實作程式碼定位功能 (Invisible Range Markers)
- [ ] 6. 實作雙風格主題系統(對齊#piBlockly, 僅C++語法及Arduino API部份)
- [ ] 7. 實作 Arduino CLI 整合
- [ ] 8. 實作 Serial Monitor
- [ ] 9. 實作 Serial Plotter
- [ ] 10. 實作程式碼撰寫領航員，引導使用者依積木流程實際寫出程式碼並給予評分(可能僅限C++及Arduino API積木，開發時再詳細討論)。
- [ ] 11. 測試與打包

## 2025-07-18 工作記錄
- [x] 建立 CodeBridge 專案目錄
- [x] 建立 CodeBridge AGENTS.md 專案規範檔
- [x] 建立 .gitignore 檔案
- [x] git 初始化
- [x] 建立專案骨架 (Tauri + Svelte + Vite)
  - package.json, ui/package.json, ui/vite.config.js
  - ui/index.html, ui/src/main.ts, ui/src/app.ts
  - ui/src/style.css, ui/tsconfig.json
  - src-tauri/Cargo.toml, tauri.conf.json
  - src-tauri/src/main.rs, lib.rs, commands.rs
  - ui/src/lib/i18n/zh-hant.ts, en.ts
  - ui/src/lib/modules/core_manifest.json
- [x] 安裝 npm 相依性與 Tauri CLI
- [x] 複製 Blockly 核心檔案 (從 cocoya)
- [x] 建立 Arduino 積木 (blocks.js)
- [x] 建立 Arduino 產生器 (generators.js)
- [x] 建立 Arduino toolbox.xml
- [x] 建立 Arduino 語法高亮 (arduino.min.js)
- [x] 複製前端資源 (vs.min.css, highlight.min.js, icons)

## 2025-07-19 工作記錄
- [x] 修復 Toolbar CSS 版面配置
  - 按鈕尺寸 24x24 → 32x32，加入 img 尺寸限制
  - toolbar 改為 flex-wrap + height: auto
  - codeArea 加入 flex-shrink: 0
  - hover 時 icon 變色 #FE2F89
- [x] 實作 i18n 中英文切換功能
  - 建立 ui/src/i18n.js（唯一 i18n 來源）
  - 自動偵測語系、替換 %{BKY_...} 佔位符
  - 設定選單加入語言切換開關（i18n.png icon）
- [x] 對齊 cocoya Tauri 版 UI 設計
  - codeArea 改為白色背景、固定 400px
  - code-toggle 收合按鈕、panel-resizer 拖曳調整寬度
  - codeHeader 淺灰背景、大寫文字
  - 加入 resizer-overlay 防止拖曳時干擾 Blockly
- [x] 清理重複的 i18n 檔案
  - 刪除 ui/src/lib/i18n/zh-hant.ts, en.ts（未被引用）
