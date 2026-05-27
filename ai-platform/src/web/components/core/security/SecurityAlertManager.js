/**
 * Security Alert Manager - Centralized alert management for security issues
 * Handles alert generation, prioritization, and notification
 */

export class SecurityAlertManager {
    constructor(options = {}) {
        this.options = {
            enableNotifications: options.enableNotifications !== false,
            enableLogging: options.enableLogging !== false,
            alertRetention: options.alertRetention || 100,
            notificationChannels: options.notificationChannels || ['console', 'dashboard'],
            alertPriorities: {
                critical: { priority: 1, color: '#dc3545', icon: '🔴' },
                high: { priority: 2, color: '#ffc107', icon: '🟡' },
                medium: { priority: 3, color: '#fd7e14', icon: '🟠' },
                low: { priority: 4, color: '#28a745', icon: '🟢' },
                info: { priority: 5, color: '#17a2b8', icon: 'ℹ️' }
            },
            ...options.alertPriorities
        };
        
        this.alerts = [];
        this.alertHistory = [];
        this.alertCounters = {
            total: 0,
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            info: 0
        };
        
        this.subscribers = new Map();
        this.notificationQueue = [];
        this.isProcessing = false;
        
        // Initialize alert management
        this.initializeAlertManagement();
    }

    /**
     * Initialize alert management
     */
    initializeAlertManager() {
        console.log('🚨 Initializing security alert manager...');
        
        // Set up alert processing queue
        this.startAlertProcessing();
        
        console.log('✅ Security alert manager initialized');
    }

    /**
     * Start alert processing queue
     */
    startAlertProcessing() {
        if (this.isProcessing) {
            return;
        }
        
        this.isProcessing = true;
        this.processAlertQueue();
    }

    /**
     * Stop alert processing queue
     */
    stopAlertProcessing() {
        this.isProcessing = false;
    }

    /**
     * Process alert queue
     */
    async processAlertQueue() {
        while (this.notificationQueue.length > 0 && this.isProcessing) {
            const alert = this.notificationQueue.shift();
            await this.processAlert(alert);
        }
        
        this.isProcessing = false;
    }

    /**
     * Add security alert
     */
    addAlert(alert) {
        // Validate alert structure
        const validatedAlert = this.validateAlert(alert);
        
        // Check if duplicate
        if (this.isDuplicateAlert(validatedAlert)) {
            console.log('⚠️ Duplicate alert detected, skipping:', validatedAlert.title);
            return;
        }
        
        // Add to queue
        this.notificationQueue.push(validatedAlert);
        
        // Start processing if not already running
        if (!this.isProcessing) {
            this.startAlertProcessing();
        }
        
        console.log(`🚨 Security alert added: ${validatedAlert.title}`);
    }

    /**
     * Validate alert structure
     */
    validateAlert(alert) {
        const requiredFields = ['type', 'severity', 'message', 'timestamp'];
        
        for (const field of requiredFields) {
            if (!alert[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        
        // Set defaults
        return {
            id: this.generateAlertId(alert),
            type: alert.type,
            severity: alert.severity || 'medium',
            message: alert.message,
            description: alert.description || '',
            recommendation: alert.recommendation || '',
            timestamp: alert.timestamp || new Date().toISOString(),
            url: alert.url || '',
            details: alert.details || {},
            acknowledged: false,
            resolved: false,
            resolvedAt: null,
            assignedTo: alert.assignedTo || 'security-team',
            priority: alert.priority || 'medium',
            category: alert.category || 'security',
            tags: alert.tags || []
        };
    }

    /**
     * Check if alert is duplicate
     */
    isDuplicateAlert(alert) {
        return this.alerts.some(existingAlert => 
            existingAlert.type === alert.type && 
            existingAlert.message === alert.message &&
            existingAlert.package === alert.package
        );
    }

    /**
     * Generate unique alert ID
     */
    generateAlertId(alert) {
        const base = `${alert.type}_${alert.message}`;
        return this.hashString(base);
    }

    /**
     * Simple string hash function
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Process individual alert
     */
    async processAlert(alert) {
        try {
            // Update counters
            this.updateAlertCounters(alert);
            
            // Add to alerts list
            this.alerts.push(alert);
            
            // Add to history
            this.alertHistory.push(alert);
            
            // Keep only recent alerts
            if (this.alertHistory.length > this.options.alertRetention) {
                this.alertHistory = this.alertHistory.slice(-this.options.alertRetention);
            }
            
            // Send notifications
            await this.sendNotifications(alert);
            
            // Log alert
            this.logAlert(alert);
            
            // Notify subscribers
            this.notifySubscribers('alert_processed', alert);
            
            console.log(`🚨 Processed security alert: ${alert.title}`);
            
        } catch (error) {
            console.error('❌ Error processing alert:', error);
            this.notifySubscribers('alert_error', { error, alert });
        }
    }

    /**
     * Update alert counters
     */
    updateAlertCounters(alert) {
        this.alertCounters.total++;
        this.alertCounters[alert.severity]++;
    }

    /**
     * Send notifications for alert
     */
    async sendNotifications(alert) {
        if (!this.options.enableNotifications) {
            return;
        }
        
        const priority = this.options.alertPriorities[alert.severity];
        
        // Send to each configured notification channel
        for (const channel of this.options.notificationChannels) {
            await this.sendNotification(channel, alert, priority);
        }
    }

    /**
     * Send notification to specific channel
     */
    async sendNotification(channel, alert, priority) {
        switch (channel) {
        case 'console':
            this.sendConsoleNotification(alert, priority);
            break;
        case 'dashboard':
            this.sendDashboardNotification(alert, priority);
            break;
        case 'email':
            this.sendEmailNotification(alert, priority);
            break;
        case 'slack':
            this.sendSlackNotification(alert, priority);
            break;
        default:
            console.log(`Unknown notification channel: ${channel}`);
        }
    }

    /**
     * Send console notification
     */
    sendConsoleNotification(alert, priority) {
        const priorityInfo = this.options.alertPriorities[alert.severity];
        const timestamp = new Date().toLocaleString();
        
        console.log(
            `${priorityInfo.icon} [${timestamp}] ${priorityInfo.color}${priorityInfo.icon} ${alert.title}\n` +
            `${priorityInfo.color} Message: ${alert.message}\n` +
            `${priorityInfo.color} Recommendation: ${alert.recommendation}\n` +
            `${priorityInfo.color} Details: ${JSON.stringify(alert.details, null, 2)}`
        );
    }

    /**
     * Send dashboard notification
     */
    sendDashboardNotification(alert, priority) {
        // In a real implementation, this would update the UI
        console.log(`🎯 Dashboard notification: ${alert.title} (${alert.severity})`);
        
        // Store for dashboard display
        if (window.dashboard && window.dashboard.showNotification) {
            window.dashboard.showNotification(
                alert.title,
                alert.message,
                alert.severity,
                alert.recommendation
            );
        }
    }

    /**
     * Send email notification
     */
    sendEmailNotification(alert, priority) {
        // In a real implementation, this would send an email
        console.log(`📧 Email notification: ${alert.title} (${alert.severity})`);
        
        // Store for email sending
        if (this.emailQueue) {
            this.emailQueue.push({
                alert,
                priority,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Send Slack notification
     */
    sendSlackNotification(alert, priority) {
        // In a real implementation, this would send a Slack message
        console.log(`💬 Slack notification: ${alert.title} (${alert.severity})`);
        
        // Store for Slack sending
        if (this.slackQueue) {
            this.slackQueue.push({
                alert,
                priority,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Log alert
     */
    logAlert(alert) {
        if (!this.options.enableLogging) {
            return;
        }
        
        const timestamp = new Date().toISOString();
        const severity = alert.severity.toUpperCase();
        
        console.log(
            `🚨 [${timestamp}] ${severity} SECURITY ALERT: ${alert.title}\n` +
            `Message: ${alert.message}\n` +
            `Recommendation: ${alert.recommendation}\n` +
            `Package: ${alert.details.package || 'unknown'}\n` +
            `Details: ${JSON.stringify(alert.details, null, 2)}`
        );
    }

    /**
     * Get current alerts
     */
    getCurrentAlerts() {
        return this.alerts.slice(-20); // Return last 20 alerts
    }

    /**
     * Get alert by severity
     */
    getAlertsBySeverity(severity) {
        return this.alerts.filter(alert => alert.severity === severity);
    }

    /**
     * Get alert summary
     */
    getAlertSummary() {
        return {
            total: this.alertCounters.total,
            critical: this.alertCounters.critical,
            high: this.alertCounters.high,
            medium: this.alertCounters.medium,
            low: this.alertCounters.low,
            info: this.alertCounters.info,
            active: this.alerts.filter(alert => !alert.acknowledged).length,
            acknowledged: this.alerts.filter(alert => alert.acknowledged).length,
            resolved: this.alerts.filter(alert => alert.resolved).length
        };
    }

    /**
     * Get alert history
     */
    getAlertHistory(limit = 100) {
        return this.alertHistory.slice(-limit);
    }

    /**
     * Acknowledge alert
     */
    acknowledgeAlert(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.acknowledged = true;
            alert.acknowledgedAt = new Date().toISOString();
            
            // Notify subscribers
            this.notifySubscribers('alert_acknowledged', alert);
            
            console.log(`✅ Alert acknowledged: ${alert.title}`);
        }
    }

    /**
     * Resolve alert
     */
    resolveAlert(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.resolved = true;
            alert.resolvedAt = new Date().toISOString();
            
            // Notify subscribers
            this.notifySubscribers('alert_resolved', alert);
            
            console.log(`✅ Alert resolved: ${alert.title}`);
        }
    }

    /**
     * Get alerts by category
     */
    getAlertsByCategory(category) {
        return this.alerts.filter(alert => alert.category === category);
    }

    /**
     * Get alerts by priority
     */
    getAlertsByPriority(priority) {
        return this.alerts.filter(alert => alert.priority === priority);
    }

    /**
     * Get unacknowledged alerts
     */
    getUnacknowledgedAlerts() {
        return this.alerts.filter(alert => !alert.acknowledged);
    }

    /**
     * Get unresolved alerts
     */
    getUnresolvedAlerts() {
        return this.alerts.filter(alert => !alert.resolved);
    }

    /**
     * Clear all alerts
     */
    clearAllAlerts() {
        this.alerts = [];
        this.alertHistory = [];
        this.notificationQueue = [];
        this.resetAlertCounters();
        
        console.log('🗑️ All security alerts cleared');
        
        // Notify subscribers
        this.notifySubscribers('alerts_cleared', {});
    }

    /**
     * Reset alert counters
     */
    resetAlertCounters() {
        this.alertCounters = {
            total: 0,
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            info: 0
        };
    }

    /**
     * Get alert statistics
     */
    getAlertStatistics() {
        const now = new Date();
        const recentAlerts = this.alerts.filter(alert => 
            (now - new Date(alert.timestamp)) < 24 * 60 * 60 * 1000 // Last 24 hours
        );
        
        return {
            total: this.alertCounters.total,
            critical: this.alertCounters.critical,
            high: this.alertCounters.high,
            medium: this.alertCounters.medium,
            low: this.alertCounters.low,
            info: this.alertCounters.info,
            recent: recentAlerts.length,
            oldestAlert: this.alertHistory.length > 0 ? this.alertHistory[0].timestamp : null,
            newestAlert: this.alertHistory.length > 0 ? this.alertHistory[this.alertHistory.length - 1].timestamp : null,
            trends: this.calculateAlertTrends()
        };
    }

    /**
     * Calculate alert trends
     */
    calculateAlertTrends() {
        const now = new Date();
        const recentAlerts = this.alerts.filter(alert => 
            (now - new Date(alert.timestamp)) < 7 * 24 * 60 * 60 * 1000 // Last 7 days
        );
        
        if (recentAlerts.length < 2) {
            return null;
        }
        
        const severityTrends = {
            critical: this.calculateSeverityTrends(recentAlerts, 'critical'),
            high: this.calculateSeverityTrends(recentAlerts, 'high'),
            medium: this.calculateSeverityTrends(recentAlerts, 'medium'),
            low: this.calculateSeverityTrends(recentAlerts, 'low'),
            info: this.calculateSeverityTrends(recentAlerts, 'info')
        };
        
        return {
            overall: this.calculateOverallTrend(severityTrends),
            severity: severityTrends,
            dataPoints: recentAlerts,
            period: '7 days',
            confidence: 'medium'
        };
    }

    /**
     * Calculate severity trends
     */
    calculateSeverityTrends(alerts, severity) {
        const severityAlerts = alerts.filter(alert => alert.severity === severity);
        
        if (severityAlerts.length < 2) {
            return null;
        }
        
        const counts = severityAlerts.map(alert => 1);
        const trend = counts[counts.length - 1] - counts[0];
        
        return {
            trend: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable',
            change: trend,
            dataPoints: severityAlerts.length,
            average: counts.reduce((sum, count) => sum + count, 0) / counts.length
        };
    }

    /**
     * Calculate overall trend
     */
    calculateOverallTrend(severityTrends) {
        const trends = Object.entries(severityTrends);
        
        let overallTrend = 'stable';
        let totalChange = 0;
        let totalWeight = 0;
        
        for (const [severity, trend] of trends) {
            const weight = this.getSeverityWeight(severity);
            totalWeight += weight;
            totalChange += trend.change * weight;
        }
        
        if (totalWeight > 0) {
            overallTrend = totalChange / totalWeight;
            overallTrend = overallTrend > 0.05 ? 'improving' : overallTrend < -0.05 ? 'declining' : 'stable';
        }
        
        return {
            trend: overallTrend,
            change: Math.round(totalChange),
            severity: severityTrends,
            confidence: 'medium'
        };
    }

    /**
     * Get severity weight
     */
    getSeverityWeight(severity) {
        const weights = {
            critical: 4,
            high: 3,
            medium: 2,
            low: 1,
            info: 0.5
        };
        
        return weights[severity] || 1;
    }

    /**
     * Subscribe to alert events
     */
    subscribe(event, callback) {
        if (!this.subscribers.has(event)) {
            this.subscribers.set(event, []);
        }
        this.subscribers.get(event).push(callback);
    }

    /**
     * Unsubscribe from alert events
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
                    console.error('Error in alert event subscriber:', error);
                }
            });
        }
    }

    /**
     * Create alert template
     */
    createAlertTemplate(type, severity, message, options = {}) {
        return {
            type,
            severity: severity || 'medium',
            title: options.title || `Security ${type}`,
            message: message,
            description: options.description || '',
            recommendation: options.recommendation || 'Address security issue',
            url: options.url || '',
            details: options.details || {},
            timestamp: new Date().toISOString(),
            acknowledged: false,
            resolved: false,
            resolvedAt: null,
            assignedTo: options.assignedTo || 'security-team',
            priority: options.priority || 'medium',
            category: options.category || 'security',
            tags: options.tags || []
        };
    }

    /**
     * Bulk create alerts
     */
    createAlerts(alerts) {
        const createdAlerts = [];
        
        for (const alert of alerts) {
            const createdAlert = this.createAlertTemplate(
                alert.type,
                alert.severity,
                alert.message,
                alert.options
            );
            createdAlerts.push(createdAlert);
        }
        
        return createdAlerts;
    }

    /**
     * Get alert by ID
     */
    getAlertById(alertId) {
        return this.alerts.find(alert => alert.id === alertId);
    }

    /**
     * Destroy alert manager
     */
    destroy() {
        this.stopAlertProcessing();
        this.clearAllAlerts();
        this.subscribers.clear();
        console.log('🗑️ Security alert manager destroyed');
    }
}

export default SecurityAlertManager;
