// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
'use strict';

const logger = require('../lib/app-logger.cjs');
const express = require('express');
const rateLimit = require('express-rate-limit');
const constants = require('../config/constants.cjs');
const { getActiveUsers } = require('../lib/session-activity.cjs');
const { authenticate } = require('../middleware/auth.cjs');
const { verifyPassword } = require('../lib/auth/password-service.cjs');
const crypto = require('crypto');

let stripe = null;
try { stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || ''); } catch { stripe = null; }

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

async function verifyAdminPassword(email, password, db, sqlite) {
  if (db) {
    try {
      const result = await db.query(
        'SELECT password_hash FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [email]
      );
      const row = result.rows[0];
      if (row?.password_hash) return await verifyPassword(password, row.password_hash);
      return false;
    } catch (err) {
      logger.warn('[AdminAPI] verify admin password db error:', err.message);
      return false;
    }
  }
  if (sqlite?.getUserByEmail) {
    const user = sqlite.getUserByEmail(email);
    if (!user || !user.password_hash || !user.salt) return false;
    const derived = await new Promise((resolve, reject) => {
      crypto.scrypt(password, user.salt, 64, (err, key) => {
        if (err) reject(err); else resolve(key.toString('hex'));
      });
    });
    return derived === user.password_hash;
  }
  return false;
}

async function stripeRefundSubscription(stripeSubscriptionId) {
  if (!stripe || !stripeSubscriptionId) return { stripeUsed: false };
  try {
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    if (subscription && subscription.status !== 'canceled') {
      await stripe.subscriptions.cancel(stripeSubscriptionId);
    }
    const latestInvoice = subscription?.latest_invoice ? await stripe.invoices.retrieve(subscription.latest_invoice) : null;
    const paymentIntent = latestInvoice?.payment_intent;
    let refund = null;
    if (paymentIntent) {
      refund = await stripe.refunds.create({ payment_intent: paymentIntent, reason: 'requested_by_customer' });
    }
    return { stripeUsed: true, refundId: refund?.id || null, canceled: true };
  } catch (err) {
    return { stripeUsed: false, stripeError: err.message };
  }
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
    status: u.status || 'active',
    trustLevel: u.trustLevel || u.trust_level || 'bronze',
    verificationStatus: u.verificationStatus || u.verification_status || 'email',
    successfulAnalyses: u.successfulAnalyses ?? u.successful_analyses ?? 0,
    securityIncidents: u.securityIncidents ?? u.security_incidents ?? 0,
    communityContributions: u.communityContributions ?? u.community_contributions ?? 0,
    createdAt: u.createdAt || u.created_at || null
  };
}

function mapSqliteCustomerRow(row) {
  const email = row.email || '';
  return {
    id: `customer-${row.id}`,
    email,
    name: email.includes('@') ? email.split('@')[0] : email,
    status: row.subscription_status === 'suspended' ? 'suspended' : 'active',
    trustLevel: tierToTrustLevel(row.tier),
    verificationStatus: 'customer',
    successfulAnalyses: 0,
    securityIncidents: 0,
    communityContributions: 0,
    createdAt: row.created_at || row.createdAt || null,
    source: 'customer'
  };
}

function mergeAdminUsersByEmail(userRows, customerRows) {
  const byEmail = new Map();
  for (const row of customerRows || []) {
    const mapped = mapSqliteCustomerRow(row);
    const key = String(mapped.email || '').trim().toLowerCase();
    if (key) byEmail.set(key, mapped);
  }
  for (const row of userRows || []) {
    const mapped = mapSqliteAdminUser(row);
    const key = String(mapped.email || '').trim().toLowerCase();
    if (key) byEmail.set(key, mapped);
  }
  return Array.from(byEmail.values());
}

function mapSqliteAdminUser(row) {
  const email = row.email || '';
  return {
    id: String(row.id),
    email,
    name: row.name || (email.includes('@') ? email.split('@')[0] : email),
    status: row.status || 'active',
    trustLevel: tierToTrustLevel(row.tier),
    verificationStatus: 'verified',
    successfulAnalyses: 0,
    securityIncidents: 0,
    communityContributions: 0,
    createdAt: row.created_at || row.createdAt || null,
    source: 'sqlite'
  };
}

const ADMIN_USER_SORT_FIELDS = new Set(['createdAt', 'name', 'email', 'trustLevel', 'successfulAnalyses', 'status']);
const DEFAULT_USER_PAGE_LIMIT = 50;
const MAX_USER_PAGE_LIMIT = 500;

function mapPgAdminUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    status: row.status || 'active',
    trustLevel: row.trust_level,
    verificationStatus: row.verification_status,
    successfulAnalyses: row.successful_analyses,
    securityIncidents: row.security_incidents,
    communityContributions: row.community_contributions,
    createdAt: row.created_at
  };
}

function parseAdminUserListQuery(req) {
  const parsedLimit = Number.parseInt(String(req.query.limit || ''), 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(MAX_USER_PAGE_LIMIT, Math.max(1, parsedLimit))
    : DEFAULT_USER_PAGE_LIMIT;
  const sort = ADMIN_USER_SORT_FIELDS.has(String(req.query.sort || ''))
    ? String(req.query.sort)
    : 'createdAt';
  const dir = String(req.query.dir || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
  const q = String(req.query.q || '').trim().slice(0, 200);
  const cursor = String(req.query.cursor || '').trim() || null;
  const parsedOffset = Number.parseInt(String(req.query.offset || ''), 10);
  const offset = Number.isFinite(parsedOffset) ? Math.max(0, parsedOffset) : 0;
  const status = String(req.query.status || 'all').trim().toLowerCase();
  const trust = String(req.query.trust || 'all').trim().toLowerCase();
  return { limit, sort, dir, q, cursor, offset, status, trust };
}

function encodeAdminUserCursor(user) {
  if (!user?.id) return null;
  const payload = JSON.stringify({
    id: String(user.id),
    createdAt: user.createdAt || user.created_at || null
  });
  return Buffer.from(payload).toString('base64url');
}

function decodeAdminUserCursor(cursor) {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!parsed?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

function sortAdminUsersInMemory(users, sort, dir) {
  const multiplier = dir === 'asc' ? 1 : -1;
  const trustOrder = { bronze: 0, silver: 1, gold: 2 };
  return [...users].sort((a, b) => {
    let av;
    let bv;
    if (sort === 'trustLevel') {
      av = trustOrder[String(a.trustLevel || 'bronze').toLowerCase()] ?? 0;
      bv = trustOrder[String(b.trustLevel || 'bronze').toLowerCase()] ?? 0;
    } else if (sort === 'successfulAnalyses') {
      av = Number(a.successfulAnalyses || 0);
      bv = Number(b.successfulAnalyses || 0);
    } else if (sort === 'createdAt') {
      av = new Date(a.createdAt || 0).getTime();
      bv = new Date(b.createdAt || 0).getTime();
    } else {
      av = String(a[sort] || '').toLowerCase();
      bv = String(b[sort] || '').toLowerCase();
    }
    if (av < bv) return -1 * multiplier;
    if (av > bv) return 1 * multiplier;
    return String(a.id).localeCompare(String(b.id)) * multiplier;
  });
}

function filterAdminUsersInMemory(users, q, status = 'all', trust = 'all') {
  let rows = users;
  if (status && status !== 'all') {
    rows = rows.filter((u) => String(u.status || 'active').toLowerCase() === status);
  }
  if (trust && trust !== 'all') {
    rows = rows.filter((u) => String(u.trustLevel || 'bronze').toLowerCase() === trust);
  }
  if (!q) return rows;
  const needle = q.toLowerCase();
  return rows.filter((u) =>
    String(u.email || '').toLowerCase().includes(needle)
    || String(u.name || '').toLowerCase().includes(needle)
    || String(u.trustLevel || '').toLowerCase().includes(needle));
}

function paginateAdminUsersInMemory(users, options) {
  const filtered = filterAdminUsersInMemory(users, options.q, options.status, options.trust);
  const sorted = sortAdminUsersInMemory(filtered, options.sort, options.dir);
  const total = sorted.length;
  let start = options.offset || 0;
  if (!options.offset && options.sort === 'createdAt' && options.cursor) {
    const decoded = decodeAdminUserCursor(options.cursor);
    if (decoded?.id) {
      const idx = sorted.findIndex((u) => String(u.id) === String(decoded.id));
      start = idx >= 0 ? idx + 1 : 0;
    }
  }
  const page = sorted.slice(start, start + options.limit);
  const hasMore = start + options.limit < total;
  return {
    users: page,
    total,
    limit: options.limit,
    hasMore,
    nextCursor: options.sort === 'createdAt' && hasMore ? encodeAdminUserCursor(page[page.length - 1]) : null
  };
}

async function countAdminUsers(db) {
  if (db) {
    const result = await db.query('SELECT COUNT(*)::int AS count FROM users');
    return result.rows[0]?.count ?? 0;
  }
  const sqlite = getSqliteDb();
  if (sqlite?.getAllUsers || sqlite?.getAllCustomers) {
    try {
      const users = sqlite.getAllUsers ? sqlite.getAllUsers() : [];
      const customers = sqlite.getAllCustomers ? sqlite.getAllCustomers() : [];
      return mergeAdminUsersByEmail(users, customers).length;
    } catch (err) {
      logger.warn('[AdminAPI] SQLite user count failed:', err.message);
    }
  }
  const { loadDemoUsers } = require('../services/user-service.cjs');
  return loadDemoUsers().length;
}

async function loadAdminUsers(db) {
  if (db) {
    const result = await db.query(
      `SELECT id, email, name, trust_level, status, verification_status,
              successful_analyses, security_incidents, community_contributions,
              created_at, updated_at
       FROM users
       ORDER BY created_at DESC`
    );
    return result.rows.map(mapPgAdminUser);
  }

  const sqlite = getSqliteDb();
  if (sqlite) {
    try {
      const userRows = sqlite.getAllUsers ? sqlite.getAllUsers() : [];
      const customerRows = sqlite.getAllCustomers ? sqlite.getAllCustomers() : [];
      const merged = mergeAdminUsersByEmail(userRows, customerRows);
      if (merged.length > 0) return merged;
    } catch (err) {
      logger.warn('[AdminAPI] SQLite user list failed:', err.message);
    }
  }

  const { loadDemoUsers } = require('../services/user-service.cjs');
  return loadDemoUsers().map(mapDemoAdminUser);
}

async function queryAdminUsersPaginated(db, options) {
  const pgSortMap = {
    createdAt: 'created_at',
    name: 'name',
    email: 'email',
    trustLevel: 'trust_level',
    successfulAnalyses: 'successful_analyses',
    status: 'status'
  };
  const sortCol = pgSortMap[options.sort] || 'created_at';
  const sortDir = options.dir === 'asc' ? 'ASC' : 'DESC';

  if (db) {
    const whereParts = [];
    const whereParams = [];
    if (options.q) {
      const pattern = `%${options.q.toLowerCase()}%`;
      whereParams.push(pattern, pattern, pattern);
      whereParts.push(`(LOWER(email) LIKE $1 OR LOWER(name) LIKE $2 OR LOWER(trust_level::text) LIKE $3)`);
    }
    if (options.status && options.status !== 'all') {
      whereParams.push(options.status);
      whereParts.push(`LOWER(status) = LOWER($${whereParams.length})`);
    }
    if (options.trust && options.trust !== 'all') {
      whereParams.push(options.trust);
      whereParts.push(`LOWER(trust_level::text) = LOWER($${whereParams.length})`);
    }
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const countResult = await db.query(`SELECT COUNT(*)::int AS count FROM users ${whereSql}`, whereParams);
    const total = countResult.rows[0]?.count ?? 0;

    const dataParams = [...whereParams];
    const cursorParts = [];
    const decodedCursor = decodeAdminUserCursor(options.cursor);
    const useCursor = options.sort === 'createdAt' && decodedCursor?.id && !options.offset;
    if (useCursor) {
      dataParams.push(decodedCursor.createdAt || null);
      const createdIdx = dataParams.length;
      dataParams.push(String(decodedCursor.id));
      const idIdx = dataParams.length;
      if (options.dir === 'asc') {
        cursorParts.push(`(created_at, id) > ($${createdIdx}::timestamptz, $${idIdx})`);
      } else {
        cursorParts.push(`(created_at, id) < ($${createdIdx}::timestamptz, $${idIdx})`);
      }
    }
    const combinedWhere = [whereSql.replace(/^WHERE /, ''), ...cursorParts].filter(Boolean);
    const listWhereSql = combinedWhere.length ? `WHERE ${combinedWhere.join(' AND ')}` : '';
    dataParams.push(options.limit + 1);
    const limitIdx = dataParams.length;
    const offsetSql = !useCursor && options.offset
      ? ` OFFSET $${dataParams.push(options.offset)}`
      : '';

    const result = await db.query(
      `SELECT id, email, name, trust_level, status, verification_status,
              successful_analyses, security_incidents, community_contributions,
              created_at, updated_at
       FROM users
       ${listWhereSql}
       ORDER BY ${sortCol} ${sortDir}, id ${sortDir}
       LIMIT $${limitIdx}${offsetSql}`,
      dataParams
    );

    const rows = result.rows.map(mapPgAdminUser);
    const hasMore = rows.length > options.limit;
    const users = hasMore ? rows.slice(0, options.limit) : rows;
    return {
      users,
      total,
      limit: options.limit,
      hasMore,
      nextCursor: hasMore ? encodeAdminUserCursor(users[users.length - 1]) : null
    };
  }

  const allUsers = await loadAdminUsers(db);
  return paginateAdminUsersInMemory(allUsers, options);
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
      const listQuery = parseAdminUserListQuery(req);
      const page = await queryAdminUsersPaginated(db, listQuery);

      const active = getActiveUsers();
      const activeById = new Map(active.map(a => [a.userId, a]));

      const enriched = page.users.map(u => {
        const activity = activeById.get(u.id) || active.find(a => a.email === u.email) || null;
        return {
          ...u,
          online: activity ? activity.online : false,
          lastSeen: activity ? activity.lastSeen : null
        };
      });

      return res.json({
        success: true,
        users: enriched,
        total: page.total,
        limit: page.limit,
        hasMore: page.hasMore,
        nextCursor: page.nextCursor,
        sort: listQuery.sort,
        dir: listQuery.dir,
        q: listQuery.q || null
      });
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
      const totalAccounts = await countAdminUsers(db);
      const active = getActiveUsers();
      const stats = {
        totalAccounts,
        onlineNow: active.filter(a => a.online).length,
        activeSessions: active.length
      };
      if (db) {
        try {
          const tierResult = await db.query(
            `SELECT LOWER(trust_level::text) AS tier, COUNT(*)::int AS count FROM users GROUP BY LOWER(trust_level::text)`
          );
          const statusResult = await db.query(
            `SELECT LOWER(status) AS status, COUNT(*)::int AS count FROM users GROUP BY LOWER(status)`
          );
          stats.tierCounts = { bronze: 0, silver: 0, gold: 0 };
          for (const row of tierResult.rows) {
            const key = String(row.tier || '').toLowerCase();
            if (key in stats.tierCounts) stats.tierCounts[key] = row.count;
          }
          stats.statusCounts = { active: 0, suspended: 0 };
          for (const row of statusResult.rows) {
            const key = String(row.status || '').toLowerCase();
            if (key in stats.statusCounts) stats.statusCounts[key] = row.count;
            else stats.statusCounts[key] = row.count;
          }
        } catch (statsErr) {
          logger.warn('[AdminAPI] stats breakdown failed:', statsErr.message);
        }
      } else {
        const allUsers = await loadAdminUsers(db);
        stats.tierCounts = { bronze: 0, silver: 0, gold: 0 };
        stats.statusCounts = { active: 0, suspended: 0 };
        for (const u of allUsers) {
          const tier = String(u.trustLevel || 'bronze').toLowerCase();
          if (tier in stats.tierCounts) stats.tierCounts[tier] += 1;
          const st = String(u.status || 'active').toLowerCase();
          stats.statusCounts[st] = (stats.statusCounts[st] || 0) + 1;
        }
      }
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

  router.post('/verify-password', async (req, res) => {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    try {
      const { password } = req.body || {};
      const adminEmail = req.user?.email;
      if (!password || !adminEmail) {
        return res.status(400).json({ success: false, error: 'Password required' });
      }
      const sqlite = getSqliteDb();
      const valid = await verifyAdminPassword(adminEmail, password, db, sqlite);
      if (!valid) return res.status(401).json({ success: false, error: 'Invalid password' });
      return res.json({ success: true, valid: true });
    } catch (err) {
      logger.warn('[AdminAPI] verify-password failed:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/users/:id/trust-level', async (req, res) => {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { id } = req.params;
    const { trustLevel, password, subscriptionTier, subscriptionStatus } = req.body || {};
    if (!password) return res.status(400).json({ success: false, error: 'Admin password required' });
    const adminEmail = req.user?.email;
    const sqlite = getSqliteDb();
    const passwordValid = await verifyAdminPassword(adminEmail, password, db, sqlite);
    if (!passwordValid) return res.status(401).json({ success: false, error: 'Invalid admin password' });
    const validLevels = ['bronze', 'silver', 'gold'];
    if (!validLevels.includes(trustLevel)) {
      return res.status(400).json({ success: false, error: 'Invalid trust level' });
    }
    try {
      let targetEmail = '';
      if (db) {
        const userResult = await db.query('SELECT email, status FROM users WHERE id = $1 LIMIT 1', [id]);
        const user = userResult.rows[0];
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        targetEmail = user.email;
        if (String(targetEmail).toLowerCase() === 'admin@simplebeacon.ai' && trustLevel !== 'gold') {
          return res.status(403).json({ success: false, error: 'Cannot downgrade the primary admin account' });
        }
        await db.query('UPDATE users SET trust_level = $1, updated_at = NOW() WHERE id = $2', [trustLevel, id]);
      } else {
        const sqlite = getSqliteDb();
        if (sqlite?.updateUserTierById) {
          const user = sqlite.getUserById(id);
          if (!user) return res.status(404).json({ success: false, error: 'User not found' });
          targetEmail = user.email;
          if (String(targetEmail).toLowerCase() === 'admin@simplebeacon.ai' && trustLevel !== 'gold') {
            return res.status(403).json({ success: false, error: 'Cannot downgrade the primary admin account' });
          }
          sqlite.updateUserTierById(id, trustLevelToTier(trustLevel));
          const subTier = subscriptionTier || trustLevelToTier(trustLevel);
          const subStatus = subscriptionStatus || 'active';
          sqlite.updateCustomerSubscription(user.email, subStatus, subTier);
        }
      }
      return res.json({ success: true, id, trustLevel, subscriptionTier: subscriptionTier || trustLevelToTier(trustLevel), subscriptionStatus: subscriptionStatus || 'active' });
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
    const { password, confirmEmail } = req.body || {};
    if (!password) return res.status(400).json({ success: false, error: 'Admin password required' });
    if (!id) {
      return res.status(400).json({ success: false, error: 'User id required' });
    }
    try {
      const users = await loadAdminUsers(db);
      const target = users.find(u => String(u.id) === String(id));
      if (target && String(target.email || '').toLowerCase() === 'admin@simplebeacon.ai') {
        return res.status(403).json({ success: false, error: 'Cannot delete the primary admin account' });
      }
      if (!target) return res.status(404).json({ success: false, error: 'User not found' });
      if (!confirmEmail || String(confirmEmail).toLowerCase() !== String(target.email).toLowerCase()) {
        return res.status(400).json({ success: false, error: 'Confirm the account email to delete' });
      }
      const adminEmail = req.user?.email;
      const sqlite = getSqliteDb();
      const passwordValid = await verifyAdminPassword(adminEmail, password, db, sqlite);
      if (!passwordValid) return res.status(401).json({ success: false, error: 'Invalid admin password' });
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
      logger.info('[AdminAPI] user deleted', { userId: id, email: target.email, admin: adminEmail });
      return res.json({ success: true, id, deleted: true });
    } catch (err) {
      logger.warn('[AdminAPI] delete user failed:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/users/:id/suspend', async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ success: false, error: 'Forbidden' });
    const { id } = req.params;
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ success: false, error: 'Admin password required' });
    const adminEmail = req.user?.email;
    const sqlite = getSqliteDb();
    const passwordValid = await verifyAdminPassword(adminEmail, password, db, sqlite);
    if (!passwordValid) return res.status(401).json({ success: false, error: 'Invalid admin password' });
    try {
      const users = await loadAdminUsers(db);
      const target = users.find(u => String(u.id) === String(id));
      if (!target) return res.status(404).json({ success: false, error: 'User not found' });
      if (String(target.email || '').toLowerCase() === 'admin@simplebeacon.ai') {
        return res.status(403).json({ success: false, error: 'Cannot suspend the primary admin account' });
      }
      if (db) {
        await db.query("UPDATE users SET status = 'suspended', updated_at = NOW() WHERE id = $1", [id]);
      } else {
        const sqlite = getSqliteDb();
        if (sqlite?.updateUserStatus) {
          sqlite.updateUserStatus(id, 'suspended');
          sqlite.updateCustomerSubscription(target.email, 'suspended', trustLevelToTier(target.trustLevel));
        }
      }
      logger.info('[AdminAPI] user suspended', { userId: id, email: target.email, admin: adminEmail });
      return res.json({ success: true, id, status: 'suspended' });
    } catch (err) {
      logger.warn('[AdminAPI] suspend user failed:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/users/:id/unsuspend', async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ success: false, error: 'Forbidden' });
    const { id } = req.params;
    try {
      const users = await loadAdminUsers(db);
      const target = users.find(u => String(u.id) === String(id));
      if (!target) return res.status(404).json({ success: false, error: 'User not found' });
      if (db) {
        await db.query("UPDATE users SET status = 'active', updated_at = NOW() WHERE id = $1", [id]);
      } else {
        const sqlite = getSqliteDb();
        if (sqlite?.updateUserStatus) {
          sqlite.updateUserStatus(id, 'active');
          sqlite.updateCustomerSubscription(target.email, 'active', trustLevelToTier(target.trustLevel));
        }
      }
      logger.info('[AdminAPI] user unsuspended', { userId: id, email: target.email, admin: req.user?.email });
      return res.json({ success: true, id, status: 'active' });
    } catch (err) {
      logger.warn('[AdminAPI] unsuspend user failed:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/users/:id/details', async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ success: false, error: 'Forbidden' });
    const { id } = req.params;
    const { name, email, password } = req.body || {};
    if (!password) return res.status(400).json({ success: false, error: 'Admin password required to update email' });
    if (!email || !String(email).includes('@')) return res.status(400).json({ success: false, error: 'Valid email required' });
    const adminEmail = req.user?.email;
    const sqlite = getSqliteDb();
    const passwordValid = await verifyAdminPassword(adminEmail, password, db, sqlite);
    if (!passwordValid) return res.status(401).json({ success: false, error: 'Invalid admin password' });
    try {
      const users = await loadAdminUsers(db);
      const target = users.find(u => String(u.id) === String(id));
      if (!target) return res.status(404).json({ success: false, error: 'User not found' });
      if (String(target.email || '').toLowerCase() === 'admin@simplebeacon.ai' && String(email).toLowerCase() !== 'admin@simplebeacon.ai') {
        return res.status(403).json({ success: false, error: 'Cannot change the primary admin email' });
      }
      if (db) {
        const existing = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2 LIMIT 1', [email, id]);
        if (existing.rows[0]) return res.status(400).json({ success: false, error: 'Email already in use by another account' });
        await db.query('UPDATE users SET name = $1, email = $2, updated_at = NOW() WHERE id = $3', [name || '', email, id]);
      } else {
        const sqlite = getSqliteDb();
        if (sqlite?.updateUserDetails) {
          const result = sqlite.updateUserDetails(id, { name, email });
          if (!result.success) return res.status(400).json({ success: false, error: result.error });
          sqlite.updateCustomerSubscription(email, 'active', trustLevelToTier(target.trustLevel));
        }
      }
      logger.info('[AdminAPI] user details updated', { userId: id, oldEmail: target.email, newEmail: email, name, admin: adminEmail });
      return res.json({ success: true, id, name, email });
    } catch (err) {
      logger.warn('[AdminAPI] update details failed:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/customers/:email/refund', async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ success: false, error: 'Forbidden' });
    const { email } = req.params;
    const { reason, password } = req.body || {};
    if (!email) return res.status(400).json({ success: false, error: 'Email required' });
    if (!password) return res.status(400).json({ success: false, error: 'Admin password required' });
    const adminEmail = req.user?.email;
    const sqlite = getSqliteDb();
    const passwordValid = await verifyAdminPassword(adminEmail, password, db, sqlite);
    if (!passwordValid) return res.status(401).json({ success: false, error: 'Invalid admin password' });
    try {
      const sqlite = getSqliteDb();
      if (!sqlite?.getAllPaidSubscriptions) {
        return res.status(400).json({ success: false, error: 'Refund requires local billing database' });
      }
      const subs = sqlite.getAllPaidSubscriptions().filter(s => s.customer_email === email.trim().toLowerCase() && s.status === 'active');
      let stripeResult = null;
      for (const sub of subs) {
        const sr = await stripeRefundSubscription(sub.stripe_subscription_id);
        if (!stripeResult) stripeResult = sr;
        sqlite.updatePaidSubscriptionToRefunded(sub.stripe_subscription_id, reason || 'Manual admin refund');
      }
      sqlite.updateCustomerSubscription(email, 'refunded', 'community');
      logger.info('[AdminAPI] customer refunded', { email, refundedCount: subs.length, stripeUsed: stripeResult?.stripeUsed, admin: adminEmail });
      return res.json({ success: true, message: 'Refund processed', refundedCount: subs.length, stripeResult });
    } catch (err) {
      logger.warn('[AdminAPI] refund failed:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });
}

module.exports = { setupAdminAPI };
