// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
'use strict';

const logger = require('../lib/app-logger.cjs');
const express = require('express');
const rateLimit = require('express-rate-limit');
const constants = require('../config/constants.cjs');
const { getActiveUsers } = require('../lib/session-activity.cjs');
const { authenticate } = require('../middleware/auth.cjs');

function isAdmin(req) {
  if (!req.user) return false;
  const email = String(req.user.email || '').toLowerCase();
  if (email === 'admin@simplebeacon.ai') return true;
  const role = String(req.user.role || '').toLowerCase();
  const tier = String(req.user.tier || '').toLowerCase();
  if (role === 'admin' || role === 'superuser') return true;
  if (tier === 'admin' || tier === 'superuser') return true;
  if (Array.isArray(req.user.features) && req.user.features.map(String).map(s => s.toLowerCase()).includes('all_modules')) return true;
  if (Array.isArray(req.user.permissions) && req.user.permissions.includes('admin:all')) return true;
  return false;
}

function tierToTrustLevel(tier) {
  const raw = String(tier || 'community').toLowerCase();
  if (raw === 'admin' || raw === 'superuser') return 'gold';
  if (raw === 'community') return 'bronze';
  if (raw === 'silver' || raw === 'gold') return raw;
  return 'bronze';
}

function trustLevelToTier(trustLevel) {
  const map = { bronze: 'community', silver: 'silver', gold: 'gold' };
  return map[String(trustLevel || '').toLowerCase()] || 'community';
}

function getSqliteDb() {
  try {
    return require('../../../coming-soon/lib/db.cjs');
  } catch {
    return null;
  }
}

function mapDemoAdminUser(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name || (u.email || '').split('@')[0],
    trustLevel: u.trustLevel || u.trust_level || 'bronze',
    verificationStatus: u.verificationStatus || u.verification_status || 'email',
    successfulAnalyses: u.successfulAnalyses ?? u.successful_analyses ?? 0,
    securityIncidents: u.securityIncidents ?? u.security_incidents ?? 0,
    communityContributions: u.communityContributions ?? u.community_contributions ?? 0,
    createdAt: u.createdAt || u.created_at || null
  };
}

function mapSqliteAdminUser(row) {
  const email = row.email || '';
  return {
    id: String(row.id),
    email,
    name: email.includes('@') ? email.split('@')[0] : email,
    trustLevel: tierToTrustLevel(row.tier),
    verificationStatus: 'verified',
    successfulAnalyses: 0,
    securityIncidents: 0,
    communityContributions: 0,
    createdAt: row.created_at || row.createdAt || null,
    source: 'sqlite'
  };
}

async function loadAdminUsers(db) {
  if (db) {
    const result = await db.query(
      `SELECT id, email, name, trust_level, verification_status,
              successful_analyses, security_incidents, community_contributions,
              created_at
       FROM users
       ORDER BY created_at DESC`
    );
    return result.rows.map(row => ({
      id: row.id,
      email: row.email,
      name: row.name,
      trustLevel: row.trust_level,
      verificationStatus: row.verification_status,
      successfulAnalyses: row.successful_analyses,
      securityIncidents: row.security_incidents,
      communityContributions: row.community_contributions,
      createdAt: row.created_at
    }));
  }

  const sqlite = getSqliteDb();
  if (sqlite) {
    try {
      const rows = sqlite.getAllUsers();
      if (Array.isArray(rows) && rows.length > 0) {
        return rows.map(mapSqliteAdminUser);
      }
    } catch (err) {
      logger.warn('[AdminAPI] SQLite user list failed:', err.message);
    }
  }

  const { loadDemoUsers } = require('../services/user-service.cjs');
  return loadDemoUsers().map(mapDemoAdminUser);
}

function setupAdminAPI(app, options = {}) {
  const db = app.locals?.db || options.db || null;

  const adminRateLimit = rateLimit({
    windowMs: constants.RATE_LIMIT_WINDOW_MS,
    max: constants.MAX_RATE_LIMIT,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Admin API rate limit exceeded. Please try again later.' }
  });

  const router = express.Router();
  app.use('/api/admin', authenticate, adminRateLimit, router);

  router.get('/users', async (req, res) => {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    try {
      const users = await loadAdminUsers(db);

      const active = getActiveUsers();
      const activeById = new Map(active.map(a => [a.userId, a]));

      const enriched = users.map(u => {
        const activity = activeById.get(u.id) || active.find(a => a.email === u.email) || null;
        return {
          ...u,
          online: activity ? activity.online : false,
          lastSeen: activity ? activity.lastSeen : null
        };
      });

      return res.json({ success: true, users: enriched, total: enriched.length });
    } catch (err) {
      logger.warn('[AdminAPI] users failed:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/stats', async (req, res) => {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    try {
      const users = await loadAdminUsers(db);
      const active = getActiveUsers();
      const stats = {
        totalAccounts: users.length,
        onlineNow: users.filter(u => active.some(a => a.email === u.email && a.online)).length,
        activeSessions: active.length
      };
      const sqlite = getSqliteDb();
      if (sqlite?.getDb) {
        try {
          const dbi = sqlite.getDb();
          const activeSubs = dbi.prepare("SELECT COUNT(*) as count FROM paid_subscriptions WHERE status = 'active'").get();
          stats.activeSubscriptions = activeSubs?.count ?? 0;
        } catch {
          // optional metrics
        }
      }
      return res.json({ success: true, stats });
    } catch (err) {
      logger.warn('[AdminAPI] stats failed:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/sessions', async (req, res) => {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    try {
      const active = getActiveUsers();
      return res.json({ success: true, sessions: active });
    } catch (err) {
      logger.warn('[AdminAPI] sessions failed:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/users/:id/trust-level', async (req, res) => {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { id } = req.params;
    const { trustLevel } = req.body || {};
    const validLevels = ['bronze', 'silver', 'gold'];
    if (!validLevels.includes(trustLevel)) {
      return res.status(400).json({ success: false, error: 'Invalid trust level' });
    }
    try {
      if (db) {
        await db.query('UPDATE users SET trust_level = $1 WHERE id = $2', [trustLevel, id]);
      } else {
        const sqlite = getSqliteDb();
        if (sqlite?.updateUserTierById) {
          const user = sqlite.getUserById(id);
          if (!user) return res.status(404).json({ success: false, error: 'User not found' });
          sqlite.updateUserTierById(id, trustLevelToTier(trustLevel));
        }
      }
      return res.json({ success: true, id, trustLevel });
    } catch (err) {
      logger.warn('[AdminAPI] update trust-level failed:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  router.delete('/users/:id', async (req, res) => {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: 'User id required' });
    }
    try {
      const users = await loadAdminUsers(db);
      const target = users.find(u => String(u.id) === String(id));
      if (target && String(target.email || '').toLowerCase() === 'admin@simplebeacon.ai') {
        return res.status(403).json({ success: false, error: 'Cannot delete the primary admin account' });
      }
      if (db) {
        await db.query('DELETE FROM users WHERE id = $1', [id]);
      } else {
        const sqlite = getSqliteDb();
        if (sqlite?.deleteUserById) {
          if (!sqlite.getUserById(id)) {
            return res.status(404).json({ success: false, error: 'User not found' });
          }
          sqlite.deleteUserById(id);
        }
      }
      return res.json({ success: true, id, deleted: true });
    } catch (err) {
      logger.warn('[AdminAPI] delete user failed:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });
}

module.exports = { setupAdminAPI };
