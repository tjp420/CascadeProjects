"use strict";

const crypto = require("crypto");
const MerkleReassembler = require("./merkle-reassembler.cjs");

class UploadSession {
  constructor(opts = {}) {
    this.sessions = new Map();
    this.inactiveTimeoutMs = opts.inactiveTimeoutMs || 15 * 60 * 1000; // 15 minutes
    this.maxSessionMs = opts.maxSessionMs || 24 * 60 * 60 * 1000; // 24 hours
    this.requireSignature =
      opts.requireSignature !== undefined ? opts.requireSignature : true;
  }

  createSession({ tenant = "anon", maxBytes = 1024 * 1024 * 1024 } = {}) {
    const id =
      (crypto.randomUUID && crypto.randomUUID()) ||
      crypto.randomBytes(16).toString("hex");
    const now = Date.now();
    const sess = {
      id,
      tenant,
      createdAt: now,
      expiresAt: now + this.inactiveTimeoutMs,
      maxBytes,
      receivedBytes: 0,
      reassembler: new MerkleReassembler({ leafSize: 4096 }),
    };
    this.sessions.set(id, sess);
    return sess;
  }

  get(id) {
    return this.sessions.get(id);
  }

  async appendChunk(id, offset, buf) {
    const s = this.sessions.get(id);
    if (!s) throw new Error("session_not_found");
    if (Date.now() - s.createdAt > this.maxSessionMs) {
      this.sessions.delete(id);
      throw new Error("session_expired");
    }
    // boundary checks
    if (offset % s.reassembler.leafSize !== 0)
      throw new Error("offset_not_aligned");
    if (s.receivedBytes + buf.length > s.maxBytes)
      throw new Error("exceeds_max_bytes");
    // update reassembler
    s.reassembler.append(offset, buf);
    s.receivedBytes += buf.length;
    s.expiresAt = Date.now() + this.inactiveTimeoutMs;
  }

  async commit(id, { signature } = {}) {
    const s = this.sessions.get(id);
    if (!s) throw new Error("session_not_found");
    if (this.requireSignature && !signature)
      throw new Error("missing_signature");
    const root = s.reassembler.finalize();
    // optional signature validation placeholder
    if (this.requireSignature) {
      // In production, validate client signature over root
      try {
        /* validate signature */
      } catch (e) {
        throw new Error("invalid_signature");
      }
    }
    this.sessions.delete(id);
    return { id, root };
  }
}

module.exports = UploadSession;
