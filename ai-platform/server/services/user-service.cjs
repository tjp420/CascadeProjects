/**
 * User authentication service — PostgreSQL with demo-user file fallback.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { hashPassword, verifyPassword } = require('../lib/auth/password-service.cjs');
const logger = require('../lib/app-logger.cjs');
const { readJsonFileCached } = require('../lib/json-file-cache.cjs');

const constants = require('../config/constants.cjs');

function resolveDemoUsersPath() {
    const candidates = [
        path.join(__dirname, '..', 'db', 'demo-users.json'),
        path.join(__dirname, '..', '..', 'server', 'db', 'demo-users.json'),
        path.join(process.cwd(), 'ai-platform', 'server', 'db', 'demo-users.json')
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
    }
    return candidates[0];
}

const DEMO_USERS_PATH = resolveDemoUsersPath();

/**
 * Should log runtime info.
 * @returns {any}
 */
function shouldLogRuntimeInfo() {
    return process.env.LOG_RUNTIME_INFO === 'true' || process.env.RUNTIME_DEBUG === 'true';
}

let sqliteDemoSeeded = false;

function getSqliteDb() {
    try {
        return require('../../../coming-soon/lib/db.cjs');
    } catch (error) {
        logger.warn('[UserService] SQLite auth module unavailable:', error.message);
        return null;
    }
}

function ensureSqliteDemoUsers() {
    if (sqliteDemoSeeded) return;
    sqliteDemoSeeded = true;
    const sqlite = getSqliteDb();
    if (!sqlite) return;
    const demoUsers = [
        { email: 'dev@simplebeacon.ai', password: process.env.DEV_DEMO_PASSWORD || 'demo123', tier: 'silver' },
        { email: 'admin@simplebeacon.ai', password: process.env.ADMIN_DEMO_PASSWORD || 'admin123', tier: 'admin' }
    ];
    for (const u of demoUsers) {
        if (sqlite.getUserByEmail(u.email)) continue;
        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = crypto.scryptSync(u.password, salt, 64).toString('hex');
        try {
            sqlite.createUser(u.email, passwordHash, salt, u.tier);
        } catch (err) {
            logger.warn('[UserService] SQLite demo seed failed for', u.email, err.message);
        }
    }
    const adminUser = sqlite.getUserByEmail('admin@simplebeacon.ai');
    if (adminUser && adminUser.tier !== 'admin') {
        sqlite.updateUserTier('admin@simplebeacon.ai', 'admin');
    }
}

function sqliteUserToAuthUser(user) {
    const email = user.email || '';
    const tier = user.tier || 'community';
    return {
        id: String(user.id != null ? user.id : email),
        email,
        username: user.username || '',
        name: user.name || (email.includes('@') ? email.split('@')[0] : email),
        status: user.status || 'active',
        trustLevel: tier === 'admin' ? 'gold' : (tier === 'silver' ? 'silver' : 'bronze'),
        role: tier === 'admin' ? 'admin' : undefined,
        tier,
        features: tier === 'admin' ? ['all_modules'] : [],
        createdAt: user.created_at || user.createdAt || new Date().toISOString(),
        successfulAnalyses: 0,
        securityIncidents: 0,
        communityContributions: 0,
        verificationStatus: tier === 'admin' ? 'verified' : 'email'
    };
}

async function authenticateWithSqlite(identifier, password) {
    const sqlite = getSqliteDb();
    if (!sqlite) return null;
    ensureSqliteDemoUsers();
    let user = sqlite.getUserByEmail(identifier);
    if (!user && typeof sqlite.getUserByUsername === 'function') {
        user = sqlite.getUserByUsername(identifier);
    }
    if (!user) return null;
    const passwordHash = crypto.scryptSync(String(password), user.salt, 64).toString('hex');
    if (passwordHash !== user.password_hash) return null;
    return sqliteUserToAuthUser(user);
}

function registerUserSqlite(email, password, name, options = {}) {
    const sqlite = getSqliteDb();
    if (!sqlite) return null;
    ensureSqliteDemoUsers();
    const normalizedEmail = String(email).trim().toLowerCase();
    const username = String(options.username || '').trim().toLowerCase();
    const status = options.status || 'active';
    if (sqlite.getUserByEmail(normalizedEmail)) {
        return { error: 'An account with this email already exists' };
    }
    if (username && typeof sqlite.getUserByUsername === 'function' && sqlite.getUserByUsername(username)) {
        return { error: 'That username is already taken' };
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = crypto.scryptSync(String(password), salt, 64).toString('hex');
    const user = typeof sqlite.createUser === 'function'
        ? sqlite.createUser(normalizedEmail, passwordHash, salt, 'community', { name, username, status })
        : sqlite.createUser(normalizedEmail, passwordHash, salt, 'community');
    return { user: sqliteUserToAuthUser(user) };
}

/**
 * Load demo users.
 * @returns {any}
 */
function loadDemoUsers() {
    try {
        const users = readJsonFileCached(DEMO_USERS_PATH);
        return Array.isArray(users) ? users : [];
    } catch (error) {
        logger.warn('[UserService] Demo users file unavailable:', error.message);
        return [];
    }
}

/**
 * To auth user.
 * @param {any} row
 * @returns {any}
 */
function toAuthUser(row) {
    return {
        id: row.id,
        email: row.email,
        username: row.username || '',
        name: row.name,
        status: row.status || 'active',
        trustLevel: row.trust_level || row.trustLevel || 'bronze',
        createdAt: row.created_at || row.createdAt || new Date().toISOString(),
        successfulAnalyses: row.successful_analyses ?? row.successfulAnalyses ?? 0,
        securityIncidents: row.security_incidents ?? row.securityIncidents ?? 0,
        communityContributions: row.community_contributions ?? row.communityContributions ?? 0,
        verificationStatus: row.verification_status || row.verificationStatus || 'email'
    };
}

/**
 * Find user by email or username.
 * @param {any} db
 * @param {string} identifier
 * @returns {any}
 */
async function findUserByEmail(db, identifier) {
    const emailLookupQuery = await db.query(
        `SELECT id, email, password_hash, name, trust_level, status, successful_analyses,
                security_incidents, community_contributions, verification_status, created_at
         FROM users WHERE LOWER(email) = LOWER($1)
            OR LOWER(username) = LOWER($1) LIMIT 1`,
        [identifier]
    );
    return emailLookupQuery.rows[0] || null;
}

/**
 * Seed demo users.
 * @param {any} db
 * @returns {any}
 */
async function seedDemoUsers(db) {
    const demoUsers = loadDemoUsers();
    for (const user of demoUsers) {
        const passwordHash = user.passwordHash || await hashPassword(user.password);
        await db.query(
            `INSERT INTO users (
                id, email, password_hash, name, trust_level,
                successful_analyses, security_incidents, community_contributions, verification_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (email) DO NOTHING`,
            [
                user.id,
                user.email,
                passwordHash,
                user.name,
                user.trustLevel || 'bronze',
                user.successfulAnalyses || 0,
                user.securityIncidents || 0,
                user.communityContributions || 0,
                user.verificationStatus || 'email'
            ]
        );
    }
    if (shouldLogRuntimeInfo()) {
        logger.info(`[UserService] Seeded ${demoUsers.length} demo users`);
    }
}

/**
 * Authenticate with database.
 * @param {any} db
 * @param {string} email
 * @param {string} password
 * @returns {any}
 */
async function authenticateWithDatabase(db, identifier, password) {
    const row = await findUserByEmail(db, identifier);
    if (!row) return null;

    const valid = await verifyPassword(password, row.password_hash);
    if (!valid) return null;

    const user = toAuthUser(row);
    // Demo file may carry role/features/tier overrides for seeded accounts; merge them in
    // so admin/superuser bypasses for paid deliverables work without a DB schema change.
    const demoUsers = loadDemoUsers();
    const demoMatch = demoUsers.find((u) =>
        u.email.toLowerCase() === String(identifier).toLowerCase() ||
        String(u.username || '').toLowerCase() === String(identifier).toLowerCase()
    );
    if (demoMatch) {
        if (demoMatch.role && !user.role) user.role = demoMatch.role;
        if (Array.isArray(demoMatch.features)) user.features = demoMatch.features;
        if (demoMatch.tier && !user.tier) user.tier = demoMatch.tier;
    }
    return user;
}

/**
 * Authenticate with demo file.
 * @param {string} email
 * @param {string} password
 * @returns {any}
 */
async function authenticateWithDemoFile(identifier, password) {
    const demoUsers = loadDemoUsers();
    const lower = String(identifier || '').toLowerCase();
    const match = demoUsers.find((user) =>
        user.email.toLowerCase() === lower ||
        String(user.username || '').toLowerCase() === lower
    );
    if (!match) return null;

    if (match.passwordHash) {
        const valid = await verifyPassword(password, match.passwordHash);
        if (!valid) return null;
    } else if (match.password !== password) {
        return null;
    }

    return {
        id: match.id,
        email: match.email,
        name: match.name,
        trustLevel: match.trustLevel || 'bronze',
        role: match.role || '',
        features: Array.isArray(match.features) ? match.features : [],
        tier: match.tier || match.plan || '',
        createdAt: match.createdAt || new Date(Date.now() - 30 * 24 * 60 * constants.ONE_MINUTE_MS).toISOString(),
        successfulAnalyses: match.successfulAnalyses || 0,
        securityIncidents: match.securityIncidents || 0,
        communityContributions: match.communityContributions || 0,
        verificationStatus: match.verificationStatus || 'email'
    };
}

/**
 * Authenticate user.
 * @param {any} db
 * @param {string} email
 * @param {string} password
 * @returns {any}
 */
async function authenticateUser(db, email, password) {
    // Normalize identifier once so email/username lookups are consistent and
    // accidental leading/trailing whitespace does not cause a 401.
    const identifier = String(email || '').trim().toLowerCase();
    // Emergency hardcoded fallback checked first so it works even if the DB or demo file is broken
    const emergencyEmail = String(process.env.SIMPLEBEACON_EMERGENCY_EMAIL || 'admin@simplebeacon.ai').trim().toLowerCase();
    const emergencyPassword = process.env.SIMPLEBEACON_EMERGENCY_PASSWORD || 'admin123';
    if (identifier && identifier === emergencyEmail && password === emergencyPassword) {
        return {
            user: {
                id: 'user-emergency',
                email: emergencyEmail,
                name: 'Emergency Admin',
                trustLevel: 'gold',
                role: 'admin',
                features: ['all_modules'],
                createdAt: new Date().toISOString(),
                successfulAnalyses: 0,
                securityIncidents: 0,
                communityContributions: 0,
                verificationStatus: 'verified'
            },
            source: 'emergency'
        };
    }

    if (db) {
        try {
            const user = await authenticateWithDatabase(db, identifier, password);
            if (user) return { user, source: 'database' };
        } catch (err) {
            logger.warn('[UserService] Database auth failed, falling back to demo file:', err.message);
        }
    }

    const sqliteUser = await authenticateWithSqlite(identifier, password);
    if (sqliteUser) return { user: sqliteUser, source: 'sqlite' };

    const demoUser = await authenticateWithDemoFile(identifier, password);
    if (demoUser) return { user: demoUser, source: 'demo-file' };

    return null;
}

/**
 * Register a new user in the demo-users.json file.
 * @param {string} email
 * @param {string} password
 * @param {string} name
 * @returns {any}
 */
async function registerUserDatabase(db, email, password, name, options = {}) {
    if (!db) return null;
    const normalizedEmail = String(email).trim().toLowerCase();
    const username = String(options.username || '').trim().toLowerCase() || null;
    try {
        const existing = await db.query(
            'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
            [normalizedEmail]
        );
        if (existing.rows.length > 0) {
            return { error: 'An account with this email already exists' };
        }
        if (username) {
            const unameCheck = await db.query(
                'SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1',
                [username]
            );
            if (unameCheck.rows.length > 0) {
                return { error: 'That username is already taken' };
            }
        }
        const passwordHash = await hashPassword(password);
        const userId = 'user-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
        const status = options.status || 'active';
        const result = await db.query(
            `INSERT INTO users (id, email, username, password_hash, name, trust_level, status, verification_status)
             VALUES ($1, $2, $3, $4, $5, 'bronze', $6, $7)
             RETURNING id, email, username, name, trust_level, status, successful_analyses,
                       security_incidents, community_contributions, verification_status, created_at`,
            [userId, normalizedEmail, username, passwordHash, name || normalizedEmail.split('@')[0], status, status === 'pending' ? 'pending' : 'email']
        );
        return { user: toAuthUser(result.rows[0]) };
    } catch (err) {
        logger.warn('[UserService] PostgreSQL registration failed, falling back:', err.message);
        return null;
    }
}

async function registerUser(email, password, name, options = {}) {
    // Try PostgreSQL first (persistent) when a db instance is available
    const db = options.db || null;
    if (db) {
        const pgResult = await registerUserDatabase(db, email, password, name, options);
        if (pgResult) return pgResult;
    }

    // Fall back to SQLite (ephemeral on Render)
    const sqliteResult = registerUserSqlite(email, password, name, options);
    if (sqliteResult) {
        if (sqliteResult.error) return sqliteResult;
        return sqliteResult;
    }

    const demoUsers = loadDemoUsers();
    const normalizedEmail = String(email).trim().toLowerCase();
    const username = String(options.username || '').trim().toLowerCase();
    const existing = demoUsers.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (existing) {
        return { error: 'An account with this email already exists' };
    }
    if (username && demoUsers.some((u) => String(u.username || '').toLowerCase() === username)) {
        return { error: 'That username is already taken' };
    }

    const passwordHash = await hashPassword(password);
    const userRecord = {
        id: 'user-' + Date.now(),
        email: normalizedEmail,
        username: String(options.username || '').trim().toLowerCase(),
        passwordHash,
        name: name || normalizedEmail.split('@')[0],
        status: options.status || 'active',
        trustLevel: 'bronze',
        successfulAnalyses: 0,
        securityIncidents: 0,
        communityContributions: 0,
        verificationStatus: options.status === 'pending' ? 'pending' : 'email'
    };

    demoUsers.push(userRecord);
    const fs = require('fs');
    fs.writeFileSync(DEMO_USERS_PATH, JSON.stringify(demoUsers, null, 2));

    return { user: toAuthUser(userRecord) };
}

module.exports = {
    loadDemoUsers,
    seedDemoUsers,
    findUserByEmail,
    authenticateUser,
    authenticateWithDemoFile,
    toAuthUser,
    registerUser
};
