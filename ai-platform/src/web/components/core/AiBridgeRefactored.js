/**
 * AI Bridge Refactored - Orchestrates AI analysis using modular components
 * Coordinates analysis engine, cache manager, and insight generator
 */

import { AiAnalysisEngine } from './analysis/AiAnalysisEngine.js';
import { AiCacheManager } from './analysis/AiCacheManager.js';
import { AiInsightGenerator } from './analysis/AiInsightGenerator.js';

export class AiBridgeRefactored {
    constructor(dataEngine, options = {}) {
        this.dataEngine = dataEngine;
        this.isActive = false;
        
        // Initialize modular components
        this.analysisEngine = new AiAnalysisEngine();
        this.cacheManager = new AiCacheManager(options.cache);
        this.insightGenerator = new AiInsightGenerator();
        
        // Configuration
        this.modelVersion = 'Cascade AI Optimizer v4.0';
        this.defaultTTL = options.defaultTTL || 5 * 60 * 1000; // 5 minutes
        
        // Setup event handlers
        this.setupEventHandlers();
    }

    /**
     * Activate AI analysis system
     */
    async activate() {
        console.log('🤖 Activating AI analysis system...');
        
        try {
            this.isActive = true;
            
            // Subscribe to data events
            this.dataEngine.subscribe('data_loaded', (data) => {
                this.generateAnalysis(data);
            });
            
            // Subscribe to analysis events
            this.dataEngine.subscribe('analysis_requested', (data) => {
                this.generateAnalysis(data);
            });
            
            console.log('✅ AI analysis system activated successfully');
        } catch (error) {
            console.error('❌ Failed to activate AI analysis system:', error);
            throw error;
        }
    }

    /**
     * Generate comprehensive analysis with caching
     * @param {Object} data - Project data to analyze
     * @returns {Object} Analysis results
     */
    async generateAnalysis(data) {
        if (!this.isActive || !data) {
            console.warn('⚠️ AI analysis system not active or no data provided');
            return null;
        }

        console.log('🔍 Generating AI analysis...');
        
        try {
            // Check cache first
            const cacheKey = this.cacheManager.generateKey(data);
            let analysis = this.cacheManager.get(cacheKey);
            
            if (!analysis) {
                // Generate new analysis
                analysis = await this.analysisEngine.generateAnalysis(data);
                
                // Add insights
                analysis.insights = this.insightGenerator.generateInsights(analysis);
                analysis.recommendations = this.insightGenerator.generateRecommendations(analysis.insights);
                analysis.summary = this.insightGenerator.generateSummary(analysis.insights);
                
                // Cache the result
                this.cacheManager.set(cacheKey, analysis, this.defaultTTL);
                
                console.log('✅ New analysis generated and cached');
            } else {
                console.log('✅ Analysis retrieved from cache');
            }
            
            // Notify subscribers
            this.dataEngine.notifySubscribers('ai_analysis_complete', analysis);
            
            return analysis;
            
        } catch (error) {
            console.error('❌ Analysis generation failed:', error);
            
            // Generate fallback analysis
            const fallbackAnalysis = this.generateFallbackAnalysis(data, error);
            this.dataEngine.notifySubscribers('ai_analysis_error', fallbackAnalysis);
            
            return fallbackAnalysis;
        }
    }

    /**
     * Analyze current directory
     * @returns {Object} Analysis results
     */
    async analyzeCurrentDirectory() {
        console.log('🔍 AI Bridge: Analyzing current directory...');
        
        try {
            // Load data from DataEngine
            const data = await this.dataEngine.loadData();
            const analysis = await this.generateAnalysis(data);
            
            if (analysis) {
                this.showSuccess('Current directory analyzed successfully!');
                return analysis;
            } else {
                throw new Error('No analysis generated');
            }
            
        } catch (error) {
            console.error('❌ Directory analysis failed:', error);
            this.showError('Directory analysis failed: ' + error.message);
            throw error;
        }
    }

    /**
     * Generate fallback analysis for error cases
     * @param {Object} data - Project data
     * @param {Error} error - Original error
     * @returns {Object} Fallback analysis
     */
    generateFallbackAnalysis(data, error) {
        console.warn('⚠️ Generating fallback analysis due to error:', error.message);
        
        return {
            model: this.modelVersion,
            timestamp: new Date().toISOString(),
            confidence: 0.3, // Low confidence for fallback
            error: error.message,
            project_analysis: {
                size: {
                    category: 'unknown',
                    file_count: data?.total_files || 0,
                    directory_count: data?.total_directories || 0
                },
                complexity: {
                    score: 50,
                    level: 'medium',
                    factors: ['analysis_error']
                },
                structure: {
                    organization: {
                        has_tests: false,
                        has_docs: false,
                        has_config: false,
                        organization_score: 30
                    },
                    patterns: [],
                    architecture: 'unknown'
                },
                technologies: {
                    primary: ['unknown'],
                    secondary: [],
                    frameworks: [],
                    tools: []
                },
                health: {
                    overall_score: 30,
                    factors: ['analysis_error'],
                    recommendations: [{
                        priority: 'high',
                        action: 'Fix analysis error',
                        description: 'Resolve the underlying analysis error'
                    }]
                }
            },
            quality_assessment: {
                overall_score: 30,
                metrics: {
                    test_coverage: 'missing',
                    documentation: 'incomplete',
                    configuration: 'basic',
                    organization: 30
                },
                issues: [{
                    severity: 'high',
                    type: 'analysis_error',
                    description: error.message
                }]
            },
            recommendations: [{
                priority: 'high',
                category: 'error_handling',
                title: 'Fix Analysis Error',
                description: 'Resolve the underlying analysis error',
                action: 'Check data format and analysis engine configuration',
                impact: 'high'
            }],
            insights: [{
                type: 'error',
                severity: 'high',
                title: 'Analysis Error Detected',
                message: `Analysis failed: ${error.message}`,
                recommendation: 'Investigate data format and system configuration'
            }],
            summary: {
                total: 1,
                by_severity: { high: 1, medium: 0, low: 0 },
                by_category: { error: 1 },
                by_impact: { high: 1, medium: 0, low: 0 },
                top_priorities: [{
                    title: 'Analysis Error Detected',
                    severity: 'high',
                    impact: 'high'
                }]
            },
            fallback: true
        };
    }

    /**
     * Get analysis with cache options
     * @param {Object} data - Project data
     * @param {Object} options - Cache options
     * @returns {Object} Analysis results
     */
    async getAnalysis(data, options = {}) {
        const cacheKey = this.cacheManager.generateKey(data);
        
        return await this.cacheManager.getOrCreate(
            data,
            (data) => this.analysisEngine.generateAnalysis(data),
            options.ttl || this.defaultTTL
        );
    }

    /**
     * Clear analysis cache
     */
    clearCache() {
        this.cacheManager.clear();
        console.log('🗑️ Analysis cache cleared');
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getCacheStats() {
        return this.cacheManager.getStats();
    }

    /**
     * Get performance metrics
     * @returns {Object} Performance metrics
     */
    getPerformanceMetrics() {
        return {
            cache: this.cacheManager.getPerformanceMetrics(),
            analysis: {
                engine_active: this.isActive,
                model_version: this.modelVersion,
                cache_hit_rate: this.cacheManager.calculateHitRate()
            }
        };
    }

    /**
     * Preload cache with common patterns
     * @param {Array} commonData - Common project patterns
     */
    async preloadCache(commonData) {
        await this.cacheManager.preload(commonData);
    }

    /**
     * Export analysis data
     * @returns {Object} Export data
     */
    exportData() {
        return {
            cache: this.cacheManager.export(),
            configuration: {
                model_version: this.modelVersion,
                active: this.isActive,
                default_ttl: this.defaultTTL
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Import analysis data
     * @param {Object} exportData - Export data to import
     */
    importData(exportData) {
        if (exportData.cache) {
            this.cacheManager.import(exportData.cache);
        }
        
        if (exportData.configuration) {
            this.modelVersion = exportData.configuration.model_version || this.modelVersion;
            this.isActive = exportData.configuration.active !== false;
        }
        
        console.log('📥 Analysis data imported successfully');
    }

    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        // Handle cache events
        this.cacheManager.on('cleanup', (removed) => {
            console.log(`🗑️ Cache cleanup: removed ${removed} entries`);
        });
        
        // Handle data engine events
        this.dataEngine.on('error', (error) => {
            console.error('❌ DataEngine error:', error);
        });
    }

    /**
     * Show success message
     * @param {string} message - Success message
     */
    showSuccess(message) {
        console.log(`✅ ${message}`);
        
        // Notify UI if available
        if (window.dashboard && window.dashboard.showNotification) {
            window.dashboard.showNotification(message, 'success');
        }
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        console.error(`❌ ${message}`);
        
        // Notify UI if available
        if (window.dashboard && window.dashboard.showNotification) {
            window.dashboard.showNotification(message, 'error');
        }
    }

    /**
     * Show info message
     * @param {string} message - Info message
     */
    showInfo(message) {
        console.log(`ℹ️ ${message}`);
        
        // Notify UI if available
        if (window.dashboard && window.dashboard.showNotification) {
            window.dashboard.showNotification(message, 'info');
        }
    }

    /**
     * Get system status
     * @returns {Object} System status
     */
    getStatus() {
        return {
            active: this.isActive,
            model: this.modelVersion,
            cache: this.cacheManager.getStats(),
            performance: this.getPerformanceMetrics(),
            components: {
                analysis_engine: 'operational',
                cache_manager: 'operational',
                insight_generator: 'operational'
            }
        };
    }

    /**
     * Health check
     * @returns {Object} Health status
     */
    async healthCheck() {
        const health = {
            status: 'healthy',
            checks: {},
            timestamp: new Date().toISOString()
        };
        
        try {
            // Check analysis engine
            const testData = { total_files: 36734, file_types: { '.js': 15447, '.py': 578, '.html': 2099, '.tsx': 176 } };
            const testAnalysis = await this.analysisEngine.generateAnalysis(testData);
            health.checks.analysis_engine = {
                status: 'healthy',
                response_time: Date.now()
            };
            
            // Check cache manager
            const cacheStats = this.cacheManager.getStats();
            health.checks.cache_manager = {
                status: cacheStats.total < this.cacheManager.maxSize ? 'healthy' : 'warning',
                utilization: cacheStats.utilization
            };
            
            // Check insight generator
            const testInsights = this.insightGenerator.generateInsights(testAnalysis);
            health.checks.insight_generator = {
                status: testInsights.length > 0 ? 'healthy' : 'warning',
                insight_count: testInsights.length
            };
            
            // Overall status
            const issues = Object.values(health.checks).filter(check => check.status !== 'healthy');
            if (issues.length > 0) {
                health.status = 'degraded';
            }
            
        } catch (error) {
            health.status = 'unhealthy';
            health.error = error.message;
        }
        
        return health;
    }

    /**
     * Deactivate AI analysis system
     */
    deactivate() {
        console.log('🤖 Deactivating AI analysis system...');
        
        this.isActive = false;
        this.cacheManager.destroy();
        
        // Unsubscribe from events
        this.dataEngine.unsubscribe('data_loaded');
        this.dataEngine.unsubscribe('analysis_requested');
        
        console.log('✅ AI analysis system deactivated');
    }

    /**
     * Destroy AI Bridge and cleanup resources
     */
    destroy() {
        this.deactivate();
        console.log('🗑️ AI Bridge destroyed');
    }
}

// Export for backward compatibility
export default AiBridgeRefactored;
