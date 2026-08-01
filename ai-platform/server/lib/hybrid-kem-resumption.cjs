'use strict';

/**
 * Track 9: Post-quantum 0-RTT session resumption.
 *
 * Resumption tickets are AES-256-GCM envelopes protected by an STEK.
 * The plaintext PSK is derived from the prior hybrid KEM root key via
 * HKDF-SHA256, giving it quantum-resistant lineage. Anti-replay is enforced
 * by a distributed nonce set (Redis-backed or in-memory) and a strict TTL.
 *
 * @module hybrid-kem-resumption
 */

const crypto = require('crypto');

const TICKET_VERSION = 0x01;
const TAG_LENGTH = 16;
const NONCE_LENGTH = 12;
const STEK_ID_LENGTH = 16;
const HEADER_LENGTH = 1 + STEK_ID_LENGTH + NONCE_LENGTH + 4;
const TTL_DEFAULT_MS = 10 * 60 * 1000;
const PSK_INFO = 'resumption:psk';
const PSK_LENGTH = 32;

/**
 * Derive a resumption PSK from the prior hybrid root.
 *
 * PSK = HKDF-SHA256(salt=prevRoot, IKM="resumption:psk", info=nodeId || sessionId)
 *
 * @param {Buffer} prevRoot
 * @param {string} nodeId
 * @param {string} sessionId
 * @returns {Buffer}
 */
function deriveResumptionPsk(prevRoot, nodeId, sessionId) {
  if (!Buffer.isBuffer(prevRoot) || prevRoot.length !== 32) {
    throw new Error('resumption: prevRoot must be a 32-byte Buffer');
  }
  const ikm = Buffer.from(PSK_INFO, 'utf8');
  const info = Buffer.concat([Buffer.from(nodeId, 'utf8'), Buffer.from(sessionId, 'utf8')]);
  return Buffer.from(crypto.hkdfSync('sha256', ikm, prevRoot, info, PSK_LENGTH));
}

/**
 * Generate a new 32-byte STEK and a 16-byte STEK identifier.
 * @returns {{ stek: Buffer, stekId: Buffer }}
 */
function generateStek() {
  return { stek: crypto.randomBytes(32), stekId: crypto.randomBytes(STEK_ID_LENGTH) };
}

/**
 * Create an AES-256-GCM resumption ticket.
 *
 * @param {object} params
 * @param {string} params.sessionId
 * @param {string} params.nodeId
 * @param {Buffer} params.prevRoot
 * @param {Buffer} stek
 * @param {Buffer} stekId
 * @param {number} [ttlMs]
 * @returns {{ ticket: Buffer, nonce: Buffer, psk: Buffer }}
 */
function createTicket({ sessionId, nodeId, prevRoot }, stek, stekId, ttlMs) {
  if (!Buffer.isBuffer(stek) || stek.length !== 32) {
    throw new Error('resumption: stek must be a 32-byte Buffer');
  }
  if (!Buffer.isBuffer(stekId) || stekId.length !== STEK_ID_LENGTH) {
    throw new Error('resumption: stekId must be a 16-byte Buffer');
  }

  const psk = deriveResumptionPsk(prevRoot, nodeId, sessionId);
  const issuedAt = Date.now();
  const nonce = crypto.randomBytes(NONCE_LENGTH);

  const plaintext = Buffer.from(JSON.stringify({
    sessionId,
    nodeId,
    issuedAt,
    ttlMs: ttlMs || TTL_DEFAULT_MS,
    psk: psk.toString('base64'),
  }), 'utf8');

  const cipher = crypto.createCipheriv('aes-256-gcm', stek, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  const header = Buffer.alloc(HEADER_LENGTH);
  header[0] = TICKET_VERSION;
  stekId.copy(header, 1);
  nonce.copy(header, 1 + STEK_ID_LENGTH);
  header.writeUInt32BE(ciphertext.length, 1 + STEK_ID_LENGTH + NONCE_LENGTH);

  return {
    ticket: Buffer.concat([header, ciphertext, tag]),
    nonce,
    psk,
  };
}

/**
 * Validate a resumption ticket.
 *
 * @param {Buffer} ticket
 * @param {Map<string, Buffer> | function(Buffer): Buffer | undefined} stekById
 * @param {{ has: (Buffer) => boolean | Promise<boolean>, add: (Buffer, number) => void | Promise<void> }} bloomFilter
 * @returns {{ valid: boolean, reason?: string, psk?: Buffer, sessionId?: string, nodeId?: string, issuedAt?: number }}
 */
async function validateTicket(ticket, stekById, bloomFilter) {
  if (!Buffer.isBuffer(ticket) || ticket.length < HEADER_LENGTH + TAG_LENGTH) {
    return { valid: false, reason: 'MALFORMED' };
  }

  if (ticket[0] !== TICKET_VERSION) {
    return { valid: false, reason: 'VERSION' };
  }

  const stekId = ticket.slice(1, 1 + STEK_ID_LENGTH);
  const nonce = ticket.slice(1 + STEK_ID_LENGTH, 1 + STEK_ID_LENGTH + NONCE_LENGTH);
  const ciphertextLen = ticket.readUInt32BE(1 + STEK_ID_LENGTH + NONCE_LENGTH);

  if (ticket.length !== HEADER_LENGTH + ciphertextLen + TAG_LENGTH) {
    return { valid: false, reason: 'MALFORMED' };
  }

  let stek;
  if (stekById instanceof Map) {
    stek = stekById.get(stekId.toString('hex'));
  } else if (typeof stekById === 'function') {
    stek = stekById(stekId);
  } else if (stekById && typeof stekById.get === 'function') {
    stek = stekById.get(stekId.toString('hex'));
  }

  if (!Buffer.isBuffer(stek) || stek.length !== 32) {
    return { valid: false, reason: 'STEK_UNKNOWN' };
  }

  const ciphertext = ticket.slice(HEADER_LENGTH, HEADER_LENGTH + ciphertextLen);
  const tag = ticket.slice(HEADER_LENGTH + ciphertextLen);

  let payload;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', stek, nonce);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    payload = JSON.parse(plaintext.toString('utf8'));
  } catch (err) {
    return { valid: false, reason: err.message || 'DECRYPT' };
  }

  if (typeof payload.issuedAt !== 'number' || typeof payload.ttlMs !== 'number') {
    return { valid: false, reason: 'MALFORMED' };
  }

  if (Date.now() - payload.issuedAt > payload.ttlMs) {
    return { valid: false, reason: 'EXPIRED' };
  }

  const nonceUsed = bloomFilter.has ? await bloomFilter.has(nonce) : false;
  if (nonceUsed) {
    return { valid: false, reason: 'REPLAY' };
  }

  const psk = Buffer.from(payload.psk, 'base64');
  if (psk.length !== PSK_LENGTH) {
    return { valid: false, reason: 'MALFORMED' };
  }

  if (bloomFilter.add) {
    await bloomFilter.add(nonce, payload.ttlMs);
  }

  return {
    valid: true,
    psk,
    sessionId: payload.sessionId,
    nodeId: payload.nodeId,
    issuedAt: payload.issuedAt,
  };
}

/**
 * In-memory nonce set for tests or single-node deployments.
 * @returns {{ has: (Buffer) => boolean, add: (Buffer, number) => void }}
 */
function createInMemoryBloomFilter() {
  const nonces = new Set();
  return {
    has: (nonce) => nonces.has(nonce.toString('hex')),
    add: (nonce) => nonces.add(nonce.toString('hex')),
  };
}

/**
 * Redis-backed nonce set using exact SADD/SISMEMBER semantics.
 * @param {object} redis
 * @returns {{ has: (Buffer) => Promise<boolean>, add: (Buffer, number) => Promise<void> }}
 */
async function createRedisBloomFilter(redis) {
  const key = 'hybrid:ticket-nonces';
  // Probe for RedisBloom module using BF.INFO; fallback to set semantics
  try {
    // If BF.INFO exists the module is available; use BF.ADD/BF.EXISTS
    await redis.sendCommand(['BF.INFO', key]);
    return {
      type: 'bloom',
      has: async (nonce) => {
        const res = await redis.sendCommand(['BF.EXISTS', key, nonce.toString('hex')]);
        // RedisBloom returns 1/0
        return res === 1 || res === true;
      },
      add: async (nonce, ttlMs) => {
        await redis.sendCommand(['BF.ADD', key, nonce.toString('hex')]);
        if (ttlMs) await redis.pExpire(key, ttlMs);
      },
    };
  } catch (err) {
    // Fallback to plain Redis Set semantics
    return {
      type: 'set',
      has: async (nonce) => {
        const res = await redis.sIsMember(key, nonce.toString('hex'));
        return res === 1 || res === true;
      },
      add: async (nonce, ttlMs) => {
        await redis.sAdd(key, nonce.toString('hex'));
        if (ttlMs) await redis.pExpire(key, ttlMs);
      },
    };
  }
}

/**
 * Helper to validate a ticket using a redis client instance.
 * Creates a Redis-backed nonce set and delegates to `validateTicket`.
 * @param {Buffer} ticket
 * @param {Map|string|function} stekById
 * @param {object} redis Redis client compatible with `sadd`, `sismember`, `pexpire`
 * @returns {Promise<object>} result of validateTicket
 */
async function validateTicketWithRedis(ticket, stekById, redis) {
  if (!redis) throw new Error('redis client required for validateTicketWithRedis');
  const bloom = await createRedisBloomFilter(redis);
  return validateTicket(ticket, stekById, bloom);
}

module.exports = {
  deriveResumptionPsk,
  generateStek,
  createTicket,
  validateTicket,
  createInMemoryBloomFilter,
  createRedisBloomFilter,
  TTL_DEFAULT_MS,
  PSK_INFO,
  PSK_LENGTH,
};

// Export helper that integrates redis-backed nonce set
module.exports.validateTicketWithRedis = validateTicketWithRedis;
