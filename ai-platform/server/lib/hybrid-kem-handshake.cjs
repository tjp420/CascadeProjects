'use strict';

/**
 * Hybrid KEM Handshake for cluster keyring sync (Track 6).
 *
 * Combines classical ECDH (X25519) with post-quantum ML-KEM-768 to derive
 * a shared session key. The handshake is fail-closed by default: if either
 * peer omits the post-quantum component, the connection is rejected unless
 * QUANTUM_DEGRADE_ALLOWED=1 is set.
 *
 * Protocol (length-prefixed JSON over the existing TLS/TCP socket):
 *
 *   Client → Server:  { "ek_classic": "<hex X25519 public>", "ek_pq": "<hex ML-KEM public>" }
 *   Server → Client:  { "c_classic": "<hex ECDH ephemeral public>", "c_pq": "<hex ML-KEM ciphertext>" }
 *
 * Both sides derive:
 *   ecdhSecret  = X25519(ephemeral_server, client_classic_priv)  // client side
 *   ecdhSecret  = X25519(ephemeral_server_priv, client_classic_pub)  // server side
 *   mlkemSecret = ML-KEM-768 decapsulate(c_pq, sk)               // client side
 *   mlkemSecret = ML-KEM-768 encapsulate(ek_pq).sharedSecret      // server side
 *   PRK         = HKDF-Extract(salt="simplebeacon:hybrid:v1", IKM = ecdhSecret || mlkemSecret)
 *   SessionKey  = HKDF-Expand(PRK, info="session:keyring", L=32)
 *
 * @module hybrid-kem-handshake
 */

const crypto = require('crypto');
const mlkem = require('./vendor/mlkem.cjs');

const HKDF_SALT = 'simplebeacon:hybrid:v1';
const HKDF_INFO = 'session:keyring';
const SESSION_KEY_LEN = 32;
const HANDSHAKE_LABEL = 'hybrid-kem';
const MAX_HANDSHAKE_MSG_BYTES = 1 << 16; // 64 KB

// ── Helpers ────────────────────────────────────────────────────────────────

function _toHex(buf) {
  return Buffer.from(buf).toString('hex');
}

function _fromHex(hex) {
  return new Uint8Array(Buffer.from(hex, 'hex'));
}

/**
 * HKDF-Extract + HKDF-Expand combiner.
 * @param {Uint8Array|Buffer} ecdhSecret - X25519 shared secret (32 bytes)
 * @param {Uint8Array|Buffer} mlkemSecret - ML-KEM-768 shared secret (32 bytes)
 * @returns {Buffer} 32-byte session key
 */
function deriveSessionKey(ecdhSecret, mlkemSecret) {
  const ikm = Buffer.concat([
    Buffer.from(ecdhSecret),
    Buffer.from(mlkemSecret),
  ]);
  const prk = crypto.hkdfSync(
    'sha256',
    ikm,
    HKDF_SALT,
    HKDF_INFO,
    SESSION_KEY_LEN,
  );
  return Buffer.from(prk);
}

/**
 * Read a single length-prefixed JSON message from a socket.
 * @returns {Promise<object>}
 */
function _readMessage(socket, timeoutMs) {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.removeListener('data', onData);
      socket.removeListener('close', onClose);
      socket.removeListener('error', onError);
      reject(new Error('hybrid handshake read timeout'));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      socket.removeListener('data', onData);
      socket.removeListener('close', onClose);
      socket.removeListener('error', onError);
    }

    function onData(chunk) {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length >= 4) {
        const length = buffer.readUInt32BE(0);
        if (length > MAX_HANDSHAKE_MSG_BYTES) {
          settled = true;
          cleanup();
          reject(new Error('hybrid handshake message exceeds 64 KB'));
          return;
        }
        if (buffer.length >= 4 + length) {
          const body = buffer.slice(4, 4 + length);
          settled = true;
          cleanup();
          try {
            resolve(JSON.parse(body.toString('utf8')));
          } catch (e) {
            reject(new Error('hybrid handshake: invalid JSON'));
          }
        }
      }
    }

    function onClose() {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('hybrid handshake: socket closed during read'));
    }

    function onError(err) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    }

    socket.on('data', onData);
    socket.once('close', onClose);
    socket.once('error', onError);
  });
}

/**
 * Send a length-prefixed JSON message over a socket.
 */
function _sendMessage(socket, obj) {
  const json = JSON.stringify(obj);
  const body = Buffer.from(json, 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32BE(body.length, 0);
  socket.write(Buffer.concat([header, body]));
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Create a client-side hybrid handshaker.
 *
 * The client generates an X25519 keypair and an ML-KEM-768 keypair,
 * sends both public keys to the server, receives the ECDH ephemeral
 * public key and ML-KEM ciphertext, then derives the session key.
 *
 * @param {import('net').Socket} socket - connected TCP/TLS socket
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=15000] - handshake timeout
 * @returns {Promise<{sessionKey: Buffer, downgraded: boolean}>}
 */
async function createClientHandshaker(socket, opts = {}) {
  const timeoutMs = opts.timeoutMs || 15000;
  const allowDegrade = process.env.QUANTUM_DEGRADE_ALLOWED === '1';

  // 1. Generate classical X25519 keypair
  const classicKeyPair = crypto.generateKeyPairSync('x25519');
  const classicPub = classicKeyPair.publicKey.export({ type: 'spki', format: 'der' });
  // Extract raw 32-byte public key from SPKI wrapper
  const classicPubRaw = classicPub.slice(-32);

  // 2. Generate ML-KEM-768 keypair
  const { publicKey: pqPub, secretKey: pqSk } = await mlkem.keygen();

  // 3. Send client hello: both public keys
  const clientHello = {
    ek_classic: _toHex(classicPubRaw),
    ek_pq: _toHex(pqPub),
  };
  _sendMessage(socket, clientHello);

  // 4. Read server response
  const serverResp = await _readMessage(socket, timeoutMs);

  // Check for downgrade
  if (!serverResp.c_pq) {
    if (!allowDegrade) {
      throw new Error('quantum_downgrade_rejected: server omitted c_pq');
    }
    // Permissive mode: classic-only
    if (!serverResp.c_classic) {
      throw new Error('hybrid handshake: server sent neither c_classic nor c_pq');
    }
    const serverEphemeralPub = _fromHex(serverResp.c_classic);
    const ecdhSecret = crypto.diffieHellman({
      privateKey: classicKeyPair.privateKey,
      publicKey: crypto.createPublicKey({
        key: _spkiFromRawX25519(serverEphemeralPub),
        format: 'der',
        type: 'spki',
      }),
    });
    // Use ECDH-only derivation with zero ML-KEM secret
    const mlkemSecret = Buffer.alloc(32);
    const sessionKey = deriveSessionKey(ecdhSecret, mlkemSecret);
    return { sessionKey, downgraded: true };
  }

  // 5. Decapsulate ML-KEM shared secret
  const c_pq = _fromHex(serverResp.c_pq);
  const mlkemSecret = await mlkem.decapsulate(c_pq, pqSk);

  // 6. Compute ECDH shared secret
  if (!serverResp.c_classic) {
    throw new Error('hybrid handshake: server omitted c_classic');
  }
  const serverEphemeralPub = _fromHex(serverResp.c_classic);
  const ecdhSecret = crypto.diffieHellman({
    privateKey: classicKeyPair.privateKey,
    publicKey: crypto.createPublicKey({
      key: _spkiFromRawX25519(serverEphemeralPub),
      format: 'der',
      type: 'spki',
    }),
  });

  // 7. Derive session key via HKDF combiner
  const sessionKey = deriveSessionKey(ecdhSecret, mlkemSecret);

  // 8. Verify key-confirmation MAC from server (detects replay/mismatch)
  if (serverResp.mac) {
    const expectedMac = crypto.createHmac('sha256', sessionKey)
      .update('server-confirmation')
      .digest('hex');
    if (expectedMac !== serverResp.mac) {
      throw new Error('hybrid handshake: key-confirmation MAC mismatch (possible replay or MITM)');
    }
  }

  return { sessionKey, downgraded: false };
}

/**
 * Create a server-side hybrid handshaker.
 *
 * The server reads the client's public keys, generates an X25519
 * ephemeral keypair, encapsulates the ML-KEM shared secret, and
 * sends both back. Then derives the same session key.
 *
 * @param {import('net').Socket} socket - incoming TCP/TLS socket
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=15000] - handshake timeout
 * @returns {Promise<{sessionKey: Buffer, downgraded: boolean}>}
 */
async function createServerHandshaker(socket, opts = {}) {
  const timeoutMs = opts.timeoutMs || 15000;
  const allowDegrade = process.env.QUANTUM_DEGRADE_ALLOWED === '1';

  // 1. Read client hello
  const clientHello = await _readMessage(socket, timeoutMs);

  if (!clientHello.ek_classic) {
    throw new Error('hybrid handshake: client omitted ek_classic');
  }

  // Check for PQ downgrade
  if (!clientHello.ek_pq) {
    if (!allowDegrade) {
      throw new Error('quantum_downgrade_rejected: client omitted ek_pq');
    }
    // Permissive mode: classic-only
    const clientClassicPub = _fromHex(clientHello.ek_classic);
    const ephemeralKeyPair = crypto.generateKeyPairSync('x25519');
    const ephemeralPubRaw = ephemeralKeyPair.publicKey.export({ type: 'spki', format: 'der' }).slice(-32);
    const ecdhSecret = crypto.diffieHellman({
      privateKey: ephemeralKeyPair.privateKey,
      publicKey: crypto.createPublicKey({
        key: _spkiFromRawX25519(clientClassicPub),
        format: 'der',
        type: 'spki',
      }),
    });
    _sendMessage(socket, { c_classic: _toHex(ephemeralPubRaw) });
    const mlkemSecret = Buffer.alloc(32);
    const sessionKey = deriveSessionKey(ecdhSecret, mlkemSecret);
    return { sessionKey, downgraded: true };
  }

  // 2. Generate ECDH ephemeral keypair
  const ephemeralKeyPair = crypto.generateKeyPairSync('x25519');
  const ephemeralPubRaw = ephemeralKeyPair.publicKey.export({ type: 'spki', format: 'der' }).slice(-32);

  // 3. Encapsulate ML-KEM shared secret against client's public key
  const clientPqPub = _fromHex(clientHello.ek_pq);
  const { cipherText, sharedSecret: mlkemSecret } = await mlkem.encapsulate(clientPqPub);

  // 4. Compute ECDH shared secret
  const clientClassicPub = _fromHex(clientHello.ek_classic);
  const ecdhSecret = crypto.diffieHellman({
    privateKey: ephemeralKeyPair.privateKey,
    publicKey: crypto.createPublicKey({
      key: _spkiFromRawX25519(clientClassicPub),
      format: 'der',
      type: 'spki',
    }),
  });

  // 5. Derive session key
  const sessionKey = deriveSessionKey(ecdhSecret, mlkemSecret);

  // 6. Compute key-confirmation MAC so the client can detect replay/mismatch
  const confirmMac = crypto.createHmac('sha256', sessionKey)
    .update('server-confirmation')
    .digest('hex');

  // 7. Send server response with confirmation MAC
  _sendMessage(socket, {
    c_classic: _toHex(ephemeralPubRaw),
    c_pq: _toHex(cipherText),
    mac: confirmMac,
  });

  return { sessionKey, downgraded: false };
}

/**
 * Build a minimal SPKI DER for a raw 32-byte X25519 public key.
 * The X25519 OID is 1.3.101.110.
 */
function _spkiFromRawX25519(raw32) {
  // SPKI for X25519 (OID 1.3.101.110):
  //   SEQUENCE {
  //     SEQUENCE { OID 1.3.101.110 }    -- 30 05 06 03 2b 65 6e
  //     BIT STRING { 00, <32 bytes> }   -- 03 21 00 <32>
  //   }
  // Total content = 7 + 35 = 42 bytes; outer SEQUENCE = 30 2a ...
  const der = Buffer.concat([
    Buffer.from([0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x03, 0x21, 0x00]),
    Buffer.from(raw32),
  ]);
  return der;
}

module.exports = {
  createClientHandshaker,
  createServerHandshaker,
  deriveSessionKey,
  HKDF_SALT,
  HKDF_INFO,
  SESSION_KEY_LEN,
};
