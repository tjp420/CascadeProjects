/**
 * SimpleBeacon API — PostgreSQL connection wrapper
 * Uses the 'pg' Pool for connection reuse.
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/simplebeacon';

// Hardened, environment-driven pool defaults
const POOL_MAX = Number.parseInt(process.env.DB_POOL_MAX || '', 10) || 15;
const IDLE_TIMEOUT_MS = Number.parseInt(process.env.DB_IDLE_TIMEOUT_MS || '', 10) || 45000;
const CONNECT_TIMEOUT_MS = Number.parseInt(process.env.DB_CONNECT_TIMEOUT_MS || '', 10) || 5000;

// Create the pool with sane defaults and allow env overrides
const pool = new Pool({
    connectionString: DATABASE_URL,
    max: POOL_MAX,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
});

// Cluster sizing safety check (warn by default, optional fail-fast)
try {
    const projectedInstances = Math.max(1, Number.parseInt(process.env.PROJECTED_INSTANCE_COUNT || '1', 10));
    const dbServerMax = Number.parseInt(process.env.DB_SERVER_MAX_CONNECTIONS || '0', 10);
    if (dbServerMax > 0) {
        const projectedConnections = POOL_MAX * projectedInstances;
        if (projectedConnections > dbServerMax) {
            const msg = `DB pool sizing risk: projected connections ${projectedConnections} exceed DB_SERVER_MAX_CONNECTIONS ${dbServerMax}. ` +
                `Reduce DB_POOL_MAX or PROJECTED_INSTANCE_COUNT, or increase DB_SERVER_MAX_CONNECTIONS.`;
            if (process.env.DB_SAFETY_FAIL_ON_EXCEED === 'true') {
                throw new Error(msg);
            } else {
                // non-fatal: surface prominent warning so operators can act
                console.warn(msg);
            }
        }
    }
} catch (err) {
    // If parsing throws for some reason, surface but do not crash startup unless fail-on-exceed is requested
    if (process.env.DB_SAFETY_FAIL_ON_EXCEED === 'true') {
        throw err;
    }
    console.warn('DB sizing validator encountered an error:', err && err.message ? err.message : err);
}

pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error:', err.message); // simplebeacon-ignore debug-artifact — production error handler
});

/**
 * Query helper — returns rows array
 * @param {string} text
 * @param {any[]} params
 * @returns {Promise<any[]>}
 */
async function query(text, params) {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
        console.log('Executed query', { text: text.slice(0, 60), duration, rows: result.rowCount });
    }
    return result.rows;
}

/**
 * Get single row helper
 * @param {string} text
 * @param {any[]} params
 * @returns {Promise<any|null>}
 */
async function get(text, params) {
    const rows = await query(text, params);
    return rows[0] || null;
}

/**
 * Run within a transaction
 * @param {(client: import('pg').PoolClient) => Promise<any>} fn
 */
async function withTransaction(fn) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { pool, query, get, withTransaction };
