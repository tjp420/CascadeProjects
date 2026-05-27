/**
 * Run platform + monorepo Simplebeacon scans (with report output), publish trust-verification.json,
 * and mirror to deployments/signin-site when present.
 *
 * Usage: node tools/refresh-trust-snapshots.js [platformRoot] [monorepoRoot]
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const platformRoot = path.resolve(process.argv[2] || process.cwd());
const monorepoRoot = path.resolve(process.argv[3] || path.join(platformRoot, '..'));
const node = process.execPath;
const cli = path.join(platformRoot, 'packages/simplebeacon-cli/bin/simplebeacon.js');
const publishScript = path.join(platformRoot, 'tools/publish-trust-verification.js');
const publicTrust = path.join(platformRoot, 'public', 'trust-verification.json');
const signinTrust = path.join(monorepoRoot, 'deployments', 'signin-site', 'trust-verification.json');

function run(label, cwd, args) {
    const result = spawnSync(node, args, { cwd, stdio: 'inherit', env: process.env });
    if (result.status !== 0) {
        throw new Error(`${label} failed (exit ${result.status ?? 1})`);
    }
}

function scanReport(cwd, label) {
    run(label, cwd, [
        cli,
        'scan',
        '--path',
        '.',
        '--format',
        'json',
        '--output',
        '.simplebeacon/report.json',
        '--gate'
    ]);
}

function main() {
    if (!fs.existsSync(cli)) {
        throw new Error(`Simplebeacon CLI not found: ${cli}`);
    }

    console.log('Refreshing platform scan report…');
    scanReport(platformRoot, 'Platform scan');

    if (path.resolve(platformRoot) !== path.resolve(monorepoRoot)) {
        console.log('Refreshing monorepo scan report…');
        run('Monorepo scan', platformRoot, [path.join(platformRoot, 'tools/scan-monorepo-report.js'), platformRoot, monorepoRoot]);
    }

    console.log('Publishing trust verification…');
    run('Trust publish', platformRoot, [publishScript, platformRoot, monorepoRoot]);

    if (fs.existsSync(publicTrust) && fs.existsSync(path.dirname(signinTrust))) {
        fs.copyFileSync(publicTrust, signinTrust);
        console.log(`Mirrored trust artifact: ${signinTrust}`);
    }

    const payload = JSON.parse(fs.readFileSync(publicTrust, 'utf8'));
    const fiction = payload.fictionScope?.fictionJsonFilesScanned ?? payload.platform?.fictionJsonFilesScanned;
    console.log(`Done · verificationId ${payload.verificationId} · fiction JSON ${fiction ?? '—'}`);
}

main();
