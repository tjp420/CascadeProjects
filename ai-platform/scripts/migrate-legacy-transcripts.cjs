'use strict';

// migrate-legacy-transcripts.cjs
// Scan legacy WAL and snapshot files for oversized numeric values in
// DKG/transcript-like records and optionally quarantine or rewrite them.
// Usage: node migrate-legacy-transcripts.cjs [--wal=./.enclave-wal] [--snapshots=dir1,dir2] [--dry-run=true] [--bit-limit=4096] [--backup-ext=.bak] [--siem=false]

const fs = require('fs');
const path = require('path');

// Try to load siem exporter if available; keep non-fatal if not present
let siem = null;
try { siem = require('../server/lib/siem-exporter.cjs'); } catch (e) { siem = null; }

function parseArgs() {
  const raw = process.argv.slice(2);
  const out = {};
  for (const a of raw) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (!m) continue;
    const k = m[1];
    const v = typeof m[2] === 'undefined' ? 'true' : m[2];
    out[k] = v;
  }
  return out;
}

const args = parseArgs();

const cwd = process.cwd();
const defaultWal = path.join(cwd, '.enclave-wal');
const walPath = args.wal ? path.resolve(args.wal) : defaultWal;

const defaultSnapshotCandidates = [
  path.join(cwd, 'ai-platform', '.snapshots'),
  path.join(cwd, 'ai-platform', 'snapshots'),
  path.join(cwd, '.snapshots'),
  path.join(cwd, 'snapshots'),
];

const snapshotsArg = args.snapshots ? String(args.snapshots).split(',').map(s => s.trim()).filter(Boolean) : [];
const snapshotDirs = snapshotsArg.length ? snapshotsArg.map(p => path.resolve(p)) : defaultSnapshotCandidates;

const dryRun = (typeof args['dry-run'] === 'undefined') ? true : String(args['dry-run']).toLowerCase() !== 'false';
const bitLimit = args['bit-limit'] ? parseInt(args['bit-limit'], 10) : 4096;
const backupExt = args['backup-ext'] ? String(args['backup-ext']) : '.bak';
const siemEnabled = args['siem'] ? String(args['siem']).toLowerCase() !== 'false' : false;
const quarantineDir = args['quarantine-dir'] ? path.resolve(args['quarantine-dir']) : path.join(cwd, 'quarantine-legacy-transcripts');

function log(...s) { console.log('[migrate] ', ...s); }

function safeReadFile(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch (e) { return null; }
}

function isHexString(s) {
  return typeof s === 'string' && /^0x[0-9a-fA-F]+$/.test(s);
}

function isIntegerString(s) {
  return typeof s === 'string' && /^[-+]?[0-9]+$/.test(s);
}

function toBigIntFromPossibleString(v) {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || !Number.isInteger(v)) return null;
    return BigInt(v);
  }
  if (typeof v === 'string') {
    if (isHexString(v)) return BigInt(v);
    if (isIntegerString(v)) return BigInt(v);
    // fallthrough: not a numeric string
    return null;
  }
  return null;
}

function bitLengthOfBigInt(n) {
  if (n === 0n) return 0;
  let x = n < 0n ? -n : n;
  return x.toString(2).length;
}

function findNumericOversize(obj, pathStack = []) {
  const findings = [];
  if (obj === null || typeof obj === 'undefined') return findings;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      findings.push(...findNumericOversize(obj[i], pathStack.concat([`[${i}]`])));
    }
    return findings;
  }
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      findings.push(...findNumericOversize(obj[k], pathStack.concat([k])));
    }
    return findings;
  }
  // primitive
  const maybe = toBigIntFromPossibleString(obj);
  if (maybe === null) return findings;
  const bits = bitLengthOfBigInt(maybe < 0n ? -maybe : maybe);
  if (bits > bitLimit) {
    findings.push({ path: pathStack.join('.'), value: String(obj), bits });
  }
  return findings;
}

function processWalFile(walFilePath, report) {
  const raw = safeReadFile(walFilePath);
  if (!raw) return report;
  const lines = raw.split(/\r?\n/).filter(Boolean);
  log(`Scanning WAL ${walFilePath} (${lines.length} lines)`);
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    let parsed = null;
    try { parsed = JSON.parse(line); } catch (e) { continue; }
    // Only inspect objects that look like contributions/transcripts by heuristic
    const keys = parsed && typeof parsed === 'object' ? Object.keys(parsed) : [];
    if (!keys.length) continue;
    const findings = findNumericOversize(parsed, []);
    if (findings.length) {
      const entry = {
        source: 'wal',
        walPath: walFilePath,
        line: idx + 1,
        id: parsed.id || parsed.txId || parsed.recordId || null,
        findings,
      };
      report.push(entry);
    }
  }
  return report;
}

function findFilesUnder(dir, namePattern) {
  const out = [];
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const it of items) {
      const full = path.join(dir, it.name);
      if (it.isDirectory()) {
        out.push(...findFilesUnder(full, namePattern));
      } else if (it.isFile()) {
        if (namePattern.test(it.name)) out.push(full);
      }
    }
  } catch (e) {
    // ignore unreadable dirs
  }
  return out;
}

function processSnapshotFile(filePath, report) {
  const raw = safeReadFile(filePath);
  if (!raw) return report;
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch (e) { return report; }
  const findings = findNumericOversize(parsed, []);
  if (findings.length) {
    report.push({ source: 'snapshot', file: filePath, findings });
  }
  return report;
}

function ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
}

function backupFile(filePath, ext) {
  try {
    const bak = filePath + ext;
    fs.copyFileSync(filePath, bak, fs.constants.COPYFILE_EXCL);
    return bak;
  } catch (e) {
    return null;
  }
}

function enqueueSiemIfConfigured(event) {
  if (!siemEnabled) return;
  if (!siem) {
    log('SIEM enabled but siem-exporter not available; skipping SIEM enqueue');
    return;
  }
  try { siem.enqueue(event); } catch (e) { log('siem.enqueue failed', e && e.message); }
}

function run() {
  const report = [];

  // WAL
  if (fs.existsSync(walPath)) {
    processWalFile(walPath, report);
  } else {
    log('WAL not found at', walPath);
  }

  // Snapshot dirs: search for files that look like snapshot/transcript JSON
  for (const sdir of snapshotDirs) {
    if (!fs.existsSync(sdir)) continue;
    log('Searching snapshots in', sdir);
    const candidates = findFilesUnder(sdir, /snapshot|transcript|dkg|contribution|transcript|wal|commitment|transcripts|transcript/i);
    for (const f of candidates) {
      processSnapshotFile(f, report);
    }
  }

  // Also do a best-effort project-wide search for obvious snapshot-like files under ai-platform/server
  const fallbackRoot = path.join(cwd, 'ai-platform', 'server');
  if (fs.existsSync(fallbackRoot)) {
    const candidates = findFilesUnder(fallbackRoot, /snapshot|transcript|dkg|contribution|commitment/i);
    for (const f of candidates) processSnapshotFile(f, report);
  }

  // Summarize
  const summary = { scannedWal: fs.existsSync(walPath), snapshotDirs: snapshotDirs, dryRun, bitLimit, totalFindings: report.length, timestamp: Date.now() };
  log('Scan complete:', JSON.stringify(summary));

  if (report.length === 0) {
    log('No oversize numeric findings detected.');
    return { summary, report };
  }

  // Write a report file
  const outDir = path.join(cwd, 'ai-platform', 'migration-reports');
  ensureDir(outDir);
  const outPath = path.join(outDir, `legacy-transcript-report-${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ summary, report }, null, 2), 'utf8');
  log('Wrote report to', outPath);

  // Dry-run: only report findings, optionally enqueue SIEM events
  for (const item of report) {
    const evt = {
      eventType: 'NUMERIC_OVERSIZE_HISTORICAL_DETECTION',
      detectedAt: Date.now(),
      details: item,
    };
    enqueueSiemIfConfigured(evt);
  }

  if (dryRun) {
    log('Dry-run mode; no files modified. To apply changes re-run with --dry-run=false');
    return { summary, report, reportPath: outPath };
  }

  // Non-dry mode: quarantine offending files/entries
  ensureDir(quarantineDir);
  for (const it of report) {
    if (it.source === 'wal' && it.walPath) {
      // backup WAL once
      const bak = backupFile(it.walPath, backupExt);
      if (bak) log('Backed up WAL to', bak);
      // split offending lines into quarantine file
      const raw = safeReadFile(it.walPath);
      const lines = raw.split(/\r?\n/).filter(Boolean);
      const qFile = path.join(quarantineDir, `wal-${path.basename(it.walPath)}-line-${it.line}-${Date.now()}.json`);
      try { fs.writeFileSync(qFile, lines[it.line - 1] || '', 'utf8'); log('Quarantined WAL line to', qFile); } catch (e) { log('Failed to quarantine WAL line', e && e.message); }
    } else if (it.source === 'snapshot' && it.file) {
      const bak = backupFile(it.file, backupExt);
      if (bak) log('Backed up snapshot to', bak);
      const qFile = path.join(quarantineDir, `snapshot-${path.basename(it.file)}-${Date.now()}.json`);
      try { fs.copyFileSync(it.file, qFile); log('Quarantined snapshot copy to', qFile); } catch (e) { log('Failed to quarantine snapshot', e && e.message); }
    }
    // emit SIEM now for applied quarantine
    const evt = { eventType: 'NUMERIC_OVERSIZE_HISTORICAL_QUARANTINED', quarantinedAt: Date.now(), details: it };
    enqueueSiemIfConfigured(evt);
  }

  log('Quarantine complete. Manual review required to decide on rewrite vs removal.');
  return { summary, report, reportPath: outPath };
}

if (require.main === module) {
  try {
    const r = run();
    // helpful exit code semantics
    process.exitCode = 0;
  } catch (e) {
    console.error('Migration script failed:', e && e.stack || e);
    process.exitCode = 2;
  }
}

module.exports = { run };
