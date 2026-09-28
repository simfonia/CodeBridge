//! CodeBridge Arduino CLI 整合（Phase T1：環境偵測與設定隔離）。
//!
//! 授權決策（B 方案）：CodeBridge **不內嵌打包** `arduino-cli` 執行檔。
//! `arduino-cli` 為 GPL-3.0 授權，官方明載商業情境需購買授權；內嵌分發會使
//! CodeBridge 承擔 GPL 義務並阻礙未來閉源商業化。因此本模組採「外部依賴 +
//! 自動引導安裝」：執行期解析使用者設定路徑與系統 PATH，找不到時回報可引導
//! 使用者安裝的結構化錯誤，而不是內建一份二進位檔。

pub mod command;
pub mod diagnostics;
pub mod draft;
pub mod encoding;
pub mod operations;
pub mod parser;
pub mod paths;
pub mod pipeline;
pub mod runner;

use serde::Serialize;

pub use diagnostics::{parse_compiler_output, Diagnostic, DiagnosticSeverity};
pub use operations::{Operation, OperationKind, OperationRegistry, OperationState, OperationStatus};
pub use parser::{
    BoardDetail, BoardSummary, DetectedBoard, LibrarySummary, PlatformSummary, SketchProgram,
    VersionInfo,
};
pub use paths::{
    resolve_cli, ArduinoCliDirs, CliError, CliHandle, CliSource, ToolchainDirs,
};
pub use runner::{ProcessRunner, RunRequest, RunResult, StdProcessRunner};

/// 官方 Arduino CLI 下載頁；`CliError::NotFound` 會攜帶此 URL 供 UI 引導使用者。
pub const ARDUINO_CLI_DOWNLOAD_URL: &str = "https://arduino.github.io/arduino-cli/latest/installation/";


/// 單一目錄的**來源**；前端據此顯示「當前值 + 來源」說明。
///
/// 使用者被環境問題卡住時，需要知道的不只是「在哪」，還有「為什麼在那」。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DirSource {
    /// 由 `arduino-cli` 的系統預設值決定（與 Arduino IDE 共用）。
    SystemDefault,
    /// CodeBridge 專屬的隔離目錄。
    AppIsolated,
    /// 使用者在設定頁手動指定。
    UserConfigured,
}

impl DirSource {
    /// 對應前端 i18n key。
    pub fn message_key(&self) -> &'static str {
        match self {
            DirSource::SystemDefault => "DIR_SOURCE_SYSTEM_DEFAULT",
            DirSource::AppIsolated => "DIR_SOURCE_APP_ISOLATED",
            DirSource::UserConfigured => "DIR_SOURCE_USER_CONFIGURED",
        }
    }
}

/// 一個路徑加上它的來源。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    /// 目前生效的完整路徑。
    pub value: String,
    /// 這個值是怎麼來的。
    pub source: DirSource,
}

/// `toolchain_get_dirs` 的回應：完整路徑快照 + 來源。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolchainDirsReport {
    /// 實際使用的 `arduino-cli` 執行檔；未找到時為 `None`。
    pub cli_path: Option<String>,
    /// 執行檔來源；未找到時為 `None`。
    pub cli_source: Option<crate::arduino::CliSource>,
    /// 找不到 CLI 時的 i18n key（前端據此顯示安裝引導）。
    pub cli_error: Option<String>,
    /// 目前是否使用 CodeBridge 專屬目錄。
    pub isolated: bool,
    /// CLI 設定目錄（`--config-dir`）。
    pub config_dir: DirEntry,
    /// 核心／函式庫資料目錄。
    pub data_dir: DirEntry,
    /// sketchbook。
    pub user_dir: DirEntry,
    /// 套件下載暫存。
    pub downloads_dir: DirEntry,
    /// 產物（草稿暫存）根目錄。
    pub build_root: DirEntry,
    /// `settings.json` 的位置，讓使用者知道設定存到哪去了。
    pub settings_path: String,
}

/// 工具鏈環境偵測結果，回傳給前端顯示狀態。

/// 工具鏈環境偵測結果，回傳給前端顯示狀態。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolchainStatus {
    /// 是否已找到可用的 arduino-cli。
    pub found: bool,
    /// 實際使用的執行檔路徑；未找到時為 `None`。
    pub path: Option<String>,
    /// 執行檔來源：`userConfigured` / `systemPath`。
    pub source: Option<CliSource>,
    /// CLI 版本字串，例如 `arduino-cli Version: 1.5.0`。
    pub version: Option<String>,
    /// CodeBridge 專屬的 CLI 設定目錄（與使用者全域設定隔離）。
    pub config_dir: String,
    /// CodeBridge 專屬資料目錄（core / library 下載位置）。
    pub data_dir: String,
    /// CodeBridge 專屬使用者目錄（sketchbook）。
    pub user_dir: String,
    /// 尚未安裝時的引導資訊；已安裝時為 `None`。
    pub install_hint: Option<InstallHint>,
}

/// 未安裝 arduino-cli 時的安裝引導資訊。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallHint {
    /// 官方安裝說明頁。
    pub url: String,
    /// Windows 環境的建議安裝指令；其他平台為一般建議。
    pub command: String,
}

/// 工具鏈對外 facade：統一提供偵測、執行與環境隔離目錄。
pub struct CodeBridgeToolchain<R: ProcessRunner> {
    runner: R,
    dirs: ToolchainDirs,
}

impl<R: ProcessRunner> CodeBridgeToolchain<R> {
    /// 建立工具鏈實例。`dirs` 應由 [`ToolchainDirs::under`] 從應用程式資料目錄推導。
    pub fn new(runner: R, dirs: ToolchainDirs) -> Self {
        Self { runner, dirs }
    }

    /// 取得隔離的 CLI 目錄設定。
    pub fn dirs(&self) -> &ToolchainDirs {
        &self.dirs
    }

    /// 取得可替換的 process runner（測試時注入 fake）。
    pub fn runner(&self) -> &R {
        &self.runner
    }

    /// 執行一次 CLI 呼叫並解析 stdout JSON。
    pub fn run_json<T: serde::de::DeserializeOwned>(
        &self,
        cli: &CliHandle,
        request: RunRequest,
    ) -> Result<T, CliError> {
        let result = self.runner.run(cli, &request)?;
        parser::parse_json(&result.stdout)
    }
}
