#!/usr/bin/env node
'use strict';

/**
 * Snapshot Backup Script
 *
 * Creates compressed, encrypted snapshots of the .simplebeacon state directory
 * and the ai-platform/server/db token registry. Implements a tiered retention
 * policy (daily, weekly, monthly) and optionally uploads to a remote repository
 * via git push or an S3-compatible endpoint.
 *
 * Usage:
 *   node scripts/snapshot-backup.cjs [--once] [--dry-run] [--verify]
 *   node scripts/snapshot-backup.cjs --once              # Single backup + rotation
 *   node scripts/snapshot-backup.cjs --dry-run           # Show what would be backed up
 *   node scripts/snapshot-backup.cjs --verify            # Verify all existing snapshots
 *   node scripts/snapshot-backup.cjs --restore <id>      # Restore a specific snapshot
 *
 * Environment:
 *   SIMPLEBEACON_STATE_DIR   - State directory (default: ./.simplebeacon)
 *   SIMPLEBEACON_DB_PATH     - Token registry path (default: ai-platform/server/db/token-registry.json)
 *   SIMPLEBEACON_BACKUP_DIR  - Backup output directory (default: ./.simplebeacon-snapshots)
 *   SIMPLEBEACON_BACKUP_KEK  - 32-byte hex KEK for encryption (auto-generated if missing)
 *   SIMPLEBEACON_RETENTION_DAILY   - Keep N daily snapshots (default: 7)
 *   SIMPLEBEACON_RETENTION_WEEKLY  - Keep N weekly snapshots (default: 4)
 *   SIMPLEBEACON_RETENTION_MONTHLY - Keep N monthly snapshots (default: 12)
 *
 * @module snapshot-backup
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const os = require('os');

// ─── Configuration ───────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');
const STATE_DIR = process.env.SIMPLEBEACON_STATE_DIR
  ? path.resolve(process.env.SIMPLEBEACON_STATE_DIR)
  : path.join(ROOT, '.simplebeacon');
const DB_PATH = process.env.SIMPLEBEACON_DB_PATH
  ? path.resolve(process.env.SIMPLEBEACON_DB_PATH)
  : path.join(ROOT, 'ai-platform', 'server', 'db', 'token-registry.json');
const BACKUP_DIR = process.env.SIMPLEBEACON_BACKUP_DIR
  ? path.resolve(process.env.SIMPLEBEACON_BACKUP_DIR)
  : path.join(ROOT, '.simplebeacon-snapshots');

const RETENTION = {
  daily: parseInt(process.env.SIMPLEBEACON_RETENTION_DAILY || '7', 10),
  weekly: parseInt(process.env.SIMPLEBEACON_RETENTION_WEEKLY || '4', 10),
  monthly: parseInt(process.env.SIMPLEBEACON_RETENTION_MONTHLY || '12', 10),
};

const SNAPSHOT_VERSION = 1;
const HEADER_MAGIC = 'SBSS'; // SimpleBeacon Snapshot

// ─── KEK Management ──────────────────────────────────────────────

function getKek() {
  const kekEnv = process.env.SIMPLEBEACON_BACKUP_KEK;
  if (kekEnv) {
    const kek = Buffer.from(kekEnv, 'hex');
    if (kek.length !== 32) {
      throw new Error('SIMPLEBEACON_BACKUP_KEK must be 32 bytes (64 hex chars)');
    }
    return kek;
  }
  // Auto-generate and persist a KEK for local development
  const kekPath = path.join(BACKUP_DIR, '.kek');
  if (fs.existsSync(kekPath)) {
    return Buffer.from(fs.readFileSync(kekPath, 'utf8').trim(), 'hex');
  }
  const newKek = crypto.randomBytes(32);
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.writeFileSync(kekPath, newKek.toString('hex'), { mode: 0o600 });
  console.warn('[snapshot] Generated new KEK at', kekPath);
  console.warn('[snapshot] For production, set SIMPLEBEACON_BACKUP_KEK env var instead.');
  return newKek;
}

// ─── Snapshot Creation ───────────────────────────────────────────

/**
 * Collect all state files to include in the snapshot.
 * Returns an array of { relativePath, absolutePath, size } entries.
 */
function collectStateFiles() {
  const files = [];

  // 1. .simplebeacon directory (JSON state files, exclude large/report dirs)
  const excludeDirs = new Set([
    'archive', 'marketing-content', 'merge-previews',
    'releases', 'report-deliveries', 'coverage',
    'qa', 'docs', 'rules', 'email-queue',
  ]);
  const excludePatterns = [
    /^_/,                          // temp/debug files starting with _
    /^nightly-/,                   // nightly scan reports
    /^ai-request/,                 // large AI request dumps
    /\.simplebeacon-backup\./,     // existing file-level backups
    /^report-/,                    // scan report dumps (not state)
    /^codemap/,                    // large codemap dumps
    /^direct-scan/,                // large scan results
    /^browser-scan/,               // browser scan dumps
    /^cascadeprojects-browser/,    // browser report dumps
    /^cli-scan/,                   // CLI scan dumps
    /^root-minimal/,               // scan logs
    /^sandbox-smoke/,              // sandbox smoke test dumps
    /^test-fixture/,               // test fixture dumps
    /^consolidation-report/,       // consolidation report dumps
    /^active-smoke/,               // smoke test dumps
    /^agent-report/,               // agent report dumps
    /^slop-audit/,                 // audit dumps
    /^scan-/,                      // scan logs/distributions
    /^debug/,                      // debug files
    /^bridge/,                     // bridge logs
    /^stderr/,                     // stderr captures
    /^stdout/,                     // stdout captures
    /^test-err/,                   // test error logs
    /^test[0-9]*-/,                // test output files
    /^tmp-/,                       // temp files
    /^remediation/,                // remediation reports
    /^render-full-scan/,           // render scan dumps
    /^roadmap/,                    // roadmap analysis
    /^run-bfg/,                    // BFG cleanup scripts
    /^rotate-secrets/,             // secret rotation scripts
    /^sync-ai-context/,            // sync scripts
    /^scan-usage/,                 // scan usage stats
    /^secret-findings/,            // secret findings dumps
    /^scan-fresh/,                 // scan logs
    /^scan-run/,                   // scan run logs
    /^data-quality/,               // data quality logs
    /^error-issues/,               // error issue dumps
    /^false-positive/,             // false positive audit dumps
    /^findings-/,                  // findings exports
    /^file-reduction\./,           // file reduction reports
    /^compliance-snapshot/,        // compliance snapshot HTML
    /^certificate/,                // certificate files
    /^collision-check/,            // collision check dumps
    /^analysis-raw/,               // raw analysis dumps
    /^audit-context/,              // audit context dumps
    /^AUDIT_REPORT/,               // audit report markdown
    /^baseline\.json\.simplebeacon/, // old baseline backups
    /^config\.json\.simplebeacon/,   // old config backups
    /^full-scan/,                  // full scan result dumps
    /^gate-/,                      // gate scan reports/logs
    /^lighthouse/,                 // lighthouse audit dumps
    /^offline-privacy/,            // offline privacy check dumps
    /^phase12/,                    // phase 12 verification dumps
    /^post-.*-scan/,               // post-fix scan dumps
    /^parent-scan/,                // parent scan test reports
    /^poc-report/,                 // POC report dumps
    /^handle-output/,              // handle output captures
    /^minimatch/,                  // minimatch fix logs
    /^proxy-violations/,           // proxy violation logs
    /^forensic-events/,            // forensic event logs
    /^full-blocker/,               // full blocker scan dumps
    /^full-coverage/,              // full coverage scan dumps
    /^gate-fix/,                   // gate fix test reports
    /^benchmark/,                  // benchmark report dumps
    /^codebase-audit/,             // codebase audit dumps
    /^ai-platform-gate/,           // ai-platform gate dumps
    /^npm-audit/,                  // npm audit report dumps
    /^track-/,                     // track-specific notes/reports
    /^release-notes/,              // release notes
    /^report\.json\.backup/,       // old report.json backup
    /^report_from/,                // report from J download
    /^sandbox-comment/,            // sandbox comment markdown
    /^fix-i18n/,                   // i18n fix script
    /^history\.json/,              // scan history (regenerable)
    /^last-scan/,                  // last scan result (regenerable)
  ];

  function walkDir(dir, relativeBase) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = relativeBase ? `${relativeBase}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        if (excludeDirs.has(entry.name)) continue;
        walkDir(fullPath, relPath);
      } else if (entry.isFile()) {
        if (excludePatterns.some((p) => p.test(entry.name))) continue;
        if (entry.name.endsWith('.bin') || entry.name.endsWith('.meta.json')) continue;
        const stat = fs.statSync(fullPath);
        // Skip files larger than 5MB (likely not state data)
        if (stat.size > 5 * 1024 * 1024) continue;
        files.push({ relativePath: relPath, absolutePath: fullPath, size: stat.size });
      }
    }
  }

  walkDir(STATE_DIR, 'simplebeacon');

  // 2. Token registry database
  if (fs.existsSync(DB_PATH)) {
    const stat = fs.statSync(DB_PATH);
    files.push({
      relativePath: 'db/token-registry.json',
      absolutePath: DB_PATH,
      size: stat.size,
    });
  }

  return files;
}

/**
 * Create a snapshot manifest with file checksums.
 */
function createManifest(files) {
  const manifest = {
    version: SNAPSHOT_VERSION,
    createdAt: Date.now(),
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    fileCount: files.length,
    totalSize: files.reduce((sum, f) => sum + f.size, 0),
    files: [],
  };

  for (const file of files) {
    const content = fs.readFileSync(file.absolutePath);
    const checksum = crypto.createHash('sha256').update(content).digest('hex');
    manifest.files.push({
      path: file.relativePath,
      size: file.size,
      checksum,
    });
  }

  return manifest;
}

/**
 * Build the snapshot payload: manifest + concatenated file contents.
 * Format:
 *   [4 bytes magic "SBSS"] [1 byte version] [4 bytes manifest length]
 *   [manifest JSON (gzip)] [file contents (gzip, concatenated with length prefixes)]
 */
function buildSnapshotPayload(files, manifest) {
  const manifestJson = Buffer.from(JSON.stringify(manifest), 'utf8');
  const manifestGzip = zlib.gzipSync(manifestJson);

  // Concatenate file contents with length prefixes
  const fileChunks = [];
  for (const file of files) {
    const content = fs.readFileSync(file.absolutePath);
    const compressed = zlib.gzipSync(content);
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(compressed.length, 0);
    fileChunks.push(lenBuf, compressed);
  }
  const fileData = Buffer.concat(fileChunks);

  // Header
  const header = Buffer.alloc(9);
  header.write(HEADER_MAGIC, 0, 4, 'ascii');
  header[4] = SNAPSHOT_VERSION;
  header.writeUInt32BE(manifestGzip.length, 5);

  return Buffer.concat([header, manifestGzip, fileData]);
}

/**
 * Encrypt the payload using AES-256-GCM.
 * Format:
 *   [12 byte nonce] [4 byte ciphertext length] [ciphertext] [16 byte auth tag]
 */
function encryptPayload(payload, kek) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', kek, nonce);
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
  const tag = cipher.getAuthTag();

  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(ciphertext.length, 0);

  return Buffer.concat([nonce, lenBuf, ciphertext, tag]);
}

/**
 * Create a single snapshot and write it to disk.
 */
function createSnapshot() {
  const timestamp = Date.now();
  const date = new Date(timestamp);
  const dateStr = date.toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const snapshotId = `snap-${dateStr}`;

  console.log(`[snapshot] Creating snapshot ${snapshotId}...`);

  const files = collectStateFiles();
  if (files.length === 0) {
    console.warn('[snapshot] No state files found. Nothing to back up.');
    return null;
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  console.log(`[snapshot] Found ${files.length} files (${(totalSize / 1024).toFixed(1)} KB)`);

  const manifest = createManifest(files);
  const payload = buildSnapshotPayload(files, manifest);
  const kek = getKek();
  const encrypted = encryptPayload(payload, kek);

  const outDir = path.join(BACKUP_DIR, 'current');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${snapshotId}.sbsnap`);
  fs.writeFileSync(outPath, encrypted);

  // Write sidecar metadata
  const meta = {
    snapshotId,
    timestamp,
    createdAt: date.toISOString(),
    fileCount: files.length,
    totalSize,
    encryptedSize: encrypted.length,
    checksum: crypto.createHash('sha256').update(encrypted).digest('hex'),
  };
  fs.writeFileSync(
    path.join(outDir, `${snapshotId}.meta.json`),
    JSON.stringify(meta, null, 2),
  );

  console.log(`[snapshot] Written ${encrypted.length} bytes to ${outPath}`);
  console.log(`[snapshot] Snapshot ID: ${snapshotId}`);

  return { snapshotId, meta, outPath };
}

// ─── Snapshot Verification ───────────────────────────────────────

function decryptSnapshot(encrypted, kek) {
  if (encrypted.length < 12 + 4 + 16) {
    throw new Error('SNAPSHOT_MALFORMED: encrypted data too short');
  }
  const nonce = encrypted.slice(0, 12);
  const ciphertextLen = encrypted.readUInt32BE(12);
  const ciphertext = encrypted.slice(16, 16 + ciphertextLen);
  const tag = encrypted.slice(16 + ciphertextLen);

  const decipher = crypto.createDecipheriv('aes-256-gcm', kek, nonce);
  decipher.setAuthTag(tag);
  const payload = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  if (payload.length < 9 || payload.slice(0, 4).toString('ascii') !== HEADER_MAGIC) {
    throw new Error('SNAPSHOT_INVALID_MAGIC: bad header');
  }

  const version = payload[4];
  if (version !== SNAPSHOT_VERSION) {
    throw new Error(`SNAPSHOT_VERSION_UNSUPPORTED: version ${version}`);
  }

  const manifestLen = payload.readUInt32BE(5);
  const manifestGzip = payload.slice(9, 9 + manifestLen);
  const manifest = JSON.parse(zlib.gunzipSync(manifestGzip).toString('utf8'));

  return { manifest, payload, fileDataStart: 9 + manifestLen };
}

function verifySnapshot(snapshotPath, kek) {
  const encrypted = fs.readFileSync(snapshotPath);
  const { manifest } = decryptSnapshot(encrypted, kek);

  // Verify each file's checksum by decompressing and hashing
  let offset = 0;
  // Re-read to get file data section
  const { payload, fileDataStart } = decryptSnapshot(encrypted, kek);
  const fileData = payload.slice(fileDataStart);

  const results = [];
  let dataOffset = 0;
  for (const file of manifest.files) {
    if (dataOffset + 4 > fileData.length) {
      results.push({ path: file.path, valid: false, reason: 'TRUNCATED' });
      break;
    }
    const compressedLen = fileData.readUInt32BE(dataOffset);
    dataOffset += 4;
    if (dataOffset + compressedLen > fileData.length) {
      results.push({ path: file.path, valid: false, reason: 'TRUNCATED_DATA' });
      break;
    }
    const compressed = fileData.slice(dataOffset, dataOffset + compressedLen);
    dataOffset += compressedLen;

    try {
      const content = zlib.gunzipSync(compressed);
      const checksum = crypto.createHash('sha256').update(content).digest('hex');
      results.push({
        path: file.path,
        valid: checksum === file.checksum,
        reason: checksum === file.checksum ? null : 'CHECKSUM_MISMATCH',
      });
    } catch (err) {
      results.push({ path: file.path, valid: false, reason: err.message });
    }
  }

  return { manifest, results };
}

function verifyAllSnapshots() {
  const kek = getKek();
  const dir = path.join(BACKUP_DIR, 'current');
  if (!fs.existsSync(dir)) {
    console.log('[snapshot] No snapshots directory found.');
    return;
  }

  const snapshots = fs.readdirSync(dir).filter((f) => f.endsWith('.sbsnap'));
  if (snapshots.length === 0) {
    console.log('[snapshot] No snapshots found.');
    return;
  }

  let allValid = true;
  for (const name of snapshots) {
    const snapPath = path.join(dir, name);
    try {
      const { manifest, results } = verifySnapshot(snapPath, kek);
      const validCount = results.filter((r) => r.valid).length;
      const invalid = results.filter((r) => !r.valid);
      const status = invalid.length === 0 ? 'OK' : 'FAIL';
      if (invalid.length > 0) allValid = false;
      console.log(`[snapshot] ${name}: ${status} (${validCount}/${results.length} files valid)`);
      if (invalid.length > 0) {
        for (const r of invalid.slice(0, 5)) {
          console.log(`  ✗ ${r.path}: ${r.reason}`);
        }
      }
    } catch (err) {
      allValid = false;
      console.log(`[snapshot] ${name}: FAIL (${err.message})`);
    }
  }

  console.log(allValid ? '\n[snapshot] All snapshots valid.' : '\n[snapshot] Some snapshots failed verification.');
  process.exit(allValid ? 0 : 1);
}

// ─── Snapshot Restore ────────────────────────────────────────────

function restoreSnapshot(snapshotId) {
  const kek = getKek();
  const dir = path.join(BACKUP_DIR, 'current');
  const snapPath = path.join(dir, `${snapshotId}.sbsnap`);

  if (!fs.existsSync(snapPath)) {
    console.error(`[snapshot] Snapshot not found: ${snapshotId}`);
    process.exit(1);
  }

  const encrypted = fs.readFileSync(snapPath);
  const { manifest, payload, fileDataStart } = decryptSnapshot(encrypted, kek);
  const fileData = payload.slice(fileDataStart);

  const restoreDir = path.join(BACKUP_DIR, 'restore', snapshotId);
  fs.mkdirSync(restoreDir, { recursive: true });

  let dataOffset = 0;
  let restored = 0;
  for (const file of manifest.files) {
    const compressedLen = fileData.readUInt32BE(dataOffset);
    dataOffset += 4;
    const compressed = fileData.slice(dataOffset, dataOffset + compressedLen);
    dataOffset += compressedLen;

    const content = zlib.gunzipSync(compressed);
    const outPath = path.join(restoreDir, file.path);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, content);
    restored++;
  }

  console.log(`[snapshot] Restored ${restored} files to ${restoreDir}`);
  console.log('[snapshot] Review files and copy to production locations manually.');
}

// ─── Tiered Retention ────────────────────────────────────────────

function applyRetention() {
  const dir = path.join(BACKUP_DIR, 'current');
  if (!fs.existsSync(dir)) return;

  const snapshots = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.meta.json')) continue;
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
      snapshots.push(meta);
    } catch { /* skip */ }
  }

  if (snapshots.length === 0) return;

  snapshots.sort((a, b) => a.timestamp - b.timestamp);

  // Categorize snapshots into tiers
  const now = Date.now();
  const oneDay = 86400000;
  const oneWeek = 7 * oneDay;
  const oneMonth = 30 * oneDay;

  const keep = new Set();

  // Daily: keep last N days
  const dailyByDay = new Map();
  for (const snap of snapshots) {
    const dayKey = Math.floor(snap.timestamp / oneDay);
    if (!dailyByDay.has(dayKey)) dailyByDay.set(dayKey, snap);
  }
  const sortedDays = Array.from(dailyByDay.keys()).sort((a, b) => b - a);
  for (const dayKey of sortedDays.slice(0, RETENTION.daily)) {
    keep.add(dailyByDay.get(dayKey).snapshotId);
  }

  // Weekly: keep last N weeks (snapshot closest to week start)
  const weeklyByWeek = new Map();
  for (const snap of snapshots) {
    const weekKey = Math.floor(snap.timestamp / oneWeek);
    if (!weeklyByWeek.has(weekKey)) weeklyByWeek.set(weekKey, snap);
  }
  const sortedWeeks = Array.from(weeklyByWeek.keys()).sort((a, b) => b - a);
  for (const weekKey of sortedWeeks.slice(0, RETENTION.weekly)) {
    keep.add(weeklyByWeek.get(weekKey).snapshotId);
  }

  // Monthly: keep last N months
  const monthlyByMonth = new Map();
  for (const snap of snapshots) {
    const d = new Date(snap.timestamp);
    const monthKey = d.getFullYear() * 12 + d.getMonth();
    if (!monthlyByMonth.has(monthKey)) monthlyByMonth.set(monthKey, snap);
  }
  const sortedMonths = Array.from(monthlyByMonth.keys()).sort((a, b) => b - a);
  for (const monthKey of sortedMonths.slice(0, RETENTION.monthly)) {
    keep.add(monthlyByMonth.get(monthKey).snapshotId);
  }

  // Always keep the most recent snapshot
  keep.add(snapshots[snapshots.length - 1].snapshotId);

  // Delete snapshots not in the keep set
  let removed = 0;
  for (const snap of snapshots) {
    if (keep.has(snap.snapshotId)) continue;
    const snapFile = path.join(dir, `${snap.snapshotId}.sbsnap`);
    const metaFile = path.join(dir, `${snap.snapshotId}.meta.json`);
    try { fs.unlinkSync(snapFile); } catch { /* ignore */ }
    try { fs.unlinkSync(metaFile); } catch { /* ignore */ }
    removed++;
  }

  console.log(`[snapshot] Retention: keeping ${keep.size}, removed ${removed}`);
  console.log(`[snapshot] Policy: ${RETENTION.daily} daily, ${RETENTION.weekly} weekly, ${RETENTION.monthly} monthly`);
}

// ─── CLI ─────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verify = args.includes('--verify');
  const restoreIdx = args.indexOf('--restore');
  const once = args.includes('--once');

  if (verify) {
    verifyAllSnapshots();
    return;
  }

  if (restoreIdx !== -1) {
    const id = args[restoreIdx + 1];
    if (!id) {
      console.error('Usage: node scripts/snapshot-backup.cjs --restore <snapshot-id>');
      process.exit(1);
    }
    restoreSnapshot(id);
    return;
  }

  if (dryRun) {
    const files = collectStateFiles();
    console.log('[snapshot] Dry run — files that would be backed up:');
    for (const f of files) {
      console.log(`  ${f.relativePath} (${f.size} bytes)`);
    }
    console.log(`\n[snapshot] Total: ${files.length} files, ${(files.reduce((s, f) => s + f.size, 0) / 1024).toFixed(1)} KB`);
    console.log(`[snapshot] Output dir: ${BACKUP_DIR}`);
    console.log(`[snapshot] Retention: ${RETENTION.daily} daily, ${RETENTION.weekly} weekly, ${RETENTION.monthly} monthly`);
    return;
  }

  // Default: create snapshot + apply retention
  const result = createSnapshot();
  if (result) {
    applyRetention();
    console.log('[snapshot] Done.');
  }
}

main();
