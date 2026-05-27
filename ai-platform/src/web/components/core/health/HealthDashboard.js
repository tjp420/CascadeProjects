/**
 * Health Dashboard - Comprehensive health monitoring dashboard
 * Integrates system health monitoring and test coverage tracking
 */

import { SecurityMonitor } from '../security/SecurityMonitor.js';

import { SystemHealthMonitor } from './SystemHealthMonitor.js';
import { TestCoverageTracker } from './TestCoverageTracker.js';

export class HealthDashboard {
    constructor(options = {}) {
        this.options = {
            refreshInterval: options.refreshInterval || 30000, // 30 seconds
            enableAlerts: options.enableAlerts !== false,
            enableTrends: options.enableTrends !== false,
            ...options
        };
        
        this.healthMonitor = new SystemHealthMonitor({
            checkInterval: this.options.refreshInterval
        });
        
        this.coverageTracker = new TestCoverageTracker({
            targetCoverage: options.targetCoverage || 80,
            reportInterval: this.options.refreshInterval
        });
        
        this.securityMonitor = new SecurityMonitor({
            scanInterval: options.securityScanInterval || 3600000, // 1 hour
            alertThresholds: options.securityAlertThresholds || {
                vulnerabilities: 0,
                highSeverityVulns: 0,
                criticalSeverityVulns: 0,
                scoreThreshold: 70
            },
            enableAlerts: options.enableSecurityAlerts !== false
        });
        
        this.dashboardData = {
            overall: 0,
            components: {},
            metrics: {},
            alerts: [],
            recommendations: [],
            trends: {},
            lastUpdate: null
        };
        
        this.isRunning = false;
        this.refreshTimer = null;
        this.subscribers = new Map();
        
        // Initialize dashboard
        this.initializeDashboard();
    }

    /**
     * Initialize health dashboard
     */
    initializeDashboard() {
        console.log('🏥 Initializing health dashboard...');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize data
        this.updateDashboardData();
        
        console.log('✅ Health dashboard initialized');
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Health monitor events
        this.healthMonitor.subscribe('health_check_completed', (data) => {
            this.onHealthCheckCompleted(data);
        });
        
        // Coverage tracker events
        this.coverageTracker.subscribe('coverage_analyzed', (data) => {
            this.onCoverageAnalyzed(data);
        });
        
        // Security monitor events
        this.securityMonitor.subscribe('security_check_completed', (data) => {
            this.onSecurityCheckCompleted(data);
        });
        
        this.securityMonitor.subscribe('security_alert', (alert) => {
            this.onSecurityAlert(alert);
        });
    }

    /**
     * Start health dashboard
     */
    start() {
        if (this.isRunning) {
            console.warn('Health dashboard is already running');
            return;
        }

        console.log('🏥 Starting health dashboard...');
        this.isRunning = true;
        
        // Start monitoring systems
        this.healthMonitor.startMonitoring();
        this.coverageTracker.startTracking();
        this.securityMonitor.startMonitoring();
        
        // Set up refresh timer
        this.refreshTimer = setInterval(() => {
            this.refreshDashboard();
        }, this.options.refreshInterval);
        
        console.log('✅ Health dashboard started');
    }

    /**
     * Stop health dashboard
     */
    stop() {
        if (!this.isRunning) {
            console.warn('Health dashboard is not running');
            return;
        }

        console.log('🏥 Stopping health dashboard...');
        this.isRunning = false;
        
        // Stop monitoring systems
        this.healthMonitor.stopMonitoring();
        this.coverageTracker.stopTracking();
        this.securityMonitor.stopMonitoring();
        
        // Clear refresh timer
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
        
        console.log('✅ Health dashboard stopped');
    }

    /**
     * Refresh dashboard data
     */
    async refreshDashboard() {
        const startTime = performance.now();
        
        try {
            console.log('🔄 Refreshing health dashboard...');
            
            // Get latest data from all systems
            const healthData = this.healthMonitor.getHealthStatus();
            const coverageData = this.coverageTracker.getCoverageSummary();
            const securityData = this.securityMonitor.getSecurityStatus();
            
            // Combine and update dashboard data
            this.combineDashboardData(healthData, coverageData);
            
            // Generate consolidated insights
            this.generateInsights();
            
            // Check for alerts
            this.checkAlerts();
            
            // Update timestamp
            this.dashboardData.lastUpdate = new Date().toISOString();
            
            // Notify subscribers
            this.notifySubscribers('dashboard_refreshed', this.dashboardData);
            
            const duration = performance.now() - startTime;
            console.log(`✅ Dashboard refreshed in ${duration.toFixed(2)}ms`);
            
        } catch (error) {
            console.error('❌ Dashboard refresh failed:', error);
            this.handleRefreshError(error);
        }
    }

    /**
     * Handle health check completion
     */
    onHealthCheckCompleted(healthData) {
        this.updateDashboardData();
        this.notifySubscribers('health_updated', healthData);
    }

    /**
     * Handle coverage analysis completion
     */
    onCoverageAnalyzed(coverageData) {
        this.updateDashboardData();
        this.notifySubscribers('coverage_updated', coverageData);
    }

    /**
     * Handle security check completion
     */
    onSecurityCheckCompleted(securityData) {
        this.updateDashboardData();
        this.notifySubscribers('security_updated', securityData);
    }

    /**
     * Handle security alert
     */
    onSecurityAlert(alert) {
        // Add to dashboard alerts
        this.dashboardData.alerts.push(alert);
        
        // Notify subscribers
        this.notifySubscribers('security_alert', alert);
        
        console.log(`🚨 Security alert: ${alert.message}`);
    }

    /**
     * Combine data from all monitoring systems
     */
    combineDashboardData(healthData, coverageData) {
        // Get security data
        const securityData = this.securityMonitor.getSecurityStatus();
        const securityScore = securityData.scanner.score || 0;
        
        // Calculate combined overall score
        const healthScore = healthData.overall || 0;
        const coverageScore = coverageData.overall || 0;
        
        // Weight health, coverage, and security for overall score
        const overallScore = Math.round((healthScore * 0.5) + (coverageScore * 0.2) + (securityScore * 0.3));
        
        this.dashboardData = {
            overall: overallScore,
            health: {
                score: healthScore,
                status: this.getHealthStatus(healthScore),
                components: healthData.components,
                metrics: healthData.metrics
            },
            coverage: {
                score: coverageScore,
                status: this.getCoverageStatus(coverageScore),
                metrics: coverageData.metrics || {},
                target: coverageData.target || 80,
                gap: (coverageData.target || 80) - coverageScore
            },
            security: {
                score: securityScore,
                status: this.getSecurityStatus(securityScore),
                metrics: securityData.metrics || {},
                vulnerabilities: securityData.vulnerabilities || 0,
                alerts: securityData.alerts || []
            },
            components: {
                ...healthData.components,
                testCoverage: {
                    score: coverageScore,
                    status: this.getCoverageStatus(coverageScore),
                    details: coverageData
                },
                security: {
                    score: securityScore,
                    status: this.getSecurityStatus(securityScore),
                    details: securityData
                }
            },
            metrics: {
                ...healthData.metrics,
                testCoverage: coverageData.metrics || {}
            },
            alerts: [],
            recommendations: [],
            trends: this.calculateTrends(),
            lastUpdate: new Date().toISOString()
        };
    }

    /**
     * Get health status from score
     */
    getHealthStatus(score) {
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
     * Get coverage status from score
     */
    getCoverageStatus(score) {
        if (score >= 80) {
            return 'excellent';
        }
        if (score >= 60) {
            return 'good';
        }
        if (score >= 40) {
            return 'fair';
        }
        if (score >= 20) {
            return 'poor';
        }
        return 'critical';
    }

    /**
     * Get security status from score
     */
    getSecurityStatus(score) {
        if (score >= 95) {
            return 'excellent';
        }
        if (score >= 85) {
            return 'very_good';
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
     * Generate consolidated insights
     */
    generateInsights() {
        const insights = [];
        
        // Overall health insight
        if (this.dashboardData.overall < 70) {
            insights.push({
                type: 'overall_health',
                severity: 'warning',
                title: 'System Health Needs Attention',
                message: `Overall health score is ${this.dashboardData.overall}/100`,
                recommendation: 'Address critical health issues to improve system stability'
            });
        }
        
        // Test coverage insight (critical issue)
        if (this.dashboardData.coverage.score < 50) {
            insights.push({
                type: 'test_coverage',
                severity: 'critical',
                title: 'Critical Test Coverage Gap',
                message: `Test coverage is only ${this.dashboardData.coverage.score}%`,
                recommendation: 'Implement comprehensive testing strategy immediately'
            });
        }
        
        // Health component insights
        Object.entries(this.dashboardData.components).forEach(([name, component]) => {
            if (component.score < 70 && component.status !== 'healthy') {
                insights.push({
                    type: 'component_health',
                    severity: 'warning',
                    component: name,
                    title: `${name} Health Issue`,
                    message: `${name} score is ${component.score}/100`,
                    recommendation: `Investigate and fix ${name} issues`
                });
            }
        });
        
        this.dashboardData.insights = insights;
    }

    /**
     * Check for alerts
     */
    checkAlerts() {
        const alerts = [];
        
        // Critical alerts
        if (this.dashboardData.overall < 50) {
            alerts.push({
                type: 'critical',
                severity: 'critical',
                message: 'System health is critically low',
                recommendation: 'Immediate attention required'
            });
        }
        
        // Test coverage alert (most critical)
        if (this.dashboardData.coverage.score < 30) {
            alerts.push({
                type: 'test_coverage',
                severity: 'critical',
                message: `Test coverage is critically low at ${this.dashboardData.coverage.score}%`,
                recommendation: 'Implement emergency testing strategy'
            });
        }
        
        // Component alerts
        Object.entries(this.dashboardData.components).forEach(([name, component]) => {
            if (component.status === 'error') {
                alerts.push({
                    type: 'component_error',
                    severity: 'critical',
                    component: name,
                    message: `${name} component error`,
                    recommendation: 'Fix component errors immediately'
                });
            } else if (component.score < 50) {
                alerts.push({
                    type: 'component_warning',
                    severity: 'warning',
                    component: name,
                    message: `${name} score is ${component.score}/100`,
                    recommendation: `Improve ${name} health metrics`
                });
            }
        });
        
        this.dashboardData.alerts = alerts;
    }

    /**
     * Calculate trends
     */
    calculateTrends() {
        // Get trends from both systems
        const healthTrends = this.healthMonitor.getHealthStatus().trends;
        const coverageTrends = this.coverageTracker.getCoverageReport().trends;
        
        return {
            health: healthTrends,
            coverage: coverageTrends,
            overall: this.calculateOverallTrend(healthTrends, coverageTrends)
        };
    }

    /**
     * Calculate overall trend
     */
    calculateOverallTrend(healthTrends, coverageTrends) {
        if (!healthTrends && !coverageTrends) {
            return null;
        }
        
        let trend = 'stable';
        let change = 0;
        
        if (healthTrends && healthTrends.change) {
            change += healthTrends.change * 0.7;
        }
        
        if (coverageTrends && coverageTrends.change) {
            change += coverageTrends.change * 0.3;
        }
        
        if (change > 5) {
            trend = 'improving';
        } else if (change < -5) {
            trend = 'declining';
        }
        
        return {
            trend,
            change: Math.round(change),
            confidence: 'medium'
        };
    }

    /**
     * Update dashboard data
     */
    updateDashboardData() {
        // Get latest data from both systems
        const healthData = this.healthMonitor.getHealthStatus();
        const coverageData = this.coverageTracker.getCoverageSummary();
        
        this.combineDashboardData(healthData, coverageData);
        this.generateInsights();
        this.checkAlerts();
    }

    /**
     * Get dashboard status
     */
    getDashboardStatus() {
        return {
            ...this.dashboardData,
            isRunning: this.isRunning,
            lastUpdate: this.dashboardData.lastUpdate,
            status: this.getOverallStatus()
        };
    }

    /**
     * Get overall status
     */
    getOverallStatus() {
        const score = this.dashboardData.overall;
        
        if (score >= 85) {
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
     * Get comprehensive health report
     */
    getHealthReport() {
        const status = this.getDashboardStatus();
        
        return {
            summary: {
                overall: status.overall,
                status: status.status,
                health: status.health.score,
                coverage: status.coverage.score,
                lastUpdate: status.lastUpdate,
                isRunning: status.isRunning
            },
            components: status.components,
            metrics: status.metrics,
            alerts: status.alerts,
            insights: status.insights,
            trends: status.trends,
            recommendations: this.getRecommendations(),
            actions: this.getRecommendedActions()
        };
    }

    /**
     * Get recommendations
     */
    getRecommendations() {
        const recommendations = [];
        
        // Test coverage recommendations (highest priority)
        if (this.dashboardData.coverage.score < 50) {
            recommendations.push({
                priority: 'critical',
                category: 'testing',
                title: 'Implement Comprehensive Testing Strategy',
                description: 'Test coverage is critically low and needs immediate attention',
                action: 'Start with unit tests for core components',
                estimatedEffort: 'high',
                impact: 'critical'
            });
        }
        
        // Health recommendations
        if (this.dashboardData.health.score < 70) {
            recommendations.push({
                priority: 'high',
                category: 'health',
                title: 'Improve System Health',
                description: 'System health metrics need improvement',
                action: 'Address health issues identified in components',
                estimatedEffort: 'medium',
                impact: 'high'
            });
        }
        
        // Component-specific recommendations
        Object.entries(this.dashboardData.components).forEach(([name, component]) => {
            if (component.score < 60 && component.status !== 'healthy') {
                recommendations.push({
                    priority: 'medium',
                    category: 'component',
                    title: `Fix ${name} Issues`,
                    description: `${name} has health issues`,
                    action: `Investigate and resolve ${name} problems`,
                    estimatedEffort: 'medium',
                    impact: 'medium'
                });
            }
        });
        
        return recommendations.sort((a, b) => {
            const priorityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    /**
     * Get recommended actions
     */
    getRecommendedActions() {
        const actions = [];
        const status = this.getDashboardStatus();
        
        // Critical actions
        if (status.overall < 50) {
            actions.push({
                priority: 'critical',
                action: 'Emergency System Recovery',
                description: 'System health is critically low',
                steps: [
                    'Address critical component failures',
                    'Implement emergency testing strategy',
                    'Stabilize system performance'
                ]
            });
        }
        
        // Test coverage actions (most critical)
        if (status.coverage.score < 30) {
            actions.push({
                priority: 'critical',
                action: 'Emergency Testing Implementation',
                description: 'Test coverage is critically low',
                steps: [
                    'Write unit tests for core components',
                    'Set up automated testing pipeline',
                    'Implement test-driven development practices'
                ]
            });
        }
        
        // Health improvement actions
        if (status.health.score < 70) {
            actions.push({
                priority: 'high',
                action: 'System Health Improvement',
                description: 'System health needs attention',
                steps: [
                    'Review component health metrics',
                    'Address performance issues',
                    'Fix configuration problems'
                ]
            });
        }
        
        return actions;
    }

    /**
     * Subscribe to dashboard events
     */
    subscribe(event, callback) {
        if (!this.subscribers.has(event)) {
            this.subscribers.set(event, []);
        }
        this.subscribers.get(event).push(callback);
    }

    /**
     * Unsubscribe from dashboard events
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
                    console.error('Error in dashboard event subscriber:', error);
                }
            });
        }
    }

    /**
     * Handle refresh error
     */
    handleRefreshError(error) {
        console.error('❌ Dashboard refresh error:', error);
        
        const alert = {
            type: 'dashboard_error',
            severity: 'critical',
            message: 'Dashboard refresh system error',
            recommendation: 'Restart dashboard monitoring system'
        };
        
        this.dashboardData.alerts = [alert];
        this.notifySubscribers('dashboard_error', { error, alert });
    }

    /**
     * Force refresh all components
     */
    async forceRefresh() {
        console.log('🔄 Forcing complete dashboard refresh...');
        
        try {
            // Force health check
            await this.healthMonitor.performHealthCheck();
            
            // Force coverage analysis
            await this.coverageTracker.analyzeCoverage();
            
            // Refresh dashboard
            await this.refreshDashboard();
            
            console.log('✅ Force refresh completed');
            
        } catch (error) {
            console.error('❌ Force refresh failed:', error);
            throw error;
        }
    }

    /**
     * Get component health details
     */
    getComponentHealth(componentName) {
        return this.dashboardData.components[componentName] || null;
    }

    /**
     * Get system metrics summary
     */
    getMetricsSummary() {
        return {
            overall: this.dashboardData.overall,
            health: this.dashboardData.health.score,
            coverage: this.dashboardData.coverage.score,
            components: Object.keys(this.dashboardData.components).length,
            alerts: this.dashboardData.alerts.length,
            recommendations: this.dashboardData.recommendations.length,
            lastUpdate: this.dashboardData.lastUpdate
        };
    }

    /**
     * Destroy health dashboard
     */
    destroy() {
        this.stop();
        this.healthMonitor.destroy();
        this.coverageTracker.destroy();
        this.subscribers.clear();
        console.log('🗑️ Health dashboard destroyed');
    }
}

export default HealthDashboard;
