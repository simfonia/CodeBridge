//! Tauri 命令：序列埠、工具鏈偵測與 Board／Library 查詢。
//!
//! 本階段（T1）只開放**唯讀查詢**命令。compile／upload 需要 T2 的草稿寫入
//! 與 operation 串流，會另行加入，避免在此放置未完成的可被呼叫路徑。

use std::time::Duration;
use tauri::State;

use crate::arduino::command::{self, GlobalFlags};
use crate::arduino::parser::{
    BoardDetailResponse, BoardSummaries, DetectedBoards, LibrariesResponse, PlatformsResponse,
    VersionInfo,
};
use crate::arduino::runner::{ProcessRunner, RunRequest, RunResult};
use crate::arduino::{CliError, InstallHint, ToolchainStatus, ARDUINO_CLI_DOWNLOAD_URL};
use crate::{resolve_cli_for, toolchain, AppState};

/// CLI 查詢的共用逾時；board listall 在首次索引下載時可能較慢。
const QUERY_TIMEOUT: Duration = Duration::from_secs(60);

/// 版本查詢逾時。
const VERSION_TIMEOUT: Duration = Duration::from_secs(10);

/// 取得可用的序列埠列表（快取值）。
#[tauri::command]
pub fn get_serial_ports(state: State<AppState>) -> Result<Vec<String>, String> {
    let ports = state.serial_ports.lock().map_err(|e| e.to_string())?;
    Ok(ports.clone())
}

/// 重新掃描序列埠並更新快取。
#[tauri::command]
pub fn refresh_serial_ports(state: State<AppState>) -> Result<Vec<String>, String> {
    let ports = scan_serial_ports();
    if let Ok(mut cache) = state.serial_ports.lock() {
        *cache = ports.clone();
    }
    Ok(ports)
}

/// 以 `serialport` crate 掃描系統序列埠。
fn scan_serial_ports() -> Vec<String> {
    serialport::available_ports()
        .map(|ports| {
            let mut names: Vec<String> = ports
                .into_iter()
                .map(|port| port.port_name)
                .collect();
            // 排序讓下拉選項順序穩定，避免每次刷新跳動。
            names.sort();
            names
        })
        .unwrap_or_default()
}

/// 開啟序列監視器（T3 實作；目前回報未實作）。
#[tauri::command]
pub fn open_serial_monitor(_port: String) -> Result<String, String> {
    Err("SERIAL_MONITOR_NOT_IMPLEMENTED".to_string())
}

/// 執行 Arduino 程式碼（T2 實作；目前回報未實作）。
#[tauri::command]
pub fn run_arduino_code(_code: String) -> Result<String, String> {
    Err("COMPILE_NOT_IMPLEMENTED".to_string())
}

/// 取得應用程式版本。
#[tauri::command]
pub fn get_version() -> Result<String, String> {
    Ok(env!("CARGO_PKG_VERSION").to_string())
}

/// 建立含隔離旗標的全域配置。
fn flags_for(state: &AppState) -> GlobalFlags {
    let urls = state
        .board_manager_urls
        .lock()
        .map(|v| v.clone())
        .unwrap_or_default();
    GlobalFlags::isolated(&state.toolchain_dirs)
        .with_additional_urls(urls)
        .with_json()
}

/// 執行一次 CLI 查詢並回傳 `RunResult`；非零結束即轉為錯誤字串。
fn query(state: &AppState, cmd: command::CliCommand) -> Result<RunResult, String> {
    let cli = resolve_cli_for(state).map_err(describe)?;
    let chain = toolchain(state);
    let result = chain
        .runner()
        .run(&cli, &RunRequest::new(cmd).with_timeout(QUERY_TIMEOUT))
        .map_err(describe)?;

    // 使用非消耗的 error()，成功時仍可讀取 result.stdout。
    match result.error() {
        Some(err) => Err(describe(err)),
        None => Ok(result),
    }
}

/// 工具鏈環境偵測。
///
/// 找不到 CLI 時**不**回傳錯誤，而是回傳 `found: false` 加上安裝引導資訊，
/// 讓前端可以顯示安裝教學而不是通用錯誤訊息。
#[tauri::command]
pub fn toolchain_detect(state: State<AppState>) -> Result<ToolchainStatus, String> {
    let dirs = &state.toolchain_dirs;
    let base = ToolchainStatus {
        found: false,
        path: None,
        source: None,
        version: None,
        config_dir: dirs.config_dir.display().to_string(),
        data_dir: dirs.data_dir.display().to_string(),
        user_dir: dirs.user_dir.display().to_string(),
        install_hint: None,
    };

    let cli = match resolve_cli_for(&state) {
        Ok(cli) => cli,
        Err(err) => {
            return Ok(ToolchainStatus {
                install_hint: Some(install_hint_for(&err)),
                ..base
            })
        }
    };

    // 版本查詢失敗不影響「已找到 CLI」的結論，只讓版本欄位留空。
    let chain = toolchain(&state);
    let version = chain
        .run_json::<VersionInfo>(
            &cli,
            RunRequest::new(command::version(&flags_for(&state))).with_timeout(VERSION_TIMEOUT),
        )
        .ok()
        .map(|info| info.display());

    Ok(ToolchainStatus {
        found: true,
        path: Some(cli.program.display().to_string()),
        source: Some(cli.source),
        version,
        ..base
    })
}

/// 產生安裝引導資訊。
fn install_hint_for(err: &CliError) -> InstallHint {
    match err {
        CliError::NotFound { url, command } => InstallHint {
            url: url.clone(),
            command: command.clone(),
        },
        _ => InstallHint {
            url: ARDUINO_CLI_DOWNLOAD_URL.to_string(),
            command: String::new(),
        },
    }
}

/// 設定使用者自訂的 arduino-cli 路徑。
///
/// 傳入 `None` 或空字串表示清除設定，改回使用系統 PATH。
#[tauri::command]
pub fn toolchain_set_cli_path(
    state: State<AppState>,
    path: Option<String>,
) -> Result<ToolchainStatus, String> {
    let normalized = path
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    if let Ok(mut slot) = state.cli_path_override.lock() {
        *slot = normalized;
    }
    toolchain_detect(state)
}

/// 列出實際連接中的開發板。
///
/// CLI 不可用時退回 `serialport` 直接掃描，讓 UI 至少能列出可用的埠。
#[tauri::command]
pub fn board_list_detected(state: State<AppState>) -> Result<serde_json::Value, String> {
    if resolve_cli_for(&state).is_err() {
        return Ok(serde_json::json!({
            "boards": scan_serial_ports(),
            "source": "serialport",
        }));
    }

    let result = query(&state, command::board_list(&flags_for(&state)))?;
    let boards: Vec<serde_json::Value> = serde_json::from_str::<DetectedBoards>(&result.stdout)
        .map(|parsed| {
            parsed
                .boards
                .into_iter()
                .map(|board| {
                    serde_json::json!({
                        "port": board.port_name(),
                        "label": board.display_label(),
                        "fqbn": board.fqbn,
                        "protocol": board.protocol,
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(serde_json::json!({ "boards": boards, "source": "arduino-cli" }))
}

/// 列出所有已知開發板（Board Manager 清單）。
#[tauri::command]
pub fn board_list_all(state: State<AppState>) -> Result<serde_json::Value, String> {
    let result = query(&state, command::board_list_all(&flags_for(&state)))?;
    let parsed: BoardSummaries =
        serde_json::from_str(&result.stdout).map_err(|err| err.to_string())?;
    Ok(serde_json::json!({ "boards": parsed.boards }))
}

/// 取得單一開發板詳細資料（含缺少的工具鏈）。
#[tauri::command]
pub fn board_details(state: State<AppState>, fqbn: String) -> Result<serde_json::Value, String> {
    let result = query(&state, command::board_details(&flags_for(&state), &fqbn))?;
    let parsed: BoardDetailResponse =
        serde_json::from_str(&result.stdout).map_err(|err| err.to_string())?;

    let board = parsed.board.unwrap_or_default();
    Ok(serde_json::json!({
        "board": {
            "name": board.name,
            "fqbn": board.fqbn,
            "matchingCore": board.matching_core,
            "missingTools": board.missing_tools(),
        }
    }))
}

/// 列出已安裝的 board core。
#[tauri::command]
pub fn core_list(state: State<AppState>) -> Result<serde_json::Value, String> {
    let result = query(&state, command::core_list(&flags_for(&state)))?;
    let parsed: PlatformsResponse =
        serde_json::from_str(&result.stdout).map_err(|err| err.to_string())?;
    Ok(serde_json::json!({ "platforms": parsed.platforms }))
}

/// 列出已安裝的函式庫。
#[tauri::command]
pub fn lib_list(state: State<AppState>) -> Result<serde_json::Value, String> {
    let result = query(&state, command::lib_list(&flags_for(&state)))?;
    let parsed: LibrariesResponse =
        serde_json::from_str(&result.stdout).map_err(|err| err.to_string())?;
    Ok(serde_json::json!({ "libraries": parsed.installed }))
}

/// 查詢作業狀態。
#[tauri::command]
pub fn operation_status(state: State<AppState>, id: String) -> Result<Option<serde_json::Value>, String> {
    Ok(state
        .operations
        .status(&id)
        .and_then(|status| serde_json::to_value(status).ok()))
}

/// 取消執行中的作業。
#[tauri::command]
pub fn operation_cancel(state: State<AppState>, id: String) -> Result<bool, String> {
    Ok(state.operations.cancel(&id))
}

/// 將 `CliError` 轉為前端可顯示的字串。
///
/// 格式為 `KEY|詳細訊息`，前端以 `KEY` 查 i18n，`詳細訊息` 作為補充說明。
fn describe(err: CliError) -> String {
    format!("{}|{}", err.message_key(), err)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn describe_prefixes_message_key() {
        let err = CliError::ConfiguredPathMissing {
            path: "C:/x/arduino-cli.exe".to_string(),
        };
        let text = describe(err);
        assert!(text.starts_with("CLI_ERROR_CONFIGURED_PATH_MISSING|"));
        assert!(text.contains("arduino-cli.exe"));
    }

    #[test]
    fn describe_marks_not_installed_errors() {
        let err = CliError::NotFound {
            url: "https://arduino.github.io/".to_string(),
            command: "winget install arduino.arduino-cli".to_string(),
        };
        assert!(err.is_not_installed());
        assert!(describe(err).starts_with("CLI_ERROR_NOT_FOUND|"));
    }

    #[test]
    fn install_hint_falls_back_to_official_url() {
        let err = CliError::SpawnFailed {
            program: "arduino-cli".to_string(),
            reason: "denied".to_string(),
        };
        let hint = install_hint_for(&err);
        assert_eq!(hint.url, ARDUINO_CLI_DOWNLOAD_URL);
        assert!(hint.command.is_empty());
    }

    #[test]
    fn install_hint_preserves_cli_provided_command() {
        let err = CliError::NotFound {
            url: "https://custom".to_string(),
            command: "brew install arduino-cli".to_string(),
        };
        let hint = install_hint_for(&err);
        assert_eq!(hint.url, "https://custom");
        assert_eq!(hint.command, "brew install arduino-cli");
    }
}
