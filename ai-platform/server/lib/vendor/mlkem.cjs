"use strict";

/**
 * Vendored ML-KEM-768 (Kyber-768 equivalent) primitive.
 *
 * This file is a thin, deterministic adapter over the audited `mlkem`
 * package (v2.7.0). It exposes only the three operations needed by the
 * hybrid handshake and keeps all KEM details isolated.
 *
 * @module vendor/mlkem
 */

const { MlKem768 } = require("mlkem");

const kem = new MlKem768();

/**
 * Generate an ML-KEM-768 keypair.
 * @returns {Promise<{publicKey: Uint8Array, secretKey: Uint8Array}>}
 */
async function keygen() {
  const [publicKey, secretKey] = await kem.generateKeyPair();
  return { publicKey, secretKey };
}

/**
 * Encapsulate a shared secret against a public key.
 * @param {Uint8Array} publicKey
 * @returns {Promise<{cipherText: Uint8Array, sharedSecret: Uint8Array}>}
 */
async function encapsulate(publicKey) {
  const [cipherText, sharedSecret] = await kem.encap(publicKey);
  return { cipherText, sharedSecret };
}

/**
 * Decapsulate the shared secret.
 * @param {Uint8Array} cipherText
 * @param {Uint8Array} secretKey
 * @returns {Promise<Uint8Array>}
 */
async function decapsulate(cipherText, secretKey) {
  return kem.decap(cipherText, secretKey);
}

module.exports = {
  keygen,
  encapsulate,
  decapsulate,
};
