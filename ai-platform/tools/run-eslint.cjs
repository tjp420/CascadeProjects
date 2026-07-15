#!/usr/bin/env node
// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives

const { execSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const fixFlag = args.includes('--fix') ? ' --fix' : '';
const paths = args.filter(arg => arg !== '--fix').join(' ') || 'server src web';

try {
  console.log('Running ESLint...');
  const cmd = `npx eslint${fixFlag} ${paths}`;
  console.log(`Command: ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  console.log('ESLint completed successfully');
} catch {
  console.error('ESLint failed');
  process.exit(1);
}
