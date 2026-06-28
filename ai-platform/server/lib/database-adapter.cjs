/**
 * PostgreSQL adapter for Simplebeacon Phase 2 (auth, snapshots, billing).
 */
const { Pool } = require('pg');

const constants = require('../config/constants.cjs');
/**
 * Database adapter.
 */
class DatabaseAdapter {
  constructor(config = {}) {
    this.pool = new Pool({
      host: config.host || process.env.DB_HOST || 'localhost',
      port: config.port || process.env.DB_PORT || constants.POSTGRES_PORT,
      database: config.database || process.env.DB_NAME || 'simplebeacon',
      user: config.user || process.env.DB_USER || 'simplebeacon_user',
      password: config.password || process.env.DB_PASSWORD || '',
      max: config.max || 20,
      idleTimeoutMillis: config.idleTimeoutMillis || constants.TIMEOUT_30S,
      connectionTimeoutMillis: config.connectionTimeoutMillis || constants.MAX_RATE_LIMIT
    });
  }

  async query(sql, params = []) {
    return this.pool.query(sql, params);
  }

  /**
   * Acquire a client, begin a transaction, set RLS workspace context,
   * yield the client for route operations, then commit/rollback and release.
   * @param {string} workspaceId - Workspace or organization ID for RLS scoping.
   * @param {Function} callback - Async callback receiving the scoped client.
   * @returns {Promise<any>} Result of the callback.
   */
  async transaction(workspaceId, callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      if (workspaceId) {
        await client.query('SET LOCAL app.current_workspace_id = $1', [workspaceId]);
      }
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async healthCheck() {
    try {
      await this.query('SELECT 1 AS health');
      return {
        status: 'healthy',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = DatabaseAdapter;
