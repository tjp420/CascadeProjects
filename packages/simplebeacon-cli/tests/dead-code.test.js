const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DeadCodeScanner } = require('../src/analyzers/file-reduction/dead-code-scanner');

function makeTempProject(structure) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-dead-'));
  for (const [relPath, content] of Object.entries(structure)) {
    const fullPath = path.join(root, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  }
  return root;
}

test('DeadCodeScanner finds unimported export', async () => {
  const root = makeTempProject({
    'package.json': JSON.stringify({ main: 'index.js' }),
    'index.js': 'export const used = 1;\nexport const dead = 2;\nconsole.log(used);',
    'lib/helper.js': 'import { used } from "../index.js";\nconsole.log(used);',
  });

  const scanner = new DeadCodeScanner();
  const result = await scanner.scan(root);

  assert.ok(result.findings.some((f) => f.type === 'dead-export' && f.metadata.symbol === 'dead'));
  assert.ok(!result.findings.some((f) => f.metadata.symbol === 'used'));
});

test('DeadCodeScanner ignores default exports', async () => {
  const root = makeTempProject({
    'package.json': JSON.stringify({ main: 'index.js' }),
    'index.js': 'export default function main() {}',
    'lib/helper.js': 'import main from "../index.js";\nmain();',
  });

  const scanner = new DeadCodeScanner();
  const result = await scanner.scan(root);

  assert.ok(!result.findings.some((f) => f.metadata.symbol === 'default'));
});

test('DeadCodeScanner detects orphaned internal-only exports', async () => {
  const root = makeTempProject({
    'package.json': JSON.stringify({ main: 'index.js' }),
    'index.js': 'export const internal = 42;\nconsole.log(internal);',
    'lib/helper.js': 'export const helper = "ok";\n',
  });

  const scanner = new DeadCodeScanner();
  const result = await scanner.scan(root);

  assert.ok(
    result.findings.some((f) => f.type === 'orphaned-export' && f.metadata.symbol === 'internal')
  );
});

test('DeadCodeScanner skips built-in globals', async () => {
  const root = makeTempProject({
    'package.json': JSON.stringify({ main: 'index.js' }),
    'index.js': 'export const Array = 1;',
  });

  const scanner = new DeadCodeScanner();
  const result = await scanner.scan(root);

  assert.ok(!result.findings.some((f) => f.metadata.symbol === 'Array'));
});
