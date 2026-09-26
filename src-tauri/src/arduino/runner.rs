//! 可替換的 process runner。
//!
//! 抽象成 trait 的目的：讓 command → 執行 → 解析的完整流程能在**沒有安裝
//! arduino-cli** 的環境下測試，也讓 timeout 與取消行為可控可驗證。

use std::io::Read;
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

use super::command::CliCommand;
use super::paths::{CliError, CliHandle};

/// 輪詢子程序的間隔；50ms 足以兼顧反應速度與 CPU 使用量。
const POLL_INTERVAL: Duration = Duration::from_millis(50);

/// 一次 CLI 執行的請求。
#[derive(Debug, Clone)]
pub struct RunRequest {
    /// 已組裝的子命令與參數。
    pub command: CliCommand,
    /// 逾時；None 代表不設上限。
    pub timeout: Option<Duration>,
}

impl RunRequest {
    /// 建立無逾時的請求。
    pub fn new(command: CliCommand) -> Self {
        Self {
            command,
            timeout: None,
        }
    }

    /// 設定逾時時間。
    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = Some(timeout);
        self
    }
}

/// 一次 CLI 執行的結果。
#[derive(Debug, Clone)]
pub struct RunResult {
    /// 結束碼；被取消或逾時時為 None。
    pub exit_code: Option<i32>,
    /// stdout 完整內容。
    pub stdout: String,
    /// stderr 完整內容。
    pub stderr: String,
    /// 是否因逾時而終止。
    pub timed_out: bool,
    /// 是否被使用者取消。
    pub cancelled: bool,
}

impl RunResult {
    /// 建立成功結果。
    pub fn ok(stdout: impl Into<String>) -> Self {
        Self {
            exit_code: Some(0),
            stdout: stdout.into(),
            stderr: String::new(),
            timed_out: false,
            cancelled: false,
        }
    }

    /// 建立失敗結果（附 stderr）。
    pub fn failure(
        exit_code: i32,
        stdout: impl Into<String>,
        stderr: impl Into<String>,
    ) -> Self {
        Self {
            exit_code: Some(exit_code),
            stdout: stdout.into(),
            stderr: stderr.into(),
            timed_out: false,
            cancelled: false,
        }
    }

    /// 是否為成功結束。
    pub fn is_success(&self) -> bool {
        self.exit_code == Some(0) && !self.timed_out && !self.cancelled
    }

    /// 若為失敗結果則回傳錯誤；成功時為 `None`。
    ///
    /// 本方法**不消耗** self，可在仍需讀取 stdout 時安全呼叫。UI 若只需要錯誤
    /// 字串應優先用這個，而非 `into_error`。
    pub fn error(&self) -> Option<CliError> {
        if self.is_success() {
            return None;
        }
        let raw = if self.stdout.trim().is_empty() {
            self.stderr.clone()
        } else {
            self.stdout.clone()
        };
        let message = super::parser::extract_error_message(&raw)
            .unwrap_or_else(|| truncate(raw.trim(), 800));

        Some(CliError::CommandFailed {
            message,
            stderr: truncate(self.stderr.trim(), 800),
        })
    }

    /// 轉為 [`CliError`]；成功時回傳 `None`。
    ///
    /// 錯誤訊息優先取 stdout 的 JSON envelope（`--json` 模式的慣例），失敗才
    /// 退回 stderr，避免 UI 顯示整段 JSON 原文。
    pub fn into_error(self) -> Option<CliError> {
        if self.is_success() {
            return None;
        }

        let raw = if self.stdout.trim().is_empty() {
            self.stderr.clone()
        } else {
            self.stdout.clone()
        };
        let message = super::parser::extract_error_message(&raw)
            .unwrap_or_else(|| truncate(raw.trim(), 800));

        Some(CliError::CommandFailed {
            message,
            stderr: truncate(self.stderr.trim(), 800),
        })
    }
}

/// 截斷過長字串並標示已截斷。
fn truncate(text: &str, max_chars: usize) -> String {
    if text.chars().count() <= max_chars {
        return text.to_string();
    }
    let head: String = text.chars().take(max_chars).collect();
    format!("{}… (已截斷)", head)
}

/// 可替換的程序執行抽象。
pub trait ProcessRunner: Send + Sync {
    /// 執行一次 CLI 呼叫。
    fn run(&self, cli: &CliHandle, request: &RunRequest) -> Result<RunResult, CliError>;
}

/// 以 `std::process::Command` 實際執行 CLI。
#[derive(Debug, Default, Clone, Copy)]
pub struct StdProcessRunner;

impl StdProcessRunner {
    /// 建立 runner。
    pub fn new() -> Self {
        Self
    }
}

impl ProcessRunner for StdProcessRunner {
    fn run(&self, cli: &CliHandle, request: &RunRequest) -> Result<RunResult, CliError> {
        let (program, args) = cli.command(&request.command.args);
        spawn_and_wait(&program, &args, request.timeout)
    }
}

/// 啟動子程序並等待結束。
///
/// 逾時採 `try_wait` 輪詢而非阻塞等待，因此不需要額外 crate，並可在逾時時
/// 主動 `kill` 子程序，讓 `core install` 這類長時間操作可被中止。
fn spawn_and_wait(
    program: &Path,
    args: &[String],
    timeout: Option<Duration>,
) -> Result<RunResult, CliError> {
    let mut child = Command::new(program)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|err| CliError::SpawnFailed {
            program: program.display().to_string(),
            reason: err.to_string(),
        })?;

    // stdout 與 stderr 各自以獨立執行緒讀完：若只讀一條，輸出量大時子程序會
    // 因管線填滿而阻塞，形成死鎖。
    let stdout_handle = drain_pipe(child.stdout.take());
    let stderr_handle = drain_pipe(child.stderr.take());

    let wait = wait_for_child(&mut child, timeout).map_err(|reason| CliError::SpawnFailed {
        program: program.display().to_string(),
        reason,
    })?;

    Ok(RunResult {
        exit_code: wait.exit_code,
        stdout: stdout_handle.join().unwrap_or_default(),
        stderr: stderr_handle.join().unwrap_or_default(),
        timed_out: wait.timed_out,
        cancelled: false,
    })
}

/// 背景執行緒讀乾淨一條管線。
fn drain_pipe<R: Read + Send + 'static>(pipe: Option<R>) -> std::thread::JoinHandle<String> {
    std::thread::spawn(move || {
        let mut buffer = String::new();
        if let Some(mut pipe) = pipe {
            let _ = pipe.read_to_string(&mut buffer);
        }
        buffer
    })
}

/// 子程序結束狀態。
struct ChildWait {
    exit_code: Option<i32>,
    timed_out: bool,
}

/// 等待子程序結束；逾時則 kill 並回報 `timed_out`。
fn wait_for_child(child: &mut Child, timeout: Option<Duration>) -> Result<ChildWait, String> {
    let deadline = timeout.map(|limit| Instant::now() + limit);

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                return Ok(ChildWait {
                    exit_code: status.code(),
                    timed_out: false,
                })
            }
            Ok(None) => {}
            Err(err) => return Err(err.to_string()),
        }

        if let Some(deadline) = deadline {
            if Instant::now() >= deadline {
                let _ = child.kill();
                let _ = child.wait();
                return Ok(ChildWait {
                    exit_code: None,
                    timed_out: true,
                });
            }
        }

        std::thread::sleep(POLL_INTERVAL);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::arduino::command::{self, GlobalFlags};
    use crate::arduino::paths::{CliSource, ToolchainDirs};
    use std::collections::HashMap;
    use std::path::PathBuf;
    use std::sync::Mutex;

    /// 測試用假 runner：以子命令字串為鍵回傳預設結果，並記錄收到的請求。
    pub struct FakeProcessRunner {
        responses: HashMap<String, RunResult>,
        spawn_error: Option<CliError>,
        recorded: Mutex<Vec<String>>,
    }

    impl FakeProcessRunner {
        /// 依子命令建立對應回應。
        pub fn new(responses: Vec<(&str, RunResult)>) -> Self {
            Self {
                responses: responses
                    .into_iter()
                    .map(|(key, value)| (key.to_string(), value))
                    .collect(),
                spawn_error: None,
                recorded: Mutex::new(Vec::new()),
            }
        }

        /// 永遠回傳啟動失敗。
        pub fn failing_spawn() -> Self {
            Self {
                responses: HashMap::new(),
                spawn_error: Some(CliError::SpawnFailed {
                    program: "arduino-cli".to_string(),
                    reason: "access denied".to_string(),
                }),
                recorded: Mutex::new(Vec::new()),
            }
        }

        /// 已收到的子命令清單。
        pub fn recorded(&self) -> Vec<String> {
            self.recorded.lock().expect("lock").clone()
        }
    }

    impl ProcessRunner for FakeProcessRunner {
        fn run(&self, _cli: &CliHandle, request: &RunRequest) -> Result<RunResult, CliError> {
            self.recorded
                .lock()
                .expect("lock")
                .push(request.command.subcommand.clone());
            if let Some(err) = &self.spawn_error {
                return Err(err.clone());
            }
            Ok(self
                .responses
                .get(&request.command.subcommand)
                .cloned()
                .unwrap_or_else(|| RunResult::ok("{}")))
        }
    }

    /// 測試用手動組裝的 CliHandle（不需真實檔案）。
    fn fake_handle() -> CliHandle {
        CliHandle {
            program: PathBuf::from("arduino-cli"),
            source: CliSource::SystemPath,
        }
    }

    /// 隔離的全域旗標。
    fn flags() -> GlobalFlags {
        GlobalFlags::isolated(&ToolchainDirs::under(std::path::Path::new("/appdata"))).with_json()
    }

    #[test]
    fn run_result_ok_is_success() {
        let result = RunResult::ok(r#"{"version":"1.5.0"}"#);
        assert!(result.is_success());
        assert!(result.into_error().is_none());
    }

    #[test]
    fn failure_extracts_json_error_message() {
        let result = RunResult::failure(
            1,
            r#"{"errorCode":5,"message":"compile error: sketch.ino:7:3: error: oops"}"#,
            "",
        );
        match result.into_error().expect("must be error") {
            CliError::CommandFailed { message, .. } => {
                assert!(message.contains("sketch.ino:7:3"));
                // UI 不應看到整段 JSON 原文。
                assert!(!message.contains("errorCode"));
            }
            other => panic!("unexpected: {:?}", other),
        }
    }

    #[test]
    fn failure_falls_back_to_stderr_when_stdout_empty() {
        let result = RunResult::failure(1, "", "fatal: board not found");
        match result.into_error().expect("must be error") {
            CliError::CommandFailed { message, stderr } => {
                assert_eq!(message, "fatal: board not found");
                assert_eq!(stderr, "fatal: board not found");
            }
            other => panic!("unexpected: {:?}", other),
        }
    }

    #[test]
    fn timed_out_result_is_not_success() {
        let result = RunResult {
            exit_code: None,
            stdout: String::new(),
            stderr: String::new(),
            timed_out: true,
            cancelled: false,
        };
        assert!(!result.is_success());
        assert!(result.into_error().is_some());
    }

    #[test]
    fn long_error_messages_are_truncated() {
        let result = RunResult::failure(1, "", "x".repeat(5000));
        match result.into_error().expect("error") {
            CliError::CommandFailed { message, .. } => {
                assert!(message.contains("已截斷"));
                assert!(message.chars().count() < 1000);
            }
            other => panic!("unexpected: {:?}", other),
        }
    }

    #[test]
    fn fake_runner_returns_mapped_response_by_subcommand() {
        let runner = FakeProcessRunner::new(vec![(
            "core list",
            RunResult::ok(r#"{"platforms":[{"id":"arduino:avr"}]}"#),
        )]);

        let result = runner
            .run(&fake_handle(), &RunRequest::new(command::core_list(&flags())))
            .expect("run");

        assert!(result.is_success());
        assert!(result.stdout.contains("arduino:avr"));
        assert_eq!(runner.recorded(), vec!["core list".to_string()]);
    }

    #[test]
    fn fake_runner_records_distinct_subcommands() {
        let runner = FakeProcessRunner::new(vec![]);
        runner
            .run(&fake_handle(), &RunRequest::new(command::board_list(&flags())))
            .expect("run");
        runner
            .run(&fake_handle(), &RunRequest::new(command::lib_list(&flags())))
            .expect("run");

        assert_eq!(
            runner.recorded(),
            vec!["board list".to_string(), "lib list".to_string()]
        );
    }

    #[test]
    fn spawn_failure_propagates_as_cli_error() {
        let runner = FakeProcessRunner::failing_spawn();
        let err = runner
            .run(&fake_handle(), &RunRequest::new(command::version(&flags())))
            .expect_err("must fail");
        assert_eq!(err.message_key(), "CLI_ERROR_SPAWN_FAILED");
    }

    #[test]
    fn run_request_carries_timeout() {
        let request =
            RunRequest::new(command::version(&flags())).with_timeout(Duration::from_secs(5));
        assert_eq!(request.timeout, Some(Duration::from_secs(5)));
    }

    #[test]
    fn run_request_defaults_to_no_timeout() {
        assert_eq!(RunRequest::new(command::version(&flags())).timeout, None);
    }

    #[test]
    fn cli_handle_command_returns_program_and_args() {
        let (program, args) = fake_handle().command(&["--format".to_string(), "json".to_string()]);
        assert_eq!(program, PathBuf::from("arduino-cli"));
        assert_eq!(args, vec!["--format", "json"]);
    }
}
