/**
 * SimpleBeacon API — PostgreSQL connection wrapper
 * Uses the 'pg' Pool for connection reuse.
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/simplebeacon';

const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

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
