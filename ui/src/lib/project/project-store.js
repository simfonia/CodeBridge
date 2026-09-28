/// CodeBridge 專案狀態與 .cbg 專案檔格式
/// 職責：.cbg（Blockly XML）metadata 序列化、專案狀態（路徑／名稱／dirty）、
///       最近專案清單與未儲存草稿。
/// 位置：ui/src/lib/project/project-store.js
///
/// 設計要點：
/// - 專案唯一真實來源是 workspace XML（.cbg）；`.ino` 永遠是產物，不落地。
/// - dirty 以「當前 XML 與最後儲存 XML 的字串比對」判定，因此 undo 回原狀
///   會自動清除 dirty，不需維護事件計數。
/// - 專案 metadata（fqbn／port／baud）以 namespaced 屬性掛在根元素 `<xml>` 上，
///   存檔時重新注入、開檔時讀取；localStorage 僅作為 cache 與草稿。

var CodeBridgeProject = (function() {
    'use strict';

    /// 專案副檔名：單一常數來源，dialog filter／Rust 白名單／範例檔皆引用此值。
    var EXT = '.cbg';
    /// .cbg 格式版本；高於此版本時拒絕開啟，避免靜默降級。
    var FORMAT_VERSION = 1;
    var NAMESPACE = 'https://codebridge.app/xml';
    /// 寫檔時記錄的 CodeBridge 版本（純診斷用，不參與相容性判斷）。
    var APP_VERSION = '0.2.0';
    var RECENTS_LIMIT = 10;

    var STORAGE_KEYS = {
        current: 'codebridgeProject',
        draft: 'codebridgeProjectDraft',
        recents: 'codebridgeRecentProjects'
    };

    /// 會被序列化進 .cbg 的 metadata 欄位。
    ///
    /// **2026-09-28 設計決策（與使用者討論後定案）**：
    /// 只保留 `app`（寫檔的 CodeBridge 版本，純診斷用），其餘全部移除：
    /// - `name`：**檔名才是權威**。存進檔案只會在使用者於檔案總管改名後
    ///   產生「檔名是 A、內部記錄是 B」的矛盾。
    /// - `fqbn`：第三方 clone 板的 reset/VID/PID 常不標準，**偵測不到 fqbn**。
    ///   記錄下來也無法驗證，只會在開檔時自動選中一個錯的預設值。
    /// - `port` / `baud`：**本機環境狀態**，不是專案特性。別台機器沒有 COM3；
    ///   同一台拔插 USB 後埠號就變。這兩個欄位曾造成「UI 顯示 COM4 但上傳
    ///   報尚未選擇序列埠」的實際 bug。
    /// - `libraries`：`#include` 已承載依賴資訊，且此欄位從無程式碼讀寫。
    var META_FIELDS = ['app'];

    function emptyMeta() {
        return { format: null, app: null };
    }

    function escapeAttribute(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function decodeAttribute(value) {
        return String(value)
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&');
    }

    function findRootTag(xmlText) {
        var match = String(xmlText).match(/<xml\b[^>]*>/);
        return match ? match[0] : null;
    }

    /// 移除根元素上的 metadata 屬性。
    ///
    /// **同時處理 `cbp:`（舊）與 `cbg:`（新）**：CodeBridge 尚未發佈、沒有既有
    /// 使用者，但仍可能有開發中的舊檔案。舊命名空間必須在重新序列化時被清乾淨，
    /// 否則會同時出現兩套 metadata。
    function stripMetadataAttributes(tag) {
        return tag
            .replace(/\s+xmlns:cb[gp]="[^"]*"/g, '')
            .replace(/\s+cb[gp]:[A-Za-z0-9_-]+="[^"]*"/g, '');
    }

    function buildAttributeText(meta) {
        var parts = ['cbg:format="' + FORMAT_VERSION + '"'];
        // 寫檔的 CodeBridge 版本：純診斷用，不參與相容性判斷。
        // 沒有它，除錯時無法得知「這個 .cbg 是哪一版 CodeBridge 產生的」。
        var app = (meta && meta.app) || APP_VERSION;
        if (app) parts.push('cbg:app="' + escapeAttribute(app) + '"');
        META_FIELDS.forEach(function(field) {
            var value = meta ? meta[field] : null;
            if (value === null || value === undefined || value === '') return;
            parts.push('cbg:' + field + '="' + escapeAttribute(value) + '"');
        });
        return parts.join(' ');
    }

    /// 將 metadata 注入 Blockly XML 根元素；重複呼叫結果一致（冪等）。
    function serialize(xmlText, meta) {
        var text = String(xmlText);
        var tag = findRootTag(text);
        if (!tag) return text;

        var cleaned = stripMetadataAttributes(tag);
        var namespace = ' xmlns:cbg="' + NAMESPACE + '"';
        var injected = cleaned.replace(/^<xml\b/, '<xml' + namespace + ' ' + buildAttributeText(meta));
        return text.replace(tag, injected);
    }

    /// 解析 .cbg 內容；回傳 metadata 與移除 metadata 屬性後的乾淨 XML。
    function parse(xmlText) {
        var text = String(xmlText);
        var tag = findRootTag(text);
        var meta = emptyMeta();
        if (!tag) return { meta: meta, body: text };

        // 同時接受 `cbg:`（新）與 `cbp:`（舊），讓舊檔案仍可開啟。
        var pattern = /\scb[gp]:([A-Za-z0-9_-]+)="([^"]*)"/g;
        var match;
        while ((match = pattern.exec(tag)) !== null) {
            var key = match[1];
            var value = decodeAttribute(match[2]);
            if (key === 'format') {
                var parsedFormat = parseInt(value, 10);
                meta.format = isNaN(parsedFormat) ? null : parsedFormat;
            } else if (META_FIELDS.indexOf(key) !== -1) {
                meta[key] = value;
            }
        }

        var body = text
            .replace(/\s+xmlns:cbp="[^"]*"/g, '')
            .replace(/\s+cbp:[A-Za-z0-9_-]+="[^"]*"/g, '');
        return { meta: meta, body: body };
    }

    function isSupported(meta) {
        if (!meta || meta.format === null || meta.format === undefined) return true;
        return meta.format <= FORMAT_VERSION;
    }

    function nameFromPath(path) {
        if (!path) return null;
        var text = String(path).split(/[\\/]/).pop();
        if (text.toLowerCase().endsWith(EXT)) {
            text = text.slice(0, text.length - EXT.length);
        }
        return text || null;
    }

    function createStore(options) {
        var settings = options || {};
        var storage = settings.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
        var listeners = [];

        function readJson(key, fallback) {
            if (!storage) return fallback;
            try {
                var raw = storage.getItem(key);
                if (!raw) return fallback;
                var parsed = JSON.parse(raw);
                return parsed === null || parsed === undefined ? fallback : parsed;
            } catch (error) {
                // 損壞的 localStorage 內容不應讓程式崩潰
                return fallback;
            }
        }

        function writeJson(key, value) {
            if (!storage) return;
            try {
                storage.setItem(key, JSON.stringify(value));
            } catch (error) {
                // localStorage 額度不足或隱私模式時靜默略過，狀態仍保留於記憶體
            }
        }

        var persisted = readJson(STORAGE_KEYS.current, null) || {};
        var state = {
            path: persisted.path || null,
            name: persisted.name || null,
            snapshot: typeof persisted.snapshot === 'string' ? persisted.snapshot : null,
            meta: persisted.meta || emptyMeta(),
            // 內容來源：使用者專案檔為真實路徑（可在檔案總管顯示）；
            // 內建範例是隨程式打包的資源，只有說明標籤，沒有可顯示的本機路徑。
            sourcePath: persisted.sourcePath || null,
            sourceLabel: persisted.sourceLabel || null
        };
        var currentSnapshot = state.snapshot === null ? '' : state.snapshot;

        function isDirtyFor(snapshot) {
            // 尚未建立基準快照時視為乾淨（新專案剛注入預設積木）
            if (state.snapshot === null) return false;
            return normalizeForCompare(snapshot) !== normalizeForCompare(state.snapshot);
        }

        function publicState() {
            return {
                path: state.path,
                name: state.name,
                isDirty: isDirtyFor(currentSnapshot),
                isUntitled: state.path === null,
                meta: state.meta,
                sourcePath: state.sourcePath,
                sourceLabel: state.sourceLabel,
                canReveal: Boolean(state.sourcePath)
            };
        }

        function persist() {
            writeJson(STORAGE_KEYS.current, {
                path: state.path,
                name: state.name,
                snapshot: state.snapshot,
                meta: state.meta,
                sourcePath: state.sourcePath,
                sourceLabel: state.sourceLabel
            });
        }

        function emit() {
            var emitted = publicState();
            listeners.slice().forEach(function(listener) { listener(emitted); });
        }

        function setSnapshotInternal(snapshot) {
            state.snapshot = snapshot;
            currentSnapshot = snapshot;
        }

        // Blockly 在載入工作區後會「正規化」註解：自動標記 pinned、補上絕對座標
        // （`<comment pinned="true" h="87" w="242" x="-18" y="5">`）。這些屬性不是
        // 使用者的修改，但它們會改變序列化結果 —— 若直接字串比對，開啟檔案的
        // 瞬間就會被誤判為 dirty，save 按鈕馬上亮起。
        //
        // 正規化的時機並不固定（實測可在載入後 10ms 內，也可能延後到 170ms，
        // 中間還會出現一段「內容不變」的平靜期），因此靠時間視窗或輪询收斂都不可靠。
        // 這裡改為**只在比較時**剝除這些易變屬性：基準快照本身保持原樣（還原與
        // 存檔仍需要完整內容），比對時雙方都正規化即可。
        //
        // 代價：單獨移動／縮放／固定註解不會標記 dirty。註解是呈現性質，
        // 對「程式內容是否改變」這個判斷而言影響可接受。
        // 先取出整個 <comment ...> 標籤，再於標籤內逐一移除易變屬性。
        // （不可用單一全域 regex 直接掃：移除第一個屬性後掃描位置已越過 `<comment`，
        //   同一標籤內其餘的屬性就會漏掉，比對仍會不一致。）
        var COMMENT_TAG = /<comment\b[^>]*>/g;
        var VOLATILE_COMMENT_ATTR = /\s+(?:x|y|pinned)="[^"]*"/g;

        function normalizeForCompare(snapshot) {
            if (typeof snapshot !== 'string') return snapshot;
            return snapshot.replace(COMMENT_TAG, function(tag) {
                return tag.replace(VOLATILE_COMMENT_ATTR, '');
            });
        }

        var store = {
            STORAGE_KEYS: STORAGE_KEYS,

            getState: publicState,

            isDirty: function() {
                return isDirtyFor(currentSnapshot);
            },

            getMeta: function() {
                return state.meta;
            },

            /// 最後一次儲存／開啟時的工作區 XML 基準內容。
            getSnapshot: function() {
                return state.snapshot;
            },

            /// 更新專案 metadata。
            ///
            /// **合併語意**：只覆寫傳入的欄位，其餘保留。
            ///
            /// 為什麼不能用「整個替換」：調用方各只關心自己的欄位 ——
            /// `board-picker` 選板時送 `{fqbn}`、`board-detector` 選序列埠時送
            /// `{port}`。若這裡整個替換，兩者會**互相清除**（選了板子就失去
            /// 序列埠、選了序列埠就失去板子），症狀是使用者明明選好了卻一直
            /// 被回報「尚未選擇開發板／序列埠」。
            ///
            /// 傳入 `null`／省略參數仍代表「重置為空」（既有語意）。
            setMeta: function(meta) {
                state.meta = meta ? Object.assign(emptyMeta(), state.meta, meta) : emptyMeta();
                persist();
                emit();
                return publicState();
            },

            subscribe: function(listener) {
                listeners.push(listener);
                return function() {
                    listeners = listeners.filter(function(item) { return item !== listener; });
                };
            },

            /// 新增專案（未命名）後建立基準快照。
            /// `displayName` 讓未命名專案仍可顯示來源名稱；`source` 描述內容來源，
            /// 例：內建範例為 `{ label: 'examples/blink.cbg' }`（沒有可顯示的本機路徑）。
            markUntitled: function(snapshot, meta, displayName, source) {
                state.path = null;
                state.name = displayName || null;
                state.meta = meta || emptyMeta();
                state.sourcePath = (source && source.path) || null;
                state.sourceLabel = (source && source.label) || null;
                setSnapshotInternal(snapshot);
                persist();
                emit();
                return publicState();
            },

            /// 儲存或開啟既有檔案後設定基準快照；內容來源即該檔案本身。
            markSaved: function(details) {
                var info = details || {};
                state.path = info.path || null;
                state.name = info.name || nameFromPath(info.path) || null;
                if (info.meta) state.meta = info.meta;
                state.sourcePath = info.sourcePath || info.path || null;
                state.sourceLabel = null;
                setSnapshotInternal(info.snapshot);
                persist();
                emit();
                return publicState();
            },

            /// 由變更事件更新目前內容；回傳是否為實質變更。
            refresh: function(snapshot) {
                var changed = snapshot !== currentSnapshot;
                currentSnapshot = snapshot;
                if (changed) emit();
                return { changed: changed, isDirty: isDirtyFor(snapshot) };
            },

            getDraft: function() {
                if (!storage) return null;
                try {
                    return storage.getItem(STORAGE_KEYS.draft);
                } catch (error) {
                    return null;
                }
            },

            setDraft: function(snapshot) {
                if (!storage) return;
                try {
                    if (snapshot === null || snapshot === undefined) {
                        storage.removeItem(STORAGE_KEYS.draft);
                    } else {
                        storage.setItem(STORAGE_KEYS.draft, snapshot);
                    }
                } catch (error) {
                    // 草稿屬於盡力而为功能，失敗不影響主要流程
                }
            },

            addRecent: function(entry) {
                if (!entry || !entry.path) return this.getRecents();
                var recents = this.getRecents().filter(function(item) { return item.path !== entry.path; });
                recents.unshift({
                    path: entry.path,
                    name: entry.name || nameFromPath(entry.path),
                    at: entry.at || Date.now()
                });
                recents = recents.slice(0, RECENTS_LIMIT);
                writeJson(STORAGE_KEYS.recents, recents);
                return recents;
            },

            getRecents: function() {
                var recents = readJson(STORAGE_KEYS.recents, []);
                if (!Array.isArray(recents)) return [];
                return recents.filter(function(item) { return item && item.path; });
            },

            removeRecent: function(path) {
                var next = this.getRecents().filter(function(item) { return item.path !== path; });
                writeJson(STORAGE_KEYS.recents, next);
                return next;
            },

            clearRecents: function() {
                writeJson(STORAGE_KEYS.recents, []);
                return [];
            }
        };

        return store;
    }

    return {
        EXT: EXT,
        FORMAT_VERSION: FORMAT_VERSION,
        NAMESPACE: NAMESPACE,
        RECENTS_LIMIT: RECENTS_LIMIT,
        STORAGE_KEYS: STORAGE_KEYS,
        META_FIELDS: META_FIELDS,
        emptyMeta: emptyMeta,
        serialize: serialize,
        parse: parse,
        isSupported: isSupported,
        nameFromPath: nameFromPath,
        createStore: createStore
    };
})();

if (typeof window !== 'undefined') {
    window.CodeBridgeProject = CodeBridgeProject;
}
