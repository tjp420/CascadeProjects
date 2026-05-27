/**
 * Performance Optimizations for AI Coding Intelligence Dashboard
 * Implements caching, memoization, and request batching to improve performance
 */

// Performance optimization utilities
class PerformanceOptimizer {
    constructor() {
        this.cache = new Map();
        this.requestQueue = [];
        this.batchTimeout = null;
        this.memoizedFunctions = new Map();
    }

    // Memoization utility
    memoize(fn, keyGenerator = (...args) => JSON.stringify(args)) {
        const memoized = (...args) => {
            const key = keyGenerator(...args);
            
            if (this.memoizedFunctions.has(key)) {
                console.log(`🚀 Cache hit for ${fn.name}: ${key}`);
                return this.memoizedFunctions.get(key);
            }
            
            console.log(`⚡ Computing ${fn.name}: ${key}`);
            const result = fn(...args);
            this.memoizedFunctions.set(key, result);
            return result;
        };
        
        return memoized;
    }

    // Request batching utility
    batchRequest(requestFn, batchSize = 5, batchDelay = 100) {
        return (...args) => {
            return new Promise((resolve, reject) => {
                this.requestQueue.push({ args, resolve, reject });
                
                if (this.requestQueue.length >= batchSize) {
                    this.processBatch(requestFn);
                } else if (!this.batchTimeout) {
                    this.batchTimeout = setTimeout(() => {
                        this.processBatch(requestFn);
                    }, batchDelay);
                }
            });
        };
    }

    processBatch(requestFn) {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
            this.batchTimeout = null;
        }
        
        const batch = this.requestQueue.splice(0, 5);
        if (batch.length === 0) {
            return;
        }
        
        console.log(`📦 Processing batch of ${batch.length} requests`);
        
        // Process all requests in parallel
        const promises = batch.map(({ args }) => {
            try {
                return requestFn(...args);
            } catch (error) {
                return Promise.reject(error);
            }
        });
        
        // Resolve all promises
        Promise.allSettled(promises).then(results => {
            results.forEach((result, index) => {
                const { resolve, reject } = batch[index];
                if (result.status === 'fulfilled') {
                    resolve(result.value);
                } else {
                    reject(result.reason);
                }
            });
        });
    }

    // Cache utility with TTL
    cacheWithTTL(key, value, ttl = 300000) { // 5 minutes default TTL
        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            ttl
        });
    }

    getCached(key) {
        const cached = this.cache.get(key);
        if (!cached) {
            return null;
        }
        
        const now = Date.now();
        if (now - cached.timestamp > cached.ttl) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.value;
    }

    // Clear expired cache entries
    clearExpiredCache() {
        const now = Date.now();
        for (const [key, cached] of this.cache.entries()) {
            if (now - cached.timestamp > cached.ttl) {
                this.cache.delete(key);
            }
        }
    }

    // Performance monitoring
    measurePerformance(fn, name) {
        return (...args) => {
            const start = performance.now();
            const result = fn(...args);
            const end = performance.now();
            const duration = end - start;
            
            console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
            
            // Log slow operations
            if (duration > 100) {
                console.warn(`🐌 Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
            }
            
            return result;
        };
    }

    // Async performance monitoring
    async measureAsyncPerformance(fn, name) {
        return async (...args) => {
            const start = performance.now();
            const result = await fn(...args);
            const end = performance.now();
            const duration = end - start;
            
            console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
            
            // Log slow operations
            if (duration > 500) {
                console.warn(`🐌 Slow async operation detected: ${name} took ${duration.toFixed(2)}ms`);
            }
            
            return result;
        };
    }
}

// Optimized data processing functions
class OptimizedDataProcessor {
    constructor() {
        this.optimizer = new PerformanceOptimizer();
        this.processedDataCache = new Map();
        
        // Initialize memoized functions after optimizer is created
        this.processUserData = this.optimizer.memoize((userData) => {
            console.log('🔄 Processing user data...');
            
            // Simulate data processing
            const processed = userData.map(user => ({
                ...user,
                processed: true,
                timestamp: Date.now()
            }));
            
            return processed;
        });
        
        this.batchFetchData = this.optimizer.batchRequest(
            this.fetchData.bind(this),
            3, // batch size
            100 // delay
        );
    }

    // Optimized fetchData with caching
    async fetchData(url) {
        const cached = this.optimizer.getCached(url);
        if (cached) {
            console.log(`🚀 Cache hit for ${url}`);
            return cached;
        }

        console.log(`📡 Fetching ${url}...`);
        
        // Simulate API call
        return new Promise((resolve) => {
            setTimeout(() => {
                const data = { url, data: 'project analysis data', timestamp: Date.now() };
                this.optimizer.cacheWithTTL(url, data, 300000); // 5 minutes
                resolve(data);
            }, Math.random() * 1000 + 500); // 500-1500ms
        });
    }
}

class OptimizedChartRenderer {
    constructor() {
        this.optimizer = new PerformanceOptimizer();
        this.chartCache = new Map();
    }

    // Optimized renderChart with virtualization
    renderChart(data, chartType) {
        return this.optimizer.memoize((data, chartType) => {
            console.log(`📊 Rendering ${chartType} chart...`);
            
            // Virtualization for large datasets
            const maxDataPoints = 1000;
            const processedData = data.length > maxDataPoints 
                ? data.slice(0, maxDataPoints) 
                : data;
            
            // Simulate chart rendering
            const chart = {
                type: chartType,
                data: processedData,
                rendered: true,
                timestamp: Date.now()
            };
            
            return chart;
        }, (data, chartType) => `${chartType}_${data.length}_${data.slice(0, 5).join(',')}`)(data, chartType);
    }

    // Optimized form validation
    validateForm(formData) {
        return this.optimizer.memoize((formData) => {
            console.log('✅ Validating form...');
            
            // Early returns for optimization
            if (!formData || Object.keys(formData).length === 0) {
                return { valid: false, errors: ['No form data provided'] };
            }
            
            if (!formData.email) {
                return { valid: false, errors: ['Email is required'] };
            }
            
            // Simulate validation
            const errors = [];
            if (formData.email && !formData.email.includes('@')) {
                errors.push('Invalid email format');
            }
            
            return {
                valid: errors.length === 0,
                errors
            };
        })(formData);
    }
}

// Performance monitoring and reporting
class OptimizationMonitor {
    constructor() {
        this.metrics = new Map();
        this.startTime = Date.now();
    }

    recordMetric(name, duration, metadata = {}) {
        if (!this.metrics.has(name)) {
            this.metrics.set(name, []);
        }
        
        this.metrics.get(name).push({
            duration,
            timestamp: Date.now(),
            metadata
        });
    }

    getPerformanceReport() {
        const report = {
            timestamp: new Date().toISOString(),
            uptime: Date.now() - this.startTime,
            metrics: {}
        };

        for (const [name, measurements] of this.metrics.entries()) {
            const durations = measurements.map(m => m.duration);
            const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
            const max = Math.max(...durations);
            const min = Math.min(...durations);
            
            report.metrics[name] = {
                callCount: measurements.length,
                avgExecutionTime: Math.round(avg),
                maxExecutionTime: Math.round(max),
                minExecutionTime: Math.round(min),
                totalExecutionTime: Math.round(durations.reduce((a, b) => a + b, 0))
            };
        }

        return report;
    }

    // Automatic performance monitoring
    wrapFunction(fn, name) {
        const monitor = this;
        return function(...args) {
            const start = performance.now();
            const result = fn.apply(this, args);
            const end = performance.now();
            const duration = end - start;
            
            monitor.recordMetric(name, duration, {
                argsCount: args.length,
                timestamp: Date.now()
            });
            
            return result;
        };
    }
}

// Global performance optimizer instance
window.performanceOptimizer = new PerformanceOptimizer();
window.optimizedDataProcessor = new OptimizedDataProcessor();
window.optimizedChartRenderer = new OptimizedChartRenderer();
window.optimizationMonitor = new OptimizationMonitor();

// Classes are already available globally via window objects

// Auto-clear expired cache every 5 minutes
setInterval(() => {
    window.performanceOptimizer.clearExpiredCache();
    console.log('🧹 Expired cache cleared');
}, 300000);
