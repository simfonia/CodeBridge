use tauri::State;
use crate::AppState;

/// 取得可用的序列埠列表
#[tauri::command]
pub fn get_serial_ports(state: State<AppState>) -> Result<Vec<String>, String> {
    let ports = state.serial_ports.lock().unwrap();
    Ok(ports.clone())
}

/// 開啟序列監視器
#[tauri::command]
pub fn open_serial_monitor(_port: String) -> Result<String, String> {
    // TODO: 實作序列監視器
    Ok("Serial monitor not implemented yet".to_string())
}

/// 執行 Arduino 程式碼
#[tauri::command]
pub fn run_arduino_code(_code: String) -> Result<String, String> {
    // TODO: 實作 Arduino CLI 整合
    Ok("Arduino execution not implemented yet".to_string())
}

/// 取得版本資訊
#[tauri::command]
pub fn get_version() -> Result<String, String> {
    Ok("0.1.0".to_string())
}