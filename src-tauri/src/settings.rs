//! CodeBridge 應用程式設定的持久化（`settings.json`）。
//!
//! 職責：把使用者在「設定中心 › 進階 › 路徑」做的選擇寫到磁碟，
//! 下次啟動時由 [`crate::AppState`] 讀回並據此組出 [`ToolchainDirs`]。
//!
//! **為什麼不放 localStorage**：設定描述的是使用者機器的環境事實
//! （`arduino-cli` 裝在哪、核心目錄在哪），不是介面偏好。放在瀏覽器的
//! localStorage 會讓「重開瀏覽器資料夾就壞掉」，也無法被後端命令共用。

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// 設定檔檔名。
pub const SETTINGS_FILE: &str = "settings.json";

/// CodeBridge 的使用者設定。
///
/// **每個欄位都要有合理的預設值**，讓沒有 `settings.json` 的首次啟動
/// 也能直接運作 —— 缺檔不是錯誤狀態，只是「用預設」。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AppSettings {
    /// 使用者指定的 `arduino-cli` 執行檔完整路徑；`None` 表示走系統 `PATH`。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cli_path: Option<String>,
    /// 工具鏈是否使用 CodeBridge 專屬（隔離）目錄。
    ///
    /// `false` = 共用 `arduino-cli` 系統目錄（與 Arduino IDE 2 一致），
    /// 讓使用者已安裝的核心直接可用。詳見 `ToolchainDirs` 的說明。
    pub isolated: bool,
    /// 產物（草稿暫存）根目錄覆寫；`None` 表示用 `<app_data>/sketches`。
    ///
    /// **產物永遠隔離**：它與「工具鏈要不要共用」是兩個獨立決策。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub build_root: Option<String>,
}

impl AppSettings {
    /// 設定檔的完整路徑（`settings.json` 位於應用程式資料根目錄之下）。
    pub fn file_path(app_data_root: &Path) -> PathBuf {
        app_data_root.join(SETTINGS_FILE)
    }

    /// 讀取設定。
    ///
    /// **缺檔與壞檔都退回預設值**而不是回傳錯誤 —— 設定檔壞掉不該讓
    /// CodeBridge 無法啟動，那會讓使用者連「重設設定」這個逃生門都沒有。
    /// 解析失敗只印到 stderr 供開發者診斷。
    pub fn load(path: &Path) -> Self {
        let raw = match std::fs::read_to_string(path) {
            Ok(raw) => raw,
            Err(error) => {
                if error.kind() != std::io::ErrorKind::NotFound {
                    eprintln!("[CodeBridge] 無法讀取設定檔（改用預設）: {}", error);
                }
                return Self::default();
            }
        };
        // 使用者可能用記事本編輯過，容忍 UTF-8 BOM（與 .cbg 讀取一致）。
        let text = raw.strip_prefix('\u{feff}').unwrap_or(&raw);
        match serde_json::from_str::<Self>(text) {
            Ok(settings) => settings,
            Err(error) => {
                eprintln!("[CodeBridge] 設定檔格式錯誤（改用預設）: {}", error);
                Self::default()
            }
        }
    }

    /// 寫入設定；先寫暫存檔再置換，避免中途中斷產生半個 JSON。
    pub fn save(&self, path: &Path) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            if !parent.as_os_str().is_empty() && !parent.is_dir() {
                return Err(format!("SETTINGS_ERROR_WRITE_FAILED|{}", parent.display()));
            }
        }
        let json = serde_json::to_string_pretty(self)
            .map_err(|error| format!("SETTINGS_ERROR_WRITE_FAILED|{error}"))?;
        let temporary = path.with_extension("json.tmp");
        std::fs::write(&temporary, json.as_bytes())
            .and_then(|_| std::fs::rename(&temporary, path))
            .map_err(|error| format!("SETTINGS_ERROR_WRITE_FAILED|{}", error))
    }

    /// 套用產物目錄覆寫；`None` 或全空白視為未設定。
    pub fn resolved_build_root(&self, app_data_root: &Path) -> PathBuf {
        self.build_root
            .as_ref()
            .map(|raw| PathBuf::from(raw.trim()))
            .filter(|path| !path.as_os_str().is_empty())
            .unwrap_or_else(|| app_data_root.join("sketches"))
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    struct TempDir(PathBuf);

    impl TempDir {
        fn new(tag: &str) -> Self {
            let path = std::env::temp_dir().join(format!("codebridge-settings-{tag}"));
            let _ = std::fs::remove_dir_all(&path);
            std::fs::create_dir_all(&path).expect("create temp dir");
            Self(path)
        }

        fn file(&self) -> PathBuf {
            self.0.join(SETTINGS_FILE)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn missing_file_falls_back_to_defaults() {
        let temp = TempDir::new("missing");
        let settings = AppSettings::load(&temp.0.join("nope.json"));
        // 首次啟動必須是「共用系統目錄」—— 隔離會讓使用者看不到已裝的核心。
        assert_eq!(settings, AppSettings::default());
        assert!(!settings.isolated);
        assert!(settings.cli_path.is_none());
    }

    #[test]
    fn save_then_load_round_trips() {
        let temp = TempDir::new("roundtrip");
        let original = AppSettings {
            cli_path: Some("D:/tools/arduino-cli.exe".to_string()),
            isolated: true,
            build_root: Some("D:/build".to_string()),
        };
        original.save(&temp.file()).expect("save");
        assert_eq!(AppSettings::load(&temp.file()), original);
    }

    #[test]
    fn corrupt_file_falls_back_instead_of_failing() {
        // 設定檔壞掉不該讓應用程式無法啟動 —— 使用者會連重設的機會都沒有。
        let temp = TempDir::new("corrupt");
        std::fs::write(temp.file(), "{ this is not json").expect("write");
        assert_eq!(AppSettings::load(&temp.file()), AppSettings::default());
    }

    #[test]
    fn bom_prefixed_file_is_tolerated() {
        // 使用者用記事本存過是常見情境，與 .cbg 讀取保持一致。
        let temp = TempDir::new("bom");
        std::fs::write(temp.file(), "\u{feff}{\"isolated\":true}").expect("write");
        assert!(AppSettings::load(&temp.file()).isolated);
    }

    #[test]
    fn unknown_fields_are_ignored() {
        // 舊版或未來的設定檔不該讓新版讀不進來。
        let temp = TempDir::new("unknown");
        std::fs::write(temp.file(), "{\"isolated\":true,\"futureKey\":42}").expect("write");
        assert!(AppSettings::load(&temp.file()).isolated);
    }

    #[test]
    fn empty_file_falls_back_to_defaults() {
        let temp = TempDir::new("empty");
        std::fs::write(temp.file(), "").expect("write");
        assert_eq!(AppSettings::load(&temp.file()), AppSettings::default());
    }

    #[test]
    fn resolved_build_root_uses_override_when_present() {
        let temp = TempDir::new("build-root");
        let settings = AppSettings {
            build_root: Some("D:/custom-build".to_string()),
            ..AppSettings::default()
        };
        assert_eq!(
            settings.resolved_build_root(&temp.0),
            PathBuf::from("D:/custom-build")
        );
    }

    #[test]
    fn blank_build_root_is_treated_as_absent() {
        // 使用者在欄位留空白並存檔，是很常見的操作。
        let temp = TempDir::new("blank-build-root");
        let settings = AppSettings {
            build_root: Some("   ".to_string()),
            ..AppSettings::default()
        };
        assert_eq!(
            settings.resolved_build_root(&temp.0),
            temp.0.join("sketches")
        );
    }

    #[test]
    fn save_reports_missing_parent_directory() {
        let temp = TempDir::new("no-parent");
        let missing = temp.0.join("a").join("b").join(SETTINGS_FILE);
        let error = AppSettings::default()
            .save(&missing)
            .expect_err("must fail");
        assert!(error.starts_with("SETTINGS_ERROR_WRITE_FAILED|"));
    }

    #[test]
    fn save_leaves_no_temporary_file_behind() {
        // 置換式寫入會產生 .tmp；成功後必須不殘留，否則資料夾會越用越髒。
        let temp = TempDir::new("no-tmp");
        AppSettings::default().save(&temp.file()).expect("save");
        let leftovers: Vec<String> = std::fs::read_dir(&temp.0)
            .expect("read dir")
            .filter_map(|entry| entry.ok())
            .map(|entry| entry.file_name().to_string_lossy().to_string())
            .filter(|name| name.ends_with(".tmp"))
            .collect();
        assert!(
            leftovers.is_empty(),
            "unexpected temp files: {:?}",
            leftovers
        );
    }
}
