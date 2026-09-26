import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const uiDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * 以 vm context 執行瀏覽器 classic script。
 *
 * CodeBridge 的前端模組是 classic script（掛在 window 上），不是 ESM，
 * 因此單元測試以 sandbox 方式載入，取得執行後掛在 sandbox 上的公開 API。
 */
export async function loadClassicScript(relativePath, globals = {}) {
  const path = join(uiDirectory, relativePath);
  const code = await readFile(path, 'utf8');
  const sandbox = { console, setTimeout, clearTimeout, ...globals };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: path });
  return sandbox;
}

/** 建立 in-memory localStorage 取代瀏覽器 API，供狀態管理單元測試使用。 */
export function createMemoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    get size() {
      return data.size;
    },
    snapshot: () => Object.fromEntries(data.entries())
  };
}
