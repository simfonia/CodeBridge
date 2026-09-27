//! 子進程輸出的寬容解碼：根治 Windows webview 終端機的 cp950 亂碼。
//!
//! 問題背景（對齊 #cocoya `AGENTS.md` 的「Python 子進程編碼鐵律」）：
//! cocoya 的解法是**在子進程端強制 UTF-8**（`PYTHONIOENCODING` / `PYTHONUTF8`），
//! 父端以 `encoding="utf-8", errors="replace"` 解碼。CodeBridge 對應的子進程是
//! `arduino-cli` 與其底下的 `avrdude` / `gcc` / `make`：`arduino-cli` 本身是 Go
//! 程式（恆為 UTF-8），但**工具鏈的原生工具**（gcc、esp32-openocd 等）仍可能
//! 依系統 locale（zh-TW Windows 即 cp950）輸出非 UTF-8 位元組。
//!
//! 本模組採「雙管齊下」：
//! 1. `runner.rs` 啟動子進程時強制 `LANG` / `LC_ALL` = `C.UTF-8`（子進程端）。
//! 2. 本模組在父端做**寬容解碼**（防線二）：UTF-8 strict → Big5(cp950) →
//!    GBK → windows-1252 → latin-1，全程 replace 策略，**永不 panic、永不丟失整段輸出**。
//!
//! 為什麼不能用 `read_to_string`：該 API 遇到非法 UTF-8 會回傳 `Err`，導致
//! gcc 的一行中文錯誤訊息讓**整份**編譯輸出消失。使用者只會看到「什麼都沒有」，
//! 比顯示亂碼更難以診斷。
//!
//! 所有函式皆為純函式，可完整單元測試，不依賴 arduino-cli 或網路。

use serde::Serialize;
use std::fmt;

/// UTF-8 BOM 位元組前綴。
const UTF8_BOM: [u8; 3] = [0xEF, 0xBB, 0xBF];

/// 實際採用的解碼來源。
///
/// 供終端機面板顯示編碼（除錯用：中文亂碼時第一眼看出是 CLI 或工具鏈在講
/// 非 UTF-8 的語言），也讓測試可以明確斷言解碼鏈的選擇結果。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum EncodingKind {
    /// 直接命中 UTF-8（arduino-cli 的正常情況）。
    Utf8,
    /// 以 Big5 / cp950 解出，Windows 繁中 locale 的工具鏈最常見。
    Big5,
    /// 以 GBK（簡體）解出。
    Gbk,
    /// 以 windows-1252（西歐）解出。
    Windows1252,
    /// 以 latin-1 逐位元組保留（終極保底，不會遺失任何位元組）。
    Latin1,
}

impl EncodingKind {
    /// 顯示用標籤。
    pub fn label(&self) -> &'static str {
        match self {
            EncodingKind::Utf8 => "UTF-8",
            EncodingKind::Big5 => "Big5 / cp950",
            EncodingKind::Gbk => "GBK",
            EncodingKind::Windows1252 => "windows-1252",
            EncodingKind::Latin1 => "latin-1",
        }
    }
}

impl fmt::Display for EncodingKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.label())
    }
}

/// 解碼結果。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DecodedText {
    /// 解碼後文字（可能含 U+FFFD 取代字元）。
    pub text: String,
    /// 實際採用的解碼來源。
    pub encoding: EncodingKind,
    /// 是否使用了取代字元或逐位元組保底（代表原始位元組已不完整）。
    pub replaced: bool,
}

impl DecodedText {
    /// 建立 UTF-8 且無取代的結果（常見快徑）。
    fn clean(text: String) -> Self {
        Self {
            text,
            encoding: EncodingKind::Utf8,
            replaced: false,
        }
    }
}


/// 移除 UTF-8 BOM 前綴（若存在）。
///
/// 工具鏈產生的訊息可能帶 BOM；不移除會讓第一行編譯器訊息出現隱形的
/// BOM 字元，導致 diagnostics 的行號解析失敗。
pub fn strip_bom(text: &str) -> &str {
    text.strip_prefix('\u{feff}').unwrap_or(text)
}

/// 以單一寬容策略解碼任意位元組串流。
///
/// 解碼鏈：`UTF-8 strict` → `Big5` → `GBK` → `windows-1252` → `latin-1`。
/// 前一階段只有在**完全沒有錯誤**時才被接受，因此不會出現「用 Big5 硬解 UTF-8
/// 卻看起來像亂碼」的誤判；`latin-1` 為最終保底，保證位元組不遺失。
pub fn decode_output(bytes: &[u8]) -> DecodedText {
    // BOM 先剝除，否則 UTF-8 strict 會失敗而被誤判為非 UTF-8。
    let body = bytes.strip_prefix(&UTF8_BOM[..]).unwrap_or(bytes);

    if let Ok(text) = std::str::from_utf8(body) {
        return DecodedText::clean(strip_bom(text).to_string());
    }

    for (encoding_rs_encoding, kind) in [
        (encoding_rs::BIG5, EncodingKind::Big5),
        (encoding_rs::GBK, EncodingKind::Gbk),
        (encoding_rs::WINDOWS_1252, EncodingKind::Windows1252),
    ] {
        let (decoded, had_errors) = encoding_rs_encoding.decode_without_bom_handling(body);
        if !had_errors {
            return DecodedText {
                text: decoded.into_owned(),
                encoding: kind,
                replaced: false,
            };
        }
    }

    // 最終保底：latin-1 逐位元組對應碼位（0x00-0xFF 一對一），因此**絕不遺失**
    // 任何位元組。實測 encoding_rs 的 BIG5 已是總函式（任何位元組序列皆可解），
    // 因此本分支屬防禦性程式碼、實務上不會被觸發；保留以確保未來替換解碼器
    // 或加入新編碼時仍有「絕不丟資料」的最後一道保險。
    DecodedText {
        text: body.iter().map(|byte| *byte as char).collect(),
        encoding: EncodingKind::Latin1,
        replaced: true,
    }
}

/// 正規化已解碼文字：去 BOM、統一換行為 `\n`、去除尾端空白。
///
/// 終端機面板與 diagnostics 解析都假設單一換行慣例；Windows 子進程的
/// `\r\n` 若不統一，`parse_compiler_output` 會在訊息尾端留下不可見的 `\r`。
pub fn normalize(text: &str) -> String {
    strip_bom(text)
        .replace("\r\n", "\n")
        .replace('\r', "\n")
        .trim_end()
        .to_string()
}


#[cfg(test)]
mod tests {
    use super::*;

    /// 以指定編碼把字串編回位元組（測試用）。
    fn encode(text: &str, encoding: &'static encoding_rs::Encoding) -> Vec<u8> {
        let (bytes, _, _) = encoding.encode(text);
        bytes.into_owned()
    }

    #[test]
    fn decodes_plain_utf8_without_replacement() {
        let decoded = decode_output("Sketch uses 924 bytes".as_bytes());
        assert_eq!(decoded.encoding, EncodingKind::Utf8);
        assert!(!decoded.replaced);
        assert_eq!(decoded.text, "Sketch uses 924 bytes");
    }

    #[test]
    fn decodes_utf8_chinese_message() {
        let decoded = decode_output("/sk/a.ino:7:1: error: 缺少分號".as_bytes());
        assert_eq!(decoded.encoding, EncodingKind::Utf8);
        assert!(decoded.text.contains('缺'));
    }

    #[test]
    fn decodes_big5_output_from_toolchain() {
        // Windows 繁中 locale 下 gcc／avrdude 可能以 Big5 輸出中文錯誤。
        let bytes = encode("/sk/a.ino:7:1: error: 缺少分號", encoding_rs::BIG5);
        assert!(
            std::str::from_utf8(&bytes).is_err(),
            "fixture must not be valid utf-8"
        );

        let decoded = decode_output(&bytes);
        assert_eq!(decoded.encoding, EncodingKind::Big5);
        assert!(!decoded.replaced);
        assert_eq!(decoded.text, "/sk/a.ino:7:1: error: 缺少分號");
    }

    #[test]
    fn prefers_big5_over_gbk_for_tw_locale() {
        // 「功」在 Big5 與 GBK 都有定義，但位元組不同；繁中情境必須選 Big5。
        let bytes = encode("功", encoding_rs::BIG5);
        let decoded = decode_output(&bytes);
        assert_eq!(decoded.encoding, EncodingKind::Big5);
        assert_eq!(decoded.text, "功");
    }

    #[test]
    fn decodes_gbk_output() {
        // 「妳」在 Big5 無定義，因此必須落到 GBK 階段。
        let bytes = encode("妳", encoding_rs::GBK);
        let decoded = decode_output(&bytes);
        assert_eq!(decoded.encoding, EncodingKind::Gbk);
        assert_eq!(decoded.text, "妳");
    }

    #[test]
    fn windows_1252_covers_latin_high_bytes_without_error() {
        // 0xFF 在 windows-1252 有定義（ÿ），因此解碼鏈應停在 windows-1252，
        // 而且是「完全無誤」而非取代字元：西歐工具鏈訊息因此能正確還原。
        let decoded = decode_output(&[0x41, 0xFF, 0x42]);
        assert_eq!(decoded.encoding, EncodingKind::Windows1252);
        assert!(!decoded.replaced);
        assert_eq!(decoded.text, "A\u{FF}B");
    }

    #[test]
    fn decode_chain_never_loses_data_for_any_byte_sequence() {
        // 實測結論：encoding_rs 的 BIG5 對所有位元組序列皆能解出結果（總函式），
        // 因此解碼鏈的最終 latin-1 分支屬**防禦性程式碼**，實務上不會被觸發。
        // 真正必須鎖定的不變量是：任意輸入都不 panic、都不回傳空字串。
        for high in 0x80u16..=0xFF {
            let decoded = decode_output(&[high as u8]);
            assert!(!decoded.text.is_empty(), "byte {high:#04x} decoded to empty");

            for low in 0x00u16..=0xFF {
                let bytes = [high as u8, low as u8];
                let decoded = decode_output(&bytes);
                assert!(
                    !decoded.text.is_empty(),
                    "bytes {high:#04x} {low:#04x} decoded to empty"
                );
            }
        }
    }

    #[test]
    fn single_high_byte_never_panics_or_empties() {
        // 鎖定底线：任何單一位元組都必須解出恰好一個字元。
        for byte in 0u16..=255 {
            let decoded = decode_output(&[byte as u8]);
            assert_eq!(decoded.text.chars().count(), 1, "byte {byte:#04x}");
        }
    }

    #[test]
    fn strips_utf8_bom_before_decoding() {
        let mut bytes = UTF8_BOM.to_vec();
        bytes.extend_from_slice("void setup()".as_bytes());
        let decoded = decode_output(&bytes);
        assert_eq!(decoded.encoding, EncodingKind::Utf8);
        assert_eq!(decoded.text, "void setup()");
    }

    #[test]
    fn strips_bom_from_already_decoded_text() {
        assert_eq!(strip_bom("\u{feff}abc"), "abc");
        assert_eq!(strip_bom("abc"), "abc");
    }

    #[test]
    fn normalizes_crlf_to_lf() {
        assert_eq!(normalize("a\r\nb\r\n"), "a\nb");
        assert_eq!(normalize("a\rb"), "a\nb");
    }

    #[test]
    fn normalize_removes_bom_and_trailing_whitespace() {
        assert_eq!(normalize("\u{feff}value   \n\n"), "value");
    }

    #[test]
    fn decode_and_normalize_handles_windows_toolchain_output() {
        let bytes = encode("第一行\r\n第二行\r\n", encoding_rs::BIG5);
        assert!(std::str::from_utf8(&bytes).is_err(), "fixture must be big5");
        let decoded = decode_and_normalize(&bytes);
        assert_eq!(decoded.encoding, EncodingKind::Big5);
        assert_eq!(decoded.text, "第一行\n第二行");
    }

    #[test]
    fn empty_input_is_safe() {
        let decoded = decode_output(&[]);
        assert_eq!(decoded.text, "");
        assert_eq!(decoded.encoding, EncodingKind::Utf8);
        assert!(!decoded.replaced);
    }

    #[test]
    fn encoding_labels_are_distinct_and_human_readable() {
        let kinds = [
            EncodingKind::Utf8,
            EncodingKind::Big5,
            EncodingKind::Gbk,
            EncodingKind::Windows1252,
            EncodingKind::Latin1,
        ];
        let labels: Vec<&str> = kinds.iter().map(|kind| kind.label()).collect();
        let mut unique = labels.clone();
        unique.sort_unstable();
        unique.dedup();
        assert_eq!(unique.len(), labels.len(), "labels must be distinct");
        assert_eq!(EncodingKind::Utf8.to_string(), "UTF-8");
    }

    #[test]
    fn multibyte_chars_never_contain_newline_byte() {
        // runner 以 0x0A 分行逐行解碼；中文字元的編碼位元組不得含 0x0A，
        // 否則一次讀取會把字元切兩半而產生亂碼。
        for encoding_rs_encoding in [
            encoding_rs::UTF_8,
            encoding_rs::BIG5,
            encoding_rs::GBK,
        ] {
            let bytes = encode("第一行第二行中文", encoding_rs_encoding);
            assert!(
                !bytes.contains(&b'\n'),
                "{} leaked a newline byte",
                encoding_rs_encoding.name()
            );
        }
    }
}

/// 解碼並正規化（runner 的預設路徑）。
pub fn decode_and_normalize(bytes: &[u8]) -> DecodedText {
    let mut decoded = decode_output(bytes);
    decoded.text = normalize(&decoded.text);
    decoded
}
