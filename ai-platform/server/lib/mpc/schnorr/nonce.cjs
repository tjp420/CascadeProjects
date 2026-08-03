const crypto = require('crypto');

class Musig2NonceGenerator {
  constructor(modulus) {
    this.q = BigInt(modulus);
  }

  generateNoncePair(sessionId) {
    const k1 = BigInt('0x' + crypto.randomBytes(32).toString('hex')) % this.q;
    const k2 = BigInt('0x' + crypto.randomBytes(32).toString('hex')) % this.q;

    const h1 = crypto.createHash('sha256').update(k1.toString() + sessionId).digest('hex');
    const h2 = crypto.createHash('sha256').update(k2.toString() + sessionId).digest('hex');

    return {
      secret: { k1, k2 },
      publicCommitment: { h1, h2, sessionId }
    };
  }
}

module.exports = { Musig2NonceGenerator };
