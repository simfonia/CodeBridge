//! arduino-cli 執行檔解析與 CodeBridge 專屬設定目錄隔離。

use serde::Serialize;
use std::fmt;
use std::path::{Path, PathBuf};

/// Windows 與 Unix 下的 CLI 執行檔名稱。
const EXECUTABLE_NAME: &str = if cfg!(windows) { "arduino-cli.exe" } else { "arduino-cli" };

/// arduino-cli 執行檔的來源。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CliSource {
    /// 使用者在 CodeBridge 設定面板中指定的路徑。
    UserConfigured,
    /// 由系統 PATH 環境變數搜尋得到。
    SystemPath,
}

impl CliSource {
    /// 對應 i18n message key，供前端顯示來源說明。
    pub fn message_key(&self) -> &'static str {
        match self {
            CliSource::UserConfigured => "CLI_SOURCE_USER_CONFIGURED",
            CliSource::SystemPath => "CLI_SOURCE_SYSTEM_PATH",
        }
    }
}

/// 已解析的 arduino-cli 執行檔。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CliHandle {
    /// 執行檔完整路徑。
    pub program: PathBuf,
    /// 取得來源。
    pub source: CliSource,
}

impl CliHandle {
    /// 組出實際執行的程式與參數；`args` 不含 `--config-dir` 等全域旗標。
    pub fn command(&self, args: &[String]) -> (PathBuf, Vec<String>) {
        (self.program.clone(), args.to_vec())
    }
}

/// CLI 解析與執行失敗。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CliError {
    /// 使用者設定了路徑，但該路徑不存在或不是檔案。
    ConfiguredPathMissing { path: String },
    /// 系統 PATH 與使用者設定都找不到 arduino-cli。
    NotFound {
        /// 官方安裝說明頁。
        url: String,
        /// 建議安裝指令。
        command: String,
    },
    /// 找到執行檔但無法啟動。
    SpawnFailed { program: String, reason: String },
    /// CLI 以非零狀態結束，且輸出無法解析為預期 JSON。
    CommandFailed {
        /// 已解析的錯誤訊息（取自 CLI JSON 的 `message` 欄位）。
        message: String,
        /// stderr 原始輸出（已截斷）。
        stderr: String,
    },
    /// JSON 解析失敗。
    InvalidJson { reason: String },
}

impl CliError {
    /// 對應 i18n message key，供前端顯示。
    pub fn message_key(&self) -> &'static str {
        match self {
            CliError::ConfiguredPathMissing { .. } => "CLI_ERROR_CONFIGURED_PATH_MISSING",
            CliError::NotFound { .. } => "CLI_ERROR_NOT_FOUND",
            CliError::SpawnFailed { .. } => "CLI_ERROR_SPAWN_FAILED",
            CliError::CommandFailed { .. } => "CLI_ERROR_COMMAND_FAILED",
            CliError::InvalidJson { .. } => "CLI_ERROR_INVALID_JSON",
        }
    }

    /// 是否為「尚未安裝」類錯誤；前端據此顯示安裝引導面板。
    pub fn is_not_installed(&self) -> bool {
        matches!(self, CliError::NotFound { .. })
    }
}

impl fmt::Display for CliError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CliError::ConfiguredPathMissing { path } => {
                write!(f, "設定的 Arduino CLI 路徑不存在: {}", path)
            }
            CliError::NotFound { .. } => write!(f, "找不到 arduino-cli，請先安裝"),
            CliError::SpawnFailed { program, reason } => {
                write!(f, "無法啟動 {}: {}", program, reason)
            }
            CliError::CommandFailed { message, .. } => write!(f, "Arduino CLI 執行失敗: {}", message),
            CliError::InvalidJson { reason } => write!(f, "無法解析 Arduino CLI 回應: {}", reason),
        }
    }
}

impl std::error::Error for CliError {}

/// CodeBridge 專屬的 arduino-cli 目錄配置。
///
/// 所有目錄都位於應用程式的 `app_data_dir` 之下，與使用者既有的全域 Arduino
/// 設定（`%LOCALAPPDATA%\Arduino15` 等）完全隔離，避免 CodeBridge 的 core 與
/// library 設定污染使用者的 Arduino IDE。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ToolchainDirs {
    /// CLI 設定目錄，對應 `--config-dir`。
    pub config_dir: PathBuf,
    /// 套件資料目錄（board core），對應 `directories.data`。
    pub data_dir: PathBuf,
    /// 使用者目錄（sketchbook），對應 `directories.user`。
    pub user_dir: PathBuf,
    /// 套件下載暫存目錄，對應 `directories.downloads`。
    pub downloads_dir: PathBuf,
    /// 編譯輸出與草稿暫存根目錄。
    pub build_root: PathBuf,
}

impl ToolchainDirs {
    /// 由應用程式資料根目錄推導全部子目錄。
    ///
    /// 佈局：
    /// ```text
    /// <app_data>/
    ///   arduino/           config_dir
    ///     data/            board core
    ///     user/            sketchbook
    ///     downloads/       package cache
    ///   sketches/          build_root（每次編譯的暫存草稿）
    /// ```
    pub fn under(app_data_root: &Path) -> Self {
        let arduino_root = app_data_root.join("arduino");
        Self {
            config_dir: arduino_root.clone(),
            data_dir: arduino_root.join("data"),
            user_dir: arduino_root.join("user"),
            downloads_dir: arduino_root.join("downloads"),
            build_root: app_data_root.join("sketches"),
        }
    }

    /// 建立所有目錄（含父層）。CLI 執行前需確保存在。
    pub fn ensure(&self) -> std::io::Result<()> {
        for dir in [
            &self.config_dir,
            &self.data_dir,
            &self.user_dir,
            &self.downloads_dir,
            &self.build_root,
        ] {
            std::fs::create_dir_all(dir)?;
        }
        Ok(())
    }

    /// 產生指定專案的草稿**容器**目錄路徑（不負責建立）。
    ///
    /// 這是 `project_id` 層；底下還會有一層與 `.ino` 同名的目錄，
    /// 因為 arduino-cli 要求草稿資料夾名必須與主檔名完全相同。
    pub fn sketch_dir(&self, project_id: &str) -> PathBuf {
        self.build_root.join(project_id)
    }

    /// 真正交給 `arduino-cli` 的草稿目錄：容器目錄下的 `<stem>/`。
    ///
    /// **為什麼要多一層**：`arduino-cli` 硬性要求草稿資料夾名與 `.ino` 主檔名
    /// 完全相同，但 CodeBridge 還需要**專案隔離** —— 兩個同名專案不該共用一個
    /// 草稿目錄。因此路徑是 `build_root/<project_id>/<stem>/<stem>.ino`：
    /// 最內層目錄名滿足 CLI，外層的 `project_id` 滿足隔離。
    pub fn sketch_path(&self, project_id: &str, stem: &str) -> PathBuf {
        self.build_root.join(project_id).join(stem)
    }
}

/// 依 B 方案解析 arduino-cli 執行檔。
///
/// 解析優先序：
/// 1. 使用者於設定面板指定的路徑（`user_configured`）。若指定但不存在，回傳
///    [`CliError::ConfiguredPathMissing`] 而**不**靜默 fallback，讓使用者知道
///    自己的設定有問題。
/// 2. 系統 `PATH` 環境變數搜尋。
/// 3. 皆失敗時回傳 [`CliError::NotFound`]，由 UI 顯示安裝引導。
///
/// `path_override` 供測試注入（此時視為待搜尋目錄）；正式呼叫傳入 `None` 表示
/// 使用系統 PATH。
pub fn resolve_cli(
    user_configured: Option<&Path>,
    path_override: Option<&Path>,
) -> Result<CliHandle, CliError> {
    if let Some(configured) = user_configured {
        if is_file(configured) {
            return Ok(CliHandle {
                program: configured.to_path_buf(),
                source: CliSource::UserConfigured,
            });
        }
        return Err(CliError::ConfiguredPathMissing {
            path: configured.display().to_string(),
        });
    }

    // 開發模式下允許注入待搜尋目錄；正式發行時呼叫端仍傳 None 以走系統 PATH。
    let program = match path_override {
        Some(dir) => search_in_dir(dir),
        None => search_path_env(),
    };

    if let Some(program) = program {
        if is_file(&program) {
            return Ok(CliHandle {
                program,
                source: CliSource::SystemPath,
            });
        }
    }

    Err(CliError::NotFound {
        url: crate::arduino::ARDUINO_CLI_DOWNLOAD_URL.to_string(),
        command: install_command_hint(),
    })
}

/// 平台對應的安裝指令提示。
fn install_command_hint() -> String {
    if cfg!(windows) {
        "winget install arduino.arduino-cli".to_string()
    } else if cfg!(target_os = "macos") {
        "brew install arduino-cli".to_string()
    } else {
        "curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh"
            .to_string()
    }
}

/// 從 `PATH` 環境變數搜尋 arduino-cli。
fn search_path_env() -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    let mut candidate_dirs: Vec<PathBuf> = std::env::split_paths(&path).collect();
    candidate_dirs.reverse();
    for dir in candidate_dirs {
        if let Some(found) = search_in_dir(&dir) {
            return Some(found);
        }
    }
    None
}

/// 在單一目錄中尋找可執行檔。
///
/// Windows 需同時嘗試 `arduino-cli.exe` 與無副檔名的 `arduino-cli`（部分安裝
/// 方式會產生這類 shim）；Unix 只檢查 `arduino-cli`。
pub fn search_in_dir(dir: &Path) -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = vec![dir.join(EXECUTABLE_NAME)];
    if cfg!(windows) {
        candidates.push(dir.join("arduino-cli"));
    }

    for candidate in candidates {
        if is_file(&candidate) {
            return Some(candidate);
        }
    }
    None
}

/// 判斷路徑是否存在且為一般檔案（目錄不算）。
fn is_file(path: &Path) -> bool {
    std::fs::metadata(path)
        .map(|meta| meta.is_file())
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    /// 建立暫存目錄，測試結束後自動清理。
    struct TempDir(PathBuf);

    impl TempDir {
        fn new(tag: &str) -> Self {
            let dir = std::env::temp_dir().join(format!(
                "codebridge-paths-{}-{}",
                tag,
                std::process::id()
            ));
            let _ = fs::remove_dir_all(&dir);
            fs::create_dir_all(&dir).expect("temp dir");
            Self(dir)
        }

        fn path(&self) -> &Path {
            &self.0
        }

        fn write_stub(&self) -> PathBuf {
            let program = self.0.join(EXECUTABLE_NAME);
            fs::write(&program, b"stub").expect("write stub");
            program
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn resolve_prefers_user_configured_path() {
        let temp = TempDir::new("configured");
        let program = temp.write_stub();

        let handle = resolve_cli(Some(&program), None).expect("should resolve");
        assert_eq!(handle.program, program);
        assert_eq!(handle.source, CliSource::UserConfigured);
        assert_eq!(handle.source.message_key(), "CLI_SOURCE_USER_CONFIGURED");
    }

    #[test]
    fn missing_configured_path_does_not_fall_back_to_path() {
        let temp = TempDir::new("missing-configured");
        temp.write_stub();
        let missing = temp.path().join("nope").join(EXECUTABLE_NAME);

        // 即使 PATH 上有可用的 CLI，使用者設定錯誤也必須直接回報，不可靜默 fallback。
        let error = resolve_cli(Some(&missing), Some(temp.path())).expect_err("must fail");
        assert!(matches!(error, CliError::ConfiguredPathMissing { .. }));
        assert!(!error.is_not_installed());
    }

    #[test]
    fn resolve_finds_program_in_search_path() {
        let temp = TempDir::new("search");
        let program = temp.write_stub();

        let handle = resolve_cli(None, Some(temp.path())).expect("should resolve via path");
        assert_eq!(handle.program, program);
        assert_eq!(handle.source, CliSource::SystemPath);
    }

    #[test]
    fn resolve_reports_not_installed_when_path_empty() {
        let temp = TempDir::new("empty");
        let error = resolve_cli(None, Some(temp.path())).expect_err("must fail");
        assert!(error.is_not_installed());
        assert_eq!(error.message_key(), "CLI_ERROR_NOT_FOUND");
        match error {
            CliError::NotFound { url, command } => {
                assert!(url.starts_with("https://arduino.github.io/"));
                assert!(!command.is_empty());
            }
            other => panic!("unexpected error: {:?}", other),
        }
    }

    #[test]
    fn directory_is_not_treated_as_executable() {
        let temp = TempDir::new("is-dir");
        let dir = temp.path().join(EXECUTABLE_NAME);
        fs::create_dir_all(&dir).expect("create dir");

        assert!(!is_file(&dir));
        assert!(resolve_cli(Some(&dir), None).is_err());
    }

    #[test]
    fn search_in_dir_ignores_missing_candidate() {
        let temp = TempDir::new("search-missing");
        assert_eq!(search_in_dir(temp.path()), None);
    }

    #[test]
    fn toolchain_dirs_are_isolated_from_global_arduino() {
        let root = Path::new("C:/fake/AppData/Roaming/com.codebridge.app");
        let dirs = ToolchainDirs::under(root);

        assert_eq!(dirs.config_dir, root.join("arduino"));
        assert_eq!(dirs.data_dir, root.join("arduino").join("data"));
        assert_eq!(dirs.user_dir, root.join("arduino").join("user"));
        assert_eq!(dirs.downloads_dir, root.join("arduino").join("downloads"));
        assert_eq!(dirs.build_root, root.join("sketches"));

        // 隔離關鍵：不得指向使用者的全域 Arduino15 目錄。
        let serialized = format!("{:?}", dirs);
        assert!(!serialized.contains("Arduino15"));
    }

    #[test]
    fn toolchain_dirs_ensure_creates_all_directories() {
        let temp = TempDir::new("ensure");
        let dirs = ToolchainDirs::under(temp.path());
        dirs.ensure().expect("ensure dirs");

        for dir in [
            &dirs.config_dir,
            &dirs.data_dir,
            &dirs.user_dir,
            &dirs.downloads_dir,
            &dirs.build_root,
        ] {
            assert!(dir.is_dir(), "missing dir: {}", dir.display());
        }
    }

    #[test]
    fn sketch_dir_is_scoped_per_project() {
        let dirs = ToolchainDirs::under(Path::new("/tmp/appdata"));
        assert_eq!(
            dirs.sketch_dir("proj-1"),
            PathBuf::from("/tmp/appdata").join("sketches").join("proj-1")
        );
    }
}
