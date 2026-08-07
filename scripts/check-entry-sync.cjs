#!/usr/bin/env node
/**
 * Validates that dashboard entry HTML files and coming-soon pages have no
 * external script references for site-config.js, referral-capture.js, auth.js,
 * or app-links.js (which cause NS_BINDING_ABORTED on Firefox / 404 on Cloudflare).
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
  'coming-soon/public/pricing.html',
  'coming-soon/public/audit.html',
  'coming-soon/public/certificate-upload.html',
  'coming-soon/public/community.html',
  'coming-soon/public/contact.html',
  'coming-soon/public/roadmap.html',
];

const FORBIDDEN_PATTERNS = [
  /<script\s+src=["']\/?site-config\.js(\?[^"']*)?["'][^>]*>\s*<\/script>/i,
  /<script\s+src=["']\/?js-es2018\/referral-capture\.js["'][^>]*>\s*<\/script>/i,
  /<script\s+src=["']\/?js-es2018\/auth\.js["'][^>]*>\s*<\/script>/i,
  /<script\s+src=["']app-links\.js(\?[^"']*)?["'][^>]*>\s*<\/script>/i,
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
  console.error('Inline site-config.js, app-links.js, auth.js, and referral-capture.js directly in the HTML instead.');
  process.exit(1);
}

console.log('All entry files are self-contained (no external site-config.js, app-links.js, auth.js, or referral-capture.js references).');
process.exit(0);
