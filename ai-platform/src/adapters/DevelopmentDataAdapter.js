/**
 * Development Data Adapter
 * 
 * Provides standardized data access for Development features.
 * Integrates with central data processor and directory manager.
 * 
 * @class DevelopmentDataAdapter
 * @example
 * const adapter = new DevelopmentDataAdapter(centralManager, dataProcessor);
 * const devData = await adapter.getDevConfigs();
 */
function __resolveAppLogger() {
    try { return require('../lib/app-logger'); } catch (e) {
        return { error: (...a) => console.error(...a), warn: () => {}, info: () => {}, debug: () => {} };
    }
}
const logger = __resolveAppLogger();

class DevelopmentDataAdapter {
    constructor(centralManager, dataProcessor) {
        this.centralManager = centralManager;
        this.dataProcessor = dataProcessor;
        this.featureConfig = centralManager.getFeatureConfig('development');
        this.paths = centralManager.getFeaturePaths('development');
        this.cache = new Map();
        this.initialized = false;
        
        this.initialize();
    }

    /**
     * Initialize the adapter
     */
    async initialize() {
        try {
            // Subscribe to directory changes
            this.centralManager.subscribe('development', this.handleDirectoryChange.bind(this));
            
            // Validate directories
            await this.validateDirectories();
            
            this.initialized = true;
            logger.debug('✅ Development Data Adapter initialized');
        } catch (error) {
            logger.error('❌ Failed to initialize Development Data Adapter:', error);
            throw error;
        }
    }

    /**
     * Validate required directories
     */
    async validateDirectories() {
        const validation = await this.centralManager.validateDirectory('development');
        if (!validation.valid) {
            logger.warn('⚠️ Development directory validation failed:', validation.error);
        }
    }

    /**
     * Handle directory changes
     * @param {Object} change - Change information
     */
    handleDirectoryChange(change) {
        logger.debug('🔄 Development directory changed:', change);
        this.clearCache();
    }

    /**
     * Get development configurations
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Development configurations
     */
    async getDevConfigs(options = {}) {
        try {
            const cacheKey = 'dev-configs';
            
            if (options.useCache !== false && this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const mockData = this.generateMockDevConfigs();
            const result = await this.dataProcessor.processData('development', 'dev-configs', mockData, options);
            
            if (result.success) {
                if (options.cache !== false) {
                    this.cache.set(cacheKey, result);
                }
                return result;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            logger.error('❌ Failed to get dev configs:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Get database schemas
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Database schemas
     */
    async getDatabaseSchemas(options = {}) {
        try {
            const cacheKey = 'database-schemas';
            
            if (options.useCache !== false && this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const mockData = this.generateMockDatabaseSchemas();
            const result = await this.dataProcessor.processData('development', 'database-schemas', mockData, options);
            
            if (result.success) {
                if (options.cache !== false) {
                    this.cache.set(cacheKey, result);
                }
                return result;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            logger.error('❌ Failed to get database schemas:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Get API documentation
     * @param {Object} options - Query options
     * @returns {Promise<Object>} API documentation
     */
    async getApiDocs(options = {}) {
        try {
            const cacheKey = 'api-docs';
            
            if (options.useCache !== false && this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const mockData = this.generateMockApiDocs();
            const result = await this.dataProcessor.processData('development', 'api-docs', mockData, options);
            
            if (result.success) {
                if (options.cache !== false) {
                    this.cache.set(cacheKey, result);
                }
                return result;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            logger.error('❌ Failed to get API docs:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Get merge configurations
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Merge configurations
     */
    async getMergeConfigs(options = {}) {
        try {
            const cacheKey = 'merge-configs';
            
            if (options.useCache !== false && this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const mockData = this.generateMockMergeConfigs();
            const result = await this.dataProcessor.processData('development', 'merge-configs', mockData, options);
            
            if (result.success) {
                if (options.cache !== false) {
                    this.cache.set(cacheKey, result);
                }
                return result;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            logger.error('❌ Failed to get merge configs:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Save development configurations
     * @param {Object} data - Development configurations to save
     * @returns {Promise<Object>} Save result
     */
    async saveDevConfigs(data) {
        try {
            const result = await this.dataProcessor.processData('development', 'dev-configs', data, { 
                action: 'save' 
            });
            
            this.clearCache('dev-configs');
            
            this.centralManager.notify('development', {
                type: 'data-saved',
                dataType: 'dev-configs',
                timestamp: new Date().toISOString()
            });
            
            return result;
        } catch (error) {
            logger.error('❌ Failed to save dev configs:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Save database schemas
     * @param {Object} data - Database schemas to save
     * @returns {Promise<Object>} Save result
     */
    async saveDatabaseSchemas(data) {
        try {
            const result = await this.dataProcessor.processData('development', 'database-schemas', data, { 
                action: 'save' 
            });
            
            this.clearCache('database-schemas');
            
            this.centralManager.notify('development', {
                type: 'data-saved',
                dataType: 'database-schemas',
                timestamp: new Date().toISOString()
            });
            
            return result;
        } catch (error) {
            logger.error('❌ Failed to save database schemas:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Save API documentation
     * @param {Object} data - API documentation to save
     * @returns {Promise<Object>} Save result
     */
    async saveApiDocs(data) {
        try {
            const result = await this.dataProcessor.processData('development', 'api-docs', data, { 
                action: 'save' 
            });
            
            this.clearCache('api-docs');
            
            this.centralManager.notify('development', {
                type: 'data-saved',
                dataType: 'api-docs',
                timestamp: new Date().toISOString()
            });
            
            return result;
        } catch (error) {
            logger.error('❌ Failed to save API docs:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Save merge configurations
     * @param {Object} data - Merge configurations to save
     * @returns {Promise<Object>} Save result
     */
    async saveMergeConfigs(data) {
        try {
            const result = await this.dataProcessor.processData('development', 'merge-configs', data, { 
                action: 'save' 
            });
            
            this.clearCache('merge-configs');
            
            this.centralManager.notify('development', {
                type: 'data-saved',
                dataType: 'merge-configs',
                timestamp: new Date().toISOString()
            });
            
            return result;
        } catch (error) {
            logger.error('❌ Failed to save merge configs:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get all development data
     * @param {Object} options - Query options
     * @returns {Promise<Object>} All development data
     */
    async getAllData(options = {}) {
        try {
            const [devConfigs, databaseSchemas, apiDocs, mergeConfigs] = await Promise.all([
                this.getDevConfigs(options),
                this.getDatabaseSchemas(options),
                this.getApiDocs(options),
                this.getMergeConfigs(options)
            ]);

            return {
                success: true,
                data: {
                    devConfigs: devConfigs.data,
                    databaseSchemas: databaseSchemas.data,
                    apiDocs: apiDocs.data,
                    mergeConfigs: mergeConfigs.data
                },
                metadata: {
                    features: this.featureConfig.features,
                    dataTypes: this.featureConfig.dataTypes,
                    retrievedAt: new Date().toISOString()
                }
            };
        } catch (error) {
            logger.error('❌ Failed to get all development data:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Validate development configuration
     * @param {Object} config - Configuration to validate
     * @returns {Object} Validation result
     */
    validateDevConfig(config) {
        const validation = {
            valid: true,
            errors: [],
            warnings: []
        };

        // Check required fields
        if (!config.name || typeof config.name !== 'string') {
            validation.valid = false;
            validation.errors.push('Configuration name is required and must be a string');
        }

        if (!config.type || !['dev', 'test', 'prod'].includes(config.type)) {
            validation.valid = false;
            validation.errors.push('Configuration type must be one of: dev, test, prod');
        }

        // Check for optional but recommended fields
        if (!config.description) {
            validation.warnings.push('Description is recommended for better documentation');
        }

        if (!config.version) {
            validation.warnings.push('Version is recommended for configuration management');
        }

        return validation;
    }

    /**
     * Validate database schema
     * @param {Object} schema - Schema to validate
     * @returns {Object} Validation result
     */
    validateDatabaseSchema(schema) {
        const validation = {
            valid: true,
            errors: [],
            warnings: []
        };

        // Check required fields
        if (!schema.name || typeof schema.name !== 'string') {
            validation.valid = false;
            validation.errors.push('Schema name is required and must be a string');
        }

        if (!schema.version || typeof schema.version !== 'string') {
            validation.valid = false;
            validation.errors.push('Schema version is required and must be a string');
        }

        if (!schema.tables || !Array.isArray(schema.tables)) {
            validation.valid = false;
            validation.errors.push('Schema must contain a tables array');
        }

        // Validate tables
        if (schema.tables) {
            schema.tables.forEach((table, index) => {
                if (!table.name) {
                    validation.valid = false;
                    validation.errors.push(`Table ${index + 1} must have a name`);
                }
                if (!table.columns || !Array.isArray(table.columns)) {
                    validation.valid = false;
                    validation.errors.push(`Table ${table.name || index + 1} must have columns array`);
                }
            });
        }

        return validation;
    }

    /**
     * Generate mock development configurations
     * @returns {Object} Mock development configurations
     */
    generateMockDevConfigs() {
        return {
            timestamp: new Date().toISOString(),
            type: 'development-configurations',
            configurations: [
                {
                    id: 'dev-config-001',
                    name: 'Development Environment',
                    type: 'dev',
                    description: 'Main development environment configuration',
                    version: '1.0.0',
                    settings: {
                        database: {
                            host: 'localhost',
                            port: 5432,
                            name: 'ai_platform_dev',
                            ssl: false
                        },
                        api: {
                            baseUrl: 'http://localhost:8002',
                            timeout: 30000,
                            retries: 3
                        },
                        logging: {
                            level: 'debug',
                            console: true,
                            file: true
                        },
                        features: {
                            hotReload: true,
                            autoSave: true,
                            debugging: true
                        }
                    },
                    environment: {
                        NODE_ENV: 'development',
                        DEBUG: 'true',
                        LOG_LEVEL: 'debug'
                    },
                    lastUpdated: new Date().toISOString()
                },
                {
                    id: 'dev-config-002',
                    name: 'Test Environment',
                    type: 'test',
                    description: 'Test environment configuration',
                    version: '1.0.0',
                    settings: {
                        database: {
                            host: 'localhost',
                            port: 5433,
                            name: 'ai_platform_test',
                            ssl: false
                        },
                        api: {
                            baseUrl: 'http://localhost:8003',
                            timeout: 15000,
                            retries: 2
                        },
                        logging: {
                            level: 'info',
                            console: false,
                            file: true
                        },
                        features: {
                            hotReload: false,
                            autoSave: false,
                            debugging: false
                        }
                    },
                    environment: {
                        NODE_ENV: 'test',
                        DEBUG: 'false',
                        LOG_LEVEL: 'info'
                    },
                    lastUpdated: new Date().toISOString()
                },
                {
                    id: 'dev-config-003',
                    name: 'Production Environment',
                    type: 'prod',
                    description: 'Production environment configuration',
                    version: '1.0.0',
                    settings: {
                        database: {
                            host: 'prod-db.example.com',
                            port: 5432,
                            name: 'ai_platform_prod',
                            ssl: true
                        },
                        api: {
                            baseUrl: 'https://api.example.com',
                            timeout: 10000,
                            retries: 1
                        },
                        logging: {
                            level: 'error',
                            console: false,
                            file: true
                        },
                        features: {
                            hotReload: false,
                            autoSave: true,
                            debugging: false
                        }
                    },
                    environment: {
                        NODE_ENV: 'production',
                        DEBUG: 'false',
                        LOG_LEVEL: 'error'
                    },
                    lastUpdated: new Date().toISOString()
                }
            ],
            summary: {
                totalConfigurations: 3,
                environmentTypes: ['dev', 'test', 'prod'],
                lastUpdated: new Date().toISOString()
            },
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Generate mock database schemas
     * @returns {Object} Mock database schemas
     */
    generateMockDatabaseSchemas() {
        return {
            timestamp: new Date().toISOString(),
            type: 'database-schemas',
            schemas: [
                {
                    id: 'schema-001',
                    name: 'ai_platform_main',
                    version: '1.0.0',
                    description: 'Main application database schema',
                    tables: [
                        {
                            name: 'users',
                            description: 'User accounts and profiles',
                            columns: [
                                { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
                                { name: 'username', type: 'varchar(50)', nullable: false, unique: true },
                                { name: 'email', type: 'varchar(255)', nullable: false, unique: true },
                                { name: 'password_hash', type: 'varchar(255)', nullable: false },
                                { name: 'created_at', type: 'timestamp', nullable: false, default: 'CURRENT_TIMESTAMP' },
                                { name: 'updated_at', type: 'timestamp', nullable: false, default: 'CURRENT_TIMESTAMP' }
                            ],
                            indexes: [
                                { name: 'idx_users_email', columns: ['email'], unique: true },
                                { name: 'idx_users_username', columns: ['username'], unique: true }
                            ]
                        },
                        {
                            name: 'projects',
                            description: 'Project information and metadata',
                            columns: [
                                { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
                                { name: 'name', type: 'varchar(255)', nullable: false },
                                { name: 'description', type: 'text', nullable: true },
                                { name: 'owner_id', type: 'uuid', nullable: false, references: 'users.id' },
                                { name: 'status', type: 'varchar(50)', nullable: false, default: 'active' },
                                { name: 'created_at', type: 'timestamp', nullable: false, default: 'CURRENT_TIMESTAMP' },
                                { name: 'updated_at', type: 'timestamp', nullable: false, default: 'CURRENT_TIMESTAMP' }
                            ],
                            indexes: [
                                { name: 'idx_projects_owner', columns: ['owner_id'] },
                                { name: 'idx_projects_status', columns: ['status'] }
                            ],
                            foreignKeys: [
                                { name: 'fk_projects_owner', column: 'owner_id', references: 'users(id)' }
                            ]
                        },
                        {
                            name: 'analysis_results',
                            description: 'AI analysis results and metrics',
                            columns: [
                                { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
                                { name: 'project_id', type: 'uuid', nullable: false, references: 'projects.id' },
                                { name: 'analysis_type', type: 'varchar(100)', nullable: false },
                                { name: 'results', type: 'jsonb', nullable: false },
                                { name: 'score', type: 'decimal(5,2)', nullable: true },
                                { name: 'created_at', type: 'timestamp', nullable: false, default: 'CURRENT_TIMESTAMP' }
                            ],
                            indexes: [
                                { name: 'idx_analysis_project', columns: ['project_id'] },
                                { name: 'idx_analysis_type', columns: ['analysis_type'] }
                            ],
                            foreignKeys: [
                                { name: 'fk_analysis_project', column: 'project_id', references: 'projects(id)' }
                            ]
                        }
                    ],
                    relationships: [
                        {
                            from: 'users',
                            to: 'projects',
                            type: 'one-to-many',
                            foreignKey: 'owner_id'
                        },
                        {
                            from: 'projects',
                            to: 'analysis_results',
                            type: 'one-to-many',
                            foreignKey: 'project_id'
                        }
                    ],
                    lastUpdated: new Date().toISOString()
                },
                {
                    id: 'schema-002',
                    name: 'ai_platform_cache',
                    version: '1.0.0',
                    description: 'Caching and temporary data schema',
                    tables: [
                        {
                            name: 'cache_entries',
                            description: 'Application cache entries',
                            columns: [
                                { name: 'key', type: 'varchar(255)', nullable: false, primaryKey: true },
                                { name: 'value', type: 'jsonb', nullable: false },
                                { name: 'expires_at', type: 'timestamp', nullable: false },
                                { name: 'created_at', type: 'timestamp', nullable: false, default: 'CURRENT_TIMESTAMP' }
                            ],
                            indexes: [
                                { name: 'idx_cache_expires', columns: ['expires_at'] }
                            ]
                        },
                        {
                            name: 'session_data',
                            description: 'User session information',
                            columns: [
                                { name: 'session_id', type: 'varchar(255)', nullable: false, primaryKey: true },
                                { name: 'user_id', type: 'uuid', nullable: false },
                                { name: 'data', type: 'jsonb', nullable: false },
                                { name: 'expires_at', type: 'timestamp', nullable: false },
                                { name: 'created_at', type: 'timestamp', nullable: false, default: 'CURRENT_TIMESTAMP' }
                            ],
                            indexes: [
                                { name: 'idx_session_user', columns: ['user_id'] },
                                { name: 'idx_session_expires', columns: ['expires_at'] }
                            ]
                        }
                    ],
                    lastUpdated: new Date().toISOString()
                }
            ],
            summary: {
                totalSchemas: 2,
                totalTables: 5,
                totalColumns: 22,
                totalIndexes: 8,
                totalRelationships: 2,
                lastUpdated: new Date().toISOString()
            },
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Generate mock API documentation
     * @returns {Object} Mock API documentation
     */
    generateMockApiDocs() {
        return {
            timestamp: new Date().toISOString(),
            type: 'api-documentation',
            version: '1.0.0',
            baseUrl: 'http://localhost:8002',
            endpoints: [
                {
                    id: 'endpoint-001',
                    path: '/api/health',
                    method: 'GET',
                    description: 'Health check endpoint',
                    summary: 'Returns the health status of the API service',
                    parameters: [],
                    responses: {
                        '200': {
                            description: 'Service is healthy',
                            schema: {
                                type: 'object',
                                properties: {
                                    status: { type: 'string', example: 'healthy' },
                                    timestamp: { type: 'string', format: 'date-time' },
                                    version: { type: 'string', example: '1.0.0' }
                                }
                            }
                        }
                    },
                    tags: ['Health', 'System']
                },
                {
                    id: 'endpoint-002',
                    path: '/api/projects',
                    method: 'GET',
                    description: 'Get all projects',
                    summary: 'Retrieves a list of all projects for the authenticated user',
                    parameters: [
                        {
                            name: 'page',
                            in: 'query',
                            type: 'integer',
                            description: 'Page number for pagination',
                            required: false,
                            default: 1
                        },
                        {
                            name: 'limit',
                            in: 'query',
                            type: 'integer',
                            description: 'Number of items per page',
                            required: false,
                            default: 20
                        },
                        {
                            name: 'status',
                            in: 'query',
                            type: 'string',
                            description: 'Filter by project status',
                            required: false,
                            enum: ['active', 'archived', 'deleted']
                        }
                    ],
                    responses: {
                        '200': {
                            description: 'List of projects',
                            schema: {
                                type: 'object',
                                properties: {
                                    projects: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                id: { type: 'string', format: 'uuid' },
                                                name: { type: 'string' },
                                                description: { type: 'string' },
                                                status: { type: 'string' },
                                                created_at: { type: 'string', format: 'date-time' }
                                            }
                                        }
                                    },
                                    pagination: {
                                        type: 'object',
                                        properties: {
                                            page: { type: 'integer' },
                                            limit: { type: 'integer' },
                                            total: { type: 'integer' },
                                            totalPages: { type: 'integer' }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    tags: ['Projects']
                },
                {
                    id: 'endpoint-003',
                    path: '/api/projects/{id}',
                    method: 'GET',
                    description: 'Get project by ID',
                    summary: 'Retrieves a specific project by its ID',
                    parameters: [
                        {
                            name: 'id',
                            in: 'path',
                            type: 'string',
                            format: 'uuid',
                            description: 'Project ID',
                            required: true
                        }
                    ],
                    responses: {
                        '200': {
                            description: 'Project details',
                            schema: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string', format: 'uuid' },
                                    name: { type: 'string' },
                                    description: { type: 'string' },
                                    owner_id: { type: 'string', format: 'uuid' },
                                    status: { type: 'string' },
                                    created_at: { type: 'string', format: 'date-time' },
                                    updated_at: { type: 'string', format: 'date-time' }
                                }
                            }
                        },
                        '404': {
                            description: 'Project not found'
                        }
                    },
                    tags: ['Projects']
                },
                {
                    id: 'endpoint-004',
                    path: '/api/projects/{id}',
                    method: 'PUT',
                    description: 'Update project',
                    summary: 'Updates an existing project',
                    parameters: [
                        {
                            name: 'id',
                            in: 'path',
                            type: 'string',
                            format: 'uuid',
                            description: 'Project ID',
                            required: true
                        }
                    ],
                    requestBody: {
                        description: 'Project update data',
                        required: true,
                        schema: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                description: { type: 'string' },
                                status: { type: 'string', enum: ['active', 'archived', 'deleted'] }
                            }
                        }
                    },
                    responses: {
                        '200': {
                            description: 'Project updated successfully',
                            schema: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string', format: 'uuid' },
                                    name: { type: 'string' },
                                    description: { type: 'string' },
                                    status: { type: 'string' },
                                    updated_at: { type: 'string', format: 'date-time' }
                                }
                            }
                        },
                        '404': {
                            description: 'Project not found'
                        }
                    },
                    tags: ['Projects']
                },
                {
                    id: 'endpoint-005',
                    path: '/api/analysis',
                    method: 'POST',
                    description: 'Create analysis',
                    summary: 'Creates a new analysis for a project',
                    parameters: [],
                    requestBody: {
                        description: 'Analysis creation data',
                        required: true,
                        schema: {
                            type: 'object',
                            properties: {
                                project_id: { type: 'string', format: 'uuid' },
                                analysis_type: { type: 'string' },
                                options: { type: 'object' }
                            },
                            required: ['project_id', 'analysis_type']
                        }
                    },
                    responses: {
                        '201': {
                            description: 'Analysis created successfully',
                            schema: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string', format: 'uuid' },
                                    project_id: { type: 'string', format: 'uuid' },
                                    analysis_type: { type: 'string' },
                                    status: { type: 'string', default: 'pending' },
                                    created_at: { type: 'string', format: 'date-time' }
                                }
                            }
                        }
                    },
                    tags: ['Analysis']
                }
            ],
            schemas: {
                Project: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid', description: 'Unique project identifier' },
                        name: { type: 'string', description: 'Project name' },
                        description: { type: 'string', description: 'Project description' },
                        owner_id: { type: 'string', format: 'uuid', description: 'Project owner ID' },
                        status: { type: 'string', enum: ['active', 'archived', 'deleted'], description: 'Project status' },
                        created_at: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
                        updated_at: { type: 'string', format: 'date-time', description: 'Last update timestamp' }
                    },
                    required: ['name', 'owner_id']
                },
                Analysis: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid', description: 'Unique analysis identifier' },
                        project_id: { type: 'string', format: 'uuid', description: 'Associated project ID' },
                        analysis_type: { type: 'string', description: 'Type of analysis' },
                        results: { type: 'object', description: 'Analysis results' },
                        score: { type: 'number', description: 'Analysis score' },
                        status: { type: 'string', enum: ['pending', 'running', 'completed', 'failed'], description: 'Analysis status' },
                        created_at: { type: 'string', format: 'date-time', description: 'Creation timestamp' }
                    },
                    required: ['project_id', 'analysis_type']
                }
            },
            tags: ['Health', 'Projects', 'Analysis'],
            security: {
                authentication: {
                    type: 'Bearer',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            },
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Generate mock merge configurations
     * @returns {Object} Mock merge configurations
     */
    generateMockMergeConfigs() {
        return {
            timestamp: new Date().toISOString(),
            type: 'merge-configurations',
            configurations: [
                {
                    id: 'merge-config-001',
                    name: 'Default Merge Strategy',
                    description: 'Default configuration for code merging',
                    version: '1.0.0',
                    settings: {
                        strategy: 'merge-commit',
                        conflictResolution: 'manual',
                        autoMerge: {
                            enabled: false,
                            types: ['json', 'yaml', 'md']
                        },
                        validation: {
                            enabled: true,
                            rules: ['no-merge-commits', 'line-length', 'file-size']
                        },
                        notifications: {
                            enabled: true,
                            channels: ['email', 'slack'],
                            events: ['merge-request', 'merge-complete', 'conflict']
                        }
                    },
                    rules: [
                        {
                            name: 'No merge commits',
                            description: 'Prevent merging merge commits',
                            enabled: true,
                            severity: 'error'
                        },
                        {
                            name: 'Line length limit',
                            description: 'Check line length does not exceed limit',
                            enabled: true,
                            severity: 'warning',
                            parameters: {
                                maxLength: 120
                            }
                        },
                        {
                            name: 'File size limit',
                            description: 'Check file size does not exceed limit',
                            enabled: true,
                            severity: 'warning',
                            parameters: {
                                maxSize: '1MB'
                            }
                        }
                    ],
                    lastUpdated: new Date().toISOString()
                },
                {
                    id: 'merge-config-002',
                    name: 'Feature Branch Strategy',
                    description: 'Configuration for feature branch development',
                    version: '1.0.0',
                    settings: {
                        strategy: 'rebase-merge',
                        conflictResolution: 'auto',
                        autoMerge: {
                            enabled: true,
                            types: ['json', 'yaml', 'md', 'js', 'ts']
                        },
                        validation: {
                            enabled: true,
                            rules: ['no-merge-commits', 'line-length', 'file-size', 'test-coverage']
                        },
                        notifications: {
                            enabled: true,
                            channels: ['email', 'slack'],
                            events: ['merge-request', 'merge-complete', 'conflict', 'test-failure']
                        }
                    },
                    rules: [
                        {
                            name: 'No merge commits',
                            description: 'Prevent merging merge commits',
                            enabled: true,
                            severity: 'error'
                        },
                        {
                            name: 'Line length limit',
                            description: 'Check line length does not exceed limit',
                            enabled: true,
                            severity: 'warning',
                            parameters: {
                                maxLength: 100
                            }
                        },
                        {
                            name: 'Test coverage',
                            description: 'Ensure test coverage meets minimum threshold',
                            enabled: true,
                            severity: 'error',
                            parameters: {
                                minCoverage: 80
                            }
                        }
                    ],
                    lastUpdated: new Date().toISOString()
                },
                {
                    id: 'merge-config-003',
                    name: 'Hotfix Strategy',
                    description: 'Configuration for hotfix branches',
                    version: '1.0.0',
                    settings: {
                        strategy: 'fast-forward',
                        conflictResolution: 'auto',
                        autoMerge: {
                            enabled: true,
                            types: ['json', 'yaml', 'md', 'js', 'ts', 'py']
                        },
                        validation: {
                            enabled: false,
                            rules: []
                        },
                        notifications: {
                            enabled: true,
                            channels: ['slack'],
                            events: ['merge-complete', 'conflict', 'deployment']
                        }
                    },
                    rules: [],
                    lastUpdated: new Date().toISOString()
                }
            ],
            summary: {
                totalConfigurations: 3,
                strategies: ['merge-commit', 'rebase-merge', 'fast-forward'],
                conflictResolutions: ['manual', 'auto'],
                lastUpdated: new Date().toISOString()
            },
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Clear cache entries
     * @param {string} key - Specific cache key to clear (optional)
     */
    clearCache(key = null) {
        if (key) {
            this.cache.delete(key);
        } else {
            this.cache.clear();
        }
    }

    /**
     * Get adapter status
     * @returns {Object} Adapter status
     */
    getStatus() {
        return {
            initialized: this.initialized,
            cacheSize: this.cache.size,
            paths: this.paths,
            featureConfig: this.featureConfig,
            lastUpdate: new Date().toISOString()
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DevelopmentDataAdapter;
}

// Auto-initialize if in browser environment
if (typeof window !== 'undefined') {
    window.DevelopmentDataAdapter = DevelopmentDataAdapter;
}
