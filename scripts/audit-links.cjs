'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'coming-soon');
const htmlFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
let issues = [];
let checked = 0;

for (const file of htmlFiles) {
  const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const matches = content.match(/href=["']([^"']+)["']/g) || [];
  for (const m of matches) {
    let href = m.replace(/^href=["']/, '').replace(/["']$/, '');
    if (href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    // Strip query strings and hash fragments
    href = href.split('?')[0].split('#')[0];
    if (!href) continue;
    const target = path.join(ROOT, href);
    checked++;
    if (!fs.existsSync(target)) {
      issues.push(`${file} -> MISSING: ${href}`);
    }
  }
}

const total = htmlFiles.length;
const valid = checked - issues.length;
process.stdout.write(JSON.stringify({ total, checked, valid, broken: issues }, null, 2) + '\n');
