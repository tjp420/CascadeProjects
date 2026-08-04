// File-backed, tenant-scoped session store for ratchet sessions
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Purger = require('../../storage/purger.cjs');
const { writeAtomicSync } = require('../../fs-atomic.cjs');

const BASE_DIR = path.join(__dirname, '..', '..', '.data', 'ratchet-sessions');

function sanitizeId(id) {
  if (typeof id !== 'string') throw new Error('invalid id');
  // basename strips path components; reject if changed
  if (path.basename(id) !== id) throw new Error('invalid id');
  // only allow limited chars to be safe
  if (!/^[A-Za-z0-9_\-:.]+$/.test(id)) throw new Error('invalid id');
  return id;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function recordPath(tenantId, sessionId) {
  const t = sanitizeId(tenantId || 'default');
  const s = sanitizeId(sessionId);
  return path.join(BASE_DIR, t, `${s}.json`);
}

class SessionStore {
  constructor() {
    this._store = new Map();
    this._purgerTimer = null;
    ensureDir(BASE_DIR);
    this.startPurger();
  }

  create(session) {
    const id = session.sessionId || crypto.randomBytes(12).toString('hex');
    const tenantId = session.tenantId || 'default';
    const now = Date.now();
    const record = Object.assign({ sessionId: id, tenantId, createdAt: now, updatedAt: now }, session);
    this._store.set(id, record);
    this._writeToDisk(record);
    return this._reconstruct(record);
  }

  get(sessionId, tenantId = null) {
    if (!sessionId) return null;
    sanitizeId(sessionId);
    if (tenantId != null) sanitizeId(tenantId);

    // prefer in-memory cache
    const cached = this._store.get(sessionId);
    if (cached) {
      if (tenantId != null && cached.tenantId !== tenantId) {
        const e = new Error('UNAUTHORIZED_SESSION_ACCESS');
        e.code = 'UNAUTHORIZED_SESSION_ACCESS';
        throw e;
      }
      return this._reconstruct(cached);
    }

    // attempt to load from disk
    try {
      const p = recordPath(tenantId || 'default', sessionId);
      if (!fs.existsSync(p)) return null;
      const raw = fs.readFileSync(p, 'utf8');
      const parsed = JSON.parse(raw);
      if (tenantId != null && parsed.tenantId !== tenantId) {
        const e = new Error('UNAUTHORIZED_SESSION_ACCESS');
        e.code = 'UNAUTHORIZED_SESSION_ACCESS';
        throw e;
      }
      this._store.set(sessionId, parsed);
      return this._reconstruct(parsed);
    } catch (err) {
      if (err.code === 'UNAUTHORIZED_SESSION_ACCESS') throw err;
      return null;
    }
  }

  set(sessionId, session) {
    const tenantId = session.tenantId || 'default';
    sanitizeId(sessionId);
    sanitizeId(tenantId);
    session.updatedAt = Date.now();
    this._store.set(sessionId, session);
    this._writeToDisk(session);
    return session;
  }

  delete(sessionId) {
    const rec = this._store.get(sessionId);
    if (rec) {
      const p = recordPath(rec.tenantId || 'default', sessionId);
      try { fs.unlinkSync(p); } catch (e) {}
    }
    return this._store.delete(sessionId);
  }

  clear() {
    this._store.clear();
    // not deleting disk data by default
  }

  startPurger(ttlHours = 24, intervalMinutes = 15) {
    if (this._purgerTimer) return;
    const intervalMs = (intervalMinutes == null ? 15 : intervalMinutes) * 60 * 1000;
    this._purgerTimer = setInterval(() => {
      const removed = Purger.purgeExpiredSessions(BASE_DIR, ttlHours);
      for (const { sessionId } of removed) {
        this._store.delete(sessionId);
      }
    }, intervalMs);
    this._purgerTimer.unref();
  }

  stopPurger() {
    if (!this._purgerTimer) return;
    clearInterval(this._purgerTimer);
    this._purgerTimer = null;
  }

  _writeToDisk(record) {
    try {
      const tenant = record.tenantId || 'default';
      const sid = record.sessionId;
      sanitizeId(tenant);
      sanitizeId(sid);
      const dir = path.join(BASE_DIR, tenant);
      ensureDir(dir);
      // Prepare serializable object
      const out = Object.assign({}, record);
      if (out.root && Buffer.isBuffer(out.root)) out.root = out.root.toString('base64');
      if (out.ck && Buffer.isBuffer(out.ck)) out.ck = out.ck.toString('base64');
      if (out.localKeyPair) {
        const lk = out.localKeyPair;
        if (lk.publicKeyDer && Buffer.isBuffer(lk.publicKeyDer)) out.localKeyPair = out.localKeyPair = Object.assign({}, lk, { publicKeyDer: lk.publicKeyDer.toString('base64'), privateKeyDer: lk.privateKeyDer && Buffer.isBuffer(lk.privateKeyDer) ? lk.privateKeyDer.toString('base64') : undefined });
      }
      if (out.remotePublicKeyDer && Buffer.isBuffer(out.remotePublicKeyDer)) out.remotePublicKeyDer = out.remotePublicKeyDer.toString('base64');
      const p = path.join(dir, `${sid}.json`);
      out.updatedAt = out.updatedAt || Date.now();
      try {
        writeAtomicSync(p, JSON.stringify(out, null, 2), { mode: 0o600 });
      } catch (e) {
        // ignore write failures for now
      }
    } catch (e) {
      // ignore write failures for now
    }
  }

  _reconstruct(stored) {
    const rec = Object.assign({}, stored);
    try {
      if (rec.root && typeof rec.root === 'string') rec.root = Buffer.from(rec.root, 'base64');
      if (rec.ck && typeof rec.ck === 'string') rec.ck = Buffer.from(rec.ck, 'base64');
      if (rec.localKeyPair && rec.localKeyPair.publicKeyDer) {
        const pubDer = Buffer.from(rec.localKeyPair.publicKeyDer, 'base64');
        const privDer = rec.localKeyPair.privateKeyDer ? Buffer.from(rec.localKeyPair.privateKeyDer, 'base64') : null;
        const publicKeyObj = crypto.createPublicKey({ key: pubDer, format: 'der', type: 'spki' });
        const privateKeyObj = privDer ? crypto.createPrivateKey({ key: privDer, format: 'der', type: 'pkcs8' }) : undefined;
        rec.localKeyPair = Object.assign({}, rec.localKeyPair, { publicKeyObj, privateKeyObj, publicKeyDer: pubDer, privateKeyDer: privDer });
      }
      if (rec.remotePublicKeyDer && typeof rec.remotePublicKeyDer === 'string') {
        const rpub = Buffer.from(rec.remotePublicKeyDer, 'base64');
        rec.remotePublicKeyObj = crypto.createPublicKey({ key: rpub, format: 'der', type: 'spki' });
        rec.remotePublicKeyDer = rpub;
      }
    } catch (e) {
      // corrupted reconstruction — return raw stored
    }
    return rec;
  }
}

module.exports = new SessionStore();
