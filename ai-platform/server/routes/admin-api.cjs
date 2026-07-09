'use strict';

const rateLimit = require('express-rate-limit');
const constants = require('../config/constants.cjs');
const { getActiveUsers } = require('../lib/session-activity.cjs');
const { authenticate } = require('../middleware/auth.cjs');

function isAdmin(req) {
  if (!req.user) return false;
  const role = String(req.user.role || '').toLowerCase();
  const tier = String(req.user.tier || '').toLowerCase();
  if (role === 'admin' || role === 'superuser') return true;
  if (tier === 'admin' || tier === 'superuser') return true;
  if (Array.isArray(req.user.features) && req.user.features.map(String).map(s => s.toLowerCase()).includes('all_modules')) return true;
  if (Array.isArray(req.user.permissions) && req.user.permissions.includes('admin:all')) return true;
  return false;
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

  app.get('/api/admin/users', authenticate, adminRateLimit, async (req, res) => {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    try {
      let users = [];
      if (db) {
        const result = await db.query(
          `SELECT id, email, name, trust_level, verification_status,
                  successful_analyses, security_incidents, community_contributions,
                  created_at
           FROM users
           ORDER BY created_at DESC`
        );
        users = result.rows.map(row => ({
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
      } else {
        const { loadDemoUsers } = require('../services/user-service.cjs');
        const demoUsers = loadDemoUsers();
        users = demoUsers.map(u => ({
          id: u.id,
          email: u.email,
          name: u.name,
          trustLevel: u.trustLevel,
          verificationStatus: u.verificationStatus,
          successfulAnalyses: u.successfulAnalyses || 0,
          securityIncidents: u.securityIncidents || 0,
          communityContributions: u.communityContributions || 0,
          createdAt: u.createdAt || null,
          source: 'demo'
        }));
      }

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

      return res.json({ success: true, users: enriched });
    } catch (err) {
      console.warn('[AdminAPI] users failed:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/admin/sessions', authenticate, adminRateLimit, async (req, res) => {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    try {
      const active = getActiveUsers();
      return res.json({ success: true, sessions: active });
    } catch (err) {
      console.warn('[AdminAPI] sessions failed:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/admin/users/:id/trust-level', authenticate, adminRateLimit, async (req, res) => {
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
      }
      return res.json({ success: true, id, trustLevel });
    } catch (err) {
      console.warn('[AdminAPI] update trust-level failed:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/admin/users/:id', authenticate, adminRateLimit, async (req, res) => {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: 'User id required' });
    }
    try {
      if (db) {
        await db.query('DELETE FROM users WHERE id = $1', [id]);
      }
      return res.json({ success: true, id, deleted: true });
    } catch (err) {
      console.warn('[AdminAPI] delete user failed:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });
}

module.exports = { setupAdminAPI };
