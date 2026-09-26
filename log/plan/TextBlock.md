# CodeBridge Text 模組移植計畫 (Engineer 風格對齊 piBlockly)

## 1. 背景

將 piBlockly 的 Text 模組移植到 CodeBridge，建立 `modules/text/`。Engineer 風格的積木文字與產生器必須對齊 piBlockly 的實作。

### 參考資訊
- **piBlockly blocks**: `C:/Workspace/piblockly/media/blocks/text.js` (2 個自訂積木)
- **piBlockly generators**: `C:/Workspace/piblockly/media/generators/text.js` (4 個產生器，包含 2 個 Blockly 內建 blocks)
- **piBlockly i18n**: `C:/Workspace/piblockly/media/zh-hant.js` + `en.js` (Engineer/Angel 對應表)
- **CodeBridge 已完成模式**: Arduino / Coding / Logic / Loops / Math / Array / Functions 模組
- **Blockly 內建 blocks**: `text` (文字常值)

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
| `text` | value | 文字常值 | 直接輸出 quoted string |
| `text_join` | value | 組合多個元素為文字 | `String(a) + String(b) + ...` |
| `text_append` | statement | 附加文字到變數 | `varName += text;\n` |
| `text_length` | value | 取得文字長度 | `value.length()` |

### 積木結構 (對齊 piBlockly)

**text** (單行輸出，Blockly 內建)
```
%1                    ← message0 (文字輸入欄位)
```
- 輸出類型: String
- 使用 Blockly 內建 block，但需要自訂 generator

**text_join** (單行輸出)
```
join                    ← message0 (Engineer) / 組合文字 (Angel)
  [ADD0]                ← 動態輸入 (0-N 個)
  [ADD1]
  ...
```
- ADD0-ADDN=input_value (可接受任何類型)
- 輸出類型: String
- 使用 Blockly 內建 block，但需要自訂 generator
- 動態輸入數量 (itemCount_)

**text_append** (單行陳述式)
```
%1 += %2                ← message0 (Engineer: "%1 += %2" / Angel: "將文字 %2 加到 %1 後面")
```
- %1=VAR(field_variable), %2=TEXT(input_value, check: String/Number)
- 輸出類型: statement
- 使用 jsonInit

**text_length** (單行輸出)
```
%1.length()             ← message0 (Engineer: "%1.length()" / Angel: "文字 %1 的長度")
```
- %1=VALUE(input_value, check: String/Array)
- 輸出類型: Number
- 使用 jsonInit

---

## 3. i18n 對照 (Engineer 對齊 piBlockly)

### Engineer 風格覆寫 (`style/engineer.js`)
| Key | piBlockly Engineer 值 | 說明 |
|-----|----------------------|------|
| `TEXT_APPEND_MESSAGE` | `%1 += %2` | 附加文字積木 |
| `TEXT_JOIN_MESSAGE` | `join` | 組合文字積木 |
| `TEXT_LENGTH_MESSAGE` | `%1.length()` | 文字長度積木 |

**注意**：`text` (文字常值) 是 Blockly 內建 block，其 Engineer 文字由 Blockly 核心控制，CodeBridge 不需要覆寫。

### Angel 風格基底 (`modules/text/zh-hant.js` + `en.js`)
| Key | zh-hant (Angel) | en (Angel) |
|-----|----------------|------------|
| `TEXT_CATEGORY` | `文字` | `Text` |
| `TEXT_HUE` | `#6a8871` | `#6a8871` |
| `TEXT_APPEND_MESSAGE` | `將文字 %2 加到 %1 後面` | `to %1 append text %2` |
| `TEXT_JOIN_MESSAGE` | `組合文字` | `join text` |
| `TEXT_LENGTH_MESSAGE` | `文字 %1 的長度` | `length of %1` |
| `TEXT_TEXT_TOOLTIP` | `一個字母、單字或一行文字。` | `A letter, word, or line of text.` |
| `TEXT_JOIN_TOOLTIP` | `透過連接任意數量的項目來建立一段文字。` | `Create a piece of text by joining any number of items.` |
| `TEXT_APPEND_TOOLTIP` | `將一些文字附加到變數。` | `Append some text to a variable.` |
| `TEXT_LENGTH_TOOLTIP` | `傳回所提供文字中的字元數（包含空格）。` | `Returns the number of characters (including spaces) in the provided text.` |

---

## 4. 檔案結構

```
ui/src/lib/blockly/modules/text/
├── zh-hant.js       # Angel-style i18n (正體中文)
├── en.js            # Angel-style i18n (English)
├── blocks.js        # 2 個自訂積木定義 (text_append, text_length)
└── generators.js    # 4 個 Arduino 產生器 (包含 2 個 Blockly 內建 blocks 覆寫)
```

**重要說明**：
- `text` (文字常值) 和 `text_join` 是 Blockly 內建 blocks，不需要在 `blocks.js` 中定義
- 但需要在 `generators.js` 中註冊這兩個 blocks 的 Arduino 產生器
- `text_append` 和 `text_length` 是自訂 blocks，需要在 `blocks.js` 和 `generators.js` 中都定義

---

## 5. 實作步驟

### Phase 1：建立模組檔案
- [ ] 建立 `modules/text/zh-hant.js` — Angel 基底訊息 (TEXT_HUE, TEXT_CATEGORY, 3 個 message + 4 個 tooltip)
- [ ] 建立 `modules/text/en.js` — Angel 基底訊息 (英文對應)
- [ ] 建立 `modules/text/blocks.js` — 2 個自訂積木定義
  - `text_append`: message0, field_variable(VAR), input_value(TEXT, check: String/Number), previousStatement/nextStatement
  - `text_length`: message0, input_value(VALUE, check: String/Array), output: Number
- [ ] 建立 `modules/text/generators.js` — 4 個產生器
  - `text`: 使用 `Blockly.Arduino.quote_()` 輸出 quoted string
  - `text_join`: 處理 0-N 個元素，使用 `String()` 轉換並用 ` + ` 連接
  - `text_append`: 使用 `variableDB_.getName()` 取得變數名稱，生成 `varName += text;\n`
  - `text_length`: 生成 `value.length()`

### Phase 2：更新 Engineer 風格覆寫
- [ ] 更新 `style/engineer.js` — 加入 3 個 Text 相關 key (TEXT_APPEND_MESSAGE, TEXT_JOIN_MESSAGE, TEXT_LENGTH_MESSAGE)

### Phase 3：更新載入順序
- [ ] 更新 `index.html` — 在 Logic 模組後、common 之前加入 text 模組 script 標籤

### Phase 4：更新模組載入器
- [ ] 更新 `loader.js` — 在 `loadLocaleBase()` 和 `setBlockStyle()` 中加入 TEXT_ZH/TEXT_EN 訊息註冊

### Phase 5：更新檔案結構
- [ ] 更新 `FILE_STRUCTURE.md` — 加入 text/ 目錄說明

---

## 6. 技術深挖

### 6.1 Blockly 內建 text block 的 generator 覆寫
- `text` (文字常值) 是 Blockly 核心提供的 block
- 預設 generator 會產生 JavaScript 字串
- CodeBridge 需要覆寫 generator 以產生 Arduino C++ 字串 (使用 `quote_()`)
- 使用 `Blockly.Arduino.forBlock['text']` 註冊覆寫

### 6.2 text_join 的動態輸入處理
- 參考 piBlockly generators/text.js lines 11-29
- 使用 `block.itemCount_` 取得輸入數量
- 處理 0 個元素 (返回 `""`)、1 個元素 (使用 `String()` 轉換)、多個元素 (用 ` + ` 連接)
- 每個元素都使用 `String()` 轉換確保類型安全

### 6.3 text_append 的變數處理
- 使用 `field_variable` 儲存變數名稱
- 使用 `Blockly.Arduino.variableDB_.getName()` 取得實際變數名稱
- 這與 Array 積木不同 (Array 使用 field_text)
- 生成 `varName += text;\n` (使用 `+=` 運算子)

### 6.4 text_length 的成員存取
- 使用 `value.length()` 取得 Arduino String 物件的長度
- 優先順序使用 `ORDER_MEMBER` (成員存取運算子)
- 可以接受 String 或 Array 類型的輸入

### 6.5 轉義字元規範
- Generator JS 中的字串不允許實體換行，使用 `\n`
- `text_append` 需要 `\n` 結尾因為它是 statement
- `quote_()` 函數會自動處理字串轉義

### 6.6 ID 標記與程式碼定位
- CodeBridge 的 `scrub_` 會自動在每行程式碼行尾插入 `// __BLOCKLY_ID:xxx__`
- text 積木不需要手動添加 ID 標記 (value/statement 積木由 scrub_ 處理)
- text 積木不在 `scopeDefiningRootBlocks` 中 (不能放在頂層)

### 6.7 孤兒積木檢測
- `text_append` 是 statement 積木，不在 `scopeDefiningRootBlocks` 中
- 如果放在頂層 → 會被標記為 disabled (孤兒積木)
- 正確使用方式：放在 `initializes_setup` 或 `initializes_loop` 內
- `text`, `text_join`, `text_length` 是 value 積木，不會有孤兒問題

---

## 7. 驗證計畫
- [ ] toolbox 分類名稱正確顯示 (文字 / Text)
- [ ] 所有 4 個積木可拖入工作區 (2 個自訂 + 2 個 Blockly 內建)
- [ ] text 可正常輸入文字內容
- [ ] text_join 可正常組合多個元素 (0-N 個)
- [ ] text_append 可正常附加文字到變數
- [ ] text_length 可正常計算文字長度
- [ ] String() 轉換正常 (數字轉字串)
- [ ] 風格切換後分類名稱與積木文字正常
- [ ] 孤兒積木檢測正常 (text_append 不能放在頂層)

---

## 8. 修改檔案清單
| 檔案 | 操作 |
|------|------|
| `ui/src/lib/blockly/modules/text/zh-hant.js` | **新增** |
| `ui/src/lib/blockly/modules/text/en.js` | **新增** |
| `ui/src/lib/blockly/modules/text/blocks.js` | **新增** |
| `ui/src/lib/blockly/modules/text/generators.js` | **新增** |
| `ui/src/lib/blockly/style/engineer.js` | **修改** (加入 3 個 Text key) |
| `ui/index.html` | **修改** (加入 text script 標籤) |
| `ui/src/lib/blockly/loader.js` | **修改** (加入 TEXT_ZH/TEXT_EN 註冊) |
| `FILE_STRUCTURE.md` | **修改** (加入 text/ 說明) |

---

## 9. 與其他模組的差異

| 項目 | Text 模組 | Functions 模組 | Array 模組 |
|------|----------|---------------|-----------|
| 積木數量 | 4 個 (2 個自訂 + 2 個內建) | 5 個公開積木 + 2 個 mutator-only helper | 5 個 |
| Blockly 內建 blocks | 2 個 (text, text_join) | 0 個 | 0 個 |
| 動態輸入 | 有 (text_join itemCount_) | 有 (mutator 參數) | 無 |
| 特殊處理 | String() 轉換, quote_() | mutationToDom/domToMutation | global_vars_ 去重 |
| 孤兒積木 | 1 個 (text_append) | 4 個 | 3 個 |
| Engineer 覆寫 key 數量 | 3 個 | 7 個 | 7 個 |

**關鍵挑戰**：
1. **Blockly 內建 blocks 的 generator 覆寫**：需要覆寫 `text` 和 `text_join` 的 generator
2. **動態輸入處理**：text_join 需要處理 0-N 個元素，並使用 `String()` 轉換
3. **變數名稱處理**：text_append 使用 `variableDB_.getName()` 而非直接取得 field value