/**
 * PostgreSQL adapter for Simplebeacon Phase 2 (auth, snapshots, billing).
 */
const { Pool } = require('pg');

class DatabaseAdapter {
  constructor(config = {}) {
    this.pool = new Pool({
      host: config.host || process.env.DB_HOST || 'localhost',
      port: config.port || process.env.DB_PORT || 5432,
      database: config.database || process.env.DB_NAME || 'simplebeacon',
      user: config.user || process.env.DB_USER || 'simplebeacon_user',
      password: config.password || process.env.DB_PASSWORD || '',
      max: config.max || 20,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000
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
