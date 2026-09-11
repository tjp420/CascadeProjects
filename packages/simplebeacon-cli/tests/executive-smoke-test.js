const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

test('Executive Export Pipeline Smoke Test', async (t) => {
  const fixturePath = path.join(__dirname, 'fixtures', 'minimal-smoke-scan.json');
  const targetOutputDir = path.resolve(path.join(__dirname, 'test-executive-vault'));
  const successFile = path.join(targetOutputDir, '_SUCCESS');
  const markdownReport = path.join(targetOutputDir, 'EXECUTIVE-REPORT.md');

  // Defensive: fixture should be present (checked-in minimal fixture)
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Smoke test fixture missing: ${fixturePath}`);
  }

  // Ensure clean boundary footprints before execution loop starts
  if (fs.existsSync(targetOutputDir)) {
    fs.rmSync(targetOutputDir, { recursive: true, force: true });
  }

  await t.test('1. Pipeline execution loop terminates successfully', () => {
    execSync(`node scripts/generate-executive-from-report.js ${fixturePath} ${targetOutputDir}`, {
      env: process.env,
      stdio: 'pipe',
    });

    assert.ok(fs.existsSync(targetOutputDir), 'Output directory space not generated.');
  });

  await t.test('2. Atomic execution invariant anchors exist (_SUCCESS)', () => {
    assert.ok(fs.existsSync(successFile), 'Pipeline atomic contract error: _SUCCESS anchor missing.');
  });

  await t.test('3. Document projection segments conform to Option B mapping rules', () => {
    const content = fs.readFileSync(markdownReport, 'utf8');

    // Assert that the human review brief includes a Findings/Active Production Boundary header
    assert.match(content, /(## Findings|Active Production Boundary Issues)/i, 'Markdown missing Findings or Active Production Boundary header.');

    // Assert that the collapsed disclosure loop correctly handles zero-vulnerability states
    assert.match(content, /No active supply-chain compromises/i, 'Renderer did not output expected Option B empty supply chain fallback string.');
    assert.match(content, /<details>/i, 'Noise suppression disclosure boundary block is missing.');
  });

  // Post-Execution Invariant: Clean up transient tracking folders
  if (fs.existsSync(targetOutputDir)) {
    fs.rmSync(targetOutputDir, { recursive: true, force: true });
  }
});
