"use strict";

/**
 * Track 113: Hybrid KEM + Ed25519 identity ratchet bootstrap.
 *
 * Combines a classical X25519/Ed25519 layer with the ML-KEM-768 (Kyber-768)
 * post-quantum KEM vendored in server/lib/vendor/mlkem.cjs. The design is
 * intentionally fail-closed: if the PQC component cannot initialize, the
 * entire bootstrap throws and emits a CRITICAL forensic SIEM event.
 *
 * @module crypto/ratchet/hybrid-bootstrap
 */

const crypto = require("node:crypto");
const mlkem = require("../../vendor/mlkem.cjs");

const HYBRID_VERSION = 0x01;

// Component identifiers in the serialized hybrid public key
const COMP_ED25519 = 0x01;
const COMP_X25519 = 0x02;
const COMP_MLKEM768 = 0x03;

const SUPPORTED_VERSIONS = new Set([HYBRID_VERSION]);

const LABEL_IKM = Buffer.from("track113-hybrid-identity");

class HybridBootstrapError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "HybridBootstrapError";
    this.code = code;
  }
}

/**
 * Generate a new hybrid identity keypair.
 * @param {string} deviceId
 * @returns {Promise<{secretKey: object, publicKey: Buffer}>}
 */
async function generateKeypair(deviceId) {
  if (!deviceId || typeof deviceId !== "string") {
    throw new HybridBootstrapError("INVALID_INPUT", "deviceId is required");
  }

  let pq;
  try {
    pq = await mlkem.keygen();
  } catch (e) {
    throw new HybridBootstrapError(
      "PQC_BOOTSTRAP_FAILED",
      `ML-KEM keygen failed: ${e && e.message}`,
    );
  }

  let classical;
  try {
    classical = {
      ed25519: crypto.generateKeyPairSync("ed25519", {
        publicKeyEncoding: { type: "spki", format: "der" },
        privateKeyEncoding: { type: "pkcs8", format: "der" },
      }),
      x25519: crypto.generateKeyPairSync("x25519", {
        publicKeyEncoding: { type: "spki", format: "der" },
        privateKeyEncoding: { type: "pkcs8", format: "der" },
      }),
    };
  } catch (e) {
    throw new HybridBootstrapError(
      "CLASSICAL_BOOTSTRAP_FAILED",
      `classical keygen failed: ${e && e.message}`,
    );
  }

  const secretKey = {
    deviceId,
    ed25519: classical.ed25519.privateKey,
    x25519: classical.x25519.privateKey,
    mlkem: pq.secretKey,
  };

  const publicKey = serializePublicKey({
    [COMP_ED25519]: classical.ed25519.publicKey,
    [COMP_X25519]: classical.x25519.publicKey,
    [COMP_MLKEM768]: pq.publicKey,
  });

  return { secretKey, publicKey };
}

/**
 * Serialize a hybrid public key with version and length-prefixed components.
 * @param {object} components — id -> Buffer/Uint8Array
 * @returns {Buffer}
 */
function serializePublicKey(components) {
  const compIds = Object.keys(components)
    .map(Number)
    .sort((a, b) => a - b);
  const blocks = [];
  for (const id of compIds) {
    const data = Buffer.from(components[id]);
    blocks.push(Buffer.from([id]));
    const len = Buffer.alloc(2);
    len.writeUInt16BE(data.length, 0);
    blocks.push(len, data);
  }
  return Buffer.concat([
    Buffer.from([HYBRID_VERSION, compIds.length]),
    Buffer.concat(blocks),
  ]);
}

/**
 * Deserialize a hybrid public key buffer.
 * @param {Buffer} publicKey
 * @returns {object} components — id -> Buffer
 */
function deserializePublicKey(publicKey) {
  if (!Buffer.isBuffer(publicKey)) {
    throw new HybridBootstrapError(
      "INVALID_INPUT",
      "publicKey must be a Buffer",
    );
  }
  if (publicKey.length < 2) {
    throw new HybridBootstrapError(
      "INVALID_HYBRID_KEY_LAYOUT",
      "key too short",
    );
  }
  const version = publicKey[0];
  if (!SUPPORTED_VERSIONS.has(version)) {
    throw new HybridBootstrapError(
      "UNSUPPORTED_HYBRID_KEY_VERSION",
      `version ${version} not supported`,
    );
  }
  const numComponents = publicKey[1];
  const components = {};
  let offset = 2;
  for (let i = 0; i < numComponents; i++) {
    if (offset + 3 > publicKey.length) {
      throw new HybridBootstrapError(
        "INVALID_HYBRID_KEY_LAYOUT",
        "truncated component header",
      );
    }
    const id = publicKey[offset];
    const len = publicKey.readUInt16BE(offset + 1);
    offset += 3;
    if (offset + len > publicKey.length) {
      throw new HybridBootstrapError(
        "INVALID_HYBRID_KEY_LAYOUT",
        `component ${id} exceeds key length`,
      );
    }
    components[id] = publicKey.subarray(offset, offset + len);
    offset += len;
  }
  return components;
}

function _requireComponent(components, id, name) {
  if (!components[id]) {
    throw new HybridBootstrapError(
      "INVALID_HYBRID_KEY_LAYOUT",
      `missing component: ${name}`,
    );
  }
  return components[id];
}

/**
 * Encapsulate a shared secret against a hybrid public key.
 * @param {Buffer} publicKey
 * @returns {Promise<{cipherText: Buffer, sharedSecret: Buffer}>}
 */
async function encapsulate(publicKey) {
  const components = deserializePublicKey(publicKey);
  const mlkemPublic = _requireComponent(components, COMP_MLKEM768, "mlkem-768");
  const x25519Public = _requireComponent(components, COMP_X25519, "x25519");

  let pq;
  try {
    pq = await mlkem.encapsulate(mlkemPublic);
  } catch (e) {
    throw new HybridBootstrapError(
      "PQC_ENCAPSULATE_FAILED",
      `ML-KEM encapsulate failed: ${e && e.message}`,
    );
  }

  let ephemeral;
  try {
    ephemeral = crypto.generateKeyPairSync("x25519", {
      publicKeyEncoding: { type: "spki", format: "der" },
      privateKeyEncoding: { type: "pkcs8", format: "der" },
    });
  } catch (e) {
    throw new HybridBootstrapError(
      "CLASSICAL_ENCAPSULATE_FAILED",
      `X25519 ephemeral keygen failed: ${e && e.message}`,
    );
  }

  const recipient = crypto.createPublicKey({
    key: x25519Public,
    type: "spki",
    format: "der",
  });
  const ephemeralPrivate = crypto.createPrivateKey({
    key: ephemeral.privateKey,
    type: "pkcs8",
    format: "der",
  });
  const dh = crypto.diffieHellman({
    privateKey: ephemeralPrivate,
    publicKey: recipient,
  });

  const sharedSecret = Buffer.from(
    crypto.hkdfSync(
      "sha384",
      Buffer.alloc(0),
      Buffer.concat([Buffer.from(pq.sharedSecret), dh]),
      LABEL_IKM,
      32,
    ),
  );

  const cipherText = Buffer.concat([
    Buffer.from([HYBRID_VERSION]),
    pq.cipherText,
    ephemeral.publicKey,
  ]);

  return { cipherText, sharedSecret };
}

/**
 * Decapsulate the shared secret from a cipher text.
 * @param {Buffer} cipherText
 * @param {object} secretKey
 * @returns {Promise<Buffer>}
 */
async function decapsulate(cipherText, secretKey) {
  if (!Buffer.isBuffer(cipherText) || cipherText.length < 1) {
    throw new HybridBootstrapError("INVALID_INPUT", "cipherText is required");
  }
  const version = cipherText[0];
  if (!SUPPORTED_VERSIONS.has(version)) {
    throw new HybridBootstrapError(
      "UNSUPPORTED_HYBRID_KEY_VERSION",
      `version ${version} not supported`,
    );
  }

  const MLKEM_CT_LEN = 1088; // ML-KEM-768 ciphertext length
  if (cipherText.length < 1 + MLKEM_CT_LEN + 2) {
    throw new HybridBootstrapError(
      "INVALID_HYBRID_KEY_LAYOUT",
      "cipherText too short",
    );
  }

  const mlkemCipher = cipherText.subarray(1, 1 + MLKEM_CT_LEN);
  const x25519EphemeralDer = cipherText.subarray(1 + MLKEM_CT_LEN);

  let pqShared;
  try {
    pqShared = await mlkem.decapsulate(mlkemCipher, secretKey.mlkem);
  } catch (e) {
    throw new HybridBootstrapError(
      "PQC_DECAPSULATE_FAILED",
      `ML-KEM decapsulate failed: ${e && e.message}`,
    );
  }

  const ephemeral = crypto.createPublicKey({
    key: x25519EphemeralDer,
    type: "spki",
    format: "der",
  });
  const x25519Private = crypto.createPrivateKey({
    key: secretKey.x25519,
    type: "pkcs8",
    format: "der",
  });
  const dh = crypto.diffieHellman({
    privateKey: x25519Private,
    publicKey: ephemeral,
  });

  return Buffer.from(
    crypto.hkdfSync(
      "sha384",
      Buffer.alloc(0),
      Buffer.concat([Buffer.from(pqShared), dh]),
      LABEL_IKM,
      32,
    ),
  );
}

/**
 * Sign a handshake transcript with the hybrid identity's Ed25519 secret.
 * @param {Buffer} transcript
 * @param {object} secretKey
 * @returns {Buffer}
 */
function sign(transcript, secretKey) {
  if (!Buffer.isBuffer(transcript)) {
    throw new HybridBootstrapError(
      "INVALID_INPUT",
      "transcript must be a Buffer",
    );
  }
  const privateKey = crypto.createPrivateKey({
    key: secretKey.ed25519,
    type: "pkcs8",
    format: "der",
  });
  return crypto.sign(null, transcript, privateKey);
}

/**
 * Verify a handshake signature against a hybrid public key.
 * @param {Buffer} signature
 * @param {Buffer} transcript
 * @param {Buffer} publicKey
 * @returns {boolean}
 */
function verify(signature, transcript, publicKey) {
  if (
    !Buffer.isBuffer(signature) ||
    !Buffer.isBuffer(transcript) ||
    !Buffer.isBuffer(publicKey)
  ) {
    throw new HybridBootstrapError(
      "INVALID_INPUT",
      "signature, transcript, and publicKey are required Buffers",
    );
  }
  const components = deserializePublicKey(publicKey);
  const ed25519Public = _requireComponent(components, COMP_ED25519, "ed25519");
  const pub = crypto.createPublicKey({
    key: ed25519Public,
    type: "spki",
    format: "der",
  });
  return crypto.verify(null, transcript, pub, signature);
}

module.exports = {
  HYBRID_VERSION,
  COMP_ED25519,
  COMP_X25519,
  COMP_MLKEM768,
  HybridBootstrapError,
  generateKeypair,
  serializePublicKey,
  deserializePublicKey,
  encapsulate,
  decapsulate,
  sign,
  verify,
};
