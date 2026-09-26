# 工具列實作與 .cbg 專案格式（Toolbar Implementation）

## 文件資訊
- 狀態：Phase 0／1／2 已完成（2026-09-26）
- 對應程式碼：`ui/src/lib/tauri/bridge.js`、`ui/src/lib/project/*`、`ui/src/lib/ui/*`、`src-tauri/src/project.rs`
- 測試：`ui/tests/unit/{plain-code,project-store,toolbar-buttons}.test.js`、`ui/tests/e2e/toolbar.spec.js`

## Problem Statement
工具列 20 個按鈕中只有 4 個有事件處理（theme、lang、practice、cheat），其餘按下完全沒有反應；
專案完全沒有落地能力（沒有 `.cbg` 讀寫、沒有 dirty 判斷、沒有未儲存保護），
Rust 端的 14 個 command 從未被前端呼叫（前端沒有任何 `invoke`）。

## Solution
1. 建立 Tauri IPC 橋接層，讓 Rust command 可用，並在純瀏覽器環境優雅降級。
2. 專案格式定為 **單一 `.cbg` 檔（Blockly XML）**，`metadata` 以 `cbp:` namespaced 屬性掛在根元素。
3. dirty 以「當前工作區 XML vs 最後儲存 XML」字串比對判定，undo 回原狀自動清除。
4. 建立按鈕 registry 與契約測試，讓「沒有實作的按鈕」必須顯式標記 `disabled` 並列入凍結清單。

## Implementation Decisions

### 為什麼是 `.cbg` 而不是 `.cbp`／`.cbproj`
- `.cbp` 是 **Code::Blocks 的專案檔副檔名**（`.cbproj` 為其舊名），C/C++ 教學學生常見混淆。
- `.cbg` 無任何通用標準佔用，作為副檔名安全。
- 副檔名集中於 `CodeBridgeProject.EXT` 與 Rust `project::PROJECT_EXTENSION`，改名成本為單點。

### 為什麼不落地 `.ino`
- 程式碼面板是唯讀，`.ino` 永遠是積木的產物；只存 XML 可消除「XML 與 ino 不同步」的整類問題。
- `coding_raw_*` 積木可承載任意手寫 C++，因此 XML 足以完整表達程式。
- 上傳時只需在暫存目錄寫一份 `<stem>.ino`（`CodeBridgePlainCode.strip()` 輸出）。

### metadata 放在哪
根元素屬性：`<xml xmlns="..." xmlns:cbp="https://codebridge.app/xml" cbp:format="1" cbp:name="Blink" cbp:fqbn="...">`。
存檔時重新注入（冪等）、開檔時讀取；localStorage 僅作 cache 與草稿，不作真實來源。
未知 `cbp:format` 版本一律拒絕開啟（`PROJECT_ERROR_UNSUPPORTED_FORMAT`），不靜默降級。

### dirty 判斷
- 快照來源：`Blockly.Xml.workspaceToDom()` + `domToText()`。
- 於 change listener（排除 `isUiEvent`）debounce 150ms 後比對。
- 優點：undo 回原狀自動 not-dirty；不需維護事件計數。
- UI 連動：檔名圖示（`load_project_*` ↔ `published_with_changes_*`）、`#btn-save.is-dirty` 高亮、`beforeunload` 攔截。

### 按鈕契約
`ui/src/lib/ui/toolbar-registry.js` 宣告每個按鈕的 `id / implemented / handledBy`；
`index.html` 每個 `.toolbar-btn`／`.terminal-tool-btn` 必須有 `data-action`，未實作者必須帶 `disabled`；
`FROZEN_UNIMPLEMENTED_IDS` 讓新增未實作按鈕變成需要明確決策的變更。

## 驗證結果
- Vitest 39 passed（plain-code 8、project-store 20、toolbar-buttons 6、blockly-assets 4 等）。
- Playwright 44 passed（toolbar.spec.js 9 項涵蓋 disabled 契約、dirty、save/open/recent/範例、剪貼簿、無 Tauri 降級）。
- `cargo test` 90 passed（`project::tests` 5 項涵蓋副檔名白名單、round-trip、BOM 容忍）。
- `npm run build` 與 `cargo build` 成功。

## 本輪不實作（backlog，見 `log/todo.md`）
- Phase 3：Serial Monitor／Terminal（`btn-refresh-serial`、`serial-selector`、`btn-terminal`、終端機工具列）
- `btn-run`／`btn-stop`：等 Arduino CLI T2 compile／upload
- `btn-diagnose` 與設定選單擴充（Board Manager／Library Manager／CLI 設定）
- `.cbg` Windows 副檔名註冊與雙擊開檔
- 匯出 `.ino` 檔（貼到 IDE 的需求已由「複製程式碼」滿足）
- 明確 CSP（`csp: null` 仍待處理，會擋住 Vite dev server，另案）

## 待辦 Icon
- `chevron-down`（下拉指示，目前以點擊展開替代）
- `history`（最近專案圖示，目前以純文字項目呈現）
