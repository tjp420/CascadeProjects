/**
 * @fileoverview Partial Share Proof and Fraud Attribution Module.
 * Authenticates objective evidence envelopes to isolate malicious equivocations.
 */

const crypto = require('crypto');

function _serialize(value) {
  if (typeof value === 'bigint') return JSON.stringify(value.toString(16));
  if (Buffer.isBuffer(value)) return JSON.stringify(value.toString('hex'));
  if (Array.isArray(value)) return '[' + value.map(_serialize).join(',') + ']';
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + _serialize(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

class PartialShareProofManager {
  /**
   * Produce a deterministic, key-sorted canonical string for an envelope.
   * Handles BigInt and Buffer values deterministically (BigInt -> hex string).
   * Returns a JSON-like string that is stable across runtimes.
   */
  canonicalize(envelope) {
    if (!envelope || typeof envelope !== 'object') throw new TypeError('envelope must be an object');
    return _serialize(envelope);
  }

  /**
   * Create a PartialShareProof: canonicalize envelope, compute evidence_id,
   * and attach a detached signature produced by `privateKey` (PEM or KeyObject).
   * The returned `envelope` is a shallow-serialized copy where BigInts are
   * converted to hex strings to make the proof JSON-serializable.
   */
  createPartialShareProof(envelope, privateKey, options = {}) {
    if (!envelope || typeof envelope !== 'object') throw new TypeError('envelope must be an object');

    const canonicalStr = this.canonicalize(envelope);
    const evidenceId = crypto.createHash('sha256').update(canonicalStr).digest('hex');

    const scheme = options.scheme || 'rsa-sha256';
    const signer = crypto.createSign('SHA256');
    signer.update(canonicalStr);
    signer.end();
    const signature = signer.sign(privateKey, 'base64');

    // Make a JSON-safe copy of the envelope where BigInts -> hex strings
    function cloneSerializable(obj) {
      if (obj === null) return null;
      if (typeof obj === 'bigint') return obj.toString(16);
      if (Buffer.isBuffer(obj)) return obj.toString('hex');
      if (Array.isArray(obj)) return obj.map(cloneSerializable);
      if (obj && typeof obj === 'object') {
        const out = {};
        for (const k of Object.keys(obj).sort()) out[k] = cloneSerializable(obj[k]);
        return out;
      }
      return obj;
    }

    const envelopeCopy = cloneSerializable(envelope);

    return {
      envelope: envelopeCopy,
      proof_material: {
        detached_signature: signature,
        signature_scheme: scheme,
        evidence_id: evidenceId,
        created_at: new Date().toISOString()
      }
    };
  }

  /**
   * Verify a stored proof. Returns true when the signature is valid and the
   * evidence_id matches the canonicalized envelope.
   */
  verifyPartialShareProof(proof, publicKey) {
    if (!proof || typeof proof !== 'object') return false;
    const { envelope, proof_material } = proof;
    if (!envelope || !proof_material || !proof_material.detached_signature || !proof_material.evidence_id) return false;

    const canonicalStr = this.canonicalize(envelope);
    const expectedId = crypto.createHash('sha256').update(canonicalStr).digest('hex');
    if (proof_material.evidence_id !== expectedId) return false;

    const verifier = crypto.createVerify('SHA256');
    verifier.update(canonicalStr);
    verifier.end();
    try {
      return verifier.verify(publicKey, proof_material.detached_signature, 'base64');
    } catch (err) {
      return false;
    }
  }
}

module.exports = { PartialShareProofManager };
