"use strict";

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

const crypto = require("crypto");

const TICKET_VERSION = 0x01;
const TAG_LENGTH = 16;
const NONCE_LENGTH = 12;
const STEK_ID_LENGTH = 16;
const HEADER_LENGTH = 1 + STEK_ID_LENGTH + NONCE_LENGTH + 4;
const TTL_DEFAULT_MS = 10 * 60 * 1000;
const PSK_INFO = "resumption:psk";
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
    throw new Error("resumption: prevRoot must be a 32-byte Buffer");
  }
  const ikm = Buffer.from(PSK_INFO, "utf8");
  const info = Buffer.concat([
    Buffer.from(nodeId, "utf8"),
    Buffer.from(sessionId, "utf8"),
  ]);
  return Buffer.from(
    crypto.hkdfSync("sha256", ikm, prevRoot, info, PSK_LENGTH),
  );
}

/**
 * Generate a new 32-byte STEK and a 16-byte STEK identifier.
 * @returns {{ stek: Buffer, stekId: Buffer }}
 */
function generateStek() {
  return {
    stek: crypto.randomBytes(32),
    stekId: crypto.randomBytes(STEK_ID_LENGTH),
  };
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
    throw new Error("resumption: stek must be a 32-byte Buffer");
  }
  if (!Buffer.isBuffer(stekId) || stekId.length !== STEK_ID_LENGTH) {
    throw new Error("resumption: stekId must be a 16-byte Buffer");
  }

  const psk = deriveResumptionPsk(prevRoot, nodeId, sessionId);
  const issuedAt = Date.now();
  const nonce = crypto.randomBytes(NONCE_LENGTH);

  const plaintext = Buffer.from(
    JSON.stringify({
      sessionId,
      nodeId,
      issuedAt,
      ttlMs: ttlMs || TTL_DEFAULT_MS,
      psk: psk.toString("base64"),
    }),
    "utf8",
  );

  const cipher = crypto.createCipheriv("aes-256-gcm", stek, nonce);
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
    return { valid: false, reason: "MALFORMED" };
  }

  if (ticket[0] !== TICKET_VERSION) {
    return { valid: false, reason: "VERSION" };
  }

  const stekId = ticket.slice(1, 1 + STEK_ID_LENGTH);
  const nonce = ticket.slice(
    1 + STEK_ID_LENGTH,
    1 + STEK_ID_LENGTH + NONCE_LENGTH,
  );
  const ciphertextLen = ticket.readUInt32BE(1 + STEK_ID_LENGTH + NONCE_LENGTH);

  if (ticket.length !== HEADER_LENGTH + ciphertextLen + TAG_LENGTH) {
    return { valid: false, reason: "MALFORMED" };
  }

  let stek;
  if (stekById instanceof Map) {
    stek = stekById.get(stekId.toString("hex"));
  } else if (typeof stekById === "function") {
    stek = stekById(stekId);
  } else if (stekById && typeof stekById.get === "function") {
    stek = stekById.get(stekId.toString("hex"));
  }

  if (!Buffer.isBuffer(stek) || stek.length !== 32) {
    return { valid: false, reason: "STEK_UNKNOWN" };
  }

  const ciphertext = ticket.slice(HEADER_LENGTH, HEADER_LENGTH + ciphertextLen);
  const tag = ticket.slice(HEADER_LENGTH + ciphertextLen);

  let payload;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", stek, nonce);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    payload = JSON.parse(plaintext.toString("utf8"));
  } catch (err) {
    return { valid: false, reason: err.message || "DECRYPT" };
  }

  if (
    typeof payload.issuedAt !== "number" ||
    typeof payload.ttlMs !== "number"
  ) {
    return { valid: false, reason: "MALFORMED" };
  }

  if (Date.now() - payload.issuedAt > payload.ttlMs) {
    return { valid: false, reason: "EXPIRED" };
  }

  const nonceUsed = bloomFilter.has ? await bloomFilter.has(nonce) : false;
  if (nonceUsed) {
    return { valid: false, reason: "REPLAY" };
  }

  const psk = Buffer.from(payload.psk, "base64");
  if (psk.length !== PSK_LENGTH) {
    return { valid: false, reason: "MALFORMED" };
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
    has: (nonce) => nonces.has(nonce.toString("hex")),
    add: (nonce) => nonces.add(nonce.toString("hex")),
  };
}

/**
 * Redis-backed nonce set using exact SADD/SISMEMBER semantics.
 * @param {object} redis
 * @returns {{ has: (Buffer) => Promise<boolean>, add: (Buffer, number) => Promise<void> }}
 */
async function createRedisBloomFilter(redis) {
  const key = "hybrid:ticket-nonces";
  // Compatibility wrapper for command invocation across clients
  function sendCmd(parts) {
    if (typeof redis.sendCommand === "function")
      return redis.sendCommand(parts);
    if (typeof redis.executeCommand === "function")
      return redis.executeCommand(parts);
    if (typeof redis.call === "function") {
      const cmd = parts[0];
      const args = parts.slice(1);
      return redis.call(cmd, ...args);
    }
    throw new Error("redis client does not support command invocation");
  }

  // Probe for RedisBloom module using BF.INFO; fallback to set semantics
  try {
    await sendCmd(["BF.INFO", key]);
    return {
      type: "bloom",
      has: async (nonce) => {
        const res = await sendCmd(["BF.EXISTS", key, nonce.toString("hex")]);
        // RedisBloom returns 1/0
        return res === 1 || res === true;
      },
      add: async (nonce, ttlMs) => {
        await sendCmd(["BF.ADD", key, nonce.toString("hex")]);
        if (ttlMs) {
          if (typeof redis.pExpire === "function") {
            await redis.pExpire(key, ttlMs);
          } else if (typeof redis.pexpire === "function") {
            await redis.pexpire(key, ttlMs);
          } else {
            await sendCmd(["PEXPIRE", key, String(ttlMs)]);
          }
        }
      },
    };
  } catch (err) {
    console.error("hybrid-kem-resumption.cjs error:", err);
    // Fallback to plain Redis Set semantics
    return {
      type: "set",
      has: async (nonce) => {
        const member = nonce.toString("hex");
        // Support multiple redis client method namings (ioredis, node-redis, redis-mock)
        if (typeof redis.sIsMember === "function") {
          const res = await redis.sIsMember(key, member);
          return res === 1 || res === true;
        }
        if (typeof redis.sismember === "function") {
          const res = await redis.sismember(key, member);
          return res === 1 || res === true;
        }
        try {
          const res = await sendCmd(["SISMEMBER", key, member]);
          return res === 1 || res === true;
        } catch (e) {
          console.error("hybrid-kem-resumption.cjs error:", e);
          // fall through to raw RESP fallback below
        }
        // Fallback: attempt a raw TCP RESP call to local Redis instance
        try {
          const host =
            redis &&
            redis.options &&
            redis.options.url &&
            redis.options.url.includes("://")
              ? null
              : null;
          const res = await rawRedisIntegerCommand("127.0.0.1", 6379, [
            "SISMEMBER",
            key,
            member,
          ]);
          return res === 1 || res === true;
        } catch (e) {
          throw new Error("redis client does not support SISMEMBER");
        }
      },
      add: async (nonce, ttlMs) => {
        const member = nonce.toString("hex");
        if (typeof redis.sAdd === "function") {
          await redis.sAdd(key, member);
        } else if (typeof redis.sadd === "function") {
          await redis.sadd(key, member);
        } else {
          try {
            await sendCmd(["SADD", key, member]);
          } catch (e) {
            console.error("hybrid-kem-resumption.cjs error:", e);
            // Fallback to raw TCP RESP SADD
            try {
              await rawRedisIntegerCommand("127.0.0.1", 6379, [
                "SADD",
                key,
                member,
              ]);
            } catch (e2) {
              throw new Error("redis client does not support SADD");
            }
          }
        }
        if (ttlMs) {
          if (typeof redis.pExpire === "function") {
            await redis.pExpire(key, ttlMs);
          } else if (typeof redis.pexpire === "function") {
            await redis.pexpire(key, ttlMs);
          } else {
            try {
              await sendCmd(["PEXPIRE", key, String(ttlMs)]);
            } catch (e) {
              console.error(
                "hybrid-kem-resumption.cjs error:",
                e,
              ); /* best-effort */
            }
          }
        }
      },
    };
  }
}

// Minimal RESP client helper for integer-returning commands (SISMEMBER, SADD, PEXPIRE)
const net = require("net");
function rawRedisIntegerCommand(host, port, parts, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(port, host, () => {
      // Build RESP array
      let cmd = `*${parts.length}\r\n`;
      for (const p of parts) {
        const s = String(p);
        cmd += `$${Buffer.byteLength(s)}\r\n${s}\r\n`;
      }
      socket.write(cmd);
    });
    let data = "";
    const onData = (chunk) => {
      data += chunk.toString("utf8");
      if (data.includes("\r\n")) finish();
    };
    const finish = () => {
      try {
        // Simple integer reply parsing
        if (data[0] === ":") {
          const m = data.match(/^:(-?\d+)\r\n/);
          if (m) return resolve(Number(m[1]));
        }
        // Simple OK or +OK
        if (data.startsWith("+")) return resolve(1);
        reject(new Error("unexpected redis reply: " + data));
      } finally {
        socket.removeListener("data", onData);
        socket.destroy();
      }
    };
    socket.on("data", onData);
    socket.on("error", (err) => {
      socket.destroy();
      reject(err);
    });
    socket.setTimeout(timeout, () => {
      socket.destroy();
      reject(new Error("redis raw command timeout"));
    });
  });
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
  if (!redis)
    throw new Error("redis client required for validateTicketWithRedis");
  const bloom = await createRedisBloomFilter(redis);
  return validateTicket(ticket, stekById, bloom);
}

module.exports = {
  deriveResumptionPsk,
  generateStek,
  createTicket,
  validateTicket,
  validateTicketWithRedis,
  createInMemoryBloomFilter,
  createRedisBloomFilter,
  TTL_DEFAULT_MS,
  PSK_INFO,
  PSK_LENGTH,
};
