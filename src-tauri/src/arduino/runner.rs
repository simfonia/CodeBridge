//! 可替換的 process runner。
//!
//! 抽象成 trait 的目的：讓 command → 執行 → 解析的完整流程能在**沒有安裝
//! arduino-cli** 的環境下測試，也讓 timeout 與取消行為可控可驗證。

use std::io::BufRead;
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;

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
    /// 累積收到的輸出行數（含 stdout 與 stderr）。
    ///
    /// 供事件 payload 與測試使用：`RunResult` 只保留文字，而行數能讓 UI
    /// 判斷「是否漏接了行」，也能在 debug 時快速看出管線是否有截斷。
    pub line_count: usize,
}

impl RunResult {
    /// 建立只帶一行輸出的成功結果（測試與便捷建構用）。
    pub fn with_line_count(
        exit_code: Option<i32>,
        stdout: impl Into<String>,
        stderr: impl Into<String>,
        timed_out: bool,
        cancelled: bool,
        line_count: usize,
    ) -> Self {
        Self {
            exit_code,
            stdout: stdout.into(),
            stderr: stderr.into(),
            timed_out,
            cancelled,
            line_count,
        }
    }

    /// 建立成功結果。
    pub fn ok(stdout: impl Into<String>) -> Self {
        let stdout = stdout.into();
        let line_count = stdout.lines().count();
        Self {
            exit_code: Some(0),
            stdout,
            stderr: String::new(),
            timed_out: false,
            cancelled: false,
            line_count,
        }
    }

    /// 建立失敗結果（附 stderr）。
    pub fn failure(
        exit_code: i32,
        stdout: impl Into<String>,
        stderr: impl Into<String>,
    ) -> Self {
        let stdout = stdout.into();
        let stderr = stderr.into();
        let line_count = stdout.lines().count() + stderr.lines().count();
        Self {
            exit_code: Some(exit_code),
            stdout,
            stderr,
            timed_out: false,
            cancelled: false,
            line_count,
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

/// 輸出的來源管線。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum StreamKind {
    /// 標準輸出（`--json` 模式下為最終 JSON 回應）。
    Stdout,
    /// 標準錯誤（進度、gcc／avrdude 訊息）。
    Stderr,
}

impl StreamKind {
    /// 對應 i18n message key。
    pub fn message_key(&self) -> &'static str {
        match self {
            StreamKind::Stdout => "CLI_STREAM_STDOUT",
            StreamKind::Stderr => "CLI_STREAM_STDERR",
        }
    }
}

/// 逐行輸出的接收端。
///
/// 抽出此 trait 的目的：讓「何時把資料送給 UI」與「如何執行子程序」解耦，
/// 測試可用記憶體 sink 驗證行序與編號，而不需要真的跑 arduino-cli。
pub trait OutputSink {
    /// 收到一行輸出（已去除行尾換行符並完成寬容解碼）。
    fn on_line(&mut self, stream: StreamKind, line: &str);

    /// 取得目前累積的行（供 pipeline 回傳給 UI 顯示）。
    ///
    /// 提供預設實作回傳空陣列，讓「只負責即時推送」的 sink（例如直接 emit
    /// Tauri 事件的 sink）不必保存歷史；需要歷史的 sink（如
    /// [`BoundedSink`]）才覆寫本方法。
    fn recent_lines(&self) -> Vec<String> {
        Vec::new()
    }
}

/// 只保留最近 N 行的 sink。
///
/// 終端機面板不需要完整歷史：首次 `core install` 會吐出上千行下載進度，
/// 無上限保存會讓 webview 記憶體無限成長。
#[derive(Debug)]
pub struct BoundedSink {
    lines: Mutex<Vec<String>>,
    capacity: usize,
}

/// `BoundedSink` 的預設容量。
pub const DEFAULT_SINK_CAPACITY: usize = 2000;

impl BoundedSink {
    /// 建立自訂容量的 sink。
    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            lines: Mutex::new(Vec::new()),
            capacity,
        }
    }

    /// 容量上限。
    pub fn capacity(&self) -> usize {
        if self.capacity == 0 {
            DEFAULT_SINK_CAPACITY
        } else {
            self.capacity
        }
    }

    /// 目前保留的行數。
    pub fn len(&self) -> usize {
        self.lines.lock().map(|lines| lines.len()).unwrap_or(0)
    }

    /// 是否沒有任何行。
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// 取得目前保留的行（由舊到新）。
    pub fn snapshot(&self) -> Vec<String> {
        self.lines.lock().map(|lines| lines.clone()).unwrap_or_default()
    }
}

impl Default for BoundedSink {
    fn default() -> Self {
        Self::with_capacity(DEFAULT_SINK_CAPACITY)
    }
}

impl OutputSink for BoundedSink {
    fn on_line(&mut self, _stream: StreamKind, line: &str) {
        if let Ok(mut lines) = self.lines.lock() {
            lines.push(line.to_string());
            let capacity = self.capacity();
            if lines.len() > capacity {
                let excess = lines.len() - capacity;
                lines.drain(0..excess);
            }
        }
    }

    fn recent_lines(&self) -> Vec<String> {
        self.snapshot()
    }
}

/// 可替換的程序執行抽象。
///
/// 兩種執行模式共存、共用同一條程式路徑：
/// - [`ProcessRunner::run`]：批次式，把輸出收進 [`RunResult`]。查詢類命令用。
/// - [`ProcessRunner::run_streamed`]：逐行回呼 [`OutputSink`]。compile／upload
///   等長作業用，可在執行中顯示進度並及時回應取消。
pub trait ProcessRunner: Send + Sync {
    /// 執行一次 CLI 呼叫。
    fn run(&self, cli: &CliHandle, request: &RunRequest) -> Result<RunResult, CliError>;

    /// 逐行串流執行一次 CLI 呼叫。
    ///
    /// 預設實作委派給 [`ProcessRunner::run`] 並在結束後一次補完輸出，因此
    /// 測試用的假 runner 只實作 `run` 也能通過串流測試。取消旗標在此被忽略
    /// （批次式實作無法中途中止），由 [`StdProcessRunner`] 覆寫以真正支援。
    fn run_streamed(
        &self,
        cli: &CliHandle,
        request: &RunRequest,
        sink: &mut dyn OutputSink,
        _cancel: &AtomicBool,
    ) -> Result<RunResult, CliError> {
        let result = self.run(cli, request)?;
        sink.on_line(StreamKind::Stdout, &result.stdout);
        if !result.stderr.is_empty() {
            sink.on_line(StreamKind::Stderr, &result.stderr);
        }
        Ok(result)
    }
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
        // 查詢類命令不需要串流，但仍走同一條 `spawn_and_wait` 路徑，
        // 輸出收集到記憶體 sink 後組成 RunResult。
        let mut sink = BoundedSink::default();
        spawn_and_wait(
            &program,
            &args,
            request.timeout,
            &mut sink,
            &AtomicBool::new(false),
        )
    }

    fn run_streamed(
        &self,
        cli: &CliHandle,
        request: &RunRequest,
        sink: &mut dyn OutputSink,
        cancel: &AtomicBool,
    ) -> Result<RunResult, CliError> {
        let (program, args) = cli.command(&request.command.args);
        spawn_and_wait(&program, &args, request.timeout, sink, cancel)
    }
}

/// 啟動子程序、串流收集輸出並等待結束。
///
/// 三個必須同時滿足的要求：
/// 1. **不死鎖**：stdout 與 stderr 各有一條專屬 reader 執行緒；只讀一條時，
///    另一條管線填滿會讓子程序永久阻塞。
/// 2. **可回應取消**：主迴圈以 [`POLL_INTERVAL`] 輪詢 `try_wait`，同時檢查
///    `cancel` 旗標；一旦被要求取消即 `kill` 子程序（`core install` 這種
///    長達數分鐘的作業才能真的中止）。
/// 3. **不解碼失敗**：reader 以 `0x0A` 為界取出原始位元組後交
///    [`super::encoding::decode_output`] 寬容解碼，Windows cp950 輸出不會
///    讓整份編譯輸出消失。
///
/// 逾時採 `try_wait` 輪詢而非阻塞等待，因此不需要額外 crate。
fn spawn_and_wait(
    program: &Path,
    args: &[String],
    timeout: Option<Duration>,
    sink: &mut dyn OutputSink,
    cancel: &AtomicBool,
) -> Result<RunResult, CliError> {
    let mut child = spawn_child(program, args)?;
    let (sender, receiver) = mpsc::channel::<(StreamKind, String)>();

    // stdout 與 stderr 各自以獨立執行緒逐行讀取。兩個 sender 全部移入
    // 執行緒後，channel 才會在兩條 reader 都結束時關閉（receiver 收到
    // Disconnected），主迴圈因此能判斷「已無輸出可等」。
    let stdout_sender = sender.clone();
    let stdout_reader = spawn_line_reader(child.stdout.take(), StreamKind::Stdout, stdout_sender);
    let stderr_reader = spawn_line_reader(child.stderr.take(), StreamKind::Stderr, sender);

    let mut stdout_lines: Vec<String> = Vec::new();
    let mut stderr_lines: Vec<String> = Vec::new();
    let mut readers: Vec<std::thread::JoinHandle<()>> = Vec::new();
    if let Some(handle) = stdout_reader {
        readers.push(handle);
    }
    if let Some(handle) = stderr_reader {
        readers.push(handle);
    }
    let wait = wait_for_child(
        &mut child,
        timeout,
        cancel,
        receiver,
        sink,
        &mut stdout_lines,
        &mut stderr_lines,
        readers,
    );

    let wait = wait.map_err(|reason| CliError::SpawnFailed {
        program: program.display().to_string(),
        reason,
    })?;

    Ok(RunResult {
        exit_code: wait.exit_code,
        stdout: stdout_lines.join("\n"),
        stderr: stderr_lines.join("\n"),
        timed_out: wait.timed_out,
        cancelled: wait.cancelled,
        // 行數 = 已收集的實體行數（不含空行），與 UI 顯示的行數一致。
        line_count: stdout_lines.len() + stderr_lines.len(),
    })
}

/// 啟動子程序並強制 UTF-8 環境（對齊 cocoya 的子進程編碼鐵律）。
///
/// `LANG` / `LC_ALL` 設為 `C.UTF-8` 會讓 gcc、avrdude 等原生工具鏈盡量輸出
/// UTF-8；`runner.rs` 的寬容解碼則作為第二道防線，處理仍殘留的 locale 輸出。
fn spawn_child(program: &Path, args: &[String]) -> Result<Child, CliError> {
    Command::new(program)
        .args(args)
        .env("LANG", "C.UTF-8")
        .env("LC_ALL", "C.UTF-8")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|err| CliError::SpawnFailed {
            program: program.display().to_string(),
            reason: err.to_string(),
        })
}

/// 背景執行緒逐行讀取一條管線，透過 channel 交回主執行緒。
///
/// 以 `read_until(0x0A)` 取**原始位元組**而非 `lines()`：後者假設 UTF-8，
/// 遇到 cp950 位元組會直接回傳錯誤。UTF-8 / Big5 / GBK 的多位元組字元
/// 皆不含 `0x0A`，因此以 `0x0A` 分行不會切開字元。
fn spawn_line_reader<R: std::io::Read + Send + 'static>(
    pipe: Option<R>,
    stream: StreamKind,
    sender: mpsc::Sender<(StreamKind, String)>,
) -> Option<std::thread::JoinHandle<()>> {
    let pipe = pipe?;
    Some(std::thread::spawn(move || {
        let mut reader = std::io::BufReader::new(pipe);
        let mut buffer: Vec<u8> = Vec::new();
        loop {
            buffer.clear();
            match reader.read_until(b'\n', &mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(_) => {
                    // 去掉行尾的 \r\n；其餘交寬容解碼。
                    while matches!(buffer.last(), Some(b'\n') | Some(b'\r')) {
                        buffer.pop();
                    }
                    if buffer.is_empty() {
                        continue;
                    }
                    let line = super::encoding::decode_output(&buffer).text;
                    if sender.send((stream, line)).is_err() {
                        break;
                    }
                }
            }
        }
    }))
}


/// 子程序結束狀態。
struct ChildWait {
    exit_code: Option<i32>,
    timed_out: bool,
    cancelled: bool,
}

/// 等待子程序結束，同時持續抽乾輸出、檢查逾時與取消旗標。
///
/// 設計重點一：**等待與抽乾必須交錯**。若先阻塞等結束再讀輸出，輸出量大時
/// 子程序會卡在管線寫入而永遠等不到結束（本專案 T1 已驗證過這類死鎖）。
/// 因此每輪迴圈先用 `recv_timeout(POLL_INTERVAL)` 取一個 channel 訊息，
/// 取不到才輪詢 `try_wait`。
///
/// 設計重點二：**結束前必須先 join reader 執行緒**。子程序退出與 reader
/// 執行緒把最後幾行送進 channel 之間存在時間差；若只 `drain_remaining`
/// 就返回，那些「在途的行」會被丟掉 —— 實測 `arduino-cli version`（輸出
/// 只有 6 行、結束極快）就因此回傳**空的 stdout**，而 `board list`（輸出較大）
/// 卻正常。這是整合測試抓到的真實 bug，不是假想。
fn wait_for_child(
    child: &mut Child,
    timeout: Option<Duration>,
    cancel: &AtomicBool,
    receiver: Receiver<(StreamKind, String)>,
    sink: &mut dyn OutputSink,
    stdout_lines: &mut Vec<String>,
    stderr_lines: &mut Vec<String>,
    readers: Vec<std::thread::JoinHandle<()>>,
) -> Result<ChildWait, String> {
    let deadline = timeout.map(|limit| Instant::now() + limit);
    // channel 關閉代表兩條 reader 都已結束；此後只等子程序本身退出。
    let mut channel_closed = false;

    // 收尾用：join 所有 reader（確保在途的行都進了 channel）後再抽乾。
    let finish = |readers: Vec<std::thread::JoinHandle<()>>,
                  receiver: &Receiver<(StreamKind, String)>,
                  sink: &mut dyn OutputSink,
                  stdout_lines: &mut Vec<String>,
                  stderr_lines: &mut Vec<String>| {
        for handle in readers {
            let _ = handle.join();
        }
        drain_remaining(receiver, sink, stdout_lines, stderr_lines);
    };

    loop {
        // 1) 先抽乾輸出（有資料就立刻回呼 sink，做到真正的即時進度）。
        if !channel_closed {
            match receiver.recv_timeout(POLL_INTERVAL) {
                Ok((stream, line)) => {
                    match stream {
                        StreamKind::Stdout => stdout_lines.push(line.clone()),
                        StreamKind::Stderr => stderr_lines.push(line.clone()),
                    }
                    sink.on_line(stream, &line);
                    continue;
                }
                Err(RecvTimeoutError::Disconnected) => channel_closed = true,
                Err(RecvTimeoutError::Timeout) => {}
            }
        }

        // 2) 檢查子程序是否已結束。
        match child.try_wait() {
            Ok(Some(status)) => {
                finish(readers, &receiver, sink, stdout_lines, stderr_lines);
                return Ok(ChildWait {
                    exit_code: status.code(),
                    timed_out: false,
                    cancelled: false,
                });
            }
            Ok(None) => {}
            Err(err) => return Err(err.to_string()),
        }

        // 3) 使用者取消 → 立即中止（compile/upload 動輒數分鐘，不能等它跑完）。
        if cancel.load(Ordering::SeqCst) {
            let _ = child.kill();
            let _ = child.wait();
            finish(readers, &receiver, sink, stdout_lines, stderr_lines);
            return Ok(ChildWait {
                exit_code: None,
                timed_out: false,
                cancelled: true,
            });
        }

        // 4) 逾時 → 同樣 kill，並標記為 timed_out 讓 UI 能區分「取消」與「逾時」。
        if let Some(deadline) = deadline {
            if Instant::now() >= deadline {
                let _ = child.kill();
                let _ = child.wait();
                finish(readers, &receiver, sink, stdout_lines, stderr_lines);
                return Ok(ChildWait {
                    exit_code: None,
                    timed_out: true,
                    cancelled: false,
                });
            }
        }

        if channel_closed {
            // 已無輸出可抽乾，改用短睡眠避免空轉燒 CPU。
            std::thread::sleep(POLL_INTERVAL);
        }
    }
}

/// 子程序結束後把 channel 中殘餘的行全部取出。
///
/// 這一步不可省略：子程序結束與 reader 執行緒結束之間存在時間差，漏掉的行
/// 正是使用者最在意的「最後一行錯誤訊息」。
fn drain_remaining(
    receiver: &Receiver<(StreamKind, String)>,
    sink: &mut dyn OutputSink,
    stdout_lines: &mut Vec<String>,
    stderr_lines: &mut Vec<String>,
) {
    while let Ok((stream, line)) = receiver.try_recv() {
        match stream {
            StreamKind::Stdout => stdout_lines.push(line.clone()),
            StreamKind::Stderr => stderr_lines.push(line.clone()),
        }
        sink.on_line(stream, &line);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::arduino::command::{self, GlobalFlags};
    use crate::arduino::paths::{CliSource, ToolchainDirs};
    use std::collections::HashMap;
    use std::path::PathBuf;
    use std::sync::{Arc, Mutex};

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

    /// 記錄所有收到的行（含管線種類）的測試 sink。
    #[derive(Default)]
    struct RecordingSink {
        lines: Vec<(StreamKind, String)>,
    }

    impl RecordingSink {
        fn texts(&self, stream: StreamKind) -> Vec<String> {
            self.lines
                .iter()
                .filter(|(kind, _)| *kind == stream)
                .map(|(_, line)| line.clone())
                .collect()
        }
    }

    impl OutputSink for RecordingSink {
        fn on_line(&mut self, stream: StreamKind, line: &str) {
            self.lines.push((stream, line.to_string()));
        }
    }

    /// 測試用的 python 直譯器；環境未安裝時回傳 `None`（該組測試自動略過）。
    fn which_python() -> Option<&'static str> {
        let candidates: &[&str] = if cfg!(windows) { &["python"] } else { &["python3"] };
        for candidate in candidates {
            if Command::new(candidate)
                .arg("--version")
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status()
                .map(|status| status.success())
                .unwrap_or(false)
            {
                return Some(candidate);
            }
        }
        None
    }

    /// 以 python 直譯器作為被執行程式的 [`CliHandle`]。
    ///
    /// 真正的 runner 執行的是 `CliHandle.program`，參數則來自
    /// `CliCommand.args`；因此要驗證真實子程序行為，必須把 program 指向
    /// python，腳本則放進 `RunRequest`。
    fn python_handle() -> CliHandle {
        CliHandle {
            program: PathBuf::from(which_python().expect("python required")),
            source: CliSource::SystemPath,
        }
    }

    /// 建立可控輸出的真實子程序請求（用於驗證串流與不死鎖）。
    ///
    /// 刻意使用真實 OS 行程而非測試替身：死鎖、`kill` 是否生效、管線填滿的
    /// 行為只有在真實行程上才驗證得出來。
    ///
    /// 腳本刻意用 `concat!` 而非 `\` 續行字串：Rust 的續行會吞掉下一行的
    /// 前導空白，足以讓 Python 的縮排失效而讓整個測試變成「測不到東西」。
    fn streaming_request() -> RunRequest {
        let script = concat!(
            "import sys\n",
            "for i in range(500):\n",
            "    sys.stdout.write('out line %d\\n' % i)\n",
            "    sys.stderr.write('err line %d\\n' % i)\n",
            "sys.stdout.flush()\n",
            "sys.stderr.flush()\n",
        );
        RunRequest::new(CliCommand {
            subcommand: "stream".to_string(),
            args: vec!["-c".to_string(), script.to_string()],
        })
    }

    /// 建立會長時間執行的真實子程序請求（用於取消／逾時）。
    fn sleeping_request(seconds: u32) -> RunRequest {
        RunRequest::new(CliCommand {
            subcommand: "sleep".to_string(),
            args: vec![
                "-c".to_string(),
                format!("import time; time.sleep({seconds})"),
            ],
        })
    }

    #[test]
    fn bounded_sink_keeps_only_the_newest_lines() {
        let mut sink = BoundedSink::with_capacity(3);
        for index in 0..10 {
            sink.on_line(StreamKind::Stdout, &format!("line {index}"));
        }
        assert_eq!(sink.len(), 3, "capacity must be enforced");
        assert_eq!(
            sink.snapshot(),
            vec!["line 7".to_string(), "line 8".to_string(), "line 9".to_string()]
        );
    }

    #[test]
    fn bounded_sink_default_capacity_is_generous() {
        let sink = BoundedSink::default();
        assert_eq!(sink.capacity(), DEFAULT_SINK_CAPACITY);
        assert!(sink.is_empty());
    }

    #[test]
    fn stream_kind_message_keys_are_distinct() {
        assert_eq!(StreamKind::Stdout.message_key(), "CLI_STREAM_STDOUT");
        assert_eq!(StreamKind::Stderr.message_key(), "CLI_STREAM_STDERR");
    }

    #[test]
    fn default_run_streamed_falls_back_to_batch_result() {
        // 假 runner 只實作 run；預設的 run_streamed 應把輸出送進 sink。
        let runner = FakeProcessRunner::new(vec![(
            "core list",
            RunResult::failure(1, r#"{"message":"boom"}"#, "warn"),
        )]);
        let mut sink = RecordingSink::default();
        let result = runner
            .run_streamed(
                &fake_handle(),
                &RunRequest::new(command::core_list(&flags())),
                &mut sink,
                &AtomicBool::new(false),
            )
            .expect("run_streamed");

        assert!(!result.is_success());
        assert_eq!(sink.texts(StreamKind::Stdout), vec![r#"{"message":"boom"}"#]);
        assert_eq!(sink.texts(StreamKind::Stderr), vec!["warn".to_string()]);
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
            line_count: 0,
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

    #[test]
    fn streamed_real_child_delivers_both_pipes_without_deadlock() {
        // 500 行 × 2 管線遠大於一般管線緩衝區；若實作有死鎖，本測試會卡住，
        // 因此它是「不死鎖」最直接的回歸保護。
        if which_python().is_none() {
            return;
        }
        let runner = StdProcessRunner::new();
        let mut sink = BoundedSink::with_capacity(5000);
        let result = runner
            .run_streamed(
                &python_handle(),
                &streaming_request(),
                &mut sink,
                &AtomicBool::new(false),
            )
            .expect("run_streamed");

        assert_eq!(result.exit_code, Some(0), "child should succeed");
        let stdout: Vec<String> = sink
            .snapshot()
            .into_iter()
            .filter(|line| line.starts_with("out line"))
            .collect();
        assert_eq!(stdout.len(), 500, "all stdout lines must arrive");
        // 行序必須保持：最後一行必須是 out line 499。
        assert_eq!(stdout.last().unwrap(), "out line 499");
    }

    #[test]
    fn streamed_result_collects_stdout_and_stderr_separately() {
        if which_python().is_none() {
            return;
        }
        let runner = StdProcessRunner::new();
        let result = runner
            .run_streamed(
                &python_handle(),
                &streaming_request(),
                &mut BoundedSink::default(),
                &AtomicBool::new(false),
            )
            .expect("run_streamed");

        // RunResult 仍須分別保留兩條管線（--json 解析只看 stdout）。
        assert!(result.stdout.contains("out line 0"));
        assert!(!result.stdout.contains("err line 0"));
        assert!(result.stderr.contains("err line 0"));
        assert!(!result.stderr.contains("out line 0"));
        assert_eq!(result.stdout.lines().count(), 500);
        assert_eq!(result.stderr.lines().count(), 500);
    }

    #[test]
    fn cancel_flag_kills_running_child() {
        if which_python().is_none() {
            return;
        }
        let runner = StdProcessRunner::new();
        let cancel = Arc::new(AtomicBool::new(false));

        // 另開執行緒於 200ms 後設旗標，模擬使用者按下「停止」。
        let cancel_for_thread = Arc::clone(&cancel);
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(200));
            cancel_for_thread.store(true, Ordering::SeqCst);
        });

        let started = Instant::now();
        let result = runner
            .run_streamed(
                &python_handle(),
                &sleeping_request(30),
                &mut BoundedSink::default(),
                &cancel,
            )
            .expect("run_streamed");

        assert!(result.cancelled, "result must report cancelled");
        assert!(!result.is_success());
        assert!(
            started.elapsed() < Duration::from_secs(10),
            "cancel must not wait for the child to finish"
        );
    }

    #[test]
    fn timeout_kills_running_child() {
        if which_python().is_none() {
            return;
        }
        let runner = StdProcessRunner::new();
        let result = runner
            .run_streamed(
                &python_handle(),
                &sleeping_request(30).with_timeout(Duration::from_millis(300)),
                &mut BoundedSink::default(),
                &AtomicBool::new(false),
            )
            .expect("run_streamed");

        assert!(result.timed_out, "result must report timed_out");
        assert!(!result.cancelled, "timeout is not cancellation");
        assert!(!result.is_success());
    }

    #[test]
    fn non_utf8_child_output_still_decodes() {
        // Windows 工具鏈可能輸出 cp950；此測試鎖定「不因編碼丟失整份輸出」。
        if which_python().is_none() {
            return;
        }
        let runner = StdProcessRunner::new();
        // 「中」在 Big5 是 0xA4 0xA4；以 bytes 寫出，避免測試原始碼編碼影響。
        let script = "import sys; sys.stdout.buffer.write(b'\\xa4\\xa4\\n'); sys.stdout.flush()";
        let request = RunRequest::new(CliCommand {
            subcommand: "bytes".to_string(),
            args: vec!["-c".to_string(), script.to_string()],
        });

        let result = runner
            .run_streamed(
                &python_handle(),
                &request,
                &mut BoundedSink::default(),
                &AtomicBool::new(false),
            )
            .expect("run_streamed");

        assert_eq!(result.stdout.trim(), "中", "big5 bytes must decode");
    }
}
