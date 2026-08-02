const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class EnclaveStateManager {
  constructor(options = {}) {
    this._hsm = options.hsm; // required: { wrapKey(Buffer)->Buffer, unwrapKey(Buffer)->Buffer }
    this._storageDir = options.storageDir || path.join(__dirname, '..', '..', '..', 'tmp', 'enclave-state');
    fs.mkdirSync(this._storageDir, { recursive: true });
  }

  _statePath(id) {
    const safe = encodeURIComponent(id);
    return path.join(this._storageDir, `${safe}.state`);
  }

  async persistState(id, plaintextBuf, opts = {}) {
    if (!Buffer.isBuffer(plaintextBuf)) plaintextBuf = Buffer.from(plaintextBuf);
    const dataKey = crypto.randomBytes(32); // AES-256 key
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', dataKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintextBuf), cipher.final()]);
    const tag = cipher.getAuthTag();

    // wrap the dataKey via HSM
    if (!this._hsm || typeof this._hsm.wrapKey !== 'function') throw new Error('HSM wrapper not available');
    const wrappedKey = await this._hsm.wrapKey(dataKey);

    const payload = {
      v: 1,
      wrappedKey: wrappedKey.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ct: ciphertext.toString('base64'),
      meta: opts.meta || {},
    };

    const tmp = this._statePath(id) + `.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify(payload), { mode: 0o600 });
    fs.renameSync(tmp, this._statePath(id));

    // zeroize sensitive in-memory copies
    dataKey.fill(0);
    iv.fill(0);
    tag.fill(0);
    // ciphertext and plaintextBuf will be GC'd; explicitly zero plaintextBuf if caller provided Buffer
    if (Buffer.isBuffer(plaintextBuf)) plaintextBuf.fill(0);

    return { id, stored: true };
  }

  async loadState(id) {
    const p = this._statePath(id);
    if (!fs.existsSync(p)) throw new Error('state-not-found');
    const raw = fs.readFileSync(p, 'utf8');
    const payload = JSON.parse(raw);
    const wrappedKey = Buffer.from(payload.wrappedKey, 'base64');
    const iv = Buffer.from(payload.iv, 'base64');
    const tag = Buffer.from(payload.tag, 'base64');
    const ct = Buffer.from(payload.ct, 'base64');

    if (!this._hsm || typeof this._hsm.unwrapKey !== 'function') throw new Error('HSM unwrap not available');
    const dataKey = await this._hsm.unwrapKey(wrappedKey);

    const decipher = crypto.createDecipheriv('aes-256-gcm', dataKey, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]);

    // zeroize sensitive
    dataKey.fill(0);
    iv.fill(0);
    tag.fill(0);

    return plain;
  }

  async purgeState(id) {
    const p = this._statePath(id);
    if (!fs.existsSync(p)) return { id, purged: false };
    try {
      // overwrite file contents with zeros before unlink to reduce risk of leftover data
      try {
        const stats = fs.statSync(p);
        const z = Buffer.alloc(Math.min(4096, Math.max(1, stats.size)), 0);
        const fd = fs.openSync(p, 'r+');
        let written = 0;
        while (written < stats.size) {
          const toWrite = Math.min(z.length, stats.size - written);
          fs.writeSync(fd, z, 0, toWrite, written);
          written += toWrite;
        }
        fs.closeSync(fd);
      } catch (e) {
        // best-effort
      }
      fs.unlinkSync(p);
      return { id, purged: true };
    } catch (e) {
      return { id, purged: false, error: e.message };
    }
  }

  async rotateKek(newWrapFn) {
    // newWrapFn: async (dataKey: Buffer) => Buffer (newWrappedKey)
    const files = fs.readdirSync(this._storageDir).filter(f => f.endsWith('.state')).sort();
    const checkpointPath = path.join(this._storageDir, 'migration-checkpoint.json');
    let lastProcessed = null;
    if (fs.existsSync(checkpointPath)) {
      try { lastProcessed = JSON.parse(fs.readFileSync(checkpointPath,'utf8')).lastProcessed; } catch (e) { lastProcessed = null; }
    }

    for (const f of files) {
      if (lastProcessed && f <= lastProcessed) continue;
      const p = path.join(this._storageDir, f);
      const raw = fs.readFileSync(p, 'utf8');
      const payload = JSON.parse(raw);
      const wrappedKey = Buffer.from(payload.wrappedKey, 'base64');

      // unwrap using current HSM
      const dataKey = await this._hsm.unwrapKey(wrappedKey);

      // create new wrapped key using provided function
      const newWrapped = await newWrapFn(dataKey);

      payload.wrappedKey = newWrapped.toString('base64');
      payload.meta = payload.meta || {};
      payload.meta.kekRotatedAt = Date.now();

      const tmp = p + `.rot-${process.pid}-${Date.now()}`;
      fs.writeFileSync(tmp, JSON.stringify(payload), { mode: 0o600 });
      fs.renameSync(tmp, p);

      // zeroize plaintext dataKey
      try { dataKey.fill(0); } catch (e) {}

      // update checkpoint so we can resume
      fs.writeFileSync(checkpointPath, JSON.stringify({ lastProcessed: f }), { mode: 0o600 });
    }

    // cleanup checkpoint
    if (fs.existsSync(checkpointPath)) fs.unlinkSync(checkpointPath);
    return { rotated: true };
  }

}

module.exports = { EnclaveStateManager };
