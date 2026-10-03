#!/usr/bin/env node
/**
 * scripts/eol.mjs — CodeBridge 行尾（CRLF/LF）檢查與修復工具
 *
 * 【與 Cocoya 的差異 —— 不可直接照抄】
 * Cocoya 用 `* text=auto eol=crlf`（統一 CRLF）；**本專案刻意不同**：
 *   1. `.cbg` 專案檔**必須是 LF**（SPEC.md §3 格式規格），全專案統一 CRLF 會違反它。
 *   2. `ui/public/blockly/**` 是官方 UMD 資產，`VERSIONS.md` 以 bytes/SHA-256 鎖定，
 *      已用 `-text` 關閉行尾轉換；任何行尾變動都會讓 `blockly-assets.test.js` 紅燈。
 * 因此本工具的目標不是「全部 CRLF」，而是：
 *   - **一般文字檔**：與專案慣例一致（Windows CRLF）→ 檢查並修復
 *   - **.cbg**、**blockly 資產**：必須維持 LF / 位元組不變 → 只檢查不變更，變了要報錯
 *
 * 【為何需要】
 * `.gitattributes` 的 `text` 只在「經過 git 的路徑」生效。編輯器／Python／PowerShell
 * 直接寫檔不經過 git，工作區就會變成 LF，而 git 視為無差異 → 問題靜態累積。
 * 實測（2026-10-03 移植時）：214 個受追蹤檔中 24 個 w/lf、**6 個混合行尾**。
 * 混合行尾危害最大：同一檔案內不同行行為不一致。
 *
 * 【用法】
 *   node scripts/eol.mjs           # 檢查（不符則 exit 1）
 *   node scripts/eol.mjs --fix     # 修復（統一為 CRLF；.cbg 與 blockly 資產不動）
 *   node scripts/eol.mjs --list    # 診斷：分別列出「混合行尾」「純 LF」「必須 LF」
 *
 * 【自我驗證】以 `git ls-files --eol` 交叉比對，抓出本工具漏掃的檔案
 *              （沒有這道就會自以為全綠 —— 實作 Cocoya 版時正是靠它抓出三個漏網）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ============================================================
 * 掃描範圍：只掃本專案維護的原始碼／文件
 * ========================================================== */
const SCAN_DIRS = [
  'ui/src', 'ui/tests', 'src-tauri/src', 'scripts', 'resources',
  'libraries', 'modules', 'log', '.github',
  // 掃 src-tauri/ 根（交叉比對抓到的漏網：Cargo.toml/Cargo.lock 是受追蹤的真實檔案）。
  // 不列 src-tauri/icons —— Tauri 產生的資產，見 BYTE_LOCKED。
  'src-tauri',
];
const SCAN_ROOT_FILES = [
  'package.json', 'AGENTS.md', 'FILE_STRUCTURE.md', 'README.md', 'SPEC.md',
  '.gitignore', '.gitattributes', '.editorconfig',
];

/* ============================================================
 * 排除：自動產物 / vendored / 依賴
 * ========================================================== */
const SKIP_DIR_PARTS = new Set([
  'node_modules', 'target', 'dist', 'out', 'build', '__pycache__', '.git',
  'gen',        // Tauri 自動產生的 schema
  'backup',     // 歷史備份，依專案規範不得改寫
  'public',     // ui/public：含 blockly 官方資產（另見 MUST_LF / BYTE_LOCKED）
  'temp', 'temp_scripts',
  'test-results', 'playwright-report', '.vscode-test',
]);

/** 位元組鎖定／工具產生的資產：行尾一變就會產生雜訊或破壞 hash 驗證，必須完全跳過 */
const BYTE_LOCKED = [
  'ui/public/blockly',   // VERSIONS.md 以 bytes/SHA-256 鎖定（.gitattributes 已標 -text）
  'ui/src/highlight.min.js',
  'ui/src/python.min.js',
  'src-tauri/icons',     // Tauri CLI 產生的平台圖示（tauri icon 會重新產生）
];

/**
 * 必須維持 LF 的格式。
 * 目前只有 `.cbg` —— 這是 SPEC.md §3 明訂的格式規格（格式規格必須被工具保護）。
 *
 * ⚠️ 不要再憑印象往這裡加檔案。實作時曾誤把 Android icon XML 加進來，
 *   但 `src-tauri/icons/**` 是 **Tauri CLI 產生的資產**（隨 `tauri icon` 重新產生），
 *   專案規範從未要求它維持 LF —— 屬無憑據的假設，已移除並改列入 BYTE_LOCKED。
 */
const MUST_LF_EXT = new Set(['.cbg']);

/** 受檢查的文字檔副檔名 */
const TEXT_EXT = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.md', '.xml', '.html',
  '.css', '.py', '.rs', '.toml', '.yml', '.yaml', '.txt', '.lock', '.svg',
  '.cbg', '.gitignore', '.gitattributes', '.editorconfig',
]);

function isByteLocked(absPath) {
  const rel = path.relative(ROOT, absPath).replace(/\\/g, '/');
  return BYTE_LOCKED.some((b) => rel === b || rel.startsWith(b + '/'));
}

function shouldSkip(absPath) {
  const parts = path.relative(ROOT, absPath).split(path.sep);
  for (const p of parts.slice(0, -1)) {
    if (SKIP_DIR_PARTS.has(p)) return true;
  }
  const base = parts[parts.length - 1];
  if (base.endsWith('.min.js')) return true;      // vendored 壓縮資產
  return isByteLocked(absPath);
}

/** 是否為「必須 LF」的檔案（目前僅 .cbg，格式規格見 SPEC.md §3） */
function mustStayLf(absPath) {
  return MUST_LF_EXT.has(path.extname(absPath).toLowerCase());
}

function isTextFile(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext) return TEXT_EXT.has(ext);
  return file.startsWith('.') || file === 'package.json';
}

/**
 * 分析行尾（位元組層級，避免 utf-8 多位元組干擾：>=0x80 不會誤判為 \r）。
 * @returns {{style:'crlf'|'lf'|'mixed'|'empty', crlf:number, loneLf:number}}
 */
function analyze(filePath) {
  const buf = fs.readFileSync(filePath);
  const size = buf.length;
  if (size === 0) return { style: 'empty', crlf: 0, loneLf: 0 };
  let crlf = 0;
  let loneLf = 0;
  for (let i = 0; i < size; i++) {
    if (buf[i] === 0x0d) {
      if (buf[i + 1] === 0x0a) { crlf++; i++; }
    } else if (buf[i] === 0x0a) {
      loneLf++;
    }
  }
  let style = 'empty';
  if (crlf > 0 && loneLf > 0) style = 'mixed';
  else if (crlf > 0) style = 'crlf';
  else if (loneLf > 0) style = 'lf';
  return { style, crlf, loneLf };
}

/** 統一為 CRLF（先轉 LF 再轉 CRLF，避免重複加 \r） */
function toCrlf(filePath) {
  const buf = fs.readFileSync(filePath);
  const s = buf.toString('binary')
    .replace(/\r\n/g, '\n')
    .replace(/\n/g, '\r\n');
  fs.writeFileSync(filePath, Buffer.from(s, 'binary'));
}

/** 統一為 LF（.cbg 等必須 LF 的格式） */
function toLf(filePath) {
  const buf = fs.readFileSync(filePath);
  fs.writeFileSync(filePath, Buffer.from(buf.toString('binary').replace(/\r\n/g, '\n'), 'binary'));
}

function collect() {
  const out = new Set();
  const push = (abs) => {
    if (!fs.existsSync(abs)) return;
    if (!fs.statSync(abs).isFile()) return;
    if (!isTextFile(abs)) return;
    if (shouldSkip(abs)) return;
    out.add(abs);
  };
  for (const dir of SCAN_DIRS) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    const walk = (cur) => {
      for (const name of fs.readdirSync(cur)) {
        const p = path.join(cur, name);
        if (fs.statSync(p).isDirectory()) {
          if (SKIP_DIR_PARTS.has(name)) continue;
          walk(p);
        } else {
          push(p);
        }
      }
    };
    walk(abs);
  }
  for (const f of SCAN_ROOT_FILES) push(path.join(ROOT, f));
  return [...out];
}
/**
 * 自我驗證：以 `git ls-files --eol` 交叉比對，找出本工具漏掃的檔案。
 *
 * 為什麼需要：git 的判定（w/lf / w/crlf / w/mixed）是獨立於本工具的權威來源。
 * 兩者不一致 → 本工具的掃描範圍或副檔名清單有漏洞。沒有這道就會自以為全綠。
 * （Cocoya 版實作時正是靠這道抓出 ui/.eslintrc.json、Cargo.toml 等三個漏網。）
 */
function verifyAgainstGit(checkedFiles) {
  let raw;
  try {
    raw = execSync('git ls-files --eol', {
      cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
    });
  } catch {
    return; // 非 git 環境
  }
  const mine = new Set(checkedFiles.map((f) => path.relative(ROOT, f).replace(/\\/g, '/')));

  const missed = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    // 格式：<i/eol> <w/eol> <attr...>\t<path>
    const m = line.match(/^(\S+)\s+(\S+)\s+(.*?)\t(.+)$/);
    if (!m) continue;
    const [, , wEol, , p] = m;
    // 只找「應該是 CRLF 卻是 LF/mixed」的檔案（LF 在本專案是正常狀態之一）
    if (wEol !== 'w/lf' && wEol !== 'w/mixed') continue;
    if (p.endsWith('.cbg')) continue;                  // .cbg 必須 LF
    if (BYTE_LOCKED.some((b) => p === b || p.startsWith(b + '/'))) continue;
    if (p.endsWith('.min.js')) continue;               // vendored
    if (!mine.has(p)) missed.push(`${p}  (git: ${wEol})`);
  }

  if (missed.length) {
    console.log('');
    console.log('⚠️ 交叉比對：git 認定以下檔案工作區為 LF/mixed，但本工具未掃到：');
    missed.forEach((p) => console.log(`    ${p}`));
    console.log('   → 若確實應納入：更新 SCAN_DIRS / TEXT_EXT；若應排除：更新 BYTE_LOCKED。');
    console.log('     （無憑據的排除會讓真問題被永久忽略，請一併更新 AGENTS.md 行尾章節。）');
  }
}

function main() {
  const args = process.argv.slice(2);
  const doFix = args.includes('--fix');
  const doList = args.includes('--list');

  const files = collect();

  const mixed = [];      // 混合行尾：危害最大
  const lfOnly = [];     // 純 LF：與專案慣例不一致
  const badMustLf = [];  // 必須 LF 卻含 CRLF → 違反 SPEC.md §3

  for (const f of files) {
    const a = analyze(f);
    if (a.style === 'empty') continue;
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    const entry = { file: f, rel, ...a };
    if (mustStayLf(f)) {
      if (a.style === 'crlf' || a.style === 'mixed') badMustLf.push(entry);
      continue;
    }
    if (a.style === 'mixed') mixed.push(entry);
    else if (a.style === 'lf') lfOnly.push(entry);
  }

  if (doList) {
    console.log(`掃描 ${files.length} 個文字檔\n`);
    if (badMustLf.length) {
      console.log(`  ✗ 必須 LF 卻含 CRLF（違反 SPEC.md §3 .cbg 規格）：${badMustLf.length}`);
      badMustLf.forEach((p) => console.log(`      ${p.rel}  (CRLF ${p.crlf} / LF ${p.loneLf})`));
    }
    if (mixed.length) {
      console.log(`  ⚠ 混合行尾（同檔內 CRLF/LF 並存，危害最大）：${mixed.length}`);
      mixed.forEach((p) => console.log(`      ${p.rel}  (CRLF ${p.crlf} / LF ${p.loneLf})`));
    }
    console.log(`  純 LF（與專案 CRLF 慣例不一致）：${lfOnly.length}`);
    lfOnly.forEach((p) => console.log(`      ${p.rel}  (${p.loneLf} 行)`));
    return 0;
  }

  if (doFix) {
    let fixed = 0;
    for (const p of badMustLf) { toLf(p.file); fixed++; }        // .cbg 轉回 LF
    for (const p of [...mixed, ...lfOnly]) { toCrlf(p.file); fixed++; }
    console.log(`已修復 ${fixed} 個檔案`);
    if (fixed === 0) console.log('所有檔案行尾已符合本專案慣例。');
    return 0;
  }

  const totalBad = badMustLf.length + mixed.length + lfOnly.length;
  if (totalBad === 0) {
    console.log(`✓ 行尾檢查通過：${files.length} 個文字檔全部符合本專案慣例。`);
    verifyAgainstGit(files);
    return 0;
  }

  console.error(`✗ 行尾檢查失敗：${files.length} 個文字檔中有 ${totalBad} 個不符慣例。`);
  console.error('');
  if (badMustLf.length) {
    console.error('  [必須 LF 卻含 CRLF —— 違反 SPEC.md §3 的 .cbg 格式規格]');
    badMustLf.forEach((p) => console.error(`    ${p.rel}  (CRLF ${p.crlf} / LF ${p.loneLf})`));
    console.error('');
  }
  if (mixed.length) {
    console.error('  [混合行尾：同檔內 CRLF/LF 並存 —— 各行行為不一致，危害最大]');
    mixed.forEach((p) => console.error(`    ${p.rel}  (CRLF ${p.crlf} / LF ${p.loneLf})`));
    console.error('');
  }
  if (lfOnly.length) {
    console.error('  [純 LF：與專案 CRLF 慣例不一致]');
    lfOnly.forEach((p) => console.error(`    ${p.rel}  (${p.loneLf} 行)`));
    console.error('');
  }
  console.error('  修復方式：npm run eol:fix');
  console.error('  預防方式：.editorconfig（編輯器存檔時自動套用）');
  return 1;
}

process.exit(main());