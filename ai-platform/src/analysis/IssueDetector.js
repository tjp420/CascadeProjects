/**
 * Issue Detection System
 * 
 * Advanced issue detection with automated classification,
 * severity assessment, and resolution recommendations
 */

class IssueDetector {
  constructor(options = {}) {
    this.options = options;
    this.detectors = new Map();
    this.issues = new Map();
    this.detectionHistory = [];
    this.isInitialized = false;
    this.severityThresholds = options.severityThresholds || {
      critical: 0.9,
      high: 0.7,
      medium: 0.5,
      low: 0.3
    };
    this.enableAutoClassification = options.enableAutoClassification !== false;
    this.enableAutoResolution = options.enableAutoResolution !== false;
    
    this.initializeDetectors();
    console.log('[ISSUE_DETECTOR] Issue detector initialized');
  }

  // Initialize detectors
  initializeDetectors() {
    // Structure issue detectors
    this.addDetector('empty_object', {
      name: 'Empty Object Detector',
      description: 'Detects empty objects',
      detector: this.detectEmptyObject.bind(this),
      classifier: this.classifyEmptyObject.bind(this),
      resolver: this.resolveEmptyObject.bind(this),
      category: 'structure',
      defaultSeverity: 'medium'
    });

    this.addDetector('undefined_value', {
      name: 'Undefined Value Detector',
      description: 'Detects undefined values',
      detector: this.detectUndefinedValue.bind(this),
      classifier: this.classifyUndefinedValue.bind(this),
      resolver: this.resolveUndefinedValue.bind(this),
      category: 'content',
      defaultSeverity: 'low'
    });

    this.addDetector('null_value', {
      name: 'Null Value Detector',
      description: 'Detects null values',
      detector: this.detectNullValue.bind(this),
      classifier: this.classifyNullValue.bind(this),
      resolver: this.resolveNullValue.bind(this),
      category: 'content',
      defaultSeverity: 'low'
    });

    // Content issue detectors
    this.addDetector('empty_string', {
      name: 'Empty String Detector',
      description: 'Detects empty strings',
      detector: this.detectEmptyString.bind(this),
      classifier: this.classifyEmptyString.bind(this),
      resolver: this.resolveEmptyString.bind(this),
      category: 'content',
      defaultSeverity: 'low'
    });

    this.addDetector('invalid_format', {
      name: 'Invalid Format Detector',
      description: 'Detects invalid data formats',
      detector: this.detectInvalidFormat.bind(this),
      classifier: this.classifyInvalidFormat.bind(this),
      resolver: this.resolveInvalidFormat.bind(this),
      category: 'format',
      defaultSeverity: 'medium'
    });

    this.addDetector('encoding_issue', {
      name: 'Encoding Issue Detector',
      description: 'Detects encoding issues',
      detector: this.detectEncodingIssue.bind(this),
      classifier: this.classifyEncodingIssue.bind(this),
      resolver: this.resolveEncodingIssue.bind(this),
      category: 'format',
      defaultSeverity: 'medium'
    });

    // Quality issue detectors
    this.addDetector('nan_value', {
      name: 'NaN Value Detector',
      description: 'Detects NaN values',
      detector: this.detectNaNValue.bind(this),
      classifier: this.classifyNaNValue.bind(this),
      resolver: this.resolveNaNValue.bind(this),
      category: 'quality',
      defaultSeverity: 'high'
    });

    this.addDetector('infinite_value', {
      name: 'Infinite Value Detector',
      description: 'Detects infinite values',
      detector: this.detectInfiniteValue.bind(this),
      classifier: this.classifyInfiniteValue.bind(this),
      resolver: this.resolveInfiniteValue.bind(this),
      category: 'quality',
      defaultSeverity: 'high'
    });

    // Security issue detectors
    this.addDetector('sensitive_data', {
      name: 'Sensitive Data Detector',
      description: 'Detects potentially sensitive data',
      detector: this.detectSensitiveData.bind(this),
      classifier: this.classifySensitiveData.bind(this),
      resolver: this.resolveSensitiveData.bind(this),
      category: 'security',
      defaultSeverity: 'high'
    });

    this.addDetector('sql_injection', {
      name: 'SQL Injection Detector',
      description: 'Detects potential SQL injection',
      detector: this.detectSQLInjection.bind(this),
      classifier: this.classifySQLInjection.bind(this),
      resolver: this.resolveSQLInjection.bind(this),
      category: 'security',
      defaultSeverity: 'critical'
    });

    // Performance issue detectors
    this.addDetector('large_file', {
      name: 'Large File Detector',
      description: 'Detects oversized files',
      detector: this.detectLargeFile.bind(this),
      classifier: this.classifyLargeFile.bind(this),
      resolver: this.resolveLargeFile.bind(this),
      category: 'performance',
      defaultSeverity: 'medium'
    });

    this.addDetector('deep_nesting', {
      name: 'Deep Nesting Detector',
      description: 'Detects deeply nested structures',
      detector: this.detectDeepNesting.bind(this),
      classifier: this.classifyDeepNesting.bind(this),
      resolver: this.resolveDeepNesting.bind(this),
      category: 'performance',
      defaultSeverity: 'medium'
    });

    console.log(`[ISSUE_DETECTOR] Initialized ${this.detectors.size} detectors`);
  }

  // Add detector
  addDetector(name, detector) {
    this.detectors.set(name, {
      ...detector,
      usage: 0,
      detections: 0,
      resolutions: 0,
      lastDetected: null
    });
    console.log(`[ISSUE_DETECTOR] Added detector: ${name}`);
  }

  // Initialize issue detector
  async initialize() {
    if (this.isInitialized) {
      console.log('[ISSUE_DETECTOR] Issue detector already initialized');
      return;
    }

    try {
      this.isInitialized = true;
      console.log('[ISSUE_DETECTOR] Issue detector initialized successfully');
      
    } catch (error) {
      console.error('[ISSUE_DETECTOR] Failed to initialize issue detector:', error.message);
      throw error;
    }
  }

  // Detect issues in data
  detectIssues(data, options = {}) {
    const startTime = Date.now();
    const detectedIssues = [];
    
    try {
      // Run all detectors
      this.detectors.forEach((detector, name) => {
        const issues = detector.detector(data, options);
        
        issues.forEach(issue => {
          // Classify issue if auto-classification is enabled
          if (this.enableAutoClassification) {
            const classification = detector.classifier(issue);
            issue.severity = classification.severity || detector.defaultSeverity;
            issue.category = classification.category || detector.category;
            issue.confidence = classification.confidence || 0.8;
          } else {
            issue.severity = detector.defaultSeverity;
            issue.category = detector.category;
            issue.confidence = 0.8;
          }
          
          // Add detector info
          issue.detector = name;
          issue.detectedAt = new Date().toISOString();
          
          detectedIssues.push(issue);
        });
      });
      
      // Filter by severity threshold
      const filteredIssues = detectedIssues.filter(issue => 
        this.severityThresholds[issue.severity] >= this.severityThresholds.low
      );
      
      // Sort by severity and confidence
      const sortedIssues = filteredIssues.sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aSeverity = severityOrder[a.severity] || 0;
        const bSeverity = severityOrder[b.severity] || 0;
        
        if (aSeverity !== bSeverity) {
          return bSeverity - aSeverity;
        }
        
        return b.confidence - a.confidence;
      });
      
      const processingTime = Date.now() - startTime;
      
      // Update detector usage stats
      detectedIssues.forEach(issue => {
        const detector = this.detectors.get(issue.detector);
        if (detector) {
          detector.usage++;
          detector.detections++;
          detector.lastDetected = new Date().toISOString();
        }
      });
      
      // Store in detection history
      this.detectionHistory.push({
        timestamp: new Date().toISOString(),
        dataSize: this.getDataSize(data),
        totalIssues: detectedIssues.length,
        filteredIssues: filteredIssues.length,
        processingTime,
        success: true
      });
      
      return {
        success: true,
        issues: sortedIssues,
        processingTime,
        metadata: {
          totalIssues: detectedIssues.length,
          filteredIssues: filteredIssues.length,
          severityDistribution: this.getSeverityDistribution(sortedIssues),
          categoryDistribution: this.getCategoryDistribution(sortedIssues),
          autoClassification: this.enableAutoClassification,
          autoResolution: this.enableAutoResolution
        }
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Store in detection history
      this.detectionHistory.push({
        timestamp: new Date().toISOString(),
        dataSize: this.getDataSize(data),
        totalIssues: 0,
        filteredIssues: 0,
        processingTime,
        success: false,
        error: error.message
      });
      
      console.error(`[ISSUE_DETECTOR] Issue detection failed: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        processingTime
      };
    }
  }

  // Resolve issues automatically
  async resolveIssues(issues, options = {}) {
    const startTime = Date.now();
    const resolvedIssues = [];
    const unresolvedIssues = [];
    
    try {
      for (const issue of issues) {
        const detector = this.detectors.get(issue.detector);
        
        if (detector && detector.resolver && this.enableAutoResolution) {
          try {
            const resolution = await detector.resolver(issue, options);
            
            if (resolution.success) {
              resolvedIssues.push({
                ...issue,
                resolved: true,
                resolution: resolution.resolution,
                resolvedAt: new Date().toISOString()
              });
              
              // Update detector resolution stats
              detector.resolutions++;
              
            } else {
              unresolvedIssues.push(issue);
            }
          } catch (error) {
            unresolvedIssues.push(issue);
          }
        } else {
          unresolvedIssues.push(issue);
        }
      }
      
      const processingTime = Date.now() - startTime;
      
      // Store in resolution history
      this.detectionHistory.push({
        timestamp: new Date().toISOString(),
        totalIssues: issues.length,
        resolvedIssues: resolvedIssues.length,
        unresolvedIssues: unresolvedIssues.length,
        processingTime,
        success: true
      });
      
      return {
        success: true,
        resolvedIssues,
        unresolvedIssues,
        processingTime,
        metadata: {
          totalIssues: issues.length,
          resolvedIssues: resolvedIssues.length,
          unresolvedIssues: unresolvedIssues.length,
          resolutionRate: (resolvedIssues.length / issues.length) * 100,
          autoResolution: this.enableAutoResolution
        }
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      console.error(`[ISSUE_DETECTOR] Issue resolution failed: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        processingTime,
        resolvedIssues: [],
        unresolvedIssues: issues
      };
    }
  }

  // Structure issue detectors
  detectEmptyObject(data) {
    const issues = [];
    
    if (typeof data === 'object' && data !== null && Object.keys(data).length === 0) {
      issues.push({
        type: 'empty_object',
        description: 'Object is empty',
        field: 'root',
        value: data,
        file: 'unknown'
      });
    }
    
    return issues;
  }

  classifyEmptyObject(issue) {
    return {
      severity: 'medium',
      category: 'structure',
      confidence: 0.9,
      recommendations: [
        'Add required fields to the object',
        'Consider using a default object structure'
      ]
    };
  }

  resolveEmptyObject(issue, options = {}) {
    if (options.defaultValue) {
      return {
        success: true,
        resolution: 'Replaced empty object with default value',
        resolvedData: options.defaultValue
      };
    }
    
    return {
      success: false,
      resolution: 'No default value provided for empty object'
    };
  }

  detectUndefinedValue(data) {
    const issues = [];
    
    if (typeof data === 'object' && data !== null) {
      Object.entries(data).forEach(([key, value]) => {
        if (value === undefined) {
          issues.push({
            type: 'undefined_value',
            description: `Field ${key} has undefined value`,
            field: key,
            value: value,
            file: 'unknown'
          });
        }
      });
    }
    
    return issues;
  }

  classifyUndefinedValue(issue) {
    return {
      severity: 'low',
      category: 'content',
      confidence: 0.7,
      recommendations: [
        'Replace undefined values with null or appropriate defaults',
        'Check for uninitialized variables'
      ]
    };
  }

  resolveUndefinedValue(issue, options = {
    replacement: 'null'
  }) {
    return {
      success: true,
      resolution: `Replaced undefined value with ${options.replacement}`,
      resolvedData: options.replacement
    };
  }

  detectNullValue(data) {
    const issues = [];
    
    if (typeof data === 'object' && data !== null) {
      Object.entries(data).forEach(([key, value]) => {
        if (value === null) {
          issues.push({
            type: 'null_value',
            description: `Field ${key} has null value`,
            field: key,
            value: value,
            file: 'unknown'
          });
        }
      });
    }
    
    return issues;
  }

  classifyNullValue(issue) {
    return {
      severity: 'low',
      category: 'content',
      confidence: 0.6,
      recommendations: [
        'Replace null values with appropriate defaults',
        'Consider if null is a valid state for this field'
      ]
    };
  }

  resolveNullValue(issue, options = {
    replacement: 'null'
  }) {
    return {
      success: true,
      resolution: `Replaced null value with ${options.replacement}`,
      resolvedData: options.replacement
    };
  }

  // Content issue detectors
  detectEmptyString(data) {
    const issues = [];
    
    if (typeof data === 'string' && data.trim() === '') {
      issues.push({
        type: 'empty_string',
        description: 'String is empty',
        field: 'unknown',
        value: data,
        file: 'unknown'
      });
    }
    
    return issues;
  }

  classifyEmptyString(issue) {
    return {
      severity: 'low',
      category: 'content',
      confidence: 0.5,
      recommendations: [
        'Add meaningful content to empty strings',
        'Consider using null if empty string is not valid'
      ]
    };
  }

  resolveEmptyString(issue, options = {
    replacement: null
  }) {
    return {
      success: true,
      resolution: `Replaced empty string with ${options.replacement}`,
      resolvedData: options.replacement
    };
  }

  detectInvalidFormat(data) {
    const issues = [];
    
    if (typeof data === 'object' && data !== null) {
      // Check for circular references
      if (this.hasCircularReference(data)) {
        issues.push({
          type: 'invalid_format',
          description: 'Object contains circular reference',
          field: 'root',
          value: data,
          file: 'unknown'
        });
      }
    }
    
    return issues;
  }

  classifyInvalidFormat(issue) {
    return {
      severity: 'medium',
      category: 'format',
      confidence: 0.7,
      recommendations: [
        'Remove circular references',
        'Restructure data to avoid circular references'
      ]
    };
  }

  resolveInvalidFormat(issue, options = {}) {
    // This would require more complex circular reference resolution
    return {
      success: false,
      resolution: 'Circular reference resolution requires manual review'
    };
  }

  detectEncodingIssue(data) {
    const issues = [];
    
    if (typeof data === 'string') {
      // Check for encoding issues
      if (data.includes('') || data.includes('')) {
        issues.push({
          type: 'encoding_issue',
          description: 'String contains encoding issues',
          field: 'unknown',
          value: data,
          file: 'unknown'
        });
      }
    }
    
    return issues;
  }

  classifyEncodingIssue(issue) {
    return {
      severity: 'medium',
      category: 'format',
      confidence: 0.6,
      recommendations: [
        'Fix encoding issues in the string',
        'Use proper UTF-8 encoding'
      ]
    };
  }

  resolveEncodingIssue(issue, options = {}) {
    const fixedData = issue.value
      .replace(/\uFFFD/g, '')
      .replace(/[\u2018\u2019]/g, "'");
    
    return {
      success: true,
      resolution: 'Fixed encoding issues',
      resolvedData: fixedData
    };
  }

  // Quality issue detectors
  detectNaNValue(data) {
    const issues = [];
    
    if (typeof data === 'number' && isNaN(data)) {
      issues.push({
        type: 'nan_value',
        description: 'Number is NaN',
        field: 'unknown',
        value: data,
        file: 'unknown'
      });
    }
    
    return issues;
  }

  classifyNaNValue(issue) {
    return {
      severity: 'high',
      category: 'quality',
      confidence: 0.9,
      recommendations: [
        'Replace NaN with 0 or appropriate default',
        'Check calculation logic for NaN sources'
      ]
    };
  }

  resolveNaNValue(issue, options = {
    replacement: 0
  }) {
    return {
      success: true,
      resolution: `Replaced NaN with ${options.replacement}`,
      resolvedData: options.replacement
    };
  }

  detectInfiniteValue(data) {
    const issues = [];
    
    if (typeof data === 'number' && !isFinite(data)) {
      issues.push({
        type: 'infinite_value',
        description: 'Number is infinite',
        field: 'unknown',
        value: data,
        file: 'unknown'
      });
    }
    
    return issues;
  }

  classifyInfiniteValue(issue) {
    return {
      severity: 'high',
      category: 'quality',
      confidence: 0.9,
      recommendations: [
        'Replace infinite with appropriate finite value',
        'Check calculation logic for infinite sources'
      ]
    };
  }

  resolveInfiniteValue(issue, options = {
    replacement: 0
  }) {
    return {
      success: true,
      resolution: `Replaced infinite value with ${options.replacement}`,
      resolvedData: options.replacement
    };
  }

  // Security issue detectors
  detectSensitiveData(data) {
    const issues = [];
    
    // Collect all string values
    const strings = this.collectStringValues(data);
    
    // Check for sensitive patterns
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
          issues.push({
            type: 'sensitive_data',
            description: `String contains sensitive data: ${pattern.source}`,
            field: `string_${index}`,
            value: str,
            file: 'unknown'
          });
        }
      });
    });
    
    return issues;
  }

  classifySensitiveData(issue) {
    return {
      severity: 'high',
      category: 'security',
      confidence: 0.8,
      recommendations: [
        'Remove or mask sensitive data',
        'Implement proper data protection'
      ]
    };
  }

  resolveSensitiveData(issue, options = {
    masking: true
  }) {
    if (options.masking) {
      const maskedValue = issue.value.replace(/./g, '*');
      
      return {
        success: true,
        resolution: 'Masked sensitive data',
        resolvedData: maskedValue
      };
    }
    
    return {
      success: false,
      resolution: 'No masking option provided'
    };
  }

  detectSQLInjection(data) {
    const issues = [];
    
    if (typeof data === 'string') {
      // Check for SQL injection patterns
      const injectionPatterns = [
        /DROP\s+TABLE/i,
        /DELETE\s+FROM/i,
        /UPDATE\s+.*\s+SET/i,
        /INSERT\s+INTO/i,
        /UNION\s+SELECT/i,
        /EXEC\s*\(/i,
        /EXECUTE\s*\(/i,
        /SP_\w+/i,
        /XP_\w+/i,
        /--.*\s*(DROP|DELETE|UPDATE|INSERT)/i
      ];
      
      injectionPatterns.forEach(pattern => {
        if (pattern.test(data)) {
          issues.push({
            type: 'sql_injection',
            description: `Potential SQL injection: ${pattern.source}`,
            field: 'unknown',
            value: data,
            file: 'unknown'
          });
        }
      });
    }
    
    return issues;
  }

  classifySQLInjection(issue) {
    return {
      severity: 'critical',
      category: 'security',
      confidence: 0.9,
      recommendations: [
        'Remove SQL injection patterns',
        'Use parameterized queries',
        'Implement input validation'
      ]
    };
  }

  resolveSQLInjection(issue, options = {}) {
    const fixedData = issue.value
      .replace(/DROP\s+TABLE/gi, '-- REMOVED')
      .replace(/DELETE\s+FROM/gi, '-- REMOVED')
      .replace(/UPDATE\s+.*\s+SET/gi, '-- REMOVED')
      .replace(/INSERT\s+INTO/gi, '-- REMOVED')
      .replace(/UNION\s+SELECT/gi, '-- REMOVED')
      .replace(/EXEC\s*\(/gi, '-- REMOVED')
      .replace(/EXECUTE\s*\(/gi, '-- REMOVED')
      .replace(/SP_\w+/gi, '-- REMOVED')
      .replace(/XP_\w+/gi, '-- REMOVED');
    
    return {
      success: true,
      resolution: 'Removed SQL injection patterns',
      resolvedData: fixedData
    };
  }

  // Performance issue detectors
  detectLargeFile(data) {
    const issues = [];
    
    const size = this.getDataSize(data);
    const maxSize = 1024 * 1024; // 1MB
    
    if (size > maxSize) {
      issues.push({
        type: 'large_file',
        description: `Data size (${size} bytes) exceeds maximum (${maxSize} bytes)`,
        field: 'root',
        value: size,
        file: 'unknown'
      });
    }
    
    return issues;
  }

  classifyLargeFile(issue) {
    return {
      severity: 'medium',
      category: 'performance',
      confidence: 0.7,
      recommendations: [
        'Compress or optimize large data',
        'Consider pagination or streaming'
      ]
    };
  }

  resolveLargeFile(issue, options = {}) {
    return {
      success: false,
      resolution: 'Large file splitting requires manual review'
    };
  }

  detectDeepNesting(data) {
    const issues = [];
    
    const maxDepth = 10;
    const depth = this.getMaxDepth(data);
    
    if (depth > maxDepth) {
      issues.push({
        type: 'deep_nesting',
        description: `Data depth (${depth}) exceeds maximum (${maxDepth})`,
        field: 'root',
        value: depth,
        file: 'unknown'
      });
    }
    
    return issues;
  }

  classifyDeepNesting(issue) {
    return {
      severity: 'medium',
      category: 'performance',
      confidence: 0.6,
      recommendations: [
        'Flatten nested structures',
        'Consider using references instead of nesting'
      ]
    };
  }

  resolveDeepNesting(issue, options = {}) {
    return {
      success: false,
      resolution: 'Deep nesting flattening requires manual review'
    };
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

  getDataSize(data) {
    return JSON.stringify(data).length;
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

  getSeverityDistribution(issues) {
    const distribution = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };
    
    issues.forEach(issue => {
      distribution[issue.severity] = (distribution[issue.severity] || 0) + 1;
    });
    
    return distribution;
  }

  getCategoryDistribution(issues) {
    const distribution = {
      structure: 0,
      content: 0,
      format: 0,
      quality: 0,
      security: 0,
      performance: 0
    };
    
    issues.forEach(issue => {
      distribution[issue.category] = (distribution[issue.category] || 0) + 1;
    });
    
    return distribution;
  }

  // Get issue detection statistics
  getStats() {
    const detectorStats = {};
    
    this.detectors.forEach((detector, name) => {
      detectorStats[name] = {
        name,
        type: detector.type,
        usage: detector.usage,
        detections: detector.detections,
        resolutions: detector.resolutions,
        lastDetected: detector.lastDetected,
        category: detector.category,
        defaultSeverity: detector.defaultSeverity,
        hasResolver: !!detector.resolver
      };
    });

    const issueStats = {};
    this.issues.forEach((issue, id) => {
      issueStats[id] = {
        id,
        ...issue
      };
    });

    return {
      detectorStats,
      issueStats,
      totalDetectors: this.detectors.size,
      totalIssues: this.issues.size,
      detectionHistorySize: this.detectionHistory.length,
      averageProcessingTime: this.calculateAverageProcessingTime(),
      overallSuccessRate: this.calculateOverallSuccessRate(),
      severityDistribution: this.getOverallSeverityDistribution(),
      categoryDistribution: this.getOverallCategoryDistribution(),
      autoClassification: this.enableAutoClassification,
      autoResolution: this.enableAutoResolution,
      lastUpdated: new Date().toISOString()
    };
  }

  // Calculate average processing time
  calculateAverageProcessingTime() {
    if (this.detectionHistory.length === 0) return 0;
    
    const processingTimes = this.detectionHistory
      .filter(entry => entry.success)
      .map(entry => entry.processingTime);
    
    return processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
  }

  // Calculate overall success rate
  calculateOverallSuccessRate() {
    if (this.detectionHistory.length === 0) return 0;
    
    const successCount = this.detectionHistory.filter(entry => entry.success).length;
    return (successCount / this.detectionHistory.length) * 100;
  }

  // Get overall severity distribution
  getOverallSeverityDistribution() {
    const allIssues = [];
    
    this.detectionHistory.forEach(entry => {
      if (entry.success) {
        // This would need to be tracked properly
        allIssues.push(
          { severity: 'critical', count: 0 },
          { severity: 'high', count: 0 },
          { severity: 'medium', count: 0 },
          { severity: 'low', count: 0 }
        );
      }
    });
    
    return this.getSeverityDistribution(allIssues);
  }

  // Get overall category distribution
  getOverallCategoryDistribution() {
    const allIssues = [];
    
    this.detectionHistory.forEach(entry => {
      if (entry.success) {
        // This would need to be tracked properly
        allIssues.push(
          { category: 'structure', count: 0 },
          { category: 'content', count: 0 },
          { category: 'format', count: 0 },
          { category: 'quality', count: 0 },
          { category: 'security', count: 0 },
          { category: 'performance', count: 0 }
        );
      }
    });
    
    return this.getCategoryDistribution(allIssues);
  }

  // Get detection history
  getDetectionHistory(limit = 100) {
    return this.detectionHistory.slice(-limit);
  }

  // Get system state
  getState() {
    return {
      isInitialized: this.isInitialized,
      options: this.options,
      detectors: Array.from(this.detectors.entries()).map(([name, detector]) => ({
        name,
        ...detector
      })),
      issues: Array.from(this.issues.entries()).map(([id, issue]) => ({
        id,
        ...issue
      })),
      detectionHistory: this.detectionHistory,
      stats: this.getStats(),
      severityThresholds: this.severityThresholds,
      enableAutoClassification: this.enableAutoClassification,
      enableAutoResolution: this.enableAutoResolution,
      lastUpdated: new Date().toISOString()
    };
  }

  // Destroy issue detector
  destroy() {
    this.detectors.clear();
    this.issues.clear();
    this.detectionHistory = [];
    
    this.isInitialized = false;
    console.log('[ISSUE_DETECTOR] Issue detector destroyed');
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
