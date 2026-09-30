# TDD 守門精簡化計畫（Test Gating 2026-09-30）

> 產出：2026-09-30（#task[cocoya TDD 架構檢查] 的延伸任務）
> **性質：只寫計畫，本檔產出過程未修改 CodeBridge 任何程式碼。** 實作留待下一輪。
> 對齊來源：cocoya `log/plan/ComprehensiveAudit_2026-09-27.md` §9（TDD 基礎設施）＋ cocoya 2026-09-30 已落地的分層守門實作。
> **本計畫的唯一目標：讓守門「跑得夠、快得起來、不燒 token」，而不是增加測試數量。**

---

## 0. 結論摘要

CodeBridge 的 TDD 狀態**比 cocoya 好**（已有 Vitest + Playwright + CI 與既有 TDD 規範），
但存在**兩個結構性浪費**與**一個 CI 缺口**：

| 等級 | 議題 | 證據 | 影響 |
|---|---|---|---|
| **P1** | **CI 完全沒跑單元測試** | `.github/workflows/frontend-blockly.yml` 只跑 `test:blockly:assets`、`test:blockly`(Playwright 全 14 支 spec)、`build`；`vitest run tests/unit` 從未出現 | 261 個單元測試在 CI 形同不存在，CI 只驗了慢的那一半 |
| **P1** | **單一測試吃掉 78% 的單元測試時間** | `compile-controller.test.js` 的「上傳期間心跳確實會跳（每秒一個點）」耗 **2227ms**，全檔 2390ms、單元套件 2.86s | 真實等待 2 秒，`vi.useFakeTimers()` 可降為毫秒級 |
| **P2** | **日常 `npm test` 太重** | 根 `test` = `npm run test --prefix ui` = `test:unit && test:blockly`；而 `test:blockly` = `playwright test` = **全部 14 支 spec**（需啟 Edge + vite server，`workers:1`、`fullyParallel:false`） | 每次改一行程式碼都要跑 E2E，等待數分鐘 |
| **P2** | **無「只跑相關測試」的機制** | 無 `test:fast` 之類腳本 | 與 cocoya 相同的 token 浪費問題 |
| **P3** | 測試輸出雜訊 | vitest 輸出夾帶 `[Vite] Copying static folder: src -> dist/src` ×3 | 污染 CI 與 AI 日誌 |

**一句話**：CodeBridge 不是「測試不夠」，而是**「快的測試沒被 CI 驗、慢的測試被塞進日常守門」——兩者剛好錯置**。

---

## 1. 現況量測（實測 2026-09-30，非估算）

### 1.1 測試資產
| 類別 | 檔案數 | 規模 | 框架 |
|---|---|---|---|
| 單元測試 `ui/tests/unit/*.test.js` | **14** | 3,757 行 | Vitest 5.0.1 |
| E2E `ui/tests/e2e/*.spec.js` | **14** | — | Playwright 1.63（`channel: 'msedge'`、`workers:1`） |
| 契約 fixture `ui/tests/fixtures/blockly-v12/` | — | — | TDD Red 起點（AGENTS.md L226） |

單元測試逐檔（`npx vitest run tests/unit`）：
| 檔案 | 測試數 | 耗時 |
|---|---|---|
| compile-controller | 37 | **2390ms**（含單一測試 2227ms） |
### 1.2 指令與 CI
```jsonc
// 根 package.json
"test": "npm run test --prefix ui"
// ui/package.json
"test":            "npm run test:unit && npm run test:blockly",
"test:blockly":    "playwright test",                 // ← 全部 14 支 spec
"test:blockly:runtime":  "playwright test tests/e2e/blockly-runtime.spec.js",
"test:blockly:fixtures": "playwright test tests/e2e/blockly-migration.spec.js",
"test:unit":       "vitest run tests/unit",
"test:blockly:assets": "vitest run tests/unit/blockly-assets.test.js"
```
CI（`.github/workflows/frontend-blockly.yml`，windows-latest、Node 24、timeout 15 分）：
`npm ci --prefix ui` → `test:blockly:assets` → **`test:blockly`（Playwright 全 14 支）** → `build` → 失敗上傳 report。
> ⚠️ **`vitest run tests/unit` 不在 CI 任何一步**。AGENTS.md L240 宣稱「CI 會自動執行 `npm test`」，
> **與實際 workflow 不符**（文件與實作脫節，屬 SSOT 違反）。

---

## 2. 施工項目（依效益排序）

### CB-T1（P1，效益最高）把單元測試接進 CI　✅ **已完成 2026-09-30**
在 `frontend-blockly.yml` 的 `npm ci --prefix ui` 之後、`test:blockly:assets` 之前插入：
```yaml
      - name: Run frontend unit tests
        run: npm run test:unit --prefix ui
```
- 為什麼放最前面：261 例 / 約 4s，是整條 CI 最便宜也最有價的一關，先跑先擋。
- **同時修正 AGENTS.md L240 的敘述**（宣稱 CI 跑 `npm test`，實情應為「CI 跑單元 + Playwright 契約」）。

### CB-T2（P1）心跳測試改用 fake timers　✅ **已完成 2026-09-30**
> 實際解法與計畫不同：`vi.useFakeTimers()` **無效**（`classic-script.js` 於載入時把計時器依值複製進 vm sandbox），
> 改為**載入時注入可控 `setInterval/clearInterval`**，測試手動觸發。效果優於原計畫（斷言更強、零時間依賴）。
`ui/tests/unit/compile-controller.test.js`「上傳期間心跳確實會跳（每秒一個點）」：
```js
// 目前：真實等待約 2.2s
// 建議：
vi.useFakeTimers();
...觸發上傳...
await vi.advanceTimersByTimeAsync(2500);   // 推進 2.5 秒
expect(terminal.records.some((e) => e.line === '.')).toBe(true);
vi.useRealTimers();
```
- **保留語意**（心跳確實啟動且每秒跳點），只是不真的睡 2 秒。
- 風險：`setInterval` 若在模組載入時就取得，需確認 fake timer 安裝時機在 import 前。
- 預期：2.86s → **約 0.7s**。

### CB-T3（P2）分層測試腳本（對齊 cocoya）　✅ **已完成 2026-09-30**
`ui/package.json` 新增：
```jsonc
"test:unit":       "vitest run tests/unit",                       // 既有
"test:unit:fast":  "vitest run tests/unit --silent",              // 迭代用，輸出極簡
"test:e2e:smoke":  "playwright test tests/e2e/blockly-runtime.spec.js tests/e2e/blockly-migration.spec.js",
"test:e2e":        "playwright test",
"test":            "npm run test:unit && npm run test:e2e"        // 維持原義不變
```
根 `package.json` 補 `"test:unit": "npm run test:unit --prefix ui"` 與 `"test:e2e": "npm run test:e2e --prefix ui"`。

### CB-T4（P2）「只跑相關測試」腳本　✅ **已完成 2026-09-30**
> 規則與 cocoya 不同：產品檔（`ui/src/**`）與測試檔（`ui/tests/unit/**`）**分屬不同樹**，
> 因此比對的是**檔名**（`tests/unit/` 遞迴索引），不是目錄。初版誤用 cocoya 的「同目錄」規則已被修正。
新增 `scripts/test-related.mjs`（**移植 cocoya `scripts/test-related.cjs` 的設計，改寫挑選規則**）：

| 變更檔案型態 | 應跑測試 |
|---|---|
| `ui/src/<name>.js` | `tests/unit/<name>.test.js`（同名優先） |
| 對應測試檔本身 | 同名測試 |
| Blockly 模組（`modules/**` 的 block/generator/toolbox/messages） | `tests/e2e/blockly-runtime.spec.js` ＋ `blockly-migration.spec.js` ＋ `blockly-assets.test.js` |
| Rust / Python | 不跑 Node 測試，提示 `cargo check` / `py_compile` |
| 只改樣式（`*.css`） | `theme-runtime.spec.js` |

**與 cocoya 的差異**：CodeBridge 測試檔與產品檔**同名對應良好**（`compile-controller.js` ↔ `compile-controller.test.js`），
規則更單純；反而**多了一層「是否升級到 E2E」的判斷**，這是 cocoya 沒有的。

### CB-T5（P3）輸出雜訊　✅ **已完成 2026-09-30**
`[Vite] Copying static folder: src -> dist/src` ×3 的根因**不是多餘 log，而是真的在做檔案複製**：
`copyCodeBridgeAssets` plugin 缺 `apply` 限制，vitest 結束時的 `closeBundle` 會觸發它，
把整個 `src/` 與 `blockly/` 遞迴複製進 `dist/`。已加 `apply: 'build'`（僅 `vite build` 生效），
並實測確認 `npm run build` 仍產出 `dist/src`、`dist/blockly`、`dist/index.html`。
`[Vite] Copying static folder: src -> dist/src` ×3 來自 Vite 靜態複製在測試期間觸發。
處理方式：於 vitest config 的 `test` 區塊覆寫，停用測試期間的 public 靜態複製。

---

## 3. 分層守門建議表（落地後的日常紀律）

| 層級 | 指令 | 何時跑 | 預估耗時 |
|---|---|---|---|
| **L0** | `npm run test:fast`（CB-T4 新增） | 每次改完碼 | < 1s |
| **L1** | `npm run test:unit --prefix ui` | 功能切片完成 | 約 0.7s（CB-T2 後） |
| **L2** | `npm run test:e2e:smoke --prefix ui` | 涉及 Blockly 模組／UI 互動 | 數十秒~數分 |
| **L3** | `npm test`（unit + 全 E2E） | 階段收尾、提交前 | 數分鐘 |
| **CI** | workflow（CB-T1 後） | push / PR | 單元先擋，再跑 E2E |

---

## 4. 風險與決策點

| 項目 | 風險 | 建議 |
|---|---|---|
| CB-T1 | CI 時間會**增加**約 5 秒（單元測試），但同時補上 261 例把關 | 值得；可把 Playwright 限縮為 smoke + nightly 全量以抵銷總時長 |
| CB-T2 | fake timer 可能與 `setInterval` 註冊時機衝突，導致測試假綠 | 改完必須**故意移除一個斷言**驗證它真的會紅（紅→綠→再紅才算有效） |
| CB-T4 | 挑選規則漏判會造成「以為測過了」 | 規則表寫進 `AGENTS.md`，並在 `--dry` 模式列出選了哪些測試 |
| Playwright 全量 | `workers: 1`、`fullyParallel: false` ＋ Edge，成本高 | 建議 CI 分兩個 job：`unit`（快）與 `e2e`（慢，可 nightly） |
| 文件脫節 | AGENTS.md 對 CI 的敘述已與 workflow 不符 | CB-T1 一併修正 |

---

## 5. 與 cocoya 的差異對照（避免直接照抄）

| 面向 | cocoya | CodeBridge |
|---|---|---|
| 框架 | `node --test` 原生 | Vitest ＋ Playwright |
| 主要浪費 | 單一測試的計時器洩漏吊住 event loop（5.7s → 1.1s） | 單一測試真實等待 2.2s（2.86s → 預估 0.7s） |
| 既有 CI | **無** | **有，但漏跑單元測試** |
| 慢測試位置 | 無（只有 Node 單元測試） | Playwright 全量被塞進根 `npm test` |
| 契約測試 | `core_contract.test.mjs`（檔案系統掃描） | `blockly-assets.test.js` ＋ 兩支 Blockly 契約 spec（CI 已跑） |
| 移植難度 | — | `test-related` 腳本可移植，但挑選規則需加入「是否升級 E2E」判斷 |

---

## 6. 執行順序

1. **CB-T1**（CI 補單元測試）＋ 修正 AGENTS.md CI 敘述 —— 5 分鐘，零風險
2. **CB-T2**（心跳改 fake timers）—— 需紅/綠/紅三段驗證
3. **CB-T3**（分層腳本）＋ **CB-T4**（`test-related`，移植 cocoya 設計）
4. **CB-T5**（輸出雜訊）—— 可併入任一次改動

---

## 7. 待使用者決策

1. CI 是否拆成 `unit`（快，必跑）與 `e2e`（慢，nightly 或允許失敗）兩個 job？
2. 根 `npm test` 是否維持「unit + 全 E2E」的 heavyweight 語意（發布前用），日常改用 `test:fast`？
3. 是否同步在 `AGENTS.md` 新增與 cocoya 同構的「測試執行分層守門」章節？

---

*本檔為計畫，尚未實作任何變更。實作時請逐項打勾並在 `log/work/` 留下執行日誌。*

| serial-monitor | 31 | 121ms |
| project-store | 30 | 129ms |
| terminal-panel | 22 | 137ms |
| plot-panel | 20 | 201ms |
| 其餘 9 檔（plot-store/parse/render、settings、board-*、toolbar、blockly-assets、plain-code） | — | 15~230ms |
| **合計** | **261 passed** | **2.86s**（tests 74% / transform 13% / import 10% / worker 3%） |
