/**
 * Performance Monitoring System
 * 
 * Real-time performance monitoring with alerts,
 * trend analysis, and comprehensive metrics tracking
 */

class PerformanceMonitor {
  constructor(options = {}) {
    this.options = options;
    this.metrics = new Map();
    this.alerts = new Map();
    this.thresholds = new Map();
    this.history = [];
    this.maxHistory = options.maxHistory || 1000;
    this.isInitialized = false;
    this.monitoringInterval = options.monitoringInterval || 30000; // 30 seconds
    this.alertThresholds = {
      response_time: 1000, // 1 second
      memory_usage: 80, // 80%
      cpu_usage: 80, // 80%
      error_rate: 5, // 5%
      throughput: 100 // 100 requests per second
    };
    
    this.initializeMetrics();
    this.initializeThresholds();
    console.log('[PERFORMANCE_MONITOR] Performance monitor initialized');
  }

  // Initialize performance metrics
  initializeMetrics() {
    // Response time metric
    this.addMetric('response_time', {
      description: 'Response time in milliseconds',
      unit: 'ms',
      type: 'duration',
      aggregation: 'average',
      thresholds: {
        excellent: 100,
        good: 250,
        acceptable: 500,
        poor: 1000,
        critical: 2000
      }
    });

    // Memory usage metric
    this.addMetric('memory_usage', {
      description: 'Memory usage percentage',
      unit: '%',
      type: 'percentage',
      aggregation: 'average',
      thresholds: {
        excellent: 60,
        good: 70,
        acceptable: 80,
        poor: 90,
        critical: 95
      }
    });

    // CPU usage metric
    this.addMetric('cpu_usage', {
      description: 'CPU usage percentage',
      unit: '%',
      type: 'percentage',
      aggregation: 'average',
      thresholds: {
        excellent: 50,
        good: 60,
        acceptable: 70,
        poor: 80,
        critical: 90
      }
    });

    // Error rate metric
    this.addMetric('error_rate', {
      description: 'Error rate percentage',
      unit: '%',
      type: 'percentage',
      aggregation: 'average',
      thresholds: {
        excellent: 1,
        good: 2,
        acceptable: 5,
        poor: 10,
        critical: 20
      }
    });

    // Throughput metric
    this.addMetric('throughput', {
      description: 'Requests per second',
      unit: 'req/s',
      type: 'rate',
      aggregation: 'sum',
      thresholds: {
        excellent: 200,
        good: 150,
        acceptable: 100,
        poor: 50,
        critical: 25
      }
    });

    // Uptime metric
    this.addMetric('uptime', {
      description: 'System uptime percentage',
      unit: '%',
      type: 'percentage',
      aggregation: 'average',
      thresholds: {
        excellent: 99.9,
        good: 99.5,
        acceptable: 99.0,
        poor: 98.0,
        critical: 95.0
      }
    });

    console.log(`[PERFORMANCE_MONITOR] Initialized ${this.metrics.size} performance metrics`);
  }

  // Initialize alert thresholds
  initializeThresholds() {
    // Response time alerts
    this.addAlertThreshold('response_time', {
      warning: 500,
      critical: 1000,
      duration: 300000, // 5 minutes
      message: 'Response time exceeds threshold'
    });

    // Memory usage alerts
    this.addAlertThreshold('memory_usage', {
      warning: 80,
      critical: 90,
      duration: 300000, // 5 minutes
      message: 'Memory usage exceeds threshold'
    });

    // CPU usage alerts
    this.addAlertThreshold('cpu_usage', {
      warning: 70,
      critical: 85,
      duration: 300000, // 5 minutes
      message: 'CPU usage exceeds threshold'
    });

    // Error rate alerts
    this.addAlertThreshold('error_rate', {
      warning: 5,
      critical: 10,
      duration: 180000, // 3 minutes
      message: 'Error rate exceeds threshold'
    });

    // Throughput alerts
    this.addAlertThreshold('throughput', {
      warning: 50,
      critical: 25,
      duration: 300000, // 5 minutes
      message: 'Throughput below threshold'
    });

    console.log(`[PERFORMANCE_MONITOR] Initialized ${this.thresholds.size} alert thresholds`);
  }

  // Add performance metric
  addMetric(name, metric) {
    this.metrics.set(name, {
      ...metric,
      history: [],
      current: 0,
      trend: 'stable',
      lastUpdated: null
    });
    console.log(`[PERFORMANCE_MONITOR] Added performance metric: ${name}`);
  }

  // Add alert threshold
  addAlertThreshold(name, threshold) {
    this.thresholds.set(name, {
      ...threshold,
      active: false,
      lastTriggered: null,
      triggerCount: 0
    });
    console.log(`[PERFORMANCE_MONITOR] Added alert threshold: ${name}`);
  }

  // Initialize monitor
  async initialize() {
    if (this.isInitialized) {
      console.log('[PERFORMANCE_MONITOR] Performance monitor already initialized');
      return;
    }

    try {
      // Start monitoring
      this.startMonitoring();
      
      this.isInitialized = true;
      console.log('[PERFORMANCE_MONITOR] Performance monitor initialized successfully');
      
    } catch (error) {
      console.error('[PERFORMANCE_MONITOR] Failed to initialize:', error.message);
      throw error;
    }
  }

  // Start monitoring
  startMonitoring() {
    if (this.monitoringIntervalId) {
      clearInterval(this.monitoringIntervalId);
    }

    this.monitoringIntervalId = setInterval(() => {
      this.collectMetrics();
    }, this.monitoringInterval);

    console.log(`[PERFORMANCE_MONITOR] Monitoring started (${this.monitoringInterval}ms interval)`);
  }

  // Stop monitoring
  stopMonitoring() {
    if (this.monitoringIntervalId) {
      clearInterval(this.monitoringIntervalId);
      this.monitoringIntervalId = null;
    }
    
    console.log('[PERFORMANCE_MONITOR] Monitoring stopped');
  }

  // Collect performance metrics
  async collectMetrics() {
    try {
      const timestamp = new Date().toISOString();
      const metrics = {};

      // Collect each metric
      this.metrics.forEach((metric, name) => {
        const value = this.collectMetricValue(name);
        metrics[name] = value;
        
        // Update metric history
        metric.history.push(value);
        metric.current = value;
        metric.trend = this.calculateTrend(metric.history);
        metric.lastUpdated = timestamp;
        
        // Keep only max history
        if (metric.history.length > this.maxHistory) {
          metric.history = metric.history.slice(-this.maxHistory);
        }
      });

      // Check for alerts
      this.checkAlerts(metrics);

      // Store in history
      this.history.push({
        timestamp,
        metrics
      });

      // Keep only max history
      if (this.history.length > this.maxHistory) {
        this.history = this.history.slice(-this.maxHistory);
      }

    } catch (error) {
      console.error('[PERFORMANCE_MONITOR] Error collecting metrics:', error.message);
    }
  }

  // Collect metric value
  collectMetricValue(metricName) {
    switch (metricName) {
      case 'response_time':
        return this.collectResponseTime();
      case 'memory_usage':
        return this.collectMemoryUsage();
      case 'cpu_usage':
        return this.collectCPUUsage();
      case 'error_rate':
        return this.collectErrorRate();
      case 'throughput':
        return this.collectThroughput();
      case 'uptime':
        return this.collectUptime();
      default:
        return 0;
    }
  }

  // Collect response time
  collectResponseTime() {
    // Mock implementation - would integrate with actual monitoring
    return 100 + Math.random() * 400; // 100-500ms
  }

  // Collect memory usage
  collectMemoryUsage() {
    // Mock implementation - would integrate with actual monitoring
    return 60 + Math.random() * 30; // 60-90%
  }

  // Collect CPU usage
  collectCPUUsage() {
    // Mock implementation - would integrate with actual monitoring
    return 40 + Math.random() * 40; // 40-80%
  }

  // Collect error rate
  collectErrorRate() {
    // Mock implementation - would integrate with actual monitoring
    return 1 + Math.random() * 4; // 1-5%
  }

  // Collect throughput
  collectThroughput() {
    // Mock implementation - would integrate with actual monitoring
    return 150 + Math.random() * 100; // 150-250 req/s
  }

  // Collect uptime
  collectUptime() {
    // Mock implementation - would integrate with actual monitoring
    return 99.5 + Math.random() * 0.4; // 99.5-99.9%
  }

  // Check for alerts
  checkAlerts(metrics) {
    this.thresholds.forEach((threshold, name) => {
      const value = metrics[name];
      if (value === undefined) return;

      const alert = this.checkThreshold(name, value, threshold);
      if (alert) {
        this.triggerAlert(alert);
      }
    });
  }

  // Check threshold
  checkThreshold(metricName, value, threshold) {
    let severity = null;

    if (value >= threshold.critical) {
      severity = 'critical';
    } else if (value >= threshold.warning) {
      severity = 'warning';
    }

    if (severity) {
      return {
        type: metricName,
        severity,
        value,
        threshold: severity === 'critical' ? threshold.critical : threshold.warning,
        message: threshold.message,
        timestamp: new Date().toISOString()
      };
    }

    return null;
  }

  // Trigger alert
  triggerAlert(alert) {
    const threshold = this.thresholds.get(alert.type);
    if (threshold) {
      threshold.active = true;
      threshold.lastTriggered = alert.timestamp;
      threshold.triggerCount++;
    }

    // Store alert
    this.alerts.set(`${alert.type}_${alert.timestamp}`, alert);

    console.log(`[PERFORMANCE_MONITOR] Alert triggered: ${alert.type} - ${alert.message} (${alert.value})`);
  }

  // Calculate trend from history
  calculateTrend(history) {
    if (history.length < 2) return 'stable';
    
    const recent = history.slice(-5);
    const older = history.slice(-10, -5);
    
    if (older.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((sum, value) => sum + value, 0) / recent.length;
    const olderAvg = older.reduce((sum, value) => sum + value, 0) / older.length;
    
    const change = recentAvg - olderAvg;
    
    if (change > 5) return 'improving';
    if (change < -5) return 'declining';
    return 'stable';
  }

  // Get performance statistics
  getStats() {
    const currentMetrics = {};
    const metricStats = {};
    
    this.metrics.forEach((metric, name) => {
      currentMetrics[name] = metric.current;
      
      metricStats[name] = {
        current: metric.current,
        trend: metric.trend,
        threshold: metric.thresholds,
        history: metric.history.length,
        lastUpdated: metric.lastUpdated,
        grade: this.getPerformanceGrade(metric.current, metric.thresholds)
      };
    });

    const alertStats = {};
    this.thresholds.forEach((threshold, name) => {
      alertStats[name] = {
        active: threshold.active,
        lastTriggered: threshold.lastTriggered,
        triggerCount: threshold.triggerCount,
        warning: threshold.warning,
        critical: threshold.critical
      };
    });

    return {
      currentMetrics,
      metricStats,
      alertStats,
      historySize: this.history.length,
      lastUpdated: this.history.length > 0 ? this.history[this.history.length - 1].timestamp : null,
      overallGrade: this.calculateOverallGrade(currentMetrics)
    };
  }

  // Get performance grade
  getPerformanceGrade(value, thresholds) {
    if (value <= thresholds.excellent) return 'excellent';
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.acceptable) return 'acceptable';
    if (value <= thresholds.poor) return 'poor';
    return 'critical';
  }

  // Calculate overall grade
  calculateOverallGrade(metrics) {
    const grades = Object.entries(metrics).map(([name, value]) => {
      const metric = this.metrics.get(name);
      if (!metric) return 'unknown';
      return this.getPerformanceGrade(value, metric.thresholds);
    });

    const gradeCounts = grades.reduce((counts, grade) => {
      counts[grade] = (counts[grade] || 0) + 1;
      return counts;
    }, {});

    const totalGrades = grades.length;
    if (totalGrades === 0) return 'unknown';

    // Weighted scoring
    const score = (gradeCounts.excellent * 5 + gradeCounts.good * 4 + gradeCounts.acceptable * 3 + gradeCounts.poor * 2 + gradeCounts.critical * 1) / totalGrades;

    if (score >= 4.5) return 'excellent';
    if (score >= 3.5) return 'good';
    if (score >= 2.5) return 'acceptable';
    if (score >= 1.5) return 'poor';
    return 'critical';
  }

  // Get performance report
  getPerformanceReport() {
    const stats = this.getStats();
    const now = new Date();
    
    return {
      timestamp: now.toISOString(),
      summary: {
        overallGrade: stats.overallGrade,
        totalMetrics: Object.keys(stats.currentMetrics).length,
        activeAlerts: Object.values(stats.alertStats).filter(alert => alert.active).length,
        lastUpdated: stats.lastUpdated
      },
      metrics: stats.metricStats,
      alerts: stats.alertStats,
      trends: this.calculateTrends(),
      recommendations: this.generateRecommendations(stats),
      generatedAt: now.toISOString()
    };
  }

  // Calculate trends
  calculateTrends() {
    const trends = {};
    
    this.metrics.forEach((metric, name) => {
      if (metric.history.length >= 10) {
        const recent = metric.history.slice(-5);
        const older = metric.history.slice(-10, -5);
        
        const recentAvg = recent.reduce((sum, value) => sum + value, 0) / recent.length;
        const olderAvg = older.reduce((sum, value) => sum + value, 0) / older.length;
        
        trends[name] = {
          trend: metric.trend,
          change: recentAvg - olderAvg,
          recentAverage: recentAvg,
          olderAverage: olderAvg
        };
      }
    });

    return trends;
  }

  // Generate recommendations
  generateRecommendations(stats) {
    const recommendations = [];

    // High priority recommendations
    Object.entries(stats.currentMetrics).forEach(([name, value]) => {
      const metric = this.metrics.get(name);
      if (!metric) return;

      if (value >= metric.thresholds.critical) {
        recommendations.push({
          priority: 'critical',
          action: `Address critical ${name} performance issue`,
          description: `${name} value of ${value} exceeds critical threshold of ${metric.thresholds.critical}`,
          metric: name,
          value,
          threshold: metric.thresholds.critical
        });
      }
    });

    // Medium priority recommendations
    Object.entries(stats.currentMetrics).forEach(([name, value]) => {
      const metric = this.metrics.get(name);
      if (!metric) return;

      if (value >= metric.thresholds.poor && value < metric.thresholds.critical) {
        recommendations.push({
          priority: 'medium',
          action: `Improve ${name} performance`,
          description: `${name} value of ${value} exceeds acceptable threshold of ${metric.thresholds.poor}`,
          metric: name,
          value,
          threshold: metric.thresholds.poor
        });
      }
    });

    // Low priority recommendations
    Object.entries(stats.currentMetrics).forEach(([name, value]) => {
      const metric = this.metrics.get(name);
      if (!metric) return;

      if (value < metric.thresholds.excellent && metric.trend === 'declining') {
        recommendations.push({
          priority: 'low',
          action: `Monitor ${name} performance`,
          description: `${name} value of ${value} is declining despite being within acceptable range`,
          metric: name,
          value,
          trend: metric.trend
        });
      }
    });

    return recommendations;
  }

  // Export performance report
  exportReport() {
    const report = this.getPerformanceReport();
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    
    console.log('[PERFORMANCE_MONITOR] Performance report exported');
  }

  // Get system state
  getState() {
    return {
      isInitialized: this.isInitialized,
      options: this.options,
      metrics: Array.from(this.metrics.entries()).map(([name, metric]) => ({
        name,
        ...metric
      })),
      thresholds: Array.from(this.thresholds.entries()).map(([name, threshold]) => ({
        name,
        ...threshold
      })),
      alerts: Array.from(this.alerts.entries()).map(([id, alert]) => ({
        id,
        ...alert
      })),
      history: this.history,
      stats: this.getStats(),
      monitoringInterval: this.monitoringInterval
    };
  }

  // Destroy monitor
  destroy() {
    this.stopMonitoring();
    
    this.metrics.clear();
    this.thresholds.clear();
    this.alerts.clear();
    this.history = [];
    
    this.isInitialized = false;
    console.log('[PERFORMANCE_MONITOR] Performance monitor destroyed');
  }
}

// Global instance
let performanceMonitor = null;

// Initialize monitor when DOM is ready
function initializePerformanceMonitor() {
  if (!performanceMonitor) {
    performanceMonitor = new PerformanceMonitor();
  }
  return performanceMonitor.initialize();
}

// Export for global access
window.performanceMonitor = performanceMonitor;

module.exports = {
  PerformanceMonitor,
  initializePerformanceMonitor
};
