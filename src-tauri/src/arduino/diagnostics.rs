//! Compiler diagnostics：把 arduino-cli 的 `compiler_err` 轉為可定位的結構化診斷。
//!
//! gcc/clang 輸出格式：
//! ```text
//! /path/to/sketch.ino:7:3: error: expected ';' before '}' token
//! /path/to/sketch.ino(12,5): error: 'led' was not declared in this scope
//! ```
//!
//! 兩種格式都要支援：冒號式（Unix 與 Windows gcc）與括號式（部分工具鏈）。
//! 行號為 1-based，對應 Blockly `plainCode` 的行索引需減 1。

use serde::Serialize;

/// 診斷嚴重度。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DiagnosticSeverity {
    /// 阻擋編譯。
    Error,
    /// 可能造成非預期行為。
    Warning,
    /// 純資訊訊息。
    Note,
}

impl DiagnosticSeverity {
    /// 對應 i18n message key。
    pub fn message_key(&self) -> &'static str {
        match self {
            DiagnosticSeverity::Error => "CLI_DIAGNOSTIC_ERROR",
            DiagnosticSeverity::Warning => "CLI_DIAGNOSTIC_WARNING",
            DiagnosticSeverity::Note => "CLI_DIAGNOSTIC_NOTE",
        }
    }
}

/// 單一條編譯器診斷。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic {
    /// 嚴重度。
    pub severity: DiagnosticSeverity,
    /// 檔案名稱（僅檔名，不含路徑），例如 `sketch.ino`。
    pub file: String,
    /// 行號（1-based）。
    pub line: u32,
    /// 欄號（1-based）；無法解析時為 0。
    pub column: u32,
    /// 訊息本文。
    pub message: String,
}

impl Diagnostic {
    /// 轉為 0-based 行索引，供前端直接對應 `plainCode` 的行陣列。
    pub fn zero_based_line(&self) -> u32 {
        self.line.saturating_sub(1)
    }
}

/// 從 compiler 輸出解析所有可定位的診斷。
///
/// 無法解析位置的行（例如 ``Used platform: arduino:avr``）會被略過，因為無法
/// 提供可點擊的定位資訊；這些行仍會由終端機面板原樣顯示。
pub fn parse_compiler_output(raw: &str) -> Vec<Diagnostic> {
    raw.lines()
        .filter_map(parse_diagnostic_line)
        .collect()
}

/// 解析單行；回傳 `None` 代表此行不是帶位置的診斷。
pub fn parse_diagnostic_line(line: &str) -> Option<Diagnostic> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }

    // 形式一：<path>:<line>:<col>: <severity>: <message>
    if let Some((path, line, col, rest)) = split_colon_style(trimmed) {
        if !path.is_empty() {
            return build_diagnostic(file_name(path), line, col, rest);
        }
    }

    // 形式二：<path>(<line>,<col>): <severity>: <message>
    // 以 rsplit_once 對應同一組分隔符，避免重複剝除右括號。
    if let Some((location, rest)) = trimmed.rsplit_once("): ") {
        if let Some((file, line_no, col_no)) = parse_paren_location(location) {
            return build_diagnostic(file, line_no, col_no, rest);
        }
    }

    None
}

/// 解析 `<path>:<line>:<col>: <rest>` 形式，回傳 (路徑, 行, 欄, 其餘)。
///
/// 逐一檢查每個 `": "` 候選點，判斷其前綴是否以 `:<line>:<col>` 結尾。
/// 檔案路徑不可能含有「冒號＋空格」序列，因此這個候選集合是安全的；這也讓
/// Windows 磁碟機代號（`C:\`，冒號後接反斜線）自然被排除。
fn split_colon_style(input: &str) -> Option<(&str, u32, u32, &str)> {
    let mut from = 0;
    while let Some(offset) = input[from..].find(": ") {
        let sep = from + offset;
        let prefix = &input[..sep];
        let rest = &input[sep + 2..];

        if let Some((path, line, col)) = split_trailing_line_col(prefix) {
            return Some((path, line, col, rest));
        }
        from = sep + 2;
    }
    None
}

/// 若 `prefix` 以 `:<line>:<col>` 結尾，回傳 (去除尾端的位置前綴, line, col)。
fn split_trailing_line_col(prefix: &str) -> Option<(&str, u32, u32)> {
    let (before_col, col_text) = prefix.rsplit_once(':')?;
    let col: u32 = col_text.parse().ok()?;
    let (before_line, line_text) = before_col.rsplit_once(':')?;
    let line: u32 = line_text.parse().ok()?;
    Some((before_line, line, col))
}

/// 解析 `<path>(<line>,<col>` 前綴（右括號已由呼叫端剝除）。
fn parse_paren_location(location: &str) -> Option<(String, u32, u32)> {
    let (file, coords) = location.rsplit_once('(')?;
    let (line, col) = coords.split_once(',')?;
    let line = line.trim().parse().ok()?;
    let col = col.trim().parse().ok()?;
    Some((file_name(file), line, col))
}

/// 取得檔名（去掉路徑分隔符之前的部分）。
///
/// gcc 在 Windows 會輸出 `C:\path\sketch.ino`，Unix 則是 `/path/sketch.ino`，
/// 兩者共用同一套剝除邏輯。
fn file_name(path: &str) -> String {
    let normalized = path.replace('\\', "/");
    normalized
        .rsplit('/')
        .find(|segment| !segment.is_empty())
        .unwrap_or(path)
        .to_string()
}

/// 從 `<severity>: <message>` 組出診斷。
fn build_diagnostic(
    file: String,
    line: u32,
    column: u32,
    rest: &str,
) -> Option<Diagnostic> {
    let (severity_text, message) = rest.split_once(':')?;
    let severity = match severity_text.trim().to_ascii_lowercase().as_str() {
        "error" => DiagnosticSeverity::Error,
        "warning" => DiagnosticSeverity::Warning,
        "note" => DiagnosticSeverity::Note,
        // gcc 偶爾以 `fatal error` 開頭，仍視為 error。
        "fatal error" => DiagnosticSeverity::Error,
        _ => return None,
    };

    Some(Diagnostic {
        severity,
        file,
        line,
        column,
        message: message.trim().to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_unix_colon_style_error() {
        let diag = parse_diagnostic_line("/sk/proj/sketch.ino:7:3: error: expected ';'")
            .expect("should parse");

        assert_eq!(diag.severity, DiagnosticSeverity::Error);
        assert_eq!(diag.file, "sketch.ino");
        assert_eq!(diag.line, 7);
        assert_eq!(diag.column, 3);
        assert_eq!(diag.message, "expected ';'");
    }

    #[test]
    fn parses_windows_path_with_drive_letter() {
        // Windows 路徑含磁碟機冒號，不可把它誤判成 line:col 的分隔。
        let diag = parse_diagnostic_line(
            r"C:\Users\teacher\AppData\sketches\proj\proj.ino:12:5: error: 'led' was not declared in this scope",
        )
        .expect("should parse");

        assert_eq!(diag.file, "proj.ino");
        assert_eq!(diag.line, 12);
        assert_eq!(diag.column, 5);
        assert_eq!(diag.message, "'led' was not declared in this scope");
    }

    #[test]
    fn parses_paren_style_location() {
        let diag = parse_diagnostic_line("/sk/proj/sketch.ino(15,9): error: missing semicolon")
            .expect("should parse");

        assert_eq!(diag.file, "sketch.ino");
        assert_eq!(diag.line, 15);
        assert_eq!(diag.column, 9);
    }

    #[test]
    fn parses_warning_and_note_severities() {
        let warning =
            parse_diagnostic_line("/sk/a.ino:3:1: warning: unused variable 'x'").expect("warning");
        assert_eq!(warning.severity, DiagnosticSeverity::Warning);

        let note = parse_diagnostic_line("/sk/a.ino:4:1: note: declared here").expect("note");
        assert_eq!(note.severity, DiagnosticSeverity::Note);
    }

    #[test]
    fn treats_fatal_error_as_error() {
        let diag =
            parse_diagnostic_line("/sk/a.ino:1:1: fatal error: compilation terminated").expect("err");
        assert_eq!(diag.severity, DiagnosticSeverity::Error);
    }

    #[test]
    fn skips_lines_without_position() {
        assert!(parse_diagnostic_line("Used platform: arduino:avr").is_none());
        assert!(parse_diagnostic_line("Sketch uses 924 bytes").is_none());
        assert!(parse_diagnostic_line("").is_none());
        assert!(parse_diagnostic_line("   ").is_none());
    }

    #[test]
    fn skips_unknown_severity_even_with_position() {
        // 有位置但嚴重度無法識別 → 不建立診斷，避免 UI 顯示無意義的錯誤。
        assert!(parse_diagnostic_line("/sk/a.ino:3:1: info: something").is_none());
    }

    #[test]
    fn parses_multiple_diagnostics_from_real_output() {
        let raw = "\
Sketch uses 924 bytes (2%) of program storage space.
/sk/proj/sketch.ino:7:3: error: expected ';' before '}' token
/sk/proj/sketch.ino:9:1: warning: unused variable 'x'
Used platform: arduino:avr (1.8.6)";

        let diags = parse_compiler_output(raw);
        assert_eq!(diags.len(), 2);
        assert_eq!(diags[0].severity, DiagnosticSeverity::Error);
        assert_eq!(diags[1].severity, DiagnosticSeverity::Warning);
        assert_eq!(diags[0].line, 7);
        assert_eq!(diags[1].line, 9);
    }

    #[test]
    fn zero_based_line_is_saturating() {
        let diag = Diagnostic {
            severity: DiagnosticSeverity::Error,
            file: "a.ino".to_string(),
            line: 1,
            column: 1,
            message: "x".to_string(),
        };
        assert_eq!(diag.zero_based_line(), 0);
    }

    #[test]
    fn message_key_is_stable_for_i18n() {
        assert_eq!(DiagnosticSeverity::Error.message_key(), "CLI_DIAGNOSTIC_ERROR");
        assert_eq!(
            DiagnosticSeverity::Warning.message_key(),
            "CLI_DIAGNOSTIC_WARNING"
        );
    }

    #[test]
    fn handles_paths_with_spaces() {
        let diag = parse_diagnostic_line(
            "/Users/a b/My Sketches/Blink 2/blink 2.ino:6:1: error: oops",
        )
        .expect("should parse");
        assert_eq!(diag.file, "blink 2.ino");
        assert_eq!(diag.line, 6);
    }

    #[test]
    fn handles_library_header_diagnostics() {
        // 函式庫內的錯誤不屬於 sketch.ino；仍解析，但檔名不同，前端據此不跳轉。
        let raw = "/data/user/libraries/Servo/Servo.cpp:42:10: error: no member named 'x'";
        let diag = parse_diagnostic_line(raw).expect("should parse");
        assert_eq!(diag.file, "Servo.cpp");
        assert_eq!(diag.line, 42);
    }
}
