/**
 * Security Monitor - Automated security monitoring and alerting
 * Provides continuous security monitoring with proactive alerts
 */

import { SecurityScanner } from './SecurityScanner.js';

export class SecurityMonitor {
    constructor(options = {}) {
        this.options = {
            scanInterval: options.scanInterval || 3600000, // 1 hour
            alertThresholds: options.alertThresholds || {
                vulnerabilities: 0,
                highSeverityVulns: 0,
                criticalSeverityVulns: 0,
                scoreThreshold: 70
            },
            enableAlerts: options.enableAlerts !== false,
            enableMonitoring: options.enableMonitoring !== false,
            enableTrends: options.enableTrends !== false,
            ...options
        };
        
        this.scanner = new SecurityScanner({
            auditTimeout: options.auditTimeout || 30000,
            cacheResults: true,
            cacheTimeout: options.cacheTimeout || 300000
        });
        
        this.monitoringData = {
            isMonitoring: false,
            lastScan: null,
            alerts: [],
            trends: null,
            metrics: {
                scanCount: 0,
                totalScans: 0,
                successfulScans: 0,
                failedScans: 0,
                averageScanTime: 0,
                lastScanTime: null
            }
        };
        
        this.monitoringTimer = null;
        this.subscribers = new Map();
        this.alertHistory = [];
        
        // Initialize monitoring
        this.initializeMonitoring();
    }

    /**
     * Initialize security monitoring
     */
    initializeMonitoring() {
        console.log('🔒 Initializing security monitoring...');
        
        // Set up event listeners
        this.setupEventListeners();
        
        console.log('✅ Security monitor initialized');
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Listen for scan completion
        this.scanner.subscribe('scan_completed', (data) => {
            this.onScanCompleted(data);
        });
        
        // Listen for scan errors
        this.scanner.subscribe('scan_error', (data) => {
            this.onScanError(data);
        });
    }

    /**
     * Start security monitoring
     */
    startMonitoring() {
        if (this.monitoringData.isMonitoring) {
            console.warn('Security monitoring is already active');
            return;
        }

        console.log('🔒 Starting security monitoring...');
        this.monitoringData.isMonitoring = true;
        
        // Run initial scan
        this.performSecurityCheck();
        
        // Set up periodic monitoring
        this.monitoringTimer = setInterval(() => {
            this.performSecurityCheck();
        }, this.options.scanInterval);
        
        console.log('✅ Security monitoring started');
    }

    /**
     * Stop security monitoring
     */
    stopMonitoring() {
        if (!this.monitoringData.isMonitoring) {
            console.warn('Security monitoring is not active');
            return;
        }

        console.log('🔒 Stopping security monitoring...');
        this.monitoringData.isMonitoring = false;
        
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
            this.monitoringTimer = null;
        }
        
        console.log('✅ Security monitoring stopped');
    }

    /**
     * Perform security check
     */
    async performSecurityCheck() {
        const startTime = performance.now();
        
        try {
            console.log('🔍 Performing security check...');
            
            // Call Python API for security scan (single source of truth)
            const scanResults = await this.fetchSecurityScanFromAPI();
            
            // Update metrics
            this.updateMetrics(scanResults, startTime);
            
            // Check for alerts
            this.checkForAlerts(scanResults);
            
            // Update trends
            if (this.options.enableTrends) {
                this.updateTrends();
            }
            
            // Notify subscribers
            this.notifySubscribers('security_check_completed', this.monitoringData);
            
            const duration = performance.now() - startTime;
            console.log(`✅ Security check completed in ${duration.toFixed(2)}ms`);
            
        } catch (error) {
            console.error('❌ Security check failed:', error);
            this.handleSecurityError(error);
        }
    }

    /**
     * Fetch security scan results from Python API
     */
    async fetchSecurityScanFromAPI() {
        try {
            const response = await fetch('/api/analysis/security');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            // Transform API response to match expected format
            return {
                vulnerabilities: data.dependencyVulnerabilities || [],
                metadata: {
                    critical: data.severityCounts?.dependencies?.critical || 0,
                    high: data.severityCounts?.dependencies?.high || 0,
                    medium: data.severityCounts?.dependencies?.medium || 0,
                    low: data.severityCounts?.dependencies?.low || 0
                },
                score: data.securityScore || 100,
                timestamp: data.timestamp,
                scanner: 'python-backend'
            };
        } catch (error) {
            console.error('Failed to fetch security scan from API, falling back to local scanner:', error);
            // Fallback to local scanner if API fails
            return await this.scanner.scanDependencies();
        }
    }

    /**
     * Handle scan completion
     */
    onScanCompleted(scanResults) {
        this.monitoringData.lastScan = scanResults;
        this.monitoringData.metrics.successfulScans++;
        this.monitoringData.metrics.totalScans++;
    }

    /**
     * Handle scan error
     */
    onScanError(error) {
        this.monitoringData.metrics.failedScans++;
        this.monitoringData.metrics.totalScans++;
        
        const alert = {
            type: 'scan_error',
            severity: 'critical',
            message: 'Security scan failed',
            recommendation: 'Check npm installation and network connectivity',
            timestamp: new Date().toISOString(),
            details: {
                error: error.message,
                stack: error.stack
            }
        };
        
        this.alerts.push(alert);
        this.notifySubscribers('security_alert', alert);
    }

    /**
     * Update monitoring metrics
     */
    updateMetrics(scanResults, startTime) {
        const duration = performance.now() - startTime;
        
        this.monitoringData.metrics.scanCount++;
        this.monitoringData.metrics.totalScans++;
        this.monitoring.metrics.lastScanTime = duration;
        
        // Calculate average scan time
        const totalTime = this.monitoring.metrics.scanCount * duration;
        this.monitoringData.metrics.averageScanTime = totalTime / this.monitoring.metrics.scanCount;
    }

    /**
     * Check for security alerts
     */
    checkForAlerts(scanResults) {
        const alerts = [];
        
        // Check vulnerability thresholds
        if (scanResults.vulnerabilities.length > this.options.alertThresholds.vulnerabilities) {
            alerts.push({
                type: 'vulnerability_count',
                severity: 'high',
                message: `Security scan found ${scanResults.vulnerabilities.length} vulnerabilities`,
                recommendation: 'Review and address security vulnerabilities',
                timestamp: new Date().toISOString()
            });
        }
        
        // Check severity thresholds
        if (scanResults.metadata.critical > this.options.alertThresholds.criticalSeverityVulns) {
            alerts.push({
                type: 'critical_vulnerabilities',
                severity: 'critical',
                message: `${scanResults.metadata.critical} critical vulnerabilities detected`,
                recommendation: 'Immediately address critical security issues',
                timestamp: new Date().toISOString()
            });
        }
        
        if (scanResults.metadata.high > this.options.alertThresholds.highSeverityVulns) {
            alerts.push({
                type: 'high_vulnerabilities',
                severity: 'high',
                message: `${scanResults.metadata.high} high severity vulnerabilities detected`,
                recommendation: 'Upgrade affected packages as soon as possible',
                timestamp: new Date().toISOString()
            });
        }
        
        // Check score threshold
        if (scanResults.score < this.options.alertThresholds.scoreThreshold) {
            alerts.push({
                type: 'low_security_score',
                severity: 'medium',
                message: `Security score is ${scanResults.score}/100`,
                recommendation: 'Improve security posture by addressing vulnerabilities',
                timestamp: new Date().toISOString()
            });
        }
        
        // Check for new vulnerabilities
        const newVulns = this.detectNewVulnerabilities(scanResults);
        if (newVulns.length > 0) {
            alerts.push({
                type: 'new_vulnerabilities',
                severity: 'high',
                message: `${newVulns.length} new vulnerabilities detected`,
                recommendation: 'Review and address new security issues',
                details: newVulns,
                timestamp: new Date().toISOString()
            });
        }
        
        this.alerts = alerts;
        this.alertHistory = [...this.alertHistory, ...alerts];
        
        // Keep only last 100 alerts
        if (this.alertHistory.length > 100) {
            this.alertHistory = this.alertHistory.slice(-100);
        }
        
        // Notify subscribers
        alerts.forEach(alert => {
            this.notifySubscribers('security_alert', alert);
        });
    }

    /**
     * Detect new vulnerabilities
     */
    detectNewVulnerabilities(currentScan) {
        if (!this.monitoringData.lastScan) {
            return [];
        }
        
        const previousVulns = this.monitoringData.lastScan.vulnerabilities;
        const currentVulns = currentScan.vulnerabilities;
        
        // Find vulnerabilities that weren't in the previous scan
        const newVulns = currentVulns.filter(current => 
            !previousVulns.some(previous => 
                current.package === previous.package && 
                current.version === previous.version
            )
        );
        
        return newVulns;
    }

    /**
     * Update security trends
     */
    updateTrends() {
        const status = this.scanner.getSecurityStatus();
        this.monitoringData.trends = status.trends;
        
        // Check for trend alerts
        if (status.trends && status.trends.trend === 'declining') {
            const alert = {
                type: 'security_trend',
                severity: 'warning',
                message: `Security score is declining (${status.trends.change} points)`,
                recommendation: 'Investigate and address security issues',
                timestamp: new Date().toISOString()
            };
            
            this.alerts.push(alert);
            this.notifySubscribers('security_alert', alert);
        }
    }

    /**
     * Get current security status
     */
    getSecurityStatus() {
        return {
            isMonitoring: this.monitoringData.isMonitoring,
            lastScan: this.monitoringData.lastScan,
            alerts: this.alerts,
            metrics: this.monitoringData.metrics,
            trends: this.monitoringData.trends,
            scanner: this.scanner.getSecurityStatus()
        };
    }

    /**
     * Get comprehensive security report
     */
    getSecurityReport() {
        const status = this.getSecurityStatus();
        const scannerReport = this.scanner.getVulnerabilityReport();
        
        return {
            summary: {
                isMonitoring: status.isMonitoring,
                overall: status.scanner.score,
                status: status.scanner.status,
                lastScan: status.lastScan?.timestamp,
                alerts: status.alerts.length,
                recommendations: status.scanner.recommendations?.length || 0
            },
            vulnerabilities: scannerReport.vulnerabilities,
            metadata: scannerReport.metadata,
            recommendations: scannerReport.recommendations,
            trends: status.trends,
            metrics: status.metrics,
            alerts: status.alerts,
            scanner: {
                cacheStats: this.scanner.getCacheStats(),
                lastScan: status.lastScan,
                isScanning: this.scanner.isScanning
            },
            monitoring: {
                interval: this.options.scanInterval,
                thresholds: this.options.alertThresholds,
                enabled: this.options.enableAlerts,
                trends: this.options.enableTrends
            }
        };
    }

    /**
     * Get vulnerability summary
     */
    getVulnerabilitySummary() {
        const status = this.getSecurityStatus();
        return {
            total: status.scanner.vulnerabilities?.length || 0,
            critical: status.scanner.metadata?.critical || 0,
            high: status.scanner.metadata?.high || 0,
            medium: status.scanner.metadata?.medium || 0,
            low: status.scanner.metadata?.low || 0,
            info: status.scanner.metadata?.info || 0,
            status: status.scanner.status,
            score: status.scanner.score,
            lastScan: status.lastScan?.timestamp
        };
    }

    /**
     * Get security metrics
     */
    getSecurityMetrics() {
        return {
            ...this.monitoringData.metrics,
            alerts: {
                total: this.alerts.length,
                critical: this.alerts.filter(a => a.severity === 'critical').length,
                high: this.alerts.filter(a => a.severity === 'high').length,
                medium: this.alerts.filter(a => a.severity === 'medium').length,
                low: this.alerts.filter(a => a.severity === 'low').length,
                info: this.alerts.filter(a => a.severity === 'info').length
            },
            scanner: this.scanner.getCacheStats(),
            monitoring: {
                interval: this.options.scanInterval,
                enabled: this.options.enableMonitoring,
                alerts: this.options.enableAlerts
            }
        };
    }

    /**
     * Get alert history
     */
    getAlertHistory(limit = 50) {
        return this.alertHistory.slice(-limit);
    }

    /**
     * Clear alerts
     */
    clearAlerts() {
        this.alerts = [];
        console.log('🗑️ Security alerts cleared');
    }

    /**
     * Subscribe to security events
     */
    subscribe(event, callback) {
        if (!this.subscribers.has(event)) {
            this.subscribers.set(event, []);
        }
        this.subscribers.get(event).push(callback);
    }

    /**
     * Unsubscribe from security events
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
                    console.error('Error in security event subscriber:', error);
                }
            });
        }
    }

    /**
     * Handle security error
     */
    handleSecurityError(error) {
        console.error('❌ Security monitoring error:', error);
        
        const alert = {
            type: 'monitoring_error',
            severity: 'critical',
            message: 'Security monitoring system error',
            recommendation: 'Restart security monitoring system',
            timestamp: new Date().toISOString(),
            details: {
                error: error.message,
                stack: error.stack
            }
        };
        
        this.alerts.push(alert);
        this.notifySubscribers('security_error', { error, alert });
    }

    /**
     * Force security scan
     */
    async forceSecurityScan() {
        console.log('🔄 Forcing security scan...');
        
        try {
            await this.performSecurityCheck();
            console.log('✅ Force security scan completed');
            
            return this.getSecurityReport();
            
        } catch (error) {
            console.error('❌ Force security scan failed:', error);
            throw error;
        }
    }

    /**
     * Update monitoring configuration
     */
    updateConfiguration(newOptions) {
        this.options = { ...this.options, ...newOptions };
        
        // Update scanner configuration
        this.scanner.options = { ...this.scanner.options, ...newOptions };
        
        // Restart monitoring if intervals changed
        if (newOptions.scanInterval && newOptions.scanInterval !== this.options.scanInterval) {
            if (this.monitoringData.isMonitoring) {
                this.stopMonitoring();
                this.startMonitoring();
            }
        }
        
        console.log('✅ Security monitoring configuration updated');
    }

    /**
     * Get monitoring configuration
     */
    getMonitoringConfiguration() {
        return {
            scanInterval: this.options.scanInterval,
            alertThresholds: this.options.alertThresholds,
            enableAlerts: this.options.enableAlerts,
            enableMonitoring: this.options.enableMonitoring,
            enableTrends: this.options.enableTrends
        };
    }

    /**
     * Destroy security monitor
     */
    destroy() {
        this.stopMonitoring();
        this.scanner.destroy();
        this.subscribers.clear();
        console.log('🗑️ Security monitor destroyed');
    }
}

export default SecurityMonitor;
