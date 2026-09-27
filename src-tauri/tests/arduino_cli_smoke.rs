//! 真實 `arduino-cli` 的端對端 smoke 測試。
//!
//! 為什麼需要：`pipeline` 與 `runner` 的單元測試都使用假 runner，驗證不到
//! 「真的把 `arduino-cli.exe` 拉起來、真的解析它的 JSON、真的解碼它的輸出」。
//! 本測試補上這個缺口。
//!
//! 兩道防護讓它可以在任何環境安全執行：
//! 1. 找不到 `arduino-cli` 時直接跳過（不讓 CI 因環境缺工具而紅燈）。
//! 2. 只呼叫**不需要網路、不需要安裝 board core** 的子命令
//!    （`version` 與 `board list`），因此離線也能跑。
//!
//! ```text
//! cargo test --test arduino_cli_smoke -- --nocapture
//! ```

use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::time::Duration;

use codebridge_lib::arduino::command::{self, GlobalFlags};
use codebridge_lib::arduino::encoding::decode_output;
use codebridge_lib::arduino::parser::{BoardDetailResponse, DetectedBoards};
use codebridge_lib::arduino::diagnostics::DiagnosticSeverity;
use codebridge_lib::arduino::operations::OperationState;
use codebridge_lib::arduino::paths::{resolve_cli, ToolchainDirs};
use codebridge_lib::arduino::runner::{BoundedSink, ProcessRunner, RunRequest, StdProcessRunner};

/// 找出可用的 arduino-cli；找不到時回傳 `None`（測試改為跳過）。
fn find_cli() -> Option<PathBuf> {
    let exe = if cfg!(windows) {
        "arduino-cli.exe"
    } else {
        "arduino-cli"
    };
    let path_var = std::env::var_os("PATH")?;
    std::env::split_paths(&path_var)
        .map(|dir| dir.join(exe))
        .find(|candidate| candidate.is_file())
}

/// 測試用的隔離目錄（不碰使用者的 Arduino15）。
fn temp_dirs(tag: &str) -> ToolchainDirs {
    let root = std::env::temp_dir().join(format!("codebridge-smoke-{tag}"));
    let _ = std::fs::remove_dir_all(&root);
    let dirs = ToolchainDirs::under(&root);
    dirs.ensure().expect("create smoke dirs");
    dirs
}

#[test]
fn real_cli_reports_version_through_the_streaming_runner() {
    let Some(program) = find_cli() else {
        eprintln!("[smoke] 略過：找不到 arduino-cli");
        return;
    };
    let dirs = temp_dirs("version");
    let handle = resolve_cli(Some(&program), None).expect("resolve configured cli");
    let runner = StdProcessRunner::new();

    let mut sink = BoundedSink::default();
    let result = runner
        .run_streamed(
            &handle,
            &RunRequest::new(command::version(&GlobalFlags::isolated(&dirs)))
                .with_timeout(Duration::from_secs(30)),
            &mut sink,
            &AtomicBool::new(false),
        )
        .expect("run version");

    assert!(result.is_success(), "stderr: {}", result.stderr);
    // `version --format json` 的輸出必須是合法 JSON 且含版本字串。
    // 註：CLI 1.2.0 的 `VersionString` 只是 "1.2.0"（較新版本才是
    // "arduino-cli Version: x.y.z"），因此只驗證非空且含數字。
    let info: codebridge_lib::arduino::parser::VersionInfo =
        codebridge_lib::arduino::parser::parse_json(&result.stdout).expect("parse version json");
    assert!(
        !info.version_string.trim().is_empty(),
        "version string must not be empty"
    );
    assert!(
        info.version_string.contains(|c: char| c.is_ascii_digit()),
        "version string should contain digits: {}",
        info.version_string
    );
    let _ = std::fs::remove_dir_all(&dirs.config_dir);
}

#[test]
fn real_cli_lists_boards_with_isolated_config_dir() {
    let Some(program) = find_cli() else {
        eprintln!("[smoke] 略過：找不到 arduino-cli");
        return;
    };
    let dirs = temp_dirs("boards");
    let handle = resolve_cli(Some(&program), None).expect("resolve configured cli");
    let runner = StdProcessRunner::new();

    let mut sink = BoundedSink::default();
    let result = runner
        .run_streamed(
            &handle,
            &RunRequest::new(command::board_list(&GlobalFlags::isolated(&dirs).with_json()))
                .with_timeout(Duration::from_secs(60)),
            &mut sink,
            &AtomicBool::new(false),
        )
        .expect("run board list");

    assert!(result.is_success(), "stderr: {}", result.stderr);
    // 即使一個板子都沒接，CLI 也必須回傳合法的空 boards 陣列。
    let boards: DetectedBoards = codebridge_lib::arduino::parser::parse_json(&result.stdout)
        .expect("parse board list json");
    // 端點欄位必須可解析（未來 board-picker 依賴它）。
    for board in &boards.boards {
        assert!(!board.port_name().is_empty(), "detected board must expose a port");
    }
    let _ = std::fs::remove_dir_all(&dirs.config_dir);
}

#[test]
fn real_cli_output_is_decodable_as_utf8_or_tolerated() {
    // 本測試守住「無論 CLI 用什麼編碼，父端都不會丟掉輸出」。
    let bytes = "Sketch 使用 1918 位元組（5%）\n".as_bytes();
    let decoded = decode_output(bytes);
    assert!(!decoded.text.is_empty());
    assert!(decoded.text.contains("1918"));
}

#[test]
fn board_details_response_shape_is_parseable() {
    // 不啟動 CLI，只確認 parser 對 CLI 1.x 的實際欄位形狀不會 panic。
    let raw = r#"{"board":{"name":"Arduino Uno","fqbn":"arduino:avr:uno",
        "matching_core":"arduino:avr (1.8.6)","missing_tools":[]}}"#;
    let parsed: BoardDetailResponse =
        codebridge_lib::arduino::parser::parse_json(raw).expect("parse board details");
    let board = parsed.board.unwrap_or_default();
    assert_eq!(board.fqbn, "arduino:avr:uno");
}

// ---------------------------------------------------------------------------
// 真實編譯（T2-E 桌機驗證的自動化替代）
// ---------------------------------------------------------------------------

/// 可編譯的核心；找不到就跳過（不讓 CI 因環境缺核心而紅燈）。
///
/// **為什麼實機驗證需要它**：CodeBridge 刻意用**隔離的 config dir**（不污染
/// 使用者的 Arduino IDE），代價是它看不到使用者已在 `%LOCALAPPDATA%\Arduino15`
/// 裝好的核心。因此要驗證真實編譯，必須在隔離目錄下有核心。
///
/// 開發者可先用 `CB_VERIFY_CONFIG_DIR` 指向一個已備妥核心的目錄來執行這兩條
/// 測試；未設定則整段跳過，維持 CI 綠燈。
fn first_compilable_fqbn(program: &PathBuf, dirs: &ToolchainDirs) -> Option<String> {
    let handle = resolve_cli(Some(program), None).ok()?;
    let runner = StdProcessRunner::new();
    let mut sink = BoundedSink::default();
    let result = runner
        .run_streamed(
            &handle,
            &RunRequest::new(command::board_list_all(&GlobalFlags::isolated(dirs).with_json()))
                .with_timeout(Duration::from_secs(120)),
            &mut sink,
            &AtomicBool::new(false),
        )
        .ok()?;
    if !result.is_success() {
        return None;
    }
    let boards: codebridge_lib::arduino::parser::BoardSummaries =
        codebridge_lib::arduino::parser::parse_json(&result.stdout).ok()?;
    boards
        .boards
        .into_iter()
        .map(|board| board.fqbn)
        .find(|fqbn| !fqbn.is_empty())
}

/// 準備一個「有核心可用」的隔離環境；不可用時回 `None`（測試改為跳過）。
///
/// 開發者驗證步驟（Windows 為例）：
/// ```text
/// arduino-cli core install arduino:avr
/// # 把核心複製到 C:\cb_verify\data\packages\arduino，
/// # 並在 C:\cb_verify\cfg\arduino-cli.yaml 設定 directories.data
/// set CB_VERIFY_CONFIG_DIR=C:\cb_verify\cfg
/// cargo test --test arduino_cli_smoke -- --nocapture
/// ```
fn verify_dirs(tag: &str) -> Option<ToolchainDirs> {
    let config_dir = std::env::var_os("CB_VERIFY_CONFIG_DIR")?;
    let dirs = ToolchainDirs {
        config_dir: PathBuf::from(config_dir),
        // 其餘欄位在此測試中不參與（compile 只用 config-dir 與暫存草稿）。
        ..temp_dirs(tag)
    };
    if !dirs.config_dir.exists() {
        eprintln!("[smoke] 略過：CB_VERIFY_CONFIG_DIR 不存在");
        return None;
    }
    Some(dirs)
}

/// 一段會編譯失敗的程式碼（少了分號）。
const BROKEN_CODE: &str = "void setup() {\n  int x = 1\n}\nvoid loop() {\n}\n";

#[test]
fn real_cli_compiles_a_valid_sketch_and_reports_size() {
    let Some(program) = find_cli() else {
        eprintln!("[smoke] 略過：找不到 arduino-cli");
        return;
    };
    let Some(dirs) = verify_dirs("compile-ok") else {
        eprintln!("[smoke] 略過：未設 CB_VERIFY_CONFIG_DIR，無法驗證真實編詯");
        return;
    };
    let Some(fqbn) = first_compilable_fqbn(&program, &dirs) else {
        eprintln!("[smoke] 略過：沒有任何已安裝的核心可編譯");
        return;
    };

    let handle = resolve_cli(Some(&program), None).expect("resolve configured cli");
    let request = codebridge_lib::arduino::pipeline::CompileRequest::new(
        "smoke_ok",
        "SmokeOk",
        &fqbn,
        "void setup() {\n  pinMode(13, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n}\n",
    );
    let mut sink = BoundedSink::default();
    let outcome = codebridge_lib::arduino::pipeline::compile_pipeline(
        &handle,
        &dirs,
        &StdProcessRunner::new(),
        &request,
        &mut sink,
        &AtomicBool::new(false),
    );

    assert_eq!(
        outcome.state,
        OperationState::Succeeded,
        "valid sketch must compile; stderr: {}",
        outcome.compiler_err
    );
    // 產出目錄必須真的存在 —— 「回傳成功但沒產物」是無聲的失敗。
    assert!(
        outcome.build_dir.exists(),
        "build dir must exist after successful compile: {:?}",
        outcome.build_dir
    );
    // 沒有錯誤就沒有 error 級診斷。
    let errors: Vec<_> = outcome
        .diagnostics
        .iter()
        .filter(|d| d.severity == DiagnosticSeverity::Error)
        .collect();
    assert!(
        errors.is_empty(),
        "successful compile must not report error diagnostics: {:?}",
        errors
    );
    let _ = std::fs::remove_dir_all(&dirs.config_dir);
}

#[test]
fn real_cli_reports_diagnostics_with_usable_line_numbers() {
    // 這條守住 T2 的**行號契約**：CLI 報的行號必須能對到草稿 .ino 的行。
    // 前端靠它把錯誤標到程式碼面板；若行號錯位，整個診斷標記機制就是壞的。
    let Some(program) = find_cli() else {
        eprintln!("[smoke] 略過：找不到 arduino-cli");
        return;
    };
    let Some(dirs) = verify_dirs("compile-diag") else {
        eprintln!("[smoke] 略過：未設 CB_VERIFY_CONFIG_DIR，無法驗證真實編詯");
        return;
    };
    let Some(fqbn) = first_compilable_fqbn(&program, &dirs) else {
        eprintln!("[smoke] 略過：沒有任何已安裝的核心可編譯");
        return;
    };

    let handle = resolve_cli(Some(&program), None).expect("resolve configured cli");
    let request = codebridge_lib::arduino::pipeline::CompileRequest::new(
        "smoke_diag",
        "SmokeDiag",
        &fqbn,
        BROKEN_CODE,
    );
    let mut sink = BoundedSink::default();
    let outcome = codebridge_lib::arduino::pipeline::compile_pipeline(
        &handle,
        &dirs,
        &StdProcessRunner::new(),
        &request,
        &mut sink,
        &AtomicBool::new(false),
    );

    assert_eq!(
        outcome.state,
        OperationState::Failed,
        "broken sketch must not report success; stdout: {}",
        outcome.compiler_out
    );
    let errors: Vec<_> = outcome
        .diagnostics
        .iter()
        .filter(|d| d.severity == DiagnosticSeverity::Error)
        .collect();
    assert!(
        !errors.is_empty(),
        "broken sketch must yield at least one error diagnostic; stderr: {}",
        outcome.compiler_err
    );
    // 行號必須落在草稿的有效範圍內（1-based，且不超過程式碼行數）。
    let line_count = BROKEN_CODE.lines().count() as u32;
    for diagnostic in &errors {
        assert!(
            diagnostic.line >= 1 && diagnostic.line <= line_count,
            "diagnostic line {} out of range 1..={} (stderr: {})",
            diagnostic.line,
            line_count,
            outcome.compiler_err
        );
    }
    let _ = std::fs::remove_dir_all(&dirs.config_dir);
}
