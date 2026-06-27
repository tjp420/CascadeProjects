#!/usr/bin/env node
'use strict';
/**
 * Bulk JSDoc Fixer
 * Adds minimal JSDoc comments to exported functions/classes/arrow functions
 * that lack preceding documentation.
 *
 * Usage:
 *   node scripts/bulk-fix-jsdoc.js --dry-run
 *   node scripts/bulk-fix-jsdoc.js --apply
 *
 * Focuses on ai-platform/server, ai-platform/src, ai-platform/packages.
 * Skips web/ dashboard components by default unless --include-web is passed.
 * simplebeacon:production-leak-intent — Regex pattern examples in comments (example, Example) are not exports; file has no module.exports.
 */

const fs = require('fs');
const path = require('path');

const INCLUDE_WEB = process.argv.includes('--include-web');
const DRY_RUN = process.argv.includes('--dry-run');
const APPLY = process.argv.includes('--apply');

if (!DRY_RUN && !APPLY) {
  process.stderr.write('Usage:\n');
  process.stderr.write('  node scripts/bulk-fix-jsdoc.js --dry-run [--include-web]\n');
  process.stderr.write('  node scripts/bulk-fix-jsdoc.js --apply  [--include-web]\n');
  process.exit(1);
}

const TARGET_DIRS = [
  path.join(__dirname, '..', 'ai-platform', 'server'),
  path.join(__dirname, '..', 'ai-platform', 'src'),
  path.join(__dirname, '..', 'ai-platform', 'packages')
];

if (INCLUDE_WEB) {
  TARGET_DIRS.push(path.join(__dirname, '..', 'ai-platform', 'web'));
}

const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', 'build', 'coverage'];

function getJsFiles(dir) {
  const results = [];
  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.includes(entry.name)) continue;
        walk(full);
      } else if (/\.(js|cjs|mjs)$/.test(entry.name)) {
        results.push(full);
      }
    }
  }
  if (fs.existsSync(dir)) walk(dir);
  return results;
}

function hasPrecedingJsdoc(lines, index) {
  // Look up to 15 lines back for a JSDoc block
  for (let i = index - 1; i >= Math.max(0, index - 15); i--) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('/**')) return true;
    if (trimmed === '' || trimmed.startsWith('//')) continue;
    if (trimmed.startsWith('*') || trimmed === '*/') continue; // inside JSDoc block
    break;
  }
  return false;
}

function generateJsdoc(name, params = [], returns = false) {
  const lines = ['/**'];
  lines.push(` * ${toSentenceCase(name)}.`);
  for (const p of params) {
    lines.push(` * @param {${inferType(p)}} ${p}`);
  }
  if (returns) lines.push(' * @returns {any}');
  lines.push(' */');
  return lines.join('\n');
}

function toSentenceCase(str) {
  return str.replace(/([A-Z])/g, ' $1').replace(/^\s+/, '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
}

function inferType(paramName) {
  const lower = paramName.toLowerCase();
  if (lower.includes('callback') || lower.startsWith('cb') || lower.startsWith('fn')) return 'Function';
  if (lower.includes('options') || lower.includes('config') || lower.includes('opts')) return 'Object';
  if (lower.includes('array') || lower.endsWith('s')) return 'Array';
  if (lower.includes('count') || lower.includes('index') || lower.includes('num') || lower.includes('port') || lower.includes('limit') || lower.includes('size') || lower.includes('length') || lower.includes('ms') || lower.includes('timeout')) return 'number';
  if (lower.includes('url') || lower.includes('path') || lower.includes('dir') || lower.includes('file') || lower.includes('name') || lower.includes('text') || lower.includes('str') || lower.includes('email') || lower.includes('token') || lower.includes('id') || lower.includes('password') || lower.includes('message')) return 'string';
  if (lower.includes('bool') || lower.startsWith('is') || lower.startsWith('has') || lower.startsWith('should') || lower.startsWith('can') || lower.startsWith('enable')) return 'boolean';
  if (lower.includes('req') && lower.includes('res')) return 'Object';
  return 'any';
}

function extractParams(signature) {
  const match = signature.match(/\((.*?)\)/);
  if (!match) return [];
  return match[1]
    .split(',')
    .map(p => p.trim())
    .filter(p => p)
    .map(p => {
      // Handle destructuring: { a, b } or [a, b]
      if (p.startsWith('{') || p.startsWith('[')) return 'options';
      // Handle default params: param = 123
      if (p.includes('=')) return p.split('=')[0].trim();
      return p;
    });
}

function fixFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let modified = false;
  let insertions = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip if already has JSDoc
    if (hasPrecedingJsdoc(lines, i)) continue;

    let name = null;
    let params = [];
    let returns = false;

    // Match patterns:
    // function example(...) { / async function example(...) { / const example = (...) => / const example = async (...) => / example(...) { / module.exports = { ... }
    // export function example(...) / export async function example(...) / export class Example / export const example = / export default function

    const funcMatch = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\((.*?)\)/);
    const arrowMatch = trimmed.match(/^const\s+(\w+)\s*=\s*(?:async\s*)?\((.*?)\)\s*=>/);
    const methodMatch = trimmed.match(/^(\w+)\s*\((.*?)\)\s*\{/);
    const classMatch = trimmed.match(/^(?:export\s+)?class\s+(\w+)/);
    const exportConstMatch = trimmed.match(/^export\s+const\s+(\w+)\s*=/);

    if (funcMatch) {
      name = funcMatch[1];
      params = extractParams(funcMatch[0]);
      returns = true;
    } else if (arrowMatch) {
      name = arrowMatch[1];
      params = extractParams(arrowMatch[0]);
      returns = true;
    } else if (methodMatch && i > 0 && lines[i - 1].trim().endsWith(',')) {
      // Likely a method in an object literal — skip to avoid false positives
      continue;
    } else if (classMatch) {
      name = classMatch[1];
    } else if (exportConstMatch) {
      name = exportConstMatch[1];
    }

    if (name) {
      const jsdoc = generateJsdoc(name, params, returns);
      lines.splice(i, 0, jsdoc);
      insertions++;
      modified = true;
      i++; // skip the inserted JSDoc
    }
  }

  if (modified) {
    return { content: lines.join('\n'), insertions };
  }
  return null;
}

function main() {
  const files = [];
  for (const dir of TARGET_DIRS) {
    files.push(...getJsFiles(dir));
  }

  let totalFiles = 0;
  let totalInsertions = 0;

  console.log(`Scanning ${files.length} files...\n`);

  for (const file of files) {
    const result = fixFile(file);
    if (result) {
      totalFiles++;
      totalInsertions += result.insertions;

      if (DRY_RUN) {
        console.log(`\n${path.relative(process.cwd(), file)} (+${result.insertions} JSDoc blocks)`);
      }

      if (APPLY) {
        fs.writeFileSync(file, result.content, 'utf8');
        console.log(`✓ ${path.relative(process.cwd(), file)} (+${result.insertions} JSDoc blocks)`);
      }
    }
  }

  console.log(`\n${DRY_RUN ? 'Would add' : 'Added'} JSDoc to ${totalFiles} files (${totalInsertions} blocks total).`);
  if (DRY_RUN) console.log('Run with --apply to write changes.');
}

main();
