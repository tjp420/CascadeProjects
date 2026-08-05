"use strict";

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const events = require('../hsm-adapter/events.cjs');
const logger = require('../app-logger.cjs').child('upload-manager');

class UploadManager {
  constructor({ baseDir = path.join(process.cwd(), '.data', 'track112'), defaultTenant = 'dev' } = {}) {
    this.baseDir = baseDir;
    this.defaultTenant = defaultTenant;
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  _tenantDir(tenant) {
    return path.join(this.baseDir, tenant || this.defaultTenant);
  }

  _sessionDir(tenant, sessionId) {
    return path.join(this._tenantDir(tenant), sessionId);
  }

  createSession({ tenant, maxBytes, traceId } = {}) {
    const id = `upload-${Date.now()}-${Math.floor(Math.random()*10000)}`;
    const dir = this._sessionDir(tenant, id);
    fs.mkdirSync(dir, { recursive: true });
    const meta = { sessionId: id, tenant: tenant || this.defaultTenant, maxBytes: maxBytes || 0, createdAt: Date.now(), lastTouch: Date.now(), committed: false, traceId: traceId || null };
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta));
    return id;
  }

  _readMeta(dir) {
    try {
      const p = path.join(dir, 'meta.json');
      const raw = fs.readFileSync(p, 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  _writeMeta(dir, meta) {
    try {
      fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta));
    } catch (e) {}
  }

  async writeChunkFromStream(sessionId, offset, stream) {
    // Find session dir by searching tenants
    const tenants = fs.readdirSync(this.baseDir).filter(d => fs.statSync(path.join(this.baseDir, d)).isDirectory());
    let dir = null;
    for (const t of tenants) {
      if (t === '_committed') continue;
      const candidate = path.join(this.baseDir, t, sessionId);
      if (fs.existsSync(candidate)) { dir = candidate; break; }
    }
    if (!dir) throw new Error('session_not_found');
    const chunkPath = path.join(dir, `${offset}.chunk`);
    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(chunkPath);
      stream.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      stream.on('error', reject);
    });
  }

  async writeChunkFromBuffer(sessionId, offset, buf) {
    const readable = require('stream').Readable;
    const stream = new readable();
    stream.push(buf);
    stream.push(null);
    return this.writeChunkFromStream(sessionId, offset, stream);
  }

  computeRootHex(sessionId) {
    const tenants = fs.readdirSync(this.baseDir).filter(d => fs.statSync(path.join(this.baseDir, d)).isDirectory());
    let dir = null;
    for (const t of tenants) {
      if (t === '_committed') continue;
      const candidate = path.join(this.baseDir, t, sessionId);
      if (fs.existsSync(candidate)) { dir = candidate; break; }
    }
    if (!dir) throw new Error('session_not_found');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.chunk'));
    const offsets = files.map(f => Number(f.replace('.chunk',''))).sort((a,b)=>a-b);
    const bufs = offsets.map(o => fs.readFileSync(path.join(dir, `${o}.chunk`)));
    const total = Buffer.concat(bufs.length ? bufs : [Buffer.alloc(0)]);
    const rootBuf = crypto.createHash('sha256').update(total).digest();
    return { rootBuf, rootHex: rootBuf.toString('hex'), dir };
  }

  verifyAndCommitSession(sessionId, publicKeyPem, signature) {
    const { rootBuf, rootHex, dir } = this.computeRootHex(sessionId);
    try {
      const pubKeyObj = crypto.createPublicKey(publicKeyPem);
      const sigBuf = Buffer.from(signature, 'base64');
      const ok = crypto.verify(null, rootBuf, pubKeyObj, sigBuf);
      if (!ok) {
        events.recordSparseEvent('upload_commit_invalid_signature', { sessionId, tenant: this._readMeta(dir)?.tenant, traceId: this._readMeta(dir)?.traceId });
        return { ok: false, reason: 'invalid_signature' };
      }
    } catch (e) {
      return { ok: false, reason: 'signature_verify_error', message: e.message };
    }

    // move to committed area
    const meta = this._readMeta(dir) || {};
    const committedDir = path.join(this.baseDir, '_committed', meta.tenant || this.defaultTenant);
    fs.mkdirSync(committedDir, { recursive: true });
    const dest = path.join(committedDir, sessionId);
    try {
      fs.renameSync(dir, dest);
      const newMeta = Object.assign({}, meta, { committed: true, committedAt: Date.now(), root: rootHex });
      fs.writeFileSync(path.join(dest, 'meta.json'), JSON.stringify(newMeta));
    } catch (e) {
      // fallback: mark committed in place
      meta.committed = true;
      meta.committedAt = Date.now();
      meta.root = rootHex;
      this._writeMeta(dir, meta);
    }
    return { ok: true, root: rootHex };
  }

  // Expose low-level helpers for test & admin use
  listSessions() {
    const tenants = fs.readdirSync(this.baseDir).filter(d => fs.statSync(path.join(this.baseDir, d)).isDirectory());
    const out = [];
    for (const t of tenants) {
      if (t === '_committed') continue;
      const td = path.join(this.baseDir, t);
      for (const s of fs.readdirSync(td)) {
        const dir = path.join(td, s);
        const meta = this._readMeta(dir);
        out.push({ tenant: t, sessionId: s, meta });
      }
    }
    return out;
  }

  removeSessionDir(sessionId) {
    // admin helper
    const tenants = fs.readdirSync(this.baseDir).filter(d => fs.statSync(path.join(this.baseDir, d)).isDirectory());
    for (const t of tenants) {
      const cand = path.join(this.baseDir, t, sessionId);
      if (fs.existsSync(cand)) {
        fs.rmSync(cand, { recursive: true, force: true });
        return true;
      }
    }
    return false;
  }
}

module.exports = UploadManager;
