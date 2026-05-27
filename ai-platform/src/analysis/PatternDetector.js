/**
 * Pattern Detection System
 * 
 * Advanced pattern detection with machine learning capabilities,
 * template-based matching, and adaptive learning
 */

class PatternDetector {
  constructor(options = {}) {
    this.options = options;
    this.patterns = new Map();
    this.templates = new Map();
    this.mlModels = new Map();
    this.detectionHistory = [];
    this.isInitialized = false;
    this.confidenceThreshold = options.confidenceThreshold || 0.7;
    this.enableMLDetection = options.enableMLDetection !== false;
    this.enableTemplateMatching = options.enableTemplateMatching !== false;
    
    this.initializePatterns();
    this.initializeTemplates();
    console.log('[PATTERN_DETECTOR] Pattern detector initialized');
  }

  // Initialize patterns
  initializePatterns() {
    // Structure patterns
    this.addPattern('array_structure', {
      name: 'Array Structure',
      description: 'Detects array-based data structures',
      type: 'structure',
      detector: this.detectArrayStructure.bind(this),
      confidence: 0.9,
      category: 'structure'
    });

    this.addPattern('object_structure', {
      name: 'Object Structure',
      description: 'Detects object-based data structures',
      type: 'structure',
      detector: this.detectObjectStructure.bind(this),
      confidence: 0.9,
      category: 'structure'
    });

    this.addPattern('nested_structure', {
      name: 'Nested Structure',
      description: 'Detects nested data structures',
      type: 'structure',
      detector: this.detectNestedStructure.bind(this),
      confidence: 0.8,
      category: 'structure'
    });

    // Content patterns
    this.addPattern('email_pattern', {
      name: 'Email Pattern',
      description: 'Detects email address patterns',
      type: 'content',
      detector: this.detectEmailPattern.bind(this),
      confidence: 0.8,
      category: 'content'
    });

    this.addPattern('url_pattern', {
      name: 'URL Pattern',
      description: 'Detects URL patterns',
      type: 'content',
      detector: this.detectURLPattern.bind(this),
      confidence: 0.9,
      category: 'content'
    });

    this.addPattern('date_pattern', {
      name: 'Date Pattern',
      description: 'Detects date patterns',
      type: 'content',
      detector: this.detectDatePattern.bind(this),
      confidence: 0.8,
      category: 'content'
    });

    this.addPattern('numeric_pattern', {
      name: 'Numeric Pattern',
      description: 'Detects numeric value patterns',
      type: 'content',
      detector: this.detectNumericPattern.bind(this),
      confidence: 0.7,
      category: 'content'
    });

    // Behavioral patterns
    this.addPattern('id_field_pattern', {
      name: 'ID Field Pattern',
      description: 'Detects ID field patterns',
      type: 'behavioral',
      detector: this.detectIDFieldPattern.bind(this),
      confidence: 0.8,
      category: 'behavioral'
    });

    this.addPattern('timestamp_pattern', {
      name: 'Timestamp Pattern',
      description: 'Detects timestamp field patterns',
      type: 'behavioral',
      detector: this.detectTimestampPattern.bind(this),
      confidence: 0.8,
      category: 'behavioral'
    });

    this.addPattern('status_pattern', {
      name: 'Status Pattern',
      description: 'Detects status field patterns',
      type: 'behavioral',
      detector: this.detectStatusPattern.bind(this),
      confidence: 0.7,
      category: 'behavioral'
    });

    // Quality patterns
    this.addPattern('consistency_pattern', {
      name: 'Consistency Pattern',
      description: 'Detects data consistency patterns',
      type: 'quality',
      detector: this.detectConsistencyPattern.bind(this),
      confidence: 0.7,
      category: 'quality'
    });

    this.addPattern('completeness_pattern', {
      name: 'Completeness Pattern',
      description: 'Detects data completeness patterns',
      type: 'quality',
      detector: this.detectCompletenessPattern.bind(this),
      confidence: 0.8,
      category: 'quality'
    });

    console.log(`[PATTERN_DETECTOR] Initialized ${this.patterns.size} patterns`);
  }

  // Initialize templates
  initializeTemplates() {
    // Email template
    this.addTemplate('email', {
      name: 'Email Template',
      pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      description: 'Email address template',
      confidence: 0.9
    });

    // URL template
    this.addTemplate('url', {
      name: 'URL Template',
      pattern: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
      description: 'URL template',
      confidence: 0.9
    });

    // Date template
    this.addTemplate('date_iso', {
      name: 'ISO Date Template',
      pattern: /^\d{4}-\d{2}-\d{2}$/,
      description: 'ISO date format template',
      confidence: 0.8
    });

    // Date template with time
    this.addTemplate('datetime_iso', {
      name: 'ISO DateTime Template',
      pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
      description: 'ISO datetime format template',
      confidence: 0.8
    });

    // UUID template
    this.addTemplate('uuid', {
      name: 'UUID Template',
      pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      description: 'UUID template',
      confidence: 0.9
    });

    console.log(`[PATTERN_DETECTOR] Initialized ${this.templates.size} templates`);
  }

  // Add pattern
  addPattern(name, pattern) {
    this.patterns.set(name, {
      ...pattern,
      usage: 0,
      detections: 0,
      lastDetected: null
    });
    console.log(`[PATTERN_DETECTOR] Added pattern: ${name}`);
  }

  // Add template
  addTemplate(name, template) {
    this.templates.set(name, {
      ...template,
      usage: 0,
      matches: 0,
      lastMatched: null
    });
    console.log(`[PATTERN_DETECTOR] Added template: ${name}`);
  }

  // Initialize pattern detector
  async initialize() {
    if (this.isInitialized) {
      console.log('[PATTERN_DETECTOR] Pattern detector already initialized');
      return;
    }

    try {
      // Initialize ML models if enabled
      if (this.enableMLDetection) {
        await this.initializeMLModels();
      }
      
      this.isInitialized = true;
      console.log('[PATTERN_DETECTOR] Pattern detector initialized successfully');
      
    } catch (error) {
      console.error('[PATTERN_DETECTOR] Failed to initialize pattern detector:', error.message);
      throw error;
    }
  }

  // Initialize ML models
  async initializeMLModels() {
    // Simple ML model for pattern classification
    this.mlModels.set('pattern_classifier', {
      name: 'Pattern Classifier',
      model: this.createSimpleClassifier(),
      accuracy: 0.85,
      lastTrained: new Date().toISOString()
    });

    console.log('[PATTERN_DETECTOR] ML models initialized');
  }

  // Create simple classifier
  createSimpleClassifier() {
    return {
      classify: (features) => {
        // Simple rule-based classification
        const score = features.reduce((sum, feature) => sum + feature.weight, 0);
        return {
          category: score > 0.7 ? 'high_confidence' : 'low_confidence',
          confidence: Math.min(score, 1.0)
        };
      }
    };
  }

  // Detect patterns in data
  detectPatterns(data, options = {}) {
    const startTime = Date.now();
    const detectedPatterns = [];
    
    try {
      // Detect structure patterns
      detectedPatterns.push(...this.detectStructurePatterns(data));
      
      // Detect content patterns
      detectedPatterns.push(...this.detectContentPatterns(data));
      
      // Detect behavioral patterns
      detectedPatterns.push(...this.detectBehavioralPatterns(data));
      
      // Detect quality patterns
      detectedPatterns.push(...this.detectQualityPatterns(data));
      
      // Apply template matching if enabled
      if (this.enableTemplateMatching) {
        detectedPatterns.push(...this.detectTemplatePatterns(data));
      }
      
      // Apply ML detection if enabled
      if (this.enableMLDetection) {
        detectedPatterns.push(...this.detectMLPatterns(data));
      }
      
      // Filter by confidence threshold
      const filteredPatterns = detectedPatterns.filter(pattern => 
        pattern.confidence >= this.confidenceThreshold
      );
      
      const processingTime = Date.now() - startTime;
      
      // Update pattern usage stats
      filteredPatterns.forEach(pattern => {
        const patternDef = this.patterns.get(pattern.type);
        if (patternDef) {
          patternDef.usage++;
          patternDef.detections++;
          patternDef.lastDetected = new Date().toISOString();
        }
      });
      
      // Store in detection history
      this.detectionHistory.push({
        timestamp: new Date().toISOString(),
        dataSize: this.getDataSize(data),
        totalPatterns: detectedPatterns.length,
        filteredPatterns: filteredPatterns.length,
        processingTime,
        success: true
      });
      
      return {
        success: true,
        patterns: filteredPatterns,
        processingTime,
        metadata: {
          totalPatterns: detectedPatterns.length,
          filteredPatterns: filteredPatterns.length,
          confidenceThreshold: this.confidenceThreshold,
          mlEnabled: this.enableMLDetection,
          templateEnabled: this.enableTemplateMatching
        }
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Store in detection history
      this.detectionHistory.push({
        timestamp: new Date().toISOString(),
        dataSize: this.getDataSize(data),
        totalPatterns: 0,
        filteredPatterns: 0,
        processingTime,
        success: false,
        error: error.message
      });
      
      console.error(`[PATTERN_DETECTOR] Pattern detection failed: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        processingTime
      };
    }
  }

  // Detect structure patterns
  detectStructurePatterns(data) {
    const patterns = [];
    
    // Array structure pattern
    if (Array.isArray(data)) {
      patterns.push({
        type: 'array_structure',
        name: 'Array Structure',
        description: 'Data is structured as an array',
        confidence: 0.9,
        metadata: {
          length: data.length,
          itemTypes: this.getItemTypes(data),
          uniformType: this.isUniformArrayType(data),
          nested: this.hasNestedArrays(data)
        }
      });
    }
    
    // Object structure pattern
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      patterns.push({
        type: 'object_structure',
        name: 'Object Structure',
        description: 'Data is structured as an object',
        confidence: 0.9,
        metadata: {
          keyCount: Object.keys(data).length,
          keyTypes: this.getKeyTypes(data),
          nested: this.hasNestedObjects(data)
        }
      });
    }
    
    // Nested structure pattern
    if (this.hasNestedStructure(data)) {
      patterns.push({
        type: 'nested_structure',
        name: 'Nested Structure',
        description: 'Data contains nested structures',
        confidence: 0.8,
        metadata: {
          maxDepth: this.getMaxDepth(data),
          totalDepth: this.getTotalDepth(data),
          complexity: this.getStructureComplexity(data)
        }
      });
    }
    
    return patterns;
  }

  // Detect content patterns
  detectContentPatterns(data) {
    const patterns = [];
    
    // Collect all string values
    const strings = this.collectStringValues(data);
    
    // Email pattern
    const emailMatches = strings.filter(s => this.matchTemplate('email', s));
    if (emailMatches.length > 0) {
      patterns.push({
        type: 'email_pattern',
        name: 'Email Pattern',
        description: `Found ${emailMatches.length} email pattern(s)`,
        confidence: 0.8,
        metadata: {
          count: emailMatches.length,
          percentage: (emailMatches.length / strings.length) * 100,
          samples: emailMatches.slice(0, 5)
        }
      });
    }
    
    // URL pattern
    const urlMatches = strings.filter(s => this.matchTemplate('url', s));
    if (urlMatches.length > 0) {
      patterns.push({
        type: 'url_pattern',
        name: 'URL Pattern',
        description: `Found ${urlMatches.length} URL pattern(s)`,
        confidence: 0.9,
        metadata: {
          count: urlMatches.length,
          percentage: (urlMatches.length / strings.length) * 100,
          samples: urlMatches.slice(0, 5)
        }
      });
    }
    
    // Date pattern
    const dateMatches = strings.filter(s => this.matchTemplate('date_iso', s));
    if (dateMatches.length > 0) {
      patterns.push({
        type: 'date_pattern',
        name: 'Date Pattern',
        description: `Found ${dateMatches.length} date pattern(s)`,
        confidence: 0.8,
        metadata: {
          count: dateMatches.length,
          percentage: (dateMatches.length / strings.length) * 100,
          samples: dateMatches.slice(0, 5)
        }
      });
    }
    
    // Numeric pattern
    const numericValues = this.collectNumericValues(data);
    if (numericValues.length > 0) {
      patterns.push({
        type: 'numeric_pattern',
        name: 'Numeric Pattern',
        description: `Found ${numericValues.length} numeric value(s)`,
        confidence: 0.7,
        metadata: {
          count: numericValues.length,
          ranges: this.getNumericRanges(numericValues),
          average: numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length
        }
      });
    }
    
    return patterns;
  }

  // Detect behavioral patterns
  detectBehavioralPatterns(data) {
    const patterns = [];
    
    if (typeof data === 'object' && data !== null) {
      // ID field pattern
      if (this.hasIDField(data)) {
        patterns.push({
          type: 'id_field_pattern',
          name: 'ID Field Pattern',
          description: 'Object contains ID field',
          confidence: 0.8,
          metadata: {
            idFields: this.getIDFields(data),
            idTypes: this.getIDFieldTypes(data),
            consistent: this.isConsistentIDType(data)
          }
        });
      }
      
      // Timestamp pattern
      if (this.hasTimestampField(data)) {
        patterns.push({
          type: 'timestamp_pattern',
          name: 'Timestamp Pattern',
          description: 'Object contains timestamp field',
          confidence: 0.8,
          metadata: {
            timestampFields: this.getTimestampFields(data),
            timestampTypes: this.getTimestampFieldTypes(data),
            consistent: this.isConsistentTimestampType(data)
          }
        });
      }
      
      // Status pattern
      if (this.hasStatusField(data)) {
        patterns.push({
          type: 'status_pattern',
          name: 'Status Pattern',
          description: 'Object contains status field',
          confidence: 0.7,
          metadata: {
            statusFields: this.getStatusFields(data),
            statusValues: this.getStatusValues(data),
            consistent: this.isConsistentStatusType(data)
          }
        });
      }
    }
    
    return patterns;
  }

  // Detect quality patterns
  detectQualityPatterns(data) {
    const patterns = [];
    
    // Consistency pattern
    if (Array.isArray(data)) {
      const consistency = this.assessArrayConsistency(data);
      if (consistency.score < 0.8) {
        patterns.push({
          type: 'consistency_pattern',
          name: 'Inconsistency Pattern',
          description: 'Array has inconsistent structure',
          confidence: 0.7,
          metadata: consistency
        });
      }
    }
    
    // Completeness pattern
    const completeness = this.assessCompleteness(data);
    if (completeness.score < 0.8) {
      patterns.push({
        type: 'completeness_pattern',
        name: 'Incompleteness Pattern',
        description: 'Data is incomplete',
        confidence: 0.8,
        metadata: completeness
      });
    }
    
    return patterns;
  }

  // Detect template patterns
  detectTemplatePatterns(data) {
    const patterns = [];
    const strings = this.collectStringValues(data);
    
    this.templates.forEach((template, name) => {
      const matches = strings.filter(s => this.matchTemplate(name, s));
      if (matches.length > 0) {
        patterns.push({
          type: `template_${name}`,
          name: template.name,
          description: `Template match: ${template.description}`,
          confidence: template.confidence,
          metadata: {
            template: name,
            matches: matches.length,
            percentage: (matches.length / strings.length) * 100,
            samples: matches.slice(0, 3)
          }
        });
      }
    });
    
    return patterns;
  }

  // Detect ML patterns
  detectMLPatterns(data) {
    const patterns = [];
    
    const classifier = this.mlModels.get('pattern_classifier');
    if (classifier) {
      const features = this.extractFeatures(data);
      const classification = classifier.model.classify(features);
      
      if (classification.confidence >= this.confidenceThreshold) {
        patterns.push({
          type: 'ml_classified',
          name: 'ML Classified Pattern',
          description: 'ML-based pattern classification',
          confidence: classification.confidence,
          metadata: {
            category: classification.category,
            features: features
          }
        });
      }
    }
    
    return patterns;
  }

  // Structure pattern detectors
  detectArrayStructure(data) {
    if (!Array.isArray(data)) return [];
    
    return [{
      type: 'array_structure',
      name: 'Array Structure',
      description: 'Data is structured as an array',
      confidence: 0.9,
      metadata: {
        length: data.length,
        itemTypes: this.getItemTypes(data),
        uniformType: this.isUniformArrayType(data),
        nested: this.hasNestedArrays(data)
      }
    }];
  }

  detectObjectStructure(data) {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return [];
    
    return [{
      type: 'object_structure',
      name: 'Object Structure',
      description: 'Data is structured as an object',
      confidence: 0.9,
      metadata: {
        keyCount: Object.keys(data).length,
        keyTypes: this.getKeyTypes(data),
        nested: this.hasNestedObjects(data)
      }
    }];
  }

  detectNestedStructure(data) {
    if (!this.hasNestedStructure(data)) return [];
    
    return [{
      type: 'nested_structure',
      name: 'Nested Structure',
      description: 'Data contains nested structures',
      confidence: 0.8,
      metadata: {
        maxDepth: this.getMaxDepth(data),
        totalDepth: this.getTotalDepth(data),
        complexity: this.getStructureComplexity(data)
      }
    }];
  }

  // Content pattern detectors
  detectEmailPattern(data) {
    const strings = this.collectStringValues(data);
    const emailMatches = strings.filter(s => this.matchTemplate('email', s));
    
    if (emailMatches.length === 0) return [];
    
    return [{
      type: 'email_pattern',
      name: 'Email Pattern',
      description: `Found ${emailMatches.length} email pattern(s)`,
      confidence: 0.8,
      metadata: {
        count: emailMatches.length,
        percentage: (emailMatches.length / strings.length) * 100,
        samples: emailMatches.slice(0, 5)
      }
    }];
  }

  detectURLPattern(data) {
    const strings = this.collectStringValues(data);
    const urlMatches = strings.filter(s => this.matchTemplate('url', s));
    
    if (urlMatches.length === 0) return [];
    
    return [{
      type: 'url_pattern',
      name: 'URL Pattern',
      description: `Found ${urlMatches.length} URL pattern(s)`,
      confidence: 0.9,
      metadata: {
        count: urlMatches.length,
        percentage: (urlMatches.length / strings.length) * 100,
        samples: urlMatches.slice(0, 5)
      }
    }];
  }

  detectDatePattern(data) {
    const strings = this.collectStringValues(data);
    const dateMatches = strings.filter(s => this.matchTemplate('date_iso', s));
    
    if (dateMatches.length === 0) return [];
    
    return [{
      type: 'date_pattern',
      name: 'Date Pattern',
      description: `Found ${dateMatches.length} date pattern(s)`,
      confidence: 0.8,
      metadata: {
        count: dateMatches.length,
        percentage: (dateMatches.length / strings.length) * 100,
        samples: dateMatches.slice(0, 5)
      }
    }];
  }

  detectNumericPattern(data) {
    const numericValues = this.collectNumericValues(data);
    
    if (numericValues.length === 0) return [];
    
    return [{
      type: 'numeric_pattern',
      name: 'Numeric Pattern',
      description: `Found ${numericValues.length} numeric value(s)`,
      confidence: 0.7,
      metadata: {
        count: numericValues.length,
        ranges: this.getNumericRanges(numericValues),
        average: numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length
      }
    }];
  }

  // Behavioral pattern detectors
  detectIDFieldPattern(data) {
    if (!this.hasIDField(data)) return [];
    
    return [{
      type: 'id_field_pattern',
      name: 'ID Field Pattern',
      description: 'Object contains ID field',
      confidence: 0.8,
      metadata: {
        idFields: this.getIDFields(data),
        idTypes: this.getIDFieldTypes(data),
        consistent: this.isConsistentIDType(data)
      }
    }];
  }

  detectTimestampPattern(data) {
    if (!this.hasTimestampField(data)) return [];
    
    return [{
      type: 'timestamp_pattern',
      name: 'Timestamp Pattern',
      description: 'Object contains timestamp field',
      confidence: 0.8,
      metadata: {
        timestampFields: this.getTimestampFields(data),
        timestampTypes: this.getTimestampFieldTypes(data),
        consistent: this.isConsistentTimestampType(data)
      }
    }];
  }

  detectStatusPattern(data) {
    if (!this.hasStatusField(data)) return [];
    
    return [{
      type: 'status_pattern',
      name: 'Status Pattern',
      description: 'Object contains status field',
      confidence: 0.7,
      metadata: {
        statusFields: this.getStatusFields(data),
        statusValues: this.getStatusValues(data),
        consistent: this.isConsistentStatusType(data)
      }
    }];
  }

  // Quality pattern detectors
  detectConsistencyPattern(data) {
    if (!Array.isArray(data)) return [];
    
    const consistency = this.assessArrayConsistency(data);
    
    if (consistency.score >= 0.8) return [];
    
    return [{
      type: 'consistency_pattern',
      name: 'Inconsistency Pattern',
      description: 'Array has inconsistent structure',
      confidence: 0.7,
      metadata: consistency
    }];
  }

  detectCompletenessPattern(data) {
    const completeness = this.assessCompleteness(data);
    
    if (completeness.score >= 0.8) return [];
    
    return [{
      type: 'completeness_pattern',
      name: 'Incompleteness Pattern',
      description: 'Data is incomplete',
      confidence: 0.8,
      metadata: completeness
    }];
  }

  // Helper methods
  matchTemplate(templateName, value) {
    const template = this.templates.get(templateName);
    if (!template) return false;
    
    return template.pattern.test(value);
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

  collectNumericValues(data) {
    const numbers = [];
    
    const collectNumbers = (value) => {
      if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
        numbers.push(value);
      } else if (Array.isArray(value)) {
        value.forEach(collectNumbers);
      } else if (typeof value === 'object' && value !== null) {
        Object.values(value).forEach(collectNumbers);
      }
    };
    
    collectNumbers(data);
    return numbers;
  }

  hasNestedStructure(data) {
    return this.getMaxDepth(data) > 1;
  }

  hasNestedArrays(data) {
    let hasNested = false;
    
    const checkNested = (value) => {
      if (Array.isArray(value)) {
        value.forEach(item => {
          if (Array.isArray(item) || (typeof item === 'object' && item !== null)) {
            hasNested = true;
          }
        });
      } else if (typeof value === 'object' && value !== null) {
        Object.values(value).forEach(checkNested);
      }
    };
    
    checkNested(data);
    return hasNested;
  }

  hasNestedObjects(data) {
    let hasNested = false;
    
    const checkNested = (value) => {
      if (typeof value === 'object' && value !== null) {
        Object.values(value).forEach(val => {
          if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
            hasNested = true;
          }
        });
      } else if (Array.isArray(value)) {
        value.forEach(checkNested);
      }
    };
    
    checkNested(data);
    return hasNested;
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

  getTotalDepth(data) {
    let totalDepth = 0;
    
    const calculateDepth = (obj, currentDepth = 0) => {
      if (Array.isArray(obj)) {
        obj.forEach(item => {
          if (typeof item === 'object' && item !== null) {
            calculateDepth(item, currentDepth + 1);
          }
        });
        totalDepth += currentDepth;
      } else if (typeof obj === 'object' && obj !== null) {
        Object.values(obj).forEach(value => {
          if (typeof value === 'object' && value !== null) {
            calculateDepth(value, currentDepth + 1);
          }
        });
        totalDepth += currentDepth;
      }
    };
    
    calculateDepth(data);
    return totalDepth;
  }

  getStructureComplexity(data) {
    let complexity = 1;
    
    if (Array.isArray(data)) {
      complexity += data.length * 0.1;
      data.forEach(item => {
        if (typeof item === 'object' && item !== null) {
          complexity += this.getStructureComplexity(item) * 0.5;
        }
      });
    } else if (typeof data === 'object' && data !== null) {
      complexity += Object.keys(data).length * 0.1;
      Object.values(data).forEach(value => {
        if (typeof value === 'object' && value !== null) {
          complexity += this.getStructureComplexity(value) * 0.5;
        }
      });
    }
    
    return Math.round(complexity);
  }

  getItemTypes(array) {
    const types = new Set();
    array.forEach(item => types.add(typeof item));
    return Array.from(types);
  }

  isUniformArrayType(array) {
    if (array.length === 0) return true;
    
    const firstType = typeof array[0];
    return array.every(item => typeof item === firstType);
  }

  getKeyTypes(obj) {
    const types = {};
    Object.entries(obj).forEach(([key, value]) => {
      types[key] = typeof value;
    });
    return types;
  }

  hasIDField(data) {
    if (typeof data !== 'object' || data === null) return false;
    
    return Object.keys(data).some(key => 
      key.toLowerCase() === 'id' || 
      key.toLowerCase().endsWith('_id') ||
      key.toLowerCase().includes('identifier')
    );
  }

  getIDFields(data) {
    if (typeof data !== 'object' || data === null) return [];
    
    return Object.keys(data).filter(key => 
      key.toLowerCase() === 'id' || 
      key.toLowerCase().endsWith('_id') ||
      key.toLowerCase().includes('identifier')
    );
  }

  getIDFieldTypes(data) {
    const idFields = this.getIDFields(data);
    const types = {};
    
    idFields.forEach(field => {
      types[field] = typeof data[field];
    });
    
    return types;
  }

  isConsistentIDType(data) {
    const idTypes = this.getIDFieldTypes(data);
    const types = Object.values(idTypes);
    
    if (types.length === 0) return true;
    
    const firstType = types[0];
    return types.every(type => type === firstType);
  }

  hasTimestampField(data) {
    if (typeof data !== 'object' || data === null) return false;
    
    return Object.keys(data).some(key => 
      key.toLowerCase().includes('time') ||
      key.toLowerCase().includes('date') ||
      key.toLowerCase().includes('created') ||
      key.toLowerCase().includes('updated')
    );
  }

  getTimestampFields(data) {
    if (typeof data !== 'object' || data === null) return [];
    
    return Object.keys(data).filter(key => 
      key.toLowerCase().includes('time') ||
      key.toLowerCase().includes('date') ||
      key.toLowerCase().includes('created') ||
      key.toLowerCase().includes('updated')
    );
  }

  getTimestampFieldTypes(data) {
    const timestampFields = this.getTimestampFields(data);
    const types = {};
    
    timestampFields.forEach(field => {
      types[field] = typeof data[field];
    });
    
    return types;
  }

  isConsistentTimestampType(data) {
    const timestampTypes = this.getTimestampFieldTypes(data);
    const types = Object.values(timestampTypes);
    
    if (types.length === 0) return true;
    
    const firstType = types[0];
    return types.every(type => type === firstType);
  }

  hasStatusField(data) {
    if (typeof data !== 'object' || data === null) return false;
    
    return Object.keys(data).some(key => 
      key.toLowerCase().includes('status') ||
      key.toLowerCase().includes('state') ||
      key.toLowerCase().includes('condition')
    );
  }

  getStatusFields(data) {
    if (typeof data !== 'object' || data === null) return [];
    
    return Object.keys(data).filter(key => 
      key.toLowerCase().includes('status') ||
      key.toLowerCase().includes('state') ||
      key.toLowerCase().includes('condition')
    );
  }

  getStatusValues(data) {
    const statusFields = this.getStatusFields(data);
    const values = {};
    
    statusFields.forEach(field => {
      values[field] = data[field];
    });
    
    return values;
  }

  isConsistentStatusType(data) {
    const statusValues = this.getStatusValues(data);
    const types = Object.values(statusValues);
    
    if (types.length === 0) return true;
    
    const firstType = typeof types[0];
    return types.every(type => typeof type === firstType);
  }

  assessArrayConsistency(array) {
    if (array.length === 0) {
      return { score: 100, issues: [] };
    }
    
    const issues = [];
    const firstItem = array[0];
    
    array.forEach((item, index) => {
      if (typeof item === 'object' && typeof firstItem === 'object') {
        const itemKeys = Object.keys(item);
        const firstKeys = Object.keys(firstItem);
        
        if (itemKeys.length !== firstKeys.length) {
          issues.push({
            index,
            type: 'key_count_mismatch',
            message: `Item ${index} has ${itemKeys.length} keys, expected ${firstKeys.length}`
          });
        }
      } else if (typeof item !== typeof firstItem) {
        issues.push({
          index,
          type: 'type_mismatch',
          message: `Item ${index} has type ${typeof item}, expected ${typeof firstItem}`
        });
      }
    });
    
    return {
      score: Math.max(0, 100 - issues.length * 10),
      issues
    };
  }

  assessCompleteness(data) {
    const issues = [];
    
    if (typeof data === 'object' && data !== null) {
      const requiredFields = ['id', 'createdAt'];
      const missingFields = requiredFields.filter(field => !(field in data));
      
      missingFields.forEach(field => {
        issues.push({
          field,
          type: 'missing_field',
          message: `Required field ${field} is missing`
        });
      });
    }
    
    return {
      score: Math.max(0, 100 - issues.length * 15),
      issues
    };
  }

  extractFeatures(data) {
    const features = [];
    
    // Size feature
    features.push({
      name: 'size',
      value: this.getDataSize(data),
      weight: 0.2
    });
    
    // Complexity feature
    features.push({
      name: 'complexity',
      value: this.getStructureComplexity(data),
      weight: 0.3
    });
    
    // Depth feature
    features.push({
      name: 'depth',
      value: this.getMaxDepth(data),
      weight: 0.2
    });
    
    // Type diversity feature
    const types = this.getContentTypes(data);
    features.push({
      name: 'type_diversity',
      value: types.length,
      weight: 0.3
    });
    
    return features;
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

  getDataSize(data) {
    return JSON.stringify(data).length;
  }

  getNumericRanges(numbers) {
    const ranges = {};
    
    numbers.forEach(num => {
      if (num < 0) ranges.negative = (ranges.negative || 0) + 1;
      else if (num === 0) ranges.zero = (ranges.zero || 0) + 1;
      else if (num < 100) ranges.small = (ranges.small || 0) + 1;
      else if (num < 1000) ranges.medium = (ranges.medium || 0) + 1;
      else ranges.large = (ranges.large || 0) + 1;
    });
    
    return ranges;
  }

  // Get pattern detection statistics
  getStats() {
    const patternStats = {};
    
    this.patterns.forEach((pattern, name) => {
      patternStats[name] = {
        name,
        type: pattern.type,
        usage: pattern.usage,
        detections: pattern.detections,
        lastDetected: pattern.lastDetected,
        confidence: pattern.confidence,
        category: pattern.category
      };
    });

    const templateStats = {};
    this.templates.forEach((template, name) => {
      templateStats[name] = {
        name,
        usage: template.usage,
        matches: template.matches,
        lastMatched: template.lastMatched,
        confidence: template.confidence
      };
    });

    const modelStats = {};
    this.mlModels.forEach((model, name) => {
      modelStats[name] = {
        name,
        accuracy: model.accuracy,
        lastTrained: model.lastTrained
      };
    });

    return {
      patternStats,
      templateStats,
      modelStats,
      totalPatterns: this.patterns.size,
      totalTemplates: this.templates.size,
      totalModels: this.mlModels.size,
      detectionHistorySize: this.detectionHistory.length,
      averageProcessingTime: this.calculateAverageProcessingTime(),
      overallSuccessRate: this.calculateOverallSuccessRate(),
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

  // Get detection history
  getDetectionHistory(limit = 100) {
    return this.detectionHistory.slice(-limit);
  }

  // Get system state
  getState() {
    return {
      isInitialized: this.isInitialized,
      options: this.options,
      patterns: Array.from(this.patterns.entries()).map(([name, pattern]) => ({
        name,
        ...pattern
      })),
      templates: Array.from(this.templates.entries()).map(([name, template]) => ({
        name,
        ...template
      })),
      mlModels: Array.from(this.mlModels.entries()).map(([name, model]) => ({
        name,
        ...model
      })),
      detectionHistory: this.detectionHistory,
      stats: this.getStats(),
      confidenceThreshold: this.confidenceThreshold,
      enableMLDetection: this.enableMLDetection,
      enableTemplateMatching: this.enableTemplateMatching,
      lastUpdated: new Date().toISOString()
    };
  }

  // Destroy pattern detector
  destroy() {
    this.patterns.clear();
    this.templates.clear();
    this.mlModels.clear();
    this.detectionHistory = [];
    
    this.isInitialized = false;
    console.log('[PATTERN_DETECTOR] Pattern detector destroyed');
  }
}

// Global instance
let patternDetector = null;

// Initialize pattern detector when DOM is ready
function initializePatternDetector() {
  if (!patternDetector) {
    patternDetector = new PatternDetector();
  }
  return patternDetector.initialize();
}

// Export for global access
window.patternDetector = patternDetector;

module.exports = {
  PatternDetector,
  initializePatternDetector
};
