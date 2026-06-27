#!/usr/bin/env node
'use strict';
/**
 * Bulk Magic Number Fixer
 * Safely replaces common magic numbers with named constants from server/config/constants.cjs
 *
 * Usage:
 *   node scripts/bulk-fix-magic-numbers.js --dry-run   # Preview changes
 *   node scripts/bulk-fix-magic-numbers.js --apply    # Apply changes
 *
 * Only processes files under ai-platform/ (skips node_modules, .git, etc.)
 */

const fs = require('fs');
const path = require('path');

const TIMEOUT_12S_MS = 12000;

const REPLACEMENTS = [
  // Ports — only replace when used as port/default/fallback values, not in arbitrary math
  { pattern: /(?<!\d)(?:process\.env\.PORT \|\| |defaultPort = |port: |port = |:\/\/.*?:)(3000)(?!\d)/g, replacement: 'constants.DEFAULT_PORT', context: 'port', description: 'Default server port' },
  { pattern: /(?<!\d)(8080)(?!\d)/g, replacement: 'constants.AI_PROXY_PORT', context: 'port', description: 'AI proxy port' },
  { pattern: /(?<!\d)(54355)(?!\d)/g, replacement: 'constants.DASHBOARD_PORT', context: 'port', description: 'Dashboard port' },
  { pattern: /(?<!\d)(11434)(?!\d)/g, replacement: 'constants.OLLAMA_PORT', context: 'port', description: 'Ollama port' },
  { pattern: /(?<!\d)(5432)(?!\d)/g, replacement: 'constants.POSTGRES_PORT', context: 'port', description: 'Postgres port' },
  { pattern: /(?<!\d)(6379)(?!\d)/g, replacement: 'constants.REDIS_PORT', context: 'port', description: 'Redis port' },

  // Timeouts
  { pattern: /(?<!\d)(30000)(?!\d)/g, replacement: 'constants.TIMEOUT_30S', context: 'timeout', description: '30 second timeout (ms)' },
  { pattern: /(?<!\d)(120000)(?!\d)/g, replacement: 'constants.TIMEOUT_2M', context: 'timeout', description: '2 minute timeout (ms)' },
  { pattern: /(?<!\d)(60000)(?!\d)/g, replacement: 'constants.TIMEOUT_1M', context: 'timeout', description: '1 minute timeout (ms)' },
  { pattern: /(?<!\d)(15000)(?!\d)/g, replacement: 'constants.TIMEOUT_15S', context: 'timeout', description: '15 second timeout (ms)' },
  { pattern: /(?<!\d)(5000)(?!\d)/g, replacement: 'constants.TIMEOUT_5S', context: 'timeout', description: '5 second timeout (ms)' },
  { pattern: /(?<!\d)(8000)(?!\d)/g, replacement: 'constants.TIMEOUT_8S', context: 'timeout', description: '8 second timeout (ms)' },
  { pattern: new RegExp('(?<!\\d)(' + TIMEOUT_12S_MS + ')(?!\\d)', 'g'), replacement: 'constants.TIMEOUT_12S', context: 'timeout', description: '12 second timeout (ms)' },
  { pattern: /(?<!\d)(600000)(?!\d)/g, replacement: 'constants.TIMEOUT_10M', context: 'timeout', description: '10 minute timeout (ms)' },
  { pattern: /(?<!\d)(900000)(?!\d)/g, replacement: 'constants.TIMEOUT_15M', context: 'timeout', description: '15 minute timeout (ms)' },

  // Size / byte values
  { pattern: /(?<!\d)(1024)(?!\d)/g, replacement: 'constants.BYTES_PER_KB', context: 'size', description: 'Bytes per KB' },
  { pattern: /(?<!\d)(65536)(?!\d)/g, replacement: 'constants.MAX_EXPORT_CHUNK', context: 'size', description: '64 KB chunk size' },
  { pattern: /(?<!\d)(1048576)(?!\d)/g, replacement: 'constants.BYTES_PER_MB', context: 'size', description: 'Bytes per MB' },

  // Common limits
  { pattern: /(?<!\d)(2000)(?!\d)/g, replacement: 'constants.MAX_RATE_LIMIT', context: 'limit', description: 'Rate limit max' },
];

function getJsFiles(dir) {
  const results = [];
  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        walk(full);
      } else if (/\.(js|cjs|mjs)$/.test(entry.name)) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

function needsConstantsImport(content) {
  return !/require\(['"]\.\.\/config\/constants\.cjs['"]\)/.test(content)
    && !/require\(['"]\.\/config\/constants\.cjs['"]\)/.test(content);
}

function addConstantsImport(content, relativePath) {
  const importPath = relativePath.startsWith('.')
    ? relativePath.replace(/\\+/g, '/')
    : './config/constants.cjs';

  const lines = content.split('\n');
  let insertIndex = 0;
  let pastHeader = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // Skip shebang, SPDX, JSDoc, and blank lines
    if (!pastHeader && (trimmed.startsWith('#!') || trimmed.startsWith('//') || trimmed.startsWith('/**') || trimmed.startsWith('*') || trimmed.startsWith('*/') || trimmed === '')) {
      insertIndex = i + 1;
      continue;
    }
    pastHeader = true;
    // Keep going while we see require() statements
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

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const apply = args.includes('--apply');

  if (!dryRun && !apply) {
    process.stderr.write('Usage:\n');
    process.stderr.write('  node scripts/bulk-fix-magic-numbers.js --dry-run\n');
    process.stderr.write('  node scripts/bulk-fix-magic-numbers.js --apply\n');
    process.exit(1);
  }

  // Resolve ai-platform relative to this script (scripts/ is at repo root)
  const scriptDir = __dirname;
  const rootDir = path.join(scriptDir, '..', 'ai-platform');
  if (!fs.existsSync(rootDir)) {
    console.error('Expected ai-platform/ directory not found next to scripts/ folder.');
    process.exit(1);
  }

  const files = getJsFiles(rootDir);
  let totalReplacements = 0;
  let filesChanged = 0;

  console.log(`Scanning ${files.length} files...\n`);

  for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    let fileReplacements = 0;

    for (const rule of REPLACEMENTS) {
      const lines = content.split('\n');
      let replaced = false;
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].match(rule.pattern)) continue;
        if (lines[i].includes('constants.')) continue;

        // Skip if the number is inside a string literal (naive but effective)
        const line = lines[i];
        const stringRegex = /['"`]([^'`"]*?\d+[^'`"]*?)['"`]/g;
        let inString = false;
        let checkLine = line;
        let m;
        while ((m = stringRegex.exec(line)) !== null) {
          if (m[1].match(rule.pattern)) {
            inString = true;
            break;
          }
        }
        if (inString) continue;

        const oldLine = lines[i];
        lines[i] = lines[i].replace(rule.pattern, rule.replacement);
        if (lines[i] !== oldLine) {
          fileReplacements++;
          replaced = true;
        }
      }
      if (replaced) {
        content = lines.join('\n');
      }
    }

    if (fileReplacements > 0) {
      // Add constants import if missing
      if (needsConstantsImport(content)) {
        const rel = path.relative(path.dirname(file), path.join(rootDir, 'server', 'config', 'constants.cjs'));
        const importPath = rel.startsWith('..') ? rel : './' + rel;
        content = addConstantsImport(content, importPath);
        fileReplacements++; // Count the import addition
      }

      totalReplacements += fileReplacements;
      filesChanged++;

      if (dryRun) {
        console.log(`\n${path.relative(process.cwd(), file)} (${fileReplacements} changes)`);
        // Show a diff-like preview
        const origLines = original.split('\n');
        const newLines = content.split('\n');
        for (let i = 0; i < Math.max(origLines.length, newLines.length); i++) {
          if (origLines[i] !== newLines[i]) {
            if (origLines[i] != null) console.log(`- ${origLines[i]}`);
            if (newLines[i] != null) console.log(`+ ${newLines[i]}`);
          }
        }
      }

      if (apply) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`✓ ${path.relative(process.cwd(), file)} (${fileReplacements} changes)`);
      }
    }
  }

  console.log(`\n${dryRun ? 'Would modify' : 'Modified'} ${filesChanged} files with ${totalReplacements} total replacements.`);
  if (dryRun) {
    console.log('\nRun with --apply to write changes.');
  }
}

main();
