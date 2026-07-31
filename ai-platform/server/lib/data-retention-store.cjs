'use strict';

/**
 * Data Retention Store — Configurable data lifecycle daemon that
 * automatically scans, overwrites, and deletes historic logs or
 * analytics data when they breach organization retention bounds.
 *
 * Features:
 *   - Per-category retention policies (audit_logs, alert_incidents,
 *     guardrail_incidents, session_audit, usage_analytics,
 *     proxy_performance, browser_errors, report_deliveries,
 *     quarantine, backup_files, logs)
 *   - Configurable retention days per category (30/90/365)
 *   - Automatic purge daemon with interval-based scanning
 *   - Safe purge: overwrites file content before deletion for secure
 *     erasure, prunes array entries by timestamp
 *   - Purge history tracking with before/after sizes
 *   - Dry-run mode to preview what would be purged
 *
 * @module data-retention-store
 */

const fs = require('fs');
const path = require('path');
const logger = require('./app-logger.cjs');

const SIMPLEBEACON_DIR = path.join(process.cwd(), '.simplebeacon');
const STORE_PATH = path.join(SIMPLEBEACON_DIR, 'data-retention.json');

// ── Data Categories ─────────────────────────────────────────────────────────

const CATEGORIES = {
  audit_logs: {
    name: 'Audit Logs',
    files: ['audit-log.json', 'enterprise-audit.json'],
    type: 'json_array',
    timestampField: 'timestamp',
    defaultRetentionDays: 90,
  },
  alert_incidents: {
    name: 'Alert Incidents',
    files: ['alert-incidents.json'],
    type: 'json_array',
    timestampField: 'timestamp',
    defaultRetentionDays: 30,
  },
  guardrail_incidents: {
    name: 'Guardrail Incidents',
    files: ['guardrail-incidents.json'],
    type: 'json_array',
    timestampField: 'timestamp',
    defaultRetentionDays: 30,
  },
  session_audit: {
    name: 'Session Audit',
    files: ['session-audit.json'],
    type: 'json_object_sessions',
    timestampField: 'updatedAt',
    defaultRetentionDays: 90,
  },
  usage_analytics: {
    name: 'Usage Analytics',
    files: ['usage-analytics.json'],
    type: 'json_analytics',
    timestampField: 'timestamp',
    defaultRetentionDays: 90,
  },
  proxy_performance: {
    name: 'Proxy Performance',
    files: ['proxy-performance.json'],
    type: 'json_performance',
    timestampField: 'ts',
    defaultRetentionDays: 7,
  },
  browser_errors: {
    name: 'Browser Errors',
    files: ['browser-errors.ndjson'],
    type: 'ndjson',
    timestampField: 'timestamp',
    defaultRetentionDays: 14,
  },
  report_deliveries: {
    name: 'Report Deliveries',
    dir: 'report-deliveries',
    type: 'directory_files',
    defaultRetentionDays: 30,
  },
  quarantine: {
    name: 'Quarantine',
    dir: 'quarantine',
    type: 'directory_files',
    defaultRetentionDays: 14,
  },
  backup_files: {
    name: 'Backup Files',
    type: 'backup_files',
    pattern: '.simplebeacon-backup.',
    defaultRetentionDays: 7,
  },
  logs: {
    name: 'Log Files',
    dir: 'logs',
    type: 'directory_files',
    defaultRetentionDays: 7,
  },
};

// ── Default Config ─────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  enabled: true,
  intervalMs: 6 * 60 * 60 * 1000,
  dryRun: false,
  secureDelete: true,
  policies: {},
};

for (const [catId, cat] of Object.entries(CATEGORIES)) {
  DEFAULT_CONFIG.policies[catId] = {
    enabled: true,
    retentionDays: cat.defaultRetentionDays,
  };
}

// ── Store State ─────────────────────────────────────────────────────────────

let _config = null;
let _cacheDirty = true;
let _purgeTimer = null;
const _purgeHistory = [];
const MAX_PURGE_HISTORY = 100;

function readConfig() {
  if (!_cacheDirty) return _config;
  try {
    if (fs.existsSync(STORE_PATH)) {
      _config = { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) };
      for (const catId of Object.keys(CATEGORIES)) {
        _config.policies[catId] = {
          ...DEFAULT_CONFIG.policies[catId],
          ...(_config.policies[catId] || {}),
        };
      }
    } else {
      _config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }
  } catch {
    _config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
  _cacheDirty = false;
  return _config;
}

function writeConfig() {
  ensureDir(SIMPLEBEACON_DIR);
  const tmp = STORE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(_config, null, 2), 'utf8');
  fs.renameSync(tmp, STORE_PATH);
  _cacheDirty = false;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── Purge Functions ─────────────────────────────────────────────────────────

function purgeJsonArray(filePath, retentionDays, timestampField, dryRun, secureDelete) {
  if (!fs.existsSync(filePath)) return { purged: 0, remaining: 0, sizeBefore: 0, sizeAfter: 0 };
  const sizeBefore = fs.statSync(filePath).size;
  const raw = fs.readFileSync(filePath, 'utf8');
  let data;
  try { data = JSON.parse(raw); } catch {
    return { purged: 0, remaining: 0, sizeBefore, sizeAfter: sizeBefore, error: 'parse_error' };
  }
  if (!Array.isArray(data)) {
    return { purged: 0, remaining: 0, sizeBefore, sizeAfter: sizeBefore, error: 'not_array' };
  }
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const before = data.length;
  const kept = data.filter((entry) => {
    const ts = entry[timestampField] || entry.timestamp || entry.ts || entry.createdAt;
    if (!ts) return true;
    return new Date(ts).getTime() >= cutoff;
  });
  const purged = before - kept.length;
  if (!dryRun && purged > 0) {
    if (secureDelete) {
      const fd = fs.openSync(filePath, 'w');
      fs.writeSync(fd, Buffer.alloc(sizeBefore, 0));
      fs.closeSync(fd);
    }
    fs.writeFileSync(filePath, JSON.stringify(kept, null, 2), 'utf8');
  }
  const sizeAfter = dryRun ? sizeBefore : fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
  return { purged, remaining: kept.length, sizeBefore, sizeAfter };
}

function purgeJsonObjectSessions(filePath, retentionDays, timestampField, dryRun, secureDelete) {
  if (!fs.existsSync(filePath)) return { purged: 0, remaining: 0, sizeBefore: 0, sizeAfter: 0 };
  const sizeBefore = fs.statSync(filePath).size;
  const raw = fs.readFileSync(filePath, 'utf8');
  let data;
  try { data = JSON.parse(raw); } catch {
    return { purged: 0, remaining: 0, sizeBefore, sizeAfter: sizeBefore, error: 'parse_error' };
  }
  if (typeof data !== 'object' || data === null) {
    return { purged: 0, remaining: 0, sizeBefore, sizeAfter: sizeBefore, error: 'not_object' };
  }
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const before = Object.keys(data).length;
  const kept = {};
  for (const [key, value] of Object.entries(data)) {
    const ts = value?.[timestampField] || value?.updatedAt || value?.timestamp || value?.createdAt;
    if (!ts || new Date(ts).getTime() >= cutoff) {
      kept[key] = value;
    }
  }
  const purged = before - Object.keys(kept).length;
  if (!dryRun && purged > 0) {
    if (secureDelete) {
      const fd = fs.openSync(filePath, 'w');
      fs.writeSync(fd, Buffer.alloc(sizeBefore, 0));
      fs.closeSync(fd);
    }
    fs.writeFileSync(filePath, JSON.stringify(kept, null, 2), 'utf8');
  }
  const sizeAfter = dryRun ? sizeBefore : fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
  return { purged, remaining: Object.keys(kept).length, sizeBefore, sizeAfter };
}

function purgeJsonAnalytics(filePath, retentionDays, dryRun, secureDelete) {
  if (!fs.existsSync(filePath)) return { purged: 0, remaining: 0, sizeBefore: 0, sizeAfter: 0 };
  const sizeBefore = fs.statSync(filePath).size;
  const raw = fs.readFileSync(filePath, 'utf8');
  let data;
  try { data = JSON.parse(raw); } catch {
    return { purged: 0, remaining: 0, sizeBefore, sizeAfter: sizeBefore, error: 'parse_error' };
  }
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let purged = 0;
  function pruneArray(arr) {
    if (!Array.isArray(arr)) return arr;
    const before = arr.length;
    const kept = arr.filter((entry) => {
      const ts = entry.ts || entry.timestamp;
      return !ts || new Date(ts).getTime() >= cutoff;
    });
    purged += before - kept.length;
    return kept;
  }
  function walk(obj) {
    if (Array.isArray(obj)) return pruneArray(obj);
    if (typeof obj === 'object' && obj !== null) {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        if (Array.isArray(value)) result[key] = pruneArray(value);
        else if (typeof value === 'object' && value !== null) result[key] = walk(value);
        else result[key] = value;
      }
      return result;
    }
    return obj;
  }
  const cleaned = walk(data);
  if (!dryRun && purged > 0) {
    if (secureDelete) {
      const fd = fs.openSync(filePath, 'w');
      fs.writeSync(fd, Buffer.alloc(sizeBefore, 0));
      fs.closeSync(fd);
    }
    fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2), 'utf8');
  }
  const sizeAfter = dryRun ? sizeBefore : fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
  return { purged, remaining: 0, sizeBefore, sizeAfter };
}

function purgeJsonPerformance(filePath, retentionDays, dryRun, secureDelete) {
  if (!fs.existsSync(filePath)) return { purged: 0, remaining: 0, sizeBefore: 0, sizeAfter: 0 };
  const sizeBefore = fs.statSync(filePath).size;
  const raw = fs.readFileSync(filePath, 'utf8');
  let data;
  try { data = JSON.parse(raw); } catch {
    return { purged: 0, remaining: 0, sizeBefore, sizeAfter: sizeBefore, error: 'parse_error' };
  }
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let purged = 0;
  if (data.recentMetrics && Array.isArray(data.recentMetrics)) {
    const before = data.recentMetrics.length;
    data.recentMetrics = data.recentMetrics.filter((m) => m.ts >= cutoff);
    purged += before - data.recentMetrics.length;
  }
  if (data.rollups && Array.isArray(data.rollups)) {
    const before = data.rollups.length;
    data.rollups = data.rollups.filter((r) => r.ts >= cutoff);
    purged += before - data.rollups.length;
  }
  if (data.queueBackpressure && Array.isArray(data.queueBackpressure)) {
    const before = data.queueBackpressure.length;
    data.queueBackpressure = data.queueBackpressure.filter((q) => q.ts >= cutoff);
    purged += before - data.queueBackpressure.length;
  }
  if (!dryRun && purged > 0) {
    if (secureDelete) {
      const fd = fs.openSync(filePath, 'w');
      fs.writeSync(fd, Buffer.alloc(sizeBefore, 0));
      fs.closeSync(fd);
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }
  const sizeAfter = dryRun ? sizeBefore : fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
  return { purged, remaining: 0, sizeBefore, sizeAfter };
}

function purgeNdjson(filePath, retentionDays, timestampField, dryRun, secureDelete) {
  if (!fs.existsSync(filePath)) return { purged: 0, remaining: 0, sizeBefore: 0, sizeAfter: 0 };
  const sizeBefore = fs.statSync(filePath).size;
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split('\n').filter(Boolean);
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const kept = [];
  let purged = 0;
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      const ts = entry[timestampField] || entry.timestamp;
      if (!ts || new Date(ts).getTime() >= cutoff) kept.push(line);
      else purged++;
    } catch { kept.push(line); }
  }
  if (!dryRun && purged > 0) {
    if (secureDelete) {
      const fd = fs.openSync(filePath, 'w');
      fs.writeSync(fd, Buffer.alloc(sizeBefore, 0));
      fs.closeSync(fd);
    }
    fs.writeFileSync(filePath, kept.join('\n') + '\n', 'utf8');
  }
  const sizeAfter = dryRun ? sizeBefore : fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
  return { purged, remaining: kept.length, sizeBefore, sizeAfter };
}

function purgeDirectoryFiles(dirPath, retentionDays, dryRun, secureDelete) {
  if (!fs.existsSync(dirPath)) return { purged: 0, remaining: 0, sizeBefore: 0, sizeAfter: 0 };
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(dirPath).filter((f) => {
    const fullPath = path.join(dirPath, f);
    return fs.statSync(fullPath).isFile();
  });
  let purged = 0;
  let sizeBefore = 0;
  let sizeAfter = 0;
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    sizeBefore += stat.size;
    if (stat.mtimeMs < cutoff) {
      if (!dryRun) {
        if (secureDelete) {
          const fd = fs.openSync(fullPath, 'r+');
          fs.writeSync(fd, Buffer.alloc(stat.size, 0));
          fs.closeSync(fd);
        }
        fs.unlinkSync(fullPath);
      }
      purged++;
    } else { sizeAfter += stat.size; }
  }
  if (dryRun) sizeAfter = sizeBefore;
  return { purged, remaining: files.length - purged, sizeBefore, sizeAfter };
}

function purgeBackupFiles(retentionDays, dryRun, secureDelete) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(SIMPLEBEACON_DIR).filter((f) => f.includes('.simplebeacon-backup.'));
  let purged = 0;
  let sizeBefore = 0;
  let sizeAfter = 0;
  for (const file of files) {
    const fullPath = path.join(SIMPLEBEACON_DIR, file);
    const stat = fs.statSync(fullPath);
    sizeBefore += stat.size;
    if (stat.mtimeMs < cutoff) {
      if (!dryRun) {
        if (secureDelete) {
          const fd = fs.openSync(fullPath, 'r+');
          fs.writeSync(fd, Buffer.alloc(stat.size, 0));
          fs.closeSync(fd);
        }
        fs.unlinkSync(fullPath);
      }
      purged++;
    } else { sizeAfter += stat.size; }
  }
  if (dryRun) sizeAfter = sizeBefore;
  return { purged, remaining: files.length - purged, sizeBefore, sizeAfter };
}

// ── Main Purge Runner ───────────────────────────────────────────────────────

function runPurge(options = {}) {
  const config = readConfig();
  const dryRun = options.dryRun !== undefined ? options.dryRun : config.dryRun;
  const startTime = Date.now();
  const results = {};
  let totalPurged = 0;
  let totalSizeFreed = 0;

  for (const [catId, cat] of Object.entries(CATEGORIES)) {
    const policy = config.policies[catId];
    if (!policy || !policy.enabled) {
      results[catId] = { skipped: true };
      continue;
    }
    try {
      let result;
      if (cat.type === 'json_array') {
        result = purgeJsonArray(path.join(SIMPLEBEACON_DIR, cat.files[0]), policy.retentionDays, cat.timestampField, dryRun, config.secureDelete);
      } else if (cat.type === 'json_object_sessions') {
        result = purgeJsonObjectSessions(path.join(SIMPLEBEACON_DIR, cat.files[0]), policy.retentionDays, cat.timestampField, dryRun, config.secureDelete);
      } else if (cat.type === 'json_analytics') {
        result = purgeJsonAnalytics(path.join(SIMPLEBEACON_DIR, cat.files[0]), policy.retentionDays, dryRun, config.secureDelete);
      } else if (cat.type === 'json_performance') {
        result = purgeJsonPerformance(path.join(SIMPLEBEACON_DIR, cat.files[0]), policy.retentionDays, dryRun, config.secureDelete);
      } else if (cat.type === 'ndjson') {
        result = purgeNdjson(path.join(SIMPLEBEACON_DIR, cat.files[0]), policy.retentionDays, cat.timestampField, dryRun, config.secureDelete);
      } else if (cat.type === 'directory_files') {
        result = purgeDirectoryFiles(path.join(SIMPLEBEACON_DIR, cat.dir), policy.retentionDays, dryRun, config.secureDelete);
      } else if (cat.type === 'backup_files') {
        result = purgeBackupFiles(policy.retentionDays, dryRun, config.secureDelete);
      } else {
        results[catId] = { skipped: true, reason: 'unknown_type' };
        continue;
      }
      results[catId] = result;
      totalPurged += result.purged || 0;
      totalSizeFreed += (result.sizeBefore || 0) - (result.sizeAfter || 0);
    } catch (err) {
      results[catId] = { error: err.message };
      logger.warn(`[DataRetention] Purge failed for ${catId}: ${err.message}`);
    }
  }

  const durationMs = Date.now() - startTime;
  const purgeRecord = {
    id: `purge-${Date.now()}`,
    timestamp: new Date().toISOString(),
    dryRun,
    durationMs,
    totalPurged,
    totalSizeFreed,
    results,
    triggeredBy: options.userId || 'system',
  };

  if (!dryRun) {
    _purgeHistory.push(purgeRecord);
    if (_purgeHistory.length > MAX_PURGE_HISTORY) _purgeHistory.shift();
  }

  logger.info(`[DataRetention] Purge complete: ${totalPurged} items, ${totalSizeFreed} bytes freed, ${durationMs}ms`);
  return { success: true, ...purgeRecord };
}

// ── Public API ──────────────────────────────────────────────────────────────

function getConfig() {
  return { ...readConfig(), categories: CATEGORIES };
}

function updateConfig(updates) {
  const config = readConfig();
  if (updates.enabled !== undefined) config.enabled = updates.enabled;
  if (updates.intervalMs !== undefined) config.intervalMs = updates.intervalMs;
  if (updates.dryRun !== undefined) config.dryRun = updates.dryRun;
  if (updates.secureDelete !== undefined) config.secureDelete = updates.secureDelete;
  if (updates.policies) {
    for (const [catId, policy] of Object.entries(updates.policies)) {
      if (config.policies[catId]) {
        config.policies[catId] = { ...config.policies[catId], ...policy };
      }
    }
  }
  writeConfig();
  if (updates.intervalMs !== undefined || updates.enabled !== undefined) restartScheduler();
  return { success: true, config };
}

function resetConfig() {
  _config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  writeConfig();
  restartScheduler();
  return { success: true, config: _config };
}

function updatePolicy(catId, updates) {
  const config = readConfig();
  if (!config.policies[catId]) return { success: false, error: 'Unknown category' };
  config.policies[catId] = { ...config.policies[catId], ...updates };
  writeConfig();
  return { success: true, policy: config.policies[catId] };
}

function getPurgeHistory(limit = 20) {
  return [..._purgeHistory].reverse().slice(0, limit);
}

function getStats() {
  const config = readConfig();
  const totalPurges = _purgeHistory.length;
  const totalItemsPurged = _purgeHistory.reduce((sum, r) => sum + r.totalPurged, 0);
  const totalSizeFreed = _purgeHistory.reduce((sum, r) => sum + r.totalSizeFreed, 0);
  const lastPurge = _purgeHistory.length > 0 ? _purgeHistory[_purgeHistory.length - 1] : null;
  const enabledCategories = Object.entries(config.policies).filter(([, p]) => p.enabled).length;
  const totalCategories = Object.keys(CATEGORIES).length;
  return {
    totalPurges,
    totalItemsPurged,
    totalSizeFreed,
    lastPurge: lastPurge ? {
      timestamp: lastPurge.timestamp,
      totalPurged: lastPurge.totalPurged,
      totalSizeFreed: lastPurge.totalSizeFreed,
      durationMs: lastPurge.durationMs,
    } : null,
    enabledCategories,
    totalCategories,
    schedulerActive: config.enabled && !!_purgeTimer,
    dryRun: config.dryRun,
  };
}

function previewPurge() {
  return runPurge({ dryRun: true });
}

function clearHistory() {
  _purgeHistory.length = 0;
  return { success: true };
}

// ── Scheduler ───────────────────────────────────────────────────────────────

function startScheduler() {
  const config = readConfig();
  if (!config.enabled) return;
  if (_purgeTimer) clearInterval(_purgeTimer);
  _purgeTimer = setInterval(() => {
    logger.info('[DataRetention] Scheduled purge triggered');
    runPurge({ userId: 'scheduler' });
  }, config.intervalMs);
  logger.info(`[DataRetention] Scheduler started with ${config.intervalMs}ms interval`);
}

function stopScheduler() {
  if (_purgeTimer) {
    clearInterval(_purgeTimer);
    _purgeTimer = null;
    logger.info('[DataRetention] Scheduler stopped');
  }
}

function restartScheduler() {
  stopScheduler();
  startScheduler();
}

module.exports = {
  runPurge,
  previewPurge,
  getConfig,
  updateConfig,
  resetConfig,
  updatePolicy,
  getPurgeHistory,
  getStats,
  clearHistory,
  startScheduler,
  stopScheduler,
  restartScheduler,
  CATEGORIES,
};
