const logger = require('../lib/production-logger');
/**
 * Analysis Engine Core System
 * 
 * Comprehensive analysis processing engine with pipeline architecture,
 * pattern detection, issue identification, and quality assessment
 */

class AnalysisEngine {
  constructor(options = {}) {
    this.options = options;
    this.pipeline = new Map();
    this.jobs = new Map();
    this.patterns = new Map();
    this.issues = new Map();
    this.history = [];
    this.metrics = new Map();
    this.isInitialized = false;
    this.maxConcurrentJobs = options.maxConcurrentJobs || 10;
    this.jobTimeout = options.jobTimeout || 60000; // 1 minute
    this.enableRealTimeAnalysis = options.enableRealTimeAnalysis !== false;
    
    this.initializeAnalyzers();
    logger.debug('[ANALYSIS_ENGINE] Analysis engine initialized');
  }

  // Initialize analyzers
  initializeAnalyzers() {
    // Pattern analyzer
    this.addAnalyzer('pattern_detector', {
      name: 'Pattern Detector',
      description: 'Detects patterns in data structures and content',
      analyzer: this.detectPatterns.bind(this),
      validator: this.validatePatterns.bind(this),
      category: 'pattern',
      priority: 'high'
    });

    // Issue analyzer
    this.addAnalyzer('issue_detector', {
      name: 'Issue Detector',
      description: 'Identifies issues and problems in data',
      analyzer: this.detectIssues.bind(this),
      validator: this.validateIssues.bind(this),
      category: 'issue',
      priority: 'high'
    });

    // Quality analyzer
    this.addAnalyzer('quality_analyzer', {
      name: 'Quality Analyzer',
      description: 'Assesses data quality and provides scoring',
      analyzer: this.analyzeQuality.bind(this),
      validator: this.validateQuality.bind(this),
      category: 'quality',
      priority: 'medium'
    });

    // Structure analyzer
    this.addAnalyzer('structure_analyzer', {
      name: 'Structure Analyzer',
      description: 'Analyzes data structures and hierarchies',
      analyzer: this.analyzeStructure.bind(this),
      validator: this.validateStructure.bind(this),
      category: 'structure',
      priority: 'medium'
    });

    // Content analyzer
    this.addAnalyzer('content_analyzer', {
      name: 'Content Analyzer',
      description: 'Analyzes data content and values',
      analyzer: this.analyzeContent.bind(this),
      validator: this.validateContent.bind(this),
      category: 'content',
      priority: 'medium'
    });

    // Performance analyzer
    this.addAnalyzer('performance_analyzer', {
      name: 'Performance Analyzer',
      description: 'Analyzes performance characteristics',
      analyzer: this.analyzePerformance.bind(this),
      validator: this.validatePerformance.bind(this),
      category: 'performance',
      priority: 'low'
    });

    logger.debug(`[ANALYSIS_ENGINE] Initialized ${this.analyzers.size} analyzers`);
  }

  // Add analyzer
  addAnalyzer(name, analyzer) {
    this.analyzers = this.analyzers || new Map();
    this.analyzers.set(name, {
      ...analyzer,
      usage: 0,
      avgProcessingTime: 0,
      totalProcessingTime: 0,
      successCount: 0,
      failureCount: 0,
      lastUsed: null
    });
    logger.debug(`[ANALYSIS_ENGINE] Added analyzer: ${name}`);
  }

  // Initialize analysis engine
  async initialize() {
    if (this.isInitialized) {
      logger.debug('[ANALYSIS_ENGINE] Analysis engine already initialized');
      return;
    }

    try {
      // Start job processing
      this.startJobProcessing();
      
      this.isInitialized = true;
      logger.debug('[ANALYSIS_ENGINE] Analysis engine initialized successfully');
      
    } catch (error) {
      console.error('[ANALYSIS_ENGINE] Failed to initialize analysis engine:', error.message);
      throw error;
    }
  }

  // Start job processing
  startJobProcessing() {
    if (this.jobProcessingIntervalId) {
      clearInterval(this.jobProcessingIntervalId);
    }

    this.jobProcessingIntervalId = setInterval(() => {
      this.processJobs();
    }, 1000);

    logger.debug('[ANALYSIS_ENGINE] Job processing started');
  }

  // Stop job processing
  stopJobProcessing() {
    if (this.jobProcessingIntervalId) {
      clearInterval(this.jobProcessingIntervalId);
      this.jobProcessingIntervalId = null;
    }
    
    logger.debug('[ANALYSIS_ENGINE] Job processing stopped');
  }

  // Process analysis jobs
  processJobs() {
    const activeJobs = Array.from(this.jobs.values()).filter(job => job.status === 'pending' || job.status === 'processing');
    
    // Process jobs up to the concurrency limit
    const jobsToProcess = activeJobs.slice(0, this.maxConcurrentJobs);
    
    jobsToProcess.forEach(job => {
      if (job.status === 'pending') {
        this.startJob(job.id);
      }
    });
  }

  // Start analysis job
  async startJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    job.status = 'processing';
    job.startedAt = new Date().toISOString();
    job.progress = 0;
    
    logger.debug(`[ANALYSIS_ENGINE] Starting analysis job: ${jobId}`);

    try {
      // Process through analysis pipeline
      for (const [stepName, step] of this.pipeline) {
        job.currentStep = stepName;
        job.progress = this.calculateProgress(job);
        
        const result = await step.execute(job);
        
        if (!result.success) {
          throw new Error(`Pipeline step ${stepName} failed: ${result.error}`);
        }
        
        job.results[stepName] = result;
      }
      
      // Mark as completed
      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.progress = 100;
      
      // Update analyzer usage stats
      const analyzer = this.analyzers.get(job.analyzer);
      if (analyzer) {
        analyzer.usage++;
        analyzer.totalProcessingTime += job.processingTime;
        analyzer.avgProcessingTime = analyzer.totalProcessingTime / analyzer.usage;
        analyzer.successCount++;
        analyzer.lastUsed = new Date().toISOString();
      }
      
      logger.debug(`[ANALYSIS_ENGINE] Analysis job completed: ${jobId}`);
      
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.failedAt = new Date().toISOString();
      
      // Update analyzer failure stats
      const analyzer = this.analyzers.get(job.analyzer);
      if (analyzer) {
        analyzer.failureCount++;
        analyzer.totalProcessingTime += job.processingTime;
        analyzer.avgProcessingTime = analyzer.totalProcessingTime / Math.max(1, analyzer.usage);
        analyzer.lastUsed = new Date().toISOString();
      }
      
      console.error(`[ANALYSIS_ENGINE] Analysis job failed: ${jobId} - ${error.message}`);
      
      // Attempt recovery
      await this.attemptRecovery(job);
    }
  }

  // Attempt job recovery
  async attemptRecovery(job) {
    if (job.retryCount >= 3) {
      logger.debug(`[ANALYSIS_ENGINE] Max retries exceeded for job: ${job.id}`);
      return;
    }

    job.status = 'recovering';
    job.retryCount++;
    job.progress = 0;
    
    logger.debug(`[ANALYSIS_ENGINE] Attempting recovery for job: ${job.id} (attempt ${job.retryCount})`);

    try {
      // Reset job state for recovery
      job.results = {};
      job.error = null;
      
      // Retry from failed step
      const failedStep = job.currentStep;
      const step = this.pipeline.get(failedStep);
      
      if (step) {
        const result = await step.execute(job);
        if (result.success) {
          job.status = 'processing';
          logger.debug(`[ANALYSIS_ENGINE] Recovery successful for job: ${job.id}`);
        }
      }
    } catch (error) {
      console.error(`[ANALYSIS_ENGINE] Recovery failed for job: ${job.id} - ${error.message}`);
    }
  }

  // Create analysis job
  createJob(options) {
    const jobId = this.generateJobId();
    
    const job = {
      id: jobId,
      type: options.type || 'data_analysis',
      source: options.source || 'unknown',
      analyzer: options.analyzer || 'pattern_detector',
      data: options.data,
      config: options.config || {},
      status: 'pending',
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      failedAt: null,
      progress: 0,
      currentStep: null,
      results: {},
      processingTime: 0,
      error: null,
      retryCount: 0
    };

    this.jobs.set(jobId, job);
    logger.debug(`[ANALYSIS_ENGINE] Created analysis job: ${jobId}`);
    
    return job;
  }

  // Generate job ID
  generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Calculate job progress
  calculateProgress(job) {
    const totalSteps = this.pipeline.size;
    const completedSteps = Object.values(job.results).filter(result => result.success).length;
    return totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
  }

  // Get job status
  getJobStatus(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }

    return {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      failedAt: job.failedAt,
      processingTime: job.processingTime,
      error: job.error,
      retryCount: job.retryCount,
      results: job.results
    };
  }

  // Get all jobs
  getJobs() {
    return Array.from(this.jobs.values()).map(job => ({
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      failedAt: job.failedAt,
      processingTime: job.processingTime,
      error: job.error,
      retryCount: job.retryCount
    }));
  }

  // Get active jobs
  getActiveJobs() {
    return Array.from(this.jobs.values()).filter(job => 
      job.status === 'pending' || job.status === 'processing' || job.status === 'recovering'
    );
  }

  // Get completed jobs
  getCompletedJobs() {
    return Array.from(this.jobs.values()).filter(job => 
      job.status === 'completed'
    );
  }

  // Cancel job
  cancelJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    if (job.status === 'completed') {
      return false;
    }

    job.status = 'cancelled';
    job.cancelledAt = new Date().toISOString();
    
    logger.debug(`[ANALYSIS_ENGINE] Cancelled analysis job: ${jobId}`);
    return true;
  }

  // Delete job
  deleteJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    if (job.status === 'processing') {
      return false;
    }

    this.jobs.delete(jobId);
    logger.debug(`[ANALYSIS_ENGINE] Deleted analysis job: ${jobId}`);
    return true;
  }

  // Analyze data using specified analyzer
  analyzeData(data, analyzerName, options = {}) {
    const analyzer = this.analyzers.get(analyzerName);
    if (!analyzer) {
      throw new Error(`Analyzer not found: ${analyzerName}`);
    }

    const startTime = Date.now();
    
    try {
      const result = analyzer.analyzer(data, options);
      const processingTime = Date.now() - startTime;
      
      // Update analyzer stats
      analyzer.usage++;
      analyzer.totalProcessingTime += processingTime;
      analyzer.avgProcessingTime = analyzer.totalProcessingTime / analyzer.usage;
      analyzer.successCount++;
      analyzer.lastUsed = new Date().toISOString();
      
      return {
        success: true,
        data: result,
        processingTime,
        metadata: {
          analyzer: analyzerName,
          analysisScore: result.score || 100,
          patterns: result.patterns || [],
          issues: result.issues || [],
          recommendations: result.recommendations || []
        }
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Update analyzer failure stats
      if (analyzer) {
        analyzer.failureCount++;
        analyzer.totalProcessingTime += processingTime;
        analyzer.avgProcessingTime = analyzer.totalProcessingTime / Math.max(1, analyzer.usage);
        analyzer.lastUsed = new Date().toISOString();
      }
      
      console.error(`[ANALYSIS_ENGINE] Analysis failed: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        processingTime
      };
    }
  }

  // Pattern detection methods
  detectPatterns(data, _options = {}) {
    const patterns = [];
    
    // Detect structure patterns
    if (typeof data === 'object' && data !== null) {
      patterns.push(...this.detectStructurePatterns(data));
    }
    
    // Detect content patterns
    patterns.push(...this.detectContentPatterns(data));
    
    // Detect behavioral patterns
    patterns.push(...this.detectBehavioralPatterns(data));
    
    return {
      patterns,
      score: this.calculatePatternScore(patterns),
      recommendations: this.generatePatternRecommendations(patterns)
    };
  }

  detectStructurePatterns(data) {
    const patterns = [];
    
    if (Array.isArray(data)) {
      patterns.push({
        type: 'array_structure',
        description: 'Data is structured as an array',
        confidence: 0.9,
        metadata: {
          length: data.length,
          itemTypes: this.getItemTypes(data)
        }
      });
    } else if (typeof data === 'object' && data !== null) {
      patterns.push({
        type: 'object_structure',
        description: 'Data is structured as an object',
        confidence: 0.9,
        metadata: {
          keys: Object.keys(data),
          keyTypes: this.getKeyTypes(data)
        }
      });
    }
    
    return patterns;
  }

  detectContentPatterns(data) {
    const patterns = [];
    
    // Detect numeric patterns
    if (typeof data === 'number') {
      patterns.push({
        type: 'numeric_value',
        description: 'Data is a numeric value',
        confidence: 0.8,
        metadata: {
          value: data,
          isInteger: Number.isInteger(data),
          range: this.getNumericRange(data)
        }
      });
    }
    
    // Detect string patterns
    if (typeof data === 'string') {
      patterns.push(...this.detectStringPatterns(data));
    }
    
    return patterns;
  }

  detectStringPatterns(data) {
    const patterns = [];
    
    // Email pattern
    if (data.includes('@') && data.includes('.')) {
      patterns.push({
        type: 'email_format',
        description: 'String matches email format',
        confidence: 0.7,
        metadata: {
          value: data
        }
      });
    }
    
    // URL pattern
    if (data.startsWith('http://') || data.startsWith('https://')) {
      patterns.push({
        type: 'url_format',
        description: 'String matches URL format',
        confidence: 0.8,
        metadata: {
          value: data,
          protocol: data.startsWith('https://') ? 'https' : 'http'
        }
      });
    }
    
    // Date pattern
    if (data.match(/^\d{4}-\d{2}-\d{2}$/)) {
      patterns.push({
        type: 'date_format',
        description: 'String matches date format',
        confidence: 0.8,
        metadata: {
          value: data,
          format: 'YYYY-MM-DD'
        }
      });
    }
    
    return patterns;
  }

  detectBehavioralPatterns(data) {
    const patterns = [];
    
    // Detect common data patterns
    if (typeof data === 'object' && data !== null) {
      // ID pattern
      if (data.id && typeof data.id === 'string') {
        patterns.push({
          type: 'id_field',
          description: 'Object contains ID field',
          confidence: 0.8,
          metadata: {
            field: 'id',
            type: typeof data.id
          }
        });
      }
      
      // Timestamp pattern
      if (data.createdAt || data.updatedAt) {
        patterns.push({
          type: 'timestamp_field',
          description: 'Object contains timestamp field',
          confidence: 0.8,
          metadata: {
            fields: [data.createdAt ? 'createdAt' : null, data.updatedAt ? 'updatedAt' : null].filter(Boolean)
          }
        });
      }
    }
    
    return patterns;
  }

  // Issue detection methods
  detectIssues(data, _options = {}) {
    const issues = [];
    
    // Detect structure issues
    issues.push(...this.detectStructureIssues(data));
    
    // Detect content issues
    issues.push(...this.detectContentIssues(data));
    
    // Detect quality issues
    issues.push(...this.detectQualityIssues(data));
    
    return {
      issues,
      score: this.calculateIssueScore(issues),
      recommendations: this.generateIssueRecommendations(issues)
    };
  }

  detectStructureIssues(data) {
    const issues = [];
    
    if (typeof data === 'object' && data !== null) {
      // Check for empty object
      if (Object.keys(data).length === 0) {
        issues.push({
          type: 'empty_object',
          description: 'Object is empty',
          severity: 'medium',
          file: 'unknown'
        });
      }
      
      // Check for undefined values
      Object.entries(data).forEach(([key, value]) => {
        if (value === undefined) {
          issues.push({
            type: 'undefined_value',
            description: `Field ${key} has undefined value`,
            severity: 'low',
            field: key,
            file: 'unknown'
          });
        }
      });
    }
    
    return issues;
  }

  detectContentIssues(data) {
    const issues = [];
    
    if (typeof data === 'string') {
      // Check for empty string
      if (data.trim() === '') {
        issues.push({
          type: 'empty_string',
          description: 'String is empty',
          severity: 'low',
          file: 'unknown'
        });
      }
      
      // Check for encoding issues
      if (data.includes('') || data.includes('')) {
        issues.push({
          type: 'encoding_issue',
          description: 'String contains encoding issues',
          severity: 'medium',
          file: 'unknown'
        });
      }
    }
    
    return issues;
  }

  detectQualityIssues(data) {
    const issues = [];
    
    // Check for data quality issues
    if (typeof data === 'number') {
      if (isNaN(data)) {
        issues.push({
          type: 'nan_value',
          description: 'Number is NaN',
          severity: 'high',
          file: 'unknown'
        });
      }
      
      if (!isFinite(data)) {
        issues.push({
          type: 'infinite_value',
          description: 'Number is infinite',
          severity: 'high',
          file: 'unknown'
        });
      }
    }
    
    return issues;
  }

  // Quality analysis methods
  analyzeQuality(data, _options = {}) {
    const qualityFactors = {
      completeness: this.assessCompleteness(data),
      consistency: this.assessConsistency(data),
      validity: this.assessValidity(data),
      accuracy: this.assessAccuracy(data)
    };
    
    const overallScore = Object.values(qualityFactors).reduce((sum, score) => sum + score, 0) / Object.keys(qualityFactors).length;
    
    return {
      score: overallScore,
      factors: qualityFactors,
      grade: this.getQualityGrade(overallScore),
      recommendations: this.generateQualityRecommendations(qualityFactors)
    };
  }

  assessCompleteness(data) {
    let score = 100;
    
    if (typeof data === 'object' && data !== null) {
      const requiredFields = ['id', 'createdAt', 'updatedAt'];
      const missingFields = requiredFields.filter(field => !(field in data));
      
      score -= missingFields.length * 10;
    }
    
    return Math.max(0, score);
  }

  assessConsistency(data) {
    let score = 100;
    
    if (Array.isArray(data)) {
      if (data.length > 0) {
        const firstItem = data[0];
        const inconsistentItems = data.filter(item => {
          if (typeof item === 'object' && typeof firstItem === 'object') {
            return Object.keys(item).length !== Object.keys(firstItem).length;
          }
          return typeof item !== typeof firstItem;
        });
        
        score -= (inconsistentItems.length / data.length) * 30;
      }
    }
    
    return Math.max(0, score);
  }

  assessValidity(data) {
    let score = 100;
    
    // Check for invalid values
    if (typeof data === 'number') {
      if (isNaN(data) || !isFinite(data)) {
        score = 0;
      }
    }
    
    if (typeof data === 'string') {
      if (data.trim() === '') {
        score -= 50;
      }
    }
    
    return Math.max(0, score);
  }

  assessAccuracy(_data) {
    // This would require external validation or reference data
    // For now, return a default score
    return 85;
  }

  // Structure analysis methods
  analyzeStructure(data, _options = {}) {
    const structure = {
      type: this.getDataType(data),
      size: this.getDataSize(data),
      depth: this.getDataDepth(data),
      complexity: this.getComplexity(data)
    };
    
    return {
      structure,
      recommendations: this.generateStructureRecommendations(structure)
    };
  }

  getDataType(data) {
    if (data === null) return 'null';
    if (Array.isArray(data)) return 'array';
    return typeof data;
  }

  getDataSize(data) {
    if (typeof data === 'string') return data.length;
    if (Array.isArray(data)) return data.length;
    if (typeof data === 'object' && data !== null) return Object.keys(data).length;
    return 1;
  }

  getDataDepth(data) {
    if (typeof data !== 'object' || data === null) return 0;
    
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

  getComplexity(data) {
    let complexity = 1;
    
    if (Array.isArray(data)) {
      complexity += data.length * 0.1;
      data.forEach(item => {
        if (typeof item === 'object' && item !== null) {
          complexity += this.getComplexity(item) * 0.5;
        }
      });
    } else if (typeof data === 'object' && data !== null) {
      complexity += Object.keys(data).length * 0.1;
      Object.values(data).forEach(value => {
        if (typeof value === 'object' && value !== null) {
          complexity += this.getComplexity(value) * 0.5;
        }
      });
    }
    
    return Math.round(complexity);
  }

  // Content analysis methods
  analyzeContent(data, _options = {}) {
    const content = {
      types: this.getContentTypes(data),
      patterns: this.getContentPatterns(data),
      statistics: this.getContentStatistics(data)
    };
    
    return {
      content,
      recommendations: this.generateContentRecommendations(content)
    };
  }

  getContentTypes(data) {
    const types = new Set();
    
    const collectTypes = (value) => {
      types.add(typeof value);
      
      if (Array.isArray(value)) {
        value.forEach(collectTypes);
      } else if (typeof value === 'object' && value !== null) {
        Object.values(value).forEach(collectTypes);
      }
    };
    
    collectTypes(data);
    return Array.from(types);
  }

  getContentPatterns(data) {
    const patterns = [];
    
    // Collect all string values
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
    
    // Analyze string patterns
    const emailCount = strings.filter(s => s.includes('@') && s.includes('.')).length;
    const urlCount = strings.filter(s => s.startsWith('http') || s.startsWith('https')).length;
    const dateCount = strings.filter(s => s.match(/^\d{4}-\d{2}-\d{2}$/)).length;
    
    if (emailCount > 0) {
      patterns.push({
        type: 'email',
        count: emailCount,
        percentage: (emailCount / strings.length) * 100
      });
    }
    
    if (urlCount > 0) {
      patterns.push({
        type: 'url',
        count: urlCount,
        percentage: (urlCount / strings.length) * 100
      });
    }
    
    if (dateCount > 0) {
      patterns.push({
        type: 'date',
        count: dateCount,
        percentage: (dateCount / strings.length) * 100
      });
    }
    
    return patterns;
  }

  getContentStatistics(data) {
    const stats = {
      totalItems: 0,
      stringItems: 0,
      numberItems: 0,
      booleanItems: 0,
      objectItems: 0,
      arrayItems: 0,
      nullItems: 0,
      undefinedItems: 0
    };
    
    const collectStats = (value) => {
      stats.totalItems++;
      
      if (typeof value === 'string') stats.stringItems++;
      else if (typeof value === 'number') stats.numberItems++;
      else if (typeof value === 'boolean') stats.booleanItems++;
      else if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          stats.arrayItems++;
          value.forEach(collectStats);
        } else {
          stats.objectItems++;
          Object.values(value).forEach(collectStats);
        }
      } else if (value === null) {
        stats.nullItems++;
      } else if (value === undefined) {
        stats.undefinedItems++;
      }
    };
    
    collectStats(data);
    return stats;
  }

  // Performance analysis methods
  analyzePerformance(data, _options = {}) {
    const performance = {
      size: this.getPerformanceSize(data),
      complexity: this.getPerformanceComplexity(data),
      processingTime: this.estimateProcessingTime(data),
      memoryUsage: this.estimateMemoryUsage(data)
    };
    
    return {
      performance,
      recommendations: this.generatePerformanceRecommendations(performance)
    };
  }

  getPerformanceSize(data) {
    return JSON.stringify(data).length;
  }

  getPerformanceComplexity(data) {
    return this.getComplexity(data);
  }

  estimateProcessingTime(data) {
    const size = this.getPerformanceSize(data);
    const complexity = this.getPerformanceComplexity(data);
    
    // Simple estimation based on size and complexity
    return Math.round(size * 0.001 + complexity * 10);
  }

  estimateMemoryUsage(data) {
    const size = this.getPerformanceSize(data);
    // Rough estimation: 1 byte per character plus overhead
    return Math.round(size * 1.5);
  }

  // Helper methods
  calculatePatternScore(patterns) {
    if (patterns.length === 0) return 50;
    
    const totalConfidence = patterns.reduce((sum, pattern) => sum + pattern.confidence, 0);
    return (totalConfidence / patterns.length) * 100;
  }

  calculateIssueScore(issues) {
    if (issues.length === 0) return 100;
    
    const severityWeights = { high: 30, medium: 20, low: 10 };
    const totalWeight = issues.reduce((sum, issue) => sum + (severityWeights[issue.severity] || 10), 0);
    const maxWeight = issues.length * 30;
    
    return Math.max(0, 100 - (totalWeight / maxWeight) * 100);
  }

  getQualityGrade(score) {
    if (score >= 90) return 'excellent';
    if (score >= 80) return 'good';
    if (score >= 70) return 'acceptable';
    if (score >= 60) return 'poor';
    return 'critical';
  }

  getItemTypes(array) {
    const types = new Set();
    array.forEach(item => types.add(typeof item));
    return Array.from(types);
  }

  getKeyTypes(obj) {
    const types = {};
    Object.entries(obj).forEach(([key, value]) => {
      types[key] = typeof value;
    });
    return types;
  }

  getNumericRange(value) {
    if (value < 0) return 'negative';
    if (value === 0) return 'zero';
    if (value < 100) return 'small';
    if (value < 1000) return 'medium';
    return 'large';
  }

  // Validation methods
  validatePatterns(result) {
    return {
      valid: Array.isArray(result.patterns),
      errors: result.patterns ? [] : ['Patterns should be an array']
    };
  }

  validateIssues(result) {
    return {
      valid: Array.isArray(result.issues),
      errors: result.issues ? [] : ['Issues should be an array']
    };
  }

  validateQuality(result) {
    return {
      valid: typeof result.score === 'number' && result.score >= 0 && result.score <= 100,
      errors: typeof result.score === 'number' ? [] : ['Score should be a number between 0 and 100']
    };
  }

  validateStructure(result) {
    return {
      valid: result.structure && typeof result.structure === 'object',
      errors: result.structure ? [] : ['Structure should be an object']
    };
  }

  validateContent(result) {
    return {
      valid: result.content && typeof result.content === 'object',
      errors: result.content ? [] : ['Content should be an object']
    };
  }

  validatePerformance(result) {
    return {
      valid: result.performance && typeof result.performance === 'object',
      errors: result.performance ? [] : ['Performance should be an object']
    };
  }

  // Recommendation methods
  generatePatternRecommendations(patterns) {
    const recommendations = [];
    
    if (patterns.length === 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Add more structured data patterns',
        description: 'Consider adding consistent structure patterns to improve analysis'
      });
    }
    
    return recommendations;
  }

  generateIssueRecommendations(issues) {
    const recommendations = [];
    
    const highSeverityIssues = issues.filter(issue => issue.severity === 'high');
    if (highSeverityIssues.length > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Fix high severity issues',
        description: `${highSeverityIssues.length} high severity issues found`
      });
    }
    
    return recommendations;
  }

  generateQualityRecommendations(factors) {
    const recommendations = [];
    
    Object.entries(factors).forEach(([factor, score]) => {
      if (score < 80) {
        recommendations.push({
          priority: 'medium',
          action: `Improve ${factor} quality`,
          description: `${factor} score is ${score}, improvement recommended`
        });
      }
    });
    
    return recommendations;
  }

  generateStructureRecommendations(structure) {
    const recommendations = [];
    
    if (structure.complexity > 10) {
      recommendations.push({
        priority: 'medium',
        action: 'Simplify data structure',
        description: `Complexity score is ${structure.complexity}, consider simplifying`
      });
    }
    
    return recommendations;
  }

  generateContentRecommendations(content) {
    const recommendations = [];
    
    if (content.statistics.stringItems === 0) {
      recommendations.push({
        priority: 'low',
        action: 'Add string content',
        description: 'No string content found, consider adding descriptive text'
      });
    }
    
    return recommendations;
  }

  generatePerformanceRecommendations(performance) {
    const recommendations = [];
    
    if (performance.size > 100000) {
      recommendations.push({
        priority: 'high',
        action: 'Optimize data size',
        description: `Data size is ${performance.size} bytes, consider optimization`
      });
    }
    
    return recommendations;
  }

  // Get analysis statistics
  getStats() {
    const analyzerStats = {};
    
    this.analyzers.forEach((analyzer, name) => {
      analyzerStats[name] = {
        name,
        usage: analyzer.usage,
        avgProcessingTime: analyzer.avgProcessingTime,
        totalProcessingTime: analyzer.totalProcessingTime,
        successCount: analyzer.successCount,
        failureCount: analyzer.failureCount,
        lastUsed: analyzer.lastUsed,
        category: analyzer.category,
        priority: analyzer.priority
      };
    });

    const jobStats = {};
    this.jobs.forEach((job, id) => {
      jobStats[id] = {
        id,
        type: job.type,
        status: job.status,
        progress: job.progress,
        processingTime: job.processingTime,
        error: job.error,
        retryCount: job.retryCount,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        failedAt: job.failedAt
      };
    });

    return {
      analyzerStats,
      jobStats,
      totalAnalyzers: this.analyzers.size,
      totalJobs: this.jobs.size,
      activeJobs: this.getActiveJobs().length,
      completedJobs: this.getCompletedJobs().length,
      averageProcessingTime: this.calculateAverageProcessingTime(),
      overallSuccessRate: this.calculateOverallSuccessRate(),
      lastUpdated: new Date().toISOString()
    };
  }

  // Calculate average processing time
  calculateAverageProcessingTime() {
    const processingTimes = Array.from(this.analyzers.values()).map(analyzer => analyzer.avgProcessingTime);
    return processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
  }

  // Calculate overall success rate
  calculateOverallSuccessRate() {
    const successRates = Array.from(this.analyzers.values()).map(analyzer => {
      const total = analyzer.successCount + analyzer.failureCount;
      return total > 0 ? analyzer.successCount / total : 0;
    });
    return successRates.reduce((sum, rate) => sum + rate, 0) / successRates.length;
  }

  // Get system state
  getState() {
    return {
      isInitialized: this.isInitialized,
      options: this.options,
      analyzers: Array.from(this.analyzers.entries()).map(([name, analyzer]) => ({
        name,
        ...analyzer
      })),
      pipeline: Array.from(this.pipeline.entries()).map(([name, step]) => ({
        name,
        ...step
      })),
      jobs: Array.from(this.jobs.entries()).map(([id, job]) => ({
        id,
        ...job
      })),
      history: this.history,
      metrics: Array.from(this.metrics.entries()).map(([name, metric]) => ({
        name,
        ...metric
      })),
      stats: this.getStats(),
      maxConcurrentJobs: this.maxConcurrentJobs,
      jobTimeout: this.jobTimeout,
      enableRealTimeAnalysis: this.enableRealTimeAnalysis,
      lastUpdated: new Date().toISOString()
    };
  }

  // Destroy analysis engine
  destroy() {
    this.stopJobProcessing();
    
    this.pipeline.clear();
    this.jobs.clear();
    this.analyzers.clear();
    this.patterns.clear();
    this.issues.clear();
    this.history = [];
    this.metrics.clear();
    
    this.isInitialized = false;
    logger.debug('[ANALYSIS_ENGINE] Analysis engine destroyed');
  }
}

// Global instance
let analysisEngine = null;

// Initialize analysis engine when DOM is ready
function initializeAnalysisEngine() {
  if (!analysisEngine) {
    analysisEngine = new AnalysisEngine();
  }
  return analysisEngine.initialize();
}

// Export for global access
window.analysisEngine = analysisEngine;

module.exports = {
  AnalysisEngine,
  initializeAnalysisEngine
};

