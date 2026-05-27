/**
 * Central Cache Manager
 * 
 * Provides unified caching system for all AI platform features.
 * Handles intelligent cache invalidation, compression, and shared resources.
 * 
 * @class CentralCacheManager
 * @example
 * const cacheManager = new CentralCacheManager();
 * await cacheManager.set('key', data);
 * const data = await cacheManager.get('key');
 */
class CentralCacheManager {
    constructor() {
        this.cache = new Map();
        this.policies = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0
        };
        this.initialized = false;
        this.maxCacheSize = 500 * 1024 * 1024; // 500MB
        this.defaultTTL = 30 * 60 * 1000; // 30 minutes
        this.compressionEnabled = true;
        this.persistToDisk = true;
        
        this.initialize();
    }

    /**
     * Initialize the cache manager
     */
    initialize() {
        try {
            // Setup default policies
            this.setupDefaultPolicies();
            
            // Start cleanup interval
            this.startCleanupInterval();
            
            this.initialized = true;
            console.log('✅ Central Cache Manager initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Central Cache Manager:', error);
            throw error;
        }
    }

    /**
     * Setup default cache policies
     */
    setupDefaultPolicies() {
        const defaultPolicies = {
            'ai-tools': {
                ttl: 15 * 60 * 1000, // 15 minutes
                maxSize: 50 * 1024 * 1024, // 50MB
                compression: true
            },
            'analytics': {
                ttl: 10 * 60 * 1000, // 10 minutes
                maxSize: 100 * 1024 * 1024, // 100MB
                compression: true
            },
            'development': {
                ttl: 60 * 60 * 1000, // 1 hour
                maxSize: 25 * 1024 * 1024, // 25MB
                compression: false
            },
            'roadmap': {
                ttl: 24 * 60 * 60 * 1000, // 24 hours
                maxSize: 10 * 1024 * 1024, // 10MB
                compression: true
            },
            'technical-debt': {
                ttl: 30 * 60 * 1000, // 30 minutes
                maxSize: 25 * 1024 * 1024, // 25MB
                compression: true
            },
            'project-resources': {
                ttl: 45 * 60 * 1000, // 45 minutes
                maxSize: 75 * 1024 * 1024, // 75MB
                compression: true
            }
        };

        for (const [feature, policy] of Object.entries(defaultPolicies)) {
            this.policies.set(feature, policy);
        }
    }

    /**
     * Start cleanup interval
     */
    startCleanupInterval() {
        // Cleanup every 5 minutes
        setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);
    }

    /**
     * Set cache value
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     * @param {Object} options - Cache options
     * @returns {Promise<boolean>} Success status
     */
    async set(key, value, options = {}) {
        try {
            const feature = this.extractFeature(key);
            const policy = this.getPolicy(feature, options);
            
            // Check cache size limit
            if (this.getCurrentSize() > this.maxCacheSize) {
                await this.evictLeastRecentlyUsed();
            }

            // Prepare cache entry
            const cacheEntry = {
                key: key,
                value: value,
                timestamp: Date.now(),
                ttl: policy.ttl,
                size: this.calculateSize(value),
                compressed: false,
                accessCount: 0,
                lastAccessed: Date.now()
            };

            // Compress if enabled and beneficial
            if (policy.compression && this.compressionEnabled && cacheEntry.size > 1024) {
                cacheEntry.value = await this.compressData(value);
                cacheEntry.compressed = true;
                cacheEntry.size = this.calculateSize(cacheEntry.value);
            }

            // Store in cache
            this.cache.set(key, cacheEntry);
            this.stats.sets++;

            console.log(`💾 Cached: ${key} (${cacheEntry.size} bytes)`);
            return true;

        } catch (error) {
            console.error(`❌ Failed to cache ${key}:`, error);
            return false;
        }
    }

    /**
     * Get cache value
     * @param {string} key - Cache key
     * @returns {Promise<*>} Cached value or null
     */
    async get(key) {
        try {
            const cacheEntry = this.cache.get(key);
            
            if (!cacheEntry) {
                this.stats.misses++;
                return null;
            }

            // Check TTL
            if (Date.now() - cacheEntry.timestamp > cacheEntry.ttl) {
                this.cache.delete(key);
                this.stats.evictions++;
                this.stats.misses++;
                console.log(`⏰ Cache expired: ${key}`);
                return null;
            }

            // Update access statistics
            cacheEntry.accessCount++;
            cacheEntry.lastAccessed = Date.now();
            this.stats.hits++;

            // Decompress if needed
            let value = cacheEntry.value;
            if (cacheEntry.compressed) {
                value = await this.decompressData(value);
            }

            console.log(`⚡ Cache hit: ${key}`);
            return value;

        } catch (error) {
            console.error(`❌ Failed to get cache ${key}:`, error);
            this.stats.misses++;
            return null;
        }
    }

    /**
     * Delete cache entry
     * @param {string} key - Cache key
     * @returns {boolean} Success status
     */
    delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.stats.deletes++;
            console.log(`🗑️ Cache deleted: ${key}`);
        }
        return deleted;
    }

    /**
     * Clear cache
     * @param {string} feature - Feature to clear (optional)
     */
    clear(feature = null) {
        if (feature) {
            // Clear specific feature cache
            const keysToDelete = [];
            for (const [key] of this.cache.entries()) {
                if (key.startsWith(`${feature}.`)) {
                    keysToDelete.push(key);
                }
            }
            
            keysToDelete.forEach(key => this.cache.delete(key));
            console.log(`🗑️ Cleared cache for feature: ${feature} (${keysToDelete.length} entries)`);
        } else {
            // Clear all cache
            const size = this.cache.size;
            this.cache.clear();
            console.log(`🗑️ Cleared all cache (${size} entries)`);
        }
    }

    /**
     * Check if key exists in cache
     * @param {string} key - Cache key
     * @returns {boolean} Exists status
     */
    has(key) {
        const cacheEntry = this.cache.get(key);
        if (!cacheEntry) {
            return false;
        }

        // Check TTL
        if (Date.now() - cacheEntry.timestamp > cacheEntry.ttl) {
            this.cache.delete(key);
            this.stats.evictions++;
            return false;
        }

        return true;
    }

    /**
     * Get cache size
     * @returns {number} Current cache size in bytes
     */
    getCurrentSize() {
        let totalSize = 0;
        for (const entry of this.cache.values()) {
            totalSize += entry.size;
        }
        return totalSize;
    }

    /**
     * Extract feature from cache key
     * @param {string} key - Cache key
     * @returns {string} Feature name
     */
    extractFeature(key) {
        const parts = key.split('.');
        return parts[0] || 'default';
    }

    /**
     * Get cache policy for feature
     * @param {string} feature - Feature name
     * @param {Object} options - Override options
     * @returns {Object} Cache policy
     */
    getPolicy(feature, options = {}) {
        const defaultPolicy = {
            ttl: this.defaultTTL,
            maxSize: this.maxCacheSize,
            compression: this.compressionEnabled
        };

        const featurePolicy = this.policies.get(feature) || defaultPolicy;
        return { ...featurePolicy, ...options };
    }

    /**
     * Calculate data size
     * @param {*} data - Data to measure
     * @returns {number} Size in bytes
     */
    calculateSize(data) {
        if (typeof data === 'string') {
            return data.length * 2; // UTF-16
        } else if (data instanceof ArrayBuffer) {
            return data.byteLength;
        } else {
            return JSON.stringify(data).length * 2;
        }
    }

    /**
     * Compress data (simple implementation)
     * @param {*} data - Data to compress
     * @returns {Promise<string>} Compressed data
     */
    async compressData(data) {
        // Simple compression using JSON and base64
        // In a real implementation, use proper compression libraries
        const jsonString = JSON.stringify(data);
        return btoa(jsonString);
    }

    /**
     * Decompress data
     * @param {string} compressedData - Compressed data
     * @returns {Promise<*>} Decompressed data
     */
    async decompressData(compressedData) {
        // Simple decompression
        const jsonString = atob(compressedData);
        return JSON.parse(jsonString);
    }

    /**
     * Evict least recently used entries
     * @returns {Promise<number>} Number of entries evicted
     */
    async evictLeastRecentlyUsed() {
        const entries = Array.from(this.cache.entries());
        
        // Sort by last accessed time
        entries.sort(([,a], [,b]) => a.lastAccessed - b.lastAccessed);
        
        // Evict oldest 25% or until under size limit
        const evictCount = Math.max(1, Math.floor(entries.length * 0.25));
        let evicted = 0;
        
        for (let i = 0; i < evictCount && this.getCurrentSize() > this.maxCacheSize; i++) {
            const [key] = entries[i];
            this.cache.delete(key);
            evicted++;
            this.stats.evictions++;
        }
        
        console.log(`🗑️ Evicted ${evicted} least recently used entries`);
        return evicted;
    }

    /**
     * Cleanup expired entries
     * @returns {number} Number of entries cleaned up
     */
    cleanup() {
        const now = Date.now();
        const keysToDelete = [];
        
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                keysToDelete.push(key);
            }
        }
        
        keysToDelete.forEach(key => {
            this.cache.delete(key);
            this.stats.evictions++;
        });
        
        if (keysToDelete.length > 0) {
            console.log(`🧹 Cleaned up ${keysToDelete.length} expired entries`);
        }
        
        return keysToDelete.length;
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0 
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
            : 0;

        return {
            entries: this.cache.size,
            size: this.getCurrentSize(),
            maxSize: this.maxCacheSize,
            hitRate: `${hitRate}%`,
            hits: this.stats.hits,
            misses: this.stats.misses,
            sets: this.stats.sets,
            deletes: this.stats.deletes,
            evictions: this.stats.evictions,
            compressionEnabled: this.compressionEnabled,
            policiesCount: this.policies.size
        };
    }

    /**
     * Get detailed cache information
     * @returns {Object} Detailed cache info
     */
    getDetailedInfo() {
        const entries = [];
        const featureStats = {};
        
        for (const [key, entry] of this.cache.entries()) {
            const feature = this.extractFeature(key);
            
            if (!featureStats[feature]) {
                featureStats[feature] = {
                    count: 0,
                    size: 0,
                    hits: 0
                };
            }
            
            featureStats[feature].count++;
            featureStats[feature].size += entry.size;
            featureStats[feature].hits += entry.accessCount;
            
            entries.push({
                key: key,
                size: entry.size,
                ttl: entry.ttl,
                age: Date.now() - entry.timestamp,
                accessCount: entry.accessCount,
                lastAccessed: entry.lastAccessed,
                compressed: entry.compressed
            });
        }
        
        return {
            stats: this.getStats(),
            featureStats,
            entries: entries.sort((a, b) => b.lastAccessed - a.lastAccessed)
        };
    }

    /**
     * Set cache policy
     * @param {string} feature - Feature name
     * @param {Object} policy - Cache policy
     */
    setPolicy(feature, policy) {
        this.policies.set(feature, policy);
        console.log(`⚙️ Set cache policy for ${feature}`);
    }

    /**
     * Get system status
     * @returns {Object} System status
     */
    getStatus() {
        return {
            initialized: this.initialized,
            entries: this.cache.size,
            size: this.getCurrentSize(),
            hitRate: this.getStats().hitRate,
            lastCleanup: new Date().toISOString()
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CentralCacheManager;
}

// Auto-initialize if in browser environment
if (typeof window !== 'undefined') {
    window.CentralCacheManager = CentralCacheManager;
    
    // Create global instance
    window.centralCacheManager = new CentralCacheManager();
}
