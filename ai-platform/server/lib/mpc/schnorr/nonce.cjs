const crypto = require("crypto");

class Musig2NonceGenerator {
  constructor(modulus) {
    if (modulus === undefined || modulus === null) {
      throw new Error("Musig2NonceGenerator: modulus is required");
    }
    this.q = BigInt(modulus);
    if (this.q <= 0n) {
      throw new Error("Musig2NonceGenerator: modulus must be positive");
    }
  }

  generateNoncePair(sessionId) {
    if (sessionId === undefined || sessionId === null) {
      throw new Error(
        "Musig2NonceGenerator.generateNoncePair: sessionId is required",
      );
    }
    if (typeof sessionId !== "string" || sessionId.length === 0) {
      throw new Error(
        "Musig2NonceGenerator.generateNoncePair: sessionId must be a non-empty string",
      );
    }

    const k1 = BigInt("0x" + crypto.randomBytes(32).toString("hex")) % this.q;
    const k2 = BigInt("0x" + crypto.randomBytes(32).toString("hex")) % this.q;

    // Ensure nonces are in valid range [1, q-1] (never zero)
    const safeK1 = k1 === 0n ? 1n : k1;
    const safeK2 = k2 === 0n ? 1n : k2;

    const h1 = crypto
      .createHash("sha256")
      .update(safeK1.toString() + sessionId)
      .digest("hex");
    const h2 = crypto
      .createHash("sha256")
      .update(safeK2.toString() + sessionId)
      .digest("hex");

    return {
      secret: { k1: safeK1, k2: safeK2 },
      publicCommitment: { h1, h2, sessionId },
    };
  }
}

module.exports = { Musig2NonceGenerator };
