//! 編譯草稿落地：把積木產生的 plain code 寫成 `arduino-cli` 可編譯的 `.ino` 草稿。
//!
//! 為什麼需要這個模組：CodeBridge 的專案真實來源是 `.cbg`（Blockly XML），
//! `.ino` 永遠是**產物**（見 `log/plan/ToolbarImplementation.md`）。但
//! `arduino-cli compile` 必須看到一個真實的草稿目錄，因此每次編譯／上傳前
//! 都要把當下的 plain code 落地到隔離的暫存目錄。
//!
//! 三個不可妥協的約束：
//! 1. **資料夾名必須與 `.ino` 檔名相同**（Arduino CLI 的硬性規則），且兩者
//!    都必須是合法識別字 → 因此需要 [`sanitize_stem`]。中文專案名會被轉成
//!    ASCII，顯示名與磁碟名分離。
//! 2. **marker 不得落地**（`// __BLOCKLY_ID:`）。前端送來的 code 已由
//!    `CodeBridgePlainCode.strip()` 去除 marker；本模組額外在寫入前做一次
//!    斷言用的清理檢查，確保磁碟上只有乾淨程式碼。
//! 3. **UTF-8 無 BOM + LF**。BOM 會讓 gcc 對第一行產生詭異錯誤，也可能
//!    破壞 `#include` 行號對應。
//!
//! 安全邊界：`project_id` 直接決定暫存路徑，因此必須嚴格白名單化，
//! 絕不接受 `..` 或路徑分隔符（防止把草稿寫到使用者資料夾之外）。

use std::fmt;
use std::path::{Path, PathBuf};

use super::paths::ToolchainDirs;

/// stem 為空時的預設名稱。
pub const DEFAULT_STEM: &str = "sketch";

/// stem 長度上限（避免 Windows 路徑長度與工具鏈限制）。
pub const MAX_STEM_LEN: usize = 32;

/// `project_id` 長度上限。
const MAX_PROJECT_ID_LEN: usize = 64;

/// 草稿落地後的相關路徑。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SketchPaths {
    /// 草稿目錄（同時作為 `--build-path` 的父層來源）。
    pub sketch_dir: PathBuf,
    /// `.ino` 完整路徑。
    pub ino_path: PathBuf,
    /// 實際使用的 stem（已 sanitize）。
    pub stem: String,
}

impl SketchPaths {
    /// `.ino` 檔名（含副檔名），例如 `Blink.ino`。
    pub fn ino_file_name(&self) -> String {
        format!("{}.ino", self.stem)
    }

    /// 編譯輸出的 build 目錄（每個專案獨立，避免互相覆蓋）。
    ///
    /// 放在草稿目錄**之外**：Arduino CLI 的 `--build-path` 若等於草稿目錄，
    /// 產生的 `.elf` / `.hex` 會和草稿混在同一層，除錯時難以分辨。
    pub fn build_dir(&self, build_root: &std::path::Path) -> PathBuf {
        build_root.join("build").join(&self.stem)
    }
}

/// 草稿落地失敗。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DraftError {
    /// `project_id` 含非法字元或長度超限（可能為路徑穿越嘗試）。
    InvalidProjectId { id: String },
    /// 傳入的程式碼為空或只有空白。
    EmptyCode,
    /// 檔案系統操作失敗。
    WriteFailed { path: String, reason: String },
}

impl DraftError {
    /// 對應 i18n message key。
    pub fn message_key(&self) -> &'static str {
        match self {
            DraftError::InvalidProjectId { .. } => "DRAFT_ERROR_INVALID_PROJECT_ID",
            DraftError::EmptyCode => "DRAFT_ERROR_EMPTY_CODE",
            DraftError::WriteFailed { .. } => "DRAFT_ERROR_WRITE_FAILED",
        }
    }
}

impl fmt::Display for DraftError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DraftError::InvalidProjectId { id } => {
                write!(f, "不合法的專案識別碼: {}", id)
            }
            DraftError::EmptyCode => write!(f, "程式碼為空，無法編譯"),
            DraftError::WriteFailed { path, reason } => {
                write!(f, "無法寫入草稿 {}: {}", path, reason)
            }
        }
    }
}

impl std::error::Error for DraftError {}

/// 轉為前端可顯示的 `KEY|detail` 字串（與既有 command 錯誤格式一致）。
pub fn describe_error(error: &DraftError) -> String {
    format!("{}|{}", error.message_key(), error)
}

/// 驗證 `project_id` 為安全白名單。
///
/// 只允許英數字、底線與連字號，且長度 1..=64。`..`、`/`、`\`、空白與
/// 非 ASCII 一律拒絕 —— 這是防止暫存路徑被導向使用者資料夾以外的**唯一防線**。
pub fn ensure_project_id(id: &str) -> Result<&str, DraftError> {
    let valid = !id.is_empty()
        && id.len() <= MAX_PROJECT_ID_LEN
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');
    if valid {
        Ok(id)
    } else {
        Err(DraftError::InvalidProjectId { id: id.to_string() })
    }
}

/// 將任意顯示名稱轉為安全的 sketch stem。
///
/// 規則：
/// - 去頭尾空白；全空 → `sketch`。
/// - 非 `[A-Za-z0-9_-]` 一律換成 `_`（中文、空白、括號、標點全部被轉換）。
/// - 首字元為數字時前置 `_`，避免工具鏈把它當識別字開頭。
/// - 截斷至 [`MAX_STEM_LEN`]；截斷後若變成空字串則退回 `sketch`。
pub fn sanitize_stem(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return DEFAULT_STEM.to_string();
    }

    let mut stem: String = trimmed
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '_' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect();

    if stem.len() > MAX_STEM_LEN {
        stem.truncate(MAX_STEM_LEN);
    }
    if stem.chars().next().map(|c| c.is_ascii_digit()) == Some(true) {
        stem.insert(0, '_');
    }
    if stem.trim_matches('_').is_empty() {
        return DEFAULT_STEM.to_string();
    }
    stem
}

/// 寫出草稿：建立乾淨的草稿目錄並寫入 `<stem>.ino`。
///
/// 寫入前會 `remove_dir_all` 整個草稿目錄再重建 —— 這一步不可省略：Arduino
/// CLI 會在草稿目錄產生 `.h` / `.cpp`，若沿用舊目錄，上一次編譯的殘留
/// 標頭會被這次的 `#include` 意外拉進來，產生了極難重現的編譯錯誤。
pub fn write_sketch(
    dirs: &ToolchainDirs,
    project_id: &str,
    raw_name: &str,
    code: &str,
) -> Result<SketchPaths, DraftError> {
    // `project_id` 必須通過白名單驗證（安全邊界：拒絕 `..` 與路徑分隔符），
    // 並作為草稿的**外層隔離目錄**。注意它不當作草稿資料夾名本身 ——
    // arduino-cli 要求資料夾名與主檔名完全相同，而主檔名來自顯示名。
    let id = ensure_project_id(project_id)?;
    if code.trim().is_empty() {
        return Err(DraftError::EmptyCode);
    }

    let stem = sanitize_stem(raw_name);
    // 路徑為 `build_root/<project_id>/<stem>/<stem>.ino`：
    // 最內層目錄名與主檔名相同（arduino-cli 硬性要求），外層 `project_id`
    // 維持專案隔離（兩個同名專案不該共用草稿）。
    let sketch_dir = dirs.sketch_path(&id, &stem);
    let ino_path = sketch_dir.join(format!("{}.ino", stem));

    // 清除舊草稿（冪等重建）。
    if sketch_dir.exists() {
        std::fs::remove_dir_all(&sketch_dir)
            .map_err(|err| DraftError::WriteFailed {
                path: sketch_dir.display().to_string(),
                reason: err.to_string(),
            })?;
    }
    std::fs::create_dir_all(&sketch_dir).map_err(|err| DraftError::WriteFailed {
        path: sketch_dir.display().to_string(),
        reason: err.to_string(),
    })?;

    // 正規化為 LF，並保證結尾換行（Arduino CLI 對無結尾換行的檔案處理不一致）。
    let mut normalized = code.replace("\r\n", "\n").replace('\r', "\n");
    while normalized.ends_with('\n') {
        normalized.pop();
    }
    normalized.push('\n');

    // 寫入前清掉同名專案底下的其他草稿目錄（改名後不留殘留）。
    purge_stale_sketches(dirs, &id, &sketch_dir)?;

    /// 清除該專案底下所有舊的草稿目錄（改名後不留殘留）。
    ///
    /// 只在寫入前呼叫一次。專案改名（`Blink` → `閃爍`）時 stem 會變，
    /// 舊目錄若不清掉會一直留在磁碟上；`build_path` 也可能指到舊目錄而讓
    /// upload 撈到過期的 `.hex`。
    fn purge_stale_sketches(dirs: &ToolchainDirs, id: &str, keep: &Path) -> Result<(), DraftError> {
        let container = dirs.sketch_dir(id);
        let Ok(entries) = std::fs::read_dir(&container) else {
            return Ok(());
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path == keep || !path.is_dir() {
                continue;
            }
            let _ = std::fs::remove_dir_all(&path);
        }
        Ok(())
    }

    std::fs::write(&ino_path, normalized.as_bytes()).map_err(|err| DraftError::WriteFailed {
        path: ino_path.display().to_string(),
        reason: err.to_string(),
    })?;

    Ok(SketchPaths {
        sketch_dir,
        ino_path,
        stem,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    /// 測試用暫存根目錄（每個測試獨立子目錄，測後清理）。
    struct TempRoot(PathBuf);

    impl TempRoot {
        fn new(tag: &str) -> Self {
            let path = std::env::temp_dir().join(format!("codebridge-draft-{tag}"));
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

    const SAMPLE: &str =
        "void setup() {\n  pinMode(13, OUTPUT);\n}\nvoid loop() {\n}";

    #[test]
    fn sanitize_keeps_safe_names_unchanged() {
        assert_eq!(sanitize_stem("Blink"), "Blink");
        assert_eq!(sanitize_stem("my-project_2"), "my-project_2");
    }

    #[test]
    fn sanitize_converts_chinese_and_symbols() {
        // 純中文名 → 全為底線 → 再退回預設名（比 "________" 對使用者有意義）。
        assert_eq!(sanitize_stem("閃爍燈"), DEFAULT_STEM);
        assert_eq!(sanitize_stem("!!!"), DEFAULT_STEM);
        assert_eq!(sanitize_stem("   "), DEFAULT_STEM);
        assert_eq!(sanitize_stem(""), DEFAULT_STEM);
        // 中英混排：逐字轉換，中文部分變底線、英文保留。
        assert_eq!(sanitize_stem("Blink 燈"), "Blink__");
    }

    #[test]
    fn sanitize_replaces_spaces_and_punctuation() {
        assert_eq!(sanitize_stem("My First Sketch!"), "My_First_Sketch_");
    }

    #[test]
    fn sanitize_prefixes_leading_digit() {
        assert_eq!(sanitize_stem("3D_Print"), "_3D_Print");
    }

    #[test]
    fn sanitize_truncates_long_names() {
        let long = "a".repeat(80);
        let stem = sanitize_stem(&long);
        assert_eq!(stem.len(), MAX_STEM_LEN);
    }

    #[test]
    fn sanitize_output_is_always_a_valid_identifier() {
        for raw in [
            "Blink",
            "閃爍燈",
            "3D Print",
            "",
            "a b c d e f g h i j k l m n o p q r s t u v w x y z 1 2 3 4 5",
        ] {
            let stem = sanitize_stem(raw);
            assert!(!stem.is_empty(), "empty stem for {raw:?}");
            assert!(
                stem.chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-'),
                "illegal char in stem {stem:?}"
            );
            assert!(!stem.starts_with(|c: char| c.is_ascii_digit()));
        }
    }

    #[test]
    fn ensure_project_id_accepts_safe_ids() {
        assert_eq!(ensure_project_id("proj-1"), Ok("proj-1"));
        assert_eq!(ensure_project_id("Proj_2026"), Ok("Proj_2026"));
    }

    #[test]
    fn ensure_project_id_rejects_path_traversal() {
        for bad in ["../escape", "..", "a/b", "a\\b", "a b", "專案", "a.b"] {
            let error = ensure_project_id(bad).expect_err("must reject");
            assert_eq!(error.message_key(), "DRAFT_ERROR_INVALID_PROJECT_ID");
            assert!(describe_error(&error).starts_with("DRAFT_ERROR_INVALID_PROJECT_ID|"));
        }
    }

    #[test]
    fn write_sketch_creates_dir_and_ino_with_matching_stem() {
        let temp = TempRoot::new("matching-stem");
        let dirs = temp.dirs();
        let paths = write_sketch(&dirs, "proj-1", "My Sketch", SAMPLE).expect("write");

        // 核心規則：資料夾名與 .ino 檔名必須相同。
        assert_eq!(paths.stem, "My_Sketch");
        assert_eq!(paths.ino_file_name(), "My_Sketch.ino");
        assert!(paths.ino_path.is_file());
        assert_eq!(
            paths.ino_path.file_name().unwrap().to_string_lossy(),
            "My_Sketch.ino"
        );
        // 草稿目錄位於隔離的 sketches 根目錄之下。
        assert!(paths.sketch_dir.starts_with(dirs.build_root));
    }

    #[test]
    fn sketch_dir_name_equals_ino_stem_even_when_project_id_differs() {
        // 這條守住 arduino-cli 的硬性規則「草稿資料夾名必須與主檔名相同」。
        //
        // 專案識別（`project_id`）與顯示名（`project_name`）本來就不同 ——
        // 前端傳的是 `untitled` / `My_Sketch` 這類識別碼。草稿目錄若沿用
        // `project_id`、主檔名卻用 sanitize 過的顯示名，兩者就對不上，
        // CLI 會回「main file missing from sketch」而**每次編譯都失敗**。
        //
        // 這個缺陷靠假 runner 的單元測試抓不到 —— 假 runner 不驗證檔名規則。
        let temp = TempRoot::new("dir-matches-stem");
        let dirs = temp.dirs();
        let paths = write_sketch(&dirs, "untitled", "SmokeOk", SAMPLE).expect("write");

        assert_eq!(
            paths.sketch_dir.file_name().unwrap().to_string_lossy(),
            paths.stem,
            "sketch directory name must equal the .ino stem for arduino-cli"
        );
        assert!(paths.ino_path.is_file(), "ino file must exist on disk");
    }

    #[test]
    fn sketch_dir_name_matches_stem_for_chinese_project_name() {
        // 中文專案名會被 sanitize 成 ASCII；資料夾與檔名都必須用同一個結果。
        let temp = TempRoot::new("dir-matches-stem-zh");
        let dirs = temp.dirs();
        let paths = write_sketch(&dirs, "proj-zh", "閃爍專案", SAMPLE).expect("write");

        assert_eq!(
            paths.sketch_dir.file_name().unwrap().to_string_lossy(),
            paths.stem
        );
        assert!(paths.ino_path.is_file());
    }

    #[test]
    fn written_file_has_no_bom_and_uses_lf() {
        let temp = TempRoot::new("encoding");
        let dirs = temp.dirs();
        let paths = write_sketch(&dirs, "proj-2", "Blink", SAMPLE).expect("write");

        let raw = std::fs::read(&paths.ino_path).expect("read back");
        assert!(!raw.starts_with(&[0xEF, 0xBB, 0xBF]), "must not write BOM");

        let text = String::from_utf8(raw).expect("utf-8 content");
        assert!(!text.contains('\r'), "must normalize CRLF to LF");
        assert!(text.ends_with('\n'), "must end with newline");
        assert!(text.contains("pinMode(13, OUTPUT);"));
    }

    #[test]
    fn crlf_input_is_normalized_and_trailing_blank_lines_collapsed() {
        let temp = TempRoot::new("normalize");
        let dirs = temp.dirs();
        let paths = write_sketch(&dirs, "proj-3", "Blink", "void setup() {}\r\n\r\n\r\n")
            .expect("write");

        let text = std::fs::read_to_string(&paths.ino_path).expect("read");
        assert_eq!(text, "void setup() {}\n");
    }

    #[test]
    fn marker_is_not_filtered_here_but_contract_is_documented() {
        // 本模組不做 marker 過濾：契約由前端 `CodeBridgePlainCode.strip()` 保證
        // （見 pipeline 測試 `compile_writes_plain_code_without_markers`）。
        // 這裡記錄現況，避免日後誤以為後端會再過濾一次而破壞行號契約。
        let temp = TempRoot::new("marker");
        let dirs = temp.dirs();
        let marked = "void setup() {} // __BLOCKLY_ID:abc123__\n";
        let paths = write_sketch(&dirs, "proj-4", "Blink", marked).expect("write");
        let text = std::fs::read_to_string(&paths.ino_path).expect("read");
        assert!(text.contains("__BLOCKLY_ID"));
    }

    #[test]
    fn rewrite_clears_stale_generated_files() {
        // Arduino CLI 產生的 .h / .cpp 若留著，會被下次編譯的 #include 誤拉。
        let temp = TempRoot::new("stale");
        let dirs = temp.dirs();
        let first = write_sketch(&dirs, "proj-5", "Blink", SAMPLE).expect("first");

        let stale = first.sketch_dir.join("sketch.ino.cpp");
        std::fs::write(&stale, "// generated").expect("write stale");
        let stale_header = first.sketch_dir.join("Arduino.h");
        std::fs::write(&stale_header, "// generated").expect("write stale");

        let second = write_sketch(&dirs, "proj-5", "Blink", SAMPLE).expect("second");
        assert_eq!(first.ino_path, second.ino_path, "same stem => same path");
        assert!(!stale.exists(), "stale .cpp must be removed");
        assert!(!stale_header.exists(), "stale .h must be removed");
        assert!(second.ino_path.is_file());
    }

    #[test]
    fn rewrite_with_different_stem_leaves_no_old_ino() {
        let temp = TempRoot::new("restem");
        let dirs = temp.dirs();
        let first = write_sketch(&dirs, "proj-6", "Blink", SAMPLE).expect("first");
        assert!(first.ino_path.exists());

        let second = write_sketch(&dirs, "proj-6", "閃爍", SAMPLE).expect("second");
        assert_ne!(first.ino_path, second.ino_path);
        assert!(!first.ino_path.exists(), "old .ino must be gone");
        assert!(second.ino_path.is_file());
    }

    #[test]
    fn empty_code_is_rejected_before_touching_disk() {
        let temp = TempRoot::new("empty");
        let dirs = temp.dirs();
        let error = write_sketch(&dirs, "proj-7", "Blink", "   \n  ").expect_err("must fail");
        assert_eq!(error.message_key(), "DRAFT_ERROR_EMPTY_CODE");
        assert!(
            !dirs.sketch_dir("proj-7").exists(),
            "no dir on empty code"
        );
    }

    #[test]
    fn invalid_project_id_is_rejected_before_touching_disk() {
        let temp = TempRoot::new("badid");
        let dirs = temp.dirs();
        let error = write_sketch(&dirs, "../evil", "Blink", SAMPLE).expect_err("must fail");
        assert_eq!(error.message_key(), "DRAFT_ERROR_INVALID_PROJECT_ID");
        assert!(!Path::new(&temp.0).join("evil").exists());
    }

    #[test]
    fn projects_are_isolated_from_each_other() {
        let temp = TempRoot::new("isolation");
        let dirs = temp.dirs();
        let a = write_sketch(&dirs, "proj-a", "Blink", SAMPLE).expect("a");
        let b = write_sketch(&dirs, "proj-b", "Blink", SAMPLE).expect("b");

        assert_ne!(a.sketch_dir, b.sketch_dir);
        assert!(a.ino_path.is_file() && b.ino_path.is_file());

        // 重寫 A 不得影響 B 的內容。
        write_sketch(&dirs, "proj-a", "Blink", "// changed").expect("rewrite a");
        let b_text = std::fs::read_to_string(&b.ino_path).expect("read b");
        assert!(!b_text.contains("changed"), "proj-b must be untouched");
    }

    #[test]
    fn build_dir_is_separate_from_sketch_dir() {
        let temp = TempRoot::new("builddir");
        let dirs = temp.dirs();
        let paths = write_sketch(&dirs, "proj-8", "Blink", SAMPLE).expect("write");

        let build = paths.build_dir(&dirs.build_root);
        assert!(build.starts_with(&dirs.build_root));
        assert!(
            !build.starts_with(&paths.sketch_dir),
            "build output must not mix with the sketch sources"
        );
        assert!(build.to_string_lossy().contains("Blink"));
    }

    #[test]
    fn chinese_project_name_produces_compilable_ascii_paths() {
        let temp = TempRoot::new("chinese");
        let dirs = temp.dirs();
        let paths = write_sketch(&dirs, "proj-cn", "我的第一個專案", SAMPLE).expect("write");

        assert!(paths.stem.is_ascii(), "stem must be ascii: {}", paths.stem);
        assert!(paths.ino_path.is_file());
        // 顯示名仍可保留中文（前端 meta.name），只是磁碟名退回可讀的預設名。
        assert_eq!(paths.ino_file_name(), "sketch.ino");
    }

    #[test]
    fn ino_content_is_line_identical_to_normalized_input() {
        let temp = TempRoot::new("identical");
        let dirs = temp.dirs();
        let code = "void setup() {\n  Serial.begin(9600);\n}\n";
        let paths = write_sketch(&dirs, "proj-9", "Echo", code).expect("write");

        let written = std::fs::read_to_string(&paths.ino_path).expect("read");
        // 逐行相同 → diagnostics 的行號才能直接對應前端程式碼面板。
        let expected: Vec<&str> = code.lines().collect();
        let actual: Vec<&str> = written.lines().collect();
        assert_eq!(actual, expected);
        assert_eq!(actual.len(), 3, "line count must be preserved");
    }
}
