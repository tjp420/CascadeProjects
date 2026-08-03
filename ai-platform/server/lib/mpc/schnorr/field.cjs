// Prime field arithmetic using native BigInt
class PrimeField {
  constructor(modulus) {
    this.q = BigInt(modulus);
  }

  toBig(a) {
    return BigInt(a);
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
