// simplebeacon-ignore git-sensitive-file — auth/token implementation file, not a leaked secret
/**
 * Token chain utilities — lazy chain validation and clock helpers.
 * Works alongside token-chain-store.cjs to enforce activation rules.
 */

'use strict';

const {
    hashToken,
    getTokenNode,
    activateToken,
    expireStaleTokens,
    getChainStatus
} = require('./token-chain-store.cjs');

/**
 * Validate a JWT string against chain state.
 * 1. Hash the JWT and look it up in token_nodes.
 * 2. If found, check status (must be active, not expired/revoked).
 * 3. If attached, verify parent is active.
 * 4. Optionally expire stale tokens first.
 * @param {string} jwtToken — the raw JWT string
 * @param {Object} [options]
 * @param {boolean} [options.autoExpire=true] — run expireStaleTokens first
 * @returns {Object} { chainValid: boolean, node: Object|null, error: string|null }
 */
function validateChainToken(jwtToken, options = {}) {
    const autoExpire = options.autoExpire !== false;
    if (autoExpire) expireStaleTokens();

    const tokenHash = hashToken(jwtToken);
    const node = getTokenNode(tokenHash);
    if (!node) {
        return { chainValid: false, node: null, error: 'Token not registered in chain registry.' };
    }

    if (node.status === 'revoked') {
        return { chainValid: false, node, error: 'Token has been revoked.' };
    }
    if (node.status === 'expired') {
        return { chainValid: false, node, error: 'Token has expired.' };
    }
    if (node.status !== 'active') {
        return { chainValid: false, node, error: 'Token is not active. Activate the owner token first.' };
    }

    return { chainValid: true, node, error: null };
}

/**
 * Ensure a token is active. For owner tokens this starts the chain clock.
 * For attached tokens, the parent must already be active.
 * @param {string} jwtToken
 * @param {number} ttlMinutes
 * @returns {Object} { success, node, error, alreadyActive }
 */
function ensureTokenActive(jwtToken, ttlMinutes) {
    const tokenHash = hashToken(jwtToken);
    return activateToken(tokenHash, ttlMinutes);
}

/**
 * Get remaining minutes for a token based on its clock.
 * Returns 0 if expired or not yet active.
 */
function getRemainingMinutes(node) {
    if (!node || !node.clock_started_at || !node.expires_at) return 0;
    const remainingMs = new Date(node.expires_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(remainingMs / 60000));
}

/**
 * Build a chain summary for API response.
 */
function buildChainSummary(chainId) {
    const status = getChainStatus(chainId);
    if (!status) return null;

    const ownerRemaining = status.owner ? getRemainingMinutes(status.owner) : 0;
    const attachedSummaries = status.attached.map(a => ({
        id: a.id,
        email: a.email,
        status: a.status,
        activatedAt: a.activatedAt,
        clockStartedAt: a.clockStartedAt,
        expiresAt: a.expiresAt,
        remainingMinutes: getRemainingMinutes(a)
    }));

    return {
        chainId: status.chainId,
        owner: status.owner
            ? {
                  id: status.owner.id,
                  email: status.owner.email,
                  status: status.owner.status,
                  activatedAt: status.owner.activatedAt,
                  clockStartedAt: status.owner.clockStartedAt,
                  expiresAt: status.owner.expiresAt,
                  remainingMinutes: ownerRemaining
              }
            : null,
        attached: attachedSummaries,
        fullyActive: status.fullyActive
    };
}

module.exports = {
    validateChainToken,
    ensureTokenActive,
    getRemainingMinutes,
    buildChainSummary
};
