//! arduino-cli command builder。
//!
//! 本模組是**純函式**：只負責把領域輸入轉換成子命令與參數，不做任何檔案或
//! 程序操作，因此可在沒有安裝 arduino-cli 的環境下完整單元測試。

use std::path::{Path, PathBuf};

use super::paths::ToolchainDirs;

/// 已組裝完成的 CLI 呼叫（不含執行程式的路徑，由呼叫端配對 `CliHandle`）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CliCommand {
    /// 執行的子命令鏈，例如 `board listall`。
    pub subcommand: String,
    /// 完整參數陣列（已含全域旗標，置於子命令之前）。
    pub args: Vec<String>,
}

/// 全域旗標配置。
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct GlobalFlags {
    /// `--config-dir`；None 表示使用 CLI 預設值。
    pub config_dir: Option<PathBuf>,
    /// 額外 Board Manager URL。
    pub additional_urls: Vec<String>,
    /// 是否要求 `--json`。
    pub json: bool,
}

impl GlobalFlags {
    /// 以 CodeBridge 隔離目錄建立旗標。
    pub fn isolated(dirs: &ToolchainDirs) -> Self {
        Self {
            config_dir: Some(dirs.config_dir.clone()),
            additional_urls: Vec::new(),
            json: false,
        }
    }

    /// 注入額外 Board Manager URL。
    pub fn with_additional_urls(mut self, urls: Vec<String>) -> Self {
        self.additional_urls = urls;
        self
    }

    /// 要求 JSON 輸出。
    pub fn with_json(mut self) -> Self {
        self.json = true;
        self
    }

    /// 將全域旗組裝成 args 前綴；順序為 config-dir → additional-urls → json → no-color。
    fn prefix(&self) -> Vec<String> {
        let mut out: Vec<String> = Vec::new();
        if let Some(dir) = &self.config_dir {
            out.push("--config-dir".to_string());
            out.push(dir.display().to_string());
        }
        if !self.additional_urls.is_empty() {
            out.push("--additional-urls".to_string());
            out.push(self.additional_urls.join(","));
        }
        if self.json {
            out.push("--json".to_string());
        }
        out.push("--no-color".to_string());
        out
    }
}

/// 合併全域旗標與子命令參數。
fn assemble(flags: &GlobalFlags, tail: Vec<String>) -> Vec<String> {
    let mut args = flags.prefix();
    args.extend(tail);
    args
}

/// `version --format json`：取得 CLI 版本。
pub fn version(flags: &GlobalFlags) -> CliCommand {
    CliCommand {
        subcommand: "version".to_string(),
        args: assemble(flags, vec!["--format".into(), "json".into()]),
    }
}

/// `board list --json`：列出實際連接中的板子。
pub fn board_list(flags: &GlobalFlags) -> CliCommand {
    CliCommand {
        subcommand: "board list".to_string(),
        args: assemble(flags, vec!["board".into(), "list".into()]),
    }
}

/// `board listall --json`：列出所有已知板子與 FQBN。
pub fn board_list_all(flags: &GlobalFlags) -> CliCommand {
    CliCommand {
        subcommand: "board listall".to_string(),
        args: assemble(flags, vec!["board".into(), "listall".into()]),
    }
}

/// `board search <term> --json`：搜尋開發板。
pub fn board_search(flags: &GlobalFlags, term: &str) -> CliCommand {
    CliCommand {
        subcommand: "board search".to_string(),
        args: assemble(
            flags,
            vec!["board".into(), "search".into(), term.to_string()],
        ),
    }
}

/// `board details -b <fqbn> --json`：取得單一開發板詳細資料。
pub fn board_details(flags: &GlobalFlags, fqbn: &str) -> CliCommand {
    CliCommand {
        subcommand: "board details".to_string(),
        args: assemble(
            flags,
            vec![
                "board".into(),
                "details".into(),
                "-b".into(),
                fqbn.to_string(),
            ],
        ),
    }
}

/// `board attach -b <fqbn> <sketch>`：將 FQBN 寫入草稿的 project metadata。
pub fn board_attach(flags: &GlobalFlags, fqbn: &str, sketch_dir: &Path) -> CliCommand {
    CliCommand {
        subcommand: "board attach".to_string(),
        args: assemble(
            flags,
            vec![
                "board".into(),
                "attach".into(),
                "-b".into(),
                fqbn.to_string(),
                sketch_dir.display().to_string(),
            ],
        ),
    }
}

/// `core list --json`：列出已安裝的 board core。
pub fn core_list(flags: &GlobalFlags) -> CliCommand {
    CliCommand {
        subcommand: "core list".to_string(),
        args: assemble(flags, vec!["core".into(), "list".into()]),
    }
}

/// `core search <term> --json`：搜尋可安裝的 board core。
pub fn core_search(flags: &GlobalFlags, term: &str) -> CliCommand {
    CliCommand {
        subcommand: "core search".to_string(),
        args: assemble(
            flags,
            vec!["core".into(), "search".into(), term.to_string()],
        ),
    }
}

/// `core install <package>`：安裝 board core。
pub fn core_install(flags: &GlobalFlags, package: &str) -> CliCommand {
    CliCommand {
        subcommand: "core install".to_string(),
        args: assemble(
            flags,
            vec!["core".into(), "install".into(), package.to_string()],
        ),
    }
}

/// `core uninstall <package>`：移除 board core。
pub fn core_uninstall(flags: &GlobalFlags, package: &str) -> CliCommand {
    CliCommand {
        subcommand: "core uninstall".to_string(),
        args: assemble(
            flags,
            vec!["core".into(), "uninstall".into(), package.to_string()],
        ),
    }
}

/// `core update-index`：更新套件索引。
pub fn core_update_index(flags: &GlobalFlags) -> CliCommand {
    CliCommand {
        subcommand: "core update-index".to_string(),
        args: assemble(flags, vec!["core".into(), "update-index".into()]),
    }
}

/// `lib search <term> --json`：搜尋函式庫。
pub fn lib_search(flags: &GlobalFlags, term: &str) -> CliCommand {
    CliCommand {
        subcommand: "lib search".to_string(),
        args: assemble(
            flags,
            vec!["lib".into(), "search".into(), term.to_string()],
        ),
    }
}

/// `lib list --json`：列出已安裝函式庫。
pub fn lib_list(flags: &GlobalFlags) -> CliCommand {
    CliCommand {
        subcommand: "lib list".to_string(),
        args: assemble(flags, vec!["lib".into(), "list".into()]),
    }
}

/// `lib install <spec>`：安裝函式庫。
pub fn lib_install(flags: &GlobalFlags, spec: &str) -> CliCommand {
    CliCommand {
        subcommand: "lib install".to_string(),
        args: assemble(flags, vec!["lib".into(), "install".into(), spec.to_string()]),
    }
}

/// `lib uninstall <name>`：移除函式庫。
pub fn lib_uninstall(flags: &GlobalFlags, name: &str) -> CliCommand {
    CliCommand {
        subcommand: "lib uninstall".to_string(),
        args: assemble(
            flags,
            vec!["lib".into(), "uninstall".into(), name.to_string()],
        ),
    }
}

/// 編譯選項。
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct CompileOptions {
    /// 匯出 .hex / .bin 到輸出目錄。
    pub export_binaries: bool,
    /// 編譯前清除 build 快取。
    pub clean: bool,
    /// gcc 警告層級：`none` / `default` / `more` / `all`。
    pub warnings: Option<String>,
    /// 平行編譯工作數；None 代表由 CLI 決定。
    pub jobs: Option<u32>,
    /// 額外 library 搜尋路徑。
    pub libraries: Vec<PathBuf>,
}

impl CompileOptions {
    /// 建立預設選項：匯出二進位、警告層級 `all`，教學場景需要看到完整訊息。
    pub fn teaching_default() -> Self {
        Self {
            export_binaries: true,
            clean: false,
            warnings: Some("all".to_string()),
            jobs: None,
            libraries: Vec::new(),
        }
    }
}

/// `compile -b <fqbn> --build-path <dir> <sketch>`：編譯草稿。
pub fn compile(
    flags: &GlobalFlags,
    sketch_dir: &Path,
    fqbn: &str,
    build_path: &Path,
    options: &CompileOptions,
) -> CliCommand {
    let mut tail: Vec<String> = vec!["compile".into(), "-b".into(), fqbn.to_string()];
    tail.push("--build-path".into());
    tail.push(build_path.display().to_string());
    if options.export_binaries {
        tail.push("--export-binaries".into());
    }
    if options.clean {
        tail.push("--clean".into());
    }
    if let Some(level) = &options.warnings {
        tail.push("--warnings".into());
        tail.push(level.clone());
    }
    if let Some(jobs) = options.jobs {
        tail.push("-j".into());
        tail.push(jobs.to_string());
    }
    for lib in &options.libraries {
        tail.push("--library".into());
        tail.push(lib.display().to_string());
    }
    tail.push(sketch_dir.display().to_string());

    CliCommand {
        subcommand: "compile".to_string(),
        args: assemble(flags, tail),
    }
}

/// `upload -b <fqbn> -p <port> --input-dir <dir> <sketch>`：上傳已編譯結果。
pub fn upload(
    flags: &GlobalFlags,
    sketch_dir: &Path,
    fqbn: &str,
    port: &str,
    input_dir: &Path,
) -> CliCommand {
    CliCommand {
        subcommand: "upload".to_string(),
        args: assemble(
            flags,
            vec![
                "upload".into(),
                "-b".into(),
                fqbn.to_string(),
                "-p".into(),
                port.to_string(),
                "--input-dir".into(),
                input_dir.display().to_string(),
                sketch_dir.display().to_string(),
            ],
        ),
    }
}

/// `monitor -p <port> --config baudrate=<baud>`：開啟序列監控（文字模式）。
pub fn monitor(flags: &GlobalFlags, port: &str, baud: u32) -> CliCommand {
    CliCommand {
        subcommand: "monitor".to_string(),
        args: assemble(
            flags,
            vec![
                "monitor".into(),
                "-p".into(),
                port.to_string(),
                "--config".into(),
                format!("baudrate={}", baud),
            ],
        ),
    }
}

/// `config init --dest-dir <dir>`：建立 CodeBridge 專屬 CLI 設定。
pub fn config_init(flags: &GlobalFlags, dest_dir: &Path) -> CliCommand {
    CliCommand {
        subcommand: "config init".to_string(),
        args: assemble(
            flags,
            vec![
                "config".into(),
                "init".into(),
                "--dest-dir".into(),
                dest_dir.display().to_string(),
            ],
        ),
    }
}

/// `config dump --json`：取得 CLI 目前生效的設定。
pub fn config_dump(flags: &GlobalFlags) -> CliCommand {
    CliCommand {
        subcommand: "config dump".to_string(),
        args: assemble(flags, vec!["config".into(), "dump".into()]),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 測試用隔離目錄；不實際落地，僅供旗標組裝斷言。
    fn test_dirs() -> ToolchainDirs {
        ToolchainDirs::under(Path::new("/appdata"))
    }

    /// 取得子命令首個 token 之後的所有參數，方便斷言後續參數。
    fn tail_after<'a>(cmd: &'a CliCommand, subcommand: &str) -> &'a [String] {
        let head = subcommand.split(' ').count();
        let first = subcommand.split(' ').next().unwrap();
        cmd.args
            .iter()
            .position(|arg| arg == first)
            .map(|idx| &cmd.args[idx + head..])
            .expect("subcommand must be present in args")
    }

    /// 測試用的隔離 config-dir 顯示字串（依平台分隔符）。
    fn test_config_dir() -> String {
        ToolchainDirs::under(Path::new("/appdata"))
            .config_dir
            .display()
            .to_string()
    }

    #[test]
    fn global_flags_always_isolate_config_dir() {
        let flags = GlobalFlags::isolated(&test_dirs()).with_json();
        let cmd = board_list(&flags);

        assert_eq!(cmd.subcommand, "board list");
        assert_eq!(
            cmd.args,
            vec![
                "--config-dir".to_string(),
                test_config_dir(),
                "--json".to_string(),
                "--no-color".to_string(),
                "board".to_string(),
                "list".to_string(),
            ]
        );
    }

    #[test]
    fn global_flags_precede_subcommand() {
        let flags = GlobalFlags::isolated(&test_dirs()).with_json();
        let cmd = lib_list(&flags);

        let config_idx = cmd.args.iter().position(|a| a == "--config-dir").expect("config-dir");
        let sub_idx = cmd.args.iter().position(|a| a == "lib").expect("lib");
        assert!(config_idx < sub_idx, "global flags must come first");
    }

    #[test]
    fn additional_urls_are_comma_joined() {
        let flags = GlobalFlags::isolated(&test_dirs()).with_additional_urls(vec![
            "https://example.com/package_index.json".to_string(),
            "https://other.example/index.json".to_string(),
        ]);
        let cmd = core_list(&flags);

        let idx = cmd
            .args
            .iter()
            .position(|a| a == "--additional-urls")
            .expect("additional-urls");
        assert_eq!(
            cmd.args[idx + 1],
            "https://example.com/package_index.json,https://other.example/index.json"
        );
    }

    #[test]
    fn empty_additional_urls_are_omitted() {
        let flags = GlobalFlags::isolated(&test_dirs());
        assert!(!core_list(&flags).args.iter().any(|a| a == "--additional-urls"));
    }

    #[test]
    fn version_requests_json_format() {
        let flags = GlobalFlags::isolated(&test_dirs());
        let cmd = version(&flags);
        assert_eq!(cmd.subcommand, "version");
        // `version` 無子命令 token，參數直接接在全域旗標之後。
        assert!(cmd.args.contains(&"--format".to_string()));
        let format_idx = cmd.args.iter().position(|a| a == "--format").expect("--format");
        assert_eq!(cmd.args[format_idx + 1], "json");
    }

    #[test]
    fn board_search_passes_term_as_trailing_arg() {
        let flags = GlobalFlags::isolated(&test_dirs()).with_json();
        assert_eq!(tail_after(&board_search(&flags, "uno"), "board"), &["search", "uno"]);
    }

    #[test]
    fn board_details_uses_short_fqbn_flag() {
        let flags = GlobalFlags::isolated(&test_dirs()).with_json();
        let cmd = board_details(&flags, "arduino:avr:uno");
        assert_eq!(tail_after(&cmd, "board"), &["details", "-b", "arduino:avr:uno"]);
    }

    #[test]
    fn board_attach_places_sketch_dir_last() {
        let flags = GlobalFlags::isolated(&test_dirs());
        let sketch = Path::new("/tmp/sk/proj");
        let cmd = board_attach(&flags, "arduino:avr:uno", sketch);

        let tail = tail_after(&cmd, "board");
        assert_eq!(
            tail,
            &[
                "attach",
                "-b",
                "arduino:avr:uno",
                &sketch.display().to_string()
            ]
        );
    }

    #[test]
    fn core_install_and_uninstall_take_package_id() {
        let flags = GlobalFlags::isolated(&test_dirs());
        assert_eq!(
            tail_after(&core_install(&flags, "arduino:avr"), "core"),
            &["install", "arduino:avr"]
        );
        assert_eq!(
            tail_after(&core_uninstall(&flags, "arduino:avr"), "core"),
            &["uninstall", "arduino:avr"]
        );
    }

    #[test]
    fn lib_install_accepts_full_spec() {
        let flags = GlobalFlags::isolated(&test_dirs());
        let cmd = lib_install(&flags, "Adafruit NeoPixel@1.12.0");
        assert_eq!(tail_after(&cmd, "lib"), &["install", "Adafruit NeoPixel@1.12.0"]);
    }

    #[test]
    fn compile_teaching_defaults_include_export_and_warnings() {
        let flags = GlobalFlags::isolated(&test_dirs()).with_json();
        let sketch = Path::new("/sk/proj");
        let cmd = compile(
            &flags,
            sketch,
            "arduino:avr:uno",
            Path::new("/build/proj"),
            &CompileOptions::teaching_default(),
        );

        assert_eq!(cmd.subcommand, "compile");
        let tail = tail_after(&cmd, "compile");
        assert!(tail.contains(&"--export-binaries".to_string()));
        assert!(tail.contains(&"--warnings".to_string()));
        assert!(tail.contains(&"all".to_string()));
        assert!(!tail.contains(&"--clean".to_string()));
        assert!(!tail.contains(&"-j".to_string()));
        // 草稿路徑必須是最後一個位置參數。
        assert_eq!(tail.last().unwrap(), &sketch.display().to_string());
    }

    #[test]
    fn compile_optional_flags_appear_only_when_enabled() {
        let flags = GlobalFlags::isolated(&test_dirs()).with_json();
        let options = CompileOptions {
            clean: true,
            jobs: Some(4),
            libraries: vec![PathBuf::from("/libs/Adafruit_NeoPixel")],
            ..CompileOptions::teaching_default()
        };
        let cmd = compile(
            &flags,
            Path::new("/sk/proj"),
            "arduino:avr:uno",
            Path::new("/build/proj"),
            &options,
        );

        let tail = tail_after(&cmd, "compile");
        assert!(tail.contains(&"--clean".to_string()));
        assert!(tail.contains(&"-j".to_string()));
        assert!(tail.contains(&"4".to_string()));
        assert!(tail.contains(&"--library".to_string()));
        assert!(tail.contains(&"/libs/Adafruit_NeoPixel".to_string()));
    }

    #[test]
    fn upload_passes_port_and_input_dir() {
        let flags = GlobalFlags::isolated(&test_dirs()).with_json();
        let sketch = Path::new("/sk/proj");
        let cmd = upload(
            &flags,
            sketch,
            "arduino:avr:uno",
            "COM3",
            Path::new("/build/proj"),
        );

        let tail = tail_after(&cmd, "upload");
        assert!(tail.contains(&"-p".to_string()));
        assert!(tail.contains(&"COM3".to_string()));
        assert!(tail.contains(&"--input-dir".to_string()));
        assert_eq!(tail.last().unwrap(), &sketch.display().to_string());
    }

    #[test]
    fn monitor_uses_config_baudrate_pair() {
        let flags = GlobalFlags::isolated(&test_dirs());
        let cmd = monitor(&flags, "COM5", 115200);
        assert_eq!(
            tail_after(&cmd, "monitor"),
            &["-p", "COM5", "--config", "baudrate=115200"]
        );
    }

    #[test]
    fn config_init_targets_dest_dir() {
        let flags = GlobalFlags::isolated(&test_dirs());
        let cmd = config_init(&flags, Path::new("/appdata/arduino"));
        assert_eq!(cmd.subcommand, "config init");
        assert!(cmd.args.contains(&"--dest-dir".to_string()));
        assert!(cmd
            .args
            .contains(&ToolchainDirs::under(Path::new("/appdata")).config_dir.display().to_string()));
    }

    #[test]
    fn no_flag_ever_references_global_arduino_data() {
        let flags = GlobalFlags::isolated(&test_dirs()).with_json();
        let commands = vec![
            board_list(&flags),
            board_list_all(&flags),
            core_list(&flags),
            lib_list(&flags),
            compile(
                &flags,
                Path::new("/sk"),
                "arduino:avr:uno",
                Path::new("/b"),
                &CompileOptions::teaching_default(),
            ),
        ];

        for cmd in commands {
            for arg in &cmd.args {
                assert!(
                    !arg.to_lowercase().contains("arduino15"),
                    "flag leaked global arduino data dir: {}",
                    arg
                );
            }
        }
    }
}
