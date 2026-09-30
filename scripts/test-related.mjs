/**
 * scripts/test-related.mjs
 * ---------------------------------------------------------------------------
 * L0 開發守門：依「本次改動的檔案」自動挑出最少的必要測試並執行。
 *
 * 設計移植自 cocoya `scripts/test-related.cjs`，但因本專案同時有
 * Vitest 單元測試與 Playwright E2E，挑選規則多一層「是否需要升級到 E2E」的判斷。
 *
 * 用法：
 *   npm run test:fast                              → 自動分析 git 變更
 *   npm run test:fast -- ui/src/lib/arduino/x.js   → 指定檔案（可多個）
 *   node scripts/test-related.mjs --dry            → 只列出會跑哪些測試
 *   node scripts/test-related.mjs --e2e            → 允許升級到 Playwright（預設開啟）
 *   node scripts/test-related.mjs --unit-only       → 強制不跑 E2E（迭代預設行為更快的路徑）
 *
 * 量測基準（2026-09-30 CB-T2 後）：
 *   - 單元測試全量 `npm run test:unit`：261 例 / 約 0.7s
 *   - Playwright 全量：需 Edge + vite server，`workers:1`，數分鐘
 *   → 因此「每次改完碼都跑 npm test」是不可負擔的成本，必須分層。
 * ---------------------------------------------------------------------------
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UI = path.join(ROOT, 'ui');
const UNIT_DIR = 'tests/unit';
const E2E_BLOCKLY = ['tests/e2e/blockly-runtime.spec.js', 'tests/e2e/blockly-migration.spec.js'];
const E2E_STYLE = ['tests/e2e/theme-runtime.spec.js'];

/** 取得本次需要關注的檔案清單（相對 repo 根、forward slash）。 */
function collectChangedFiles(argv) {
  const explicit = argv.filter((a) => !a.startsWith('--'));
  if (explicit.length) return explicit.map((p) => p.replace(/\\/g, '/'));
  const git = (args) => {
    const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
    return r.status === 0 ? r.stdout.trim().split(/\r?\n/).filter(Boolean) : [];
  };
  return [...new Set([...git(['diff', '--name-only', 'HEAD']), ...git(['ls-files', '--others', '--exclude-standard'])])]
    .map((p) => p.replace(/\\/g, '/'));
}

/** 建立「測試檔名 → 相對於 ui/ 的路徑」索引（遞迴掃描 tests/unit）。 */
let _unitIndex = null;
function unitIndex() {
  if (_unitIndex) return _unitIndex;
  _unitIndex = new Map();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.name.endsWith('.test.js')) {
        _unitIndex.set(entry.name, path.relative(UI, abs).replace(/\\/g, '/'));
      }
    }
  };
  walk(path.join(UI, UNIT_DIR));
  return _unitIndex;
}

function selectTests(files, { allowE2E }) {
  const unit = new Set();
  const e2e = new Set();
  const reasons = new Map();
  const hints = [];
  const add = (set, target, why) => {
    if (!reasons.has(target)) reasons.set(target, why);
    set.add(target);
  };

  for (const file of files) {
    if (!file.startsWith('ui/')) {
      if (/^src-tauri\/.*\.rs$/.test(file)) hints.push('Rust 變更 → 另跑 `npm run cargo:check`');
      else if (/^src\/.*\.ts$/.test(file)) hints.push('VSIX/TS 變更 → 另跑型別檢查');
      else if (/\.py$/.test(file)) hints.push('Python 變更 → 另跑 `python -m py_compile` 該檔');
      continue;
    }
    const rel = file.slice(3); // 去掉 ui/
    const dir = path.posix.dirname(rel);
    const base = path.posix.basename(rel).replace(/\.test\.js$/, '').replace(/\.(js|mjs|css|html|json|xml)$/, '');

    // 0) 改的就是測試檔本身 → 它自己就是該跑的測試（否則會被誤判為「沒有對應測試」）
    if (rel.endsWith('.test.js')) {
      add(unit, rel, `變更的是測試檔本身：${file}`);
      continue;
    }

    // 1) 同名單元測試優先。
    //    注意：CodeBridge 的產品檔（ui/src/**）與測試檔（ui/tests/unit/**）分屬不同樹，
    //    因此必須在整個 tests/unit 遞迴比對檔名，不能套用「同目錄」規則。
    const same = unitIndex().get(`${base}.test.js`);
    if (same) add(unit, same, `同名單元測試：${file}`);

    // 2) Blockly 模組 → 升級 E2E 契約
    if (/^src\/lib\/blockly\//.test(rel) || /_blocks\.js$|_generators?\.js$|toolbox\.xml$/.test(rel)) {
      add(unit, `${UNIT_DIR}/blockly-assets.test.js`, `Blockly 資源契約：${file}`);
      if (allowE2E) for (const s of E2E_BLOCKLY) add(e2e, s, `Blockly 模組升級 E2E：${file}`);
    }

    // 3) 樣式 / 主題 → theme-runtime
    if (/\.css$/.test(rel) || /theme/i.test(rel)) {
      if (allowE2E) for (const s of E2E_STYLE) add(e2e, s, `樣式/主題變更：${file}`);
    }

    // 4) 這個檔案本身沒被任何規則涵蓋時明示（須逐檔判斷，不能看全域是否已有測試）
    const before = unit.size + e2e.size;
    if (unit.size + e2e.size === before) {
      hints.push(`${file} 沒有對應測試；若此變更影響行為，請補測試（AGENTS.md 規定新增測試是必要工作）`);
    }
  }
  return { unit, e2e, reasons, hints };
}

function runVitest(files) {
  const args = ['vitest', 'run', ...files];
  const r = spawnSync('npx', args, { cwd: UI, encoding: 'utf8', shell: true, maxBuffer: 32 * 1024 * 1024 });
  const out = `${r.stdout || ''}\n${r.stderr || ''}`;
  const summary = out.split(/\r?\n/).filter((l) => /(Tests|Test Files|Duration)\s/.test(l) || /^\s*×|FAIL/.test(l));
  console.log(`[vitest] ${files.length} 檔 →`);
  console.log(summary.slice(0, 20).join('\n') || '(無摘要)');
  return r.status === 0;
}

function runPlaywright(files) {
  const r = spawnSync('npx', ['playwright', 'test', ...files], { cwd: UI, encoding: 'utf8', shell: true, maxBuffer: 32 * 1024 * 1024 });
  const out = `${r.stdout || ''}\n${r.stderr || ''}`;
  const summary = out.split(/\r?\n/).filter((l) => /passed|failed|Error/.test(l));
  console.log(`[playwright] ${files.length} spec →`);
  console.log(summary.slice(0, 20).join('\n') || '(無摘要)');
  return r.status === 0;
}

function main() {
  const argv = process.argv.slice(2);
  const dry = argv.includes('--dry');
  const allowE2E = !argv.includes('--unit-only');
  const files = collectChangedFiles(argv);
  if (!files.length) {
    console.log('沒有偵測到任何變更檔。全量守門請用：npm run test:unit');
    return 0;
  }
  const { unit, e2e, reasons, hints } = selectTests(files, { allowE2E });
  console.log(`變更檔案 ${files.length} 個：${files.slice(0, 8).join(', ')}${files.length > 8 ? ' …' : ''}`);
  for (const t of [...unit, ...e2e]) console.log(`  + ${t}  ← ${reasons.get(t)}`);
  hints.forEach((h) => console.log(`  ! ${h}`));
  if (dry) return 0;
  let ok = true;
  if (unit.size) ok = runVitest([...unit]) && ok;
  if (e2e.size) ok = runPlaywright([...e2e]) && ok;
  if (!unit.size && !e2e.size) console.log('未匹配到測試；若不確定，請跑：npm run test:unit');
  return ok ? 0 : 1;
}

process.exit(main());
