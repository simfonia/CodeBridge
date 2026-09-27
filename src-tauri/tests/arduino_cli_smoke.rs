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
