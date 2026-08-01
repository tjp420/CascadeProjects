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
const resumption = require('./hybrid-kem-resumption.cjs');

const HKDF_SALT = 'simplebeacon:hybrid:v1';
const HKDF_INFO = 'session:keyring';
const SESSION_KEY_LEN = 32;
const HANDSHAKE_LABEL = 'hybrid-kem';
const MAX_HANDSHAKE_MSG_BYTES = 1 << 16; // 64 KB

const PFS_SALT = 'simplebeacon:pfs:v1';
const PFS_INFO = 'pfs:root';
const REKEY_INTERVAL_SEC = parseInt(process.env.REKEY_INTERVAL_SEC, 10) || 3600;
const MAX_QUEUE_BYTES = parseInt(process.env.HYBRID_MAX_QUEUE_BYTES, 10) || (16 * 1024 * 1024);

const REKEY_STATES = {
  IDLE: 'IDLE',
  ACTIVE: 'ACTIVE',
  REKEYING: 'REKEYING',
};

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

// ── PFS / Re-key helpers ───────────────────────────────────────────────────

/**
 * Derive the next PFS root from the previous root plus fresh secrets.
 * newRoot = HKDF-Extract(salt="simplebeacon:pfs:v1",
 *                        IKM = prevRoot || newECDHSecret || newMLKEMSecret)
 *
 * @param {Uint8Array|Buffer} prevRoot
 * @param {Uint8Array|Buffer} ecdhSecret
 * @param {Uint8Array|Buffer} mlkemSecret
 * @returns {Buffer} 32-byte new root
 */
function deriveRekeyRoot(prevRoot, ecdhSecret, mlkemSecret) {
  const ikm = Buffer.concat([
    Buffer.from(prevRoot),
    Buffer.from(ecdhSecret),
    Buffer.from(mlkemSecret),
  ]);
  const newRoot = crypto.hkdfSync(
    'sha256',
    ikm,
    PFS_SALT,
    PFS_INFO,
    SESSION_KEY_LEN,
  );
  return Buffer.from(newRoot);
}

function _rekeyMac(root, label, extras) {
  const hmac = crypto.createHmac('sha256', root).update(label);
  if (extras) {
    hmac.update(extras);
  }
  return hmac.digest('hex');
}

async function rekeyAsInitiator(socket, currentRoot, timeoutMs) {
  const tm = timeoutMs || 15000;

  // 1. Generate fresh X25519 + ML-KEM ephemeral material
  const classicKeyPair = crypto.generateKeyPairSync('x25519');
  const classicPubRaw = classicKeyPair.publicKey.export({ type: 'spki', format: 'der' }).slice(-32);
  const { publicKey: pqPub, secretKey: pqSk } = await mlkem.keygen();

  _sendMessage(socket, { type: 'REKEY_INIT', ek_classic: _toHex(classicPubRaw), ek_pq: _toHex(pqPub) });

  // 2. Read responder's reply
  const resp = await _readMessage(socket, tm);
  if (resp.type !== 'REKEY_RESP' || !resp.c_classic || !resp.c_pq || !resp.mac) {
    throw new Error('pfs: invalid REKEY_RESP');
  }

  // 3. Derive secrets
  const serverEphemeralPub = _fromHex(resp.c_classic);
  const ecdhSecret = crypto.diffieHellman({
    privateKey: classicKeyPair.privateKey,
    publicKey: crypto.createPublicKey({ key: _spkiFromRawX25519(serverEphemeralPub), format: 'der', type: 'spki' }),
  });
  const c_pq = _fromHex(resp.c_pq);
  const mlkemSecret = await mlkem.decapsulate(c_pq, pqSk);

  const newRoot = deriveRekeyRoot(currentRoot, ecdhSecret, mlkemSecret);

  // 4. Verify responder's confirmation MAC
  const expectedMac = _rekeyMac(newRoot, 'pfs:rekey-resp:', `${resp.c_classic}:${resp.c_pq}`);
  if (expectedMac !== resp.mac) {
    throw new Error('pfs: REKEY_RESP MAC mismatch');
  }

  // 5. Send our own ACK
  const ackMac = _rekeyMac(newRoot, 'pfs:rekey-ack:', '');
  _sendMessage(socket, { type: 'REKEY_ACK', mac: ackMac });

  return { newRoot, sessionKey: deriveSessionKey(ecdhSecret, mlkemSecret) };
}

async function rekeyAsResponder(socket, currentRoot, timeoutMs) {
  const tm = timeoutMs || 15000;

  // 1. Read REKEY_INIT
  const init = await _readMessage(socket, tm);
  if (init.type !== 'REKEY_INIT' || !init.ek_classic || !init.ek_pq) {
    throw new Error('pfs: invalid REKEY_INIT');
  }

  // 2. Generate fresh X25519 ephemeral and encapsulate PQ
  const ephemeralKeyPair = crypto.generateKeyPairSync('x25519');
  const ephemeralPubRaw = ephemeralKeyPair.publicKey.export({ type: 'spki', format: 'der' }).slice(-32);
  const clientPqPub = _fromHex(init.ek_pq);
  const { cipherText, sharedSecret: mlkemSecret } = await mlkem.encapsulate(clientPqPub);

  // 3. Derive ECDH
  const clientClassicPub = _fromHex(init.ek_classic);
  const ecdhSecret = crypto.diffieHellman({
    privateKey: ephemeralKeyPair.privateKey,
    publicKey: crypto.createPublicKey({ key: _spkiFromRawX25519(clientClassicPub), format: 'der', type: 'spki' }),
  });

  const newRoot = deriveRekeyRoot(currentRoot, ecdhSecret, mlkemSecret);

  // 4. Send REKEY_RESP with confirmation MAC
  const cClassicHex = _toHex(ephemeralPubRaw);
  const cPqHex = _toHex(cipherText);
  const respMac = _rekeyMac(newRoot, 'pfs:rekey-resp:', `${cClassicHex}:${cPqHex}`);
  _sendMessage(socket, { type: 'REKEY_RESP', c_classic: cClassicHex, c_pq: cPqHex, mac: respMac });

  // 5. Read REKEY_ACK and verify
  const ack = await _readMessage(socket, tm);
  if (ack.type !== 'REKEY_ACK' || !ack.mac) {
    throw new Error('pfs: invalid REKEY_ACK');
  }
  const expectedAck = _rekeyMac(newRoot, 'pfs:rekey-ack:', '');
  if (expectedAck !== ack.mac) {
    throw new Error('pfs: REKEY_ACK MAC mismatch');
  }

  return { newRoot, sessionKey: deriveSessionKey(ecdhSecret, mlkemSecret) };
}

/**
 * Minimal stateful wrapper for a hybrid KEM session. Tracks re-keying
 * suspension and queues outbound data frames during the cut-over.
 */
class HybridSession {
  constructor(socket, opts = {}) {
    this.socket = socket;
    this.initiator = !!opts.initiator;
    this.state = REKEY_STATES.IDLE;
    this.rootKey = opts.rootKey || null;
    this.sessionKey = opts.sessionKey || null;
    this.writeQueue = [];
    this.rekeyTimer = null;
    this.timeoutMs = opts.timeoutMs || 15000;
    this._startRekeyTimer();
  }

  _startRekeyTimer() {
    if (this.rekeyTimer) return;
    this.rekeyTimer = setInterval(() => {
      this.rekey().catch(() => {});
    }, REKEY_INTERVAL_SEC * 1000);
  }

  setKeys({ rootKey, sessionKey }) {
    this.rootKey = rootKey;
    this.sessionKey = sessionKey;
    this.state = REKEY_STATES.ACTIVE;
  }

  send(data) {
    if (this.state === REKEY_STATES.REKEYING) {
      // Enforce a bounded queue to prevent unbounded memory growth
      // during an extended re-key handshake.
      const queuedBytes = this._queuedBytes();
      const dataBytes = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);
      if (queuedBytes + dataBytes > MAX_QUEUE_BYTES) {
        this.state = REKEY_STATES.IDLE;
        const err = new Error(`hybrid session: write queue exceeded ${MAX_QUEUE_BYTES} bytes during re-key`);
        err.code = 'QUEUE_FULL';
        throw err;
      }
      this.writeQueue.push(data);
      return false;
    }
    this.socket.write(data);
    return true;
  }

  _queuedBytes() {
    let total = 0;
    for (const item of this.writeQueue) {
      total += Buffer.isBuffer(item) ? item.length : Buffer.byteLength(item);
    }
    return total;
  }

  _drainQueue() {
    while (this.writeQueue.length) {
      this.socket.write(this.writeQueue.shift());
    }
  }

  async rekey() {
    if (this.state === REKEY_STATES.REKEYING) return this.rootKey;
    if (!this.rootKey) throw new Error('hybrid session: no rootKey for re-key');

    this.state = REKEY_STATES.REKEYING;
    try {
      const result = this.initiator
        ? await rekeyAsInitiator(this.socket, this.rootKey, this.timeoutMs)
        : await rekeyAsResponder(this.socket, this.rootKey, this.timeoutMs);
      this.rootKey = result.newRoot;
      this.sessionKey = result.sessionKey;
      this.state = REKEY_STATES.ACTIVE;
      this._drainQueue();
      return this.rootKey;
    } catch (err) {
      this.state = REKEY_STATES.ACTIVE;
      throw err;
    }
  }

  destroy() {
    if (this.rekeyTimer) {
      clearInterval(this.rekeyTimer);
      this.rekeyTimer = null;
    }
    try {
      this.socket.destroy();
    } catch (e) {
      // ignore
    }
  }
}

// ── Resumption helpers (Track 9) ───────────────────────────────────────────

/**
 * Issue a resumption ticket after a successful full hybrid handshake.
 *
 * @param {object} params
 * @param {Buffer} params.sessionKey - session/root key from the handshake
 * @param {string} params.nodeId
 * @param {string} [params.sessionId] - defaults to crypto.randomUUID()
 * @param {Buffer} stek - 32-byte AES key
 * @param {Buffer} stekId - 16-byte STEK identifier
 * @returns {{ ticket: Buffer, nonce: Buffer, psk: Buffer }}
 */
function issueTicket({ sessionKey, nodeId, sessionId }, stek, stekId) {
  const sid = sessionId || crypto.randomUUID();
  return resumption.createTicket({ sessionId: sid, nodeId, prevRoot: sessionKey }, stek, stekId);
}

/**
 * Attempt a 0-RTT resumption on an inbound socket.
 *
 * Reads the first frame; if it is a RESUMPTION frame, validates the ticket.
 * On success, sends RESUMED and returns the PSK-derived session key.
 * On failure, sends RESUME_REJECT and returns resumed: false.
 *
 * @param {import('net').Socket} socket
 * @param {Map<string, Buffer> | function(Buffer): Buffer} stekById
 * @param {{ has: (Buffer) => boolean|Promise<boolean>, add: (Buffer, number) => void|Promise<void> }} bloomFilter
 * @param {number} [timeoutMs]
 * @returns {Promise<{resumed: boolean, sessionKey?: Buffer, sessionId?: string, nodeId?: string, reason?: string}>}
 */
async function tryResumption(socket, stekById, bloomFilter, timeoutMs = 15000) {
  const msg = await _readMessage(socket, timeoutMs);

  if (msg.type !== 'RESUMPTION' || typeof msg.ticket !== 'string') {
    return { resumed: false, reason: 'NOT_RESUMPTION' };
  }

  const ticket = Buffer.from(msg.ticket, 'base64');
  const result = resumption.validateTicket(ticket, stekById, bloomFilter);

  if (!result.valid) {
    _sendMessage(socket, { type: 'RESUME_REJECT', reason: result.reason });
    return { resumed: false, reason: result.reason };
  }

  _sendMessage(socket, { type: 'RESUMED', session_id: result.sessionId });
  return {
    resumed: true,
    sessionKey: result.psk,
    sessionId: result.sessionId,
    nodeId: result.nodeId,
  };
}

module.exports = {
  createClientHandshaker,
  createServerHandshaker,
  deriveSessionKey,
  deriveRekeyRoot,
  rekeyAsInitiator,
  rekeyAsResponder,
  issueTicket,
  tryResumption,
  HybridSession,
  REKEY_STATES,
  REKEY_INTERVAL_SEC,
  MAX_QUEUE_BYTES,
  HKDF_SALT,
  HKDF_INFO,
  SESSION_KEY_LEN,
  PFS_SALT,
  PFS_INFO,
};
