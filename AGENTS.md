# CodeBridge 專案指南 (Cline AGENTS.md)

## 專案概述
CodeBridge 是一個 Tauri 桌面應用程式，為高中生教學設計的 Blockly 視覺化 Arduino 程式開發環境。它允許使用者透過拖拉積木的方式產生 Arduino C++ 程式碼，並提供程式碼預覽及定位功能，幫助學生理解從圖形到文字程式的過渡過程。

## 技術規範

### 核心架構
- **目標平台**：Tauri 2.0 桌面應用 (Windows/macOS/Linux)
- **目標語言**：Arduino C++ (.ino)
- **前端框架**：Svelte + TypeScript + Blockly v13.3.0 + Vite
- **後端框架**：Rust + Tauri

### 影子積木規範 (Shadow Block Standards)
- **arduino_pin_shadow** 作為 Blockly 的陰影積木，其運作方式是：
  - 它為需要腳位輸入的積木（如 `arduino_pin_mode`、`arduino_digital_read` 等）提供預設、可編輯的文字輸入欄位。
  - 使用者可以直接在陰影積木的欄位中輸入腳位名稱或數字（例如 A0, 2, ~ 等）。
  - 如果使用者需要更複雜的腳位來源（例如變數、運算結果等），他們可以直接拖曳其他積木到陰影積木的位置，陰影積木就會被替換掉。
  - 在 `arduino.js` 中定義時，其 `setOutput(true, ["Number", "String"])` 與 toolbox.xml 中使用它的父積木的輸入檢查類型相符。

### 產生器註冊規範 (Generator Registration)
- 註冊 generator 使用 `Blockly.Arduino.forBlock[]`
- 參考 piBlockly 專案的做法

### 程式碼籃子架構 (Code Buckets Architecture)
- 採用多個專用「程式碼籃子」，確保生成的 C++ 程式碼永遠符合編譯要求
- 程式碼籃子定義於 `ui/src/lib/blockly/generators/_core.js`：
  - `includes_`：存放 `#include <...>` 語句
  - `macros_`：存放 `#define` 等預處理器宏
  - `global_vars_`：存放所有全域變數和 `const` 常數宣告
  - `definitions_`：通用定義區
  - `function_prototypes_`：存放函式原型
  - `function_definitions_`：存放函式的完整實作
  - `setups_`：存放 `void setup() { ... }` 內的程式碼

### 積木顏色屬性統一規範 (Block Colour Attribute Standard)
- **統一使用 `colour` 屬性**：所有積木（含 Blockly 內建積木覆寫）**必須**使用 `"colour": "%{BKY_XXX_HUE}"` 設定顏色。
- **不使用 `style` 屬性**：不再使用 `"style": "xxx_blocks"` 方式，因為我們已移除 Theme 的 `blockStyles` 定義，改由語系檔直接控制顏色。
- **顏色來源**：所有顏色值由語系檔 (`zh-hant.js` / `en.js`) 中的 `XXX_HUE` key 定義，`%{BKY_XXX_HUE}` 在 `jsonInit` 時由 Blockly 自動解析。
- **內建積木覆寫**：如需統一內建積木（如 `math_number`、`text`、`text_join`）的顏色，必須在對應模組的 `blocks.js` 中重新定義該積木，並加入 `"colour": "%{BKY_XXX_HUE}"`。
- **範例**：
  ```javascript
  // ✅ 正確：統一使用 colour 屬性
  this.jsonInit({
    "message0": "%{BKY_MATH_NUMBER}",
    "args0": [...],
    "colour": "%{BKY_MATH_HUE}",
  });

  // ❌ 錯誤：不使用 style 屬性
  this.jsonInit({
    "style": "math_blocks",  // ← 不再支援
  });
  ```

### 轉義字元與換行處理規範 (Critical)
參考 global.md 的規範，嚴格遵守三層字串意識。

### Blockly v13 開發規範 (Critical)

目前固定使用 **Blockly 13.3.0**，禁止直接套用 v12 寫法。詳細決策與升級紀錄見 `log/plan/BlocklyV13Upgrade.md`。

- UMD 載入順序固定為：`blockly.js` → `blocks_compressed.js` → `python_compressed.js` → `msg/*.js` → plugins → CodeBridge blocks。
- `blocks_compressed.js` 必須在 CodeBridge 覆寫 `controls_if`、`text_join` 等內建 block 前載入，否則 mutator extension 不存在。
- v13 workspace ARIA 初始化需要官方基礎訊息；語系載入必須透過 `Blockly.setLocale()`，不可只依賴 CodeBridge 模組訊息。
- 停用音效的 injection option 是 `sounds: false`（複數），不可寫成 `sound`。
- Thrasos 是 renderer，不是公開 Theme；使用 `renderer: 'thrasos'` 搭配 `Blockly.Themes.Classic`。
- 不可使用 v12 已移除的 Workspace／VariableMap 舊 API，例如 `createVariable()`、`getVariableById()`、`getAllVariables()`、`renameVariableById()`、`deleteVariableById()`；改用 VariableMap API。
- v12 `controls_if` mutation 使用 `elseifCount`／`elseCount`，v13 使用 `elseif`／`else`。不可在 block definition 覆寫官方 mutator method。
- 所有 XML 輸入必須使用 `CodeBridgeBlocklyXml.textToWorkspace()` 或 `domToWorkspace()`，不可直接呼叫 `Blockly.Xml.domToWorkspace()`。
- 初始 XML、session restore 與 style reload 後，必須確認 `workspace.updateAriaLabel()` 已更新 workspace stack label。
- 升級或替換任何 Blockly JS 資源時，必須同步更新 `ui/public/blockly/VERSIONS.md` 的 bytes 與 SHA-256。

### 模組開發與 TDD (Required Workflow)

新增或修改 Blockly 模組時必須採 red → green → refactor：

1. **Red**：先在 `ui/tests/e2e/blockly-migration.spec.js` 或 `ui/tests/fixtures/blockly-v12/` 建立會失敗的公開行為測試。
2. **Green**：只實作讓該測試通過所需的 block definition、messages 與 generator。
3. **Refactor**：完成模組後才整理重複程式碼，不在 red/green 迴圈中預先抽象。
4. 執行 `npm test`，確認 Vitest assets／module contracts 與 Playwright Edge tests 全數通過。
5. 執行 `npm run build`，確認 production build 通過。

每個公開模組 block 必須具備：

- `colour`、`tooltip`、英文與繁中訊息。
- 對應的 `Blockly.Arduino.forBlock[type]` generator；mutator-only helper blocks（例如 `controls_if_elseif`、`controls_if_else`）可列入明確 allowlist。
- 至少一份 XML fixture，驗證可由 Blockly 13 載入。
- 至少一個公開行為斷言；statement/value block 需有 generator golden 產碼。
- Toolbox reference、block type、generator type 必須一致。

CI 會自動執行 `npm test` 與 build，但**不會自動替開發者產生 TDD 測試**。新增測試是模組開發的必要工作，不是選用步驟。

## 開發慣例

### 積木與產生器模組化
- 積木定義位於 `ui/src/lib/blockly/blocks/`
- 程式碼產生器位於 `ui/src/lib/blockly/generators/`
- 可從 piBlockly-modules 動態載入

### 代碼風格
- **Frontend**: TypeScript + Svelte
- **Backend**: Rust (Tauri)

### 雙風格主題系統
- **Engineer 風格**：技術專業風格，顯示 C/C++ 語法
- **Angel 風格**：友好教學風格，使用文字描述

### i18n
- UI/積木/互動訊息在開發時一律使用i18n來設計文字字串，支援繁體中文及英文。
- 前端語言檔 ui/src/i18n.js
- 積木語言檔置於該模組下，對齊#cocoya方式

## 重要路徑
- **模組載入清單**：`ui/src/lib/modules/core_manifest.json`
- **前端主程式**：`ui/src/main.ts`
- **後端主程式**：`src-tauri/src/main.rs`

## 日誌與備份保護原則
- **日誌追加保護 (Append-Only)**：異動需記錄於 `log/work/yyyy-mm-dd.md`
- **覆寫前置備份**：若需覆寫檔案，必須先備份到 `backup/` 資料夾

## 工作流規範
1. **啟動 CodeBridge**：選擇新專案或開啟現有專案
2. **程式碼唯讀**：程式碼編輯器為唯讀模式，確保與積木同步
3. **程式碼定位**：點擊積木可高亮對應程式碼區域
4. **Serial Monitor**：即時監看 Arduino 序列埠輸出
5. **Serial Plotter**：資料視覺化功能