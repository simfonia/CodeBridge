# Blockly v12.3.1 升級至 v13.3.0：過程與經驗

## 1. 文件目的

本文記錄 CodeBridge 從 Blockly 12.3.1 升級至 13.3.0 的完整經驗，重點不在記錄改了哪些檔案，而是回答：

- 升級前應該先準備什麼？
- 為什麼單純替換 UMD 資源不足以完成升級？
- v12 與 v13 真正影響 CodeBridge 的差異有哪些？
- 遇到了哪些非預期錯誤？如何診斷？
- 為什麼最終在 XML 輸入邊界處理 migration？
- 如何用測試把未來模組開發與 Blockly 升級變成可重複驗證的流程？

實際結果是：CodeBridge 固定使用 Blockly 13.3.0，保留原有 UMD 全域架構、Arduino generator、code buckets、Blockly ID marker、XML block type，以及 Angel／Engineer 雙風格設計。

---

## 2. 升級目標與範圍

### 2.1 目標

- Blockly core 從 12.3.1 更新至 13.3.0。
- Python generator 與所有既有外掛更新至相同版本。
- 保留現有積木與 generator 註冊方式。
- 保留 v12 Blockly XML 的開啟能力。
- 停用 Blockly 所有操作音效。
- 明確固定 Thrasos renderer，避免未來預設 renderer 改變造成 UI 無預警變動。
- 建立可重複執行的 runtime、migration、golden 與資源完整性測試。

### 2.2 明確不包含

本次沒有同時進行：

- 將 UMD script 全面改為 ESM／Svelte module。
- 將 Blockly 改由 npm bundler 直接 import。
- 重新命名既有 block type。
- 重寫 `Blockly.Blocks[...]` 或 `Blockly.Arduino.forBlock[...]` 註冊模型。
- 重寫 code buckets 或 block ID marker。
- 合併 UMD 遷移與 Module Runtime 重構。

這些工作都有獨立風險。若與版本升級一起進行，失敗時將難以判斷是 Blockly 版本問題、架構重構問題，還是模組行為問題。

---

## 3. 升級前盤點

### 3.1 確認實際執行版本

專案文件原本標示 Blockly v12.3.1，但升級前不能只相信文件或目錄名稱。實際檢查：

```javascript
Blockly.VERSION
```

結果確認 core 內版本確實為 12.3.1。

> CodeBridge 使用手工內嵌 UMD 資源，npm dependency 不存在，因此文件與實際資源可能不同步。版本資訊至少要同時核對文件、`package.json` 與實際載入的 runtime。

### 3.2 盤點 Blockly 接觸面

升級前列出專案使用的所有 Blockly API，而不是只搜尋「Blockly」關鍵字。

盤點項目：

- 工作區：`inject`、`getMainWorkspace`、`getSelected`、`svgResize`。
- 主題：`Theme.defineTheme`、`Themes.Classic`。
- 事件：`Events.disable`、`Events.enable`、`Events.setGroup`、`Events.fire`。
- XML：`domToWorkspace`、`workspaceToDom`、`domToText`、`utils.xml.textToDom`。
- 訊息：`Blockly.Msg`。
- Generator：`Blockly.Generator`、Arduino generator、`Blockly.Arduino.forBlock`。
- 變數 API：確認是否使用 v12 將移除的 Workspace／VariableMap 舊方法。
- 事件常數：`Events.SELECTED`、`Events.BLOCK_CHANGE`。
- 自訂 field 與 registry。
- Blockly 外掛。

盤點結果顯示 CodeBridge 沒有直接使用 v12 已棄用的 `createVariable()`、`getVariableById()`、`getAllVariables()` 等舊 API，因此這些移除項目不會阻塞本次升級；但已列入未來開發禁用清單。

### 3.3 盤點積木與 generator 數量

升級前確認：

- 45 個 CodeBridge block definitions。
- 43 個 Arduino generators。

這不只是記數字，而是建立後續 contract：新增 block 卻忘記 generator 時要能自動發現；generator 對應錯誤 block type 時也要能發現；官方 standard blocks 載入後總 block 數增加不應被誤判為模組重複註冊。

### 3.4 建立備份與回退點

替換任何資源前，先完整備份：

- `ui/public/blockly/core/`
- `ui/public/blockly/plugins/`
- 主要入口 `ui/index.html`
- Blockly 初始化程式 `ui/src/main.js`

本次備份位置：

```text
C:\Workspace\CodeBridge\backup\blockly-12.3.1_20260925_155656
```

回退點必須包含入口與初始化程式，而不只是 Blockly 壓縮檔，因為升級問題可能來自載入順序或 injection options。

---

## 4. 資源與版本策略

### 4.1 固定精確版本

不使用浮動網址：

```html
<!-- 錯誤 -->
<script src="https://unpkg.com/blockly/blockly.min.js"></script>
```

改用固定版本：

```text
https://unpkg.com/blockly@13.3.0/blockly_compressed.js
https://unpkg.com/blockly@13.3.0/python_compressed.js
https://unpkg.com/blockly@13.3.0/msg/en.js
https://unpkg.com/blockly@13.3.0/msg/zh-hant.js
```

> 對離線桌面應用而言，浮動 `latest` 等於把未來啟動結果交給第三方網站決定。CodeBridge 的 runtime 必須可重現，因此版本與 hash 都要固定。

### 4.2 外掛不可混用不同 Blockly 版本

同步更新：

- `@blockly/field-colour`
- `@blockly/field-multilineinput`
- `@blockly/plugin-scroll-options`
- `@blockly/workspace-minimap`
- `@blockly/plugin-modal`

外掛使用相同 UMD 載入模型，但內部依賴 core、registry、field、event 與 component API。若 core 是 v13、外掛仍是 v12，錯誤通常只會在特定操作時出現，比純載入失敗更難診斷。

> Blockly 升級單位不是單一 core 檔，而是 core、standard blocks、language generator、messages、plugins 的完整版本集合。


### 4.3 資源 manifest

所有發布的 Blockly JavaScript 資源都記錄：

- 相對路徑
- bytes
- SHA-256

位置：

```text
ui/public/blockly/VERSIONS.md
```

後續 Vitest 會驗證：

1. manifest 中的每個檔案都存在。
2. bytes 相同。
3. SHA-256 相同。
4. 所有發布的 Blockly `.js` 都已登錄。

這可防止下載到錯誤版本、替換時漏掉檔案、壓縮檔被不完整覆蓋，以及開發環境與 CI 使用不同 Blockly 產物。

---

## 5. 最終正確的資源載入順序

CodeBridge 固定使用以下順序：

```text
1. blockly/core/blockly.js
2. blockly/core/blocks_compressed.js
3. blockly/core/python_compressed.js
4. blockly/msg/en.js
5. 保存英文基礎訊息 snapshot
6. blockly/msg/zh-hant.js
7. 保存繁中基礎訊息 snapshot
8. Blockly plugins
9. CodeBridge generator core
10. CodeBridge modules：messages → blocks → generators
11. XML migration adapter
12. main.js
```

### 為什麼 `blocks_compressed.js` 不可省略

CodeBridge 只載入 core 時，基本工作區可以建立，但建立 `controls_if` 或 `text_join` 會失敗：

```text
Extension "controls_if_mutator" not found
Extension "text_join_mutator" not found
```

原因：

- CodeBridge 在自己的 `blocks.js` 中覆寫 `controls_if` 與 `text_join`。
- 覆寫定義仍引用官方 mutator。
- 官方 mutator 註冊在 standard blocks bundle 中，不在 core-only bundle 中。

因此 standard blocks 必須在 CodeBridge 覆寫 block 之前載入。

正確順序：

```html
<script src="blockly/core/blockly.js"></script>
<script src="blockly/core/blocks_compressed.js"></script>
```

> 覆寫 Blockly 內建 block 不代表不需要官方 standard blocks。覆寫只取代 block definition，不會自動取代 mutator、field、toolbox 與其他 registry extension。

---

## 6. 問題一：v13 ARIA 初始化缺少官方基礎訊息

### 6.1 症狀

替換 core 後，頁面初始化失敗：

```text
TypeError: Cannot read properties of undefined (reading 'replace')
```

堆疊指向：

```text
updateAriaLabel
setInitialAriaContext
createDom
inject
```

### 6.2 根因

CodeBridge 原本只載入 Blockly core 與 CodeBridge 自訂 messages。v12 工作區初始化不需要完整 Blockly 基礎訊息，但 v13 預設支援鍵盤導覽與螢幕閱讀器，建立工作區時會讀取：

- `WORKSPACE_LABEL_PLAIN`
- `WORKSPACE_LABEL_1_STACK`
- `WORKSPACE_LABEL_MANY_STACKS`
- `WORKSPACE_ROLEDESCRIPTION`

這些是 Blockly 官方基礎訊息，不存在於 CodeBridge 模組訊息中。缺少 `WORKSPACE_LABEL_MANY_STACKS` 時，v13 執行：

```javascript
WORKSPACE_LABEL_MANY_STACKS.replace('%1', String(blockCount));
```

因此造成 `undefined.replace()` 初始化中斷。

### 6.3 解法

加入官方訊息：

```text
ui/public/blockly/msg/en.js
ui/public/blockly/msg/zh-hant.js
```

但 CodeBridge 支援繁中／英文即時切換，不能只載入單一語系。msg UMD 會直接覆寫 `Blockly.Msg`，因此分別載入後保存 snapshot：

```javascript
window.CodeBridgeBlocklyBaseLocales = {};
window.CodeBridgeBlocklyBaseLocales.en = Object.assign({}, Blockly.Msg);
```

載入繁中後再保存：

```javascript
window.CodeBridgeBlocklyBaseLocales['zh-hant'] = Object.assign({}, Blockly.Msg);
```

loader 切換語系時先套用官方基礎訊息：

```javascript
Blockly.setLocale(CodeBridgeBlocklyBaseLocales[locale]);
```

再由 CodeBridge 模組訊息覆寫積木文字與分類名稱。

### 6.4 經驗

- CodeBridge 模組訊息不能取代 Blockly 基礎訊息。
- v13 的 accessibility 訊息已成為 runtime 必要依賴。
- 多語系訊息必須建立「基礎語系 → 專案覆寫」的兩層模型。
- 不能在 `Blockly.inject()` 前假定 `Blockly.Msg` 已完整。

---

## 7. 問題二：Thrasos 不是 Theme

### 症狀

最初嘗試：

```javascript
theme: Blockly.Themes.Thrasos
```

v13 工作區初始化時發生 `undefined.replace()`。

### 根因

Blockly v13 將 Thrasos 作為預設 renderer，但公開 Theme 仍只有：

- `Blockly.Themes.Classic`
- `Blockly.Themes.Zelos`

v13 沒有公開的 `Blockly.Themes.Thrasos`。

### 解法

Theme 與 renderer 分開設定：

```javascript
const workspace = Blockly.inject(blocklyDiv, {
  theme: Blockly.Themes.Classic,
  renderer: 'thrasos',
  sounds: false
});
```

> Renderer 決定積木如何繪製；Theme 決定顏色、字型與其他視覺屬性。兩者名稱可能相似，但不是同一個設定層級。

---

## 8. 問題三：停用音效的選項名稱

最初直覺使用：

```javascript
sound: false
```

但 Blockly v13 正式選項是複數：

```javascript
sounds: false
```

`Options` 會讀取 `options['sounds']`，錯誤的 `sound: false` 會被忽略，Blockly 仍可能載入音效。

正確驗收不是只看 `workspace.options.sound`，而是檢查：

```javascript
workspace.options.hasSounds === false
```

並在瀏覽器層確認沒有 mp3／wav／ogg request。

> Injection option 的複數、單數與內部正規化欄位可能都不同。驗收應檢查實際生效狀態，而不是只確認原始設定物件。


---

## 9. 問題四：v12 `controls_if` mutation 無法在 v13 還原

### 9.1 症狀

載入 v12 `controls_if` XML 後，只保留第一個 IF，elseif 與 else 消失。

v12 XML：

```xml
<mutation elseifCount="1" elseCount="1"/>
```

### 9.2 根因

Blockly 13.3.0 官方 mutator 改讀：

```xml
<mutation elseif="1" else="1"/>
```

v12 與 v13 的 mutation 屬性名稱不同。舊屬性被忽略後，mutator 不會建立 `IF1`、`DO1` 與 `ELSE` inputs。

### 9.3 錯誤的修正方式：覆寫 block definition method

第一個直覺是覆寫 CodeBridge `controls_if` 的 `domToMutation`：

```javascript
Blockly.Blocks['controls_if'] = {
  init: function() {
    // ...
  },
  domToMutation: function(xmlElement) {
    // 同時讀 elseif / elseifCount
  }
};
```

但 v13 registry 會拒絕這種做法。

使用 `mutator` 加自訂 method 的錯誤：

```text
tried to apply mutation "controls_if_mutator" to a block that already has mutator functions
```

把 mutator 改成一般 extension 的錯誤：

```text
Mixin will overwrite block members: ["domToMutation"]
mutation properties changed when applying a non-mutator extension
```

這些錯誤說明：官方 mutator 已提供 lifecycle methods；v13 不允許 block definition 或一般 extension 任意覆寫。複製或重複註冊 mutator 會失去官方 decompose／compose／save／load 契約。

### 9.4 正確解法：XML 輸入邊界 migration

建立單一 migration seam：

```text
ui/src/lib/blockly/xml-migration.js
```

在 XML 進入 Blockly 前轉換 mutation：

```javascript
function migrateControlsIfMutations(xmlElement) {
  const controlsIfBlocks = xmlElement.querySelectorAll('block[type="controls_if"]');

  for (let i = 0; i < controlsIfBlocks.length; i++) {
    const mutation = controlsIfBlocks[i].querySelector('mutation');
    if (!mutation) continue;

    const elseifCount = mutation.getAttribute('elseifCount');
    if (elseifCount !== null && mutation.getAttribute('elseif') === null) {
      mutation.setAttribute('elseif', elseifCount);
    }

    const elseCount = mutation.getAttribute('elseCount');
    if (elseCount !== null && mutation.getAttribute('else') === null) {
      mutation.setAttribute('else', elseCount);
    }
  }
}
```

提供統一代入介面：

```javascript
CodeBridgeBlocklyXml.prepareXml(xmlElement);
CodeBridgeBlocklyXml.domToWorkspace(xmlElement, workspace);
CodeBridgeBlocklyXml.textToWorkspace(xmlText, workspace);
```

產品所有 XML 輸入路徑都改用此介面：預設 setup／loop 注入、sessionStorage 還原、Angel／Engineer style reload、測試 fixture 載入。

### 9.5 為什麼不在 block factory 遷移

- 會與官方 mutator method 衝突。
- 容易破壞 decompose／compose。
- 每種 XML 差異都要複製官方實作。
- 未來升級仍需手動比對。
- 測試很難只從公開 XML 輸入 seam 驗證。

XML adapter 的優點是：保留官方 mutator 完整行為，只處理已知序列化差異，所有路徑共用，且可用輸入 XML 與輸出 workspace 行為驗證。

> Serialization migration 應發生在資料輸入邊界，不應複製或修改第三方 library 對 block lifecycle 的內部責任。

---

## 10. 問題五：v13 workspace ARIA label 停留在 0 stacks

### 10.1 症狀

工作區已建立預設 setup／loop，DOM 也有兩個 block，但螢幕閱讀器 label 仍是：

```text
0 stacks of blocks
```

### 10.2 根因

v13 在工作區建立時先初始化 ARIA context，當時尚未注入 CodeBridge 預設積木。CodeBridge 原本在 `Blockly.Events.disable()` 狀態下注入初始 XML，而且注入發生在 change listener 安裝之前，因此沒有事件更新 stack count。

### 10.3 解法

初始 XML 不再停用 events：

```javascript
CodeBridgeBlocklyXml.textToWorkspace(defaultXml, workspace);
workspace.updateAriaLabel();
```

session restore 同樣處理。style reload 仍需停用 events 進行整個 workspace 重建，但重建後補上：

```javascript
ws.clear();
CodeBridgeBlocklyXml.domToWorkspace(currentXml, ws);
ws.updateAriaLabel();
```

### 10.4 經驗

- Blockly 成功建立 workspace，不等於所有 accessibility state 都正確。
- v13 預設提供鍵盤與螢幕閱讀器支援，ARIA label 應納入 runtime contract。
- 批量重建後應明確刷新衍生狀態。
- 無障礙問題應由公開 DOM 屬性驗證。

---

## 11. 問題六：v12 fixture 的 statement 結構

第一版 v12 XML fixture 將 `input_statement` 錯寫為：

```xml
<value name="CONTENT">
```

Blockly v13 拋出：

```text
Shadow block is missing previous connection
```

正確結構：

```xml
<statement name="CONTENT">
  ...
</statement>
```

> Blockly v13 對 shadow block 與 connection 結構的驗證更嚴格。XML migration 測試應保留真實舊版序列化結構，不可手寫「看起來差不多」的 DOM。

---

## 12. 問題七：generator golden 測試中的 ID marker

CodeBridge 為程式碼定位加入動態 marker：

```text
// __BLOCKLY_ID:<block id>__
```

Blockly block id 每個 session 都不同，因此 golden 測試不能直接比較完整產碼。目前策略：

1. 產生 marked code。
2. 測試端移除每行 `__BLOCKLY_ID` marker。
3. 與固定 `.ino` literal 比較。

Blockly 隨機 id 可能包含 `//`、分號或底線字元，因此不能假設 ID 一定符合 `\S+`，也不能依賴 `__` 是 ID 的第一個結尾。marker 固定是行尾 suffix，因此以行尾範圍移除最穩定。

長期目標：將 marked code、plain code 與 source mapping 分離，golden test 直接驗證正式 `.ino` 不含 marker。

---

## 13. 測試策略：把一次驗證升級成永久安全網

### 13.1 為什麼需要真實瀏覽器

Blockly 依賴 DOM、SVG、focus、ARIA、registry 與事件生命週期。純靜態單元測試無法證明工作區可建立、預設積木可注入、訊息完整、mutator 可建立、ARIA 正確、Console 無錯或沒有媒體請求。因此使用 Playwright + 系統 Microsoft Edge 測試真實 runtime。

### 13.2 公開測試 seam

- **Runtime**：驗證 `Blockly.VERSION`、renderer、`hasSounds`、block／generator registrations、預設 blocks、ARIA、HTTP status、media requests 與 Console。
- **Migration**：透過 `CodeBridgeBlocklyXml.textToWorkspace()` 載入真實 v12 XML。
- **Generator golden**：透過 `Blockly.Arduino.workspaceToCode()` 取得公開產物。
- **Resource manifest**：Vitest 驗證 bytes 與 SHA-256。

### 13.3 Fixture 與風險

| Fixture | 主要驗證 |
|---|---|
| `setup-loop.xml` | code buckets、pin shadow、Arduino I/O、block comment |
| `controls-if.xml` | v12 mutation migration、elseif、else、邏輯比較 |
| `controls-for.xml` | field variable、數字 shadow、loop generator、math generator |
| `text.xml` | `text_join` mutator、text generator、value expression |
| `workspace-comment.xml` | top-level workspace comment 序列化與無 block 程式碼 |

後續 Variables、Array、Functions 模組也沿用相同方式加入 fixture。

### 13.4 為什麼不用 keyboard-navigation plugin

Blockly v13 已將鍵盤導覽內建。若同時保留舊 plugin，可能造成快捷鍵衝突。CodeBridge 不自行註冊第二套鍵盤導覽，只確保自訂 blocks 在 v13 預設 accessibility 模型下可正常操作。


---

## 14. TDD 與模組開發流程

### 14.1 為什麼 CI 不會自動產生 TDD 測試

自動化可以驗證規則，但無法可靠推導新 block 的正確公開行為與 C++ 語意。自動生成測試容易變成只證明實作符合自己的形式，而不是符合使用者需求。

正確分工：

- 開發者或 AI agent 負責先寫公開行為測試。
- 自動 contract test 防止結構性遺漏。
- CI 確保既有與新增測試持續通過。

### 14.2 強制工作流程

新增或修改模組採 red → green → refactor：

1. Red：先建立會失敗的 XML fixture 與行為斷言。
2. Green：只實作讓測試通過所需的 block、messages 與 generator。
3. Refactor：完成垂直功能後才整理重複程式碼。
4. 執行 `npm test`。
5. 執行 `npm run build`。

### 14.3 每個公開 block 的最低契約

- `colour`
- `tooltip`
- 英文與繁中訊息
- 對應 `Blockly.Arduino.forBlock[type]`
- 至少一份 XML fixture
- 至少一個公開行為斷言
- statement／value block 的 generator golden output
- Toolbox、block type 與 generator type 一致

mutator-only helper 可以沒有 generator，但必須列入明確 allowlist。目前包括：

- `controls_if_elseif`
- `controls_if_else`

### 14.4 自動 module contract

Vitest 掃描所有模組的 `blocks.js` 與 `generators.js`：

- block 缺少 generator → 失敗。
- generator 沒有對應 block → 失敗。
- allowlist 必須明確存在。

這能防止新模組最常見的結構性錯誤，但無法取代 XML 與 golden 行為測試。

---

## 15. CI 設計

Workflow：

```text
.github/workflows/frontend-blockly.yml
```

使用：

- `windows-latest`
- Node.js 24
- `npm ci --prefix ui`
- system Edge
- 不下載 Playwright Chromium

執行順序：

1. Vitest asset／module contract。
2. Playwright runtime／migration tests。
3. Vite production build。
4. 失敗時上傳 Playwright HTML report。

先跑 asset tests 的原因是：若 Blockly hash、版本或 manifest 已破壞，後續 browser test 的失敗只是間接症狀。Playwright 使用 dev server 通過也不代表 production build 一定通過，因此兩者都要保留。

---

## 16. 診斷方法與工具選擇

### 16.1 先讀實際發布產物，不猜 source 路徑

Blockly 上游在 v13 將標準 blocks 拆到不同 package，搜尋舊 repository 路徑可能得到 404。最終以實際 npm 發布的 `blockly_compressed.js` 與 `blocks_compressed.js` 內容確認 mutator 與 mutation 契約。

> 當文件路徑、repository 結構與實際套件不一致時，以固定版本套件的實際產物與官方 API reference 為準。

### 16.2 使用最小重現

每個問題都縮成單一 fixture：缺少 mutator 只載入 `controls_if`；ARIA 只檢查 focus target；audio 只監聽媒體 request；mutation 只載入一組 `controls_if` XML。

避免一次載入所有模組後猜測問題來源。

### 16.3 不要放寬測試讓錯誤消失

重要修正都選擇修產品：

- ARIA label 應是 1 stack，不接受 0。
- v12 `controls_if` 應保留 IF1／DO1／ELSE，不接受只剩 IF0。
- 音效應真的沒有媒體請求，不接受只檢查錯誤設定 key。
- standard blocks 應真的註冊 mutator，不接受移除 mutator 功能。

### 16.4 區分資源問題與產品程式問題

Console 顯示 Blockly 壓縮檔內部錯誤時，依序檢查：

1. 版本與 hash。
2. 載入順序。
3. 必要 bundle 是否存在。
4. CodeBridge 覆寫與 generator。

不要直接修改官方壓縮檔。

---

## 17. v12 與 v13 差異速查表

| 項目 | v12 行為 | v13 行為／CodeBridge 做法 |
|---|---|---|
| 預設 renderer | 舊預設 | Thrasos；明確指定 |
| 公開 Theme | Classic、Zelos | 仍為 Classic、Zelos；Thrasos 不是 Theme |
| 音效 option | 容易誤認為 `sound` | 正式為 `sounds` |
| 基礎訊息 | core-only 可建立 workspace | ARIA 初始化需要官方 `msg/*.js` |
| 鍵盤導覽 | 可使用 plugin | v13 內建，不需舊 plugin |
| Accessibility | 非核心行為 | 預設 ARIA、focus、live region |
| Workspace label | 初始化後通常不明顯 | 注入／重建後需確認 `updateAriaLabel()` |
| 舊變數 API | 部分方法仍存在但棄用 | 已移除，改用 VariableMap API |
| `controls_if` mutation | `elseifCount`／`elseCount` | `elseif`／`else` |
| `text_join` mutation | 依舊 block 結構 | 使用 `items`，需 standard blocks bundle |
| Mutator 覆寫 | 舊版較寬鬆 | 不允許覆寫官方 mutator method |
| Shadow／connection 驗證 | 較寬鬆 | 對錯誤 XML 更嚴格 |
| Standard blocks | 可只依賴既有覆寫 | core-only 不含 mutator，需載入 `blocks_compressed.js` |

---

## 18. 常見錯誤寫法

### 使用不存在的主題

```javascript
// 錯誤
theme: Blockly.Themes.Thrasos

// 正確
theme: Blockly.Themes.Classic,
renderer: 'thrasos'
```

### 停用音效的 key 拼錯

```javascript
// 錯誤
sound: false

// 正確
sounds: false
```

### 直接載入未轉換的舊 XML

```javascript
// 錯誤
Blockly.Xml.domToWorkspace(oldXml, workspace);

// 正確
CodeBridgeBlocklyXml.textToWorkspace(oldXml, workspace);
```

### 覆寫官方 mutator

```javascript
// 錯誤：直接覆寫 v13 mutator method
Blockly.Blocks['controls_if'].domToMutation = function() {};
```

正確方式是在 XML 輸入邊界轉換序列化差異，保留官方 mutator。

### 只載入 CodeBridge messages

```javascript
// 錯誤：Blockly 基礎訊息仍不完整
Blockly.Msg['CUSTOM_KEY'] = '自訂文字';
Blockly.inject(...);

// 正確
Blockly.setLocale(blocklyBaseMessages);
// 再由 CodeBridge 訊息覆寫
```

### 只做靜態版本檢查

靜態檢查無法證明 runtime、ARIA 或 mutator 正常。應使用真實 Edge 載入頁面，透過公開 API 與 DOM 驗證。


---

## 19. 下一次 Blockly 升級的可重用檢查清單

### Phase 0：盤點

- [ ] 讀取目標版本 release notes 與 breaking changes。
- [ ] 核對實際 runtime 版本。
- [ ] 盤點所有 Blockly API、外掛、field、registry 使用。
- [ ] 盤點目前 XML fixtures。
- [ ] 建立完整備份與回退點。
- [ ] 確認 production build 基準通過。

### Phase 1：測試先行

- [ ] 先讓新版本在既有 runtime test 中失敗。
- [ ] 保留舊版 XML migration fixtures。
- [ ] 確認 generator golden baseline。
- [ ] 確認資源 manifest 會拒絕新版本未登錄檔案。

### Phase 2：資源

- [ ] 使用固定版本，不用 `latest`。
- [ ] core、standard blocks、language generators、messages、plugins 全部同版本。
- [ ] 更新 `VERSIONS.md` bytes 與 SHA-256。
- [ ] 檢查 Node.js engine 與 CI runner。

### Phase 3：初始化

- [ ] 驗證載入順序。
- [ ] 驗證 renderer／theme 分離。
- [ ] 驗證音效 options。
- [ ] 驗證基礎訊息與 `setLocale()`。
- [ ] 驗證 workspace ARIA 與 focus。

### Phase 4：Migration

- [ ] 比對 mutation 與 serialization 屬性。
- [ ] migration 放在輸入邊界。
- [ ] 所有 XML 載入路徑使用同一 adapter。
- [ ] 不覆寫官方 lifecycle method。

### Phase 5：模組

- [ ] 每個 block 都有 generator。
- [ ] mutator-only allowlist 明確。
- [ ] Toolbox、block type、generator type 一致。
- [ ] 新增 XML fixture 與 golden output。

### Phase 6：驗收

- [ ] `npm test` 全通過。
- [ ] `npm run build` 通過。
- [ ] Console 無 warning／error。
- [ ] 無未捕捉 page error。
- [ ] 舊 XML 可載入並可重新序列化。
- [ ] 程式碼定位與 ID marker 正常。
- [ ] 無音訊或媒體請求。
- [ ] npm audit 與依賴版本安全。
- [ ] 備份可回退。

---

## 20. 核心經驗總結

### 20.1 版本升級不是檔案替換

真正的升級包含資源組合、載入順序、locale 基礎訊息、序列化格式、mutator registry、accessibility 衍生狀態，以及 generator 與 XML round-trip。

### 20.2 不要複製第三方 library 的內部責任

`controls_if` 教訓最清楚：看似在 block definition 修一個 method 最直接，實際上會與 v13 registry lifecycle 衝突。正確 seam 是 XML 輸入邊界，保留官方 block／mutator 行為，只轉換已知資料格式。

### 20.3 Runtime 成功不等於產品正確

本次至少有兩個「頁面可開但功能不完整」問題：ARIA label 顯示 0 stacks、v12 `controls_if` 靜默遺失分支。兩者都不會拋出 build error，只能透過公開行為測試發現。

### 20.4 先建立測試安全網，再做後續模組開發

升級完成後，Variables、Array、Functions 都可沿用同一套契約：v12 XML fixture、block／generator registration、generator golden、Angel／Engineer round-trip、module contract scan。這使升級成果不只是一次性修好，而是後續模組開發的基礎設施。

### 20.5 版本規則應放在專案規範

日常開發規則已放入：

```text
AGENTS.md
```

詳細資料位於：

```text
log/plan/BlocklyV13Upgrade.md
log/plan/BlocklyV13MigrationExperience.md
log/plan/BlocklyTesting.md
log/mappings/Framework_API_Index.html
```

### 20.6 完成標準

未來新增模組時，不應再以「替換壓縮檔後能開啟頁面」作為完成標準；必須同時通過 runtime、migration、generator、resource 與 production build 契約。

---

## 21. 最終狀態

CodeBridge 固定使用 Blockly 13.3.0，並已建立：

- 完整 Blockly 資源 manifest。
- v13 基礎訊息與雙語 snapshot。
- Thrasos renderer + Classic theme。
- 完整停用 Blockly 音效。
- v12 `controls_if` XML migration adapter。
- 初始／還原／style reload 的 ARIA 更新。
- Playwright system Edge runtime 與 migration contracts。
- Vitest 資源與 module contracts。
- v12 XML／generator golden fixtures。
- Windows GitHub Actions CI。
- `AGENTS.md` 的 Blockly v13 開發與 TDD 強制規範。


---

## 22. Blockly v13 Toolbox Flyout 背景修正

### 22.1 問題症狀

在 Engineer 深色科技 preset 中，點擊 toolbox 左側分類後，flyout 面板仍呈現白色。Toolbox 本身、workspace 背景與一般 CSS 表面都已是深色，因此問題只出現在左鍵點擊分類後顯示的 flyout 背景。

這個問題與 hover 無關；Blockly v13 的 toolbox flyout 是由左鍵點擊分類後動態顯示的 `svg` 元素。

### 22.2 診斷方式

使用 Playwright 點擊第 7 個公開 toolbox category，檢查所有含 `Flyout` 的 DOM 元素。實際結構為：

```text
<div class="injectionDiv thrasos-renderer codebridge-technology-dark-theme">
  <svg class="blocklyFlyout blocklyToolboxFlyout">
    <path class="blocklyFlyoutBackground"></path>
  </svg>
</div>
```

診斷結果：

- `svg.blocklyFlyout` 的 CSS `background-color` 已是 Engineer 深色。
- `path.blocklyFlyoutBackground` 的 `fill` 仍是白色。
- 截圖中的白色面板實際由 SVG path 的 `fill` 決定，而不是一般 CSS background。

### 22.3 根因

Blockly v13 flyout 使用 SVG 背景圖層：

```html
<path class="blocklyFlyoutBackground"></path>
```

先前 Engineer 主題只覆寫 CSS：

```css
.blocklyFlyout {
    background-color: var(--cb-surface) !important;
}
```

這只能改變 SVG 元素的 CSS 背景，不能改變 SVG path 的 `fill`，因此畫面仍顯示 Blockly 預設白色。

### 22.4 修正方式

在 Engineer preset 的主題樣式中加入 SVG-specific contract：

```css
[data-codebridge-preset='engineer'] path.blocklyFlyoutBackground {
    fill: var(--cb-surface) !important;
    stroke: var(--cb-border) !important;
}
```

同時保留 flyout 元素本身的背景覆寫，處理不同 Blockly runtime 可能產生的背景層與 shorthand：

```css
[data-codebridge-preset='engineer'] .blocklyFlyout,
[data-codebridge-preset='engineer'] .blocklyToolboxFlyout,
[data-codebridge-preset='engineer'] .blocklyFlyoutBackground,
[data-codebridge-preset='engineer'] .blocklyFlyout .blocklyFlyoutBackground,
[data-codebridge-preset='engineer'] .blocklyFlyoutScrollbar,
[data-codebridge-preset='engineer'] .blocklyFlyout .blocklyScrollbarThumb {
    background: var(--cb-surface) !important;
    background-color: var(--cb-surface) !important;
}
```

這項修正僅影響 Engineer preset，不改變 Angel 的明亮 flyout，也不改變 Blockly toolbox XML、block type、generator 或 workspace 資料。

### 22.5 驗證結果

點擊分類後使用 computed style 驗證：

```text
fill:   rgb(18, 27, 43)
stroke: rgb(48, 68, 95)
```

因此 Engineer flyout 的 SVG 背景已確認為深色。

相關回歸驗證：

- Settings dropdown above toolbox：1 passed。
- Engineer toolbox／flyout／highlight／switch：1 passed。
- `git diff --check` 通過。

### 22.6 可重用診斷教學

遇到 Blockly v13 toolbox 或 flyout 主題問題時，不應只檢查 `.blocklyFlyout` 的 computed `background`。應用左鍵點擊分類後，直接檢查：

```javascript
const path = document.querySelector(
  '.blocklyFlyout:not(.blocklyTrashcanFlyout) path.blocklyFlyoutBackground'
);

({
  fill: getComputedStyle(path).fill,
  stroke: getComputedStyle(path).stroke,
  background: getComputedStyle(path).backgroundColor,
  outerHTML: path.outerHTML
});
```

判斷原則：

- 若 `fill` 是白色，必須覆寫 `path` 的 `fill`。
- 若 `background-color` 是白色，處理 flyout 元素或背景層的 CSS background。
- 若兩者都正確但仍白色，檢查 inline `style`、更高優先級的 runtime CSS 或不同 preset stacking context。

### 22.7 重要教訓

Blockly v13 的主題問題不能只從 CSS class 名稱推測。Flyout 屬於 SVG component，背景由 `path.blocklyFlyoutBackground` 的 `fill` 決定。對未來主題、除錯與瀏覽器自動化測試，應以點擊後的公開 DOM 與 computed style 為準，不要只依 hover 或未開啟的 flyout 狀態判斷。
