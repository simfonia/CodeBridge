//! 非同步 operation registry：管理 compile／upload／core install 等長作業。
//!
//! 這些作業可能持續數分鐘（首次安裝 board core），因此必須支援：
//! - 以 ID 追蹤狀態，供 UI 輪詢或訂閱事件
//! - 取消（`kill` 子程序）
//! - 完成後清理，避免 registry 無限增長

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use serde::Serialize;

/// 作業種類。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum OperationKind {
    /// 編譯草稿。
    Compile,
    /// 上傳至開發板。
    Upload,
    /// 安裝／移除 board core。
    CoreInstall,
    /// 更新套件索引。
    CoreUpdateIndex,
    /// 安裝／移除函式庫。
    LibraryInstall,
}

impl OperationKind {
    /// 對應 i18n message key。
    pub fn message_key(&self) -> &'static str {
        match self {
            OperationKind::Compile => "CLI_OPERATION_COMPILE",
            OperationKind::Upload => "CLI_OPERATION_UPLOAD",
            OperationKind::CoreInstall => "CLI_OPERATION_CORE_INSTALL",
            OperationKind::CoreUpdateIndex => "CLI_OPERATION_CORE_UPDATE_INDEX",
            OperationKind::LibraryInstall => "CLI_OPERATION_LIBRARY_INSTALL",
        }
    }
}

/// 作業狀態。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum OperationState {
    /// 執行中。
    Running,
    /// 成功結束。
    Succeeded,
    /// 失敗結束。
    Failed,
    /// 被使用者取消。
    Cancelled,
    /// 因逾時終止。
    TimedOut,
}

impl OperationState {
    /// 是否為終態（不可再變更）。
    pub fn is_terminal(&self) -> bool {
        !matches!(self, OperationState::Running)
    }
}

/// 作業狀態快照（回傳給 UI）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationStatus {
    /// 作業 ID。
    pub id: String,
    /// 作業種類。
    pub kind: OperationKind,
    /// 目前狀態。
    pub state: OperationState,
    /// 最後一行輸出，供終端機面板顯示。
    pub last_line: Option<String>,
    /// 失敗訊息（`KEY|detail`）。
    pub message: Option<String>,
    /// 累積輸出行數；UI 可用它比對自身已附加的行數，判斷是否漏接。
    pub line_count: usize,
    /// 已完成作業的最後結果（compile 為 CompileOutcome、upload 為 UploadOutcome）。
    pub result: Option<serde_json::Value>,
}

/// 作業項目。
pub struct Operation {
    /// 作業 ID。
    pub id: String,
    /// 作業種類。
    pub kind: OperationKind,
    /// 取消旗標。
    ///
    /// 子程序 handle **不在此保存**：串流 runner 在自己的執行緒內持有 `Child`
    /// 並輪詢此旗標（見 `runner::wait_for_child`）。若同時保存 handle 供外部
    /// `kill`，就會有兩條 kill 路徑、且 `Child` 無法跨執行緒安全共享 ——
    /// 這正是 T1 遗留的死碼（`child` 欄位從未被讀寫）。
    pub cancel_flag: Arc<AtomicBool>,
    /// 目前狀態。
    pub state: OperationState,
    /// 最後一行輸出。
    pub last_line: Option<String>,
    /// 失敗訊息。
    pub message: Option<String>,
    /// 累積輸出行數。
    pub line_count: usize,
    /// 完成後的結果。
    pub result: Option<serde_json::Value>,
}

impl Operation {
    /// 建立執行中的作業。
    pub fn new(id: String, kind: OperationKind) -> Self {
        Self {
            id,
            kind,
            cancel_flag: Arc::new(AtomicBool::new(false)),
            state: OperationState::Running,
            last_line: None,
            message: None,
            line_count: 0,
            result: None,
        }
    }

    /// 記錄一行輸出並累加行數。
    pub fn push_line(&mut self, line: &str) {
        self.last_line = Some(line.to_string());
        self.line_count += 1;
    }

    /// 目前狀態的快照。
    pub fn status(&self) -> OperationStatus {
        OperationStatus {
            id: self.id.clone(),
            kind: self.kind,
            state: self.state,
            last_line: self.last_line.clone(),
            message: self.message.clone(),
            line_count: self.line_count,
            result: self.result.clone(),
        }
    }

    /// 請求取消；回傳是否成功設定旗標。
    ///
    /// 實際終止由執行緒在下一次輪詢觀察旗標後執行 `kill`。多次呼叫皆回傳
    /// `true`，讓 UI 可安全重複點擊取消鈕。
    pub fn request_cancel(&self) -> bool {
        self.cancel_flag.store(true, Ordering::SeqCst);
        true
    }

    /// 取消旗標是否已設定。
    pub fn is_cancel_requested(&self) -> bool {
        self.cancel_flag.load(Ordering::SeqCst)
    }
}

/// 作業 registry。
///
/// 以 `Arc` 包裝以便在多執行緒間共享；所有內部狀態都由 `Mutex` 保護。
#[derive(Clone, Default)]
pub struct OperationRegistry {
    inner: Arc<Mutex<HashMap<String, Arc<Mutex<Operation>>>>>,
}

impl OperationRegistry {
    /// 建立空的 registry。
    pub fn new() -> Self {
        Self::default()
    }

    /// 註冊新作業並回傳其 ID。
    pub fn begin(&self, id: String, kind: OperationKind) -> Arc<Mutex<Operation>> {
        let cell = Arc::new(Mutex::new(Operation::new(id.clone(), kind)));
        self.inner
            .lock()
            .expect("registry lock")
            .insert(id, cell.clone());
        cell
    }

    /// 取得作業狀態快照。
    pub fn status(&self, id: &str) -> Option<OperationStatus> {
        self.inner
            .lock()
            .ok()?
            .get(id)
            .map(|cell| cell.lock().expect("operation lock").status())
    }

    /// 列出所有仍處於執行中的作業 ID。
    pub fn running_ids(&self) -> Vec<String> {
        self.inner
            .lock()
            .map(|map| {
                map.iter()
                    .filter(|(_, cell)| {
                        cell.lock()
                            .map(|op| !op.state.is_terminal())
                            .unwrap_or(false)
                    })
                    .map(|(id, _)| id.clone())
                    .collect()
            })
            .unwrap_or_default()
    }

    /// 請求取消指定作業。
    pub fn cancel(&self, id: &str) -> bool {
        self.inner
            .lock()
            .ok()
            .and_then(|map| map.get(id).cloned())
            .map(|cell| cell.lock().expect("operation lock").request_cancel())
            .unwrap_or(false)
    }

    /// 移除所有已進入終態的作業。
    ///
    /// 呼叫端應在作業完成後呼叫，避免 registry 隨編譯次數無限增長。
    pub fn prune_finished(&self) -> usize {
        let mut map = match self.inner.lock() {
            Ok(guard) => guard,
            Err(_) => return 0,
        };
        let before = map.len();
        map.retain(|_, cell| {
            cell.lock()
                .map(|op| !op.state.is_terminal())
                .unwrap_or(true)
        });
        before - map.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn begin_registers_running_operation() {
        let registry = OperationRegistry::new();
        registry.begin("op-1".to_string(), OperationKind::Compile);

        let status = registry.status("op-1").expect("status");
        assert_eq!(status.id, "op-1");
        assert_eq!(status.kind, OperationKind::Compile);
        assert_eq!(status.state, OperationState::Running);
        assert_eq!(registry.running_ids(), vec!["op-1".to_string()]);
    }

    #[test]
    fn status_of_unknown_operation_is_none() {
        assert!(OperationRegistry::new().status("nope").is_none());
    }

    #[test]
    fn cancel_sets_flag_and_is_idempotent() {
        let registry = OperationRegistry::new();
        let cell = registry.begin("op-2".to_string(), OperationKind::Upload);

        assert!(!cell.lock().unwrap().is_cancel_requested());
        assert!(registry.cancel("op-2"));
        assert!(cell.lock().unwrap().is_cancel_requested());
        // 重複取消仍回傳 true，UI 可安全重複點擊。
        assert!(registry.cancel("op-2"));
    }

    #[test]
    fn cancel_unknown_operation_returns_false() {
        assert!(!OperationRegistry::new().cancel("missing"));
    }

    #[test]
    fn terminal_state_leaves_running_ids() {
        let registry = OperationRegistry::new();
        let cell = registry.begin("op-3".to_string(), OperationKind::CoreInstall);
        cell.lock().unwrap().state = OperationState::Succeeded;

        assert!(registry.running_ids().is_empty());
    }

    #[test]
    fn prune_removes_only_finished_operations() {
        let registry = OperationRegistry::new();
        let done = registry.begin("done".to_string(), OperationKind::Compile);
        let active = registry.begin("active".to_string(), OperationKind::Upload);

        done.lock().unwrap().state = OperationState::Failed;
        active.lock().unwrap().state = OperationState::Running;

        assert_eq!(registry.prune_finished(), 1);
        assert!(registry.status("done").is_none());
        assert!(registry.status("active").is_some());
    }

    #[test]
    fn prune_on_empty_registry_is_noop() {
        assert_eq!(OperationRegistry::new().prune_finished(), 0);
    }

    #[test]
    fn state_terminality_is_correct() {
        assert!(!OperationState::Running.is_terminal());
        for state in [
            OperationState::Succeeded,
            OperationState::Failed,
            OperationState::Cancelled,
            OperationState::TimedOut,
        ] {
            assert!(state.is_terminal(), "{:?} must be terminal", state);
        }
    }

    #[test]
    fn status_carries_last_line_and_message() {
        let registry = OperationRegistry::new();
        let cell = registry.begin("op-4".to_string(), OperationKind::LibraryInstall);
        {
            let mut op = cell.lock().unwrap();
            op.last_line = Some("Downloading 42%".to_string());
            op.message = Some("network timeout".to_string());
        }

        let status = registry.status("op-4").expect("status");
        assert_eq!(status.last_line.as_deref(), Some("Downloading 42%"));
        assert_eq!(status.message.as_deref(), Some("network timeout"));
    }

    #[test]
    fn operation_kind_message_keys_are_distinct() {
        let keys = [
            OperationKind::Compile.message_key(),
            OperationKind::Upload.message_key(),
            OperationKind::CoreInstall.message_key(),
            OperationKind::CoreUpdateIndex.message_key(),
            OperationKind::LibraryInstall.message_key(),
        ];
        let mut unique = keys.to_vec();
        unique.sort_unstable();
        unique.dedup();
        assert_eq!(unique.len(), keys.len(), "message keys must be unique");
    }

    #[test]
    fn multiple_operations_are_tracked_independently() {
        let registry = OperationRegistry::new();
        registry.begin("a".to_string(), OperationKind::Compile);
        registry.begin("b".to_string(), OperationKind::Upload);

        let mut running = registry.running_ids();
        running.sort();
        assert_eq!(running, vec!["a".to_string(), "b".to_string()]);
    }

    #[test]
    fn push_line_tracks_last_line_and_count() {
        let registry = OperationRegistry::new();
        let cell = registry.begin("op-lines".to_string(), OperationKind::Compile);
        {
            let mut op = cell.lock().unwrap();
            op.push_line("Sketch uses 1918 bytes");
            op.push_line("Global variables use 184 bytes");
        }

        let status = registry.status("op-lines").expect("status");
        assert_eq!(status.line_count, 2);
        assert_eq!(
            status.last_line.as_deref(),
            Some("Global variables use 184 bytes")
        );
    }

    #[test]
    fn status_carries_serialized_result() {
        let registry = OperationRegistry::new();
        let cell = registry.begin("op-result".to_string(), OperationKind::Compile);
        {
            let mut op = cell.lock().unwrap();
            op.result = Some(serde_json::json!({ "inoFileName": "Blink.ino" }));
        }

        let status = registry.status("op-result").expect("status");
        let result = status.result.expect("result");
        assert_eq!(result["inoFileName"], "Blink.ino");
    }

    #[test]
    fn new_operation_starts_without_result() {
        let operation = Operation::new("op-new".to_string(), OperationKind::Upload);
        assert_eq!(operation.line_count, 0);
        assert!(operation.result.is_none());
        assert_eq!(operation.state, OperationState::Running);
    }
}
