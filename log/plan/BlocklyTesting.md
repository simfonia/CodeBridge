# Blockly 測試維護指南

## 測試 seam

1. **Runtime**：真實 Edge 載入 CodeBridge 頁面，透過 Blockly 公開 API 驗證版本、renderer、sounds、ARIA、blocks 與 generators。
2. **Migration**：透過 `CodeBridgeBlocklyXml` 載入 `tests/fixtures/blockly-v12/*.xml`。
3. **Generator golden**：移除隨機 Blockly ID marker 後，與 spec 中的固定 `.ino` literal 比較。
4. **Resource manifest**：`VERSIONS.md` 是已發布 Blockly 資源的 bytes 與 SHA-256 來源，Vitest 逐檔驗證。

## 命令

- `npm test`：完整 assets + Playwright contracts
- `npm run test:blockly:assets --prefix ui`：資源 manifest
- `npm run test:blockly:runtime --prefix ui`：runtime contract
- `npm run test:blockly:fixtures --prefix ui`：migration／golden tests
- `npm run build`：production build

Playwright 使用 `channel: 'msedge'`，因此開發機與 CI 必須有 Microsoft Edge；CI 使用 `windows-latest`。

## 新增 block 或模組時

1. 新增涵蓋公開行為的 XML fixture，不直接測試 block 私有欄位。
2. 若 generator 產碼刻意改變，先確認 C++ 語意，再更新固定 golden literal。
3. 測試中的 block type 清單包含 shadow blocks；數量增加不一定是 regression。
4. 升級 Blockly 資源時同步更新 `VERSIONS.md`，asset test 會拒絕未登錄或 hash 不符的 JS。
5. XML 輸入一律使用 `CodeBridgeBlocklyXml.textToWorkspace()`／`domToWorkspace()`，不可繞過 migration adapter。

## CI

`.github/workflows/frontend-blockly.yml` 在 push、pull request 與手動觸發時執行：

- `npm ci --prefix ui`
- asset manifest tests
- Playwright runtime／migration tests
- Vite production build
- 失敗時上傳 Playwright HTML report
