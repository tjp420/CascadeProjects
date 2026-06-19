/**
 * Token chain store — lazy activation tree for license tokens.
 * Owner token must activate first; attached tokens only become active
 * after their parent is active. Each token tracks its own clock_start.
 */

'use strict';

const crypto = require('crypto');
const { getDb } = require('./db.cjs');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a token chain with an owner and N attached tokens.
 * @param {string} ownerEmail
 * @param {Object} ownerTokenPayload — payload used to generate the owner JWT
 * @param {string} ownerJwt — the generated owner JWT string
 * @param {number} ttlMinutes — lifetime from activation
 * @param {Array<Object>} [attached=[]] — { email, tier, features }
 * @param {Array<string>} [attachedJwts=[]] — pre-generated JWT strings for attached
 * @returns {Object} { chainId, owner, attached }
 */
function createTokenChain(ownerEmail, ownerTokenPayload, ownerJwt, ttlMinutes, attached = [], attachedJwts = []) {
  const db = getDb();
  const chainId = 'tc_' + crypto.randomBytes(8).toString('hex');
  const now = new Date().toISOString();
  const ownerHash = hashToken(ownerJwt);

  const ownerStmt = db.prepare(
    `INSERT INTO token_nodes
     (chain_id, token_hash, token_type, status, email, tier, created_at, features)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  ownerStmt.run(
    chainId,
    ownerHash,
    'owner',
    'pending',
    ownerEmail.trim().toLowerCase(),
    ownerTokenPayload.tier || 'community',
    now,
    JSON.stringify(ownerTokenPayload.features || [])
  );

  const ownerRow = db.prepare('SELECT id FROM token_nodes WHERE token_hash = ?').get(ownerHash);
  const ownerId = ownerRow.id;

  const attachedStmt = db.prepare(
    `INSERT INTO token_nodes
     (chain_id, parent_id, token_hash, token_type, status, email, tier, created_at, features)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const attachedResults = [];
  for (let i = 0; i < attached.length; i++) {
    const a = attached[i];
    const jwtStr = attachedJwts[i] || '';
    const aHash = jwtStr ? hashToken(jwtStr) : null;
    attachedStmt.run(
      chainId,
      ownerId,
      aHash,
      'attached',
      'pending',
      (a.email || ownerEmail).trim().toLowerCase(),
      a.tier || ownerTokenPayload.tier || 'community',
      now,
      JSON.stringify(a.features || ownerTokenPayload.features || [])
    );
    if (aHash) {
      const row = db.prepare('SELECT id, token_hash, status, token_type FROM token_nodes WHERE token_hash = ?').get(aHash);
      attachedResults.push(row);
    }
  }

  return {
    chainId,
    owner: { id: ownerId, tokenHash: ownerHash, status: 'pending' },
    attached: attachedResults
  };
}

/**
 * Get a token node by its hash.
 */
function getTokenNode(tokenHash) {
  const db = getDb();
  return db.prepare('SELECT * FROM token_nodes WHERE token_hash = ?').get(tokenHash);
}

/**
 * Get all nodes in a chain.
 */
function getChain(chainId) {
  const db = getDb();
  return db.prepare('SELECT * FROM token_nodes WHERE chain_id = ? ORDER BY id').all(chainId);
}

/**
 * Activate a token if its parent is active (lazy chain).
 * Sets activated_at and clock_started_at, computes expires_at.
 * For owner tokens, no parent check needed.
 * @param {string} tokenHash
 * @param {number} ttlMinutes — duration from activation
 * @returns {Object} { success, node, error }
 */
function activateToken(tokenHash, ttlMinutes) {
  const db = getDb();
  const node = getTokenNode(tokenHash);
  if (!node) return { success: false, error: 'Token not found in chain registry.' };
  if (node.status === 'active') return { success: true, node, alreadyActive: true };
  if (node.status === 'expired' || node.status === 'revoked') {
    return { success: false, error: `Token is ${node.status}.` };
  }

  // Owner can activate anytime; attached require active parent
  if (node.token_type === 'attached' && node.parent_id) {
    const parent = db.prepare('SELECT status FROM token_nodes WHERE id = ?').get(node.parent_id);
    if (!parent || parent.status !== 'active') {
      return { success: false, error: 'Parent token is not yet active. Activate the owner token first.' };
    }
  }

  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

  db.prepare(
    `UPDATE token_nodes
     SET status = 'active', activated_at = ?, clock_started_at = ?, expires_at = ?
     WHERE id = ?`
  ).run(nowIso, nowIso, expiresAt, node.id);

  const updated = getTokenNode(tokenHash);
  return { success: true, node: updated };
}

/**
 * Mark a token as expired if past its expires_at.
 * Returns true if any row was updated.
 */
function expireStaleTokens() {
  const db = getDb();
  const nowIso = new Date().toISOString();
  const result = db.prepare(
    `UPDATE token_nodes SET status = 'expired'
     WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < ?`
  ).run(nowIso);
  return result.changes > 0;
}

/**
 * Revoke a token and optionally all its descendants.
 */
function revokeToken(tokenHash, cascade = false) {
  const db = getDb();
  const node = getTokenNode(tokenHash);
  if (!node) return { success: false, error: 'Token not found.' };

  db.prepare("UPDATE token_nodes SET status = 'revoked' WHERE id = ?").run(node.id);

  if (cascade && node.token_type === 'owner') {
    db.prepare("UPDATE token_nodes SET status = 'revoked' WHERE parent_id = ? AND status != 'revoked'").run(node.id);
  }

  return { success: true };
}

/**
 * Check if a token chain is fully active (owner + all attached).
 */
function isChainFullyActive(chainId) {
  const db = getDb();
  const rows = db.prepare('SELECT status FROM token_nodes WHERE chain_id = ?').all(chainId);
  if (rows.length === 0) return false;
  return rows.every((r) => r.status === 'active');
}

/**
 * Get chain status summary.
 */
function getChainStatus(chainId) {
  const nodes = getChain(chainId);
  if (nodes.length === 0) return null;

  const owner = nodes.find((n) => n.token_type === 'owner');
  const attached = nodes.filter((n) => n.token_type === 'attached');

  return {
    chainId,
    owner: owner ? {
      id: owner.id,
      status: owner.status,
      email: owner.email,
      tier: owner.tier,
      activatedAt: owner.activated_at,
      clockStartedAt: owner.clock_started_at,
      expiresAt: owner.expires_at
    } : null,
    attached: attached.map((a) => ({
      id: a.id,
      status: a.status,
      email: a.email,
      tier: a.tier,
      activatedAt: a.activated_at,
      clockStartedAt: a.clock_started_at,
      expiresAt: a.expires_at
    })),
    fullyActive: isChainFullyActive(chainId)
  };
}

module.exports = {
  hashToken,
  createTokenChain,
  getTokenNode,
  getChain,
  activateToken,
  expireStaleTokens,
  revokeToken,
  isChainFullyActive,
  getChainStatus
};
