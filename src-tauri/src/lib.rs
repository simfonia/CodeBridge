pub mod commands;

use tauri::{Manager, State};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

/// AppState 定義應用程式狀態
pub struct AppState {
    pub serial_ports: Arc<Mutex<Vec<String>>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState {
            serial_ports: Arc::new(Mutex::new(Vec::new())),
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_serial_ports,
            commands::open_serial_monitor,
            commands::run_arduino_code,
            commands::get_version
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}