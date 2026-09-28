# CodeBridge 系統規格書

> 本檔是 CodeBridge 的**權威產品規格**。開發計畫與決策歷程記在
> [`log/plan/`](log/plan/)，目錄結構記在 [`FILE_STRUCTURE.md`](FILE_STRUCTURE.md)，
> 開發規範記在 [`AGENTS.md`](AGENTS.md)。
>
> **文件分工**
>
> | 文件 | 回答的問題 |
> |---|---|
> | `SPEC.md`（本檔） | 系統「是什麼、長什麼樣、怎麼運作」 |
> | `AGENTS.md` | 「動工時必須遵守什麼」 |
> | `FILE_STRUCTURE.md` | 「有哪些檔案、各做什麼」 |
> | `log/plan/*.md` | 「為什麼這樣決策」 |
> | `log/todo.md` | 「現在做到哪、接下來做什麼」 |

## 目錄

- [1. 產品定義](#1-產品定義)
- [2. 技術架構](#2-技術架構)
- [3. .cbg 專案檔格式](#3-cbg-專案檔格式)
- [4. 內建範例檔規格](#4-內建範例檔規格)
- [5. 積木與產生器契約](#5-積木與產生器契約)
- [6. 硬體工具鏈](#6-硬體工具鏈)
- [7. 序列監視器與繪圖](#7-序列監視器與繪圖)
- [8. 程式碼預覽面板](#8-程式碼預覽面板)

---

## 1. 產品定義

CodeBridge 是為高中生教學設計的視覺化 Arduino 程式開發環境（Tauri 2 桌面應用）。
使用者透過拖拉積木產生 Arduino C++ 程式碼，並由程式碼預覽與定位功能，
協助學生理解「從圖形到文字程式」的過渡過程。

**核心設計前提**

- **專案唯一真實來源是 Blockly XML（`.cbg`）**，`.ino` 永遠是產物，不落地。
- 程式碼編輯器為唯讀，確保積木與程式碼永遠同步。
- 教學說明必須寫在 Blockly 的 `<comment>` 裡（見 [§3](#3-cbg-專案檔格式)），
  否則使用者一存檔就會消失。
- 介面文字一律經 i18n（`ui/src/lib/i18n/`），模組文字放在該模組自己的語系檔。
- 視覺色彩走語意 token（`presets.css`），不寫死色碼，以同時支援 Engineer（深色科技）
  與 Angel（明亮糖果）兩種 preset。

---

## 2. 技術架構

| 層 | 技術 |
|---|---|
| 前端框架 | **Vanilla ES5/UMD JavaScript**（無框架），Vite 打包 |
| 視覺化編輯 | Blockly **v13.3.0**（`renderer: 'thrasos'` + `Blockly.Themes.Classic`） |
| 後端 | Rust + Tauri 2.0 |
| 工具鏈 | Arduino CLI（外部程序，JSON 輸出） |
| 序列埠 | Rust `serialport`（長連線） |
| 測試 | Vitest（單元）+ Playwright（端對端，Edge 通道） |

> **沒有 Svelte，也沒有 TypeScript。** 前端全數是掛在 `window` 上的 UMD script
> （`var CodeBridgeXxx = (function(){ ... })()`），由 `index.html` 以 `<script>` 依序載入。
> `ui/package.json` 的 `dependencies` 只有 4 個 Tauri API 套件，`devDependencies`
> 只有 TypeScript（僅供編輯器型別提示）、Vite、Vitest、Playwright。
>
> `ui/src/app.ts` 與 `ui/src/main.ts` 是**未接線的骨架**（`main.ts` 引用了不存在的
> `./lib/blockly/index`，且全無 `TODO` 之外的實作），`index.html` 只載入 `src/main.js`。
> 不要把它們當成實際架構。

**執行期入口**：`ui/index.html` 以 UMD script 依序載入 Blockly → 模組 → CodeBridge 程式碼，
主程式為 `ui/src/main.js`。Tauri 指令入口為 `src-tauri/src/main.rs`。

---

## 3. .cbg 專案檔格式

`.cbg` 是 CodeBridge 的**單一檔專案格式**：Blockly 工作區 XML 加上掛在根元素上的
CodeBridge metadata。格式由 `ui/src/lib/project/project-store.js` 定義與序列化。

### 3.1 檔案形狀

`.cbg` 是 **UTF-8（無 BOM）、LF 行尾、以換行結尾** 的文字檔，內容為多行縮排 XML：

```xml
<xml xmlns:cbg="https://codebridge.app/xml" cbg:format="1" cbg:app="0.2.0" xmlns="https://developers.google.com/blockly/xml">
  <block type="initializes_setup" id="setup-1" x="250" y="30">
    <comment pinned="true" h="87" w="242" x="-18" y="5">把 13 腳設定為輸出</comment>
    <statement name="CONTENT">
      <block type="arduino_pin_mode" id="pinmode-1">
        <field name="MODE">OUTPUT</field>
        <value name="PIN">
          <shadow type="arduino_pin_shadow" id="pin-shadow-1">
            <field name="PIN">13</field>
          </shadow>
        </value>
      </block>
    </statement>
    <next>
      <block type="initializes_loop" id="loop-1">
        <statement name="CONTENT">...</statement>
      </block>
    </next>
  </block>
</xml>
```

**格式規則**

| 規則 | 說明 |
|---|---|
| 根元素屬性順序 | `xmlns:cbg` → `cbg:format` → `cbg:app` → `xmlns`（由 `serialize()` 產生，順序固定） |
| 根元素位置 | 必須在**第一行**（metadata 掛在根元素上，`findRootTag()` 依賴此點） |
| 縮排 | 每層兩空格，由 `Blockly.Xml.domToPrettyText()` 產生 |
| 自閉合標籤 | 一律展開為 `<tag></tag>`（`domToPrettyText` 的第一步即做此轉換） |
| 單行元素 | 內容不換行者合併為一行，例如 `<field name="NUM">500</field>` |
| 結尾 | 以 `\n` 結尾 |

### 3.2 禁止事項（Critical）

以下寫法在 Blockly 13.3.0 **會被靜默丟棄**，使用者按一次存檔就永久消失：

| 禁止 | 原因 |
|---|---|
| `<?xml version="1.0" encoding="UTF-8"?>` 宣告 | Blockly 的 `workspaceToDom()` 不產生它，`parse()` 也不還原它 |
| 根元素**之前**的 `<!-- ... -->` 註解 | 位於 workspace 之外，不屬於任何 block |
| `<statement>`／`<next>`／`<value>` 之間的行內 `<!-- ... -->` 註解 | `domToWorkspace()` 只處理元素節點，註解節點直接跳過 |
| 註解文字含實際換行 | 破壞 pretty 縮排對齊；教學說明請用 `。` `；` 等標點分隔 |

**真實案例**：`03_plot-waves.cbg` 在 2026-09-28 之前使用了 `<?xml ?>` 宣告、根元素前的
23 行教學說明、8 處行內註解。使用者開啟該範例、任何編輯、再存檔 —— 那些說明全部蒸發。
**教學內容放在檔案裡等於沒放**，因為下一個使用者拿到的是已被洗掉的版本。

**教學說明的正確位置**：Blockly 的 `<comment>` 元素，分兩種：

- **積木註解**：`<block>` 的子節點，附在特定積木上。
- **工作區註解**：直接掛在 `<xml>` 下（`parentElement.tagName === 'xml'`），
  適合放專案整體的說明文字。

```xml
<xml ...>
  <comment pinned="true" h="340" w="520" x="40" y="-380">專案整體說明（工作區註解）</comment>
  <block type="initializes_setup" id="setup-1">
    <comment pinned="true" h="60" w="300" x="20" y="-10">這個積木在做什麼</comment>
    ...
  </block>
</xml>
```

### 3.3 metadata 欄位

`cbg:` 命名空間，URI 為 `https://codebridge.app/xml`。

| 屬性 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `cbg:format` | 整數 | 是 | 格式版本，目前為 `1`。開檔時若大於目前版本則拒絕開啟（`isSupported()`），避免靜默降級 |
| `cbg:app` | 字串 | 是 | 寫檔的 CodeBridge 版本（純診斷用，不參與相容性判斷） |

**只有這兩個欄位。** 以下欄位已於 2026-09-28 移除，理由見 `project-store.js` 的
`META_FIELDS` 註解：

| 已移除 | 移除理由 |
|---|---|
| `name` | 檔名才是權威；存進檔只會在使用者於檔案總管改名後產生「檔名是 A、內部記錄是 B」的矛盾 |
| `fqbn` | 第三方 clone 板的 reset/VID/PID 常不標準，偵測不到 fqbn；記錄下來也無法驗證 |
| `port` / `baud` | 本機環境狀態而非專案特性；別台機器沒有 COM3，同一台拔插 USB 後埠號就變。曾造成「UI 顯示 COM4 但上傳報尚未選擇序列埠」的實際 bug |
| `libraries` | `#include` 已承載依賴資訊，且此欄位從無程式碼讀寫 |

**開發板的選擇**由 `board-picker` / `board-detector` 寫入 `localStorage` 的 store，
**不進 .cbg**。

### 3.4 舊命名空間相容

`parse()` 與 `stripMetadataAttributes()` 同時處理 `cbg:`（現行）與 `cbp:`（舊）：

- 開舊檔時讀得到 `cbp:format`；
- 重新序列化時舊屬性必須被清乾淨，否則檔案會同時出現兩套 metadata。

### 3.5 格式驗證與 I/O 邊界

| 層 | 職責 | 位置 |
|---|---|---|
| 序列化／解析 | metadata 注入與剝除、冪等 `serialize()` | `ui/src/lib/project/project-store.js` |
| 流程編排 | New／Open／Save／Save As／範例、dirty 確認 | `ui/src/lib/project/project-io.js` |
| 磁碟 I/O | 副檔名白名單、UTF-8 無 BOM、BOM 容忍、LF 正規化 | `src-tauri/src/project.rs` |
| 範例掃描 | `fs::read_dir()` 掃資源目錄，檔名數字前綴＝排序 | `src-tauri/src/commands.rs` |

**副檔名白名單**：Rust 端只接受 `.cbg`（大小寫不敏感），避免誤覆寫使用者的
`.ino`／`.sketch`。錯誤以 `KEY|detail` 回傳，前端以 KEY 查 i18n。

**編碼**：一律寫入 UTF-8（無 BOM）與 LF；讀取時容忍 BOM（使用者可能用記事本編輯過）。

**存檔格式**：`project-io.js` 的 `serializeWorkspace()` 使用
`Blockly.Xml.domToPrettyText(dom)`，**不可**改回 `domToText()` ——
後者會把整個工作區壓成單行（動輒 15 KB、無任何換行），使用者要手動編輯、
交作業或做版控時完全無法閱讀。dirty 判斷的 snapshot 走同一路徑，兩者一致即可。

---

## 4. 內建範例檔規格

內建範例位於 `src-tauri/resources/examples/`，由 Rust `list_examples` 掃描目錄取得
（不需 `manifest.json` 索引檔）。

**檔名規則**：`NN_snake-case名稱.cbg`，數字前綴決定排序，顯示名稱由 Rust
`display_name()` 剝掉前綴。

| 檔案 | 內容 |
|---|---|
| `01_blink.cbg` | 燈閃爍（pinMode + digitalWrite + delay） |
| `02_serial-hello.cbg` | 序列埠每秒輸出一行問候 |
| `03_plot-waves.cbg` | 序列繪圖示範：方波 + 正弦波 + 隨機雜訊。四個全域變數為 `angleValue`／`squareValue`／`sineValue`／`noiseValue`（`sineValue` 為 `float`，其餘為 `int`） |

**範例 3 的變數名帶 `Value` 後綴是刻意的**：`square` 已被 AVR `<math.h>` 的
`double square(double)` 佔用，取同名會編譯失敗（詳見 §5 變數命名）。
但序列輸出的 label（`"square:"`）是字串常數，維持原樣不變。

**範例檔必須與使用者存檔的檔案形狀完全一致**，即符合 §3.1 全部規則。
新增範例時請直接複製既有範例作為骨架，不要從頭手寫 XML。

此契約由 `ui/tests/unit/project-store.test.js` 的「三個內建範例皆符合規格」測試
自動驗證 —— 新增的範例若違規（多行、有 XML 宣告、有 XML 註解）測試會紅燈。

---

## 5. 積木與產生器契約

| 項目 | 契約 |
|---|---|
| 產生器註冊 | `Blockly.Arduino.forBlock[]` |
| 程式碼籃子 | `includes_`／`macros_`／`global_vars_`／`definitions_`／`function_prototypes_`／`function_definitions_`／`setups_`，定義於 `generators/_core.js`（共 7 個，缺一不可） |
| 程式碼標記 | generator 產出帶 ID marker 的 marked code（供積木↔程式碼定位），去除 marker 後的 plain code 才是可寫入／可貼出的產物，marker 不得寫入磁碟 |
| 積木顏色 | 一律在 `jsonInit()` 後呼叫 `this.setColour(CodeBridgeBlockPalette.getColourForRole(role))`；不使用 `style` 屬性、不使用 `%{BKY_XXX_HUE}` |
| 影子積木 | 需要腳位／值輸入時提供（如 `arduino_pin_shadow`），`setOutput()` 型別須與父積木輸入檢查型別相符 |
| 變數命名 | 變數是 C++ 識別字，**不得與已宣告的全域函式同名**。AVR `<math.h>` 定義了 `double square(double)`，取名 `square` 會得到 `'int square' redeclared as different kind of symbol`。`addReservedWords` 已列入 math.h／string.h／stdlib.h 的常見函式名供 UI 標示。注意：**序列繪圖的 label（如 `"square:"`）是字串常數，不是識別字**，不受此限 |
| XML 輸入邊界 | 一律經 `CodeBridgeBlocklyXml.textToWorkspace()` / `domToWorkspace()`，不可直接呼叫 `Blockly.Xml.domToWorkspace()` |
| 根層白名單 | 可單獨擺在工作區根層的積木型別由 `Blockly.Arduino.scopeDefiningRootBlocks` 定義（`_core.js`），現況共 9 個：`initializes_setup`、`initializes_loop`、`coding_include`、`coding_raw_definition`、`coding_raw_wrapper`、`array_declare_global`、`variables_declare_global`、`custom_functions_defreturn`、`custom_functions_defnoreturn`。**不在清單內的根層積木會被停用且不產生程式碼**（症狀：宣告了變數但 `// Global variables` 是空的，無任何錯誤訊息）；新增可在根層使用的型別（尤其宣告型積木）時必須同步加入 |
| 變數分類 | Variables 分類為**固定分類**，永遠 4 顆積木（`variables_declare_global`／`variables_declare_local`／`variables_get`／`variables_set`）+ 1 顆「建立變數」按鈕。不可改用 `custom="VARIABLE"` 動態分類：它會依變數數量動態生成積木，導致 flyout 被塞爆且宣告積木永遠不出現（對齊 piBlockly） |
| 定義堆疊 | `variables_declare_global` 與 `coding_raw_definition` 共用 `processDefinitionStack`：宣告積木以 `next` 串成連續堆疊，由堆頂一次產出整條堆疊並寫入 `global_vars_` 的單一 entry（對齊 piBlockly）。`variables_declare_local` 不走此路徑 |

**資料流**：workspace → `domToPrettyText` → metadata 注入 → `.cbg` 落盤；
`.cbg` → `parse()` 去 metadata → `textToWorkspace` → workspace → `workspaceToCode` → 去除 marker → plain code。

---

## 6. 硬體工具鏈

- Arduino CLI 以 JSON 輸出管理 core、library、compile、upload 與 board discovery。
- CLI 程序以非同步 operation 管理進度、取消、stderr 與 timeout。
- 編譯上限 **5 分鐘**（`COMPILE_TIMEOUT`，`pipeline.rs`）、上傳上限 **60 秒**
  （`UPLOAD_TIMEOUT`）。Rust 側另有測試斷言 `COMPILE_TIMEOUT > UPLOAD_TIMEOUT`。
- **教學編譯預設旗標**（`command.rs` 的 `CompileOptions`）：`warnings: Some("all")`、
  `export_binaries: true`、`clean: false`。用 `--warnings all` 是為了讓學習者看到完整訊息，
  代價是核心／函式庫自己的警告也會出現在 stderr（見 §7.3）。
- `clean: false` 且每個專案有獨立 build cache，因此**首次編譯或清 cache 後會重編核心**，
  核心警告因而可見；後續編譯命中快取時可能不再出現 —— 這是預期行為，不是 bug。
- 上傳前必須暫停同一序列埠的 Monitor，結束後依設定重新連線。
- **上傳依賴當下選擇的序列埠**（`compile-controller.currentDevice()` 讀
  `board-detector.getState()`），不讀專案 metadata。

---

## 7. 序列監視器與繪圖

### 7.1 連線與版面

- **Monitor**：Rust `serialport` 維護長連線，支援開關、timestamp、HEX、篩選、清理與重連。
- **Plotter**：開啟時終端機面板**垂直分成左右兩欄**（左＝Monitor 文字、右＝波形），
  與 Monitor **共用同一條序列連線**（Windows COM 埠為獨佔資源，絕不可另開第二條連線）。
  視窗過窄時自動改為上下堆疊，兩者仍同時可見。
- 高度不足時自動撐高終端機面板至 `MIN_PLOT_HEIGHT`，關閉時還原使用者原高度。
- 架構分離要求：plot data parser、series store、ring buffer、downsampling 與 renderer 必須分離。

### 7.2 資料與時間窗

- 資料格式支援 `label:value`、CSV、TSV、布林值；垃圾行（如 `LED 已開啟`）安靜忽略。
- 可選時間窗為 **3 / 10 / 30 秒**（`WINDOW_CHOICES = [200, 600, 1800]`，@60Hz）。
- **預設時間窗為 3 秒**（`DEFAULT_WINDOW = 200`，2026-09-28 由 600／10 秒改為此值）。
  序列資料速率通常只有每秒數筆到數十筆，10 秒視窗會讓「上一輪」與「這一輪」擠在一起，
  看不出波形正在變化。
- 下抽樣採 **min/max 包絡**而非抽稀 —— 抽稀會讓峰值消失，那是誤導而非最佳化。

### 7.3 編譯診斷分流（方案 B）

編譯診斷分為兩組，判準是 **`diagnostic.file === inoFileName`**（與程式碼面板的
標記規則同一套）：

| 組別 | 條件 | 呈現方式 |
|---|---|---|
| 使用者草稿 | `file` 等於後端回報的草稿檔名 | 原樣輸出 `file:line:col message`，並在程式碼面板標記對應行 |
| 核心／函式庫 | 其他所有檔案 | 先印一行摘要（`CLI_DIAGNOSTIC_EXTERNAL_HEADER`，帶筆數），再縮排列出檔名與訊息 |

實作於 `compile-controller.js` 的 `splitDiagnostics()` / `renderDiagnostics()`。

**為什麼要分區但不合併隱藏**：以 `--warnings all` 編譯時，AVR 核心自己會產生警告
（典型為 `cores/arduino/new.cpp` 的 `unused parameter 'tag'`）。這些與使用者的 `.ino`
毫無關係，原樣混印會讓學生困惑「我哪來的 new.cpp？」；但真實編譯確實有這種噪音，
讓學習者提早知情是好的。因此**明確標示「與你的程式碼無關」並保留原文**，
而不是假裝不存在。

程式碼面板的標記維持原則：**只標記使用者草稿的診斷**，函式庫核心檔的警告不標。

### 7.4 序列通訊預設值

- `arduino_serial_begin` 的**預設鮑率為 9600**（`blocks.js` 的模組層常數 `DEFAULT_BAUD`），
  但**下拉清單順序維持遞增不動**。
- 兩者並存的做法：`options` 陣列保持原序，在 `jsonInit()` 之後呼叫
  `setFieldValue(DEFAULT_BAUD, 'BAUD')`。
  Blockly 的 `field_dropdown` **一律選第一個 option**，若把 9600 搬到清單第一項，
  下拉選單會變成 `9600, 300, 1200, ...`（順序錯亂）。

### 7.5 介面狀態表達

終端機工具列的開關鈕以 **`is-active` class + `aria-pressed` 屬性**表達狀態
（`#btn-plotter` 用 `is-active`，`#btn-plot-pause` 用 `is-paused`）：

- 顏色一律走語意 token（`--cb-primary`、`--cb-dirty-ring`），**不可寫死色碼**。
  寫死的淺色文字搭配深色背景，在 Angel（candy-light）淺色 preset 下幾乎看不見。
- 狀態變化必須呼叫 `syncControls()`（內部已包含 `syncStatus()`），不可只呼叫
  `syncStatus()` —— 開關鈕的 class 不會被更新，按鈕會停在舊樣式。
  現況呼叫點：`openPlot()`、`closePlot()`、`init()`、`setWindow()`、`togglePause()`。
  **改動這五個函式任一處時都必須確認有呼叫**，漏掉 `closePlot()` 會造成
  「關閉後按鈕仍是啟用樣式」。
- 同時提供 `aria-pressed`，讓螢幕閱讀器能播報 toggle 狀態，不只靠顏色表達。

---

## 8. 程式碼預覽面板

唯讀，呈現由積木產生的 Arduino C++ 程式碼。

- **行號**：以 CSS counter 實作（`#codeContent` 的 `counter-reset: line` 配對
  `.code-line` 的 `counter-increment`，數字由 `.code-line::before` 的
  `content: counter(line)` 產生）。
- 選用 CSS counter 而非在 JS 插入節點的理由：`innerHTML` 仍只含高亮後的程式碼、
  診斷標記（`diag-*`）與選取範圍的計算不受影響、增刪積木時行號自動重算、
  「複製程式碼」走 `plainCode` 模組不經 DOM 因而輸出不含行號。
- **選取與定位**：點選積木會高亮其對應的程式行（generator 產出的 ID marker 去除後
  的行號區間），此機制與行號共存，行號欄位不被選取範圍覆蓋。

