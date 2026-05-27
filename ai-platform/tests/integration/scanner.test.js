/**
 * Safe-Fail Testing Architecture — integration proof for Simplebeacon CLI.
 *
 * Proves:
 * 1. True positives — real leaks fail the gate
 * 2. Allowlist safety — scoped config passes on authorized exceptions
 * 3. Zero-mutation — scan never writes to source files
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const TOXIC_REPO = path.join(__dirname, '../fixtures/simplebeacon-toxic-fixtures');
const CLI_BIN = path.join(ROOT, 'packages/simplebeacon-cli/bin/simplebeacon.js');
const FULL_CONFIG = path.join(TOXIC_REPO, '.simplebeacon/config.json');
const DOCS_CONFIG = path.join(TOXIC_REPO, '.simplebeacon/docs-gate.config.json');

function runSimplebeacon(args, cwd = TOXIC_REPO) {
  return spawnSync(process.execPath, [CLI_BIN, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' }
  });
}

function combinedOutput(result) {
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

describe('SampleBeacon Security Core Integration Suite', () => {
  beforeAll(() => {
    expect(fs.existsSync(TOXIC_REPO)).toBe(true);
    expect(fs.existsSync(CLI_BIN)).toBe(true);
  });

  test('catches critical leak vectors and returns a non-zero exit code (true positives)', () => {
    const reportPath = path.join(require('os').tmpdir(), `simplebeacon-toxic-${Date.now()}.json`);

    const result = runSimplebeacon([
      'scan',
      '--path', TOXIC_REPO,
      '--config', FULL_CONFIG,
      '--gate',
      '--fail-on=high',
      '--format', 'json',
      '--output', reportPath
    ]);

    expect(result.status).not.toBe(0);

    expect(fs.existsSync(reportPath)).toBe(true);

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const issues = report.rawIssues || [];
    expect(report.projectRoot.replace(/\\/g, '/')).toMatch(/simplebeacon-toxic-fixtures$/);

    const serialized = JSON.stringify(issues);
    expect(issues.length).toBeGreaterThan(0);
    expect(serialized).toMatch(/aws-access-key|aws access key/i);
    expect(serialized).toMatch(/Fictional KPI|aws-access-key|production leak|sample-json|fixtures-path/i);
    expect(serialized).toMatch(/Production Leak|production leak|fixtures-path|sample-json/i);
    expect((report.severityCounts?.high || 0)).toBeGreaterThan(0);
    expect(report.gate?.pass).toBe(false);

    const text = combinedOutput(result);
    expect(text).toMatch(/Gate: FAIL|Gate failed/i);
  });

  test('passes when docs-only scope uses allowlist-safe configuration', () => {
    const result = runSimplebeacon([
      'scan',
      '--path', TOXIC_REPO,
      '--config', DOCS_CONFIG,
      '--gate',
      '--format', 'text'
    ]);

    expect(result.status).toBe(0);
    expect(combinedOutput(result)).toMatch(/Gate: PASS/i);
    expect(combinedOutput(result)).not.toMatch(/Gate: FAIL/i);
  });

  test('never alters, writes, or mutates targeted source code files (zero-mutation)', () => {
    const testFilePath = path.join(TOXIC_REPO, 'src/server/auth-mock.js');
    const originalContent = fs.readFileSync(testFilePath, 'utf8');
    const originalStats = fs.statSync(testFilePath);

    runSimplebeacon([
      'scan',
      '--path', TOXIC_REPO,
      '--config', FULL_CONFIG,
      '--gate',
      '--fail-on=high'
    ]);

    const postScanContent = fs.readFileSync(testFilePath, 'utf8');
    const postScanStats = fs.statSync(testFilePath);

    expect(postScanContent).toBe(originalContent);
    expect(postScanStats.mtimeMs).toBe(originalStats.mtimeMs);
    expect(postScanStats.size).toBe(originalStats.size);
  });
});
