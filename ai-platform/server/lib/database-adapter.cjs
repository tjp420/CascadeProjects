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
