'use strict';

const crypto = require('crypto');

const SYNC_INTERVAL_MS = parseInt(process.env.SESSION_TOKEN_SYNC_MS, 10) || 10000;
const EXPIRY_SWEEP_MS = parseInt(process.env.SESSION_TOKEN_EXPIRY_SWEEP_MS, 10) || 30000;
const MAX_TOKENS_PER_SYNC = 500;

class SessionTokenReplicator {
  constructor(config = {}) {
    this.nodeId = config.nodeId || process.env.NODE_ID || require('os').hostname() || 'node';
    this.sendFn = typeof config.sendFn === 'function' ? config.sendFn : null;
    this.syncIntervalMs = config.syncIntervalMs || SYNC_INTERVAL_MS;
    this.expirySweepMs = config.expirySweepMs || EXPIRY_SWEEP_MS;
    this._tokens = new Map();
    this._families = new Map();
    this._appliedMessages = new Set();
    this._maxAppliedMessages = 10000;
    this._metrics = {
      tokens_replicated_total: 0,
      tokens_revoked_total: 0,
      families_revoked_total: 0,
      sync_messages_sent_total: 0,
      sync_messages_received_total: 0,
      tokens_expired_swept_total: 0,
      state_requests_sent_total: 0,
      state_requests_received_total: 0,
    };
    this._syncTimer = null;
    this._expiryTimer = null;
    this._running = false;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._syncTimer = setInterval(() => { this._broadcastStateSync(); }, this.syncIntervalMs);
    if (this._syncTimer.unref) this._syncTimer.unref();
    this._expiryTimer = setInterval(() => { this._sweepExpiredTokens(); }, this.expirySweepMs);
    if (this._expiryTimer.unref) this._expiryTimer.unref();
  }

  stop() {
    this._running = false;
    if (this._syncTimer) clearInterval(this._syncTimer);
    if (this._expiryTimer) clearInterval(this._expiryTimer);
    this._syncTimer = null;
    this._expiryTimer = null;
  }

  issueToken(tokenData) {
    if (!tokenData || !tokenData.tokenId) return false;
    const tokenId = String(tokenData.tokenId);
    if (this._tokens.has(tokenId)) return false;
    const entry = {
      tokenHash: tokenData.tokenHash || null,
      userId: tokenData.userId || null,
      family: tokenData.family || null,
      expiresAt: tokenData.expiresAt || 0,
      revoked: false,
      issuedAt: Date.now(),
      issuedBy: tokenData.issuedBy || this.nodeId,
      tenantId: tokenData.tenantId || null,
    };
    this._tokens.set(tokenId, entry);
    if (entry.family) {
      if (!this._families.has(entry.family)) this._families.set(entry.family, new Set());
      this._families.get(entry.family).add(tokenId);
    }
    this._broadcast({
      type: 'SESSION_TOKEN_ISSUE', from: this.nodeId, tokenId,
      tokenHash: entry.tokenHash, userId: entry.userId, family: entry.family,
      expiresAt: entry.expiresAt, issuedBy: entry.issuedBy, tenantId: entry.tenantId,
      timestamp: Date.now(),
    });
    this._metrics.tokens_replicated_total += 1;
    return true;
  }

  revokeToken(tokenId, reason) {
    const entry = this._tokens.get(String(tokenId));
    if (!entry || entry.revoked) return false;
    entry.revoked = true;
    entry.revokedAt = Date.now();
    entry.revokedReason = reason || 'manual';
    this._broadcast({
      type: 'SESSION_TOKEN_REVOKE', from: this.nodeId,
      tokenId: String(tokenId), reason: entry.revokedReason, timestamp: Date.now(),
    });
    this._metrics.tokens_revoked_total += 1;
    return true;
  }

  revokeFamily(familyId, reason) {
    const family = this._families.get(String(familyId));
    if (!family || family.size === 0) return 0;
    let count = 0;
    const revokedTokenIds = [];
    for (const tokenId of family) {
      const entry = this._tokens.get(tokenId);
      if (entry && !entry.revoked) {
        entry.revoked = true;
        entry.revokedAt = Date.now();
        entry.revokedReason = reason || 'family_revocation';
        count++;
        revokedTokenIds.push(tokenId);
      }
    }
    if (count > 0) {
      this._broadcast({
        type: 'SESSION_FAMILY_REVOKE', from: this.nodeId, family: String(familyId),
        reason: reason || 'family_revocation', revokedTokenIds, timestamp: Date.now(),
      });
      this._metrics.families_revoked_total += 1;
    }
    return count;
  }

  isTokenRevoked(tokenId) {
    const entry = this._tokens.get(String(tokenId));
    if (!entry) return true;
    return entry.revoked;
  }

  isTokenValid(tokenId) {
    const entry = this._tokens.get(String(tokenId));
    if (!entry || entry.revoked) return false;
    if (entry.expiresAt && entry.expiresAt < Date.now()) return false;
    return true;
  }

  getTokenState(tokenId) {
    const entry = this._tokens.get(String(tokenId));
    if (!entry) return null;
    return {
      userId: entry.userId, family: entry.family, expiresAt: entry.expiresAt,
      revoked: entry.revoked, issuedAt: entry.issuedAt, issuedBy: entry.issuedBy,
      tenantId: entry.tenantId, revokedAt: entry.revokedAt || null,
      revokedReason: entry.revokedReason || null,
    };
  }

  getMetrics() {
    return { ...this._metrics, activeTokens: this._tokens.size, activeFamilies: this._families.size };
  }

  handlePeerSync(msg) {
    if (!msg || !msg.type) return;
    this._metrics.sync_messages_received_total += 1;
    switch (msg.type) {
      case 'SESSION_TOKEN_ISSUE': this.handleTokenIssue(msg); break;
      case 'SESSION_TOKEN_REVOKE': this.handleTokenRevoke(msg); break;
      case 'SESSION_FAMILY_REVOKE': this.handleFamilyRevoke(msg); break;
      case 'SESSION_TOKEN_SYNC': this._handleStateSync(msg); break;
      case 'SESSION_STATE_REQUEST': this._handleStateRequest(msg); break;
      case 'SESSION_STATE_RESPONSE': this._handleStateResponse(msg); break;
      default: break;
    }
  }

  handleTokenIssue(msg) {
    if (!msg.tokenId) return;
    const tokenId = String(msg.tokenId);
    if (this._tokens.has(tokenId)) return;
    const entry = {
      tokenHash: msg.tokenHash || null, userId: msg.userId || null,
      family: msg.family || null, expiresAt: msg.expiresAt || 0,
      revoked: false, issuedAt: msg.timestamp || Date.now(),
      issuedBy: msg.from || msg.issuedBy || 'remote', tenantId: msg.tenantId || null,
    };
    this._tokens.set(tokenId, entry);
    if (entry.family) {
      if (!this._families.has(entry.family)) this._families.set(entry.family, new Set());
      this._families.get(entry.family).add(tokenId);
    }
  }

  handleTokenRevoke(msg) {
    if (!msg.tokenId) return;
    const tokenId = String(msg.tokenId);
    const entry = this._tokens.get(tokenId);
    if (!entry) {
      this._tokens.set(tokenId, {
        tokenHash: null, userId: null, family: null, expiresAt: 0,
        revoked: true, issuedAt: msg.timestamp || Date.now(),
        issuedBy: msg.from || 'remote', tenantId: msg.tenantId || null,
        revokedAt: Date.now(), revokedReason: msg.reason || 'remote_revocation',
      });
      return;
    }
    entry.revoked = true;
    entry.revokedAt = Date.now();
    entry.revokedReason = msg.reason || 'remote_revocation';
  }

  handleFamilyRevoke(msg) {
    if (!msg.family) return;
    const family = this._families.get(String(msg.family));
    if (family) {
      for (const tokenId of family) {
        const entry = this._tokens.get(tokenId);
        if (entry && !entry.revoked) {
          entry.revoked = true;
          entry.revokedAt = Date.now();
          entry.revokedReason = msg.reason || 'remote_family_revocation';
        }
      }
    }
    if (msg.revokedTokenIds && Array.isArray(msg.revokedTokenIds)) {
      for (const tokenId of msg.revokedTokenIds) {
        const entry = this._tokens.get(String(tokenId));
        if (entry && !entry.revoked) {
          entry.revoked = true;
          entry.revokedAt = Date.now();
          entry.revokedReason = msg.reason || 'remote_family_revocation';
        }
      }
    }
  }

  requestStateFromPeers() {
    this._metrics.state_requests_sent_total += 1;
    this._broadcast({ type: 'SESSION_STATE_REQUEST', from: this.nodeId, timestamp: Date.now() });
  }

  _handleStateRequest(msg) {
    this._metrics.state_requests_received_total += 1;
    const tokens = [];
    const now = Date.now();
    for (const [tokenId, entry] of this._tokens.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) continue;
      tokens.push({
        tokenId, tokenHash: entry.tokenHash, userId: entry.userId,
        family: entry.family, expiresAt: entry.expiresAt, revoked: entry.revoked,
        issuedBy: entry.issuedBy, tenantId: entry.tenantId,
      });
      if (tokens.length >= MAX_TOKENS_PER_SYNC) break;
    }
    this._broadcast({
      type: 'SESSION_STATE_RESPONSE', from: this.nodeId, to: msg.from,
      tokens, timestamp: Date.now(),
    });
  }

  _handleStateResponse(msg) {
    if (!msg.tokens || !Array.isArray(msg.tokens)) return;
    if (msg.to && msg.to !== this.nodeId) return;
    for (const t of msg.tokens) {
      if (!t.tokenId) continue;
      const tokenId = String(t.tokenId);
      if (this._tokens.has(tokenId)) continue;
      const entry = {
        tokenHash: t.tokenHash || null, userId: t.userId || null,
        family: t.family || null, expiresAt: t.expiresAt || 0,
        revoked: t.revoked || false, issuedAt: msg.timestamp || Date.now(),
        issuedBy: t.issuedBy || msg.from || 'remote', tenantId: t.tenantId || null,
      };
      this._tokens.set(tokenId, entry);
      if (entry.family) {
        if (!this._families.has(entry.family)) this._families.set(entry.family, new Set());
        this._families.get(entry.family).add(tokenId);
      }
    }
  }

  _handleStateSync(msg) { /* lightweight heartbeat */ }

  _broadcast(msg) {
    if (!this.sendFn) return;
    try { this.sendFn(msg); this._metrics.sync_messages_sent_total += 1; } catch { /* fail-silent */ }
  }

  _broadcastStateSync() {
    this._broadcast({
      type: 'SESSION_TOKEN_SYNC', from: this.nodeId,
      tokenCount: this._tokens.size, familyCount: this._families.size, timestamp: Date.now(),
    });
  }

  _sweepExpiredTokens() {
    const now = Date.now();
    let swept = 0;
    for (const [tokenId, entry] of this._tokens.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this._tokens.delete(tokenId);
        if (entry.family && this._families.has(entry.family)) {
          this._families.get(entry.family).delete(tokenId);
          if (this._families.get(entry.family).size === 0) this._families.delete(entry.family);
        }
        swept++;
      }
    }
    this._metrics.tokens_expired_swept_total += swept;
  }

  setSendFn(fn) { this.sendFn = typeof fn === 'function' ? fn : null; }
  size() { return this._tokens.size; }

  _reset() {
    this._tokens.clear();
    this._families.clear();
    this._appliedMessages.clear();
    this._metrics = {
      tokens_replicated_total: 0, tokens_revoked_total: 0, families_revoked_total: 0,
      sync_messages_sent_total: 0, sync_messages_received_total: 0,
      tokens_expired_swept_total: 0, state_requests_sent_total: 0, state_requests_received_total: 0,
    };
  }
}

module.exports = { SessionTokenReplicator, SYNC_INTERVAL_MS, EXPIRY_SWEEP_MS, MAX_TOKENS_PER_SYNC };
