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

Blockly 13 的 block definition 會在建立時解析 `colour: "%{BKY_XXX_HUE}"`。因此 palette 切換採以下順序：

1. 套用 Engineer／Angel block message overlay。
2. 由 Blockly adapter 將目前 `*_HUE` 對應到 preset palette。
3. 更新 workspace 既有 block 的 colour。
4. clone 並更新 toolbox XML 的 colour。
5. 在停用 Blockly events 時呼叫 `Blockly.setLocale(Blockly.Msg)` 原地重繪。
6. 更新 toolbox search index 與 workspace ARIA label。

禁止為了視覺切換 clear/reload workspace。舊實作會在切換期間讓孤兒積木 detector 寫入 `disabled-reasons="orphan"`，造成非主題 XML 差異。

## 持久化與遷移

- `codebridgeExperiencePreset`：`engineer` 或 `angel`。
- `codebridgeBlockStyle`：目前 preset 對應的 block message overlay。
- `codebridgeTheme`：舊相容鍵；讀到合法值時自動遷移。
- `codebridgeLang`：維持既有語系設定，不受 preset 影響。

## 擴充方式

新增 preset 時：

1. 在 `presets.js` 增加 ID、visual theme 與 block style。
2. 在 `presets.css` 增加該 ID 的 token。
3. 若需要不同 Blockly component style 或 block palette，在 adapter registry 增加 visual theme。
4. 新增公開行為測試，驗證 UI、Blockly、持久化、fallback 與 workspace 不變。

## 測試 Seam

`ui/tests/e2e/theme-runtime.spec.js` 透過公開介面與使用者操作驗證：

- Engineer 預設視覺與 block style。
- UI toggle 切換 Angel。
- 主要 UI／Blockly surface 套用正確 preset。
- 刷新後還原 preset。
- 舊鍵遷移與未知值 fallback。
- 切換前後 workspace XML 與 generator output 不變。
- Engineer／Angel 使用不同 Blockly block palette。

既有 runtime、migration 與 assets contract 必須持續通過，以驗證 Blockly 13 message、toolbox、XML 與資源完整性。
