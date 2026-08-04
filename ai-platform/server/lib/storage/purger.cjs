"use strict";

const fs = require('fs');
const path = require('path');
let events = null;
try {
  events = require('../hsm-adapter/events.cjs');
} catch (e) {
  try {
    events = require(require('path').join(__dirname, '..', 'hsm-adapter', 'events.cjs'));
  } catch (e2) {
    events = { recordSparseEvent: function() {} };
  }
}
const logger = require('../app-logger.cjs').child('upload-purger');

class Purger {
  constructor({ baseDir = path.join(process.cwd(), '.data', 'track112'), ttlHours = 24, intervalMinutes = 15 } = {}) {
    this.baseDir = baseDir;
    this.ttlMs = (ttlHours || 24) * 60 * 60 * 1000;
    this.intervalMs = (intervalMinutes || 15) * 60 * 1000;
    this._timer = null;
  }

  _scanOnce() {
    try {
      const tenants = fs.readdirSync(this.baseDir).filter(d => fs.statSync(path.join(this.baseDir, d)).isDirectory());
      for (const t of tenants) {
        if (t === '_committed') continue;
        const td = path.join(this.baseDir, t);
        for (const s of fs.readdirSync(td)) {
          const dir = path.join(td, s);
          const metaPath = path.join(dir, 'meta.json');
          if (!fs.existsSync(metaPath)) continue;
          let meta = null;
          try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch (e) { meta = null; }
          if (!meta) continue;
          if (meta.committed) continue;
          const age = Date.now() - (meta.lastTouch || meta.createdAt || 0);
          if (age > this.ttlMs) {
            try {
              fs.rmSync(dir, { recursive: true, force: true });
              events.recordSparseEvent('upload_purged', { tenant: t, sessionId: s, reason: 'ttl_expired', traceId: meta.traceId });
              logger.info('purged stale upload', { tenant: t, sessionId: s, reason: 'ttl_expired' });
            } catch (e) {
              logger.warn('purge failed', e && e.message ? e.message : String(e));
            }
          }
        }
      }
    } catch (e) {
      logger.warn('purger scan error', e && e.message ? e.message : String(e));
    }
  }

  start() {
    if (this._timer) return;
    this._scanOnce();
    this._timer = setInterval(() => this._scanOnce(), this.intervalMs);
  }

  stop() {
    if (!this._timer) return;
    clearInterval(this._timer);
    this._timer = null;
  }

  /**
   * Crawl a tenant-scoped session directory and delete .json session records
   * whose updatedAt/createdAt/mtime is older than the configured TTL.
   * @param {string} baseDir - e.g. server/.data/ratchet-sessions
   * @param {number} [ttlHours=24]
   * @returns {{tenant: string, sessionId: string, path: string}[]} deleted sessions
   */
  static purgeExpiredSessions(baseDir, ttlHours = 24) {
    const ttlMs = (ttlHours == null ? 24 : ttlHours) * 60 * 60 * 1000;
    const now = Date.now();
    const purged = [];
    try {
      const tenants = fs.readdirSync(baseDir).filter(d => {
        try {
          return fs.statSync(path.join(baseDir, d)).isDirectory();
        } catch (e) {
          return false;
        }
      });
      for (const t of tenants) {
        const td = path.join(baseDir, t);
        for (const f of fs.readdirSync(td)) {
          if (!f.endsWith('.json')) continue;
          const fp = path.join(td, f);
          let mtime = now;
          try {
            mtime = fs.statSync(fp).mtime.getTime();
          } catch (e) {
            continue;
          }

          let lastTouch = mtime;
          let sessionId = path.basename(f, '.json');
          try {
            const raw = fs.readFileSync(fp, 'utf8');
            const meta = JSON.parse(raw);
            lastTouch = meta.updatedAt || meta.createdAt || meta.lastTouch || mtime;
            if (meta.sessionId) sessionId = meta.sessionId;
          } catch (e) {
            // malformed/unreadable JSON falls back to mtime and filename
          }

          const age = now - lastTouch;
          if (age > ttlMs) {
            try {
              fs.unlinkSync(fp);
              purged.push({ tenant: t, sessionId, path: fp });
              events.recordSparseEvent('session_purged', { tenant: t, sessionId, reason: 'ttl_expired', mtime });
              logger.info('purged stale ratchet session', { tenant: t, sessionId, reason: 'ttl_expired' });
            } catch (e) {
              logger.warn('session purge failed', e && e.message ? e.message : String(e));
            }
          }
        }
      }
    } catch (e) {
      logger.warn('session purger scan error', e && e.message ? e.message : String(e));
    }
    return purged;
  }
}

module.exports = Purger;

// Compatibility helper used by session-store: purgeExpiredSessions(baseDir, ttlHours)
module.exports.purgeExpiredSessions = function(baseDir, ttlHours = 24) {
  const removed = [];
  try {
    const tenants = fs.readdirSync(baseDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
    for (const tenant of tenants) {
      const tdir = path.join(baseDir, tenant);
      const files = fs.readdirSync(tdir).filter(f => f.endsWith('.json'));
      for (const f of files) {
        const p = path.join(tdir, f);
        try {
          const raw = fs.readFileSync(p, 'utf8');
          const parsed = JSON.parse(raw);
          const updated = parsed.updatedAt ? Number(parsed.updatedAt) : fs.statSync(p).mtimeMs;
          const cutoff = Date.now() - (ttlHours * 3600 * 1000);
          if (updated <= cutoff) {
            try { fs.unlinkSync(p); } catch (e) {}
            removed.push({ tenant, sessionId: parsed.sessionId });
            try { events.recordSparseEvent('upload_purged', { tenant, sessionId: parsed.sessionId, reason: 'expired', ttlHours }); } catch (e) {}
          }
        } catch (e) {
          // ignore
        }
      }
    }
  } catch (e) {}
  return removed;
};
