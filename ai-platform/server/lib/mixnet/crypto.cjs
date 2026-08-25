const crypto = require('crypto');

// Simple hybrid-like layer using ephemeral key material derived from per-hop node key
// For PoC: derive an AEAD key via HKDF(nodeKey, ephSalt) and use ChaCha20-Poly1305

function hkdfExtract(salt, ikm) {
  return crypto.createHmac('sha256', salt).update(ikm).digest();
}

function hkdfExpand(prk, info, len) {
  const hashLen = 32;
  let t = Buffer.alloc(0);
  let okm = Buffer.alloc(0);
  const n = Math.ceil(len / hashLen);
  for (let i = 0; i < n; i++) {
    const hmac = crypto.createHmac('sha256', prk);
    hmac.update(Buffer.concat([t, Buffer.from(info || ''), Buffer.from([i + 1])]));
    t = hmac.digest();
    okm = Buffer.concat([okm, t]);
  }
  return okm.slice(0, len);
}

function deriveAeadKey(nodeKey, salt) {
  const prk = hkdfExtract(salt || Buffer.alloc(0), nodeKey);
  return hkdfExpand(prk, 'mixnet-aead', 32);
}

function unwrapLayer(buf, nodeKey) {
  // Layer format (PoC): 12-byte nonce | 2-byte nextLen | next (utf8) | ciphertext
  if (!Buffer.isBuffer(buf) || buf.length < 14) return { ok: false };
  const nonce = buf.slice(0, 12);
  const nextLen = buf.readUInt16BE(12);
  if (buf.length < 14 + nextLen) return { ok: false };
  const nextBuf = buf.slice(14, 14 + nextLen);
  const ct = buf.slice(14 + nextLen);

  const salt = Buffer.concat([nonce, nextBuf]);
  const aeadKey = deriveAeadKey(nodeKey, salt);

  try {
    const decipher = crypto.createDecipheriv('chacha20-poly1305', aeadKey, nonce, { authTagLength: 16 });
    // Node.js requires settingAAD before updating when AAD used; we don't use AAD in PoC
    const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
    const tag = ct.slice(ct.length - 16);
    // ChaCha20-Poly1305 in Node expects tag separated; but since we appended tag in ct, parse differently
    // For PoC assume server placed tag separately; simpler: use AEAD with cipher.setAuthTag
    // Re-implement correct parsing: last 16 bytes of ct are tag
  } catch (e) {
    console.error('crypto.cjs error:', e);
    // fallback: try explicit tag handling
  }

  // proper parsing: last 16 bytes of ciphertext are tag
  if (ct.length < 16) return { ok: false };
  const tag = ct.slice(ct.length - 16);
  const realCt = ct.slice(0, ct.length - 16);

  // Fixed dummy workload to reduce timing variance between failure and success paths.
  const DUMMY_LOOPS = 2000;
  function dummyWork() {
    // perform repeated HMACs to emulate cryptographic effort
    let acc = Buffer.alloc(0);
    for (let i = 0; i < DUMMY_LOOPS; i++) {
      const h = crypto.createHmac('sha256', nodeKey);
      h.update(acc);
      h.update(Buffer.from(String(i)));
      acc = h.digest();
    }
    return acc;
  }

  try {
    const decipher = crypto.createDecipheriv('chacha20-poly1305', aeadKey, nonce, { authTagLength: 16 });
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(realCt), decipher.final()]);
    // run dummy work to equalize timing
    dummyWork();
    return { ok: true, next: nextBuf.toString('utf8'), payload: pt };
  } catch (err) {
    console.error('crypto.cjs error:', err);
    // on failure still run dummy work to keep timing similar
    dummyWork();
    return { ok: false };
  }
}

function wrapLayer(next, innerPayload, nodeKey) {
  // Construct layer: nonce(12) | nextLen(2) | next | ciphertext+tag
  const nonce = crypto.randomBytes(12);
  const nextBuf = Buffer.from(String(next || ''), 'utf8');
  const salt = Buffer.concat([nonce, nextBuf]);
  const aeadKey = deriveAeadKey(nodeKey, salt);
  const cipher = crypto.createCipheriv('chacha20-poly1305', aeadKey, nonce, { authTagLength: 16 });
  const ct = Buffer.concat([cipher.update(innerPayload), cipher.final()]);
  const tag = cipher.getAuthTag();
  const out = Buffer.concat([nonce, Buffer.alloc(2), nextBuf, ct, tag]);
  out.writeUInt16BE(nextBuf.length, 12);
  return out;
}

module.exports = { wrapLayer, unwrapLayer };
