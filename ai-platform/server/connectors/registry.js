/**
 * Connector Registry
 * 
 * Central registry for all data connectors with:
 * - Dynamic loading and registration
 * - Health monitoring
 * - Performance metrics
 * - Connector lifecycle management
 * - Configuration management
 */

const logger = require('../lib/app-logger');

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;

class ConnectorRegistry extends EventEmitter {
    constructor() {
        super();
        
        this.connectors = new Map();
        this.categories = new Map();
        this.healthChecks = new Map();
        this.metrics = new Map();
        
        // Built-in connector categories
        this.initializeCategories();
        
        // Start health monitoring
        this.startHealthMonitoring();
    }
    
    /**
     * Initialize connector categories
     */
    initializeCategories() {
        this.categories.set('ai', {
            name: 'AI/ML Platforms',
            description: 'Machine learning platforms and AI services',
            connectors: []
        });
        
        this.categories.set('database', {
            name: 'Databases',
            description: 'SQL and NoSQL databases',
            connectors: []
        });
        
        this.categories.set('cloud', {
            name: 'Cloud Services',
            description: 'AWS, GCP, Azure services',
            connectors: []
        });
        
        this.categories.set('analytics', {
            name: 'Analytics Tools',
            description: 'Analytics and monitoring platforms',
            connectors: []
        });
        
        this.categories.set('communication', {
            name: 'Communication',
            description: 'Email, chat, and collaboration tools',
            connectors: []
        });
        
        this.categories.set('development', {
            name: 'Development',
            description: 'Development and CI/CD tools',
            connectors: []
        });
    }
    
    /**
     * Register a connector
     */
    async registerConnector(connectorClass, config = {}) {
        try {
            const connector = new connectorClass(config);
            
            // Validate connector
            this.validateConnector(connector);
            
            // Store connector
            this.connectors.set(connector.id, connector);
            
            // Add to category
            const category = this.categories.get(connector.type);
            if (category) {
                category.connectors.push(connector.id);
            }
            
            // Initialize connector
            await connector.initialize();
            
            // Setup event handlers
            this.setupConnectorEvents(connector);
            
            // Start health monitoring
            this.startConnectorHealthCheck(connector);
            
            this.emit('connector-registered', connector);
            logger.debug(`[Registry] Connector registered: ${connector.name} (${connector.id})`);
            
            return connector;
        } catch (error) {
            console.error(`[Registry] Failed to register connector:`, error);
            throw error;
        }
    }
    
    /**
     * Validate connector
     */
    validateConnector(connector) {
        const requiredMethods = ['initialize', 'connect', 'disconnect', 'test', 'request'];
        
        for (const method of requiredMethods) {
            if (typeof connector[method] !== 'function') {
                throw new Error(`Connector missing required method: ${method}`);
            }
        }
        
        if (!connector.id || !connector.name || !connector.type) {
            throw new Error('Connector missing required properties: id, name, type');
        }
    }
    
    /**
     * Setup connector event handlers
     */
    setupConnectorEvents(connector) {
        connector.on('connected', () => {
            this.emit('connector-connected', connector);
        });
        
        connector.on('disconnected', () => {
            this.emit('connector-disconnected', connector);
        });
        
        connector.on('error', (error) => {
            this.emit('connector-error', { connector, error });
        });
        
        connector.on('request-success', (data) => {
            this.updateMetrics(connector.id, 'success', data);
        });
        
        connector.on('request-error', (data) => {
            this.updateMetrics(connector.id, 'error', data);
        });
    }
    
    /**
     * Load connectors from directory
     */
    async loadConnectorsFromDirectory(directory) {
        try {
            const files = await fs.readdir(directory);
            
            for (const file of files) {
                if (file.endsWith('.js') && !file.startsWith('base-')) {
                    const connectorPath = path.join(directory, file);
                    const connectorClass = require(connectorPath);
                    
                    try {
                        await this.registerConnector(connectorClass);
                    } catch (error) {
                        console.error(`[Registry] Failed to load connector ${file}:`, error);
                    }
                }
            }
        } catch (error) {
            console.error(`[Registry] Failed to load connectors from directory ${directory}:`, error);
        }
    }
    
    /**
     * Get connector by ID
     */
    getConnector(id) {
        return this.connectors.get(id);
    }
    
    /**
     * Get connectors by category
     */
    getConnectorsByCategory(category) {
        const categoryData = this.categories.get(category);
        if (!categoryData) {
            return [];
        }
        
        return categoryData.connectors
            .map(id => this.connectors.get(id))
            .filter(connector => connector);
    }
    
    /**
     * Get all connectors
     */
    getAllConnectors() {
        return Array.from(this.connectors.values());
    }
    
    /**
     * Get connector categories
     */
    getCategories() {
        const categories = {};
        
        for (const [key, category] of this.categories) {
            categories[key] = {
                ...category,
                connectors: category.connectors
                    .map(id => {
                        const connector = this.connectors.get(id);
                        return connector ? {
                            id: connector.id,
                            name: connector.name,
                            type: connector.type,
                            isConnected: connector.isConnected,
                            stats: connector.getStats()
                        } : null;
                    })
                    .filter(connector => connector)
            };
        }
        
        return categories;
    }
    
    /**
     * Connect all connectors
     */
    async connectAll() {
        const results = [];
        
        for (const connector of this.connectors.values()) {
            try {
                await connector.connect();
                results.push({ connector: connector.id, success: true });
            } catch (error) {
                results.push({ connector: connector.id, success: false, error: error.message });
            }
        }
        
        return results;
    }
    
    /**
     * Disconnect all connectors
     */
    async disconnectAll() {
        const results = [];
        
        for (const connector of this.connectors.values()) {
            try {
                await connector.disconnect();
                results.push({ connector: connector.id, success: true });
            } catch (error) {
                results.push({ connector: connector.id, success: false, error: error.message });
            }
        }
        
        return results;
    }
    
    /**
     * Test all connectors
     */
    async testAll() {
        const results = [];
        
        for (const connector of this.connectors.values()) {
            try {
                const result = await connector.test();
                results.push({ connector: connector.id, ...result });
            } catch (error) {
                results.push({ connector: connector.id, success: false, error: error.message });
            }
        }
        
        return results;
    }
    
    /**
     * Start health monitoring for a connector
     */
    startConnectorHealthCheck(connector) {
        const interval = setInterval(async () => {
            try {
                const health = await connector.healthCheck();
                this.healthChecks.set(connector.id, health);
                
                if (health.status !== 'healthy') {
                    this.emit('connector-unhealthy', { connector, health });
                }
            } catch (error) {
                this.healthChecks.set(connector.id, {
                    status: 'error',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
                this.emit('connector-health-error', { connector, error });
            }
        }, 60000); // Check every minute
        
        // Store interval ID for cleanup
        connector._healthCheckInterval = interval;
    }
    
    /**
     * Start global health monitoring
     */
    startHealthMonitoring() {
        setInterval(() => {
            this.emit('health-check', this.getGlobalHealth());
        }, 300000); // Every 5 minutes
    }
    
    /**
     * Get global health status
     */
    getGlobalHealth() {
        const connectors = Array.from(this.connectors.values());
        const healthy = connectors.filter(c => c.isConnected).length;
        const total = connectors.length;
        
        return {
            status: healthy === total ? 'healthy' : healthy > 0 ? 'degraded' : 'unhealthy',
            healthyConnectors: healthy,
            totalConnectors: total,
            timestamp: new Date().toISOString(),
            connectors: connectors.map(c => ({
                id: c.id,
                name: c.name,
                status: c.isConnected ? 'healthy' : 'unhealthy',
                lastError: c.lastError?.message
            }))
        };
    }
    
    /**
     * Update connector metrics
     */
    updateMetrics(connectorId, type, data) {
        if (!this.metrics.has(connectorId)) {
            this.metrics.set(connectorId, {
                requests: 0,
                successes: 0,
                errors: 0,
                averageResponseTime: 0,
                lastUpdate: new Date().toISOString()
            });
        }
        
        const metrics = this.metrics.get(connectorId);
        metrics.requests++;
        
        if (type === 'success') {
            metrics.successes++;
            if (data.responseTime) {
                const total = metrics.averageResponseTime * (metrics.successes - 1) + data.responseTime;
                metrics.averageResponseTime = total / metrics.successes;
            }
        } else if (type === 'error') {
            metrics.errors++;
        }
        
        metrics.lastUpdate = new Date().toISOString();
    }
    
    /**
     * Get connector metrics
     */
    getMetrics(connectorId = null) {
        if (connectorId) {
            return this.metrics.get(connectorId);
        }
        
        const allMetrics = {};
        for (const [id, metrics] of this.metrics) {
            allMetrics[id] = metrics;
        }
        
        return allMetrics;
    }
    
    /**
     * Remove connector
     */
    async removeConnector(id) {
        const connector = this.connectors.get(id);
        if (!connector) {
            throw new Error(`Connector not found: ${id}`);
        }
        
        try {
            // Disconnect
            if (connector.isConnected) {
                await connector.disconnect();
            }
            
            // Clear health check interval
            if (connector._healthCheckInterval) {
                clearInterval(connector._healthCheckInterval);
            }
            
            // Remove from registry
            this.connectors.delete(id);
            this.healthChecks.delete(id);
            this.metrics.delete(id);
            
            // Remove from category
            for (const category of this.categories.values()) {
                const index = category.connectors.indexOf(id);
                if (index > -1) {
                    category.connectors.splice(index, 1);
                }
            }
            
            this.emit('connector-removed', connector);
            logger.debug(`[Registry] Connector removed: ${connector.name} (${id})`);
            
        } catch (error) {
            console.error(`[Registry] Failed to remove connector ${id}:`, error);
            throw error;
        }
    }
    
    /**
     * Shutdown registry
     */
    async shutdown() {
        logger.debug('[Registry] Shutting down connector registry...');
        
        // Disconnect all connectors
        await this.disconnectAll();
        
        // Clear health checks
        for (const connector of this.connectors.values()) {
            if (connector._healthCheckInterval) {
                clearInterval(connector._healthCheckInterval);
            }
        }
        
        // Clear all data
        this.connectors.clear();
        this.healthChecks.clear();
        this.metrics.clear();
        
        this.emit('shutdown');
        logger.debug('[Registry] Connector registry shutdown complete');
    }
}

// Singleton instance
const registry = new ConnectorRegistry();

module.exports = registry;
