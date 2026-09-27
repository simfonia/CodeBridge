pub mod arduino;
pub mod commands;
pub mod events;
pub mod project;

use tauri::{Emitter, Manager};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use arduino::operations::OperationRegistry;
use arduino::paths::ToolchainDirs;
use arduino::pipeline::BuildRecord;
use arduino::runner::StdProcessRunner;
use arduino::CodeBridgeToolchain;

/// AppState 定義應用程式狀態
pub struct AppState {
    /// 序列埠清單快取（由 board discovery 或 serialport 掃描更新）。
    pub serial_ports: Arc<Mutex<Vec<String>>>,
    /// 使用者於設定面板指定的 arduino-cli 路徑；None 表示使用系統 PATH。
    pub cli_path_override: Arc<Mutex<Option<String>>>,
    /// 額外 Board Manager URL。
    pub board_manager_urls: Arc<Mutex<Vec<String>>>,
    /// 長作業 registry。
    pub operations: OperationRegistry,
    /// CodeBridge 隔離的 CLI 目錄；於啟動時建立。
    pub toolchain_dirs: ToolchainDirs,
    /// 成功編譯紀錄（`projectId` → build 資訊），上傳時作為前置依據。
    ///
    /// **後端權威**：前端上傳時只送 `projectId`／`fqbn`／`port`，
    /// build 路徑一律由此處查出。不可讓前端直接指定 `--input-dir`，
    /// 否則惡意的 webview 就能要求把任意目錄的內容寫進晶片。
    pub last_builds: Arc<Mutex<HashMap<String, BuildRecord>>>,
    /// 序列埠佔用鎖；None 代表空閒。
    ///
    /// compile／upload 期間佔用，T3 的 Serial Monitor 需沿用同一把鎖，
    /// 實現「上傳前暫停 Monitor、結束後依設定重連」。
    pub port_lease: Arc<Mutex<Option<String>>>,
}

impl AppState {
    /// 建立狀態；`app_data_dir` 為應用程式資料根目錄。
    pub fn new(app_data_dir: std::path::PathBuf) -> Self {
        Self {
            serial_ports: Arc::new(Mutex::new(Vec::new())),
            cli_path_override: Arc::new(Mutex::new(None)),
            board_manager_urls: Arc::new(Mutex::new(Vec::new())),
            operations: OperationRegistry::new(),
            toolchain_dirs: ToolchainDirs::under(&app_data_dir),
            last_builds: Arc::new(Mutex::new(HashMap::new())),
            port_lease: Arc::new(Mutex::new(None)),
        }
    }

    /// 嘗試佔用序列埠；已被佔用時回傳 `false`。
    pub fn try_acquire_port(&self, port: &str) -> bool {
        let mut lease = match self.port_lease.lock() {
            Ok(guard) => guard,
            Err(_) => return false,
        };
        match lease.as_deref() {
            Some(current) if current == port => true,
            Some(_) => false,
            None => {
                *lease = Some(port.to_string());
                true
            }
        }
    }

    /// 釋放序列埠佔用。
    pub fn release_port(&self, port: &str) {
        if let Ok(mut lease) = self.port_lease.lock() {
            if lease.as_deref() == Some(port) {
                *lease = None;
            }
        }
    }

    /// 目前被佔用的序列埠（供 UI 顯示「忙於編譯／上傳」）。
    pub fn leased_port(&self) -> Option<String> {
        self.port_lease.lock().ok().and_then(|lease| lease.clone())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .on_window_event(|window, event| {
            // 使用者按下視窗右上角的 X：先攔截，請前端確認未儲存變更，
            // 前端決定要儲存／不儲存／取消後再呼叫 app_close 真正關閉。
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.emit(events::names::REQUEST_CLOSE, ());
                }
            }
        })
        .setup(|app| {
            // 於啟動時建立 CodeBridge 專屬的 CLI 目錄，避免首次編譯時失敗。
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::env::temp_dir().join("codebridge"));
            let state = AppState::new(app_data_dir);
            if let Err(err) = state.toolchain_dirs.ensure() {
                eprintln!("[CodeBridge] 無法建立工具鏈目錄: {}", err);
            }
            app.manage(state);
            // 啟動序列埠熱插拔 watcher（T2-D）：1500ms 輪詢 + 簽章 diff。
            commands::spawn_port_watcher(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_serial_ports,
            commands::refresh_serial_ports,
            commands::open_serial_monitor,
            commands::get_version,
            commands::toolchain_detect,
            commands::toolchain_set_cli_path,
            commands::board_list_detected,
            commands::board_list_all,
            commands::board_details,
            commands::core_list,
            commands::lib_list,
            commands::operation_status,
            commands::operation_cancel,
            commands::compile_start,
            commands::upload_start,
            commands::upload_ready,
            project::project_read,
            project::project_save,
            project::project_exists,
            project::project_reveal,
            commands::app_close,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// 建立綁定 `StdProcessRunner` 的工具鏈實例。
pub fn toolchain(state: &AppState) -> CodeBridgeToolchain<StdProcessRunner> {
    CodeBridgeToolchain::new(StdProcessRunner::new(), state.toolchain_dirs.clone())
}

/// 解析目前應使用的 CLI 執行檔。
///
/// 使用者設定的路徑優先；設定存在但失效時直接回報錯誤，不靜默 fallback，
/// 讓使用者知道自己的設定需要修正。
pub fn resolve_cli_for(state: &AppState) -> Result<arduino::CliHandle, arduino::CliError> {
    let override_path = state.cli_path_override.lock().ok().and_then(|v| v.clone());
    let configured = override_path.as_ref().map(std::path::PathBuf::from);
    arduino::resolve_cli(configured.as_deref(), None)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 測試用狀態；使用暫存根目錄避免污染應用程式資料。
    fn state(tag: &str) -> AppState {
        let root = std::env::temp_dir().join(format!("codebridge-state-{tag}"));
        let _ = std::fs::remove_dir_all(&root);
        AppState::new(root)
    }

    #[test]
    fn port_lease_is_exclusive_across_different_ports() {
        let state = state("lease-exclusive");
        assert!(state.try_acquire_port("COM3"));
        // 不同埠不可同時佔用。
        assert!(!state.try_acquire_port("COM4"));
        assert_eq!(state.leased_port().as_deref(), Some("COM3"));
    }

    #[test]
    fn port_lease_is_reentrant_for_same_port() {
        // 同一埠重複取得應回 true（冪等），避免重複點擊造成自我阻塞。
        let state = state("lease-reentrant");
        assert!(state.try_acquire_port("COM3"));
        assert!(state.try_acquire_port("COM3"));
    }

    #[test]
    fn port_lease_release_frees_the_port() {
        let state = state("lease-release");
        assert!(state.try_acquire_port("COM3"));
        state.release_port("COM3");
        assert!(state.leased_port().is_none());
        assert!(state.try_acquire_port("COM4"), "other port must be free");
    }

    #[test]
    fn port_lease_release_only_affects_owning_port() {
        // 釋放別人持有的埠不應影響現有持有者（否則會出現雙持有）。
        let state = state("lease-foreign");
        assert!(state.try_acquire_port("COM3"));
        state.release_port("COM9");
        assert_eq!(state.leased_port().as_deref(), Some("COM3"));
    }

    #[test]
    fn toolchain_dirs_are_under_the_given_root() {
        let state = state("dirs");
        assert!(state.toolchain_dirs.config_dir.starts_with(&state.toolchain_dirs.data_dir.parent().unwrap()));
        assert!(state.toolchain_dirs.data_dir.starts_with(&state.toolchain_dirs.config_dir));
    }

    #[test]
    fn last_builds_start_empty() {
        let state = state("builds");
        assert!(state.last_builds.lock().unwrap().is_empty());
    }
}
