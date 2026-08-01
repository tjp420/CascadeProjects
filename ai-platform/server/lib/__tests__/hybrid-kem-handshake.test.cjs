'use strict';

const { EventEmitter } = require('events');
const crypto = require('crypto');
const {
  deriveSessionKeyRing,
  createClientHandshaker,
  createServerHandshaker,
} = require('../hybrid-kem-handshake.cjs');

function createSocketPair() {
  const client = new EventEmitter();
  const server = new EventEmitter();
  client.write = (d) => { process.nextTick(() => server.emit('data', d)); return true; };
  server.write = (d) => { process.nextTick(() => client.emit('data', d)); return true; };
  return { client, server };
}

describe('hybrid-kem-handshake', () => {
  afterEach(() => {
    delete process.env.QUANTUM_DEGRADE_ALLOWED;
  });

  test('deriveSessionKeyRing returns a uniform 32-byte Buffer', async () => {
    const classic = crypto.randomBytes(32);
    const pq = crypto.randomBytes(32);
    const ring = await deriveSessionKeyRing(classic, pq);
    expect(Buffer.isBuffer(ring)).toBe(true);
    expect(ring.length).toBe(32);
  });

  test('client and server derive the same session keyring', async () => {
    const { client, server } = createSocketPair();
    const classic = crypto.randomBytes(32);

    const clientPromise = createClientHandshaker(client, {
      classicSecret: classic,
      timeoutMs: 5000,
    });
    const serverPromise = createServerHandshaker(server, {
      classicSecret: classic,
      timeoutMs: 5000,
    });

    const [clientKey, serverKey] = await Promise.all([clientPromise, serverPromise]);
    expect(clientKey.length).toBe(32);
    expect(serverKey.length).toBe(32);
    expect(clientKey.equals(serverKey)).toBe(true);
  });

  test('corrupted server ciphertext causes client handshake to fail', async () => {
    const { client, server } = createSocketPair();

    // Drive a fake server that ignores the client public key and
    // returns a random (invalid) ciphertext.
    const clientPromise = createClientHandshaker(client, { timeoutMs: 5000 });
    const serverPromise = (async () => {
      // Wait for clientHello
      let buffer = Buffer.alloc(0);
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 5000);
        const onData = (d) => {
          buffer = Buffer.concat([buffer, d]);
          if (buffer.length >= 4) {
            const len = buffer.readUInt32BE(0);
            if (buffer.length >= 4 + len) {
              clearTimeout(timer);
              server.removeListener('data', onData);
              resolve();
            }
          }
        };
        server.on('data', onData);
      });
      const response = {
        type: 'serverResponse',
        cipherText: crypto.randomBytes(1088).toString('base64'),
      };
      const payload = Buffer.from(JSON.stringify(response), 'utf8');
      const length = Buffer.alloc(4);
      length.writeUInt32BE(payload.length, 0);
      server.write(Buffer.concat([length, payload]));
    })();

    await expect(clientPromise).rejects.toThrow();
    await serverPromise.catch(() => {});
  });

  test('legacy node is rejected by default', async () => {
    const { client, server } = createSocketPair();
    const clientPromise = createClientHandshaker(client, {
      quantumCapable: false,
      timeoutMs: 5000,
    });
    const serverPromise = createServerHandshaker(server, { timeoutMs: 5000 });

    await expect(clientPromise).rejects.toThrow(/quantum_downgrade_rejected/);
    await expect(serverPromise).rejects.toThrow(/quantum_downgrade_rejected/);
  });

  test('legacy node is accepted when QUANTUM_DEGRADE_ALLOWED=1', async () => {
    process.env.QUANTUM_DEGRADE_ALLOWED = '1';
    const { client, server } = createSocketPair();
    const classic = crypto.randomBytes(32);

    const clientPromise = createClientHandshaker(client, {
      quantumCapable: false,
      classicSecret: classic,
      timeoutMs: 5000,
    });
    const serverPromise = createServerHandshaker(server, {
      classicSecret: classic,
      timeoutMs: 5000,
    });

    const [clientKey, serverKey] = await Promise.all([clientPromise, serverPromise]);
    expect(clientKey.length).toBe(32);
    expect(serverKey.length).toBe(32);
    expect(clientKey.equals(serverKey)).toBe(true);
  });
});
