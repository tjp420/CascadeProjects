/**
 * Analytics Data Adapter
 * 
 * Provides standardized data access for Analytics features.
 * Integrates with central data processor and directory manager.
 * 
 * @class AnalyticsDataAdapter
 * @example
 * const adapter = new AnalyticsDataAdapter(centralManager, dataProcessor);
 * const reports = await adapter.getReports();
 */
function __resolveAppLogger() {
    try { return require('../lib/app-logger'); } catch (e) {
        return { error: (...a) => console.error(...a), warn: () => {}, info: () => {}, debug: () => {} };
    }
}
const logger = __resolveAppLogger();

class AnalyticsDataAdapter {
    constructor(centralManager, dataProcessor) {
        this.centralManager = centralManager;
        this.dataProcessor = dataProcessor;
        this.featureConfig = centralManager.getFeatureConfig('analytics');
        this.paths = centralManager.getFeaturePaths('analytics');
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
            this.centralManager.subscribe('analytics', this.handleDirectoryChange.bind(this));
            
            // Validate directories
            await this.validateDirectories();
            
            this.initialized = true;
            logger.debug('✅ Analytics Data Adapter initialized');
        } catch (error) {
            logger.error('❌ Failed to initialize Analytics Data Adapter:', error);
            throw error;
        }
    }

    /**
     * Validate required directories
     */
    async validateDirectories() {
        const validation = await this.centralManager.validateDirectory('analytics');
        if (!validation.valid) {
            logger.warn('⚠️ Analytics directory validation failed:', validation.error);
        }
    }

    /**
     * Handle directory changes
     * @param {Object} change - Change information
     */
    handleDirectoryChange(change) {
        logger.debug('🔄 Analytics directory changed:', change);
        this.clearCache();
    }

    /**
     * Get reports
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Reports data
     */
    async getReports(options = {}) {
        try {
            const cacheKey = 'reports';
            
            if (options.useCache !== false && this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const mockData = this.generateMockReports();
            const result = await this.dataProcessor.processData('analytics', 'reports', mockData, options);
            
            if (result.success) {
                if (options.cache !== false) {
                    this.cache.set(cacheKey, result);
                }
                return result;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            logger.error('❌ Failed to get reports:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Get metrics
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Metrics data
     */
    async getMetrics(options = {}) {
        try {
            const cacheKey = 'metrics';
            
            if (options.useCache !== false && this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const mockData = this.generateMockMetrics();
            const result = await this.dataProcessor.processData('analytics', 'metrics', mockData, options);
            
            if (result.success) {
                if (options.cache !== false) {
                    this.cache.set(cacheKey, result);
                }
                return result;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            logger.error('❌ Failed to get metrics:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Get performance data
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Performance data
     */
    async getPerformanceData(options = {}) {
        try {
            const cacheKey = 'performance-data';
            
            if (options.useCache !== false && this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const mockData = this.generateMockPerformanceData();
            const result = await this.dataProcessor.processData('analytics', 'performance-data', mockData, options);
            
            if (result.success) {
                if (options.cache !== false) {
                    this.cache.set(cacheKey, result);
                }
                return result;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            logger.error('❌ Failed to get performance data:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Save reports
     * @param {Object} data - Reports to save
     * @returns {Promise<Object>} Save result
     */
    async saveReports(data) {
        try {
            const result = await this.dataProcessor.processData('analytics', 'reports', data, { 
                action: 'save' 
            });
            
            this.clearCache('reports');
            
            this.centralManager.notify('analytics', {
                type: 'data-saved',
                dataType: 'reports',
                timestamp: new Date().toISOString()
            });
            
            return result;
        } catch (error) {
            logger.error('❌ Failed to save reports:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Save metrics
     * @param {Object} data - Metrics to save
     * @returns {Promise<Object>} Save result
     */
    async saveMetrics(data) {
        try {
            const result = await this.dataProcessor.processData('analytics', 'metrics', data, { 
                action: 'save' 
            });
            
            this.clearCache('metrics');
            
            this.centralManager.notify('analytics', {
                type: 'data-saved',
                dataType: 'metrics',
                timestamp: new Date().toISOString()
            });
            
            return result;
        } catch (error) {
            logger.error('❌ Failed to save metrics:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Save performance data
     * @param {Object} data - Performance data to save
     * @returns {Promise<Object>} Save result
     */
    async savePerformanceData(data) {
        try {
            const result = await this.dataProcessor.processData('analytics', 'performance-data', data, { 
                action: 'save' 
            });
            
            this.clearCache('performance-data');
            
            this.centralManager.notify('analytics', {
                type: 'data-saved',
                dataType: 'performance-data',
                timestamp: new Date().toISOString()
            });
            
            return result;
        } catch (error) {
            logger.error('❌ Failed to save performance data:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get all analytics data
     * @param {Object} options - Query options
     * @returns {Promise<Object>} All analytics data
     */
    async getAllData(options = {}) {
        try {
            const [reports, metrics, performanceData] = await Promise.all([
                this.getReports(options),
                this.getMetrics(options),
                this.getPerformanceData(options)
            ]);

            return {
                success: true,
                data: {
                    reports: reports.data,
                    metrics: metrics.data,
                    performanceData: performanceData.data
                },
                metadata: {
                    features: this.featureConfig.features,
                    dataTypes: this.featureConfig.dataTypes,
                    retrievedAt: new Date().toISOString()
                }
            };
        } catch (error) {
            logger.error('❌ Failed to get all analytics data:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Generate mock reports
     * @returns {Object} Mock reports
     */
    generateMockReports() {
        return {
            reports: [
                {
                    id: 'report_001',
                    name: 'Project Performance Report',
                    type: 'performance',
                    status: 'completed',
                    generatedAt: new Date().toISOString(),
                    size: '2.3MB',
                    format: 'pdf'
                },
                {
                    id: 'report_002',
                    name: 'Code Quality Analysis',
                    type: 'quality',
                    status: 'in-progress',
                    generatedAt: new Date().toISOString(),
                    size: '1.8MB',
                    format: 'xlsx'
                },
                {
                    id: 'report_003',
                    name: 'Security Assessment',
                    type: 'security',
                    status: 'completed',
                    generatedAt: new Date().toISOString(),
                    size: '3.1MB',
                    format: 'pdf'
                }
            ],
            summary: {
                totalReports: 3,
                completed: 2,
                inProgress: 1,
                totalSize: '7.2MB',
                lastUpdated: new Date().toISOString()
            }
        };
    }

    /**
     * Generate mock metrics
     * @returns {Object} Mock metrics
     */
    generateMockMetrics() {
        return {
            metrics: {
                codeQuality: {
                    score: 85.3,
                    trend: 'up',
                    issues: 12,
                    tests: 892
                },
                performance: {
                    responseTime: 245,
                    throughput: 1250,
                    errorRate: 0.02,
                    uptime: 99.9
                },
                security: {
                    vulnerabilities: 3,
                    riskScore: 15.2,
                    complianceScore: 92.1
                },
                productivity: {
                    commits: 47,
                    pullRequests: 12,
                    issuesResolved: 8,
                    codeChurn: 2.3
                }
            },
            calculatedAt: new Date().toISOString()
        };
    }

    /**
     * Generate mock performance data
     * @returns {Object} Mock performance data
     */
    generateMockPerformanceData() {
        return {
            performance: {
                system: {
                    cpuUsage: 45.2,
                    memoryUsage: 67.8,
                    diskUsage: 23.1,
                    networkLatency: 12
                },
                application: {
                    responseTime: {
                        p50: 180,
                        p95: 450,
                        p99: 890
                    },
                    throughput: {
                        requests: 1250,
                        errors: 25
                    },
                    cache: {
                        hitRate: 85.3,
                        missRate: 14.7
                    }
                },
                database: {
                    queryTime: 45,
                    connections: 12,
                    indexUsage: 92.1
                }
            },
            measuredAt: new Date().toISOString()
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
    module.exports = AnalyticsDataAdapter;
}

// Auto-initialize if in browser environment
if (typeof window !== 'undefined') {
    window.AnalyticsDataAdapter = AnalyticsDataAdapter;
}
