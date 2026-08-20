const crypto = require("crypto");

/**
 * Build the canonical core fields used for signing.
 * Order is fixed to ensure deterministic signatures.
 */
function buildCoreFields(reportJson) {
  return {
    qualityScore:
      reportJson.qualityScore === undefined ? null : reportJson.qualityScore,
    projectName:
      reportJson.projectName ||
      reportJson.projectRoot ||
      reportJson.scanTargetRoot ||
      null,
    gateStatus: reportJson.gate
      ? reportJson.gate.pass
        ? "pass"
        : "fail"
      : null,
    generatedAt: reportJson.generatedAt || new Date().toISOString(),
  };
}

function stableStringify(obj) {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(stableStringify).join(",") + "]";
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k]))
      .join(",") +
    "}"
  );
}

/**
 * Sign a report's canonical core fields using HMAC-SHA256 and return the envelope.
 * @param {Object} reportJson
 * @param {string} key - raw signing key
 * @param {string} [keyId] - optional key identifier
 * @returns {Object|null} cryptoValidation envelope or null when key not provided
 */
function signReport(reportJson, key, keyId) {
  if (!key) return null;
  // Canonicalize full report JSON for signing by removing any existing cryptoValidation
  const payload = canonicalizeForSigning(reportJson);
  try {
    console.error(
      "[DIAG] signReport invoked, payloadLen=",
      payload ? payload.length : 0,
    );
  } catch (e) {}
  const h = crypto.createHmac("sha256", String(key));
  h.update(payload, "utf8");
  const signature = h.digest("base64");
  return {
    algorithm: "HMAC-SHA256",
    signature,
    signedAt: new Date().toISOString(),
    keyId: keyId || null,
    fields: ["qualityScore", "projectName", "gateStatus", "generatedAt"],
  };
}

/**
 * Verify a report's cryptoValidation envelope using the provided key.
 * Returns true if valid, false otherwise.
 */
function verifyReportSignature(reportJson, key) {
  try {
    if (!reportJson || !reportJson.cryptoValidation) return false;
    const envelope = reportJson.cryptoValidation;
    if (!envelope || !envelope.signature) return false;
    const payload = canonicalizeForSigning(reportJson);
    try {
      console.error(
        "[DIAG] verifyReportSignature invoked, payloadLen=",
        payload ? payload.length : 0,
      );
    } catch (e) {}
    const h = crypto.createHmac("sha256", String(key));
    h.update(payload, "utf8");
    const expected = h.digest("base64");
    return expected === envelope.signature;
  } catch (e) {
    return false;
  }
}

/**
 * Produce a canonical string for signing/verification.
 * - Deep-clone the report
 * - Remove `cryptoValidation` if present
 * - Use `stableStringify` to sort keys deterministically
 */
function canonicalizeForSigning(reportJson) {
  if (reportJson === null || typeof reportJson !== "object")
    return stableStringify(reportJson);
  // Deep clone to avoid mutating original
  let cloned;
  try {
    cloned = JSON.parse(JSON.stringify(reportJson));
  } catch {
    // Fallback: use original reference (best-effort)
    cloned = reportJson;
  }
  if (cloned && typeof cloned === "object" && "cryptoValidation" in cloned) {
    try {
      delete cloned.cryptoValidation;
    } catch (e) {
      /* ignore */
    }
  }
  return stableStringify(cloned);
}

module.exports = { signReport, verifyReportSignature };
