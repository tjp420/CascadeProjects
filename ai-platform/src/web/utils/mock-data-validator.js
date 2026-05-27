/**
 * Mock Data Validator and Version Controller
 * 
 * This module provides version control and schema validation for mock data
 * to ensure consistency across the codebase and prevent breaking changes.
 * 
 * @version 1.1.0
 * @created 2026-05-20
 * @updated 2026-05-20 - Added report schema validation

// ============================================================================
// VERSION CONTROL SYSTEM
// ============================================================================

/**
 * Mock data version registry
 * Tracks versions of different mock data sources
 */
const MOCK_DATA_VERSIONS = {
    'team-data': '1.2.0',
    'roadmap-data': '1.1.0',
    'performance-data': '1.0.0',
    'debug-data': '1.0.0',
    'export-mock-data': '1.0.0',
    'test-fixtures': '2.0.0',
    'test-data-generator': '1.5.0',
    'comprehensive-analysis': '1.3.0',
    'mock-data-analysis': '1.0.0',
    'report-data': '1.0.0',
    'resource-utilization-report': '1.0.0',
    'performance-report': '1.0.0',
    'code-quality-report': '1.0.0',
    'security-audit-report': '1.0.0',
};

/**
 * Version history log
 * Tracks changes to mock data versions over time
 */
const VERSION_HISTORY = [
    {
        version: '1.0.0',
        date: '2026-05-01',
        changes: ['Initial version of mock data system'],
        sources: ['team-data', 'roadmap-data', 'performance-data'],
    },
    {
        version: '1.1.0',
        date: '2026-05-10',
        changes: ['Added sprint status data', 'Updated roadmap structure'],
        sources: ['roadmap-data', 'sprint-data'],
    },
    {
        version: '1.2.0',
        date: '2026-05-15',
        changes: ['Enhanced team data with performance metrics', 'Added department information'],
        sources: ['team-data'],
    },
    {
        version: '1.3.0',
        date: '2026-05-18',
        changes: [
            'Updated comprehensive analysis with new metrics',
            'Added security vulnerability scan',
        ],
        sources: ['comprehensive-analysis'],
    },
    {
        version: '2.0.0',
        date: '2026-05-20',
        changes: ['Major refactor of test fixtures', 'Added new fixture categories'],
        sources: ['test-fixtures'],
    },
];

/**
 * Get current version of a mock data source
 * @param {string} sourceName - Name of the mock data source
 * @returns {string} Current version or 'unknown' if not found
 */
function getMockDataVersion(sourceName) {
    return MOCK_DATA_VERSIONS[sourceName] || 'unknown';
}

/**
 * Set version for a mock data source
 * @param {string} sourceName - Name of the mock data source
 * @param {string} version - New version string (semantic versioning)
 * @returns {boolean} Success status
 */
function setMockDataVersion(sourceName, version) {
    if (!isValidVersion(version)) {
        console.error(`Invalid version format: ${version}`);
        return false;
    }

    const oldVersion = MOCK_DATA_VERSIONS[sourceName];
    MOCK_DATA_VERSIONS[sourceName] = version;

    // Log version change
    VERSION_HISTORY.push({
        version: version,
        date: new Date().toISOString().split('T')[0],
        changes: [`Version bumped from ${oldVersion || 'none'} to ${version}`],
        sources: [sourceName],
    });

    console.log(`Updated ${sourceName} from version ${oldVersion || 'none'} to ${version}`);
    return true;
}

/**
 * Validate semantic version format
 * @param {string} version - Version string to validate
 * @returns {boolean} Valid version format
 */
function isValidVersion(version) {
    const semanticVersionRegex =
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
    return semanticVersionRegex.test(version);
}

/**
 * Compare two version strings
 * @param {string} version1 - First version string
 * @param {string} version2 - Second version string
 * @returns {number} -1 if version1 < version2, 0 if equal, 1 if version1 > version2
 */
function compareVersions(version1, version2) {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
        const v1Part = v1Parts[i] || 0;
        const v2Part = v2Parts[i] || 0;

        if (v1Part < v2Part) {
            return -1;
        }
        if (v1Part > v2Part) {
            return 1;
        }
    }

    return 0;
}

/**
 * Get version history for a specific source
 * @param {string} sourceName - Name of the mock data source
 * @returns {Array} Array of version history entries
 */
function getVersionHistory(sourceName) {
    return VERSION_HISTORY.filter((entry) => entry.sources.includes(sourceName));
}

/**
 * Get all mock data versions
 * @returns {Object} Object containing all mock data versions
 */
function getAllVersions() {
    return { ...MOCK_DATA_VERSIONS };
}

// ============================================================================
// SCHEMA VALIDATION SYSTEM
// ============================================================================

/**
 * Mock data schema definitions
 * Defines expected structure for different mock data types
 */
const MOCK_DATA_SCHEMAS = {
    'team-data': {
        type: 'object',
        required: ['teamMembers'],
        properties: {
            teamMembers: {
                type: 'array',
                minLength: 1,
                itemSchema: {
                    type: 'object',
                    required: ['id', 'name', 'role', 'email', 'status'],
                    properties: {
                        id: { type: 'string', pattern: '^member_\\d+$' },
                        name: { type: 'string', minLength: 2 },
                        role: {
                            type: 'string',
                            enum: [
                                'Project Manager',
                                'Lead Developer',
                                'Backend Developer',
                                'Frontend Developer',
                                'Designer',
                                'QA Engineer',
                            ],
                        },
                        email: { type: 'string', pattern: '^[\\w.-]+@[\\w.-]+\\.\\w+$' },
                        status: { type: 'string', enum: ['active', 'inactive', 'on-leave'] },
                        department: { type: 'string' },
                        performance: {
                            type: 'object',
                            properties: {
                                productivity: { type: 'number', minimum: 0, maximum: 100 },
                                quality: { type: 'number', minimum: 0, maximum: 100 },
                                collaboration: { type: 'number', minimum: 0, maximum: 100 },
                            },
                        },
                    },
                },
            },
        },
    },

    'roadmap-data': {
        type: 'object',
        required: ['currentQuarter', 'quarters'],
        properties: {
            currentQuarter: { type: 'string', pattern: '^Q[1-4] \\d{4}$' },
            quarters: {
                type: 'array',
                minLength: 1,
                itemSchema: {
                    type: 'object',
                    required: ['id', 'name', 'startDate', 'endDate', 'status'],
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        startDate: { type: 'string', format: 'date' },
                        endDate: { type: 'string', format: 'date' },
                        status: { type: 'string', enum: ['completed', 'active', 'planned'] },
                        progress: { type: 'number', minimum: 0, maximum: 100 },
                    },
                },
            },
        },
    },

    'performance-data': {
        type: 'object',
        required: ['overallMetrics'],
        properties: {
            overallMetrics: {
                type: 'object',
                required: ['avgResponseTime', 'throughput', 'errorRate', 'uptime'],
                properties: {
                    avgResponseTime: { type: 'number', minimum: 0 },
                    throughput: { type: 'number', minimum: 0 },
                    errorRate: { type: 'number', minimum: 0, maximum: 100 },
                    uptime: { type: 'number', minimum: 0, maximum: 100 },
                },
            },
        },
    },

    'export-mock-data': {
        type: 'object',
        properties: {
            overview: {
                type: 'object',
                properties: {
                    totalFiles: { type: 'number', minimum: 0 },
                    totalComplexity: { type: 'number', minimum: 0 },
                    performance: { type: 'number', minimum: 0, maximum: 100 },
                },
            },
            technicalDebt: {
                type: 'object',
                properties: {
                    high: { type: 'number', minimum: 0 },
                    medium: { type: 'number', minimum: 0 },
                    low: { type: 'number', minimum: 0 },
                },
            },
        },
    },

    'report-data': {
        type: 'object',
        required: ['reportInfo', 'metadata'],
        properties: {
            reportInfo: {
                type: 'object',
                required: ['name', 'type', 'category', 'format', 'status'],
                properties: {
                    name: { type: 'string', minLength: 1 },
                    description: { type: 'string' },
                    type: { type: 'string', enum: ['performance', 'quality', 'security', 'resources'] },
                    category: { type: 'string' },
                    format: { type: 'string', enum: ['pdf', 'excel', 'json'] },
                    generated: { type: 'string', format: 'date-time' },
                    status: { type: 'string', enum: ['ready', 'processing', 'failed'] },
                    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
                },
            },
            metadata: {
                type: 'object',
                required: ['id', 'size', 'schedule'],
                properties: {
                    id: { type: 'string', pattern: '^report_\\d+$' },
                    size: { type: 'number', minimum: 0 },
                    schedule: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
                    lastGenerated: { type: 'string', format: 'date-time' },
                    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
                    validationStatus: { type: 'string', enum: ['valid', 'invalid', 'pending'] },
                    templateSource: { type: 'string' },
                },
            },
            data: {
                type: 'object',
                properties: {
                    summary: {
                        type: 'object',
                        properties: {
                            totalMetrics: { type: 'number', minimum: 0 },
                            passed: { type: 'number', minimum: 0 },
                            failed: { type: 'number', minimum: 0 },
                            score: { type: 'number', minimum: 0, maximum: 100 },
                        },
                    },
                    metrics: {
                        type: 'array',
                        itemSchema: {
                            type: 'object',
                            required: ['name', 'value', 'status', 'trend'],
                            properties: {
                                name: { type: 'string', minLength: 1 },
                                value: { type: 'number' },
                                status: { type: 'string', enum: ['good', 'excellent', 'fair', 'optimal', 'poor'] },
                                trend: { type: 'string', enum: ['up', 'down', 'stable'] },
                            },
                        },
                    },
                    recommendations: {
                        type: 'array',
                        itemSchema: { type: 'string', minLength: 1 },
                    },
                },
            },
        },
    },

    'resource-utilization-report': {
        type: 'object',
        required: ['reportInfo', 'metadata', 'data'],
        properties: {
            reportInfo: {
                type: 'object',
                required: ['name', 'type', 'category'],
                properties: {
                    name: { type: 'string', enum: ['Resource Utilization'] },
                    type: { type: 'string', enum: ['resources'] },
                    category: { type: 'string', enum: ['operations'] },
                },
            },
            data: {
                type: 'object',
                required: ['summary', 'metrics'],
                properties: {
                    summary: {
                        type: 'object',
                        required: ['totalMetrics', 'passed', 'failed', 'score'],
                        properties: {
                            totalMetrics: { type: 'number', minimum: 0 },
                            passed: { type: 'number', minimum: 0 },
                            failed: { type: 'number', minimum: 0 },
                            score: { type: 'number', minimum: 0, maximum: 100 },
                        },
                    },
                    metrics: {
                        type: 'array',
                        minLength: 4,
                        itemSchema: {
                            type: 'object',
                            required: ['name', 'value', 'status', 'trend'],
                            properties: {
                                name: { type: 'string', enum: ['Performance', 'Quality', 'Security', 'Resources'] },
                                value: { type: 'number', minimum: 0, maximum: 100 },
                                status: { type: 'string' },
                                trend: { type: 'string', enum: ['up', 'down', 'stable'] },
                            },
                        },
                    },
                },
            },
        },
    },

    'performance-report': {
        type: 'object',
        required: ['reportInfo', 'metadata', 'data'],
        properties: {
            reportInfo: {
                type: 'object',
                required: ['name', 'type', 'category'],
                properties: {
                    name: { type: 'string', enum: ['Project Performance Report'] },
                    type: { type: 'string', enum: ['performance'] },
                    category: { type: 'string', enum: ['analytics'] },
                },
            },
            data: {
                type: 'object',
                required: ['summary', 'metrics'],
                properties: {
                    summary: {
                        type: 'object',
                        required: [
                            'totalProjects',
                            'activeProjects',
                            'completedProjects',
                            'overallPerformance',
                        ],
                        properties: {
                            totalProjects: { type: 'number', minimum: 0 },
                            activeProjects: { type: 'number', minimum: 0 },
                            completedProjects: { type: 'number', minimum: 0 },
                            overallPerformance: { type: 'number', minimum: 0, maximum: 100 },
                        },
                    },
                    metrics: {
                        type: 'array',
                        minLength: 4,
                        itemSchema: {
                            type: 'object',
                            required: ['name', 'value', 'status', 'trend'],
                            properties: {
                                name: { type: 'string' },
                                value: { type: 'number' },
                                status: { type: 'string' },
                                trend: { type: 'string', enum: ['up', 'down', 'stable'] },
                            },
                        },
                    },
                },
            },
        },
    },

    'code-quality-report': {
        type: 'object',
        required: ['reportInfo', 'metadata', 'data'],
        properties: {
            reportInfo: {
                type: 'object',
                required: ['name', 'type', 'category'],
                properties: {
                    name: { type: 'string', enum: ['Code Quality Analysis'] },
                    type: { type: 'string', enum: ['quality'] },
                    category: { type: 'string', enum: ['development'] },
                },
            },
            data: {
                type: 'object',
                required: ['summary', 'metrics'],
                properties: {
                    summary: {
                        type: 'object',
                        required: ['totalFiles', 'totalLines', 'codeCoverage', 'technicalDebt'],
                        properties: {
                            totalFiles: { type: 'number', minimum: 0 },
                            totalLines: { type: 'number', minimum: 0 },
                            codeCoverage: { type: 'number', minimum: 0, maximum: 100 },
                            technicalDebt: { type: 'number', minimum: 0 },
                        },
                    },
                    metrics: {
                        type: 'array',
                        minLength: 4,
                        itemSchema: {
                            type: 'object',
                            required: ['name', 'value', 'status', 'trend'],
                            properties: {
                                name: { type: 'string' },
                                value: { type: 'number' },
                                status: { type: 'string' },
                                trend: { type: 'string', enum: ['up', 'down', 'stable'] },
                            },
                        },
                    },
                },
            },
        },
    },

    'security-audit-report': {
        type: 'object',
        required: ['reportInfo', 'metadata', 'data'],
        properties: {
            reportInfo: {
                type: 'object',
                required: ['name', 'type', 'category'],
                properties: {
                    name: { type: 'string', enum: ['Security Audit Report'] },
                    type: { type: 'string', enum: ['security'] },
                    category: { type: 'string', enum: ['compliance'] },
                },
            },
            data: {
                type: 'object',
                required: ['summary', 'metrics'],
                properties: {
                    summary: {
                        type: 'object',
                        required: [
                            'totalVulnerabilities',
                            'critical',
                            'high',
                            'medium',
                            'low',
                            'complianceScore',
                        ],
                        properties: {
                            totalVulnerabilities: { type: 'number', minimum: 0 },
                            critical: { type: 'number', minimum: 0 },
                            high: { type: 'number', minimum: 0 },
                            medium: { type: 'number', minimum: 0 },
                            low: { type: 'number', minimum: 0 },
                            complianceScore: { type: 'number', minimum: 0, maximum: 100 },
                        },
                    },
                    metrics: {
                        type: 'array',
                        minLength: 4,
                        itemSchema: {
                            type: 'object',
                            required: ['name', 'value', 'status', 'trend'],
                            properties: {
                                name: { type: 'string' },
                                value: { type: 'number' },
                                status: { type: 'string' },
                                trend: { type: 'string', enum: ['up', 'down', 'stable'] },
                            },
                        },
                    },
                },
            },
        },
    },
};

/**
 * Validate mock data against schema
 * @param {string} sourceName - Name of the mock data source
 * @param {object} data - Mock data to validate
 * @returns {Object} Validation result with isValid flag and errors array
 */
function validateMockData(sourceName, data) {
    const schema = MOCK_DATA_SCHEMAS[sourceName];

    if (!schema) {
        return {
            isValid: true,
            errors: [],
            warnings: [`No schema defined for ${sourceName}, skipping validation`],
        };
    }

    const errors = [];
    const warnings = [];

    // Validate required fields
    if (schema.required) {
        schema.required.forEach((field) => {
            if (!data.hasOwnProperty(field)) {
                errors.push(`Missing required field: ${field}`);
            }
        });
    }

    // Validate data type
    if (schema.type && typeof data !== schema.type) {
        errors.push(`Expected type ${schema.type}, got ${typeof data}`);
    }

    // Validate properties
    if (schema.properties) {
        Object.entries(schema.properties).forEach(([propName, propSchema]) => {
            if (data.hasOwnProperty(propName)) {
                const propErrors = validateProperty(data[propName], propSchema, propName);
                errors.push(...propErrors);
            }
        });
    }

    return {
        isValid: errors.length === 0,
        errors: errors,
        warnings: warnings,
    };
}

/**
 * Validate a single property against its schema
 * @param {any} value - Property value to validate
 * @param {object} schema - Property schema
 * @param {string} propName - Property name for error messages
 * @returns {Array} Array of error messages
 */
function validateProperty(value, schema, propName) {
    const errors = [];

    // Type validation
    if (schema.type && typeof value !== schema.type) {
        errors.push(`${propName}: Expected type ${schema.type}, got ${typeof value}`);
    }

    // Minimum validation for numbers
    if (schema.type === 'number' && schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`${propName}: Value ${value} is below minimum ${schema.minimum}`);
    }

    // Maximum validation for numbers
    if (schema.type === 'number' && schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`${propName}: Value ${value} exceeds maximum ${schema.maximum}`);
    }

    // String pattern validation
    if (schema.type === 'string' && schema.pattern && !new RegExp(schema.pattern).test(value)) {
        errors.push(`${propName}: Value '${value}' does not match pattern ${schema.pattern}`);
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${propName}: Value '${value}' is not in allowed enum [${schema.enum.join(', ')}]`);
    }

    // Array validation
    if (schema.type === 'array' && !Array.isArray(value)) {
        errors.push(`${propName}: Expected array, got ${typeof value}`);
    }

    if (schema.type === 'array' && Array.isArray(value)) {
        if (schema.minLength && value.length < schema.minLength) {
            errors.push(`${propName}: Array length ${value.length} is below minimum ${schema.minLength}`);
        }

        // Validate array items if itemSchema is defined
        if (schema.itemSchema) {
            value.forEach((item, index) => {
                const itemErrors = validateProperty(item, schema.itemSchema, `${propName}[${index}]`);
                errors.push(...itemErrors);
            });
        }
    }

    // Object validation
    if (schema.type === 'object' && typeof value === 'object' && value !== null) {
        if (schema.required) {
            schema.required.forEach((field) => {
                if (!value.hasOwnProperty(field)) {
                    errors.push(`${propName}: Missing required field: ${field}`);
                }
            });
        }

        if (schema.properties) {
            Object.entries(schema.properties).forEach(([subPropName, subPropSchema]) => {
                if (value.hasOwnProperty(subPropName)) {
                    const subErrors = validateProperty(
                        value[subPropName],
                        subPropSchema,
                        `${propName}.${subPropName}`
                    );
                    errors.push(...subErrors);
                }
            });
        }
    }

    return errors;
}

/**
 * Validate all mock data sources
 * @param {Object} mockDataRegistry - Object containing all mock data sources
 * @returns {Object} Overall validation results
 */
function validateAllMockData(mockDataRegistry) {
    const results = {};
    let totalErrors = 0;
    let totalWarnings = 0;

    Object.keys(mockDataRegistry).forEach((sourceName) => {
        const result = validateMockData(sourceName, mockDataRegistry[sourceName]);
        results[sourceName] = result;
        totalErrors += result.errors.length;
        totalWarnings += result.warnings.length;
    });

    return {
        overall: {
            isValid: totalErrors === 0,
            totalErrors: totalErrors,
            totalWarnings: totalWarnings,
            sourcesChecked: Object.keys(results).length,
            sourcesValid: Object.values(results).filter((r) => r.isValid).length,
        },
        details: results,
    };
}

/**
 * Register a new schema for a mock data source
 * @param {string} sourceName - Name of the mock data source
 * @param {object} schema - Schema definition
 * @returns {boolean} Success status
 */
function registerSchema(sourceName, schema) {
    MOCK_DATA_SCHEMAS[sourceName] = schema;
    console.log(`Registered schema for ${sourceName}`);
    return true;
}

/**
 * Get schema for a mock data source
 * @param {string} sourceName - Name of the mock data source
 * @returns {object|null} Schema definition or null if not found
 */
function getSchema(sourceName) {
    return MOCK_DATA_SCHEMAS[sourceName] || null;
}

// ============================================================================
// MOCK DATA REGISTRY WITH VERSIONING
// ============================================================================

/**
 * Mock data registry with version tracking
 * Manages mock data sources with version information
 */
class MockDataRegistry {
    constructor() {
        this.registry = new Map();
        this.versionInfo = new Map();
    }

    /**
   * Register a mock data source with version
   * @param {string} name - Name of the data source
   * @param {any} data - Mock data
   * @param {string} version - Version string
   * @param {object} schema - Optional schema for validation
   * @returns {boolean} Success status
   */
    register(name, data, version, schema = null) {
    // Validate version format
        if (!isValidVersion(version)) {
            console.error(`Invalid version format for ${name}: ${version}`);
            return false;
        }

        // Validate data against schema if provided
        if (schema) {
            const validation = validateProperty(data, schema, name);
            if (!validation.isValid) {
                console.error(`Schema validation failed for ${name}:`, validation.errors);
                return false;
            }
        }

        // Register the data
        this.registry.set(name, {
            data: data,
            version: version,
            registeredAt: new Date().toISOString(),
            schema: schema,
        });

        // Update version registry
        this.versionInfo.set(name, {
            currentVersion: version,
            registeredAt: new Date().toISOString(),
        });

        console.log(`Registered ${name} version ${version}`);
        return true;
    }

    /**
   * Get mock data from registry
   * @param {string} name - Name of the data source
   * @returns {any|null} Mock data or null if not found
   */
    get(name) {
        const entry = this.registry.get(name);
        return entry ? entry.data : null;
    }

    /**
   * Get version information for a data source
   * @param {string} name - Name of the data source
   * @returns {object|null} Version information or null if not found
   */
    getVersionInfo(name) {
        return this.versionInfo.get(name) || null;
    }

    /**
   * Update mock data with new version
   * @param {string} name - Name of the data source
   * @param {any} newData - New mock data
   * @param {string} newVersion - New version string
   * @returns {boolean} Success status
   */
    update(name, newData, newVersion) {
        const entry = this.registry.get(name);
        if (!entry) {
            console.error(`Data source ${name} not found`);
            return false;
        }

        const oldVersion = entry.version;

        // Validate version is greater than old version
        if (compareVersions(newVersion, oldVersion) <= 0) {
            console.error(`New version ${newVersion} must be greater than old version ${oldVersion}`);
            return false;
        }

        // Validate against existing schema if available
        if (entry.schema) {
            const validation = validateProperty(newData, entry.schema, name);
            if (!validation.isValid) {
                console.error(`Schema validation failed for ${name}:`, validation.errors);
                return false;
            }
        }

        // Update the entry
        this.registry.set(name, {
            data: newData,
            version: newVersion,
            registeredAt: new Date().toISOString(),
            schema: entry.schema,
        });

        // Update version info
        this.versionInfo.set(name, {
            currentVersion: newVersion,
            previousVersion: oldVersion,
            updatedAt: new Date().toISOString(),
        });

        console.log(`Updated ${name} from version ${oldVersion} to ${newVersion}`);
        return true;
    }

    /**
   * Remove a data source from registry
   * @param {string} name - Name of the data source
   * @returns {boolean} Success status
   */
    remove(name) {
        const deleted = this.registry.delete(name);
        this.versionInfo.delete(name);

        if (deleted) {
            console.log(`Removed ${name} from registry`);
        }

        return deleted;
    }

    /**
   * List all registered data sources
   * @returns {Array} Array of data source names
   */
    list() {
        return Array.from(this.registry.keys());
    }

    /**
   * Validate all registered data sources
   * @returns {Object} Validation results
   */
    validateAll() {
        const results = {};

        this.registry.forEach((entry, name) => {
            if (entry.schema) {
                results[name] = validateProperty(entry.data, entry.schema, name);
            } else {
                results[name] = {
                    isValid: true,
                    errors: [],
                    warnings: ['No schema defined, skipping validation'],
                };
            }
        });

        return results;
    }
}

// ============================================================================
// GLOBAL REGISTRY INSTANCE
// ============================================================================

const globalMockDataRegistry = new MockDataRegistry();

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
    // Version control functions
        getMockDataVersion,
        setMockDataVersion,
        isValidVersion,
        compareVersions,
        getVersionHistory,
        getAllVersions,

        // Schema validation functions
        validateMockData,
        validateProperty,
        validateAllMockData,
        registerSchema,
        getSchema,

        // Registry class
        MockDataRegistry,

        // Global registry instance
        globalMockDataRegistry,

        // Constants
        MOCK_DATA_VERSIONS,
        VERSION_HISTORY,
        MOCK_DATA_SCHEMAS,
    };
}

// Make available globally for browser usage
if (typeof window !== 'undefined') {
    window.MockDataValidator = {
    // Version control functions
        getMockDataVersion,
        setMockDataVersion,
        isValidVersion,
        compareVersions,
        getVersionHistory,
        getAllVersions,

        // Schema validation functions
        validateMockData,
        validateProperty,
        validateAllMockData,
        registerSchema,
        getSchema,

        // Registry class
        MockDataRegistry,

        // Global registry instance
        globalMockDataRegistry,

        // Constants
        MOCK_DATA_VERSIONS,
        VERSION_HISTORY,
        MOCK_DATA_SCHEMAS,
    };
}
