'use strict';

/**
 * aes-kw-bench.cjs
 * High-precision microsecond profiling for AES-KW operations.
 */
const { wrap, unwrap } = require('../server/lib/aes-kw.cjs');
const { KW_VECTORS } = require('../server/lib/__tests__/vectors/aes-kw-vectors.cjs');
const crypto = require('crypto');

const ITERATIONS = 10000;

function runBenchmark() {
  console.log(`=== AES-KW High-Precision Benchmark (${ITERATIONS.toLocaleString()} iterations) ===\n`);

  // Profile the 6 NIST vectors
  KW_VECTORS.forEach((vector, idx) => {
    const kek = vector.kek;
    const plaintext = vector.plaintext;
    const ciphertext = vector.ciphertext;

    profileCase(`Vector ${idx + 1} (${vector.name} Wrap)`, () => wrap(kek, plaintext));
    profileCase(`Vector ${idx + 1} (${vector.name} Unwrap)`, () => unwrap(kek, ciphertext));
  });

  // Profile Random 256-bit KEK / 256-bit Key Case
  const randKek = crypto.randomBytes(32);
  const randPlain = crypto.randomBytes(32);
  const randCipher = wrap(randKek, randPlain);

  profileCase('Random Case (AES-256 KEK / 256-bit Key Wrap)', () => wrap(randKek, randPlain));
  profileCase('Random Case (AES-256 KEK / 256-bit Key Unwrap)', () => unwrap(randKek, randCipher));
}

function profileCase(label, operation) {
  // Warm up V8 compilation
  for (let i = 0; i < 100; i++) operation();

  const start = process.hrtime.bigint();
  for (let i = 0; i < ITERATIONS; i++) {
    operation();
  }
  const end = process.hrtime.bigint();

  const totalNs = Number(end - start);
  const totalMs = totalNs / 1_000_000;
  const usPerOp = (totalNs / ITERATIONS) / 1_000;
  const opsPerSec = (ITERATIONS / totalMs) * 1000;

  console.log(`${label.padEnd(50)} : ${usPerOp.toFixed(3).padStart(8)} µs/op | ${Math.round(opsPerSec).toLocaleString().padStart(10)} ops/sec`);
}

runBenchmark();
