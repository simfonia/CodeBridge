# CodeBridge Coding 模組移植計畫

## 1. 背景

參考 Arduino 模組成功移植的模式，移植 Coding 積木到 `modules/coding/`。

### 參考資訊
- **todo.md 縮排規範**：容器型積木使用 `statementToCode()`，數值/字串積木使用 `valueToCode()`，無需手動處理縮排
- **程式碼籃子架構**：`includes_`、`global_vars_`、`setups_`、`function_definitions_` 等 bucket 在 `_core.js` 中定義
- **孤兀積木檢測**：`coding_include`、`coding_comment`、`coding_raw_definition` 已列在 `scopeDefiningRootBlocks` 中
- **toolbox 參考** (index.html)：6 個 coding 積木類型

### 移植流程
1. 從 `common/zh-hant.js` 移除 `CODING_CATEGORY`
2. 從 `common/en.js` 移除 `CODING_CATEGORY`
3. 建立 `modules/coding/zh-hant.js` + `en.js` 定義該分類
4. 建立 `modules/coding/blocks.js` + `generators.js`
5. 更新 `index.html` 載入順序
6. 更新 `loader.js` 訊息註冊

## 2. 積木設計

| 積木類型 | 類型 | 說明 | 程式碼籃子 |
|---------|------|------|------------|
| `coding_comment` | statement | 註解文字輸入 → `// comment` | inline (setup/loop) |
| `coding_include` | statement | `#include <path>` | includes_ |
| `coding_raw_statement` | statement | 原始 C++ 陳述式 | inline (setup/loop) |
| `coding_raw_input` | value | 原始 C++ 表達式 | 回傳 [code, ORDER] |
| `coding_raw_definition` | statement | 全局作用域原始程式碼 | global_vars_ |
| `coding_raw_wrapper` | statement | 包裹內部積木的原始 C++ | function_definitions_ |

## 3. 檔案結構

```
ui/src/lib/blockly/modules/coding/
├── zh-hant.js       # 正體中文訊息
├── en.js            # 英文訊息
├── blocks.js        # 積木定義
└── generators.js    # 程式碼產生器
```

## 4. 實作步驟

### Phase 1：建立模組檔案
- [x] 建立 `modules/coding/zh-hant.js`
- [x] 建立 `modules/coding/en.js`
- [x] 建立 `modules/coding/blocks.js`
- [x] 建立 `modules/coding/generators.js`

### Phase 2：清理 common 模組
- [x] 從 `common/zh-hant.js` 移除 `CODING_CATEGORY`
- [x] 從 `common/en.js` 移除 `CODING_CATEGORY`

### Phase 3：更新載入順序
- [x] 更新 `index.html` - 加入 coding 模組 script 標籤
- [x] 更新 `loader.js` - 加入 coding 模組訊息註冊

### Phase 4：驗證
- [ ] 確認 toolbox 分類名稱正確顯示
- [ ] 確認所有 6 個積木可拖入工作區
- [ ] 確認程式碼生成正確
- [ ] 確認孤兀積木檢測正常

## 5. 關鍵技術注意事項

1. **轉義字元**：generator JS 中的字串不允許實體換行，使用 `\n`
2. **程式碼籃子**：`coding_include` → `includes_`，`coding_raw_definition` → `global_vars_`，`coding_raw_wrapper` → `function_definitions_`
3. **ID 標記**：bucket 型積木需要手動添加 ID 標記以支援程式碼定位
4. **Engineer 風格**：coding 積木不需要 Engineer 覆寫 (維持自然語言)
5. **多行輸入**：使用 `field_multilineinput` (已在 plugins 中載入)
