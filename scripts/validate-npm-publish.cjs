#!/usr/bin/env node
/**
 * Post-Launch NPM Install Validation Script
 * Run after `npm publish --access public` to verify the live package payload.
 *
 * Usage: node scripts/validate-npm-publish.cjs
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PACKAGE_NAME = 'simplebeacon';
const EXPECTED_VERSION = require('../packages/simplebeacon-cli/package.json').version;

function run(cmd, opts = {}) {
    const result = spawnSync(cmd, { shell: true, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts });
    if (result.status !== 0) {
        console.error(`FAIL: ${cmd}`);
        console.error(result.stderr);
        return false;
    }
    console.log(`PASS: ${cmd}`);
    return true;
}

console.log(`Validating npm package ${PACKAGE_NAME}@${EXPECTED_VERSION}...\n`);

let ok = true;

// 1. npm view returns the expected version
const viewResult = spawnSync('npm', ['view', PACKAGE_NAME, 'version'], { encoding: 'utf8', shell: true });
if (viewResult.status === 0 && viewResult.stdout.trim() === EXPECTED_VERSION) {
    console.log(`PASS: npm view version = ${viewResult.stdout.trim()}`);
} else {
    console.error(`FAIL: Expected ${EXPECTED_VERSION}, got ${viewResult.stdout?.trim() || 'none'}`);
    ok = false;
}

// 2. Global install succeeds
ok = run(`npm install -g ${PACKAGE_NAME}@${EXPECTED_VERSION}`) && ok;

// 3. CLI binary is on PATH after global install
ok = run('npx simplebeacon --version') && ok;

// 4. Local install in temp dir succeeds
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-npm-test-'));
ok = run(`cd ${tmpDir} && npm init -y && npm install ${PACKAGE_NAME}@${EXPECTED_VERSION}`) && ok;

// 5. Verify package contents include critical files
const installedPath = path.join(tmpDir, 'node_modules', PACKAGE_NAME);
const requiredFiles = ['package.json', 'src/index.js', 'bin/simplebeacon.js'];
for (const f of requiredFiles) {
    const full = path.join(installedPath, f);
    if (fs.existsSync(full)) {
        console.log(`PASS: ${f} exists in installed package`);
    } else {
        console.error(`FAIL: ${f} missing from installed package`);
        ok = false;
    }
}

// 6. Run a quick scan to verify the binary works
const scanResult = spawnSync('node', [path.join(installedPath, 'bin/simplebeacon.js'), 'scan', '--help'], {
    encoding: 'utf8',
    cwd: tmpDir
});
if (scanResult.status === 0 && scanResult.stdout.includes('Usage')) {
    console.log('PASS: simplebeacon scan --help works');
} else {
    console.error('FAIL: simplebeacon scan --help did not return expected output');
    ok = false;
}

// Cleanup
fs.rmSync(tmpDir, { recursive: true, force: true });

console.log('\n' + (ok ? 'All npm publish validation checks PASSED' : 'Some npm publish validation checks FAILED'));
process.exit(ok ? 0 : 1);
