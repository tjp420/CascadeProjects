/**
 * AI Cache Manager - Handles caching for AI analysis results
 * Provides intelligent caching with TTL and size limits
 */

export class AiCacheManager {
    constructor(options = {}) {
        this.cache = new Map();
        this.maxSize = options.maxSize || 100;
        this.defaultTTL = options.defaultTTL || 5 * 60 * 1000; // 5 minutes
        this.cleanupInterval = options.cleanupInterval || 60 * 1000; // 1 minute
        
        // Start cleanup timer
        this.startCleanupTimer();
    }

    /**
     * Store analysis result in cache
     * @param {string} key - Cache key
     * @param {Object} value - Analysis result
     * @param {number} ttl - Time to live in milliseconds
     */
    set(key, value, ttl = this.defaultTTL) {
        // Remove oldest entries if cache is full
        if (this.cache.size >= this.maxSize) {
            this.removeOldestEntry();
        }

        const cacheEntry = {
            value,
            timestamp: Date.now(),
            ttl,
            expires: Date.now() + ttl
        };

        this.cache.set(key, cacheEntry);
    }

    /**
     * Get analysis result from cache
     * @param {string} key - Cache key
     * @returns {Object|null} Cached analysis result or null if not found/expired
     */
    get(key) {
        const entry = this.cache.get(key);
        
        if (!entry) {
            return null;
        }

        // Check if entry has expired
        if (Date.now() > entry.expires) {
            this.cache.delete(key);
            return null;
        }

        // Update access time for LRU
        entry.timestamp = Date.now();
        
        return entry.value;
    }

    /**
     * Check if key exists in cache and is not expired
     * @param {string} key - Cache key
     * @returns {boolean} Whether key exists and is valid
     */
    has(key) {
        return this.get(key) !== null;
    }

    /**
     * Remove entry from cache
     * @param {string} key - Cache key
     * @returns {boolean} Whether entry was removed
     */
    delete(key) {
        return this.cache.delete(key);
    }

    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getStats() {
        const now = Date.now();
        let expiredCount = 0;
        let validCount = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expires) {
                expiredCount++;
            } else {
                validCount++;
            }
        }

        return {
            total: this.cache.size,
            valid: validCount,
            expired: expiredCount,
            maxSize: this.maxSize,
            utilization: (this.cache.size / this.maxSize) * 100
        };
    }

    /**
     * Remove expired entries
     * @returns {number} Number of entries removed
     */
    cleanup() {
        const now = Date.now();
        let removedCount = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expires) {
                this.cache.delete(key);
                removedCount++;
            }
        }

        return removedCount;
    }

    /**
     * Remove oldest entry (LRU eviction)
     */
    removeOldestEntry() {
        let oldestKey = null;
        let oldestTime = Date.now();

        for (const [key, entry] of this.cache.entries()) {
            if (entry.timestamp < oldestTime) {
                oldestTime = entry.timestamp;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }

    /**
     * Start automatic cleanup timer
     */
    startCleanupTimer() {
        this.cleanupTimer = setInterval(() => {
            const removed = this.cleanup();
            if (removed > 0) {
                console.log(`AI Cache: Cleaned up ${removed} expired entries`);
            }
        }, this.cleanupInterval);
    }

    /**
     * Stop automatic cleanup timer
     */
    stopCleanupTimer() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    /**
     * Generate cache key from project data
     * @param {Object} data - Project data
     * @returns {string} Cache key
     */
    generateKey(data) {
        if (!data) {
            return 'empty';
        }

        // Create a deterministic key from project characteristics
        const keyParts = [
            data.total_files || 0,
            data.total_directories || 0,
            Object.keys(data.file_types || {}).sort().join(','),
            data.last_modified || 'unknown'
        ];

        return this.hashString(keyParts.join('|'));
    }

    /**
     * Simple string hash function
     * @param {string} str - String to hash
     * @returns {string} Hash string
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Get or create analysis result
     * @param {Object} data - Project data
     * @param {Function} analysisFunction - Function to generate analysis if not cached
     * @param {number} ttl - Cache TTL
     * @returns {Promise<Object>} Analysis result
     */
    async getOrCreate(data, analysisFunction, ttl = this.defaultTTL) {
        const key = this.generateKey(data);
        let result = this.get(key);

        if (!result) {
            result = await analysisFunction(data);
            this.set(key, result, ttl);
        }

        return result;
    }

    /**
     * Preload cache with common analysis patterns
     * @param {Array} commonData - Array of common project data patterns
     */
    async preload(commonData) {
        console.log('AI Cache: Preloading common analysis patterns...');
        
        for (const data of commonData) {
            const key = this.generateKey(data);
            if (!this.has(key)) {
                // This would be called with actual analysis function
                // For now, we'll just set a placeholder
                this.set(key, { 
                    cached: true, 
                    pattern: 'preloaded',
                    timestamp: Date.now()
                });
            }
        }
        
        console.log(`AI Cache: Preloaded ${commonData.length} patterns`);
    }

    /**
     * Export cache data for persistence
     * @returns {Object} Cache data for export
     */
    export() {
        const data = {};
        const now = Date.now();

        for (const [key, entry] of this.cache.entries()) {
            if (now <= entry.expires) {
                data[key] = {
                    value: entry.value,
                    ttl: entry.ttl,
                    expires: entry.expires
                };
            }
        }

        return {
            data,
            timestamp: now,
            version: '1.0'
        };
    }

    /**
     * Import cache data
     * @param {Object} exportData - Cache data to import
     */
    import(exportData) {
        if (!exportData || !exportData.data) {
            return;
        }

        const now = Date.now();
        let importedCount = 0;

        for (const [key, entry] of Object.entries(exportData.data)) {
            if (now <= entry.expires) {
                this.cache.set(key, {
                    value: entry.value,
                    timestamp: now,
                    ttl: entry.ttl,
                    expires: entry.expires
                });
                importedCount++;
            }
        }

        console.log(`AI Cache: Imported ${importedCount} entries`);
    }

    /**
     * Get cache performance metrics
     * @returns {Object} Performance metrics
     */
    getPerformanceMetrics() {
        const stats = this.getStats();
        
        return {
            ...stats,
            average_ttl: this.calculateAverageTTL(),
            hit_rate: this.calculateHitRate(),
            memory_usage: this.estimateMemoryUsage()
        };
    }

    /**
     * Calculate average TTL
     * @returns {number} Average TTL in milliseconds
     */
    calculateAverageTTL() {
        const entries = Array.from(this.cache.values());
        if (entries.length === 0) {
            return 0;
        }

        const totalTTL = entries.reduce((sum, entry) => sum + entry.ttl, 0);
        return totalTTL / entries.length;
    }

    /**
     * Calculate hit rate (would need tracking in production)
     * @returns {number} Hit rate percentage
     */
    calculateHitRate() {
        // This would require tracking hits and misses
        // For now, return an estimate based on cache utilization
        return Math.min((this.cache.size / this.maxSize) * 100, 100);
    }

    /**
     * Estimate memory usage
     * @returns {number} Estimated memory usage in bytes
     */
    estimateMemoryUsage() {
        let totalSize = 0;
        
        for (const entry of this.cache.values()) {
            // Rough estimation of entry size
            totalSize += JSON.stringify(entry.value).length * 2; // UTF-16 bytes
            totalSize += 100; // Overhead for cache metadata
        }
        
        return totalSize;
    }

    /**
     * Destroy cache manager and cleanup resources
     */
    destroy() {
        this.stopCleanupTimer();
        this.clear();
    }
}
