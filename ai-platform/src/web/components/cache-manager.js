/**
 * Cache Manager for Dashboard Performance
 * Implements client-side caching for better performance
 */

class CacheManager {
    constructor() {
        this.cachePrefix = 'dashboard_';
        this.defaultTTL = 5 * 60 * 1000; // 5 minutes
        this.cacheEnabled = true;
    }

    // Set cache item
    set(key, data, ttl = this.defaultTTL) {
        if (!this.cacheEnabled) {
            return;
        }
        
        const cacheData = {
            data: data,
            timestamp: Date.now(),
            ttl: ttl
        };
        
        try {
            localStorage.setItem(this.cachePrefix + key, JSON.stringify(cacheData));
            console.log(`Cached data for key: ${key}`);
        } catch (error) {
            console.warn('Failed to cache data:', error);
        }
    }

    // Get cache item
    get(key) {
        if (!this.cacheEnabled) {
            return null;
        }
        
        try {
            const cached = localStorage.getItem(this.cachePrefix + key);
            if (!cached) {
                return null;
            }
            
            const cacheData = JSON.parse(cached);
            const now = Date.now();
            
            // Check if cache is expired
            if (now - cacheData.timestamp > cacheData.ttl) {
                this.remove(key);
                return null;
            }
            
            console.log(`Cache hit for key: ${key}`);
            return cacheData.data;
        } catch (error) {
            console.warn('Failed to retrieve cached data:', error);
            return null;
        }
    }

    // Remove cache item
    remove(key) {
        try {
            localStorage.removeItem(this.cachePrefix + key);
            console.log(`Removed cache for key: ${key}`);
        } catch (error) {
            console.warn('Failed to remove cache:', error);
        }
    }

    // Clear all cache
    clear() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.cachePrefix)) {
                    localStorage.removeItem(key);
                }
            });
            console.log('Cleared all dashboard cache');
        } catch (error) {
            console.warn('Failed to clear cache:', error);
        }
    }

    // Check if cache exists and is valid
    isValid(key) {
        const cached = this.get(key);
        return cached !== null;
    }

    // Enable/disable caching
    setEnabled(enabled) {
        this.cacheEnabled = enabled;
        console.log(`Cache ${enabled ? 'enabled' : 'disabled'}`);
    }

    // Get cache statistics
    getStats() {
        try {
            const keys = Object.keys(localStorage);
            const cacheKeys = keys.filter(key => key.startsWith(this.cachePrefix));
            const totalSize = cacheKeys.reduce((size, key) => {
                return size + localStorage.getItem(key).length;
            }, 0);
            
            return {
                totalItems: cacheKeys.length,
                totalSize: totalSize,
                sizeFormatted: this.formatBytes(totalSize)
            };
        } catch (error) {
            return { totalItems: 0, totalSize: 0, sizeFormatted: '0 B' };
        }
    }

    // Format bytes to human readable format
    formatBytes(bytes) {
        if (bytes === 0) {
            return '0 B';
        }
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Global cache manager instance
window.cacheManager = new CacheManager();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CacheManager;
}
