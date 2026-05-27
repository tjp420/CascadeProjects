/**
 * Central Data Integration System
 * 
 * Main integration point that combines all central data components.
 * Provides unified interface for all features to access central data system.
 * 
 * @class CentralDataIntegration
 * @example
 * const integration = new CentralDataIntegration();
 * await integration.initialize();
 * const data = await integration.getData('aiTools', 'analysis-results');
 */
class CentralDataIntegration {
    constructor() {
        this.directoryManager = null;
        this.dataProcessor = null;
        this.dataBus = null;
        this.cacheManager = null;
        this.adapters = new Map();
        this.initialized = false;
        this.config = null;
        
        this.initializeComponents();
    }

    /**
     * Initialize all components
     */
    initializeComponents() {
        try {
            // Initialize core components
            this.directoryManager = new CentralDirectoryManager();
            this.dataProcessor = new UniversalDataProcessor(this.directoryManager);
            this.dataBus = new DataBus();
            this.cacheManager = new CentralCacheManager();
            
            console.log('🔧 Central data components initialized');
        } catch (error) {
            console.error('❌ Failed to initialize components:', error);
            throw error;
        }
    }

    /**
     * Initialize the entire system
     */
    async initialize() {
        try {
            console.log('🚀 Initializing Central Data Integration System...');
            
            // Initialize directory manager
            await this.directoryManager.initialize();
            
            // Initialize adapters
            await this.initializeAdapters();
            
            // Setup cross-feature syncs
            this.setupCrossFeatureSyncs();
            
            // Setup event handlers
            this.setupEventHandlers();
            
            this.initialized = true;
            console.log('✅ Central Data Integration System initialized successfully');
            
            // Publish system ready event
            await this.dataBus.publish('system.initialized', {
                timestamp: new Date().toISOString(),
                components: ['directoryManager', 'dataProcessor', 'dataBus', 'cacheManager', 'adapters']
            });
            
        } catch (error) {
            console.error('❌ Failed to initialize Central Data Integration System:', error);
            throw error;
        }
    }

    /**
     * Initialize feature adapters
     */
    async initializeAdapters() {
        try {
            // Import and initialize adapters
            const adapterClasses = {
                'aiTools': window.AIToolsDataAdapter,
                'analytics': window.AnalyticsDataAdapter,
                'roadmap': window.RoadmapDataAdapter,
                'technicalDebt': window.TechnicalDebtDataAdapter,
                'development': window.DevelopmentDataAdapter,
                'projectResources': window.ProjectResourcesDataAdapter
                // Add other adapters as they're created
            };

            for (const [feature, AdapterClass] of Object.entries(adapterClasses)) {
                if (AdapterClass) {
                    const adapter = new AdapterClass(this.directoryManager, this.dataProcessor);
                    await adapter.initialize();
                    this.adapters.set(feature, adapter);
                    console.log(`🔌 Initialized adapter: ${feature}`);
                }
            }
            
            console.log(`🔌 Initialized ${this.adapters.size} feature adapters`);
        } catch (error) {
            console.error('❌ Failed to initialize adapters:', error);
            throw error;
        }
    }

    /**
     * Setup cross-feature data synchronization
     */
    setupCrossFeatureSyncs() {
        try {
            // AI Tools -> Analytics sync
            this.dataBus.createSync(
                'ai-tools',
                'analytics',
                'ai-tools.analysis-complete',
                (data) => ({
                    type: 'analysis-metrics',
                    source: 'ai-tools',
                    metrics: data.results,
                    timestamp: new Date().toISOString()
                })
            );

            // Analytics -> Reports sync
            this.dataBus.createSync(
                'analytics',
                'project-resources',
                'analytics.report-generated',
                (data) => ({
                    type: 'report-data',
                    source: 'analytics',
                    report: data.reports,
                    timestamp: new Date().toISOString()
                })
            );

            // Development -> Technical Debt sync
            this.dataBus.createSync(
                'development',
                'technical-debt',
                'development.config-changed',
                (data) => ({
                    type: 'config-impact',
                    source: 'development',
                    impact: data.configs,
                    timestamp: new Date().toISOString()
                })
            );

            console.log('🔗 Cross-feature syncs established');
        } catch (error) {
            console.error('❌ Failed to setup cross-feature syncs:', error);
        }
    }

    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        try {
            // Handle data save events
            this.dataBus.subscribe('system.data-saved', async (event) => {
                console.log('💾 Data saved event:', event);
                
                // Clear relevant cache entries
                const feature = this.extractFeatureFromEvent(event);
                if (feature) {
                    this.cacheManager.clear(feature);
                }
            });

            // Handle cache clear events
            this.dataBus.subscribe('system.cache-cleared', async (event) => {
                console.log('🗑️ Cache cleared event:', event);
                
                // Notify adapters of cache clear
                for (const [feature, adapter] of this.adapters.entries()) {
                    if (adapter.clearCache) {
                        adapter.clearCache();
                    }
                }
            });

            // Handle config update events
            this.dataBus.subscribe('system.config-updated', async (event) => {
                console.log('⚙️ Config updated event:', event);
                
                // Reload configuration
                await this.directoryManager.updateConfig(event.data.config);
            });

            console.log('👂 Event handlers established');
        } catch (error) {
            console.error('❌ Failed to setup event handlers:', error);
        }
    }

    /**
     * Get data from central system
     * @param {string} feature - Feature category
     * @param {string} dataType - Data type
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Data result
     */
    async getData(feature, dataType, options = {}) {
        this.ensureInitialized();
        
        try {
            const adapter = this.adapters.get(feature);
            if (!adapter) {
                throw new Error(`No adapter found for feature: ${feature}`);
            }

            // Check cache first
            const cacheKey = `${feature}.${dataType}`;
            if (options.useCache !== false) {
                const cached = await this.cacheManager.get(cacheKey);
                if (cached) {
                    console.log(`⚡ Cache hit for ${cacheKey}`);
                    return cached;
                }
            }

            // Get data from adapter
            const result = await adapter.getData(dataType, options);
            
            // Cache result
            if (result.success && options.cache !== false) {
                await this.cacheManager.set(cacheKey, result);
            }

            // Publish data access event
            await this.dataBus.publish('system.data-accessed', {
                feature,
                dataType,
                success: result.success,
                timestamp: new Date().toISOString()
            });

            return result;

        } catch (error) {
            console.error(`❌ Failed to get data for ${feature}.${dataType}:`, error);
            
            // Publish error event
            await this.dataBus.publish('system.error-occurred', {
                feature,
                dataType,
                error: error.message,
                timestamp: new Date().toISOString()
            });

            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Save data to central system
     * @param {string} feature - Feature category
     * @param {string} dataType - Data type
     * @param {*} data - Data to save
     * @param {Object} options - Save options
     * @returns {Promise<Object>} Save result
     */
    async saveData(feature, dataType, data, options = {}) {
        this.ensureInitialized();
        
        try {
            const adapter = this.adapters.get(feature);
            if (!adapter) {
                throw new Error(`No adapter found for feature: ${feature}`);
            }

            // Save data through adapter
            const result = await adapter.saveData(dataType, data, options);
            
            if (result.success) {
                // Clear cache
                const cacheKey = `${feature}.${dataType}`;
                this.cacheManager.delete(cacheKey);
                
                // Publish save event
                await this.dataBus.publish('system.data-saved', {
                    feature,
                    dataType,
                    success: true,
                    timestamp: new Date().toISOString()
                });
            }

            return result;

        } catch (error) {
            console.error(`❌ Failed to save data for ${feature}.${dataType}:`, error);
            
            // Publish error event
            await this.dataBus.publish('system.error-occurred', {
                feature,
                dataType,
                action: 'save',
                error: error.message,
                timestamp: new Date().toISOString()
            });

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get all data for a feature
     * @param {string} feature - Feature category
     * @param {Object} options - Query options
     * @returns {Promise<Object>} All feature data
     */
    async getAllFeatureData(feature, options = {}) {
        this.ensureInitialized();
        
        try {
            const adapter = this.adapters.get(feature);
            if (!adapter) {
                throw new Error(`No adapter found for feature: ${feature}`);
            }

            return await adapter.getAllData(options);

        } catch (error) {
            console.error(`❌ Failed to get all data for ${feature}:`, error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Process data through universal processor
     * @param {string} feature - Feature category
     * @param {string} dataType - Data type
     * @param {*} data - Data to process
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Processing result
     */
    async processData(feature, dataType, data, options = {}) {
        this.ensureInitialized();
        
        try {
            const result = await this.dataProcessor.processData(feature, dataType, data, options);
            
            // Publish processing event
            await this.dataBus.publish('system.data-processed', {
                feature,
                dataType,
                success: result.success,
                timestamp: new Date().toISOString()
            });

            return result;

        } catch (error) {
            console.error(`❌ Failed to process data for ${feature}.${dataType}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get central directory path
     * @param {string} feature - Feature category
     * @param {string} dataType - Data type (optional)
     * @returns {string} Directory path
     */
    getPath(feature, dataType = null) {
        this.ensureInitialized();
        return this.directoryManager.getPath(feature, dataType);
    }

    /**
     * Subscribe to data events
     * @param {string} eventType - Event type
     * @param {Function} callback - Callback function
     * @returns {string} Subscription ID
     */
    subscribe(eventType, callback) {
        this.ensureInitialized();
        return this.dataBus.subscribe(eventType, callback);
    }

    /**
     * Unsubscribe from data events
     * @param {string} subscriptionId - Subscription ID
     */
    unsubscribe(subscriptionId) {
        this.ensureInitialized();
        this.dataBus.unsubscribe(subscriptionId);
    }

    /**
     * Publish data event
     * @param {string} eventType - Event type
     * @param {*} data - Event data
     * @returns {Promise<Object>} Publish result
     */
    async publish(eventType, data) {
        this.ensureInitialized();
        return await this.dataBus.publish(eventType, data);
    }

    /**
     * Extract feature from event
     * @param {Object} event - Event object
     * @returns {string|null} Feature name
     */
    extractFeatureFromEvent(event) {
        if (event.type && event.type.includes('.')) {
            return event.type.split('.')[0];
        }
        return null;
    }

    /**
     * Ensure system is initialized
     */
    ensureInitialized() {
        if (!this.initialized) {
            throw new Error('Central Data Integration System not initialized. Call initialize() first.');
        }
    }

    /**
     * Get system status
     * @returns {Object} System status
     */
    getStatus() {
        const status = {
            initialized: this.initialized,
            components: {
                directoryManager: this.directoryManager?.getStatus(),
                dataProcessor: this.dataProcessor?.getStats(),
                dataBus: this.dataBus?.getStatus(),
                cacheManager: this.cacheManager?.getStatus()
            },
            adapters: {},
            lastUpdate: new Date().toISOString()
        };

        // Get adapter statuses
        for (const [feature, adapter] of this.adapters.entries()) {
            status.adapters[feature] = adapter.getStatus?.() || { initialized: false };
        }

        return status;
    }

    /**
     * Get comprehensive system statistics
     * @returns {Object} System statistics
     */
    getSystemStats() {
        return {
            status: this.getStatus(),
            cacheStats: this.cacheManager.getDetailedInfo(),
            dataBusStats: this.dataBus.getStats(),
            directoryPaths: Object.fromEntries(
                Array.from(this.adapters.keys()).map(feature => [
                    feature,
                    this.directoryManager.getFeaturePaths(feature)
                ])
            )
        };
    }

    /**
     * Shutdown the system
     */
    async shutdown() {
        try {
            console.log('🛑 Shutting down Central Data Integration System...');
            
            // Clear cache
            this.cacheManager.clear();
            
            // Clear event history
            this.dataBus.clearHistory();
            
            // Reset adapters
            for (const adapter of this.adapters.values()) {
                if (adapter.clearCache) {
                    adapter.clearCache();
                }
            }
            
            this.initialized = false;
            console.log('✅ Central Data Integration System shut down successfully');
            
        } catch (error) {
            console.error('❌ Failed to shutdown system:', error);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CentralDataIntegration;
}

// Auto-initialize if in browser environment
if (typeof window !== 'undefined') {
    window.CentralDataIntegration = CentralDataIntegration;
    
    // Create global instance
    window.centralDataIntegration = new CentralDataIntegration();
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.centralDataIntegration.initialize().catch(error => {
                console.error('❌ Failed to auto-initialize Central Data Integration:', error);
            });
        });
    } else {
        window.centralDataIntegration.initialize().catch(error => {
            console.error('❌ Failed to auto-initialize Central Data Integration:', error);
        });
    }
}
