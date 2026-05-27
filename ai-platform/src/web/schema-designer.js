/**
 * Schema Designer
 * Designs database schemas based on extracted patterns
 * Provides comprehensive schema visualization and SQL generation
 */

class SchemaDesigner {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            showDetails: true,
            interactiveElements: true,
            theme: 'dark',
            realTimeUpdates: true,
            updateInterval: 30000,
            databaseType: 'postgresql',
            ...options
        };
        this.data = null;
        this.patterns = [];
        this.schemas = [];
        this.relationships = [];
        
        this.init();
    }

    /**
     * Initialize the schema designer
     */
    init() {
        if (!this.container) {
            console.error('Schema designer container not found');
            return;
        }

        this.setupStyles();
        this.createDesignerStructure();
        this.bindEvents();
        
        if (this.options.realTimeUpdates) {
            this.startRealTimeUpdates();
        }
    }

    /**
     * Setup CSS styles for the designer
     */
    setupStyles() {
        const styleId = 'schema-designer-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .schema-designer {
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    border-radius: 12px;
                    padding: 2rem;
                    margin: 1rem 0;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                }

                .designer-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                    padding-bottom: 1rem;
                    border-bottom: 1px solid rgba(148, 163, 184, 0.2);
                }

                .designer-title {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin: 0;
                }

                .designer-controls {
                    display: flex;
                    gap: 1rem;
                    align-items: center;
                }

                .btn-design {
                    background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
                    color: white;
                    border: none;
                    padding: 0.5rem 1rem;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.3s ease;
                }

                .btn-design:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
                }

                .database-selector {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.3);
                    color: #e2e8f0;
                    padding: 0.5rem;
                    border-radius: 6px;
                    font-size: 0.9rem;
                }

                .design-config {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin-bottom: 2rem;
                }

                .config-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 1.5rem;
                }

                .config-item {
                    display: flex;
                    flex-direction: column;
                }

                .config-label {
                    color: #f8fafc;
                    font-weight: 500;
                    margin-bottom: 0.5rem;
                }

                .config-input {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.3);
                    color: #e2e8f0;
                    padding: 0.5rem;
                    border-radius: 6px;
                    font-size: 0.9rem;
                }

                .config-input:focus {
                    outline: none;
                    border-color: #8b5cf6;
                    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
                }

                .schema-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }

                .schema-card {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    transition: all 0.3s ease;
                }

                .schema-card:hover {
                    transform: translateY(-2px);
                    border-color: #8b5cf6;
                    box-shadow: 0 8px 25px rgba(139, 92, 246, 0.2);
                }

                .schema-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .schema-name {
                    font-size: 1.2rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .schema-type {
                    background: rgba(139, 92, 246, 0.2);
                    color: #8b5cf6;
                    padding: 0.25rem 0.75rem;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    font-weight: 500;
                }

                .schema-description {
                    color: #94a3b8;
                    font-size: 0.9rem;
                    margin-bottom: 1rem;
                }

                .schema-fields {
                    margin-bottom: 1rem;
                }

                .field-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.5rem 0;
                    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
                }

                .field-name {
                    color: #e2e8f0;
                    font-weight: 500;
                    font-size: 0.9rem;
                }

                .field-type {
                    color: #94a3b8;
                    font-size: 0.8rem;
                }

                .field-required {
                    color: #ef4444;
                    font-size: 0.8rem;
                }

                .sql-preview {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.3);
                    border-radius: 8px;
                    padding: 1rem;
                    margin-top: 1rem;
                    font-family: 'Courier New', monospace;
                    color: #e2e8f0;
                    font-size: 0.8rem;
                    overflow-x: auto;
                    max-height: 300px;
                    overflow-y: auto;
                }

                .relationship-section {
                    margin-top: 2rem;
                }

                .relationship-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 1.5rem;
                }

                .relationship-card {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                }

                .relationship-header {
                    display: flex;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .relationship-type {
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    margin-right: 0.5rem;
                }

                .one-to-many {
                    background: #3b82f6;
                }

                .many-to-one {
                    background: #10b981;
                }

                .many-to-many {
                    background: #f59e0b;
                }

                .relationship-name {
                    font-size: 1rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .relationship-details {
                    color: #94a3b8;
                    font-size: 0.9rem;
                    line-height: 1.4;
                }

                .diagram-section {
                    margin-top: 2rem;
                }

                .diagram-container {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 2rem;
                    min-height: 400px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .diagram-placeholder {
                    text-align: center;
                    color: #94a3b8;
                }

                .action-buttons {
                    display: flex;
                    gap: 1rem;
                    margin-top: 2rem;
                }

                .btn-primary {
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.3s ease;
                }

                .btn-primary:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                }

                .btn-secondary {
                    background: rgba(148, 163, 184, 0.2);
                    color: #f8fafc;
                    border: 1px solid rgba(148, 163, 184, 0.3);
                    padding: 0.75rem 1.5rem;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.3s ease;
                }

                .btn-secondary:hover {
                    background: rgba(148, 163, 184, 0.3);
                }

                .export-section {
                    margin-top: 2rem;
                }

                .export-options {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                }

                .export-option {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 8px;
                    padding: 1rem;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .export-option:hover {
                    border-color: #3b82f6;
                    background: rgba(59, 130, 246, 0.1);
                }

                .export-icon {
                    font-size: 2rem;
                    color: #3b82f6;
                    margin-bottom: 0.5rem;
                }

                .export-label {
                    color: #f8fafc;
                    font-weight: 500;
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Create designer structure
     */
    createDesignerStructure() {
        this.container.textContent = `
            <div class="designer-header">
                <h2 class="designer-title">Schema Designer</h2>
                <div class="designer-controls">
                    <select class="database-selector" id="database-type">
                        <option value="postgresql">PostgreSQL</option>
                        <option value="mysql">MySQL</option>
                        <option value="sqlite">SQLite</option>
                        <option value="mongodb">MongoDB</option>
                    </select>
                    <button class="btn-design" onclick="schemaDesigner.generateSchemas()">
                        <i class="fas fa-magic"></i> Generate Schemas
                    </button>
                </div>
            </div>

            <div class="design-config">
                <h3 class="designer-title">Schema Configuration</h3>
                <div class="config-grid">
                    <div class="config-item">
                        <label class="config-label">Naming Convention</label>
                        <select class="config-input" id="naming-convention">
                            <option value="snake_case">snake_case</option>
                            <option value="camelCase">camelCase</option>
                            <option value="PascalCase">PascalCase</option>
                        </select>
                    </div>
                    <div class="config-item">
                        <label class="config-label">Primary Key Type</label>
                        <select class="config-input" id="primary-key-type">
                            <option value="serial">SERIAL</option>
                            <option value="uuid">UUID</option>
                            <option value="bigint">BIGINT</option>
                        </select>
                    </div>
                    <div class="config-item">
                        <label class="config-label">Timestamp Fields</label>
                        <select class="config-input" id="timestamp-fields">
                            <option value="created_updated">created_at, updated_at</option>
                            <option value="created_only">created_at</option>
                            <option value="none">None</option>
                        </select>
                    </div>
                    <div class="config-item">
                        <label class="config-label">Foreign Key Naming</label>
                        <select class="config-input" id="fk-naming">
                            <option value="table_id">table_id</option>
                            <option value="tableid">tableid</option>
                            <option value="id_table">id_table</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="schema-grid" id="schema-grid">
                <!-- Schemas will be generated here -->
            </div>

            <div class="relationship-section">
                <h3 class="designer-title">Relationships</h3>
                <div class="relationship-grid" id="relationship-grid">
                    <!-- Relationships will be generated here -->
                </div>
            </div>

            <div class="diagram-section">
                <h3 class="designer-title">Entity Relationship Diagram</h3>
                <div class="diagram-container" id="diagram-container">
                    <div class="diagram-placeholder">
                        <i class="fas fa-project-diagram fa-3x mb-3"></i>
                        <p>Entity relationship diagram will be displayed here</p>
                    </div>
                </div>
            </div>

            <div class="export-section">
                <h3 class="designer-title">Export Options</h3>
                <div class="export-options">
                    <div class="export-option" onclick="schemaDesigner.exportSQL()">
                        <div class="export-icon">
                            <i class="fas fa-database"></i>
                        </div>
                        <div class="export-label">SQL Script</div>
                    </div>
                    <div class="export-option" onclick="schemaDesigner.exportJSON()">
                        <div class="export-icon">
                            <i class="fas fa-code"></i>
                        </div>
                        <div class="export-label">JSON Schema</div>
                    </div>
                    <div class="export-option" onclick="schemaDesigner.exportDDL()">
                        <div class="export-icon">
                            <i class="fas fa-file-code"></i>
                        </div>
                        <div class="export-label">DDL File</div>
                    </div>
                    <div class="export-option" onclick="schemaDesigner.exportDiagram()">
                        <div class="export-icon">
                            <i class="fas fa-sitemap"></i>
                        </div>
                        <div class="export-label">Diagram</div>
                    </div>
                </div>
            </div>

            <div class="action-buttons">
                <button class="btn-primary" onclick="schemaDesigner.validateSchemas()">
                    <i class="fas fa-check-circle"></i> Validate Schemas
                </button>
                <button class="btn-secondary" onclick="schemaDesigner.resetDesigner()">
                    <i class="fas fa-redo"></i> Reset Designer
                </button>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Bind events
     */
    bindEvents() {
        // Event binding will be implemented here
    }

    /**
     * Generate schemas from patterns
     */
    async generateSchemas() {
        try {
            this.showLoading();
            
            // Load patterns (would come from pattern analyzer)
            this.patterns = await this.loadPatterns();
            
            // Get configuration
            const config = this.getConfiguration();
            
            // Generate schemas
            this.schemas = this.patterns.map(pattern => 
                this.generateSchema(pattern, config)
            );
            
            // Generate relationships
            this.relationships = this.generateRelationships(this.patterns, config);
            
            // Render results
            this.renderSchemas();
            this.renderRelationships();
            
            this.hideLoading();
            console.log('[SCHEMA_DESIGNER] Schema generation completed');
            
        } catch (error) {
            console.error('[SCHEMA_DESIGNER] Failed to generate schemas:', error);
            this.showError('Failed to generate schemas');
        }
    }

    /**
     * Get configuration
     */
    getConfiguration() {
        return {
            databaseType: document.getElementById('database-type').value,
            namingConvention: document.getElementById('naming-convention').value,
            primaryKeyType: document.getElementById('primary-key-type').value,
            timestampFields: document.getElementById('timestamp-fields').value,
            fkNaming: document.getElementById('fk-naming').value
        };
    }

    /**
     * Load patterns from pattern analyzer
     */
    async loadPatterns() {
        // This would load patterns from the pattern analyzer
        return [
            {
                id: 'user_profile',
                name: 'User Profile',
                type: 'user_data',
                fields: [
                    { name: 'id', type: 'serial', required: true },
                    { name: 'first_name', type: 'varchar', length: 50, required: true },
                    { name: 'last_name', type: 'varchar', length: 50, required: true },
                    { name: 'email', type: 'varchar', length: 100, required: true, unique: true },
                    { name: 'phone', type: 'varchar', length: 20, required: false },
                    { name: 'address', type: 'text', required: false },
                    { name: 'created_at', type: 'timestamp', required: true },
                    { name: 'updated_at', type: 'timestamp', required: true }
                ]
            },
            {
                id: 'api_response',
                name: 'API Response',
                type: 'api_data',
                fields: [
                    { name: 'id', type: 'serial', required: true },
                    { name: 'request_id', type: 'varchar', length: 100, required: true },
                    { name: 'status', type: 'varchar', length: 20, required: true },
                    { name: 'response_data', type: 'jsonb', required: true },
                    { name: 'response_time', type: 'integer', required: false },
                    { name: 'timestamp', type: 'timestamp', required: true }
                ]
            },
            {
                id: 'analytics_data',
                name: 'Analytics Data',
                type: 'analytics_data',
                fields: [
                    { name: 'id', type: 'serial', required: true },
                    { name: 'metric_name', type: 'varchar', length: 100, required: true },
                    { name: 'metric_value', type: 'decimal', precision: 10, scale: 2, required: true },
                    { name: 'metric_type', type: 'varchar', length: 50, required: true },
                    { name: 'timestamp', type: 'timestamp', required: true },
                    { name: 'tags', type: 'jsonb', required: false }
                ]
            }
        ];
    }

    /**
     * Generate schema from pattern
     */
    generateSchema(pattern, config) {
        const tableName = this.formatTableName(pattern.name, config.namingConvention);
        const fields = this.generateFields(pattern.fields, config);
        const sql = this.generateSQL(tableName, fields, config);
        const jsonSchema = this.generateJSONSchema(pattern, fields, config);
        
        return {
            id: pattern.id,
            name: pattern.name,
            tableName: tableName,
            type: pattern.type,
            fields: fields,
            sql: sql,
            jsonSchema: jsonSchema,
            indexes: this.generateIndexes(tableName, fields, config),
            constraints: this.generateConstraints(tableName, fields, config)
        };
    }

    /**
     * Format table name
     */
    formatTableName(name, convention) {
        switch (convention) {
            case 'snake_case':
                return name.toLowerCase().replace(/\s+/g, '_');
            case 'camelCase':
                return name.replace(/\s+(.)/g, (_, c) => c.toUpperCase());
            case 'PascalCase':
                return name.replace(/\s+(.)/g, (_, c) => c.toUpperCase());
            default:
                return name.toLowerCase().replace(/\s+/g, '_');
        }
    }

    /**
     * Generate fields
     */
    generateFields(patternFields, config) {
        return patternFields.map(field => ({
            ...field,
            columnName: this.formatColumnName(field.name, config.namingConvention),
            sqlType: this.getSQLType(field.type, field),
            nullable: !field.required,
            defaultValue: this.getDefaultValue(field),
            constraints: this.getFieldConstraints(field)
        }));
    }

    /**
     * Format column name
     */
    formatColumnName(name, convention) {
        switch (convention) {
            case 'snake_case':
                return name.toLowerCase().replace(/([A-Z])/g, '_$1').toLowerCase();
            case 'camelCase':
                return name.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
            case 'PascalCase':
                return name.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
            default:
                return name.toLowerCase();
        }
    }

    /**
     * Get SQL type
     */
    getSQLType(type, field) {
        switch (type) {
            case 'serial':
                return 'SERIAL';
            case 'uuid':
                return 'UUID';
            case 'bigint':
                return 'BIGINT';
            case 'varchar':
                return `VARCHAR(${field.length || 255})`;
            case 'text':
                return 'TEXT';
            case 'integer':
                return 'INTEGER';
            case 'decimal':
                return `DECIMAL(${field.precision || 10}, ${field.scale || 2})`;
            case 'timestamp':
                return 'TIMESTAMP';
            case 'boolean':
                return 'BOOLEAN';
            case 'jsonb':
                return 'JSONB';
            case 'date':
                return 'DATE';
            case 'time':
                return 'TIME';
            default:
                return 'VARCHAR(255)';
        }
    }

    /**
     * Get default value
     */
    getDefaultValue(field) {
        if (field.type === 'timestamp') {
            return 'CURRENT_TIMESTAMP';
        }
        if (field.type === 'boolean') {
            return 'FALSE';
        }
        return null;
    }

    /**
     * Get field constraints
     */
    getFieldConstraints(field) {
        const constraints = [];
        
        if (field.required) {
            constraints.push('NOT NULL');
        }
        
        if (field.unique) {
            constraints.push('UNIQUE');
        }
        
        return constraints;
    }

    /**
     * Generate SQL schema
     */
    generateSQL(tableName, fields, config) {
        const databaseType = config.databaseType;
        
        let sql = `CREATE TABLE ${tableName} (\n`;
        
        // Add fields
        fields.forEach((field, index) => {
            const isLast = index === fields.length - 1;
            sql += `    ${field.columnName} ${field.sqlType}`;
            
            if (field.nullable) {
                sql += ' NULL';
            } else {
                sql += ' NOT NULL';
            }
            
            if (field.defaultValue) {
                sql += ` DEFAULT ${field.defaultValue}`;
            }
            
            // Add constraints
            if (field.constraints && field.constraints.length > 0) {
                sql += ' ' + field.constraints.join(' ');
            }
            
            if (!isLast) {
                sql += ',\n';
            }
        });
        
        sql += '\n);\n';
        
        // Add indexes
        const indexes = this.generateIndexes(tableName, fields, config);
        if (indexes.length > 0) {
            sql += indexes.join('\n') + '\n';
        }
        
        return sql;
    }

    /**
     * Generate indexes
     */
    generateIndexes(tableName, fields, config) {
        const indexes = [];
        
        // Primary key index (SERIAL doesn't need explicit index)
        const primaryField = fields.find(f => f.type === 'serial' || f.type === 'bigint');
        if (primaryField && primaryField.type !== 'serial') {
            indexes.push(`CREATE INDEX idx_${tableName}_${primaryField.columnName} ON ${tableName}(${primaryField.columnName});`);
        }
        
        // Unique indexes
        fields.filter(f => f.unique).forEach(field => {
            indexes.push(`CREATE UNIQUE INDEX idx_${tableName}_${field.columnName}_unique ON ${tableName}(${field.columnName});`);
        });
        
        // Index on timestamp fields
        fields.filter(f => f.type === 'timestamp').forEach(field => {
            indexes.push(`CREATE INDEX idx_${tableName}_${field.columnName} ON ${tableName}(${field.columnName});`);
        });
        
        // Foreign key indexes
        fields.filter(f => f.columnName.endsWith('_id')).forEach(field => {
            indexes.push(`CREATE INDEX idx_${tableName}_${field.columnName} ON ${tableName}(${field.columnName});`);
        });
        
        return indexes;
    }

    /**
     * Generate constraints
     */
    generateConstraints(tableName, fields, config) {
        const constraints = [];
        
        // Foreign key constraints
        fields.filter(f => f.columnName.endsWith('_id')).forEach(field => {
            const referencedTable = field.columnName.replace('_id', '');
            constraints.push(`ALTER TABLE ${tableName} ADD CONSTRAINT fk_${tableName}_${field.columnName} FOREIGN KEY (${field.columnName}) REFERENCES ${referencedTable}(id);`);
        });
        
        return constraints;
    }

    /**
     * Generate JSON schema
     */
    generateJSONSchema(pattern, fields, config) {
        const properties = {};
        
        fields.forEach(field => {
            const prop = {
                type: this.getJSONType(field.type),
                description: field.name
            };
            
            if (!field.required) {
                prop.type = [prop.type, 'null'];
            }
            
            if (field.type === 'varchar' && field.length) {
                prop.maxLength = field.length;
            }
            
            if (field.type === 'decimal' && field.precision) {
                prop.type = 'number';
                prop.minimum = 0;
                prop.maximum = Math.pow(10, field.precision - field.scale) - 1;
            }
            
            properties[field.name] = prop;
        });
        
        const required = fields.filter(f => f.required).map(f => f.name);
        
        return {
            $schema: 'http://json-schema.org/draft-07/schema#',
            type: 'object',
            title: pattern.name,
            properties: properties,
            required: required,
            additionalProperties: false
        };
    }

    /**
     * Get JSON type
     */
    getJSONType(sqlType) {
        switch (sqlType) {
            case 'serial':
            case 'bigint':
            case 'integer':
                return 'integer';
            case 'decimal':
                return 'number';
            case 'varchar':
            case 'text':
                return 'string';
            case 'boolean':
                return 'boolean';
            case 'timestamp':
                return 'string';
            case 'date':
                return 'string';
            case 'time':
                return 'string';
            case 'jsonb':
                return 'object';
            default:
                return 'string';
        }
    }

    /**
     * Generate relationships
     */
    generateRelationships(patterns, config) {
        const relationships = [];
        
        // Generate sample relationships based on patterns
        relationships.push({
            id: 'user_profile_api_response',
            type: 'one-to-many',
            fromTable: 'user_profile',
            toTable: 'api_response',
            fromField: 'id',
            toField: 'user_id',
            description: 'User can have multiple API responses'
        });
        
        relationships.push({
            id: 'api_response_analytics_data',
            type: 'many-to-one',
            fromTable: 'api_response',
            toTable: 'analytics_data',
            fromField: 'id',
            toField: 'response_id',
            description: 'API response can be linked to analytics data'
        });
        
        return relationships;
    }

    /**
     * Render schemas
     */
    renderSchemas() {
        const schemaGrid = document.getElementById('schema-grid');
        
        schemaGrid.textContent = this.schemas.map(schema => `
            <div class="schema-card" onclick="schemaDesigner.showSchemaDetails('${schema.id}')">
                <div class="schema-header">
                    <span class="schema-name">${schema.name}</span>
                    <span class="schema-type">${schema.tableName}</span>
                </div>
                <div class="schema-description">
                    ${schema.type} schema with ${schema.fields.length} fields
                </div>
                <div class="schema-fields">
                    ${schema.fields.slice(0, 5).map(field => `
                        <div class="field-item">
                            <span class="field-name">${field.columnName}</span>
                            <span class="field-type">${field.sqlType}</span>
                            ${field.required ? '<span class="field-required">REQUIRED</span>' : ''}
                        </div>
                    `).join('')}
                    ${schema.fields.length > 5 ? '<div class="field-item"><span class="field-name">... and ' + (schema.fields.length - 5) + ' more fields</span></div>' : ''}
                </div>
                <div class="sql-preview">
                    <pre>${schema.sql.substring(0, 200)}${schema.sql.length > 200 ? '...' : ''}</pre>
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render relationships
     */
    renderRelationships() {
        const relationshipGrid = document.getElementById('relationship-grid');
        
        relationshipGrid.textContent = this.relationships.map(rel => `
            <div class="relationship-card">
                <div class="relationship-header">
                    <span class="relationship-type ${rel.type.replace('-', '_')}"></span>
                    <span class="relationship-name">${rel.fromTable} → ${rel.toTable}</span>
                </div>
                <div class="relationship-details">
                    <strong>From:</strong> ${rel.fromTable} (${rel.fromField})<br>
                    <strong>To:</strong> ${rel.toTable} (${rel.toField})<br>
                    <strong>Type:</strong> ${rel.type.replace('-', ' ')}<br>
                    <strong>Description:</strong> ${rel.description}
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Show schema details
     */
    showSchemaDetails(schemaId) {
        const schema = this.schemas.find(s => s.id === schemaId);
        if (schema) {
            console.log('Schema details:', schema);
            // This would show a modal or detailed view
        }
    }

    /**
     * Validate schemas
     */
    validateSchemas() {
        try {
            this.showLoading();
            
            const validationResults = this.schemas.map(schema => this.validateSchema(schema));
            
            const hasErrors = validationResults.some(result => result.hasErrors);
            
            this.hideLoading();
            
            if (hasErrors) {
                this.showError('Schema validation failed. Please check the console for details.');
            } else {
                this.showSuccess('All schemas validated successfully!');
            }
            
        } catch (error) {
            console.error('[SCHEMA_DESIGNER] Failed to validate schemas:', error);
            this.showError('Failed to validate schemas');
        }
    }

    /**
     * Validate schema
     */
    validateSchema(schema) {
        const errors = [];
        
        // Check for required fields
        if (!schema.fields.find(f => f.type === 'serial' || f.type === 'bigint')) {
            errors.push('Schema must have a primary key field');
        }
        
        // Check for timestamp fields
        if (this.options.timestampFields === 'created_updated' && 
            !schema.fields.some(f => f.name === 'created_at') && 
            !schema.fields.some(f => f.name === 'updated_at')) {
            errors.push('Schema should have created_at and updated_at fields');
        }
        
        return {
            schemaId: schema.id,
            hasErrors: errors.length > 0,
            errors: errors
        };
    }

    /**
     * Export SQL
     */
    exportSQL() {
        const sql = this.schemas.map(schema => schema.sql).join('\n\n');
        
        const blob = new Blob([sql], { type: 'text/sql' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `schema-${new Date().toISOString().split('T')[0]}.sql`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObject(url);
    }

    /**
     * Export JSON
     */
    exportJSON() {
        const data = {
            schemas: this.schemas,
            relationships: this.relationships,
            config: this.getConfiguration(),
            exportedAt: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `schemas-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObject(url);
    }

    /**
     * Export DDL
     */
    exportDDL() {
        const ddl = this.generateDDL();
        
        const blob = new Blob([ddl], { type: 'text/sql' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `schema-ddl-${new Date().toISOString().split('T')[0]}.sql`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObject(url);
    }

    /**
     * Generate DDL
     */
    generateDDL() {
        let ddl = '-- Database Schema DDL\n';
        ddl += `-- Generated: ${new Date().toISOString()}\n\n`;
        
        this.schemas.forEach(schema => {
            ddl += `-- Schema: ${schema.name}\n`;
            ddl += schema.sql;
            ddl += '\n';
            
            // Add constraints
            if (schema.constraints && schema.constraints.length > 0) {
                ddl += '-- Constraints\n';
                ddl += schema.constraints.join('\n') + '\n';
            }
            
            ddl += '\n';
        });
        
        return ddl;
    }

    /**
     * Export diagram
     */
    exportDiagram() {
        // This would generate and export an entity relationship diagram
        const diagram = this.generateERD();
        
        const blob = new Blob([diagram], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `er-diagram-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObject(url);
    }

    /**
     * Generate ERD
     */
    generateERD() {
        let erd = 'Entity Relationship Diagram\n';
        erd += 'Generated: ' + new Date().toISOString() + '\n\n';
        
        this.schemas.forEach(schema => {
            erd += `Entity: ${schema.name}\n`;
            erd += `Table: ${schema.tableName}\n`;
            erd += `Fields: ${schema.fields.map(f => `  - ${f.columnName} (${f.sqlType})`).join('\n')}\n`;
            
            // Add relationships
            const relatedRels = this.relationships.filter(r => 
                r.fromTable === schema.tableName || r.toTable === schema.tableName
            );
            
            if (relatedRels.length > 0) {
                erd += 'Relationships:\n';
                relatedRels.forEach(rel => {
                    erd += `  - ${rel.fromTable} → ${rel.toTable} (${rel.type})\n`;
                });
            }
            
            erd += '\n';
        });
        
        return erd;
    }

    /**
     * Reset designer
     */
    resetDesigner() {
        this.schemas = [];
        this.relationships = [];
        
        // Reset UI
        document.getElementById('schema-grid').textContent = '' /* Replaced innerHTML with textContent for safety */
        document.getElementById('relationship-grid').textContent = '' /* Replaced innerHTML with textContent for safety */
        
        // Reset configuration
        document.getElementById('database-type').value = 'postgresql';
        document.getElementById('naming-convention').value = 'snake_case';
        document.getElementById('primary-key-type').value = 'serial';
        document.getElementById('timestamp-fields').value = 'created_updated';
        document.getElementById('fk-naming').value = 'table_id';
        
        console.log('[SCHEMA_DESIGNER] Designer reset');
    }

    /**
     * Helper methods
     */
    showLoading() {
        // Show loading indicator
    }

    hideLoading() {
        // Hide loading indicator
    }

    showError(message) {
        // Show error message
        console.error('[SCHEMA_DESIGNER]', message);
    }

    showSuccess(message) {
        // Show success message
        console.log('[SCHEMA_DESIGNER]', message);
    }

    /**
     * Start real-time updates
     */
    startRealTimeUpdates() {
        // Implementation for real-time updates
    }

    /**
     * Destroy designer
     */
    destroy() {
        // Cleanup resources
    }
}

// Global instance
let schemaDesigner = null;

// Initialize when DOM is ready
function initializeSchemaDesigner(containerId = 'schema-designer-container') {
    if (!schemaDesigner) {
        schemaDesigner = new SchemaDesigner(containerId);
    }
    return schemaDesigner;
}
