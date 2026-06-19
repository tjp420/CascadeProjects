const fs = require('fs');
const path = require('path');

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

const TIME_PATTERNS = [
  { pattern: /15 \* 60 \* 1000/g, replacement: 'constants.RATE_LIMIT_WINDOW_MS' },
  { pattern: /60 \* 1000(?!\d)/g, replacement: 'constants.ONE_MINUTE_MS' },
  { pattern: /60 \* 60 \* 1000/g, replacement: 'constants.ONE_HOUR_MS' },
  { pattern: /24 \* 60 \* 60 \* 1000/g, replacement: 'constants.ONE_DAY_MS' },
  { pattern: /30 \* 24 \* 60 \* 60 \* 1000/g, replacement: 'constants.THIRTY_DAYS_MS' },
  { pattern: /5 \* 60 \* 1000/g, replacement: 'constants.FIVE_MINUTES_MS' },
  { pattern: /Date\.now\(\) \/ 1000/g, replacement: 'Math.floor(Date.now() / constants.MS_PER_SECOND)' },
  { pattern: /\/ 1000\b(?!\d)/g, replacement: '/ constants.MS_PER_SECOND' },
];

function needsImport(content) {
  return !content.includes('constants.cjs');
}

function addImport(content, importPath) {
  const lines = content.split('\n');
  let insertIndex = 0;
  let pastHeader = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!pastHeader && (trimmed.startsWith('#!') || trimmed.startsWith('//') || trimmed.startsWith('/**') || trimmed.startsWith('*') || trimmed.startsWith('*/') || trimmed === '')) {
      insertIndex = i + 1;
      continue;
    }
    pastHeader = true;
    if (trimmed.startsWith('const ') && trimmed.includes('require(')) {
      insertIndex = i + 1;
    } else if (trimmed === '') {
      insertIndex = i + 1;
    } else {
      break;
    }
  }
  lines.splice(insertIndex, 0, `const constants = require('${importPath}');`);
  return lines.join('\n');
}

function walk(dir, callback) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walk(full, callback);
    } else if (/\.(cjs|js)$/.test(entry.name)) {
      callback(full);
    }
  }
}

let totalFiles = 0;
let totalChanges = 0;

walk('C:/Users/Trevor/CascadeProjects/ai-platform/server', (file) => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  let changes = 0;

  for (const rule of TIME_PATTERNS) {
    const matches = content.match(rule.pattern);
    if (matches) {
      content = content.replace(rule.pattern, rule.replacement);
      changes += matches.length;
    }
  }

  if (changes > 0 && needsImport(content)) {
    const rel = path.relative(path.dirname(file), 'C:/Users/Trevor/CascadeProjects/ai-platform/server/config/constants.cjs');
    const importPath = rel.startsWith('..') ? rel : './' + rel;
    content = addImport(content, importPath);
    changes++;
  }

  if (changes > 0) {
    totalFiles++;
    totalChanges += changes;
    fs.writeFileSync(file, content, 'utf8');
    console.log(`✓ ${path.relative('C:/Users/Trevor/CascadeProjects/ai-platform', file)} (${changes} changes)`);
  }
});

console.log(`\nFixed ${totalFiles} files with ${totalChanges} total changes.`);
