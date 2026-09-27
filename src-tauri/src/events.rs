//! 把長作業的串流輸出推播到前端的 glue 層。
//!
//! 位置刻意在 `arduino/` **之外**：`arduino` 模組保持不依賴 Tauri（可用於
//! 純單元測試與未來的其他 host），事件推播只屬於桌面應用層。
//!
//! 節流採 #cocoya `commands/mcu.rs` 的**雙門檻**策略：`200ms` **或** `64 行`
//! 任一達成就 emit。單用時間會在高輸出時把事件塞爆 IPC；單用行數則在
//! 「長時間沒有輸出」時（例如 `core install` 下載）讓 UI 沒有回饋。

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

/// 預設的時間門檻。
pub const FLUSH_INTERVAL: Duration = Duration::from_millis(200);

/// 預設的行數門檻。
pub const FLUSH_LINE_THRESHOLD: usize = 64;

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
    /// 本批最後一行輸出。
    pub last_line: String,
    /// 輸出的來源管線。
    pub stream: StreamKind,
    /// 累計輸出行數。
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
    line_count: usize,
    last_line: String,
    last_stream: StreamKind,
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
            line_count: 0,
            last_line: String::new(),
            last_stream: StreamKind::Stdout,
        }
    }

    /// 累計收到的行數。
    pub fn line_count(&self) -> usize {
        self.line_count
    }

    /// 組出並送出一次進度推播。
    ///
    /// 回傳是否實際送出：沒有待送行時（例如剛 flush 完就結束）不送空事件，
    /// 避免 UI 附加空行。
    pub fn flush_now(&mut self, state: OperationState, finished: bool) -> bool {
        if self.last_line.is_empty() {
            return false;
        }
        let payload = OperationProgress {
            operation_id: self.operation_id.clone(),
            kind: kind_name(self.kind),
            kind_label: self.kind.message_key(),
            state,
            last_line: std::mem::take(&mut self.last_line),
            stream: self.last_stream,
            line_count: self.line_count,
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
        self.line_count += 1;
        self.last_line = line.to_string();
        self.last_stream = stream;

        if self.policy.take_flush(1) {
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
            last_line: "Sketch uses 1918 bytes".to_string(),
            stream: StreamKind::Stdout,
            line_count: 3,
            finished: false,
        };
        let json = serde_json::to_value(&payload).expect("serialize");
        assert_eq!(json["operationId"], "op-1");
        assert_eq!(json["kindLabel"], "CLI_OPERATION_COMPILE");
        assert_eq!(json["lastLine"], "Sketch uses 1918 bytes");
        assert_eq!(json["lineCount"], 3);
        assert_eq!(json["finished"], false);
        assert_eq!(json["stream"], "stdout");
    }
}
