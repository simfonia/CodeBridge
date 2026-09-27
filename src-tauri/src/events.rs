//! 把長作業的串流輸出推播到前端的 glue 層。
//!
//! 位置刻意在 `arduino/` **之外**：`arduino` 模組保持不依賴 Tauri（可用於
//! 純單元測試與未來的其他 host），事件推播只屬於桌面應用層。
//!
//! 節流採 #cocoya `commands/mcu.rs` 的**雙門檻**策略：`200ms` **或** `64 行`
//! 任一達成就 emit。單用時間會在高輸出時把事件塞爆 IPC；單用行數則在
//! 「長時間沒有輸出」時（例如 `core install` 下載）讓 UI 沒有回饋。

use std::collections::VecDeque;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::arduino::operations::{OperationKind, OperationState};
use crate::arduino::runner::{OutputSink, StreamKind};
use crate::events::names as event_names;

/// 供命令與事件推播使用的事件名稱。
///
/// 集中管理避免拼字不一致；前端以相同字串 `listen`（見
/// `ui/src/lib/tauri/bridge.js`）。
pub mod names {
    /// 工具鏈狀態變更。
    pub const TOOLCHAIN_STATUS: &str = "codebridge://toolchain-status";
    /// 作業狀態更新（compile／upload 的逐行進度）。
    pub const OPERATION_STATUS: &str = "codebridge://operation-status";
    /// 編譯診斷結果（作業結束時一次送出完整清單）。
    pub const COMPILE_DIAGNOSTICS: &str = "codebridge://compile-diagnostics";
    /// 視窗被要求關閉（攔截 CloseRequested 後通知前端處理未儲存變更）。
    pub const REQUEST_CLOSE: &str = "codebridge://request-close";
    /// 序列埠清單變化（熱插拔輪詢）。
    pub const SERIAL_PORTS_CHANGED: &str = "codebridge://serial-ports-changed";
    /// 板子偵測結果（port → fqbn 對應）。
    pub const BOARD_DETECTED: &str = "codebridge://board-detected";
    /// 工具鏈可執行狀態改變（安裝／移除 core、library）。
    pub const TOOLCHAIN_CHANGED: &str = "codebridge://toolchain-changed";
}

/// 序列埠輪詢週期（毫秒）。
///
/// 1500ms 對齊 #cocoya：使用者插拔板子的動作以秒為單位，週期再短只會增加
/// `serialport::available_ports()` 的系統呼叫次數（Windows 上需列舉裝置管理樹）。
pub const PORT_POLL_INTERVAL_MS: u64 = 1500;

/// 一個序列埠的識別資訊。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortInfo {
    /// 埠名稱，例如 `COM3`。
    pub port: String,
    /// 廠商 ID（十六進位字串）。
    pub vid: Option<String>,
    /// 產品 ID（十六進位字串）。
    pub pid: Option<String>,
}

impl PortInfo {
    /// 僅有埠名稱（VID／PID 未知）。
    pub fn named(port: &str) -> Self {
        Self {
            port: port.to_string(),
            vid: None,
            pid: None,
        }
    }

    /// 帶 VID／PID 的埠。
    pub fn with_ids(port: &str, vid: Option<u16>, pid: Option<u16>) -> Self {
        Self {
            port: port.to_string(),
            vid: vid.map(hex4),
            pid: pid.map(hex4),
        }
    }

    /// 計算用於 diff 的簽章。
    ///
    /// **必須包含 VID／PID**：只比對埠名會漏掉「同一個 COM 口插上不同板子」
    /// —— 埠名不變但板子變了，UI 必須重新判斷 FQBN。
    pub fn signature(&self) -> String {
        format!(
            "{}|{}|{}",
            self.port,
            self.vid.as_deref().unwrap_or_default(),
            self.pid.as_deref().unwrap_or_default()
        )
    }
}

/// 把 u16 轉為 4 位大寫十六進位（arduino-cli 與 serialport 的慣例）。
fn hex4(value: u16) -> String {
    format!("{value:04X}")
}

/// 掃描結果的簽章（依序列埠順序串接）。
pub fn port_signature(ports: &[PortInfo]) -> String {
    ports
        .iter()
        .map(PortInfo::signature)
        .collect::<Vec<_>>()
        .join("\n")
}

/// 序列埠變化類型（序列化名稱）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PortChange {
    /// 首次掃描（沒有基準可比對）。
    Initial,
    /// 有埠被插入。
    Added,
    /// 有埠被移除。
    Removed,
    /// 埠名相同但 VID／PID 改變（換了不同的板子）。
    Replaced,
    /// 沒有實質變化。
    Unchanged,
}

impl PortChange {
    /// 是否應該推送事件。
    ///
    /// `Unchanged` **不推送**：1500ms 一次的事件會讓前端反覆重建下拉清單，
    /// 使用者已選好的序列埠會被不斷重設。
    pub fn should_emit(self) -> bool {
        !matches!(self, PortChange::Unchanged)
    }
}

/// 兩次掃描的差異結果。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PortDiff {
    /// 變化類型。
    pub change: PortChange,
    /// 目前的埠名稱（已排序）。
    pub ports: Vec<String>,
    /// 新增的埠名。
    pub added: Vec<String>,
    /// 移除的埠名。
    pub removed: Vec<String>,
}

/// 判斷兩次掃描之間的變化（純函式，不碰 I/O 與 Tauri）。
///
/// 判定順序刻意為**先比簽章**：簽章相同時直接回 `Unchanged`，不做後續比對 ——
/// 1500ms 一次的多數輪詢都會走到這裡，是最熱的路徑。
pub fn diff_ports(current: &[PortInfo], previous: Option<&[PortInfo]>) -> PortDiff {
    let ports: Vec<String> = current.iter().map(|port| port.port.clone()).collect();
    let Some(previous) = previous else {
        return PortDiff {
            change: PortChange::Initial,
            ports,
            added: Vec::new(),
            removed: Vec::new(),
        };
    };

    if port_signature(current) == port_signature(previous) {
        return PortDiff {
            change: PortChange::Unchanged,
            ports,
            added: Vec::new(),
            removed: Vec::new(),
        };
    }

    let added: Vec<String> = current
        .iter()
        .filter(|port| !previous.iter().any(|old| old.port == port.port))
        .map(|port| port.port.clone())
        .collect();
    let removed: Vec<String> = previous
        .iter()
        .filter(|old| !current.iter().any(|port| port.port == old.port))
        .map(|old| old.port.clone())
        .collect();

    let change = match (added.is_empty(), removed.is_empty()) {
        (false, true) => PortChange::Added,
        (true, false) => PortChange::Removed,
        // 埠名集合完全相同但簽章不同 → 同名埠換了板子。
        (true, true) => PortChange::Replaced,
        // 同時有新增與移除（例如 USB Hub 重新列舉）：以新增為主。
        (false, false) => PortChange::Added,
    };

    PortDiff {
        change,
        ports,
        added,
        removed,
    }
}

/// 序列埠清單變更事件的 payload。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SerialPortsChanged {
    /// 目前的序列埠名稱（已排序）。
    pub ports: Vec<String>,
    /// 變化類型。
    pub change: PortChange,
    /// 新增的埠。
    pub added: Vec<String>,
    /// 移除的埠。
    pub removed: Vec<String>,
}

impl From<&PortDiff> for SerialPortsChanged {
    fn from(diff: &PortDiff) -> Self {
        Self {
            ports: diff.ports.clone(),
            change: diff.change,
            added: diff.added.clone(),
            removed: diff.removed.clone(),
        }
    }
}

/// 預設的時間門檻。
pub const FLUSH_INTERVAL: Duration = Duration::from_millis(200);

/// 預設的行數門檻。
pub const FLUSH_LINE_THRESHOLD: usize = 64;

/// 節流緩衝的預設容量上限。
///
/// 一次 flush 送出前累積的行數上限。`core install` 級別的作業可能吐出上千行
/// 下載進度，若無上限緩衝會讓記憶體無限成長；超出時丟棄最舊的行。
pub const DEFAULT_LINE_BUFFER_CAPACITY: usize = 512;

/// 一行輸出（附帶來源管線）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ProgressLine {
    /// 行內容（已去除換行符並完成寬容解碼）。
    pub text: String,
    /// 輸出的來源管線。
    pub stream: StreamKind,
}

/// 節流用的行緩衝。
///
/// **為什麼需要它**：舊實作只保留 `last_line`（一行）並永遠以 `take_flush(1)`
/// 判斷，造成兩個缺陷：
/// 1. `64 行`門檻永遠不觸發（pending 恆為 1），只有時間門檻在起作用；
/// 2. flush 之間的所有中間行都被丟棄 —— 編譯輸出裡的錯誤訊息、gcc 進度
///    大多落在被丟棄的區段，終端機只會看到零星幾行。
///
/// 抽成獨立的純型別（不依賴 `AppHandle`）後，緩衝行為可在沒有 Tauri app 的
/// 情況下完整驗證。
#[derive(Debug, Clone)]
pub struct LineBuffer {
    lines: VecDeque<ProgressLine>,
    capacity: usize,
    total_pushed: usize,
}

impl LineBuffer {
    /// 使用預設容量建立緩衝。
    pub fn new() -> Self {
        Self::with_capacity(DEFAULT_LINE_BUFFER_CAPACITY)
    }

    /// 使用自訂容量建立緩衝；`0` 視為使用預設值。
    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            lines: VecDeque::new(),
            capacity: if capacity == 0 {
                DEFAULT_LINE_BUFFER_CAPACITY
            } else {
                capacity
            },
            total_pushed: 0,
        }
    }

    /// 容量上限。
    pub fn capacity(&self) -> usize {
        self.capacity
    }

    /// 尚未送出的行數。
    pub fn pending_len(&self) -> usize {
        self.lines.len()
    }

    /// 累計推送的行數（不因 `take_all` 而歸零）。
    pub fn total_pushed(&self) -> usize {
        self.total_pushed
    }

    /// 是否沒有待送出行。
    pub fn is_empty(&self) -> bool {
        self.lines.is_empty()
    }

    /// 追加一行；空白行被忽略（不計入統計，避免終端機出現假進度）。
    pub fn push(&mut self, stream: StreamKind, line: &str) {
        if line.trim().is_empty() {
            return;
        }
        self.total_pushed += 1;
        self.lines.push_back(ProgressLine {
            text: line.to_string(),
            stream,
        });
        while self.lines.len() > self.capacity {
            self.lines.pop_front();
        }
    }

    /// 取出並清空所有待送出的行（由舊到新）。
    pub fn take_all(&mut self) -> Vec<ProgressLine> {
        self.lines.drain(..).collect()
    }
}

impl Default for LineBuffer {
    fn default() -> Self {
        Self::new()
    }
}

/// 節流策略（純邏��，可完整單元測試）。
#[derive(Debug, Clone)]
pub struct FlushPolicy {
    /// 上次 flush 的時間。
    last_flush: Instant,
    /// 時間門檻。
    interval: Duration,
    /// 行數門檻。
    line_threshold: usize,
}

impl Default for FlushPolicy {
    fn default() -> Self {
        Self::new()
    }
}

impl FlushPolicy {
    /// 使用預設門檻建立策略。
    pub fn new() -> Self {
        Self::with(FLUSH_INTERVAL, FLUSH_LINE_THRESHOLD)
    }

    /// 使用自訂門檻建立策略。
    pub fn with(interval: Duration, line_threshold: usize) -> Self {
        Self {
            // 視為「剛 flush 過」，避免作業剛開始就立刻 emit 一次空事件。
            last_flush: Instant::now(),
            interval,
            line_threshold,
        }
    }

    /// 依雙門檻判斷是否該 flush；判定成立時同時重置計時。
    pub fn take_flush(&mut self, pending: usize) -> bool {
        let due = pending >= self.line_threshold || self.last_flush.elapsed() >= self.interval;
        if due {
            self.last_flush = Instant::now();
        }
        due
    }
}

/// 作業進度事件 payload。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationProgress {
    /// 作業 ID。
    pub operation_id: String,
    /// 作業種類（序列化名稱，例：`compile`）。
    pub kind: &'static str,
    /// 作業種類的 i18n key。
    pub kind_label: &'static str,
    /// 目前狀態。
    pub state: OperationState,
    /// 本批輸出的所有行（由舊到新）。
    ///
    /// **不可只送最後一行**：節流期間累積的每一行都是使用者唯一能看到編譯
    /// 過程的線索，丟棄中間行等於讓終端機只剩零星幾行。
    pub lines: Vec<ProgressLine>,
    /// 累計輸出行數（含已被 flush 的行）。
    pub line_count: usize,
    /// 是否為最後一次推播（作業結束）。
    pub finished: bool,
}

/// 把子程序輸出即時推播為 Tauri 事件的 sink。
pub struct EventSink {
    app: AppHandle,
    label: String,
    operation_id: String,
    kind: OperationKind,
    policy: FlushPolicy,
    buffer: LineBuffer,
}

impl EventSink {
    /// 建立 sink。
    pub fn new(app: AppHandle, label: &str, operation_id: &str, kind: OperationKind) -> Self {
        Self {
            app,
            label: label.to_string(),
            operation_id: operation_id.to_string(),
            kind,
            policy: FlushPolicy::new(),
            buffer: LineBuffer::new(),
        }
    }

    /// 累計收到的行數。
    pub fn line_count(&self) -> usize {
        self.buffer.total_pushed()
    }

    /// 組出並送出一次進度推播。
    ///
    /// 回傳是否實際送出：沒有待送行時（例如剛 flush 完就結束）不送空事件，
    /// 避免 UI 附加空行。
    pub fn flush_now(&mut self, state: OperationState, finished: bool) -> bool {
        let lines = self.buffer.take_all();
        if lines.is_empty() {
            return false;
        }
        let payload = OperationProgress {
            operation_id: self.operation_id.clone(),
            kind: kind_name(self.kind),
            kind_label: self.kind.message_key(),
            state,
            lines,
            line_count: self.buffer.total_pushed(),
            finished,
        };
        // 使用 `emit_to` 而非全域 `emit`：作業狀態是視窗專屬資料，
        // 遵守 cocoya AGENTS.md 的 emit_to 鐵則。
        if let Err(error) = self
            .app
            .emit_to(&self.label, event_names::OPERATION_STATUS, payload)
        {
            eprintln!("[CodeBridge] 無法推播作業進度: {error}");
        }
        true
    }
}

impl OutputSink for EventSink {
    fn on_line(&mut self, stream: StreamKind, line: &str) {
        self.buffer.push(stream, line);
        // 以實際待送行數判斷，64 行門檻才會真正生效。
        if self.policy.take_flush(self.buffer.pending_len()) {
            self.flush_now(OperationState::Running, false);
        }
    }
}

/// 作業種類的序列化名稱。
pub fn kind_name(kind: OperationKind) -> &'static str {
    match kind {
        OperationKind::Compile => "compile",
        OperationKind::Upload => "upload",
        OperationKind::CoreInstall => "coreInstall",
        OperationKind::CoreUpdateIndex => "coreUpdateIndex",
        OperationKind::LibraryInstall => "libraryInstall",
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn policy_does_not_flush_before_interval_or_threshold() {
        let mut policy = FlushPolicy::with(Duration::from_secs(60), 64);
        // 尚未累積到門檻且時間未到 → 不 flush。
        assert!(!policy.take_flush(1));
        assert!(!policy.take_flush(63));
    }

    #[test]
    fn policy_flushes_when_line_threshold_reached() {
        let mut policy = FlushPolicy::with(Duration::from_secs(60), 64);
        assert!(policy.take_flush(64), "64 lines must flush immediately");
        // flush 後重置計時，行數不足前不再 flush。
        assert!(!policy.take_flush(1));
    }

    #[test]
    fn policy_flushes_when_interval_elapsed() {
        // 間隔設為 0 → 任何一行都立即 flush（模擬時間已過）。
        let mut policy = FlushPolicy::with(Duration::from_millis(0), 1000);
        assert!(policy.take_flush(1), "elapsed interval must flush");
    }

    #[test]
    fn default_policy_uses_documented_thresholds() {
        let policy = FlushPolicy::new();
        assert_eq!(policy.interval, Duration::from_millis(200));
        assert_eq!(policy.line_threshold, 64);
        assert_eq!(policy.interval, FLUSH_INTERVAL);
        assert_eq!(policy.line_threshold, FLUSH_LINE_THRESHOLD);
    }

    #[test]
    fn kind_names_are_distinct_and_camel_case() {
        let kinds = [
            OperationKind::Compile,
            OperationKind::Upload,
            OperationKind::CoreInstall,
            OperationKind::CoreUpdateIndex,
            OperationKind::LibraryInstall,
        ];
        let names: Vec<&str> = kinds.iter().map(|kind| kind_name(*kind)).collect();
        let mut unique = names.clone();
        unique.sort_unstable();
        unique.dedup();
        assert_eq!(unique.len(), names.len(), "kind names must be distinct");
        assert_eq!(kind_name(OperationKind::CoreInstall), "coreInstall");
    }

    #[test]
    fn progress_payload_uses_camel_case_keys() {
        let payload = OperationProgress {
            operation_id: "op-1".to_string(),
            kind: "compile",
            kind_label: "CLI_OPERATION_COMPILE",
            state: OperationState::Running,
            lines: vec![ProgressLine {
                text: "Sketch uses 1918 bytes".to_string(),
                stream: StreamKind::Stdout,
            }],
            line_count: 3,
            finished: false,
        };
        let json = serde_json::to_value(&payload).expect("serialize");
        assert_eq!(json["operationId"], "op-1");
        assert_eq!(json["kindLabel"], "CLI_OPERATION_COMPILE");
        assert_eq!(json["lines"][0]["text"], "Sketch uses 1918 bytes");
        assert_eq!(json["lines"][0]["stream"], "stdout");
        assert_eq!(json["lineCount"], 3);
        assert_eq!(json["finished"], false);
    }

    // ---------------------------------------------------------------
    // LineBuffer：節流緩衝（不依賴 Tauri，可完整單元測試）
    // ---------------------------------------------------------------

    #[test]
    fn buffer_preserves_every_pushed_line_in_order() {
        let mut buffer = LineBuffer::new();
        buffer.push(StreamKind::Stdout, "first");
        buffer.push(StreamKind::Stderr, "second");
        buffer.push(StreamKind::Stdout, "third");

        let lines = buffer.take_all();
        let texts: Vec<&str> = lines.iter().map(|line| line.text.as_str()).collect();
        assert_eq!(texts, vec!["first", "second", "third"]);
        assert_eq!(lines[1].stream, StreamKind::Stderr);
    }

    #[test]
    fn buffer_is_empty_after_take_all() {
        let mut buffer = LineBuffer::new();
        buffer.push(StreamKind::Stdout, "only");
        assert!(!buffer.take_all().is_empty());
        assert!(buffer.take_all().is_empty(), "take_all must drain the buffer");
    }

    #[test]
    fn buffer_pending_len_grows_per_line_and_resets_on_take() {
        // 這是原缺陷的根因：舊實作永遠以 take_flush(1) 判斷，64 行門檻永不觸發，
        // 且中間行會被丟棄（只保留最後一行）。
        let mut buffer = LineBuffer::new();
        for index in 0..64 {
            buffer.push(StreamKind::Stderr, &format!("line {index}"));
        }
        assert_eq!(buffer.pending_len(), 64);
        buffer.take_all();
        assert_eq!(buffer.pending_len(), 0);
    }

    #[test]
    fn buffer_drops_oldest_lines_beyond_capacity() {
        // 上限防止無限輸出（例如 core install 上千行）讓記憶體無限成長。
        let mut buffer = LineBuffer::with_capacity(3);
        for index in 0..5 {
            buffer.push(StreamKind::Stdout, &format!("line {index}"));
        }
        let texts: Vec<String> = buffer
            .take_all()
            .into_iter()
            .map(|line| line.text)
            .collect();
        assert_eq!(texts, vec!["line 2", "line 3", "line 4"]);
    }

    #[test]
    fn buffer_capacity_of_zero_falls_back_to_default() {
        let buffer = LineBuffer::with_capacity(0);
        assert_eq!(buffer.capacity(), DEFAULT_LINE_BUFFER_CAPACITY);
    }

    #[test]
    fn buffer_skips_empty_lines() {
        // 子進程常吐出空行；送進 UI 只會在終端機留下空白的假進度。
        let mut buffer = LineBuffer::new();
        buffer.push(StreamKind::Stdout, "");
        buffer.push(StreamKind::Stdout, "   ");
        assert!(buffer.take_all().is_empty());
        assert_eq!(buffer.total_pushed(), 0);
    }

    #[test]
    fn buffer_counts_total_pushed_separately_from_pending() {
        // lineCount 是「累計收到的行數」，不可因為 take_all 而歸零。
        let mut buffer = LineBuffer::new();
        buffer.push(StreamKind::Stdout, "a");
        buffer.take_all();
        buffer.push(StreamKind::Stdout, "b");
        buffer.take_all();
        assert_eq!(buffer.total_pushed(), 2);
    }

    // ---------------------------------------------------------------
    // 序列埠簽章 diff（T2-D 的事件來源，純函式）
    // ---------------------------------------------------------------

    #[test]
    fn first_scan_is_initial_and_carries_all_ports() {
        let current = vec![PortInfo::named("COM3"), PortInfo::named("COM7")];
        let diff = diff_ports(&current, None);
        assert_eq!(diff.change, PortChange::Initial);
        assert_eq!(diff.ports, vec!["COM3", "COM7"]);
        assert!(diff.added.is_empty());
        assert!(diff.removed.is_empty());
        assert!(diff.change.should_emit());
    }

    #[test]
    fn identical_scan_is_unchanged_and_must_not_emit() {
        // 這是 1500ms 輪詢中最常見的情況：不可發事件，否則前端會不斷
        // 重建下拉清單並重設使用者已選好的序列埠。
        let ports = vec![PortInfo::with_ids("COM3", Some(0x2341), Some(0x0043))];
        let diff = diff_ports(&ports, Some(&ports));
        assert_eq!(diff.change, PortChange::Unchanged);
        assert!(!diff.change.should_emit());
    }

    #[test]
    fn newly_plugged_port_is_reported_as_added() {
        let previous = vec![PortInfo::named("COM3")];
        let current = vec![PortInfo::named("COM3"), PortInfo::named("COM7")];
        let diff = diff_ports(&current, Some(&previous));
        assert_eq!(diff.change, PortChange::Added);
        assert_eq!(diff.added, vec!["COM7"]);
        assert!(diff.removed.is_empty());
        assert_eq!(diff.ports, vec!["COM3", "COM7"]);
    }

    #[test]
    fn unplugged_port_is_reported_as_removed() {
        let previous = vec![PortInfo::named("COM3"), PortInfo::named("COM7")];
        let current = vec![PortInfo::named("COM3")];
        let diff = diff_ports(&current, Some(&previous));
        assert_eq!(diff.change, PortChange::Removed);
        assert_eq!(diff.removed, vec!["COM7"]);
        assert!(diff.added.is_empty());
    }

    #[test]
    fn same_port_name_with_different_board_is_replaced() {
        // 核心情境：使用者從 COM3 拔下 Uno 插上 Nano。埠名不變，若只比對埠名
        // 就會誤判為 Unchanged，UI 就不會重新判斷 FQBN。
        let previous = vec![PortInfo::with_ids("COM3", Some(0x2341), Some(0x0043))];
        let current = vec![PortInfo::with_ids("COM3", Some(0x1A86), Some(0x7523))];
        let diff = diff_ports(&current, Some(&previous));
        assert_eq!(diff.change, PortChange::Replaced);
        assert!(diff.added.is_empty());
        assert!(diff.removed.is_empty());
        assert!(diff.change.should_emit());
    }

    #[test]
    fn vid_only_change_is_detected() {
        let previous = vec![PortInfo::with_ids("COM3", Some(0x2341), Some(0x0043))];
        let current = vec![PortInfo::with_ids("COM3", Some(0x2341), Some(0x0001))];
        assert_eq!(
            diff_ports(&current, Some(&previous)).change,
            PortChange::Replaced
        );
    }

    #[test]
    fn ports_without_ids_compare_by_name_only() {
        // serialport 在部分平台拿不到 VID／PID；此時不可把所有埠都視為相同。
        let previous = vec![PortInfo::named("COM3")];
        let current = vec![PortInfo::named("COM3"), PortInfo::named("COM4")];
        assert_eq!(
            diff_ports(&current, Some(&previous)).change,
            PortChange::Added
        );
    }

    #[test]
    fn simultaneous_add_and_remove_prefers_added() {
        // USB Hub 重新列舉時常見；前端只需要知道「清單變了、要重建」。
        let previous = vec![PortInfo::named("COM3")];
        let current = vec![PortInfo::named("COM9")];
        let diff = diff_ports(&current, Some(&previous));
        assert_eq!(diff.change, PortChange::Added);
        assert_eq!(diff.added, vec!["COM9"]);
        assert_eq!(diff.removed, vec!["COM3"]);
    }

    #[test]
    fn signature_includes_vid_and_pid() {
        let port = PortInfo::with_ids("COM3", Some(0x2341), Some(0x0043));
        assert_eq!(port.signature(), "COM3|2341|0043");
        assert_eq!(PortInfo::named("COM3").signature(), "COM3||");
    }

    #[test]
    fn hex_ids_are_uppercase_and_four_digits() {
        let port = PortInfo::with_ids("COM3", Some(0x1a86), Some(0x7523));
        assert_eq!(port.vid.as_deref(), Some("1A86"));
        assert_eq!(port.pid.as_deref(), Some("7523"));
    }

    #[test]
    fn port_change_serializes_as_camel_case() {
        let json = serde_json::to_value(PortChange::Replaced).expect("serialize");
        assert_eq!(json, "replaced");
        let diff = diff_ports(&[PortInfo::named("COM3")], None);
        let payload = serde_json::to_value(SerialPortsChanged::from(&diff)).expect("serialize");
        assert_eq!(payload["change"], "initial");
        assert_eq!(payload["ports"][0], "COM3");
    }

    #[test]
    fn poll_interval_matches_documented_value() {
        assert_eq!(PORT_POLL_INTERVAL_MS, 1500);
    }
}
