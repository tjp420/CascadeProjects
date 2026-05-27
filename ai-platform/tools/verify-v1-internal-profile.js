#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const checks = [];

function pass(label, detail) {
    checks.push({ label, ok: true, detail });
}

function fail(label, detail) {
    checks.push({ label, ok: false, detail });
}

function warn(label, detail) {
    checks.push({ label, ok: true, warn: true, detail });
}

if (fs.existsSync(path.join(ROOT, '.env.v1-internal.example'))) {
    pass('v1-internal env template', '.env.v1-internal.example');
} else {
    fail('v1-internal env template', 'missing .env.v1-internal.example');
}

if (fs.existsSync(path.join(ROOT, 'docs/v1-internal-runbook.md'))) {
    pass('deploy runbook', 'docs/v1-internal-runbook.md');
} else {
    fail('deploy runbook', 'missing docs/v1-internal-runbook.md');
}

if (fs.existsSync(path.join(ROOT, 'web/simplebeacon-dashboard/js/components/LoginModal.js'))) {
    pass('SPA login modal', 'LoginModal.js');
} else {
    fail('SPA login modal', 'missing LoginModal.js');
}

if (fs.existsSync(path.join(ROOT, 'web/simplebeacon-dashboard/js/services/authService.js'))) {
    pass('SPA auth service', 'authService.js');
} else {
    fail('SPA auth service', 'missing authService.js');
}

if (fs.existsSync(path.join(ROOT, 'scripts/deploy-simplebeacon.sh'))) {
    pass('production deploy script', 'scripts/deploy-simplebeacon.sh');
} else {
    fail('production deploy script', 'missing deploy script');
}

const localEnv = path.join(ROOT, '.env.v1-internal');
if (fs.existsSync(localEnv)) {
    const { readEnvFileFlags, isConfiguredSecret } = require('../server/lib/code-roadmap-generator');
    const flags = readEnvFileFlags(localEnv);
    if (
        flags?.requireAuth
        && (
            (isConfiguredSecret(flags.jwtSecret) && isConfiguredSecret(flags.jwtRefreshSecret))
            || flags.allowDevEphemeralSecrets === 'true'
        )
    ) {
        pass('local v1-internal env', '.env.v1-internal configured');
    } else {
        warn('local v1-internal env', '.env.v1-internal exists but JWT secrets need configuration');
    }
} else {
    warn('local v1-internal env', 'copy .env.v1-internal.example → .env.v1-internal for local auth testing');
}

const coverageSummary = path.join(ROOT, 'coverage/dashboard/coverage-summary.json');
if (fs.existsSync(coverageSummary)) {
    try {
        const summary = JSON.parse(fs.readFileSync(coverageSummary, 'utf8'));
        pass('Istanbul coverage artifact', `line ${summary.total?.lines?.pct ?? 'n/a'}%`);
    } catch (error) {
        fail('Istanbul coverage artifact', error.message);
    }
} else {
    fail('Istanbul coverage artifact', 'run npm run test:coverage');
}

try {
    execSync('npm run verify:v1-internal', { cwd: ROOT, stdio: 'pipe' });
    pass('REQUIRE_AUTH integration tests', 'phase2-integration.test.js');
} catch (error) {
    fail('REQUIRE_AUTH integration tests', error.stderr?.toString() || error.message);
}

console.log('=== v1.0-internal profile checks ===');
for (const check of checks) {
    const tag = check.ok ? (check.warn ? 'WARN' : 'OK ') : 'FAIL';
    console.log(`${tag}  ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
}

const blocking = checks.filter((check) => !check.ok);
if (blocking.length) {
    process.exitCode = 1;
}
