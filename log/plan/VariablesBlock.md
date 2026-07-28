# CodeBridge Variables 模組移植計畫 (Engineer 風格對齊 piBlockly)

## 1. 背景

將 piBlockly 的 Variables 模組移植到 CodeBridge，建立 `modules/variables/`。Engineer 風格的積木文字與產生器必須對齊 piBlockly 的實作。

### 參考資訊
- **piBlockly blocks**: `C:/Workspace/piblockly/media/blocks/variables.js` (4 個自訂積木)
- **piBlockly generators**: `C:/Workspace/piblockly/media/generators/variables.js` (4 個產生器)
- **piBlockly i18n**: `C:/Workspace/piblockly/media/zh-hant.js` + `en.js` (Engineer/Angel 對應表)
- **CodeBridge 已完成模式**: Arduino / Coding / Logic / Loops / Math / Array / Functions / Text 模組
- **Blockly 內建 blocks**: `variables_get`, `variables_set` (Blockly 核心提供，但需要自訂 generators)

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
| `variables_declare_global` | statement | 宣告全域變數 | `type varName = value;` (加入 global_vars_) |
| `variables_declare_local` | statement | 宣告區域變數 | `type varName = value;\n` |
| `variables_get` | value | 取得變數值 | `varName` |
| `variables_set` | statement | 設定變數值 | `varName = value;\n` |

### 積木結構 (對齊 piBlockly)

**variables_declare_global** (單行陳述式)
```
Global %1 %2 = %3              ← message0 (Engineer: "Global %1 %2 = %3" / Angel: "建立全域變數 %2 型別為 %1 初始值為 %3")
```
- %1=TYPE(dropdown: int/float/String/bool), %2=VAR(field_variable), %3=VALUE(input_value)
- 輸出類型: statement
- 使用 jsonInit

**variables_declare_local** (單行陳述式)
```
Local %1 %2 = %3               ← message0 (Engineer: "Local %1 %2 = %3" / Angel: "建立區域變數 %2 型別為 %1 初始值為 %3")
```
- %1=TYPE(dropdown: int/float/String/bool), %2=VAR(field_variable), %3=VALUE(input_value)
- 輸出類型: statement
- 使用 jsonInit

**variables_get** (單行輸出)
```
%1                             ← message0 (Engineer/Angel: "%1")
```
- %1=VAR(field_variable)
- 輸出類型: null (任何類型)
- 使用 jsonInit
- 包含 contextMenu (建立對應的 variables_set)

**variables_set** (單行陳述式)
```
%1 = %2                        ← message0 (Engineer: "%1 = %2" / Angel: "設定 %1 為 %2")
```
- %1=VAR(field_variable), %2=VALUE(input_value)
- 輸出類型: statement
- 使用 jsonInit
- 包含 contextMenu (建立對應的 variables_get)

---

## 3. i18n 對照 (Engineer 對齊 piBlockly)

### Engineer 風格覆寫 (`style/engineer.js`)
| Key | piBlockly Engineer 值 | 說明 |
|-----|----------------------|------|
| `VARIABLES_DECLARE_GLOBAL_MESSAGE` | `Global %1 %2 = %3` | 全域變數宣告 |
| `VARIABLES_DECLARE_LOCAL_MESSAGE` | `Local %1 %2 = %3` | 區域變數宣告 |
| `VARIABLES_SET_MESSAGE` | `%1 = %2` | 變數設定 |

**注意**：`variables_get` 的 Engineer 文字由 Blockly 核心控制 (就是變數名稱本身)，CodeBridge 不需要覆寫。

### Angel 風格基底 (`modules/variables/zh-hant.js` + `en.js`)
| Key | zh-hant (Angel) | en (Angel) |
|-----|----------------|------------|
| `VARIABLES_CATEGORY` | `變數` | `Variables` |
| `VARIABLES_HUE` | `#ef9a9a` | `#ef9a9a` |
| `VARIABLES_DEFAULT_NAME` | `var` | `var` |
| `VARIABLES_DECLARE_GLOBAL_MESSAGE` | `建立全域變數 %2 型別為 %1 初始值為 %3` | `create global variable %2 of type %1 with value %3` |
| `VARIABLES_DECLARE_LOCAL_MESSAGE` | `建立區域變數 %2 型別為 %1 初始值為 %3` | `create local variable %2 of type %1 with value %3` |
| `VARIABLES_SET_MESSAGE` | `設定 %1 為 %2` | `set %1 to %2` |
| `VARIABLES_DECLARE_GLOBAL_TOOLTIP` | `宣告一個全域變數。` | `Declares a global variable.` |
| `VARIABLES_DECLARE_LOCAL_TOOLTIP` | `宣告一個區域變數。` | `Declares a local variable.` |
| `VARIABLES_GET_TOOLTIP` | `傳回此變數的值。` | `Returns the value of this variable.` |
| `VARIABLES_SET_TOOLTIP` | `將此變數設定為等於輸入值。` | `Sets this variable to be equal to the input value.` |

---

## 4. 檔案結構

```
ui/src/lib/blockly/modules/variables/
├── zh-hant.js       # Angel-style i18n (繁體中文)
├── en.js            # Angel-style i18n (English)
├── blocks.js        # 4 個自訂積木定義 (包含 2 個 Blockly 內建 blocks 覆寫)
└── generators.js    # 4 個 Arduino 產生器
```

**重要說明**：
- `variables_get` 和 `variables_set` 是 Blockly 內建 blocks，不需要在 `blocks.js` 中定義
- 但需要在 `generators.js` 中註冊這兩個 blocks 的 Arduino 產生器
- `variables_declare_global` 和 `variables_declare_local` 是自訂 blocks，需要在 `blocks.js` 和 `generators.js` 中都定義

---

## 5. 實作步驟

### Phase 1：建立模組檔案
- [ ] 建立 `modules/variables/zh-hant.js` — Angel 基底訊息 (VARIABLES_HUE, VARIABLES_CATEGORY, VARIABLES_DEFAULT_NAME, 3 個 message + 4 個 tooltip)
- [ ] 建立 `modules/variables/en.js` — Angel 基底訊息 (英文對應)
- [ ] 建立 `modules/variables/blocks.js` — 2 個自訂積木定義
  - `variables_declare_global`: message0, TYPE dropdown, VAR field_variable, VALUE input_value, previousStatement/nextStatement
  - `variables_declare_local`: message0, TYPE dropdown, VAR field_variable, VALUE input_value, previousStatement/nextStatement
- [ ] 建立 `modules/variables/generators.js` — 4 個產生器
  - `variables_declare_global`: 生成 `type varName = value;` 並加入 `global_vars_` (使用 processDefinitionStack)
  - `variables_declare_local`: 生成 `type varName = value;\n` (處理 type 和 default value)
  - `variables_get`: 使用 `variableDB_.getName()` 取得變數名稱
  - `variables_set`: 使用 `variableDB_.getName()` 和 `valueToCode` 生成 `varName = value;\n`

### Phase 2：更新 Engineer 風格覆寫
- [ ] 更新 `style/engineer.js` — 加入 3 個 Variables 相關 key (VARIABLES_DECLARE_GLOBAL_MESSAGE, VARIABLES_DECLARE_LOCAL_MESSAGE, VARIABLES_SET_MESSAGE)

### Phase 3：更新載入順序
- [ ] 更新 `index.html` — 在 Logic 模組後、common 之前加入 variables 模組 script 標籤

### Phase 4：更新模組載入器
- [ ] 更新 `loader.js` — 在 `loadLocaleBase()` 和 `setBlockStyle()` 中加入 VARIABLES_ZH/VARIABLES_EN 訊息註冊

### Phase 5：更新檔案結構
- [ ] 更新 `FILE_STRUCTURE.md` — 加入 variables/ 目錄說明

---

## 6. 技術深挖

### 6.1 variables_declare_global 的 global_vars_ 處理
- 參考 piBlockly generators/variables.js line 7
- 使用 `processDefinitionStack` 函數 (定義在 `_lib.js` 中)
- 這個函數會自動處理 global_vars_ 的去重
- 返回 `null` (因為已經放到 global_vars_)

### 6.2 variables_declare_local 的類型預設值處理
- 參考 piBlockly generators/variables.js lines 9-27
- 根據 TYPE 設定預設值：
  - `int` → `0`
  - `float` → `0`
  - `String` → `""`
  - `bool` → `false`
- 如果使用者有提供 VALUE → 使用 VALUE，否則使用預設值

### 6.3 variables_get 的變數名稱處理
- 使用 `Blockly.Arduino.variableDB_.getName()` 取得變數名稱
- 這是 Blockly 的變數系統，確保變數名稱唯一性
- 與 Array 積木不同 (Array 使用 field_text 直接儲存名稱)

### 6.4 variables_set 的賦值處理
- 使用 `Blockly.Arduino.variableDB_.getName()` 取得變數名稱
- 使用 `valueToCode` 取得 VALUE 的程式碼
- 使用 `ORDER_ASSIGNMENT` 優先順序確保正確的括號處理
- 生成 `varName = value;\n`

### 6.5 contextMenu 功能
- `variables_get` 包含 `contextMenuMsg_` 和 `contextMenuType_`
- 右鍵選單可以「建立對應的 variables_set」
- `variables_set` 包含反向的 contextMenu
- 這是 Blockly 內建功能，piBlockly 保留了這個機制

### 6.6 轉義字元規範
- Generator JS 中的字串不允許實體換行，使用 `\n`
- `variables_declare_local` 和 `variables_set` 需要 `\n` 結尾因為它們是 statement

### 6.7 ID 標記與程式碼定位
- CodeBridge 的 `scrub_` 會自動在每行程式碼行尾插入 `// __BLOCKLY_ID:xxx__`
- variables 積木不需要手動添加 ID 標記 (value/statement 積木由 scrub_ 處理)
- `variables_declare_global` 和 `variables_declare_local` 不在 `scopeDefiningRootBlocks` 中 (不能放在頂層)

### 6.8 孤兒積木檢測
- `variables_declare_global`, `variables_declare_local`, `variables_set` 是 statement 積木
- 如果放在頂層 → 會被標記為 disabled (孤兒積木)
- 正確使用方式：放在 `initializes_setup` 或 `initializes_loop` 內
- `variables_get` 是 value 積木，不會有孤兒問題

---

## 7. 驗證計畫
- [ ] toolbox 分類名稱正確顯示 (變數 / Variables)
- [ ] 所有 4 個積木可拖入工作區 (2 個自訂 + 2 個 Blockly 內建)
- [ ] variables_declare_global 可正常宣告全域變數 (int/float/String/bool)
- [ ] variables_declare_local 可正常宣告區域變數 (包含預設值處理)
- [ ] variables_get 可正常取得變數值
- [ ] variables_set 可正常設定變數值
- [ ] 全域變數只會宣告一次 (global_vars_ 去重)
- [ ] contextMenu 功能正常 (右鍵可建立對應的 get/set)
- [ ] 風格切換後分類名稱與積木文字正常
- [ ] 孤兒積木檢測正常 (declare/set 不能放在頂層)

---

## 8. 修改檔案清單
| 檔案 | 操作 |
|------|------|
| `ui/src/lib/blockly/modules/variables/zh-hant.js` | **新增** |
| `ui/src/lib/blockly/modules/variables/en.js` | **新增** |
| `ui/src/lib/blockly/modules/variables/blocks.js` | **新增** |
| `ui/src/lib/blockly/modules/variables/generators.js` | **新增** |
| `ui/src/lib/blockly/style/engineer.js` | **修改** (加入 3 個 Variables key) |
| `ui/index.html` | **修改** (加入 variables script 標籤) |
| `ui/src/lib/blockly/loader.js` | **修改** (加入 VARIABLES_ZH/VARIABLES_EN 註冊) |
| `FILE_STRUCTURE.md` | **修改** (加入 variables/ 說明) |

---

## 9. 與其他模組的差異

| 項目 | Variables 模組 | Text 模組 | Array 模組 |
|------|---------------|----------|-----------|
| 積木數量 | 4 個 (2 個自訂 + 2 個內建) | 4 個 (2 個自訂 + 2 個內建) | 5 個 |
| Blockly 內建 blocks | 2 個 (get, set) | 2 個 (text, text_join) | 0 個 |
| 變數系統 | 使用 Blockly variableDB | 使用 variableDB (text_append) | 使用 field_text |
| 特殊處理 | global_vars_ 去重, 類型預設值 | String() 轉換, quote_() | FieldTextInput |
| contextMenu | 有 (get ↔ set) | 無 | 無 |
| 孤兒積木 | 3 個 (declare_global, declare_local, set) | 1 個 (text_append) | 3 個 (declare_global, declare_local, set) |

**關鍵挑戰**：
1. **Blockly 變數系統整合**：使用 `variableDB_.getName()` 與 Blockly 的變數系統整合
2. **global_vars_ 去重**：variables_declare_global 使用 `processDefinitionStack` 確保只宣告一次
3. **類型預設值處理**：variables_declare_local 需要根據類型提供正確的預設值
4. **contextMenu 功能**：保留 Blockly 內建的右鍵選單功能 (建立對應的 get/set)

---

## 10. 完整移植總結

### 10.1 所有待移植模組總覽

| 模組 | 積木數量 | Blockly 內建 | 特殊處理 | 孤兒積木 | Engineer Key 數 |
|------|---------|-------------|---------|---------|----------------|
| **Loops** | 3 個 | 0 個 | onchange/updateLabels | 3 個 | 3 個 |
| **Math** | 7 個 | 3 個 | 三角函數轉換 | 1 個 | 6 個 |
| **Array** | 5 個 | 0 個 | global_vars_ 去重 | 3 個 | 7 個 |
| **Functions** | 7 個 | 0 個 | Mutator 機制 | 4 個 | 7 個 |
| **Text** | 4 個 | 2 個 | String() 轉換 | 1 個 | 3 個 |
| **Variables** | 4 個 | 2 個 | 變數系統整合 | 3 個 | 3 個 |
| **總計** | **30 個** | **7 個** | - | **15 個** | **29 個** |

### 10.2 移植優先順序建議

**第一階段 (基礎模組)**：
1. Variables (變數系統基礎)
2. Math (數學運算基礎)

**第二階段 (結構模組)**：
3. Text (文字處理)
4. Array (陣列處理)

**第三階段 (進階模組)**：
5. Loops (迴圈控制)
6. Functions (函式定義與呼叫)

### 10.3 共同技術重點

1. **雙風格機制**：所有模組都需要 Angel 基底 + Engineer 覆寫
2. **程式碼籃子**：使用 global_vars_, function_prototypes_, function_definitions_ 等
3. **孤兒積木檢測**：statement 積木不能放在頂層
4. **轉義字元規範**：嚴格遵守三層字串意識
5. **載入順序**：模組載入 → i18n 註冊 → Engineer 覆寫 → 風格切換

### 10.4 風險與注意事項

1. **Blockly 版本相容性**：內建 blocks 的 generator 覆寫可能因 Blockly 版本更新而失效
2. **Mutator 複雜度**：Functions 模組的 mutator 機制最為複雜，需要完整測試
3. **變數名稱衝突**：Array 使用 field_text，Variables 使用 field_variable，需注意差異
4. **global_vars_ 去重**：Array 和 Variables 的 declare_global 都需要去重機制
5. **類型安全**：Arduino C++ 是強型別語言，需要正確處理類型轉換