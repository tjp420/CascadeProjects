/**
 * Enhanced Performance Optimizer
 * 
 * Advanced performance optimization with intelligent caching, lazy loading, and monitoring
 */

export class PerformanceOptimizer {
    constructor() {
        this.cache = new Map();
        this.cacheStats = {
            hits: 0,
            misses: 0,
            evictions: 0
        };
        this.performanceMetrics = new Map();
        this.optimizationStrategies = new Map();
        this.init();
    }

    init() {
        this.setupCacheConfig();
        this.setupPerformanceMonitoring();
        this.setupResourceOptimization();
        this.setupMemoryManagement();
        console.log('⚡ Performance Optimizer initialized');
    }

    /**
     * Setup cache configuration
     */
    setupCacheConfig() {
        this.cacheConfig = {
            maxSize: 100, // Maximum number of cache entries
            defaultTTL: 5 * 60 * 1000, // 5 minutes default TTL
            cleanupInterval: 60 * 1000, // Cleanup every minute
            strategy: 'lru' // Cache eviction strategy
        };

        // Start periodic cache cleanup
        setInterval(() => this.cleanupCache(), this.cacheConfig.cleanupInterval);
    }

    /**
     * Enhanced cache with TTL and size limits
     */
    async getFromCache(key) {
        const entry = this.cache.get(key);
        
        if (!entry) {
            this.cacheStats.misses++;
            return null;
        }

        // Check if entry has expired
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.cacheStats.evictions++;
            this.cacheStats.misses++;
            return null;
        }

        // Update access time for LRU
        entry.lastAccessed = Date.now();
        this.cacheStats.hits++;
        
        return entry.value;
    }

    async setCache(key, value, ttl = this.cacheConfig.defaultTTL) {
        // Check cache size limit
        if (this.cache.size >= this.cacheConfig.maxSize) {
            this.evictFromCache();
        }

        const entry = {
            value,
            createdAt: Date.now(),
            expiresAt: Date.now() + ttl,
            lastAccessed: Date.now(),
            size: this.estimateSize(value)
        };

        this.cache.set(key, entry);
    }

    /**
     * Evict entries from cache based on strategy
     */
    evictFromCache() {
        switch (this.cacheConfig.strategy) {
        case 'lru':
            this.evictLRU();
            break;
        case 'fifo':
            this.evictFIFO();
            break;
        case 'lfu':
            this.evictLFU();
            break;
        default:
            this.evictLRU();
        }
    }

    evictLRU() {
        let oldestKey = null;
        let oldestTime = Infinity;

        this.cache.forEach((entry, key) => {
            if (entry.lastAccessed < oldestTime) {
                oldestTime = entry.lastAccessed;
                oldestKey = key;
            }
        });

        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.cacheStats.evictions++;
        }
    }

    evictFIFO() {
        let oldestKey = null;
        let oldestTime = Infinity;

        this.cache.forEach((entry, key) => {
            if (entry.createdAt < oldestTime) {
                oldestTime = entry.createdAt;
                oldestKey = key;
            }
        });

        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.cacheStats.evictions++;
        }
    }

    evictLFU() {
        let leastUsedKey = null;
        let leastUsedCount = Infinity;

        this.cache.forEach((entry, key) => {
            if ((entry.accessCount || 0) < leastUsedCount) {
                leastUsedCount = entry.accessCount || 0;
                leastUsedKey = key;
            }
        });

        if (leastUsedKey) {
            this.cache.delete(leastUsedKey);
            this.cacheStats.evictions++;
        }
    }

    /**
     * Cleanup expired cache entries
     */
    cleanupCache() {
        const now = Date.now();
        let cleaned = 0;

        this.cache.forEach((entry, key) => {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
                cleaned++;
            }
        });

        if (cleaned > 0) {
            this.cacheStats.evictions += cleaned;
            console.log(`🧹 Cleaned up ${cleaned} expired cache entries`);
        }
    }

    /**
     * Estimate size of cached value
     */
    estimateSize(value) {
        if (typeof value === 'string') {
            return value.length * 2; // 2 bytes per character
        } else if (typeof value === 'object') {
            return JSON.stringify(value).length * 2;
        }
        return 100; // Default estimate
    }

    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        // Monitor page load performance
        if (typeof window !== 'undefined' && window.performance) {
            window.addEventListener('load', () => {
                this.recordPageLoadMetrics();
            });
        }

        // Monitor long tasks
        if (typeof PerformanceObserver !== 'undefined') {
            try {
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        this.recordLongTask(entry);
                    }
                });
                observer.observe({ entryTypes: ['longtask'] });
            } catch (e) {
                console.warn('Long task monitoring not supported');
            }
        }
    }

    /**
     * Record page load metrics
     */
    recordPageLoadMetrics() {
        if (!window.performance || !window.performance.timing) {
            return;
        }

        const timing = window.performance.timing;
        const metrics = {
            dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
            tcpConnection: timing.connectEnd - timing.connectStart,
            requestTime: timing.responseEnd - timing.requestStart,
            domProcessing: timing.domComplete - timing.domLoading,
            domContentLoaded: timing.domContentLoadedEventEnd - timing.domContentLoadedEventStart,
            loadEvent: timing.loadEventEnd - timing.loadEventStart,
            totalLoadTime: timing.loadEventEnd - timing.navigationStart
        };

        this.performanceMetrics.set('pageLoad', metrics);
        console.log('📊 Page load metrics recorded:', metrics);
    }

    /**
     * Record long task
     */
    recordLongTask(entry) {
        const metric = {
            duration: entry.duration,
            startTime: entry.startTime,
            name: entry.name
        };

        if (!this.performanceMetrics.has('longTasks')) {
            this.performanceMetrics.set('longTasks', []);
        }

        this.performanceMetrics.get('longTasks').push(metric);
        console.warn('⚠️ Long task detected:', metric);
    }

    /**
     * Setup resource optimization
     */
    setupResourceOptimization() {
        this.setupLazyLoading();
        this.setupImageOptimization();
        this.setupScriptOptimization();
        this.setupCSSOptimization();
    }

    /**
     * Setup lazy loading for images and iframes
     */
    setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                        }
                        observer.unobserve(img);
                    }
                });
            });

            // Observe all images with data-src
            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        }
    }

    /**
     * Setup image optimization
     */
    setupImageOptimization() {
        // Add loading="lazy" to images below the fold
        document.querySelectorAll('img').forEach((img, index) => {
            if (index > 3) { // Skip first 4 images (above fold)
                img.loading = 'lazy';
            }
        });

        // Use WebP if supported
        if (this.supportsWebP()) {
            document.querySelectorAll('img[src$=".jpg"], img[src$=".png"]').forEach(img => {
                const webpSrc = img.src.replace(/\.(jpg|png)$/, '.webp');
                // You would implement actual WebP conversion here
            });
        }
    }

    /**
     * Check WebP support
     */
    supportsWebP() {
        if (typeof window === 'undefined') {
            return false;
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }

    /**
     * Setup script optimization
     */
    setupScriptOptimization() {
        // Add defer to non-critical scripts
        document.querySelectorAll('script:not([defer]):not([async])').forEach(script => {
            if (!script.hasAttribute('data-critical')) {
                script.defer = true;
            }
        });
    }

    /**
     * Setup CSS optimization
     */
    setupCSSOptimization() {
        // Critical CSS inline (simplified - would use actual critical CSS extraction)
        const criticalCSS = `
            /* Critical CSS would be extracted here */
        `;

        // Load non-critical CSS asynchronously
        const nonCriticalStylesheets = document.querySelectorAll('link[rel="stylesheet"]:not([data-critical])');
        nonCriticalStylesheets.forEach(link => {
            link.media = 'print';
            link.onload = () => {
                link.media = 'all';
            };
        });
    }

    /**
     * Setup memory management
     */
    setupMemoryManagement() {
        // Monitor memory usage if available
        if (window.performance && window.performance.memory) {
            setInterval(() => {
                this.recordMemoryUsage();
            }, 30000); // Every 30 seconds
        }

        // Setup garbage collection hints
        this.setupGarbageCollectionHints();
    }

    /**
     * Record memory usage
     */
    recordMemoryUsage() {
        if (!window.performance.memory) {
            return;
        }

        const memory = {
            usedJSHeapSize: window.performance.memory.usedJSHeapSize,
            totalJSHeapSize: window.performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit,
            usagePercentage: (window.performance.memory.usedJSHeapSize / window.performance.memory.jsHeapSizeLimit) * 100
        };

        this.performanceMetrics.set('memory', memory);

        if (memory.usagePercentage > 80) {
            console.warn('⚠️ High memory usage:', memory.usagePercentage.toFixed(2) + '%');
            this.suggestGarbageCollection();
        }
    }

    /**
     * Setup garbage collection hints
     */
    setupGarbageCollectionHints() {
        // Clear references to large objects when not needed
        window.addEventListener('beforeunload', () => {
            this.cleanupCache();
            this.performanceMetrics.clear();
        });
    }

    /**
     * Suggest garbage collection (Chrome only)
     */
    suggestGarbageCollection() {
        if (window.gc && typeof window.gc === 'function') {
            try {
                window.gc();
                console.log('🗑️ Garbage collection triggered');
            } catch (e) {
                console.warn('Garbage collection not available');
            }
        }
    }

    /**
     * Debounce function for performance
     */
    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle function for performance
     */
    throttle(func, limit = 300) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Request animation frame throttle
     */
    rafThrottle(func) {
        let rafId = null;
        return function executedFunction(...args) {
            if (rafId) {
                return;
            }
            rafId = requestAnimationFrame(() => {
                func(...args);
                rafId = null;
            });
        };
    }

    /**
     * Optimize array operations
     */
    optimizeArrayOperations() {
        // Use typed arrays where appropriate
        this.optimizationStrategies.set('typedArrays', {
            description: 'Use typed arrays for numeric data',
            example: 'const numbers = new Int32Array([1, 2, 3]);'
        });

        // Use array methods efficiently
        this.optimizationStrategies.set('arrayMethods', {
            description: 'Use efficient array methods',
            example: 'array.forEach(x => process(x)) instead of for loop'
        });
    }

    /**
     * Optimize DOM operations
     */
    optimizeDOMOperations() {
        // Batch DOM reads
        this.optimizationStrategies.set('batchDOMReads', {
            description: 'Batch DOM reads together',
            example: 'Read all DOM values before writing'
        });

        // Use document fragments
        this.optimizationStrategies.set('documentFragments', {
            description: 'Use document fragments for multiple insertions',
            example: 'const fragment = document.createDocumentFragment();'
        });

        // Minimize reflows
        this.optimizationStrategies.set('minimizeReflows', {
            description: 'Minimize layout reflows',
            example: 'Batch DOM changes together'
        });
    }

    /**
     * Get performance report
     */
    getPerformanceReport() {
        return {
            cache: {
                size: this.cache.size,
                maxSize: this.cacheConfig.maxSize,
                hits: this.cacheStats.hits,
                misses: this.cacheStats.misses,
                evictions: this.cacheStats.evictions,
                hitRate: this.calculateHitRate()
            },
            metrics: Object.fromEntries(this.performanceMetrics),
            strategies: Array.from(this.optimizationStrategies.entries())
        };
    }

    /**
     * Calculate cache hit rate
     */
    calculateHitRate() {
        const total = this.cacheStats.hits + this.cacheStats.misses;
        if (total === 0) {
            return 0;
        }
        return (this.cacheStats.hits / total) * 100;
    }

    /**
     * Clear all caches
     */
    clearAllCaches() {
        this.cache.clear();
        this.cacheStats = {
            hits: 0,
            misses: 0,
            evictions: 0
        };
        console.log('🧹 All caches cleared');
    }

    /**
     * Optimize specific function with memoization
     */
    memoize(fn, keyGenerator = (...args) => JSON.stringify(args)) {
        const cache = new Map();
        
        return function(...args) {
            const key = keyGenerator(...args);
            
            if (cache.has(key)) {
                return cache.get(key);
            }

            const result = fn.apply(this, args);
            cache.set(key, result);
            return result;
        };
    }

    /**
     * Create optimized async queue
     */
    createAsyncQueue(concurrency = 3) {
        const queue = [];
        let running = 0;

        return {
            add: async (task) => {
                return new Promise((resolve, reject) => {
                    queue.push({ task, resolve, reject });
                    this.processQueue();
                });
            },
            processQueue: async () => {
                if (running >= concurrency || queue.length === 0) {
                    return;
                }

                running++;
                const { task, resolve, reject } = queue.shift();

                try {
                    const result = await task();
                    resolve(result);
                } catch (error) {
                    reject(error);
                } finally {
                    running--;
                    this.processQueue();
                }
            }
        };
    }
}

export default PerformanceOptimizer;