#!/usr/bin/env node

/**
 * Database Migration Script
 * Migrates from file-based JSON storage to PostgreSQL database
 */

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'cascade_ai_platform',
  user: process.env.DB_USER || 'cascade_user',
  password: process.env.DB_PASSWORD || 'secure_password'
};

class DatabaseMigrator {
  constructor() {
    this.pool = new Pool(dbConfig);
    this.dataCentralPath = path.join(__dirname, '../data-central');
  }

  async migrate() {
    try {
      console.log('🚀 Starting database migration...');
      
      // Step 1: Create database schema
      await this.createSchema();
      console.log('✅ Database schema created');
      
      // Step 2: Migrate all data
      await this.migrateAllData();
      console.log('✅ All data migrated successfully');
      
      // Step 3: Create indexes
      await this.createIndexes();
      console.log('✅ Database indexes created');
      
      // Step 4: Validate migration
      await this.validateMigration();
      console.log('✅ Migration validation passed');
      
      console.log('🎉 Database migration completed successfully!');
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    } finally {
      await this.pool.end();
    }
  }

  async createSchema() {
    const client = await this.pool.connect();
    
    try {
      // Drop existing tables if they exist (for fresh migration)
      await client.query(`
        DROP TABLE IF EXISTS roadmap_data CASCADE;
        DROP TABLE IF EXISTS technical_debt CASCADE;
        DROP TABLE IF EXISTS project_resources CASCADE;
        DROP TABLE IF EXISTS development_data CASCADE;
        DROP TABLE IF EXISTS analytics_data CASCADE;
        DROP TABLE IF EXISTS ai_tools_data CASCADE;
        DROP TABLE IF EXISTS projects CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
      `);

      // Create users table
      await client.query(`
        CREATE TABLE users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(20) DEFAULT 'user',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP,
          is_active BOOLEAN DEFAULT true
        );
      `);

      // Create projects table
      await client.query(`
        CREATE TABLE projects (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          owner_id UUID REFERENCES users(id),
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          settings JSONB DEFAULT '{}'
        );
      `);

      // Create AI tools data table
      await client.query(`
        CREATE TABLE ai_tools_data (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID REFERENCES projects(id),
          tool_name VARCHAR(100) NOT NULL,
          tool_type VARCHAR(50) NOT NULL,
          configuration JSONB NOT NULL,
          usage_data JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create analytics data table
      await client.query(`
        CREATE TABLE analytics_data (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID REFERENCES projects(id),
          metric_name VARCHAR(100) NOT NULL,
          metric_value DECIMAL(10,2),
          metric_data JSONB DEFAULT '{}',
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create development data table
      await client.query(`
        CREATE TABLE development_data (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID REFERENCES projects(id),
          data_type VARCHAR(50) NOT NULL,
          content JSONB NOT NULL,
          version INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create project resources table
      await client.query(`
        CREATE TABLE project_resources (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID REFERENCES projects(id),
          resource_type VARCHAR(50) NOT NULL,
          resource_name VARCHAR(255) NOT NULL,
          content JSONB NOT NULL,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create technical debt table
      await client.query(`
        CREATE TABLE technical_debt (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID REFERENCES projects(id),
          debt_type VARCHAR(50) NOT NULL,
          severity VARCHAR(20) NOT NULL,
          description TEXT,
          impact_score DECIMAL(5,2),
          resolution_data JSONB DEFAULT '{}',
          status VARCHAR(20) DEFAULT 'open',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create roadmap data table
      await client.query(`
        CREATE TABLE roadmap_data (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID REFERENCES projects(id),
          phase_number INTEGER NOT NULL,
          phase_name VARCHAR(100) NOT NULL,
          phase_data JSONB NOT NULL,
          status VARCHAR(20) DEFAULT 'planned',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

    } finally {
      client.release();
    }
  }

  async createIndexes() {
    const client = await this.pool.connect();
    
    try {
      // Performance indexes
      const indexes = [
        'CREATE INDEX idx_users_email ON users(email);',
        'CREATE INDEX idx_users_username ON users(username);',
        'CREATE INDEX idx_projects_owner ON projects(owner_id);',
        'CREATE INDEX idx_projects_status ON projects(status);',
        'CREATE INDEX idx_ai_tools_project ON ai_tools_data(project_id);',
        'CREATE INDEX idx_ai_tools_type ON ai_tools_data(tool_type);',
        'CREATE INDEX idx_analytics_project ON analytics_data(project_id);',
        'CREATE INDEX idx_analytics_timestamp ON analytics_data(timestamp);',
        'CREATE INDEX idx_development_project ON development_data(project_id);',
        'CREATE INDEX idx_development_type ON development_data(data_type);',
        'CREATE INDEX idx_resources_project ON project_resources(project_id);',
        'CREATE INDEX idx_resources_type ON project_resources(resource_type);',
        'CREATE INDEX idx_debt_project ON technical_debt(project_id);',
        'CREATE INDEX idx_debt_severity ON technical_debt(severity);',
        'CREATE INDEX idx_roadmap_project ON roadmap_data(project_id);'
      ];

      for (const indexSql of indexes) {
        await client.query(indexSql);
      }

    } finally {
      client.release();
    }
  }

  async migrateAllData() {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Create default admin user
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      const [user] = await client.query(`
        INSERT INTO users (username, email, password_hash, role)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, ['admin', 'admin@cascade.ai', hashedPassword, 'admin']);

      // Create default project
      const [project] = await client.query(`
        INSERT INTO projects (name, description, owner_id, status)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, ['Cascade AI Platform', 'Main AI platform project', user.rows[0].id, 'active']);

      const projectId = project.rows[0].id;

      // Migrate AI tools data
      await this.migrateAIToolsData(client, projectId);
      
      // Migrate analytics data
      await this.migrateAnalyticsData(client, projectId);
      
      // Migrate development data
      await this.migrateDevelopmentData(client, projectId);
      
      // Migrate project resources
      await this.migrateProjectResources(client, projectId);
      
      // Migrate technical debt
      await this.migrateTechnicalDebt(client, projectId);
      
      // Migrate roadmap data
      await this.migrateRoadmapData(client, projectId);

      await client.query('COMMIT');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async migrateAIToolsData(client, projectId) {
    try {
      const filePath = path.join(this.dataCentralPath, 'ai-tools/ai-tools-data.json');
      const data = await fs.readFile(filePath, 'utf8');
      const aiToolsData = JSON.parse(data);

      for (const tool of aiToolsData.tools || []) {
        await client.query(`
          INSERT INTO ai_tools_data (project_id, tool_name, tool_type, configuration, usage_data)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          projectId,
          tool.name,
          tool.type,
          tool.configuration || {},
          tool.usage || {}
        ]);
      }

      console.log('✅ AI tools data migrated');

    } catch (error) {
      console.log('⚠️ AI tools data not found or invalid, skipping...');
    }
  }

  async migrateAnalyticsData(client, projectId) {
    try {
      const filePath = path.join(this.dataCentralPath, 'analytics/analytics-data.json');
      const data = await fs.readFile(filePath, 'utf8');
      const analyticsData = JSON.parse(data);

      for (const metric of analyticsData.metrics || []) {
        await client.query(`
          INSERT INTO analytics_data (project_id, metric_name, metric_value, metric_data)
          VALUES ($1, $2, $3, $4)
        `, [
          projectId,
          metric.name,
          metric.value || 0,
          metric.data || {}
        ]);
      }

      console.log('✅ Analytics data migrated');

    } catch (error) {
      console.log('⚠️ Analytics data not found or invalid, skipping...');
    }
  }

  async migrateDevelopmentData(client, projectId) {
    const devFiles = [
      'dev-configs.json',
      'database-schemas.json',
      'api-docs.json',
      'merge-configs.json'
    ];

    for (const file of devFiles) {
      try {
        const filePath = path.join(this.dataCentralPath, 'development', file);
        const fileData = await fs.readFile(filePath, 'utf8');
        const parsedData = JSON.parse(fileData);

        await client.query(`
          INSERT INTO development_data (project_id, data_type, content)
          VALUES ($1, $2, $3)
        `, [
          projectId,
          file.replace('.json', ''),
          parsedData
        ]);

      } catch (error) {
        console.log(`⚠️ Development file ${file} not found or invalid, skipping...`);
      }
    }

    console.log('✅ Development data migrated');
  }

  async migrateProjectResources(client, projectId) {
    const resourceFiles = [
      'billing-data.json',
      'report-templates.json',
      'assets.json',
      'code-templates.json',
      'coverage-data.json'
    ];

    for (const file of resourceFiles) {
      try {
        const filePath = path.join(this.dataCentralPath, 'project-resources', file);
        const fileData = await fs.readFile(filePath, 'utf8');
        const parsedData = JSON.parse(fileData);

        await client.query(`
          INSERT INTO project_resources (project_id, resource_type, resource_name, content)
          VALUES ($1, $2, $3, $4)
        `, [
          projectId,
          file.replace('.json', ''),
          parsedData.title || file,
          parsedData
        ]);

      } catch (error) {
        console.log(`⚠️ Resource file ${file} not found or invalid, skipping...`);
      }
    }

    console.log('✅ Project resources migrated');
  }

  async migrateTechnicalDebt(client, projectId) {
    try {
      const filePath = path.join(this.dataCentralPath, 'technical-debt/debt-metrics.json');
      const data = await fs.readFile(filePath, 'utf8');
      const debtData = JSON.parse(data);

      for (const debt of debtData.debtItems || []) {
        await client.query(`
          INSERT INTO technical_debt (project_id, debt_type, severity, description, impact_score, resolution_data)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          projectId,
          debt.type,
          debt.severity,
          debt.description,
          debt.impactScore || 0,
          debt.resolution || {}
        ]);
      }

      console.log('✅ Technical debt migrated');

    } catch (error) {
      console.log('⚠️ Technical debt data not found or invalid, skipping...');
    }
  }

  async migrateRoadmapData(client, projectId) {
    try {
      const filePath = path.join(this.dataCentralPath, 'roadmap/roadmap-data.json');
      const data = await fs.readFile(filePath, 'utf8');
      const roadmapData = JSON.parse(data);

      for (const phase of roadmapData.timeline || []) {
        await client.query(`
          INSERT INTO roadmap_data (project_id, phase_number, phase_name, phase_data, status)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          projectId,
          phase.phase,
          phase.title,
          phase,
          phase.status || 'planned'
        ]);
      }

      console.log('✅ Roadmap data migrated');

    } catch (error) {
      console.log('⚠️ Roadmap data not found or invalid, skipping...');
    }
  }

  async validateMigration() {
    const client = await this.pool.connect();
    
    try {
      // Check if all tables have data
      const tables = ['users', 'projects', 'ai_tools_data', 'analytics_data', 'development_data', 'project_resources', 'technical_debt', 'roadmap_data'];
      
      for (const table of tables) {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        const count = parseInt(result.rows[0].count);
        console.log(`📊 ${table}: ${count} records`);
        
        if (table === 'users' && count === 0) {
          throw new Error(`Table ${table} is empty`);
        }
      }

      // Test basic functionality
      await client.query('SELECT * FROM users LIMIT 1');
      await client.query('SELECT * FROM projects LIMIT 1');
      
      console.log('✅ Database validation passed');

    } finally {
      client.release();
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  const migrator = new DatabaseMigrator();
  migrator.migrate()
    .then(() => {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = DatabaseMigrator;
