/**
 * Validation Engine Core System
 * 
 * Comprehensive validation processing engine with pipeline architecture,
 * job management, auto-fixing, and comprehensive validation capabilities
 */

class ValidationEngine {
  constructor(options = {}) {
    this.options = options;
    this.pipeline = new Map();
    this.jobs = new Map();
    this.rules = new Map();
    this.history = [];
    this.metrics = new Map();
    this.isInitialized = false;
    this.maxConcurrentJobs = options.maxConcurrentJobs || 10;
    this.jobTimeout = options.jobTimeout || 60000; // 1 minute
    this.enableAutoFixing = options.enableAutoFixing !== false;
    
    this.initializeRules();
    console.log('[VALIDATION_ENGINE] Validation engine initialized');
  }

  // Initialize validation rules
  initializeRules() {
    // JSON validation rules
    this.addRule('json_structure', {
      name: 'JSON Structure Validation',
      description: 'Validates JSON structure and syntax',
      validator: this.validateJSONStructure.bind(this),
      autoFixer: this.fixJSONStructure.bind(this),
      severity: 'high',
      category: 'structure'
    });

    this.addRule('json_format', {
      name: 'JSON Format Validation',
      description: 'Validates JSON format and encoding',
      validator: this.validateJSONFormat.bind(this),
      autoFixer: this.fixJSONFormat.bind(this),
      severity: 'medium',
      category: 'format'
    });

    this.addRule('json_content', {
      name: 'JSON Content Validation',
      description: 'Validates JSON content and data integrity',
      validator: this.validateJSONContent.bind(this),
      autoFixer: this.fixJSONContent.bind(this),
      severity: 'medium',
      category: 'content'
    });

    // CSV validation rules
    this.addRule('csv_structure', {
      name: 'CSV Structure Validation',
      description: 'Validates CSV structure and column consistency',
      validator: this.validateCSVStructure.bind(this),
      autoFixer: this.fixCSVStructure.bind(this),
      validation: (data) => this.validateCSVStructure(data),
      autoFix: (data) => this.fixCSVStructure(data)
    });

    // SQL validation rules
    this.addRule('sql_syntax', {
      name: 'SQL Syntax Validation',
      description: 'Validates SQL syntax and structure',
      validator: this.validateSQLSyntax.bind(this),
      autoFixer: this.fixSQLSyntax.bind(this),
      severity: 'high',
      category: 'structure'
    });

    this.addRule('sql_structure', {
      name: 'SQL Structure Validation',
      description: 'Validates SQL table structure',
      validator: this.validateSQLStructure.bind(this),
      autoFixer: this.fixSQLStructure.bind(this),
      severity: 'high',
      category: 'structure'
    });

    // XML validation rules
    this.addRule('xml_structure', {
      name: 'XML Structure Validation',
      description: 'Validates XML structure and syntax',
      validator: this.validateXMLStructure.bind(this),
      autoFixer: this.fixXMLStructure.bind(this),
      severity: 'high',
      category: 'structure'
    });

    this.addRule('xml_syntax', {
      name: 'XML Syntax Validation',
      description: 'Validates XML syntax and encoding',
      validator: this.validateXMLSyntax.bind(this),
      autoFixer: this.fixXMLSyntax.bind(this),
      severity: 'medium',
      category: 'format'
    });

    // YAML validation rules
    this.addRule('yaml_structure', {
      name: 'YAML Structure Validation',
      description: 'Validates YAML structure and syntax',
      validator: this.validateYAMLStructure.bind(this),
      autoFixer: this.fixYAMLStructure.bind(this),
      severity: 'medium',
      category: 'structure'
    });

    this.addRule('yaml_syntax', {
      name: 'YAML Syntax Validation',
      description: 'Validates YAML syntax and encoding',
      validator: this.validateYAMLSyntax.bind(this),
      autoFixer: this.fixYAMLSyntax.bind(this),
      severity: 'medium',
      category: 'format'
    });

    console.log(`[VALIDATION_ENGINE] Initialized ${this.rules.size} validation rules`);
  }

  // Add validation rule
  addRule(name, rule) {
    this.rules.set(name, {
      ...rule,
      usage: 0,
      avgProcessingTime: 0,
      totalProcessingTime: 0,
      successCount: 0,
      failureCount: 0,
      lastUsed: null
    });
    console.log(`[VALIDATION_ENGINE] Added validation rule: ${name}`);
  }

  // Initialize validation engine
  async initialize() {
    if (this.isInitialized) {
      console.log('[VALIDATION_ENGINE] Validation engine already initialized');
      return;
    }

    try {
      // Start job processing
      this.startJobProcessing();
      
      this.isInitialized = true;
      console.log('[VALIDATION_ENGINE] Validation engine initialized successfully');
      
    } catch (error) {
      console.error('[VALIDATION_ENGINE] Failed to initialize validation engine:', error.message);
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

    console.log('[VALIDATION_ENGINE] Job processing started');
  }

  // Stop job processing
  stopJobProcessing() {
    if (this.jobProcessingIntervalId) {
      clearInterval(this.jobProcessingIntervalId);
      this.jobProcessingIntervalId = null;
    }
    
    console.log('[VALIDATION_ENGINE] Job processing stopped');
  }

  // Process validation jobs
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

  // Start validation job
  async startJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    job.status = 'processing';
    job.startedAt = new Date().toISOString();
    job.progress = 0;
    
    console.log(`[VALIDATION_ENGINE] Starting validation job: ${jobId}`);

    try {
      // Process through validation pipeline
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
      
      // Update rule usage stats
      const rule = this.rules.get(job.rule);
      if (rule) {
        rule.usage++;
        rule.totalProcessingTime += job.processingTime;
        rule.avgProcessingTime = rule.totalProcessingTime / rule.usage;
        rule.successCount++;
        rule.lastUsed = new Date().toISOString();
      }
      
      console.log(`[VALIDATION_ENGINE] Validation job completed: ${jobId}`);
      
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.failedAt = new Date().toISOString();
      
      // Update rule failure stats
      const rule = this.rules.get(job.rule);
      if (rule) {
        rule.failureCount++;
        rule.totalProcessingTime += job.processingTime;
        rule.avgProcessingTime = rule.totalProcessingTime / Math.max(1, rule.usage);
        rule.lastUsed = new Date().toISOString();
      }
      
      console.error(`[VALIDATION_ENGINE] Validation job failed: ${jobId} - ${error.message}`);
      
      // Attempt recovery
      await this.attemptRecovery(job);
    }
  }

  // Attempt job recovery
  async attemptRecovery(job) {
    if (job.retryCount >= 3) {
      console.log(`[VALIDATION_ENGINE] Max retries exceeded for job: ${job.id}`);
      return;
    }

    job.status = 'recovering';
    job.retryCount++;
    job.progress = 0;
    
    console.log(`[VALIDATION_ENGINE] Attempting recovery for job: ${job.id} (attempt ${job.retryCount})`);

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
          console.log(`[VALIDATION_ENGINE] Recovery successful for job: ${job.id}`);
        }
      }
    } catch (error) {
      console.error(`[VALIDATION_ENGINE] Recovery failed for job: ${job.id} - ${error.message}`);
    }
  }

  // Create validation job
  createJob(options) {
    const jobId = this.generateJobId();
    
    const job = {
      id: jobId,
      type: options.type || 'data_validation',
      source: options.source || 'unknown',
      rule: options.rule || 'json_structure',
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
    console.log(`[VALIDATION_ENGINE] Created validation job: ${jobId}`);
    
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
      failedAt: job.job.failedAt,
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
    
    console.log(`[VALIDATION_ENGINE] Cancelled validation job: ${jobId}`);
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
    console.log(`[VALIDATION_ENGINE] Deleted validation job: ${jobId}`);
    return true;
  }

  // Validate data using specified rule
  validateData(data, ruleName, options = {}) {
    const rule = this.rules.get(ruleName);
    if (!rule) {
      throw new Error(`Validation rule not found: ${ruleName}`);
    }

    const startTime = Date.now();
    
    try {
      const result = rule.validator(data, options);
      const processingTime = Date.now() - startTime;
      
      // Update rule stats
      rule.usage++;
      rule.totalProcessingTime += processingTime;
      rule.avgProcessingTime = rule.totalProcessingTime / rule.usage;
      rule.successCount++;
      rule.lastUsed = new Date().toISOString();
      
      return {
        success: result.valid,
        data: result.data || data,
        processingTime,
        metadata: {
          rule: ruleName,
          validationScore: result.score || 100,
          issues: result.errors || [],
          recommendations: result.recommendations || []
        }
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Update rule failure stats
      if (rule) {
        rule.failureCount++;
        rule.totalProcessingTime += processingTime;
        rule.avgProcessingTime = rule.totalProcessingTime / Math.max(1, rule.usage);
        rule.lastUsed = new Date().toISOString();
      }
      
      console.error(`[VALIDATION_ENGINE] Validation failed: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        processingTime
      };
    }
  }

  // Validate JSON structure
  validateJSONStructure(data) {
    try {
      JSON.parse(JSON.stringify(data));
      return { valid: true, errors: [] };
    } catch (error) {
      return { valid: false, errors: [error.message] };
    }
  }

  // Fix JSON structure
  fixJSONStructure(data) {
    if (typeof data === 'object' && data !== null) {
      Object.keys(data).forEach(key => {
        if (data[key] === undefined) {
          data[key] = null;
        }
      });
    }
    return data;
  }

  // Validate JSON format
  validateJSONFormat(data) {
    if (typeof data !== 'string') return false;
    
    const issues = [];
    
    // Check for common JSON format issues
    if (data.includes('undefined') || data.includes('NaN')) {
      issues.push('JSON contains undefined or NaN values');
    }
    
    // Check for encoding issues
    if (data.includes('') || data.includes('')) {
      issues.push('JSON contains encoding issues');
    }
    
    return {
      valid: issues.length === 0,
      errors: issues
    };
  }

  // Fix JSON format
  fixJSONFormat(data) {
    if (typeof data !== 'string') return data;
    
    // Fix undefined and NaN values
    data = data.replace(/undefined/g, 'null').replace(/NaN/g, '0');
    
    // Fix encoding issues
    data = data.replace(/\uFFFD/g, '').replace(/[\u2018\u2019]/g, "'");
    
    return data;
  }

  // Validate JSON content
  validateJSONContent(data) {
    if (typeof data !== 'object' || data === null) {
      return { valid: false, errors: ['Data is not an object'] };
    }
    
    const issues = [];
    
    // Check for empty objects
    if (Object.keys(data).length === 0) {
      issues.push('Object is empty');
    }
    
    // Check for invalid values
    Object.values(data).forEach(value => {
      if (value === null || value === undefined) {
        issues.push('Object contains null or undefined values');
      }
    });
    
    return {
      valid: issues.length === 0,
      errors: issues
    };
  }

  // Fix JSON content
  fixJSONContent(data) {
    if (typeof data !== 'object' || data === null) return data;
    
    Object.keys(data).forEach(key => {
      if (data[key] === null || data[key] === undefined) {
        data[key] = null;
      }
    });
    
    return data;
  }

  // Validate CSV structure
  validateCSVStructure(data) {
    if (!Array.isArray(data)) {
      return { valid: false, errors: ['Data is not an array'] };
    }
    
    const issues = [];
    
    const columnCounts = data.map(row => row.split(',').length);
    const firstCount = columnCounts[0];
    
    for (let i = 1; i < columnCounts.length; i++) {
      if (columnCounts[i] !== firstCount) {
        issues.push(`Row ${i + 1}: Column count mismatch (${columnCounts[i]} vs ${firstCount})`);
      }
    }
    
    return {
      valid: issues.length === 0,
      errors: issues
    };
  }

  // Fix CSV structure
  fixCSVStructure(data) {
    if (!Array.isArray(data)) return data;
    
    const columnCounts = data.map(row => row.split(',').length);
    const firstCount = columnCounts[0];
    
    for (let i = 1; i < columnCounts.length; i++) {
      if (columnCounts[i] !== firstCount) {
        data[i] = data[i].map((value, index) => value || '');
      }
    }
    
    return data;
  }

  // Validate SQL syntax
  validateSQLSyntax(data) {
    if (typeof data !== 'string') return false;
    
    const sqlUpper = data.toUpperCase();
    
    // Check for SQL keywords
    const sqlKeywords = ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT'];
    
    const hasKeywords = sqlKeywords.some(keyword => sqlUpper.includes(keyword));
    
    return hasKeywords;
  }

  // Fix SQL syntax
  fixSQLSyntax(data) {
    if (typeof data !== 'string') return data;
    
    // Fix common SQL syntax issues
    data = data.replace(/\s+/g, ' ');
    data = data.replace(/\s+/g, ' ');
    
    return data;
  }

  // Validate SQL structure
  validateSQLStructure(data) {
    if (!Array.isArray(data)) return false;
    
    const issues = [];
    
    const headers = Object.keys(data[0] || []);
    
    data.forEach((row, index) => {
      const rowKeys = Object.keys(row);
      const missingFields = headers.filter(header => !rowKeys.includes(header));
      if (missingFields.length > 0) {
        issues.push(`Row ${index + 1}: Missing fields: ${missingFields.join(', ')}`);
      }
    });
    
    return {
      valid: issues.length === 0,
      errors: issues
    };
  }

  // Fix SQL structure
  fixSQLStructure(data) {
    if (!Array.isArray(data)) return data;
    
    const headers = Object.keys(data[0] || []);
    
    data.forEach((row, index) => {
      const rowKeys = Object.keys(row);
      const missingFields = headers.filter(header => !rowKeys.includes(header));
      if (missingFields.length > 0) {
        missingFields.forEach(field => {
          row[field] = '';
        });
      }
    });
    
    return data;
  }

  // Validate XML structure
  validateXMLStructure(data) {
    if (typeof data !== 'string') return false;
    
    try {
      const parser = new DOMParser();
      parser.parseFromString(data, 'text/xml');
      return true;
    } catch (error) {
      return false;
    }
  }

  // Fix XML structure
  fixXMLStructure(data) {
    if (typeof data !== 'string') return data;
    
    // Fix common XML structure issues
    data = data.replace(/&/g, '&amp;');
    data = data.replace(/</g, '&lt;');
    data = data.replace(/>/g, '&gt;');
    
    return data;
  }

  // Validate XML syntax
  validateXMLSyntax(data) {
    if (typeof data !== 'string') return false;
    
    const issues = [];
    
    // Check for XML syntax issues
    if (data.includes('<') && !data.includes('>')) {
      issues.push('Unclosed XML tag');
    }
    
    if (data.includes('</') && !data.includes('<')) {
      issues.push('Unclosed XML tag');
    }
    
    return {
      valid: issues.length === 0,
      errors: issues
    };
  }

  // Fix XML syntax
  fixXMLSyntax(data) {
    if (typeof data !== 'string') return data;
    
    // Fix common XML syntax issues
    data = data.replace(/</g, '&gt;');
    data = data.replace(/</g, '&lt;');
    data = data.replace(/>/g, '&gt;');
    
    return data;
  }

  // Validate YAML structure
  validateYAMLStructure(data) {
    if (typeof data !== 'string') return false;
    
    const lines = data.split('\n');
    if (lines.length === 0) return false;
    
    // Check for valid YAML structure
    let hasValidStructure = true;
    
    for (const line of lines) {
      if (line.trim().length === 0) {
        hasValidStructure = false;
      }
    }
    
    return hasValidStructure;
  }

  // Fix YAML structure
  fixYAMLStructure(data) {
    if (typeof data !== 'string') return data;
    
    // Fix common YAML structure issues
    data = data.replace(/: /g, ': ');
    data = data.replace(/: /g, ': ');
    
    return data;
  }

  // Validate YAML syntax
  validateYAMLSyntax(data) {
    if (typeof data !== 'string') return false;
    
    const issues = [];
    
    // Check for YAML syntax issues
    if (data.includes('\t')) {
      issues.push('YAML contains tabs (should use spaces)');
    }
    
    return {
      valid: issues.length === 0,
      errors: issues
    };
  }

  // Fix YAML syntax
  fixYAMLSyntax(data) {
    if (typeof data !== 'string') return data;
    
    // Fix common YAML syntax issues
    data = data.replace(/\t/g, '  ');
    
    return data;
  }

  // Get validation statistics
  getStats() {
    const ruleStats = {};
    
    this.rules.forEach((rule, name) => {
      ruleStats[name] = {
        name,
        usage: rule.usage,
        avgProcessingTime: rule.avgProcessingTime,
        totalProcessingTime: rule.totalProcessingTime,
        successCount: rule.successCount,
        failureCount: rule.failureCount,
        lastUsed: rule.lastUsed,
        severity: rule.severity,
        category: rule.category
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
      ruleStats,
      jobStats,
      totalRules: this.rules.size,
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
    const processingTimes = Array.from(this.rules.values()).map(rule => rule.avgProcessingTime);
    return processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
  }

  // Calculate overall success rate
  calculateOverallSuccessRate() {
    const successRates = Array.from(this.rules.values()).map(rule => rule.successRate || 0);
    return successRates.reduce((sum, rate) => sum + rate, 0) / successRates.length;
  }

  // Get system state
  getState() {
    return {
      isInitialized: this.isInitialized,
      options: this.options,
      rules: Array.from(this.rules.entries()).map(([name, rule]) => ({
        name,
        ...rule
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
      enableAutoFixing: this.enableAutoFixing,
      lastUpdated: new Date().toISOString()
    };
  }

  // Destroy validation engine
  destroy() {
    this.stopJobProcessing();
    
    this.pipeline.clear();
    this.jobs.clear();
    this.rules.clear();
    this.history = [];
    this.metrics.clear();
    
    this.isInitialized = false;
    console.log('[VALIDATION_ENGINE] Validation engine destroyed');
  }
}

// Global instance
let validationEngine = null;

// Initialize validation engine when DOM is ready
function initializeValidationEngine() {
  if (!validationEngine) {
    validationEngine = new ValidationEngine();
  }
  return validationEngine.initialize();
}

// Export for global access
window.validationEngine = validationEngine;

module.exports = {
  ValidationEngine,
  initializeValidationEngine
};
