#!/usr/bin/env node
/**
 * Remediate SimpleBeacon audit hygiene findings:
 * - Remove console.* debug statements from web HTML
 * - Production-guard logger.js bootstrap console usage
 * - Replace console.* in src/server/index.js with app-logger
 * - Replace bare print() in src/server Python with logging (production-safe)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function walk(dir, filter, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', '.simplebeacon', '.venv', 'venv', '__pycache__'].includes(entry.name)) continue;
      walk(full, filter, acc);
    } else if (filter(full)) {
      acc.push(full);
    }
  }
  return acc;
}

function removeConsoleStatements(source) {
  const lines = source.split('\n');
  const out = [];
  let removed = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/\bconsole\.(log|debug|info|warn|error)\s*\(/.test(line)) {
      out.push(line);
      continue;
    }

    let depth = 0;
    let started = false;
    let j = i;
    for (; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === '(') {
          depth += 1;
          started = true;
        } else if (ch === ')') {
          depth -= 1;
        }
      }
      if (started && depth <= 0) break;
    }

    removed += 1;
    i = j;
  }

  return { text: out.join('\n'), removed };
}

function stripHtmlConsole(rootDir) {
  const files = walk(rootDir, (f) => f.endsWith('.html'));
  let totalRemoved = 0;
  for (const file of files) {
    const before = fs.readFileSync(file, 'utf8');
    const { text, removed } = removeConsoleStatements(before);
    if (removed > 0) {
      fs.writeFileSync(file, text, 'utf8');
      totalRemoved += removed;
      console.log(`  ${path.relative(ROOT, file)}: removed ${removed}`);
    }
  }
  return totalRemoved;
}

function patchLogger(filePath) {
  if (!fs.existsSync(filePath)) return false;
  let src = fs.readFileSync(filePath, 'utf8');
  const before = src;

  src = src.replace(
    "window.logger = new Logger({\n    level: 'info',\n    prefix: 'Dashboard',\n    enableConsole: true,",
    "const __isDevHost = /^(localhost|127\\.0\\.0\\.1)$/.test(window.location.hostname);\n\nwindow.logger = new Logger({\n    level: 'info',\n    prefix: 'Dashboard',\n    enableConsole: __isDevHost,"
  );

  src = src.replace(/\nconsole\.log\('✅ Structured logging system initialized'\);\s*$/, '\n');

  if (src !== before) {
    fs.writeFileSync(filePath, src, 'utf8');
    return true;
  }
  return false;
}

function patchSrcServerIndex() {
  const file = path.join(ROOT, 'src', 'server', 'index.js');
  if (!fs.existsSync(file)) return 0;

  let src = fs.readFileSync(file, 'utf8');
  if (src.includes('app-logger')) return 0;

  src = src.replace(
    "require('dotenv').config();",
    "require('dotenv').config();\nconst logger = require('../../server/lib/app-logger');"
  );

  src = src.replace(/\bconsole\.log\b/g, 'logger.debug');
  src = src.replace(/\bconsole\.error\b/g, 'logger.error');
  src = src.replace(/\bconsole\.warn\b/g, 'logger.warn');
  src = src.replace(/\bconsole\.info\b/g, 'logger.info');

  fs.writeFileSync(file, src, 'utf8');
  const count = (src.match(/logger\.(debug|error|warn|info)/g) || []).length;
  return count;
}

function patchPythonPrints(rootDir) {
  const files = walk(rootDir, (f) => f.endsWith('.py'));
  let patched = 0;

  for (const file of files) {
    let src = fs.readFileSync(file, 'utf8');
    if (!/\bprint\s*\(/.test(src)) continue;

    const before = src;
    if (!/^\s*import logging/m.test(src)) {
      src = 'import logging\n\n' + src;
    }
    if (!/logger\s*=\s*logging\.getLogger/.test(src)) {
      src = src.replace(/^import logging\n/m, "import logging\n\nlogger = logging.getLogger(__name__)\n");
    }

    src = src.replace(/\bprint\s*\(/g, 'logger.info(');

    if (src !== before) {
      fs.writeFileSync(file, src, 'utf8');
      patched += 1;
      console.log(`  ${path.relative(ROOT, file)}`);
    }
  }
  return patched;
}

function main() {
  console.log('=== web HTML: strip console.* ===');
  const webRemoved = stripHtmlConsole(path.join(ROOT, 'web'));
  console.log(`Removed ${webRemoved} console statement(s) from web HTML\n`);

  console.log('=== logger.js: production guard ===');
  const loggers = [
    path.join(ROOT, 'web', 'scripts', 'logger.js'),
  ];
  for (const f of loggers) {
    console.log(`  ${path.relative(ROOT, f)}: ${patchLogger(f) ? 'patched' : 'skipped'}`);
  }

  console.log('\n=== src/server/index.js: app-logger ===');
  const serverPatches = patchSrcServerIndex();
  console.log(`  Replaced ${serverPatches} console call site(s)\n`);

  console.log('Done.');
}

main();
