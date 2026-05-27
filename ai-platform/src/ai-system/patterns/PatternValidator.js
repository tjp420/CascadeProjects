/**
 * Pattern Validation and Classification System
 * 
 * Pattern validation with confidence scoring, classification,
 * validation rules, and pattern recommendation system
 */

class PatternValidator {
  constructor(options = {}) {
    this.validationRules = new Map();
    this.classifiers = new Map();
    this.recommendations = new Map();
    this.confidenceThreshold = options.confidenceThreshold || 0.8;
    this.strictMode = options.strictMode || false;
    this.stats = {
      validationsPerformed: 0,
      patternsValidated: 0,
      classificationsMade: 0,
      recommendationsGenerated: 0
    };
    
    this.initializeValidationRules();
    this.initializeClassifiers();
    console.log('[PATTERN_VALIDATOR] Pattern validator initialized');
  }

  // Initialize validation rules for different pattern types
  initializeValidationRules() {
    // User pattern validation rules
    this.addValidationRule('user', {
      requiredFields: ['id', 'name', 'email'],
      optionalFields: ['phone', 'address', 'preferences', 'created_at', 'updated_at'],
      fieldRules: {
        id: {
          type: 'string',
          pattern: /^[a-zA-Z0-9_-]+$/,
          minLength: 1,
          maxLength: 50,
          description: 'User ID must be alphanumeric with underscores/hyphens'
        },
        name: {
          type: 'string',
          minLength: 1,
          maxLength: 100,
          pattern: /^[a-zA-Z\s]+$/,
          description: 'Name must contain only letters and spaces'
        },
        email: {
          type: 'string',
          pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          description: 'Must be a valid email address'
        },
        phone: {
          type: 'string',
          pattern: /^\+?1?-?\d{3}-?\d{3}-?\d{4}$/,
          description: 'Must be a valid phone number'
        },
        created_at: {
          type: 'string',
          format: 'date-time',
          description: 'Must be a valid ISO datetime'
        },
        updated_at: {
          type: 'string',
          format: 'date-time',
          description: 'Must be a valid ISO datetime'
        }
      }
    });

    // Product pattern validation rules
    this.addValidationRule('product', {
      requiredFields: ['id', 'name', 'price'],
      optionalFields: ['description', 'category', 'tags', 'inventory', 'images', 'created_at', 'updated_at'],
      fieldRules: {
        id: {
          type: 'string',
          pattern: /^[a-zA-Z0-9_-]+$/,
          minLength: 1,
          maxLength: 50,
          description: 'Product ID must be alphanumeric with underscores/hyphens'
        },
        name: {
          type: 'string',
          minLength: 1,
          maxLength: 200,
          description: 'Product name is required'
        },
        price: {
          type: 'number',
          minimum: 0,
          description: 'Price must be a non-negative number'
        },
        currency: {
          type: 'string',
          enum: ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'],
          description: 'Currency must be a valid ISO currency code'
        },
        category: {
          type: 'string',
          minLength: 1,
          maxLength: 50,
          description: 'Category is required'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags must be an array of strings'
        },
        inventory: {
          type: 'object',
          properties: {
            available: { type: 'number', minimum: 0 },
            reserved: { type: 'number', minimum: 0 }
          },
          description: 'Inventory must be an object with available/reserved counts'
        }
      }
    });

    // Order pattern validation rules
    this.addValidationRule('order', {
      requiredFields: ['id', 'user_id', 'items', 'total'],
      optionalFields: ['status', 'payment_method', 'shipping_address', 'billing_address', 'created_at', 'updated_at'],
      fieldRules: {
        id: {
          type: 'string',
          pattern: /^[a-zA-Z0-9_-]+$/,
          minLength: 1,
          maxLength: 50,
          description: 'Order ID must be alphanumeric with underscores/hyphens'
        },
        user_id: {
          type: 'string',
          pattern: /^[a-zA-Z0-9_-]+$/,
          minLength: 1,
          maxLength: 50,
          description: 'User ID must be alphanumeric with underscores/hyphens'
        },
        items: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['product_id', 'quantity', 'price'],
            properties: {
              product_id: { type: 'string', description: 'Product ID is required' },
              quantity: { type: 'number', minimum: 1, description: 'Quantity must be at least 1' },
              price: { type: 'number', minimum: 0, description: 'Price must be non-negative' }
            }
          },
          description: 'Items must be an array with at least one item'
        },
        total: {
          type: 'number',
          minimum: 0,
          description: 'Total must be a non-negative number'
        },
        status: {
          type: 'string',
          enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
          description: 'Status must be a valid order status'
        }
      }
    });

    console.log(`[PATTERN_VALIDATOR] Initialized ${this.validationRules.size} validation rule sets`);
  }

  // Initialize classifiers for pattern classification
  initializeClassifiers() {
    // Type classifier
    this.addClassifier('type', {
      classify: (data) => this.classifyByType(data),
      confidence: 0.95
    });

    // Category classifier
    this.addClassifier('category', {
      classify: (data) => this.classifyByCategory(data),
      confidence: 0.90
    });

    // Complexity classifier
    this.addClassifier('complexity', {
      classify: (data) => this.classifyByComplexity(data),
      confidence: 0.85
    });

    // Quality classifier
    this.addClassifier('quality', {
      classify: (data) => this.classifyByQuality(data),
      confidence: 0.80
    });

    console.log(`[PATTERN_VALIDATOR] Initialized ${this.classifiers.size} classifiers`);
  }

  // Add validation rule set
  addValidationRule(patternType, rules) {
    this.validationRules.set(patternType, rules);
    console.log(`[PATTERN_VALIDATOR] Added validation rules for: ${patternType}`);
  }

  // Add classifier
  addClassifier(name, classifier) {
    this.classifiers.set(name, classifier);
    console.log(`[PATTERN_VALIDATOR] Added classifier: ${name}`);
  }

  // Validate pattern against rules
  validatePattern(data, patternType, options = {}) {
    this.stats.validationsPerformed++;
    
    const rules = this.validationRules.get(patternType);
    if (!rules) {
      throw new Error(`No validation rules found for pattern type: ${patternType}`);
    }

    const result = {
      valid: true,
      errors: [],
      warnings: [],
      score: 0,
      validatedFields: {},
      missingFields: [],
      extraFields: [],
      patternType,
      timestamp: new Date().toISOString()
    };

    try {
      // Check required fields
      const dataFields = typeof data === 'object' && data !== null ? Object.keys(data) : [];
      
      rules.requiredFields.forEach(field => {
        if (!dataFields.includes(field)) {
          result.errors.push({
            field,
            message: `Required field missing: ${field}`,
            code: 'REQUIRED_FIELD_MISSING',
            severity: 'error'
          });
          result.missingFields.push(field);
          result.valid = false;
        } else {
          result.validatedFields[field] = 'present';
        }
      });

      // Check extra fields
      const allowedFields = [...rules.requiredFields, ...(rules.optionalFields || [])];
      dataFields.forEach(field => {
        if (!allowedFields.includes(field)) {
          result.warnings.push({
            field,
            message: `Extra field not in schema: ${field}`,
            code: 'EXTRA_FIELD',
            severity: 'warning'
          });
          result.extraFields.push(field);
        }
      });

      // Validate field rules
      Object.entries(rules.fieldRules || {}).forEach(([field, rule]) => {
        if (data.hasOwnProperty(field)) {
          const fieldResult = this.validateField(data[field], field, rule);
          
          if (!fieldResult.valid) {
            result.errors.push(...fieldResult.errors);
            result.valid = false;
          }
          
          if (fieldResult.warnings) {
            result.warnings.push(...fieldResult.warnings);
          }
          
          result.validatedFields[field] = fieldResult.valid ? 'valid' : 'invalid';
        }
      });

      // Calculate overall score
      result.score = this.calculateValidationScore(result);

    } catch (error) {
      result.errors.push({
        field: 'root',
        message: `Validation error: ${error.message}`,
        code: 'VALIDATION_ERROR',
        severity: 'error'
      });
      result.valid = false;
    }

    if (result.valid) {
      this.stats.patternsValidated++;
    }

    return result;
  }

  // Validate individual field
  validateField(value, fieldName, rule) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Type validation
    if (rule.type && value !== undefined && value !== null) {
      if (!this.validateType(value, rule.type)) {
        result.errors.push({
          field: fieldName,
          message: `Expected type ${rule.type}, got ${typeof value}`,
          code: 'TYPE_MISMATCH',
          severity: 'error'
        });
        result.valid = false;
      }
    }

    // Required field validation
    if (rule.required && (value === undefined || value === null || value === '')) {
      result.errors.push({
        field: fieldName,
        message: `Required field is empty`,
        code: 'REQUIRED_FIELD_EMPTY',
        severity: 'error'
      });
      result.valid = false;
    }

    // String validations
    if (typeof value === 'string') {
      if (rule.minLength && value.length < rule.minLength) {
        result.errors.push({
          field: fieldName,
          message: `String too short. Minimum length: ${rule.minLength}`,
          code: 'STRING_TOO_SHORT',
          severity: 'error'
        });
        result.valid = false;
      }

      if (rule.maxLength && value.length > rule.maxLength) {
        result.errors.push({
          field: fieldName,
          message: `String too long. Maximum length: ${rule.maxLength}`,
          code: 'STRING_TOO_LONG',
          severity: 'error'
        });
        result.valid = false;
      }

      if (rule.pattern && !new RegExp(rule.pattern).test(value)) {
        result.errors.push({
          field: fieldName,
          message: `String does not match required pattern: ${rule.pattern}`,
          code: 'PATTERN_MISMATCH',
          severity: 'error'
        });
        result.valid = false;
      }

      if (rule.format) {
        const formatValidation = this.validateFormat(value, rule.format);
        if (!formatValidation.valid) {
          result.errors.push({
            field: fieldName,
            message: formatValidation.message,
            code: 'FORMAT_INVALID',
            severity: 'error'
          });
          result.valid = false;
        }
      }
    }

    // Number validations
    if (typeof value === 'number') {
      if (rule.minimum !== undefined && value < rule.minimum) {
        result.errors.push({
          field: fieldName,
          message: `Number too small. Minimum: ${rule.minimum}`,
          code: 'NUMBER_TOO_SMALL',
          severity: 'error'
        });
        result.valid = false;
      }

      if (rule.maximum !== undefined && value > rule.maximum) {
        result.errors.push({
          field: fieldName,
          message: `Number too large. Maximum: ${rule.maximum}`,
          code: 'NUMBER_TOO_LARGE',
          severity: 'error'
        });
        result.valid = false;
      }
    }

    // Array validations
    if (Array.isArray(value)) {
      if (rule.minItems && value.length < rule.minItems) {
        result.errors.push({
          field: fieldName,
          message: `Array too short. Minimum items: ${rule.minItems}`,
          code: 'ARRAY_TOO_SHORT',
          severity: 'error'
        });
        result.valid = false;
      }

      if (rule.maxItems && value.length > rule.maxItems) {
        result.errors.push({
          field: fieldName,
          message: `Array too long. Maximum items: ${rule.maxItems}`,
          code: 'ARRAY_TOO_LONG',
          severity: 'error'
        });
        result.valid = false;
      }

      // Validate array items
      if (rule.items && typeof rule.items === 'object') {
        value.forEach((item, index) => {
          const itemResult = this.validateField(item, `${fieldName}[${index}]`, rule.items);
          if (!itemResult.valid) {
            result.errors.push(...itemResult.errors);
            result.valid = false;
          }
          
          if (itemResult.warnings) {
            result.warnings.push(...itemResult.warnings);
          }
        });
      }
    }

    // Object validations
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (rule.properties) {
        Object.entries(rule.properties).forEach(([propName, propRule]) => {
          if (value.hasOwnProperty(propName)) {
            const propResult = this.validateField(value[propName], `${fieldName}.${propName}`, propRule);
            
            if (!propResult.valid) {
              result.errors.push(...propResult.errors);
              result.valid = false;
            }
            
            if (propResult.warnings) {
              result.warnings.push(...propResult.warnings);
            }
          }
        });
      }
    }

    // Enum validation
    if (rule.enum && !rule.enum.includes(value)) {
      result.errors.push({
        field: fieldName,
        message: `Value must be one of: ${rule.enum.join(', ')}`,
        code: 'ENUM_INVALID',
        severity: 'error'
      });
      result.valid = false;
    }

    return result;
  }

  // Validate type
  validateType(value, expectedType) {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return true;
    }
  }

  // Validate format
  validateFormat(value, format) {
    const result = { valid: true, message: '' };

    switch (format) {
      case 'email':
        result.valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        result.message = result.valid ? '' : 'Invalid email format';
        break;
      case 'phone':
        result.valid = /^[\d\s\-\+\(\)]+$/.test(value);
        result.message = result.valid ? '' : 'Invalid phone format';
        break;
      case 'date-time':
        result.valid = !isNaN(Date.parse(value));
        result.message = result.valid ? '' : 'Invalid date-time format';
        break;
      case 'date':
        result.valid = /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
        result.message = result.valid ? '' : 'Invalid date format (YYYY-MM-DD)';
        break;
      case 'url':
        try {
          new URL(value);
          result.valid = true;
        } catch {
          result.valid = false;
          result.message = 'Invalid URL format';
        }
        break;
      default:
        result.valid = true;
    }

    return result;
  }

  // Calculate validation score
  calculateValidationScore(result) {
    if (result.valid) {
      return 100;
    }

    const totalChecks = result.errors.length + result.warnings.length;
    if (totalChecks === 0) return 100;

    const errorWeight = 2;
    const warningWeight = 1;
    
    const weightedScore = result.errors.length * errorWeight + result.warnings.length * warningWeight;
    const maxWeight = totalChecks * errorWeight;
    
    return Math.max(0, 100 - Math.round((weightedScore / maxWeight) * 100));
  }

  // Classify pattern by type
  classifyByType(data) {
    if (Array.isArray(data)) {
      return {
        type: 'array',
        confidence: 0.95,
        features: ['array', 'collection', 'list']
      };
    }

    if (typeof data === 'object' && data !== null) {
      const keys = Object.keys(data);
      
      // User data detection
      if (this.hasUserFields(keys)) {
        return {
          type: 'user',
          confidence: 0.95,
          features: ['object', 'user', 'person']
        };
      }
      
      // Product data detection
      if (this.hasProductFields(keys)) {
        return {
          type: 'product',
          confidence: 0.95,
          features: ['object', 'product', 'item']
        };
      }
      
      // Order data detection
      if (this.hasOrderFields(keys)) {
        return {
          type: 'order',
          confidence: 0.95,
          features: ['object', 'order', 'transaction']
        };
      }
      
      // Event data detection
      if (this.hasEventFields(keys)) {
        return {
          type: 'event',
          confidence: 0.90,
          features: ['object', 'event', 'log']
        };
      }
      
      // Log data detection
      if (this.hasLogFields(keys)) {
        return {
          type: 'log',
          confidence: 0.90,
          features: ['object', 'log', 'system']
        };
      }
      
      // Config data detection
      if (this.hasConfigFields(keys)) {
        return {
          type: 'config',
          confidence: 0.85,
          features: ['object', 'configuration', 'settings']
        };
      }
      
      // API response detection
      if (this.hasAPIResponseFields(keys)) {
        return {
          type: 'api_response',
          confidence: 0.90,
          features: ['object', 'response', 'api']
        };
      }
      
      // Generic object
      return {
        type: 'object',
        confidence: 0.70,
        features: ['object', 'generic']
      };
    }

    // Primitive type
    return {
      type: typeof data,
      confidence: 0.80,
      features: ['primitive', 'simple']
    };
  }

  // Classify pattern by category
  classifyByCategory(data) {
    if (typeof data !== 'object' || data === null) {
      return {
        category: 'primitive',
        confidence: 0.80,
        features: []
      };
    }

    const keys = Object.keys(data);
    
    // Basic category
    const basicFields = ['id', 'name', 'type', 'status'];
    const hasBasicFields = basicFields.filter(field => keys.includes(field)).length;
    
    if (hasBasicFields >= 2) {
      return {
        category: 'basic',
        confidence: 0.85,
        features: ['structured', 'standard']
      };
    }

    // Extended category
    const extendedFields = ['description', 'metadata', 'properties', 'attributes'];
    const hasExtendedFields = extendedFields.filter(field => keys.includes(field)).length;
    
    if (hasExtendedFields >= 2) {
      return {
        category: 'extended',
        confidence: 0.90,
        features: ['structured', 'detailed']
      };
    }

    // E-commerce category
    const ecommerceFields = ['price', 'currency', 'inventory', 'shipping', 'billing'];
    const hasEcommerceFields = ecommerceFields.filter(field => keys.includes(field)).length;
    
    if (hasEcommerceFields >= 2) {
      return {
        category: 'ecommerce',
        confidence: 0.92,
        features: ['business', 'commerce']
      };
    }

    // Analytics category
    const analyticsFields = ['timestamp', 'session_id', 'user_id', 'event', 'duration'];
    const hasAnalyticsFields = analyticsFields.filter(field => keys.includes(field)).length;
    
    if (hasAnalyticsFields >= 3) {
      return {
        category: 'analytics',
        confidence: 0.88,
        features: ['data', 'tracking', 'metrics']
      };
    }

    return {
      category: 'generic',
      confidence: 0.75,
      features: ['unstructured']
    };
  }

  // Classify by complexity
  classifyByComplexity(data) {
    if (typeof data !== 'object' || data === null) {
      return {
        complexity: 'simple',
        confidence: 0.90,
        features: ['primitive']
      };
    }

    const keys = Object.keys(data);
    const values = Object.values(data);
    
    // Simple complexity
    if (keys.length <= 5 && values.every(v => typeof v !== 'object' || v === null)) {
      return {
        complexity: 'simple',
        confidence: 0.90,
        features: ['shallow', 'basic']
      };
    }

    // Check for nested objects
    const hasNestedObjects = values.some(v => typeof v === 'object' && v !== null && !Array.isArray(v));
    const hasArrays = values.some(v => Array.isArray(v));
    
    if (hasNestedObjects || hasArrays) {
      // Calculate depth
      const maxDepth = this.calculateDepth(data);
      
      if (maxDepth <= 2) {
        return {
          complexity: 'moderate',
          confidence: 0.85,
          features: ['nested', 'structured']
        };
      } else {
        return {
          complexity: 'complex',
          confidence: 0.80,
          features: ['deeply_nested', 'hierarchical']
        };
      }
    }

    return {
      complexity: 'simple',
      confidence: 0.90,
      features: ['flat', 'basic']
    };
  }

  // Classify by quality
  classifyByQuality(data) {
    const validation = this.quickValidate(data);
    
    if (validation.valid) {
      return {
        quality: 'excellent',
        confidence: 0.95,
        features: ['valid', 'well-structured']
      };
    }

    const errorCount = validation.errors.length;
    const warningCount = validation.warnings.length;
    const totalIssues = errorCount + warningCount;

    if (totalIssues === 0) {
      return {
        quality: 'excellent',
        confidence: 0.95,
        features: ['valid', 'perfect']
      };
    } else if (errorCount === 0) {
      return {
        quality: 'good',
        confidence: 0.85,
        features: ['valid', 'minor_issues']
      };
    } else if (errorCount <= 2) {
      return {
        quality: 'acceptable',
        confidence: 0.75,
        features: ['invalid', 'fixable']
      };
    } else {
      return {
        quality: 'poor',
        confidence: 0.60,
        features: ['invalid', 'major_issues']
      };
    }
  }

  // Quick validation for quality classification
  quickValidate(data) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    try {
      if (typeof data === 'object' && data !== null) {
        // Basic structure checks
        const keys = Object.keys(data);
        if (keys.length === 0) {
          result.errors.push({
            field: 'root',
            message: 'Empty object',
            code: 'EMPTY_OBJECT',
            severity: 'warning'
          });
        }

        // Check for null/undefined values
        const nullCount = Object.values(data).filter(v => v === null || v === undefined).length;
        if (nullCount > 0) {
          result.warnings.push({
            field: 'general',
            message: `${nullCount} null/undefined values found`,
            code: 'NULL_VALUES',
            severity: 'warning'
          });
        }
      }
    } catch (error) {
      result.valid = false;
      result.errors.push({
        field: 'root',
        message: `Quick validation error: ${error.message}`,
        code: 'VALIDATION_ERROR',
        severity: 'error'
      });
    }

    return result;
  }

  // Helper methods for classification
  hasUserFields(keys) {
    const userFields = ['id', 'name', 'email', 'phone', 'address', 'preferences', 'created_at', 'updated_at'];
    return userFields.filter(field => keys.includes(field)).length >= 3;
  }

  hasProductFields(keys) {
    const productFields = ['id', 'name', 'price', 'category', 'description', 'tags', 'inventory'];
    return productFields.filter(field => keys.includes(field)).length >= 3;
  }

  hasOrderFields(keys) {
    const orderFields = ['id', 'user_id', 'items', 'total', 'status', 'created_at', 'updated_at'];
    return orderFields.filter(field => keys.includes(field)).length >= 3;
  }

  hasEventFields(keys) {
    const eventFields = ['id', 'type', 'timestamp', 'source', 'data'];
    return eventFields.filter(field => keys.includes(field)).length >= 3;
  }

  hasLogFields(keys) {
    const logFields = ['timestamp', 'level', 'message', 'source', 'context'];
    return logFields.filter(field => keys.includes(field)).length >= 3;
  }

  hasConfigFields(keys) {
    const configFields = ['app_name', 'version', 'environment', 'database', 'features'];
    return configFields.filter(field => keys.includes(field)).length >= 2;
  }

  hasAPIResponseFields(keys) {
    const apiFields = ['status', 'data', 'message', 'timestamp', 'error'];
    return apiFields.filter(field => keys.includes(field)).length >= 2;
  }

  calculateDepth(obj, currentDepth = 0) {
    if (typeof obj !== 'object' || obj === null) {
      return currentDepth;
    }

    let maxDepth = currentDepth;

    Object.values(obj).forEach(value => {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const depth = this.calculateDepth(value, currentDepth + 1);
        maxDepth = Math.max(maxDepth, depth);
      }
    });

    return maxDepth;
  }

  // Comprehensive pattern validation
  validatePatternComprehensive(data, patternType, options = {}) {
    const { includeClassification = true, includeRecommendations = true } = options;
    
    // Basic validation
    const validationResult = this.validatePattern(data, patternType);
    
    const result = {
      ...validationResult,
      timestamp: new Date().toISOString()
    };

    // Add classification if requested
    if (includeClassification) {
      this.stats.classificationsMade++;
      
      const typeClassification = this.classifiers.get('type').classify(data);
      const categoryClassification = this.classifiers.get('category').classify(data);
      const complexityClassification = this.classifiers.get('complexity').classify(data);
      const qualityClassification = this.classifiers.get('quality').classify(data);
      
      result.classification = {
        type: typeClassification,
        category: categoryClassification,
        complexity: complexityClassification,
        quality: qualityClassification,
        confidence: (typeClassification.confidence + categoryClassification.confidence + complexityClassification.confidence + qualityClassification.confidence) / 4
      };
    }

    // Add recommendations if requested
    if (includeRecommendations) {
      this.stats.recommendationsGenerated++;
      result.recommendations = this.generateRecommendations(validationResult, result.classification);
    }

    return result;
  }

  // Generate recommendations based on validation results
  generateRecommendations(validationResult, classification) {
    const recommendations = [];

    // Validation-based recommendations
    if (!validationResult.valid) {
      recommendations.push({
        type: 'validation_fix',
        priority: 'high',
        action: 'Fix validation errors',
        description: `${validationResult.errors.length} errors found requiring attention`,
        fields: validationResult.errors.map(e => e.field)
      });
    }

    // Warning-based recommendations
    if (validationResult.warnings.length > 0) {
      recommendations.push({
        type: 'warning_review',
        priority: 'medium',
        action: 'Review warnings',
        description: `${validationResult.warnings.length} warnings identified for review`,
        fields: validationResult.warnings.map(w => w.field)
      });
    }

    // Classification-based recommendations
    if (classification) {
      if (classification.complexity === 'complex') {
        recommendations.push({
          type: 'simplify_structure',
          priority: 'medium',
          action: 'Simplify data structure',
          description: 'Consider flattening complex nested structures',
          confidence: classification.confidence
        });
      }

      if (classification.quality === 'poor') {
        recommendations.push({
          type: 'quality_improvement',
          priority: 'high',
          action: 'Improve data quality',
          description: 'Significant quality improvements needed',
          confidence: classification.confidence
        });
      }

      if (classification.category === 'generic') {
        recommendations.push({
          type: 'pattern_specification',
          priority: 'low',
          action: 'Define pattern specification',
          description: 'Consider defining a specific pattern type',
          confidence: classification.confidence
        });
      }
    }

    return recommendations;
  }

  // Batch validation
  validateBatch(items, patternType, options = {}) {
    const results = [];
    
    items.forEach((item, index) => {
      try {
        const result = this.validatePatternComprehensive(item, patternType, options);
        results.push({
          index,
          ...result
        });
      } catch (error) {
        results.push({
          index,
          valid: false,
          errors: [{ message: error.message, code: 'VALIDATION_ERROR' }],
          warnings: [],
          timestamp: new Date().toISOString()
        });
      }
    });

    return {
      results,
      summary: this.generateBatchSummary(results)
    };
  }

  // Generate batch summary
  generateBatchSummary(results) {
    const valid = results.filter(r => r.valid).length;
    const invalid = results.filter(r => !r.valid).length;
    const withWarnings = results.filter(r => r.warnings.length > 0).length;
    
    return {
      total: results.length,
      valid,
      invalid,
      withWarnings,
      successRate: results.length > 0 ? (valid / results.length) * 100 : 0,
      averageScore: results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length,
      timestamp: new Date().toISOString()
    };
  }

  // Get statistics
  getStats() {
    return {
      ...this.stats,
      validationRules: this.validationRules.size,
      classifiers: this.classifiers.size,
      confidenceThreshold: this.confidenceThreshold,
      strictMode: this.strictMode
    };
  }

  // Update confidence threshold
  updateConfidenceThreshold(newThreshold) {
    this.confidenceThreshold = newThreshold;
    console.log(`[PATTERN_VALIDATOR] Confidence threshold updated: ${newThreshold}`);
  }

  // Update strict mode
  updateStrictMode(strictMode) {
    this.strictMode = strictMode;
    console.log(`[PATTERN_VALIDATOR] Strict mode: ${strictMode}`);
  }

  // Export validation rules
  exportValidationRules() {
    const rules = {};
    
    this.validationRules.forEach((rule, name) => {
      rules[name] = rule;
    });
    
    return {
      rules,
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  // Import validation rules
  importValidationRules(rulesData) {
    if (rulesData.rules) {
      Object.entries(rulesData.rules).forEach(([name, rule]) => {
        this.validationRules.set(name, rule);
      });
    }
    
    console.log(`[PATTERN_VALIDATOR] Imported ${Object.keys(rulesData.rules || {}).length} validation rule sets`);
  }
}

module.exports = PatternValidator;
