import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const uiDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const blocklyDirectory = join(uiDirectory, 'public', 'blockly');
const modulesDirectory = join(uiDirectory, 'src', 'lib', 'blockly', 'modules');
const versionsPath = join(blocklyDirectory, 'VERSIONS.md');
const rowPattern = /^\| `([^`]+)` \| (\d+) \| `([A-F0-9]{64})` \|$/gm;
const blockPattern = /Blockly\.Blocks\[['"]([^'"]+)['"]\]/g;
const generatorPattern = /Blockly\.Arduino\.forBlock\[['"]([^'"]+)['"]\]/g;
const mutatorOnlyBlocks = new Set([
  'controls_if_elseif',
  'controls_if_else'
]);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await listFiles(path);
      nested.forEach((nestedPath) => files.push(nestedPath));
    } else {
      files.push(path);
    }
  }
  return files;
}

function toPosixPath(path) {
  return relative(blocklyDirectory, path).split(sep).join('/');
}

describe('Blockly runtime asset manifest', () => {
  test('every manifest hash and byte size matches the local file', async () => {
    const manifest = await readFile(versionsPath, 'utf8');
    const expectedEntries = [];
    for (const match of manifest.matchAll(rowPattern)) {
      expectedEntries.push({
        path: match[1],
        bytes: Number(match[2]),
        sha256: match[3]
      });
    }

    expect(expectedEntries.length).toBeGreaterThanOrEqual(10);

    for (const expected of expectedEntries) {
      const contents = await readFile(join(blocklyDirectory, expected.path));
      const actualSha256 = createHash('sha256').update(contents).digest('hex').toUpperCase();
      expect({ path: expected.path, bytes: contents.byteLength, sha256: actualSha256 }).toEqual({
        path: expected.path,
        bytes: expected.bytes,
        sha256: expected.sha256
      });
    }
  });

  test('manifest covers every published Blockly JavaScript asset', async () => {
    const manifest = await readFile(versionsPath, 'utf8');
    const manifestPaths = new Set(
      Array.from(manifest.matchAll(rowPattern), (match) => match[1])
    );
    const files = (await listFiles(blocklyDirectory))
      .filter((path) => path.endsWith('.js'))
      .map(toPosixPath)
      .sort();
    const missingFiles = files.filter((path) => !manifestPaths.has(path));
    expect(missingFiles).toEqual([]);
  });

  test('runtime contract stays on Blockly 13.3.0', async () => {
    const core = await readFile(join(blocklyDirectory, 'core', 'blockly.js'), 'utf8');
    expect(core).toContain('.VERSION="13.3.0"');
  });

  test('every module block has a generator unless explicitly allowed', async () => {
    const moduleFiles = (await readdir(modulesDirectory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    const blockTypes = new Set();
    const generatorTypes = new Set();

    for (const moduleName of moduleFiles) {
      const moduleDirectory = join(modulesDirectory, moduleName);
      const entries = await readdir(moduleDirectory, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
        const contents = await readFile(join(moduleDirectory, entry.name), 'utf8');
        for (const match of contents.matchAll(blockPattern)) {
          blockTypes.add(match[1]);
        }
        for (const match of contents.matchAll(generatorPattern)) {
          generatorTypes.add(match[1]);
        }
      }
    }

    const missingGenerators = Array.from(blockTypes)
      .filter((type) => !generatorTypes.has(type) && !mutatorOnlyBlocks.has(type))
      .sort();
    const orphanGenerators = Array.from(generatorTypes)
      .filter((type) => !blockTypes.has(type))
      .sort();

    expect({ missingGenerators, orphanGenerators }).toEqual({
      missingGenerators: [],
      orphanGenerators: []
    });
  });
});
