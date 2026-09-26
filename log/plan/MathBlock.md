# CodeBridge Math 模組移植計畫 (Engineer 風格對齊 piBlockly)

## 1. 背景

將 piBlockly 的 Math 模組移植到 CodeBridge，建立 `modules/math/`。Engineer 風格的積木文字與產生器必須對齊 piBlockly 的實作。

### 參考資訊
- **piBlockly generators**: `C:/Workspace/piblockly/media/generators/math.js` (8 個產生器)
- **piBlockly blocks**: `C:/Workspace/piblockly/media/blocks/arduino.js` (4 個 Math 相關積木定義)
- **piBlockly i18n**: `C:/Workspace/piblockly/media/zh-hant.js` + `en.js` (Engineer/Angel 對應表)
- **CodeBridge 已完成模式**: Arduino / Coding / Logic / Loops 模組
- **Blockly 內建 blocks**: `math_number`, `math_arithmetic`, `math_single` (Blockly 核心提供，但需要自訂 generators)

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
| `math_number` | value | 數字常值 | 直接輸出數字 |
| `math_arithmetic` | value | 四則運算 (ADD/MINUS/MULTIPLY/DIVIDE/POWER) | `a + b`, `pow(a, b)` |
| `math_single` | value | 單目運算 (ABS/ROOT/LN/LOG10/EXP/POW10/ROUND/ROUNDUP/ROUNDDOWN/SIN/COS/TAN/ASIN/ACOS/ATAN/NEG) | `abs(x)`, `sqrt(x)`, `sin(x / 180.0 * PI)` 等 |
| `arduino_constrain` | value | 限制範圍 | `constrain(value, low, high)` |
| `arduino_map` | value | 範圍映射 | `map(value, fromLow, fromHigh, toLow, toHigh)` |
| `math_random_seed` | statement | 設定隨機種子 | `randomSeed(seed);\n` |
| `math_random_int` | value | 隨機整數 | `random(min, max)` 或 `random(max)` 或 `random()` |

### 積木結構 (對齊 piBlockly)

**math_number** (單行輸出)
```
%1                    ← message0 (數字輸入欄位)
```
- 輸出類型: Number
- 使用 Blockly 內建 block，但需要自訂 generator

**math_arithmetic** (單行運算)
```
%1 %2 %3              ← message0 (Engineer: "%1 %2 %3" / Angel: "%1 %2 %3")
```
- %1=A(value), %2=OP(dropdown: ADD/MINUS/MULTIPLY/DIVIDE/POWER), %3=B(value)
- 輸出類型: Number
- POWER 使用 `pow(a, b)` 函數

**math_single** (單行函數)
```
%1 %2                 ← message0 (Engineer: "%1 %2" / Angel: "%1 %2")
```
- %1=OP(dropdown: ABS/ROOT/LN/LOG10/EXP/POW10/ROUND/ROUNDUP/ROUNDDOWN/SIN/COS/TAN/ASIN/ACOS/ATAN/NEG), %2=NUM(value)
- 輸出類型: Number
- 三角函數需轉換度數到弧度: `sin(x / 180.0 * PI)`
- 反三角函數需轉換弧度到位數: `asin(x) / PI * 180`

**arduino_constrain** (單行函數)
```
constrain( %1, %2, %3 )    ← message0 (Engineer) / 限制 %1 在 %2 和 %3 之間 (Angel)
```
- %1=VALUE(value), %2=LOW(value), %3=HIGH(value)
- 輸出類型: Number
- style: "math_blocks"

**arduino_map** (單行函數)
```
map( %1, %2, %3, %4, %5 )  ← message0 (Engineer) / 將 %1 從 %2 - %3 範圍重新對應到 %4 - %5 (Angel)
```
- %1=VALUE(value), %2=FROMLOW(value), %3=FROMHIGH(value), %4=TOLOW(value), %5=TOHIGH(value)
- 輸出類型: Number
- style: "math_blocks"

**math_random_seed** (單行陳述式)
```
randomSeed( %1 )            ← message0 (Engineer) / 設定隨機種子為 %1 (Angel)
```
- %1=SEED(value)，shadow 使用 arduino_analog_read (A0)
- 輸出類型: statement
- style: "math_blocks"

**math_random_int** (單行函數)
```
random( %1, %2 )            ← message0 (Engineer) / 隨機數，介於 %1 和 %2 之間 (Angel)
```
- %1=MIN(value, shadow: math_number 0), %2=MAX(value, shadow: math_number 100)
- 輸出類型: Number
- style: "math_blocks"
- Generator 需處理參數可選情況 (1 個或 2 個參數)

---

## 3. i18n 對照 (Engineer 對齊 piBlockly)

### Engineer 風格覆寫 (`style/engineer.js`)
| Key | piBlockly Engineer 值 | 說明 |
|-----|----------------------|------|
| `MATH_SINGLE_OP_ABSOLUTE` | `abs` | 函數顯示名稱 |
| `MATH_SINGLE_OP_ROOT` | `sqrt` | 函數顯示名稱 |
| `ARDUINO_CONSTRAIN_MSG` | `constrain( %1, %2, %3 )` | constrain 積木 |
| `ARDUINO_MAP_MSG` | `map( %1, %2, %3, %4, %5 )` | map 積木 |
| `ARDUINO_MATH_RANDOM_SEED_MSG` | `randomSeed( %1 )` | randomSeed 積木 |
| `ARDUINO_MATH_RANDOM_INT_MSG` | `random( %1, %2 )` | random 積木 |

**注意**：`math_number`, `math_arithmetic`, `math_single` 這三個 Blockly 內建 blocks 的 Engineer 文字由 Blockly 核心控制，CodeBridge 不需要覆寫。

### Angel 風格基底 (`modules/math/zh-hant.js` + `en.js`)
| Key | zh-hant (Angel) | en (Angel) |
|-----|----------------|------------|
| `MATH_CATEGORY` | `數學` | `Math` |
| `MATH_HUE` | `#5C68A6` | `#5C68A6` |
| `MATH_NUMBER_TOOLTIP` | `一個數字。` | `A number.` |
| `MATH_ARITHMETIC_TOOLTIP_ADD` | `傳回兩個數字的總和。` | `Returns the sum of two numbers.` |
| `MATH_ARITHMETIC_TOOLTIP_MINUS` | `傳回兩個數字的差。` | `Returns the difference of two numbers.` |
| `MATH_ARITHMETIC_TOOLTIP_MULTIPLY` | `傳回兩個數字的乘積。` | `Returns the product of two numbers.` |
| `MATH_ARITHMETIC_TOOLTIP_DIVIDE` | `傳回兩個數字的商。` | `Returns the quotient of two numbers.` |
| `MATH_ARITHMETIC_TOOLTIP_POWER` | `傳回第一個數字的第二個數字次方。` | `Returns the first number raised to the power of the second number.` |
| `MATH_SINGLE_TOOLTIP_ROOT` | `傳回一個數字的平方根。` | `Returns the square root of a number.` |
| `MATH_SINGLE_TOOLTIP_ABS` | `傳回一個數字的絕對值。` | `Returns the absolute value of a number.` |
| `MATH_SINGLE_TOOLTIP_NEG` | `傳回一個數字的負數。` | `Returns the negation of a number.` |
| `MATH_SINGLE_TOOLTIP_LN` | `傳回一個數字的自然對數。` | `Returns the natural logarithm of a number.` |
| `MATH_SINGLE_TOOLTIP_LOG10` | `傳回一個數字的以 10 為底的對數。` | `Returns the base 10 logarithm of a number.` |
| `MATH_SINGLE_TOOLTIP_EXP` | `傳回 e 的指定數次方。` | `Returns e to the power of the specified number.` |
| `MATH_SINGLE_TOOLTIP_POW10` | `傳回 10 的指定數次方。` | `Returns 10 to the power of the specified number.` |
| `ARDUINO_CONSTRAIN_MSG` | `限制 %1 在 %2 和 %3 之間` | `limit %1 between %2 and %3` |
| `ARDUINO_MAP_MSG` | `將 %1 從 %2 - %3 範圍重新對應到 %4 - %5` | `remap %1 from range %2 - %3 to %4 - %5` |
| `ARDUINO_MATH_RANDOM_SEED_MSG` | `設定隨機種子為 %1` | `set random seed to %1` |
| `ARDUINO_MATH_RANDOM_INT_MSG` | `隨機數，介於 %1 和 %2 之間` | `random number between %1 and %2` |
| `ARDUINO_CONSTRAIN_TOOLTIP` | `將一個數字限制在一個範圍內。參數：(要限制的值, 範圍下限, 範圍上限)。` | `Constrains a number to be within a range. Parameters: (value, min, max).` |
| `ARDUINO_MAP_TOOLTIP` | `將一個數字從一個範圍重新對應到另一個範圍。參數：(要對應的值, 原始範圍下限, 原始範圍上限, 目標範圍下限, 目標範圍上限)。` | `Re-maps a number from one range to another. Parameters: (value, fromLow, fromHigh, toLow, toHigh).` |
| `ARDUINO_MATH_RANDOM_SEED_TOOLTIP` | `初始化偽亂數生成器。建議使用一個未連接的類比腳位作為種子。` | `Initializes the pseudo-random number generator. Using an unconnected analog pin as a seed is recommended.` |
| `ARDUINO_MATH_RANDOM_INT_TOOLTIP` | `產生一個介於 min (包含) 和 max (不包含) 之間的偽亂數。` | `Generates a pseudo-random number between min (inclusive) and max (exclusive).` |

---

## 4. 檔案結構

```
ui/src/lib/blockly/modules/math/
├── zh-hant.js       # Angel-style i18n (正體中文)
├── en.js            # Angel-style i18n (English)
├── blocks.js        # 4 個自訂積木定義 (arduino_constrain, arduino_map, math_random_seed, math_random_int)
└── generators.js    # 8 個 Arduino 產生器 (包含 Blockly 內建 blocks 的覆寫)
```

**重要說明**：
- `math_number`, `math_arithmetic`, `math_single` 是 Blockly 內建 blocks，不需要在 `blocks.js` 中定義
- 但需要在 `generators.js` 中註冊這三個 blocks 的 Arduino 產生器
- `arduino_constrain`, `arduino_map`, `math_random_seed`, `math_random_int` 是自訂 blocks，需要在 `blocks.js` 和 `generators.js` 中都定義

---

## 5. 實作步驟

### Phase 1：建立模組檔案
- [ ] 建立 `modules/math/zh-hant.js` — Angel 基底訊息 (MATH_HUE, MATH_CATEGORY, 4 個 arduino_* message + 12 個 tooltip)
- [ ] 建立 `modules/math/en.js` — Angel 基底訊息 (英文對應)
- [ ] 建立 `modules/math/blocks.js` — 4 個自訂積木定義
  - `arduino_constrain`: message0, 3 個 input_value (VALUE/LOW/HIGH), output: Number, style: "math_blocks"
  - `arduino_map`: message0, 5 個 input_value (VALUE/FROMLOW/FROMHIGH/TOLOW/TOHIGH), output: Number, style: "math_blocks"
  - `math_random_seed`: message0, 1 個 input_value (SEED), shadow: arduino_analog_read (A0), previousStatement/nextStatement, style: "math_blocks"
  - `math_random_int`: message0, 2 個 input_value (MIN/MAX), shadow: math_number (0/100), output: Number, style: "math_blocks"
- [ ] 建立 `modules/math/generators.js` — 8 個產生器
  - `math_number`: 直接輸出數字字串
  - `math_arithmetic`: 四則運算 + POWER (使用 pow())
  - `math_single`: 單目運算 (注意三角函數度數轉換)
  - `arduino_constrain`: `constrain(value, low, high)`
  - `arduino_map`: `map(value, fromLow, fromHigh, toLow, toHigh)`
  - `math_random_seed`: `randomSeed(seed);\n`
  - `math_random_int`: 處理 0-2 個參數情況

### Phase 2：更新 Engineer 風格覆寫
- [ ] 更新 `style/engineer.js` — 加入 6 個 Math 相關 key (MATH_SINGLE_OP_ABSOLUTE, MATH_SINGLE_OP_ROOT, ARDUINO_CONSTRAIN_MSG, ARDUINO_MAP_MSG, ARDUINO_MATH_RANDOM_SEED_MSG, ARDUINO_MATH_RANDOM_INT_MSG)

### Phase 3：更新載入順序
- [ ] 更新 `index.html` — 在 Logic 模組後、common 之前加入 math 模組 script 標籤

### Phase 4：更新模組載入器
- [ ] 更新 `loader.js` — 在 `loadLocaleBase()` 和 `setBlockStyle()` 中加入 MATH_ZH/MATH_EN 訊息註冊

### Phase 5：更新檔案結構
- [ ] 更新 `FILE_STRUCTURE.md` — 加入 math/ 目錄說明

---

## 6. 技術深挖

### 6.1 Blockly 內建 blocks 的 generator 覆寫
- `math_number`, `math_arithmetic`, `math_single` 是 Blockly 核心提供的 blocks
- 預設 generator 會產生 JavaScript 程式碼
- CodeBridge 需要覆寫這三個 blocks 的 generator 以產生 Arduino C++ 程式碼
- 使用 `Blockly.Arduino.forBlock['math_number']` 註冊覆寫

### 6.2 math_arithmetic 的運算子處理
- 參考 piBlockly generators/math.js lines 11-32
- 使用 OPERATORS 映射表處理 ADD/MINUS/MULTIPLY/DIVIDE
- POWER 是特殊情況，使用 `pow(a, b)` 函數呼叫
- 運算子優先順序由 ORDER_* 常數控制

### 6.3 math_single 的三角函數度數轉換
- Arduino 的 `sin()`, `cos()`, `tan()` 函數使用弧度
- Blockly 內建的 dropdown 選項使用度數 (SIN, COS, TAN)
- Generator 必須轉換: `sin(x / 180.0 * PI)`
- 反三角函數也需要轉換: `asin(x) / PI * 180`
- 使用 Blockly 提供的 `PI` 常數 (Blockly.Arduino 會自動定義)

### 6.4 math_random_int 的參數處理
- 參考 piBlockly generators/math.js lines 143-155
- 支援 0-2 個參數:
  - 2 個參數: `random(min, max)`
  - 1 個參數: `random(max)`
  - 0 個參數: `random()`
- 使用 `valueToCode` 取得參數，檢查是否為 null/undefined

### 6.5 轉義字元規範
- Generator JS 中的字串不允許實體換行，使用 `\n`
- 參考 global.md 三層字串意識
- `math_random_seed` 需要 `\n` 結尾因為它是 statement

### 6.6 ID 標記與程式碼定位
- CodeBridge 的 `scrub_` 會自動在每行程式碼行尾插入 `// __BLOCKLY_ID:xxx__`
- math 積木不需要手動添加 ID 標記 (value/statement 積木由 scrub_ 處理)
- math 積木不在 `scopeDefiningRootBlocks` 中 (不能放在頂層)

### 6.7 孤兒積木檢測
- `math_random_seed` 是 statement 積木，不在 `scopeDefiningRootBlocks` 中
- 如果放在頂層 → 會被標記為 disabled (孤兒積木)
- 正確使用方式：放在 `initializes_setup` 或 `initializes_loop` 內
- `math_number`, `math_arithmetic`, `math_single`, `arduino_constrain`, `arduino_map`, `math_random_int` 是 value 積木，不會有孤兒問題

---

## 7. 驗證計畫
- [ ] toolbox 分類名稱正確顯示 (數學 / Math)
- [ ] 所有 7 個積木可拖入工作區 (4 個自訂 + 3 個 Blockly 內建)
- [ ] math_number 可正常輸入數字
- [ ] math_arithmetic 下拉 ADD/MINUS/MULTIPLY/DIVIDE/POWER 正常
- [ ] math_single 下拉 15 個運算子正常 (ABS/ROOT/LN/LOG10/EXP/POW10/ROUND/ROUNDUP/ROUNDDOWN/SIN/COS/TAN/ASIN/ACOS/ATAN/NEG)
- [ ] arduino_constrain 可正常生成 constrain() 程式碼
- [ ] arduino_map 可正常生成 map() 程式碼
- [ ] math_random_seed 可正常生成 randomSeed() 程式碼
- [ ] math_random_int 可正常生成 random() 程式碼 (0-2 個參數)
- [ ] 三角函數度數轉換正確 (SIN/COS/TAN 使用弧度)
- [ ] 反三角函數弧度轉換正確 (ASIN/ACOS/ATAN 回傳度數)
- [ ] 風格切換後分類名稱與積木文字正常
- [ ] 孤兒積木檢測正常 (math_random_seed 不能放在頂層)

---

## 8. 修改檔案清單
| 檔案 | 操作 |
|------|------|
| `ui/src/lib/blockly/modules/math/zh-hant.js` | **新增** |
| `ui/src/lib/blockly/modules/math/en.js` | **新增** |
| `ui/src/lib/blockly/modules/math/blocks.js` | **新增** |
| `ui/src/lib/blockly/modules/math/generators.js` | **新增** |
| `ui/src/lib/blockly/style/engineer.js` | **修改** (加入 6 個 Math key) |
| `ui/index.html` | **修改** (加入 math script 標籤) |
| `ui/src/lib/blockly/loader.js` | **修改** (加入 MATH_ZH/MATH_EN 註冊) |
| `FILE_STRUCTURE.md` | **修改** (加入 math/ 說明) |

---

## 9. 與 Loops 模組的差異

| 項目 | Loops 模組 | Math 模組 |
|------|-----------|----------|
| 自訂 blocks 數量 | 3 個 | 4 個 |
| Blockly 內建 blocks | 0 個 | 3 個 (math_number, math_arithmetic, math_single) |
| Generator 數量 | 3 個 | 8 個 (包含 3 個內建 blocks 覆寫) |
| 特殊處理 | onchange/updateLabels | 三角函數度數轉換、random 參數可選 |
| 孤兒積木 | 3 個 (while/for/flow) | 1 個 (random_seed) |
| Engineer 覆寫 key 數量 | 3 個 | 6 個 |

**關鍵挑戰**：
1. **Blockly 內建 blocks 的 generator 覆寫**：需要確保在正確的時機註冊覆寫
2. **三角函數度數轉換**：Arduino 使用弧度，但 Blockly 內建 dropdown 使用度數
3. **math_random_int 的參數處理**：需要處理 0-2 個參數的彈性情況