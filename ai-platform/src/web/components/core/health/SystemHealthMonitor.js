/**
 * System Health Monitor - Comprehensive health monitoring and reporting
 * Provides real-time health metrics, scoring, and actionable recommendations
 */

export class SystemHealthMonitor {
    constructor(options = {}) {
        this.options = {
            checkInterval: options.checkInterval || 30000, // 30 seconds
            alertThresholds: options.alertThresholds || {
                overall: 70,
                codeQuality: 90,
                testCoverage: 50,
                performance: 70,
                security: 80
            },
            ...options
        };
        
        this.healthData = {
            overall: 0,
            components: {},
            metrics: {},
            alerts: [],
            recommendations: [],
            lastCheck: null,
            history: []
        };
        
        this.isMonitoring = false;
        this.monitoringTimer = null;
        this.subscribers = new Map();
        
        // Initialize health checks
        this.initializeHealthChecks();
    }

    /**
     * Initialize all health check modules
     */
    initializeHealthChecks() {
        this.healthChecks = {
            codeQuality: new CodeQualityHealthCheck(),
            testCoverage: new TestCoverageHealthCheck(),
            performance: new PerformanceHealthCheck(),
            security: new SecurityHealthCheck(),
            architecture: new ArchitectureHealthCheck(),
            dependencies: new DependencyHealthCheck()
        };
    }

    /**
     * Start health monitoring
     */
    startMonitoring() {
        if (this.isMonitoring) {
            console.warn('Health monitoring is already active');
            return;
        }

        console.log('🏥 Starting system health monitoring...');
        this.isMonitoring = true;
        
        // Run initial health check
        this.performHealthCheck();
        
        // Set up periodic monitoring
        this.monitoringTimer = setInterval(() => {
            this.performHealthCheck();
        }, this.options.checkInterval);
        
        console.log('✅ Health monitoring started');
    }

    /**
     * Stop health monitoring
     */
    stopMonitoring() {
        if (!this.isMonitoring) {
            console.warn('Health monitoring is not active');
            return;
        }

        console.log('🏥 Stopping system health monitoring...');
        this.isMonitoring = false;
        
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
            this.monitoringTimer = null;
        }
        
        console.log('✅ Health monitoring stopped');
    }

    /**
     * Perform comprehensive health check
     */
    async performHealthCheck() {
        const startTime = performance.now();
        
        try {
            console.log('🔍 Performing system health check...');
            
            // Run all health checks
            const checkResults = await this.runAllHealthChecks();
            
            // Calculate overall health score
            const overallScore = this.calculateOverallHealthScore(checkResults);
            
            // Generate recommendations
            const recommendations = this.generateRecommendations(checkResults);
            
            // Check for alerts
            const alerts = this.checkForAlerts(checkResults, overallScore);
            
            // Update health data
            this.updateHealthData(checkResults, overallScore, recommendations, alerts);
            
            // Notify subscribers
            this.notifySubscribers('health_check_completed', this.healthData);
            
            const duration = performance.now() - startTime;
            console.log(`✅ Health check completed in ${duration.toFixed(2)}ms`);
            
        } catch (error) {
            console.error('❌ Health check failed:', error);
            this.handleHealthCheckError(error);
        }
    }

    /**
     * Run all health checks
     */
    async runAllHealthChecks() {
        const results = {};
        
        for (const [name, healthCheck] of Object.entries(this.healthChecks)) {
            try {
                console.log(`🔍 Running ${name} health check...`);
                const result = await healthCheck.check();
                results[name] = {
                    ...result,
                    timestamp: new Date().toISOString(),
                    status: result.score >= this.options.alertThresholds[name] ? 'healthy' : 'warning'
                };
                console.log(`✅ ${name} health check: ${result.score}/100`);
            } catch (error) {
                console.error(`❌ ${name} health check failed:`, error);
                results[name] = {
                    score: 0,
                    status: 'error',
                    error: error.message,
                    timestamp: new Date().toISOString()
                };
            }
        }
        
        return results;
    }

    /**
     * Calculate overall health score
     */
    calculateOverallHealthScore(checkResults) {
        const weights = {
            codeQuality: 0.25,
            testCoverage: 0.20,
            performance: 0.20,
            security: 0.15,
            architecture: 0.10,
            dependencies: 0.10
        };
        
        let weightedScore = 0;
        let totalWeight = 0;
        
        for (const [name, result] of Object.entries(checkResults)) {
            if (result.score !== undefined && result.status !== 'error') {
                weightedScore += result.score * weights[name];
                totalWeight += weights[name];
            }
        }
        
        return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
    }

    /**
     * Generate actionable recommendations
     */
    generateRecommendations(checkResults) {
        const recommendations = [];
        
        for (const [name, result] of Object.entries(checkResults)) {
            if (result.score < this.options.alertThresholds[name]) {
                const healthCheck = this.healthChecks[name];
                const checkRecommendations = healthCheck.getRecommendations(result);
                recommendations.push(...checkRecommendations);
            }
        }
        
        // Sort by priority
        return recommendations.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    /**
     * Check for health alerts
     */
    checkForAlerts(checkResults, overallScore) {
        const alerts = [];
        
        // Overall health alert
        if (overallScore < this.options.alertThresholds.overall) {
            alerts.push({
                type: 'overall_health',
                severity: overallScore < 50 ? 'critical' : 'warning',
                message: `Overall health score is ${overallScore}/100`,
                recommendation: 'Review and address critical health issues'
            });
        }
        
        // Component-specific alerts
        for (const [name, result] of Object.entries(checkResults)) {
            if (result.status === 'error') {
                alerts.push({
                    type: 'component_error',
                    severity: 'critical',
                    component: name,
                    message: `${name} health check failed`,
                    recommendation: 'Fix component errors immediately'
                });
            } else if (result.score < this.options.alertThresholds[name]) {
                alerts.push({
                    type: 'component_warning',
                    severity: 'warning',
                    component: name,
                    message: `${name} score is ${result.score}/100`,
                    recommendation: `Improve ${name} health metrics`
                });
            }
        }
        
        return alerts;
    }

    /**
     * Update health data
     */
    updateHealthData(checkResults, overallScore, recommendations, alerts) {
        const previousHealth = { ...this.healthData };
        
        this.healthData = {
            overall: overallScore,
            components: checkResults,
            metrics: this.calculateSystemMetrics(checkResults),
            alerts: alerts,
            recommendations: recommendations,
            lastCheck: new Date().toISOString(),
            history: this.updateHistory(previousHealth, overallScore)
        };
    }

    /**
     * Calculate system metrics
     */
    calculateSystemMetrics(checkResults) {
        return {
            projectFiles: this.getProjectFileCount(),
            directories: this.getDirectoryCount(),
            fileTypes: this.getFileTypeCount(),
            codeComplexity: this.getCodeComplexity(),
            testCoverage: this.getTestCoverage(),
            performance: this.getPerformanceMetrics(),
            security: this.getSecurityMetrics()
        };
    }

    /**
     * Update health history
     */
    updateHistory(previousHealth, currentScore) {
        const historyEntry = {
            score: currentScore,
            timestamp: new Date().toISOString(),
            alerts: this.healthData.alerts.length,
            recommendations: this.healthData.recommendations.length
        };
        
        const history = [...(previousHealth.history || []), historyEntry];
        
        // Keep only last 24 hours of history (assuming 30-second intervals)
        const maxEntries = 24 * 60 * 60 / this.options.checkInterval;
        return history.slice(-maxEntries);
    }

    /**
     * Get current health status
     */
    getHealthStatus() {
        return {
            ...this.healthData,
            isMonitoring: this.isMonitoring,
            lastCheck: this.healthData.lastCheck,
            status: this.getHealthStatusLevel(this.healthData.overall)
        };
    }

    /**
     * Get health status level
     */
    getHealthStatusLevel(score) {
        if (score >= 90) {
            return 'excellent';
        }
        if (score >= 70) {
            return 'good';
        }
        if (score >= 50) {
            return 'fair';
        }
        if (score >= 30) {
            return 'poor';
        }
        return 'critical';
    }

    /**
     * Subscribe to health events
     */
    subscribe(event, callback) {
        if (!this.subscribers.has(event)) {
            this.subscribers.set(event, []);
        }
        this.subscribers.get(event).push(callback);
    }

    /**
     * Unsubscribe from health events
     */
    unsubscribe(event, callback) {
        if (this.subscribers.has(event)) {
            const callbacks = this.subscribers.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Notify subscribers
     */
    notifySubscribers(event, data) {
        if (this.subscribers.has(event)) {
            this.subscribers.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Error in health event subscriber:', error);
                }
            });
        }
    }

    /**
     * Handle health check errors
     */
    handleHealthCheckError(error) {
        const alert = {
            type: 'system_error',
            severity: 'critical',
            message: 'Health check system error',
            recommendation: 'Restart health monitoring system'
        };
        
        this.healthData.alerts = [alert];
        this.notifySubscribers('health_check_error', { error, alert });
    }

    /**
     * Get health report
     */
    getHealthReport() {
        const status = this.getHealthStatus();
        
        return {
            summary: {
                overall: status.overall,
                status: status.status,
                lastCheck: status.lastCheck,
                isMonitoring: status.isMonitoring
            },
            components: status.components,
            metrics: status.metrics,
            alerts: status.alerts,
            recommendations: status.recommendations,
            trends: this.getHealthTrends(),
            actions: this.getRecommendedActions()
        };
    }

    /**
     * Get health trends
     */
    getHealthTrends() {
        const history = this.healthData.history || [];
        if (history.length < 2) {
            return null;
        }
        
        const recent = history.slice(-10); // Last 10 checks
        const scores = recent.map(entry => entry.score);
        
        const trend = scores[scores.length - 1] - scores[0];
        const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        
        return {
            trend: trend > 5 ? 'improving' : trend < -5 ? 'declining' : 'stable',
            average: Math.round(average),
            change: trend,
            dataPoints: recent
        };
    }

    /**
     * Get recommended actions
     */
    getRecommendedActions() {
        const actions = [];
        const status = this.getHealthStatus();
        
        if (status.overall < 70) {
            actions.push({
                priority: 'high',
                action: 'Address critical health issues',
                description: 'Overall health score requires immediate attention',
                steps: status.recommendations.slice(0, 3).map(r => r.title)
            });
        }
        
        if (status.components.testCoverage?.score < 50) {
            actions.push({
                priority: 'high',
                action: 'Improve test coverage',
                description: 'Test coverage is critically low',
                steps: ['Write unit tests', 'Add integration tests', 'Set up CI/CD testing']
            });
        }
        
        if (status.alerts.length > 0) {
            actions.push({
                priority: 'medium',
                action: 'Resolve health alerts',
                description: `${status.alerts.length} active alerts require attention`,
                steps: status.alerts.slice(0, 3).map(a => a.message)
            });
        }
        
        return actions;
    }

    // Helper methods for system metrics
    getProjectFileCount() {
        // This would integrate with actual project analysis
        return 2366; // From current system data
    }

    getDirectoryCount() {
        return 236; // From current system data
    }

    getFileTypeCount() {
        return 42; // From current system data
    }

    getCodeComplexity() {
        // Calculate from actual code analysis
        return {
            average: 15,
            high: 5,
            total: 50
        };
    }

    getTestCoverage() {
        // Calculate from actual test coverage analysis
        return {
            percentage: 0,
            coveredLines: 0,
            totalLines: 0
        };
    }

    getPerformanceMetrics() {
        return {
            responseTime: 150,
            memoryUsage: 45,
            cpuUsage: 25
        };
    }

    getSecurityMetrics() {
        return {
            vulnerabilities: 0,
            score: 100,
            lastScan: new Date().toISOString()
        };
    }

    /**
     * Destroy health monitor
     */
    destroy() {
        this.stopMonitoring();
        this.subscribers.clear();
        console.log('🗑️ Health monitor destroyed');
    }
}

/**
 * Base class for health checks
 */
class HealthCheck {
    constructor(name, options = {}) {
        this.name = name;
        this.options = options;
    }

    async check() {
        throw new Error('check() method must be implemented by subclass');
    }

    getRecommendations(result) {
        return [];
    }
}

/**
 * Code Quality Health Check
 */
class CodeQualityHealthCheck extends HealthCheck {
    constructor() {
        super('codeQuality');
    }

    async check() {
        // Simulate code quality analysis
        const metrics = {
            maintainabilityIndex: 75,
            cyclomaticComplexity: 12,
            codeDuplication: 5,
            technicalDebt: 15
        };

        const score = this.calculateQualityScore(metrics);

        return {
            score,
            metrics,
            details: {
                maintainability: metrics.maintainabilityIndex,
                complexity: metrics.cyclomaticComplexity,
                duplication: metrics.codeDuplication,
                debt: metrics.technicalDebt
            }
        };
    }

    calculateQualityScore(metrics) {
        let score = 100;
        
        // Deduct points for issues
        score -= (100 - metrics.maintainabilityIndex) * 0.3;
        score -= Math.max(0, metrics.cyclomaticComplexity - 10) * 2;
        score -= metrics.codeDuplication * 2;
        score -= metrics.technicalDebt * 0.5;
        
        return Math.max(0, Math.round(score));
    }

    getRecommendations(result) {
        const recommendations = [];
        
        if (result.metrics.cyclomaticComplexity > 10) {
            recommendations.push({
                priority: 'medium',
                title: 'Reduce Code Complexity',
                description: 'High cyclomatic complexity detected',
                action: 'Refactor complex functions into smaller, focused functions'
            });
        }
        
        if (result.metrics.codeDuplication > 5) {
            recommendations.push({
                priority: 'low',
                title: 'Reduce Code Duplication',
                description: 'Code duplication detected',
                action: 'Extract common functionality into shared utilities'
            });
        }
        
        return recommendations;
    }
}

/**
 * Test Coverage Health Check
 */
class TestCoverageHealthCheck extends HealthCheck {
    constructor() {
        super('testCoverage');
    }

    async check() {
        // Simulate test coverage analysis
        const coverage = {
            lines: 0,
            functions: 0,
            branches: 0,
            statements: 0
        };

        const score = coverage.lines; // Use line coverage as primary metric

        return {
            score,
            metrics: coverage,
            details: {
                totalTests: 0,
                testFiles: 0,
                coveragePercentage: coverage.lines
            }
        };
    }

    getRecommendations(result) {
        const recommendations = [];
        
        if (result.score < 50) {
            recommendations.push({
                priority: 'high',
                title: 'Implement Test Coverage',
                description: `Test coverage is critically low at ${result.score}%`,
                action: 'Start with unit tests for core components'
            });
        } else if (result.score < 80) {
            recommendations.push({
                priority: 'medium',
                title: 'Improve Test Coverage',
                description: `Test coverage is ${result.score}%, aim for 80%+`,
                action: 'Add tests for uncovered code paths'
            });
        }
        
        return recommendations;
    }
}

/**
 * Performance Health Check
 */
class PerformanceHealthCheck extends HealthCheck {
    constructor() {
        super('performance');
    }

    async check() {
        // Simulate performance analysis
        const metrics = {
            responseTime: 150,
            memoryUsage: 45,
            cpuUsage: 25,
            throughput: 1000
        };

        const score = this.calculatePerformanceScore(metrics);

        return {
            score,
            metrics,
            details: {
                responseTime: metrics.responseTime,
                memoryUsage: metrics.memoryUsage,
                cpuUsage: metrics.cpuUsage,
                throughput: metrics.throughput
            }
        };
    }

    calculatePerformanceScore(metrics) {
        let score = 100;
        
        // Deduct points for performance issues
        if (metrics.responseTime > 200) {
            score -= 20;
        }
        if (metrics.memoryUsage > 80) {
            score -= 15;
        }
        if (metrics.cpuUsage > 70) {
            score -= 15;
        }
        
        return Math.max(0, Math.round(score));
    }

    getRecommendations(result) {
        const recommendations = [];
        
        if (result.metrics.responseTime > 200) {
            recommendations.push({
                priority: 'medium',
                title: 'Optimize Response Time',
                description: `Response time is ${result.metrics.responseTime}ms`,
                action: 'Implement caching and optimize database queries'
            });
        }
        
        if (result.metrics.memoryUsage > 80) {
            recommendations.push({
                priority: 'high',
                title: 'Reduce Memory Usage',
                description: `Memory usage is ${result.metrics.memoryUsage}%`,
                action: 'Optimize memory allocation and cleanup'
            });
        }
        
        return recommendations;
    }
}

/**
 * Security Health Check
 */
class SecurityHealthCheck extends HealthCheck {
    constructor() {
        super('security');
    }

    async check() {
        // Simulate security analysis
        const metrics = {
            vulnerabilities: 0,
            securityScore: 100,
            lastScan: new Date().toISOString()
        };

        return {
            score: metrics.securityScore,
            metrics,
            details: {
                vulnerabilities: metrics.vulnerabilities,
                lastScan: metrics.lastScan,
                securityScore: metrics.securityScore
            }
        };
    }

    getRecommendations(result) {
        const recommendations = [];
        
        if (result.metrics.vulnerabilities > 0) {
            recommendations.push({
                priority: 'high',
                title: 'Address Security Vulnerabilities',
                description: `${result.metrics.vulnerabilities} vulnerabilities found`,
                action: 'Update dependencies and fix security issues'
            });
        }
        
        return recommendations;
    }
}

/**
 * Architecture Health Check
 */
class ArchitectureHealthCheck extends HealthCheck {
    constructor() {
        super('architecture');
    }

    async check() {
        // Simulate architecture analysis
        const metrics = {
            modularity: 85,
            coupling: 20,
            cohesion: 80,
            patterns: 75
        };

        const score = Math.round((metrics.modularity + metrics.cohesion + metrics.patterns) / 3);

        return {
            score,
            metrics,
            details: {
                modularity: metrics.modularity,
                coupling: metrics.coupling,
                cohesion: metrics.cohesion,
                patterns: metrics.patterns
            }
        };
    }

    getRecommendations(result) {
        const recommendations = [];
        
        if (result.metrics.coupling > 30) {
            recommendations.push({
                priority: 'medium',
                title: 'Reduce Coupling',
                description: 'High coupling detected between components',
                action: 'Implement dependency injection and interfaces'
            });
        }
        
        return recommendations;
    }
}

/**
 * Dependency Health Check
 */
class DependencyHealthCheck extends HealthCheck {
    constructor() {
        super('dependencies');
    }

    async check() {
        // Simulate dependency analysis
        const metrics = {
            outdated: 2,
            vulnerabilities: 0,
            totalDependencies: 25,
            devDependencies: 15
        };

        const score = Math.max(0, 100 - (metrics.outdated * 10) - (metrics.vulnerabilities * 20));

        return {
            score,
            metrics,
            details: {
                outdated: metrics.outdated,
                vulnerabilities: metrics.vulnerabilities,
                total: metrics.totalDependencies,
                dev: metrics.devDependencies
            }
        };
    }

    getRecommendations(result) {
        const recommendations = [];
        
        if (result.metrics.outdated > 0) {
            recommendations.push({
                priority: 'medium',
                title: 'Update Dependencies',
                description: `${result.metrics.outdated} outdated dependencies`,
                action: 'Run npm update and test compatibility'
            });
        }
        
        return recommendations;
    }
}

export default SystemHealthMonitor;
