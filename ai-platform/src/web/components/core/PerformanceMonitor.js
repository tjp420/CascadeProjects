/**
 * Performance monitoring for tracking response times and resource usage
 * 
 * @class PerformanceMonitor
 * @example
 * const monitor = new PerformanceMonitor();
 * monitor.initialize();
 */
export class PerformanceMonitor {
    constructor() {
        this.metrics = [];
        this.maxMetrics = 1000;
        this.startTime = Date.now();
        this.initialized = false;
    }

    /**
     * Initializes the performance monitor
     * 
     * @returns {void}
     */
    initialize() {
        if (this.initialized) {
            return;
        }

        // Track page load performance
        if (window.performance && window.performance.timing) {
            window.addEventListener('load', () => {
                this.trackPageLoad();
            });
        }

        // Track navigation timing
        if (window.performance && window.performance.getEntriesByType) {
            this.trackNavigationTiming();
        }

        this.initialized = true;
    }

    trackPageLoad() {
        const timing = window.performance.timing;
        const metrics = {
            timestamp: new Date().toISOString(),
            type: 'page_load',
            dns: timing.domainLookupEnd - timing.domainLookupStart,
            tcp: timing.connectEnd - timing.connectStart,
            request: timing.responseStart - timing.requestStart,
            response: timing.responseEnd - timing.responseStart,
            dom: timing.domComplete - timing.domLoading,
            load: timing.loadEventEnd - timing.loadEventStart,
            total: timing.loadEventEnd - timing.navigationStart
        };

        this.recordMetric(metrics);
    }

    trackNavigationTiming() {
        const entries = window.performance.getEntriesByType('navigation');
        if (entries.length > 0) {
            const nav = entries[0];
            const metrics = {
                timestamp: new Date().toISOString(),
                type: 'navigation',
                domContentLoaded: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
                loadComplete: nav.loadEventEnd - nav.loadEventStart,
                transferSize: nav.transferSize,
                encodedBodySize: nav.encodedBodySize
            };

            this.recordMetric(metrics);
        }
    }

    trackAPIPerformance(endpoint, duration, status) {
        const metrics = {
            timestamp: new Date().toISOString(),
            type: 'api_call',
            endpoint,
            duration,
            status
        };

        this.recordMetric(metrics);
    }

    trackFunctionPerformance(functionName, duration) {
        const metrics = {
            timestamp: new Date().toISOString(),
            type: 'function_call',
            functionName,
            duration
        };

        this.recordMetric(metrics);
    }

    recordMetric(metrics) {
        this.metrics.push(metrics);

        // Keep only the last maxMetrics entries
        if (this.metrics.length > this.maxMetrics) {
            this.metrics.shift();
        }

        console.log('📊 Performance metric recorded:', metrics);
    }

    getMetrics(type = null, limit = null) {
        let filtered = this.metrics;

        if (type) {
            filtered = filtered.filter(m => m.type === type);
        }

        if (limit) {
            filtered = filtered.slice(-limit);
        }

        return filtered;
    }

    getAverageMetric(type, field) {
        const filtered = this.metrics.filter(m => m.type === type && m[field] !== undefined);
        if (filtered.length === 0) {
            return 0;
        }

        const sum = filtered.reduce((acc, m) => acc + m[field], 0);
        return sum / filtered.length;
    }

    getPerformanceSummary() {
        const summary = {
            uptime: Date.now() - this.startTime,
            totalMetrics: this.metrics.length,
            byType: {},
            averages: {}
        };

        // Count by type
        this.metrics.forEach(m => {
            summary.byType[m.type] = (summary.byType[m.type] || 0) + 1;
        });

        // Calculate averages
        summary.averages.apiCallDuration = this.getAverageMetric('api_call', 'duration');
        summary.averages.functionCallDuration = this.getAverageMetric('function_call', 'duration');
        summary.averages.pageLoadTime = this.getAverageMetric('page_load', 'total');

        return summary;
    }

    clearMetrics() {
        this.metrics = [];
    }

    exportMetrics(format = 'json') {
        if (format === 'json') {
            return JSON.stringify(this.metrics, null, 2);
        } else if (format === 'csv') {
            const headers = ['timestamp', 'type', 'duration', 'status'];
            const rows = this.metrics.map(m => [
                m.timestamp,
                m.type,
                m.duration || '',
                m.status || ''
            ]);
            return [headers, ...rows].map(row => row.join(',')).join('\n');
        }
        return this.metrics;
    }

    // Performance timing wrapper
    async measureFunction(functionName, fn) {
        const start = performance.now();
        try {
            const result = await fn();
            const duration = performance.now() - start;
            this.trackFunctionPerformance(functionName, duration);
            return result;
        } catch (error) {
            const duration = performance.now() - start;
            this.trackFunctionPerformance(functionName, duration);
            throw error;
        }
    }
}

// Create global performance monitor instance
window.performanceMonitor = new PerformanceMonitor();
window.PerformanceMonitor = PerformanceMonitor;
