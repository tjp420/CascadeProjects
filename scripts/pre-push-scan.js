#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Config
const SKIP_GLOBS = [
  'docs/**',
  '**/*.md',
  'node_modules/**',
  'dist/**',
  'build/**',
  '**/*.png',
  '**/*.jpg',
  '**/*.jpeg',
  '**/*.css',
  // Git hook scripts — gitleaks fails on these (tries to cd into files, not dirs)
  '.husky/**',
  // Dev database fixtures — test-generated JWT tokens for admin@example.com (not real secrets)
  'ai-platform/server/db/token-registry.json',
];

const MAX_BYTES = 1024 * 1024; // 1MB per-file read cap for regex scanning

function runCmd(cmd, args, opts = {}) {
  try {
    return spawnSync(cmd, args, Object.assign({ encoding: 'utf8' }, opts));
  } catch (err) {
    return { error: err };
  }
}

function hasCommand(cmd) {
  const r = runCmd(cmd, ['--version']);
  return r && r.status === 0;
}

function readStdinLines() {
  const input = fs.readFileSync(0, 'utf8');
  return input.trim().split(/\r?\n/).filter(Boolean);
}

function globToRegex(glob) {
  // small glob -> regex converter
  // protect double-star first
  let g = glob.replace(/\*\*/g, '<<DS>>');
  // escape regex meta
  g = g.replace(/([.+^=!:${}()|\\[\\]\/\\\\])/g, '\\$1');
  // single star -> no-slash wildcards
  g = g.replace(/\*/g, '[^/]*');
  // double-star placeholder -> match any
  g = g.replace(/<<DS>>/g, '.*');
  // ? -> single char
  g = g.replace(/\?/g, '.');
  return new RegExp('^' + g + '$', 'i');
}

const SKIP_REGEXES = SKIP_GLOBS.map(globToRegex);

function isSkipped(file) {
  return SKIP_REGEXES.some(r => r.test(file));
}

function collectChangedFiles() {
  // Read pre-push stdin (lines like: <localRef> <localSha> <remoteRef> <remoteSha>)
  const lines = readStdinLines();
  const files = new Set();
  if (lines.length === 0) {
    // Fallback: use staged files
    const st = runCmd('git', ['diff', '--name-only', '--staged']);
    if (st.status === 0 && st.stdout) st.stdout.split(/\r?\n/).forEach(f => f && files.add(f));
    return Array.from(files);
  }

  for (const ln of lines) {
    const parts = ln.trim().split(/\s+/);
    if (parts.length < 4) continue;
    const localSha = parts[1];
    const remoteSha = parts[3];

    if (/^0+$/.test(remoteSha)) {
      // new branch; list files in the pushed commit(s)
      const r = runCmd('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', localSha]);
      if (r.status === 0 && r.stdout) r.stdout.split(/\r?\n/).forEach(f => f && files.add(f));
    } else {
      const r = runCmd('git', ['diff', '--name-only', `${remoteSha}..${localSha}`]);
      if (r.status === 0 && r.stdout) r.stdout.split(/\r?\n/).forEach(f => f && files.add(f));
    }
  }
  return Array.from(files);
}

function isBinary(buf) {
  for (let i = 0; i < buf.length; i++) if (buf[i] === 0) return true;
  return false;
}

const REGEX_PATTERNS = [
  { id: 'AWS_ACCESS_KEY_ID', re: /AKIA[0-9A-Z]{16}/g },
  { id: 'AWS_SECRET_ACCESS_KEY', re: /aws(.{0,20})?(secret|secret_access_key).{0,20}["'=: ]([A-Za-z0-9\/+=]{20,40})/i },
  { id: 'GCP_API_KEY', re: /AIza[0-9A-Za-z\-_]{35}/g },
  { id: 'SLACK_TOKEN', re: /xox[baprs]-[0-9a-zA-Z-]+/g },
  { id: 'GITHUB_TOKEN', re: /ghp_[A-Za-z0-9_]{36,}/g },
  { id: 'GITHUB_OAUTH', re: /gho_[A-Za-z0-9_]{36,}/g },
  { id: 'PRIVATE_KEY', re: /-----BEGIN (RSA |)?PRIVATE KEY-----/g },
  { id: 'JWT_LIKE', re: /[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
];

function regexScanFile(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(Math.min(MAX_BYTES, fs.fstatSync(fd).size || 0));
    if (buf.length === 0) { fs.closeSync(fd); return []; }
    fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    if (isBinary(buf)) return [];
    const txt = buf.toString('utf8');
    const findings = [];
    for (const p of REGEX_PATTERNS) {
      const m = txt.match(p.re);
      if (m && m.length) findings.push({ id: p.id, matches: Array.from(new Set(m)).slice(0,5) });
    }
    return findings;
  } catch (err) {
    return [];
  }
}

function runGitleaksOnFiles(files) {
  // Attempt to use local gitleaks binary first, then npx fallback
  const tryCmds = [];
  if (hasCommand('gitleaks')) tryCmds.push({ cmd: 'gitleaks', args: ['detect', '--source'] });
  tryCmds.push({ cmd: 'npx', args: ['gitleaks', 'detect', '--source'] });

  for (const attempt of tryCmds) {
    const base = attempt.cmd;
    const baseArgs = attempt.args;
    // Attempt per-file invocation to limit memory and allow redaction per-file
    let aggregatedOutput = '';
    let hadError = false;
    for (const f of files) {
      const a = baseArgs.concat([f, '--redact']);
      const r = runCmd(base, a, { stdio: 'pipe' });
      if (r && r.error && r.error.code === 'ENOENT') break; // binary missing
      aggregatedOutput += (r.stdout || '') + (r.stderr || '');
      if (r.status && r.status !== 0) {
        // Distinguish actual findings (exit 1) from errors (other codes)
        // On Windows, gitleaks fails with "cannot change to '<file>': Invalid argument"
        // because it treats file paths as directory paths. These errors contain
        // "fatal: cannot change to" or "The directory name is invalid" — skip them.
        const errText = (r.stderr || '') + (r.stdout || '');
        const isWindowsPathError = /cannot change to|directory name is invalid|Invalid argument/i.test(errText);
        if (isWindowsPathError) {
          hadError = true;
          continue; // Skip this file, try the next one
        }
        // Actual leak finding — surface its output
        return { success: true, output: aggregatedOutput, code: r.status };
      }
    }
    // If we reached here, gitleaks either succeeded or had Windows path errors
    // In both cases, fall through to the regex scanner for a deterministic check
    if (hadError) return { success: false, output: '' };
    return { success: true, output: aggregatedOutput, code: 0 };
  }
  return { success: false, output: '' };
}

function main() {
  const changed = collectChangedFiles();
  const filtered = changed.filter(f => !isSkipped(f) && fs.existsSync(f) && fs.statSync(f).isFile());
  if (filtered.length === 0) {
    console.log('ℹ️ No changed files to scan (after skip rules).');
    process.exit(0);
  }

  console.log(`ℹ️ Scanning ${filtered.length} changed files for secrets...`);

  const gRes = runGitleaksOnFiles(filtered);
  if (gRes.success && gRes.code !== 0 && gRes.output && gRes.output.trim()) {
    console.error('💥 gitleaks reported findings:\n', gRes.output);
    process.exit(1);
  }

  // gitleaks unavailable or did not report; run regex fallback which is deterministic
  const findings = [];
  for (const f of filtered) {
    const r = regexScanFile(f);
    if (r && r.length) findings.push({ file: f, issues: r });
  }

  if (findings.length) {
    console.error('\n💥 [Pre-Push] SECRET FINDINGS (regex fallback):');
    for (const it of findings) {
      console.error(`- ${it.file}`);
      for (const issue of it.issues) console.error(`  - ${issue.id}: ${issue.matches.join(', ')}`);
    }
    console.error('\nRemediate the secrets or add to the allowlist and try again.');
    process.exit(1);
  }

  console.log('✅ No findings in changed files.');
  process.exit(0);
}

main();
