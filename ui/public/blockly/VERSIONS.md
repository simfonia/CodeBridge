# Blockly runtime assets

本目錄固定使用 Blockly 13.3.0 的瀏覽器 UMD 產物，不使用 `latest` 或 beta 版。

## 載入順序

1. `core/blockly.js`
2. `core/blocks_compressed.js`（標準 blocks 與 mutator extensions）
3. `core/python_compressed.js`
4. `msg/en.js`，保存英文基礎訊息 snapshot
5. `msg/zh-hant.js`，保存繁中基礎訊息 snapshot
6. `plugins/*.js`
7. CodeBridge modules、messages 與 generator

Blockly v13 的工作區 ARIA 初始化需要官方基礎訊息。CodeBridge loader 會先透過 `Blockly.setLocale()` 套用本目錄的訊息 snapshot，再由模組訊息覆寫積木文字。

## 固定資源與 SHA-256

| 檔案 | Bytes | SHA-256 |
|---|---:|---|
| `core/blockly.js` | 640346 | `D3F46AF56951A7AED27F09F872DCA66ED70A932CA8BE9AADE3D9DF06CEACD078` |
| `core/blocks_compressed.js` | 71578 | `25284EDEC82C518A4699A6C2E763F6A47BA863E93327C7C9685BD9A5C6EDC812` |
| `core/python_compressed.js` | 27777 | `7D880E1763A147A4646398B5F6CF2398CF866BD12C12DB44ED4C91A5D38FCA59` |
| `msg/en.js` | 49406 | `155B0E29AD2BD59AD463EBDE5C3ACE7685EA5C25D019E950AAB625B3259D7E02` |
| `msg/zh-hant.js` | 54736 | `4A952C0C38ABFAA27BE00D2ADBD02DDB989E1DDBF078D6057B0927F50D76DE81` |
| `plugins/blockly-modal.js` | 5125 | `C9BF21CDD2FAB4AAC088E4E019D0DFF12DC2E119AB38E1FAB37D93B65D538747` |
| `plugins/field-colour.js` | 29563 | `EF3D0F5E20D3890D50307E32014AC314E844E50E3CC9AC773B3E1F831DCF2BA4` |
| `plugins/field-multilineinput.js` | 12404 | `515F3D689B0AC8EBCBBEC869EF73BAD60D5D09392B4EAAF85713A93BAF307D16` |
| `plugins/scroll-options.js` | 8604 | `E81530D9FD7E922AF29C712E3C55F0F6011310234DE088360CA65C57415DC7A7` |
| `plugins/workspace-minimap.js` | 10974 | `4DE655A1696B53ADA8B455653BBB337BC4E2E305B9DF806B0F3E91C983369FEE` |

## Media（離線備份）

Blockly 預設從 `https://static.blockly.com/media/` 載入縮放鈕、垃圾桶、註記摺疊與
縮放把手的 SVG。依賴外網 CDN 會讓離線環境（校園教學常見）整組圖示失效，因此把
同一份資源備份到本機，並在 `Blockly.inject` 傳入 `media: './blockly/media/'`。

注意 Blockly 13 的選項名稱是 **`media`**；舊版的 `pathToMedia` 在此版本已被忽略
（選項解析處硬寫 `this.pathToMedia = "https://static.blockly.com/media/"`）。

`sprites.svg` 的座標與 `blockly.js` 內的 `x:-32`（zoom in）、`x:-64`（zoom out）、
`y:-92`（三顆共用）偏移完全對應，**不可**用其他 Blockly 版本的媒體檔替代。

| 檔案 | Bytes | SHA-256 |
|---|---:|---|
| `media/sprites.svg` | 1775 | `862DE0EE081FA9BAF504E673736D7446439C15246452258CAB964A82566EF40F` |
| `media/delete-icon.svg` | 315 | `3EEE02B06F476CE746566808178543389E53CD4E9D7FD32B69E329EFF4FC71EF` |
| `media/foldout-icon.svg` | 150 | `0AC7478B56F5E5CC583C26710CB7EE5EDCEDB563CDE65CD2385F4DD3E9E08C64` |
| `media/resize-handle.svg` | 218 | `C95D07B3FB3AAA088E6665061B01952E7EA9DDA462B7032A85E095BF8A12855B` |

## Runtime 選項

- renderer：`thrasos`
- theme：`Blockly.Themes.Classic`
- sounds：`false`
- media：`./blockly/media/`（本機離線備份，見上節）
- Node.js 開發環境：Blockly 13.3.0 與目前測試工具鏈要求 Node.js 22.12 以上
