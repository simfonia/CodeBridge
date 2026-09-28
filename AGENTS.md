# CodeBridge 專案指南 (Cline AGENTS.md)

## 專案概述
CodeBridge 是一個 Tauri 桌面應用程式，為高中生教學設計的 Blockly 視覺化 Arduino 程式開發環境。它允許使用者透過拖拉積木的方式產生 Arduino C++ 程式碼，並提供程式碼預覽及定位功能，幫助學生理解從圖形到文字程式的過渡過程。

> **系統規格書**：[`SPEC.md`](SPEC.md)。產品「長什麼樣、怎麼運作」以 SPEC.md 為權威來源；
> 本檔只記「動工時必須遵守什麼」。修改 `.cbg` 格式、metadata 欄位、範例檔或
> 資料流時，**兩份文件都要同步更新**。

## 技術規範

### 核心架構
- **目標平台**：Tauri 2.0 桌面應用 (Windows/macOS/Linux)
- **目標語言**：Arduino C++ (.ino)
- **前端框架**：**Vanilla JavaScript（UMD script，無框架）** + Blockly v13.3.0 + Vite
  - 前端沒有 Svelte，也沒有 TypeScript 編譯步驟；`ui/src/app.ts`、`ui/src/main.ts`
    是未接線的骨架（`index.html` 只載入 `src/main.js`），不要當成實際架構
- **後端框架**：Rust + Tauri

### .cbg 專案檔格式規範 (Critical)

完整規格見 [`SPEC.md` §3](SPEC.md#3-cbg-專案檔格式)。動手改任何相關檔案前必讀。

**檔案形狀**：UTF-8 無 BOM、LF 行尾、以換行結尾的多行縮排 XML。
根元素屬性順序固定為 `xmlns:cbg` → `cbg:format` → `cbg:app` → `xmlns`，且根元素必須在第一行。

```xml
<xml xmlns:cbg="https://codebridge.app/xml" cbg:format="1" cbg:app="0.2.0" xmlns="https://developers.google.com/blockly/xml">
  <block type="initializes_setup" id="setup-1" x="250" y="30">
    ...
  </block>
</xml>
```

**存檔必須用 `Blockly.Xml.domToPrettyText()`**（`project-io.js` 的 `serializeWorkspace()`）。
**絕不可**改回 `Blockly.Xml.domToText()` —— 它會把整個工作區壓成單行（15 KB 無換行），
使用者要手動編輯、交作業或版控時完全無法閱讀。

**絕對禁止的寫法**（Blockly 13.3.0 會靜默丟棄，使用者一存檔就永久消失）：

| 禁止 | 原因 |
|---|---|
| `<?xml version="1.0"?>` 宣告 | `workspaceToDom()` 不產生它 |
| 根元素前的 `<!-- ... -->` 註解 | 位於 workspace 之外 |
| `<statement>`/`<next>`/`<value>` 之間的行內 `<!-- -->` | `domToWorkspace()` 只處理元素節點 |
| 註解文字含實際換行 | 破壞 pretty 縮排對齊，改用 `。` `；` 分隔 |

**教學說明一律寫在 Blockly 的 `<comment>`**：
- 積木註解 = `<block>` 的子節點；
- 工作區註解 = 直接掛在 `<xml>` 下（`parentElement.tagName === 'xml'`）。

`03_plot-waves.cbg` 曾因使用 XML 註解撰寫 23 行教學說明，導致使用者開啟後一存檔說明全部蒸發。
**教學內容放在 XML 註解裡等於沒放**，因為下一個人拿到的是已被洗掉的版本。

**metadata 只有兩個欄位**：`cbg:format`（格式版本，高於目前版本則拒絕開啟）與
`cbg:app`（寫檔版本，純診斷用）。`name` / `fqbn` / `port` / `baud` / `libraries`
已於 2026-09-28 移除，理由見 `project-store.js` 的 `META_FIELDS` 註解。
**開發板選擇不進 .cbg**，由 `board-picker` / `board-detector` 存在 localStorage。

**新增或修改內建範例**（`src-tauri/resources/examples/*.cbg`）時：
直接複製既有範例作為骨架，勿從頭手寫 XML。契約由
`ui/tests/unit/project-store.test.js` 的「三個內建範例皆符合規格」測試自動驗證，
違規（多行、有 XML 宣告、有 XML 註解、根元素不在第一行）會讓測試紅燈。

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
- **統一使用 `setColour()`**：所有積木（含 Blockly 內建積木覆寫）在 `jsonInit()` 之後呼叫 `this.setColour(CodeBridgeBlockPalette.getColourForRole('role'))` 設定顏色。
- **不使用 `style` 屬性**：不再使用 `"style": "xxx_blocks"` 方式，因為我們已移除 Theme 的 `blockStyles` 定義，改由語意 palette 與語系 key 控制顏色。
- **不使用 `colour: '%{BKY_XXX_HUE}'`**：色碼不再經由 Blockly message 佔位符解析，避免語系檔與執行期色碼雙重來源。
- **顏色來源（語意 palette contract）**：模組色碼的**唯一來源**為 `ui/src/theme/block-palette.js` 的語意角色（`structure`、`control`、`digital`、`analog`、`time`、`serial`、`logic`、`loops`、`math`、`text`、`variables`、`array`、`functions`）。執行期重算顏色時以 `block.type` 查角色，**不可**依 block 目前的 colour 值反查。
- **語系檔不含色碼**：`modules/*/zh-hant.js` 與 `en.js` 只維護文字、分類名稱與 tooltips，不得維護 `*_HUE`。
- **第三方模組加入**：`CodeBridgeBlockPalette.registerModule({id, role, typePrefix?, blockTypes?, colours})`；未登錄語意角色的積木保持原色。
- **內建積木覆寫**：如需統一內建積木（如 `math_number`、`text`、`text_join`）的顏色，必須在對應模組的 `blocks.js` 中重新定義該積木並呼叫 `setColour()`。
- **範例**：
  ```javascript
  // ✅ 正確：由語意角色取色
  Blockly.Blocks['logic_compare'] = {
    init: function() {
      this.jsonInit({ /* ... */ });
      this.setColour(CodeBridgeBlockPalette.getColourForRole('logic'));
    }
  };

  // ❌ 錯誤：不使用 style 屬性
  this.jsonInit({ "style": "logic_blocks" });  // ← 不再支援
  ```

### 轉義字元與換行處理規範 (Critical)
參考 global.md 的規範，嚴格遵守三層字串意識。

### 變數分類：固定 4 顆積木 (piBlockly 對齊)

`ui/index.html` 的 Variables 分類是**固定分類**，永遠只有 4 顆積木 + 1 顆「建立變數」按鈕：

```xml
<category name="%{BKY_VARIABLES_CATEGORY}">
    <button text="%{BKY_NEW_VARIABLE}" callbackKey="CREATE_VARIABLE"></button>
    <block type="variables_declare_global"></block>
    <block type="variables_declare_local"></block>
    <block type="variables_get"></block>
    <block type="variables_set"></block>
</category>
```

**絕對不可改回 `<category custom="VARIABLE">`（Blockly 內建動態分類）。**
該分類會為工作區裡的**每一個變數**各生一對 `variables_get` / `variables_set`，
症狀是：

1. 變數一多，flyout 就被同一批積木塞爆，且**永遠看不到宣告積木**；
2. 學生看不到「要先宣告型別」，於是產生的 .ino 沒有任何型別定義，編譯失敗。

固定分類後，使用者建立變數後要拖固定的 `variables_get`，再從下拉選單換變數名稱。
這是 piBlockly 的設計，刻意保留不加額外提示。

**「建立變數」按鈕必須自行註冊 callback**（`main.js` 的 `createWorkspace()`）：

```js
workspace.registerButtonCallback('CREATE_VARIABLE', function () {
    Blockly.Variables.createVariableButtonHandler(workspace);
});
```

Blockly 的動態分類會**自動**註冊，但改用固定分類後按鈕改由 toolbox XML 宣告，
不註冊就點了沒反應。

此契約由 `ui/tests/e2e/variables-toolbox.spec.js` 的 6 項測試鎖住。

### 變數命名：不可與 math.h 的函式同名 (Critical)

變數是 **C++ 識別字**，全域命名空間裡不能與已宣告的函式同名。
AVR 的 `<math.h>` 定義了 `double square(double)`，取名 `square` 會得到：

```
error: 'int square' redeclared as different kind of symbol
note: previous declaration 'double square(double)'
```

**這類問題在 CodeBridge 端完全沒有線索** —— 產出的 `.ino` 本身合理、格式正確、
邏輯無誤，只有交給 `avr-gcc` 才會爆錯。2026-09-28 範例 3 就因此編譯失敗。

`addReservedWords`（`_core.js`）已列入 `<math.h>`／`<string.h>`／`<stdlib.h>`
的常見函式名（`square`、`cube`、`hypot`、`fmod`、`round`…）供 UI 標示。
**新增內建範例或撰寫教學文件時，變數名要避開這些字。**

⚠️ **別搞混了**：序列繪圖的 label（如 `"square:"`）是**輸出字串常數**，
不是識別字，與 `math.h` 無關。變數叫 `squareValue` 而曲線 label 維持
`square:` 是正確的 —— 對學生而言「方波 square」是直觀的。

### 定義堆疊模型 (piBlockly 對齊)

`variables_declare_global` 與 `coding_raw_definition` **共用** `processDefinitionStack`
（`ui/src/lib/blockly/generators/_core.js`）。模型與 piBlockly 的
`media/generators/_lib.js` 完全一致：

- 宣告積木以 `next` 串成一條**連續堆疊**（畫面上就是一段「型別宣告區」）
- 由堆疊**最上方**的積木觸發，沿 `next` 走完整條堆疊，
  合併後寫入 `global_vars_['stack_' + 堆頂id]` 的**單一 entry**
- 非堆頂積木 `return ''`，避免重複產碼

**不可改回「每個變數各自一個獨立根層積木」**：那會讓畫面上互不相干的散落積木
對應到程式碼中順序不保相鄰的宣告，且非堆頂積木也會各自產碼（需額外去重）。

`variables_declare_local` **不**走堆疊處理器 —— 區域變數是作用域內的陳述式，
不進 `global_vars_`，直接回傳程式碼（與 piBlockly 一致）。

### 孤兒積木白名單 (Critical)

`ui/src/lib/blockly/generators/_core.js` 的 `Blockly.Arduino.scopeDefiningRootBlocks`
是「哪些積木型別允許單獨存在於工作區根層」的唯一來源，由
`ui/src/main.js` 的 `updateOrphanBlocks()` 執行：**不在清單內的根層積木
連同其所有 descendants 會被 `setDisabledReason(true, 'orphan')` 停用**。

**停用的積木不產生程式碼。** 所以白名單漏掉一個型別，症狀是：

> 使用者用了該積木 → 產生的 .ino 缺了對應的程式碼 → 無任何錯誤訊息。

**2026-09-28 實例**：`variables_declare_global` 漏在白名單外，症狀是
「宣告了變數，但 .ino 的 `// Global variables` 區段是空的」，
使用者完全無從聯想到是孤兒積木檢測造成的。

**新增任何可在根層使用的積木型別時，必須同步加入此清單。**
特別是各類「宣告型」積木（`variables_declare_global`、`array_declare_global`）——
它們描述的是「整個專案的型別」，使用者本就會直接擺在根層。

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
- **存檔輸出**必須使用 `Blockly.Xml.domToPrettyText()`，不可用 `domToText()`（見「.cbg 專案檔格式規範」）。
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
- **Frontend**: Vanilla JavaScript（UMD script）。新程式碼沿用既有 `var CodeBridgeXxx = (function(){...})()` 模式，
  並掛到 `window` 供 `index.html` 以 `<script>` 載入。不要引入框架或建置步驟。
- **Backend**: Rust (Tauri)

### Engineer／Angel 體驗主題系統
- **Engineer preset**：`technology-dark` 深色科技視覺 + C/C++ API 積木文字
- **Angel preset**：`candy-light` 明亮糖果視覺 + 自然教學積木文字
- 高階協調 interface：`ui/src/theme/theme-manager.js` 的 `CodeBridgeTheme`
- 視覺 token：`ui/src/styles/presets.css`；視覺切換不得 clear/reload workspace。

### i18n
- UI/積木/互動訊息在開發時一律使用i18n來設計文字字串，支援正體中文及英文。
- 前端語言檔 ui/src/i18n.js
- 積木語言檔置於該模組下，對齊#cocoya方式

## 重要路徑
- **系統規格書**：`SPEC.md`（產品規格權威來源，含 `.cbg` 檔案格式規格）
- **總體開發規格**：`log/plan/CodeBridgeV2.md`
- **模組載入清單**：`ui/src/lib/modules/core_manifest.json`
- **前端主程式**：`ui/src/main.js`（由 `ui/index.html` 以 UMD script 載入）
- **後端主程式**：`src-tauri/src/main.rs`
- **.cbg 序列化**：`ui/src/lib/project/project-store.js`（metadata）與 `project-io.js`（流程與 pretty 輸出）
- **內建範例**：`src-tauri/resources/examples/*.cbg`（Rust `read_dir()` 掃描，檔名前綴＝排序）

## 日誌與備份保護原則
- **日誌追加保護 (Append-Only)**：異動需記錄於 `log/work/yyyy-mm-dd.md`
- **覆寫前置備份**：若需覆寫檔案，必須先備份到 `backup/` 資料夾

## 任務追蹤檔案規範 (todo.md)
`log/todo.md` 是唯一的任務進度追蹤檔案，結構如下（詳見檔案內「目錄」章節）：

```
# CodeBridge 任務進度
## 目錄            # 錨點導覽，新增章節時須同步
## 目前待辦        # 彙整視圖：所有未完成項目的唯一權威來源
# 2026-09-26       # 一級標題 = 日期章節，由新到舊排列
## 2026-09-26：任務名稱
### 已完成 / 技術深挖 / 驗證結果 / 下次啟動方向
```

- **追加至對應日期章節末尾**：新任務寫入當天的 `## YYYY-MM-DD：任務名稱` 區段；若當日尚無章節，則在 `# YYYY-MM-DD` 標題下新增。**不可**寫到檔案開頭或檔案結尾。
- **同步更新「目前待辦」**：任何新增的未完成項目（`- [ ]`）都必須在文首「目前待辦」有對應條目，並依主題歸類到既有小節；這是彙整視圖的維護責任。
- **同步更新「目錄」**：新增日期章節時，必須在 `## 目錄` 加入對應錨點連結。
- **標註結案**：章節內的「下次啟動方向 (Next Steps)」若已在後續日期完成，應改為註記並指向實際完成的章節。
- **嚴禁刪除歷史**：不得刪除任何已完成的任務紀錄。過期或失效的內容以註記標示（如同「此項已於 YYYY-MM-DD 完成」），而非直接刪除。
- **狀態標記要準確**：任務實際完成後，須將 `- [ ]` 改為 `- [x]`，不可留下已失效的未完成標記。
- **檔案格式**：`log/todo.md` 使用 **CRLF 行尾 + UTF-8（無 BOM）**。以 Python 批次改寫時，必須使用 `write_bytes()` 保留 `\r\n`，不可用 `write_text()`（會轉為 LF 造成全檔 diff）。

## 暫存檔案規範 (Temporary Files)
- **一律寫在本專案的 `temp/` 目錄**：任何暫存腳本（例如批次改寫檔案的 Python／PowerShell 腳本）、中間產物、暫存 XML 或除錯輸出，都必須放在 `**該專案**/temp/` 之下。
- **不得寫入外部工具目錄**：不可將暫存檔案寫到 Python 安裝目錄（如 `C:\WPy64-*\`）、系統暫存區或任何全域工具路徑。這些目錄屬於環境所有，寫入會污染其他專案且難以清理。
- **`temp/` 不納入版控**：`temp/` 已列於 `.gitignore`，內容為一次性用途，完成後應自行刪除。
- **完成後清理**：暫存腳本執行完畢即刪除，不留殘留檔案於 `temp/`。
- **需要重複使用的工具**：若某腳本會反覆使用，應正式納入專案結構並記入 `FILE_STRUCTURE.md`，而非長期滯留於 `temp/`。

## 工作流規範
1. **啟動 CodeBridge**：選擇新專案或開啟現有專案
2. **程式碼唯讀**：程式碼編輯器為唯讀模式，確保與積木同步
3. **程式碼定位**：點擊積木可高亮對應程式碼區域
4. **Serial Monitor**：即時監看 Arduino 序列埠輸出
5. **Serial Plotter**：序列資料可視化。開啟時終端機面板**垂直分成左右兩欄**
   （左＝Monitor 文字、右＝波形），與 Monitor **共用同一條序列連線**
   （Windows COM 埠為獨佔資源，絕不可另開第二條連線）。
   支援 `label:value`、CSV、TSV、布林值；垃圾行（如 `LED 已開啟`）安靜忽略。
   實作詳見 `log/plan/SerialPlotter.md` 與 `ui/src/lib/plot/`。