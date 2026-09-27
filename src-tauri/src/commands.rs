//! Tauri 命令：序列埠、工具鏈偵測與 Board／Library 查詢。
//!
//! 本階段（T1）只開放**唯讀查詢**命令。compile／upload 需要 T2 的草稿寫入
//! 與 operation 串流，會另行加入，避免在此放置未完成的可被呼叫路徑。

use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State, Window};

use crate::arduino::command::{self, GlobalFlags};
use crate::arduino::diagnostics::Diagnostic;
use crate::arduino::operations::{self, OperationKind, OperationState};
use crate::arduino::parser::{
    BoardDetailResponse, BoardSummaries, DetectedBoards, LibrariesResponse, PlatformsResponse,
    VersionInfo,
};
use crate::arduino::pipeline::{self, SizeUsage};
use crate::arduino::runner::{ProcessRunner, RunRequest, RunResult, StdProcessRunner};
use crate::arduino::{CliError, InstallHint, ToolchainStatus, ARDUINO_CLI_DOWNLOAD_URL};
use crate::events::names as event_names;
use crate::events::EventSink;
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

/// 以 `serialport` crate 掃描系統序列埠（含 VID／PID，供熱插拔簽章使用）。
///
/// `serialport` 4.x 的 VID／PID 只在 `SerialPortType::UsbPort` 分支提供；
/// 內建 COM 口（`PciPort`）與藍牙埠沒有這些資訊，一律視為 `None`。
fn scan_ports_detailed() -> Vec<crate::events::PortInfo> {
    use serialport::{SerialPortType, SerialPortType::UsbPort};

    serialport::available_ports()
        .map(|ports| {
            let mut infos: Vec<crate::events::PortInfo> = ports
                .into_iter()
                .map(|port| {
                    let (vid, pid) = match &port.port_type {
                        UsbPort(usb) => (Some(usb.vid), Some(usb.pid)),
                        SerialPortType::PciPort
                        | SerialPortType::BluetoothPort
                        | SerialPortType::Unknown => (None, None),
                    };
                    crate::events::PortInfo::with_ids(&port.port_name, vid, pid)
                })
                .collect();
            // 排序讓下拉選項順序穩定，避免每次刷新跳動。
            infos.sort_by(|a, b| a.port.cmp(&b.port));
            infos
        })
        .unwrap_or_default()
}

/// 以 `serialport` crate 掃描系統序列埠（只取名稱，供既有命令使用）。
fn scan_serial_ports() -> Vec<String> {
    scan_ports_detailed()
        .into_iter()
        .map(|port| port.port)
        .collect()
}

/// 把 `arduino-cli board list` 的回應轉為板子偵測結果。
///
/// 埠清單與 CLI 回應交叉比對：`board list` 只列出 CLI 看得懂的埠，兩邊的差集
/// 就是「無法辨識」的埠（通常是沒安裝對應 core 的板子），交由前端提示手動選板。
fn detect_boards(ports: &[crate::events::PortInfo], cli_stdout: &str) -> crate::events::BoardsDetected {
    use crate::arduino::parser::DetectedBoards;

    let Ok(parsed) = crate::arduino::parser::parse_json::<DetectedBoards>(cli_stdout) else {
        return crate::events::BoardsDetected::from_matches(Vec::new())
            .with_unknown(ports.iter().map(|p| p.port.clone()).collect());
    };

    let matches: Vec<crate::events::BoardMatch> = parsed
        .boards
        .into_iter()
        .map(|board| {
            let fqbn = board.fqbn.clone().unwrap_or_default();
            let name = board.matching_board.clone().unwrap_or_default();
            let port = board.port_name();
            crate::events::BoardMatch::new(&port, &fqbn, &name)
        })
        .collect();

    // CLI 對某個埠沒有給 FQBN → 該埠無法自動對應板子。
    let detected = crate::events::BoardsDetected::from_matches(matches);
    let unknown: Vec<String> = ports
        .iter()
        .map(|port| port.port.clone())
        .filter(|port| detected.fqbn_for(port).is_empty())
        .collect();
    detected.with_unknown(unknown)
}

/// 啟動序列埠／開發板熱插拔 watcher。
///
/// 每 `PORT_POLL_INTERVAL_MS`（1500ms）掃描一次序列埠，與上一輪結果做**簽章
/// diff**（`port|vid|pid`）。只有實質變化（新增／移除／換板）才 emit
/// `codebridge://serial-ports-changed`，並同步更新 `AppState` 快取。
///
/// 埠有變化時**再**呼叫 `arduino-cli board list` 補齊 port → fqbn 對應並 emit
/// `codebridge://board-detected`：`board list` 需要啟動子進程（數百毫秒），
/// 不可放在每 1500ms 的輪詢路徑上，否則 CLI 沒安裝時會每 1.5 秒失敗一次。
///
/// **為什麼簽章要含 VID／PID**：同一個 COM 口插上不同板子時埠名不變，只比對
/// 埠名會漏判，UI 就不會重新判斷 FQBN。
///
/// 首次掃描（`Initial`）也會 emit，讓前端一開啟程式就拿到完整清單。
pub fn spawn_port_watcher(app: AppHandle) {
    tauri::async_runtime::spawn_blocking(move || {
        let mut previous: Option<Vec<crate::events::PortInfo>> = None;
        loop {
            let current = scan_ports_detailed();
            let diff = crate::events::diff_ports(&current, previous.as_deref());

            if diff.change.should_emit() {
                // 同步快取，讓 `get_serial_ports`（唯讀命令）也拿到最新值。
                if let Some(state) = app.try_state::<AppState>() {
                    if let Ok(mut cache) = state.serial_ports.lock() {
                        *cache = diff.ports.clone();
                    }
                }
                let payload = crate::events::SerialPortsChanged::from(&diff);
                if let Err(err) = app.emit_to(
                    MAIN_WINDOW_LABEL_FOR_WATCHER,
                    crate::events::names::SERIAL_PORTS_CHANGED,
                    payload,
                ) {
                    eprintln!("[CodeBridge] 無法推播序列埠變化: {err}");
                }
                publish_detected_boards(&app, &current);
            }

            previous = Some(current);
            std::thread::sleep(std::time::Duration::from_millis(
                crate::events::PORT_POLL_INTERVAL_MS,
            ));
        }
    });
}

/// 以 `arduino-cli board list` 補齊 port → fqbn 對應並 emit `board-detected`。
///
/// **為什麼要丟到獨立執行緒**：`board list` 需啟動子進程並掃描 USB，耗時數百
/// 毫秒、逾時上限 60 秒。若在 watcher 的輪詢迴圈裡同步呼叫，序列埠掃描會被
/// 整段卡住 —— 使用者插拔板子時 UI 會長時間沒有反應。
///
/// **in-flight 抑制**：上一次查詢還沒回來就跳過這次，避免快速插拔時堆積
/// 出一長串 CLI 子進程。
///
/// CLI 不可用或查詢失敗時**不發事件**：前端拿不到對應時應維持使用者已選的
/// FQBN，不可因為一次查詢失敗就把板子清空。
fn publish_detected_boards(app: &AppHandle, ports: &[crate::events::PortInfo]) {
    // 已有查詢在進行 → 本輪略過。
    if BOARD_SCAN_INFLIGHT.swap(true, std::sync::atomic::Ordering::SeqCst) {
        return;
    }
    let app = app.clone();
    let ports = ports.to_vec();
    tauri::async_runtime::spawn_blocking(move || {
        let result = detect_and_emit_boards(&app, &ports);
        // 無論成功與否都要釋放旗標，否則一次例外就會永久卡住後續偵測。
        BOARD_SCAN_INFLIGHT.store(false, std::sync::atomic::Ordering::SeqCst);
        result
    });
}

/// 實際執行板子偵測並發送事件。
fn detect_and_emit_boards(
    app: &AppHandle,
    ports: &[crate::events::PortInfo],
) -> Result<(), String> {
    if ports.is_empty() {
        // 沒有任何埠時仍要發空結果，前端據此把下拉清單清空。
        let detected = crate::events::BoardsDetected::from_matches(Vec::new());
        let _ = app.emit_to(
            MAIN_WINDOW_LABEL_FOR_WATCHER,
            crate::events::names::BOARD_DETECTED,
            detected,
        );
        return Ok(());
    }

    let Some(state) = app.try_state::<AppState>() else {
        return Ok(());
    };
    // 板子偵測是附帶功能，不可讓使用者等 60 秒：給較短的逾時，
    // 逾時就當作「這次沒結果」，下一次埠變化時自然會再試。
    let Ok(cli) = resolve_cli_for(&state) else {
        return Ok(());
    };
    let runner = StdProcessRunner::new();
    let request = RunRequest::new(command::board_list(&flags_for(&state)))
        .with_timeout(BOARD_SCAN_TIMEOUT);
    let Ok(result) = runner.run(&cli, &request) else {
        return Ok(());
    };
    if let Some(error) = result.error() {
        let _ = error;
        return Ok(());
    }

    let detected = detect_boards(ports, &result.stdout);
    let _ = app.emit_to(
        MAIN_WINDOW_LABEL_FOR_WATCHER,
        crate::events::names::BOARD_DETECTED,
        detected,
    );
    Ok(())
}

/// 板子偵測逾時：短於一般查詢，避免 UI 因附帶功能而停滯。
const BOARD_SCAN_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(8);

/// 板子偵測是否已在進行中（防止 CLI 子進程堆積）。
static BOARD_SCAN_INFLIGHT: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

/// watcher emit 使用的視窗 label（與 commands.rs 的 MAIN_WINDOW_LABEL 相同）。
const MAIN_WINDOW_LABEL_FOR_WATCHER: &str = "main";

/// 開啟序列監視器（T3 實作；目前回報未實作）。
#[tauri::command]
pub fn open_serial_monitor(_port: String) -> Result<String, String> {
    Err("SERIAL_MONITOR_NOT_IMPLEMENTED".to_string())
}

/// 主視窗 label；事件一律以此視窗為目標（cocoya 的 emit_to 鐵則）。
const MAIN_WINDOW_LABEL: &str = "main";

/// compile 命令的請求 payload（camelCase，供前端 `invoke` 使用）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompilePayload {
    /// 專案識別（暫存目錄名）。
    pub project_id: String,
    /// 專案顯示名（用於推導 .ino 檔名）。
    pub project_name: String,
    /// 目標開發板 FQBN。
    pub fqbn: String,
    /// **plain code**（前端已去除 ID marker）。
    pub code: String,
    /// 編譯前清除 build 快取。
    #[serde(default)]
    pub clean: bool,
    /// 平行編譯工作數。
    #[serde(default)]
    pub jobs: Option<u32>,
}

impl CompilePayload {
    /// 轉為 pipeline 的領域型別。
    fn to_request(&self) -> pipeline::CompileRequest {
        pipeline::CompileRequest {
            project_id: self.project_id.clone(),
            project_name: self.project_name.clone(),
            fqbn: self.fqbn.clone(),
            code: self.code.clone(),
            libraries: Vec::new(),
            clean: self.clean,
            jobs: self.jobs,
        }
    }
}

/// upload 命令的請求 payload。
///
/// **不包含 build 路徑**：上傳所用的一定是後端 `last_builds` 記錄的編譯結果。
/// 若讓前端傳入 `--input-dir`，惡意的 webview 就能要求把任意目錄寫進晶片。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadPayload {
    /// 專案識別。
    pub project_id: String,
    /// 目標開發板 FQBN（必須與編譯時相同）。
    pub fqbn: String,
    /// 序列埠。
    pub port: String,
}

/// 編譯診斷事件 payload。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompileDiagnostics {
    /// 對應的作業 ID。
    pub operation_id: String,
    /// 草稿 `.ino` 檔名；前端據此判斷診斷能否跳轉到自己的程式碼。
    pub ino_file_name: String,
    /// 可定位的診斷清單。
    pub diagnostics: Vec<Diagnostic>,
    /// 資源用量（成功時才有）。
    pub size: Option<SizeUsage>,
    /// 編譯摘要原文。
    pub compiler_out: String,
    /// 失敗訊息（`KEY|detail`）。
    pub error: Option<String>,
}

impl CompileDiagnostics {
    /// 由編譯結果建立 payload。
    fn from_outcome(operation_id: &str, outcome: &pipeline::CompileOutcome) -> Self {
        Self {
            operation_id: operation_id.to_string(),
            ino_file_name: outcome.ino_file_name.clone(),
            diagnostics: outcome.diagnostics.clone(),
            size: outcome.size,
            compiler_out: outcome.compiler_out.clone(),
            error: outcome.error.clone(),
        }
    }
}

/// 產生作業 ID（UUID v4）。
///
/// 用 UUID 而非自增序：作業 ID 會出現在事件 payload 與前端 localStorage 的
/// 進行中作業清單，自增序在不同工作階段重複時會讓 UI 誤判為同一作業。
fn new_operation_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// 啟動編譯（非同步）；立即回傳作業 ID。
///
/// 為什麼非同步：編譯可能長達數分鐘（首次編譯會連帶編譯整個函式庫叢）。
/// 若同步等待，Tauri 命令執行緒會被佔住，前端既拿不到進度也無法取消。
/// 進度透過 `codebridge://operation-status` 推播，結束時再送
/// `codebridge://compile-diagnostics`。
#[tauri::command]
pub async fn compile_start(
    app: AppHandle,
    state: State<'_, AppState>,
    payload: CompilePayload,
) -> Result<String, String> {
    // CLI 解析在啟動時做：找不到 arduino-cli 要立刻回報（前端顯示安裝引導），
    // 而不是讓使用者按下執行後才在背景才失敗。
    let cli = resolve_cli_for(&state).map_err(describe)?;
    let id = new_operation_id();
    let cell = state.operations.begin(id.clone(), OperationKind::Compile);
    let request = payload.to_request();
    let dirs = state.toolchain_dirs.clone();

    let app_for_task = app.clone();
    let id_for_task = id.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = app_for_task.state::<AppState>();
        let cancel = cell.lock().expect("operation lock").cancel_flag.clone();
        let mut sink = EventSink::new(
            app_for_task.clone(),
            MAIN_WINDOW_LABEL,
            &id_for_task,
            OperationKind::Compile,
        );

        let outcome = pipeline::compile_pipeline(
            &cli,
            &dirs,
            &StdProcessRunner::new(),
            &request,
            &mut sink,
            &cancel,
        );
        // 送出最後一批輸出（避免尾端行因節流而遺失）。
        sink.flush_now(outcome.state, true);

        // 只有成功才保存 build 紀錄；取消／失敗都不允許上傳。
        if outcome.state == OperationState::Succeeded {
            let record = pipeline::build_record(&outcome, &request.fqbn);
            if let Ok(mut builds) = state.last_builds.lock() {
                builds.insert(request.project_id.clone(), record);
            }
        }

        let status = finish_operation(
            &cell,
            &outcome.state,
            outcome.error.clone(),
            sink.line_count(),
            &outcome,
        );
        let _ = app_for_task.emit_to(MAIN_WINDOW_LABEL, event_names::OPERATION_STATUS, status);
        let _ = app_for_task.emit_to(
            MAIN_WINDOW_LABEL,
            event_names::COMPILE_DIAGNOSTICS,
            CompileDiagnostics::from_outcome(&id_for_task, &outcome),
        );

        // 清除已結束的作業，避免 registry 隨編譯次數無限增長。
        state.operations.prune_finished();
    });

    Ok(id)
}

/// 更新 registry 並回傳可推播的狀態快照。
fn finish_operation(
    cell: &Arc<Mutex<operations::Operation>>,
    state: &OperationState,
    error: Option<String>,
    line_count: usize,
    outcome: &impl Serialize,
) -> operations::OperationStatus {
    let mut op = cell.lock().expect("operation lock");
    op.state = *state;
    op.message = error;
    op.line_count = line_count;
    op.result = serde_json::to_value(outcome).ok();
    op.status()
}

/// 啟動上傳（非同步）；立即回傳作業 ID。
#[tauri::command]
pub async fn upload_start(
    app: AppHandle,
    state: State<'_, AppState>,
    payload: UploadPayload,
) -> Result<String, String> {
    let cli = resolve_cli_for(&state).map_err(describe)?;

    // 後端權威：build 路徑只從 last_builds 取得，前端無法指定。
    let build = state
        .last_builds
        .lock()
        .ok()
        .and_then(|builds| builds.get(&payload.project_id).cloned())
        .ok_or_else(|| "CLI_ERROR_BUILD_STALE|尚未編譯，請先執行一次編譯".to_string())?;

    // 佔用序列埠：避免兩個作業同時操作同一個埠（會直接讓 avrdude 失敗）。
    if !state.try_acquire_port(&payload.port) {
        return Err(format!(
            "CLI_ERROR_PORT_BUSY|{} 正被其他作業使用",
            state.leased_port().unwrap_or_default()
        ));
    }

    let id = new_operation_id();
    let cell = state.operations.begin(id.clone(), OperationKind::Upload);
    let request = pipeline::UploadRequest::new(&payload.fqbn, &payload.port, build);
    let dirs = state.toolchain_dirs.clone();
    let port = payload.port.clone();

    let app_for_task = app.clone();
    let id_for_task = id.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = app_for_task.state::<AppState>();
        let cancel = cell.lock().expect("operation lock").cancel_flag.clone();
        let mut sink = EventSink::new(
            app_for_task.clone(),
            MAIN_WINDOW_LABEL,
            &id_for_task,
            OperationKind::Upload,
        );

        let outcome = pipeline::upload_pipeline(
            &cli,
            &dirs,
            &StdProcessRunner::new(),
            &request,
            &mut sink,
            &cancel,
        );
        sink.flush_now(outcome.state, true);

        let status = finish_operation(
            &cell,
            &outcome.state,
            outcome.error.clone(),
            sink.line_count(),
            &outcome,
        );
        let _ = app_for_task.emit_to(MAIN_WINDOW_LABEL, event_names::OPERATION_STATUS, status);

        // 釋放序列埠 —— 無論成功與否都必須釋放，否則埠會被永久鎖死。
        state.release_port(&port);
        state.operations.prune_finished();
    });

    Ok(id)
}

/// 查詢某專案是否存在可上傳的編譯結果。
///
/// 前端用它決定「執行」鈕的行為：已有有效 build → 直接上傳；沒有 → 先編譯。
#[tauri::command]
pub fn upload_ready(state: State<'_, AppState>, project_id: String, fqbn: String) -> bool {
    let Ok(builds) = state.last_builds.lock() else {
        return false;
    };
    let Some(build) = builds.get(&project_id) else {
        return false;
    };
    pipeline::verify_build(build, &fqbn).is_ok()
}

/// 取得應用程式版本。
#[tauri::command]
pub fn get_version() -> Result<String, String> {
    Ok(env!("CARGO_PKG_VERSION").to_string())
}

/// 真正關閉主視窗。
///
/// `on_window_event` 會攔截所有 `CloseRequested`，因此前端在使用者確認
/// （儲存／不儲存）之後呼叫本命令繞過攔截；`destroy()` 不再觸發 CloseRequested。
#[tauri::command]
pub fn app_close(window: Window) -> Result<(), String> {
    window.destroy().map_err(|error| error.to_string())
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

/// 搜尋可安裝的 board core。
///
/// 這是「第一次使用」的關鍵入口：CodeBridge 刻意與使用者的 Arduino IDE 隔離，
/// 因此新使用者**不會**看到自己已裝的核心。若沒有這條路徑，首次開啟就會
/// 卡在「清單是空的」，完全不知道該怎麼辦。
#[tauri::command]
pub fn core_search(
    state: State<AppState>,
    term: String,
) -> Result<serde_json::Value, String> {
    let result = query(&state, command::core_search(&flags_for(&state), &term))?;
    // 索引可能尚未下載（首次執行時 CLI 會自動抓取），解析失敗就回空清單
    // 而不是報錯 —— 搜尋不到不該阻擋使用者。
    let platforms = serde_json::from_str::<PlatformsResponse>(&result.stdout)
        .map(|parsed| parsed.platforms)
        .unwrap_or_default();
    Ok(serde_json::json!({ "platforms": platforms }))
}

/// 安裝（或更新）board core。
///
/// 需要獨立命令而非併入 `compile`：`core install` 會下載數百 MB，
/// 使用者必須能看到即時進度，也必須能在失敗時重試。
#[tauri::command]
pub fn core_install(
    state: State<AppState>,
    package: String,
) -> Result<serde_json::Value, String> {
    if package.trim().is_empty() {
        return Err("CLI_ERROR_INVALID_FQBN|".to_string());
    }
    let result = query(
        &state,
        command::core_install(&flags_for(&state), package.trim()),
    )?;
    Ok(serde_json::json!({
        "stdout": result.stdout,
        "package": package.trim(),
    }))
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
