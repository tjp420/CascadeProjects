'use strict';

/**
 * Backup Snapshot Store — Automated snapshot orchestration worker that
 * cryptographically signs, compresses, and bundles the platform's
 * .simplebeacon/ JSON state records using symmetric keys for secure
 * long-term multi-region storage.
 *
 * Features:
 *   - Snapshot creation: collects all .simplebeacon/ state files, computes
 *     SHA-256 hashes, signs with HMAC-SHA256 using a symmetric key
 *   - Compression: zlib gzip compression of the bundled snapshot
 *   - Manifest: JSON manifest with file list, hashes, sizes, signature
 *   - Restore: verify signature, decompress, restore files to target
 *   - Retention: configurable max snapshots with automatic pruning
 *   - Scheduling: interval-based automatic snapshot creation
 *
 * @module backup-snapshot-store
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const logger = require('./app-logger.cjs');

const SIMPLEBEACON_DIR = path.join(process.cwd(), '.simplebeacon');
const SNAPSHOTS_DIR = path.join(SIMPLEBEACON_DIR, 'snapshots');
const MANIFEST_PATH = path.join(SNAPSHOTS_DIR, 'snapshot-manifest.json');

const DEFAULT_CONFIG = {
  enabled: true,
  intervalMs: 60 * 60 * 1000, // 1 hour
  maxSnapshots: 24,
  compress: true,
  includeSubdirs: true,
  excludePatterns: ['snapshots', '.webhook-key'],
  retentionDays: 7,
};

let _config = null;
let _manifest = null;
let _cacheDirty = true;
let _snapshotTimer = null;

function readConfig() {
  if (!_cacheDirty) return _config;
  try {
    const configPath = path.join(SNAPSHOTS_DIR, 'config.json');
    if (fs.existsSync(configPath)) {
      _config = { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) };
    } else {
      _config = { ...DEFAULT_CONFIG };
    }
  } catch {
    _config = { ...DEFAULT_CONFIG };
  }
  _cacheDirty = false;
  return _config;
}

function writeConfig() {
  ensureDir(SNAPSHOTS_DIR);
  const configPath = path.join(SNAPSHOTS_DIR, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(_config, null, 2), 'utf8');
  _cacheDirty = false;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── Symmetric Key Management ────────────────────────────────────────────────

function getSnapshotKey() {
  // Use env var or generate/retrieve from key file
  if (process.env.SIMPLEBEACON_SNAPSHOT_KEY) {
    return Buffer.from(process.env.SIMPLEBEACON_SNAPSHOT_KEY, 'hex');
  }

  const keyPath = path.join(SNAPSHOTS_DIR, '.snapshot-key');
  ensureDir(SNAPSHOTS_DIR);

  if (fs.existsSync(keyPath)) {
    return Buffer.from(fs.readFileSync(keyPath, 'utf8').trim(), 'hex');
  }

  // Generate new 256-bit key
  const key = crypto.randomBytes(32);
  fs.writeFileSync(keyPath, key.toString('hex'), 'utf8');
  logger.info('[BackupSnapshot] Generated new snapshot signing key');
  return key;
}

function hmacSign(data, key) {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// ── Manifest Management ─────────────────────────────────────────────────────

function readManifest() {
  if (_manifest) return _manifest;
  try {
    if (fs.existsSync(MANIFEST_PATH)) {
      _manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    } else {
      _manifest = { snapshots: [] };
    }
  } catch {
    _manifest = { snapshots: [] };
  }
  return _manifest;
}

function writeManifest() {
  ensureDir(SNAPSHOTS_DIR);
  const tmp = MANIFEST_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(_manifest, null, 2), 'utf8');
  fs.renameSync(tmp, MANIFEST_PATH);
}

// ── File Collection ─────────────────────────────────────────────────────────

function shouldExclude(filePath, config) {
  const relativePath = path.relative(SIMPLEBEACON_DIR, filePath);
  for (const pattern of config.excludePatterns) {
    if (relativePath.startsWith(pattern) || relativePath.includes(pattern)) {
      return true;
    }
  }
  return false;
}

function collectFiles(dir, config, baseDir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      if (config.includeSubdirs && !shouldExclude(fullPath, config)) {
        files.push(...collectFiles(fullPath, config, baseDir));
      }
    } else if (entry.isFile()) {
      if (!shouldExclude(fullPath, config)) {
        const stat = fs.statSync(fullPath);
        files.push({
          relativePath,
          absolutePath: fullPath,
          size: stat.size,
          hash: sha256(fs.readFileSync(fullPath)),
        });
      }
    }
  }

  return files;
}

// ── Snapshot Creation ───────────────────────────────────────────────────────

function createSnapshot(options = {}) {
  const config = readConfig();
  const startTime = Date.now();

  try {
    if (!fs.existsSync(SIMPLEBEACON_DIR)) {
      return { success: false, error: 'No .simplebeacon directory found' };
    }

    // Collect all state files
    const files = collectFiles(SIMPLEBEACON_DIR, config, SIMPLEBEACON_DIR);

    if (files.length === 0) {
      return { success: false, error: 'No files found to snapshot' };
    }

    // Build snapshot data
    const snapshotId = `snap-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const timestamp = new Date().toISOString();

    // Read all file contents
    const fileEntries = [];
    let totalUncompressed = 0;

    for (const file of files) {
      const content = fs.readFileSync(file.absolutePath);
      totalUncompressed += content.length;
      fileEntries.push({
        path: file.relativePath,
        size: file.size,
        hash: file.hash,
        content: content.toString('base64'),
      });
    }

    const snapshotData = {
      id: snapshotId,
      timestamp,
      version: 1,
      fileCount: files.length,
      totalUncompressedSize: totalUncompressed,
      files: fileEntries,
    };

    // Serialize and optionally compress
    const jsonStr = JSON.stringify(snapshotData);
    let payload = Buffer.from(jsonStr, 'utf8');
    let compressed = false;

    if (config.compress) {
      payload = zlib.gzipSync(payload);
      compressed = true;
    }

    // Sign the payload
    const key = getSnapshotKey();
    const signature = hmacSign(payload, key);

    // Write snapshot file
    ensureDir(SNAPSHOTS_DIR);
    const snapshotPath = path.join(SNAPSHOTS_DIR, `${snapshotId}.snap`);
    fs.writeFileSync(snapshotPath, payload);

    // Get compressed size
    const compressedSize = payload.length;

    // Record in manifest
    const manifest = readManifest();
    const manifestEntry = {
      id: snapshotId,
      timestamp,
      fileCount: files.length,
      uncompressedSize: totalUncompressed,
      compressedSize,
      compressed,
      signature,
      filePath: path.relative(SIMPLEBEACON_DIR, snapshotPath),
      createdBy: options.userId || 'system',
      durationMs: Date.now() - startTime,
    };

    manifest.snapshots.push(manifestEntry);

    // Prune old snapshots
    pruneSnapshots(manifest, config);

    writeManifest();

    logger.info(`[BackupSnapshot] Created snapshot ${snapshotId}: ${files.length} files, ${totalUncompressed} bytes -> ${compressedSize} bytes`);

    return {
      success: true,
      snapshot: manifestEntry,
    };
  } catch (err) {
    logger.error('[BackupSnapshot] Create snapshot failed:', err.message);
    return { success: false, error: err.message };
  }
}

// ── Snapshot Restore ────────────────────────────────────────────────────────

function restoreSnapshot(snapshotId, options = {}) {
  try {
    const config = readConfig();
    const manifest = readManifest();
    const entry = manifest.snapshots.find((s) => s.id === snapshotId);

    if (!entry) {
      return { success: false, error: 'Snapshot not found' };
    }

    const snapshotPath = path.join(SIMPLEBEACON_DIR, entry.filePath);
    if (!fs.existsSync(snapshotPath)) {
      return { success: false, error: 'Snapshot file missing' };
    }

    // Read and verify signature
    const payload = fs.readFileSync(snapshotPath);
    const key = getSnapshotKey();
    const expectedSig = hmacSign(payload, key);

    if (expectedSig !== entry.signature) {
      return { success: false, error: 'Signature verification failed — snapshot may be tampered' };
    }

    // Decompress if needed
    let jsonBuffer = payload;
    if (entry.compressed) {
      jsonBuffer = zlib.gunzipSync(payload);
    }

    const snapshotData = JSON.parse(jsonBuffer.toString('utf8'));

    // Restore files
    const targetDir = options.targetDir || SIMPLEBEACON_DIR;
    let restoredCount = 0;

    for (const file of snapshotData.files) {
      const targetPath = path.join(targetDir, file.path);
      ensureDir(path.dirname(targetPath));

      const content = Buffer.from(file.content, 'base64');

      // Verify file hash
      const fileHash = sha256(content);
      if (fileHash !== file.hash) {
        logger.warn(`[BackupSnapshot] Hash mismatch for ${file.path}, skipping`);
        continue;
      }

      fs.writeFileSync(targetPath, content);
      restoredCount++;
    }

    logger.info(`[BackupSnapshot] Restored snapshot ${snapshotId}: ${restoredCount}/${snapshotData.files.length} files`);

    return {
      success: true,
      restoredCount,
      totalFiles: snapshotData.files.length,
      timestamp: snapshotData.timestamp,
    };
  } catch (err) {
    logger.error('[BackupSnapshot] Restore failed:', err.message);
    return { success: false, error: err.message };
  }
}

// ── Snapshot Verification ───────────────────────────────────────────────────

function verifySnapshot(snapshotId) {
  try {
    const manifest = readManifest();
    const entry = manifest.snapshots.find((s) => s.id === snapshotId);

    if (!entry) {
      return { success: false, error: 'Snapshot not found' };
    }

    const snapshotPath = path.join(SIMPLEBEACON_DIR, entry.filePath);
    if (!fs.existsSync(snapshotPath)) {
      return { success: false, error: 'Snapshot file missing', verified: false };
    }

    const payload = fs.readFileSync(snapshotPath);
    const key = getSnapshotKey();
    const expectedSig = hmacSign(payload, key);
    const valid = expectedSig === entry.signature;

    return {
      success: true,
      verified: valid,
      snapshotId,
      signature: entry.signature,
      computedSignature: expectedSig,
    };
  } catch (err) {
    return { success: false, error: err.message, verified: false };
  }
}

// ── Snapshot Deletion ───────────────────────────────────────────────────────

function deleteSnapshot(snapshotId) {
  try {
    const manifest = readManifest();
    const entry = manifest.snapshots.find((s) => s.id === snapshotId);

    if (!entry) {
      return { success: false, error: 'Snapshot not found' };
    }

    // Delete file
    const snapshotPath = path.join(SIMPLEBEACON_DIR, entry.filePath);
    if (fs.existsSync(snapshotPath)) {
      fs.unlinkSync(snapshotPath);
    }

    // Remove from manifest
    manifest.snapshots = manifest.snapshots.filter((s) => s.id !== snapshotId);
    writeManifest();

    logger.info(`[BackupSnapshot] Deleted snapshot ${snapshotId}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Pruning ─────────────────────────────────────────────────────────────────

function pruneSnapshots(manifest, config) {
  const max = config.maxSnapshots;
  const retentionMs = config.retentionDays * 24 * 60 * 60 * 1000;
  const now = Date.now();

  // Sort by timestamp descending
  manifest.snapshots.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Remove expired snapshots
  const toKeep = [];
  for (const snap of manifest.snapshots) {
    const age = now - new Date(snap.timestamp).getTime();
    if (age <= retentionMs && toKeep.length < max) {
      toKeep.push(snap);
    } else {
      // Delete the file
      const snapPath = path.join(SIMPLEBEACON_DIR, snap.filePath);
      try {
        if (fs.existsSync(snapPath)) fs.unlinkSync(snapPath);
      } catch {
        // silent
      }
    }
  }

  manifest.snapshots = toKeep;
}

// ── Query Functions ─────────────────────────────────────────────────────────

function listSnapshots() {
  const manifest = readManifest();
  return manifest.snapshots.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function getSnapshotInfo(snapshotId) {
  const manifest = readManifest();
  return manifest.snapshots.find((s) => s.id === snapshotId) || null;
}

function getStats() {
  const manifest = readManifest();
  const snapshots = manifest.snapshots;
  const totalUncompressed = snapshots.reduce((sum, s) => sum + s.uncompressedSize, 0);
  const totalCompressed = snapshots.reduce((sum, s) => sum + s.compressedSize, 0);
  const totalFiles = snapshots.reduce((sum, s) => sum + s.fileCount, 0);

  return {
    totalSnapshots: snapshots.length,
    totalUncompressedSize: totalUncompressed,
    totalCompressedSize: totalCompressed,
    totalFiles,
    compressionRatio: totalUncompressed > 0
      ? Math.round((1 - totalCompressed / totalUncompressed) * 10000) / 100
      : 0,
    oldestSnapshot: snapshots.length > 0
      ? snapshots.reduce((oldest, s) => new Date(s.timestamp) < new Date(oldest.timestamp) ? s : oldest).timestamp
      : null,
    newestSnapshot: snapshots.length > 0
      ? snapshots.reduce((newest, s) => new Date(s.timestamp) > new Date(newest.timestamp) ? s : newest).timestamp
      : null,
  };
}

function getConfig() {
  return readConfig();
}

function updateConfig(updates) {
  const config = readConfig();
  Object.assign(config, updates);
  writeConfig();

  // Restart scheduler if interval changed
  if (updates.intervalMs !== undefined || updates.enabled !== undefined) {
    restartScheduler();
  }

  return { success: true, config };
}

function resetConfig() {
  _config = { ...DEFAULT_CONFIG };
  writeConfig();
  restartScheduler();
  return { success: true, config: _config };
}

// ── Scheduler ───────────────────────────────────────────────────────────────

function startScheduler() {
  const config = readConfig();
  if (!config.enabled) return;
  if (_snapshotTimer) clearInterval(_snapshotTimer);

  _snapshotTimer = setInterval(() => {
    logger.info('[BackupSnapshot] Scheduled snapshot triggered');
    createSnapshot({ userId: 'scheduler' });
  }, config.intervalMs);

  logger.info(`[BackupSnapshot] Scheduler started with ${config.intervalMs}ms interval`);
}

function stopScheduler() {
  if (_snapshotTimer) {
    clearInterval(_snapshotTimer);
    _snapshotTimer = null;
    logger.info('[BackupSnapshot] Scheduler stopped');
  }
}

function restartScheduler() {
  stopScheduler();
  startScheduler();
}

module.exports = {
  createSnapshot,
  restoreSnapshot,
  verifySnapshot,
  deleteSnapshot,
  listSnapshots,
  getSnapshotInfo,
  getStats,
  getConfig,
  updateConfig,
  resetConfig,
  startScheduler,
  stopScheduler,
  restartScheduler,
};
