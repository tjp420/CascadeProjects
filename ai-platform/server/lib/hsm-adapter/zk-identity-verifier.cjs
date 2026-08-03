'use strict';

/**
 * Track 21: Zero-knowledge identity verifier using a Schnorr-style protocol.
 *
 * Provides a non-interactive proof of knowledge of a private key without
 * exposing the key or the underlying signature. All arithmetic is performed
 * over a 256-bit prime field using native BigInt.
 *
 * @module hsm-adapter/zk-identity-verifier
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

const DEFAULT_FIELD_BITS = 256;

function _modPow(base, exp, mod) {
  let result = 1n;
  let b = _mod(base, mod);
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e = e >> 1n;
  }
  return result;
}

function _mod(a, m) {
  let r = a % m;
  if (r < 0n) r += m;
  return r;
}

function _randomBigInt(max) {
  const bytes = crypto.randomBytes(32);
  let v = 0n;
  for (const b of bytes) {
    v = (v << 8n) | BigInt(b);
  }
  return v % max;
}

function _randomInRange(max) {
  let v = _randomBigInt(max);
  if (v === 0n) v = 1n;
  return v;
}

function _bytesToBigInt(buf) {
  let v = 0n;
  for (const b of buf) {
    v = (v << 8n) | BigInt(b);
  }
  return v;
}

function _bigIntToBytes(value, length) {
  const buf = Buffer.alloc(length);
  for (let i = length - 1; i >= 0; i--) {
    buf[i] = Number(value & 0xffn);
    value = value >> 8n;
  }
  return buf;
}

function _deriveField(bits) {
  const p = crypto.generatePrimeSync(bits, { safe: true, bigint: true });
  const q = (p - 1n) / 2n;
  let g = 0n;
  for (let attempts = 0; attempts < 100; attempts++) {
    const h = _randomInRange(p - 1n);
    g = _modPow(h, 2n, p);
    if (g !== 1n) break;
  }
  return { p, q, g };
}

class ZkIdentityVerifier {
  /**
   * @param {object} [options]
   * @param {bigint} [options.prime]
   * @param {bigint} [options.generator]
   * @param {number} [options.fieldBits=256]
   * @param {object} [options.logger]
   */
  constructor(options = {}) {
    if (options.prime && options.generator) {
      this._p = options.prime;
      this._q = options.safe ? (this._p - 1n) / 2n : this._p - 1n;
      this._g = options.generator;
    } else {
      const field = _deriveField(options.fieldBits || DEFAULT_FIELD_BITS);
      this._p = field.p;
      this._q = field.q;
      this._g = field.g;
    }
    this._logger = options.logger || null;
  }

  get prime() {
    return this._p;
  }

  get generator() {
    return this._g;
  }

  _audit(event, extra = {}) {
    if (!this._logger || !this._logger.info) return;
    this._logger.info(event, { sub: 'hsm-adapter', provider: 'zkp', ...extra });
  }

  _hashChallenge(publicKeyBuf, tBuf, contextBuf) {
    const h = crypto.createHash('sha256');
    h.update(publicKeyBuf);
    h.update(tBuf);
    h.update(contextBuf);
    const digest = h.digest();
    return _bytesToBigInt(digest) % this._q;
  }

  /**
   * Generate a prover keypair.
   * @returns {{privateKey: Buffer, publicKey: Buffer}}
   */
  generateProverKeys() {
    const x = _randomInRange(this._q);
    const y = _modPow(this._g, x, this._p);
    return {
      privateKey: _bigIntToBytes(x, 32),
      publicKey: _bigIntToBytes(y, 32),
    };
  }

  /**
   * Create a non-interactive Schnorr proof.
   * @param {Buffer} privateKey
   * @param {Buffer|string} [context]
   * @param {bigint|Buffer} [challenge]
   * @returns {{t: Buffer, s: Buffer}}
   */
  createProof(privateKey, context = '', challenge = null) {
    const x = _bytesToBigInt(privateKey);
    const y = _modPow(this._g, x, this._p);
    const publicKey = _bigIntToBytes(y, 32);

    const r = _randomInRange(this._q);
    const t = _modPow(this._g, r, this._p);
    const tBuf = _bigIntToBytes(t, 32);

    const contextBuf = Buffer.isBuffer(context) ? context : Buffer.from(context, 'utf8');
    const c = challenge !== null ? _bytesToBigInt(challenge) % this._q : this._hashChallenge(publicKey, tBuf, contextBuf);

    const s = _mod(r + c * x, this._q);
    const sBuf = _bigIntToBytes(s, 32);

    this._audit('IDENTITY_PROOF_GENERATED', { publicKeyPrefix: publicKey.toString('hex').slice(0, 16) });
    return { t: tBuf, s: sBuf, context };
  }

  /**
   * Verify a non-interactive Schnorr proof.
   * @param {Buffer} publicKey
   * @param {{t: Buffer, s: Buffer}} proof
   * @param {Buffer|string} [context]
   * @param {bigint|Buffer} [challenge]
   * @returns {boolean}
   */
  verifyProof(publicKey, proof, context = '', challenge = null) {
    const y = _bytesToBigInt(publicKey);
    const t = _bytesToBigInt(proof.t);
    const s = _bytesToBigInt(proof.s);

    if (challenge === null && proof.context !== undefined) {
      const proofContext = typeof proof.context === 'string' ? proof.context : proof.context.toString('utf8');
      const verifyContext = typeof context === 'string' ? context : context.toString('utf8');
      if (proofContext !== verifyContext) {
        this._audit('ZERO_KNOWLEDGE_VERIFIED', { result: false, publicKeyPrefix: publicKey.toString('hex').slice(0, 16) });
        return false;
      }
    }

    const contextBuf = Buffer.isBuffer(context) ? context : Buffer.from(context, 'utf8');
    const c = challenge !== null ? _bytesToBigInt(challenge) % this._q : this._hashChallenge(publicKey, proof.t, contextBuf);

    const lhs = _modPow(this._g, s, this._p);
    const rhs = _mod(t * _modPow(y, c, this._p), this._p);
    const ok = lhs === rhs;

    this._audit('ZERO_KNOWLEDGE_VERIFIED', { result: ok, publicKeyPrefix: publicKey.toString('hex').slice(0, 16) });
    return ok;
  }

  verifyProofOrThrow(publicKey, proof, context = '', challenge = null) {
    const ok = this.verifyProof(publicKey, proof, context, challenge);
    if (!ok) {
      throw new HsmAdapterError('ZKP_VERIFICATION_FAILED', 'Zero-knowledge proof verification failed');
    }
  }
}

module.exports = {
  ZkIdentityVerifier,
};
