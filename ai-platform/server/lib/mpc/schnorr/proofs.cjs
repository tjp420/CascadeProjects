/**
 * @fileoverview Partial Share Proof and Fraud Attribution Module.
 * Authenticates objective evidence envelopes to isolate malicious equivocations.
 */

const crypto = require('crypto');
const { JcsCanonicalizer } = require('./jcs.cjs');
const Ajv = require('ajv');

const jcs = new JcsCanonicalizer();

// Load and compile JSON Schema for incoming proofs
let validateProof = null;
try {
  const schema = require('./schemas/partial_share_proof.schema.json');
  const ajv = new Ajv({ allErrors: true, strict: false });
  // support standard formats like date-time
  try {
    require('ajv-formats')(ajv);
  } catch (e) {
    // if ajv-formats is unavailable, continue without format checks
  }
  validateProof = ajv.compile(schema);
} catch (e) {
  // If schema/ajv is not available, leave validateProof null and rely on JCS-level checks
  validateProof = null;
}

class PartialShareProofManager {
  /**
   * Delegate canonicalization to the RFC 8785 JCS canonicalizer for
   * cross-language deterministic serialization.
   */
  canonicalize(envelope) {
    if (!envelope || typeof envelope !== 'object') throw new TypeError('envelope must be an object');
    return jcs.canonicalize(envelope);
  }

  /**
   * Create a PartialShareProof: canonicalize envelope using JCS, compute evidence_id,
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
    // Return object: { ok: true } or { ok: false, reason: <string>, message?: <string>, details?: any }
    if (!proof || typeof proof !== 'object') return { ok: false, reason: 'invalid_argument', message: 'proof must be an object' };

    // Schema-based structural validation (defense-in-depth)
    if (validateProof) {
      const ok = validateProof(proof);
      if (!ok) {
        return { ok: false, reason: 'schema', message: 'schema validation failed', details: validateProof.errors };
      }
    } else {
      // Fallback structural checks
      if (!proof.proof_material || !proof.proof_material.detached_signature || !proof.proof_material.evidence_id) {
        return { ok: false, reason: 'structural', message: 'missing proof_material or required fields' };
      }
      if (!proof.envelope || typeof proof.envelope !== 'object') {
        return { ok: false, reason: 'structural', message: 'missing or invalid envelope' };
      }
    }

    const { envelope, proof_material } = proof;

    let canonicalStr;
    try {
      canonicalStr = this.canonicalize(envelope);
    } catch (e) {
      // Canonicalization failed (e.g., refused marker) — return structured error
      return { ok: false, reason: 'canonicalization', message: e && e.message ? e.message : String(e) };
    }

    const expectedId = crypto.createHash('sha256').update(canonicalStr).digest('hex');
    if (proof_material.evidence_id !== expectedId) {
      return { ok: false, reason: 'evidence_mismatch', message: 'evidence_id does not match canonicalized envelope' };
    }

    const verifier = crypto.createVerify('SHA256');
    verifier.update(canonicalStr);
    verifier.end();
    try {
      const valid = verifier.verify(publicKey, proof_material.detached_signature, 'base64');
      if (!valid) return { ok: false, reason: 'signature_invalid', message: 'detached signature did not verify' };
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: 'signature_error', message: err && err.message ? err.message : String(err) };
    }
  }
}

module.exports = { PartialShareProofManager };
