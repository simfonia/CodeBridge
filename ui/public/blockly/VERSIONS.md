# Blockly runtime assets

本目錄固定使用 Blockly 13.3.0 的瀏覽器 UMD 產物，不使用 `latest` 或 beta 版。

## 載入順序

1. `core/blockly.js`
2. `core/python_compressed.js`
3. `msg/en.js`，保存英文基礎訊息 snapshot
4. `msg/zh-hant.js`，保存繁中基礎訊息 snapshot
5. `plugins/*.js`
6. CodeBridge modules、messages 與 generator

Blockly v13 的工作區 ARIA 初始化需要官方基礎訊息。CodeBridge loader 會先透過 `Blockly.setLocale()` 套用本目錄的訊息 snapshot，再由模組訊息覆寫積木文字。

## 固定資源與 SHA-256

| 檔案 | Bytes | SHA-256 |
|---|---:|---|
| `core/blockly.js` | 640346 | `D3F46AF56951A7AED27F09F872DCA66ED70A932CA8BE9AADE3D9DF06CEACD078` |
| `core/python_compressed.js` | 27777 | `7D880E1763A147A4646398B5F6CF2398CF866BD12C12DB44ED4C91A5D38FCA59` |
| `msg/en.js` | 49406 | `155B0E29AD2BD59AD463EBDE5C3ACE7685EA5C25D019E950AAB625B3259D7E02` |
| `msg/zh-hant.js` | 54736 | `4A952C0C38ABFAA27BE00D2ADBD02DDB989E1DDBF078D6057B0927F50D76DE81` |
| `plugins/blockly-modal.js` | 5125 | `C9BF21CDD2FAB4AAC088E4E019D0DFF12DC2E119AB38E1FAB37D93B65D538747` |
| `plugins/field-colour.js` | 29563 | `EF3D0F5E20D3890D50307E32014AC314E844E50E3CC9AC773B3E1F831DCF2BA4` |
| `plugins/field-multilineinput.js` | 12404 | `515F3D689B0AC8EBCBBEC869EF73BAD60D5D09392B4EAAF85713A93BAF307D16` |
| `plugins/scroll-options.js` | 8604 | `E81530D9FD7E922AF29C712E3C55F0F6011310234DE088360CA65C57415DC7A7` |
| `plugins/workspace-minimap.js` | 10974 | `4DE655A1696B53ADA8B455653BBB337BC4E2E305B9DF806B0F3E91C983369FEE` |

## Runtime 選項

- renderer：`thrasos`
- theme：`Blockly.Themes.Classic`
- sounds：`false`
- Node.js 開發環境：Blockly 13.3.0 要求 Node.js 22 以上
