'use strict';

/**
 * aes-kw-bench.cjs
 * High-precision microsecond profiling for AES-KW and AES-KWP operations.
 */
const { wrap, unwrap, wrapPad, unwrapPad } = require('../server/lib/aes-kw.cjs');
const { KW_VECTORS, KWP_VECTORS } = require('../server/lib/__tests__/vectors/aes-kw-vectors.cjs');
const crypto = require('crypto');

const ITERATIONS = 10000;

function runBenchmark() {
  console.log(`=== AES-KW / AES-KWP High-Precision Benchmark (${ITERATIONS.toLocaleString()} iterations) ===\n`);

  console.log('--- RFC 3394 AES-KW ---\n');
  KW_VECTORS.forEach((vector, idx) => {
    const kek = vector.kek;
    const plaintext = vector.plaintext;
    const ciphertext = vector.ciphertext;

    profileCase(`KW  Vector ${idx + 1} (${vector.name} Wrap)`, () => wrap(kek, plaintext));
    profileCase(`KW  Vector ${idx + 1} (${vector.name} Unwrap)`, () => unwrap(kek, ciphertext));
  });

  console.log('\n--- RFC 5649 AES-KWP ---\n');
  KWP_VECTORS.forEach((vector, idx) => {
    const kek = vector.kek;
    const plaintext = vector.plaintext;
    const ciphertext = vector.ciphertext;

    profileCase(`KWP Vector ${idx + 1} (${vector.name} Wrap)`, () => wrapPad(kek, plaintext));
    profileCase(`KWP Vector ${idx + 1} (${vector.name} Unwrap)`, () => unwrapPad(kek, ciphertext));
  });

  console.log('\n--- Random Cases ---\n');
  const randKek = crypto.randomBytes(32);
  const randPlain = crypto.randomBytes(32);
  const randCipher = wrap(randKek, randPlain);

  profileCase('Random Case (AES-256 KEK / 256-bit Key Wrap)', () => wrap(randKek, randPlain));
  profileCase('Random Case (AES-256 KEK / 256-bit Key Unwrap)', () => unwrap(randKek, randCipher));

  const randPadPayload = crypto.randomBytes(37); // non-8-byte aligned
  const randPadCipher = wrapPad(randKek, randPadPayload);
  profileCase('Random KWP (AES-256 KEK / 37-byte payload Wrap)', () => wrapPad(randKek, randPadPayload));
  profileCase('Random KWP (AES-256 KEK / 37-byte payload Unwrap)', () => unwrapPad(randKek, randPadCipher));
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

  console.log(`${label.padEnd(55)} : ${usPerOp.toFixed(3).padStart(8)} µs/op | ${Math.round(opsPerSec).toLocaleString().padStart(10)} ops/sec`);
}

runBenchmark();
