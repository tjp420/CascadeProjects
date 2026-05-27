/**
 * Performance Monitoring System
 * Tracks application performance metrics and provides analytics
 */

class PerformanceMonitor {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.sampleRate = options.sampleRate || 1.0; // 100% sampling by default
        this.metrics = [];
        this.maxMetrics = options.maxMetrics || 1000;
        this.thresholds = options.thresholds || {
            renderTime: 100, // ms
            apiTime: 1000, // ms
            memoryUsage: 50 // MB
        };
        
        if (this.enabled && 'PerformanceObserver' in window) {
            this.initializePerformanceObserver();
        }
    }

    /**
     * Initialize PerformanceObserver for browser performance metrics
     */
    initializePerformanceObserver() {
        try {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.recordMetric({
                        type: entry.entryType,
                        name: entry.name,
                        duration: entry.duration,
                        startTime: entry.startTime,
                        timestamp: new Date().toISOString()
                    });
                }
            });

            observer.observe({ entryTypes: ['navigation', 'resource', 'measure', 'paint'] });
            console.log('✅ Performance Observer initialized');
        } catch (error) {
            console.warn('Performance Observer not supported:', error);
        }
    }

    /**
     * Record a performance metric
     */
    recordMetric(metric) {
        if (!this.enabled) {
            return;
        }
        
        // Apply sampling rate
        if (Math.random() > this.sampleRate) {
            return;
        }

        this.metrics.push(metric);
        
        // Keep only the most recent metrics
        if (this.metrics.length > this.maxMetrics) {
            this.metrics.shift();
        }

        // Check thresholds
        this.checkThresholds(metric);
    }

    /**
     * Check if metric exceeds thresholds
     */
    checkThresholds(metric) {
        if (metric.duration > this.thresholds.renderTime && metric.type === 'measure') {
            console.warn(`⚠️ Slow render detected: ${metric.name} took ${metric.duration.toFixed(2)}ms`);
        }

        if (metric.duration > this.thresholds.apiTime && metric.name.includes('api')) {
            console.warn(`⚠️ Slow API call detected: ${metric.name} took ${metric.duration.toFixed(2)}ms`);
        }
    }

    /**
     * Start measuring a named operation
     */
    startMeasure(name) {
        if (!this.enabled) {
            return () => {};
        }
        
        const startTime = performance.now();
        const startMark = `${name}-start`;
        
        performance.mark(startMark);
        
        return () => {
            const endMark = `${name}-end`;
            performance.mark(endMark);
            
            performance.measure(name, startMark, endMark);
            
            const duration = performance.now() - startTime;
            
            this.recordMetric({
                type: 'custom',
                name: name,
                duration: duration,
                timestamp: new Date().toISOString()
            });
            
            // Clean up marks
            performance.clearMarks(startMark);
            performance.clearMarks(endMark);
            performance.clearMeasures(name);
            
            return duration;
        };
    }

    /**
     * Measure API call performance
     */
    async measureApiCall(name, apiFunction) {
        if (!this.enabled) {
            return apiFunction();
        }
        
        const endMeasure = this.startMeasure(`api-${name}`);
        
        try {
            const result = await apiFunction();
            const duration = endMeasure();
            
            this.recordMetric({
                type: 'api',
                name: name,
                duration: duration,
                success: true,
                timestamp: new Date().toISOString()
            });
            
            return result;
        } catch (error) {
            const duration = endMeasure();
            
            this.recordMetric({
                type: 'api',
                name: name,
                duration: duration,
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            
            throw error;
        }
    }

    /**
     * Get all metrics
     */
    getMetrics() {
        return this.metrics;
    }

    /**
     * Get metrics by type
     */
    getMetricsByType(type) {
        return this.metrics.filter(metric => metric.type === type);
    }

    /**
     * Get metrics by name
     */
    getMetricsByName(name) {
        return this.metrics.filter(metric => metric.name === name);
    }

    /**
     * Get performance statistics
     */
    getStats() {
        if (this.metrics.length === 0) {
            return {
                total: 0,
                byType: {},
                averageDuration: 0,
                maxDuration: 0,
                minDuration: 0
            };
        }

        const durations = this.metrics.map(m => m.duration);
        const byType = {};
        
        this.metrics.forEach(metric => {
            if (!byType[metric.type]) {
                byType[metric.type] = {
                    count: 0,
                    totalDuration: 0,
                    avgDuration: 0,
                    maxDuration: 0,
                    minDuration: Infinity
                };
            }
            
            byType[metric.type].count++;
            byType[metric.type].totalDuration += metric.duration;
            byType[metric.type].maxDuration = Math.max(byType[metric.type].maxDuration, metric.duration);
            byType[metric.type].minDuration = Math.min(byType[metric.type].minDuration, metric.duration);
            byType[metric.type].avgDuration = byType[metric.type].totalDuration / byType[metric.type].count;
        });

        return {
            total: this.metrics.length,
            byType: byType,
            averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
            maxDuration: Math.max(...durations),
            minDuration: Math.min(...durations)
        };
    }

    /**
     * Get memory usage (if available)
     */
    getMemoryUsage() {
        if ('memory' in performance) {
            const memoryInfo = performance.memory;
            return {
                usedJSHeapSize: (memoryInfo.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
                totalJSHeapSize: (memoryInfo.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
                jsHeapSizeLimit: (memoryInfo.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB',
                usagePercentage: ((memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100).toFixed(2) + '%'
            };
        }
        return null;
    }

    /**
     * Get navigation timing (if available)
     */
    getNavigationTiming() {
        const timing = performance.timing;
        if (!timing) {
            return null;
        }

        return {
            domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
            loadComplete: timing.loadEventEnd - timing.navigationStart,
            firstPaint: timing.responseStart - timing.navigationStart,
            domInteractive: timing.domInteractive - timing.navigationStart
        };
    }

    /**
     * Clear all metrics
     */
    clearMetrics() {
        this.metrics = [];
        console.log('🧹 Performance metrics cleared');
    }

    /**
     * Export metrics as JSON
     */
    exportMetrics() {
        return JSON.stringify({
            metrics: this.metrics,
            stats: this.getStats(),
            memory: this.getMemoryUsage(),
            navigation: this.getNavigationTiming(),
            exportTimestamp: new Date().toISOString()
        }, null, 2);
    }

    /**
     * Enable/disable monitoring
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        console.log(`Performance monitoring ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Set sampling rate
     */
    setSampleRate(rate) {
        this.sampleRate = Math.min(1.0, Math.max(0.0, rate));
        console.log(`Performance monitoring sample rate set to ${(this.sampleRate * 100).toFixed(0)}%`);
    }

    /**
     * Create performance report
     */
    createReport() {
        const stats = this.getStats();
        const memory = this.getMemoryUsage();
        const navigation = this.getNavigationTiming();

        return {
            summary: {
                totalMetrics: stats.total,
                averageDuration: stats.averageDuration.toFixed(2) + 'ms',
                maxDuration: stats.maxDuration.toFixed(2) + 'ms',
                minDuration: stats.minDuration.toFixed(2) + 'ms'
            },
            byType: stats.byType,
            memory: memory,
            navigation: navigation,
            recommendations: this.generateRecommendations(stats, memory)
        };
    }

    /**
     * Generate performance recommendations
     */
    generateRecommendations(stats, memory) {
        const recommendations = [];

        if (stats.averageDuration > this.thresholds.renderTime) {
            recommendations.push({
                type: 'warning',
                message: 'Average operation duration exceeds threshold',
                suggestion: 'Consider optimizing slow operations or implementing caching'
            });
        }

        if (memory && parseFloat(memory.usagePercentage) > this.thresholds.memoryUsage) {
            recommendations.push({
                type: 'warning',
                message: 'Memory usage is high',
                suggestion: 'Consider implementing memory cleanup or reducing data retention'
            });
        }

        if (stats.byType.api && stats.byType.api.avgDuration > this.thresholds.apiTime) {
            recommendations.push({
                type: 'warning',
                message: 'API calls are slow',
                suggestion: 'Consider implementing API response caching or optimizing backend'
            });
        }

        if (recommendations.length === 0) {
            recommendations.push({
                type: 'info',
                message: 'Performance is within acceptable limits',
                suggestion: 'Continue monitoring for performance regressions'
            });
        }

        return recommendations;
    }
}

// Create global performance monitor instance
window.performanceMonitor = new PerformanceMonitor({
    enabled: true,
    sampleRate: 1.0,
    maxMetrics: 1000,
    thresholds: {
        renderTime: 100,
        apiTime: 1000,
        memoryUsage: 50
    }
});

// Log initialization
console.log('✅ Performance monitoring system initialized');

// Create a global convenience function for measuring operations
window.measurePerformance = (name, fn) => {
    return window.performanceMonitor.measureApiCall(name, fn);
};

// Create a global convenience function for starting measures
window.startMeasure = (name) => {
    return window.performanceMonitor.startMeasure(name);
};

console.log('✅ Performance monitoring convenience functions available');
