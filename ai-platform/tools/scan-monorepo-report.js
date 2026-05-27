/**
 * Write monorepo-root .simplebeacon/report.json using ai-platform CLI + config.
 * Usage: node tools/scan-monorepo-report.js [platformRoot] [monorepoRoot]
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const platformRoot = path.resolve(process.argv[2] || process.cwd());
const monorepoRoot = path.resolve(process.argv[3] || path.join(platformRoot, '..'));

if (path.resolve(platformRoot) === path.resolve(monorepoRoot)) {
    console.log('Monorepo scan skipped — platform root equals monorepo root.');
    process.exit(0);
}

const cli = path.join(platformRoot, 'packages/simplebeacon-cli/bin/simplebeacon.js');

if (!fs.existsSync(cli)) {
    console.error(`CLI not found: ${cli}`);
    process.exit(1);
}

const result = spawnSync(
    process.execPath,
    [cli, 'scan', '--path', '.', '--format', 'json', '--output', '.simplebeacon/report.json', '--gate', '--fail-on', 'high'],
    { cwd: monorepoRoot, stdio: 'inherit', env: process.env }
);

process.exit(result.status === 0 ? 0 : result.status || 1);
