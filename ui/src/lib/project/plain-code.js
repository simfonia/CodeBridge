/// CodeBridge plain code 工具
/// 職責：將 generator 產生的 marked code（內含 ID 標記）還原為可寫入磁碟、
///       可貼到 Arduino IDE 的純程式碼。
/// 位置：ui/src/lib/project/plain-code.js
///
/// 設計要點：
/// - ID 標記只出現在行尾（statement：`// __BLOCKLY_ID:<id>__`，
///   value：`/* // __BLOCKLY_ID:<id>__ */`），移除後不影響 C++ 語意。
/// - 預覽面板、複製到剪貼簿、compile/upload 共用本模組，
///   避免 main.js 與後端各自維護一套 regex。
/// - 標記常數一律從 Blockly.Arduino 讀取，缺少 Blockly 執行期時退回預設值，
///   讓單元測試可以在無 Blockly 環境下驗證。

var CodeBridgePlainCode = (function() {
    'use strict';

    var DEFAULT_MARKER = '// __BLOCKLY_ID:';
    var DEFAULT_MARKER_END = '__';

    function escapeRegExp(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function markerInfo(blockly) {
        var arduino = (blockly || (typeof Blockly !== 'undefined' ? Blockly : null));
        arduino = arduino && arduino.Arduino;
        return {
            marker: (arduino && arduino.ID_MARKER) || DEFAULT_MARKER,
            markerEnd: (arduino && arduino.ID_MARKER_END) || DEFAULT_MARKER_END
        };
    }

    /// 建立標記解析用的正規表達式；`blockly` 可注入以便測試。
    function buildPatterns(blockly) {
        var info = markerInfo(blockly);
        var marker = escapeRegExp(info.marker);
        var id = '([^\\s]+)';
        return {
            marker: info.marker,
            markerEnd: info.markerEnd,
            // 擷取標記中的 block id（供程式碼定位使用）
            idRegex: new RegExp(info.marker + id + info.markerEnd, 'g'),
            // 移除行尾的 statement 標記（含前置空白）
            cleanIdRegex: new RegExp(' ' + marker + '[^\\s]+' + info.markerEnd, 'g'),
            // 移除 value block 的區塊註解標記
            cleanValueMarkerRegex: new RegExp('/\\*\\s*' + marker + '[^\\r\\n]*?\\s*\\*/', 'g')
        };
    }

    function removeMarkers(text, patterns) {
        return text
            .replace(patterns.cleanValueMarkerRegex, '')
            .replace(patterns.cleanIdRegex, '');
    }

    /// 去除單行的 ID 標記（預覽面板逐行使用）。
    function stripLine(line, patterns) {
        return removeMarkers(String(line), patterns || buildPatterns());
    }

    /// 將 marked code 轉為 plain code；每行去除標記後再去除行尾空白。
    function strip(code, blockly) {
        if (!code || typeof code !== 'string') return '';
        var patterns = buildPatterns(blockly);
        return removeMarkers(code, patterns)
            .split('\n')
            .map(function(line) { return line.replace(/[ \t]+$/, ''); })
            .join('\n');
    }

    /// 取出單行內所有 ID（供 renderCode 建立 blockId → 行號對應）。
    function extractIds(line, blockly) {
        var patterns = buildPatterns(blockly);
        patterns.idRegex.lastIndex = 0;
        var ids = [];
        var match;
        while ((match = patterns.idRegex.exec(String(line))) !== null) {
            ids.push(match[1]);
        }
        return ids;
    }

    return {
        DEFAULT_MARKER: DEFAULT_MARKER,
        DEFAULT_MARKER_END: DEFAULT_MARKER_END,
        buildPatterns: buildPatterns,
        removeMarkers: removeMarkers,
        strip: strip,
        stripLine: stripLine,
        extractIds: extractIds
    };
})();

if (typeof window !== 'undefined') {
    window.CodeBridgePlainCode = CodeBridgePlainCode;
}
