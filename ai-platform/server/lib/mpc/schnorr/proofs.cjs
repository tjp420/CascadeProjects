/**
 * @fileoverview Partial Share Proof and Fraud Attribution Module.
 * Authenticates objective evidence envelopes to isolate malicious equivocations.
 */

const crypto = require("crypto");
const { JcsCanonicalizer } = require("./jcs.cjs");
const Ajv = require("ajv");
const auditLogger = require("../../audit-logger.cjs");

const jcs = new JcsCanonicalizer();

// Load and compile JSON Schema for incoming proofs
let validateProof = null;
try {
  const schema = require("./schemas/partial_share_proof.schema.json");
  const ajv = new Ajv({ allErrors: true, strict: false });
  // support standard formats like date-time
  try {
    require("ajv-formats")(ajv);
  } catch (e) {
    console.error("proofs.cjs error:", e);
    // if ajv-formats is unavailable, continue without format checks
  }
  validateProof = ajv.compile(schema);
} catch (e) {
  console.error("proofs.cjs error:", e);
  // If schema/ajv is not available, leave validateProof null and rely on JCS-level checks
  validateProof = null;
}

class PartialShareProofManager {
  /**
   * Delegate canonicalization to the RFC 8785 JCS canonicalizer for
   * cross-language deterministic serialization.
   */
  canonicalize(envelope) {
    if (!envelope || typeof envelope !== "object")
      throw new TypeError("envelope must be an object");
    return jcs.canonicalize(envelope);
  }

  /**
   * Create a PartialShareProof: canonicalize envelope using JCS, compute evidence_id,
   * and attach a detached signature produced by `privateKey` (PEM or KeyObject).
   * The returned `envelope` is a shallow-serialized copy where BigInts are
   * converted to hex strings to make the proof JSON-serializable.
   */
  createPartialShareProof(envelope, privateKey, options = {}) {
    if (!envelope || typeof envelope !== "object")
      throw new TypeError("envelope must be an object");

    const canonicalStr = this.canonicalize(envelope);
    const evidenceId = crypto
      .createHash("sha256")
      .update(canonicalStr)
      .digest("hex");

    const scheme = options.scheme || "rsa-sha256";
    const signer = crypto.createSign("SHA256");
    signer.update(canonicalStr);
    signer.end();
    const signature = signer.sign(privateKey, "base64");

    // Make a JSON-safe copy of the envelope where BigInts -> hex strings
    function cloneSerializable(obj) {
      if (obj === null) return null;
      if (typeof obj === "bigint") return obj.toString(16);
      if (Buffer.isBuffer(obj)) return obj.toString("hex");
      if (Array.isArray(obj)) return obj.map(cloneSerializable);
      if (obj && typeof obj === "object") {
        const out = {};
        for (const k of Object.keys(obj).sort())
          out[k] = cloneSerializable(obj[k]);
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
        created_at: new Date().toISOString(),
      },
    };
  }

  /**
   * Verify a stored proof. Returns true when the signature is valid and the
   * evidence_id matches the canonicalized envelope.
   */
  verifyPartialShareProof(proof, publicKey) {
    // Return object: { ok: true } or { ok: false, reason: <string>, message?: <string>, details?: any }
    if (!proof || typeof proof !== "object")
      return {
        ok: false,
        reason: "invalid_argument",
        message: "proof must be an object",
      };

    // Schema-based structural validation (defense-in-depth)
    if (validateProof) {
      const ok = validateProof(proof);
      if (!ok) {
        const details = sanitizeAjvErrors(validateProof.errors);
        // central audit log for schema failures
        try {
          auditLogger.log({
            action: "PROOF_VERIFY_FAILED",
            entity: "partial_share_proof",
            entityId:
              proof && proof.proof_material && proof.proof_material.evidence_id,
            metadata: {
              reason: "schema",
              message: "schema validation failed",
              errors: details,
            },
          });
        } catch (e) {
          console.error("proofs.cjs error:", e);
          // non-fatal
        }
        return {
          ok: false,
          reason: "schema",
          message: "schema validation failed",
          details,
        };
      }
    } else {
      // Fallback structural checks
      if (
        !proof.proof_material ||
        !proof.proof_material.detached_signature ||
        !proof.proof_material.evidence_id
      ) {
        try {
          auditLogger.log({
            action: "PROOF_VERIFY_FAILED",
            entity: "partial_share_proof",
            entityId:
              proof && proof.proof_material && proof.proof_material.evidence_id,
            metadata: {
              reason: "structural",
              message: "missing proof_material or required fields",
            },
          });
        } catch (e) {
          console.error("proofs.cjs error:", e);
        }
        return {
          ok: false,
          reason: "structural",
          message: "missing proof_material or required fields",
        };
      }
      if (!proof.envelope || typeof proof.envelope !== "object") {
        try {
          auditLogger.log({
            action: "PROOF_VERIFY_FAILED",
            entity: "partial_share_proof",
            entityId:
              proof && proof.proof_material && proof.proof_material.evidence_id,
            metadata: {
              reason: "structural",
              message: "missing or invalid envelope",
            },
          });
        } catch (e) {
          console.error("proofs.cjs error:", e);
        }
        return {
          ok: false,
          reason: "structural",
          message: "missing or invalid envelope",
        };
      }
    }

    const { envelope, proof_material } = proof;

    let canonicalStr;
    try {
      canonicalStr = this.canonicalize(envelope);
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      try {
        auditLogger.log({
          action: "PROOF_VERIFY_FAILED",
          entity: "partial_share_proof",
          entityId:
            proof && proof.proof_material && proof.proof_material.evidence_id,
          metadata: { reason: "canonicalization", message: msg },
        });
      } catch (er) {
        console.error("proofs.cjs error:", er);
      }
      // Canonicalization failed (e.g., refused marker) — return structured error
      return { ok: false, reason: "canonicalization", message: msg };
    }

    const expectedId = crypto
      .createHash("sha256")
      .update(canonicalStr)
      .digest("hex");
    const payloadHash = crypto
      .createHash("sha256")
      .update(canonicalStr)
      .digest("hex");
    if (proof_material.evidence_id !== expectedId) {
      try {
        auditLogger.log({
          action: "PROOF_VERIFY_FAILED",
          entity: "partial_share_proof",
          entityId:
            proof && proof.proof_material && proof.proof_material.evidence_id,
          metadata: {
            reason: "evidence_mismatch",
            message: "evidence_id does not match canonicalized envelope",
            expected: expectedId,
            provided: proof_material.evidence_id,
            payloadHash,
          },
        });
      } catch (e) {
        console.error("proofs.cjs error:", e);
      }
      return {
        ok: false,
        reason: "evidence_mismatch",
        message: "evidence_id does not match canonicalized envelope",
      };
    }

    const verifier = crypto.createVerify("SHA256");
    verifier.update(canonicalStr);
    verifier.end();
    try {
      const valid = verifier.verify(
        publicKey,
        proof_material.detached_signature,
        "base64",
      );
      if (!valid) {
        try {
          auditLogger.log({
            action: "PROOF_VERIFY_FAILED",
            entity: "partial_share_proof",
            entityId:
              proof && proof.proof_material && proof.proof_material.evidence_id,
            metadata: {
              reason: "signature_invalid",
              message: "detached signature did not verify",
              payloadHash,
            },
          });
        } catch (e) {
          console.error("proofs.cjs error:", e);
        }
        return {
          ok: false,
          reason: "signature_invalid",
          message: "detached signature did not verify",
        };
      }
      return { ok: true };
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      try {
        auditLogger.log({
          action: "PROOF_VERIFY_FAILED",
          entity: "partial_share_proof",
          entityId:
            proof && proof.proof_material && proof.proof_material.evidence_id,
          metadata: { reason: "signature_error", message: msg, payloadHash },
        });
      } catch (e) {
        console.error("proofs.cjs error:", e);
      }
      return { ok: false, reason: "signature_error", message: msg };
    }
  }

  /**
   * Compact AJV errors for audit logs to avoid recording excessively verbose
   * schema objects. We keep: keyword, instancePath, schemaPath, message.
   */
}

function sanitizeAjvErrors(errors) {
  if (!errors) return null;
  return errors.map((e) => ({
    keyword: e.keyword,
    instancePath: e.instancePath,
    schemaPath: e.schemaPath,
    message: e.message,
  }));
}

module.exports = { PartialShareProofManager };
