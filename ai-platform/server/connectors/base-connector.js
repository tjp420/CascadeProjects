/**
 * Base Connector Class
 * 
 * Abstract base class for all data connectors
 * Provides common functionality and interface for:
 * - Authentication
 * - Rate limiting
 * - Error handling
 * - Data transformation
 * - Caching
 * - Monitoring
 */

const logger = require('../lib/app-logger');

const EventEmitter = require('events');
const crypto = require('crypto');
const axios = require('axios');

class BaseConnector extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.id = config.id || crypto.randomUUID();
        this.name = config.name || 'Base Connector';
        this.type = config.type || 'base';
        this.version = config.version || '1.0.0';
        
        // Configuration
        this.config = {
            timeout: config.timeout || 30000,
            retries: config.retries || 3,
            retryDelay: config.retryDelay || 1000,
            rateLimit: config.rateLimit || { requests: 100, window: 60000 },
            cache: config.cache || { enabled: true, ttl: 300 },
            ...config
        };
        
        // State
        this.isInitialized = false;
        this.isConnected = false;
        this.lastError = null;
        this.stats = {
            requests: 0,
            successes: 0,
            errors: 0,
            totalResponseTime: 0,
            lastRequest: null
        };
        
        // Rate limiting
        this.rateLimitState = {
            requests: [],
            windowStart: Date.now()
        };
        
        // Cache
        this.cache = new Map();
        
        // Initialize
        this.initialize();
    }
    
    /**
     * Initialize connector
     */
    async initialize() {
        try {
            await this.onInitialize();
            this.isInitialized = true;
            this.emit('initialized');
            logger.debug(`[Connector] ${this.name} initialized`);
        } catch (error) {
            this.lastError = error;
            this.emit('error', error);
            console.error(`[Connector] ${this.name} initialization failed:`, error);
            throw error;
        }
    }
    
    /**
     * Connect to data source
     */
    async connect() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            await this.onConnect();
            this.isConnected = true;
            this.emit('connected');
            logger.debug(`[Connector] ${this.name} connected`);
        } catch (error) {
            this.lastError = error;
            this.emit('error', error);
            console.error(`[Connector] ${this.name} connection failed:`, error);
            throw error;
        }
    }
    
    /**
     * Disconnect from data source
     */
    async disconnect() {
        try {
            await this.onDisconnect();
            this.isConnected = false;
            this.emit('disconnected');
            logger.debug(`[Connector] ${this.name} disconnected`);
        } catch (error) {
            this.lastError = error;
            this.emit('error', error);
            console.error(`[Connector] ${this.name} disconnection failed:`, error);
            throw error;
        }
    }
    
    /**
     * Test connection
     */
    async test() {
        try {
            const result = await this.onTest();
            this.emit('test-success', result);
            return { success: true, result };
        } catch (error) {
            this.emit('test-failed', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Execute request with rate limiting, retries, and caching
     */
    async request(method, url, data = null, options = {}) {
        const startTime = Date.now();
        this.stats.requests++;
        
        try {
            // Check rate limit
            await this.checkRateLimit();
            
            // Check cache
            const cacheKey = this.getCacheKey(method, url, data);
            if (this.config.cache.enabled && method.toLowerCase() === 'get') {
                const cached = this.getFromCache(cacheKey);
                if (cached) {
                    this.emit('cache-hit', cacheKey);
                    return cached;
                }
            }
            
            // Execute request with retries
            const response = await this.executeWithRetry(method, url, data, options);
            
            // Update stats
            this.stats.successes++;
            const responseTime = Date.now() - startTime;
            this.stats.totalResponseTime += responseTime;
            this.stats.lastRequest = new Date().toISOString();
            
            // Cache response
            if (this.config.cache.enabled && method.toLowerCase() === 'get') {
                this.setCache(cacheKey, response);
            }
            
            // Transform data
            const transformed = await this.transformResponse(response);
            
            this.emit('request-success', { method, url, responseTime });
            return transformed;
            
        } catch (error) {
            this.stats.errors++;
            this.lastError = error;
            this.emit('request-error', { method, url, error });
            throw error;
        }
    }
    
    /**
     * Check rate limit
     */
    async checkRateLimit() {
        const now = Date.now();
        const window = this.config.rateLimit.window;
        const maxRequests = this.config.rateLimit.requests;
        
        // Reset window if needed
        if (now - this.rateLimitState.windowStart > window) {
            this.rateLimitState.requests = [];
            this.rateLimitState.windowStart = now;
        }
        
        // Check if rate limit exceeded
        if (this.rateLimitState.requests.length >= maxRequests) {
            const oldestRequest = this.rateLimitState.requests[0];
            const waitTime = window - (now - oldestRequest);
            
            if (waitTime > 0) {
                this.emit('rate-limit-exceeded', { waitTime });
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        
        // Add current request
        this.rateLimitState.requests.push(now);
    }
    
    /**
     * Execute request with retries
     */
    async executeWithRetry(method, url, data, options) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.config.retries; attempt++) {
            try {
                return await this.executeRequest(method, url, data, options);
            } catch (error) {
                lastError = error;
                
                if (attempt < this.config.retries && this.shouldRetry(error)) {
                    const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
                    this.emit('retry', { attempt, error, delay });
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw error;
                }
            }
        }
        
        throw lastError;
    }
    
    /**
     * Execute actual request
     */
    async executeRequest(method, url, data, options) {
        const config = {
            method,
            url,
            timeout: this.config.timeout,
            ...options
        };
        
        if (data) {
            config.data = data;
        }
        
        // Add authentication
        this.addAuthentication(config);
        
        const response = await axios(config);
        return response.data;
    }
    
    /**
     * Check if error should trigger retry
     */
    shouldRetry(error) {
        if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
            return true;
        }
        
        if (error.response) {
            const status = error.response.status;
            return status >= 500 || status === 429;
        }
        
        return false;
    }
    
    /**
     * Generate cache key
     */
    getCacheKey(method, url, data) {
        const key = `${method}:${url}:${JSON.stringify(data || {})}`;
        return crypto.createHash('md5').update(key).digest('hex');
    }
    
    /**
     * Get from cache
     */
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() < cached.expires) {
            return cached.data;
        }
        
        if (cached) {
            this.cache.delete(key);
        }
        
        return null;
    }
    
    /**
     * Set cache
     */
    setCache(key, data) {
        const expires = Date.now() + (this.config.cache.ttl * 1000);
        this.cache.set(key, { data, expires });
        
        // Cleanup expired entries
        if (this.cache.size > 1000) {
            this.cleanupCache();
        }
    }
    
    /**
     * Cleanup expired cache entries
     */
    cleanupCache() {
        const now = Date.now();
        for (const [key, cached] of this.cache) {
            if (now >= cached.expires) {
                this.cache.delete(key);
            }
        }
    }
    
    /**
     * Transform response data
     */
    async transformResponse(data) {
        return data; // Override in subclasses
    }
    
    /**
     * Add authentication to request
     */
    addAuthentication(_config) {
        // Override in subclasses
    }
    
    /**
     * Get connector statistics
     */
    getStats() {
        const avgResponseTime = this.stats.requests > 0 
            ? this.stats.totalResponseTime / this.stats.requests 
            : 0;
            
        return {
            ...this.stats,
            averageResponseTime: Math.round(avgResponseTime),
            successRate: this.stats.requests > 0 
                ? (this.stats.successes / this.stats.requests * 100).toFixed(2) 
                : 0,
            cacheSize: this.cache.size,
            isConnected: this.isConnected,
            isInitialized: this.isInitialized
        };
    }
    
    /**
     * Health check
     */
    async healthCheck() {
        try {
            const testResult = await this.test();
            const stats = this.getStats();
            
            return {
                status: testResult.success ? 'healthy' : 'unhealthy',
                lastCheck: new Date().toISOString(),
                stats,
                testResult
            };
        } catch (error) {
            return {
                status: 'error',
                lastCheck: new Date().toISOString(),
                error: error.message
            };
        }
    }
    
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            requests: 0,
            successes: 0,
            errors: 0,
            totalResponseTime: 0,
            lastRequest: null
        };
        this.cache.clear();
        this.rateLimitState = {
            requests: [],
            windowStart: Date.now()
        };
    }
    
    // Abstract methods to be implemented by subclasses
    async onInitialize() {
        // Override in subclasses
    }
    
    async onConnect() {
        // Override in subclasses
    }
    
    async onDisconnect() {
        // Override in subclasses
    }
    
    async onTest() {
        // Override in subclasses
        return { status: 'ok' };
    }
}

module.exports = BaseConnector;
