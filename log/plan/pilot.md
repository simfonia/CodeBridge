# CodeBridge 程式碼撰寫導航員 - 實作計畫

## 文件資訊
- **建立日期**：2026-07-25
- **最後更新**：2026-07-26
- **狀態**：已審核通過，準備實作
- **負責人**：simfonia

---

## 1. 功能概述

### 1.1 功能名稱
程式碼撰寫導航員（Code Writing Navigator）

### 1.2 功能目標
提供學生一個**手寫練習環境**，讓他們：
1. 看著積木產生的標準答案
2. 在練習模式下手寫 C++ 程式碼
3. 即時獲得錯誤反饋（紅色標記錯誤）
4. 卡住時可以按 F2 取得提示

### 1.3 核心設計原則
- **隱藏標準答案**：練習時標準答案完全不可見
- **即時比對**：每寫完一行就檢查正確性
- **行序為主**：假設學生照著順序抄寫（符合教學場景）
- **寬容比對**：忽略空白、空行、註解，但保留 C++ 大小寫

---

## 2. 技術架構

### 2.1 現有基礎
- ✅ `blockToRangeMap`：blockId → {start, end}（積木 → 程式碼行）
- ✅ `renderCode()`：生成程式碼並嵌入 ID 標記
- ✅ `codeContent`：程式碼顯示區域

### 2.2 需要新增的元件

```
ui/src/
├── lib/
│   └── practice/
│       └── practice-mode.js      # 練習模式核心（含比對引擎 + 提示系統）
```

> **說明**：三個功能合併為單一模組，置於 `ui/src/lib/practice/` 下，與 Blockly 積木定義解耦。

### 2.3 資料結構

```js
// 練習模式狀態
var practiceMode = {
    isActive: false,           // 是否在練習模式
    standardCode: '',          // 原始標準答案
    normalizedStandard: [],    // 正規化後的標準答案（陣列）
    studentTextarea: null,     // 學生輸入的 textarea
    currentLineIndex: 0,       // 學生目前寫到第幾行
    results: []                // 比對結果
};
```

---

## 3. 核心算法

### 3.1 正規化函式

```js
/**
 * 正規化程式碼（保留 C++ 特性）
 * @param {string} code - 原始程式碼
 * @returns {string[]} 正規化後的行陣列
 */
function normalizeCode(code) {
    if (!code || typeof code !== 'string') return [];
    
    // 1. 移除區塊註解 /* ... */（C++ 不允許巢狀註解）
    code = code.replace(/\/\*[\s\S]*?\*\//g, '');
    
    return code.split('\n')
        .map(line => {
            // 2. 移除單行註解（// 之後的全部忽略）
            line = line.replace(/\/\/.*$/g, '');
            // 3. 壓縮空白（保留 C++ 大小寫）
            line = line.replace(/\s+/g, ' ').trim();
            return line;
        })
        .filter(line => line.length > 0); // 移除空行
}

// 範例：
// 輸入：  "  pinMode(13, OUTPUT);  // 設定腳位  "
// 輸出：  "pinMode(13, OUTPUT);"
//
// 輸入：  "/* 註解 */\n  pinMode(13, OUTPUT);"
// 輸出：  ["pinMode(13, OUTPUT);"]
```

### 3.2 行序比對算法

```js
/**
 * 檢查學生的進度（基於行序的一對一比對）
 * @param {string} studentCode - 學生的程式碼（到目前行為止）
 * @returns {Array} 比對結果陣列
 */
function checkStudentProgress(studentCode) {
    var normalizedStudent = normalizeCode(studentCode);
    var results = [];
    
    for (var i = 0; i < normalizedStudent.length; i++) {
        var studentLine = normalizedStudent[i];
        var standardLine = practiceMode.normalizedStandard[i];
        
        if (!standardLine) {
            // 學生寫超過標準答案
            results.push({
                index: i,
                status: 'extra',
                line: studentLine,
                message: '多寫了這行'
            });
            continue;
        }
        
        // Level 1：完全匹配
        if (studentLine === standardLine) {
            results.push({
                index: i,
                status: 'correct',
                line: studentLine
            });
        } 
        // Level 2：檢查是否只是遺漏分號（保留標準行分號為比對基準）
        else if (isMissingSemicolon(studentLine, standardLine)) {
            results.push({
                index: i,
                status: 'warning',
                line: studentLine,
                expected: standardLine,
                message: '別忘了分號！'
            });
        }
        // Level 3：不匹配
        else {
            results.push({
                index: i,
                status: 'wrong',
                line: studentLine,
                expected: standardLine
            });
        }
    }
    
    return results;
}

/**
 * 檢查是否只是遺漏分號
 * 保留標準行的分號作為比對基準，只檢查學生行是否少了結尾分號
 */
function isMissingSemicolon(studentLine, standardLine) {
    if (standardLine.endsWith(';') && !studentLine.endsWith(';')) {
        var withoutSemicolon = standardLine.slice(0, -1);
        return studentLine === withoutSemicolon;
    }
    return false;
}
```

### 3.3 提示系統

```js
/**
 * 顯示提示（F2 快捷鍵）
 * @param {number} cursorPosition - 游標位置
 */
function showHint(cursorPosition) {
    var studentCode = practiceMode.studentTextarea.value.substring(0, cursorPosition);
    var normalizedStudent = normalizeCode(studentCode);
    var currentLineIndex = normalizedStudent.length;
    
    // 取得游標之後的標準答案（接下來 3 行）
    var hintLines = practiceMode.normalizedStandard.slice(
        currentLineIndex, 
        currentLineIndex + 3
    );
    
    if (hintLines.length > 0) {
        showHintPopup(hintLines, currentLineIndex);
    } else {
        showCompletionMessage();
    }
}
```

---

## 4. UI 設計

### 4.1 練習模式佈局

```html
<div id="practiceContainer" style="display: none;">
    <div class="practice-header">
        <span class="practice-title">✍️ 程式碼撰寫練習</span>
        <div class="practice-controls">
            <button id="btn-exit-practice" class="practice-btn">
                ❌ 退出練習
            </button>
        </div>
    </div>
    
    <div class="practice-content">
        <div class="practice-hint">
            💡 按 F2 顯示提示 | 按 Enter 換行並檢查 | 按 Esc 退出
        </div>
        
        <div class="practice-editor-wrapper">
            <div class="practice-line-numbers" id="practiceLineNumbers">1</div>
            <textarea id="practiceTextarea" 
                      class="practice-textarea" 
                      placeholder="在這裡手寫程式碼..."
                      spellcheck="false"
                      autocomplete="off"
                      wrap="off"></textarea>
        </div>
        
        <div id="hintPopup" class="hint-popup" style="display: none;">
            <div class="hint-title">💡 提示</div>
            <div id="hintContent" class="hint-content"></div>
        </div>
    </div>
</div>
```

### 4.2 CSS 樣式

```css
/* 練習模式容器 */
#practiceContainer {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #1e1e1e;
}

.practice-header {
    padding: 8px 12px;
    background: #2d2d2d;
    border-bottom: 1px solid #404040;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.practice-title {
    color: #FE2F89;
    font-weight: bold;
    font-size: 14px;
}

.practice-btn {
    background: #404040;
    color: #fff;
    border: none;
    padding: 4px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
}

.practice-btn:hover {
    background: #505050;
}

/* 練習區域 */
.practice-content {
    flex: 1;
    position: relative;
    overflow: hidden;
}

.practice-hint {
    padding: 8px 12px;
    background: #252525;
    color: #aaa;
    font-size: 11px;
    border-bottom: 1px solid #333;
}

/* 編輯器包裝（行號 + textarea） */
.practice-editor-wrapper {
    display: flex;
    height: calc(100% - 36px);
    position: relative;
}

/* 行號欄 */
.practice-line-numbers {
    width: 40px;
    background: #252525;
    color: #666;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 14px;
    line-height: 1.6;
    padding: 12px 8px;
    text-align: right;
    user-select: none;
    overflow: hidden;
    border-right: 1px solid #333;
}

.practice-textarea {
    flex: 1;
    background: #1e1e1e;
    color: #d4d4d4;
    border: none;
    padding: 12px;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 14px;
    line-height: 1.6;
    resize: none;
    outline: none;
    tab-size: 4;
}

/* 提示 Popup */
.hint-popup {
    position: absolute;
    bottom: 20px;
    left: 20px;
    right: 20px;
    background: rgba(45, 45, 45, 0.95);
    border: 1px solid #FE2F89;
    border-radius: 6px;
    padding: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.hint-title {
    color: #FE2F89;
    font-weight: bold;
    margin-bottom: 8px;
    font-size: 13px;
}

.hint-content {
    color: #aaa;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 13px;
    line-height: 1.6;
}

.hint-line {
    color: #666;
    padding: 2px 0;
}

/* 比對結果樣式 */
.practice-line-correct {
    background-color: rgba(76, 175, 80, 0.15);
}

.practice-line-warning {
    background-color: rgba(255, 152, 0, 0.15);
}

.practice-line-wrong {
    background-color: rgba(244, 67, 54, 0.15);
}

.practice-line-extra {
    background-color: rgba(255, 235, 59, 0.1);
}
```

### 4.3 視覺效果

```
┌────────────────────────────────────────────┐
│ ✍️ 程式碼撰寫練習              [❌ 退出練習] │
├────────────────────────────────────────────┤
│ 💡 按 F2 顯示提示 | Enter 檢查 | Esc 退出  │
├────┬───────────────────────────────────────┤
│  1 │ void setup() {                       │ ← 綠色背景 ✅
│  2 │ pinMode(13,OUTPUT);                  │ ← 綠色背景 ✅
│  3 │ digitalWrite(13,HIGH)                │ ← 紅色背景 ❌
│  4 │ }                                    │ ← 綠色背景 ✅
│    │                                       │
│    │                                       │
│    │ ┌────────────────────────────────┐    │
│    │ │ 💡 提示 (你正在寫第 3 行)       │    │
│    │ │ digitalWrite(13, **HIGH**);    │    │ ← 粗體 = 未完成部分
│    │ │ 下一行：delay(1000);           │    │
│    │ └────────────────────────────────┘    │
└────┴───────────────────────────────────────┘
```

---

## 5. 實作步驟

### Phase 1：基礎框架（1 小時）

#### 5.1.1 建立練習模式 UI
- [ ] 在 `index.html` 中加入 `#practiceContainer`（位於 `#codeContent` 旁）
- [ ] 在 `#codeHeader` 加入「✍️ 練習」按鈕（icon: `pen-new-square-outline.png`）
- [ ] 加入練習模式樣式（`style.css`）

#### 5.1.2 建立核心模組
- [ ] 建立 `ui/src/lib/practice/practice-mode.js`
- [ ] 實作 `normalizeCode()` 函式（含區塊註解處理）
- [ ] 實作 `isMissingSemicolon()` 函式

#### 5.1.3 整合到主程式
- [ ] 在 `main.js` 中加入 `initPracticeMode(workspace)` 呼叫
- [ ] 建立切換函式 `togglePracticeMode()`

### Phase 2：即時比對（1-2 小時）

#### 5.2.1 比對引擎
- [ ] 實作 `checkStudentProgress()` 函式
- [ ] 實作行序比對算法
- [ ] 實作分號檢查

#### 5.2.2 即時監聽
- [ ] 監聽 textarea 的 `keydown` 事件（Enter 鍵）
- [ ] 取得游標位置
- [ ] 觸發比對

#### 5.2.3 視覺反饋
- [ ] 用 CSS class 標記正確/錯誤行（含 ✅/❌/⚠️ 圖示標記）
- [ ] 顯示錯誤提示訊息
- [ ] 滾動到錯誤行
- [ ] 同步更新行號欄

### Phase 3：提示系統（30 分鐘）

#### 5.3.1 快捷鍵監聽
- [ ] 監聽 F2 鍵
- [ ] 監聽 Esc 鍵（退出練習）

#### 5.3.2 提示顯示
- [ ] 實作 `showHint()` 函式
- [ ] 顯示游標所在行的上下文提示（粗體標示未完成部分）
- [ ] 顯示接下來 2 行（淡灰色）
- [ ] 完成時顯示祝賀訊息

#### 5.3.3 UI 提示
- [ ] 在練習區域顯示快捷鍵提示
- [ ] 提示按鈕（可視化）

### Phase 4：測試與優化（1 小時）

#### 5.4.1 測試案例（使用 console.assert）
- [ ] 測試完全正確的程式碼
- [ ] 測試遺漏分號
- [ ] 測試空白不一致
- [ ] 測試註解忽略（單行 + 區塊）
- [ ] 測試大小寫敏感
- [ ] 測試跳行（學生多寫一行）

#### 5.4.2 優化
- [ ] 調整比對閾值
- [ ] 優化效能（debounce）
- [ ] 改善 UI/UX

---

## 6. 快捷鍵設計

### 6.1 快捷鍵一覽表

| 功能 | 快捷鍵 | 觸發時機 | 說明 |
|------|--------|----------|------|
| 顯示提示 | F2 | 游標在 textarea 中 | 顯示游標所在行的上下文提示 + 接下來 2 行 |
| 觸發比對 | Enter | 學生按 Enter 後 | 檢查到目前行為止的程式碼 |
| 退出練習 | Esc | 任何時候 | 回到唯讀模式 |

### 6.2 UI 提示

在練習模式中顯示：
```
💡 按 F2 顯示提示 | Enter 檢查 | Esc 退出
```

### 6.3 快捷鍵衝突檢查

| 快捷鍵 | 潛在衝突 | 解決方案 |
|--------|----------|----------|
| F2 | 瀏覽器書籤（Tauri 不會） | ✅ 無衝突 |
| Enter | textarea 預設行為 | ✅ 保留，只添加比對功能 |
| Esc | 瀏覽器全屏 | ✅ 在練習模式中優先使用 |

---

## 7. 比對策略

### 7.1 比對層級

| 層級 | 條件 | 結果 | 視覺效果 |
|------|------|------|----------|
| **Level 1** | 完全匹配（忽略空白） | ✅ 正確 | 綠色背景 |
| **Level 2** | 遺漏分號 | ⚠️ 警告 | 橙色背景 + 提示訊息 |
| **Level 3** | 不匹配 | ❌ 錯誤 | 紅色背景 + 顯示正確答案 |

### 7.2 正規化規則

1. **保留**：
   - C++ 關鍵字的大小寫（`pinMode` ≠ `PinMode`）
   - 數字、字串常數
   - 運算子（`+`, `-`, `*`, `/`, `=`, `==`, `!=`）
   - 分號（作為標準行的一部分）

2. **移除**：
   - 區塊註解（`/* ... */`）
   - 單行註解（`//` 之後的全部內容）
   - 多餘空白（壓縮成單一空白）
   - 空行

3. **忽略**：
   - 空白位置（`pinMode(13,OUTPUT)` = `pinMode( 13 , OUTPUT )`）
   - 分號遺漏（只顯示警告，不算錯誤）

### 7.3 邊界情況處理

| 情況 | 處理方式 |
|------|----------|
| 學生多寫一行 | 標記為 "extra"，不影響後續比對 |
| 學生漏寫一行 | 後續所有行都會標記為錯誤（符合預期，學生會立即修正） |
| 學生寫超過標準答案 | 標記為 "extra" |
| 標準答案為空行 | 跳過（不參與比對） |
| 學生輸入空行 | 跳過（不參與比對） |

---

## 8. 提示系統設計

### 8.1 提示觸發

- **快捷鍵**：F2
- **按鈕**：可視化的「💡 提示」按鈕

### 8.2 提示內容

顯示游標位置所在行的上下文提示，以及接下來 2 行：

```js
// 學生目前寫到第 3 行，剛打完 "digital"
// 標準答案：
// 1. void setup() {
// 2. pinMode(13, OUTPUT);
// 3. digitalWrite(13, HIGH);
// 4. delay(1000);
// 5. }

// 按下 F2 後顯示：
// 💡 提示 (你正在寫第 3 行)
// digitalWrite(13, **HIGH**);    ← 粗體 = 還沒寫的部分
// 下一行：delay(1000);
```

### 8.3 提示樣式

- **顏色**：淡灰色（`#666`）
- **字體**：等寬字體（Consolas, Monaco）
- **位置**：textarea 下方（絕對定位 popup）
- **動畫**：淡入效果

### 8.4 完成判定

- 學生寫完最後一行後，隱藏提示按鈕
- 顯示祝賀訊息：「🎉 完成！你已經正確寫完所有程式碼！」

---

## 9. 檔案異動清單

### 9.1 新增檔案

| 檔案路徑 | 說明 |
|----------|------|
| `ui/src/lib/practice/practice-mode.js` | 練習模式核心（比對引擎 + 提示系統） |

### 9.2 修改檔案

| 檔案路徑 | 修改內容 |
|----------|----------|
| `ui/index.html` | 加入練習模式 UI（`#practiceContainer`）及 `<script>` 載入 |
| `ui/src/style.css` | 加入練習模式樣式 |
| `ui/src/main.js` | 加入 `initPracticeMode(workspace)` 一行呼叫 |
| `ui/src/lib/i18n/zh-hant.js` | 加入練習模式相關 i18n key |
| `ui/src/lib/i18n/en.js` | 加入練習模式相關 i18n key |

### 9.3 不需要修改的檔案

- ✅ `ui/src/lib/blockly/generators/_core.js`（不需要改動）
- ✅ `ui/src/lib/blockly/modules/arduino/generators.js`（不需要改動）
- ✅ `ui/src/lib/blockly/loader.js`（不需要改動）

---

## 10. 測試計畫

### 10.1 單元測試（console.assert）

```js
// 測試 normalizeCode()
console.assert(JSON.stringify(normalizeCode('pinMode(13, OUTPUT);')) === 
               JSON.stringify(['pinMode(13, OUTPUT);']));

// 測試區塊註解移除
console.assert(JSON.stringify(normalizeCode('/* comment */\npinMode(13, OUTPUT);')) === 
               JSON.stringify(['pinMode(13, OUTPUT);']));

// 測試 isMissingSemicolon()
console.assert(isMissingSemicolon('pinMode(13, OUTPUT)', 'pinMode(13, OUTPUT);') === true);
console.assert(isMissingSemicolon('pinMode(13, OUTPUT);', 'pinMode(13, OUTPUT);') === false);

// 測試 checkStudentProgress()
var results = checkStudentProgress('void setup() {\npinMode(13, OUTPUT);');
console.assert(results[0].status === 'correct');
console.assert(results[1].status === 'correct');
```

### 10.2 整合測試

| 測試場景 | 預期結果 |
|----------|----------|
| 學生完全正確 | 所有行顯示綠色 + ✅ |
| 學生遺漏分號 | 該行顯示橙色 + ⚠️ + 提示 |
| 學生寫錯函式名稱 | 該行顯示紅色 + ❌ + 正確答案 |
| 學生多寫一行 | 該行顯示黃色 + "多寫了這行" |
| 學生按 F2 | 顯示游標所在行上下文提示 + 接下來 2 行 |
| 學生按 Esc | 退出練習模式 |

### 10.3 使用者測試

- [ ] 找 3-5 名學生測試
- [ ] 記錄使用時間
- [ ] 收集反饋意見
- [ ] 調整比對閾值

---

## 11. 風險與限制

### 11.1 技術風險

| 風險 | 影響 | 緩解措施 |
|------|------|----------|
| 學生跳行寫程式 | 後續所有行都會錯誤 | 在提示中說明「請按順序抄寫」 |
| 語法錯誤嚴重 | 比對準確率下降 | 設定合理的相似度閾值 |
| 效能問題（長程式碼） | 比對延遲 | 使用 debounce，限制比對頻率 |

### 11.2 使用者體驗限制

1. **必須按順序抄寫**：如果學生跳行，後續會全部錯誤
   - 解決方案：在提示中強調「請按順序抄寫」

2. **不能部分正確**：如果第 3 行錯誤，第 4 行就算正確也會被標記為錯誤
   - 解決方案：這是預期行為（強制按順序學習）

3. **提示可能被濫用**：學生可能一直按 F2 看答案
   - 解決方案：可以記錄提示次數（未來功能）

---

## 12. 未來擴展

### 12.1 短期（可選）

- [ ] 統計正確率
- [ ] 完成度百分比
- [ ] 錯誤類型分析（漏分號、括號不對齊等）
- [ ] 提示次數限制

### 12.2 中期（可選）

- [ ] 支援多種正確寫法（如 `pinMode(13, OUTPUT)` 和 `pinMode(13,INPUT_PULLUP)`）
- [ ] 智能提示（根據錯誤類型給出不同提示）
- [ ] 儲存學生的練習記錄

### 12.3 長期（可選）

- [ ] 整合到評分系統
- [ ] 教師後台查看學生的練習記錄
- [ ] 難度分級（初級/中級/進級）

---

## 13. 開發時程

### 13.1 预估時間

| Phase | 工作內容 | 預估時間 |
|-------|----------|----------|
| Phase 1 | 基礎框架 | 1 小時 |
| Phase 2 | 即時比對 | 1-2 小時 |
| Phase 3 | 提示系統 | 30 分鐘 |
| Phase 4 | 測試與優化 | 1 小時 |
| **總計** | | **3.5-4.5 小時** |

### 13.2 建議開發順序

1. **Day 1**：Phase 1 + Phase 2（基礎框架 + 即時比對）
2. **Day 2**：Phase 3（提示系統）
3. **Day 3**：Phase 4（測試與優化）

---

## 14. 相關文件

- [x] `FILE_STRUCTURE.md` - 專案檔案結構
- [x] `log/work/2026-07-25.md` - 今日工作日誌
- [x] `README.md` - 專案說明文件

---

## 15. 審核清單

### 15.1 功能確認

- [x] 練習模式要隱藏標準答案？（✅ 已確認）
- [x] 快捷鍵用 F2？（✅ 已確認）
- [x] 提示顯示游標所在行上下文 + 接下來 2 行？（✅ 已確認）
- [x] 比對基於行序（一對一）？（✅ 已確認）
- [x] 保留 C++ 大小寫？（✅ 已確認）
- [x] 忽略空白、空行、註解？（✅ 已確認）
- [x] 分號保留為標準行的一部分？（✅ 已確認）

### 15.2 技術確認

- [x] 使用 textarea + 即時比對？
- [x] 正規化函式含區塊註解處理？
- [x] 行序比對算法符合預期？
- [x] 提示系統顯示游標所在行上下文？
- [x] 模組置於 `ui/src/lib/practice/` 下？
- [x] 三個功能合併為單一 `practice-mode.js`？

### 15.3 UI/UX 確認

- [x] 練習模式的佈局滿意？
- [x] 顏色配置（綠色/紅色/橙色）滿意？
- [x] 提示 popup 的樣式滿意？
- [x] 快捷鍵提示清楚？
- [x] 加入行號欄位？
- [x] 加入 ✅/❌/⚠️ 圖示標記（無障礙）？
- [x] 進入按鈕使用 `pen-new-square-outline.png` 圖示？

---

## 16. 下一步行動

1. ~~審核此計畫~~ ✅ 已完成
2. ~~修改建議~~ ✅ 已整合
3. **開始實作**：切換到 ACT MODE 開始實作

---

## 17. 備註

- 此計畫基於 2026-07-25 的討論，2026-07-26 審核通過
- 所有技術細節都已驗證可行性
- 實作時會遵循 CodeBridge 的編碼規範
- 完成後會更新工作日誌和 FILE_STRUCTURE.md

---

**文件版本**：v1.1  
**最後更新**：2026-07-26  
**狀態**：已審核通過，準備實作