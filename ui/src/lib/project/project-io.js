/// CodeBridge 專案 I/O 協調層
/// 職責：New／Open／Save／Save As／Examples／複製程式碼 的流程編排，
///       並在切換或關閉專案前處理未儲存變更。
/// 位置：ui/src/lib/project/project-io.js
///
/// 資料流：
///   workspace --serialize--> .cbg 文字（含 cbp metadata） --project_save--> 磁碟
///   磁碟 --project_read--> parse（去 metadata）--textToWorkspace--> workspace
///   workspace --generate--> marked code --strip--> plain code（貼到 Arduino IDE）

var CodeBridgeProjectIO = (function() {
    'use strict';

    var context = null;

    function store() {
        return context.store;
    }

    function bridge() {
        return window.CodeBridgeTauri;
    }

    function project() {
        return window.CodeBridgeProject;
    }

    function plainCode() {
        return window.CodeBridgePlainCode;
    }

    function notifyError(error) {
        var described = bridge().describeError(error);
        var message = (typeof getI18n === 'function') ? getI18n(described.key, described.key) : described.key;
        if (described.detail) message += '：' + described.detail;
        if (window.CodeBridgeToast) {
            window.CodeBridgeToast.show(message, { type: 'error', duration: 4000 });
        }
        console.warn('[CodeBridge] project error:', described);
    }

    function requireDesktop() {
        if (bridge().isAvailable()) return true;
        if (window.CodeBridgeToast) {
            window.CodeBridgeToast.showKey('MSG_DESKTOP_REQUIRED', { type: 'error' });
        }
        return false;
    }

    /// 最近清單由工具列 UI 擁有；寫入後需請它重繪。
    function refreshRecentsUi() {
        if (window.CodeBridgeToolbarUI) window.CodeBridgeToolbarUI.refreshRecents();
    }

    /// 序列化目前工作區（Blockly XML，不含 cbg metadata）。
    ///
    /// **為什麼用 `domToPrettyText` 而非 `domToText`**（2026-09-28）：
    /// `domToText` 會把整個工作區壓成單行，動輒 15 KB 以上且沒有任何換行。
    /// 使用者要手動編輯 .cbg、要交作業、要 git 版控時完全無法閱讀，
    /// 而 .cbg 正是本專案的唯一真實來源，值得用可讀的格式落地。
    ///
    /// Blockly 13.3.0 官方提供的 `Blockly.Xml.domToPrettyText()` 會依巢狀深度
    /// 產生兩空格縮排的多行 XML；`Blockly.Xml.domToText()` 仍保留給
    /// 「需要單行字串做字串比對」的場景（dirty 判斷用的 snapshot 走同一路徑，
    /// 兩者一致即可）。
    ///
    /// 附帶效果：多行格式讓 `<!-- -->` 之類的問題在 diff 中一眼可見，
    /// 也讓「根元素 metadata 屬性」不再埋在 5000 字元的單行裡。
    function serializeWorkspace() {
        var workspace = context.getWorkspace();
        var dom = Blockly.Xml.workspaceToDom(workspace);
        return Blockly.Xml.domToPrettyText(dom);
    }

    /// 以 XML 文字取代整個工作區內容。
    function loadWorkspaceXml(xmlText) {
        var workspace = context.getWorkspace();
        workspace.clear();
        CodeBridgeBlocklyXml.textToWorkspace(xmlText, workspace);
        workspace.updateAriaLabel();
        context.onWorkspaceReloaded();
    }

    /// 產生要寫入磁碟的 .cbg 內容（XML + metadata）。
    function buildFileContents(name) {
        var meta = project().emptyMeta();
        meta.name = name || store().getState().name;
        return project().serialize(serializeWorkspace(), meta);
    }

    /// 有未儲存變更時詢問使用者；回傳是否可繼續。
    function confirmDiscardIfDirty() {
        var state = store().getState();
        if (!state.isDirty) return Promise.resolve(true);
        return window.CodeBridgeConfirm.askUnsaved(state.name || '').then(function(answer) {
            if (answer === 'save') return save({ saveAs: !state.path });
            if (answer === 'discard') return true;
            return false;
        });
    }

    function save(options) {
        var settings = options || {};
        if (!requireDesktop()) return Promise.resolve(false);

        var state = store().getState();
        var targetPath = state.path;
        var targetName = state.name;

        if (settings.saveAs || !targetPath) {
            return bridge().pickProjectSavePath(targetName).then(function(chosen) {
                if (!chosen) return false;
                return writeTo(chosen);
            });
        }
        return writeTo(targetPath);
    }

    function writeTo(path) {
        var name = project().nameFromPath(path);
        var contents = buildFileContents(name);
        return bridge().invoke('project_save', { path: path, contents: contents })
            .then(function() {
                var snapshot = serializeWorkspace();
                store().markSaved({ path: path, name: name, snapshot: snapshot });
                store().setDraft(null);
                store().addRecent({ path: path, name: name });
                refreshRecentsUi();
                if (window.CodeBridgeToast) window.CodeBridgeToast.showKey('MSG_SAVED', { type: 'success' });
                return true;
            })
            .catch(function(error) {
                notifyError(error);
                return false;
            });
    }

    function openProjectDialog() {
        if (!requireDesktop()) return Promise.resolve(false);
        return bridge().pickProjectToOpen().then(function(chosen) {
            if (!chosen) return false;
            return openPath(chosen);
        });
    }

    function openPath(path) {
        if (!requireDesktop()) return Promise.resolve(false);
        return bridge().invoke('project_read', { path: path })
            .then(function(contents) {
                var parsed = project().parse(contents);
                if (!project().isSupported(parsed.meta)) {
                    notifyError(new Error('PROJECT_ERROR_UNSUPPORTED_FORMAT|' + path));
                    return false;
                }
                loadWorkspaceXml(parsed.body);
                store().markSaved({
                    path: path,
                    name: parsed.meta.name || project().nameFromPath(path),
                    snapshot: serializeWorkspace(),
                    meta: parsed.meta
                });
                // Blockly 會在載入後正規化註解等屬性；讓載入後的第一次 refresh
                store().setDraft(null);
                store().addRecent({ path: path, name: parsed.meta.name || project().nameFromPath(path) });
                refreshRecentsUi();
                return true;
            })
            .catch(function(error) {
                notifyError(error);
                return false;
            });
    }

    /// 保留使用者的設備選擇（開發板／序列埠／鮑率）後回傳 metadata。
    ///
    /// 內建範例的 `.cbg` 只帶 `cbp:format` 與 `cbp:name`，**不含** fqbn / port，
    /// 解析出來會是 `null`。若直接把它交給 `markUntitled`（整個替換），
    /// 使用者剛選好的板子與序列埠就被清成空值 —— 症狀是「換一個範例，
    /// 按執行卻說尚未選擇開發板」。
    ///
    /// 板子與序列埠描述的是**使用者身邊的硬體**，不是專案內容，因此換專案
    /// 時必須保留。專案自帶的值（例如從磁碟開啟的舊 `.cbg`）仍可覆寫。
    function newProject() {
        return confirmDiscardIfDirty().then(function(allowed) {
            if (!allowed) return false;
            var workspace = context.getWorkspace();
            workspace.clear();
            if (typeof context.injectDefaultBlocks === 'function') context.injectDefaultBlocks();
            workspace.updateAriaLabel();
            context.onWorkspaceReloaded();
            // 空白專案仍保留使用者已選的板子與序列埠（見 keepDeviceMeta 說明）。
            store().markUntitled(serializeWorkspace(), keepDeviceMeta(project().emptyMeta()));
            store().setDraft(null);
            return true;
        });
    }

    /// 範例載入後視為未命名專案：第一次存檔會走 Save As。
    function openExample(example) {
        return confirmDiscardIfDirty().then(function(allowed) {
            if (!allowed) return false;
            // 讀取走 Rust 端：範例在 Tauri 資源目錄，dev 伺服器沒有它。
            return bridge().invoke('read_example', { path: example.path })
                .then(function(contents) {
                    var parsed = project().parse(contents);
                    loadWorkspaceXml(parsed.body);
                    // 範例視為未命名專案（存檔會走 Save As），但檔名區要顯示範例名稱。
                    // 範例是隨程式打包的資源，沒有可在本機檔案總管顯示的路徑，只提供說明標籤。
                    store().markUntitled(
                        serializeWorkspace(),
                        // 裝置狀態（埠／板型）不屬於範例，也不再存進 metadata ——
                        // 保持在 board-detector 與下拉選單，由使用者當下的選擇決定。
                        { format: parsed.meta.format, app: parsed.meta.app },
                        // 顯示名稱由 Rust 從檔名剝掉排序前綴而得（見 display_name）。
                        example.name || project().nameFromPath(example.file),
                        { label: example.file }
                    );
                    store().setDraft(null);
                    return true;
                })
                .catch(function(error) {
                    notifyError(error);
                    return false;
                });
        });
    }

    /// 讀取內建範例清單；失敗時回傳空陣列，讓 UI 顯示「尚無內建範例」。
    ///
    /// 範例改由 Rust 端掃描資源目錄（對齊 #WaveCode），因此新增範例只要
    /// 放檔案即可，不必維護 `manifest.json` 索引檔。
    function loadExamples() {
        if (!requireDesktop()) return Promise.resolve([]);
        return bridge().invoke('list_examples')
            .then(function(list) { return Array.isArray(list) ? list : []; })
            .catch(function() { return []; });
    }

    /// 複製 plain code（去除 ID marker）到剪貼簿，供貼到 Arduino IDE。
    function copyCode() {
        var text = plainCode().strip(context.getCode());
        return window.CodeBridgeClipboard.copy(text).then(function(succeeded) {
            if (window.CodeBridgeToast) {
                window.CodeBridgeToast.showKey(succeeded ? 'MSG_COPIED' : 'MSG_COPY_FAILED', {
                    type: succeeded ? 'success' : 'error',
                    duration: succeeded ? 2200 : 4000
                });
            }
            return succeeded;
        });
    }

    /// 在系統檔案總管中顯示目前專案檔。
    /// 內建範例與全新專案沒有本機路徑，因此不可顯示。
    function revealInFileManager() {
        var state = store().getState();
        if (!state.canReveal) {
            if (window.CodeBridgeToast) {
                window.CodeBridgeToast.showKey(
                    state.sourceLabel ? 'TLB_EXAMPLE_NOT_ON_DISK' : 'TLB_NO_PATH_TO_REVEAL',
                    { type: 'error' }
                );
            }
            return Promise.resolve(false);
        }
        if (!requireDesktop()) return Promise.resolve(false);
        return bridge().invoke('project_reveal', { path: state.sourcePath })
            .then(function() { return true; })
            .catch(function(error) {
                notifyError(error);
                return false;
            });
    }

    /// 處理 Rust 攔截的視窗關閉要求（按下右上角 X）。
    ///
    /// 乾淨時直接關閉；有未儲存變更時先詢問，取消則留在程式內。
    /// `closingGuard` 避免使用者連續按 X 產生多個對話框。
    var closingGuard = false;

    function handleCloseRequest() {
        if (!bridge().isAvailable() || closingGuard) return Promise.resolve(false);
        closingGuard = true;

        return confirmDiscardIfDirty()
            .then(function(allowed) {
                if (!allowed) {
                    closingGuard = false;
                    return false;
                }
                return bridge().invoke('app_close')
                    .then(function() { return true; })
                    .catch(function(error) {
                        closingGuard = false;
                        notifyError(error);
                        return false;
                    });
            });
    }

    /// 註冊視窗關閉監聽；僅桌面版有效。
    function listenForCloseRequest() {
        if (!bridge().isAvailable()) return;
        bridge().listen('codebridge://request-close', function() {
            handleCloseRequest();
        });
    }

    return {
        init: function(options) {
            context = options || {};
            listenForCloseRequest();
        },
        serializeWorkspace: serializeWorkspace,
        loadWorkspaceXml: loadWorkspaceXml,
        buildFileContents: buildFileContents,
        confirmDiscardIfDirty: confirmDiscardIfDirty,
        isDesktopAvailable: function() { return bridge().isAvailable(); },
        newProject: newProject,
        save: save,
        openProjectDialog: openProjectDialog,
        openPath: openPath,
        openExample: openExample,
        loadExamples: loadExamples,
        copyCode: copyCode,
        revealInFileManager: revealInFileManager,
        handleCloseRequest: handleCloseRequest
    };
})();

if (typeof window !== 'undefined') {
    window.CodeBridgeProjectIO = CodeBridgeProjectIO;
}
