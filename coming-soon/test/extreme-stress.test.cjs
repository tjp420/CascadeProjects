'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const FIXTURES = path.join(__dirname, 'fixtures', 'extreme-stress');
const ANALYZER = path.join(__dirname, '..', 'analyze-directory.js');

function cleanFixtures() {
  fs.rmSync(FIXTURES, { recursive: true, force: true });
  fs.mkdirSync(FIXTURES, { recursive: true });
}

function buildMonolith() {
  const dir = path.join(FIXTURES, 'monolith');
  fs.mkdirSync(dir, { recursive: true });
  const todo = '\n// TODO: implement rest of business logic\n';
  for (let i = 0; i < 10000; i++) {
    const file = path.join(dir, `component-${i}.js`);
    fs.writeFileSync(file, `const x = ${i};${todo}export default x;\n`, 'utf8');
  }
}

function buildDependencyNightmare() {
  const dir = path.join(FIXTURES, 'dependency-nightmare');
  fs.mkdirSync(dir, { recursive: true });
  // 20 packages, each with a nested node_modules to test recursive skip
  for (let p = 0; p < 20; p++) {
    const pkg = path.join(dir, 'node_modules', `fake-pkg-${p}`);
    fs.mkdirSync(pkg, { recursive: true });
    fs.writeFileSync(path.join(pkg, 'index.js'), `module.exports = ${p};\n`, 'utf8');
    const sub = path.join(pkg, 'node_modules', `sub-${p}`);
    fs.mkdirSync(sub, { recursive: true });
    fs.writeFileSync(path.join(sub, 'sub.js'), `module.exports = ${p};\n`, 'utf8');
  }
}

function buildBinaryTrap() {
  const dir = path.join(FIXTURES, 'binary-trap');
  fs.mkdirSync(dir, { recursive: true });
  const exts = ['mp4', 'zip', 'png', 'jpg', 'pdf'];
  for (let i = 0; i < 50; i++) {
    const ext = exts[i % exts.length];
    const file = path.join(dir, `asset-${i}.${ext}`);
    fs.writeFileSync(file, Buffer.alloc(1024 + i), null);
  }
}

function parseNumber(str) {
  return Number(String(str).replace(/,/g, ''));
}

function analyze(name, expectations) {
  const dir = path.join(FIXTURES, name);
  const output = path.join(dir, 'report.json');
  console.log(`\n--- ${name} ---`);
  const stdout = execSync(`node "${ANALYZER}" "${dir}" --output "${output}"`, {
    encoding: 'utf8',
    timeout: 120000,
    stdio: 'pipe'
  });
  console.log(stdout);
  const report = JSON.parse(fs.readFileSync(output, 'utf8'));
  const s = report.summary;

  if (expectations.readErrors != null && s.readErrors !== expectations.readErrors) {
    throw new Error(`${name}: readErrors mismatch: ${s.readErrors} (expected ${expectations.readErrors})`);
  }
  const totalFiles = parseNumber(s.totalFiles);
  if (expectations.totalFiles != null && totalFiles !== expectations.totalFiles) {
    throw new Error(`${name}: totalFiles mismatch: ${totalFiles} (expected ${expectations.totalFiles})`);
  }
  if (expectations.dirSkippedMin != null && s.dirSkipped < expectations.dirSkippedMin) {
    throw new Error(`${name}: dirSkipped too low: ${s.dirSkipped} (expected >= ${expectations.dirSkippedMin})`);
  }
  if (expectations.binarySkippedMin != null && s.binarySkipped < expectations.binarySkippedMin) {
    throw new Error(`${name}: binarySkipped too low: ${s.binarySkipped} (expected >= ${expectations.binarySkippedMin})`);
  }
  console.log(`PASS ${name}`);
  return report;
}

function main() {
  console.log('Building extreme stress fixtures...');
  cleanFixtures();
  buildMonolith();
  buildDependencyNightmare();
  buildBinaryTrap();

  analyze('monolith', {
    readErrors: 0,
    totalFiles: 10000,
    binarySkippedMin: 0,
    dirSkippedMin: 0
  });

  analyze('dependency-nightmare', {
    readErrors: 0,
    totalFiles: 0,
    dirSkippedMin: 1
  });

  analyze('binary-trap', {
    readErrors: 0,
    totalFiles: 0,
    binarySkippedMin: 50
  });

  console.log('\nAll extreme repository stress tests passed.');
}

main();
