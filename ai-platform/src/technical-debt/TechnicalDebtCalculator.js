/**
 * Technical Debt Calculator System
 * 
 * Comprehensive technical debt assessment and calculation with
 * real-time monitoring, reduction tracking, and integration with quality metrics
 */

class TechnicalDebtCalculator {
  constructor(options = {}) {
    this.options = options;
    this.debtMetrics = new Map();
    this.debtCategories = new Map();
    this.debtHistory = [];
    this.reductionGoals = new Map();
    this.maxHistory = options.maxHistory || 1000;
    this.isInitialized = false;
    this.updateInterval = options.updateInterval || 60000; // 1 minute
    
    this.initializeDebtCategories();
    this.initializeDebtMetrics();
    console.log('[TECHNICAL_DEBT] Technical debt calculator initialized');
  }

  // Initialize debt categories
  initializeDebtCategories() {
    // Code complexity debt
    this.addDebtCategory('complexity', {
      description: 'Code complexity issues including cyclomatic complexity and maintainability',
      weight: 0.25,
      severity: 'medium',
      factors: ['cyclomatic_complexity', 'maintainability_index', 'code_duplication'],
      threshold: {
        excellent: 10,
        good: 20,
        acceptable: 30,
        poor: 50,
        critical: 100
      }
    });

    // Code quality debt
    this.addDebtCategory('quality', {
      description: 'Code quality issues including test coverage, documentation, and standards compliance',
      weight: 0.20,
      severity: 'medium',
      factors: ['test_coverage', 'documentation_coverage', 'standards_compliance', 'error_handling'],
      threshold: {
        excellent: 5,
        good: 15,
        acceptable: 30,
        poor: 50,
        critical: 80
      }
    });

    // Security debt
    this.addDebtCategory('security', {
      description: 'Security vulnerabilities and compliance issues',
      weight: 0.30,
      severity: 'high',
      factors: ['vulnerabilities', 'security_tests', 'compliance_gaps', 'encryption_issues'],
      threshold: {
        excellent: 0,
        good: 5,
        acceptable: 15,
        poor: 30,
        critical: 60
      }
    });

    // Performance debt
    this.addDebtCategory('performance', {
      description: 'Performance issues including response time, memory usage, and scalability',
      weight: 0.15,
      severity: 'medium',
      factors: ['response_time', 'memory_usage', 'scalability_issues', 'resource_leaks'],
      threshold: {
        excellent: 5,
        good: 15,
        acceptable: 30,
        poor: 50,
        critical: 80
      }
    });

    // Architecture debt
    this.addDebtCategory('architecture', {
      design: 'Architecture issues including design patterns, modularity, and coupling',
      weight: 0.10,
      severity: 'medium',
      factors: ['design_patterns', 'modularity', 'coupling', 'documentation'],
      threshold: {
        excellent: 5,
        good: 15,
        acceptable: 25,
        poor: 40,
        critical: 70
      }
    });

    console.log(`[TECHNICAL_DEBT] Initialized ${this.debtCategories.size} debt categories`);
  }

  // Initialize debt metrics
  initializeDebtMetrics() {
    // Overall technical debt score
    this.addDebtMetric('overall', {
      description: 'Overall technical debt score',
      weight: 1.0,
      calculation: 'weighted_average',
      threshold: {
        excellent: 10,
        good: 25,
        acceptable: 40,
        poor: 60,
        critical: 80
      }
    });

    // Code quality score
    this.addDebtMetric('code_quality', {
      description: 'Code quality technical debt score',
      weight: 0.8,
      calculation: 'weighted_average',
      threshold: {
        excellent: 15,
        good: 30,
        acceptable: 45,
        poor: 60,
        critical: 85
      }
    });

    // Security score
    this.addDebtMetric('security', {
      description: 'Security technical debt score',
      weight: 0.9,
      calculation: 'weighted_average',
      threshold: {
        excellent: 5,
        good: 20,
        acceptable: 35,
        poor: 55,
        critical: 75
      }
    });

    // Performance score
    this.addDebtMetric('performance', {
      description: 'Performance technical debt score',
      weight: 0.7,
      calculation: 'weighted_average',
      threshold: {
        excellent: 10,
        good: 25,
        acceptable: 40,
        poor: 60,
        critical: 80
      }
    });

    console.log(`[TECHNICAL_DEBT] Initialized ${this.debtMetrics.size} debt metrics`);
  }

  // Add debt category
  addDebtCategory(name, category) {
    this.debtCategories.set(name, {
      ...category,
      history: [],
      currentScore: 0,
      trend: 'stable',
      lastUpdated: null
    });
    console.log(`[TECHNICAL_DEBT] Added debt category: ${name}`);
  }

  // Add debt metric
  addDebtMetric(name, metric) {
    this.debtMetrics.set(name, {
      ...metric,
      history: [],
      currentScore: 0,
      trend: 'stable',
      lastUpdated: null
    });
    console.log(`[TECHNICAL_DEBT] Added debt metric: ${name}`);
  }

  // Initialize system
  async initialize() {
    if (this.isInitialized) {
      console.log('[TECHNICAL_DEBT] Technical debt calculator already initialized');
      return;
    }

    try {
      // Load historical data
      this.loadHistoricalData();
      
      // Start periodic updates
      this.startPeriodicUpdates();
      
      this.isInitialized = true;
      console.log('[TECHNICAL_DEBT] Technical debt calculator initialized successfully');
      
    } catch (error) {
      console.error('[TECHNICAL_DEBT] Failed to initialize:', error.message);
      throw error;
    }
  }

  // Calculate technical debt for codebase
  async calculateTechnicalDebt(codebaseData, options = {}) {
    const {
      filePaths = [],
      includeComplexity = true,
      includeQuality = true,
      includeSecurity = true,
      includePerformance = true,
      includeArchitecture = true
    } = options;

    const debtAssessment = {
      timestamp: new Date().toISOString(),
      codebase: {
        totalFiles: filePaths.length,
        totalLines: 0,
        totalSize: 0
      },
      categories: {},
      metrics: {},
      overallScore: 0,
      grade: 'unknown',
      recommendations: []
    };

    let totalLines = 0;
    let totalSize = 0;

    // Process each file
    for (const filePath of filePaths) {
      try {
        const fileData = await this.analyzeFile(filePath);
        totalLines += fileData.lines;
        totalSize += fileData.size;

        // Calculate debt for each category
        this.debtCategories.forEach((category, categoryName) => {
          if (this.shouldIncludeCategory(categoryName, options)) {
            const categoryScore = this.calculateCategoryDebt(fileData, category);
            debtAssessment.categories[categoryName] = {
              score: categoryScore,
              grade: this.getDebtGrade(categoryScore, category.threshold),
              factors: category.factors.map(factor => ({
                name: factor,
                score: fileData.factors[factor] || 0,
                threshold: category.threshold[factor] || 50
              }))
            };
          }
        });

        debtAssessment.codebase.totalLines = totalLines;
        debtAssessment.codebase.totalSize = totalSize;

      } catch (error) {
        console.error(`[TECHNICAL_DEBT] Error analyzing file ${filePath}:`, error.message);
      }
    }

    // Calculate overall metrics
    this.debtMetrics.forEach((metric, metricName) => {
      if (this.shouldIncludeMetric(metricName, options)) {
        const metricScore = this.calculateMetricScore(debtAssessment.categories, metric);
        debtAssessment.metrics[metricName] = {
          score: metricScore,
          grade: this.getDebtGrade(metricScore, metric.threshold),
          contributingCategories: this.getContributingCategories(debtAssessment.categories, metric)
        };
      }
    });

    // Calculate overall score
    debtAssessment.overallScore = this.calculateOverallScore(debtAssessment.metrics);
    debtAssessment.grade = this.getDebtGrade(debtAssessment.overallScore, this.debtMetrics.get('overall').threshold);

    // Generate recommendations
    debtAssessment.recommendations = this.generateRecommendations(debtAssessment);

    // Store in history
    this.storeAssessment(debtAssessment);

    console.log(`[TECHNICAL_DEBT] Technical debt calculated: ${debtAssessment.overallScore} (${debtAssessment.grade})`);
    return debtAssessment;
  }

  // Analyze individual file
  async analyzeFile(filePath) {
    // This would integrate with file system analysis
    // For now, we'll create a mock implementation
    const mockData = {
      path: filePath,
      lines: Math.floor(Math.random() * 1000) + 50,
      size: Math.floor(Math.random() * 100000) + 1000,
      factors: {
        cyclomatic_complexity: Math.random() * 50 + 10,
        maintainability_index: Math.random() * 50 + 10,
        code_duplication: Math.random() * 30 + 5,
        test_coverage: Math.random() * 80 + 10,
        documentation_coverage: Math.random() * 60 + 10,
        standards_compliance: Math.random() * 70 + 10,
        error_handling: Math.random() * 60 + 10,
        vulnerabilities: Math.random() * 20 + 5,
        security_tests: Math.random() * 30 + 5,
        compliance_gaps: Math.random() * 25 + 5,
        encryption_issues: Math.random() * 15 + 3,
        response_time: Math.random() * 500 + 50,
        memory_usage: Math.random() * 100 + 10,
        scalability_issues: Math.random() * 30 + 5,
        resource_leaks: Math.random() * 25 + 5,
        design_patterns: Math.random() * 40 + 10,
        modularity: Math.random() * 60 + 20,
        coupling: Math.random() * 30 + 10,
        documentation: Math.random() * 50 + 10
      }
    };

    return mockData;
  }

  // Calculate debt for a specific category
  calculateCategoryDebt(fileData, category) {
    let categoryScore = 0;
    let factorCount = 0;

    category.factors.forEach(factor => {
      const factorScore = fileData.factors[factor] || 0;
      const factorWeight = 1 / category.factors.length;
      
      // Apply severity weighting
      let severityWeight = 1.0;
      if (category.severity === 'critical') severityWeight = 1.5;
      if (category.severity === 'high') severityWeight = 1.25;
      if (category.severity === 'low') severityWeight = 0.75;
      
      categoryScore += factorScore * factorWeight * severityWeight;
      factorCount++;
    });

    return factorCount > 0 ? categoryScore / factorCount : 0;
  }

  // Calculate metric score from categories
  calculateMetricScore(categories, metric) {
    let score = 0;
    let totalWeight = 0;

    categories.forEach((category, categoryName) => {
      if (this.debtCategories.has(categoryName)) {
        const categoryWeight = this.debtCategories.get(categoryName).weight;
        score += category.score * categoryWeight;
        totalWeight += categoryWeight;
      }
    });

    return totalWeight > 0 ? score / totalWeight : 0;
  }

  // Calculate overall score
  calculateOverallScore(metrics) {
    let totalScore = 0;
    let totalWeight = 0;

    this.debtMetrics.forEach((metric, metricName) => {
      totalScore += metrics[metricName]?.score || 0 * metric.weight;
      totalWeight += metric.weight;
    });

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  // Get debt grade
  getDebtGrade(score, threshold) {
    if (score <= threshold.excellent) return 'excellent';
    if (score <= threshold.good) return 'good';
    if (score <= threshold.acceptable) return 'acceptable';
    if (score <= threshold.poor) return 'poor';
    return 'critical';
  }

  // Get contributing categories for a metric
  getContributingCategories(categories, metric) {
    const contributing = [];
    
    Object.entries(categories).forEach(([categoryName, category]) => {
      const categoryWeight = this.debtCategories.get(categoryName).weight;
      const metricWeight = metric.weight;
      
      if (categoryWeight > 0 && metricWeight > 0) {
        const contribution = (category.score * categoryWeight) / metricWeight;
        if (contribution > 0.1) { // Only include significant contributions
          contributing.push({
            category: categoryName,
            contribution: Math.round(contribution * 100) / 100,
            score: category.score,
            grade: this.getDebtGrade(category.score, category.threshold)
          });
        }
      }
    });

    return contributing;
  }

  // Generate recommendations based on debt assessment
  generateRecommendations(debtAssessment) {
    const recommendations = [];

    // High priority recommendations
    if (debtAssessment.overallScore > 60) {
      recommendations.push({
        priority: 'critical',
        action: 'Address critical technical debt immediately',
        description: `Overall debt score of ${debtAssessment.overallScore} requires immediate attention`,
        affectedAreas: Object.entries(debtAssessment.categories)
          .filter(([name, category]) => category.score > 50)
          .map(([name, category]) => name)
      });
    }

    // Category-specific recommendations
    Object.entries(debtAssessment.categories).forEach(([categoryName, category]) => {
      if (category.score > category.threshold.poor) {
        recommendations.push({
          priority: 'high',
          action: `Improve ${categoryName} technical debt`,
          description: `${categoryName} score of ${Math.round(category.score)} exceeds threshold of ${category.threshold.poor}`,
          factors: category.factors
            .filter(factor => factor.score > factor.threshold)
            .map(factor => factor.name)
        });
      }
    });

    // Low-hanging fruit recommendations
    Object.entries(debtAssessment.categories).forEach(([categoryName, category]) => {
      if (category.score < category.threshold.good && category.score > 0) {
        recommendations.push({
          priority: 'medium',
          action: `Monitor ${categoryName} technical debt`,
          description: `${categoryName} score of ${Math.round(category.score)} is improving but still needs attention`,
          factors: category.factors
            .filter(factor => factor.score > factor.threshold)
            .map(factor => factor.name)
        });
      }
    });

    return recommendations;
  }

  // Determine if category should be included in calculation
  shouldIncludeCategory(categoryName, options) {
    if (options.includeComplexity && categoryName === 'complexity') return true;
    if (options.includeQuality && categoryName === 'quality') return true;
    if (options.includeSecurity && categoryName === 'security') return true;
    if (options.includePerformance && categoryName === 'performance') return true;
    if (options.includeArchitecture && categoryName === 'architecture') return true;
    return false;
  }

  // Determine if metric should be included in calculation
  shouldIncludeMetric(metricName, options) {
    if (metricName === 'overall') return true;
    if (options.includeCodeQuality && metricName === 'code_quality') return true;
    if (options.includeSecurity && metricName === 'security') return true;
    if (options.includePerformance && metricName === 'performance') return true;
    return false;
  }

  // Store assessment in history
  storeAssessment(assessment) {
    this.debtHistory.push(assessment);
    
    // Keep only max history items
    if (this.debtHistory.length > this.maxHistory) {
      this.debtHistory = this.debtHistory.slice(-this.maxHistory);
    }

    // Update category and metric histories
    Object.entries(assessment.categories).forEach(([categoryName, category]) => {
      const categoryData = this.debtCategories.get(categoryName);
      if (categoryData) {
        categoryData.history.push(category.score);
        categoryData.currentScore = category.score;
        categoryData.trend = this.calculateTrend(categoryData.history);
        categoryData.lastUpdated = assessment.timestamp;
      }
    });

    Object.entries(assessment.metrics).forEach(([metricName, metric]) => {
      const metricData = this.debtMetrics.get(metricName);
      if (metricData) {
        metricData.history.push(metric.score);
        metricData.currentScore = metric.score;
        metricData.trend = this.calculateTrend(metricData.history);
        metricData.lastUpdated = assessment.timestamp;
      }
    });
  }

  // Calculate trend from history
  calculateTrend(history) {
    if (history.length < 2) return 'stable';
    
    const recent = history.slice(-5);
    const older = history.slice(-10, -5);
    
    if (older.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((sum, score) => sum + score, 0) / recent.length;
    const olderAvg = older.reduce((sum, score) => sum + score, 0) / older.length;
    
    const change = recentAvg - olderAvg;
    
    if (change > 5) return 'improving';
    if (change < -5) return 'declining';
    return 'stable';
  }

  // Start periodic updates
  startPeriodicUpdates() {
    if (this.updateIntervalId) {
      clearInterval(this.updateIntervalId);
    }

    this.updateIntervalId = setInterval(() => {
      this.performPeriodicUpdate();
    }, this.updateInterval);

    console.log(`[TECHNICAL_DEBT] Periodic updates started (${this.updateInterval}ms interval)`);
  }

  // Stop periodic updates
  stopPeriodicUpdates() {
    if (this.updateIntervalId) {
      clearInterval(this.loadIntervalId);
      this.updateIntervalId = null;
    }
    
    console.log('[TECHNICAL_DEBT] Periodic updates stopped');
  }

  // Perform periodic update
  async performPeriodicUpdate() {
    try {
      // In a real implementation, this would recalculate debt based on current codebase state
      console.log('[TECHNICAL_DEBT] Performing periodic update');
      
      // Update reduction goals
      this.updateReductionGoals();
      
    } catch (error) {
      console.error('[TECHNICAL_DEBT] Error in periodic update:', error.message);
    }
  }

  // Update reduction goals
  updateReductionGoals() {
    this.debtCategories.forEach((category, categoryName) => {
      if (category.history.length > 10) {
        const recent = category.history.slice(-10);
        const older = category.history.slice(-20, -10);
        
        const recentAvg = recent.reduce((sum, score) => sum + score, 0) / recent.length;
        const olderAvg = older.reduce((sum, score) => sum + score, 0) / older.length;
        
        const improvement = recentAvg - olderAvg;
        
        if (improvement < 0) {
          this.debtCategories.get(categoryName).reductionGoal = Math.abs(improvement);
        }
      }
    });
  }

  // Get debt statistics
  getDebtStats() {
    const currentAssessment = this.debtHistory.length > 0 ? this.debtHistory[this.debtHistory.length - 1] : null;
    
    const categoryStats = {};
    this.debtCategories.forEach((category, name) => {
      categoryStats[name] = {
        currentScore: category.currentScore,
        trend: category.trend,
        threshold: category.threshold,
        usage: category.history.length,
        lastUpdated: category.lastUpdated
      };
    });

    const metricStats = {};
    this.debtMetrics.forEach((metric, name) => {
      metricStats[name] = {
        currentScore: metric.currentScore,
        trend: metric.trend,
        threshold: metric.threshold,
        usage: metric.history.length,
        lastUpdated: metric.lastUpdated
      };
    });

    return {
      totalAssessments: this.debtHistory.length,
      currentAssessment,
      categoryStats,
      metricStats,
      reductionGoals: Array.from(this.debtCategories.entries()).map(([name, category]) => ({
        name,
        reductionGoal: category.reductionGoal || 0,
        currentScore: category.currentScore,
        improvement: category.trend === 'improving'
      })),
      averageScore: currentAssessment?.overallScore || 0,
      grade: currentAssessment?.grade || 'unknown',
      lastUpdated: currentAssessment?.timestamp || null
    };
  }

  // Get debt reduction progress
  getDebtReductionProgress() {
    const progress = {};
    
    this.debtCategories.forEach((category, name) => {
      if (category.reductionGoal > 0) {
        const currentScore = category.currentScore;
        const targetScore = Math.max(0, category.currentScore - category.reductionGoal);
        const progress = Math.max(0, Math.min(100, ((category.currentScore - targetScore) / category.reductionGoal) * 100));
        
        progress[name] = {
          current: Math.round(currentScore),
          target: targetScore,
          progress: Math.round(progress),
          remaining: Math.max(0, category.reductionGoal - (category.currentScore - targetScore)),
          trend: category.trend
        };
      }
    });

    return progress;
  }

  // Set reduction goal for category
  setReductionGoal(categoryName, targetScore) {
    const category = this.debtCategories.get(categoryName);
    if (category) {
      const currentScore = category.currentScore;
      category.reductionGoal = Math.max(0, currentScore - targetScore);
      
      console.log(`[TECHNICAL_DEBT] Set reduction goal for ${categoryName}: ${category.reductionGoal} (current: ${currentScore}, target: ${targetScore})`);
    }
  }

  // Get debt by severity
  getDebtBySeverity() {
    const bySeverity = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      unknown: []
    };

    this.debtCategories.forEach((category, name) => {
      const severity = category.severity;
      const score = category.currentScore;
      
      if (bySeverity[severity]) {
        bySeverity[severity].push({
          name,
          score,
          grade: this.getDebtGrade(score, category.threshold),
          trend: category.trend
        });
      }
    });

    return bySeverity;
  }

  // Export debt report
  exportDebtReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.getDebtStats(),
      categories: Array.from(this.debtCategories.entries()).map(([name, category]) => ({
        name,
        description: category.description,
        weight: category.weight,
        severity: category.severity,
        currentScore: category.currentScore,
        threshold: category.threshold,
        trend: category.trend,
        factors: category.factors,
        history: category.history.slice(-20),
        lastUpdated: category.lastUpdated
      })),
      metrics: Array.from(this.debtMetrics.entries()).map(([name, metric]) => ({
        name,
        description: metric.description,
        weight: metric.weight,
        calculation: metric.calculation,
        currentScore: metric.currentScore,
        threshold: metric.threshold,
        trend: metric.trend,
        history: metric.history.slice(-20),
        lastUpdated: metric.lastUpdated
      })),
      recommendations: this.generateRecommendations(this.debtHistory.length > 0 ? this.debtHistory[this.debtHistory.length - 1] : null),
      reductionProgress: this.getDebtReductionProgress(),
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `technical-debt-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    
    console.log('[TECHNICAL_DEBT] Technical debt report exported');
  }

  // Load historical data
  loadHistoricalData() {
    try {
      const saved = localStorage.getItem('technical_debt_history');
      if (saved) {
        this.debtHistory = JSON.parse(saved);
        console.log(`[TECHNICAL_DEBT] Loaded ${this.debtHistory.length} assessments from history`);
      }
    } catch (error) {
      console.warn('[TECHNICAL_DEBT] Failed to load historical data:', error.message);
    }
  }

  // Save historical data
  saveHistoricalData() {
    try {
      localStorage.setItem('technical_debt_history', JSON.stringify(this.debtHistory));
      console.log(`[TECHNICAL_DEBT] Saved ${this.debtHistory.length} assessments to history`);
    } catch (error) {
      console.warn('[TECHNICAL_DEBT] Failed to save historical data:', error.message);
    }
  }

  // Get system state
  getState() {
    return {
      isInitialized: this.isInitialized,
      options: this.options,
      debtCategories: Array.from(this.debtCategories.entries()).map(([name, category]) => ({
        name,
        ...category
      })),
      debtMetrics: Array.from(this.debtMetrics.entries()).map(([name, metric]) => ({
        name,
        ...metric
      })),
      debtHistory: this.debtHistory,
      reductionGoals: Array.from(this.debtCategories.entries()).map(([name, category]) => ({
        name,
        reductionGoal: category.reductionGoal || 0
      })),
      stats: this.getDebtStats(),
      updateInterval: this.updateIntervalId,
      maxHistory: this.maxHistory
    };
  }

  // Destroy calculator
  destroy() {
    this.stopPeriodicUpdates();
    this.saveHistoricalData();
    
    this.debtCategories.clear();
    this.debtMetrics.clear();
    this.debtHistory = [];
    this.reductionGoals.clear();
    
    this.isInitialized = false;
    console.log('[TECHNICAL_DEBT] Technical debt calculator destroyed');
  }
}

// Global instance
let technicalDebtCalculator = null;

// Initialize calculator when DOM is ready
function initializeTechnicalDebtCalculator() {
  if (!technicalDebtCalculator) {
    technicalDebtCalculator = new TechnicalDebtCalculator();
  }
  return technicalDebtCalculator.initialize();
}

// Export for global access
window.technicalDebtCalculator = technicalDebtCalculator;

module.exports = {
  TechnicalDebtCalculator,
  initializeTechnicalDebtCalculator
};
