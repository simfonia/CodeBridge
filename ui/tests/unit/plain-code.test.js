import { describe, expect, test } from 'vitest';
import { loadClassicScript } from '../support/classic-script.js';

const ID_MARKER = '// __BLOCKLY_ID:';
const ID_MARKER_END = '__';

/** 模擬 _core.js 註冊的 Blockly.Arduino marker 常數。 */
function createBlocklyStub() {
  return { Arduino: { ID_MARKER, ID_MARKER_END } };
}

async function loadPlainCode() {
  const sandbox = await loadClassicScript('src/lib/project/plain-code.js', {
    Blockly: createBlocklyStub()
  });
  return sandbox.CodeBridgePlainCode;
}

describe('plain code (marker 去除)', () => {
  test('statement marker 於行尾時被完整移除', async () => {
    const plainCode = await loadPlainCode();
    const marked = 'void setup() { ' + ID_MARKER + 'abc123' + ID_MARKER_END + '\n  pinMode(13, OUTPUT);\n}\n';
    expect(plainCode.strip(marked)).toBe('void setup() {\n  pinMode(13, OUTPUT);\n}\n');
  });

  test('value marker 的區塊註解被移除且不留行尾空白', async () => {
    const plainCode = await loadPlainCode();
    const marked = '  int x = 5; /* ' + ID_MARKER + 'v9' + ID_MARKER_END + ' */\n';
    expect(plainCode.strip(marked)).toBe('  int x = 5;\n');
  });

  test('同一行多個 marker 全部移除', async () => {
    const plainCode = await loadPlainCode();
    const marked = '  a(); ' + ID_MARKER + 'b1' + ID_MARKER_END + ' ' +
      ID_MARKER + 'b2' + ID_MARKER_END + '\n';
    expect(plainCode.strip(marked)).toBe('  a();\n');
  });

  test('strip 只移除標記，保留輸入原有的結尾換行（寫檔與貼上皆需要）', async () => {
    const plainCode = await loadPlainCode();
    const withNewline = 'void loop() { ' + ID_MARKER + 'l1' + ID_MARKER_END + '\n}\n';
    expect(plainCode.strip(withNewline).endsWith('}\n')).toBe(true);
    expect(plainCode.strip('void loop() {}')).toBe('void loop() {}');
  });

  test('輸出不含任何 marker 殘留', async () => {
    const plainCode = await loadPlainCode();
    const marked = [
      'void setup() { ' + ID_MARKER + 's1' + ID_MARKER_END,
      '  Serial.begin(9600);',
      '}',
      'void loop() { ' + ID_MARKER + 'l1' + ID_MARKER_END,
      '  int v = 1; /* ' + ID_MARKER + 'v1' + ID_MARKER_END + ' */',
      '}'
    ].join('\n');
    const result = plainCode.strip(marked);
    expect(result).not.toContain('__BLOCKLY_ID');
    expect(result).toBe('void setup() {\n  Serial.begin(9600);\n}\nvoid loop() {\n  int v = 1;\n}');
  });

  test('字串常數內的 marker 樣式不被破壞', async () => {
    const plainCode = await loadPlainCode();
    const marked = '  Serial.print("__BLOCKLY_ID: keep__");\n';
    expect(plainCode.strip(marked)).toBe('  Serial.print("__BLOCKLY_ID: keep__");\n');
  });

  test('extractIds 回傳 marker 中的 block id 順序', async () => {
    const plainCode = await loadPlainCode();
    const line = 'void loop() { ' + ID_MARKER + 'loop1' + ID_MARKER_END + '\n' +
      '  x = 1; /* ' + ID_MARKER + 'val1' + ID_MARKER_END + ' */\n';
    expect(plainCode.extractIds(line)).toEqual(['loop1', 'val1']);
  });

  test('缺少 Blockly 執行期時退回預設 marker', async () => {
    const sandbox = await loadClassicScript('src/lib/project/plain-code.js', {});
    const plainCode = sandbox.CodeBridgePlainCode;
    expect(plainCode.strip('void loop() { // __BLOCKLY_ID:z1__\n}')).toBe('void loop() {\n}');
  });
});
