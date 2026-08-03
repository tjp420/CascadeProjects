const crypto = require('crypto');

function deriveParams({ seed, difficulty = 1000, group } = {}) {
  // Derive simple prime/modulus and base from seed using HKDF
  const hk = crypto.createHash('sha256').update(seed || 'vdf-seed').digest();
  const p = BigInt('0x' + crypto.createHash('sha256').update(Buffer.concat([hk, Buffer.from('p')])).digest('hex')) | 1n;
  const g = 2n + (BigInt('0x' + crypto.createHash('sha256').update(Buffer.concat([hk, Buffer.from('g')])).digest('hex')) % 100n);
  const difficultyIter = Number(difficulty);
  return { seedBigInt: BigInt('0x' + hk.toString('hex')), difficultyIter, p, g };
}

async function runSequentialIterations({ seedBigInt, difficultyIter, p, g }) {
  let y = 1n;
  for (let i = 0; i < difficultyIter; i++) {
    y = (y * g) % p;
    // occasional micro-yield
    if ((i & 0xfff) === 0) await new Promise((r) => setImmediate(r));
  }
  return { y: y.toString(), iter: difficultyIter };
}

function hashToBigInt(buf) {
  return BigInt('0x' + crypto.createHash('sha256').update(buf).digest('hex'));
}

function verifyWesolowski(params, proof) {
  // Placeholder: naive verification checking y^1 == product (this is NOT a real Wesolowski verifier)
  const { p, g, difficultyIter } = params;
  const y = BigInt(proof.y);
  // Recompute g^{difficultyIter} mod p
  let expect = 1n;
  for (let i = 0; i < difficultyIter; i++) expect = (expect * g) % p;
  return expect === y;
}

module.exports = { deriveParams, runSequentialIterations, hashToBigInt, verifyWesolowski };