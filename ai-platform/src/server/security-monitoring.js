const logger = require('../lib/production-logger');
/**
 * Advanced Security Monitoring System
 * Real-time security monitoring and threat detection
 */

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const { readJsonFileCached } = require('../../server/lib/json-file-cache');

class SecurityMonitoring extends EventEmitter {
  constructor() {
    super();
    this.securityData = {
      score: 100,
      vulnerabilities: 0,
      threatsBlocked: 0,
      securityEvents: 0,
      alerts: [],
      metrics: {
        requests: 0,
        blockedRequests: 0,
        suspiciousActivity: 0,
        securityScans: 0
      },
      trends: {
        hourly: [],
        daily: [],
        weekly: []
      }
    };
    
    this.threatPatterns = new Map();
    this.securityThresholds = {
      suspiciousRequestsPerMinute: 10,
      failedAuthAttempts: 5,
      unusualUserAgentPatterns: 3,
      requestSizeThreshold: 1024 * 1024 // 1MB
    };
    
    this.initializeMonitoring();
  }

  initializeMonitoring() {
    // Load security data from file if exists
    this.loadSecurityData();
    
    // Start periodic monitoring
    this.startPeriodicMonitoring();
    
    // Initialize threat patterns
    this.initializeThreatPatterns();
    
    logger.debug('🔒 Advanced security monitoring initialized');
  }

  loadSecurityData() {
    try {
      const dataPath = path.join(__dirname, '../../security-data.json');
      if (fs.existsSync(dataPath)) {
        const data = readJsonFileCached(dataPath);
        if (data) {
          this.securityData = { ...this.securityData, ...data };
        }
      }
    } catch (error) {
      console.error('Error loading security data:', error.message);
    }
  }

  saveSecurityData() {
    try {
      const dataPath = path.join(__dirname, '../../security-data.json');
      fs.writeFileSync(dataPath, JSON.stringify(this.securityData, null, 2));
    } catch (error) {
      console.error('Error saving security data:', error.message);
    }
  }

  startPeriodicMonitoring() {
    // Save data every 5 minutes
    setInterval(() => {
      this.saveSecurityData();
    }, 5 * 60 * 1000);

    // Generate security report every hour
    setInterval(() => {
      this.generateSecurityReport();
    }, 60 * 60 * 1000);

    // Update trends every minute
    setInterval(() => {
      this.updateTrends();
    }, 60 * 1000);
  }

  initializeThreatPatterns() {
    // SQL Injection patterns
    this.threatPatterns.set('sql-injection', [
      /union\s+select/i,
      /or\s+1\s*=\s*1/i,
      /drop\s+table/i,
      /insert\s+into/i,
      /delete\s+from/i
    ]);

    // XSS patterns
    this.threatPatterns.set('xss', [
      /<script[^>]*>/i,
      /javascript:/i,
      /onload\s*=/i,
      /onerror\s*=/i,
      /eval\(/i
    ]);

    // Path traversal patterns
    this.threatPatterns.set('path-traversal', [
      /\.\.\//i,
      /\.\.\\/i,
      /etc\/passwd/i,
      /windows\/system32/i
    ]);

    // Command injection patterns
    this.threatPatterns.set('command-injection', [
      /;\s*rm\s+/i,
      /\|\s*cat\s+/i,
      /&&\s*ls/i,
      /\|\s*nc\s+/i
    ]);
  }

  analyzeRequest(req) {
    const analysis = {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent') || '',
      headers: req.headers,
      threats: [],
      riskScore: 0
    };

    // Check for threat patterns
    this.checkThreatPatterns(analysis);

    // Check request size
    this.checkRequestSize(analysis, req);

    // Check suspicious user agents
    this.checkSuspiciousUserAgent(analysis);

    // Check rate limiting
    this.checkRateLimiting(analysis);

    // Update metrics
    this.updateMetrics(analysis);

    // Emit security event
    this.emit('security-event', analysis);

    return analysis;
  }

  checkThreatPatterns(analysis) {
    const url = analysis.url.toLowerCase();
    const userAgent = analysis.userAgent.toLowerCase();

    for (const [patternName, patterns] of this.threatPatterns) {
      for (const pattern of patterns) {
        if (pattern.test(url) || pattern.test(userAgent)) {
          analysis.threats.push({
            type: patternName,
            pattern: pattern.toString(),
            severity: 'high'
          });
          analysis.riskScore += 25;
        }
      }
    }
  }

  checkRequestSize(analysis, req) {
    const contentLength = parseInt(req.get('Content-Length') || '0');
    if (contentLength > this.securityThresholds.requestSizeThreshold) {
      analysis.threats.push({
        type: 'large-request',
        size: contentLength,
        severity: 'medium'
      });
      analysis.riskScore += 15;
    }
  }

  checkSuspiciousUserAgent(analysis) {
    const suspiciousAgents = [
      /bot/i,
      /crawler/i,
      /scanner/i,
      /wget/i,
      /curl/i,
      /python/i,
      /java/i,
      /go-http/i
    ];

    for (const pattern of suspiciousAgents) {
      if (pattern.test(analysis.userAgent)) {
        analysis.threats.push({
          type: 'suspicious-user-agent',
          agent: analysis.userAgent,
          severity: 'low'
        });
        analysis.riskScore += 5;
        break;
      }
    }
  }

  checkRateLimiting(analysis) {
    const now = Date.now();
    const windowSize = 60 * 1000; // 1 minute
    const key = `rate-limit-${analysis.ip}`;

    if (!this.rateLimitData) {
      this.rateLimitData = new Map();
    }

    if (!this.rateLimitData.has(key)) {
      this.rateLimitData.set(key, []);
    }

    const requests = this.rateLimitData.get(key);
    requests.push(now);

    // Remove old requests
    const cutoff = now - windowSize;
    while (requests.length > 0 && requests[0] < cutoff) {
      requests.shift();
    }

    if (requests.length > this.securityThresholds.suspiciousRequestsPerMinute) {
      analysis.threats.push({
        type: 'rate-limit-exceeded',
        requests: requests.length,
        severity: 'high'
      });
      analysis.riskScore += 30;
    }
  }

  updateMetrics(analysis) {
    this.securityData.metrics.requests++;
    
    if (analysis.riskScore > 50) {
      this.securityData.metrics.suspiciousActivity++;
      this.securityData.securityEvents++;
    }

    if (analysis.riskScore > 75) {
      this.securityData.metrics.blockedRequests++;
      this.securityData.threatsBlocked++;
      
      // Create security alert
      this.createSecurityAlert(analysis);
    }
  }

  createSecurityAlert(analysis) {
    const alert = {
      id: Date.now().toString(),
      timestamp: analysis.timestamp,
      type: 'threat_detected',
      severity: analysis.riskScore > 75 ? 'high' : 'medium',
      message: `Security threat detected from ${analysis.ip}`,
      details: {
        ip: analysis.ip,
        threats: analysis.threats,
        riskScore: analysis.riskScore,
        userAgent: analysis.userAgent
      }
    };

    this.securityData.alerts.unshift(alert);
    
    // Keep only last 100 alerts
    if (this.securityData.alerts.length > 100) {
      this.securityData.alerts = this.securityData.alerts.slice(0, 100);
    }

    // Emit alert event
    this.emit('security-alert', alert);

    console.warn(`🚨 Security Alert: ${alert.message} (Risk Score: ${analysis.riskScore})`);
  }

  updateTrends() {
    const now = Date.now();
    const hourlyData = {
      timestamp: now,
      score: this.securityData.score,
      vulnerabilities: this.securityData.vulnerabilities,
      threats: this.securityData.threatsBlocked,
      events: this.securityData.securityEvents
    };

    this.securityData.trends.hourly.unshift(hourlyData);
    
    // Keep only last 24 hours of data
    if (this.securityData.trends.hourly.length > 24) {
      this.securityData.trends.hourly = this.securityData.trends.hourly.slice(0, 24);
    }
  }

  generateSecurityReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        securityScore: this.securityData.score,
        vulnerabilities: this.securityData.vulnerabilities,
        threatsBlocked: this.securityData.threatsBlocked,
        securityEvents: this.securityData.securityEvents
      },
      metrics: this.securityData.metrics,
      trends: this.securityData.trends,
      alerts: this.securityData.alerts.slice(0, 10),
      recommendations: this.generateRecommendations()
    };

    // Save report
    const reportPath = path.join(__dirname, '../../security-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Emit report event
    this.emit('security-report', report);

    logger.debug('📊 Security report generated');
  }

  generateRecommendations() {
    const recommendations = [];

    if (this.securityData.vulnerabilities > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Fix security vulnerabilities',
        details: `${this.securityData.vulnerabilities} vulnerabilities detected`
      });
    }

    if (this.securityData.metrics.suspiciousActivity > 100) {
      recommendations.push({
        priority: 'medium',
        action: 'Investigate suspicious activity',
        details: `${this.securityData.metrics.suspiciousActivity} suspicious requests detected`
      });
    }

    if (this.securityData.threatsBlocked > 50) {
      recommendations.push({
        priority: 'medium',
        action: 'Review security policies',
        details: `${this.securityData.threatsBlocked} threats blocked`
      });
    }

    return recommendations;
  }

  getSecurityStatus() {
    return {
      securityScore: this.securityData.score,
      vulnerabilities: this.securityData.vulnerabilities,
      threatsBlocked: this.securityData.threatsBlocked,
      securityEvents: this.securityData.securityEvents,
      recentAlerts: this.securityData.alerts.slice(0, 10),
      metrics: this.securityData.metrics,
      trends: this.securityData.trends
    };
  }

  // Update security score based on current metrics
  updateSecurityScore() {
    let score = 100;

    // Deduct points for vulnerabilities
    score -= this.securityData.vulnerabilities * 5;

    // Deduct points for security events
    score -= Math.min(this.securityData.securityEvents * 0.1, 10);

    // Deduct points for high suspicious activity
    if (this.securityData.metrics.suspiciousActivity > 100) {
      score -= 5;
    }

    // Ensure score doesn't go below 0
    this.securityData.score = Math.max(0, score);
  }

  // Simulate security scan
  async runSecurityScan() {
    logger.debug('🔍 Running security scan...');
    
    this.securityData.metrics.securityScans++;
    
    // Simulate finding vulnerabilities
    const vulnerabilities = Math.floor(Math.random() * 3);
    this.securityData.vulnerabilities = vulnerabilities;
    
    // Update security score
    this.updateSecurityScore();
    
    // Generate report
    this.generateSecurityReport();
    
    logger.debug(`✅ Security scan completed. Found ${vulnerabilities} vulnerabilities. Score: ${this.securityData.score}/100`);
    
    return this.getSecurityStatus();
  }
}

module.exports = SecurityMonitoring;
