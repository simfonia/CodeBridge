import { describe, expect, test } from 'vitest';
import { loadClassicScript } from '../support/classic-script.js';

/**
 * 序列繪圖的資料解析器單元測試。
 *
 * 驗證的是**格式契約**：`label:value`、CSV、TSV、純數值、布林、垃圾行。
 * 這是 plotter 最容易出錯的地方 —— 學生印出 `LED 已開啟` 時，
 * 圖表必須安靜地忽略它，而不是拋例外或畫出一條 y=NaN 的線。
 */

const SCRIPT = 'src/lib/plot/plot-parse.js';

/** 載入模組並取出公開 API（sandbox 上掛的是 `CodeBridgePlotParse`）。 */
async function loadParser() {
  const sandbox = await loadClassicScript(SCRIPT);
  return sandbox.CodeBridgePlotParse;
}

describe('序列繪圖：資料解析器', () => {
  test('公開 API 齊備', async () => {
    const parser = await loadParser();
    expect(typeof parser.parseLine).toBe('function');
    expect(typeof parser.createParser).toBe('function');
  });

  test('純數值沿用上一個標籤（Arduino IDE 行為）', async () => {
    const { createParser } = await loadParser();
    const parser = createParser();

    // 第一個純數值沒有前文，標籤退為 '1'。
    expect(parser.parseLine('23.5')).toEqual([
      { label: '1', value: 23.5, index: 0 }
    ]);
    // 純數值不該新增 series，沿用上一個標籤。
    expect(parser.parseLine('24.0')).toEqual([
      { label: '1', value: 24.0, index: 0 }
    ]);
  });

  test('label:value 建立具名 series', async () => {
    const { createParser } = await loadParser();
    const parser = createParser();

    expect(parser.parseLine('temp:23.5')).toEqual([
      { label: 'temp', value: 23.5, index: 0 }
    ]);
    expect(parser.parseLine('humid:60.2')).toEqual([
      { label: 'humid', value: 60.2, index: 0 }
    ]);
  });

  test('CSV 以序號為標籤，每欄一個 series', async () => {
    const { createParser } = await loadParser();
    const parser = createParser();

    expect(parser.parseLine('23.5, 40.2, 18.0')).toEqual([
      { label: '1', value: 23.5, index: 0 },
      { label: '2', value: 40.2, index: 1 },
      { label: '3', value: 18.0, index: 2 }
    ]);
  });

  test('tab 分隔與 CSV 等價', async () => {
    const { createParser } = await loadParser();
    const parser = createParser();

    expect(parser.parseLine('23.5\t40.2')).toEqual([
      { label: '1', value: 23.5, index: 0 },
      { label: '2', value: 40.2, index: 1 }
    ]);
  });

  test('逗號分隔的 label:value 各自成立', async () => {
    const { createParser } = await loadParser();
    const parser = createParser();

    expect(parser.parseLine('temp:23.5, humid:60.2')).toEqual([
      { label: 'temp', value: 23.5, index: 0 },
      { label: 'humid', value: 60.2, index: 1 }
    ]);
  });

  test('布林值映射為 1 / 0', async () => {
    const { createParser } = await loadParser();
    const parser = createParser();

    expect(parser.parseLine('on')).toEqual([{ label: '1', value: 1, index: 0 }]);
    expect(parser.parseLine('off')).toEqual([{ label: '1', value: 0, index: 0 }]);
    expect(parser.parseLine('true')).toEqual([{ label: '1', value: 1, index: 0 }]);
    expect(parser.parseLine('false')).toEqual([{ label: '1', value: 0, index: 0 }]);
  });

  test('接受負數與科學記號', async () => {
    const { createParser } = await loadParser();
    const parser = createParser();

    expect(parser.parseLine('-12.5')[0].value).toBe(-12.5);
    expect(parser.parseLine('1.2e3')[0].value).toBe(1200);
    expect(parser.parseLine('+.5')[0].value).toBe(0.5);
  });

  test('文字垃圾行被安靜忽略（不得拋例外）', async () => {
    const { createParser } = await loadParser();
    const parser = createParser();

    expect(parser.parseLine('LED 已開啟')).toEqual([]);
    expect(parser.parseLine('')).toEqual([]);
    expect(parser.parseLine('   ')).toEqual([]);
    expect(parser.parseLine('NaN')).toEqual([]);
    expect(parser.parseLine('inf')).toEqual([]);
    expect(parser.parseLine('hello, world')).toEqual([]);
  });

  test('混合行：可解析欄位保留，垃圾欄位以 null 斷線呈現', async () => {
    const { createParser } = await loadParser();
    const parser = createParser();

    // 整行全不可解析時才丟棄；只要有一欄有效就保留其餘為 null，
    // 避免 `23.5, LED 已開啟` 讓整個 sample 被丟掉。
    expect(parser.parseLine('23.5, 開啟了, 40.2')).toEqual([
      { label: '1', value: 23.5, index: 0 },
      { label: '2', value: null, index: 1 },
      { label: '3', value: 40.2, index: 2 }
    ]);
  });

  test('標籤含冒號時以最後一個冒號切分', async () => {
    const { createParser } = await loadParser();
    const parser = createParser();

    expect(parser.parseLine('a:b:3.5')).toEqual([
      { label: 'a:b', value: 3.5, index: 0 }
    ]);
  });

  test('reset 清掉「上一個標籤」狀態', async () => {
    const { createParser } = await loadParser();
    const parser = createParser();

    parser.parseLine('temp:23.5');
    expect(parser.parseLine('30.0')[0].label).toBe('temp');
    parser.reset();
    // 重置後退回序號標籤，避免上一次連線的 series 名稱污染新連線。
    expect(parser.parseLine('30.0')[0].label).toBe('1');
  });

  test('parseLine 對非字串輸入不拋例外', async () => {
    const { parseLine } = await loadParser();
    expect(parseLine(null)).toEqual([]);
    expect(parseLine(undefined)).toEqual([]);
    expect(parseLine(42)).toEqual([]);
  });
});
