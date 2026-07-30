/**
 * Install git / Husky hooks for local Simplebeacon gates (Community tier).
 */

const fs = require('fs');
const path = require('path');
const { withTransactionSync } = require('./lib/transaction-manager');
const { writeManagedFileSync } = require('./lib/safe-write');
const { validateGitHook, validateNotEmpty } = require('./lib/file-validator');
const { sanitizePath } = require('./lib/path-sanitizer');

const HOOK_TYPES = new Set(['pre-commit', 'pre-push']);

function buildHookScript(type, { failOn = 'high', withJest = false, fix = false, secretsOnly = false } = {}) {
    const secretsCmd = 'npx simplebeacon secrets-gate --path .';
    const scanArgs = [
        'scan',
        '--gate',
        `--fail-on ${failOn}`
    ];
    if (withJest || type === 'pre-push') {
        scanArgs.push('--with-jest');
    }

    const fullScanCmd = fix
        ? 'npx simplebeacon fix . --dry-run'
        : `npx simplebeacon ${scanArgs.join(' ')}`;

    const bodyLines = [];
    if (type === 'pre-commit') {
        bodyLines.push('echo "Simplebeacon staged secrets gate..."', secretsCmd);
    }
    if (!secretsOnly || type !== 'pre-commit') {
        bodyLines.push(`echo "Simplebeacon ${type}..."`, fullScanCmd);
    }
    bodyLines.push(`echo "Simplebeacon ${type} passed"`);

    return `#!/usr/bin/env sh
# Simplebeacon ${type} — Community tier local gate
# https://www.npmjs.com/package/simplebeacon
set -e
${bodyLines.join('\n')}
`;
}

function resolveHookTarget(root, type, preferHusky) {
    const huskyDir = path.join(root, '.husky');
    const gitHooksDir = path.join(root, '.git', 'hooks');

    if (preferHusky || fs.existsSync(huskyDir)) {
        return { hookPath: path.join(huskyDir, type), kind: 'husky' };
    }
    if (fs.existsSync(gitHooksDir)) {
        return { hookPath: path.join(gitHooksDir, type), kind: 'git' };
    }
    return {
        hookPath: path.join(root, '.simplebeacon', 'hooks', type),
        kind: 'manual'
    };
}

function installSimplebeaconHook(root, options = {}) {
    const projectRoot = sanitizePath(root || process.cwd(), root || process.cwd());
    const type = options.type || 'pre-commit';
    if (!HOOK_TYPES.has(type)) {
        throw new Error(`Invalid hook type "${type}" — use pre-commit or pre-push`);
    }

    const dryRun = Boolean(options.dryRun);
    const failOn = options.failOn || 'high';
    const withJest = Boolean(options.withJest);
    const fix = Boolean(options.fix);
    const secretsOnly = Boolean(options.secretsOnly);
    const preferHusky = Boolean(options.preferHusky);
    const script = buildHookScript(type, { failOn, withJest, fix, secretsOnly });
    const { hookPath, kind } = resolveHookTarget(projectRoot, type, preferHusky);

    if (dryRun) {
        return {
            hookPath,
            kind,
            type,
            manual: kind === 'manual',
            dryRun: true,
            plannedActions: [
                { action: 'mkdir', path: path.dirname(hookPath) },
                {
                    action: fs.existsSync(hookPath) ? 'overwrite' : 'create',
                    path: hookPath
                }
            ]
        };
    }

    return withTransactionSync((transaction) => {
        const writeResult = writeManagedFileSync(hookPath, script, {
            mode: 0o755,
            force: true,
            transaction,
            validators: [validateNotEmpty, validateGitHook]
        });

        return {
            hookPath,
            kind,
            type,
            manual: kind === 'manual',
            backupPath: writeResult.backupPath || null
        };
    });
}

module.exports = {
    HOOK_TYPES,
    buildHookScript,
    installSimplebeaconHook
};
