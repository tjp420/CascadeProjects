#!/usr/bin/env node
/**
 * Phase 2: Replace console.log/debug in src/ production JS with production-logger.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOGGER_REL_FROM_SRC = 'lib/production-logger';
const TARGET_ROOT = path.join(ROOT, 'src');
const SKIP_DIRS = new Set(); // set to ['web'] to skip browser bundles
const SKIP_FILES = /[/\\](logger\.js|components[/\\]core[/\\]Logger\.js)$/;

const SKIP_SEGMENTS = new Set(['node_modules', '.git', '__tests__', 'tests', '.venv', 'venv']);

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const relFromSrc = path.relative(TARGET_ROOT, full).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (SKIP_SEGMENTS.has(entry.name) || SKIP_DIRS.has(entry.name)) continue;
      if (relFromSrc.split('/').some((seg) => SKIP_DIRS.has(seg))) continue;
      walk(full, acc);
    } else if (entry.isFile() && full.endsWith('.js')) {
      if (!SKIP_FILES.test(full)) acc.push(full);
    }
  }
  return acc;
}

function loggerRequirePath(filePath) {
  const relDir = path.relative(path.join(ROOT, 'src'), path.dirname(filePath)).replace(/\\/g, '/');
  const depth = relDir && relDir !== '.' ? relDir.split('/').filter(Boolean).length : 0;
  return `${'../'.repeat(depth)}lib/production-logger`;
}

function patchJsFile(filePath) {
  let src = fs.readFileSync(filePath, 'utf8');
  if (!/\bconsole\.(log|debug|info)\s*\(/.test(src)) {
    return { patched: false, removed: 0 };
  }

  if (/DEBUG_PATTERNS|production-debug-guard|debugger-statement/.test(src)) {
    return { patched: false, removed: 0, skipped: 'scanner-tooling' };
  }

  const reqPath = loggerRequirePath(filePath);
  const requireLine = `const logger = require('${reqPath.replace(/\\/g, '/')}');`;

  if (!src.includes('production-logger')) {
    const requireMatch = src.match(/^(.*?)(const |let |var |class |function |module\.exports|exports\.|\/\*\*)/s);
    if (src.startsWith('#!')) {
      const nl = src.indexOf('\n');
      src = `${src.slice(0, nl + 1)}${requireLine}\n${src.slice(nl + 1)}`;
    } else if (/^['"]use strict['"];?\s*\n/.test(src)) {
      src = src.replace(/^(['"]use strict['"];?\s*\n)/, `$1${requireLine}\n`);
    } else {
      src = `${requireLine}\n${src}`;
    }
  }

  const before = src;
  src = src.replace(/\bconsole\.log\s*\(/g, 'logger.debug(');
  src = src.replace(/\bconsole\.debug\s*\(/g, 'logger.debug(');
  src = src.replace(/\bconsole\.info\s*\(/g, 'logger.info(');

  const removed = (before.match(/\bconsole\.(log|debug|info)\s*\(/g) || []).length;
  if (src !== before) {
    fs.writeFileSync(filePath, src, 'utf8');
    return { patched: true, removed };
  }
  return { patched: false, removed: 0 };
}

function main() {
  const loggerFile = path.join(ROOT, 'src', 'lib', 'production-logger.js');
  if (!fs.existsSync(loggerFile)) {
    console.error('Missing src/lib/production-logger.js — create it first.');
    process.exit(1);
  }

  let totalRemoved = 0;
  let filesPatched = 0;

  console.log(`=== ${path.relative(ROOT, TARGET_ROOT)} (excluding web/) ===`);
  for (const file of walk(TARGET_ROOT)) {
    const result = patchJsFile(file);
    if (result.patched) {
      filesPatched += 1;
      totalRemoved += result.removed;
      console.log(`  ${path.relative(ROOT, file)}: ${result.removed} console.log/debug/info → logger`);
    }
  }

  console.log(`\nPatched ${filesPatched} file(s), rewired ${totalRemoved} console call(s).`);
}

main();
