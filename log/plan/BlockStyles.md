# CodeBridge 雙風格積木實作計畫（v2 - 改良版）

## 1. 核心設計理念

### 1.1 風格定義
- **Angel 風格** = 語系自然語言（基底）
  - 例如：`設定腳位 %1 為 %2`（zh-hant）、`set pin %1 to %2`（en）
  - 所有積木都有語系訊息，包括感測器/硬體積木
- **Engineer 風格** = 在 Angel 基底上疊加 C++/Arduino API 覆寫
  - 僅影響「有直接 C++ API 對應」的核心積木
  - 例如：`pinMode(%1, %2)`、`digitalWrite(%1, %2)`
  - 感測器/硬體積木不受影響（維持自然語言）

### 1.2 關鍵優勢
- 風格切換**不需重載工作區**（只更新 Blockly.Msg 鍵值）
- 感測器積木不受風格影響，降低維護成本
- 學生在 Engineer 模式下看到的積木文字 = 最終 C++ 程式碼片段

---

## 2. 目錄結構

```
ui/src/lib/blockly/
├── index.ts                    # 統一匯出 + 初始化 workbench
│
├── blocks/                     # 積木定義（模組化拆分）
│   ├── index.ts                # 載入所有內建模組
│   ├── core.ts                 # Arduino 核心 (pinMode, digitalWrite, ...)
│   ├── pin.ts                  # 影子積木 (arduino_pin_shadow)
│   ├── serial.ts               # 序列 (Serial.print, Serial.read...)
│   ├── math.ts                 # 數學
│   ├── logic.ts                # 邏輯
│   ├── loops.ts                # 迴圈
│   ├── variables.ts            # 變數
│   └── ... (依移植進度擴充)
│
├── generators/                 # 產生器（完全對應 blocks/）
│   ├── index.ts
│   ├── core.ts
│   ├── pin.ts
│   ├── serial.ts
│   ├── math.ts
│   ├── logic.ts
│   ├── loops.ts
│   ├── variables.ts
│   └── ...
│
├── messages/                   # 訊息管理（核心設計）
│   ├── index.ts                # 匯出 + Blockly.Msg 擴充邏輯
│   ├── zh-hant.ts              # 正體中文（全部積木）
│   ├── en.ts                   # 英文（全部積木）
│   └── style/                  # Engineer 風格覆寫層
│       ├── index.ts            # 套用/移除風格
│       └── engineer.ts         # 核心積木的 C++ 語法覆寫
│
├── theme/                      # Blockly 視覺主題
│   ├── index.ts
│   └── colours.ts
│
├── toolbox/                    # 工具箱分類
│   └── index.ts
│
├── modules/                    # 模組載入器（與 piBlockly-modules 對接）
│   ├── index.ts                # 模組管理器
│   ├── loader.ts               # 動態載入（本地/遠端）
│   └── manifest.ts             # core_manifest.json 解析
│
└── _core.js                    # 保留：程式碼籃子架構
```

---

## 3. 訊息系統架構

### 3.1 三層訊息模型

```
Layer 1: Locale (語系基底)
  └── zh-hant.ts / en.ts
      └── 所有積木的自然語言文字
      
Layer 2: Style Overlay (風格覆寫，可選)
  └── style/engineer.ts
      └── 僅核心積木的 C++ 語法覆寫
      
Layer 3: UI i18n (UI 介面文字，獨立於積木)
  └── ui/src/lib/i18n/ (獨立檔案)
      └── 選單、按鈕、對話框等 UI 文字
```

### 3.2 Locale 訊息格式（zh-hant.ts）

```typescript
export const ZH_HANT_MESSAGES: Record<string, string> = {
  // === Arduino Core ===
  'ARDUINO_PIN_MODE': '設定腳位 %1 為 %2',
  'ARDUINO_DIGITAL_WRITE': '數位寫入腳位 %1 狀態 %2',
  'ARDUINO_DIGITAL_READ': '數位讀取腳位 %1',
  'ARDUINO_ANALOG_WRITE': '類比寫入腳位 %1 值 %2',
  'ARDUINO_ANALOG_READ': '類比讀取腳位 %1',
  'ARDUINO_DELAY': '延遲 %1 毫秒',
  'ARDUINO_SERIAL_PRINT': '序列輸出 %1',

  // === Dropdown Options ===
  'ARDUINO_PIN_MODE_OUTPUT': '輸出',
  'ARDUINO_PIN_MODE_INPUT': '輸入',
  'ARDUINO_PIN_MODE_INPUT_PULLUP': '輸入拉高',
  'ARDUINO_DIGITAL_HIGH': '高',
  'ARDUINO_DIGITAL_LOW': '低',

  // === Tooltips ===
  'ARDUINO_PIN_MODE_TOOLTIP': '設定指定腳位為輸入或輸出模式。',
  'ARDUINO_DIGITAL_WRITE_TOOLTIP': '設定指定腳位為高電位或低電位。',
  // ...
}
```

### 3.3 Engineer 風格覆寫（style/engineer.ts）

```typescript
// 只包含有 C++ API 對應的核心積木
export const ENGINEER_STYLE: Record<string, string> = {
  'ARDUINO_PIN_MODE': 'pinMode(%1, %2)',
  'ARDUINO_DIGITAL_WRITE': 'digitalWrite(%1, %2)',
  'ARDUINO_DIGITAL_READ': 'digitalRead(%1)',
  'ARDUINO_ANALOG_WRITE': 'analogWrite(%1, %2)',
  'ARDUINO_ANALOG_READ': 'analogRead(%1)',
  'ARDUINO_DELAY': 'delay(%1)',
  'ARDUINO_SERIAL_PRINT': 'Serial.print(%1)',

  // Dropdown 選項也覆寫為 C++ 常數
  'ARDUINO_PIN_MODE_OUTPUT': 'OUTPUT',
  'ARDUINO_PIN_MODE_INPUT': 'INPUT',
  'ARDUINO_PIN_MODE_INPUT_PULLUP': 'INPUT_PULLUP',
  'ARDUINO_DIGITAL_HIGH': 'HIGH',
  'ARDUINO_DIGITAL_LOW': 'LOW',
}
```

### 3.4 切換邏輯

```typescript
function setBlockStyle(style: 'angel' | 'engineer', locale: 'zh-hant' | 'en') {
  // 1. 載入語系訊息（永遠執行）
  const localeMessages = locale === 'zh-hant' ? ZH_HANT_MESSAGES : EN_MESSAGES;
  Object.assign(Blockly.Msg, localeMessages);
  
  // 2. 如果是 engineer，疊加風格覆寫
  if (style === 'engineer') {
    Object.assign(Blockly.Msg, ENGINEER_STYLE);
  }
  
  // 3. 更新工作區（不需重載）
  const ws = Blockly.common.getMainWorkspace();
  if (ws) {
    ws.refreshToolboxSelection_();
    // 觸發所有積木重新渲染
    Blockly.Events.fire(new Blockly.Events.Ui(null, 'themeChange'));
  }
}
```

---

## 4. 積木定義規範

### 4.1 使用 %{BKY_...} 佔位符

```typescript
// blocks/core.ts
Blockly.Blocks['arduino_pin_mode'] = {
  init: function() {
    this.jsonInit({
      message0: '%{BKY_ARDUINO_PIN_MODE}',
      args0: [
        {
          type: 'input_value',
          name: 'PIN',
          check: ['Number', 'String']
        },
        {
          type: 'field_dropdown',
          name: 'MODE',
          options: [
            ['%{BKY_ARDUINO_PIN_MODE_OUTPUT}', 'OUTPUT'],
            ['%{BKY_ARDUINO_PIN_MODE_INPUT}', 'INPUT'],
            ['%{BKY_ARDUINO_PIN_MODE_INPUT_PULLUP}', 'INPUT_PULLUP']
          ]
        }
      ],
      previousStatement: true,
      nextStatement: true,
      colour: '%{BKY_ARDUINO_CONTROL_HUE}',
      tooltip: '%{BKY_ARDUINO_PIN_MODE_TOOLTIP}',
      helpUrl: ''
    });
  }
};
```

### 4.2 影子積木（維持 imperative 風格）

```typescript
// blocks/pin.ts
Blockly.Blocks['arduino_pin_shadow'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(Blockly.Msg.ARDUINO_PIN_LABEL)
        .appendField(new Blockly.FieldTextInput(''), 'PIN');
    this.setOutput(true, ['Number', 'String']);
    this.setColour(Blockly.Msg.ARDUINO_CONTROL_HUE);
    this.setTooltip('');
    this.setHelpUrl('');
  }
};
```

---

## 5. 模組載入系統（與 piBlockly-modules 對接）

### 5.1 Manifest 格式

```json
// ui/src/lib/modules/core_manifest.json
{
  "version": "1.0.0",
  "modules": [
    {
      "id": "arduino_base",
      "name": "Arduino Base",
      "description": "Basic Arduino blocks for CodeBridge",
      "type": "builtin",
      "enabled": true
    },
    {
      "id": "sensor_ultrasonic",
      "name": "Ultrasonic Sensor",
      "description": "HC-SR04 ultrasonic distance sensor",
      "type": "remote",
      "url": "https://pi-blockly-modules.example.com/piblockly_hw_blocks/",
      "enabled": false
    }
  ]
}
```

### 5.2 載入流程

```
loadModule(id)
  ├── 檢查 manifest 取得模組資訊
  ├── 如果是 builtin → 直接 import 本地模組
  ├── 如果是 remote → fetch(url) 動態載入
  │     ├── blocks.js → registerBlocks(Blockly)
  │     ├── generators.js → 註冊產生器
  │     ├── zh-hant.js → 合併訊息
  │     ├── en.js → 合併訊息
  │     └── toolbox.xml → 加入工具箱
  └── 更新 manifest 狀態
```

### 5.3 與 piBlockly 的相容性

- 遠端模組格式與 piBlockly-modules 一致（blocks.js, generators.js, zh-hant.js, en.js, toolbox.xml）
- 使用相同的 `loadModule()` 動態載入機制
- 模組可從 piBlockly-modules 的部署網址直接載入

---

## 6. UI i18n 與積木訊息的關係

| 面向 | 位置 | 管理方式 |
|------|------|---------|
| 積木文字 | `blockly/messages/` | 與積木定義綁定，隨模組載入 |
| 工具箱分類 | `blockly/messages/` | 同上，使用相同訊息鍵 |
| UI 介面文字 | `ui/src/lib/i18n/` | 獨立管理，與 Svelte 元件綁定 |
| 設定選單 | Svelte 元件 | 直接使用 i18n 語系檔 |

**UI 的語系/風格切換開關**：直接呼叫 `setBlockStyle()` 和 `setLocale()`，不需經過積木系統。

---

## 7. 移植優先順序

### Phase 1：核心 Arduino + C++ 語法（本次實作）
- 影子積木（arduino_pin_shadow）
- pinMode / digitalWrite / digitalRead
- analogWrite / analogRead
- delay
- Serial.begin / Serial.print / Serial.println
- setup / loop 結構積木

### Phase 2：基礎程式邏輯
- 邏輯（if/else, compare, operation, boolean）
- 迴圈（for, while, repeat）
- 數學（constrain, map, random）
- 變數
- 文字

### Phase 3：感測器與致動器（從 piBlockly-modules 移植）
- 超音波 HC-SR04
- DHT 溫濕度
- 伺服馬達
- 步進馬達
- 其他硬體模組

---

## 8. 與 piBlockly 的關鍵差異

| 面向 | piBlockly | CodeBridge |
|------|-----------|------------|
| 風格管理 | 兩組完整語言檔（_ENGINEER / _ANGEL） | **Locale + Style Overlay** |
| 感測器積木 | 有雙風格 | **僅 Locale（自然語言）** |
| 風格切換 | 重載工作區 | **即時，不需重載** |
| 模組載入 | 快取目錄讀取 | **本地 + 遠端動態載入** |
| 模組封裝 | 無固定結構 | **含 blocks/generators/messages** |
| 積木定義 | 混合 imperative + jsonInit | **統一 jsonInit + %{BKY_...}** |
| UI i18n | 與積木訊息混合 | **獨立於積木訊息** |