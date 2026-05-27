/**
 * Performance Optimizer for AI Coding Dashboard
 * Implements memoization, caching, and performance monitoring
 */

class PerformanceOptimizer {
    constructor() {
        this.cache = new Map();
        this.requestCache = new Map();
        this.pendingRequests = new Map();
        this.metrics = new Map();
        this.optimizationEnabled = true;
    }

    // Memoization decorator for functions
    memoize(fn, cacheKeyGenerator = (...args) => JSON.stringify(args)) {
        const cache = new Map();
        
        return (...args) => {
            const key = cacheKeyGenerator(...args);
            
            if (cache.has(key)) {
                const cached = cache.get(key);
                if (Date.now() - cached.timestamp < 30000) { // 30 second cache
                    console.log(`📋 Memoized hit for: ${fn.name || 'anonymous'}`);
                    return cached.result;
                }
            }
            
            const startTime = performance.now();
            const result = fn(...args);
            const endTime = performance.now();
            
            cache.set(key, {
                result,
                timestamp: Date.now()
            });
            
            this.recordMetric(fn.name || 'anonymous', endTime - startTime);
            console.log(`⚡ ${fn.name || 'anonymous'} executed in ${(endTime - startTime).toFixed(2)}ms`);
            
            return result;
        };
    }

    // Optimized fetch with caching and duplicate request prevention
    async optimizedFetch(url, options = {}) {
        const cacheKey = `fetch_${url}_${JSON.stringify(options)}`;
        
        // Check cache first
        if (this.requestCache.has(cacheKey)) {
            const cached = this.requestCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 30000) { // 30 seconds
                console.log(`📋 Using cached fetch for: ${url}`);
                return cached.response;
            }
        }

        // Check if request is pending
        if (this.pendingRequests.has(cacheKey)) {
            console.log(`⏳ Waiting for pending fetch: ${url}`);
            return await this.pendingRequests.get(cacheKey);
        }

        // Make the request
        const requestPromise = this.makeOptimizedRequest(url, options);
        this.pendingRequests.set(cacheKey, requestPromise);

        try {
            const response = await requestPromise;
            
            // Cache successful responses
            if (response.ok) {
                this.requestCache.set(cacheKey, {
                    response,
                    timestamp: Date.now()
                });
            }
            
            return response;
        } finally {
            this.pendingRequests.delete(cacheKey);
        }
    }

    async makeOptimizedRequest(url, options) {
        const startTime = performance.now();
        console.log(`🚀 Optimized fetch: ${url}`);
        
        try {
            const response = await fetch(url, options);
            const endTime = performance.now();
            
            this.recordMetric('fetch', endTime - startTime);
            console.log(`✅ Fetch completed in ${(endTime - startTime).toFixed(2)}ms: ${url}`);
            
            return response;
        } catch (error) {
            const endTime = performance.now();
            console.error(`❌ Fetch failed after ${(endTime - startTime).toFixed(2)}ms: ${url}`, error);
            throw error;
        }
    }

    // Batch multiple requests
    async batchFetch(urls, options = {}) {
        const startTime = performance.now();
        console.log(`🔄 Starting batch fetch for ${urls.length} URLs`);
        
        try {
            const results = await Promise.allSettled(
                urls.map(url => this.optimizedFetch(url, options))
            );
            
            const endTime = performance.now();
            console.log(`✅ Batch fetch completed in ${(endTime - startTime).toFixed(2)}ms`);
            
            return results;
        } catch (error) {
            const endTime = performance.now();
            console.error(`❌ Batch fetch failed after ${(endTime - startTime).toFixed(2)}ms`, error);
            throw error;
        }
    }

    // Performance monitoring
    recordMetric(functionName, duration) {
        if (!this.metrics.has(functionName)) {
            this.metrics.set(functionName, {
                count: 0,
                totalTime: 0,
                minTime: Infinity,
                maxTime: 0,
                avgTime: 0
            });
        }
        
        const metric = this.metrics.get(functionName);
        metric.count++;
        metric.totalTime += duration;
        metric.minTime = Math.min(metric.minTime, duration);
        metric.maxTime = Math.max(metric.maxTime, duration);
        metric.avgTime = metric.totalTime / metric.count;
        
        // Alert on slow functions
        if (duration > 1000) {
            console.warn(`⚠️ Slow function detected: ${functionName} took ${duration.toFixed(2)}ms`);
        }
    }

    // Get performance report
    getPerformanceReport() {
        const report = {
            summary: {
                totalFunctions: this.metrics.size,
                totalCalls: Array.from(this.metrics.values()).reduce((sum, m) => sum + m.count, 0),
                avgExecutionTime: this.calculateOverallAverage()
            },
            functions: {}
        };
        
        for (const [name, metric] of this.metrics.entries()) {
            report.functions[name] = {
                calls: metric.count,
                avgTime: metric.avgTime.toFixed(2),
                minTime: metric.minTime.toFixed(2),
                maxTime: metric.maxTime.toFixed(2),
                totalTime: metric.totalTime.toFixed(2)
            };
        }
        
        return report;
    }

    calculateOverallAverage() {
        if (this.metrics.size === 0) {
            return 0;
        }
        
        let totalTime = 0;
        let totalCalls = 0;
        
        for (const metric of this.metrics.values()) {
            totalTime += metric.totalTime;
            totalCalls += metric.count;
        }
        
        return (totalTime / totalCalls).toFixed(2);
    }

    // Cache management
    clearCache() {
        this.cache.clear();
        this.requestCache.clear();
        console.log('🧹 Performance optimizer cache cleared');
    }

    getCacheStats() {
        return {
            cacheSize: this.cache.size,
            requestCacheSize: this.requestCache.size,
            pendingRequests: this.pendingRequests.size,
            metricsRecorded: this.metrics.size
        };
    }

    // Enable/disable optimizations
    setOptimizationEnabled(enabled) {
        this.optimizationEnabled = enabled;
        console.log(`🔧 Performance optimization ${enabled ? 'enabled' : 'disabled'}`);
    }

    // Apply optimizations to common dashboard functions
    applyDashboardOptimizations() {
        if (typeof window !== 'undefined' && window.dashboard) {
            console.log('🎯 Applying dashboard performance optimizations...');
            
            // Optimize DataEngine if available
            if (window.dashboard.dataEngine) {
                const originalLoadData = window.dashboard.dataEngine.loadData.bind(window.dashboard.dataEngine);
                window.dashboard.dataEngine.loadData = this.memoize(originalLoadData);
            }
            
            // Optimize chart rendering if available
            if (typeof Chart !== 'undefined') {
                const originalRender = Chart.prototype.render;
                Chart.prototype.render = this.memoize(originalRender.bind(Chart.prototype));
            }
            
            console.log('✅ Dashboard optimizations applied');
        }
    }
}

// Global optimizer instance
if (typeof window !== 'undefined') {
    window.performanceOptimizer = new PerformanceOptimizer();
    
    // Auto-apply optimizations when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.performanceOptimizer.applyDashboardOptimizations();
        });
    } else {
        window.performanceOptimizer.applyDashboardOptimizations();
    }
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceOptimizer;
}
