/**
 * Technical Debt Data Adapter
 * 
 * Provides standardized data access for Technical Debt features.
 * Integrates with central data processor and directory manager.
 * 
 * @class TechnicalDebtDataAdapter
 * @example
 * const adapter = new TechnicalDebtDataAdapter(centralManager, dataProcessor);
 * const debtData = await adapter.getDebtMetrics();
 */
function __resolveAppLogger() {
    try { return require('../lib/app-logger'); } catch (e) {
        return { error: (...a) => console.error(...a), warn: () => {}, info: () => {}, debug: () => {} };
    }
}
const logger = __resolveAppLogger();

class TechnicalDebtDataAdapter {
    constructor(centralManager, dataProcessor) {
        this.centralManager = centralManager;
        this.dataProcessor = dataProcessor;
        this.featureConfig = centralManager.getFeatureConfig('technicalDebt');
        this.paths = centralManager.getFeaturePaths('technicalDebt');
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
            this.centralManager.subscribe('technicalDebt', this.handleDirectoryChange.bind(this));
            
            // Validate directories
            await this.validateDirectories();
            
            this.initialized = true;
            logger.debug('✅ Technical Debt Data Adapter initialized');
        } catch (error) {
            logger.error('❌ Failed to initialize Technical Debt Data Adapter:', error);
            throw error;
        }
    }

    /**
     * Validate required directories
     */
    async validateDirectories() {
        const validation = await this.centralManager.validateDirectory('technicalDebt');
        if (!validation.valid) {
            logger.warn('⚠️ Technical Debt directory validation failed:', validation.error);
        }
    }

    /**
     * Handle directory changes
     * @param {Object} change - Change information
     */
    handleDirectoryChange(change) {
        logger.debug('🔄 Technical Debt directory changed:', change);
        this.clearCache();
    }

    /**
     * Get debt metrics
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Debt metrics
     */
    async getDebtMetrics(options = {}) {
        try {
            const cacheKey = 'debt-metrics';
            
            if (options.useCache !== false && this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const mockData = this.generateMockDebtMetrics();
            const result = await this.dataProcessor.processData('technicalDebt', 'debt-metrics', mockData, options);
            
            if (result.success) {
                if (options.cache !== false) {
                    this.cache.set(cacheKey, result);
                }
                return result;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            logger.error('❌ Failed to get debt metrics:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Get reduction plans
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Reduction plans
     */
    async getReductionPlans(options = {}) {
        try {
            const cacheKey = 'reduction-plans';
            
            if (options.useCache !== false && this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const mockData = this.generateMockReductionPlans();
            const result = await this.dataProcessor.processData('technicalDebt', 'reduction-plans', mockData, options);
            
            if (result.success) {
                if (options.cache !== false) {
                    this.cache.set(cacheKey, result);
                }
                return result;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            logger.error('❌ Failed to get reduction plans:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Get analytics data
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Analytics data
     */
    async getDebtAnalyticsData(options = {}) {
        try {
            const cacheKey = 'analytics-data';
            
            if (options.useCache !== false && this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const mockData = this.generateMockDebtAnalyticsData();
            const result = await this.dataProcessor.processData('technicalDebt', 'analytics-data', mockData, options);
            
            if (result.success) {
                if (options.cache !== false) {
                    this.cache.set(cacheKey, result);
                }
                return result;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            logger.error('❌ Failed to get debt analytics data:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Get calculations
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Calculations
     */
    async getCalculations(options = {}) {
        try {
            const cacheKey = 'calculations';
            
            if (options.useCache !== false && this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const mockData = this.generateMockCalculations();
            const result = await this.dataProcessor.processData('technicalDebt', 'calculations', mockData, options);
            
            if (result.success) {
                if (options.cache !== false) {
                    this.cache.set(cacheKey, result);
                }
                return result;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            logger.error('❌ Failed to get calculations:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Save debt metrics
     * @param {Object} data - Debt metrics to save
     * @returns {Promise<Object>} Save result
     */
    async saveDebtMetrics(data) {
        try {
            const result = await this.dataProcessor.processData('technicalDebt', 'debt-metrics', data, { 
                action: 'save' 
            });
            
            this.clearCache('debt-metrics');
            
            this.centralManager.notify('technicalDebt', {
                type: 'data-saved',
                dataType: 'debt-metrics',
                timestamp: new Date().toISOString()
            });
            
            return result;
        } catch (error) {
            logger.error('❌ Failed to save debt metrics:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Save reduction plans
     * @param {Object} data - Reduction plans to save
     * @returns {Promise<Object>} Save result
     */
    async saveReductionPlans(data) {
        try {
            const result = await this.dataProcessor.processData('technicalDebt', 'reduction-plans', data, { 
                action: 'save' 
            });
            
            this.clearCache('reduction-plans');
            
            this.centralManager.notify('technicalDebt', {
                type: 'data-saved',
                dataType: 'reduction-plans',
                timestamp: new Date().toISOString()
            });
            
            return result;
        } catch (error) {
            logger.error('❌ Failed to save reduction plans:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Save analytics data
     * @param {Object} data - Analytics data to save
     * @returns {Promise<Object>} Save result
     */
    async saveDebtAnalyticsData(data) {
        try {
            const result = await this.dataProcessor.processData('technicalDebt', 'analytics-data', data, { 
                action: 'save' 
            });
            
            this.clearCache('analytics-data');
            
            this.centralManager.notify('technicalDebt', {
                type: 'data-saved',
                dataType: 'analytics-data',
                timestamp: new Date().toISOString()
            });
            
            return result;
        } catch (error) {
            logger.error('❌ Failed to save debt analytics data:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Save calculations
     * @param {Object} data - Calculations to save
     * @returns {Promise<Object>} Save result
     */
    async saveCalculations(data) {
        try {
            const result = await this.dataProcessor.processData('technicalDebt', 'calculations', data, { 
                action: 'save' 
            });
            
            this.clearCache('calculations');
            
            this.centralManager.notify('technicalDebt', {
                type: 'data-saved',
                dataType: 'calculations',
                timestamp: new Date().toISOString()
            });
            
            return result;
        } catch (error) {
            logger.error('❌ Failed to save calculations:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get all technical debt data
     * @param {Object} options - Query options
     * @returns {Promise<Object>} All technical debt data
     */
    async getAllData(options = {}) {
        try {
            const [debtMetrics, reductionPlans, analyticsData, calculations] = await Promise.all([
                this.getDebtMetrics(options),
                this.getReductionPlans(options),
                this.getDebtAnalyticsData(options),
                this.getCalculations(options)
            ]);

            return {
                success: true,
                data: {
                    debtMetrics: debtMetrics.data,
                    reductionPlans: reductionPlans.data,
                    analyticsData: analyticsData.data,
                    calculations: calculations.data
                },
                metadata: {
                    features: this.featureConfig.features,
                    dataTypes: this.featureConfig.dataTypes,
                    retrievedAt: new Date().toISOString()
                }
            };
        } catch (error) {
            logger.error('❌ Failed to get all technical debt data:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Calculate technical debt score
     * @param {Object} metrics - Debt metrics
     * @returns {Object} Calculated score
     */
    calculateDebtScore(metrics) {
        const score = {
            overall: 0,
            categories: {},
            factors: {},
            recommendations: []
        };

        // Calculate category scores
        if (metrics.categories) {
            for (const [category, data] of Object.entries(metrics.categories)) {
                const categoryScore = this.calculateCategoryScore(data);
                score.categories[category] = categoryScore;
            }
        }

        // Calculate overall score
        const categoryScores = Object.values(score.categories);
        if (categoryScores.length > 0) {
            score.overall = categoryScores.reduce((sum, s) => sum + s.score, 0) / categoryScores.length;
        }

        // Generate recommendations
        score.recommendations = this.generateRecommendations(score);

        return score;
    }

    /**
     * Calculate category score
     * @param {Object} categoryData - Category data
     * @returns {Object} Category score
     */
    calculateCategoryScore(categoryData) {
        const score = {
            score: 0,
            severity: 'low',
            items: categoryData.items || [],
            totalDebt: 0,
            estimatedCost: 0
        };

        if (categoryData.items && Array.isArray(categoryData.items)) {
            score.totalDebt = categoryData.items.reduce((sum, item) => sum + (item.hours || 0), 0);
            score.estimatedCost = categoryData.items.reduce((sum, item) => sum + (item.cost || 0), 0);
            
            // Calculate score based on debt hours
            if (score.totalDebt > 100) {
                score.score = 80 + Math.min(20, (score.totalDebt - 100) / 10);
                score.severity = 'high';
            } else if (score.totalDebt > 50) {
                score.score = 60 + (score.totalDebt - 50) / 2;
                score.severity = 'medium';
            } else {
                score.score = score.totalDebt * 1.2;
                score.severity = 'low';
            }
        }

        return score;
    }

    /**
     * Generate recommendations based on debt score
     * @param {Object} score - Debt score
     * @returns {Array} Recommendations
     */
    generateRecommendations(score) {
        const recommendations = [];

        // High severity recommendations
        const highCategories = Object.entries(score.categories)
            .filter(([, cat]) => cat.severity === 'high')
            .map(([name, cat]) => ({ name, ...cat }));

        if (highCategories.length > 0) {
            recommendations.push({
                priority: 'high',
                action: 'Address high-severity technical debt',
                description: `Focus on ${highCategories.map(c => c.name).join(', ')} categories with ${highCategories.reduce((sum, c) => sum + c.totalDebt, 0)} total hours of debt`,
                estimatedImpact: 'Significant improvement in code quality and maintainability'
            });
        }

        // Medium severity recommendations
        const mediumCategories = Object.entries(score.categories)
            .filter(([, cat]) => cat.severity === 'medium')
            .map(([name, cat]) => ({ name, ...cat }));

        if (mediumCategories.length > 0) {
            recommendations.push({
                priority: 'medium',
                action: 'Plan medium-severity debt reduction',
                description: `Schedule regular refactoring for ${mediumCategories.map(c => c.name).join(', ')} categories`,
                estimatedImpact: 'Gradual improvement in development velocity'
            });
        }

        // General recommendations
        if (score.overall > 70) {
            recommendations.push({
                priority: 'high',
                action: 'Implement comprehensive debt reduction strategy',
                description: 'Current debt levels require immediate attention and systematic reduction',
                estimatedImpact: 'Major improvement in system health and performance'
            });
        }

        return recommendations;
    }

    /**
     * Generate mock debt metrics
     * @returns {Object} Mock debt metrics
     */
    generateMockDebtMetrics() {
        return {
            timestamp: new Date().toISOString(),
            type: 'technical-debt-metrics',
            overall: {
                totalDebtHours: 156,
                debtRatio: 12.3,
                riskScore: 67.8,
                estimatedCost: 23400,
                trend: 'increasing'
            },
            categories: {
                codeComplexity: {
                    name: 'Code Complexity',
                    totalDebt: 67,
                    estimatedCost: 10050,
                    items: [
                        { name: 'Complex Functions', hours: 45, cost: 6750, severity: 'high' },
                        { name: 'Deep Nesting', hours: 22, cost: 3300, severity: 'medium' }
                    ]
                },
                documentation: {
                    name: 'Documentation',
                    totalDebt: 34,
                    estimatedCost: 5100,
                    items: [
                        { name: 'Missing Comments', hours: 28, cost: 4200, severity: 'medium' },
                        { name: 'Outdated Docs', hours: 6, cost: 900, severity: 'low' }
                    ]
                },
                testing: {
                    name: 'Testing',
                    totalDebt: 28,
                    estimatedCost: 4200,
                    items: [
                        { name: 'Missing Tests', hours: 20, cost: 3000, severity: 'high' },
                        { name: 'Test Coverage', hours: 8, cost: 1200, severity: 'medium' }
                    ]
                },
                configuration: {
                    name: 'Configuration',
                    totalDebt: 27,
                    estimatedCost: 4050,
                    items: [
                        { name: 'Config Complexity', hours: 27, cost: 4050, severity: 'medium' }
                    ]
                }
            },
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Generate mock reduction plans
     * @returns {Object} Mock reduction plans
     */
    generateMockReductionPlans() {
        return {
            timestamp: new Date().toISOString(),
            type: 'debt-reduction-plans',
            plans: [
                {
                    id: 'plan_001',
                    name: 'Code Complexity Reduction',
                    priority: 'high',
                    estimatedHours: 45,
                    estimatedCost: 6750,
                    timeline: '6 weeks',
                    status: 'planned',
                    phases: [
                        { name: 'Analysis', duration: '1 week', deliverables: 'Complexity assessment' },
                        { name: 'Refactoring', duration: '4 weeks', deliverables: 'Simplified code structure' },
                        { name: 'Testing', duration: '1 week', deliverables: 'Validation and verification' }
                    ],
                    impact: {
                        codeQuality: 85,
                        maintainability: 90,
                        developmentVelocity: 75
                    }
                },
                {
                    id: 'plan_002',
                    name: 'Documentation Improvement',
                    priority: 'medium',
                    estimatedHours: 34,
                    estimatedCost: 5100,
                    timeline: '4 weeks',
                    status: 'planned',
                    phases: [
                        { name: 'Documentation Audit', duration: '1 week', deliverables: 'Gap analysis' },
                        { name: 'Documentation Creation', duration: '2 weeks', deliverables: 'Complete documentation' },
                        { name: 'Review Process', duration: '1 week', deliverables: 'Quality assurance' }
                    ],
                    impact: {
                        knowledgeTransfer: 90,
                        onboarding: 85,
                        maintenance: 80
                    }
                },
                {
                    id: 'plan_003',
                    name: 'Test Coverage Enhancement',
                    priority: 'high',
                    estimatedHours: 28,
                    estimatedCost: 4200,
                    timeline: '3 weeks',
                    status: 'planned',
                    phases: [
                        { name: 'Test Analysis', duration: '1 week', deliverables: 'Coverage assessment' },
                        { name: 'Test Development', duration: '2 weeks', deliverables: 'Comprehensive test suite' },
                        { name: 'Integration', duration: '0 weeks', deliverables: 'CI/CD integration' }
                    ],
                    impact: {
                        reliability: 95,
                        confidence: 90,
                        maintenance: 85
                    }
                }
            ],
            summary: {
                totalPlans: 3,
                totalHours: 107,
                totalCost: 16050,
                averageTimeline: '4.3 weeks',
                highPriorityPlans: 2,
                mediumPriorityPlans: 1
            },
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Generate mock debt analytics data
     * @returns {Object} Mock analytics data
     */
    generateMockDebtAnalyticsData() {
        return {
            timestamp: new Date().toISOString(),
            type: 'debt-analytics',
            trends: {
                debtGrowth: [
                    { month: 'Jan', debtHours: 120, cost: 18000 },
                    { month: 'Feb', debtHours: 135, cost: 20250 },
                    { month: 'Mar', debtHours: 142, cost: 21300 },
                    { month: 'Apr', debtHours: 148, cost: 22200 },
                    { month: 'May', debtHours: 156, cost: 23400 }
                ],
                reductionProgress: [
                    { month: 'Jan', reducedHours: 5, cost: 750 },
                    { month: 'Feb', reducedHours: 8, cost: 1200 },
                    { month: 'Mar', reducedHours: 12, cost: 1800 },
                    { month: 'Apr', reducedHours: 15, cost: 2250 },
                    { month: 'May', reducedHours: 18, cost: 2700 }
                ]
            },
            predictions: {
                nextQuarter: {
                    projectedDebt: 178,
                    projectedCost: 26700,
                    confidence: 0.85
                },
                nextYear: {
                    projectedDebt: 234,
                    projectedCost: 35100,
                    confidence: 0.72
                }
            },
            benchmarks: {
                industryAverage: {
                    debtRatio: 15.2,
                    costPerHour: 150
                },
                teamPerformance: {
                    debtRatio: 12.3,
                    costPerHour: 150,
                    reductionRate: 0.12
                }
            },
            insights: [
                {
                    type: 'warning',
                    message: 'Debt is growing faster than reduction efforts',
                    impact: 'high',
                    recommendation: 'Increase reduction investment by 25%'
                },
                {
                    type: 'opportunity',
                    message: 'Code complexity category shows highest ROI for reduction',
                    impact: 'medium',
                    recommendation: 'Prioritize complexity reduction initiatives'
                }
            ],
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Generate mock calculations
     * @returns {Object} Mock calculations
     */
    generateMockCalculations() {
        return {
            timestamp: new Date().toISOString(),
            type: 'debt-calculations',
            calculations: {
                roi: {
                    reductionInvestment: 16050,
                    expectedSavings: 45000,
                    roi: 180.4,
                    paybackPeriod: '4.3 months'
                },
                impact: {
                    developmentVelocity: {
                        current: 85,
                        projected: 92,
                        improvement: 8.2
                    },
                    defectRate: {
                        current: 2.3,
                        projected: 1.1,
                        improvement: 52.2
                    },
                    maintenanceTime: {
                        current: 25,
                        projected: 15,
                        improvement: 40.0
                    }
                },
                scenarios: {
                    bestCase: {
                        debtReduction: 0.75,
                        costSavings: 60000,
                        timeline: '6 months'
                    },
                    realistic: {
                        debtReduction: 0.50,
                        costSavings: 45000,
                        timeline: '9 months'
                    },
                    worstCase: {
                        debtReduction: 0.25,
                        costSavings: 22500,
                        timeline: '12 months'
                    }
                }
            },
            assumptions: [
                'Development team velocity remains constant',
                'No major architectural changes during reduction period',
                'Market rate for development work stays stable'
            ],
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
    module.exports = TechnicalDebtDataAdapter;
}

// Auto-initialize if in browser environment
if (typeof window !== 'undefined') {
    window.TechnicalDebtDataAdapter = TechnicalDebtDataAdapter;
}
