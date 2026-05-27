/**
 * Central Directory Manager
 * 
 * Manages the central data truth system for all AI platform features.
 * Provides unified directory management, path resolution, and change notifications.
 * 
 * @class CentralDirectoryManager
 * @example
 * const manager = new CentralDirectoryManager();
 * const path = manager.getPath('aiTools', 'analysis-results');
 * manager.subscribe('aiTools', callback);
 */
class CentralDirectoryManager {
    constructor() {
        this.config = null;
        this.observers = new Map();
        this.directoryState = new Map();
        this.initialized = false;
        this.configPath = './data-central/config/central-data-config.json';
        
        this.initialize();
    }

    /**
     * Initialize the central directory manager
     */
    async initialize() {
        try {
            await this.loadConfig();
            this.setupDirectoryStructure();
            this.initialized = true;
            console.log('✅ Central Directory Manager initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Central Directory Manager:', error);
            throw error;
        }
    }

    /**
     * Load central configuration
     */
    async loadConfig() {
        try {
            // Try to load from file first
            const response = await fetch(this.configPath);
            if (response.ok) {
                this.config = await response.json();
                console.log('📋 Central configuration loaded from file');
            } else {
                // Fallback to default configuration
                this.config = this.getDefaultConfig();
                console.log('⚠️ Using default configuration (file not found)');
            }
        } catch (error) {
            // Fallback to default configuration
            this.config = this.getDefaultConfig();
            console.log('⚠️ Using default configuration (fetch failed):', error.message);
        }
    }

    /**
     * Get default configuration
     */
    getDefaultConfig() {
        return {
            centralDataTruth: {
                version: "1.0.0",
                rootDirectory: "./data-central",
                subDirectories: {
                    aiTools: "./data-central/ai-tools",
                    analytics: "./data-central/analytics", 
                    development: "./data-central/development",
                    roadmap: "./data-central/roadmap",
                    technicalDebt: "./data-central/technical-debt",
                    projectResources: "./data-central/project-resources",
                    uploads: "./data-central/uploads",
                    cache: "./data-central/cache",
                    exports: "./data-central/exports",
                    config: "./data-central/config"
                },
                globalSettings: {
                    autoSync: true,
                    cacheEnabled: true,
                    backupEnabled: true,
                    versionControl: true
                }
            }
        };
    }

    /**
     * Setup directory structure and validate paths
     */
    setupDirectoryStructure() {
        const { subDirectories } = this.config.centralDataTruth;
        
        for (const [key, path] of Object.entries(subDirectories)) {
            this.directoryState.set(key, {
                path: path,
                exists: false,
                lastChecked: null,
                files: [],
                size: 0
            });
        }
        
        console.log(`📁 Directory structure setup for ${Object.keys(subDirectories).length} directories`);
    }

    /**
     * Get path for specific feature and data type
     * @param {string} feature - Feature category (aiTools, analytics, etc.)
     * @param {string} dataType - Data type within the feature
     * @returns {string} Full path to the data directory
     */
    getPath(feature, dataType = null) {
        if (!this.initialized) {
            throw new Error('Central Directory Manager not initialized');
        }

        const basePath = this.config.centralDataTruth.subDirectories[feature];
        if (!basePath) {
            throw new Error(`Unknown feature: ${feature}`);
        }

        if (dataType) {
            return `${basePath}/${dataType}`;
        }

        return basePath;
    }

    /**
     * Get all paths for a feature
     * @param {string} feature - Feature category
     * @returns {Object} All paths and metadata for the feature
     */
    getFeaturePaths(feature) {
        const featureConfig = this.config.centralDataTruth.featureMappings?.[feature];
        const basePath = this.getPath(feature);
        
        if (!featureConfig) {
            return { basePath, dataTypes: [] };
        }

        return {
            basePath,
            features: featureConfig.features,
            dataTypes: featureConfig.dataTypes.map(dataType => ({
                name: dataType,
                path: `${basePath}/${dataType}`,
                extensions: featureConfig.fileExtensions
            }))
        };
    }

    /**
     * Resolve a relative path to absolute path
     * @param {string} relativePath - Relative path from data-central
     * @returns {string} Absolute path
     */
    resolvePath(relativePath) {
        const rootPath = this.config.centralDataTruth.rootDirectory;
        return `${rootPath}/${relativePath}`;
    }

    /**
     * Subscribe to directory changes
     * @param {string} feature - Feature to watch
     * @param {Function} callback - Callback function for changes
     * @returns {string} Subscription ID
     */
    subscribe(feature, callback) {
        if (!this.observers.has(feature)) {
            this.observers.set(feature, new Map());
        }
        
        const subscriptionId = this.generateSubscriptionId();
        this.observers.get(feature).set(subscriptionId, callback);
        
        console.log(`👁️ Subscribed to ${feature} changes (ID: ${subscriptionId})`);
        return subscriptionId;
    }

    /**
     * Unsubscribe from directory changes
     * @param {string} feature - Feature to unsubscribe from
     * @param {string} subscriptionId - Subscription ID
     */
    unsubscribe(feature, subscriptionId) {
        if (this.observers.has(feature)) {
            this.observers.get(feature).delete(subscriptionId);
            console.log(`👋 Unsubscribed from ${feature} (ID: ${subscriptionId})`);
        }
    }

    /**
     * Notify subscribers of changes
     * @param {string} feature - Feature that changed
     * @param {Object} change - Change information
     */
    notify(feature, change) {
        if (this.observers.has(feature)) {
            const callbacks = this.observers.get(feature);
            callbacks.forEach(callback => {
                try {
                    callback(change);
                } catch (error) {
                    console.error(`❌ Error in subscriber callback for ${feature}:`, error);
                }
            });
        }
    }

    /**
     * Validate directory exists and is accessible
     * @param {string} feature - Feature to validate
     * @returns {Promise<Object>} Validation result
     */
    async validateDirectory(feature) {
        const path = this.getPath(feature);
        
        try {
            // In a real implementation, this would check the filesystem
            // For now, we'll simulate the validation
            const state = this.directoryState.get(feature) || {};
            const isValid = true; // Simulated validation
            
            this.directoryState.set(feature, {
                ...state,
                path,
                exists: isValid,
                lastChecked: new Date().toISOString()
            });

            return {
                feature,
                path,
                valid: isValid,
                lastChecked: new Date().toISOString()
            };
        } catch (error) {
            console.error(`❌ Failed to validate directory for ${feature}:`, error);
            return {
                feature,
                path,
                valid: false,
                error: error.message,
                lastChecked: new Date().toISOString()
            };
        }
    }

    /**
     * Get configuration for a specific feature
     * @param {string} feature - Feature name
     * @returns {Object} Feature configuration
     */
    getFeatureConfig(feature) {
        return this.config.centralDataTruth.featureMappings?.[feature] || null;
    }

    /**
     * Get global settings
     * @returns {Object} Global settings
     */
    getGlobalSettings() {
        return this.config.centralDataTruth.globalSettings;
    }

    /**
     * Update configuration
     * @param {Object} newConfig - New configuration
     */
    async updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.setupDirectoryStructure();
        
        // Notify all subscribers of configuration change
        this.notify('config', { type: 'config-update', config: this.config });
        
        console.log('⚙️ Configuration updated');
    }

    /**
     * Generate unique subscription ID
     * @returns {string} Unique ID
     */
    generateSubscriptionId() {
        return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get system status
     * @returns {Object} System status information
     */
    getStatus() {
        return {
            initialized: this.initialized,
            configLoaded: !!this.config,
            directoriesCount: this.directoryState.size,
            subscribersCount: Array.from(this.observers.values()).reduce((total, map) => total + map.size, 0),
            rootDirectory: this.config?.centralDataTruth?.rootDirectory,
            lastUpdate: new Date().toISOString()
        };
    }

    /**
     * Export configuration for backup
     * @returns {Object} Exportable configuration
     */
    exportConfig() {
        return {
            config: this.config,
            directoryState: Object.fromEntries(this.directoryState),
            status: this.getStatus(),
            exportedAt: new Date().toISOString()
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CentralDirectoryManager;
}

// Auto-initialize if in browser environment
if (typeof window !== 'undefined') {
    window.CentralDirectoryManager = CentralDirectoryManager;
    
    // Create global instance
    window.centralDirectoryManager = new CentralDirectoryManager();
}
