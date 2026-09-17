#!/usr/bin/env node
const fs = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

function loadPatterns(patternFile) {
  const raw = fs.readFileSync(patternFile, 'utf8');
  return raw.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
}

function compilePatterns(patterns) {
  return patterns.map(p => {
    // If pattern looks like a regex (contains special chars), create a regex
    try {
      return new RegExp(p, 'i');
    } catch (e) {
      // escape
      return new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
  });
}

function findMatchesInText(regexes, text) {
  const matches = [];
  regexes.forEach((r) => {
    let m;
    const copy = text;
    // global search
    const g = new RegExp(r.source, r.flags.includes('g') ? r.flags : r.flags + 'g');
    while ((m = g.exec(copy)) !== null) {
      matches.push({ pattern: r.source, index: m.index, match: m[0] });
      // prevent infinite loops
      if (m.index === g.lastIndex) g.lastIndex++;
    }
  });
  return matches;
}

function scanFiles(regexes, files) {
  const results = [];
  files.forEach((f) => {
    try {
      const content = fs.readFileSync(f, 'utf8');
      const matches = findMatchesInText(regexes, content);
      if (matches.length) results.push({ file: f, matches });
    } catch (e) {
      // ignore unreadable files
    }
  });
  return results;
}

function gitStagedFiles() {
  const out = spawnSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' });
  if (out.status !== 0) return [];
  return out.stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

function main() {
  const repoRoot = process.cwd();
  const patternFile = path.join(repoRoot, 'scripts', 'secret-patterns.txt');
  if (!fs.existsSync(patternFile)) {
    console.error('Pattern file not found:', patternFile);
    process.exit(1);
  }
  const patterns = loadPatterns(patternFile);
  const regexes = compilePatterns(patterns);

  // Gather staged files
  const staged = gitStagedFiles();
  if (!staged.length) {
    console.log('No staged files to scan.');
    process.exit(0);
  }
  // Only scan existing files
  const toScan = staged.filter(f => fs.existsSync(f));
  const findings = scanFiles(regexes, toScan);
  if (findings.length) {
    console.error('Secret guard: potential secrets found in staged files:');
    findings.forEach((r) => {
      console.error(`\nFile: ${r.file}`);
      r.matches.slice(0, 5).forEach((m) => {
        console.error(`  - Pattern: /${m.pattern}/  Match: ${m.match}  at ${m.index}`);
      });
      if (r.matches.length > 5) console.error(`  ...and ${r.matches.length - 5} more matches`);
    });
    console.error('\nRemediation: remove the secret, add to .gitignore, rotate credentials. Use `git restore --staged <file>` to unstage.');
    process.exit(2);
  }
  console.log('Secret guard: no findings.');
  process.exit(0);
}

if (require.main === module) main();

module.exports = { loadPatterns, compilePatterns, findMatchesInText, scanFiles };
