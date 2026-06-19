#!/usr/bin/env node
/**
 * Remove duplicate JSDoc blocks from files that got hit by the buggy bulk script.
 */
const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const APPLY = process.argv.includes('--apply');

if (!DRY_RUN && !APPLY) {
  console.log('Usage: node dedupe-jsdoc.js --dry-run | --apply');
  process.exit(1);
}

const TARGET_DIRS = [
  path.join(__dirname, '..', 'ai-platform', 'server'),
  path.join(__dirname, '..', 'ai-platform', 'src'),
  path.join(__dirname, '..', 'ai-platform', 'packages')
];

const EXCLUDED = ['node_modules', '.git', 'dist', 'build'];

function getJsFiles(dir) {
  const results = [];
  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (EXCLUDED.includes(entry.name)) continue;
        walk(full);
      } else if (/\.(js|cjs|mjs)$/.test(entry.name)) {
        results.push(full);
      }
    }
  }
  if (fs.existsSync(dir)) walk(dir);
  return results;
}

function dedupeJsdoc(content) {
  const lines = content.split('\n');
  const out = [];
  let prevWasJsdocEnd = false;
  let removed = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // If current line starts a JSDoc block and previous line was also a JSDoc end,
    // skip this whole block until we find the next end
    if (trimmed.startsWith('/**') && prevWasJsdocEnd) {
      // Skip lines until we find the end of this duplicate block
      let j = i;
      while (j < lines.length && !lines[j].trim().endsWith('*/')) {
        j++;
      }
      removed += (j - i + 1);
      i = j; // skip the whole block
      continue;
    }
    out.push(lines[i]);
    prevWasJsdocEnd = trimmed.endsWith('*/');
  }

  return { content: out.join('\n'), removed };
}

function main() {
  const files = [];
  for (const dir of TARGET_DIRS) {
    files.push(...getJsFiles(dir));
  }

  let totalFiles = 0;
  let totalRemoved = 0;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const result = dedupeJsdoc(content);
    if (result.removed > 0) {
      totalFiles++;
      totalRemoved += result.removed;
      if (DRY_RUN) {
        console.log(`Would dedupe ${path.relative(process.cwd(), file)} (-${result.removed} lines)`);
      }
      if (APPLY) {
        fs.writeFileSync(file, result.content, 'utf8');
        console.log(`✓ ${path.relative(process.cwd(), file)} (-${result.removed} lines)`);
      }
    }
  }

  console.log(`\n${DRY_RUN ? 'Would fix' : 'Fixed'} ${totalFiles} files, removed ${totalRemoved} duplicate JSDoc lines.`);
}

main();
