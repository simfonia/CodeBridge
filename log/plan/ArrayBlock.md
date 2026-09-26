# CodeBridge Array 模組移植計畫 (Engineer 風格對齊 piBlockly)

## 1. 背景

將 piBlockly 的 Array 模組移植到 CodeBridge，建立 `modules/array/`。Engineer 風格的積木文字與產生器必須對齊 piBlockly 的實作。

### 參考資訊
- **piBlockly blocks**: `C:/Workspace/piblockly/media/blocks/array.js` (5 個自訂積木)
- **piBlockly generators**: `C:/Workspace/piblockly/media/generators/array.js` (5 個產生器)
- **piBlockly i18n**: `C:/Workspace/piblockly/media/zh-hant.js` + `en.js` (Engineer/Angel 對應表)
- **CodeBridge 已完成模式**: Arduino / Coding / Logic / Loops / Math 模組

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
| `array_declare_global` | statement | 宣告全域陣列 | `type varName[size];` (加入 global_vars_) |
| `array_declare_local` | statement | 宣告區域陣列 | `type varName[size];` |
| `array_get` | value | 取得陣列元素 | `varName[index]` |
| `array_set` | statement | 設定陣列元素 | `varName[index] = value;\n` |
| `array_length` | value | 取得陣列長度 | `sizeof(varName) / sizeof(varName[0])` |

### 積木結構 (對齊 piBlockly)

**array_declare_global** (多行陳述式)
```
Global Array type varName [ size ]    ← message0
```
- type=dropdown(int/float/String/bool), varName=field_text, size=input_value(Number)
- 輸出類型: statement
- 使用 imperative style (appendDummyInput + appendValueInput)

**array_declare_local** (多行陳述式)
```
Local Array type varName [ size ]     ← message0
```
- type=dropdown(int/float/String/bool), varName=field_text, size=input_value(Number)
- 輸出類型: statement
- 使用 imperative style

**array_get** (單行輸出)
```
varName [ index ]                      ← message0
```
- varName=field_text, index=input_value(Number)
- 輸出類型: null (任何類型)
- 使用 imperative style

**array_set** (單行陳述式)
```
varName [ index ] = value             ← message0
```
- varName=field_text, index=input_value(Number), value=input_value(null)
- 輸出類型: statement
- 使用 imperative style

**array_length** (單行輸出)
```
length of Array varName               ← message0
```
- varName=field_text
- 輸出類型: Number
- 使用 imperative style

---

## 3. i18n 對照 (Engineer 對齊 piBlockly)

### Engineer 風格覆寫 (`style/engineer.js`)
| Key | piBlockly Engineer 值 | 說明 |
|-----|----------------------|------|
| `ARRAY_DECLARE_GLOBAL_TITLE` | `Global Array` | 全域陣列標題 |
| `ARRAY_DECLARE_LOCAL_TITLE` | `Local Array` | 區域陣列標題 |
| `ARRAY_GET_BRACKET_OPEN` | `[` | 陣列取得左括號 |
| `ARRAY_GET_BRACKET_CLOSE` | `]` | 陣列取得右括號 |
| `ARRAY_SET_BRACKET_OPEN` | `[` | 陣列設定左括號 |
| `ARRAY_SET_BRACKET_CLOSE_EQUALS` | `] = ` | 陣列設定右括號等號 |
| `ARRAY_LENGTH_TITLE` | `length of Array` | 陣列長度標題 |

### Angel 風格基底 (`modules/array/zh-hant.js` + `en.js`)
| Key | zh-hant (Angel) | en (Angel) |
|-----|----------------|------------|
| `ARRAY_CATEGORY` | `陣列` | `Array` |
| `ARRAY_HUE` | `#d1972b` | `#d1972b` |
| `ARRAY_DECLARE_GLOBAL_TITLE` | `建立全域陣列` | `Create Global Array` |
| `ARRAY_DECLARE_LOCAL_TITLE` | `建立區域陣列` | `Create Local Array` |
| `ARRAY_GET_BRACKET_OPEN` | `項目 #` | `item #` |
| `ARRAY_GET_BRACKET_CLOSE` | `` (空) | `` (空) |
| `ARRAY_SET_BRACKET_OPEN` | `項目 #` | `item #` |
| `ARRAY_SET_BRACKET_CLOSE_EQUALS` | ` 設為 ` | ` to ` |
| `ARRAY_LENGTH_TITLE` | `陣列長度` | `length of Array` |
| `ARRAY_DECLARE_GLOBAL_TOOLTIP` | `宣告一個指定類型和大小的全域陣列。` | `Declares a global array of a specified type and size.` |
| `ARRAY_DECLARE_LOCAL_TOOLTIP` | `宣告一個指定類型和大小的區域陣列。` | `Declares a local array of a specified type and size.` |
| `ARRAY_GET_TOOLTIP` | `從陣列中獲取指定索引的元素。` | `Gets an element from an array at a specified index.` |
| `ARRAY_SET_TOOLTIP` | `設定陣列中指定索引的元素值。` | `Sets the value of an element in an array at a specified index.` |
| `ARRAY_LENGTH_TOOLTIP` | `獲取陣列的元素數量。` | `Gets the number of elements in an array.` |

---

## 4. 檔案結構

```
ui/src/lib/blockly/modules/array/
├── zh-hant.js       # Angel-style i18n (正體中文)
├── en.js            # Angel-style i18n (English)
├── blocks.js        # 5 個自訂積木定義
└── generators.js    # 5 個 Arduino 產生器
```

---

## 5. 實作步驟

### Phase 1：建立模組檔案
- [ ] 建立 `modules/array/zh-hant.js` — Angel 基底訊息 (ARRAY_HUE, ARRAY_CATEGORY, 7 個 key + 5 個 tooltip)
- [ ] 建立 `modules/array/en.js` — Angel 基底訊息 (英文對應)
- [ ] 建立 `modules/array/blocks.js` — 5 個自訂積木定義
  - `array_declare_global`: appendDummyInput (title + TYPE dropdown + VAR text + [), appendValueInput(SIZE), appendDummyInput(]), previousStatement/nextStatement
  - `array_declare_local`: 同 global 結構
  - `array_get`: appendDummyInput (VAR text + [), appendValueInput(INDEX), appendDummyInput(]), output: null
  - `array_set`: appendDummyInput (VAR text + [), appendValueInput(INDEX), appendDummyInput(] = ), appendValueInput(VALUE), previousStatement/nextStatement
  - `array_length`: appendDummyInput (title + VAR text), output: Number
- [ ] 建立 `modules/array/generators.js` — 5 個產生器
  - `array_declare_global`: 生成 `type varName[size];` 並加入 `global_vars_`
  - `array_declare_local`: 生成 `type varName[size];\n`
  - `array_get`: 生成 `varName[index]`
  - `array_set`: 生成 `varName[index] = value;\n`
  - `array_length`: 生成 `sizeof(varName) / sizeof(varName[0])`

### Phase 2：更新 Engineer 風格覆寫
- [ ] 更新 `style/engineer.js` — 加入 7 個 Array 相關 key

### Phase 3：更新載入順序
- [ ] 更新 `index.html` — 在 Logic 模組後、common 之前加入 array 模組 script 標籤

### Phase 4：更新模組載入器
- [ ] 更新 `loader.js` — 在 `loadLocaleBase()` 和 `setBlockStyle()` 中加入 ARRAY_ZH/ARRAY_EN 訊息註冊

### Phase 5：更新檔案結構
- [ ] 更新 `FILE_STRUCTURE.md` — 加入 array/ 目錄說明

---

## 6. 技術深挖

### 6.1 Imperative style vs jsonInit
- Array 積木使用 imperative style (appendDummyInput/appendValueInput) 而非 jsonInit
- 原因：piBlockly 註解說明 "due to jsonInit issues with FieldTextInput and shadow DOM"
- 特別注意 `array_get` 和 `array_set` 的 varName 使用 `new Blockly.FieldTextInput('myArray')`

### 6.2 array_declare_global 的 global_vars_ 處理
- 參考 piBlockly generators/array.js lines 6-13
- 使用 `Blockly.Arduino.global_vars_['array_declare_global_' + varName]` 儲存
- 返回空字串 `''` (因為已經放到 global_vars_)
- 這確保全域陣列宣告只會出現一次

### 6.3 array_length 的 sizeof 計算
- 使用 `sizeof(varName) / sizeof(varName[0])` 計算陣列元素數量
- 這是 C/C++ 標準做法，編譯器會自動計算
- 回傳類型為 Number

### 6.4 變數名稱處理
- `array_get`, `array_set`, `array_length` 使用 `block.getFieldValue('VAR')` 取得變數名稱
- 這與 variables_get 不同，variables_get 使用 `variableDB_.getName()`
- 因為 Array 積木使用 field_text 而非 field_variable

### 6.5 轉義字元規範
- Generator JS 中的字串不允許實體換行，使用 `\n`
- `array_declare_local` 和 `array_set` 需要 `\n` 結尾因為它們是 statement

### 6.6 ID 標記與程式碼定位
- CodeBridge 的 `scrub_` 會自動在每行程式碼行尾插入 `// __BLOCKLY_ID:xxx__`
- array 積木不需要手動添加 ID 標記 (value/statement 積木由 scrub_ 處理)
- `array_declare_global` 已列入 `scopeDefiningRootBlocks`，可作為根層級全域宣告
- `array_declare_local` 是 statement 積木，必須放在 `initializes_setup` 或 `initializes_loop` 內

### 6.7 孤兒積木檢測
- `array_declare_global` 可放在根層級；`array_declare_local`、`array_set` 若放在根層級會被標記為 disabled（孤兒積木）
- 區域陣列宣告與設定的正確使用方式是放在 `initializes_setup` 或 `initializes_loop` 內
- `array_get`, `array_length` 是 value 積木，不會有孤兒問題

---

## 7. 驗證計畫
- [ ] toolbox 分類名稱正確顯示 (陣列 / Array)
- [ ] 所有 5 個積木可拖入工作區
- [ ] array_declare_global 可正常宣告全域陣列 (int/float/String/bool)
- [ ] array_declare_local 可正常宣告區域陣列
- [ ] array_get 可正常取得陣列元素
- [ ] array_set 可正常設定陣列元素
- [ ] array_length 可正常計算陣列長度
- [ ] 全域陣列只會宣告一次 (global_vars_ 去重)
- [ ] 風格切換後分類名稱與積木文字正常
- [ ] 孤兒積木檢測正常（全域宣告可放根層級，區域宣告與設定須位於 setup/loop 內）

---

## 8. 修改檔案清單
| 檔案 | 操作 |
|------|------|
| `ui/src/lib/blockly/modules/array/zh-hant.js` | **新增** |
| `ui/src/lib/blockly/modules/array/en.js` | **新增** |
| `ui/src/lib/blockly/modules/array/blocks.js` | **新增** |
| `ui/src/lib/blockly/modules/array/generators.js` | **新增** |
| `ui/src/lib/blockly/style/engineer.js` | **修改** (加入 7 個 Array key) |
| `ui/index.html` | **修改** (加入 array script 標籤) |
| `ui/src/lib/blockly/loader.js` | **修改** (加入 ARRAY_ZH/ARRAY_EN 註冊) |
| `FILE_STRUCTURE.md` | **修改** (加入 array/ 說明) |

---

## 9. 與其他模組的差異

| 項目 | Array 模組 | Math 模組 | Loops 模組 |
|------|-----------|----------|-----------|
| 積木數量 | 5 個 | 7 個 | 3 個 |
| Blockly 內建 blocks | 0 個 | 3 個 | 0 個 |
| Imperative style | 5 個 (全部) | 0 個 | 0 個 |
| jsonInit | 0 個 | 4 個 | 3 個 |
| 特殊處理 | global_vars_ 去重 | 三角函數轉換 | onchange/updateLabels |
| 孤兒積木 | 3 個 (declare_global, declare_local, set) | 1 個 (random_seed) | 3 個 (while, for, flow) |

**關鍵挑戰**：
1. **Imperative style**：所有 Array 積木都使用 imperative style，需要手動管理 inputs
2. **global_vars_ 去重**：array_declare_global 必須確保同名陣列只會宣告一次
3. **FieldTextInput vs field_variable**：Array 積木使用 field_text 儲存變數名稱，而非 Blockly 的變數系統