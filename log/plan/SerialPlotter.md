# 序列繪圖器（Serial Plotter）

## 文件資訊
- 狀態：**實作中（2026-09-28）**
- 對應程式碼：`ui/src/lib/plot/plot-parse.js`、`plot-store.js`、`plot-render.js`、`plot-panel.js`、
  `ui/src/lib/arduino/serial-monitor.js`（新增 `onDataLine`）、`ui/index.html`、`ui/src/style.css`、
  `ui/src/lib/ui/toolbar-registry.js`、`ui/src/lib/ui/toolbar.js`、`ui/src/main.js`
- 前置：`log/plan/SerialMonitor.md` 已完成（T3 Phase 1，序列連線穩定化）
- **Rust 端零改動** —— 見「架構決策 A」

---

## 已確認的產品決策（2026-09-28）

| 決策點 | 結論 | 理由 |
|---|---|---|
| 連線來源 | **與 Serial Monitor 共用同一條序列連線** | Windows 上 COM 埠為獨佔資源，另開一條連線必然 `AccessDenied`；且會破壞已穩定化的「上傳前釋放／上傳後重連」流程 |
| 佈局 | **開啟繪圖時把終端機面板垂直分成左右兩欄**：左＝Monitor 文字、右＝Plotter 波形 | 高中生需要「看文字確認印了什麼」與「看曲線確認數值」同時成立，切頁則只能二選一 |
| 面板高度 | 開啟繪圖時若高度 < **320px** 則自動撐高，關閉時還原 | 預設 200px 扣掉標題/控制列/輸入行後 canvas 僅約 110px，折線幾乎看不出波形 |
| 視覺區隔 | **維持不變**（`.terminal-line--data` 左側綠色色條） | 既有設計已足夠，另加區隔只會增加噪音 |
| HEX 模式 | HEX 開啟時**不做解析**，右欄顯示提示 | `48 65 6C` 這種位元組串解析沒有意義，且會把圖表搞成雜訊 |
| 色碼 | **沿用終端機深色系**，不引入 semantic token | 終端機區域本來就沒走 `presets.css`；Plotter 是它的子區域，跟著走就不會與 Engineer/Angel 兩套 preset 衝突 |

---

## Problem Statement

### 1. 學生看不到數值變化

序列監視器（T3）只把資料印成文字行。`Serial.print(sensorValue, ",")` 的輸出
在使用者眼裡是一串毫無意義的數字，**「溫度有沒有在變」「波形對不對」完全看不出來**。
硬體課程的核心實驗（取樣、濾波、PID、感測器校正）幾乎全部依賴視覺化。

### 2. 後端已提供一切所需

`src-tauri/src/serial_monitor.rs` 的 `pump()` 已把完整行以
`codebridge://serial-data` 事件批次推給前端，前端 `handleSerialData` 已拿到每一行原文。
**缺的只是前端把它變成折線。**

### 3. 與 `CodeBridgeV2.md` 既有定調一致

`log/plan/CodeBridgeV2.md:73-74` 已定調：
- Plotter 支援 CSV、tab 與 `label:value`
- plot data parser、ring buffer、downsampling 與 renderer **必須分離**

---

## 架構決策

### A. 為什麼是「零 Rust 改動」

`port_lease` 是單一持有者模型（`AppState::port_lease` / `monitor_wants`）。
Plotter 若要在後端另開 plot session，就必須複製一整套租約協調、
上傳暫停／重連、埠消失自動關閉的邏輯 —— 那是已實測穩定化的程式碼，
複製一份只會製造兩份會漂移的邏輯。

**Plotter 是 Monitor 資料流的圖形檢視，不是另一個裝置連線。**
因此只在前端加一個訂閱點即可。

### B. 資料流

```
Rust serial_monitor（唯一 COM 持有者）
  └ codebridge://serial-data（既有事件）
     └ serial-monitor.js handleSerialData（既有）
        └ ★新增 onDataLine(listener)   ← 唯一改動既有檔案之處
           └ plot-parse.js    純函式：文字行 → [{label, value, index}]
              └ plot-store.js  純資料：ring buffer / series / 時間窗 / 下抽樣
                 └ plot-render.js  Canvas 2D，rAF 節流
                    └ plot-panel.js  DOM 接線、開關、分隔條、窄視窗降級
```

### C. 模組邊界

| 檔案 | 職責 | 純函式？ |
|---|---|---|
| `plot-parse.js` | 行文字 → 資料點 | ✅ |
| `plot-store.js` | ring buffer、series、時間窗、下抽樣 | ✅ |
| `plot-render.js` | Canvas 繪圖 | ⚠️ 需 mock 2D context |
| `plot-panel.js` | DOM 接線、開關、開關高度、分隔條拖曳 | ⚠️ 需 DOM |

前兩個承擔 80% 邏輯與 100% 核心測試。

---

## UI 佈局

### 新增的 DOM 層

```
#terminalArea                    (既有，flex column，高度可拖曳)
├── #terminalHeader              (既有) ── 新增 [繪圖] 鈕
├── #serialControlBar            (既有，埠/baud/HEX/開關)
├── #terminalBody        ★新     flex:1, display:flex, row
│   ├── #terminalTextPane  ★新   flex:1, min-width:0, flex column
│   │   ├── #terminalContent     (既有，撐滿)
│   │   └── #serialInputBar      (既有)
│   ├── #plotDivider      ★新     5px 垂直拖曳分隔條
│   └── #plotPane         ★新     flex:1, min-width:0, flex column（預設 display:none）
│       ├── #plotToolbar         視窗長度 ▾ / 暫停 / 清除
│       ├── #plotCanvasWrap > <canvas id="plotCanvas">
│       └── #plotLegend          色塊 + 標籤，點擊切換顯示
```

### 為什麼需要 `#terminalBody` 這一層

`#terminalArea` 已是 `flex column`（標題／控制列在上，內容撐滿）。
若直接把 `#plotPane` 放進去會變成「標題 + 橫向雙欄 + 輸入行」錯位，
輸入行會橫跨兩欄。加一層把「文字區 + 輸入行」綁成左欄、plotter 綁成右欄，語意才乾淨。

**相容性**：`terminal-panel.js` 全部用 `getElementById` 取得元素，多包一層不影響；
`workspace-wheel.spec.js` 量的是 `terminalArea.offsetHeight`，也不受影響。

### 窄視窗降級

`ResizeObserver` 監看 `#terminalBody` 寬度：
- < **560px** → 自動退回上下堆疊（`column`），右欄在上、左欄在下
- ≥ 560px → 恢復左右分欄

### 分隔比例

`#plotDivider` 可拖曳，預設 50/50，左右各最小 **260px**。

---

## 資料格式（對齊 Arduino IDE 慣例）

| 格式 | 範例 | 處理 |
|---|---|---|
| 純數值 | `23.5` | 沿用上一個 label（Arduino IDE 行為） |
| `label:value` | `temp:23.5` | 決定 series 名稱 |
| CSV | `23.5, 40.2, 18.0` | 序號為 label（`1` `2` `3`…） |
| TSV | `23.5\t40.2` | 同上 |
| 布林 | `on` / `off` / `true` / `false` | 映射 1 / 0 |
| 文字垃圾行 | `LED 已開啟` | **忽略並計數**，不讓圖表崩潰 |

- 負數、科學記號（`1.2e3`）皆接受。
- `NaN` / `inf` 直接丟棄，**不可污染 ring buffer**。
- 同一時間軸多欄位以 `null` 對齊補值（斷線呈現），避免不同長度序列錯位。

---

## Ring Buffer 與效能

| 項目 | 值 | 理由 |
|---|---|---|
| 預設視窗 | 600 點 | ≈10 秒 @60Hz，夠看又不塞爆 |
| 視窗選項 | 200 / 600 / 1800 點 | 對應 3 / 10 / 30 秒；高中生不需要更長 |
| 每 series 硬上限 | 3600 點 | 超過丟最舊，webview 記憶體不可無限成長 |
| 下抽樣 | 像素寬度 > 點數時採 **min/max 對包絡** | 保留尖峰；單純抽稀會讓峰值消失，是誤導 |
| 重繪 | 單一 `<canvas>` + `requestAnimationFrame` | 資料事件可達 60Hz，不可每次都重畫 |
| DPR | 以實際 `devicePixelRatio` 縮放 | 高分螢幕模糊 |

---

## 視覺設計

- 背景／格線／文字沿用終端機深色系（`#1e1e1e` 底、`#3c3c3c` 線、`#b8b8b8` 字）。
  Plotter 是終端機子區域，兩者本來就同屬一個視覺區塊。
- Series 配色用固定高辨識度色序（青／桃／黃／綠／紫），在 render 啟動時
  以 `getComputedStyle` 讀取容器色實例化 → **零新增硬編碼色碼**。
- 圖例為 **色塊 + 文字標籤**雙重編碼，不單靠顏色（與既有 `.serial-status`
  的「文字 + 顏色雙重編碼」原則一致，色盲友善）。
- X 軸＝相對時間（避免絕對時間戳佔滿軸），Y 軸自適應含 0。

---

## TDD 流程

1. **Red**
   - `tests/unit/plot-parse.test.js`：CSV／TSV／`label:value`／純數值／布林／垃圾行／
     負數與科學記號／`NaN` 丟棄／label 含冒號
   - `tests/unit/plot-store.test.js`：容量上限丟最舊、多 series、清除、時間窗切片、
     min/max 下抽樣、隱藏 series 不影響資料
   - `tests/unit/plot-render.test.js`：mock `getContext`，驗證 `stroke` 次數與可見
     series 數一致、隱藏者不繪、DPR 縮放
   - `tests/unit/plot-panel.test.js`：窄視窗退回堆疊、開啟繪圖自動撐高、
     關閉還原、`onDataLine` 訂閱正確
   - `tests/unit/serial-monitor.test.js`：擴充既有事件仍通知 Plotter 訂閱者
   - `tests/e2e/plotter.spec.js`：`btn-plotter` 切換、注入偽造事件後圖例出現、
     `data-action` 契約完整、`#plotPane` 與 `#terminalContent` 左右並排
2. **Green**：只寫讓測試通過的最小實作
3. **Refactor**：抽出共用 throttle / 尺寸工具
4. **驗證**：`npm run test:unit` → `npx playwright test` → `npm run build` → `cargo test`

---

## 風險與緩解

| 風險 | 緩解 |
|---|---|
| 高流量塞爆 IPC | 資料事件本身已被 Rust 端 60ms／32 行雙門檻節流；前端再加 rAF 合併重繪 |
| 分欄後高度不足，波形看不出來 | 開啟繪圖自動撐高至 320px；可拖曳的 `#terminal-resizer` 仍在 |
| 使用者拖曳過的高度被自動撐高覆蓋 | 自動高度與 `userHeight` **分開記錄**，關閉時只還原自動撐的那一次 |
| 視窗太窄兩欄都不能用 | 560px 以下自動退回上下堆疊 |
| HEX 模式下圖表變雜訊 | HEX 時不解析，右欄顯示明確提示 |
| 拔線／上傳暫停時圖表假死 | 狀態事件驅動右欄顯示「等待資料…」，復線後自動續畫（不補斷點資料） |
| Plotter 擠壓 Blockly 工作區 | 開啟時會觸發 `svgResize`（既有 `onWorkspaceResize` 機制） |

---

## 明確不做（排除範圍）

- 資料記錄 / 匯出 CSV
- 暫停後回放、游標讀值、FFT／頻譜
- 依賴第三方圖表函式庫（**零新增 dependency**，自繪 Canvas）
- 後端 plot session、獨立的 plotter 埠連線
- 多視窗各自監看不同埠

---

## 下一步

1. Red：`plot-parse` / `plot-store` 測試
2. Green：兩個純邏輯模組
3. Red/Green：`plot-render` / `plot-panel` 測試與實作
4. `serial-monitor.js` 新增 `onDataLine`
5. `index.html` DOM 重構 + `style.css` + script 載入
6. `toolbar-registry.js` 契約 + `toolbar.js` ACTIONS + i18n 中英
7. 全量驗證

