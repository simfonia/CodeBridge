# 序列監視器（Serial Monitor）

## 文件資訊
- 狀態：**實作中（2026-09-28）**
- 對應程式碼：`src-tauri/src/serial_monitor.rs`、`src-tauri/src/commands.rs`、`src-tauri/src/events.rs`、`src-tauri/src/lib.rs`、`ui/src/lib/arduino/serial-monitor.js`、`ui/src/lib/ui/terminal-panel.js`、`ui/index.html`
- 前置：Phase T2 已完成編譯／上傳、板子自動偵測、開發板選擇面板；`serialport` crate 已在 `Cargo.toml`
- 對齊參考：#cocoya `src-tauri/src/commands/mcu.rs` 的 `spawn_serial_monitor` / `SerialMonitorWant`

---

## 已確認的產品決策（2026-09-28）

| 決策點 | 結論 | 理由 |
|---|---|---|
| 面板配置 | **編譯輸出與序列輸出共用一個面板**（`#terminalContent`） | 高中生不會同時需要看編譯 log 與序列輸出；Arduino IDE 也是單一面板。兩者以不同 class（`terminal-line--command` vs `--data`）視覺區隔即可 |
| 上傳後重連 | **預設自動重連為開啟** | 使用者的心智模型是「按執行 → 看到結果」；要求手動重開是額外負擔，且會讓學生以為程式沒輸出 |
| baud 變更 | **自動重啟 Monitor** | 序列埠的 baud 在開啟時綁定，無法熱改。丟失連線瞬間是唯一合理代價 |

---

## Problem Statement

### 1. 學生看不到 `Serial.print()` 的結果

`index.html:399` 的終端機標題早已寫著 `TLB_TERMINAL_TITLE`（序列監視器），
但面板實際上只承載編譯／上傳輸出。使用者按「執行」燒錄成功後，
程式裡的 `Serial.println("LED 已開啟")` 完全沒有任何地方可以看。

### 2. 後端已備妥基礎設施，缺的是服務層

- `serialport = "4.2"` 已在 `Cargo.toml`，`commands.rs:scan_ports_detailed()` 已用它列 port + VID/PID
- `AppState::port_lease`（`try_acquire_port` / `release_port`）**已存在**且 upload 已在用；
  `lib.rs:43` 的註解明寫「T3 的 Serial Monitor 需沿用同一把鎖，實現上傳前暫停 Monitor、結束後依設定重連」
- `project-store.js:29` 的 `META_FIELDS` 已含 `baud`，`.cbg` 可存波特率
- 缺的只有：常駐讀取程序、事件串流、前端控制列

### 3. 序列埠是獨佔資源 —— 這是本功能最大的風險點

Windows 上同一個 COM 埠同一時間只能被一個程序開啟。若 Monitor 持續佔著 COM3，
使用者按下「執行」時 avrdude 會直接失敗。**必須沿用既有的 `port_lease`**，
在 upload 前自動釋放 Monitor、上傳結束後自動重連。

---

## 實作範圍

### 本次做（Phase 1）
1. **Rust 端監控服務** `src-tauri/src/serial_monitor.rs`
   - 純邏輯（framing / HEX 編碼 / 節流策略）可獨立單元測試，不碰真實硬體
   - `pump()` 泛型於 `Read`，測試可餵入假的讀取來源
2. **Tauri 命令**：`serial_monitor_start` / `serial_monitor_stop` / `serial_monitor_send` / `serial_monitor_status`
3. **事件**：`codebridge://serial-data`（節流批次）、`codebridge://serial-state`（連線狀態）
4. **前端模組** `ui/src/lib/arduino/serial-monitor.js`：啟停、baud、HEX、時間戳、開發者輸入行
5. **UI**：終端機標題列下新增 `#serialControlBar`；面板底部新增開發者輸入行
6. **埠租約協調**：upload 前自動暫停 Monitor、上傳終態後依「自動重連」重開
7. **i18n** 中英對齊，移除 `SERIAL_MONITOR_NOT_IMPLEMENTED`
8. **測試**：Rust 單元測試、Vitest 單元測試、Playwright E2E

### 本次不做（明確排除）
- **Serial Plotter**（另立計畫）
- **DTR／RTS 自動重置**：`serialport` 4.x 需開 `unstable` feature 才能 `set_dtr`，
  成本效益比低；改以上傳後自動重連解決
- 檔案記錄 / log 匯出、時區設定、多視窗各自監看不同埠

---

## 後端設計

### 模組邊界（刻意不放進 `arduino/`）
`arduino/` 保持「不依賴 Tauri」的特性（可純單元測試）。序列監視器需要
`AppHandle` 推播事件，因此獨立成 `src-tauri/src/serial_monitor.rs`。

### 核心型別

```rust
/// 監看設定
pub struct MonitorConfig { pub port: String, pub baud: u32 }

/// 監看狀態（對應前端 `getState()`）
pub struct MonitorStatus {
    pub connected: bool,
    pub port: String,
    pub baud: u32,
    pub error: Option<String>,
}

/// 行切割器：把任意 chunk 的 bytes 轉成完整行
pub struct LineFramer { buffer: Vec<u8> }
impl LineFramer {
    pub fn push(&mut self, chunk: &[u8]) -> Vec<String>;  // 剝 \r、lossy UTF-8
    pub fn flush(&mut self) -> Option<String>;            // 結束時吐出殘餘
}

/// 一個執行中的監看 session
pub struct Session {
    pub port: String,
    pub baud: u32,
    stop: Arc<AtomicBool>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
}
```

### 執行緒模型
`serial_monitor_start` 開一條 OS thread：
1. `serialport::new(port, baud).timeout(50ms).open()` —— **50ms timeout 是重點**：
   讓 `read()` 週期性返回，才能檢查 stop 旗標；否則拔線時 thread 永久卡住
2. `pump(reader, &mut framer, &stop, &mut flush_policy, sink)`
3. 讀錯誤（拔線）→ emit `serial-state { connected: false, error }` → thread 結束

### 節流（沿用 `events.rs` 的雙門檻風格，但調快）
| 參數 | 值 | 理由 |
|---|---|---|
| 時間門檻 | **60ms** | 序列資料對延遲敏感，`events.rs` 的 200ms 是為編譯的下載進度調的，太慢 |
| 行數門檻 | **32 行** | 高流量時提早 flush，避免 UI 停滯 |
| 單行上限 | 4096 bytes | 沒有換行的壞資料不可讓緩衝無限成長 |

### HEX 模式在 Rust 端轉換
理由：中文 Big5／UTF-8 壞位元組在前端會變成 U+FFFD，轉成 HEX 後學生才看得到
真實內容 —— 這是除錯時的關鍵能力，前端不做位元組處理。

### 埠租約協調
```
serial_monitor_start
  → 若 state.port_lease 已被別人持有 → 拒絕（PORT_BUSY）
  → try_acquire_port(port) 成功 → 開 thread

upload_start（既有）
  → 取得 port 前呼叫 release_monitor_for_port(port)
     回傳原本的 MonitorConfig 存進 monitor_wants

上傳終態（release_port 之後）
  → 若 monitor_wants 有值且 auto_reconnect → 重新 start
```

`monitor_wants` 沿用 #cocoya 的 `SerialMonitorWant` 概念：記錄「使用者想監看的設定」，
與「是否正在監看」分離。

### 為什麼不沿用 `operation_cancel`
`operation_cancel(id)` 接受 operation id，而 Monitor 是**常駐程序**不是 operation。
混用會讓 `operations` registry 裡出現一個永不結束的條目。
**結論：新增 `serial_monitor_stop`**；`operation_cancel` 維持不動、前端仍無呼叫端。

---

## 前端設計

`ui/src/lib/arduino/serial-monitor.js`，架構仿 `board-detector.js`
（IIFE + `window.CodeBridgeSerialMonitor` + `init/getState/onChange/_reset`）。

| API | 說明 |
|---|---|
| `init({ store })` | 訂閱兩個事件、綁定控制列、訂閱 board-detector 的變化 |
| `start()` / `stop()` / `toggle()` | 呼叫後端；**純瀏覽器降級**：無 Tauri → toast，不拋錯 |
| `setBaud(n)` | **重啟** Monitor（序列埠 baud 無法熱改） |
| `setHex(bool)` / `setTimestamp(bool)` | 純前端顯示切換，不重啟 |
| `send(text)` | 開發者輸入行，附 `\n` |
| `pauseForUpload()` / `resumeAfterUpload()` | 由 `compile-controller.js` 呼叫 |

### 與既有模組的接點
- `compile-controller.js`：`doUpload()` 前 `pauseForUpload()`；收到上傳終態時 `resumeAfterUpload()`
- `board-detector.js`：埠從清單消失時自動 `stop()`；換埠且原本連著則重連
- `terminal-panel.js`：**不修改**（保持純面板職責）；序列行以 `kind: 'data'` 附加

### UI 佈局
```
[序列埠: COM3 ▾] [波特率: 9600 ▾] [☑時間戳] [☐HEX] [● 已連線]   [開啟/關閉] [清除] [×]
──────────────────────────────────────────────────────────────────────────
14:32:05.123  LED 已開啟                    ← terminal-line--data + --ts
──────────────────────────────────────────────────────────────────────────
[輸入訊息____________________] [傳送]     ← 開發者輸入行
```
- 波特率選項**直接沿用 arduino 模組既有清單**（300/1200/2400/4800/9600/14400/
  19200/28800/38400/57600/115200），與積木的 `BAUD` dropdown 一致，不新增 i18n key
- 顏色全部走 `presets.css` 的 semantic token，Engineer／Angel 兩套 preset 都要可讀

---

## TDD 流程

1. **Red**
   - Rust `serial_monitor.rs` 內測試：`framer_keeps_partial_tail`、
     `framer_strips_carriage_return`、`framer_respects_max_line_bytes`、
     `hex_encode_is_space_separated_uppercase`、`flush_policy_needs_time_or_lines`
   - Vitest `ui/tests/unit/serial-monitor.test.js`：`純瀏覽器時 start 回 false`、
     `baud 變更會重新 start`、`send 附加換行`、`埠消失時自動 stop`
   - Playwright `ui/tests/e2e/serial-monitor.spec.js`：控制列出現、HEX 切換、
     `data-action` 契約完整
2. **Green**：只寫讓測試通過的最小實作
3. **Refactor**：抽共用 throttle 工具
4. **驗證**：`cargo test`、`npx vitest run tests/unit`、`npx playwright test`、`npm run build`

---

## 風險與緩解

| 風險 | 緩解 |
|---|---|
| Monitor 佔用 COM 埠導致上傳失敗 | 沿用 `port_lease`；upload 前自動停 Monitor。**先做這項** |
| Windows 拔線時 `read()` 阻塞不返回 | `timeout(50ms)` + stop 旗標，不依賴阻塞返回 |
| 高流量塞爆 IPC | 雙門檻節流（60ms / 32 行），前端批次 append |
| 中文亂碼 | HEX 模式作為逃生門；HEX 在 Rust 端轉 |
| 前端 E2E 無法驗真實序列埠 | 沿用既有策略：Rust 單元測試 + 前端 mock；實機驗證由使用者執行（與 T2-E 相同模式） |
| `terminal-panel.js` 的 `MAX_LINES = 2000` 會把序列資料擠掉 | **決策：不改**。兩者共用面板就共用上限，使用者可用清除鈕；實測不足再議 |

---

## 下一步
1. 依 TDD 流程實作 `serial_monitor.rs` 純邏輯 + 測試
2. Tauri 命令與事件
3. 前端模組 + UI 控制列 + i18n
4. 與 `compile-controller.js` / `board-detector.js` 接線
5. 全量驗證 + 實機測試（UNO clone CH340）
