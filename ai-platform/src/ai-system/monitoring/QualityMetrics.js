/**
 * Quality Metrics and Monitoring System
 * 
 * Real-time quality monitoring with predictive analytics,
 * code quality scoring, performance monitoring, and user feedback integration
 */

class QualityMetrics {
  constructor() {
    this.metrics = new Map();
    this.thresholds = new Map();
    this.alerts = [];
    this.feedbackData = new Map();
    this.predictiveModels = new Map();
    this.initializeMetrics();
  }

  initializeMetrics() {
    console.log('[QUALITY] Initializing quality metrics system...');
    this.setupDefaultThresholds();
    this.loadHistoricalData();
    this.initializePredictiveModels();
  }

  setupDefaultThresholds() {
    this.thresholds.set('code_quality', {
      excellent: 90,
      good: 75,
      acceptable: 60,
      poor: 40
    });

    this.thresholds.set('performance', {
      excellent: 95,
      good: 85,
      acceptable: 70,
      poor: 50
    });

    this.thresholds.set('security', {
      excellent: 95,
      good: 80,
      acceptable: 65,
      poor: 45
    });

    this.thresholds.set('user_satisfaction', {
      excellent: 90,
      good: 75,
      acceptable: 60,
      poor: 40
    });
  }

  loadHistoricalData() {
    try {
      const fs = require('fs');
      const path = require('path');
      
      const metricsPath = path.join(__dirname, '../../../logs/quality-metrics.json');
      if (fs.existsSync(metricsPath)) {
        const data = fs.readFileSync(metricsPath, 'utf8');
        const historicalData = JSON.parse(data);
        
        historicalData.forEach(metric => {
          this.metrics.set(metric.id, metric);
        });
      }

      console.log(`[QUALITY] Loaded ${this.metrics.size} historical metric records`);
    } catch (error) {
      console.warn('[QUALITY] Failed to load historical data:', error.message);
    }
  }

  initializePredictiveModels() {
    // Initialize simple predictive models for quality forecasting
    this.predictiveModels.set('code_quality_trend', {
      type: 'linear_regression',
      features: ['complexity', 'test_coverage', 'documentation'],
      target: 'quality_score',
      accuracy: 0.85
    });

    this.predictiveModels.set('performance_prediction', {
      type: 'time_series',
      features: ['response_time', 'memory_usage', 'cpu_usage'],
      target: 'performance_score',
      accuracy: 0.82
    });

    this.predictiveModels.set('user_satisfaction_forecast', {
      type: 'ensemble',
      features: ['response_time', 'error_rate', 'feature_usage'],
      target: 'satisfaction_score',
      accuracy: 0.78
    });
  }

  // Calculate comprehensive code quality score
  calculateCodeQualityScore(codeAnalysis) {
    const timestamp = new Date().toISOString();
    const metricId = this.generateMetricId();

    const factors = {
      complexity: this.calculateComplexityScore(codeAnalysis.complexity),
      maintainability: this.calculateMaintainabilityScore(codeAnalysis.maintainability),
      test_coverage: this.calculateTestCoverageScore(codeAnalysis.testCoverage),
      documentation: this.calculateDocumentationScore(codeAnalysis.documentation),
      security: this.calculateSecurityScore(codeAnalysis.security),
      performance: this.calculatePerformanceScore(codeAnalysis.performance)
    };

    const weights = {
      complexity: 0.2,
      maintainability: 0.25,
      test_coverage: 0.2,
      documentation: 0.15,
      security: 0.15,
      performance: 0.05
    };

    const weightedScore = Object.entries(factors).reduce((sum, [factor, score]) => {
      return sum + (score * weights[factor]);
    }, 0);

    const qualityScore = Math.round(weightedScore);
    const grade = this.getQualityGrade(qualityScore, 'code_quality');

    const metric = {
      id: metricId,
      type: 'code_quality',
      timestamp,
      score: qualityScore,
      grade,
      factors,
      weights,
      details: {
        totalLines: codeAnalysis.totalLines || 0,
        functions: codeAnalysis.functions || 0,
        classes: codeAnalysis.classes || 0,
        cyclomaticComplexity: codeAnalysis.cyclomaticComplexity || 0
      },
      recommendations: this.generateQualityRecommendations(factors, grade)
    };

    this.metrics.set(metricId, metric);
    this.saveMetrics();
    this.checkThresholds(metric);

    console.log(`[QUALITY] Code quality calculated: ${qualityScore} (${grade})`);
    return metric;
  }

  // Calculate performance metrics
  calculatePerformanceMetrics(performanceData) {
    const timestamp = new Date().toISOString();
    const metricId = this.generateMetricId();

    const factors = {
      response_time: this.calculateResponseTimeScore(performanceData.responseTime),
      throughput: this.calculateThroughputScore(performanceData.throughput),
      memory_usage: this.calculateMemoryUsageScore(performanceData.memoryUsage),
      cpu_usage: this.calculateCpuUsageScore(performanceData.cpuUsage),
      error_rate: this.calculateErrorRateScore(performanceData.errorRate),
      availability: this.calculateAvailabilityScore(performanceData.availability)
    };

    const weights = {
      response_time: 0.25,
      throughput: 0.2,
      memory_usage: 0.15,
      cpu_usage: 0.15,
      error_rate: 0.15,
      availability: 0.1
    };

    const weightedScore = Object.entries(factors).reduce((sum, [factor, score]) => {
      return sum + (score * weights[factor]);
    }, 0);

    const performanceScore = Math.round(weightedScore);
    const grade = this.getQualityGrade(performanceScore, 'performance');

    const metric = {
      id: metricId,
      type: 'performance',
      timestamp,
      score: performanceScore,
      grade,
      factors,
      weights,
      details: {
        averageResponseTime: performanceData.responseTime || 0,
        peakThroughput: performanceData.throughput || 0,
        memoryPeak: performanceData.memoryUsage || 0,
        cpuPeak: performanceData.cpuUsage || 0,
        totalErrors: performanceData.totalErrors || 0,
        uptime: performanceData.uptime || 0
      },
      recommendations: this.generatePerformanceRecommendations(factors, grade)
    };

    this.metrics.set(metricId, metric);
    this.saveMetrics();
    this.checkThresholds(metric);

    console.log(`[QUALITY] Performance metrics calculated: ${performanceScore} (${grade})`);
    return metric;
  }

  // Process user feedback
  processUserFeedback(userId, feedbackData) {
    const timestamp = new Date().toISOString();
    const feedbackId = this.generateFeedbackId();

    const feedback = {
      id: feedbackId,
      userId,
      timestamp,
      rating: feedbackData.rating,
      category: feedbackData.category,
      comments: feedbackData.comments,
      context: feedbackData.context,
      sentiment: this.analyzeSentiment(feedbackData.comments),
      priority: this.calculateFeedbackPriority(feedbackData)
    };

    if (!this.feedbackData.has(userId)) {
      this.feedbackData.set(userId, []);
    }
    this.feedbackData.get(userId).push(feedback);

    // Update user satisfaction metrics
    this.updateUserSatisfactionMetrics(userId);

    console.log(`[QUALITY] User feedback processed: ${userId} - ${feedbackData.rating}`);
    return feedback;
  }

  // Generate quality predictions
  generateQualityPrediction(metricType, timeHorizon = 7) {
    const historicalData = this.getHistoricalMetrics(metricType, 30); // Last 30 days
    
    if (historicalData.length < 5) {
      return {
        error: 'Insufficient historical data for prediction',
        required: 5,
        available: historicalData.length
      };
    }

    const model = this.predictiveModels.get(this.getPredictionModel(metricType));
    if (!model) {
      return {
        error: 'No prediction model available for this metric type',
        metricType
      };
    }

    const prediction = this.applyPredictiveModel(model, historicalData, timeHorizon);
    
    const result = {
      metricType,
      timeHorizon,
      prediction,
      confidence: model.accuracy,
      model: model.type,
      generatedAt: new Date().toISOString(),
      recommendations: this.generatePredictionRecommendations(prediction, metricType)
    };

    console.log(`[QUALITY] Quality prediction generated: ${metricType} - ${timeHorizon} days`);
    return result;
  }

  // Generate comprehensive quality dashboard data
  generateQualityDashboard() {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentMetrics = Array.from(this.metrics.values())
      .filter(metric => new Date(metric.timestamp) >= last24Hours);

    const weeklyMetrics = Array.from(this.metrics.values())
      .filter(metric => new Date(metric.timestamp) >= last7Days);

    const dashboard = {
      overview: {
        totalMetrics: this.metrics.size,
        recentMetrics: recentMetrics.length,
        averageQuality: this.calculateAverageQuality(recentMetrics),
        trend: this.calculateQualityTrend(weeklyMetrics)
      },
      currentScores: {
        code_quality: this.getLatestMetricScore('code_quality'),
        performance: this.getLatestMetricScore('performance'),
        security: this.getLatestMetricScore('security'),
        user_satisfaction: this.calculateUserSatisfactionScore()
      },
      alerts: this.alerts.filter(alert => new Date(alert.timestamp) >= last24Hours),
      predictions: {
        code_quality: this.generateQualityPrediction('code_quality'),
        performance: this.generateQualityPrediction('performance'),
        user_satisfaction: this.generateQualityPrediction('user_satisfaction')
      },
      feedback: {
        totalFeedback: this.getTotalFeedbackCount(),
        averageRating: this.calculateAverageRating(),
        recentFeedback: this.getRecentFeedback(10)
      },
      generatedAt: now.toISOString()
    };

    return dashboard;
  }

  // Helper methods for score calculations
  calculateComplexityScore(complexity) {
    if (!complexity) return 70; // Default score
    
    const { cyclomaticComplexity, cognitiveComplexity } = complexity;
    
    // Score based on complexity (lower complexity = higher score)
    if (cyclomaticComplexity <= 5) return 100;
    if (cyclomaticComplexity <= 10) return 85;
    if (cyclomaticComplexity <= 15) return 70;
    if (cyclomaticComplexity <= 20) return 55;
    return 40;
  }

  calculateMaintainabilityScore(maintainability) {
    if (!maintainability) return 70;
    
    const { technicalDebt, codeDuplication, coupling } = maintainability;
    
    let score = 100;
    score -= (technicalDebt || 0) * 0.5;
    score -= (codeDuplication || 0) * 0.3;
    score -= (coupling || 0) * 0.2;
    
    return Math.max(0, Math.round(score));
  }

  calculateTestCoverageScore(testCoverage) {
    if (!testCoverage) return 70;
    
    const { lineCoverage, branchCoverage, functionCoverage } = testCoverage;
    
    const avgCoverage = (lineCoverage + branchCoverage + functionCoverage) / 3;
    return Math.round(avgCoverage);
  }

  calculateDocumentationScore(documentation) {
    if (!documentation) return 70;
    
    const { apiDocs, codeComments, readmeFiles } = documentation;
    
    let score = 0;
    if (apiDocs > 0) score += 30;
    if (codeComments > 50) score += 40;
    if (readmeFiles > 0) score += 30;
    
    return Math.min(100, score);
  }

  calculateSecurityScore(security) {
    if (!security) return 70;
    
    const { vulnerabilities, securityTests, encryption } = security;
    
    let score = 100;
    score -= (vulnerabilities || 0) * 10;
    score += (securityTests || 0) * 2;
    if (encryption) score += 10;
    
    return Math.max(0, Math.round(score));
  }

  calculatePerformanceScore(performance) {
    if (!performance) return 70;
    
    const { responseTime, memoryUsage, optimization } = performance;
    
    let score = 100;
    if (responseTime > 1000) score -= 20;
    if (responseTime > 500) score -= 10;
    if (memoryUsage > 1000000) score -= 15;
    if (memoryUsage > 500000) score -= 5;
    if (optimization) score += 10;
    
    return Math.max(0, Math.round(score));
  }

  calculateResponseTimeScore(responseTime) {
    if (responseTime <= 100) return 100;
    if (responseTime <= 500) return 85;
    if (responseTime <= 1000) return 70;
    if (responseTime <= 2000) return 50;
    return 30;
  }

  calculateThroughputScore(throughput) {
    if (!throughput) return 70;
    
    // Score based on requests per second
    if (throughput >= 1000) return 100;
    if (throughput >= 500) return 85;
    if (throughput >= 200) return 70;
    if (throughput >= 100) return 55;
    return 40;
  }

  calculateMemoryUsageScore(memoryUsage) {
    if (!memoryUsage) return 70;
    
    // Score based on memory usage in MB
    if (memoryUsage <= 100) return 100;
    if (memoryUsage <= 500) return 85;
    if (memoryUsage <= 1000) return 70;
    if (memoryUsage <= 2000) return 50;
    return 30;
  }

  calculateCpuUsageScore(cpuUsage) {
    if (!cpuUsage) return 70;
    
    // Score based on CPU usage percentage
    if (cpuUsage <= 50) return 100;
    if (cpuUsage <= 70) return 85;
    if (cpuUsage <= 85) return 70;
    if (cpuUsage <= 95) return 50;
    return 30;
  }

  calculateErrorRateScore(errorRate) {
    if (!errorRate) return 100;
    
    // Score based on error rate percentage
    if (errorRate <= 0.1) return 100;
    if (errorRate <= 0.5) return 85;
    if (errorRate <= 1.0) return 70;
    if (errorRate <= 2.0) return 50;
    return 30;
  }

  calculateAvailabilityScore(availability) {
    if (!availability) return 70;
    
    // Score based on uptime percentage
    if (availability >= 99.9) return 100;
    if (availability >= 99.5) return 85;
    if (availability >= 99.0) return 70;
    if (availability >= 98.0) return 50;
    return 30;
  }

  getQualityGrade(score, metricType) {
    const thresholds = this.thresholds.get(metricType);
    if (!thresholds) return 'unknown';

    if (score >= thresholds.excellent) return 'excellent';
    if (score >= thresholds.good) return 'good';
    if (score >= thresholds.acceptable) return 'acceptable';
    return 'poor';
  }

  generateQualityRecommendations(factors, grade) {
    const recommendations = [];

    Object.entries(factors).forEach(([factor, score]) => {
      if (score < 60) {
        switch (factor) {
          case 'complexity':
            recommendations.push('Reduce code complexity by breaking down large functions');
            break;
          case 'maintainability':
            recommendations.push('Improve maintainability by reducing technical debt');
            break;
          case 'test_coverage':
            recommendations.push('Increase test coverage to improve code reliability');
            break;
          case 'documentation':
            recommendations.push('Add comprehensive documentation for better maintainability');
            break;
          case 'security':
            recommendations.push('Address security vulnerabilities and add security tests');
            break;
          case 'performance':
            recommendations.push('Optimize performance bottlenecks and resource usage');
            break;
        }
      }
    });

    if (grade === 'poor') {
      recommendations.push('Comprehensive quality improvement plan recommended');
    }

    return recommendations;
  }

  generatePerformanceRecommendations(factors, grade) {
    const recommendations = [];

    Object.entries(factors).forEach(([factor, score]) => {
      if (score < 60) {
        switch (factor) {
          case 'response_time':
            recommendations.push('Optimize response times through caching and query optimization');
            break;
          case 'throughput':
            recommendations.push('Increase throughput by optimizing resource allocation');
            break;
          case 'memory_usage':
            recommendations.push('Reduce memory usage through better memory management');
            break;
          case 'cpu_usage':
            recommendations.push('Optimize CPU usage through algorithm improvements');
            break;
          case 'error_rate':
            recommendations.push('Reduce error rate through better error handling and testing');
            break;
          case 'availability':
            recommendations.push('Improve availability through better monitoring and failover');
            break;
        }
      }
    });

    return recommendations;
  }

  analyzeSentiment(comments) {
    if (!comments) return 'neutral';
    
    // Simple sentiment analysis
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love', 'perfect', 'helpful'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'broken', 'useless', 'slow'];
    
    const words = comments.toLowerCase().split(/\s+/);
    const positiveCount = words.filter(word => positiveWords.includes(word)).length;
    const negativeCount = words.filter(word => negativeWords.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  calculateFeedbackPriority(feedbackData) {
    let priority = 'medium';
    
    if (feedbackData.rating <= 2) priority = 'high';
    if (feedbackData.category === 'security' || feedbackData.category === 'performance') priority = 'high';
    if (feedbackData.rating >= 4) priority = 'low';
    
    return priority;
  }

  updateUserSatisfactionMetrics(userId) {
    const userFeedback = this.feedbackData.get(userId) || [];
    if (userFeedback.length === 0) return;

    const recentFeedback = userFeedback.slice(-10); // Last 10 feedback entries
    const averageRating = recentFeedback.reduce((sum, f) => sum + f.rating, 0) / recentFeedback.length;
    
    const metricId = this.generateMetricId();
    const metric = {
      id: metricId,
      type: 'user_satisfaction',
      timestamp: new Date().toISOString(),
      score: Math.round(averageRating * 20), // Convert 1-5 scale to 0-100
      userId,
      feedbackCount: recentFeedback.length,
      lastFeedback: recentFeedback[recentFeedback.length - 1].timestamp
    };

    this.metrics.set(metricId, metric);
  }

  getHistoricalMetrics(metricType, days) {
    const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    return Array.from(this.metrics.values())
      .filter(metric => metric.type === metricType && new Date(metric.timestamp) >= cutoffDate)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  getPredictionModel(metricType) {
    const modelMap = {
      'code_quality': 'code_quality_trend',
      'performance': 'performance_prediction',
      'user_satisfaction': 'user_satisfaction_forecast'
    };
    
    return modelMap[metricType];
  }

  applyPredictiveModel(model, historicalData, timeHorizon) {
    // Simplified predictive model application
    const recentScores = historicalData.slice(-7).map(m => m.score);
    
    if (model.type === 'linear_regression') {
      // Simple linear regression
      const trend = this.calculateLinearTrend(recentScores);
      const prediction = recentScores[recentScores.length - 1] + (trend * timeHorizon);
      
      return {
        predictedScore: Math.max(0, Math.min(100, Math.round(prediction))),
        trend: trend > 0 ? 'improving' : trend < 0 ? 'declining' : 'stable',
        confidence: model.accuracy
      };
    }
    
    // Default prediction
    const averageScore = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
    return {
      predictedScore: Math.round(averageScore),
      trend: 'stable',
      confidence: model.accuracy
    };
  }

  calculateLinearTrend(scores) {
    if (scores.length < 2) return 0;
    
    const n = scores.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = scores.reduce((sum, score) => sum + score, 0);
    const sumXY = scores.reduce((sum, score, index) => sum + (index * score), 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  generatePredictionRecommendations(prediction, metricType) {
    const recommendations = [];
    
    if (prediction.predictedScore < 60) {
      recommendations.push(`Expected ${metricType} quality to decline - immediate action recommended`);
    } else if (prediction.predictedScore < 75) {
      recommendations.push(`Expected ${metricType} quality to decrease - preventive measures advised`);
    }
    
    if (prediction.trend === 'declining') {
      recommendations.push('Negative trend detected - review recent changes');
    }
    
    return recommendations;
  }

  checkThresholds(metric) {
    const thresholds = this.thresholds.get(metric.type);
    if (!thresholds) return;

    if (metric.score < thresholds.poor) {
      this.createAlert(metric, 'critical');
    } else if (metric.score < thresholds.acceptable) {
      this.createAlert(metric, 'warning');
    }
  }

  createAlert(metric, severity) {
    const alert = {
      id: this.generateAlertId(),
      metricId: metric.id,
      type: metric.type,
      score: metric.score,
      severity,
      timestamp: new Date().toISOString(),
      message: `${metric.type} quality is ${severity}: ${metric.score}`,
      recommendations: metric.recommendations
    };

    this.alerts.push(alert);
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    console.log(`[QUALITY] Alert created: ${severity} - ${metric.type} (${metric.score})`);
  }

  generateMetricId() {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateFeedbackId() {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  saveMetrics() {
    try {
      const fs = require('fs');
      const path = require('path');
      
      const metricsPath = path.join(__dirname, '../../../logs/quality-metrics.json');
      const metricsArray = Array.from(this.metrics.values());
      
      fs.writeFileSync(metricsPath, JSON.stringify(metricsArray, null, 2));
    } catch (error) {
      console.error('[QUALITY] Failed to save metrics:', error.message);
    }
  }

  calculateAverageQuality(metrics) {
    if (metrics.length === 0) return 0;
    
    const totalScore = metrics.reduce((sum, metric) => sum + metric.score, 0);
    return Math.round(totalScore / metrics.length);
  }

  calculateQualityTrend(metrics) {
    if (metrics.length < 2) return 'stable';
    
    const recentScores = metrics.slice(-7).map(m => m.score);
    const olderScores = metrics.slice(-14, -7).map(m => m.score);
    
    if (olderScores.length === 0) return 'stable';
    
    const recentAvg = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
    const olderAvg = olderScores.reduce((sum, score) => sum + score, 0) / olderScores.length;
    
    const difference = recentAvg - olderAvg;
    
    if (difference > 5) return 'improving';
    if (difference < -5) return 'declining';
    return 'stable';
  }

  getLatestMetricScore(metricType) {
    const typeMetrics = Array.from(this.metrics.values())
      .filter(metric => metric.type === metricType)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return typeMetrics.length > 0 ? typeMetrics[0].score : 0;
  }

  calculateUserSatisfactionScore() {
    const allFeedback = Array.from(this.feedbackData.values()).flat();
    if (allFeedback.length === 0) return 0;
    
    const averageRating = allFeedback.reduce((sum, f) => sum + f.rating, 0) / allFeedback.length;
    return Math.round(averageRating * 20);
  }

  getTotalFeedbackCount() {
    return Array.from(this.feedbackData.values())
      .reduce((total, userFeedback) => total + userFeedback.length, 0);
  }

  calculateAverageRating() {
    const allFeedback = Array.from(this.feedbackData.values()).flat();
    if (allFeedback.length === 0) return 0;
    
    return allFeedback.reduce((sum, f) => sum + f.rating, 0) / allFeedback.length;
  }

  getRecentFeedback(count) {
    return Array.from(this.feedbackData.values())
      .flat()
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, count);
  }
}

module.exports = QualityMetrics;
