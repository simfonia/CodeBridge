# 設定中心與核心目錄共用化（Phase T3）

## 文件資訊
- 狀態：**階段 1 已完成（2026-09-27）** —— 預設共用已上線，可實測上傳；設定 UI 與階段 2／3 待做
- 對應程式碼：`src-tauri/src/arduino/paths.rs`、`src-tauri/src/commands.rs`、`src-tauri/src/lib.rs`、`ui/src/lib/arduino/*`、`ui/src/lib/ui/*`、`ui/index.html`
- 前置：Phase T2 已完成編譯／上傳、板子自動偵測、開發板選擇面板
- 範圍限制：**只做 CodeBridge 自己用得到的設定**，不做通用 Arduino 環境管理器（不提供 `additional_urls` 編輯、代理設定等對高中生無意義的選項）
- 相容性前提：**CodeBridge 尚未發佈，目前沒有使用者**，因此可直接改變預設行為，不需遷移舊設定

### 階段 1 已完成的部分（2026-09-27）
- [x] `ArduinoCliDirs` + `platform_default()`（依 OS 推算預設值）
- [x] `ArduinoCliDirs::probe(program)`：以 `arduino-cli config get directories.*` 為**權威來源**，失敗才退回平台預設
- [x] `ToolchainDirs::shared()` / `with_mode(app_root, defaults, isolated)` / `under()`（保留隔離）
- [x] `AppState::with_isolation()`，預設 `false`（共用）；新增 `isolated_toolchain` 旗標供後續設定切換
- [x] 測試：`paths.rs` +5 項（共用取系統目錄、產物仍隔離、隔離模式不變、`build_root` 兩模式相同）
- [x] 真實 smoke 測試：`shared_toolchain_dirs_point_at_the_users_existing_cores`（實測通過）
- [ ] **待做**：`settings.json` 持久化、`toolchain_get_dirs` / `set_dirs`、設定對話框「進階 › 路徑」頁
- [x] **Bug 修正**：`compile_start` / `upload_start` 的 payload 包裝（見下方「前後端契約教訓」）

### 首次使用流程：arduino-cli 缺失時的處理（已決策，2026-09-27）

**問題**：未裝 Arduino IDE 2 與 arduino-cli 的新使用者，`core install` 無法執行
（它是 CLI 的子命令），但板子面板目前只檢查前端模組是否存在，會顯示一個**會失敗**的
「安裝核心」按鈕。

**決策：維持半自動，不自動執行遠端腳本。**

| 面向 | 決策 | 理由 |
|---|---|---|
| 一鍵安裝 CLI | **不做自動安裝** | `irm ... \| iex` 是遠端腳本執行；需系統管理員權限（UAC）；裝完可能未加入 PATH；資安與可追蹤性都不適合教學產品 |
| 提供什麼 | 下載說明頁 + 可複製的安裝指令 + 手動指定執行檔路徑 | 使用者需要知道「這是什麼、為什麼要裝」，而不是按一下系統就變了 |
| 放在哪 | **設定中心 › 進階 › 路徑**，板子面板只放捷徑連結 | 語意層級不同：選板是「我要選一塊板」，安裝 CLI 是「我要把環境弄好」。在選板流程裡插入環境設定是語意錯亂 |

**預期流程**：
```
開啟 CodeBridge（未裝 CLI）
  → 首次啟動檢查 → 一次性提示「環境未就緒」
  → [開啟設定中心] / [複製安裝指令]
  → 設定中心 › 進階 › 路徑 › Arduino CLI：顯示當前值 + 來源
  → CLI 就緒後，開發板管理器才有意義
```

**待做**：
- [ ] `board-picker.canInstallCore()` 改為檢查 **CLI 是否可用**（呼叫 `toolchain_detect`），
      CLI 缺失時顯示「請先到設定中心安裝 Arduino CLI」而非會失敗的按鈕
- [ ] 首次啟動的環境檢查提示（可關閉）

### 前後端契約教訓：Tauri command 的 payload 包裝

Rust 端 `compile_start(payload: CompilePayload)` 要求前端送 `{ payload: {...} }`；
`upload_ready(state, project_id, fqbn)` 是兩個獨立參數，要求**扁平**。

兩者混用時 E2E 完全測不出來 —— 因為 `tauri-mock` 只記錄呼叫、不驗證參數形狀。
實際症狀：`invalid args 'payload' for command 'compile_start'`，
使用者按「執行」立即失敗。已補上單元測試
`compile_start 與 upload_start 都以 { payload } 包裝送出`
與 `upload_ready 保持扁平參數`。



---

## Problem Statement

### 1. 隔離設計造成「使用者看不到自己已安裝的核心」（阻擋性）

`ToolchainDirs::under()` 把**全部** arduino-cli 目錄寫死在 `app_data_dir` 之下：

```
%APPDATA%\com.codebridge.app\arduino\{config,data,user,downloads}
```

實測結果（2026-09-27，使用者機器）：

| 目錄 | 內容 |
|---|---|
| `%APPDATA%\com.codebridge.app\arduino\data\packages\` | 只有 `builtin` 工具，**零核心** |
| `%LOCALAPPDATA%\Arduino15\packages\` | `arduino:avr`、`esp32:esp32`、`rp2040:rp2040` 三個核心 |

後果：使用者明明已安裝核心，CodeBridge 卻顯示「尚未安裝任何開發板核心」，且**沒有任何出路**。這是本專案至今最嚴重的 UX 缺陷。

### 2. 隔離偏離了 Arduino 官方慣例

實測確認 Arduino IDE 2 內建的 arduino-cli 與命令列 CLI **共用同一個目錄**：

```
%LOCALAPPDATA%\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe
%LOCALAPPDATA%\Arduino15\       ← arduino-cli 的 Windows 預設，IDE 2 與 CLI 共用
```

證據：`%LOCALAPPDATA%\Arduino15\inventory.yaml` 同時記錄了 IDE 2 與命令列寫入的 VID/PID 查詢快取：

```yaml
cache:
  api2:
    arduino:
      cc/boards/v1/boards?vid-pid=0x1a86-0x7523:
        ts: 2026-04-17T18:17:31   ← IDE 2 寫入
  builder-api:
    v3/boards/byvid/pid/0x1a86/0x7523:
        ts: 2026-09-27T21:41:03   ← 命令列 CLI 寫入
```

`%USERPROFILE%\.arduino15` 不存在，IDE 2 的 `config.json` 也只有視窗狀態、沒有資料目錄設定 —— 證明 IDE 2 完全依賴 arduino-cli 的預設值。

**結論：共用是官方既有慣例，CodeBridge 的隔離是刻意偏離，且沒有換來實際好處。**

### 3. 「設定/環境診斷」形同虛設

`btn-diagnose` 目前是 `disabled`，功能從未實作。後端已有 `toolchain_detect` 等命令但前端一項都沒接。使用者遇到環境問題時，沒有任何自助手段。

---

## Solution

### 決策一：預設共用，保留獨立開關

把「產物」與「工具鏈」拆開處理 —— 這是原始設計的核心錯誤，把兩類性質完全不同的資源混為一談：

| 資源 | 性質 | 處置 |
|---|---|---|
| `directories.data`（核心、函式庫） | 共享工具鏈，200MB+，官方慣例共用 | **預設共用**系統預設 |
| `directories.downloads` | 套件快取 | **預設共用** |
| `config_dir` / `arduino-cli.yaml` | CLI 設定 | **預設共用** |
| `inventory.yaml` | VID/PID 查詢快取 | **預設共用**（共用才有加速效果） |
| `build_root`（草稿暫存） | **CodeBridge 產物**，每次編譯重建 | **維持隔離** |
| `.cbg` 專案檔 | CodeBridge 自有格式 | 本來就獨立 |

```rust
// 概念示意
data_dir:       arduino_cli_default_data_dir()   // 共用（新增）
downloads_dir:  arduino_cli_default_downloads()  // 共用（新增）
config_dir:     arduino_cli_default_config()     // 共用（新增）
user_dir:       arduino_cli_default_user()       // 共用（新增）
build_root:     app_data_dir.join("sketches")    // 維持隔離
```

### 決策二：獨立模式作為可選開關

需要完全獨立環境的少數使用者（怕污染 IDE、測試多版本共存）仍可切換。切換入口放在「進階 › 路徑」，預設關閉。

### 決策三：設定中心只做 CodeBridge 用得到的

分兩層，**常用**給高中生、**進階**給少數人：

```
設定
├── 常用
│   ├── 開發板管理器     安裝／移除核心
│   ├── 函式庫管理器     安裝／移除函式庫
│   └── 序列埠
└── 進階
    ├── 路徑
    │   ├── Arduino CLI 執行檔
    │   ├── 核心目錄  ★ 獨立開關
    │   └── 草稿暫存目錄
    └── 診斷資訊（唯讀）
```

**不做**：`additional_urls` 編輯、代理設定、CLI 全域開關。理由：對高中生只會製造困惑，且 CodeBridge 定位是教學 IDE 而非瑞士刀。

### 決策四：每個欄位顯示「當前生效值 + 來源」

這是解決所有環境困惑的關鍵。使用者被「看不到核心」卡住，本質是**不知道系統當下用哪個目錄、為什麼**。

```
核心目錄
  當前值：%LOCALAPPDATA%\Arduino15
  來源：  共用系統目錄（與 Arduino IDE 共用）
  [ ] 使用 CodeBridge 專屬目錄

  ⓘ 共用時，你在 Arduino IDE 安裝的核心在這裡會直接可用。
```

有「當前值 + 來源」，使用者能自行回答「為什麼我看不到我的核心」，不必依賴我們猜測。

---

## 實作階段

### 階段 1：路徑可設定 + 預設共用（解決阻擋性問題）

**後端**
- 新增 `settings.json` 持久化（`%APPDATA%\com.codebridge.com/settings.json`）
  - 欄位：`cliPath`、`isolated`（bool，預設 `false`）、`buildRoot`（可選覆寫）
- 新增 `arduino_cli_default_data_dir()` 等函式：呼叫 `arduino-cli config get directories.data`，失敗時退回已知預設值（Windows `%LOCALAPPDATA%\Arduino15`、macOS `~/Library/Arduino15`、Linux `~/.arduino15`）
- `ToolchainDirs::from_settings()` 取代 `under()`：共用模式取 CLI 預設，獨立模式取 app_data
- 新增命令 `toolchain_get_dirs`：回報**當前生效的所有路徑 + 每個路徑的來源**（`system-default` / `user-configured` / `app-isolated`）
- 新增命令 `toolchain_set_dirs`：寫入 `settings.json`
- `AppState.toolchain_dirs` 改為 `RwLock`，切換時可更新；watcher 需重讀

**前端**
- `ui/src/lib/arduino/settings.js`：設定讀寫、變更訂閱
- 設定對話框骨架 + 「進階 › 路徑」頁
- 每欄位顯示當前值 + 來源 + 開關

**驗收**
- 預設狀態下，`board_list_all` 能列出使用者在 IDE 2 裝的核心
- 切換到獨立模式後，CodeBridge 看不到系統核心（行為正確切換）
- 重啟後設定被保留

### 階段 2：開發板管理器

**後端**
- `core_remove`、`core_update_index`
- `core_list` 補上版本、大小欄位

**前端**
- 把 `board-picker.js` 內的臨時「安裝核心」按鈕升級為完整管理器
- 顯示已安裝清單（ID、版本、移除鈕）+ 可安裝清單

**驗收**
- 可安裝／移除核心，操作後清單即時更新
- 進行中顯示進度（`core install` 會下載數百 MB）

### 階段 3：函式庫管理器

**後端**
- `lib_search`、`lib_install`、`lib_remove`
- `lib_list` 區分已安裝／可安裝

**前端**
- 函式庫管理頁：搜尋、安裝、顯示「用於哪些專案」

**驗收**
- 可搜尋、安裝、移除函式庫
- 專案可引用已安裝函式庫

---

## 切換獨立模式時的資料處理

已存在的舊目錄資料**不自動搬移**，改用確認對話框讓使用者選：

| 選項 | 行為 |
|---|---|
| 只切換 | 舊目錄保留不動（之後可手動刪除） |
| 切換並複製已安裝核心 | 把舊目錄的 `packages/` 複製到新位置（注意版本衝突） |
| 取消 | 維持原狀 |

理由：自動搬移可能覆蓋目標位置已存在的不同版本核心，代價大於好處。讓使用者明確選擇。

---

## 風險與緩解

| 風險 | 緩解 |
|---|---|
| 共用後 CodeBridge 升級核心會影響 IDE 2 | 這是官方生態既有現象，IDE 2 自己也會更新核心。設定頁明確標示「與 Arduino IDE 共用」 |
| `arduino-cli.yaml` 的 `installation.id`／`secret` 互相覆寫 | 實測目前該檔只有 `additional_urls`，無衝突欄位。階段 1 需再驗證 |
| `ToolchainDirs` 改為動態後，watcher 讀到舊值 | `AppState` 用 `RwLock`，切換時更新並重啟 watcher |
| 學生誤改設定把自己搞死 | 路徑欄位加驗證（目錄存在、可寫），失敗時回退到預設並提示 |

---

## 與既有文件的關係

- `log/plan/ArduinoCompileUpload.md`（Phase T2）：本計畫延續其工具鏈設計，並修正其 `ToolchainDirs` 的隔離決策
- `log/plan/ToolbarImplementation.md`：設定對話框的 UI 元件可沿用 `confirm-dialog.js` 的 overlay 模式

## 产品決策：停止鈕移除 + 逾時保護（2026-09-27 定案）

`compile` / `upload` 原本無逾時上限（`RunRequest::new` 預設 `None`），`arduino-cli` 一旦卡住
（等待網線、驅動無回應、檔案被鎖）作業就會永久停潛，唯一出路是停止鈕。
但停止的可能性很低（編詯 2–5 秒、上傳 3–5 秒），而燒錄中斷會留下半尾 flash（板子看起來像坏掉）。

**最終方案：移除停止鈕，改以逾時保護。**

| 作業 | 上限 | 理由 |
|---|---|---|
| `compile` | 5 分鐘（`COMPILE_TIMEOUT`） | 首次編詯可能需編詯核心工具鏈，需要富裕 |
| `upload` | 60 秒（`UPLOAD_TIMEOUT`） | avrdude 燒 8KB UNO 只需數秒，上限主要防範「埠被卡住」 |

已從下列位置移除停止鈕：`index.html`、`toolbar-registry.js`、`toolbar.js`、
`compile-controller.stop()` 及相關測試。保留 Rust 的 `operation_cancel` 命令（T3 Serial Monitor 可能用得上）。

---

## 下一步

1. 階段 1 實作（路徑可設定 + 預設共用）
2. 實機驗證：預設狀態下能否看到使用者已裝的 3 個核心
3. 階段 2、3
