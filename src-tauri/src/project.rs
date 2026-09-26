//! CodeBridge `.cbg` 專案檔 I/O。
//!
//! 專案檔是 Blockly 工作區的單一 XML 檔：根元素帶 `cbp:` metadata，
//! 內含積木 XML。`.ino` 永遠由積木產生，不落地到磁碟。
//!
//! 安全邊界：
//! - 只接受 `.cbg` 副檔名，避免誤覆寫 `.ino`／`.sketch` 等使用者既有檔案。
//! - 一律寫入 UTF-8（無 BOM）與 LF 行尾；讀取時容忍 BOM（使用者可能用記事本存過）。
//! - 錯誤以 `KEY|detail` 回傳，前端以 KEY 查 i18n。

use std::path::Path;

/// 專案副檔名；與前端 `CodeBridgeProject.EXT` 保持一致。
pub const PROJECT_EXTENSION: &str = "cbg";

/// 驗證副檔名；非 `.cbg` 一律拒絕。
pub fn ensure_extension(path: &Path) -> Result<(), String> {
    let is_cbg = path
        .extension()
        .map(|value| value.eq_ignore_ascii_case(PROJECT_EXTENSION))
        .unwrap_or(false);
    if is_cbg {
        Ok(())
    } else {
        Err(format!(
            "PROJECT_ERROR_INVALID_EXTENSION|{}",
            path.display()
        ))
    }
}

/// 讀取專案檔內容。
#[tauri::command]
pub fn project_read(path: String) -> Result<String, String> {
    let target = Path::new(&path);
    ensure_extension(target)?;

    if !target.is_file() {
        return Err(format!("PROJECT_ERROR_NOT_FOUND|{}", target.display()));
    }

    let raw = std::fs::read(target).map_err(|error| {
        format!("PROJECT_ERROR_READ_FAILED|{}: {}", target.display(), error)
    })?;

    // 容忍 UTF-8 BOM，避免使用者用記事本編輯後無法開啟。
    let text = String::from_utf8(raw)
        .map_err(|error| format!("PROJECT_ERROR_READ_FAILED|{}: {}", target.display(), error))?;
    Ok(text.strip_prefix('\u{feff}').unwrap_or(&text).to_string())
}

/// 寫入專案檔內容（UTF-8 無 BOM、LF 行尾）。
#[tauri::command]
pub fn project_save(path: String, contents: String) -> Result<(), String> {
    let target = Path::new(&path);
    ensure_extension(target)?;

    if let Some(parent) = target.parent() {
        if !parent.as_os_str().is_empty() && !parent.is_dir() {
            return Err(format!(
                "PROJECT_ERROR_WRITE_FAILED|{}",
                parent.display()
            ));
        }
    }

    let normalized = contents.replace("\r\n", "\n").replace('\r', "\n");
    std::fs::write(target, normalized.as_bytes())
        .map_err(|error| format!("PROJECT_ERROR_WRITE_FAILED|{}: {}", target.display(), error))
}

/// 檢查專案檔是否存在（用於過濾失效的最近專案清單）。
#[tauri::command]
pub fn project_exists(path: String) -> Result<bool, String> {
    let target = Path::new(&path);
    if ensure_extension(target).is_err() {
        return Ok(false);
    }
    Ok(target.is_file())
}

/// 產生「在檔案總管中顯示此路徑」的外部指令。
///
/// 抽出成純函式以便單元測試；實際開啟由 `std::process::Command` 執行，
/// 不經過 tauri-plugin-shell，因此不需要額外權限宣告。
pub fn reveal_command(path: &Path) -> (String, Vec<String>) {
    let full = path.to_string_lossy().to_string();
    let is_file = path.is_file();
    let parent = path
        .parent()
        .map(|dir| dir.to_string_lossy().to_string())
        .unwrap_or_else(|| full.clone());

    if cfg!(target_os = "windows") {
        // 檔案用 /select 選取，資料夾直接開啟
        if is_file {
            return ("explorer".to_string(), vec![format!("/select,{full}")]);
        }
        return ("explorer".to_string(), vec![parent]);
    }

    if cfg!(target_os = "macos") {
        if is_file {
            return ("open".to_string(), vec!["-R".to_string(), full]);
        }
        return ("open".to_string(), vec![parent]);
    }

    ("xdg-open".to_string(), vec![parent])
}

/// 在系統檔案總管中顯示專案檔（或其所在資料夾）。
#[tauri::command]
pub fn project_reveal(path: String) -> Result<(), String> {
    let target = Path::new(&path);
    if !target.exists() {
        return Err(format!("PROJECT_ERROR_NOT_FOUND|{}", target.display()));
    }

    let (program, args) = reveal_command(target);
    std::process::Command::new(&program)
        .args(&args)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("PROJECT_ERROR_REVEAL_FAILED|{}: {}", program, error))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_path(name: &str) -> std::path::PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!("codebridge-test-{}-{}.cbg", std::process::id(), name));
        path
    }

    #[test]
    fn extension_check_accepts_only_cbg() {
        assert!(ensure_extension(Path::new("C:/p/Blink.cbg")).is_ok());
        assert!(ensure_extension(Path::new("C:/p/Blink.CBG")).is_ok());
        let error = ensure_extension(Path::new("C:/p/Blink.ino")).unwrap_err();
        assert!(error.starts_with("PROJECT_ERROR_INVALID_EXTENSION|"));
    }

    #[test]
    fn save_then_read_round_trips_without_bom() {
        let path = temp_path("roundtrip");
        let contents = "<xml>\n  <block type=\"initializes_setup\"></block>\n</xml>\n";

        project_save(path.to_string_lossy().to_string(), contents.replace('\n', "\r\n"))
            .expect("save should succeed");
        let read_back = project_read(path.to_string_lossy().to_string()).expect("read should succeed");

        assert_eq!(read_back, contents);
        let raw = std::fs::read(&path).expect("raw read");
        assert!(!raw.starts_with(&[0xef, 0xbb, 0xbf]), "must not write BOM");
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn read_reports_missing_file_with_i18n_key() {
        let path = temp_path("missing");
        let _ = std::fs::remove_file(&path);
        let error = project_read(path.to_string_lossy().to_string()).unwrap_err();
        assert!(error.starts_with("PROJECT_ERROR_NOT_FOUND|"));
    }

    #[test]
    fn read_tolerates_utf8_bom() {
        let path = temp_path("bom");
        let mut raw = vec![0xef, 0xbb, 0xbf];
        raw.extend_from_slice(b"<xml></xml>");
        std::fs::write(&path, raw).expect("write");

        let read_back = project_read(path.to_string_lossy().to_string()).expect("read");
        assert_eq!(read_back, "<xml></xml>");
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn exists_rejects_wrong_extension() {
        assert!(!project_exists("C:/p/Blink.ino".to_string()).unwrap());
    }

    #[test]
    fn reveal_command_targets_existing_file_only() {
        let path = temp_path("reveal");
        std::fs::write(&path, "<xml></xml>").expect("write");

        let (program, args) = reveal_command(&path);
        assert!(!program.is_empty());
        assert_eq!(args.len(), 1);
        // 實際檔案必須帶選取語意（Windows /select,、macOS -R）
        if cfg!(target_os = "windows") {
            assert!(args[0].starts_with("/select,"), "got {}", args[0]);
        } else if cfg!(target_os = "macos") {
            assert_eq!(args[0], "-R");
        }
        assert!(args.last().unwrap().contains("reveal.cbg"));

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn reveal_command_falls_back_to_parent_directory() {
        let directory = temp_path("reveal-dir");
        std::fs::create_dir_all(&directory).expect("create");
        let missing = directory.join("not-created.cbg");

        let (_, args) = reveal_command(&missing);
        assert_eq!(args.len(), 1);
        // 檔案不存在 → 開啟父資料夾，不使用選取語意
        if cfg!(target_os = "windows") {
            assert!(!args[0].starts_with("/select,"), "got {}", args[0]);
        }
        assert!(args[0].contains("reveal-dir"));

        let _ = std::fs::remove_dir_all(&directory);
    }

    #[test]
    fn reveal_reports_missing_path_with_i18n_key() {
        let missing = temp_path("reveal-missing").join("nope.cbg");
        let error = project_reveal(missing.to_string_lossy().to_string()).unwrap_err();
        assert!(error.starts_with("PROJECT_ERROR_NOT_FOUND|"));
    }
}
