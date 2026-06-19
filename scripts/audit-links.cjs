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

console.log(`Audited ${htmlFiles.length} HTML files, ${checked} internal links checked`);
if (issues.length === 0) {
  console.log('All internal links valid');
} else {
  console.log('Broken links:');
  issues.forEach(i => console.log('  ', i));
}
