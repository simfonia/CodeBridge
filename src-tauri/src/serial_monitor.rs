//! 序列監視器（Serial Monitor）常駐程序。
//!
//! 位置刻意在 `arduino/` **之外**：`arduino` 模組保持不依賴 Tauri（可純單元測試），
//! 序列監視器需要 `AppHandle` 推播事件，屬於桌面應用層。
//!
//! # 為什麼需要它
//!
//! 使用者燒錄成功後，程式的 `Serial.println("LED 已開啟")` 目前沒有任何地方可以看。
//! `index.html` 的終端機標題早已寫著「序列監視器」，但面板只承載編譯輸出。
//!
//! # 最大的風險：序列埠是獨佔資源
//!
//! Windows 上同一個 COM 埠同一時間只能被一個程序開啟。若 Monitor 持續佔著 COM3，
//! 使用者按下「執行」時 avrdude 會直接失敗。因此 Monitor **必須**沿用既有的
//! `AppState::port_lease`（見 `lib.rs`），在 upload 前自動釋放、上傳後重連。
//!
//! # 執行緒模型
//!
//! 每次 `start()` 開一條 OS thread，內含 [`pump`]：
//! 1. `read()` 帶 50ms timeout —— **這是正確性需求而非效能考量**，讓讀取週期性
//!    返回才能檢查 stop 旗標，否則拔線時 thread 永久卡在 `read()`。
//! 2. 位元組交給 [`LineFramer`] 切成完整行（剝除 `\r`、寬容解碼）。
//! 3. 依 [`FlushPolicy`] 雙門檻節流後 emit 批次事件。

use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use serde::Serialize;

use crate::events::FlushPolicy;

/// 讀取逾時（毫秒）。見檔頭說明：這是正確性需求。
pub const READ_TIMEOUT_MS: u64 = 50;

/// 節流時間門檻（毫秒）。
///
/// 比 `events.rs` 的編譯用 200ms 更短：序列資料對延遲敏感，200ms 會讓
/// `Serial.print()` 的輸出明顯「成批跳出來」。
pub const FLUSH_INTERVAL_MS: u64 = 60;

/// 節流行數門檻。
pub const FLUSH_LINE_THRESHOLD: usize = 32;

/// 單行位元組上限。沒有換行的壞資料不可讓緩衝無限成長。
pub const MAX_LINE_BYTES: usize = 4096;

/// 預設波特率。
pub const DEFAULT_BAUD: u32 = 9600;

/// 可選的波特率清單（與 arduino 模組積木的 `BAUD` dropdown 一致）。
pub const SUPPORTED_BAUDS: [u32; 11] = [
    300, 1200, 2400, 4800, 9600, 14400, 19200, 28800, 38400, 57600, 115200,
];

/// 建立序列資料用的節流策略。
pub fn serial_flush_policy() -> FlushPolicy {
    FlushPolicy::with(
        std::time::Duration::from_millis(FLUSH_INTERVAL_MS),
        FLUSH_LINE_THRESHOLD,
    )
}

/// 監看設定。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorConfig {
    /// 序列埠名稱，例如 `COM3`。
    pub port: String,
    /// 波特率。
    pub baud: u32,
    /// 是否以 HEX 呈現資料。
    ///
    /// **存在設定裡而非只存在 session**：上傳會暫停 Monitor 再重連，
    /// 若 HEX 只留在 session 裡，使用者會在一次上傳後發現自己的設定
    /// 悄悄失效了。
    pub hex: bool,
    /// 開啟序列埠時是否以 DTR 觸發板子重置。
    ///
    /// UNO／Nano 的 reset 電路透過 DTR 觸發。開啟時把 DTR 拉低可讓板子
    /// 重啟並重**播**開機訊息。
    ///
    /// **為什麼需要它**：CH340 之類的 USB-UART 晶片會硬體重組時脈，所以
    /// PC 端用錯誤的 baud 讀到的**仍是正確文字而非亂碼**。使用者看到的
    /// 「沒有任何訊息」其實是開機訊息早已印完 —— 沒有 reset 就永遠看不到。
    ///
    /// 預設關閉：使用者可能已經在跑程式，開啟監視器不該擅自重置它。
    pub reset_on_open: bool,
}

impl MonitorConfig {
    /// 建立設定；不支援的波特率退回 [`DEFAULT_BAUD`]。
    ///
    /// 不退回而讓 `serialport` 開一個錯誤速率，只會得到神祕的開啟失敗。
    pub fn new(port: &str, baud: u32) -> Self {
        Self::with_hex(port, baud, false)
    }

    /// 建立設定並指定 HEX 模式。
    pub fn with_hex(port: &str, baud: u32, hex: bool) -> Self {
        Self::with_options(port, baud, hex, false)
    }

    /// 建立完整設定。
    pub fn with_options(port: &str, baud: u32, hex: bool, reset_on_open: bool) -> Self {
        Self {
            port: port.to_string(),
            baud: if SUPPORTED_BAUDS.contains(&baud) {
                baud
            } else {
                DEFAULT_BAUD
            },
            hex,
            reset_on_open,
        }
    }

    /// 設定是否可用於啟動監看（埠名不可為空）。
    pub fn is_valid(&self) -> bool {
        !self.port.trim().is_empty()
    }
}

/// 監看狀態（對應前端 `getState()`）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorStatus {
    /// 是否正在監看。
    pub connected: bool,
    /// 目前監看的埠（未連線時為最後嘗試的值）。
    pub port: String,
    /// 波特率。
    pub baud: u32,
    /// 是否以 HEX 呈現資料。
    pub hex: bool,
    /// 開啟時是否會重置開發板（讓開機訊息重播）。
    pub reset_on_open: bool,
    /// 錯誤訊息（`KEY|detail` 格式，供前端查 i18n）。
    pub error: Option<String>,
}

impl MonitorStatus {
    /// 未連線的初始狀態。
    pub fn idle() -> Self {
        Self {
            connected: false,
            port: String::new(),
            baud: DEFAULT_BAUD,
            hex: false,
            reset_on_open: false,
            error: None,
        }
    }

    /// 已連線。
    pub fn connected(config: &MonitorConfig) -> Self {
        Self {
            connected: true,
            port: config.port.clone(),
            baud: config.baud,
            hex: config.hex,
            reset_on_open: config.reset_on_open,
            error: None,
        }
    }

    /// 帶錯誤的中斷狀態。
    pub fn failed(config: &MonitorConfig, error: &str) -> Self {
        Self {
            connected: false,
            port: config.port.clone(),
            baud: config.baud,
            hex: config.hex,
            reset_on_open: config.reset_on_open,
            error: Some(error.to_string()),
        }
    }
}

/// 行切割器：把任意切分的位元組 chunk 轉成完整行。
///
/// **為什麼需要緩衝**：序列資料的邊界與 `read()` 的邊界無關 —— 一次 `read()`
/// 可能只拿到半個中文字（3 bytes 的 UTF-8），也可能一次拿到三行。直接
/// `String::from_utf8_lossy(chunk)` 會在每個 chunk 邊界產生 U+FFFD。
#[derive(Debug, Default)]
pub struct LineFramer {
    buffer: Vec<u8>,
}

impl LineFramer {
    /// 建立空的切割器。
    pub fn new() -> Self {
        Self { buffer: Vec::new() }
    }

    /// 尚未形成完整行的位元組數。
    pub fn pending_len(&self) -> usize {
        self.buffer.len()
    }

    /// 追加一個 chunk，回傳本次可組出的完整行的**原始位元組**。
    ///
    /// **為什麼回傳位元組而非字串**：HEX 模式必須看到未經解碼的原始內容。
    /// 若先解碼再 `as_bytes()` 重編碼，遇到 Big5／binary 資料會失真，
    /// HEX 模式就失去了「看見真實內容」的意義。
    pub fn push(&mut self, chunk: &[u8]) -> Vec<Vec<u8>> {
        let mut lines = Vec::new();
        for byte in chunk {
            if *byte == b'\n' {
                lines.push(self.take_line());
            } else {
                self.buffer.push(*byte);
                if self.buffer.len() > MAX_LINE_BYTES {
                    lines.push(self.take_line());
                }
            }
        }
        lines
    }

    /// 取出殘餘位元組作為最後一行（連線結束時呼叫）。
    pub fn flush(&mut self) -> Option<Vec<u8>> {
        if self.buffer.is_empty() {
            return None;
        }
        Some(self.take_line())
    }

    /// 取出並清空緩衝，剝除行尾 `\r`。
    fn take_line(&mut self) -> Vec<u8> {
        let bytes = std::mem::take(&mut self.buffer);
        match bytes.strip_suffix(b"\r") {
            Some(stripped) => stripped.to_vec(),
            None => bytes,
        }
    }
}

/// 把位元組轉為「空格分隔的大寫 HEX」字串。
///
/// **在 Rust 端轉換的理由**：中文 Big5／UTF-8 壞位元組送進 webview 會變成
/// U+FFFD，學生看到的是「看不懂的方框」；轉成 HEX 後才看得到真實內容。
/// 這是除錯時的關鍵能力，因此前端不做位元組處理。
pub fn hex_encode(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|byte| format!("{byte:02X}"))
        .collect::<Vec<_>>()
        .join(" ")
}

/// 把不可列印的字元轉成可見的佔位符。
///
/// **為什麼需要**：baud 不符時，CH340 的取樣時脈錯誤會產生垃圾位元組。
/// `decode_output` 的 Big5 分支是**總函式**（任何位元組序列都能「成功」解碼），
/// 因此垃圾會被解成**控制字元**（0x00–0x1F）—— 這些字元在終端機裡
/// **完全不可見**，使用者只會看到「空白行」，完全無從判斷發生了什麼
/// （2026-09-28 實機回報：顯示「已接收 N bytes」但文字全空白）。
///
/// 轉成 `<0xNN>` 後，使用者一眼就能看出「這裡有資料但不是文字」，
/// 進而意識到是波特率不符 —— 這是把不可診斷的症狀變成可診斷的關鍵。
fn make_control_chars_visible(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for ch in text.chars() {
        match ch {
            // 換行與 tab 是**合法**的排版控制，必須保留。
            '\n' | '\t' => out.push(ch),
            // 其餘 C0 控制字元、刪除字元、以及 C1 控制區都不可列印。
            c if (c as u32) < 0x20 || c as u32 == 0x7F || ((c as u32) >= 0x80 && (c as u32) <= 0x9F) => {
                out.push_str(&format!("<0x{:02X}>", c as u32));
            }
            c => out.push(c),
        }
    }
    out
}

/// 依模式決定輸出的顯示文字。
pub fn format_line(bytes: &[u8], hex: bool) -> String {
    if hex {
        hex_encode(bytes)
    } else {
        make_control_chars_visible(&decode_serial(bytes))
    }
}

/// 序列資料的解碼策略：**UTF-8 → latin-1**（**不**走 Big5/GBK/1252）。
///
/// **為什麼不能用 `decode_output` 的完整 fallback 鏈**：
/// 那條鏈是為了解**編譯器輸出**而設計的 —— zh-TW Windows 上 gcc/avrdude 會用
/// cp950（Big5）輸出中文錯誤訊息，因此需要 Big5 → GBK 的 fallback。
///
/// 但序列埠資料的編碼規則**完全不同**：
/// - Arduino 的 `String` 內部就是 **UTF-8**，`Serial.print("中文")` 送出的
///   是 UTF-8 位元組
/// - Arduino IDE 2.x 的 Serial Monitor 預設解碼也是 **UTF-8**
/// - 序列資料**沒有**任何編碼標記，Big5/GBK 在此毫無依據
///
/// 若沿用 Big5 fallback，壞位元組（例如 baud 不符時的垃圾）會被 Big5
/// **硬解成合法但錯誤的中文字** —— 使用者會看到完全無關的內容，
/// 比看到「原本的位元組」更難判斷問題。
///
/// latin-1 是 0x00–0xFF 對應 U+0000–U+00FF 的**完全保真**映射：
/// 至少使用者看到的就是實際送出的位元組。
fn decode_serial(bytes: &[u8]) -> String {
    // BOM 先剝除，否則 UTF-8 strict 會失敗而被誤判為非 UTF-8。
    let body = bytes.strip_prefix(&crate::arduino::encoding::UTF8_BOM).unwrap_or(bytes);
    if let Ok(text) = std::str::from_utf8(body) {
        return text.to_string();
    }
    // 非 UTF-8：latin-1 逐位元組保真。
    body.iter().map(|byte| *byte as char).collect()
}

/// 一個執行中的監看 session。
///
/// 讀取在獨立 thread 進行；`writer` 供 `serial_monitor_send` 寫入。
pub struct Session {
    /// 監看的埠。
    pub port: String,
    /// 波特率。
    pub baud: u32,
    /// 停止旗標；`pump` 每輪讀取後檢查。
    pub stop: Arc<AtomicBool>,
    /// 寫入端（供開發者輸入行使用）。
    pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
}

impl Session {
    /// 請求停止讀取。
    pub fn request_stop(&self) {
        self.stop.store(true, Ordering::SeqCst);
    }

    /// 是否已請求停止。
    pub fn is_stopping(&self) -> bool {
        self.stop.load(Ordering::SeqCst)
    }

    /// 寫入一行（自動補 `\n`）。
    pub fn send_line(&self, text: &str) -> Result<usize, String> {
        let mut writer = self
            .writer
            .lock()
            .map_err(|_| "SERIAL_MONITOR_SEND_FAILED|寫入鎖已失效".to_string())?;
        let payload = format!("{text}\n");
        writer
            .write_all(payload.as_bytes())
            .map_err(|err| format!("SERIAL_MONITOR_SEND_FAILED|{err}"))?;
        writer
            .flush()
            .map_err(|err| format!("SERIAL_MONITOR_SEND_FAILED|{err}"))?;
        Ok(payload.len())
    }
}

/// 閒置強制輸出的等待時間（毫秒）。
///
/// 資料抵達後若這段時間內沒有新資料，強制把殘餘位元組當成一行輸出。
///
/// **為什麼需要**：baud 設錯時，位元組邊界錯位讓換行符（0x0A）極少出現，
/// `LineFramer` 只在遇到 `\n` 才吐出行，於是資料全部卡在緩衝裡。
/// 使用者看到的是「切錯 baud 後完全沒反應，切回來才看到累積的亂碼」。
///
/// 250ms 兼顧兩者：足夠長可避免把剛到的半行誤切（9600 下傳 10 bytes
/// 只需 10ms），夠短到使用者不會覺得「卡住」。
pub const IDLE_FLUSH_MS: u64 = 250;

/// 判斷讀取錯誤是否只是「這次沒資料」。
///
/// **這是本模組最容易犯的錯**：`SerialPort::timeout()` 到期時回的是
/// `Err`，但它語意上是「沒資料」而非「失敗」。把它當斷線處理會讓
/// Monitor 在板子安靜時就死掉。
pub fn is_no_data(err: &std::io::Error) -> bool {
    matches!(
        err.kind(),
        std::io::ErrorKind::TimedOut | std::io::ErrorKind::WouldBlock
    )
}

/// 跑一次 `pump` 並回傳已接收的位元組數。
///
/// **為什麼要位元組數**：使用者看到「印出空白行」時，無法分辨
/// 「板子完全沒送資料」與「送了資料但解碼成空字串」—— 兩者畫面完全一樣。
/// 有這個數字就能立刻確認是「板子沒印」還是「我們收錯」；
/// 沒有它就只能在兩個假設之間來回猜。
///
/// `counter` 與 `pump` 同執行緒，因此用 `Cell` 即可（不需原子操作）。
pub fn pump_with_count<R, F>(
    reader: R,
    stop: &AtomicBool,
    hex: bool,
    counter: &std::cell::Cell<u64>,
    mut sink: F,
) -> u64
where
    R: Read,
    F: FnMut(Vec<String>, u64),
{
    pump(
        reader,
        stop,
        hex,
        LineFramer::new(),
        serial_flush_policy(),
        sink,
        counter,
    );
    counter.get()
}

/// 讀取迴圈的可測核心：從 `reader` 讀取、切行、依政策 emit。
///
/// **泛型化 `Read` 的理由**：真實 `SerialPort` 不可在測試中建立（需要硬體），
/// 泛型化後測試可餵入 `Cursor`，完整驗證切行與停止語意而不需接硬體。
///
/// `sink` 只在有實際內容時被呼叫（空批次不 emit），避免 UI 被無意義事件淹沒。
pub fn pump<R, F>(
    mut reader: R,
    stop: &AtomicBool,
    hex: bool,
    mut framer: LineFramer,
    mut policy: FlushPolicy,
    mut sink: F,
    counter: &std::cell::Cell<u64>,
) -> LineFramer
where
    R: Read,
    F: FnMut(Vec<String>, u64),
{
    let mut chunk = [0u8; 1024];
    let mut pending: Vec<String> = Vec::new();
    // 上次收到**實質資料**的時間。閒置逾時時用來強制切出沒有換行符的行。
    let idle_limit = std::time::Duration::from_millis(IDLE_FLUSH_MS);
    let mut last_data = std::time::Instant::now();

    loop {
        if stop.load(Ordering::SeqCst) {
            break;
        }
        match reader.read(&mut chunk) {
            Ok(0) => break,
            Ok(size) => {
                last_data = std::time::Instant::now();
                counter.set(counter.get() + size as u64);
                for line in framer.push(&chunk[..size]) {
                    pending.push(format_line(&line, hex));
                }
            }
            // **「沒有資料」不是錯誤**。`SerialPort::timeout()` 到期時 `read()`
            // 會回 `Err(TimedOut)`，這是它讓呼叫端能週期性檢查 stop 旗標的機制
            // —— 正是我們設 50ms timeout 的目的。非阻塞驅動則回 `WouldBlock`，
            // 語意完全相同。
            //
            // 早期版本把這個 Err 當成「板子斷線」而 `break`，導致 Monitor 在
            // 燒錄完、板子安靜下來的那一刻就死掉：終端機永遠顯示「未連線」，
            // 且 `Serial.println()` 永遠沒有任何輸出。
            Err(err) if is_no_data(&err) => {
                // 閒置逾時且緩衝有內容 → 強制切出一行。
                //
                // 這解決「baud 設錯就完全沒反應」：錯的 baud 讓位元組邊界錯位，
                // 換行符極少出現，資料會永遠卡在 `LineFramer` 的緩衝裡。
                if last_data.elapsed() >= idle_limit && framer.pending_len() > 0 {
                    if let Some(partial) = framer.flush() {
                        pending.push(format_line(&partial, hex));
                    }
                }
                if policy.take_flush(pending.len()) {
                    sink(std::mem::take(&mut pending), counter.get());
                }
                continue;
            }
            Err(err) => {
                // 真正的讀取錯誤（拔線）：轉成一行輸出讓使用者看到原因，
                // 然後結束 thread。
                pending.push(format!("SERIAL_ERROR_READ|{err}"));
                break;
            }
        }
        if policy.take_flush(pending.len()) {
            sink(std::mem::take(&mut pending), counter.get());
        }
    }

    // 收尾：殘餘位元組與尚未送出的行都不可丟（否則最後一句輸出會消失）。
    if let Some(tail) = framer.flush() {
        pending.push(format_line(&tail, hex));
    }
    if !pending.is_empty() {
        sink(pending, counter.get());
    }
    framer
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::arduino::encoding::decode_output;
    use std::cell::RefCell;
    use std::io::Cursor;

    /// 跑一次 `pump`（忽略位元組計數），收集所有 emit 出去的行。
    ///
    /// **單線程而非 spawn**：pump 的 sink 是同步呼叫，用 channel 反而要處理
    /// 接收端何時結束。改用 `RefCell` 直接收集，測試意圖更清楚。
    fn run(source: &[u8], stop: bool, hex: bool) -> Vec<String> {
        let collected: RefCell<Vec<String>> = RefCell::new(Vec::new());
        pump_with_count(
            Cursor::new(source.to_vec()),
            &AtomicBool::new(stop),
            hex,
            &std::cell::Cell::new(0),
            |batch, _bytes| collected.borrow_mut().extend(batch),
        );
        collected.into_inner()
    }

    // ---------------------------------------------------------------
    // LineFramer
    // ---------------------------------------------------------------

    #[test]
    fn framer_splits_complete_lines() {
        let mut framer = LineFramer::new();
        let lines = framer.push(b"hello\nworld\n");
        assert_eq!(lines.len(), 2);
        assert_eq!(decode_output(&lines[0]).text, "hello");
        assert_eq!(decode_output(&lines[1]).text, "world");
        assert_eq!(framer.pending_len(), 0);
    }

    #[test]
    fn framer_keeps_partial_tail() {
        // 核心情境：一次 read 只拿到半行，必須留到下次。
        let mut framer = LineFramer::new();
        assert!(framer.push(b"hel").is_empty());
        assert_eq!(framer.pending_len(), 3);
        assert_eq!(framer.push(b"lo\n").len(), 1);
    }

    #[test]
    fn framer_strips_carriage_return() {
        // Arduino 的 println 送出 \r\n；若不剝除，終端機每行末尾都有不可見字元。
        let mut framer = LineFramer::new();
        let lines = framer.push(b"line1\r\nline2\r\n");
        assert_eq!(decode_output(&lines[0]).text, "line1");
        assert_eq!(decode_output(&lines[1]).text, "line2");
    }

    #[test]
    fn framer_handles_crlf_split_across_chunks() {
        // \r 與 \n 可能在不同 chunk 抵達。
        let mut framer = LineFramer::new();
        assert!(framer.push(b"abc\r").is_empty());
        let lines = framer.push(b"\ndef\n");
        assert_eq!(decode_output(&lines[0]).text, "abc");
    }

    #[test]
    fn framer_preserves_multibyte_split_across_chunks() {
        // 「中」是 3 bytes 的 UTF-8；切在 chunk 邊界時不可破壞位元組。
        let mut framer = LineFramer::new();
        let bytes = "中文\n".as_bytes();
        assert!(framer.push(&bytes[0..4]).is_empty());
        let lines = framer.push(&bytes[4..]);
        assert_eq!(decode_output(&lines[0]).text, "中文");
    }

    #[test]
    fn framer_respects_max_line_bytes() {
        // 沒有換行的壞資料不可讓緩衝無限成長。
        let mut framer = LineFramer::new();
        let flood = vec![b'x'; MAX_LINE_BYTES + 10];
        assert_eq!(framer.push(&flood).len(), 1, "oversized line is force-cut");
        assert!(framer.pending_len() <= MAX_LINE_BYTES);
    }

    #[test]
    fn framer_flush_returns_remaining_partial_line() {
        let mut framer = LineFramer::new();
        framer.push(b"no newline");
        assert!(framer.flush().is_some());
        assert!(framer.flush().is_none(), "buffer already drained");
    }

    #[test]
    fn framer_keeps_empty_lines() {
        // 空行是「程式印了一個空行」的忠實呈現，不可吞掉 —— 那會改變學生
        // 對輸出結構的理解。終端機面板另會忽略全空字串以免佔版面。
        let mut framer = LineFramer::new();
        let lines = framer.push(b"a\n\nb\n");
        assert_eq!(lines.len(), 3);
        assert!(lines[1].is_empty());
    }

    // ---------------------------------------------------------------
    // HEX 編碼
    // ---------------------------------------------------------------

    #[test]
    fn hex_encode_is_space_separated_uppercase() {
        assert_eq!(hex_encode(&[0x00, 0x0A, 0xFF]), "00 0A FF");
    }

    #[test]
    fn hex_encode_preserves_leading_zeros() {
        // 少了前導零會讓學生對照 bytes 時算錯位置。
        assert_eq!(hex_encode(&[0x01, 0x02]), "01 02");
    }

    #[test]
    fn hex_encode_of_empty_is_empty() {
        assert_eq!(hex_encode(&[]), "");
    }

    #[test]
    fn format_line_switches_between_text_and_hex() {
        let bytes = "LED".as_bytes();
        assert_eq!(format_line(bytes, false), "LED");
        assert_eq!(format_line(bytes, true), "4C 45 44");
    }

    #[test]
    fn serial_data_prefers_utf8_and_falls_back_to_latin1_not_big5() {
        // 使用者提問「為何用 big5 而不是 utf8」—— 這指出了設計缺陷。
        //
        // `encoding.rs` 的 Big5/GBK fallback 是為了解**編譯器輸出**而存在
        // （zh-TW Windows 的 gcc 用 cp950）。序列資料沒有這個前提：
        // - Arduino 的 `String` 內部就是 UTF-8
        // - Arduino IDE 2.x 的 Serial Monitor 預設也是 UTF-8
        //
        // 用 Big5 硬解壞位元組會產出**合法但完全無關的中文字**，
        // 比直接顯示原始位元組更難判斷問題。
        let utf8 = "中文字".as_bytes();
        assert_eq!(format_line(utf8, false), "中文字", "有效 UTF-8 必須正確解碼");

        // 0xFF 0xFE 在 Big5 會被解成奇怪的中文；latin-1 應給出實際的 ÿþ。
        let bad = [0xFFu8, 0xFE];
        let text = format_line(&bad, false);
        assert_eq!(
            text, "ÿþ",
            "非 UTF-8 必須用 latin-1 逐位元組保真，而不是 Big5 硬解"
        );
    }

    #[test]
    fn latin1_fallback_is_honest_where_big5_would_guess() {
        // 這個測試**記錄兩條解碼路徑的分歧點**，證明序列資料不該走 Big5。
        //
        // 0xA4 0xA4 在 Big5 是「中」，在 latin-1 是 U+00A4（¤）。
        // Big5 解碼器是**總函式**（任何位元組序列都能「成功」解碼），
        // 所以它會在 windows-1252 之前被接受 —— 也就是說，
        // `decode_output` 遇到非 UTF-8 的序列資料時，**總是**猜成中文。
        //
        // 對序列資料這個猜測是錯的：Arduino 的 `String` 內部是 UTF-8，
        // Arduino IDE 的 Serial Monitor 預設也解 UTF-8，序列埠上根本不會
        // 出現 Big5。猜錯的結果是使用者看到**完全無關的漢字**，
        // 比看到實際位元組更難判斷問題出在哪。
        let bytes = [0xA4u8, 0xA4];

        // 編譯器輸出專用路徑：猜成 Big5 中文。
        assert_eq!(
            decode_output(&bytes).encoding,
            crate::arduino::encoding::EncodingKind::Big5,
            "decode_output 會把無法解析為 UTF-8 的序列猜成 Big5"
        );

        // 序列資料專用路徑：latin-1 逐位元組保真，不猜。
        assert_eq!(format_line(&bytes, false), "\u{00A4}\u{00A4}");
    }

    #[test]
    fn control_characters_are_made_visible_in_text_mode() {
        // 實機回報（2026-09-28）：9600 的程式用 115200 監視器看，
        // 狀態列顯示「已接收 N bytes」但**文字全部空白**。
        //
        // 根因：baud 不符 → CH340 取樣時脈錯誤 → 垃圾位元組 →
        // `decode_output` 的 Big5 分支是總函式，把它們「成功」解成
        // 控制字元（0x00–0x1F）→ 終端機裡完全不可見 → 使用者只看到空白。
        //
        // 這個測試鎖定「不可列印字元必須可見」：它是把不可診斷的症狀
        // 轉成可診斷的關鍵 —— 使用者看到 `<0x00><0x01>` 就會知道
        // 是波特率問題，而不是「程式沒有輸出」。
        let garbage = [0x00u8, 0x01, 0x1B, 0x1F];
        let text = format_line(&garbage, false);
        assert!(
            text.contains("<0x00>") && text.contains("<0x01>"),
            "控制字元必須可見，否則使用者只會看到空白：{text:?}"
        );
    }

    #[test]
    fn normal_printable_text_is_untouched() {
        // 保護「正常輸出不可被這個轉換污染」—— 若把正常文字也改掉，
        // 會比原本的空白更糟（使用者看到 `<0x48>ello` 之類的東西）。
        assert_eq!(format_line(b"hello", false), "hello");
        assert_eq!(format_line("中文".as_bytes(), false), "中文");
        // tab 是合法的排版控制，必須保留而不是變成佔位符。
        assert_eq!(format_line(b"a\tb", false), "a\tb");
    }

    #[test]
    fn hex_mode_shows_the_real_bytes_text_mode_cannot_reveal() {        // **為什麼 HEX 模式值得存在**：`decode_output` 的 fallback 鏈
        // （UTF-8 → Big5 → GBK → 1252 → latin-1）保證「永不產生 U+FFFD」，
        // 代價是**猜測**編碼。0xFF 0xFE 在 latin-1/1252 下看起來像合法的
        // 「ÿþ」，學生會誤以為板子真的印了這些字。
        // HEX 模式顯示未經猜測的原始位元組，這才是除錯時唯一可信的資訊。
        let raw = vec![0xFF, 0xFE, 0x00];
        assert_eq!(format_line(&raw, true), "FF FE 00");
        // 文字模式走 fallback 鏈，結果與原始位元組無關（是猜測來的）。
        assert_ne!(format_line(&raw, false), format_line(&raw, true));
        // 但對有效 UTF-8，兩者必須語意一致（HEX 只是換種表示法）。
        let utf8 = "中文字".as_bytes();
        assert_eq!(decode_output(utf8).text, "中文字");
        assert_eq!(hex_encode(utf8), "E4 B8 AD E6 96 87 E5 AD 97");
    }

    // ---------------------------------------------------------------
    // 設定與狀態
    // ---------------------------------------------------------------

    #[test]
    fn unsupported_baud_falls_back_to_default() {
        assert_eq!(MonitorConfig::new("COM3", 12345).baud, DEFAULT_BAUD);
        assert_eq!(MonitorConfig::new("COM3", 115200).baud, 115200);
    }

    #[test]
    fn empty_port_is_not_valid() {
        assert!(!MonitorConfig::new("", 9600).is_valid());
        assert!(!MonitorConfig::new("   ", 9600).is_valid());
        assert!(MonitorConfig::new("COM3", 9600).is_valid());
    }

    #[test]
    fn status_tracks_connection_lifecycle() {
        let config = MonitorConfig::new("COM3", 9600);
        assert!(!MonitorStatus::idle().connected);
        assert!(MonitorStatus::connected(&config).connected);
        let failed = MonitorStatus::failed(&config, "SERIAL_ERROR_OPEN|找不到 COM3");
        assert!(!failed.connected);
        assert_eq!(failed.error.as_deref(), Some("SERIAL_ERROR_OPEN|找不到 COM3"));
    }

    #[test]
    fn default_baud_is_in_the_supported_list() {
        assert!(SUPPORTED_BAUDS.contains(&DEFAULT_BAUD));
    }

    #[test]
    fn open_options_reset_the_board_only_when_asked() {
        // **為什麼需要 DTR reset**：CH340 之類的 USB-UART 晶片會**硬體重組時脈**，
        // 所以 PC 端用 115200 去讀一個 9600 的程式，**收到的仍是正確文字**，
        // 不是亂碼。使用者看到的「沒有任何訊息」其實是：開機訊息在他
        // 開啟監視器之前就已經印完了。
        //
        // UNO 的 reset 電路透過 DTR 觸發，因此開啟時把 DTR 拉低即可讓板子
        // 重啟並重**播**開機訊息 —— 與 Arduino IDE 開啟 Serial Monitor 的行為一致。
        let quiet = MonitorConfig::new("COM3", 9600);
        assert!(!quiet.reset_on_open, "預設不強制 reset，使用者可能已在執行程式");
        let resetting = MonitorConfig::with_options("COM3", 9600, false, true);
        assert!(resetting.reset_on_open);
    }

    // ---------------------------------------------------------------
    // 節流
    // ---------------------------------------------------------------

    #[test]
    fn serial_flush_policy_triggers_on_line_threshold() {
        assert!(serial_flush_policy().take_flush(FLUSH_LINE_THRESHOLD));
    }

    #[test]
    fn serial_flush_policy_is_faster_than_compile_policy() {
        // 序列資料的延遲感受比編譯進度強烈得多，門檻必須不同。
        assert!(!crate::events::FlushPolicy::new().take_flush(FLUSH_LINE_THRESHOLD));
    }

    // ---------------------------------------------------------------
    // pump（以假的 Read 驗證，不碰真實硬體）
    // ---------------------------------------------------------------

    #[test]
    fn pump_emits_every_line() {
        assert_eq!(run(b"one\ntwo\nthree\n", false, false), vec!["one", "two", "three"]);
    }

    #[test]
    fn pump_emits_trailing_partial_line() {
        // 沒有結尾換行的最後一句不可丟，否則學生看不到輸出。
        assert_eq!(run(b"done", false, false), vec!["done"]);
    }

    #[test]
    fn pump_stops_reading_after_flag_is_set() {
        // 旗標一開始就為 true：資料完全不該被讀出。
        assert!(run(b"never read\n", true, false).is_empty());
    }

    #[test]
    fn pump_in_hex_mode_emits_hex_text() {
        assert_eq!(run(b"AB\n", false, true), vec!["41 42"]);
    }

    #[test]
    fn pump_counts_bytes_so_users_can_tell_empty_from_silent() {
        // 使用者回報「印出空白行」—— 他無法判斷板子到底有沒有送資料。
        // 對「完全沒資料」與「有資料但解碼成空」兩種情況，畫面看起來一樣。
        // 讓模組回報已接收位元組數，是唯一能確認「是板子沒印」還是
        // 「是我們收錯」的手段 —— 沒有它就只能在兩個假設之間猜。
        let collected: RefCell<Vec<String>> = RefCell::new(Vec::new());
        let total = pump_with_count(
            Cursor::new(b"abc\n".to_vec()),
            &AtomicBool::new(false),
            false,
            &std::cell::Cell::new(0),
            |batch, _bytes| collected.borrow_mut().extend(batch),
        );
        assert_eq!(total, 4, "4 個位元組（含換行）");
        assert_eq!(collected.into_inner(), vec!["abc"]);
    }

    #[test]
    fn pump_count_is_zero_when_nothing_arrives() {
        // 對照組：真的沒資料時必須是 0，不能是 1 或其他「看起來有東西」的值。
        let collected: RefCell<Vec<String>> = RefCell::new(Vec::new());
        let total = pump_with_count(
            Cursor::new(Vec::new()),
            &AtomicBool::new(true),
            false,
            &std::cell::Cell::new(0),
            |batch, _bytes| collected.borrow_mut().extend(batch),
        );
        assert_eq!(total, 0);
        assert!(collected.into_inner().is_empty());
    }

    #[test]
    fn pump_reports_read_errors_as_a_line_not_a_panic() {        // 拔線時 `read()` 會回 Err；必須變成使用者看得懂的訊息。
        struct Failing;
        impl Read for Failing {
            fn read(&mut self, _: &mut [u8]) -> std::io::Result<usize> {
                Err(std::io::Error::new(
                    std::io::ErrorKind::BrokenPipe,
                    "device disconnected",
                ))
            }
        }
        let collected: RefCell<Vec<String>> = RefCell::new(Vec::new());
        pump(
            Failing,
            &AtomicBool::new(false),
            false,
            LineFramer::new(),
            serial_flush_policy(),
            |batch, _bytes| collected.borrow_mut().extend(batch),
            &std::cell::Cell::new(0),
        );
        let lines = collected.into_inner();
        assert_eq!(lines.len(), 1);
        assert!(lines[0].starts_with("SERIAL_ERROR_READ|"));
    }

    #[test]
    fn pump_treats_timeout_as_no_data_not_disconnect() {
        // **這是實機才會暴露的缺陷**：`serialport` 設了 `timeout(50ms)` 後，
        // 沒有資料時 `read()` 會回 `Err(TimedOut)` —— 那是**正常**的輪詢結果，
        // 不是板子斷線。若把它當致命錯誤，Monitor 會在使用者燒錄完、
        // 板子安靜下來的那一刻就死掉，並印出誤導的「SERIAL_ERROR_READ」。
        // 症狀：終端機一直顯示「未連線」，且 `Serial.println()` 沒有任何輸出。
        let collected: RefCell<Vec<String>> = RefCell::new(Vec::new());

        // 前兩次讀取回 TimedOut（模擬板子靜默），第三次給一筆資料，
        // 第四次回 Ok(0) 模擬串流結束 —— 這樣迴圈會自然收尾，
        // 不需要靠 stop 旗標，測試就不會與實作的時序耦合。
        struct SlowThenData {
            reads: usize,
        }
        impl Read for SlowThenData {
            fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
                self.reads += 1;
                match self.reads {
                    1 | 2 => Err(std::io::Error::new(
                        std::io::ErrorKind::TimedOut,
                        "Operation timed out",
                    )),
                    3 => {
                        let data = b"LED on\n";
                        buf[..data.len()].copy_from_slice(data);
                        Ok(data.len())
                    }
                    _ => Ok(0),
                }
            }
        }

        pump(
            SlowThenData { reads: 0 },
            &AtomicBool::new(false),
            false,
            LineFramer::new(),
            serial_flush_policy(),
            |batch, _bytes| collected.borrow_mut().extend(batch),
            &std::cell::Cell::new(0),
        );

        let lines = collected.into_inner();
        assert_eq!(lines, vec!["LED on"], "timeout must not kill the monitor");
        assert!(
            !lines.iter().any(|line| line.starts_with("SERIAL_ERROR_READ|")),
            "timeout must not be reported as a read error"
        );
    }

    #[test]
    fn pump_treats_would_block_as_no_data() {
        // Unix 與部分驅動在非阻塞模式下回 `WouldBlock`，語意與 TimedOut 相同。
        let collected: RefCell<Vec<String>> = RefCell::new(Vec::new());

        struct WouldBlockThenData {
            reads: usize,
        }
        impl Read for WouldBlockThenData {
            fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
                self.reads += 1;
                match self.reads {
                    1 => Err(std::io::Error::new(
                        std::io::ErrorKind::WouldBlock,
                        "would block",
                    )),
                    2 => {
                        let data = b"ok\n";
                        buf[..data.len()].copy_from_slice(data);
                        Ok(data.len())
                    }
                    _ => Ok(0),
                }
            }
        }

        pump(
            WouldBlockThenData { reads: 0 },
            &AtomicBool::new(false),
            false,
            LineFramer::new(),
            serial_flush_policy(),
            |batch, _bytes| collected.borrow_mut().extend(batch),
            &std::cell::Cell::new(0),
        );

        assert_eq!(collected.into_inner(), vec!["ok"]);
    }

    #[test]
    fn is_no_data_only_covers_polling_results() {
        // 真正的斷線（拔線）絕不可被當成「沒資料」而無限重試 ——
        // 那會讓終端機永遠停在「已連線」卻沒有任何輸出。
        assert!(is_no_data(&std::io::Error::new(
            std::io::ErrorKind::TimedOut,
            "x"
        )));
        assert!(is_no_data(&std::io::Error::new(
            std::io::ErrorKind::WouldBlock,
            "x"
        )));
        for kind in [
            std::io::ErrorKind::BrokenPipe,
            std::io::ErrorKind::NotFound,
            std::io::ErrorKind::PermissionDenied,
            std::io::ErrorKind::UnexpectedEof,
        ] {
            assert!(!is_no_data(&std::io::Error::new(kind, "x")), "{kind:?}");
        }
    }

    #[test]
    fn pump_flushes_a_line_that_never_ends_with_newline() {
        // **錯誤 baud 的實機症狀**：板子以 9600 送、監聽端用 115200 讀，
        // 位元組邊界錯位後幾乎不會出現 0x0A。`LineFramer` 只在遇到 `\n`
        // 才吐出行，於是所有資料都卡在緩衝裡 —— 使用者看到「沒有動靜」，
        // 切回正確 baud 後才看到累積的亂碼。
        //
        // 解法：閒置一段時間後強制把殘餘位元組當成一行輸出。
        //
        // **測試關鍵**：必須在 pump **尚未結束**（尚未收到 `Ok(0)`）時
        // 就觀察到輸出，否則只是在測 EOF 收尾的既有 `flush()`，
        // 這個測試會假綠。
        use std::sync::Arc;

        let collected: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));

        struct GarbageThenIdle {
            reads: usize,
        }
        impl Read for GarbageThenIdle {
            fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
                self.reads += 1;
                match self.reads {
                    // 一次送出一段沒有換行符的亂碼。
                    1 => {
                        let garbage = [0xF1u8, 0xA2, 0xC3, 0x9E, 0x88];
                        buf[..garbage.len()].copy_from_slice(&garbage);
                        Ok(garbage.len())
                    }
                    // 之後持續「沒資料」且**永不**回 Ok(0) —— 模擬錯誤 baud 下
                    // 連線仍然開著、但再也沒有可解碼的資料抵達。
                    _ => {
                        std::thread::sleep(std::time::Duration::from_millis(5));
                        Err(std::io::Error::new(
                            std::io::ErrorKind::TimedOut,
                            "Operation timed out",
                        ))
                    }
                }
            }
        }

        let stop = Arc::new(AtomicBool::new(false));
        let collected_for_sink = collected.clone();
        let stop_for_reader = stop.clone();
        let worker = std::thread::spawn(move || {
            let framer = pump(
                GarbageThenIdle { reads: 0 },
                &stop_for_reader,
                false,
                LineFramer::new(),
                serial_flush_policy(),
                move |batch, _bytes| collected_for_sink.lock().expect("collected").extend(batch),
                &std::cell::Cell::new(0),
            );
            framer
        });

        // 等 pump 有時間收到亂碼並進入閒置。
        //
        // **時間餘裕**：idle flush 是 250ms，節流另有 60ms，加上 thread 排程
        // 延遲 —— 原本的 300ms 幾乎沒有餘裕，在負載較高的機器上會間歇失敗
        // （實測連續三次執行中就失敗一次）。改用 2.5 倍於 idle 門檻。
        std::thread::sleep(std::time::Duration::from_millis(IDLE_FLUSH_MS * 3));
        let snapshot = collected.lock().expect("collected").clone();
        stop.store(true, Ordering::SeqCst);
        let _ = worker.join();

        assert!(
            !snapshot.is_empty(),
            "沒有換行符的資料必須在連線仍開著時被強制輸出，\
             否則使用者切 baud 錯誤時會看到「沒有動靜」。\
             實際收集到：{snapshot:?}"
        );
    }

    #[test]
    fn pump_still_prefers_newline_delimited_lines() {
        // 閒置強制輸出**不可**破壞正常的換行切分：有 `\n` 的資料
        // 必須在遇換行時就吐出，不可等到閒置才整段倒出來。
        let collected: RefCell<Vec<String>> = RefCell::new(Vec::new());

        struct NewlineThenIdle {
            reads: usize,
        }
        impl Read for NewlineThenIdle {
            fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
                self.reads += 1;
                match self.reads {
                    1 => {
                        let data = b"first\nsecond\n";
                        buf[..data.len()].copy_from_slice(data);
                        Ok(data.len())
                    }
                    2..=12 => Err(std::io::Error::new(
                        std::io::ErrorKind::TimedOut,
                        "Operation timed out",
                    )),
                    _ => Ok(0),
                }
            }
        }

        pump(
            NewlineThenIdle { reads: 0 },
            &AtomicBool::new(false),
            false,
            LineFramer::new(),
            serial_flush_policy(),
            |batch, _bytes| collected.borrow_mut().extend(batch),
            &std::cell::Cell::new(0),
        );

        let lines = collected.into_inner();
        assert_eq!(
            lines,
            vec!["first", "second"],
            "換行切分不可被閒置強制輸出干擾"
        );
    }

    // ---------------------------------------------------------------
    // Session 的送出語意
    // ---------------------------------------------------------------

    /// 可觀察的假寫入端，記錄實際寫入的位元組。
    struct FakeWriter(Arc<Mutex<Vec<u8>>>);

    impl Write for FakeWriter {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            self.0.lock().expect("writer").extend_from_slice(buf);
            Ok(buf.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }

    fn fake_session(recorded: Arc<Mutex<Vec<u8>>>) -> Session {
        Session {
            port: "COM3".to_string(),
            baud: 9600,
            stop: Arc::new(AtomicBool::new(false)),
            writer: Arc::new(
                Mutex::new(Box::new(FakeWriter(recorded)) as Box<dyn Write + Send>),
            ),
        }
    }

    #[test]
    fn send_line_appends_a_newline() {
        // Arduino 的 Serial.readStringUntil('\n') 需要結尾換行才會回傳。
        let written = Arc::new(Mutex::new(Vec::new()));
        let session = fake_session(written.clone());
        assert_eq!(session.send_line("hello").expect("write"), 6);
        assert_eq!(&*written.lock().expect("writer"), b"hello\n");
    }

    #[test]
    fn stop_flag_round_trips() {
        let session = fake_session(Arc::new(Mutex::new(Vec::new())));
        assert!(!session.is_stopping());
        session.request_stop();
        assert!(session.is_stopping());
    }
}
