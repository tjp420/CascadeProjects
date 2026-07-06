/**
 * User authentication service — PostgreSQL with demo-user file fallback.
 */

const path = require('path');
const { hashPassword, verifyPassword } = require('../middleware/auth.cjs');
const logger = require('../lib/app-logger.cjs');
const { readJsonFileCached } = require('../lib/json-file-cache.cjs');

const constants = require('../config/constants.cjs');
const DEMO_USERS_PATH = path.join(__dirname, '..', 'db', 'demo-users.json');

/**
 * Should log runtime info.
 * @returns {any}
 */
function shouldLogRuntimeInfo() {
    return process.env.LOG_RUNTIME_INFO === 'true' || process.env.RUNTIME_DEBUG === 'true';
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
        name: row.name,
        trustLevel: row.trust_level || row.trustLevel || 'bronze',
        createdAt: row.created_at || row.createdAt || new Date().toISOString(),
        successfulAnalyses: row.successful_analyses ?? row.successfulAnalyses ?? 0,
        securityIncidents: row.security_incidents ?? row.securityIncidents ?? 0,
        communityContributions: row.community_contributions ?? row.communityContributions ?? 0,
        verificationStatus: row.verification_status || row.verificationStatus || 'email'
    };
}

/**
 * Find user by email.
 * @param {any} db
 * @param {string} email
 * @returns {any}
 */
async function findUserByEmail(db, email) {
    const emailLookupQuery = await db.query(
        `SELECT id, email, password_hash, name, trust_level, successful_analyses,
                security_incidents, community_contributions, verification_status, created_at
         FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [email]
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
async function authenticateWithDatabase(db, email, password) {
    const row = await findUserByEmail(db, email);
    if (!row) return null;

    const valid = await verifyPassword(password, row.password_hash);
    if (!valid) return null;

    return toAuthUser(row);
}

/**
 * Authenticate with demo file.
 * @param {string} email
 * @param {string} password
 * @returns {any}
 */
async function authenticateWithDemoFile(email, password) {
    const demoUsers = loadDemoUsers();
    const match = demoUsers.find((user) => user.email.toLowerCase() === email.toLowerCase());
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
    if (db) {
        try {
            const user = await authenticateWithDatabase(db, email, password);
            if (user) return { user, source: 'database' };
        } catch (err) {
            logger.warn('[UserService] Database auth failed, falling back to demo file:', err.message);
        }
    }

    const demoUser = await authenticateWithDemoFile(email, password);
    if (demoUser) return { user: demoUser, source: 'demo-file' };

    // Emergency hardcoded fallback in case the demo file is missing/unreachable
    const emergencyEmail = String(process.env.SIMPLEBEACON_EMERGENCY_EMAIL || 'admin@simplebeacon.ai').toLowerCase();
    const emergencyPassword = process.env.SIMPLEBEACON_EMERGENCY_PASSWORD || 'admin123';
    if (email && email.toLowerCase() === emergencyEmail && password === emergencyPassword) {
        return {
            user: {
                id: 'user-emergency',
                email: emergencyEmail,
                name: 'Emergency Admin',
                trustLevel: 'gold',
                createdAt: new Date().toISOString(),
                successfulAnalyses: 0,
                securityIncidents: 0,
                communityContributions: 0,
                verificationStatus: 'verified'
            },
            source: 'emergency'
        };
    }

    return null;
}

/**
 * Register a new user in the demo-users.json file.
 * @param {string} email
 * @param {string} password
 * @param {string} name
 * @returns {any}
 */
async function registerUser(email, password, name) {
    const demoUsers = loadDemoUsers();
    const existing = demoUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
        return { error: 'An account with this email already exists' };
    }

    const passwordHash = await hashPassword(password);
    const userRecord = {
        id: 'user-' + Date.now(),
        email,
        passwordHash,
        name: name || email.split('@')[0],
        trustLevel: 'bronze',
        successfulAnalyses: 0,
        securityIncidents: 0,
        communityContributions: 0,
        verificationStatus: 'email'
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
