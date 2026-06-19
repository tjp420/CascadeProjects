/**
 * Token chain API routes — create, activate, and inspect token trees.
 */

'use strict';

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const {
  createTokenChain,
  getTokenNode,
  getChain,
  activateToken,
  revokeToken,
  expireStaleTokens
} = require('../lib/token-chain-store.cjs');
const {
  validateChainToken,
  ensureTokenActive,
  buildChainSummary
} = require('../lib/token-chain-utils.cjs');

const logger = {
  error: (...a) => { const c = globalThis.console; c.error(...a); },
  info:  (...a) => { const c = globalThis.console; c.log(...a); }
};

// In-memory rate limiter for chain creation
const CHAIN_RATE_MS = 60 * 1000;
const chainRateLog = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = chainRateLog.get(ip);
  if (entry && now - entry < CHAIN_RATE_MS) return false;
  chainRateLog.set(ip, now);
  return true;
}

// POST /api/token-chain/create
// Body: { ownerEmail, ownerToken, ownerPayload, ttlMinutes, attached: [{email,tier,features,jwt}] }
router.post('/api/token-chain/create', (req, res) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({ error: 'Too many chain creation requests. Wait 60 seconds.' });
    }

    const { ownerEmail, ownerToken, ownerPayload, ttlMinutes, attached = [] } = req.body;
    if (!ownerEmail || !ownerToken) {
      return res.status(400).json({ error: 'ownerEmail and ownerToken are required.' });
    }

    const attachedJwts = attached.map((a) => a.jwt || '');
    const result = createTokenChain(
      ownerEmail,
      ownerPayload || {},
      ownerToken,
      ttlMinutes || 60 * 24 * 30,
      attached,
      attachedJwts
    );

    logger.info('[TokenChain] Created chain', result.chainId, 'for', ownerEmail);
    res.json({ success: true, chainId: result.chainId, owner: result.owner, attachedCount: result.attached.length });
  } catch (err) {
    logger.error('[TokenChainCreate] Error:', err.message);
    res.status(500).json({ error: 'Failed to create token chain.', detail: err.message });
  }
});

// POST /api/token-chain/activate
// Body: { token, ttlMinutes }
router.post('/api/token-chain/activate', (req, res) => {
  try {
    expireStaleTokens();
    const { token, ttlMinutes } = req.body;
    if (!token) return res.status(400).json({ error: 'token is required.' });

    const result = ensureTokenActive(token, ttlMinutes || 60 * 24 * 30);
    if (!result.success) {
      return res.status(403).json({ success: false, error: result.error });
    }

    res.json({
      success: true,
      node: {
        id: result.node.id,
        chainId: result.node.chain_id,
        tokenType: result.node.token_type,
        status: result.node.status,
        activatedAt: result.node.activated_at,
        clockStartedAt: result.node.clock_started_at,
        expiresAt: result.node.expires_at
      },
      alreadyActive: result.alreadyActive || false
    });
  } catch (err) {
    logger.error('[TokenChainActivate] Error:', err.message);
    res.status(500).json({ error: 'Activation failed.', detail: err.message });
  }
});

// GET /api/token-chain/status/:chainId
router.get('/api/token-chain/status/:chainId', (req, res) => {
  try {
    expireStaleTokens();
    const summary = buildChainSummary(req.params.chainId);
    if (!summary) return res.status(404).json({ error: 'Chain not found.' });
    res.json({ success: true, chain: summary });
  } catch (err) {
    logger.error('[TokenChainStatus] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch chain status.', detail: err.message });
  }
});

// POST /api/token-chain/validate
// Body: { token }
router.post('/api/token-chain/validate', (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token is required.' });

    const result = validateChainToken(token);
    res.json({
      success: true,
      chainValid: result.chainValid,
      status: result.node?.status || null,
      tokenType: result.node?.token_type || null,
      error: result.error
    });
  } catch (err) {
    logger.error('[TokenChainValidate] Error:', err.message);
    res.status(500).json({ error: 'Validation failed.', detail: err.message });
  }
});

// POST /api/token-chain/revoke
// Body: { token, cascade }
router.post('/api/token-chain/revoke', (req, res) => {
  try {
    const { token, cascade = false } = req.body;
    if (!token) return res.status(400).json({ error: 'token is required.' });

    const result = revokeToken(token, cascade);
    if (!result.success) return res.status(404).json(result);
    res.json({ success: true, message: cascade ? 'Token and descendants revoked.' : 'Token revoked.' });
  } catch (err) {
    logger.error('[TokenChainRevoke] Error:', err.message);
    res.status(500).json({ error: 'Revoke failed.', detail: err.message });
  }
});

// GET /api/token-chain/customer — list all chains for a customer (API key auth)
router.get('/api/token-chain/customer', (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const apiKey = authHeader.replace(/^Bearer\s+/i, '');
    if (!apiKey) {
      return res.status(401).json({ error: 'Missing API key. Use Authorization: Bearer <api_key>' });
    }
    const { getCustomerByApiKey } = require('../lib/db.cjs');
    const customer = getCustomerByApiKey(apiKey);
    if (!customer) {
      return res.status(401).json({ error: 'Invalid API key.' });
    }

    const { getDb } = require('../lib/db.cjs');
    const db = getDb();
    const rows = db.prepare(
      `SELECT chain_id, COUNT(*) as node_count,
       SUM(CASE WHEN token_type = 'owner' THEN 1 ELSE 0 END) as owner_count,
       SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count
       FROM token_nodes WHERE email = ? GROUP BY chain_id`
    ).all(customer.email.trim().toLowerCase());

    res.json({ success: true, chains: rows });
  } catch (err) {
    logger.error('[TokenChainCustomer] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch customer chains.', detail: err.message });
  }
});

module.exports = router;
