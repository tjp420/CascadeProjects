/**
 * Quality Analyzer System
 * 
 * Comprehensive quality assessment with multiple factors,
 * scoring, grading, and improvement recommendations
 */

class QualityAnalyzer {
  constructor(options = {}) {
    this.options = options;
    this.factors = new Map();
    this.thresholds = options.thresholds || {
      excellent: 90,
      good: 80,
      acceptable: 70,
      poor: 60,
      critical: 40
    };
    this.weights = options.weights || {
      completeness: 0.3,
      consistency: 0.25,
      validity: 0.25,
      accuracy: 0.2
    };
    this.isInitialized = false;
    
    this.initializeFactors();
    console.log('[QUALITY_ANALYZER] Quality analyzer initialized');
  }

  // Initialize quality factors
  initializeFactors() {
    // Completeness factor
    this.addFactor('completeness', {
      name: 'Completeness',
      description: 'Assesses data completeness and required fields',
      analyzer: this.assessCompleteness.bind(this),
      validator: this.validateCompleteness.bind(this),
      weight: this.weights.completeness,
      category: 'data'
    });

    // Consistency factor
    this.addFactor('consistency', {
      name: 'Consistency',
      description: 'Assesses data consistency across similar items',
      analyzer: this.assessConsistency.bind(this),
      validator: this.validateConsistency.bind(this),
      weight: this.weights.consistency,
      category: 'data'
    });

    // Validity factor
    this.addFactor('validity', {
      name: 'Validity',
      description: 'Assesses data validity and format compliance',
      analyzer: this.assessValidity.bind(this),
      validator: this.validateValidity.bind(this),
      weight: this.weights.validity,
      category: 'format'
    });

    // Accuracy factor
    this.addFactor('accuracy', {
      name: 'Accuracy',
      description: 'Assesses data accuracy and correctness',
      analyzer: this.assessAccuracy.bind(this),
      validator: this.validateAccuracy.bind(this),
      weight: this.weights.accuracy,
      category: 'quality'
    });

    // Performance factor
    this.addFactor('performance', {
      name: 'Performance',
      description: 'Assesses performance characteristics',
      analyzer: this.assessPerformance.bind(this),
      validator: this.validatePerformance.bind(this),
      weight: 0.1,
      category: 'performance'
    });

    // Security factor
    this.addFactor('security', {
      name: 'Security',
      description: 'Assesses security compliance and risks',
      analyzer: this.assessSecurity.bind(this),
      validator: this.validateSecurity.bind(this),
      weight: 0.1,
      category: 'security'
    });

    console.log(`[QUALITY_ANALYZER] Initialized ${this.factors.size} quality factors`);
  }

  // Add quality factor
  addFactor(name, factor) {
    this.factors.set(name, {
      ...factor,
      usage: 0,
      avgScore: 0,
      totalScore: 0,
      successCount: 0,
      failureCount: 0,
      lastUsed: null
    });
    console.log(`[QUALITY_ANALYZER] Added quality factor: ${name}`);
  }

  // Initialize quality analyzer
  async initialize() {
    if (this.isInitialized) {
      console.log('[QUALITY_ANALYZER] Quality analyzer already initialized');
      return;
    }

    try {
      this.isInitialized = true;
      console.log('[QUALITY_ANALYZER] Quality analyzer initialized successfully');
      
    } catch (error) {
      console.error('[QUALITY_ANALYZER] Failed to initialize quality analyzer:', error.message);
      throw error;
    }
  }

  // Analyze data quality
  analyzeQuality(data, options = {}) {
    const startTime = Date.now();
    
    try {
      const factors = {};
      
      // Assess all factors
      this.factors.forEach((factor, name) => {
        const assessment = factor.analyzer(data, options);
        factors[name] = assessment;
        
        // Validate assessment
        const validation = factor.validator(assessment);
        if (!validation.valid) {
          console.warn(`[QUALITY_ANALYZER] Validation failed for ${name}: ${validation.errors.join(', ')}`);
        }
      });
      
      // Calculate overall score
      const overallScore = this.calculateOverallScore(factors);
      
      // Generate grade
      const grade = this.getQualityGrade(overallScore);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(factors);
      
      const processingTime = Date.now() - startTime;
      
      // Update factor usage stats
      Object.entries(factors).forEach(([name, assessment]) => {
        const factor = this.factors.get(name);
        if (factor) {
          factor.usage++;
          factor.totalScore += assessment.score;
          factor.avgScore = factor.totalScore / factor.usage;
          factor.successCount++;
          factor.lastUsed = new Date().toISOString();
        }
      });
      
      return {
        success: true,
        score: overallScore,
        grade,
        factors,
        recommendations,
        processingTime,
        metadata: {
          threshold: this.thresholds,
          weights: this.weights,
          factorCount: this.factors.size,
          totalScore: Object.values(factors).reduce((sum, factor) => sum + factor.score, 0)
        }
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      console.error(`[QUALITY_ANALYZER] Quality analysis failed: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        processingTime
      };
    }
  }

  // Assess completeness factor
  assessCompleteness(data, options = {}) {
    let score = 100;
    const issues = [];
    
    if (typeof data === 'object' && data !== null) {
      // Check required fields
      const requiredFields = options.requiredFields || ['id', 'createdAt', 'updatedAt'];
      const missingFields = requiredFields.filter(field => !(field in data));
      
      missingFields.forEach(field => {
        score -= 15;
        issues.push({
          field,
          type: 'missing_field',
          message: `Required field ${field} is missing`
        });
      });
      
      // Check for empty values
      Object.entries(data).forEach(([key, value]) => {
        if (value === null || value === '' || value === undefined) {
          score -= 10;
          issues.push({
            field: key,
            type: 'empty_value',
            message: `Field ${key} has empty value`
          });
        }
      });
      
      // Check array completeness
      if (Array.isArray(data)) {
        if (data.length === 0) {
          score -= 30;
          issues.push({
            type: 'empty_array',
            message: 'Array is empty'
          });
        }
      }
    } else if (data === null || data === undefined) {
      score = 0;
      issues.push({
        type: 'null_data',
        message: 'Data is null or undefined'
      });
    }
    
    return {
      score: Math.max(0, score),
      issues
    };
  }

  validateCompleteness(assessment) {
    return {
      valid: assessment.score >= 0,
      errors: assessment.issues || []
    };
  }

  // Assess consistency factor
  assessConsistency(data, options = {}) {
    let score = 100;
    const issues = [];
    
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return { score: 100, issues: [] };
      }
      
      const firstItem = data[0];
      
      // Check type consistency
      const firstType = typeof firstItem;
      const typeInconsistencies = data.filter(item => typeof item !== firstType);
      
      if (typeInconsistencies.length > 0) {
        score -= (typeInconsistencies.length / data.length) * 20;
        issues.push({
          type: 'type_inconsistency',
          message: `${typeInconsistencies.length} items have inconsistent types`
        });
      }
      
      // Check structure consistency for objects
      const objectItems = data.filter(item => typeof item === 'object' && item !== null);
      if (objectItems.length > 0) {
        const firstObject = objectItems[0];
        const firstKeys = Object.keys(firstObject);
        
        objectItems.forEach((item, index) => {
          const itemKeys = Object.keys(item);
          const missingKeys = firstKeys.filter(key => !itemKeys.includes(key));
          if (missingKeys.length > 0) {
            score -= (missingKeys.length / firstKeys.length) * 15;
            issues.push({
              index,
              type: 'key_count_mismatch',
              message: `Item ${index} missing ${missingKeys.length} keys`
            });
          }
        });
      }
    } else if (typeof data === 'object' && data !== null) {
      // Check for consistent key patterns
      const keys = Object.keys(data);
      const keyPatterns = this.analyzeKeyPatterns(keys);
      
      const inconsistentPatterns = keyPatterns.filter(pattern => pattern.consistency < 0.8);
      if (inconsistentPatterns.length > 0) {
        score -= inconsistentPatterns.length * 10;
        issues.push({
          type: 'key_inconsistency',
          message: `${inconsistentPatterns.length} key patterns are inconsistent`
        });
      }
    }
    
    return {
      score: Math.max(0, score),
      issues
    };
  }

  validateConsistency(assessment) {
    return {
      valid: assessment.score >= 0,
      errors: assessment.issues || []
    };
  }

  // Assess validity factor
  assessValidity(data, options = {}) {
    let score = 100;
    const issues = [];
    
    // Check for invalid values
    if (typeof data === 'number') {
      if (isNaN(data) || !isFinite(data)) {
        score = 0;
        issues.push({
          type: 'invalid_number',
          message: 'Number is invalid (NaN or infinite)'
        });
      }
    }
    
    if (typeof data === 'string') {
      if (data.trim() === '') {
        score -= 50;
        issues.push({
          type: 'empty_string',
          message: 'String is empty'
        });
      }
      
      // Check for encoding issues
      if (data.includes('') || data.includes('')) {
        score -= 25;
        issues.push({
          type: 'encoding_issue',
          message: 'String contains encoding issues'
        });
      }
    }
    
    return {
      score: Math.max(0, score),
      issues
    };
  }

  validateValidity(assessment) {
    return {
      valid: assessment.score >= 0,
      errors: assessment.issues || []
    };
  }

  // Assess accuracy factor
  assessAccuracy(data, options = {}) {
    // This would require external validation or reference data
    // For now, return a default score based on data type
    let score = 85;
    
    if (typeof data === 'number') {
      if (data === 0) score = 95;
      if (data < 0) score = 75;
    }
    
    if (typeof data === 'string') {
      if (data.length < 10) score = 90;
      if (data.length > 1000) score = 70;
    }
    
    if (typeof data === 'object' && data !== null) {
      if (Object.keys(data).length === 0) score = 80;
      if (Object.keys(data).length > 50) score = 70;
    }
    
    return {
      score,
      issues: []
    };
  }

  validateAccuracy(assessment) {
    return {
      valid: assessment.score >= 0,
      errors: assessment.issues || []
    };
  }

  // Assess performance factor
  assessPerformance(data, options = {}) {
    let score = 100;
    const issues = [];
    
    const size = this.getDataSize(data);
    const maxSize = 1024 * 1024; // 1MB
    
    if (size > maxSize) {
      score -= Math.min(50, (size - maxSize) / maxSize * 100);
      issues.push({
        type: 'large_data',
        message: `Data size (${size} bytes) exceeds recommended size (${maxSize} bytes)`
      });
    }
    
    // Check for deep nesting
    const depth = this.getMaxDepth(data);
    const maxDepth = 10;
    
    if (depth > maxDepth) {
      score -= (depth - maxDepth) * 5;
      issues.push({
        type: 'deep_nesting',
        message: `Data depth (${depth}) exceeds recommended depth (${maxDepth})`
      });
    }
    
    // Check for circular references
    if (this.hasCircularReference(data)) {
      score = 0;
      issues.push({
        type: 'circular_reference',
        message: 'Data contains circular references'
      });
    }
    
    return {
      score: Math.max(0, score),
      issues
    };
  }

  validatePerformance(assessment) {
    return {
      valid: assessment.score >= 0,
      errors: assessment.issues || []
    };
  }

  // Assess security factor
  assessSecurity(data, options = {}) {
    let score = 100;
    const issues = [];
    
    // Check for sensitive data patterns
    const strings = this.collectStringValues(data);
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /auth/i,
      /credential/i,
      /ssn/i,
      /credit.*card/i,
      /bank.*account/i,
      /personal.*info/i
    ];
    
    strings.forEach((str, index) => {
      sensitivePatterns.forEach(pattern => {
        if (pattern.test(str)) {
          score -= 20;
          issues.push({
            type: 'sensitive_data',
            message: `String ${index} contains sensitive data: ${pattern.source}`
          });
        }
      });
    });
    
    return {
      score: Math.max(0, score),
      issues
    };
  }

  validateSecurity(assessment) {
    return {
      valid: assessment.score >= 0,
      errors: assessment.issues || []
    };
  }

  // Calculate overall quality score
  calculateOverallScore(factors) {
    if (Object.keys(factors).length === 0) return 0;
    
    const weightedSum = Object.entries(factors).reduce((sum, [name, factor]) => {
      const weight = this.factors.get(name)?.weight || 0;
      return sum + (factor.score * weight);
    }, 0);
    
    const totalWeight = Object.values(this.factors).reduce((sum, factor) => sum + factor.weight, 0);
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  // Get quality grade
  getQualityGrade(score) {
    if (score >= this.thresholds.excellent) return 'excellent';
    if (score >= this.thresholds.good) return 'good';
    if (score >= this.thresholds.acceptable) return 'acceptable';
    if (score >= this.thresholds.poor) return 'poor';
    return 'critical';
  }

  // Generate quality recommendations
  generateRecommendations(factors) {
    const recommendations = [];
    
    Object.entries(factors).forEach(([name, factor]) => {
      if (factor.score < 80) {
        recommendations.push({
          priority: this.getPriorityLevel(factor.score),
          action: `Improve ${name} quality`,
          description: `${name} score is ${Math.round(factor.score)}, improvement recommended`
        });
      }
    });
    
    // Add high priority recommendations
    const criticalFactors = Object.entries(factors).filter(([name, factor]) => factor.score < 60);
    if (criticalFactors.length > 0) {
      recommendations.push({
        priority: 'critical',
        action: 'Address critical quality issues',
        description: `${criticalFactors.length} factors have critical quality scores`
      });
    }
    
    return recommendations;
  }

  getPriorityLevel(score) {
    if (score < 40) return 'critical';
    if (score < 60) return 'high';
    if (score < 80) return 'medium';
    return 'low';
  }

  // Helper methods
  hasCircularReference(data) {
    const seen = new WeakSet();
    
    const checkCircular = (obj) => {
      if (seen.has(obj)) return true;
      seen.add(obj);
      
      if (typeof obj === 'object' && obj !== null) {
        return Object.values(obj).some(checkCircular);
      }
      
      return false;
    };
    
    return checkCircular(data);
  }

  collectStringValues(data) {
    const strings = [];
    
    const collectStrings = (value) => {
      if (typeof value === 'string') {
        strings.push(value);
      } else if (Array.isArray(value)) {
        value.forEach(collectStrings);
      } else if (typeof value === 'object' && value !== null) {
        Object.values(value).forEach(collectStrings);
      }
    };
    
    collectStrings(data);
    return strings;
  }

  getMaxDepth(data) {
    let maxDepth = 0;
    
    const calculateDepth = (obj, currentDepth = 0) => {
      maxDepth = Math.max(maxDepth, currentDepth);
      
      if (Array.isArray(obj)) {
        obj.forEach(item => {
          if (typeof item === 'object' && item !== null) {
            calculateDepth(item, currentDepth + 1);
          }
        });
      } else if (typeof obj === 'object' && obj !== null) {
        Object.values(obj).forEach(value => {
          if (typeof value === 'object' && value !== null) {
            calculateDepth(value, currentDepth + 1);
          }
        });
      }
    };
    
    calculateDepth(data);
    return maxDepth;
  }

  analyzeKeyPatterns(keys) {
    const patterns = [];
    
    // Analyze key naming patterns
    const namingPatterns = {
      camelCase: /^[a-z][a-zA-Z]*$/,
      snake_case: /^[a-z_]+$/,
      kebab_case: /^[a-z]+[A-Z]/,
      pascal_case: /^[A-Z][a-zA-Z]*$/,
      numeric_prefix: /^\d+/,
      suffix_id: /_id$/,
      suffix_uuid: /_uuid$/
    };
    
    Object.keys(keys).forEach(key => {
      let pattern = 'unknown';
      
      if (namingPatterns.camelCase.test(key)) {
        pattern = 'camel_case';
      } else if (namingPatterns.snake_case.test(key)) {
        pattern = 'snake_case';
      } else if (namingPatterns.kebab_case.test(key)) {
        pattern = 'kebab_case';
      } else if (namingPatterns.pascal_case.test(key)) {
        pattern = 'pascal_case';
      } else if (namingPatterns.numeric_prefix.test(key)) {
        pattern = 'numeric_prefix';
      } else if (namingPatterns.suffix_id.test(key)) {
        pattern = 'suffix_id';
      } else if (namingPatterns.suffix_uuid.test(key)) {
        pattern = 'suffix_uuid';
      }
      
      patterns.push({
        key,
        pattern,
        consistency: this.calculatePatternConsistency(keys, pattern)
      });
    });
    
    return patterns;
  }

  calculatePatternConsistency(keys, targetPattern) {
    if (keys.length === 0) return 1.0;
    
    const matchingKeys = keys.filter(key => {
      switch (targetPattern) {
        case 'camel_case':
          return /^[a-z][a-zA-Z]*$/.test(key);
        case 'snake_case':
          return /^[a-z_]+$/.test(key);
        case 'kebab_case':
          return /^[a-z]+[A-Z]/.test(key);
        case 'pascal_case':
          return /^[A-Z][a-zA-Z]*$/.test(key);
        case 'numeric_prefix':
          return /^\d+/.test(key);
        case 'suffix_id':
          return /_id$/.test(key);
        case 'suffix_uuid':
          return /_uuid$/.test(key);
        default:
          return false;
      }
    });
    
    return matchingKeys.length / keys.length;
  }

  getDataSize(data) {
    return JSON.stringify(data).length;
  }

  // Get quality statistics
  getStats() {
    const factorStats = {};
    
    this.factors.forEach((factor, name) => {
      factorStats[name] = {
        name,
        type: factor.type,
        usage: factor.usage,
        avgScore: factor.avgScore,
        totalScore: factor.totalScore,
        successCount: factor.successCount,
        failureCount: factor.failureCount,
        lastUsed: factor.lastUsed,
        weight: factor.weight,
        category: factor.category
      };
    });

    return {
      factorStats,
      totalFactors: this.factors.size,
      averageScore: this.calculateAverageScore(),
      threshold: this.thresholds,
      weights: this.weights,
      lastUpdated: new Date().toISOString()
    };
  }

  // Calculate average score
  calculateAverageScore() {
    const scores = Array.from(this.factors.values()).map(factor => factor.avgScore);
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  // Get system state
  getState() {
    return {
      isInitialized: this.isInitialized,
      options: this.options,
      factors: Array.from(this.factors.entries()).map(([name, factor]) => ({
        name,
        ...factor
      })),
      stats: this.getStats(),
      lastUpdated: new Date().toISOString()
    };
  }

  // Destroy quality analyzer
  destroy() {
    this.factors.clear();
    
    this.isInitialized = false;
    console.log('[QUALITY_ANALYZER] Quality analyzer destroyed');
  }
}

// Global instance
let qualityAnalyzer = null;

// Initialize quality analyzer when DOM is ready
function initializeQualityAnalyzer() {
  if (!qualityAnalyzer) {
    qualityAnalyzer = new QualityAnalyzer();
  }
  return qualityAnalyzer.initialize();
}

// Export for global access
window.qualityAnalyzer = qualityAnalyzer;

module.exports = {
  QualityAnalyzer,
  initializeQualityAnalyzer
};
