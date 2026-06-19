const fs = require('fs');
const path = require('path');

const CONSTANTS_PATH = '../../../ai-platform/server/config/constants.cjs';

const REPLACEMENTS = [
  { pattern: /\b1000\b(?!\s*\))/, replacement: 'constants.MS_PER_SECOND' },
  { pattern: /\b3000\b/, replacement: 'constants.DEFAULT_PORT' },
  { pattern: /\b5000\b/, replacement: 'constants.TIMEOUT_5S' },
  { pattern: /15\s*\*\s*60\s*\*\s*1000/, replacement: 'constants.RATE_LIMIT_WINDOW_MS' },
  { pattern: /60\s*\*\s*1000/, replacement: 'constants.ONE_MINUTE_MS' },
  { pattern: /60\s*\*\s*60\s*\*\s*1000/, replacement: 'constants.ONE_HOUR_MS' },
  { pattern: /24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/, replacement: 'constants.ONE_DAY_MS' },
  { pattern: /\b1024\b/, replacement: 'constants.BYTES_PER_KB' },
  { pattern: /\b65536\b/, replacement: 'constants.MAX_EXPORT_CHUNK' },
];

function walk(dir, callback) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) continue;
      walk(full, callback);
    } else if (/\.(js|cjs|mjs)$/.test(entry.name)) {
      callback(full);
    }
  }
}

let totalFiles = 0;
let totalChanges = 0;

walk('C:/Users/Trevor/CascadeProjects/packages/simplebeacon-cli/src', (file) => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  let changes = 0;

  // Skip if already imports constants
  const needsImport = !content.includes('constants.cjs');

  for (const rule of REPLACEMENTS) {
    const matches = content.match(rule.pattern);
    if (matches) {
      content = content.replace(rule.pattern, rule.replacement);
      changes += matches.length;
    }
  }

  if (changes > 0 && needsImport) {
    // Find a good insertion point after other requires
    const lines = content.split('\n');
    let insertIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('const ') && lines[i].includes('require(')) {
        insertIdx = i + 1;
      }
    }
    lines.splice(insertIdx, 0, `const constants = require('${CONSTANTS_PATH}');`);
    content = lines.join('\n');
    changes++;
  }

  if (changes > 0) {
    totalFiles++;
    totalChanges += changes;
    fs.writeFileSync(file, content, 'utf8');
    console.log(`✓ ${path.relative('C:/Users/Trevor/CascadeProjects', file)} (${changes})`);
  }
});

console.log(`\nFixed ${totalFiles} files with ${totalChanges} changes.`);
