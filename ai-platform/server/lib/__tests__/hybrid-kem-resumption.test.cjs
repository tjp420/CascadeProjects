const {
  deriveResumptionPsk,
  generateStek,
  createTicket,
  validateTicket,
  createInMemoryBloomFilter,
} = require('../hybrid-kem-resumption.cjs');

describe('hybrid-kem-resumption', () => {
  test('deriveResumptionPsk is deterministic and returns 32 bytes', () => {
    const prevRoot = Buffer.alloc(32, 0x42);
    const p1 = deriveResumptionPsk(prevRoot, 'nodeA', 'sess-1');
    const p2 = deriveResumptionPsk(prevRoot, 'nodeA', 'sess-1');
    expect(p1.equals(p2)).toBe(true);
    expect(p1.length).toBe(32);
  });

  test('createTicket/validateTicket works and prevents replay', async () => {
    const prevRoot = Buffer.alloc(32, 0x42);
    const stekObj = generateStek();
    const { ticket } = createTicket({ sessionId: 'sess-1', nodeId: 'nodeA', prevRoot }, stekObj.stek, stekObj.stekId, 60000);

    // stekById map
    const stekById = new Map();
    stekById.set(stekObj.stekId.toString('hex'), stekObj.stek);

    const bloom = createInMemoryBloomFilter();

    const res1 = await validateTicket(ticket, stekById, bloom);
    expect(res1.valid).toBe(true);
    expect(res1.psk).toBeDefined();

    // Replay should be detected on second validation
    const res2 = await validateTicket(ticket, stekById, bloom);
    expect(res2.valid).toBe(false);
    expect(res2.reason).toBe('REPLAY');
  });

  test('expired ticket is rejected with EXPIRED', async () => {
    // Build a ticket with an old issuedAt by crafting the ciphertext
    const prevRoot = Buffer.alloc(32, 0x42);
    const stekObj = generateStek();
    const { ticket } = createTicket({ sessionId: 'sess-exp', nodeId: 'nodeX', prevRoot }, stekObj.stek, stekObj.stekId, 24 * 60 * 60 * 1000);

    // Parse header
    const HEADER_LENGTH = 1 + 16 + 12 + 4;
    const nonceBuf = ticket.slice(1 + 16, 1 + 16 + 12);
    const ciphertextLen = ticket.readUInt32BE(1 + 16 + 12);
    const ciphertext = ticket.slice(HEADER_LENGTH, HEADER_LENGTH + ciphertextLen);
    const tag = ticket.slice(HEADER_LENGTH + ciphertextLen);

    // Decrypt plaintext
    const crypto = require('crypto');
    const decipher = crypto.createDecipheriv('aes-256-gcm', stekObj.stek, nonceBuf);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const payload = JSON.parse(plaintext.toString('utf8'));

    // Set issuedAt to far past and re-encrypt
    payload.issuedAt = Date.now() - (10 * 24 * 60 * 60 * 1000); // 10 days ago
    const newPlain = Buffer.from(JSON.stringify(payload), 'utf8');
    const cipher = crypto.createCipheriv('aes-256-gcm', stekObj.stek, nonceBuf);
    const newCiphertext = Buffer.concat([cipher.update(newPlain), cipher.final()]);
    const newTag = cipher.getAuthTag();
    const newTicket = Buffer.concat([ticket.slice(0, HEADER_LENGTH), newCiphertext, newTag]);

    const stekById = new Map();
    stekById.set(stekObj.stekId.toString('hex'), stekObj.stek);

    const bloom = createInMemoryBloomFilter();
    const res = await validateTicket(newTicket, stekById, bloom);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('EXPIRED');
  });
});
'use strict';

const crypto = require('crypto');
const { EventEmitter } = require('events');
const resumption = require('../hybrid-kem-resumption.cjs');
const handshake = require('../hybrid-kem-handshake.cjs');

function createMockSocketPair() {
  const client = new EventEmitter();
  const server = new EventEmitter();
  client.write = (d) => { if (d) process.nextTick(() => server.emit('data', d)); return true; };
  server.write = (d) => { if (d) process.nextTick(() => client.emit('data', d)); return true; };
  client.destroy = () => {};
  server.destroy = () => {};
  return { clientSocket: client, serverSocket: server };
}

describe('hybrid-kem-resumption', () => {
  const { stek, stekId } = resumption.generateStek();
  const stekById = new Map([[stekId.toString('hex'), stek]]);

  test('L1: deriveResumptionPsk is deterministic', () => {
    const prevRoot = crypto.randomBytes(32);
    const psk1 = resumption.deriveResumptionPsk(prevRoot, 'node-A', 'sid-1');
    const psk2 = resumption.deriveResumptionPsk(prevRoot, 'node-A', 'sid-1');
    expect(psk1.length).toBe(32);
    expect(psk1.equals(psk2)).toBe(true);
  });

  test('L1: PSK differs when prevRoot, nodeId, or sessionId change', () => {
    const prevRoot = crypto.randomBytes(32);
    const base = resumption.deriveResumptionPsk(prevRoot, 'node-A', 'sid-1');
    const changedRoot = resumption.deriveResumptionPsk(crypto.randomBytes(32), 'node-A', 'sid-1');
    const changedNode = resumption.deriveResumptionPsk(prevRoot, 'node-B', 'sid-1');
    const changedSession = resumption.deriveResumptionPsk(prevRoot, 'node-A', 'sid-2');
    expect(base.equals(changedRoot)).toBe(false);
    expect(base.equals(changedNode)).toBe(false);
    expect(base.equals(changedSession)).toBe(false);
  });

  test('L1: STEK+GCM round-trip encrypts and decrypts ticket', async () => {
    const prevRoot = crypto.randomBytes(32);
    const bloom = resumption.createInMemoryBloomFilter();
    const { ticket } = resumption.createTicket(
      { sessionId: 'sid-1', nodeId: 'node-A', prevRoot },
      stek,
      stekId,
    );
    const result = await resumption.validateTicket(ticket, stekById, bloom);
    expect(result.valid).toBe(true);
    expect(result.psk.length).toBe(32);
    expect(result.sessionId).toBe('sid-1');
    expect(result.nodeId).toBe('node-A');
  });

  test('L2: expired ticket is rejected as EXPIRED', async () => {
    const prevRoot = crypto.randomBytes(32);
    const bloom = resumption.createInMemoryBloomFilter();
    const { ticket } = resumption.createTicket(
      { sessionId: 'sid-expired', nodeId: 'node-A', prevRoot },
      stek,
      stekId,
      1, // 1 ms TTL
    );
    await new Promise((r) => setTimeout(r, 20));
    const result = await resumption.validateTicket(ticket, stekById, bloom);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('EXPIRED');
  });

  test('L2: replayed ticket is rejected as REPLAY', async () => {
    const prevRoot = crypto.randomBytes(32);
    const bloom = resumption.createInMemoryBloomFilter();
    const { ticket } = resumption.createTicket(
      { sessionId: 'sid-replay', nodeId: 'node-A', prevRoot },
      stek,
      stekId,
    );
    const first = await resumption.validateTicket(ticket, stekById, bloom);
    expect(first.valid).toBe(true);
    const second = await resumption.validateTicket(ticket, stekById, bloom);
    expect(second.valid).toBe(false);
    expect(second.reason).toBe('REPLAY');
  });

  test('L2: corrupted ciphertext fails authentication', async () => {
    const prevRoot = crypto.randomBytes(32);
    const bloom = resumption.createInMemoryBloomFilter();
    const { ticket } = resumption.createTicket(
      { sessionId: 'sid-corrupt', nodeId: 'node-A', prevRoot },
      stek,
      stekId,
    );
    ticket[ticket.length - 1] ^= 0xff; // corrupt last byte (tag)
    const result = await resumption.validateTicket(ticket, stekById, bloom);
    expect(result.valid).toBe(false);
  });

  test('L3: 0-RTT resumption bypasses ML-KEM/ECDH via tryResumption', async () => {
    const prevRoot = crypto.randomBytes(32);
    const bloom = resumption.createInMemoryBloomFilter();
    const { ticket } = resumption.createTicket(
      { sessionId: 'sid-0rtt', nodeId: 'node-A', prevRoot },
      stek,
      stekId,
    );

    const { clientSocket, serverSocket } = createMockSocketPair();
    const server = handshake.tryResumption(serverSocket, stekById, bloom, 5000);

    const body = Buffer.from(JSON.stringify({
      type: 'RESUMPTION',
      ticket: ticket.toString('base64'),
    }), 'utf8');
    const header = Buffer.alloc(4);
    header.writeUInt32BE(body.length, 0);
    clientSocket.write(Buffer.concat([header, body]));

    const result = await server;
    expect(result.resumed).toBe(true);
    expect(result.sessionKey.length).toBe(32);
    expect(result.sessionId).toBe('sid-0rtt');
    expect(result.nodeId).toBe('node-A');
  });

  test('L3: tryResumption fail-closed when bloom filter errors', async () => {
    const prevRoot = crypto.randomBytes(32);
    const { ticket } = resumption.createTicket(
      { sessionId: 'sid-bloom-err', nodeId: 'node-A', prevRoot },
      stek,
      stekId,
    );

    const { clientSocket, serverSocket } = createMockSocketPair();
    const failingBloom = {
      has: () => { throw new Error('redis down'); },
      add: () => {},
    };

    const server = handshake.tryResumption(serverSocket, stekById, failingBloom, 5000);

    const body = Buffer.from(JSON.stringify({
      type: 'RESUMPTION',
      ticket: ticket.toString('base64'),
    }), 'utf8');
    const header = Buffer.alloc(4);
    header.writeUInt32BE(body.length, 0);
    clientSocket.write(Buffer.concat([header, body]));

    const result = await server;
    expect(result.resumed).toBe(false);
    expect(result.reason).toBe('BLOOM_FILTER_ERROR');
  });

  test('L3: issueTicket uses handshake sessionKey and returns valid ticket', async () => {
    const sessionKey = crypto.randomBytes(32);
    const { ticket } = handshake.issueTicket({
      sessionKey,
      nodeId: 'node-B',
      sessionId: 'sid-issued',
    }, stek, stekId);
    const bloom = resumption.createInMemoryBloomFilter();
    const result = await resumption.validateTicket(ticket, stekById, bloom);
    expect(result.valid).toBe(true);
    expect(result.sessionId).toBe('sid-issued');
  });
});
