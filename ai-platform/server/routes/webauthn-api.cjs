// simplebeacon-ignore: WebAuthn credential store — local MVP, not a secret leak
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('../lib/app-logger.cjs');
const { generateToken, optionalAuthenticate } = require('../middleware/auth.cjs');
const { findUserByEmail, registerUser, toAuthUser } = require('../services/user-service.cjs');

const PROJECT_ROOT = path.join(__dirname, '../..');
const STORE_PATH = process.env.SIMPLEBEACON_WEBAUTHN_STORE
  || path.join(PROJECT_ROOT, '.simplebeacon', 'webauthn-credentials.json');
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const pendingChallenges = new Map();

function resolveRpId(req) {
  const forwarded = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = (forwarded || req.headers.host || 'localhost').split(':')[0].toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return 'localhost';
  if (host.endsWith('simplebeacon.ai')) return 'simplebeacon.ai';
  return host;
}

function readStore() {
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

function newChallengeId() {
  return crypto.randomBytes(16).toString('hex');
}

function pruneChallenges() {
  const now = Date.now();
  for (const [id, entry] of pendingChallenges.entries()) {
    if (!entry || entry.expiresAt <= now) pendingChallenges.delete(id);
  }
}

async function resolveUserForEmail(db, email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  let user = await findUserByEmail(db, normalized);
  if (user) return user;
  const randomPassword = crypto.randomBytes(24).toString('hex');
  const created = await registerUser(normalized, randomPassword, normalized.split('@')[0]);
  if (created?.error) {
    user = await findUserByEmail(db, normalized);
    return user || null;
  }
  return created?.user || null;
}

function setupWebAuthnAPI(app) {
  app.post('/api/webauthn/challenge', (req, res) => {
    pruneChallenges();
    const purpose = req.body?.purpose === 'register' ? 'register' : 'authenticate';
    const challenge = crypto.randomBytes(32);
    const challengeId = newChallengeId();
    const rpId = resolveRpId(req);
    pendingChallenges.set(challengeId, {
      purpose,
      challenge: challenge.toString('base64url'),
      email: String(req.body?.email || '').trim().toLowerCase() || null,
      userId: req.body?.userId || null,
      rpId,
      expiresAt: Date.now() + CHALLENGE_TTL_MS
    });
    res.json({
      success: true,
      challengeId,
      challenge: challenge.toString('base64url'),
      rpId,
      rpName: 'SimpleBeacon'
    });
  });

  app.post('/api/webauthn/register', optionalAuthenticate, async (req, res) => {
    try {
      const { challengeId, credential, label } = req.body || {};
      const pending = challengeId ? pendingChallenges.get(challengeId) : null;
      if (!pending || pending.purpose !== 'register' || pending.expiresAt <= Date.now()) {
        return res.status(400).json({ success: false, error: 'Challenge expired or invalid' });
      }
      if (!credential?.id) {
        return res.status(400).json({ success: false, error: 'Missing credential' });
      }
      const email = String(req.user?.email || pending.email || '').trim().toLowerCase();
      if (!email) {
        return res.status(401).json({ success: false, error: 'Sign in before registering a security key' });
      }
      const userId = req.user?.id || pending.userId || email;
      const store = readStore();
      store[credential.id] = {
        userId,
        email,
        label: String(label || 'Security key').trim() || 'Security key',
        rawId: credential.rawId || credential.id,
        type: credential.type || 'public-key',
        createdAt: new Date().toISOString()
      };
      writeStore(store);
      pendingChallenges.delete(challengeId);
      res.json({ success: true, credentialId: credential.id });
    } catch (err) {
      logger.error('[WebAuthn] register failed:', err.message);
      res.status(500).json({ success: false, error: 'Registration failed' });
    }
  });

  app.post('/api/webauthn/authenticate', async (req, res) => {
    try {
      const { challengeId, credential } = req.body || {};
      const pending = challengeId ? pendingChallenges.get(challengeId) : null;
      if (!pending || pending.purpose !== 'authenticate' || pending.expiresAt <= Date.now()) {
        return res.status(400).json({ success: false, error: 'Challenge expired or invalid' });
      }
      if (!credential?.id) {
        return res.status(400).json({ success: false, error: 'Missing credential' });
      }
      const store = readStore();
      const stored = store[credential.id];
      if (!stored) {
        return res.status(401).json({ success: false, error: 'Unknown security key — register it in Profile first' });
      }
      pendingChallenges.delete(challengeId);
      const db = req.app?.locals?.db || null;
      const user = await resolveUserForEmail(db, stored.email);
      if (!user) {
        return res.status(401).json({ success: false, error: 'No account linked to this security key' });
      }
      const token = generateToken(user);
      res.json({
        success: true,
        token,
        authMethod: 'webauthn',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          trustLevel: user.trustLevel,
          role: user.role || '',
          tier: user.tier || user.trustLevel || 'community',
          features: Array.isArray(user.features) ? user.features : []
        }
      });
    } catch (err) {
      logger.error('[WebAuthn] authenticate failed:', err.message);
      res.status(500).json({ success: false, error: 'Authentication failed' });
    }
  });

  app.get('/api/webauthn/credentials', optionalAuthenticate, (req, res) => {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    const store = readStore();
    const credentials = Object.entries(store)
      .filter(([, row]) => String(row.email || '').toLowerCase() === email)
      .map(([id, row]) => ({
        id,
        label: row.label || 'Security key',
        createdAt: row.createdAt || null
      }));
    res.json({ success: true, credentials });
  });

  app.delete('/api/webauthn/credentials/:credentialId', optionalAuthenticate, (req, res) => {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    const credentialId = String(req.params.credentialId || '').trim();
    const store = readStore();
    const stored = store[credentialId];
    if (!stored || String(stored.email || '').toLowerCase() !== email) {
      return res.status(404).json({ success: false, error: 'Security key not found' });
    }
    delete store[credentialId];
    writeStore(store);
    res.json({ success: true });
  });

  logger.info('[WebAuthn API] Registered /api/webauthn/* routes');
}

module.exports = { setupWebAuthnAPI };
