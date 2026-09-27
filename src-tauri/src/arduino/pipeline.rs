//! compile / upload 的組裝層：草稿落地 → 組 CLI 命令 → 執行 → 解析結果。
//!
//! 為什麼需要這一層：`command.rs` 只負責把領域輸入轉成參數陣列（純函式），
//! `runner.rs` 只負責執行子程序（可替換 seam），兩者之間缺一段**流程編排**。
//! 把編排獨立成 `compile_pipeline` / `upload_pipeline` 並對
//! [`ProcessRunner`] 泛型化，好處是：整條「落地 → 編譯 → 解析診斷」流程
//! 可以用假 runner 與暫存目錄做完整單元測試，不需要 Tauri App，也不需要
//! 真的安裝 board core。
//!
//! 兩條重要契約：
//! 1. **行號契約**：`request.code` 必須是前端 `CodeBridgePlainCode.strip()`
//!    的輸出，落地後的 `.ino` 與程式碼面板**逐行相同**，compiler diagnostics
//!    的行號因此能直接對應 UI。本模組刻意不做第二次 marker 過濾 —— 再過濾
//!    一次不會更乾淨，只會讓行號對不起來。
//!
//! 2. **compile／upload 刻意不使用 `--json`**（實測 arduino-cli 1.2.0 驗證）：
//!    - `--json` 模式下 **stderr 完全為空**，連「正在編譯什麼」的進度都沒有；
//!      所有內容都被包成一個 JSON 物件。終端機面板會變成一片空白。
//!    - 非 JSON 模式的分工正好符合 UI 需求：**stdout 是人類可讀的進度與摘要**
//!      （「Sketch 使用 1918 位元組（5%）」），**stderr 是 gcc/avrdude 的診斷**
//!      （`path:line:col: error: msg`，正是 [`parse_compiler_output`] 處理的格式）。
//!    - `board list` / `core list` / `lib list` 等查詢仍使用 `--json`
//!      （它們是一次性查詢，不需要即時進度，結構化輸出更有價值）。
//!
//! 附帶觀察：arduino-cli 的訊息會**跟著系統 locale 本地化**（本機為 zh-TW，
//! 因此顯示「建構時出錯」）。這也是 [`super::encoding`] 必須存在的原因：
//! 父端絕不能因為不是 UTF-8 就丟掉整份輸出。

use std::path::PathBuf;
use std::sync::atomic::AtomicBool;

use serde::Serialize;

use super::command::{self, CompileOptions, GlobalFlags};
use super::diagnostics::{parse_compiler_output, Diagnostic};
use super::draft::{self, DraftError, SketchPaths};
use super::operations::OperationState;
use super::parser;
use super::paths::{CliError, CliHandle, ToolchainDirs};
use super::runner::{OutputSink, ProcessRunner, RunRequest};

/// 編譯作業的逾時上限。
///
/// **為什麼需要上限**：`arduino-cli` 一旦卡住（等待網路、驅動無回應、
/// 檔案被鎖住）作業就會**永久停滯**。CodeBridge 已移除停止鈕（見
/// `log/todo.md` 的產品決策），逾時是使用者唯一的保護。
///
/// 給 5 分鐘：一般編譯 2–5 秒，但首次編譯可能要編譯核心工具鏈，較慢。
const COMPILE_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(300);

/// 上傳作業的逾時上限。
///
/// 給 60 秒：avrdude 燒錄 8KB UNO 只要幾秒，此上限主要防範「埠被卡住」
/// 造成的永久等待。刻意比編譯短 —— 使用者看到逾時時，程式多半已經編譯完，
/// 重試的成本遠低於乾等。
const UPLOAD_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(60);

/// FQBN 允許的格式：`vendor:architecture:board`（可含額外設定項）。
///
/// 驗證 FQBN 不是為了防禦 shell 注入（參數以陣列傳遞，沒有 shell），
/// 而是為了**在使用者按下執行前就給出可翻譯的錯誤**：壞掉的板子設定應該看到
/// 「開發板設定不正確」，而不是 CLI 吐出的天書。
pub fn validate_fqbn(fqbn: &str) -> Result<(), PipelineError> {
    let trimmed = fqbn.trim();
    let segments: Vec<&str> = trimmed.split(':').collect();
    let shape_ok = segments.len() >= 3
        && segments[..3].iter().all(|segment| !segment.is_empty())
        && trimmed
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "_-+=.:".contains(c));
    if shape_ok {
        Ok(())
    } else {
        Err(PipelineError::InvalidFqbn {
            fqbn: fqbn.to_string(),
        })
    }
}

/// pipeline 層的失敗。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PipelineError {
    /// FQBN 格式不正確。
    InvalidFqbn { fqbn: String },
    /// 草稿落地失敗。
    Draft(DraftError),
    /// CLI 未安裝或無法啟動。
    Cli(CliError),
    /// 上傳前找不到可用的編譯結果。
    BuildStale { detail: String },
    /// 未提供序列埠。
    MissingPort,
}

impl PipelineError {
    /// 對應 i18n message key。
    pub fn message_key(&self) -> &'static str {
        match self {
            PipelineError::InvalidFqbn { .. } => "CLI_ERROR_INVALID_FQBN",
            PipelineError::Draft(err) => err.message_key(),
            PipelineError::Cli(err) => err.message_key(),
            PipelineError::BuildStale { .. } => "CLI_ERROR_BUILD_STALE",
            PipelineError::MissingPort => "CLI_ERROR_NO_PORT",
        }
    }
}

impl std::fmt::Display for PipelineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PipelineError::InvalidFqbn { fqbn } => write!(f, "開發板設定不正確: {}", fqbn),
            PipelineError::Draft(err) => write!(f, "{}", err),
            PipelineError::Cli(err) => write!(f, "{}", err),
            PipelineError::BuildStale { detail } => {
                write!(f, "編譯結果已失效，請重新編譯: {}", detail)
            }
            PipelineError::MissingPort => write!(f, "尚未選擇序列埠"),
        }
    }
}

impl std::error::Error for PipelineError {}

impl From<DraftError> for PipelineError {
    fn from(error: DraftError) -> Self {
        PipelineError::Draft(error)
    }
}

impl From<CliError> for PipelineError {
    fn from(error: CliError) -> Self {
        PipelineError::Cli(error)
    }
}

/// 轉為前端可顯示的 `KEY|detail` 字串。
pub fn describe_error(error: &PipelineError) -> String {
    format!("{}|{}", error.message_key(), error)
}

/// compile 請求。
#[derive(Debug, Clone)]
pub struct CompileRequest {
    /// 專案識別（暫存目錄名；必須通過白名單驗證）。
    pub project_id: String,
    /// 專案顯示名（會被 sanitize 成 sketch stem）。
    pub project_name: String,
    /// 目標開發板。
    pub fqbn: String,
    /// **plain code**（已去除 ID marker）。
    pub code: String,
    /// 額外 library 搜尋路徑。
    pub libraries: Vec<PathBuf>,
    /// 編譯前清除 build 快取。
    pub clean: bool,
    /// 平行編譯工作數。
    pub jobs: Option<u32>,
}

impl CompileRequest {
    /// 建立最小可用請求（其餘選項採教學預設）。
    pub fn new(project_id: &str, project_name: &str, fqbn: &str, code: &str) -> Self {
        Self {
            project_id: project_id.to_string(),
            project_name: project_name.to_string(),
            fqbn: fqbn.to_string(),
            code: code.to_string(),
            libraries: Vec::new(),
            clean: false,
            jobs: None,
        }
    }
}

/// compile 結果。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompileOutcome {
    /// 作業狀態。
    pub state: OperationState,
    /// 草稿的 `.ino` 檔名（例如 `Blink.ino`），用於比對 diagnostics 的檔名。
    pub ino_file_name: String,
    /// 草稿目錄。
    pub sketch_dir: PathBuf,
    /// 編譯輸出目錄（成功時用於 upload）。
    pub build_dir: PathBuf,
    /// 可定位的編譯器診斷。
    pub diagnostics: Vec<Diagnostic>,
    /// 編譯摘要（stdout 原文，例如記憶體用量）。
    pub compiler_out: String,
    /// 診斷原文（stderr 原文）。
    pub compiler_err: String,
    /// 資源用量摘要（成功時才有；由 [`parse_size_report`] 解析）。
    pub size: Option<SizeUsage>,
    /// 終端機面板用的輸出行。
    pub logs: Vec<String>,
    /// 失敗時的 `KEY|detail` 字串。
    pub error: Option<String>,
}

impl CompileOutcome {
    /// 尚未落地草稿就失敗時的骨架。
    fn failure(state: OperationState, error: &PipelineError, sketch: Option<&SketchPaths>) -> Self {
        Self {
            state,
            ino_file_name: sketch.map(|s| s.ino_file_name()).unwrap_or_default(),
            sketch_dir: sketch.map(|s| s.sketch_dir.clone()).unwrap_or_default(),
            build_dir: PathBuf::new(),
            diagnostics: Vec::new(),
            compiler_out: String::new(),
            compiler_err: String::new(),
            size: None,
            logs: Vec::new(),
            error: Some(describe_error(error)),
        }
    }

    /// 以草稿資訊補齊欄位（避免每個分支重複搬運）。
    fn with_sketch(
        state: OperationState,
        sketch: &SketchPaths,
        build_dir: PathBuf,
        diagnostics: Vec<Diagnostic>,
        compiler_out: String,
        compiler_err: String,
        size: Option<SizeUsage>,
        logs: Vec<String>,
        error: Option<String>,
    ) -> Self {
        Self {
            state,
            ino_file_name: sketch.ino_file_name(),
            sketch_dir: sketch.sketch_dir.clone(),
            build_dir,
            diagnostics,
            compiler_out,
            compiler_err,
            size,
            logs,
            error,
        }
    }
}

/// Flash / RAM 用量摘要。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SizeUsage {
    /// 程式儲存空間（Flash）用量位元組。
    pub flash_bytes: u32,
    /// Flash 用量百分比。
    pub flash_percent: u32,
    /// 動態記憶體（RAM）用量位元組。
    pub ram_bytes: u32,
    /// RAM 用量百分比。
    pub ram_percent: u32,
}

/// 從編譯摘要解析資源用量。
///
/// **刻意不依賴訊息文字**：arduino-cli 會跟著系統 locale 本地化（繁中為
/// 「Sketch 使用 1918 位元組（5%）」，英文為 "Sketch uses 1918 bytes (5%)"），
/// 因此改用與語言無關的結構特徵：**一行含有「數字緊接 `%`」即為用量行**
/// （平台版本表不含 `%`，因此不會誤判）。
/// 第一個數字視為位元組數、第一個帶 `%` 的數字視為百分比；只取前兩行
/// （第一行 Flash、第二行 RAM）。找不到就回 `None`，UI 隱藏用量條
/// （不影響編譯成功判定）。
pub fn parse_size_report(stdout: &str) -> Option<SizeUsage> {
    let mut usage: Option<SizeUsage> = None;
    for line in stdout.lines() {
        let (bytes, percent) = match parse_bytes_and_percent(line.trim()) {
            Some(parsed) => parsed,
            None => continue,
        };
        match usage.as_mut() {
            None => {
                usage = Some(SizeUsage {
                    flash_bytes: bytes,
                    flash_percent: percent,
                    ram_bytes: 0,
                    ram_percent: 0,
                })
            }
            Some(existing) => {
                existing.ram_bytes = bytes;
                existing.ram_percent = percent;
                break;
            }
        }
    }
    usage
}

/// 從一行取出「位元組數」與「百分比」；不是用量行時回傳 `None`。
///
/// 規則：行內第一個數字是位元組數；必須存在**緊接 `%`** 的數字才算用量行。
fn parse_bytes_and_percent(line: &str) -> Option<(u32, u32)> {
    let mut numbers: Vec<(u32, bool)> = Vec::new(); // (value, 是否緊接 %)
    let chars: Vec<char> = line.chars().collect();
    let mut index = 0;
    while index < chars.len() {
        if chars[index].is_ascii_digit() {
            let start = index;
            while index < chars.len() && chars[index].is_ascii_digit() {
                index += 1;
            }
            let text: String = chars[start..index].iter().collect();
            let has_percent = chars.get(index) == Some(&'%');
            if let Ok(value) = text.parse::<u32>() {
                numbers.push((value, has_percent));
            }
        } else {
            index += 1;
        }
    }
    let bytes = numbers.first().map(|(value, _)| *value)?;
    let percent = numbers
        .iter()
        .find(|(_, has_percent)| *has_percent)
        .map(|(value, _)| *value)?;
    Some((bytes, percent))
}

/// 建立隔離旗標（compile / upload 共用）。
///
/// **刻意不加 `--json`**：見模組層文件對 arduino-cli 1.2.0 的實測結論。
fn flags(dirs: &ToolchainDirs) -> GlobalFlags {
    GlobalFlags::isolated(dirs)
}

/// 執行編譯：落地草稿 → 組命令 → 執行 → 解析結果。
///
/// 刻意**不設逾時**：首次編譯會連帶編譯整個函式庫叢，動輒數分鐘；
/// 使用者要中止請用取消鈕（`cancel` 旗標），而不是被 timeout 硬殺。
pub fn compile_pipeline<R: ProcessRunner>(
    cli: &CliHandle,
    dirs: &ToolchainDirs,
    runner: &R,
    request: &CompileRequest,
    sink: &mut dyn OutputSink,
    cancel: &AtomicBool,
) -> CompileOutcome {
    if let Err(error) = validate_fqbn(&request.fqbn) {
        return CompileOutcome::failure(OperationState::Failed, &error, None);
    }

    // 1) 落地草稿。
    let sketch = match draft::write_sketch(
        dirs,
        &request.project_id,
        &request.project_name,
        &request.code,
    ) {
        Ok(paths) => paths,
        Err(error) => {
            let error = PipelineError::Draft(error);
            return CompileOutcome::failure(OperationState::Failed, &error, None);
        }
    };
    let requested_build_dir = sketch.build_dir(&dirs.build_root);
    if let Err(error) = std::fs::create_dir_all(&requested_build_dir) {
        let error = PipelineError::Draft(DraftError::WriteFailed {
            path: requested_build_dir.display().to_string(),
            reason: error.to_string(),
        });
        return CompileOutcome::failure(OperationState::Failed, &error, Some(&sketch));
    }

    // 2) 組命令並執行。
    let options = CompileOptions {
        export_binaries: true,
        clean: request.clean,
        warnings: Some("all".to_string()),
        jobs: request.jobs,
        libraries: request.libraries.clone(),
    };
    let cli_command = command::compile(
        &flags(dirs),
        &sketch.sketch_dir,
        &request.fqbn,
        &requested_build_dir,
        &options,
    );

    let result = match runner.run_streamed(
        cli,
        &RunRequest::new(cli_command).with_timeout(COMPILE_TIMEOUT),
        sink,
        cancel,
    ) {
        Ok(result) => result,
        Err(error) => {
            let error = PipelineError::Cli(error);
            return CompileOutcome::failure(OperationState::Failed, &error, Some(&sketch));
        }
    };

    let logs = sink.recent_lines();
    let compiler_out = result.stdout.clone();
    let compiler_err = result.stderr.clone();

    // 3) 解析診斷。gcc / avrdude 的錯誤固定寫在 stderr（實測已確認），
    //    但部分工具鏈會混在 stdout，因此兩邊都掃描並依「行號+訊息」去重。
    //    成功時 stderr 仍會有**函式庫核心檔的警告**（例如 avr-gcc 對
    //    `new.cpp` 的 unused parameter），UI 需依檔名過濾，只跳轉自己的草稿。
    let diagnostics = collect_diagnostics(&result.stderr, &result.stdout);
    let size = parse_size_report(&result.stdout);

    // 4) 終態分支：取消與逾時必須先於成功／失敗判斷，否則使用者會看到
    //    「編譯失敗」而不是「已取消」，且 build 紀錄會被錯誤保存。
    if result.cancelled {
        return CompileOutcome::with_sketch(
            OperationState::Cancelled,
            &sketch,
            requested_build_dir,
            diagnostics,
            compiler_out,
            compiler_err,
            size,
            logs,
            Some("CLI_OPERATION_CANCELLED|".to_string()),
        );
    }
    if result.timed_out {
        return CompileOutcome::with_sketch(
            OperationState::TimedOut,
            &sketch,
            requested_build_dir,
            diagnostics,
            compiler_out,
            compiler_err,
            size,
            logs,
            Some("CLI_OPERATION_TIMED_OUT|".to_string()),
        );
    }

    // 5) 成功判定：非 JSON 模式下以結束碼為準（實測 compile 失敗時 exit=1）。
    if result.is_success() {
        return CompileOutcome::with_sketch(
            OperationState::Succeeded,
            &sketch,
            requested_build_dir,
            diagnostics,
            compiler_out,
            compiler_err,
            size,
            logs,
            None,
        );
    }

    // 失敗：優先取第一條 error 診斷（最貼近使用者看到的訊息），沒有才用
    // CLI 的結束訊息或診斷數量描述。
    let first_error = diagnostics
        .iter()
        .find(|diag| diag.severity == super::diagnostics::DiagnosticSeverity::Error)
        .map(|diag| format!("{}:{} {}", diag.file, diag.line, diag.message));
    let detail = first_error.or_else(|| parser::extract_error_message(&result.stderr));
    let error = match detail {
        Some(detail) => format!("CLI_ERROR_COMPILE_FAILED|{}", detail),
        None => format!("CLI_ERROR_COMPILE_FAILED|{} 條診斷", diagnostics.len()),
    };

    CompileOutcome::with_sketch(
        OperationState::Failed,
        &sketch,
        requested_build_dir,
        diagnostics,
        compiler_out,
        compiler_err,
        size,
        logs,
        Some(error),
    )
}

/// 收集診斷：掃描 stderr 與 stdout 並依「嚴重度/檔名/行/訊息」去重。
///
/// 兩個來源都要掃：實測 gcc 診斷固定在 stderr，但不同工具鏈（esp32-openocd、
/// esptool）有時把訊息寫到 stdout，只掃 stderr 會讓使用者看到「編譯失敗但沒訊息」。
fn collect_diagnostics(stderr: &str, stdout: &str) -> Vec<Diagnostic> {
    let mut collected: Vec<Diagnostic> = Vec::new();
    for source in [stderr, stdout] {
        for diagnostic in parse_compiler_output(source) {
            let duplicate = collected.iter().any(|existing| {
                existing.severity == diagnostic.severity
                    && existing.file == diagnostic.file
                    && existing.line == diagnostic.line
                    && existing.column == diagnostic.column
                    && existing.message == diagnostic.message
            });
            if !duplicate {
                collected.push(diagnostic);
            }
        }
    }
    collected
}

/// 一次成功編譯的紀錄（上傳時的必要前置）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildRecord {
    /// 編譯時使用的開發板。
    pub fqbn: String,
    /// 編譯輸出目錄（upload 的 `--input-dir`）。
    pub build_dir: PathBuf,
    /// 草稿目錄（upload 的位置參數）。
    pub sketch_dir: PathBuf,
    /// 草稿 `.ino` 檔名。
    pub ino_file_name: String,
}

/// 由成功的 compile 結果建立 build 紀錄。
pub fn build_record(outcome: &CompileOutcome, fqbn: &str) -> BuildRecord {
    BuildRecord {
        fqbn: fqbn.to_string(),
        build_dir: outcome.build_dir.clone(),
        sketch_dir: outcome.sketch_dir.clone(),
        ino_file_name: outcome.ino_file_name.clone(),
    }
}

/// upload 請求。
#[derive(Debug, Clone)]
pub struct UploadRequest {
    /// 開發板。
    pub fqbn: String,
    /// 序列埠。
    pub port: String,
    /// 上一次成功編譯的紀錄。
    pub build: BuildRecord,
}

impl UploadRequest {
    /// 建立 upload 請求。
    pub fn new(fqbn: &str, port: &str, build: BuildRecord) -> Self {
        Self {
            fqbn: fqbn.to_string(),
            port: port.to_string(),
            build,
        }
    }
}

/// upload 結果。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadOutcome {
    /// 作業狀態。
    pub state: OperationState,
    /// 終端機面板用的輸出行。
    pub logs: Vec<String>,
    /// 合併輸出（便於 UI 顯示）。
    pub output: String,
    /// 失敗時的 `KEY|detail` 字串。
    pub error: Option<String>,
}

/// 驗證 build 紀錄仍可用於上傳。
///
/// 兩種失效情境必須擋下：
/// - FQBN 與編譯時不同（使用者換板子了；上傳會寫進錯誤的晶片）。
/// - 輸出或草稿目錄不存在（暫存被清掉、重開應用程式）。
pub fn verify_build(build: &BuildRecord, fqbn: &str) -> Result<(), PipelineError> {
    if build.fqbn != fqbn {
        return Err(PipelineError::BuildStale {
            detail: format!("編譯時使用 {}，目前選擇 {}", build.fqbn, fqbn),
        });
    }
    if !build.build_dir.is_dir() {
        return Err(PipelineError::BuildStale {
            detail: format!(
                "找不到編譯輸出目錄 {}",
                build.build_dir.display()
            ),
        });
    }
    if !build.sketch_dir.join(&build.ino_file_name).is_file() {
        return Err(PipelineError::BuildStale {
            detail: format!(
                "找不到草稿 {}",
                build.sketch_dir.join(&build.ino_file_name).display()
            ),
        });
    }
    Ok(())
}

/// 執行上傳：驗證前置 → 組命令 → 執行。
pub fn upload_pipeline<R: ProcessRunner>(
    cli: &CliHandle,
    dirs: &ToolchainDirs,
    runner: &R,
    request: &UploadRequest,
    sink: &mut dyn OutputSink,
    cancel: &AtomicBool,
) -> UploadOutcome {
    if let Err(error) = validate_fqbn(&request.fqbn) {
        return failed_upload(&error, Vec::new());
    }
    if request.port.trim().is_empty() {
        return failed_upload(&PipelineError::MissingPort, Vec::new());
    }
    if let Err(error) = verify_build(&request.build, &request.fqbn) {
        return failed_upload(&error, Vec::new());
    }

    let cli_command = command::upload(
        &flags(dirs),
        &request.build.sketch_dir,
        &request.fqbn,
        request.port.trim(),
        &request.build.build_dir,
    );

    match runner.run_streamed(
        cli,
        &RunRequest::new(cli_command).with_timeout(UPLOAD_TIMEOUT),
        sink,
        cancel,
    ) {
        Ok(result) => {
            let logs = sink.recent_lines();
            if result.cancelled {
                return UploadOutcome {
                    state: OperationState::Cancelled,
                    logs,
                    output: result.stderr,
                    error: Some("CLI_OPERATION_CANCELLED|".to_string()),
                };
            }
            if result.is_success() {
                return UploadOutcome {
                    state: OperationState::Succeeded,
                    logs,
                    output: result.stdout,
                    error: None,
                };
            }
            // 合併兩條管線：avrdude 的進度在 stderr，成功訊息在 stdout。
            let merged = if result.stderr.is_empty() {
                result.stdout.clone()
            } else if result.stdout.is_empty() {
                result.stderr.clone()
            } else {
                format!("{}\n{}", result.stderr, result.stdout)
            };
            let error = result
                .error()
                .map(|err| describe_error(&PipelineError::Cli(err)))
                .unwrap_or_else(|| "CLI_ERROR_UPLOAD_FAILED|".to_string());
            UploadOutcome {
                state: OperationState::Failed,
                logs,
                output: merged,
                error: Some(error),
            }
        }
        Err(error) => {
            let error = PipelineError::Cli(error);
            failed_upload(&error, Vec::new())
        }
    }
}

/// 失敗的 upload 結果。
fn failed_upload(error: &PipelineError, logs: Vec<String>) -> UploadOutcome {
    UploadOutcome {
        state: OperationState::Failed,
        logs,
        output: String::new(),
        error: Some(describe_error(error)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;
    use std::sync::atomic::AtomicBool;
    use std::sync::{Arc, Mutex};

    use super::super::runner::RunResult;

    #[test]
    fn compile_and_upload_have_bounded_timeouts() {
        // 沒有逾時時，arduino-cli 一旦卡住（網路等待、驅動無回應）作業就
        // **永久停滯**，使用者只能關掉應用程式。這是移除停止鈕後唯一的保護，
        // 因此兩個常數都必須有上限，且編譯要給得比上傳寬鬆。
        assert!(COMPILE_TIMEOUT > UPLOAD_TIMEOUT);
        assert!(
            COMPILE_TIMEOUT <= std::time::Duration::from_secs(600),
            "compile timeout must stay under 10 minutes"
        );
        assert!(
            UPLOAD_TIMEOUT <= std::time::Duration::from_secs(120),
            "upload timeout must stay under 2 minutes"
        );
    }

    #[test]
    fn timed_out_run_is_reported_as_failure_not_success() {
        // 逾時的子程序 `exit_code` 為 None，若當成成功會讓 UI 顯示
        // 「編譯成功」而 build 目錄其實是空的 —— 使用者按上傳才會莫名失敗。
        let result = RunResult {
            exit_code: None,
            stdout: String::new(),
            stderr: String::new(),
            timed_out: true,
            cancelled: false,
            line_count: 0,
        };
        assert!(!result.is_success());
        assert!(result.timed_out);
    }

    /// 測試用暫存根目錄。
    struct TempRoot(PathBuf);

    impl TempRoot {
        fn new(tag: &str) -> Self {
            let path = std::env::temp_dir().join(format!("codebridge-pipeline-{tag}"));
            let _ = std::fs::remove_dir_all(&path);
            std::fs::create_dir_all(&path).expect("create temp root");
            Self(path)
        }

        fn dirs(&self) -> ToolchainDirs {
            ToolchainDirs::under(&self.0)
        }
    }

    impl Drop for TempRoot {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    /// 可注入預設回應並記錄請求參數的假 runner。
    struct ScriptedRunner {
        result: RunResult,
        recorded: Arc<Mutex<Vec<Vec<String>>>>,
    }

    impl ScriptedRunner {
        fn ok(stdout: &str) -> Self {
            Self::with(RunResult::ok(stdout))
        }

        fn with(result: RunResult) -> Self {
            Self {
                result,
                recorded: Arc::new(Mutex::new(Vec::new())),
            }
        }

        /// 最近一次請求的完整參數。
        fn last_args(&self) -> Vec<String> {
            self.recorded.lock().expect("lock").last().cloned().unwrap_or_default()
        }
    }

    impl ProcessRunner for ScriptedRunner {
        fn run(&self, _cli: &CliHandle, request: &RunRequest) -> Result<RunResult, CliError> {
            self.recorded.lock().expect("lock").push(request.command.args.clone());
            Ok(self.result.clone())
        }
    }

    /// 不需真實檔案的 CLI handle。
    fn handle() -> CliHandle {
        CliHandle {
            program: PathBuf::from("arduino-cli"),
            source: super::super::paths::CliSource::SystemPath,
        }
    }

    const CODE: &str = "void setup() {\n  pinMode(13, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(13, HIGH);\n}";

    /// 成功編譯的**非 JSON** 輸出（實測 arduino-cli 1.2.0 的繁中摘要）。
    ///
    /// 刻意使用真實擷取的字串（含全形括號與百分比），確保 parser 不依賴英文。
    const SUCCESS_STDOUT: &str = "使用的平台       版本    路徑\narduino:avr 1.8.6 /path/to/avr\n\nSketch 使用 1918 位元組（5%）的程式儲存空間。最大為 32256 位元組\n全域變數使用 184 位元組 (8%) 的動態記憶體, 保留 1864 位元組給區域變數. 最大 2048 位元組\n";

    /// 成功編譯時 stderr 會有**函式庫核心檔**的警告（非使用者草稿）。
    const LIBRARY_WARNINGS: &str = "C:/cores/arduino/new.cpp:59:60: warning: unused parameter 'tag' [-Wunused-parameter]\n void * operator new(std::size_t size, const std::nothrow_t tag) noexcept {\n";

    fn request() -> CompileRequest {
        CompileRequest::new("proj-1", "Blink", "arduino:avr:uno", CODE)
    }


    #[test]
    fn validates_well_formed_fqbn() {
        assert!(validate_fqbn("arduino:avr:uno").is_ok());
        assert!(validate_fqbn("esp32:esp32:esp32").is_ok());
        // 帶設定項的 FQBN 也是合法的。
        assert!(validate_fqbn("arduino:avr:nano:cpu=atmega328old").is_ok());
    }

    #[test]
    fn rejects_malformed_fqbn() {
        for bad in ["", "uno", "arduino:uno", "arduino::uno", ":avr:uno", "arduino avr uno"] {
            let error = validate_fqbn(bad).expect_err("must reject");
            assert_eq!(error.message_key(), "CLI_ERROR_INVALID_FQBN");
            assert!(describe_error(&error).starts_with("CLI_ERROR_INVALID_FQBN|"));
        }
    }

    #[test]
    fn compile_writes_plain_code_to_disk() {
        let temp = TempRoot::new("write");
        let runner = ScriptedRunner::ok(SUCCESS_STDOUT);

        let outcome = compile_with(&temp, &runner, &request());

        assert_eq!(outcome.state, OperationState::Succeeded);
        assert_eq!(outcome.ino_file_name, "Blink.ino");
        let ino = outcome.sketch_dir.join("Blink.ino");
        assert!(ino.is_file(), "draft must exist");
        let written = std::fs::read_to_string(&ino).expect("read");
        // 逐行相同 → diagnostics 行號才能對應 UI。
        assert_eq!(written.lines().count(), CODE.lines().count());
        // marker 不得落地（前端已 strip；這裡鎖住「後端不破壞內容」）。
        assert!(!written.contains("__BLOCKLY_ID"));
    }

    #[test]
    fn compile_passes_fqbn_and_build_path() {
        let temp = TempRoot::new("args");
        let runner = ScriptedRunner::ok(SUCCESS_STDOUT);

        compile_with(&temp, &runner, &request());

        let args = runner.last_args();
        let joined = args.join(" ");
        assert!(joined.contains("-b arduino:avr:uno"), "got {joined}");
        assert!(joined.contains("--build-path"), "got {joined}");
        assert!(joined.contains("--export-binaries"), "got {joined}");
        // 關鍵決策：compile 必須是**非 JSON** 模式，否則終端機面板會沒有進度。
        assert!(!joined.contains("--json"), "compile must not use --json: {joined}");
        // 全域旗標必須在子命令之前。
        let config_idx = args.iter().position(|a| a == "--config-dir").expect("config-dir");
        let compile_idx = args.iter().position(|a| a == "compile").expect("compile");
        assert!(config_idx < compile_idx);
    }

    #[test]
    fn compile_parses_size_report_from_localized_output() {
        let temp = TempRoot::new("size");
        let runner = ScriptedRunner::ok(SUCCESS_STDOUT);

        let outcome = compile_with(&temp, &runner, &request());

        let size = outcome.size.expect("size report");
        assert_eq!(size.flash_bytes, 1918);
        assert_eq!(size.flash_percent, 5);
        assert_eq!(size.ram_bytes, 184);
        assert_eq!(size.ram_percent, 8);
    }

    #[test]
    fn compile_keeps_library_warnings_with_their_own_file_name() {
        // 實測：成功編譯時 stderr 仍有 avr 核心檔的警告。UI 需要靠檔名判斷
        // 能否跳轉，因此後端必須原樣保留，不可過濾掉。
        let temp = TempRoot::new("libwarn");
        let runner = ScriptedRunner::with(RunResult::failure(0, SUCCESS_STDOUT, LIBRARY_WARNINGS));

        let outcome = compile_with(&temp, &runner, &request());

        assert_eq!(outcome.diagnostics.len(), 1);
        assert_eq!(outcome.diagnostics[0].file, "new.cpp");
        assert_eq!(outcome.diagnostics[0].line, 59);
        assert_ne!(outcome.diagnostics[0].file, outcome.ino_file_name);
    }

    #[test]
    fn compile_failure_yields_locatable_diagnostics() {
        // 實測擷取的 gcc 輸出格式（繁中 Windows，含 CRLF 與「In function」行）。
        let temp = TempRoot::new("fail");
        let stderr = "C:/sketches/proj-1/Blink.ino: In function 'void setup()':\r\n\
                      C:/sketches/proj-1/Blink.ino:3:1: error: expected ';' before '}' token\r\n\
                      }\r\n\
                      ^\r\n\
                      C:/sketches/proj-1/Blink.ino:5:25: error: expected '}' at end of input\r\n\
                      建構時出錯: exit status 1\r\n";
        let runner = failed_compile(stderr);

        let outcome = compile_with(&temp, &runner, &request());

        assert_eq!(outcome.state, OperationState::Failed);
        assert_eq!(outcome.diagnostics.len(), 2);
        // 診斷檔名必須與草稿檔名一致，UI 才能判斷可否跳轉。
        assert_eq!(outcome.diagnostics[0].file, "Blink.ino");
        assert_eq!(outcome.diagnostics[0].line, 3);
        // 0-based 行索引 = 1-based 行號 - 1。
        assert_eq!(outcome.diagnostics[0].zero_based_line(), 2);
        // 「In function ...」與「^」等非診斷行必須被略過。
        assert!(outcome
            .diagnostics
            .iter()
            .all(|d| !d.message.contains("In function")));
        // 失敗訊息取第一條 error 診斷，而不是 CLI 的結束訊息。
        let error = outcome.error.expect("error");
        assert!(error.starts_with("CLI_ERROR_COMPILE_FAILED|"), "got {error}");
        assert!(error.contains("Blink.ino:3"), "got {error}");
    }

    #[test]
    fn compile_also_scans_diagnostics_written_to_stdout() {
        // esp32-openocd / esptool 有時把錯誤寫在 stdout，只掃 stderr 會讓
        // 使用者看到「編譯失敗但沒訊息」。
        let temp = TempRoot::new("stdout-diag");
        let runner = ScriptedRunner::with(RunResult::failure(
            1,
            "esptool.py:2:1: error: Failed to connect",
            "",
        ));

        let outcome = compile_with(&temp, &runner, &request());

        assert_eq!(outcome.state, OperationState::Failed);
        assert_eq!(outcome.diagnostics.len(), 1);
        assert_eq!(outcome.diagnostics[0].line, 2);
    }

    #[test]
    fn collect_diagnostics_deduplicates_across_streams() {
        let line = "C:/x/Blink.ino:4:3: error: oops\n";
        let collected = collect_diagnostics(line, line);
        assert_eq!(collected.len(), 1, "same diagnostic must appear once");
    }

    #[test]
    fn compile_reports_cancelled_state() {
        let temp = TempRoot::new("cancel");
        let mut result = RunResult::ok(SUCCESS_STDOUT);
        result.cancelled = true;
        let runner = ScriptedRunner::with(result);

        let outcome = compile_with(&temp, &runner, &request());

        assert_eq!(outcome.state, OperationState::Cancelled);
        // 已取消時絕不可被當成成功（否則會保存 build 紀錄並允許上傳）。
        assert!(outcome.error.is_some());
    }

    #[test]
    fn compile_rejects_invalid_fqbn_before_touching_disk() {
        let temp = TempRoot::new("badfqbn");
        let dirs = temp.dirs();
        let runner = ScriptedRunner::ok(SUCCESS_STDOUT);
        let mut request = request();
        request.fqbn = "uno".to_string();

        let outcome = compile_with(&temp, &runner, &request);

        assert_eq!(outcome.state, OperationState::Failed);
        assert!(outcome.error.expect("error").starts_with("CLI_ERROR_INVALID_FQBN|"));
        assert!(runner.last_args().is_empty(), "must not spawn CLI");
        assert!(!dirs.build_root.join("proj-1").exists(), "no draft on invalid fqbn");
    }

    #[test]
    fn compile_rejects_empty_code() {
        let temp = TempRoot::new("emptycode");
        let runner = ScriptedRunner::ok(SUCCESS_STDOUT);
        let request = CompileRequest::new("proj-1", "Blink", "arduino:avr:uno", "   \n ");

        let outcome = compile_with(&temp, &runner, &request);

        assert_eq!(outcome.state, OperationState::Failed);
        assert!(outcome.error.expect("error").starts_with("DRAFT_ERROR_EMPTY_CODE|"));
    }

    /// 建立一個可上傳的 build 紀錄（草稿與輸出目錄都真實存在）。
    fn fresh_build(temp: &TempRoot, runner: &ScriptedRunner) -> BuildRecord {
        let outcome = compile_with(temp, runner, &request());
        assert_eq!(outcome.state, OperationState::Succeeded);
        // CLI 回報的路徑不存在於測試環境，改以我們指定的目錄為準。
        let mut record = build_record(&outcome, "arduino:avr:uno");
        record.build_dir = outcome
            .sketch_dir
            .parent()
            .map(|root| root.join("build").join("Blink"))
            .expect("parent");
        std::fs::create_dir_all(&record.build_dir).expect("create build dir");
        record
    }

    /// 執行一次上傳（測試用捷徑）。
    fn upload_with(
        temp: &TempRoot,
        runner: &ScriptedRunner,
        request: &UploadRequest,
    ) -> UploadOutcome {
        let mut sink = super::super::runner::BoundedSink::default();
        upload_pipeline(
            &handle(),
            &temp.dirs(),
            runner,
            request,
            &mut sink,
            &AtomicBool::new(false),
        )
    }

    #[test]
    fn upload_passes_port_and_input_dir() {
        let temp = TempRoot::new("upload");
        let build = fresh_build(&temp, &ScriptedRunner::ok(SUCCESS_STDOUT));
        let upload_runner = ScriptedRunner::ok("{\"success\":true}");

        let outcome = upload_with(
            &temp,
            &upload_runner,
            &UploadRequest::new("arduino:avr:uno", "COM3", build),
        );

        assert_eq!(outcome.state, OperationState::Succeeded);
        let joined = upload_runner.last_args().join(" ");
        assert!(joined.contains("-p COM3"), "got {joined}");
        assert!(joined.contains("--input-dir"), "got {joined}");
        assert!(joined.contains("upload"), "got {joined}");
    }

    #[test]
    fn upload_refuses_when_fqbn_changed() {
        let temp = TempRoot::new("stale-fqbn");
        let build = fresh_build(&temp, &ScriptedRunner::ok(SUCCESS_STDOUT));
        let upload_runner = ScriptedRunner::ok("{\"success\":true}");

        let outcome = upload_with(
            &temp,
            &upload_runner,
            &UploadRequest::new("arduino:avr:mega", "COM3", build),
        );

        assert_eq!(outcome.state, OperationState::Failed);
        assert!(outcome.error.expect("error").starts_with("CLI_ERROR_BUILD_STALE|"));
        assert!(
            upload_runner.last_args().is_empty(),
            "must not upload to wrong board"
        );
    }

    #[test]
    fn upload_refuses_when_build_dir_missing() {
        let temp = TempRoot::new("stale-dir");
        let mut build = fresh_build(&temp, &ScriptedRunner::ok(SUCCESS_STDOUT));
        build.build_dir = temp.dirs().build_root.join("does-not-exist");
        let upload_runner = ScriptedRunner::ok("{\"success\":true}");

        let outcome = upload_with(
            &temp,
            &upload_runner,
            &UploadRequest::new("arduino:avr:uno", "COM3", build),
        );

        assert_eq!(outcome.state, OperationState::Failed);
        assert!(outcome.error.expect("error").starts_with("CLI_ERROR_BUILD_STALE|"));
    }

    #[test]
    fn upload_requires_a_port() {
        let temp = TempRoot::new("noport");
        let build = fresh_build(&temp, &ScriptedRunner::ok(SUCCESS_STDOUT));
        let upload_runner = ScriptedRunner::ok("{\"success\":true}");

        let outcome = upload_with(
            &temp,
            &upload_runner,
            &UploadRequest::new("arduino:avr:uno", "  ", build),
        );

        assert_eq!(outcome.state, OperationState::Failed);
        assert!(outcome.error.expect("error").starts_with("CLI_ERROR_NO_PORT|"));
    }

    #[test]
    fn upload_failure_merges_both_pipes() {
        let temp = TempRoot::new("uploadfail");
        let build = fresh_build(&temp, &ScriptedRunner::ok(SUCCESS_STDOUT));
        let upload_runner = ScriptedRunner::with(RunResult::failure(
            1,
            r#"{"message":"avrdude: verification error"}"#,
            "Performing 100% readout",
        ));

        let outcome = upload_with(
            &temp,
            &upload_runner,
            &UploadRequest::new("arduino:avr:uno", "COM3", build),
        );

        assert_eq!(outcome.state, OperationState::Failed);
        // 兩條管線的內容都要看得到（avrdude 進度在 stderr）。
        assert!(outcome.output.contains("Performing 100% readout"));
        assert!(outcome.output.contains("verification error"));
        assert!(outcome.error.expect("error").starts_with("CLI_ERROR_COMMAND_FAILED|"));
    }

    #[test]
    fn build_record_keeps_sketch_and_build_paths() {
        let temp = TempRoot::new("record");
        let dirs = temp.dirs();
        let runner = ScriptedRunner::ok(SUCCESS_STDOUT);

        let outcome = compile_with(&temp, &runner, &request());
        let record = build_record(&outcome, "arduino:avr:uno");

        assert_eq!(record.fqbn, "arduino:avr:uno");
        assert_eq!(record.ino_file_name, "Blink.ino");
        // 草稿路徑是 `build_root/<project_id>/<stem>`：最內層目錄名與主檔名
        // 相同（arduino-cli 硬性要求），外層 project_id 提供專案隔離。
        assert_eq!(record.sketch_dir, dirs.sketch_path("proj-1", "Blink"));
    }

    #[test]
    fn pipeline_error_keys_are_stable_for_i18n() {
        assert_eq!(PipelineError::MissingPort.message_key(), "CLI_ERROR_NO_PORT");
        assert_eq!(
            PipelineError::BuildStale {
                detail: "x".to_string()
            }
            .message_key(),
            "CLI_ERROR_BUILD_STALE"
        );
        assert_eq!(
            PipelineError::Draft(DraftError::EmptyCode).message_key(),
            "DRAFT_ERROR_EMPTY_CODE"
        );
    }

    #[test]
    fn verify_build_requires_matching_fqbn_and_existing_paths() {
        let record = BuildRecord {
            fqbn: "arduino:avr:uno".to_string(),
            build_dir: PathBuf::from("/nonexistent/build"),
            sketch_dir: PathBuf::from("/nonexistent/sketch"),
            ino_file_name: "Blink.ino".to_string(),
        };
        // FQBN 不符先被擋下。
        let mismatch = verify_build(&record, "arduino:avr:mega").expect_err("mismatch");
        assert_eq!(mismatch.message_key(), "CLI_ERROR_BUILD_STALE");
        // FQBN 相符但目錄不存在。
        let missing = verify_build(&record, "arduino:avr:uno").expect_err("missing");
        assert_eq!(missing.message_key(), "CLI_ERROR_BUILD_STALE");
        // 完全不存在於磁碟的草稿不應 panic。
        assert!(!Path::new("/nonexistent/sketch/Blink.ino").exists());
    }

    #[test]
    fn compile_uses_requested_build_dir_for_upload() {
        // 非 JSON 模式下沒有 build_path 回報，因此 build 目錄必須是我們指定的
        // 那一個；upload 會以它作為 `--input-dir`。
        let temp = TempRoot::new("builddir");
        let dirs = temp.dirs();
        let runner = ScriptedRunner::ok(SUCCESS_STDOUT);

        let outcome = compile_with(&temp, &runner, &request());

        assert_eq!(outcome.state, OperationState::Succeeded);
        assert!(outcome.build_dir.starts_with(dirs.build_root));
        assert!(outcome.build_dir.is_dir(), "build dir must be created");
    }

    #[test]
    fn parse_size_report_handles_english_and_chinese() {
        // 語言無關：以「數字開頭且含 %」辨識用量行。
        let english = parse_size_report(
            "Sketch uses 1918 bytes (5%) of program storage space.\n\
             Global variables use 184 bytes (8%) of dynamic memory.\n",
        )
        .expect("english");
        assert_eq!(english.flash_bytes, 1918);
        assert_eq!(english.flash_percent, 5);
        assert_eq!(english.ram_bytes, 184);
        assert_eq!(english.ram_percent, 8);

        let chinese = parse_size_report(SUCCESS_STDOUT).expect("chinese");
        assert_eq!(chinese, english);
    }

    #[test]
    fn parse_size_report_returns_none_without_usage_lines() {
        assert!(parse_size_report("").is_none());
        // 平台版本表雖有數字但沒有百分比 → 不是用量行。
        assert!(parse_size_report("使用的平台 arduino:avr 1.8.6").is_none());
        // 有位元組但沒有百分比 → 不是用量行。
        assert!(parse_size_report("Sketch uses 1918 bytes of program storage.").is_none());
    }

    #[test]
    fn parse_size_report_keeps_only_the_first_two_usage_lines() {
        // 避免工具鏈額外輸出百分比行時把 RAM 覆蓋掉。
        let text = "100 bytes (1%) first\n200 bytes (2%) second\n300 bytes (3%) third\n";
        let usage = parse_size_report(text).expect("usage");
        assert_eq!(usage.flash_bytes, 100);
        assert_eq!(usage.ram_bytes, 200);
        assert_eq!(usage.ram_percent, 2);
    }

    /// 執行一次編譯（測試用捷徑）。
    fn compile_with(
        temp: &TempRoot,
        runner: &ScriptedRunner,
        request: &CompileRequest,
    ) -> CompileOutcome {
        let mut sink = super::super::runner::BoundedSink::default();
        compile_pipeline(
            &handle(),
            &temp.dirs(),
            runner,
            request,
            &mut sink,
            &AtomicBool::new(false),
        )
    }

    /// 失敗編譯的回應（診斷在 stderr、exit 1）。
    fn failed_compile(stderr: &str) -> ScriptedRunner {
        ScriptedRunner::with(RunResult::failure(1, "", stderr))
    }
}

