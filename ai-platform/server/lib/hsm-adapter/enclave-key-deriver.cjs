'use strict';

/**
 * Track 47: Enclave key deriver
 *
 * Consumes fresh seed material, derives master keys in-process using HKDF,
 * commits seeds into the enclave (audit hook), and zeroizes legacy roots.
 */

const crypto = require('crypto');
const { secureZeroize } = require('./secure-zeroize.cjs');

async function deriveMasterKeyFromSeed(seedBuf, options = {}) {
  if (!Buffer.isBuffer(seedBuf) || seedBuf.length === 0) throw new Error('invalid seed');
  const salt = options.salt || crypto.randomBytes(16);
  const info = options.info || Buffer.from('enclave-master-key');
  try {
    // Derive a 32-byte master key. Prefer HKDF when available, fallback to HMAC-DRBG style derive.
    let master;
    if (typeof crypto.hkdfSync === 'function') {
      master = crypto.hkdfSync('sha256', seedBuf, salt, info, 32);
      // Node may return an ArrayBuffer — coerce to Buffer for callers
      try { master = Buffer.from(master); } catch (e) {}
    } else {
      // Fallback deterministic HMAC-based derivation
      const h = crypto.createHmac('sha256', seedBuf).update(info).update(salt).digest();
      master = Buffer.from(h).slice(0, 32);
    }
    // Commit telemetry/audit
    try { if (options.audit) options.audit('HARDWARE_SEED_COMMITTED', { length: seedBuf.length }); } catch (e) {}
    // Optionally zeroize legacy roots via provided callback
    if (typeof options.zeroizeOldRoots === 'function') {
      try { await options.zeroizeOldRoots(); } catch (e) {}
    }
    return master;
  } finally {
    // zeroize sensitive intermediates
    try { seedBuf.fill(0); } catch (e) {}
    try { salt.fill(0); } catch (e) {}
    try { if (Buffer.isBuffer(info)) info.fill(0); } catch (e) {}
  }
}

module.exports = { deriveMasterKeyFromSeed };
