//! arduino-cli `--json` 回應解析。
//!
//! 所有解析函式皆為純函式：以 fixture JSON 為輸入，以領域型別為輸出，缺少
//! 欄位時以 `Option`／預設值優雅降級，不因 CLI 小版本差異而 panic。

use serde::{Deserialize, Serialize};

use super::paths::CliError;

/// 解析 JSON 字串為型別，失敗時回傳 [`CliError::InvalidJson`]。
pub fn parse_json<T: for<'de> Deserialize<'de>>(raw: &str) -> Result<T, CliError> {
    serde_json::from_str(raw).map_err(|err| CliError::InvalidJson {
        reason: err.to_string(),
    })
}

/// `version --format json` 回應。
///
/// CLI 實際回傳的字串欄位是 `VersionString`。**格式隨版本而異**（實測）：
/// - 1.2.0：`"1.2.0"`
/// - 較新版本：`"arduino-cli Version: 1.5.0"`
/// 因此解析端不得依賴字面格式，只取非空字串供顯示。部分版本另有 `Date`。
#[derive(Debug, Clone, Deserialize)]
pub struct VersionInfo {
    #[serde(default, rename = "VersionString", alias = "version")]
    pub version_string: String,
    #[serde(default)]
    pub date: String,
}

impl VersionInfo {
    /// 組出顯示用字串。
    pub fn display(&self) -> String {
        if self.version_string.is_empty() {
            "unknown".to_string()
        } else {
            self.version_string.clone()
        }
    }
}

/// CLI 錯誤回應（`--json` 模式下的非零結束）。
#[derive(Debug, Clone, Deserialize)]
struct CliErrorEnvelope {
    #[serde(default)]
    message: String,
}

/// 從 CLI 的 JSON 錯誤輸出萃取訊息；解析失敗時回傳 `None`。
pub fn extract_error_message(raw: &str) -> Option<String> {
    let envelope: CliErrorEnvelope = serde_json::from_str(raw).ok()?;
    if envelope.message.is_empty() {
        None
    } else {
        Some(envelope.message)
    }
}

/// `board list --json` 中的連接埠描述。
///
/// CLI 1.x 的 `port` 是物件（含 `address`、`label`、`protocol`）；部分情境與舊
/// 版本會直接給字串，因此以 untagged enum 同時接受兩種形式。
#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum PortDescriptor {
    /// 物件形式：`{"address": "COM3", "label": "Arduino Uno", ...}`。
    Object {
        #[serde(default)]
        address: String,
        #[serde(default)]
        label: String,
    },
    /// 字串形式：`"COM3"`。
    Plain(String),
}

impl PortDescriptor {
    /// 取得可顯示的埠名稱。
    ///
    /// 物件形式優先使用 `address`（實際裝置路徑），退回 `label`。
    pub fn display(&self) -> String {
        match self {
            PortDescriptor::Object { address, label } if !address.is_empty() => address.clone(),
            PortDescriptor::Object { label, .. } => label.clone(),
            PortDescriptor::Plain(value) => value.clone(),
        }
    }
}

/// `board list --json` 的裝置屬性（VID/PID 等）。
#[derive(Debug, Clone, Default, Deserialize)]
pub struct DeviceProperties {
    #[serde(default)]
    pub vid: Option<String>,
    #[serde(default)]
    pub pid: Option<String>,
}

/// `board list --json` 回應的單一項目。
#[derive(Debug, Clone, Deserialize)]
pub struct DetectedBoard {
    /// 連接埠描述（物件或字串）。
    #[serde(default)]
    pub port: Option<PortDescriptor>,
    /// 板子類型，例如 `serial`。
    #[serde(default, rename = "type")]
    pub board_type: String,
    /// 通訊協定，例如 `serial`。
    #[serde(default)]
    pub protocol: String,
    /// VID/PID 等裝置屬性。
    #[serde(default)]
    pub properties: Option<DeviceProperties>,
    /// 板子名稱（若已安裝對應 core）。
    #[serde(default)]
    pub matching_board: Option<String>,
    /// 對應 FQBN（若已安裝對應 core）。
    #[serde(default)]
    pub fqbn: Option<String>,
}

impl DetectedBoard {
    /// 連接埠名稱，例如 `COM3`。
    pub fn port_name(&self) -> String {
        self.port.as_ref().map(PortDescriptor::display).unwrap_or_default()
    }

    /// 產生工具列下拉選項的顯示文字。
    ///
    /// 已辨識到板名時顯示板名，未辨識時退回 `VID:PID`；兩者皆無時只顯示埠名，
    /// 不留下多餘空格或虛線。
    pub fn display_label(&self) -> String {
        let name = self.matching_board.as_deref().unwrap_or("").trim();
        let ids = match &self.properties {
            Some(props) => match (props.vid.as_deref(), props.pid.as_deref()) {
                (Some(vid), Some(pid)) => format!(" ({}:{})", vid, pid),
                (Some(vid), None) => format!(" ({})", vid),
                _ => String::new(),
            },
            None => String::new(),
        };

        if name.is_empty() {
            format!("{}{}", self.port_name(), ids)
        } else {
            format!("{} - {}{}", self.port_name(), name, ids)
        }
    }
}

/// `board list --json` 回應。
#[derive(Debug, Clone, Deserialize)]
pub struct DetectedBoards {
    #[serde(default)]
    pub boards: Vec<DetectedBoard>,
}

/// `board listall --json` 回應的單一項目。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoardSummary {
    /// 顯示名稱，例如 `Arduino Uno`。
    #[serde(default)]
    pub name: String,
    /// 完整 FQBN，例如 `arduino:avr:uno`。
    #[serde(default)]
    pub fqbn: String,
}

/// `board listall --json` 回應。
#[derive(Debug, Clone, Deserialize)]
pub struct BoardSummaries {
    #[serde(default)]
    pub boards: Vec<BoardSummary>,
}

impl BoardSummaries {
    /// 依顯示名稱或 FQBN 做不分大小寫的子字串過濾。
    ///
    /// 空字串視為不過濾，讓 Board Manager 開啟時顯示全部項目。
    pub fn filter(&self, term: &str) -> Vec<&BoardSummary> {
        let needle = term.trim().to_lowercase();
        if needle.is_empty() {
            return self.boards.iter().collect();
        }
        self.boards
            .iter()
            .filter(|board| {
                board.name.to_lowercase().contains(&needle)
                    || board.fqbn.to_lowercase().contains(&needle)
            })
            .collect()
    }
}

/// `board details -b <fqbn> --json` 回應的單一項目。
#[derive(Debug, Clone, Default, Deserialize)]
pub struct BoardDetail {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub fqbn: String,
    #[serde(default)]
    pub matching_core: Option<String>,
    #[serde(default)]
    pub tools_dependencies: Vec<BoardTool>,
    /// 預設 upload protocol。
    #[serde(default)]
    pub default_protocol: String,
    /// 預設序列傳輸速率（baud rate）。
    #[serde(default)]
    pub default_baud_rate: String,
}

/// 開發板所需的工具鏈（已安裝或缺少）。
#[derive(Debug, Clone, Deserialize)]
pub struct BoardTool {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub version: Option<String>,
}

impl BoardDetail {
    /// 尚未安裝的工具名稱清單；空集合代表此板可直接編譯。
    pub fn missing_tools(&self) -> Vec<String> {
        self.tools_dependencies
            .iter()
            .filter(|tool| tool.version.is_none())
            .map(|tool| tool.name.clone())
            .collect()
    }
}

/// `board details --json` 回應容器。
#[derive(Debug, Clone, Deserialize)]
pub struct BoardDetailResponse {
    #[serde(default)]
    pub board: Option<BoardDetail>,
}

/// `core list --json` 回應的單一項目。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformSummary {
    /// 平台識別碼，例如 `arduino:avr`。
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub installed_version: String,
    /// 是否有更新可安裝。
    #[serde(default)]
    pub latest_version: String,
    /// 已安裝的板子清單。
    #[serde(default)]
    pub installed_boards: Vec<String>,
}

impl PlatformSummary {
    /// 是否有可升級版本。
    pub fn has_upgrade(&self) -> bool {
        !self.latest_version.is_empty() && self.latest_version != self.installed_version
    }
}

/// `core list --json` 回應容器。
#[derive(Debug, Clone, Deserialize)]
pub struct PlatformsResponse {
    #[serde(default)]
    pub platforms: Vec<PlatformSummary>,
}

/// `lib search` / `lib list --json` 回應的單一項目。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibrarySummary {
    /// 函式庫名稱。
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub author: String,
    /// 最新可用版本；`lib list` 已安裝時為已安裝版本。
    #[serde(default)]
    pub version: String,
    /// 簡要說明。
    #[serde(default, rename = "sentence")]
    pub sentence: String,
    /// 官方函式庫旗標。
    #[serde(default)]
    pub official: bool,
    /// 已安裝旗標（`lib list` 回應）。
    #[serde(default)]
    pub installed: bool,
}

impl LibrarySummary {
    /// 產生 Board/Library Manager 清單的顯示文字。
    pub fn display_label(&self) -> String {
        if self.author.is_empty() {
            self.name.clone()
        } else {
            format!("{} ({})", self.name, self.author)
        }
    }
}

/// `lib search` / `lib list --json` 回應容器。
///
/// 三種 CLI 情境的鍵名不同，統一在此吸收：
/// - `lib list` → `installed_libraries` / `available_libraries`
/// - `lib search` → `libraries`
#[derive(Debug, Clone, Deserialize)]
pub struct LibrariesResponse {
    #[serde(default, rename = "installed_libraries")]
    pub installed: Vec<LibrarySummary>,
    #[serde(default, rename = "available_libraries")]
    pub available: Vec<LibrarySummary>,
    /// `lib search` 使用此欄位。
    #[serde(default)]
    pub libraries: Vec<LibrarySummary>,
}

impl LibrariesResponse {
    /// 合併所有來源，讓 UI 以單一列表呈現。
    pub fn all(&self) -> Vec<&LibrarySummary> {
        self.installed
            .iter()
            .chain(self.available.iter())
            .chain(self.libraries.iter())
            .collect()
    }
}

/// `compile --json` 成功回應。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SketchProgram {
    /// 產生錯誤的布林旗標。
    #[serde(default)]
    pub success: bool,
    /// 原始編譯輸出。
    #[serde(default)]
    pub compiler_out: String,
    /// 錯誤輸出（供 diagnostics 解析行號）。
    #[serde(default)]
    pub compiler_err: String,
    /// 已匯出的 .hex / .bin 路徑。
    #[serde(default)]
    pub builder_result: SketchBuilderResult,
}

/// `compile --json` 的建置結果。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SketchBuilderResult {
    #[serde(default)]
    pub build_path: String,
    #[serde(default)]
    pub executable_sections_filename: String,
    #[serde(default)]
    pub used_libraries: Vec<UsedLibrary>,
}

/// 編譯實際使用的函式庫（供 project metadata 保存依賴）。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsedLibrary {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub location: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_parses_and_formats_display() {
        // CLI 的真實欄位是 VersionString，而非 version。
        let info: VersionInfo = parse_json(
            r#"{"VersionString":"arduino-cli Version: 1.5.0","Date":"2026-01-01"}"#,
        )
        .expect("version");
        assert_eq!(info.version_string, "arduino-cli Version: 1.5.0");
        assert_eq!(info.display(), "arduino-cli Version: 1.5.0");
    }

    #[test]
    fn version_without_version_field_degrades_gracefully() {
        let info: VersionInfo = parse_json("{}").expect("version");
        assert_eq!(info.display(), "unknown");
    }

    #[test]
    fn extract_error_message_reads_cli_envelope() {
        let message = extract_error_message(
            r#"{"errorCode":5,"message":"compile error: sketch.ino:7:3: error: expected ';'"}"#,
        );
        assert_eq!(message.as_deref(), Some("compile error: sketch.ino:7:3: error: expected ';'"));
    }

    #[test]
    fn extract_error_message_returns_none_for_non_json() {
        assert_eq!(extract_error_message("panic: something broke"), None);
    }

    #[test]
    fn invalid_json_maps_to_cli_error() {
        let err = parse_json::<VersionInfo>("not json").expect_err("must fail");
        assert_eq!(err.message_key(), "CLI_ERROR_INVALID_JSON");
    }

    #[test]
    fn board_list_parses_object_port_form() {
        // CLI 1.x 的實際回應：port 為物件，vid/pid 位於 properties 內。
        let boards: DetectedBoards = parse_json(
            r#"{"boards":[
                {"port":{"address":"/dev/ttyACM0","label":"/dev/ttyACM0","protocol":"serial","protocolLabel":"Serial Port (USB)"},"type":"serial","protocol":"serial","properties":{"pid":"0043","vid":"2341"},"matching_board":"Arduino Uno","fqbn":"arduino:avr:uno"}
            ]}"#,
        )
        .expect("boards");

        assert_eq!(boards.boards.len(), 1);
        let board = &boards.boards[0];
        assert_eq!(board.port_name(), "/dev/ttyACM0");
        assert_eq!(board.fqbn.as_deref(), Some("arduino:avr:uno"));
        assert_eq!(board.display_label(), "/dev/ttyACM0 - Arduino Uno (2341:0043)");
    }

    #[test]
    fn board_list_parses_string_port_form() {
        let boards: DetectedBoards =
            parse_json(r#"{"boards":[{"port":"COM3","protocol":"serial"}]}"#).expect("boards");
        assert_eq!(boards.boards[0].port_name(), "COM3");
    }

    #[test]
    fn port_object_falls_back_to_label_when_address_empty() {
        let boards: DetectedBoards =
            parse_json(r#"{"boards":[{"port":{"label":"BT Serial","protocol":"serial"}}]}"#)
                .expect("boards");
        assert_eq!(boards.boards[0].port_name(), "BT Serial");
    }

    #[test]
    fn detected_board_label_falls_back_to_vid_when_name_missing() {
        let boards: DetectedBoards = parse_json(
            r#"{"boards":[{"port":{"address":"COM7"},"protocol":"serial","properties":{"vid":"1A86"}}]}"#,
        )
        .expect("boards");
        assert_eq!(boards.boards[0].display_label(), "COM7 (1A86)");
    }

    #[test]
    fn detected_board_label_with_no_metadata_is_port_only() {
        let boards: DetectedBoards = parse_json(r#"{"boards":[{"port":"COM9"}]}"#).expect("boards");
        assert_eq!(boards.boards[0].display_label(), "COM9");
    }

    #[test]
    fn detected_board_with_missing_port_degrades_gracefully() {
        let boards: DetectedBoards = parse_json(r#"{"boards":[{}]}"#).expect("boards");
        assert_eq!(boards.boards[0].port_name(), "");
    }

    #[test]
    fn board_summaries_filter_by_name_and_fqbn() {
        let boards: BoardSummaries = parse_json(
            r#"{"boards":[{"name":"Arduino Uno","fqbn":"arduino:avr:uno"},{"name":"Arduino Nano","fqbn":"arduino:avr:nano"},{"name":"ESP32 Dev Module","fqbn":"esp32:esp32:esp32"}]}"#,
        )
        .expect("boards");

        assert_eq!(boards.filter("uno").len(), 1);
        assert_eq!(boards.filter("arduino:avr").len(), 2);
        assert_eq!(boards.filter("ESP32").len(), 1);
        assert_eq!(boards.filter("").len(), 3);
    }

    #[test]
    fn board_details_reports_missing_tools() {
        let response: BoardDetailResponse = parse_json(
            r#"{"board":{"name":"Arduino Uno","fqbn":"arduino:avr:uno","matching_core":"arduino:avr","tools_dependencies":[{"name":"avr-gcc"},{"name":"avrdude","version":"7.3.0"}]}}"#,
        )
        .expect("details");

        let board = response.board.expect("board");
        assert_eq!(board.matching_core.as_deref(), Some("arduino:avr"));
        // avr-gcc 缺版本 → 需要安裝；avrdude 有版本 → 已就緒。
        assert_eq!(board.missing_tools(), vec!["avr-gcc".to_string()]);
    }

    #[test]
    fn board_details_with_all_tools_installed_has_no_missing() {
        let response: BoardDetailResponse = parse_json(
            r#"{"board":{"fqbn":"arduino:avr:uno","tools_dependencies":[{"name":"avr-gcc","version":"7.3.0"}]}}"#,
        )
        .expect("details");
        assert!(response.board.expect("board").missing_tools().is_empty());
    }

    #[test]
    fn platform_summary_detects_available_upgrade() {
        let response: PlatformsResponse = parse_json(
            r#"{"platforms":[{"id":"arduino:avr","name":"Arduino AVR Boards","installed_version":"1.8.5","latest_version":"1.8.6","installed_boards":["Arduino Uno"]}]}"#,
        )
        .expect("platforms");

        let platform = &response.platforms[0];
        assert!(platform.has_upgrade());
        assert_eq!(platform.installed_boards, vec!["Arduino Uno".to_string()]);
    }

    #[test]
    fn platform_without_upgrade_reports_false() {
        let response: PlatformsResponse = parse_json(
            r#"{"platforms":[{"id":"arduino:avr","installed_version":"1.8.6","latest_version":"1.8.6"}]}"#,
        )
        .expect("platforms");
        assert!(!response.platforms[0].has_upgrade());
    }

    #[test]
    fn libraries_response_merges_installed_and_available() {
        let response: LibrariesResponse = parse_json(
            r#"{"installed_libraries":[{"name":"Servo","author":"Michael Margolis","version":"1.2.2","sentence":"Arduino library for servo","official":true}],"available_libraries":[{"name":"NeoPixel","author":"Adafruit","version":"1.12.0","sentence":"NeoPixel library","official":false}]}"#,
        )
        .expect("libraries");

        assert_eq!(response.all().len(), 2);
        assert!(response.installed[0].official);
        assert_eq!(
            response.installed[0].display_label(),
            "Servo (Michael Margolis)"
        );
        assert_eq!(response.available[0].display_label(), "NeoPixel (Adafruit)");
    }

    #[test]
    fn libraries_response_accepts_search_shape() {
        let response: LibrariesResponse =
            parse_json(r#"{"libraries":[{"name":"LiquidCrystal","version":"1.0.7"}]}"#).expect("libs");
        assert_eq!(response.all().len(), 1);
        // 無 author 時只顯示名稱。
        assert_eq!(response.libraries[0].display_label(), "LiquidCrystal");
    }

    #[test]
    fn compile_success_payload_exposes_build_path_and_libraries() {
        let program: SketchProgram = parse_json(
            r#"{"success":true,"compiler_out":"Sketch uses 1234 bytes","compiler_err":"","builder_result":{"build_path":"/build/proj","executable_sections_filename":"proj.ino.hex","used_libraries":[{"name":"Servo","version":"1.2.2","location":"/user/libraries/Servo"}]}}"#,
        )
        .expect("program");

        assert!(program.success);
        assert_eq!(program.builder_result.build_path, "/build/proj");
        assert_eq!(program.builder_result.used_libraries[0].name, "Servo");
    }

    #[test]
    fn compile_failure_payload_keeps_compiler_err_for_diagnostics() {
        let program: SketchProgram = parse_json(
            r#"{"success":false,"compiler_out":"","compiler_err":"/sk/proj/proj.ino:7:3: error: expected ';' before '}' token"}"#,
        )
        .expect("program");

        assert!(!program.success);
        assert!(program.compiler_err.contains("proj.ino:7:3"));
    }

    #[test]
    fn sketch_program_with_empty_payload_degrades_gracefully() {
        let program: SketchProgram = parse_json("{}").expect("program");
        assert!(!program.success);
        assert!(program.compiler_err.is_empty());
    }

    #[test]
    fn library_without_author_has_plain_label() {
        let response: LibrariesResponse =
            parse_json(r#"{"libraries":[{"name":"OneWire"}]}"#).expect("libs");
        assert_eq!(response.libraries[0].display_label(), "OneWire");
    }
}
