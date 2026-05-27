/**
 * Quality Enhancement and Monitoring System
 * 
 * Enhanced quality scoring algorithm with weighted factors,
 * real-time monitoring, quality thresholds, and alerts
 */

const logger = require('../../lib/app-logger');

class QualityEnhancer {
  constructor(options = {}) {
    this.weights = options.weights || {
      structure: 0.25,
      content: 0.20,
      format: 0.15,
      completeness: 0.15,
      consistency: 0.15,
      performance: 0.10
    };
    
    this.thresholds = options.thresholds || {
      excellent: 95,
      good: 85,
      acceptable: 70,
      poor: 50
    };
    
    this.alertThresholds = options.alertThresholds || {
      consecutiveLowScores: 3,
      rapidDecline: 10,
      criticalIssues: 1
    };
    
    this.qualityHistory = [];
    this.alerts = [];
    this.metrics = new Map();
    this.isMonitoring = false;
    this.monitoringInterval = null;
    
    logger.debug('[QUALITY] Quality enhancer initialized');
  }

  // Calculate comprehensive quality score
  calculateQualityScore(data, metadata = {}) {
    const timestamp = new Date().toISOString();
    
    const factors = {
      structure: this.calculateStructureScore(data),
      content: this.calculateContentScore(data),
      format: this.calculateFormatScore(data, metadata.format),
      completeness: this.calculateCompletenessScore(data),
      consistency: this.calculateConsistencyScore(data),
      performance: this.calculatePerformanceScore(data, metadata)
    };

    const weightedScore = Object.entries(factors).reduce((sum, [factor, score]) => {
      return sum + (score * this.weights[factor]);
    }, 0);

    const qualityScore = Math.round(weightedScore);
    const grade = this.getQualityGrade(qualityScore);

    const result = {
      timestamp,
      score: qualityScore,
      grade,
      factors,
      weights: { ...this.weights },
      metadata: {
        dataSize: JSON.stringify(data).length,
        format: metadata.format || 'unknown',
        source: metadata.source || 'unknown'
      },
      recommendations: this.generateRecommendations(factors, grade),
      trends: this.calculateTrends(qualityScore)
    };

    // Store in metrics
    this.metrics.set(timestamp, result);
    this.qualityHistory.push(result);
    
    // Keep only last 1000 entries
    if (this.qualityHistory.length > 1000) {
      this.qualityHistory = this.qualityHistory.slice(-1000);
    }

    // Check for alerts
    this.checkAlerts(result);

    logger.debug(`[QUALITY] Quality score calculated: ${qualityScore} (${grade})`);
    return result;
  }

  // Calculate structure quality score
  calculateStructureScore(data) {
    let score = 100;
    
    try {
      if (typeof data === 'object' && data !== null) {
        // Check for proper object structure
        const keys = Object.keys(data);
        
        // Penalize empty objects
        if (keys.length === 0) {
          score -= 30;
        }
        
        // Check for nested depth
        const maxDepth = this.calculateMaxDepth(data);
        if (maxDepth > 5) {
          score -= (maxDepth - 5) * 5;
        }
        
        // Check for consistent naming conventions
        const namingIssues = this.checkNamingConsistency(keys);
        score -= namingIssues * 3;
        
        // Check for circular references
        if (this.hasCircularReference(data)) {
          score -= 20;
        }
        
      } else if (Array.isArray(data)) {
        // Array structure checks
        if (data.length === 0) {
          score -= 20;
        }
        
        // Check for mixed types in array
        const types = new Set(data.map(item => typeof item));
        if (types.size > 2) {
          score -= (types.size - 2) * 5;
        }
        
      } else {
        // Primitive type checks
        if (data === null || data === undefined) {
          score -= 50;
        }
      }
      
    } catch (error) {
      score = 0;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  // Calculate content quality score
  calculateContentScore(data) {
    let score = 100;
    
    try {
      const content = JSON.stringify(data);
      
      // Check for content size
      if (content.length === 0) {
        score -= 50;
      } else if (content.length < 100) {
        score -= 20;
      }
      
      // Check for special characters
      const specialCharCount = (content.match(/[^\w\s.,;:!?'"()[\]{}<>-]/g) || []).length;
      if (specialCharCount > content.length * 0.1) {
        score -= 10;
      }
      
      // Check for encoding issues
      if (content.includes('') || content.includes('')) {
        score -= 15;
      }
      
      // Check for duplicate content
      const duplicateRatio = this.calculateDuplicateRatio(data);
      score -= duplicateRatio * 20;
      
    } catch (error) {
      score = 0;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  // Calculate format quality score
  calculateFormatScore(data, format) {
    let score = 100;
    
    try {
      switch (format) {
        case 'json':
          // JSON-specific checks
          JSON.parse(JSON.stringify(data));
          break;
          
        case 'csv':
          // CSV-specific checks
          if (Array.isArray(data)) {
            const firstRowKeys = Object.keys(data[0] || {});
            data.forEach(row => {
              const rowKeys = Object.keys(row);
              if (rowKeys.length !== firstRowKeys.length) {
                score -= 10;
              }
            });
          }
          break;
          
        case 'xml':
          // XML-specific checks
          if (typeof data === 'object') {
            const xmlString = this.objectToXML(data);
            if (!xmlString.includes('<?xml')) {
              score -= 10;
            }
          }
          break;
          
        default:
          // Generic format checks
          if (typeof data !== 'object' && typeof data !== 'string') {
            score -= 20;
          }
      }
      
    } catch (error) {
      score = 0;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  // Calculate completeness score
  calculateCompletenessScore(data) {
    let score = 100;
    
    try {
      if (typeof data === 'object' && data !== null) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        
        // Check for null/undefined values
        const nullCount = values.filter(v => v === null || v === undefined).length;
        if (nullCount > 0) {
          score -= (nullCount / keys.length) * 50;
        }
        
        // Check for empty strings
        const emptyStringCount = values.filter(v => typeof v === 'string' && v.trim() === '').length;
        if (emptyStringCount > 0) {
          score -= (emptyStringCount / keys.length) * 30;
        }
        
        // Check for empty arrays/objects
        const emptyCount = values.filter(v => {
          if (Array.isArray(v)) return v.length === 0;
          if (typeof v === 'object' && v !== null) return Object.keys(v).length === 0;
          return false;
        }).length;
        
        if (emptyCount > 0) {
          score -= (emptyCount / keys.length) * 20;
        }
        
      } else {
        // Primitive type completeness
        if (data === null || data === undefined || data === '') {
          score = 0;
        }
      }
      
    } catch (error) {
      score = 0;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  // Calculate consistency score
  calculateConsistencyScore(data) {
    let score = 100;
    
    try {
      if (Array.isArray(data)) {
        // Check array consistency
        if (data.length > 1) {
          const firstItem = data[0];
          const firstType = typeof firstItem;
          
          // Check type consistency
          const typeConsistency = data.filter(item => typeof item === firstType).length / data.length;
          if (typeConsistency < 0.8) {
            score -= (1 - typeConsistency) * 30;
          }
          
          // Check structure consistency for objects
          if (firstType === 'object' && firstItem !== null) {
            const firstKeys = Object.keys(firstItem);
            data.forEach(item => {
              if (typeof item === 'object' && item !== null) {
                const itemKeys = Object.keys(item);
                const keyOverlap = firstKeys.filter(k => itemKeys.includes(k)).length;
                const keyConsistency = keyOverlap / Math.max(firstKeys.length, itemKeys.length);
                
                if (keyConsistency < 0.8) {
                  score -= (1 - keyConsistency) * 20;
                }
              }
            });
          }
        }
      }
      
    } catch (error) {
      score = 0;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  // Calculate performance score
  calculatePerformanceScore(data, metadata) {
    let score = 100;
    
    try {
      const size = JSON.stringify(data).length;
      
      // Penalize very large data
      if (size > 1000000) { // 1MB
        score -= Math.min(30, (size - 1000000) / 100000);
      }
      
      // Check processing time if available
      if (metadata.processingTime) {
        if (metadata.processingTime > 1000) { // 1 second
          score -= Math.min(20, (metadata.processingTime - 1000) / 100);
        }
      }
      
      // Check memory usage if available
      if (metadata.memoryUsage) {
        if (metadata.memoryUsage > 100000000) { // 100MB
          score -= Math.min(25, (metadata.memoryUsage - 100000000) / 1000000);
        }
      }
      
    } catch (error) {
      score = 0;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  // Get quality grade
  getQualityGrade(score) {
    if (score >= this.thresholds.excellent) return 'excellent';
    if (score >= this.thresholds.good) return 'good';
    if (score >= this.thresholds.acceptable) return 'acceptable';
    return 'poor';
  }

  // Generate recommendations
  generateRecommendations(factors, grade) {
    const recommendations = [];
    
    Object.entries(factors).forEach(([factor, score]) => {
      if (score < 60) {
        switch (factor) {
          case 'structure':
            recommendations.push({
              priority: 'high',
              factor,
              action: 'Improve data structure',
              description: `Structure score is ${score}. Consider organizing data better.`
            });
            break;
          case 'content':
            recommendations.push({
              priority: 'medium',
              factor,
              action: 'Enhance content quality',
              description: `Content score is ${score}. Review content for issues.`
            });
            break;
          case 'format':
            recommendations.push({
              priority: 'high',
              factor,
              action: 'Fix format compliance',
              description: `Format score is ${score}. Ensure proper format.`
            });
            break;
          case 'completeness':
            recommendations.push({
              priority: 'medium',
              factor,
              action: 'Complete missing data',
              description: `Completeness score is ${score}. Fill in missing fields.`
            });
            break;
          case 'consistency':
            recommendations.push({
              priority: 'medium',
              factor,
              action: 'Ensure data consistency',
              description: `Consistency score is ${score}. Standardize data format.`
            });
            break;
          case 'performance':
            recommendations.push({
              priority: 'low',
              factor,
              action: 'Optimize performance',
              description: `Performance score is ${score}. Consider optimization.`
            });
            break;
        }
      }
    });
    
    if (grade === 'poor') {
      recommendations.push({
        priority: 'critical',
        factor: 'overall',
        action: 'Comprehensive quality improvement needed',
        description: 'Overall quality is poor. Complete review required.'
      });
    }
    
    return recommendations;
  }

  // Calculate trends
  calculateTrends(currentScore) {
    if (this.qualityHistory.length < 2) {
      return {
        trend: 'stable',
        change: 0,
        direction: 'none'
      };
    }
    
    const recentScores = this.qualityHistory.slice(-10).map(h => h.score);
    const olderScores = this.qualityHistory.slice(-20, -10).map(h => h.score);
    
    if (olderScores.length === 0) {
      return {
        trend: 'stable',
        change: 0,
        direction: 'none'
      };
    }
    
    const recentAvg = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
    const olderAvg = olderScores.reduce((sum, score) => sum + score, 0) / olderScores.length;
    
    const change = recentAvg - olderAvg;
    
    let trend = 'stable';
    let direction = 'none';
    
    if (change > 5) {
      trend = 'improving';
      direction = 'up';
    } else if (change < -5) {
      trend = 'declining';
      direction = 'down';
    }
    
    return {
      trend,
      change: Math.round(change),
      direction
    };
  }

  // Check for alerts
  checkAlerts(result) {
    const alerts = [];
    
    // Check for consecutive low scores
    const recentScores = this.qualityHistory.slice(-5).map(h => h.score);
    const lowScoreCount = recentScores.filter(score => score < this.thresholds.acceptable).length;
    
    if (lowScoreCount >= this.alertThresholds.consecutiveLowScores) {
      alerts.push({
        type: 'consecutive_low_scores',
        severity: 'warning',
        message: `${lowScoreCount} consecutive low quality scores detected`,
        timestamp: result.timestamp,
        data: { count: lowScoreCount, threshold: this.alertThresholds.consecutiveLowScores }
      });
    }
    
    // Check for rapid decline
    if (recentScores.length >= 3) {
      const decline = recentScores[0] - recentScores[recentScores.length - 1];
      if (decline >= this.alertThresholds.rapidDecline) {
        alerts.push({
          type: 'rapid_decline',
          severity: 'critical',
          message: `Rapid quality decline detected (${decline} points)`,
          timestamp: result.timestamp,
          data: { decline, threshold: this.alertThresholds.rapidDecline }
        });
      }
    }
    
    // Check for critical issues
    if (result.score < this.thresholds.poor) {
      alerts.push({
        type: 'critical_quality',
        severity: 'critical',
        message: `Critical quality issue: ${result.score} (${result.grade})`,
        timestamp: result.timestamp,
        data: { score: result.score, grade: result.grade }
      });
    }
    
    // Store alerts
    alerts.forEach(alert => {
      this.alerts.push(alert);
    });
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
    
    return alerts;
  }

  // Start monitoring
  startMonitoring(intervalMs = 60000) {
    if (this.isMonitoring) {
      logger.debug('[QUALITY] Monitoring already started');
      return;
    }
    
    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, intervalMs);
    
    logger.debug(`[QUALITY] Monitoring started (interval: ${intervalMs}ms)`);
  }

  // Stop monitoring
  stopMonitoring() {
    if (!this.isMonitoring) {
      logger.debug('[QUALITY] Monitoring not started');
      return;
    }
    
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    logger.debug('[QUALITY] Monitoring stopped');
  }

  // Perform health check
  performHealthCheck() {
    if (this.qualityHistory.length === 0) {
      return;
    }
    
    const latest = this.qualityHistory[this.qualityHistory.length - 1];
    const health = {
      timestamp: new Date().toISOString(),
      currentScore: latest.score,
      currentGrade: latest.grade,
      trend: latest.trends,
      alerts: this.alerts.slice(-5),
      metrics: this.calculateMetrics()
    };
    
    logger.debug(`[QUALITY] Health check: ${health.currentScore} (${health.currentGrade})`);
    return health;
  }

  // Calculate metrics
  calculateMetrics() {
    if (this.qualityHistory.length === 0) {
      return {
        totalAssessments: 0,
        averageScore: 0,
        gradeDistribution: {},
        trend: 'stable'
      };
    }
    
    const scores = this.qualityHistory.map(h => h.score);
    const grades = this.qualityHistory.map(h => h.grade);
    
    const gradeDistribution = grades.reduce((dist, grade) => {
      dist[grade] = (dist[grade] || 0) + 1;
      return dist;
    }, {});
    
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    return {
      totalAssessments: this.qualityHistory.length,
      averageScore: Math.round(averageScore),
      gradeDistribution,
      trend: this.calculateTrends(averageScore).trend,
      alertsCount: this.alerts.length,
      lastUpdated: new Date().toISOString()
    };
  }

  // Get quality dashboard data
  getDashboardData() {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const recentMetrics = this.qualityHistory.filter(h => new Date(h.timestamp) >= last24Hours);
    const weeklyMetrics = this.qualityHistory.filter(h => new Date(h.timestamp) >= last7Days);
    
    return {
      overview: {
        totalAssessments: this.qualityHistory.length,
        recentAssessments: recentMetrics.length,
        averageScore: this.calculateAverageScore(recentMetrics),
        trend: this.calculateTrends(recentMetrics[recentMetrics.length - 1]?.score || 0).trend
      },
      current: {
        score: recentMetrics[recentMetrics.length - 1]?.score || 0,
        grade: recentMetrics[recentMetrics.length - 1]?.grade || 'unknown',
        factors: recentMetrics[recentMetrics.length - 1]?.factors || {},
        recommendations: recentMetrics[recentMetrics.length - 1]?.recommendations || []
      },
      alerts: this.alerts.slice(-10),
      metrics: this.calculateMetrics(),
      generatedAt: now.toISOString()
    };
  }

  // Helper methods
  calculateMaxDepth(obj, currentDepth = 0) {
    if (typeof obj !== 'object' || obj === null) {
      return currentDepth;
    }
    
    let maxDepth = currentDepth;
    
    Object.values(obj).forEach(value => {
      if (typeof value === 'object' && value !== null) {
        const depth = this.calculateMaxDepth(value, currentDepth + 1);
        maxDepth = Math.max(maxDepth, depth);
      }
    });
    
    return maxDepth;
  }

  checkNamingConsistency(keys) {
    let issues = 0;
    
    const styles = {
      camelCase: /^[a-z][a-zA-Z0-9]*$/,
      snake_case: /^[a-z][a-z0-9_]*$/,
      kebab_case: /^[a-z][a-z0-9-]*$/,
      PascalCase: /^[A-Z][a-zA-Z0-9]*$/
    };
    
    const detectedStyles = keys.map(key => {
      for (const [style, regex] of Object.entries(styles)) {
        if (regex.test(key)) return style;
      }
      return 'inconsistent';
    });
    
    const uniqueStyles = [...new Set(detectedStyles)];
    if (uniqueStyles.length > 1) {
      issues += uniqueStyles.length - 1;
    }
    
    return issues;
  }

  hasCircularReference(obj, seen = new WeakSet()) {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }
    
    if (seen.has(obj)) {
      return true;
    }
    
    seen.add(obj);
    
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        if (this.hasCircularReference(value, seen)) {
          return true;
        }
      }
    }
    
    seen.delete(obj);
    return false;
  }

  calculateDuplicateRatio(data) {
    if (Array.isArray(data)) {
      const unique = new Set(data.map(item => JSON.stringify(item)));
      return 1 - (unique.size / data.length);
    }
    
    return 0;
  }

  objectToXML(obj) {
    let xml = '';
    
    Object.entries(obj).forEach(([key, value]) => {
      xml += `<${key}>${value}</${key}>`;
    });
    
    return xml;
  }

  calculateAverageScore(metrics) {
    if (metrics.length === 0) return 0;
    
    const total = metrics.reduce((sum, m) => sum + m.score, 0);
    return Math.round(total / metrics.length);
  }

  // Get statistics
  getStats() {
    return {
      ...this.calculateMetrics(),
      isMonitoring: this.isMonitoring,
      alertsCount: this.alerts.length,
      weights: this.weights,
      thresholds: this.thresholds
    };
  }

  // Update weights
  updateWeights(newWeights) {
    this.weights = { ...this.weights, ...newWeights };
    logger.debug('[QUALITY] Weights updated:', this.weights);
  }

  // Update thresholds
  updateThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    logger.debug('[QUALITY] Thresholds updated:', this.thresholds);
  }

  // Clear history
  clearHistory() {
    this.qualityHistory = [];
    this.alerts = [];
    this.metrics.clear();
    logger.debug('[QUALITY] History cleared');
  }
}

module.exports = QualityEnhancer;
