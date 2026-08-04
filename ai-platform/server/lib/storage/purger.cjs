"use strict";

const fs = require('fs');
const path = require('path');
const events = require('../hsm-adapter/events.cjs');
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
}

module.exports = Purger;
