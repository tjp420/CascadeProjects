#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function correctRequirePath(filePath) {
  const relDir = path.relative(path.join(ROOT, 'src'), path.dirname(filePath)).replace(/\\/g, '/');
  const depth = relDir && relDir !== '.' ? relDir.split('/').filter(Boolean).length : 0;
  return `${'../'.repeat(depth)}lib/production-logger`;
}

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.isFile() && full.endsWith('.js')) acc.push(full);
  }
  return acc;
}

let fixed = 0;
for (const file of walk(path.join(ROOT, 'src'))) {
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes('production-logger')) continue;

  const correct = correctRequirePath(file);
  const next = src.replace(
    /require\(['"](?:\.\.\/)+lib\/production-logger['"]\)/,
    `require('${correct}')`
  );
  if (next !== src) {
    fs.writeFileSync(file, next, 'utf8');
    fixed += 1;
    console.log(path.relative(ROOT, file), '->', correct);
  }
}

console.log(`Fixed ${fixed} file(s).`);
