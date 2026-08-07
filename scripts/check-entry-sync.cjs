#!/usr/bin/env node
/**
 * Validates that dashboard entry HTML files have no external script references
 * for site-config.js or referral-capture.js (which 404 on Cloudflare Pages).
 *
 * Run: node scripts/check-entry-sync.cjs
 * Exit 0 = pass, exit 1 = fail
 */
const fs = require('fs');
const path = require('path');

const ENTRY_FILES = [
  'coming-soon/public/dashboard/__entry',
  'coming-soon/public/dashboard/entry-20260806.html',
  'coming-soon/public/dashboard/index.html',
  'coming-soon/public/app/__entry',
  'coming-soon/public/app/entry-20260806.html',
  'ai-platform/web/simplebeacon-dashboard/index.html',
];

const FORBIDDEN_PATTERNS = [
  /<script\s+src="\/site-config\.js\?v=\d+"/,
  /<script\s+src="\/js-es2018\/referral-capture\.js\?v=\d+"/,
];

let failures = 0;

for (const file of ENTRY_FILES) {
  const fullPath = path.join(__dirname, '..', file);
  if (!fs.existsSync(fullPath)) continue;

  const content = fs.readFileSync(fullPath, 'utf8');
  for (const pattern of FORBIDDEN_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      console.error(`FAIL: ${file} contains external script reference: ${match[0]}`);
      failures++;
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} entry file(s) have external script references that will 404 on Cloudflare Pages.`);
  console.error('Inline site-config.js and referral-capture.js directly in the HTML instead.');
  process.exit(1);
}

console.log('All entry files are self-contained (no external site-config.js or referral-capture.js references).');
process.exit(0);
