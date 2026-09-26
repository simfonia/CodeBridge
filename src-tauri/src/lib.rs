pub mod arduino;
pub mod commands;
pub mod project;

use tauri::{Emitter, Manager};
use std::sync::{Arc, Mutex};

use arduino::operations::OperationRegistry;
use arduino::paths::ToolchainDirs;
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
        }
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
                    let _ = window.emit(events::REQUEST_CLOSE, ());
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
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_serial_ports,
            commands::refresh_serial_ports,
            commands::open_serial_monitor,
            commands::run_arduino_code,
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

/// 供命令使用的事件名稱；集中管理避免拼字不一致。
pub mod events {
    /// 工具鏈狀態變更。
    pub const TOOLCHAIN_STATUS: &str = "codebridge://toolchain-status";
    /// 作業狀態更新。
    pub const OPERATION_STATUS: &str = "codebridge://operation-status";
    /// 編譯診斷結果。
    pub const COMPILE_DIAGNOSTICS: &str = "codebridge://compile-diagnostics";
    /// 視窗被要求關閉（攔截 CloseRequested 後通知前端處理未儲存變更）。
    pub const REQUEST_CLOSE: &str = "codebridge://request-close";
}