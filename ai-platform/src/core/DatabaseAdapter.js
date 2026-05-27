/**
 * Database Adapter
 * Provides database operations for the AI Platform
 * Replaces file-based JSON storage with PostgreSQL
 */

const { Pool } = require('pg');

class DatabaseAdapter {
  constructor(config = {}) {
    this.config = {
      host: config.host || process.env.DB_HOST || 'localhost',
      port: config.port || process.env.DB_PORT || 5432,
      database: config.database || process.env.DB_NAME || 'cascade_ai_platform',
      user: config.user || process.env.DB_USER || 'cascade_user',
      password: config.password || process.env.DB_PASSWORD || 'secure_password',
      max: config.max || 20,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
    };

    this.pool = new Pool(this.config);
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Execute a raw SQL query
   */
  async query(sql, params = []) {
    try {
      const start = Date.now();
      const result = await this.pool.query(sql, params);
      const duration = Date.now() - start;
      const logQueries = process.env.LOG_QUERIES === 'true';
      const slowQueryMs = Number(process.env.DB_SLOW_QUERY_MS || 100);

      if (logQueries) {
        const paramHint = params.length ? ` (${params.length} param${params.length === 1 ? '' : 's'})` : '';
        console.log(`[DB Query] (${duration}ms)${paramHint}:`, sql.substring(0, 200));
      } else if (duration > slowQueryMs) {
        console.log(`⚠️ Slow query (${duration}ms):`, sql.substring(0, 100));
      }
      
      return result;
    } catch (error) {
      console.error('❌ Database query error:', error);
      throw error;
    }
  }

  /**
   * Find a record by ID
   */
  async findById(table, id) {
    const cacheKey = `${table}_by_id_${id}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const result = await this.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    const record = result.rows[0];

    if (record) {
      this.cache.set(cacheKey, record);
      setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);
    }

    return record;
  }

  /**
   * Find records by criteria
   */
  async find(table, criteria = {}, options = {}) {
    const cacheKey = `${table}_find_${JSON.stringify(criteria)}_${JSON.stringify(options)}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    let whereClause = 'WHERE 1=1';
    let params = [];
    let paramIndex = 1;

    // Build WHERE clause from criteria
    Object.entries(criteria).forEach(([key, value]) => {
      whereClause += ` AND ${key} = $${paramIndex}`;
      params.push(value);
      paramIndex++;
    });

    // Add ORDER BY
    if (options.orderBy) {
      whereClause += ` ORDER BY ${options.orderBy}`;
    }

    // Add LIMIT
    if (options.limit) {
      whereClause += ` LIMIT $${paramIndex}`;
      params.push(options.limit);
      paramIndex++;
    }

    // Add OFFSET
    if (options.offset) {
      whereClause += ` OFFSET $${paramIndex}`;
      params.push(options.offset);
      paramIndex++;
    }

    const result = await this.query(`SELECT * FROM ${table} ${whereClause}`, params);

    const records = result.rows;

    this.cache.set(cacheKey, records);
    setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);

    return records;
  }

  /**
   * Create a new record
   */
  async create(table, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    
    const columns = keys.join(', ');
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');

    const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`;
    
    const result = await this.query(sql, values);
    const record = result.rows[0];

    // Clear related cache
    this.clearTableCache(table);

    return record;
  }

  /**
   * Update a record by ID
   */
  async update(table, id, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    
    const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
    
    const sql = `UPDATE ${table} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${keys.length + 1} RETURNING *`;
    
    const result = await this.query(sql, [...values, id]);
    const record = result.rows[0];

    // Clear related cache
    this.clearTableCache(table);

    return record;
  }

  /**
   * Delete a record by ID
   */
  async delete(table, id) {
    const result = await this.query(`DELETE FROM ${table} WHERE id = $1 RETURNING *`, [id]);
    
    // Clear related cache
    this.clearTableCache(table);

    return result.rows[0];
  }

  /**
   * Execute a transaction
   */
  async transaction(callback) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const transactionClient = {
        query: (sql, params) => client.query(sql, params)
      };
      
      const result = await callback(transactionClient);
      
      await client.query('COMMIT');
      
      // Clear all cache on transaction
      this.cache.clear();
      
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get count of records
   */
  async count(table, criteria = {}) {
    let whereClause = 'WHERE 1=1';
    let params = [];
    let paramIndex = 1;

    Object.entries(criteria).forEach(([key, value]) => {
      whereClause += ` AND ${key} = $${paramIndex}`;
      params.push(value);
      paramIndex++;
    });

    const result = await this.query(`SELECT COUNT(*) as count FROM ${table} ${whereClause}`, params);
    return parseInt(result.rows[0].count);
  }

  /**
   * Check if a record exists
   */
  async exists(table, criteria = {}) {
    const count = await this.count(table, criteria);
    return count > 0;
  }

  /**
   * Get paginated results
   */
  async paginate(table, criteria = {}, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    const [records, total] = await Promise.all([
      this.find(table, criteria, { ...options, limit, offset }),
      this.count(table, criteria)
    ]);

    return {
      records,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Bulk insert records
   */
  async bulkInsert(table, records) {
    if (records.length === 0) return [];

    const keys = Object.keys(records[0]);
    const columns = keys.join(', ');
    
    const values = records.map((record, index) => {
      const placeholders = keys.map((_, keyIndex) => `$${index * keys.length + keyIndex + 1}`).join(', ');
      return `(${placeholders})`;
    }).join(', ');

    const flatValues = records.flatMap(record => Object.values(record));
    
    const sql = `INSERT INTO ${table} (${columns}) VALUES ${values} RETURNING *`;
    
    const result = await this.query(sql, flatValues);
    
    // Clear related cache
    this.clearTableCache(table);

    return result.rows;
  }

  /**
   * Get database statistics
   */
  async getStats() {
    const tables = ['users', 'projects', 'ai_tools_data', 'analytics_data', 'development_data', 'project_resources', 'technical_debt', 'roadmap_data'];
    const stats = {};

    for (const table of tables) {
      try {
        const result = await this.query(`SELECT COUNT(*) as count FROM ${table}`);
        stats[table] = parseInt(result.rows[0].count);
      } catch (error) {
        stats[table] = 0;
      }
    }

    return stats;
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const result = await this.query('SELECT 1 as health');
      const stats = await this.getStats();
      const poolInfo = {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount
      };

      return {
        status: 'healthy',
        database: result.rows[0].health,
        pool: poolInfo,
        tables: stats,
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

  /**
   * Clear cache for a specific table
   */
  clearTableCache(table) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(table)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      timeout: this.cacheTimeout,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Close database connection pool
   */
  async close() {
    await this.pool.end();
  }

  /**
   * Get pool information
   */
  getPoolInfo() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }
}

module.exports = DatabaseAdapter;
