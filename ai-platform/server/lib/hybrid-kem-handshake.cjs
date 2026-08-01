'use strict';

/**
 * Hybrid KEM handshake for cluster sync.
 *
 * Combines the classic TLS/ECDH secret with an ML-KEM-768 shared secret to
 * produce a post-quantum-resistant session keyring. All KEM traffic is
 * length-prefixed JSON exchanged inside the existing TLS-protected socket.
 *
 * @module hybrid-kem-handshake
 */

const crypto = require('crypto');
const { promisify } = require('util');
const { keygen, encapsulate, decapsulate } = require('./vendor/mlkem.cjs');

const HK = require('./app-logger.cjs');
const logger = HK.logger ? HK.logger : HK;

const hkdf = promisify(crypto.hkdf);

const HYBRID_SALT = 'simplebeacon:hybrid:v1';
const HYBRID_INFO = 'session:keyring';
const KEYRING_LENGTH = 32;

const DEFAULT_TIMEOUT_MS = 30000;

function isQuantumDowngradeAllowed() {
  return process.env.QUANTUM_DEGRADE_ALLOWED === '1';
}

/**
 * Derive the final 32-byte session keyring.
 * @param {Uint8Array|Buffer} classicSecret
 * @param {Uint8Array|Buffer} pqSharedSecret
 * @returns {Promise<Buffer>}
 */
async function deriveSessionKeyRing(classicSecret, pqSharedSecret) {
  const c = Buffer.from(classicSecret);
  const pq = Buffer.from(pqSharedSecret);
  const ikm = Buffer.concat([c, pq]);
  const ring = await hkdf('sha256', ikm, HYBRID_SALT, HYBRID_INFO, KEYRING_LENGTH);
  return Buffer.from(ring);
}

function _toBuffer(value, fallback) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (typeof value === 'string') return Buffer.from(value, 'utf8');
  return fallback;
}

function _readClassicSecret(socket, provided) {
  if (provided) return _toBuffer(provided, Buffer.alloc(0));
  if (socket && typeof socket.getSession === 'function') {
    const s = socket.getSession();
    if (s) return _toBuffer(s, Buffer.alloc(0));
  }
  if (socket && socket.getCipher && typeof socket.getCipher === 'function') {
    const cipher = socket.getCipher();
    if (cipher && cipher.name) return Buffer.from(cipher.name, 'utf8');
  }
  throw new Error('hybrid-kem: no classic secret available');
}

function _writeFrame(socket, message) {
  const payload = Buffer.from(JSON.stringify(message), 'utf8');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length, 0);
  socket.write(Buffer.concat([length, payload]));
}

function _readFrame(socket, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('hybrid-kem: handshake read timeout'));
    }, timeoutMs);

    let bufs = [];
    let total = 0;
    let expected = null;

    function cleanup() {
      clearTimeout(timer);
      socket.removeListener('data', onData);
      socket.removeListener('error', onError);
      socket.removeListener('close', onClose);
    }

    function onError(err) {
      cleanup();
      reject(err);
    }

    function onClose() {
      cleanup();
      reject(new Error('hybrid-kem: socket closed during handshake'));
    }

    function processBuffer() {
      if (expected === null) {
        if (total < 4) return false;
        const header = Buffer.concat(bufs);
        expected = header.readUInt32BE(0);
        const extra = header.slice(4);
        bufs = extra.length ? [extra] : [];
        total = extra.length;
      }
      if (total < expected) return false;
      const full = Buffer.concat(bufs);
      const payload = full.slice(0, expected);
      const leftover = full.slice(expected);
      if (leftover.length) {
        bufs = [leftover];
        total = leftover.length;
        expected = null;
      } else {
        bufs = [];
        total = 0;
        expected = null;
      }
      cleanup();
      resolve(payload);
      return true;
    }

    function onData(chunk) {
      bufs.push(chunk);
      total += chunk.length;
      processBuffer();
    }

    socket.on('data', onData);
    socket.on('error', onError);
    socket.on('close', onClose);
  });
}

/**
 * Perform the client side of the hybrid handshake.
 * @param {import('net').Socket} socket
 * @param {object} [options]
 * @param {Uint8Array|Buffer} [options.classicSecret] — optional classic secret
 * @param {number} [options.timeoutMs]
 * @param {boolean} [options.quantumCapable]
 * @returns {Promise<Buffer>} 32-byte session keyring
 */
async function createClientHandshaker(socket, options = {}) {
  const { classicSecret, timeoutMs = DEFAULT_TIMEOUT_MS, quantumCapable = true } = options;

  let pqSecret = Buffer.alloc(0);
  let clientKeypair = null;

  if (quantumCapable) {
    clientKeypair = await keygen();
    _writeFrame(socket, {
      type: 'clientHello',
      publicKey: Buffer.from(clientKeypair.publicKey).toString('base64'),
    });

    const response = JSON.parse((await _readFrame(socket, timeoutMs)).toString('utf8'));
    if (response.type !== 'serverResponse' || !response.cipherText) {
      throw new Error('hybrid-kem: unexpected server response');
    }

    const cipherText = Uint8Array.from(Buffer.from(response.cipherText, 'base64'));
    pqSecret = await decapsulate(cipherText, clientKeypair.secretKey);
    pqSecret = Buffer.from(pqSecret);
  } else {
    _writeFrame(socket, {
      type: 'clientHello',
      quantumCapable: false,
    });
    const response = JSON.parse((await _readFrame(socket, timeoutMs)).toString('utf8'));
    if (response.type !== 'serverResponse') {
      throw new Error('hybrid-kem: unexpected server response');
    }
    if (response.error) {
      throw new Error(`hybrid-kem: ${response.error}`);
    }
    if (response.degraded) {
      if (!isQuantumDowngradeAllowed()) {
        throw new Error('hybrid-kem: downgrade not allowed; quantum capability required');
      }
      logger.warn('hybrid-kem: classic-only connection negotiated (quantum_downgrade)');
    } else {
      throw new Error('hybrid-kem: downgrade refused by server');
    }
  }

  const classic = _readClassicSecret(socket, classicSecret);
  return deriveSessionKeyRing(classic, pqSecret);
}

/**
 * Perform the server side of the hybrid handshake.
 * @param {import('net').Socket} socket
 * @param {object} [options]
 * @param {Uint8Array|Buffer} [options.classicSecret]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<Buffer>} 32-byte session keyring
 */
async function createServerHandshaker(socket, options = {}) {
  const { classicSecret, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const hello = JSON.parse((await _readFrame(socket, timeoutMs)).toString('utf8'));
  if (hello.type !== 'clientHello') {
    throw new Error('hybrid-kem: expected clientHello');
  }

  let pqSecret = Buffer.alloc(0);

  if (hello.publicKey) {
    const publicKey = Uint8Array.from(Buffer.from(hello.publicKey, 'base64'));
    const { sharedSecret, cipherText } = await encapsulate(publicKey);
    pqSecret = Buffer.from(sharedSecret);
    _writeFrame(socket, {
      type: 'serverResponse',
      cipherText: Buffer.from(cipherText).toString('base64'),
    });
  } else if (hello.quantumCapable === false && isQuantumDowngradeAllowed()) {
    _writeFrame(socket, { type: 'serverResponse', degraded: true });
    logger.warn('hybrid-kem: accepting classic-only connection (quantum_downgrade)');
  } else {
    _writeFrame(socket, { type: 'serverResponse', error: 'quantum_downgrade_rejected' });
    throw new Error('hybrid-kem: quantum_downgrade_rejected');
  }

  const classic = _readClassicSecret(socket, classicSecret);
  return deriveSessionKeyRing(classic, pqSecret);
}

module.exports = {
  deriveSessionKeyRing,
  createClientHandshaker,
  createServerHandshaker,
  isQuantumDowngradeAllowed,
};
