'use strict';

/**
 * Session Token Replicator — distributed session-state coordinator.
 *
 * Handles the state machine for `SESSION_TOKEN_*` gossip messages while
 * leaving the socket transport and message framing to cluster-keyring-sync.cjs.
 *
 * Invariants:
 *   - Per-tenant tokenSequence cache for fast, collision-free local issuance.
 *   - Monotonic (epoch, tokenSequence) conflict resolution.
 *   - Fail-closed cross-tenant validation.
 *   - Delta-only responses for state sync.
 */

const tokenDb = require('./token-db.cjs');

const DEFAULT_TENANT = 'default';
const NODE_ID = process.env.NODE_ID || 'node-1';

let _broadcast = null;
const _tenantSequence = new Map(); // tenantId -> number

function setBroadcast(broadcastFn) {
  _broadcast = broadcastFn;
}

function _getTenant(tenantId) {
  return tenantId || DEFAULT_TENANT;
}

function _nextSequence(tenantId) {
  const t = _getTenant(tenantId);
  const current = _tenantSequence.get(t) || 0;
  const next = current + 1;
  _tenantSequence.set(t, next);
  return next;
}

function _setSequence(tenantId, seq) {
  const t = _getTenant(tenantId);
  const current = _tenantSequence.get(t) || 0;
  if (seq > current) _tenantSequence.set(t, seq);
}

function _validateTenant(msg, socket) {
  const payloadTenant = msg.tenantId || DEFAULT_TENANT;
  const socketTenant = socket && socket.tenantId ? socket.tenantId : DEFAULT_TENANT;
  return payloadTenant === socketTenant;
}

/**
 * Broadcast a new session token issuance to the cluster.
 */
async function issueToken({ tokenHash, accountId, tenantId, expiresAt }) {
  if (!_broadcast) return { accepted: false, reason: 'broadcast_unavailable' };
  const t = _getTenant(tenantId);
  const seq = _nextSequence(t);

  const frame = {
    type: 'SESSION_TOKEN_ISSUE',
    from: NODE_ID,
    tokenHash,
    accountId,
    tenantId: t,
    epoch: 0,
    tokenSequence: seq,
    expiresAt,
  };

  await tokenDb.syncSessionToken({
    token_hash: tokenHash,
    account_id: accountId,
    tenant_id: t,
    token_sequence: seq,
    epoch: 0,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  });

  _broadcast(frame);
  return { accepted: true, tokenSequence: seq };
}

/**
 * Broadcast a session token revocation to the cluster.
 */
async function revokeToken({ tokenHash, tenantId }) {
  if (!_broadcast) return { accepted: false, reason: 'broadcast_unavailable' };
  const t = _getTenant(tenantId);
  const seq = _nextSequence(t);

  const frame = {
    type: 'SESSION_TOKEN_REVOKE',
    from: NODE_ID,
    tokenHash,
    tenantId: t,
    epoch: 0,
    tokenSequence: seq,
  };

  await tokenDb.syncSessionToken({
    token_hash: tokenHash,
    tenant_id: t,
    token_sequence: seq,
    epoch: 0,
    revoked_at: new Date().toISOString(),
  });

  _broadcast(frame);
  return { accepted: true, tokenSequence: seq };
}

/**
 * Broadcast a request for session-token state delta to all cluster peers.
 */
function requestStateSync({ lastKnownSequence = 0, tenantId } = {}) {
  if (!_broadcast) return { accepted: false, reason: 'broadcast_unavailable' };
  const t = _getTenant(tenantId);
  const frame = {
    type: 'SESSION_STATE_REQUEST',
    from: NODE_ID,
    tenantId: t,
    lastKnownSequence,
  };
  _broadcast(frame);
  return { accepted: true, action: 'state_request_broadcast' };
}

/**
 * Build a delta of tokens greater than lastKnownSequence for a tenant.
 */
function buildStateDelta(tenantId, lastKnownSequence) {
  const t = _getTenant(tenantId);
  const tokens = tokenDb.findSessionTokensByTenant(t);
  return tokens.filter((tok) => (tok.token_sequence || 0) > lastKnownSequence);
}

/**
 * Handle incoming `SESSION_*` gossip messages.
 * Returns { handled: boolean } so the dispatcher can stop processing.
 */
async function handleSessionTokenMessage(msg, socket) {
  if (!msg || !msg.type || !msg.type.startsWith('SESSION_')) return { handled: false };

  if (!_validateTenant(msg, socket)) {
    throw new Error('CROSS_TENANT_SESSION_INJECTION_REJECTED');
  }

  const tenantId = _getTenant(msg.tenantId);

  switch (msg.type) {
    case 'SESSION_TOKEN_ISSUE': {
      _setSequence(tenantId, msg.tokenSequence);
      return tokenDb.syncSessionToken({
        token_hash: msg.tokenHash,
        account_id: msg.accountId,
        tenant_id: tenantId,
        token_sequence: msg.tokenSequence,
        epoch: msg.epoch || 0,
        expires_at: msg.expiresAt,
        created_at: new Date().toISOString(),
      });
    }
    case 'SESSION_TOKEN_REVOKE': {
      _setSequence(tenantId, msg.tokenSequence);
      return tokenDb.syncSessionToken({
        token_hash: msg.tokenHash,
        tenant_id: tenantId,
        token_sequence: msg.tokenSequence,
        epoch: msg.epoch || 0,
        revoked_at: new Date().toISOString(),
      });
    }
    case 'SESSION_STATE_REQUEST': {
      const delta = buildStateDelta(tenantId, msg.lastKnownSequence || 0);
      const response = {
        type: 'SESSION_STATE_RESPONSE',
        from: NODE_ID,
        tenantId,
        lastKnownSequence: msg.lastKnownSequence || 0,
        tokens: delta,
      };
      if (!_broadcast) return { accepted: false, reason: 'broadcast_unavailable' };
      _broadcast(response);
      return { accepted: true, action: 'state_response_sent', count: delta.length };
    }
    case 'SESSION_STATE_RESPONSE': {
      const tokens = Array.isArray(msg.tokens) ? msg.tokens : [];
      const results = [];
      let rejected = 0;
      for (const t of tokens) {
        try {
          _setSequence(tenantId, t.token_sequence);
          results.push(await tokenDb.syncSessionToken(t));
        } catch (err) {
          rejected += 1;
          results.push({ accepted: false, reason: err.message });
        }
      }
      return { accepted: rejected === 0, results, rejected };
    }
    default:
      return { handled: false };
  }
}

module.exports = {
  setBroadcast,
  issueToken,
  revokeToken,
  requestStateSync,
  buildStateDelta,
  handleSessionTokenMessage,
  _nextSequence,
  _setSequence,
};
