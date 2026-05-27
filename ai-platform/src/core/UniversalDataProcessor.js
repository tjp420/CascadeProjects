/**
 * Universal Data Processor
 * 
 * Provides unified data processing pipeline for all AI platform features.
 * Handles data transformation, validation, and processing with standardized interfaces.
 * 
 * @class UniversalDataProcessor
 * @example
 * const processor = new UniversalDataProcessor(centralManager);
 * const result = await processor.processData('aiTools', 'analysis-results', rawData);
 */
class UniversalDataProcessor {
    constructor(centralManager) {
        this.centralManager = centralManager;
        this.processors = new Map();
        this.transformers = new Map();
        this.validators = new Map();
        this.cache = new Map();
        this.processingQueue = [];
        this.isProcessing = false;
        
        this.initializeDefaultProcessors();
    }

    /**
     * Initialize default data processors
     */
    initializeDefaultProcessors() {
        // AI Tools processors
        this.registerProcessor('aiTools', 'analysis-results', this.processAIAnalysisResults.bind(this));
        this.registerProcessor('aiTools', 'generated-code', this.processGeneratedCode.bind(this));
        this.registerProcessor('aiTools', 'mock-data', this.processMockData.bind(this));
        
        // Analytics processors
        this.registerProcessor('analytics', 'reports', this.processReports.bind(this));
        this.registerProcessor('analytics', 'metrics', this.processMetrics.bind(this));
        this.registerProcessor('analytics', 'performance-data', this.processPerformanceData.bind(this));
        
        // Development processors
        this.registerProcessor('development', 'dev-configs', this.processDevConfigs.bind(this));
        this.registerProcessor('development', 'database-schemas', this.processDatabaseSchemas.bind(this));
        this.registerProcessor('development', 'api-docs', this.processAPIDocs.bind(this));
        
        // Roadmap processors
        this.registerProcessor('roadmap', 'roadmap-data', this.processRoadmapData.bind(this));
        this.registerProcessor('roadmap', 'release-timeline', this.processReleaseTimeline.bind(this));
        this.registerProcessor('roadmap', 'feature-backlog', this.processFeatureBacklog.bind(this));
        
        // Technical Debt processors
        this.registerProcessor('technicalDebt', 'debt-metrics', this.processDebtMetrics.bind(this));
        this.registerProcessor('technicalDebt', 'reduction-plans', this.processReductionPlans.bind(this));
        this.registerProcessor('technicalDebt', 'analytics-data', this.processDebtAnalyticsData.bind(this));
        
        // Project Resources processors
        this.registerProcessor('projectResources', 'billing-data', this.processBillingData.bind(this));
        this.registerProcessor('projectResources', 'report-templates', this.processReportTemplates.bind(this));
        this.registerProcessor('projectResources', 'assets', this.processAssets.bind(this));
        this.registerProcessor('projectResources', 'code-templates', this.processCodeTemplates.bind(this));
        this.registerProcessor('projectResources', 'coverage-data', this.processCoverageData.bind(this));
        
        console.log('🔧 Default data processors initialized');
    }

    /**
     * Register a data processor
     * @param {string} feature - Feature category
     * @param {string} dataType - Data type
     * @param {Function} processor - Processing function
     */
    registerProcessor(feature, dataType, processor) {
        const key = `${feature}.${dataType}`;
        this.processors.set(key, processor);
        console.log(`📝 Registered processor: ${key}`);
    }

    /**
     * Register a data transformer
     * @param {string} feature - Feature category
     * @param {string} dataType - Data type
     * @param {Function} transformer - Transform function
     */
    registerTransformer(feature, dataType, transformer) {
        const key = `${feature}.${dataType}`;
        this.transformers.set(key, transformer);
        console.log(`🔄 Registered transformer: ${key}`);
    }

    /**
     * Register a data validator
     * @param {string} feature - Feature category
     * @param {string} dataType - Data type
     * @param {Function} validator - Validation function
     */
    registerValidator(feature, dataType, validator) {
        const key = `${feature}.${dataType}`;
        this.validators.set(key, validator);
        console.log(`✅ Registered validator: ${key}`);
    }

    /**
     * Process data with universal pipeline
     * @param {string} feature - Feature category
     * @param {string} dataType - Data type
     * @param {*} data - Raw data to process
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Processed data result
     */
    async processData(feature, dataType, data, options = {}) {
        const startTime = Date.now();
        const key = `${feature}.${dataType}`;
        
        try {
            console.log(`🔄 Processing data: ${key}`);
            
            // Check cache first
            if (options.useCache !== false) {
                const cached = this.getCachedResult(key, data);
                if (cached) {
                    console.log(`⚡ Cache hit for: ${key}`);
                    return cached;
                }
            }

            // Validate data
            const validationResult = await this.validateData(feature, dataType, data);
            if (!validationResult.valid) {
                throw new Error(`Validation failed for ${key}: ${validationResult.errors.join(', ')}`);
            }

            // Transform data
            const transformedData = await this.transformData(feature, dataType, data);

            // Process data
            const processor = this.processors.get(key);
            if (!processor) {
                throw new Error(`No processor found for: ${key}`);
            }

            const processedData = await processor(transformedData, options);

            // Create result
            const result = {
                success: true,
                data: processedData,
                metadata: {
                    feature,
                    dataType,
                    processedAt: new Date().toISOString(),
                    processingTime: Date.now() - startTime,
                    originalSize: this.calculateSize(data),
                    processedSize: this.calculateSize(processedData),
                    validation: validationResult
                }
            };

            // Cache result
            if (options.cache !== false) {
                this.cacheResult(key, data, result);
            }

            console.log(`✅ Processing completed: ${key} (${Date.now() - startTime}ms)`);
            return result;

        } catch (error) {
            console.error(`❌ Processing failed for ${key}:`, error);
            
            return {
                success: false,
                error: error.message,
                metadata: {
                    feature,
                    dataType,
                    processedAt: new Date().toISOString(),
                    processingTime: Date.now() - startTime,
                    failed: true
                }
            };
        }
    }

    /**
     * Validate data using registered validators
     * @param {string} feature - Feature category
     * @param {string} dataType - Data type
     * @param {*} data - Data to validate
     * @returns {Promise<Object>} Validation result
     */
    async validateData(feature, dataType, data) {
        const key = `${feature}.${dataType}`;
        const validator = this.validators.get(key);
        
        if (!validator) {
            // Default validation
            return this.defaultValidation(data);
        }

        try {
            return await validator(data);
        } catch (error) {
            return {
                valid: false,
                errors: [error.message]
            };
        }
    }

    /**
     * Transform data using registered transformers
     * @param {string} feature - Feature category
     * @param {string} dataType - Data type
     * @param {*} data - Data to transform
     * @returns {Promise<*>} Transformed data
     */
    async transformData(feature, dataType, data) {
        const key = `${feature}.${dataType}`;
        const transformer = this.transformers.get(key);
        
        if (!transformer) {
            return data; // No transformation needed
        }

        try {
            return await transformer(data);
        } catch (error) {
            console.error(`❌ Transformation failed for ${key}:`, error);
            throw error;
        }
    }

    /**
     * Default validation logic
     * @param {*} data - Data to validate
     * @returns {Object} Validation result
     */
    defaultValidation(data) {
        const errors = [];
        
        if (data === null || data === undefined) {
            errors.push('Data cannot be null or undefined');
        }
        
        if (typeof data === 'object' && Object.keys(data).length === 0) {
            errors.push('Data object cannot be empty');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Cache processing result
     * @param {string} key - Cache key
     * @param {*} inputData - Input data for cache key
     * @param {Object} result - Processing result
     */
    cacheResult(key, inputData, result) {
        const cacheKey = this.generateCacheKey(key, inputData);
        this.cache.set(cacheKey, {
            result,
            timestamp: Date.now(),
            ttl: 30 * 60 * 1000 // 30 minutes
        });
    }

    /**
     * Get cached result
     * @param {string} key - Cache key
     * @param {*} inputData - Input data for cache key
     * @returns {Object|null} Cached result or null
     */
    getCachedResult(key, inputData) {
        const cacheKey = this.generateCacheKey(key, inputData);
        const cached = this.cache.get(cacheKey);
        
        if (!cached) {
            return null;
        }

        // Check TTL
        if (Date.now() - cached.timestamp > cached.ttl) {
            this.cache.delete(cacheKey);
            return null;
        }

        return cached.result;
    }

    /**
     * Generate cache key
     * @param {string} key - Base key
     * @param {*} inputData - Input data
     * @returns {string} Cache key
     */
    generateCacheKey(key, inputData) {
        const dataHash = this.hashData(inputData);
        return `${key}_${dataHash}`;
    }

    /**
     * Simple data hashing for cache keys
     * @param {*} data - Data to hash
     * @returns {string} Hash
     */
    hashData(data) {
        const str = typeof data === 'string' ? data : JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Calculate data size
     * @param {*} data - Data to measure
     * @returns {number} Size in bytes
     */
    calculateSize(data) {
        return JSON.stringify(data).length;
    }

    // Default processor implementations
    async processAIAnalysisResults(data, options) {
        return {
            type: 'ai-analysis',
            results: Array.isArray(data) ? data : [data],
            summary: {
                total: Array.isArray(data) ? data.length : 1,
                processedAt: new Date().toISOString()
            }
        };
    }

    async processGeneratedCode(data, options) {
        return {
            type: 'generated-code',
            code: data,
            metadata: {
                language: options.language || 'javascript',
                generatedAt: new Date().toISOString()
            }
        };
    }

    async processMockData(data, options) {
        return {
            type: 'mock-data',
            data: data,
            metadata: {
                recordCount: Array.isArray(data) ? data.length : 1,
                generatedAt: new Date().toISOString()
            }
        };
    }

    async processReports(data, options) {
        return {
            type: 'reports',
            reports: Array.isArray(data) ? data : [data],
            summary: {
                total: Array.isArray(data) ? data.length : 1,
                generatedAt: new Date().toISOString()
            }
        };
    }

    async processMetrics(data, options) {
        return {
            type: 'metrics',
            metrics: data,
            calculatedAt: new Date().toISOString()
        };
    }

    async processPerformanceData(data, options) {
        return {
            type: 'performance',
            data: data,
            measuredAt: new Date().toISOString()
        };
    }

    async processDevConfigs(data, options) {
        return {
            type: 'dev-configs',
            configs: data,
            version: options.version || '1.0.0'
        };
    }

    async processDatabaseSchemas(data, options) {
        return {
            type: 'database-schemas',
            schemas: data,
            version: options.version || '1.0.0'
        };
    }

    async processAPIDocs(data, options) {
        return {
            type: 'api-docs',
            documentation: data,
            version: options.version || '1.0.0'
        };
    }

    async processRoadmapData(data, options) {
        return {
            type: 'roadmap',
            data: data,
            lastUpdated: new Date().toISOString()
        };
    }

    async processReleaseTimeline(data, options) {
        return {
            type: 'release-timeline',
            timeline: data,
            lastUpdated: new Date().toISOString()
        };
    }

    async processFeatureBacklog(data, options) {
        return {
            type: 'feature-backlog',
            backlog: data,
            lastUpdated: new Date().toISOString()
        };
    }

    async processDebtMetrics(data, options) {
        return {
            type: 'debt-metrics',
            metrics: data,
            calculatedAt: new Date().toISOString()
        };
    }

    async processReductionPlans(data, options) {
        return {
            type: 'reduction-plans',
            plans: data,
            createdAt: new Date().toISOString()
        };
    }

    async processDebtAnalyticsData(data, options) {
        return {
            type: 'debt-analytics',
            analytics: data,
            generatedAt: new Date().toISOString()
        };
    }

    async processBillingData(data, options) {
        return {
            type: 'billing-data',
            billing: data,
            period: options.period || 'current'
        };
    }

    async processReportTemplates(data, options) {
        return {
            type: 'report-templates',
            templates: data,
            version: options.version || '1.0.0'
        };
    }

    async processAssets(data, options) {
        return {
            type: 'assets',
            assets: data,
            categorized: options.categorize || false
        };
    }

    async processCodeTemplates(data, options) {
        return {
            type: 'code-templates',
            templates: data,
            language: options.language || 'javascript'
        };
    }

    async processCoverageData(data, options) {
        return {
            type: 'coverage-data',
            coverage: data,
            measuredAt: new Date().toISOString()
        };
    }

    /**
     * Get processing statistics
     * @returns {Object} Processing statistics
     */
    getStats() {
        return {
            processorsCount: this.processors.size,
            transformersCount: this.transformers.size,
            validatorsCount: this.validators.size,
            cacheSize: this.cache.size,
            queueLength: this.processingQueue.length,
            isProcessing: this.isProcessing
        };
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️ Cache cleared');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UniversalDataProcessor;
}

// Auto-initialize if in browser environment
if (typeof window !== 'undefined') {
    window.UniversalDataProcessor = UniversalDataProcessor;
}
