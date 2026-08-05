'use strict';

/**
 * Track 113: Compatibility shim for classical-only peers.
 *
 * Auto-detects whether a peer public key is hybrid-capable (contains ML-KEM).
 * If not, it falls back to a classical X25519/Ed25519 handshake while
 * enforcing an optional deprecation deadline and emitting telemetry.
 *
 * @module crypto/ratchet/compatibility-shim
 */

const crypto = require('node:crypto');
const bootstrap = require('./hybrid-bootstrap.cjs');
const { initializeFromShared } = require('./index.cjs');

const CLASSICAL_LABEL = Buffer.from('track113-classical-fallback');
const HANDSHAKE_VERSION_CLASSICAL = 0x00;
const HANDSHAKE_VERSION_HYBRID = 0x01;

class CompatibilityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CompatibilityError';
    this.code = code;
  }
}

/**
 * Inspect a peer public key and determine the session mode.
 * @param {Buffer} publicKey
 * @returns {{mode: 'HYBRID'|'CLASSICAL'}}
 */
function detectMode(publicKey) {
  if (!Buffer.isBuffer(publicKey) || publicKey.length === 0) {
    throw new CompatibilityError('INVALID_PUBLIC_KEY', 'public key is required');
  }
  if (publicKey[0] === bootstrap.HYBRID_VERSION && publicKey.length >= 2) {
    const components = bootstrap.deserializePublicKey(publicKey);
    if (components[bootstrap.COMP_MLKEM768]) return { mode: 'HYBRID' };
    if (components[bootstrap.COMP_X25519] && components[bootstrap.COMP_ED25519]) return { mode: 'CLASSICAL' };
    throw new CompatibilityError('INVALID_HYBRID_KEY_LAYOUT', 'peer key missing x25519 or ed25519 component');
  }
  // SPKI DER or raw; for this shim we require the versioned layout.
  throw new CompatibilityError('INVALID_PUBLIC_KEY', 'unrecognized peer public key format');
}

function _classicalPeerComponents(publicKey) {
  try {
    const components = bootstrap.deserializePublicKey(publicKey);
    return {
      x25519: components[bootstrap.COMP_X25519],
      ed25519: components[bootstrap.COMP_ED25519],
    };
  } catch (e) {
    throw new CompatibilityError('INVALID_HYBRID_KEY_LAYOUT', `failed to parse peer key: ${e.message}`);
  }
}

function _deriveClassicalShared(localX25519Private, peerX25519PublicDer) {
  const peer = crypto.createPublicKey({ key: peerX25519PublicDer, type: 'spki', format: 'der' });
  const local = crypto.createPrivateKey({ key: localX25519Private, type: 'pkcs8', format: 'der' });
  const dh = crypto.diffieHellman({ privateKey: local, publicKey: peer });
  return Buffer.from(crypto.hkdfSync('sha384', Buffer.alloc(0), dh, CLASSICAL_LABEL, 32));
}

function _makeTranscript(localPublic, peerPublic) {
  return Buffer.concat([
    Buffer.from('track113-handshake-v1'),
    crypto.createHash('sha256').update(localPublic).digest(),
    crypto.createHash('sha256').update(peerPublic).digest(),
  ]);
}

function _checkDeprecation(opts, telemetry) {
  const now = opts.now || Date.now();
  const deadline = opts.deprecationDeadline;
  if (typeof deadline === 'number' && now >= deadline) {
    throw new CompatibilityError('CLASSICAL_DEPRECATION_DEADLINE', 'classical-only handshake past deprecation deadline');
  }
  if (telemetry) telemetry('IDENTITY_COMPAT_CLASSICAL_FALLBACK', { now, deprecationDeadline: deadline });
}

/**
 * Initiate a handshake to a peer.
 * @param {IdentityRatchet} localRatchet
 * @param {Buffer} peerPublicKey
 * @param {object} [opts]
 * @param {number} [opts.deprecationDeadline]
 * @param {number} [opts.now]
 * @param {Function} [opts.telemetry]
 * @returns {Promise<{mode: 'HYBRID'|'CLASSICAL', handshake: Buffer, chainKey: string}>}
 */
async function initiateHandshake(localRatchet, peerPublicKey, opts = {}) {
  const { mode } = detectMode(peerPublicKey);

  if (mode === 'HYBRID') {
    const enc = await localRatchet.encapsulateFor(peerPublicKey);
    const transcript = _makeTranscript(localRatchet.publicKey, peerPublicKey);
    const signature = localRatchet.signHandshake(transcript);
    const handshake = Buffer.concat([
      Buffer.from([HANDSHAKE_VERSION_HYBRID]),
      enc.cipherText,
      Buffer.from([signature.length]),
      signature,
    ]);
    return { mode, handshake, chainKey: enc.chainKey };
  }

  // Classical mode
  _checkDeprecation(opts, opts.telemetry);
  const peer = _classicalPeerComponents(peerPublicKey);
  const sharedSecret = _deriveClassicalShared(localRatchet.secretKey.x25519, peer.x25519);

  const ephemeral = crypto.generateKeyPairSync('x25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });
  const ephemeralPublic = ephemeral.publicKey;
  const peerPub = crypto.createPublicKey({ key: peer.x25519, type: 'spki', format: 'der' });
  const ephemeralPrivate = crypto.createPrivateKey({ key: ephemeral.privateKey, type: 'pkcs8', format: 'der' });
  const dh = crypto.diffieHellman({ privateKey: ephemeralPrivate, publicKey: peerPub });
  const finalShared = Buffer.from(crypto.hkdfSync('sha384', Buffer.alloc(0), Buffer.concat([sharedSecret, dh]), CLASSICAL_LABEL, 32));

  const { ck } = initializeFromShared(finalShared);
  localRatchet._initChain(finalShared);

  const transcript = _makeTranscript(localRatchet.publicKey, peerPublicKey);
  const signature = localRatchet.signHandshake(transcript);
  const handshake = Buffer.concat([
    Buffer.from([HANDSHAKE_VERSION_CLASSICAL]),
    ephemeralPublic,
    Buffer.from([signature.length]),
    signature,
  ]);

  return { mode, handshake, chainKey: ck.toString('hex') };
}

/**
 * Accept a handshake from a peer.
 * @param {IdentityRatchet} localRatchet
 * @param {Buffer} handshake
 * @param {Buffer} peerPublicKey
 * @param {object} [opts]
 * @param {number} [opts.deprecationDeadline]
 * @param {number} [opts.now]
 * @param {Function} [opts.telemetry]
 * @returns {Promise<{mode: 'HYBRID'|'CLASSICAL', chainKey: string}>}
 */
async function acceptHandshake(localRatchet, handshake, peerPublicKey, opts = {}) {
  if (!Buffer.isBuffer(handshake) || handshake.length < 1) {
    throw new CompatibilityError('INVALID_HANDSHAKE', 'handshake is required');
  }
  const version = handshake[0];

  if (version === HANDSHAKE_VERSION_HYBRID) {
    const cipherText = handshake.subarray(1);
    const { chainKey } = await localRatchet.decapsulateFrom(cipherText);
    return { mode: 'HYBRID', chainKey };
  }

  if (version !== HANDSHAKE_VERSION_CLASSICAL) {
    throw new CompatibilityError('INVALID_HANDSHAKE_VERSION', `handshake version ${version} not supported`);
  }

  _checkDeprecation(opts, opts.telemetry);

  // layout: version(1) | ephemeralX25519Der | sigLen(1) | signature
  const peer = _classicalPeerComponents(peerPublicKey);
  // SPKI DER X25519 is 44 bytes; sigLen(1) + Ed25519 signature(64) = 65 trailing bytes
  const EPHEMERAL_DER_LEN = 44;
  const SIG_LEN = 64;
  if (handshake.length !== 1 + EPHEMERAL_DER_LEN + 1 + SIG_LEN) {
    throw new CompatibilityError('INVALID_HANDSHAKE', 'handshake too short');
  }
  const sigLen = handshake[handshake.length - 1 - SIG_LEN];
  if (sigLen !== SIG_LEN) throw new CompatibilityError('INVALID_HANDSHAKE', 'unexpected signature length');
  const signature = handshake.subarray(handshake.length - SIG_LEN);
  const ephemeralPublicDer = handshake.subarray(1, 1 + EPHEMERAL_DER_LEN);
  const localX25519Private = crypto.createPrivateKey({ key: localRatchet.secretKey.x25519, type: 'pkcs8', format: 'der' });
  const ephemeralPub = crypto.createPublicKey({ key: ephemeralPublicDer, type: 'spki', format: 'der' });
  const dh = crypto.diffieHellman({ privateKey: localX25519Private, publicKey: ephemeralPub });
  const sharedSecret = _deriveClassicalShared(localRatchet.secretKey.x25519, peer.x25519);
  const finalShared = Buffer.from(crypto.hkdfSync('sha384', Buffer.alloc(0), Buffer.concat([sharedSecret, dh]), CLASSICAL_LABEL, 32));

  const transcript = _makeTranscript(peerPublicKey, localRatchet.publicKey);
  if (!bootstrap.verify(signature, transcript, peerPublicKey)) {
    throw new CompatibilityError('SIGNATURE_INVALID', 'classical handshake signature verification failed');
  }

  const { ck } = initializeFromShared(finalShared);
  localRatchet._initChain(finalShared);
  return { mode: 'CLASSICAL', chainKey: ck.toString('hex') };
}

module.exports = {
  CompatibilityError,
  detectMode,
  initiateHandshake,
  acceptHandshake,
};
