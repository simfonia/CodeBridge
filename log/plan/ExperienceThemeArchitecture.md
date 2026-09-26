# CodeBridge Engineer／Angel 體驗主題架構

## 狀態
- 已採用並完成第一階段實作
- 決策日期：2026-09-25

## Problem

CodeBridge 過去以 `codebridgeTheme` 同時表示 Engineer／Angel 教學風格，但產品實際上只有淺色 UI 與固定 Blockly Classic theme。若未來直接加入 light、dark 或其他品牌主題，會混淆教學文字、Blockly 配色、UI 色碼與程式碼高亮，且每個功能 CSS 都會自行判斷主題。

## Solution

CodeBridge 對外只提供兩個完整體驗 preset：

| Preset | Visual theme | Block style | 定位 |
|---|---|---|---|
| `engineer` | `technology-dark` | `engineer` | 深色科技、C/C++ API |
| `angel` | `candy-light` | `angel` | 明亮糖果、自然教學語言 |

高階 interface 為 `window.CodeBridgeTheme`。內部仍以 `visualTheme` 與 `blockStyle` 分離 UI／Blockly／程式碼色系和積木訊息責任，讓未來可建立其他 preset，不將 Engineer／Angel 的視覺與文字永久焊死。

## Module 與 Interface

### `ui/src/theme/presets.js`
- 定義 `CODEBRIDGE_EXPERIENCE_PRESETS` registry。
- 每個 preset 指定 `visualTheme` 與 `blockStyle`。

### `ui/src/theme/theme-manager.js`
- 公開 `CodeBridgeTheme.init()`、`setPreset(id)`、`getPreset()`、`getDefinition()`、`attachWorkspace(workspace)`。
- 儲存 `codebridgeExperiencePreset` 與 `codebridgeBlockStyle`。
- 未知 preset 安全 fallback 到 Engineer。
- 舊 `codebridgeTheme=engineer|angel` 自動遷移。

### `ui/src/theme/blockly-adapter.js`
- 建立 CodeBridge Blockly component themes。
- 管理 grid、toolbox、flyout、selection、insertion marker 與 block palette。
- 在執行期更新既有 block 顏色、toolbox XML 與新 block 的 `*_HUE`。
- 不修改 block type、XML 結構或 generator。

### `ui/src/theme/code-theme-adapter.js`
- 套用 visual theme 與程式碼預覽 data attribute。
- 未來可在此擴充語法色系 adapter。

### `ui/src/styles/presets.css`
- 定義語意 CSS custom properties。
- 集中處理應用程式表面、Blockly chrome、focus、程式碼高亮與練習模式。
- 功能 CSS 消費 token，主題值不散落在功能模組。

## Blockly 更新策略

Blockly 13 的 block definition 在 `jsonInit` 之後呼叫 `this.setColour(CodeBridgeBlockPalette.getColourForRole(role))` 取得顏色。因此 palette 切換採以下順序：

1. 套用 Engineer／Angel block message overlay。
2. 由 `block-palette.js` 以 block type 查語意角色，再查該 visual theme 的 role 色碼。
3. 更新 workspace 既有 block 的 colour。
4. clone 並更新 toolbox XML 的 block 與 category colour。
5. 在停用 Blockly events 時呼叫 `Blockly.setLocale(Blockly.Msg)` 原地重繪。
6. 更新 toolbox search index 與 workspace ARIA label。

禁止為了視覺切換 clear/reload workspace。舊實作會在切換期間讓孤兒積木 detector 寫入 `disabled-reasons="orphan"`，造成非主題 XML 差異。

## 語意 Palette Contract（2026-09-26）

`ui/src/theme/block-palette.js` 是模組色碼的唯一來源：

- 語意角色：`structure`、`control`、`digital`、`analog`、`time`、`serial`、`logic`、`loops`、`math`、`text`、`variables`、`array`、`functions`。
- `ROLE_COLOURS`：role → 各 visual theme 色碼。
- `TYPE_ROLES` 與 `TYPE_PREFIX_ROLES`：block type → role，精確規則優先於前綴規則。
- `CATEGORY_ROLES`：toolbox 分類名稱（`%{BKY_XXX_CATEGORY}`）→ role，讓 dynamic 分類也能對齊。
- `getColourForRole(role)`：block 定義於 `init()` 中取目前 preset 的語意色碼。
- `registerModule({id, role, typePrefix?, blockTypes?, colours})`：第三方模組加入 contract 的公開入口。

專案尚未發佈，因此不保留任何相容層：

- 模組語系檔不再維護 `*_HUE` 色碼 key，顏色一律來自語意角色。
- `Blockly.Msg` 不寫入 `*_HUE`；Blockly 官方 msg 自帶的 `LOGIC_HUE`／`MATH_HUE` 不受影響。
- 持久化只保留 `codebridgeExperiencePreset` 單一鍵，無 `codebridgeTheme` 遷移、無 `codebridgeBlockStyle` 第二鍵。
- toolbox XML 不再硬編碼 `colour` 屬性，一律由 adapter 依語意角色設定。

## 持久化與遷移

- `codebridgeExperiencePreset`：`engineer` 或 `angel`。
- `codebridgeBlockStyle`：目前 preset 對應的 block message overlay。
- `codebridgeTheme`：舊相容鍵；讀到合法值時自動遷移。
- `codebridgeLang`：維持既有語系設定，不受 preset 影響。

## 擴充方式

新增 preset 時：

1. 在 `presets.js` 增加 ID、visual theme 與 block style。
2. 在 `presets.css` 增加該 ID 的 token。
3. 若需要不同 Blockly component style，在 adapter registry 增加 visual theme。
4. 在 `block-palette.js` 為新的語意角色補上各 visual theme 色碼。
5. 新增公開行為測試，驗證 UI、Blockly、持久化、fallback 與 workspace 不變。

## 測試 Seam

`ui/tests/e2e/theme-runtime.spec.js` 透過公開介面與使用者操作驗證：

- Engineer 預設視覺與 block style。
- UI toggle 切換 Angel。
- 主要 UI／Blockly surface 套用正確 preset。
- 刷新後還原 preset。
- 舊鍵遷移與未知值 fallback。
- 切換前後 workspace XML 與 generator output 不變。
- Engineer／Angel 使用不同 Blockly block palette。
- 語意 palette manifest 覆蓋 toolbox 全部 block type 與分類。
- 依 block type 重新著色，不受 block 目前 colour 影響。
- 舊 `*_HUE` message key 與語意 palette 同步。
- 第三方模組以語意角色加入 palette contract。

既有 runtime、migration 與 assets contract 必須持續通過，以驗證 Blockly 13 message、toolbox、XML 與資源完整性。
