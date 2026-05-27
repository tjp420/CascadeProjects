#!/usr/bin/env node
/**
 * Run ESLint on platform lint targets (only directories that exist).
 * Keeps npm scripts aligned with server/lib/codebase-analyzer ESLINT_TARGET_DIRS.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { resolveEslintTargets } = require('../server/lib/codebase-analyzer');

const root = path.join(__dirname, '..');
const eslintBin = path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js');
const configPath = path.join(root, 'eslint.config.js');

const targets = resolveEslintTargets(root);

if (!targets.length) {
    console.error('No ESLint target directories found under', root);
    process.exit(1);
}

if (!fs.existsSync(eslintBin)) {
    console.error('ESLint is not installed. Run npm install in ai-platform first.');
    process.exit(1);
}

const extraArgs = process.argv.slice(2);
const args = ['--config', configPath, ...targets, ...extraArgs];

execFileSync(process.execPath, [eslintBin, ...args], {
    cwd: root,
    stdio: 'inherit',
    env: process.env
});
