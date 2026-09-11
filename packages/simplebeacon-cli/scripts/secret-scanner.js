#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REGEX_PATH = path.join(__dirname, '..', 'config', 'regex.json');
const ALLOWLIST_PATH = path.join(process.cwd(), 'ALLOWLIST.md');

/** Directories never walked by the pre-push secret gate. */
const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  'dist',
  'build',
  'coverage',
  '.next',
  'out',
  '.cache',
  '.turbo',
  'github-cache',
  '.github-sync',
  'target',
  'vendor',
  '.venv',
  'venv',
  '__pycache__',
]);

/**
 * Test / fixture paths — intentional mock secrets live here.
 * Pre-push should not require ALLOWLIST.md entries for every unit-test AKIA string.
 */
const SKIP_PATH_RE =
  /(^|[\\/])(?:tests?|__tests__|fixtures?|mocks?|true-positives|benchmark|corpus|sample-secrets)(?:[\\/]|$)/i;
const SKIP_FILE_RE = /\.(?:test|spec)\.[cm]?[jt]sx?$/i;

let rules = [];
try {
  rules = JSON.parse(fs.readFileSync(REGEX_PATH, 'utf8'));
} catch (e) {
  if (require.main === module) {
    console.error('Missing regex rules at', REGEX_PATH);
    process.exit(2);
  }
}

// Load allowlist fingerprints (sha256 hex strings) from ALLOWLIST.md in repo root
function loadAllowlist(allowlistPath) {
  const p = allowlistPath || ALLOWLIST_PATH;
  try {
    const txt = fs.readFileSync(p, 'utf8');
    const matches = Array.from(txt.matchAll(/([a-fA-F0-9]{64})/g)).map((m) =>
      m[1].toLowerCase(),
    );
    return new Set(matches);
  } catch (e) {
    return new Set();
  }
}
let ALLOWLIST = loadAllowlist();

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function maskPreview(secret) {
  if (!secret || secret.length <= 10) return 'REDACTED';
  if (secret.includes('-----BEGIN')) return 'REDACTED(PEM)';
  const first = secret.slice(0, 6);
  const last = secret.slice(-4);
  return `${first}...${last}`;
}

function computeEntropy(s) {
  const freq = {};
  for (const ch of s) freq[ch] = (freq[ch] || 0) + 1;
  const len = s.length;
  let ent = 0;
  for (const k in freq) {
    const p = freq[k] / len;
    ent -= p * Math.log2(p);
  }
  return ent;
}

function shouldSkipPath(p) {
  const normalized = String(p || '').replace(/\\/g, '/');
  if (SKIP_PATH_RE.test(normalized)) return true;
  if (SKIP_FILE_RE.test(normalized)) return true;
  return false;
}

function scanText(text, filePath) {
  const findings = [];
  for (const rule of rules) {
    const flags = rule.flags || 'g';
    const re = new RegExp(
      rule.pattern,
      flags.includes('g') ? flags : flags + 'g',
    );
    let m;
    while ((m = re.exec(text)) !== null) {
      // extract secret from named capture or full match
      const secret = m.groups && m.groups.secret ? m.groups.secret : m[0];
      if (!secret) continue;
      const fullFp = sha256Hex(secret);
      const fp = fullFp.slice(0, 12);
      const masked = maskPreview(secret);
      const start = m.index;
      // compute line/col roughly
      const pre = text.slice(0, start);
      const line = pre.split('\n').length;
      const col = start - pre.lastIndexOf('\n');

      const fingerprint_full = `sha256:${fullFp}`;
      const fingerprint_short = `sha256:${fp}`;
      const suppressed = ALLOWLIST.has(fullFp);
      const finding = {
        rule_id: rule.id,
        type: rule.type,
        level: rule.level,
        file: filePath || null,
        line,
        col,
        masked_preview: masked,
        fingerprint: fingerprint_full,
        fingerprint_short,
      };
      if (suppressed) {
        finding.classification = 'suppressed-by-policy';
        finding.suppressed_by = 'ALLOWLIST.md';
      }
      findings.push(finding);
    }
  }
  return findings;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  // parse --allowlist <path>
  const allowIdx = args.indexOf('--allowlist');
  let allowlistPath = null;
  if (allowIdx !== -1) {
    if (args[allowIdx + 1]) {
      allowlistPath = path.resolve(args[allowIdx + 1]);
      args.splice(allowIdx, 2);
    } else {
      console.error('--allowlist requires a path');
      process.exit(2);
    }
  }
  if (allowlistPath) ALLOWLIST = loadAllowlist(allowlistPath);

  if (args.length === 0) {
    console.error(
      'Usage: secret-scanner.js <file1|dir1> [file2|dir2 ...] [--allowlist <path>]',
    );
    process.exit(2);
  }

  const allFindings = [];

  function walkAndScan(p) {
    try {
      const base = path.basename(p);
      if (SKIP_DIR_NAMES.has(base)) return;
      if (shouldSkipPath(p)) return;

      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        const items = fs.readdirSync(p);
        for (const it of items) {
          if (SKIP_DIR_NAMES.has(it)) continue;
          walkAndScan(path.join(p, it));
        }
      } else if (stat.isFile()) {
        try {
          const txt = fs.readFileSync(p, 'utf8');
          const f = scanText(txt, p);
          allFindings.push(...f);
        } catch (e) {
          // ignore binary or unreadable files
        }
      }
    } catch (e) {
      // ignore missing paths
    }
  }

  for (const p of args) {
    walkAndScan(p);
  }

  console.log(JSON.stringify({ findings: allFindings }, null, 2));
}

module.exports = {
  scanText,
  sha256Hex,
  maskPreview,
  computeEntropy,
  shouldSkipPath,
  SKIP_DIR_NAMES,
};
