pub mod arduino;
pub mod commands;
pub mod events;
pub mod project;
pub mod serial_monitor;
pub mod settings;

use tauri::{AppHandle, Emitter, Manager};
use std::collections::HashMap;
use std::sync::{Arc, Mutex, RwLock};

use arduino::operations::OperationRegistry;
use arduino::paths::{resolve_cli, ArduinoCliDirs, ToolchainDirs};
use arduino::pipeline::BuildRecord;
use arduino::runner::StdProcessRunner;
use arduino::CodeBridgeToolchain;
use settings::AppSettings;

/// AppState 定義應用程式狀態
pub struct AppState {
    /// 序列埠清單快取（由 board discovery 或 serialport 掃描更新）。
    pub serial_ports: Arc<Mutex<Vec<String>>>,
    /// 使用者於設定面板指定的 arduino-cli 路徑；None 表示使用系統 PATH。
    pub cli_path_override: Arc<Mutex<Option<String>>>,
    /// 額外 Board Manager URL。
    pub board_manager_urls: Arc<Mutex<Vec<String>>>,
    /// 長作業 registry。
    pub operations: OperationRegistry,
    /// CLI 目錄；於啟動時建立，設定變更時可整組更新。
    ///
    /// **預設共用** `arduino-cli` 的系統目錄（見 [`ToolchainDirs`]）——
    /// 隔離會讓使用者看不到自己已裝的核心。需要獨立環境時由設定面板切換。
    ///
    /// **為什麼是 `RwLock`**：設定頁切換共用／隔離時必須能就地換掉整組目錄，
    /// 而 watcher、查詢命令都會同時讀取它。
    pub toolchain_dirs: Arc<RwLock<ToolchainDirs>>,
    /// 工具鏈是否使用 CodeBridge 專屬目錄（`true` = 隔離，預設 `false` = 共用）。
    ///
    /// 這是 [`AppSettings::isolated`](crate::settings::AppSettings::isolated)
    /// 的執行期鏡像；設定檔才是權威來源。
    pub isolated_toolchain: Arc<Mutex<bool>>,
    /// 使用者設定（權威來源為 `settings.json`）。
    pub settings: Arc<Mutex<AppSettings>>,
    /// 應用程式資料根目錄；設定檔與產物根目錄都掛在它之下。
    pub app_data_dir: std::path::PathBuf,
    /// `settings.json` 的完整路徑。
    pub settings_path: std::path::PathBuf,
    /// 成功編譯紀錄（`projectId` → build 資訊），上傳時作為前置依據。
    ///
    /// **後端權威**：前端上傳時只送 `projectId`／`fqbn`／`port`，
    /// build 路徑一律由此處查出。不可讓前端直接指定 `--input-dir`，
    /// 否則惡意的 webview 就能要求把任意目錄的內容寫進晶片。
    pub last_builds: Arc<Mutex<HashMap<String, BuildRecord>>>,
    /// 序列埠佔用鎖；None 代表空閒。
    ///
    /// compile／upload 期間佔用，序列監視器需沿用同一把鎖 ——
    /// 序列埠在 Windows 上是獨佔資源，Monitor 與 avrdude 同時開啟會直接失敗。
    pub port_lease: Arc<Mutex<Option<String>>>,
    /// 進行中的序列監視器 session（最多一個）。
    pub serial_monitor: Arc<Mutex<Option<serial_monitor::Session>>>,
    /// 使用者「想」監看的設定（與是否正在監看分離）。
    ///
    /// **為什麼需要 wants**：upload 會暫時關閉 Monitor，但使用者並沒有
    /// 關閉它的意圖。若只有「是否連線」一個狀態，上傳結束後就分不清
    /// 「使用者要重連」與「使用者已手動關閉」。沿用 #cocoya 的
    /// `SerialMonitorWant` 概念（參見計畫文件）。
    pub monitor_wants: Arc<Mutex<Option<serial_monitor::MonitorConfig>>>,
    /// 讀取 thread 的控制代碼。
    ///
    /// **為什麼必須有**：`stop` 只設旗標並不等於埠已釋放 —— thread 還活著，
    /// `SerialPort` 就還持有 Windows 的 COM handle。沒有 join 的話，
    /// 使用者「關閉監視器」後立刻重新開啟（或改 baud）會得到
    /// `AccessDenied`（症狀：無法開啟序列埠）。實機驗證才抓得到這個問題。
    pub monitor_thread: Arc<Mutex<Option<std::thread::JoinHandle<()>>>>,
}

impl AppState {
    /// 建立狀態；`app_data_dir` 為應用程式資料根目錄。
    ///
    /// 預設**共用** `arduino-cli` 的系統目錄，讓使用者已安裝的核心直接可用；
    /// 產物（草稿暫存）仍隔離在 `app_data` 之下。
    ///
    /// `settings.json` 若存在則以其為準 —— 使用者在設定頁做過的選擇
    /// 必須跨啟動保留，否則「設定」這個功能等於沒有。
    pub fn new(app_data_dir: std::path::PathBuf) -> Self {
        let settings_path = AppSettings::file_path(&app_data_dir);
        let settings = AppSettings::load(&settings_path);
        Self::from_settings(app_data_dir, settings_path, settings)
    }

    /// 由既有的設定物件建立狀態（測試與設定更新路徑共用）。
    pub fn from_settings(
        app_data_dir: std::path::PathBuf,
        settings_path: std::path::PathBuf,
        settings: AppSettings,
    ) -> Self {
        // CLI 的實際目錄以 `config get` 為準；CLI 不存在時退回平台預設值。
        let defaults = resolve_cli(settings.cli_path.as_deref().map(std::path::Path::new), None)
            .map(|cli| ArduinoCliDirs::probe(&cli.program))
            .unwrap_or_else(|_| ArduinoCliDirs::platform_default());
        let isolated = settings.isolated;
        let build_root = settings.resolved_build_root(&app_data_dir);
        let mut toolchain_dirs = ToolchainDirs::with_mode(&app_data_dir, &defaults, isolated);
        toolchain_dirs.build_root = build_root;

        Self {
            serial_ports: Arc::new(Mutex::new(Vec::new())),
            cli_path_override: Arc::new(Mutex::new(settings.cli_path.clone())),
            board_manager_urls: Arc::new(Mutex::new(Vec::new())),
            operations: OperationRegistry::new(),
            toolchain_dirs: Arc::new(RwLock::new(toolchain_dirs)),
            isolated_toolchain: Arc::new(Mutex::new(isolated)),
            settings: Arc::new(Mutex::new(settings)),
            app_data_dir,
            settings_path,
            last_builds: Arc::new(Mutex::new(HashMap::new())),
            port_lease: Arc::new(Mutex::new(None)),
            serial_monitor: Arc::new(Mutex::new(None)),
            monitor_wants: Arc::new(Mutex::new(None)),
            monitor_thread: Arc::new(Mutex::new(None)),
        }
    }

    /// 嘗試佔用序列埠；已被佔用時回傳 `false`。
    pub fn try_acquire_port(&self, port: &str) -> bool {
        let mut lease = match self.port_lease.lock() {
            Ok(guard) => guard,
            Err(_) => return false,
        };
        match lease.as_deref() {
            Some(current) if current == port => true,
            Some(_) => false,
            None => {
                *lease = Some(port.to_string());
                true
            }
        }
    }

    /// 釋放序列埠佔用。
    pub fn release_port(&self, port: &str) {
        if let Ok(mut lease) = self.port_lease.lock() {
            if lease.as_deref() == Some(port) {
                *lease = None;
            }
        }
    }

    /// 目前被佔用的序列埠（供 UI 顯示「忙於編譯／上傳」）。
    pub fn leased_port(&self) -> Option<String> {
        self.port_lease.lock().ok().and_then(|lease| lease.clone())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .on_window_event(|window, event| {
            // 使用者按下視窗右上角的 X：先攔截，請前端確認未儲存變更，
            // 前端決定要儲存／不儲存／取消後再呼叫 app_close 真正關閉。
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.emit(events::names::REQUEST_CLOSE, ());
                }
            }
        })
        .setup(|app| {
            // 於啟動時建立 CodeBridge 專屬的 CLI 目錄，避免首次編譯時失敗。
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::env::temp_dir().join("codebridge"));
            let state = AppState::new(app_data_dir);
            if let Ok(dirs) = state.toolchain_dirs.read() {
                if let Err(err) = dirs.ensure() {
                    eprintln!("[CodeBridge] 無法建立工具鏈目錄: {}", err);
                }
            }
            app.manage(state);
            // 啟動序列埠熱插拔 watcher（T2-D）：1500ms 輪詢 + 簽章 diff。
            commands::spawn_port_watcher(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_serial_ports,
            commands::refresh_serial_ports,
            commands::open_serial_monitor,
            commands::get_version,
            commands::toolchain_detect,
            commands::toolchain_set_cli_path,
            commands::toolchain_get_dirs,
            commands::toolchain_set_dirs,
            commands::board_list_detected,
            commands::board_list_all,
            commands::board_details,
            commands::core_list,
            commands::core_search,
            commands::core_install,
            commands::lib_list,
            commands::operation_status,
            commands::operation_cancel,
            commands::list_examples,
            commands::read_example,
            commands::serial_monitor_start,
            commands::serial_monitor_stop,
            commands::serial_monitor_send,
            commands::serial_monitor_status,
            commands::compile_start,
            commands::upload_start,
            commands::upload_ready,
            project::project_read,
            project::project_save,
            project::project_exists,
            project::project_reveal,
            commands::app_close,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// 建立綁定 `StdProcessRunner` 的工具鏈實例。
pub fn toolchain(state: &AppState) -> CodeBridgeToolchain<StdProcessRunner> {
    let dirs = state
        .toolchain_dirs
        .read()
        .map(|dirs| dirs.clone())
        .unwrap_or_else(|_| ToolchainDirs::under(&state.app_data_dir));
    CodeBridgeToolchain::new(StdProcessRunner::new(), dirs)
}

/// 內建範例所在的資源目錄。
///
/// **為什麼放 resources 而非 public**（對齊 #WaveCode）：
/// 靜態檔案伺服器沒有「列出目錄」的 API，前端 `fetch('examples/')` 拿不到檔案清單。
/// 放在 Tauri 資源目錄後，Rust 端可以用 `fs::read_dir()` 真的列出檔案，
/// 新增範例只要放檔案，不必維護任何索引檔。
pub fn examples_dir(app: &AppHandle) -> Option<std::path::PathBuf> {
    let resource = app.path().resource_dir().ok()?;
    select_examples_dir(&[
        // 打包後：resources/examples
        resource.join("examples"),
        // 開發模式：target/debug/resources/examples
        resource.join("resources").join("examples"),
    ])
}

/// 從候選目錄中挑出真正含有 `.cbg` 的那一個。
///
/// **為什麼不能只看 `is_dir()`**：Cargo 在開發模式會留下
/// `target/debug/examples/` 這種空殼目錄，而真正複製檔案的是
/// `target/debug/resources/examples/`。只判斷「目錄存在」會命中空殼，
/// 症狀是 UI 顯示「目前沒有內建範例」—— 明明檔案就在隔壁。
/// 這正是 2026-09-28 使用者回報的缺陷。
fn select_examples_dir(candidates: &[std::path::PathBuf]) -> Option<std::path::PathBuf> {
    candidates
        .iter()
        .find(|dir| has_examples(dir))
        .cloned()
        // 一個都沒有時回傳第一個存在的目錄，讓錯誤訊息指出真正該修哪裡，
        // 而不是「找不到範例目錄」這種誤導。
        .or_else(|| candidates.iter().find(|dir| dir.is_dir()).cloned())
}

/// 目錄內是否至少有一個 `.cbg` 檔。
fn has_examples(dir: &std::path::Path) -> bool {
    std::fs::read_dir(dir)
        .map(|entries| {
            entries.filter_map(|entry| entry.ok()).any(|entry| {
                let path = entry.path();
                path.is_file()
                    && path
                        .extension()
                        .and_then(|ext| ext.to_str())
                        .map(|ext| ext.eq_ignore_ascii_case("cbg"))
                        .unwrap_or(false)
            })
        })
        .unwrap_or(false)
}

/// 解析目前應使用的 CLI 執行檔。///
/// 使用者設定的路徑優先；設定存在但失效時直接回報錯誤，不靜默 fallback，
/// 讓使用者知道自己的設定需要修正。
pub fn resolve_cli_for(state: &AppState) -> Result<arduino::CliHandle, arduino::CliError> {
    let override_path = state.cli_path_override.lock().ok().and_then(|v| v.clone());
    let configured = override_path.as_ref().map(std::path::PathBuf::from);
    arduino::resolve_cli(configured.as_deref(), None)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 測試用狀態；使用暫存根目錄避免污染應用程式資料。
    fn state(tag: &str) -> AppState {
        let root = std::env::temp_dir().join(format!("codebridge-state-{tag}"));
        let _ = std::fs::remove_dir_all(&root);
        AppState::new(root)
    }

    /// 建立一個只含指定檔名的暫存目錄，回傳其路徑。
    fn temp_dir_with(tag: &str, files: &[&str]) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("codebridge-examples-{tag}"));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("建立暫存目錄");
        for name in files {
            std::fs::write(dir.join(name), b"<xml/>").expect("寫入暫存檔");
        }
        dir
    }

    #[test]
    fn select_examples_dir_skips_empty_shell_and_picks_the_one_with_files() {
        // 回歸（2026-09-28 使用者回報「目前沒有內建範例」）：
        // Cargo 在開發模式留下 target/debug/examples/ 空殼，
        // 真正複製檔案的是 target/debug/resources/examples/。
        // 只用 is_dir() 判斷會命中空殼，UI 就永遠是空的。
        let shell = temp_dir_with("shell", &[]);
        let real = temp_dir_with("real", &["01_blink.cbg"]);
        let shell_path = shell.clone();
        let real_path = real.clone();

        let picked = select_examples_dir(&[shell.clone(), real.clone()]);

        assert_eq!(picked, Some(real_path));
        let _ = std::fs::remove_dir_all(&shell);
    }

    #[test]
    fn select_examples_dir_ignores_non_cbg_files() {
        // 只有 README 沒有範例 → 不算有效目錄。
        let doc_only = temp_dir_with("doc-only", &["README.md"]);
        let real = temp_dir_with("real2", &["02_serial-hello.cbg"]);
        let real_path = real.clone();

        let picked = select_examples_dir(&[doc_only.clone(), real.clone()]);

        assert_eq!(picked, Some(real_path));
        let _ = std::fs::remove_dir_all(&doc_only);
    }

    #[test]
    fn select_examples_dir_falls_back_to_existing_dir_when_empty() {
        // 全都沒有範例時回傳存在的目錄，讓錯誤訊息指出真正該修哪裡。
        let empty = temp_dir_with("empty", &[]);
        let empty_path = empty.clone();

        assert_eq!(select_examples_dir(&[empty.clone()]), Some(empty_path));
        let _ = std::fs::remove_dir_all(&empty);
    }

    #[test]
    fn select_examples_dir_returns_none_when_nothing_exists() {
        let missing = std::env::temp_dir().join("codebridge-examples-does-not-exist");
        let _ = std::fs::remove_dir_all(&missing);
        assert_eq!(select_examples_dir(&[missing]), None);
    }

    #[test]
    fn port_lease_is_exclusive_across_different_ports() {
        let state = state("lease-exclusive");
        assert!(state.try_acquire_port("COM3"));
        // 不同埠不可同時佔用。
        assert!(!state.try_acquire_port("COM4"));
        assert_eq!(state.leased_port().as_deref(), Some("COM3"));
    }

    #[test]
    fn port_lease_is_reentrant_for_same_port() {
        // 同一埠重複取得應回 true（冪等），避免重複點擊造成自我阻塞。
        let state = state("lease-reentrant");
        assert!(state.try_acquire_port("COM3"));
        assert!(state.try_acquire_port("COM3"));
    }

    #[test]
    fn port_lease_release_frees_the_port() {
        let state = state("lease-release");
        assert!(state.try_acquire_port("COM3"));
        state.release_port("COM3");
        assert!(state.leased_port().is_none());
        assert!(state.try_acquire_port("COM4"), "other port must be free");
    }

    #[test]
    fn port_lease_release_only_affects_owning_port() {
        // 釋放別人持有的埠不應影響現有持有者（否則會出現雙持有）。
        let state = state("lease-foreign");
        assert!(state.try_acquire_port("COM3"));
        state.release_port("COM9");
        assert_eq!(state.leased_port().as_deref(), Some("COM3"));
    }

    #[test]
    fn toolchain_dirs_are_under_the_given_root() {
        // 共用模式下 data_dir 與 config_dir 同層（都由 arduino-cli 決定），
        // 因此這裡驗證的是「build_root 一定在 app_data 之下」——
        // 產物隔離是不可退讓的底線。
        let state = state("dirs");
        let dirs = state.toolchain_dirs.read().unwrap();
        assert!(dirs.build_root.starts_with(&state.app_data_dir));
    }

    #[test]
    fn state_reads_persisted_settings_on_startup() {
        // 使用者在設定頁做的選擇必須跨啟動保留，否則「設定」等於沒有。
        let root = std::env::temp_dir().join("codebridge-state-persisted");
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).expect("建立暫存目錄");
        let path = AppSettings::file_path(&root);
        AppSettings {
            cli_path: Some("D:/tools/arduino-cli.exe".to_string()),
            isolated: true,
            build_root: None,
        }
        .save(&path)
        .expect("寫入設定");

        let state = AppState::new(root.clone());
        assert_eq!(
            state.cli_path_override.lock().unwrap().as_deref(),
            Some("D:/tools/arduino-cli.exe")
        );
        assert!(*state.isolated_toolchain.lock().unwrap());
        // 隔離模式的核心目錄必須在 app_data 之下。
        let dirs = state.toolchain_dirs.read().unwrap();
        assert!(dirs.data_dir.starts_with(&root));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn build_root_override_is_applied_from_settings() {
        let root = std::env::temp_dir().join("codebridge-state-buildroot");
        let _ = std::fs::remove_dir_all(&root);
        let state = AppState::from_settings(
            root.clone(),
            AppSettings::file_path(&root),
            AppSettings {
                build_root: Some(root.join("custom-build").display().to_string()),
                ..AppSettings::default()
            },
        );
        let dirs = state.toolchain_dirs.read().unwrap();
        assert_eq!(dirs.build_root, root.join("custom-build"));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn missing_settings_file_keeps_shared_mode() {
        // 沒有 settings.json 的首次啟動必須是「共用」——
        // 隔離會讓使用者看不到自己已裝的核心（2026-09-27 的最嚴重 UX 缺陷）。
        let root = std::env::temp_dir().join("codebridge-state-fresh");
        let _ = std::fs::remove_dir_all(&root);
        let state = AppState::new(root.clone());
        assert!(!*state.isolated_toolchain.lock().unwrap());
        let dirs = state.toolchain_dirs.read().unwrap();
        // 共用時核心目錄不得在 app_data 之下（那才是隔離）。
        assert!(!dirs.data_dir.starts_with(&root));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn last_builds_start_empty() {
        let state = state("builds");
        assert!(state.last_builds.lock().unwrap().is_empty());
    }
}
