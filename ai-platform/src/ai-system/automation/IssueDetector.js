/**
 * Automated Issue Detection System
 * 
 * Real-time issue detection with automatic identification,
  classification, severity assessment, and resolution recommendations
 */

const logger = require('../../lib/app-logger');

class IssueDetector {
  constructor(options = {}) {
    this.options = options;
    this.issueTypes = new Map();
    this.detectionRules = new Map();
    this.issues = new Map();
    this.issueHistory = [];
    this.detectionThresholds = {
      critical: 0.9,
      high: 0.8,
      medium: 0.7,
      low: 0.6
    };
    this.maxIssues = options.maxIssues || 1000;
    this.maxHistory = options.maxHistory || 10000;
    this.isInitialized = false;
    this.detectionInterval = options.detectionInterval || 10000; // 10 seconds
    
    this.initializeIssueTypes();
    this.initializeDetectionRules();
    logger.info('[ISSUE_DETECTOR] Issue detector initialized');
  }

  // Initialize issue types
  initializeIssueTypes() {
    // Data quality issues
    this.addIssueType('missing_field', {
      category: 'data_quality',
      severity: 'high',
      description: 'Required field is missing from data structure',
      autoFixable: true,
      impact: 'medium'
    });

    this.addIssueType('invalid_format', {
      category: 'data_quality',
      severity: 'medium',
      description: 'Data format does not match expected pattern',
      autoFixable: true,
      impact: 'low'
    });

    this.addIssueType('duplicate_data', {
      category: 'data_quality',
      severity: 'medium',
      description: 'Duplicate data detected in dataset',
      autoFixable: true,
      impact: 'medium'
    });

    this.addIssueType('null_value', {
      category: 'data_quality',
      severity: 'low',
      description: 'Null or undefined value found where data expected',
      autoFixable: true,
      impact: 'low'
    });

    // Performance issues
    this.addIssueType('slow_processing', {
      category: 'performance',
      severity: 'medium',
      description: 'Processing time exceeds acceptable threshold',
      autoFixable: false,
      impact: 'high'
    });

    this.addIssueType('memory_leak', {
      category: 'performance',
      severity: 'high',
      description: 'Memory usage continuously increasing',
      autoFixable: false,
      impact: 'high'
    });

    // Security issues
    this.addIssueType('sensitive_data', {
      category: 'security',
      severity: 'high',
      description: 'Sensitive data detected in non-secure context',
      autoFixable: false,
      impact: 'critical'
    });

    this.addIssueType('insecure_format', {
      category: 'security',
      severity: 'medium',
      description: 'Data format may pose security risk',
      autoFixable: true,
      impact: 'medium'
    });

    // Consistency issues
    this.addIssueType('type_mismatch', {
      category: 'consistency',
      severity: 'medium',
      description: 'Data type does not match expected type',
      autoFixable: true,
      impact: 'medium'
    });

    this.addIssueType('schema_violation', {
      category: 'consistency',
      severity: 'high',
      description: 'Data structure violates defined schema',
      autoFixable: true,
      impact: 'high'
    });

    // Business logic issues
    this.addIssueType('invalid_business_rule', {
      category: 'business_logic',
      severity: 'medium',
      description: 'Data violates business logic rules',
      autoFixable: false,
      impact: 'medium'
    });

    this.addIssueType('data_corruption', {
      category: 'business_logic',
      severity: 'critical',
      description: 'Data appears to be corrupted or invalid',
      autoFixable: false,
      impact: 'critical'
    });

    logger.debug(`[ISSUE_DETECTOR] Initialized ${this.issueTypes.size} issue types`);
  }

  // Initialize detection rules
  initializeDetectionRules() {
    // Missing field detection
    this.addDetectionRule('missing_field_detection', {
      types: ['missing_field'],
      detect: (data, context) => this.detectMissingFields(data, context),
      confidence: 0.95
    });

    // Format validation detection
    this.addDetectionRule('format_validation', {
      types: ['invalid_format', 'insecure_format'],
      detect: (data, context) => this.detectFormatIssues(data, context),
      confidence: 0.90
    });

    // Duplicate detection
    this.addDetectionRule('duplicate_detection', {
      types: ['duplicate_data'],
      detect: (data, context) => this.detectDuplicates(data, context),
      confidence: 0.85
    });

    // Null value detection
    this.addDetectionRule('null_detection', {
      types: ['null_value'],
      detect: (data, context) => this.detectNullValues(data, context),
      confidence: 0.80
    });

    // Performance detection
    this.addDetectionRule('performance_detection', {
      types: ['slow_processing', 'memory_leak'],
      detect: (data, context) => this.detectPerformanceIssues(data, context),
      confidence: 0.85
    });

    // Security detection
    this.addDetectionRule('security_detection', {
      types: ['sensitive_data', 'insecure_format'],
      detect: (data, context) => this.detectSecurityIssues(data, context),
      confidence: 0.90
    });

    // Consistency detection
    this.addDetectionRule('consistency_detection', {
      types: ['type_mismatch', 'schema_violation'],
      detect: (data, context) => this.detectConsistencyIssues(data, context),
      confidence: 0.85
    });

    // Business logic detection
    this.addDetectionRule('business_logic_detection', {
      types: ['invalid_business_rule', 'data_corruption'],
      detect: (data, context) => this.detectBusinessLogicIssues(data, context),
      confidence: 0.80
    });

    logger.debug(`[ISSUE_DETECTOR] Initialized ${this.detectionRules.size} detection rules`);
  }

  // Add issue type
  addIssueType(name, issueType) {
    this.issueTypes.set(name, {
      ...issueType,
      detectedCount: 0,
      fixedCount: 0,
      lastDetected: null
    });
    logger.debug(`[ISSUE_DETECTOR] Added issue type: ${name}`);
  }

  // Add detection rule
  addDetectionRule(name, rule) {
    this.detectionRules.set(name, {
      ...rule,
      enabled: true,
      lastRun: null,
      runCount: 0
    });
    logger.debug(`[ISSUE_DETECTOR] Added detection rule: ${name}`);
  }

  // Initialize system
  async initialize() {
    if (this.isInitialized) {
      logger.debug('[ISSUE_DETECTOR] Issue detector already initialized');
      return;
    }

    try {
      // Load issue history
      this.loadIssueHistory();
      
      // Start detection loop
      this.startDetectionLoop();
      
      this.isInitialized = true;
      logger.info('[ISSUE_DETECTOR] Issue detector initialized successfully');
      
    } catch (error) {
      console.error('[ISSUE_DETECTOR] Failed to initialize issue detector:', error.message);
      throw error;
    }
  }

  // Detect issues in data
  detectIssues(data, context = {}) {
    const detectedIssues = [];
    
    this.detectionRules.forEach((rule, ruleName) => {
      if (!rule.enabled) return;
      
      try {
        const ruleResults = rule.detect(data, context);
        
        if (ruleResults && ruleResults.length > 0) {
          ruleResults.forEach(result => {
            const issue = this.createIssue(result, rule, ruleName, data, context);
            detectedIssues.push(issue);
            this.addIssue(issue);
          });
        }
        
        // Update rule stats
        rule.lastRun = new Date().toISOString();
        rule.runCount++;
        
      } catch (error) {
        console.error(`[ISSUE_DETECTOR] Error in detection rule ${ruleName}:`, error.message);
      }
    });

    return detectedIssues;
  }

  // Create issue object
  createIssue(result, rule, ruleName, data, context) {
    const issueType = this.issueTypes.get(result.type);
    if (!issueType) {
      console.warn(`[ISSUE_DETECTOR] Unknown issue type: ${result.type}`);
      return null;
    }

    return {
      id: this.generateIssueId(),
      type: result.type,
      category: issueType.category,
      severity: result.severity || issueType.severity,
      title: result.title || `${issueType.description}`,
      description: result.description || issueType.description,
      location: result.location || this.extractLocation(data, result),
      timestamp: new Date().toISOString(),
      data: {
        sample: result.sample || this.extractSample(data, result),
        context: context,
        rule: ruleName,
        confidence: result.confidence || rule.confidence
      },
      impact: issueType.impact,
      autoFixable: issueType.autoFixable,
      status: 'detected',
      acknowledged: false,
      resolved: false,
      fixAttempts: 0,
      recommendations: this.generateRecommendations(result, issueType)
    };
  }

  // Add issue to tracking
  addIssue(issue) {
    if (!issue) return;
    
    this.issues.set(issue.id, issue);
    this.issueHistory.push(issue);
    
    // Update issue type stats
    const issueType = this.issueTypes.get(issue.type);
    if (issueType) {
      issueType.detectedCount++;
      issueType.lastDetected = issue.timestamp;
    }
    
    // Keep only max issues
    if (this.issues.size > this.maxIssues) {
      const oldestId = this.issues.keys().next().value;
      this.issues.delete(oldestId);
    }
    
    // Keep only max history
    if (this.issueHistory.length > this.maxHistory) {
      this.issueHistory = this.issueHistory.slice(-this.maxHistory);
    }
    
    logger.info(`[ISSUE_DETECTOR] Issue detected: ${issue.type} - ${issue.title}`);
  }

  // Detection methods
  detectMissingFields(data, context) {
    const issues = [];
    
    if (typeof data !== 'object' || data === null) {
      return issues;
    }

    const requiredFields = context.requiredFields || ['id', 'name', 'created_at'];
    const dataFields = Object.keys(data);
    
    requiredFields.forEach(field => {
      if (!dataFields.includes(field)) {
        issues.push({
          type: 'missing_field',
          location: `field:${field}`,
          description: `Required field '${field}' is missing`,
          severity: 'high',
          confidence: 0.95
        });
      }
    });

    return issues;
  }

  detectFormatIssues(data, context) {
    const issues = [];
    
    if (typeof data === 'string') {
      // Check for common format issues
      if (data.includes('undefined') || data.includes('NaN')) {
        issues.push({
          type: 'invalid_format',
          location: 'string_content',
          description: 'String contains undefined or NaN values',
          severity: 'medium',
          confidence: 0.90
        });
      }
      
      // Check for encoding issues
      if (data.includes('') || data.includes('')) {
        issues.push({
          type: 'invalid_format',
          location: 'string_encoding',
          description: 'String contains encoding issues',
          severity: 'medium',
          confidence: 0.85
        });
      }
    }

    if (typeof data === 'object' && data !== null) {
      Object.entries(data).forEach(([key, value]) => {
        if (typeof value === 'string') {
          // Check email format
          if (key.toLowerCase().includes('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            issues.push({
              type: 'invalid_format',
              location: `field:${key}`,
              description: `Email field '${key}' has invalid format`,
              severity: 'medium',
              confidence: 0.90
            });
          }
          
          // Check date format
          if (key.toLowerCase().includes('date') || key.toLowerCase().includes('time')) {
            if (!/^\d{4}-\d{2}-\d{2}/.test(value) && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
              issues.push({
                type: 'invalid_format',
                location: `field:${key}`,
                description: `Date/time field '${key}' has invalid format`,
                severity: 'medium',
                confidence: 0.85
              });
            }
          }
        }
      });
    }

    return issues;
  }

  detectDuplicates(data, context) {
    const issues = [];
    
    if (!context.dataset || context.dataset.length < 2) {
      return issues;
    }

    // Simple duplicate detection based on content similarity
    const dataStr = JSON.stringify(data);
    
    context.dataset.forEach((otherData, index) => {
      if (otherData === data) return;
      
      const otherStr = JSON.stringify(otherData);
      const similarity = this.calculateSimilarity(dataStr, otherStr);
      
      if (similarity > 0.9) {
        issues.push({
          type: 'duplicate_data',
          location: `index:${index}`,
          description: `Duplicate data detected (similarity: ${Math.round(similarity * 100)}%)`,
          severity: 'medium',
          confidence: similarity
        });
      }
    });

    return issues;
  }

  detectNullValues(data, context) {
    const issues = [];
    
    if (typeof data === 'object' && data !== null) {
      Object.entries(data).forEach(([key, value]) => {
        if (value === null || value === undefined) {
          issues.push({
            type: 'null_value',
            location: `field:${key}`,
            description: `Field '${key}' has null/undefined value`,
            severity: 'low',
            confidence: 0.80
          });
        }
        
        if (typeof value === 'string' && value.trim() === '') {
          issues.push({
            type: 'null_value',
            location: `field:${key}`,
            description: `Field '${key}' has empty string value`,
            severity: 'low',
            confidence: 0.75
          });
        }
      });
    }

    return issues;
  }

  detectPerformanceIssues(data, context) {
    const issues = [];
    
    // Check processing time
    if (context.processingTime && context.processingTime > 5000) { // 5 seconds
      issues.push({
        type: 'slow_processing',
        location: 'processing',
        description: `Processing time ${context.processingTime}ms exceeds threshold`,
        severity: 'medium',
        confidence: 0.85
      });
    }
    
    // Check memory usage
    if (context.memoryUsage && context.memoryUsage > 100000000) { // 100MB
      issues.push({
        type: 'memory_leak',
        location: 'memory',
        description: `Memory usage ${Math.round(context.memoryUsage / 1024 / 1024)}MB exceeds threshold`,
        severity: 'high',
        confidence: 0.90
      });
    }

    return issues;
  }

  detectSecurityIssues(data, context) {
    const issues = [];
    
    const dataStr = JSON.stringify(data);
    
    // Check for sensitive data patterns
    const sensitivePatterns = [
      { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, type: 'credit_card', severity: 'critical' },
      { pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/, type: 'ssn', severity: 'critical' },
      { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, type: 'email', severity: 'medium' },
      { pattern: /\b\d{3}[-\s]?\d{3}[-\s]?\d{4}\b/, type: 'phone', severity: 'medium' },
      { pattern: /password|secret|token|key/i, type: 'credential', severity: 'high' }
    ];
    
    sensitivePatterns.forEach(({ pattern, type, severity }) => {
      if (pattern.test(dataStr)) {
        issues.push({
          type: 'sensitive_data',
          location: 'content',
          description: `Sensitive data detected: ${type}`,
          severity,
          confidence: 0.90
        });
      }
    });

    // Check for insecure formats
    if (dataStr.includes('http://') && !dataStr.includes('https://')) {
      issues.push({
        type: 'insecure_format',
        location: 'content',
        description: 'Insecure HTTP URL detected',
        severity: 'medium',
        confidence: 0.85
      });
    }

    return issues;
  }

  detectConsistencyIssues(data, context) {
    const issues = [];
    
    if (typeof data !== 'object' || data === null) {
      return issues;
    }

    // Check type consistency
    if (context.expectedTypes) {
      Object.entries(context.expectedTypes).forEach(([field, expectedType]) => {
        if (data.hasOwnProperty(field)) {
          const actualType = typeof data[field];
          
          if (!this.typeMatches(actualType, expectedType)) {
            issues.push({
              type: 'type_mismatch',
              location: `field:${field}`,
              description: `Field '${field}' type mismatch: expected ${expectedType}, got ${actualType}`,
              severity: 'medium',
              confidence: 0.85
            });
          }
        }
      });
    }

    // Check schema violations
    if (context.schema) {
      const validation = this.validateAgainstSchema(data, context.schema);
      if (!validation.valid) {
        issues.push({
          type: 'schema_violation',
          location: 'schema',
          description: `Schema violation: ${validation.errors.join(', ')}`,
          severity: 'high',
          confidence: 0.90
        });
      }
    }

    return issues;
  }

  detectBusinessLogicIssues(data, context) {
    const issues = [];
    
    if (typeof data !== 'object' || data === null) {
      return issues;
    }

    // Check business rules
    if (context.businessRules) {
      context.businessRules.forEach(rule => {
        try {
          const result = rule.validate(data);
          if (!result.valid) {
            issues.push({
              type: 'invalid_business_rule',
              location: 'business_logic',
              description: `Business rule violation: ${rule.name} - ${result.message}`,
              severity: 'medium',
              confidence: 0.80
            });
          }
        } catch (error) {
          console.error(`[ISSUE_DETECTOR] Error in business rule ${rule.name}:`, error.message);
        }
      });
    }

    // Check for data corruption
    if (this.detectDataCorruption(data)) {
      issues.push({
        type: 'data_corruption',
        location: 'content',
        description: 'Potential data corruption detected',
        severity: 'critical',
        confidence: 0.95
      });
    }

    return issues;
  }

  // Helper methods
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (shorter[i] === longer[i]) matches++;
    }
    
    return matches / longer.length;
  }

  typeMatches(actual, expected) {
    const typeMap = {
      'string': ['string'],
      'number': ['number', 'integer'],
      'boolean': ['boolean'],
      'object': ['object'],
      'array': ['array'],
      'date': ['string'],
      'email': ['string'],
      'url': ['string']
    };
    
    const expectedTypes = typeMap[expected] || [expected];
    return expectedTypes.includes(actual);
  }

  validateAgainstSchema(data, schema) {
    // Simplified schema validation
    const result = { valid: true, errors: [] };
    
    if (schema.required) {
      schema.required.forEach(field => {
        if (!data.hasOwnProperty(field)) {
          result.errors.push(`Missing required field: ${field}`);
          result.valid = false;
        }
      });
    }
    
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([field, rules]) => {
        if (data.hasOwnProperty(field)) {
          if (rules.type && typeof data[field] !== rules.type) {
            result.errors.push(`Field ${field} type mismatch`);
            result.valid = false;
          }
        }
      });
    }
    
    return result;
  }

  detectDataCorruption(data) {
    // Simple corruption detection
    const dataStr = JSON.stringify(data);
    
    // Check for common corruption patterns
    const corruptionPatterns = [
      /\x00/, // Null bytes
      /\ufffd/, // Replacement character
      /\[object Object\]/, // Stringified object
      /undefined/ // Undefined values
    ];
    
    return corruptionPatterns.some(pattern => pattern.test(dataStr));
  }

  extractLocation(data, result) {
    if (result.location) return result.location;
    
    if (typeof data === 'object' && data !== null) {
      return 'object';
    }
    
    return 'root';
  }

  extractSample(data, result) {
    if (result.sample) return result.sample;
    
    if (typeof data === 'object' && data !== null) {
      const sample = {};
      Object.keys(data).slice(0, 3).forEach(key => {
        sample[key] = data[key];
      });
      return sample;
    }
    
    return data;
  }

  generateRecommendations(result, issueType) {
    const recommendations = [];
    
    if (issueType.autoFixable) {
      recommendations.push({
        action: 'auto_fix',
        description: 'This issue can be automatically fixed',
        priority: 'high'
      });
    }
    
    switch (result.type) {
      case 'missing_field':
        recommendations.push({
          action: 'add_field',
          description: 'Add the missing field with appropriate default value',
          priority: 'high'
        });
        break;
      case 'invalid_format':
        recommendations.push({
          action: 'format_correction',
          description: 'Correct the data format according to specifications',
          priority: 'medium'
        });
        break;
      case 'duplicate_data':
        recommendations.push({
          action: 'remove_duplicate',
          description: 'Remove or merge duplicate data entries',
          priority: 'medium'
        });
        break;
      case 'sensitive_data':
        recommendations.push({
          action: 'encrypt_data',
          description: 'Encrypt or mask sensitive data',
          priority: 'critical'
        });
        break;
      case 'type_mismatch':
        recommendations.push({
          action: 'type_conversion',
          description: 'Convert data to expected type',
          priority: 'medium'
        });
        break;
    }
    
    return recommendations;
  }

  // Start detection loop
  startDetectionLoop() {
    if (this.detectionIntervalId) {
      clearInterval(this.detectionIntervalId);
    }

    this.detectionIntervalId = setInterval(() => {
      this.performDetection();
    }, this.detectionInterval);

    logger.debug(`[ISSUE_DETECTOR] Detection loop started (${this.detectionInterval}ms interval)`);
  }

  // Stop detection loop
  stopDetectionLoop() {
    if (this.detectionIntervalId) {
      clearInterval(this.detectionIntervalId);
      this.detectionIntervalId = null;
    }
    
    logger.debug('[ISSUE_DETECTOR] Detection loop stopped');
  }

  // Perform detection
  performDetection() {
    // In a real implementation, this would fetch current data
    // For now, we'll just log the status
    const activeIssues = Array.from(this.issues.values()).filter(issue => !issue.resolved);
    
    if (activeIssues.length > 0) {
      logger.debug(`[ISSUE_DETECTOR] Active issues: ${activeIssues.length}`);
    }
  }

  // Get issue statistics
  getIssueStats() {
    const active = Array.from(this.issues.values()).filter(issue => !issue.resolved);
    const bySeverity = {
      critical: active.filter(i => i.severity === 'critical').length,
      high: active.filter(i => i.severity === 'high').length,
      medium: active.filter(i => i.severity === 'medium').length,
      low: active.filter(i => i.severity === 'low').length
    };

    const byCategory = {
      data_quality: active.filter(i => i.category === 'data_quality').length,
      performance: active.filter(i => i.category === 'performance').length,
      security: active.filter(i => i.category === 'security').length,
      consistency: active.filter(i => i.category === 'consistency').length,
      business_logic: active.filter(i => i.category === 'business_logic').length
    };

    return {
      total: active.length,
      bySeverity,
      byCategory,
      autoFixable: active.filter(i => i.autoFixable).length,
      acknowledged: active.filter(i => i.acknowledged).length,
      resolved: this.issues.size - active.length,
      detectionRules: this.detectionRules.size,
      issueTypes: this.issueTypes.size,
      historySize: this.issueHistory.length,
      lastUpdated: new Date().toISOString()
    };
  }

  // Generate issue ID
  generateIssueId() {
    return `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Load issue history
  loadIssueHistory() {
    try {
      const saved = localStorage.getItem('issue_history');
      if (saved) {
        this.issueHistory = JSON.parse(saved);
        logger.debug(`[ISSUE_DETECTOR] Loaded ${this.issueHistory.length} issues from history`);
      }
    } catch (error) {
      console.warn('[ISSUE_DETECTOR] Failed to load issue history:', error.message);
    }
  }

  // Save issue history
  saveIssueHistory() {
    try {
      localStorage.setItem('issue_history', JSON.stringify(this.issueHistory));
      logger.debug(`[ISSUE_DETECTOR] Saved ${this.issueHistory.length} issues to history`);
    } catch (error) {
      console.warn('[ISSUE_DETECTOR] Failed to save issue history:', error.message);
    }
  }

  // Get active issues
  getActiveIssues() {
    return Array.from(this.issues.values()).filter(issue => !issue.resolved);
  }

  // Get issues by severity
  getIssuesBySeverity(severity) {
    return Array.from(this.issues.values()).filter(issue => issue.severity === severity);
  }

  // Get issues by category
  getIssuesByCategory(category) {
    return Array.from(this.issues.values()).filter(issue => issue.category === category);
  }

  // Acknowledge issue
  acknowledgeIssue(issueId) {
    const issue = this.issues.get(issueId);
    if (issue) {
      issue.acknowledged = true;
      issue.acknowledgedAt = new Date().toISOString();
      logger.info(`[ISSUE_DETECTOR] Issue acknowledged: ${issueId}`);
      return true;
    }
    return false;
  }

  // Resolve issue
  resolveIssue(issueId, resolution = 'resolved') {
    const issue = this.issues.get(issueId);
    if (issue) {
      issue.resolved = true;
      issue.resolvedAt = new Date().toISOString();
      issue.resolution = resolution;
      
      // Update issue type stats
      const issueType = this.issueTypes.get(issue.type);
      if (issueType) {
        issueType.fixedCount++;
      }
      
      logger.info(`[ISSUE_DETECTOR] Issue resolved: ${issueId} - ${resolution}`);
      return true;
    }
    return false;
  }

  // Export issues
  exportIssues() {
    const exportData = {
      issues: Array.from(this.issues.values()),
      history: this.issueHistory,
      issueTypes: Array.from(this.issueTypes.entries()).map(([name, type]) => ({
        name,
        ...type
      })),
      detectionRules: Array.from(this.detectionRules.entries()).map(([name, rule]) => ({
        name,
        ...rule
      })),
      stats: this.getIssueStats(),
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `issue-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObject(url);
    
    logger.debug('[ISSUE_DETECTOR] Issues exported');
  }

  // Get system state
  getState() {
    return {
      isInitialized: this.isInitialized,
      issues: Array.from(this.issues.values()),
      issueHistory: this.issueHistory,
      issueTypes: Array.from(this.issueTypes.entries()).map(([name, type]) => ({
        name,
        ...type
      })),
      detectionRules: Array.from(this.detectionRules.entries()).map(([name, rule]) => ({
        name,
        ...rule
      })),
      detectionThresholds: this.detectionThresholds,
      maxIssues: this.maxIssues,
      maxHistory: this.maxHistory,
      stats: this.getIssueStats()
    };
  }

  // Destroy issue detector
  destroy() {
    // Save history before destroying
    this.saveIssueHistory();
    
    // Stop detection loop
    this.stopDetectionLoop();
    
    // Clear all data
    this.issues.clear();
    this.issueHistory = [];
    
    this.isInitialized = false;
    logger.info('[ISSUE_DETECTOR] Issue detector destroyed');
  }
}

// Global instance
let issueDetector = null;

// Initialize issue detector when DOM is ready
function initializeIssueDetector() {
  if (!issueDetector) {
    issueDetector = new IssueDetector();
  }
  return issueDetector.initialize();
}

// Export for global access
window.issueDetector = issueDetector;

module.exports = {
  IssueDetector,
  initializeIssueDetector
};
