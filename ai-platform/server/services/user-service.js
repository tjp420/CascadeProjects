/**
 * User authentication service — PostgreSQL with demo-user file fallback.
 */

const fs = require('fs');
const path = require('path');
const { hashPassword, verifyPassword } = require('../middleware/auth');
const logger = require('../lib/app-logger');

const DEMO_USERS_PATH = path.join(__dirname, '..', 'db', 'demo-users.json');

function shouldLogRuntimeInfo() {
    return process.env.LOG_RUNTIME_INFO === 'true' || process.env.RUNTIME_DEBUG === 'true';
}

function loadDemoUsers() {
    try {
        return JSON.parse(fs.readFileSync(DEMO_USERS_PATH, 'utf8'));
    } catch (error) {
        logger.warn('[UserService] Demo users file unavailable:', error.message);
        return [];
    }
}

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

async function findUserByEmail(db, email) {
    const result = await db.query(
        `SELECT id, email, password_hash, name, trust_level, successful_analyses,
                security_incidents, community_contributions, verification_status, created_at
         FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [email]
    );
    return result.rows[0] || null;
}

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

async function authenticateWithDatabase(db, email, password) {
    const row = await findUserByEmail(db, email);
    if (!row) return null;

    const valid = await verifyPassword(password, row.password_hash);
    if (!valid) return null;

    return toAuthUser(row);
}

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
        createdAt: match.createdAt || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        successfulAnalyses: match.successfulAnalyses || 0,
        securityIncidents: match.securityIncidents || 0,
        communityContributions: match.communityContributions || 0,
        verificationStatus: match.verificationStatus || 'email'
    };
}

async function authenticateUser(db, email, password) {
    if (db) {
        const user = await authenticateWithDatabase(db, email, password);
        if (user) return { user, source: 'database' };
    }

    const demoUser = await authenticateWithDemoFile(email, password);
    if (demoUser) return { user: demoUser, source: 'demo-file' };

    return null;
}

module.exports = {
    loadDemoUsers,
    seedDemoUsers,
    findUserByEmail,
    authenticateUser,
    authenticateWithDemoFile,
    toAuthUser
};
