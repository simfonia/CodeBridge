# CodeBridge Functions 模組移植計畫 (Engineer 風格對齊 piBlockly)

## 1. 背景

將 piBlockly 的 Functions 模組移植到 CodeBridge，建立 `modules/functions/`。Engineer 風格的積木文字與產生器必須對齊 piBlockly 的實作。

### 參考資訊
- **piBlockly blocks**: `C:/Workspace/piblockly/media/blocks/functions.js`（5 個 toolbox 公開積木 + 2 個 mutator-only helper）
- **piBlockly generators**: `C:/Workspace/piblockly/media/generators/functions.js` (5 個產生器)
- **piBlockly i18n**: `C:/Workspace/piblockly/media/zh-hant.js` + `en.js` (Engineer/Angel 對應表)
- **CodeBridge 已完成模式**: Arduino / Coding / Logic / Loops / Math / Array 模組

### 關鍵差異：piBlockly vs CodeBridge 雙風格機制
| 專案 | Angel 基底 | Engineer 覆寫 | 切換機制 |
|------|-----------|--------------|----------|
| **piBlockly** | `BKY_*_MSG_ANGEL` | `BKY_*_MSG_ENGINEER` | `blockMessageStylesMap` 動態對映 |
| **CodeBridge** | 模組 `zh-hant.js`/`en.js` 直接設定 key | `style/engineer.js` 覆寫相同 key | `loader.js` 重新註冊 + `setBlockStyle()` |

**對齊原則**：CodeBridge 的 Engineer 覆寫值必須等同 piBlockly 的 `BKY_*_MSG_ENGINEER` 值。

---

## 2. 積木設計

| 積木類型 | 類型 | 說明 | 產生器 |
|---------|------|------|--------|
| `custom_functions_defnoreturn` | statement | 定義無回傳值函式 | 生成原型 + 定義 (放入 function_prototypes_/function_definitions_) |
| `custom_functions_defreturn` | statement | 定義有回傳值函式 | 生成原型 + 定義 (放入 function_prototypes_/function_definitions_) |
| `custom_functions_return` | statement | 回傳值 | `return value;\n` |
| `custom_functions_callnoreturn_manual` | statement | 呼叫無回傳值函式 | `funcName(args);\n` |
| `custom_functions_callreturn_manual` | value | 呼叫有回傳值函式 | `funcName(args)` |
| `custom_functions_mutatorcontainer` | statement | 函式參數容器 (mutator) | 不生成程式碼 |
| `custom_functions_mutatorarg` | statement | 函式參數項目 (mutator) | 不生成程式碼 |

### 積木結構 (對齊 piBlockly)

**custom_functions_defnoreturn** (多行陳述式)
```
void funcName ( params ) {           ← message0 (TOPROW)
  [STACK]                            ← message1 (STACK)
}                                    ← message2 (BOTTOMROW)
```
- NAME=field_text, PARAMS=auto-generated from arguments_
- 輸出類型: statement
- 使用 mutator (custom_functions_mutatorarg) 動態管理參數
- 包含 mutationToDom/domToMutation 支援存檔

**custom_functions_defreturn** (多行陳述式)
```
returnType funcName ( params ) {     ← message0 (TOPROW)
  [STACK]                            ← message1 (STACK)
}                                    ← message2 (BOTTOMROW)
```
- TYPE=dropdown(int/float/String/bool), NAME=field_text, PARAMS=auto-generated
- 輸出類型: statement
- 使用 mutator 動態管理參數
- 包含 mutationToDom/domToMutation 支援存檔

**custom_functions_return** (單行陳述式)
```
return %1                            ← message0
```
- VALUE=input_value
- 輸出類型: statement
- 包含 onchange 驗證 (只能在函式內使用)

**custom_functions_callnoreturn_manual** (單行陳述式)
```
Call funcName ( args )               ← message0 (TOPROW)
```
- NAME=field_text, ARG0-ARGN=dynamic inputs
- 輸出類型: statement
- 使用 mutator 動態管理參數數量

**custom_functions_callreturn_manual** (單行值)
```
Get Value from funcName ( args )     ← message0 (TOPROW)
```
- NAME=field_text, ARG0-ARGN=dynamic inputs
- 輸出類型: null (任何類型)
- 使用 mutator 動態管理參數數量

**custom_functions_mutatorcontainer** (mutator 專用)
```
Function Inputs                      ← message0
  [STACK]                            ← message1
```
- 只在 mutator 對話框中使用
- contextMenu = false

**custom_functions_mutatorarg** (mutator 專用)
```
Parameter type name                  ← message0
```
- TYPE=dropdown(int/float/String/bool), NAME=field_text
- 只在 mutator 對話框中使用
- contextMenu = false

---

## 3. i18n 對照 (Engineer 對齊 piBlockly)

### Engineer 風格覆寫 (`style/engineer.js`)
| Key | piBlockly Engineer 值 | 說明 |
|-----|----------------------|------|
| `CUSTOM_FUNCTIONS_DEFNORETURN_MSG` | `void %1 (%2) {` | 無回傳函式定義 |
| `CUSTOM_FUNCTIONS_DEFRETURN_MSG` | `%1 %2 (%3) {` | 有回傳函式定義 |
| `CUSTOM_FUNCTIONS_CALLNORETURN_MSG` | `%1()` | 無回傳函式呼叫 |
| `CUSTOM_FUNCTIONS_CALLRETURN_MSG` | `%1()` | 有回傳函式呼叫 |
| `CUSTOM_FUNCTIONS_MUTATORCONTAINER_MSG` | `function inputs` | mutator 容器 |
| `CUSTOM_FUNCTIONS_MUTATORARG_MSG` | `parameter` | mutator 參數 |
| `CUSTOM_FUNCTIONS_RETURN_MSG` | `return %1` | 回傳值 |

### Angel 風格基底 (`modules/functions/zh-hant.js` + `en.js`)
| Key | zh-hant (Angel) | en (Angel) |
|-----|----------------|------------|
| `FUNCTIONS_CATEGORY` | `函式` | `Functions` |
| `FUNCTIONS_HUE` | `#d22f73` | `#d22f73` |
| `FUNCTIONS_CALLNORETURN_TITLE` | `執行函式 ` | `Call ` |
| `FUNCTIONS_CALLRETURN_TITLE` | `從函式取得結果 ` | `Get Value from ` |
| `CUSTOM_FUNCTIONS_DEFNORETURN_MSG` | `建立函式 %1 (%2)` | `do task %1 (%2)` |
| `CUSTOM_FUNCTIONS_DEFRETURN_MSG` | `建立函式 %2 (%3) 並傳回 %1` | `do task %2 (%3) and report back %1` |
| `CUSTOM_FUNCTIONS_CALLNORETURN_MSG` | `執行函式 %1 (%2)` | `do task %1 (%2)` |
| `CUSTOM_FUNCTIONS_CALLRETURN_MSG` | `從函式 %1 (%2)取得結果 ` | `get report from task %1 (%2)` |
| `CUSTOM_FUNCTIONS_MUTATORCONTAINER_MSG` | `函式輸入` | `function inputs` |
| `CUSTOM_FUNCTIONS_MUTATORARG_MSG` | `參數` | `parameter` |
| `CUSTOM_FUNCTIONS_RETURN_MSG` | `傳回 %1` | `report back %1` |
| `FUNCTIONS_DEFNORETURN_TOOLTIP` | `建立一個沒有輸出的函式。` | `Creates a function with no output.` |
| `FUNCTIONS_DEFRETURN_TOOLTIP` | `建立一個有輸出的函式。` | `Creates a function with an output.` |
| `FUNCTIONS_CALLNORETURN_TOOLTIP` | `執行使用者定義的函式。` | `Execute the user-defined function.` |
| `FUNCTIONS_CALLRETURN_TOOLTIP` | `執行使用者定義的函式，並使用其輸出。` | `Execute the user-defined function and use its output.` |
| `FUNCTIONS_IFRETURN_TOOLTIP` | `從函式傳回一個值。` | `Returns a value from a function if a value is true.` |
| `FUNCTIONS_MUTATORARG_TOOLTIP` | `為函式添加一個輸入參數。` | `Add an input to the function.` |
| `FUNCTIONS_RETURN_TOOLTIP` | `從函式傳回一個值。` | `Returns a value from a function.` |

---

## 4. 檔案結構

```
ui/src/lib/blockly/modules/functions/
├── zh-hant.js       # Angel-style i18n (正體中文)
├── en.js            # Angel-style i18n (English)
├── blocks.js        # 5 個公開積木 + 2 個 mutator-only helper 定義
└── generators.js    # 5 個 Arduino 產生器
```

**重要說明**：
- `custom_functions_mutatorcontainer` 和 `custom_functions_mutatorarg` 是 mutator 專用 blocks，不生成程式碼
- 只需要 5 個產生器 (defnoreturn, defreturn, return, callnoreturn_manual, callreturn_manual)

---

## 5. 實作步驟

### Phase 1：建立模組檔案
- [ ] 建立 `modules/functions/zh-hant.js` — Angel 基底訊息（FUNCTIONS_HUE、FUNCTIONS_CATEGORY、7 個積木訊息、7 個 tooltip、2 個 return 警告）
- [ ] 建立 `modules/functions/en.js` — Angel 基底訊息 (英文對應)
- [ ] 建立 `modules/functions/blocks.js` — 5 個公開積木與 2 個 mutator-only helper 定義
  - `custom_functions_defnoreturn`: appendDummyInput(TOPROW: void + NAME + ( + PARAMS + ) {), appendStatementInput(STACK), appendDummyInput(BOTTOMROW: }), mutator
  - `custom_functions_defreturn`: 同 defnoreturn 但加入 TYPE dropdown
  - `custom_functions_return`: appendValueInput(VALUE), previousStatement, onchange 驗證
  - `custom_functions_callnoreturn_manual`: appendDummyInput(TOPROW: Call + NAME), previousStatement/nextStatement, mutator
  - `custom_functions_callreturn_manual`: appendDummyInput(TOPROW: Get Value from + NAME), output, mutator
  - `custom_functions_mutatorcontainer`: appendDummyInput + appendStatementInput(STACK), contextMenu=false
  - `custom_functions_mutatorarg`: appendDummyInput(Parameter + TYPE dropdown + NAME text), contextMenu=false
- [ ] 建立 `modules/functions/generators.js` — 5 個產生器
  - `custom_functions_defnoreturn`: 生成原型 + 定義，放入 function_prototypes_/function_definitions_
  - `custom_functions_defreturn`: 生成原型 + 定義 (包含 returnType)
  - `custom_functions_return`: 生成 `return value;\n`
  - `custom_functions_callnoreturn_manual`: 生成 `funcName(args);\n`
  - `custom_functions_callreturn_manual`: 生成 `funcName(args)`

### Phase 2：更新 Engineer 風格覆寫
- [ ] 更新 `style/engineer.js` — 加入 7 個 Functions 相關 key

### Phase 3：更新載入順序
- [ ] 更新 `index.html` — 在 Logic 模組後、common 之前加入 functions 模組 script 標籤

### Phase 4：更新模組載入器
- [ ] 更新 `loader.js` — 在 `loadLocaleBase()` 和 `setBlockStyle()` 中加入 FUNCTIONS_ZH/FUNCTIONS_EN 訊息註冊

### Phase 5：更新檔案結構
- [ ] 更新 `FILE_STRUCTURE.md` — 加入 functions/ 目錄說明

---

## 6. 技術深挖

### 6.1 Mutator 機制
- Functions 模組使用 Blockly 的 Mutator 機制動態管理函式參數
- `custom_functions_mutatorcontainer` 是容器 block，包含多個 `custom_functions_mutatorarg`
- 透過 `mutationToDom`/`domToMutation` 序列化參數資訊
- 透過 `decompose`/`compose` 開啟 mutator 對話框並重建參數

### 6.2 函式原型與定義分離
- 參考 piBlockly generators/functions.js lines 6-45
- `custom_functions_defnoreturn` 和 `custom_functions_defreturn` 生成兩行程式碼：
  - 原型 (prototype): 放入 `function_prototypes_`
  - 定義 (definition): 放入 `function_definitions_`
- 返回 `null` (因為不直接在呼叫位置生成程式碼)

### 6.3 參數類型處理
- 使用 `block.arguments_` (字串陣列) 儲存參數名稱
- 使用 `block.argTypes_` (字串陣列) 儲存參數類型
- 生成時組合成 `type name` 格式，例如 `int x, float y`
- 透過 mutator 的 `updateShape_` 動態重建參數 inputs

### 6.4 custom_functions_callnoreturn_manual vs custom_functions_callreturn_manual
- 這兩個 blocks 是「手動呼叫」版本，不依賴 Blockly.Procedures 系統
- 與 Blockly 內建的 `procedures_callnoreturn`/`procedures_callreturn` 不同
- 使用 `block.arguments_` 而非自動從定義取得參數
- 適合需要完全控制函式呼叫的場景

### 6.5 custom_functions_return 的驗證機制
- 使用 `setOnChange` 監聽 block 變化
- 檢查是否在函式內 (遍歷 `getSurroundParent()`)
- 檢查直接父積木是否為 `custom_functions_defreturn` 或 `custom_functions_defnoreturn`
- 如果不是在函式內或在 void 函式中使用 → 顯示警告

### 6.6 轉義字元規範
- Generator JS 中的字串不允許實體換行，使用 `\n`
- 函式定義需要 `\n` 結尾因為包含多行程式碼
- `custom_functions_return` 需要 `\n` 結尾

### 6.7 ID 標記與程式碼定位
- CodeBridge 的 `scrub_` 會自動在每行程式碼行尾插入 `// __BLOCKLY_ID:xxx__`
- functions 積木不需要手動添加 ID 標記 (value/statement 積木由 scrub_ 處理)
- `custom_functions_defnoreturn` 和 `custom_functions_defreturn` 已列入 `scopeDefiningRootBlocks`，可作為根層級函式定義

### 6.8 孤兒積木檢測
- `custom_functions_defnoreturn`、`custom_functions_defreturn` 是根層級定義積木，不需 statement 連接
- `custom_functions_return`、`custom_functions_callnoreturn_manual` 若放在根層級會被標記為 disabled（孤兒積木），必須位於函式本體、setup 或 loop 內
- `custom_functions_callreturn_manual` 是 value 積木，不會有根層級孤兒問題

---

## 7. 驗證計畫
- [ ] toolbox 分類名稱正確顯示 (函式 / Functions)
- [ ] 5 個公開積木可從 toolbox 拖入工作區，2 個 helper 僅由 mutator 使用
- [ ] custom_functions_defnoreturn 可正常定義無回傳函式
- [ ] custom_functions_defreturn 可正常定義有回傳函式 (int/float/String/bool)
- [ ] custom_functions_return 可正常生成 return 程式碼
- [ ] custom_functions_callnoreturn_manual 可正常呼叫無回傳函式
- [ ] custom_functions_callreturn_manual 可正常呼叫有回傳函式
- [ ] mutator 可正常新增/刪除參數
- [ ] 函式原型與定義正確分離 (function_prototypes_/function_definitions_)
- [ ] custom_functions_return 的驗證機制正常 (只能在函式內使用)
- [ ] 風格切換後分類名稱與積木文字正常
- [ ] 孤兒積木檢測正常（函式定義可放根層級，return 與 statement 呼叫須置於合法容器）

---

## 8. 修改檔案清單
| 檔案 | 操作 |
|------|------|
| `ui/src/lib/blockly/modules/functions/zh-hant.js` | **新增** |
| `ui/src/lib/blockly/modules/functions/en.js` | **新增** |
| `ui/src/lib/blockly/modules/functions/blocks.js` | **新增** |
| `ui/src/lib/blockly/modules/functions/generators.js` | **新增** |
| `ui/src/lib/blockly/style/engineer.js` | **修改** (加入 7 個 Functions key) |
| `ui/index.html` | **修改** (加入 functions script 標籤) |
| `ui/src/lib/blockly/loader.js` | **修改** (加入 FUNCTIONS_ZH/FUNCTIONS_EN 註冊) |
| `FILE_STRUCTURE.md` | **修改** (加入 functions/ 說明) |

---

## 9. 與其他模組的差異

| 項目 | Functions 模組 | Array 模組 | Math 模組 |
|------|---------------|-----------|----------|
| 積木數量 | 5 個公開積木 + 2 個 mutator-only helper | 5 個 | 7 個 |
| Blockly 內建 blocks | 0 個 | 0 個 | 3 個 |
| Mutator 機制 | 有 (複雜) | 無 | 無 |
| 特殊處理 | mutationToDom/domToMutation, decompose/compose | global_vars_ 去重 | 三角函數轉換 |
| 根層級可放置 | 2 個函式定義 | 1 個全域陣列宣告 | 視各 statement 契約而定 |
| Engineer 覆寫 key 數量 | 7 個 | 7 個 | 6 個 |

**關鍵挑戰**：
1. **Mutator 機制**：需要實作完整的 mutationToDom/domToMutation/decompose/compose 生命週期
2. **函式原型與定義分離**：使用 CodeBridge 的程式碼籃子架構 (function_prototypes_/function_definitions_)
3. **參數動態管理**：透過 mutator 動態新增／刪除參數；manual call 依自身 mutation 產生參數，不依賴 Procedures 自動同步
4. **驗證機制**：custom_functions_return 驗證直接父積木是否為函式定義