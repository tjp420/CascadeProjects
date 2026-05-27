/**
 * Performance Dashboard Component
 * Real-time performance monitoring and optimization insights
 */

class PerformanceDashboard {
    constructor() {
        this.metrics = [];
        this.alerts = [];
        this.thresholds = {
            responseTime: 1000, // 1 second
            memoryUsage: 65,     // 65% - based on project performance metrics
            cpuUsage: 65,        // 65% - based on project performance metrics
            errorRate: 2         // 2% - realistic error rate threshold
        };
        this.isMonitoring = false;
        this.updateInterval = null;
    }

    startMonitoring() {
        if (this.isMonitoring) {
            return;
        }
        
        this.isMonitoring = true;
        console.log('📊 Starting performance monitoring...');
        
        // Start collecting metrics
        this.updateInterval = setInterval(() => {
            this.collectMetrics();
        }, 5000); // Every 5 seconds
        
        // Initial collection
        this.collectMetrics();
    }

    stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }
        
        this.isMonitoring = false;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        console.log('⏹️ Performance monitoring stopped');
    }

    collectMetrics() {
        const timestamp = new Date().toISOString();
        
        // Collect API performance metrics
        const apiMetrics = this.collectAPIMetrics();
        
        // Collect browser performance metrics
        const browserMetrics = this.collectBrowserMetrics();
        
        // Collect memory metrics
        const memoryMetrics = this.collectMemoryMetrics();
        
        const metric = {
            timestamp,
            api: apiMetrics,
            browser: browserMetrics,
            memory: memoryMetrics,
            overall: this.calculateOverallScore(apiMetrics, browserMetrics, memoryMetrics)
        };
        
        this.metrics.push(metric);
        
        // Keep only last 100 metrics
        if (this.metrics.length > 100) {
            this.metrics = this.metrics.slice(-100);
        }
        
        // Check for performance alerts
        this.checkAlerts(metric);
        
        // Update UI if available
        this.updateUI(metric);
    }

    collectAPIMetrics() {
        // Get metrics from performance optimizer if available
        if (window.performanceOptimizer) {
            const report = window.performanceOptimizer.getPerformanceReport();
            return {
                avgResponseTime: report.summary.avgExecutionTime || 0,
                totalCalls: report.summary.totalCalls || 0,
                slowestFunction: this.findSlowestFunction(report.functions),
                cacheHitRatio: this.calculateCacheHitRatio()
            };
        }
        
        return {
            avgResponseTime: 0,
            totalCalls: 0,
            slowestFunction: null,
            cacheHitRatio: 0
        };
    }

    collectBrowserMetrics() {
        if (performance && performance.timing) {
            const timing = performance.timing;
            const loadTime = timing.loadEventEnd - timing.navigationStart;
            
            return {
                pageLoadTime: loadTime,
                domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
                firstPaint: this.getFirstPaintTime(),
                firstContentfulPaint: this.getFirstContentfulPaintTime()
            };
        }
        
        return {
            pageLoadTime: 0,
            domContentLoaded: 0,
            firstPaint: 0,
            firstContentfulPaint: 0
        };
    }

    collectMemoryMetrics() {
        if (performance && performance.memory) {
            const memory = performance.memory;
            const used = memory.usedJSHeapSize;
            const total = memory.totalJSHeapSize;
            const limit = memory.jsHeapSizeLimit;
            
            return {
                used: this.formatBytes(used),
                total: this.formatBytes(total),
                limit: this.formatBytes(limit),
                usagePercent: ((used / total) * 100).toFixed(2)
            };
        }
        
        return {
            used: '0 MB',
            total: '0 MB',
            limit: '0 MB',
            usagePercent: '0'
        };
    }

    calculateOverallScore(apiMetrics, browserMetrics, memoryMetrics) {
        let score = 100;
        
        // API performance impact
        if (apiMetrics.avgResponseTime > this.thresholds.responseTime) {
            score -= 20;
        }
        
        // Memory usage impact
        const memoryUsage = parseFloat(memoryMetrics.usagePercent);
        if (memoryUsage > this.thresholds.memoryUsage) {
            score -= 15;
        }
        
        // Page load time impact
        if (browserMetrics.pageLoadTime > 3000) { // 3 seconds
            score -= 15;
        }
        
        return Math.max(0, score);
    }

    findSlowestFunction(functions) {
        let slowest = null;
        let maxTime = 0;
        
        for (const [name, metrics] of Object.entries(functions)) {
            const avgTime = parseFloat(metrics.avgTime);
            if (avgTime > maxTime) {
                maxTime = avgTime;
                slowest = { name, avgTime };
            }
        }
        
        return slowest;
    }

    calculateCacheHitRatio() {
        // This would be calculated from actual cache statistics
        return 75; // Placeholder
    }

    getFirstPaintTime() {
        const paintEntries = performance.getEntriesByType('paint');
        const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
        return firstPaint ? firstPaint.startTime : 0;
    }

    getFirstContentfulPaintTime() {
        const paintEntries = performance.getEntriesByType('paint');
        const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
        return fcp ? fcp.startTime : 0;
    }

    formatBytes(bytes) {
        if (bytes === 0) {
            return '0 MB';
        }
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    }

    checkAlerts(metric) {
        const newAlerts = [];
        
        // Check API response time
        if (metric.api.avgResponseTime > this.thresholds.responseTime) {
            newAlerts.push({
                type: 'warning',
                message: `API response time is ${metric.api.avgResponseTime.toFixed(2)}ms (threshold: ${this.thresholds.responseTime}ms)`,
                severity: 'high'
            });
        }
        
        // Check memory usage
        const memoryUsage = parseFloat(metric.memory.usagePercent);
        if (memoryUsage > this.thresholds.memoryUsage) {
            newAlerts.push({
                type: 'critical',
                message: `Memory usage is ${memoryUsage}% (threshold: ${this.thresholds.memoryUsage}%)`,
                severity: 'critical'
            });
        }
        
        // Check overall score
        if (metric.overall < 70) {
            newAlerts.push({
                type: 'warning',
                message: `Overall performance score is ${metric.overall}/100`,
                severity: 'medium'
            });
        }
        
        // Add new alerts
        this.alerts.push(...newAlerts);
        
        // Keep only last 50 alerts
        if (this.alerts.length > 50) {
            this.alerts = this.alerts.slice(-50);
        }
    }

    updateUI(metric) {
        // Update performance dashboard UI if elements exist
        const scoreElement = document.getElementById('performance-score');
        if (scoreElement) {
            scoreElement.textContent = metric.overall;
            scoreElement.className = `score ${this.getScoreClass(metric.overall)}`;
        }
        
        const alertsElement = document.getElementById('performance-alerts');
        if (alertsElement) {
            this.renderAlerts(alertsElement);
        }
        
        const metricsElement = document.getElementById('performance-metrics');
        if (metricsElement) {
            this.renderMetrics(metricsElement, metric);
        }
    }

    getScoreClass(score) {
        if (score >= 90) {
            return 'excellent';
        }
        if (score >= 70) {
            return 'good';
        }
        if (score >= 50) {
            return 'fair';
        }
        return 'poor';
    }

    renderAlerts(container) {
        const recentAlerts = this.alerts.slice(-5);
        container.textContent = recentAlerts.map(alert => `
            <div class="alert alert-${alert.type} alert-${alert.severity}">
                <span class="alert-message">${alert.message}</span>
                <small class="alert-time">${new Date().toLocaleTimeString()}</small>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    renderMetrics(container, metric) {
        container.textContent = `
            <div class="metric-grid">
                <div class="metric-card">
                    <h4>API Performance</h4>
                    <div class="metric-value">${metric.api.avgResponseTime.toFixed(2)}ms</div>
                    <div class="metric-detail">Avg Response Time</div>
                </div>
                <div class="metric-card">
                    <h4>Memory Usage</h4>
                    <div class="metric-value">${metric.memory.usagePercent}%</div>
                    <div class="metric-detail">${metric.memory.used} / ${metric.memory.total}</div>
                </div>
                <div class="metric-card">
                    <h4>Page Load</h4>
                    <div class="metric-value">${(metric.browser.pageLoadTime / 1000).toFixed(2)}s</div>
                    <div class="metric-detail">Total Load Time</div>
                </div>
                <div class="metric-card">
                    <h4>Cache Hit Ratio</h4>
                    <div class="metric-value">${metric.api.cacheHitRatio}%</div>
                    <div class="metric-detail">Request Cache</div>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    getPerformanceReport() {
        if (this.metrics.length === 0) {
            return {
                status: 'No data available',
                recommendations: ['Start monitoring to collect performance data']
            };
        }
        
        const latest = this.metrics[this.metrics.length - 1];
        const recommendations = this.generateRecommendations(latest);
        
        return {
            status: latest.overall >= 70 ? 'Good' : 'Needs Improvement',
            score: latest.overall,
            metrics: latest,
            alerts: this.alerts.slice(-10),
            recommendations,
            trends: this.analyzeTrends()
        };
    }

    generateRecommendations(metric) {
        const recommendations = [];
        
        if (metric.api.avgResponseTime > this.thresholds.responseTime) {
            recommendations.push({
                priority: 'high',
                action: 'Optimize API calls',
                description: 'Implement request batching or caching to reduce API response time'
            });
        }
        
        if (parseFloat(metric.memory.usagePercent) > this.thresholds.memoryUsage) {
            recommendations.push({
                priority: 'medium',
                action: 'Reduce memory usage',
                description: 'Optimize data structures and implement object pooling'
            });
        }
        
        if (metric.browser.pageLoadTime > 3000) {
            recommendations.push({
                priority: 'medium',
                action: 'Improve page load speed',
                description: 'Optimize asset loading and implement lazy loading'
            });
        }
        
        return recommendations;
    }

    analyzeTrends() {
        if (this.metrics.length < 10) {
            return { trend: 'insufficient_data' };
        }
        
        const recent = this.metrics.slice(-10);
        const scores = recent.map(m => m.overall);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        
        const firstHalf = scores.slice(0, 5);
        const secondHalf = scores.slice(5);
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        
        const trend = secondAvg > firstAvg ? 'improving' : 'declining';
        const change = ((secondAvg - firstAvg) / firstAvg * 100).toFixed(1);
        
        return {
            trend,
            change: `${change}%`,
            average: avgScore.toFixed(1)
        };
    }
}

// Export for use
if (typeof window !== 'undefined') {
    window.PerformanceDashboard = PerformanceDashboard;
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceDashboard;
}
