# CodeBridge Loops 模組移植計畫 (Engineer 風格對齊 piBlockly)

## 1. 背景

將 piBlockly 的 Loops 模組移植到 CodeBridge，建立 `modules/loops/`。Engineer 風格的積木文字與產生器必須對齊 piBlockly 的實作。

### 參考資訊
- **piBlockly blocks**: `C:/Workspace/piblockly/media/blocks/loops.js` (3 個自訂積木)
- **piBlockly generators**: `C:/Workspace/piblockly/media/generators/loops.js` (4 個產生器)
- **piBlockly i18n**: `C:/Workspace/piblockly/media/zh-hant.js` + `en.js` (Engineer/Angel 對應表)
- **piBlockly style switching**: `C:/Workspace/piblockly/media/main.js` `blockMessageStylesMap`
- **CodeBridge 已完成模式**: Arduino / Coding / Logic 模組
- **CodeBridge index.html**: 工具箱已預留 loops 分類 (lines 220-241)
- **CodeBridge engineer.js**: 已有舊版 loops 覆寫 (需更新為對齊 piBlockly)

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
| `controls_while` | statement | while 迴圈 (BOOL 條件 + DO 陳述式) | `while (cond) { ... }` |
| `controls_for` | statement | for 迴圈 (VAR 變數 + FROM/TO/BY 值 + DO 陳述式) | `for (int i = from; i <= to; i += by) { ... }` |
| `controls_flow_statements` | statement | break / continue | `break;` / `continue;` |

### 積木結構 (對齊 piBlockly)

**controls_while** (多行區塊: message0 + message1 + message2)
```
while (%1) {        ← message0 (Engineer) / 當 %1 (Angel)
  [DO]              ← message1
}                   ← message2
```

**controls_for** (8 個佔位符)
```
for (int %1 = %2; %3 %4 %5; %6 %7 %8) {   ← message0
  [DO]                                     ← message1
}                                          ← message2
```
- %1=VAR(variable), %2=FROM(value), %3=VAR_LABEL_1(label), %4=COMPARE_OP(label), %5=TO(value), %6=VAR_LABEL_2(label), %7=STEP_OP(label), %8=BY(value)
- 包含 `onchange` 自動切換 `<=`/`>=` 與 `+=`/`-=`
- 包含 `updateLabels` 同步變數名稱到 VAR_LABEL_1/2

**controls_flow_statements** (單行下拉)
```
%1                    ← message0 (Engineer: "%1" / Angel: "%1 迴圈")
```
- 下拉選項: BREAK("break"/"中斷"), CONTINUE("continue"/"跳過")

---

## 3. i18n 對照 (Engineer 對齊 piBlockly)

### Engineer 風格覆寫 (`style/engineer.js`)
| Key | piBlockly Engineer 值 | 當前 CodeBridge 值 | 更新為 |
|-----|----------------------|-------------------|--------|
| `CONTROLS_WHILE_MESSAGE` | `while (%1) {` | `while(%1)` | `while (%1) {` |
| `CONTROLS_FOR_MESSAGE` | `for (int %1 = %2; %3 %4 %5; %6 %7 %8) {` | `for(%1 = %2; %1 <= %3; %1 += %4)` | `for (int %1 = %2; %3 %4 %5; %6 %7 %8) {` |
| `CONTROLS_FLOW_STATEMENTS_MESSAGE` | `%1` | `break` | `%1` |

### Angel 風格基底 (`modules/loops/zh-hant.js` + `en.js`)
| Key | zh-hant (Angel) | en (Angel) |
|-----|----------------|------------|
| `CONTROLS_WHILE_MESSAGE` | `當 %1` | `while %1` |
| `CONTROLS_FOR_MESSAGE` | `計數，變數%1 = %2 ; %3%4%5 ; 每次變動(%6%7 %8) ` | `Count, variable %1 = %2 ; %3%4%5 ; each change (%6%7 %8)` |
| `CONTROLS_FLOW_STATEMENTS_MESSAGE` | `%1 迴圈` | `%1 loop` |

### 其他 i18n key
| Key | zh-hant | en |
|-----|---------|-----|
| `LOOPS_HUE` | `#7fcd81` | `#7fcd81` |
| `LOOPS_CATEGORY` | `迴圈` | `Loops` |
| `CONTROLS_WHILE_TOOLTIP` | `當條件為真時，重複執行一些語句。` | `While a condition is true, then do some statements.` |
| `CONTROLS_FOR_TOOLTIP` | `讓變數從開始值到結束值，按照指定的間隔計數，並執行指定的積木。` | `Loop with %1 from %2 to %3 by %4.` |
| `CONTROLS_FLOW_STATEMENTS_TOOLTIP` | `跳出(break)一層迴圈或繼續(continue)下一次迭代。` | `Break out of the inner loop or continue with the next iteration.` |

---

## 4. 檔案結構

```
ui/src/lib/blockly/modules/loops/
├── zh-hant.js       # Angel-style i18n (繁體中文)
├── en.js            # Angel-style i18n (English)
├── blocks.js        # 3 個自訂積木定義
└── generators.js    # 3 個 Arduino 產生器
```

---

## 5. 實作步驟

### Phase 1：建立模組檔案
- [ ] 建立 `modules/loops/zh-hant.js` — Angel 基底訊息 (LOOPS_HUE, LOOPS_CATEGORY, 3 個 message + 3 個 tooltip)
- [ ] 建立 `modules/loops/en.js` — Angel 基底訊息 (英文對應)
- [ ] 建立 `modules/loops/blocks.js` — 3 個積木定義
  - `controls_while`: message0/message1/message2 多行區塊, BOOL(input_value, check Boolean), DO(input_statement)
  - `controls_for`: 8 個佔位符, field_variable(VAR), 4 個 input_value(FROM/TO/BY), 4 個 field_label(VAR_LABEL_1/COMPARE_OP/VAR_LABEL_2/STEP_OP), onchange 自動切換, updateLabels 同步
  - `controls_flow_statements`: field_dropdown(FLOW: BREAK/CONTINUE)
  - 使用 `"style": "loop_blocks"` (Blockly 內建)
  - 使用 `%{BKY_...}` 佔位符
- [ ] 建立 `modules/loops/generators.js` — 3 個產生器
  - `controls_while`: `valueToCode(BOOL, ORDER_NONE)` + `statementToCode(DO)` → `while (cond) {\n body }\n`
  - `controls_for`: 參考 piBlockly 實作 (number literal 檢測 + generic fallback)
  - `controls_flow_statements`: switch FLOW → `break;\n` / `continue;\n`
  - **不包含** `controls_if` (已在 logic/generators.js) 和 `controls_repeat_ext` (toolbox 不需)

### Phase 2：清理 common 模組
- [ ] 從 `modules/common/zh-hant.js` 移除 `LOOPS_CATEGORY`
- [ ] 從 `modules/common/en.js` 移除 `LOOPS_CATEGORY`

### Phase 3：更新 Engineer 風格覆寫
- [ ] 更新 `style/engineer.js` 中的 3 個 loops key 為對齊 piBlockly 的 Engineer 值

### Phase 4：更新載入順序
- [ ] 更新 `index.html` — 在 Logic 模組後、common 之前加入 loops 模組 script 標籤

### Phase 5：更新模組載入器
- [ ] 更新 `loader.js` — 在 `loadLocaleBase()` 和 `setBlockStyle()` 中加入 LOOPS_ZH/LOOPS_EN 訊息註冊

### Phase 6：更新檔案結構
- [ ] 更新 `FILE_STRUCTURE.md` — 加入 loops/ 目錄說明

---

## 6. 技術深挖

### 6.1 CodeBridge 雙風格機制 vs piBlockly
- **piBlockly**: 使用 `blockMessageStylesMap` 動態對映 generic key → theme-specific key
- **CodeBridge**: Angel 直接設定在模組 i18n，Engineer 覆寫在 `engineer.js`，loader 重新註冋 + `setBlockStyle()` 切換
- **對齊**: engineer.js 的 key 必須與模組 i18n 的 key 相同 (loader 會加上 `BKY_` 前綴)

### 6.2 縮排處理
- `controls_while` / `controls_for` / `controls_flow_statements` 都是 statement 積木
- 使用 `statementToCode(block, 'DO')` 取得迴圈體，Blockly 自動加入縮排
- `finish()` 中的 `prefixLines()` 統一處理 setup/loop 內縮
- **無需**在產生器中手動處理縮排

### 6.3 controls_for 的 number literal 檢測
- 參考 piBlockly generators/loops.js lines 54-118
- 若 FROM/TO/BY 皆為數字字面值 → 生成簡單 for 迴圈 (自動判斷 <=/>= 與 ++/--/+=)
- 若有非數字字面值 → 生成 generic for 迴圈 (快取變數)
- 使用 `Blockly.Arduino.variableDB_.getName()` 取得變數名稱

### 6.4 ID 標記與程式碼定位
- CodeBridge 的 `scrub_` 會自動在每行程式碼行尾插入 `// __BLOCKLY_ID:xxx__`
- loops 積木不需要手動添加 ID 標記 (statement 積木由 scrub_ 處理)
- 但 loops 積木不在 `scopeDefiningRootBlocks` 中 (不能放在頂層)

### 6.5 孤兒積木檢測
- `controls_while`, `controls_for`, `controls_flow_statements` 不在 `scopeDefiningRootBlocks` 中
- 如果放在頂層 → 會被標記為 disabled (孤兒積木)
- 正確使用方式：放在 `initializes_setup` 或 `initializes_loop` 內

### 6.6 轉義字元規範
- Generator JS 中的字串不允許實體換行，使用 `\n`
- 參考 global.md 三層字串意識

---

## 7. 驗證計畫
- [ ] toolbox 分類名稱正確顯示 (迴圈 / Loops)
- [ ] 所有 3 個積木可拖入工作區
- [ ] controls_while 可正常展開 DO 區域
- [ ] controls_for 可正常顯示 8 個佔位符，變數名稱同步
- [ ] controls_for onchange 自動切換 <= / >= 與 += / -=
- [ ] controls_flow_statements 下拉 BREAK/CONTINUE 正常
- [ ] 程式碼生成正確 (while, for, break/continue)
- [ ] 風格切換後分類名稱與積木文字正常
- [ ] 孤兒積木檢測正常 (loops 積木不能放在頂層)

---

## 8. 修改檔案清單
| 檔案 | 操作 |
|------|------|
| `ui/src/lib/blockly/modules/loops/zh-hant.js` | **新增** |
| `ui/src/lib/blockly/modules/loops/en.js` | **新增** |
| `ui/src/lib/blockly/modules/loops/blocks.js` | **新增** |
| `ui/src/lib/blockly/modules/loops/generators.js` | **新增** |
| `ui/src/lib/blockly/style/engineer.js` | **修改** (更新 3 個 loops key) |
| `ui/src/lib/blockly/modules/common/zh-hant.js` | **修改** (移除 LOOPS_CATEGORY) |
| `ui/src/lib/blockly/modules/common/en.js` | **修改** (移除 LOOPS_CATEGORY) |
| `ui/index.html` | **修改** (加入 loops script 標籤) |
| `ui/src/lib/blockly/loader.js` | **修改** (加入 LOOPS_ZH/LOOPS_EN 註冊) |
| `FILE_STRUCTURE.md` | **修改** (加入 loops/ 說明) |
