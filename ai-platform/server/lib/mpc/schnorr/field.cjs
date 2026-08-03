// Prime field arithmetic using native BigInt
class PrimeField {
  constructor(modulus) {
    this.q = BigInt(modulus);
  }

  /**
   * Normalize various numeric input forms into a BigInt.
   * Accepts: bigint, integer number, decimal string, hex string (with or without 0x).
   * Rejects floats, scientific notation, and non-integer values.
   */
  toBig(a) {
    return normalizeToBigInt(a);
  }

  add(a, b) {
    return (this.toBig(a) + this.toBig(b)) % this.q;
  }

  sub(a, b) {
    return (this.toBig(a) - this.toBig(b) + this.q) % this.q;
  }

  mul(a, b) {
    return (this.toBig(a) * this.toBig(b)) % this.q;
  }

  neg(a) {
    return (this.q - (this.toBig(a) % this.q)) % this.q;
  }

  inv(a) {
    let t = 0n, newT = 1n;
    let r = this.q, newR = this.toBig(a) % this.q;
    while (newR !== 0n) {
      const quotient = r / newR;
      const tmpT = newT;
      newT = t - quotient * newT;
      t = tmpT;
      const tmpR = newR;
      newR = r - quotient * newR;
      r = tmpR;
    }
    if (r > 1n) throw new Error('NOT_INVERTIBLE');
    if (t < 0n) t += this.q;
    return t;
  }

  div(a, b) {
    return this.mul(a, this.inv(b));
  }
}

module.exports = { PrimeField };

// Export a normalization helper for other modules to use
function normalizeToBigInt(v) {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') {
    if (!Number.isInteger(v)) throw new TypeError('numeric value must be integer');
    return BigInt(v);
  }
  if (typeof v === 'string') {
    const s = v.trim();
    // allow optional leading - for negatives
    const neg = s.startsWith('-');
    const core = neg ? s.slice(1) : s;
    if (/^[0-9]+$/.test(core)) {
      const vBig = BigInt((neg ? '-' : '') + core);
      return vBig;
    }
    if (/^0x[0-9a-fA-F]+$/.test(core) || /^0x[0-9a-fA-F]+$/.test(s)) {
      // BigInt accepts 0x prefix
      return BigInt(s);
    }
    if (/^[0-9a-fA-F]+$/.test(core)) {
      // hex without 0x prefix -> interpret as hex
      return BigInt((neg ? '-' : '') + '0x' + core);
    }
    throw new TypeError('invalid numeric string format');
  }
  throw new TypeError('unsupported numeric type for BigInt conversion');
}

module.exports.normalizeToBigInt = normalizeToBigInt;
