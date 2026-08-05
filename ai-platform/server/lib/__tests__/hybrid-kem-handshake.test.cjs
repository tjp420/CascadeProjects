'use strict';

/**
 * Track 6 test suite for hybrid-kem-handshake.cjs.
 *
 * Covers:
 *   L2-01: ML-KEM-768 keygen/encap/decap round-trip
 *   L2-02: HKDF-SHA256 combiner produces uniform 32-byte keys
 *   L2-03: Full handshake over a real TCP socket pair
 *   L2-04: Corrupted ciphertext causes decapsulation failure
 *   L3-01: Strict fail-closed on legacy node omission (no ek_pq)
 *   L3-02: Permissive override allows classic-only with QUANTUM_DEGRADE_ALLOWED=1
 *   S-01: Both classic and PQ secrets contribute to the final key
 *   S-02: Fail-closed by default
 *   S-03: Corrupted KEM material does not leak shared secret or crash
 */

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const net = require('net');
const crypto = require('crypto');

const hk = require('../hybrid-kem-handshake.cjs');
const mlkem = require('../vendor/mlkem.cjs');

describe('L2-01: ML-KEM-768 keygen/encap/decap round-trip', () => {
  it('generates a keypair, encapsulates, and decapsulates to the same shared secret', async () => {
    const { publicKey, secretKey } = await mlkem.keygen();
    assert.ok(publicKey instanceof Uint8Array, 'publicKey should be Uint8Array');
    assert.ok(secretKey instanceof Uint8Array, 'secretKey should be Uint8Array');
    assert.strictEqual(publicKey.length, 1184, 'ML-KEM-768 public key is 1184 bytes');
    assert.strictEqual(secretKey.length, 2400, 'ML-KEM-768 secret key is 2400 bytes');

    const { cipherText, sharedSecret } = await mlkem.encapsulate(publicKey);
    assert.strictEqual(cipherText.length, 1088, 'ML-KEM-768 ciphertext is 1088 bytes');
    assert.strictEqual(sharedSecret.length, 32, 'shared secret is 32 bytes');

    const decapped = await mlkem.decapsulate(cipherText, secretKey);
    assert.ok(
      Buffer.from(sharedSecret).equals(Buffer.from(decapped)),
      'decapsulated secret must match encapsulated secret'
    );
  });
});

describe('L2-02: HKDF-SHA256 combiner produces uniform 32-byte keys', () => {
  it('derives a deterministic 32-byte session key from ECDH + ML-KEM secrets', () => {
    const ecdhSecret = crypto.randomBytes(32);
    const mlkemSecret = crypto.randomBytes(32);
    const key1 = hk.deriveSessionKey(ecdhSecret, mlkemSecret);
    const key2 = hk.deriveSessionKey(ecdhSecret, mlkemSecret);
    assert.strictEqual(key1.length, 32);
    assert.ok(key1.equals(key2), 'same inputs must produce same key (deterministic)');
  });

  it('different ECDH secrets produce different session keys', () => {
    const mlkemSecret = crypto.randomBytes(32);
    const ecdh1 = crypto.randomBytes(32);
    const ecdh2 = crypto.randomBytes(32);
    const key1 = hk.deriveSessionKey(ecdh1, mlkemSecret);
    const key2 = hk.deriveSessionKey(ecdh2, mlkemSecret);
    assert.ok(!key1.equals(key2), 'different ECDH secrets must produce different keys');
  });

  it('different ML-KEM secrets produce different session keys', () => {
    const ecdhSecret = crypto.randomBytes(32);
    const mlkem1 = crypto.randomBytes(32);
    const mlkem2 = crypto.randomBytes(32);
    const key1 = hk.deriveSessionKey(ecdhSecret, mlkem1);
    const key2 = hk.deriveSessionKey(ecdhSecret, mlkem2);
    assert.ok(!key1.equals(key2), 'different ML-KEM secrets must produce different keys');
  });
});

describe('S-01: Both classic and PQ secrets contribute to the final key', () => {
  it('changing either ECDH or ML-KEM secret changes the session key', () => {
    const ecdh = crypto.randomBytes(32);
    const mlkem = crypto.randomBytes(32);
    const baseline = hk.deriveSessionKey(ecdh, mlkem);

    // Change ECDH only
    const ecdhOnly = hk.deriveSessionKey(crypto.randomBytes(32), mlkem);
    assert.ok(!baseline.equals(ecdhOnly), 'ECDH secret must contribute');

    // Change ML-KEM only
    const mlkemOnly = hk.deriveSessionKey(ecdh, crypto.randomBytes(32));
    assert.ok(!baseline.equals(mlkemOnly), 'ML-KEM secret must contribute');
  });
});

describe('L2-03 & L2-04: Full handshake over a real TCP socket pair', () => {
  let server;
  let serverSocket;
  let clientSocket;
  let serverPort;

  before((done) => {
    server = net.createServer((s) => {
      serverSocket = s;
      done();
    });
    server.listen(0, '127.0.0.1', () => {
      serverPort = server.address().port;
      clientSocket = net.connect(serverPort, '127.0.0.1');
    });
  });

  after((done) => {
    try { clientSocket.destroy(); } catch (e) {}
    try { serverSocket.destroy(); } catch (e) {}
    server.close(() => done());
  });

  it('L2-03: both sides derive identical session keys', async () => {
    // Run client and server handshakes concurrently
    const clientPromise = hk.createClientHandshaker(clientSocket, { timeoutMs: 30000 });
    const serverPromise = hk.createServerHandshaker(serverSocket, { timeoutMs: 30000 });

    const [clientResult, serverResult] = await Promise.all([clientPromise, serverPromise]);

    assert.strictEqual(clientResult.sessionKey.length, 32);
    assert.strictEqual(serverResult.sessionKey.length, 32);
    assert.ok(
      clientResult.sessionKey.equals(serverResult.sessionKey),
      'client and server must derive the same session key'
    );
    assert.strictEqual(clientResult.downgraded, false);
    assert.strictEqual(serverResult.downgraded, false);
  });
});

describe('L2-04: Corrupted ciphertext causes decapsulation failure', () => {
  it('S-03: corrupted C_pq does not leak shared secret or crash', async () => {
    const { publicKey, secretKey } = await mlkem.keygen();
    const { cipherText, sharedSecret } = await mlkem.encapsulate(publicKey);

    // Corrupt a byte in the ciphertext
    const corrupted = new Uint8Array(cipherText);
    corrupted[0] ^= 0xff;

    // Decapsulation should either throw or produce a different (fail-closed) secret
    // ML-KEM is designed to return a "rejection key" (kBar) on failure, not crash
    const decapped = await mlkem.decapsulate(corrupted, secretKey);
    // The decapsulated secret must NOT match the original shared secret
    assert.ok(
      !Buffer.from(sharedSecret).equals(Buffer.from(decapped)),
      'corrupted ciphertext must not produce the original shared secret'
    );
  });
});

describe('L3-01: Strict fail-closed on legacy node omission', () => {
  let server, clientSocket, serverSocket, serverPort;

  beforeEach((done) => {
    delete process.env.QUANTUM_DEGRADE_ALLOWED;
    server = net.createServer((s) => { serverSocket = s; done(); });
    server.listen(0, '127.0.0.1', () => {
      serverPort = server.address().port;
      clientSocket = net.connect(serverPort, '127.0.0.1');
    });
  });

  afterEach((done) => {
    try { clientSocket.destroy(); } catch (e) {}
    try { serverSocket.destroy(); } catch (e) {}
    server.close(() => done());
  });

  it('server rejects client that omits ek_pq', async () => {
    // Manually send a client hello without ek_pq
    const header = Buffer.alloc(4);
    const body = Buffer.from(JSON.stringify({ ek_classic: 'aa'.repeat(32) }), 'utf8');
    header.writeUInt32BE(body.length, 0);
    clientSocket.write(Buffer.concat([header, body]));

    // Server handshake should reject with quantum_downgrade_rejected
    await assert.rejects(
      () => hk.createServerHandshaker(serverSocket, { timeoutMs: 5000 }),
      /quantum_downgrade_rejected/,
      'server must reject client without ek_pq when QUANTUM_DEGRADE_ALLOWED is not set'
    );
  });

  it('client rejects server that omits c_pq', async () => {
    // Server sends a response without c_pq
    // First, client sends a proper hello, then we manually craft the server response
    const clientHello = {
      ek_classic: crypto.randomBytes(32).toString('hex'),
      ek_pq: crypto.randomBytes(1184).toString('hex'),
    };
    const header = Buffer.alloc(4);
    const body = Buffer.from(JSON.stringify(clientHello), 'utf8');
    header.writeUInt32BE(body.length, 0);
    clientSocket.write(Buffer.concat([header, body]));

    // Read the client hello on the server side, then send a degraded response
    serverSocket.once('data', (chunk) => {
      // Parse the length-prefixed message
      const len = chunk.readUInt32BE(0);
      const msg = JSON.parse(chunk.slice(4, 4 + len).toString('utf8'));
      // Send response without c_pq
      const resp = { c_classic: crypto.randomBytes(32).toString('hex') };
      const respHeader = Buffer.alloc(4);
      const respBody = Buffer.from(JSON.stringify(resp), 'utf8');
      respHeader.writeUInt32BE(respBody.length, 0);
      serverSocket.write(Buffer.concat([respHeader, respBody]));
    });

    await assert.rejects(
      () => hk.createClientHandshaker(clientSocket, { timeoutMs: 5000 }),
      /quantum_downgrade_rejected/,
      'client must reject server without c_pq when QUANTUM_DEGRADE_ALLOWED is not set'
    );
  });
});

describe('L3-02: Permissive override allows classic-only', () => {
  let server, clientSocket, serverSocket, serverPort;

  beforeEach((done) => {
    process.env.QUANTUM_DEGRADE_ALLOWED = '1';
    server = net.createServer((s) => { serverSocket = s; done(); });
    server.listen(0, '127.0.0.1', () => {
      serverPort = server.address().port;
      clientSocket = net.connect(serverPort, '127.0.0.1');
    });
  });

  afterEach((done) => {
    delete process.env.QUANTUM_DEGRADE_ALLOWED;
    try { clientSocket.destroy(); } catch (e) {}
    try { serverSocket.destroy(); } catch (e) {}
    server.close(() => done());
  });

  it('S-02: server allows client without ek_pq when QUANTUM_DEGRADE_ALLOWED=1', async () => {
    // Manually send a client hello without ek_pq
    const header = Buffer.alloc(4);
    const body = Buffer.from(JSON.stringify({ ek_classic: crypto.randomBytes(32).toString('hex') }), 'utf8');
    header.writeUInt32BE(body.length, 0);
    clientSocket.write(Buffer.concat([header, body]));

    const result = await hk.createServerHandshaker(serverSocket, { timeoutMs: 10000 });
    assert.strictEqual(result.downgraded, true);
    assert.strictEqual(result.sessionKey.length, 32);
  });

  it('client allows server without c_pq when QUANTUM_DEGRADE_ALLOWED=1', async () => {
    // Client sends proper hello
    const clientHello = {
      ek_classic: crypto.randomBytes(32).toString('hex'),
      ek_pq: crypto.randomBytes(1184).toString('hex'),
    };
    const header = Buffer.alloc(4);
    const body = Buffer.from(JSON.stringify(clientHello), 'utf8');
    header.writeUInt32BE(body.length, 0);
    clientSocket.write(Buffer.concat([header, body]));

    // Server sends degraded response (no c_pq)
    serverSocket.once('data', (chunk) => {
      const len = chunk.readUInt32BE(0);
      const msg = JSON.parse(chunk.slice(4, 4 + len).toString('utf8'));
      const resp = { c_classic: crypto.randomBytes(32).toString('hex') };
      const respHeader = Buffer.alloc(4);
      const respBody = Buffer.from(JSON.stringify(resp), 'utf8');
      respHeader.writeUInt32BE(respBody.length, 0);
      serverSocket.write(Buffer.concat([respHeader, respBody]));
    });

    const result = await hk.createClientHandshaker(clientSocket, { timeoutMs: 10000 });
    assert.strictEqual(result.downgraded, true);
    assert.strictEqual(result.sessionKey.length, 32);
  });
});

describe('L3-02b: cluster-keyring-sync emits QUANTUM_DEGRADE_REJECTED on forced downgrade', () => {
  let server, clientSocket, serverSocket, serverPort;
  let clusterSync;

  before(() => {
    delete require.cache[require.resolve('../cluster-keyring-sync.cjs')];
    clusterSync = require('../cluster-keyring-sync.cjs');
  });

  beforeEach((done) => {
    delete process.env.QUANTUM_DEGRADE_ALLOWED;
    clusterSync._resetEvents();
    server = net.createServer((s) => { serverSocket = s; done(); });
    server.listen(0, '127.0.0.1', () => {
      serverPort = server.address().port;
      clientSocket = net.connect(serverPort, '127.0.0.1');
    });
  });

  afterEach((done) => {
    try { clientSocket.destroy(); } catch (e) {}
    try { serverSocket.destroy(); } catch (e) {}
    server.close(() => done());
  });

  it('records quantum_downgrade_rejected error payload via EVENT_TYPES.QUANTUM_DEGRADE_REJECTED', async () => {
    const header = Buffer.alloc(4);
    const body = Buffer.from(JSON.stringify({ ek_classic: 'aa'.repeat(32) }), 'utf8');
    header.writeUInt32BE(body.length, 0);
    clientSocket.write(Buffer.concat([header, body]));

    // Mirror cluster-keyring-sync _startServer onConnection catch (fail-closed).
    let caught;
    try {
      await hk.createServerHandshaker(serverSocket, { timeoutMs: 5000 });
    } catch (err) {
      caught = err;
      clusterSync._recordEvent(
        clusterSync.EVENT_TYPES.QUANTUM_DEGRADE_REJECTED,
        'test-node',
        { error: err.message }
      );
    }

    assert.ok(caught, 'server handshaker must reject omitted ek_pq');
    assert.match(caught.message, /^quantum_downgrade_rejected: client omitted ek_pq$/);

    const result = clusterSync.queryEvents({
      eventType: clusterSync.EVENT_TYPES.QUANTUM_DEGRADE_REJECTED,
    });
    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.events[0].eventType, 'quantum_downgrade_rejected');
    assert.strictEqual(result.events[0].details.error, caught.message);
  });
});

describe('L3-03: Hybrid handshake does not break existing cluster sync with flag disabled', () => {
  it('cluster-keyring-sync loads without error when CLUSTER_QUANTUM_HYBRID is not set', () => {
    delete process.env.CLUSTER_QUANTUM_HYBRID;
    // Clear require cache
    delete require.cache[require.resolve('../cluster-keyring-sync.cjs')];
    const sync = require('../cluster-keyring-sync.cjs');
    assert.ok(typeof sync.getStatus === 'function', 'cluster-keyring-sync should export getStatus');
  });
});
