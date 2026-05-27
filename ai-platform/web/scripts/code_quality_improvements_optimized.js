/**
 * Code Quality Improvements - Optimized Version
 * Addresses complexity, duplication, and maintainability issues
 */

/**
 * Utility class for common code quality improvements
 */
class CodeQualityUtils {
    /**
     * Extract common validation logic
     * @param {Object} data - Data to validate
     * @param {Object} schema - Validation schema
     * @returns {Object} Validation result
     */
    static validateData(data, schema) {
        const errors = [];
        const warnings = [];

        // Basic null checks
        if (!data) {
            errors.push('Data is null or undefined');
            return { valid: false, errors, warnings };
        }

        // Schema validation
        for (const [key, rules] of Object.entries(schema)) {
            const value = data[key];
            
            // Required field validation
            if (rules.required && (value === undefined || value === null)) {
                errors.push(`Required field '${key}' is missing`);
                continue;
            }

            // Type validation
            if (value !== undefined && rules.type && typeof value !== rules.type) {
                errors.push(`Field '${key}' should be of type ${rules.type}`);
            }

            // Array validation
            if (rules.array && !Array.isArray(value)) {
                errors.push(`Field '${key}' should be an array`);
            }

            // Range validation
            if (rules.min !== undefined && value < rules.min) {
                warnings.push(`Field '${key}' is below minimum value ${rules.min}`);
            }
            if (rules.max !== undefined && value > rules.max) {
                warnings.push(`Field '${key}' is above maximum value ${rules.max}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Format error messages consistently
     * @param {string} code - Error code
     * @param {string} message - Error message
     * @param {Object} details - Additional error details
     * @returns {Object} Formatted error object
     */
    static formatError(code, message, details = {}) {
        return {
            error: true,
            code,
            message,
            details,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Create a debounced function
     * @param {Function} func - Function to debounce
     * @param {number} delay - Delay in milliseconds
     * @returns {Function} Debounced function
     */
    static debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    /**
     * Create a throttled function
     * @param {Function} func - Function to throttle
     * @param {number} limit - Time limit in milliseconds
     * @returns {Function} Throttled function
     */
    static throttle(func, limit) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Safe JSON parsing with error handling
     * @param {string} jsonString - JSON string to parse
     * @param {*} defaultValue - Default value if parsing fails
     * @returns {*} Parsed object or default value
     */
    static safeJsonParse(jsonString, defaultValue = null) {
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            console.warn('JSON parsing failed:', error.message);
            return defaultValue;
        }
    }

    /**
     * Deep clone an object
     * @param {*} obj - Object to clone
     * @returns {*} Cloned object
     */
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        if (obj instanceof Date) {
            return new Date(obj.getTime());
        }
        
        if (obj instanceof Array) {
            return obj.map(item => this.deepClone(item));
        }
        
        const cloned = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                cloned[key] = this.deepClone(obj[key]);
            }
        }
        
        return cloned;
    }
}

/**
 * Improved API Client with better error handling and reduced complexity
 */
class ImprovedAPIClient {
    constructor(baseUrl = null) {
        // Use window.location.origin for dynamic port support
        this.baseUrl = baseUrl || (typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost:54369');
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.requestQueue = [];
        this.activeRequests = new Set();
        this.maxRetries = 3;
        this.retryDelay = 1000;
        
        // Bind methods to maintain context
        this.fetchWithCache = this.fetchWithCache.bind(this);
        this.fetchWithRetry = this.fetchWithRetry.bind(this);
    }

    /**
     * Fetch data with caching
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>} Response data
     */
    async fetchWithCache(endpoint, options = {}) {
        const cacheKey = this.generateCacheKey(endpoint, options);
        const cached = this.getCachedData(cacheKey);

        if (cached) {
            return cached;
        }

        return this.fetchWithRetry(endpoint, options, cacheKey);
    }

    /**
     * Fetch data with retry logic
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Fetch options
     * @param {string} cacheKey - Cache key
     * @param {number} retryCount - Current retry count
     * @returns {Promise<Object>} Response data
     */
    async fetchWithRetry(endpoint, options, cacheKey, retryCount = 0) {
        try {
            const response = await this.makeRequest(endpoint, options);
            const data = await this.parseResponse(response);
            
            this.setCachedData(cacheKey, data);
            return data;
            
        } catch (error) {
            if (retryCount < this.maxRetries && this.shouldRetry(error)) {
                await this.delay(this.retryDelay * Math.pow(2, retryCount));
                return this.fetchWithRetry(endpoint, options, cacheKey, retryCount + 1);
            }
            
            throw this.formatAPIError(error);
        }
    }

    /**
     * Make HTTP request
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Fetch options
     * @returns {Promise<Response>} HTTP response
     */
    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const requestOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...this.getAuthHeaders(),
                ...options.headers
            },
            ...options
        };

        const response = await fetch(url, requestOptions);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response;
    }

    /**
     * Parse HTTP response
     * @param {Response} response - HTTP response
     * @returns {Promise<Object>} Parsed data
     */
    async parseResponse(response) {
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        
        return await response.text();
    }

    /**
     * Generate cache key
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Request options
     * @returns {string} Cache key
     */
    generateCacheKey(endpoint, options) {
        return `${endpoint}:${JSON.stringify(options)}`;
    }

    /**
     * Get cached data
     * @param {string} cacheKey - Cache key
     * @returns {Object|null} Cached data or null
     */
    getCachedData(cacheKey) {
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        
        if (cached) {
            this.cache.delete(cacheKey);
        }
        
        return null;
    }

    /**
     * Set cached data
     * @param {string} cacheKey - Cache key
     * @param {Object} data - Data to cache
     */
    setCachedData(cacheKey, data) {
        this.cache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });
        
        // Limit cache size
        if (this.cache.size > 100) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
    }

    /**
     * Get authentication headers
     * @returns {Object} Auth headers
     */
    getAuthHeaders() {
        const token = localStorage.getItem('access_token');
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    }

    /**
     * Check if error should be retried
     * @param {Error} error - Error to check
     * @returns {boolean} Whether to retry
     */
    shouldRetry(error) {
        return error.message.includes('fetch') || 
               error.message.includes('timeout') ||
               (error.message.includes('HTTP 5') && !error.message.includes('HTTP 404'));
    }

    /**
     * Format API error
     * @param {Error} error - Original error
     * @returns {Object} Formatted error
     */
    formatAPIError(error) {
        return CodeQualityUtils.formatError(
            'API_ERROR',
            error.message,
            {
                originalError: error.name,
                stack: error.stack
            }
        );
    }

    /**
     * Delay execution
     * @param {number} ms - Delay in milliseconds
     * @returns {Promise} Promise that resolves after delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache stats
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: 100,
            hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0
        };
    }
}

/**
 * Improved Data Engine with reduced complexity
 */
class ImprovedDataEngine {
    constructor() {
        this.currentDirectory = './';
        this.cache = new Map();
        this.apiEndpoint = 'http://localhost:8081/api/project/overview';
        this.apiClient = new ImprovedAPIClient();
        this.data = null;
        this.subscribers = new Set();
        
        // Debounced data loading
        this.debouncedLoadData = CodeQualityUtils.debounce(
            this.loadData.bind(this), 
            300
        );
    }

    /**
     * Set current directory
     * @param {string} directory - Directory path
     */
    setDirectory(directory) {
        if (typeof directory !== 'string') {
            throw new Error('Directory must be a string');
        }
        
        this.currentDirectory = directory;
        this.debouncedLoadData();
    }

    /**
     * Load data with error handling
     * @returns {Promise<Object>} Loaded data
     */
    async loadData() {
        try {
            // Try API first
            const data = await this.apiClient.fetchWithCache(this.apiEndpoint);
            this.data = this.validateAndProcessData(data);
            this.notifySubscribers('dataLoaded', this.data);
            return this.data;
            
        } catch (error) {
            console.warn('API load failed, using fallback:', error.message);
            const fallbackData = this.getFallbackData();
            this.data = this.validateAndProcessData(fallbackData);
            this.notifySubscribers('dataLoaded', this.data);
            return this.data;
        }
    }

    /**
     * Validate and process data
     * @param {Object} data - Raw data
     * @returns {Object} Validated data
     */
    validateAndProcessData(data) {
        const schema = {
            totalFiles: { required: true, type: 'number', min: 0 },
            codeQuality: { required: true, type: 'number', min: 0, max: 100 },
            testCoverage: { required: true, type: 'number', min: 0, max: 100 },
            languages: { required: true, type: 'object', array: true }
        };

        const validation = CodeQualityUtils.validateData(data, schema);
        
        if (!validation.valid) {
            console.warn('Data validation failed:', validation.errors);
            return this.getFallbackData();
        }

        if (validation.warnings.length > 0) {
            console.warn('Data validation warnings:', validation.warnings);
        }

        return this.processData(data);
    }

    /**
     * Process data (add computed fields)
     * @param {Object} data - Raw data
     * @returns {Object} Processed data
     */
    processData(data) {
        return {
            ...data,
            healthScore: this.calculateHealthScore(data),
            timestamp: new Date().toISOString(),
            processed: true
        };
    }

    /**
     * Calculate health score
     * @param {Object} data - Data to score
     * @returns {number} Health score (0-100)
     */
    calculateHealthScore(data) {
        const weights = {
            codeQuality: 0.4,
            testCoverage: 0.3,
            maintainability: 0.3
        };

        const maintainability = this.calculateMaintainability(data);
        
        return Math.round(
            data.codeQuality * weights.codeQuality +
            data.testCoverage * weights.testCoverage +
            maintainability * weights.maintainability
        );
    }

    /**
     * Calculate maintainability score
     * @param {Object} data - Data to score
     * @returns {number} Maintainability score (0-100)
     */
    calculateMaintainability(data) {
        let score = 80; // Base score
        
        // Adjust based on complexity indicators
        if (data.totalFiles > 1000) {
            score -= 10;
        }
        if (data.totalFiles > 5000) {
            score -= 20;
        }
        
        return Math.max(0, Math.min(100, score));
    }

    /**
     * Get fallback data
     * @returns {Object} Fallback data
     */
    getFallbackData() {
        return {
            name: 'AI Coding Intelligence Dashboard',
            totalFiles: 150,
            totalDirectories: 25,
            linesOfCode: 15678,
            codeQuality: 82,
            testCoverage: 65,
            technicalDebt: 'Medium',
            maintainability: 'Good',
            languages: ['JavaScript', 'Python', 'HTML', 'CSS'],
            frameworks: ['Node.js', 'Express'],
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Subscribe to data changes
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
        this.subscribers.add(callback);
        
        return () => {
            this.subscribers.delete(callback);
        };
    }

    /**
     * Notify subscribers of changes
     * @param {string} event - Event type
     * @param {*} data - Event data
     */
    notifySubscribers(event, data) {
        for (const callback of this.subscribers) {
            try {
                callback(event, data);
            } catch (error) {
                console.error('Subscriber callback error:', error);
            }
        }
    }

    /**
     * Get current data
     * @returns {Object|null} Current data
     */
    getData() {
        return this.data;
    }

    /**
     * Clear cache and reload
     */
    async refresh() {
        this.apiClient.clearCache();
        return this.loadData();
    }
}

/**
 * Export improved components
 */
export {
    CodeQualityUtils,
    ImprovedAPIClient,
    ImprovedDataEngine
};

/**
 * Global instances for backward compatibility
 */
export const dataEngine = new ImprovedDataEngine();
export const apiClient = new ImprovedAPIClient();
