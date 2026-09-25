# CodeBridge Modules 專案開發計畫

## 文件資訊
- 狀態：已採用
- 決策日期：2026-09-25
- 決策：建立全新 repository，不沿用 `piBlockly-modules` 名稱與架構
- 暫定名稱：CodeBridge Modules

## 決策摘要

建立新的 `codebridge-modules` repository，承載所有非核心遠端積木。舊 `C:\Workspace\piblockly-modules` 不在原地升級，其程式碼、語系、toolbox 與 Git history 僅作為遷移來源。新 repository 從零建立 catalog、schema、module contract、CI、發布、版本與安全流程。

## 命名策略

- 產品名稱：CodeBridge Modules
- Repository：`codebridge-modules`
- 技術 catalog：`manifest.v2.json`
- Module ID namespace：`codebridge.*`
- 舊 block type 暫時保留，例如 `piblockly_hw_*`、`PIBLOCKLY_HW_*`、`huskylens_*`，確保既有 XML 相容。
- 不要求 module ID 與 block type 同名。
- 未來只有在提供 migration 時才允許 block type 變更。

## 目標架構

```text
codebridge-modules/
├── manifest.v2.json
├── schemas/
│   └── module.schema.json
├── modules/
│   ├── sensors/
│   ├── actuators/
│   ├── servo/
│   ├── huskylens/
│   ├── music/
│   ├── picar/
│   └── libraries/
├── migration/
│   └── piBlocklyV1/
├── templates/
├── tests/
│   ├── fixtures/
│   └── contract/
├── docs/
├── log/
└── FILE_STRUCTURE.md
```

## Module Contract

每個模組至少包含 `module.json`、`blocks.js`、`generators.js`、`toolbox.xml`、`zh-hant.js` 與 `en.js`。可選包含 engineer style、examples、resources、libraries 與 migrations。

`module.json` 必須描述：
- schemaVersion、module id、semver、作者與授權
- CodeBridge、Blockly 與 generator API 相容範圍
- blocks、generators、toolbox 與 translations entry
- 所需核心 block
- Arduino library dependencies
- checksum 與發布 metadata

程式模組採 ES module exports：
- `registerBlocks(Blockly)`
- `registerGenerators(Blockly)`
- i18n named exports

Generator 統一註冊至 `Blockly.Arduino.forBlock[]`，共用 CodeBridge code buckets 與 source mapping。

## 舊 pbm 遷移策略

1. 盤點 75 個 block type、73 個 generator、i18n keys 與 toolbox references。
2. 建立 migration manifest，不直接複製成新架構。
3. 將舊 `piblockly_hw_blocks` 作為一個 temporary compatibility module 匯入。
4. 對每個 block 建立 XML 與 generated code fixture。
5. 驗證完成後，按 sensors、actuators、servo、huskylens、music、picar 與 libraries 拆分。
6. 拆分時保留原 block type，避免舊 XML 失效。
7. 為 library dependency 建立可由 CodeBridge Library Manager 檢查的 metadata。
8. 舊 pbm 凍結為 migration source，不再接受新 V1 模組。

## Catalog 與更新

CodeBridge 啟動後讀取 catalog，先驗證 CodeBridge runtime 版本，再使用本機已驗證 cache；需要更新時才下載。更新採原子切換，新版本載入或 contract test 失敗時繼續使用舊 active version。

Catalog 應提供 module version、URL、checksum、compatibility、dependencies 與發布時間。官方來源預設要求 HTTPS。CodeBridge 不直接把任意 URL 的 JavaScript 當成可信模組。

## 依賴與載入順序

runtime 固定執行：
1. validate manifest
2. validate compatibility/checksum
3. register locale messages
4. register blocks
5. register generators
6. merge toolbox
7. update workspace

拒絕重複 block type、重複 module id、缺少 generator、缺少 required core block、無效 toolbox reference 與不相容 API。

## 開發里程碑

### M1：Repository 與契約基礎
- 建立新 GitHub repository
- 建立 README、LICENSE、CONTRIBUTING 與 CI
- 定義 module.schema.json
- 建立模組模板與 contract test runner
- 定義 CodeBridge API compatibility 常數

### M2：舊 pbm migration
- 建立完整 block/generator inventory
- 匯入舊 piblockly_hw_blocks 為 temporary module
- 驗證 XML round-trip 與 code generation
- 修復 generator API 差異，不改公開 block type

### M3：領域拆分
- 拆分 sensors、actuators、servo、huskylens、music、picar
- 補齊雙語、Engineer style、tooltips 與 examples
- 宣告 library dependencies 與最低版本

### M4：發布與更新
- 產生 manifest.v2.json
- 產生 checksums 與 release metadata
- 設定 GitHub Pages
- 測試離線 cache、rollback 與版本不相容

## 測試與 CI

- manifest schema validation
- unique id 與 block type 檢查
- i18n key coverage
- toolbox reference coverage
- generator 存在與 return contract
- XML load/save round-trip
- golden Arduino code tests
- library dependency contract
- source mapping marker 不得殘留於 plain code
- CodeBridge compatibility matrix

## 排除範圍

- 新 repo 不包含 CodeBridge 主程式與核心語言積木。
- 不在第一階段支援執行任意 legacy 單檔 module。
- 不更改舊 pbm repository 作為遷移來源。
- 不將 Arduino Community Edition 當成模組 runtime 依賴。
