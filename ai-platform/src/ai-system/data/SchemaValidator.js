/**
 * Schema Validation and Auto-Completion System
 * 
 * Implements comprehensive schema validation for different data types
 * with automatic field completion, validation rules, and schema management
 */

const logger = require('../../lib/app-logger');

class SchemaValidator {
  constructor(options = {}) {
    this.schemas = new Map();
    this.validationRules = new Map();
    this.fieldCompleters = new Map();
    this.strictMode = options.strictMode || false;
    this.autoComplete = options.autoComplete !== false;
    this.stats = {
      validationsPerformed: 0,
      fieldsCompleted: 0,
      validationErrors: 0,
      schemasLoaded: 0
    };
    
    this.initializeDefaultSchemas();
    logger.info('[SCHEMA] Schema validator initialized');
  }

  // Initialize default schemas for common data types
  initializeDefaultSchemas() {
    // JSON schema
    this.addSchema('json', {
      type: 'object',
      required: [],
      properties: {
        id: { type: 'string', required: false },
        name: { type: 'string', required: false },
        description: { type: 'string', required: false },
        created_at: { type: 'string', format: 'date-time', required: false },
        updated_at: { type: 'string', format: 'date-time', required: false },
        status: { type: 'string', enum: ['active', 'inactive', 'pending'], required: false },
        metadata: { type: 'object', required: false }
      }
    });

    // User data schema
    this.addSchema('user', {
      type: 'object',
      required: ['id', 'name', 'email'],
      properties: {
        id: { type: 'string', required: true, pattern: '^[a-zA-Z0-9_-]+$' },
        name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
        email: { type: 'string', required: true, format: 'email' },
        phone: { type: 'string', required: false, format: 'phone' },
        age: { type: 'number', required: false, minimum: 0, maximum: 150 },
        address: { type: 'object', required: false },
        preferences: { type: 'object', required: false },
        created_at: { type: 'string', format: 'date-time', required: false },
        updated_at: { type: 'string', format: 'date-time', required: false }
      }
    });

    // Product data schema
    this.addSchema('product', {
      type: 'object',
      required: ['id', 'name', 'price'],
      properties: {
        id: { type: 'string', required: true },
        name: { type: 'string', required: true, minLength: 1, maxLength: 200 },
        description: { type: 'string', required: false, maxLength: 1000 },
        price: { type: 'number', required: true, minimum: 0 },
        currency: { type: 'string', required: false, enum: ['USD', 'EUR', 'GBP', 'JPY'] },
        category: { type: 'string', required: false },
        tags: { type: 'array', required: false, items: { type: 'string' } },
        inventory: { type: 'object', required: false },
        created_at: { type: 'string', format: 'date-time', required: false },
        updated_at: { type: 'string', format: 'date-time', required: false }
      }
    });

    // Order data schema
    this.addSchema('order', {
      type: 'object',
      required: ['id', 'user_id', 'items', 'total'],
      properties: {
        id: { type: 'string', required: true },
        user_id: { type: 'string', required: true },
        items: { type: 'array', required: true, minItems: 1 },
        total: { type: 'number', required: true, minimum: 0 },
        status: { type: 'string', required: false, enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] },
        shipping_address: { type: 'object', required: false },
        billing_address: { type: 'object', required: false },
        payment_method: { type: 'string', required: false },
        created_at: { type: 'string', format: 'date-time', required: false },
        updated_at: { type: 'string', format: 'date-time', required: false }
      }
    });

    logger.debug(`[SCHEMA] Loaded ${this.schemas.size} default schemas`);
  }

  // Add a new schema
  addSchema(name, schema) {
    this.schemas.set(name, schema);
    this.stats.schemasLoaded++;
    
    // Create field completer for this schema
    this.createFieldCompleter(name, schema);
    
    logger.debug(`[SCHEMA] Added schema: ${name}`);
  }

  // Create field completer for a schema
  createFieldCompleter(schemaName, schema) {
    const completer = {
      schemaName,
      completeFields: (data) => this.completeFields(data, schema),
      generateDefaults: () => this.generateDefaults(schema)
    };
    
    this.fieldCompleters.set(schemaName, completer);
  }

  // Validate data against schema
  validate(data, schemaName) {
    this.stats.validationsPerformed++;
    
    const schema = this.schemas.get(schemaName);
    if (!schema) {
      throw new Error(`Schema not found: ${schemaName}`);
    }

    const result = {
      valid: true,
      errors: [],
      warnings: [],
      completed: false,
      originalData: data,
      validatedData: data
    };

    try {
      // Parse data if it's a string
      let parsedData = data;
      if (typeof data === 'string') {
        parsedData = JSON.parse(data);
      }

      // Validate type
      if (schema.type && typeof parsedData !== schema.type) {
        result.errors.push({
          field: 'root',
          message: `Expected type ${schema.type}, got ${typeof parsedData}`,
          code: 'TYPE_MISMATCH'
        });
        result.valid = false;
      }

      // Validate required fields
      if (schema.required && Array.isArray(schema.required)) {
        schema.required.forEach(field => {
          if (!(field in parsedData)) {
            result.errors.push({
              field,
              message: `Required field missing: ${field}`,
              code: 'REQUIRED_FIELD_MISSING'
            });
            result.valid = false;
          }
        });
      }

      // Validate properties
      if (schema.properties && typeof schema.properties === 'object') {
        Object.entries(schema.properties).forEach(([field, rules]) => {
          const validation = this.validateField(parsedData[field], field, rules);
          
          if (!validation.valid) {
            result.errors.push(...validation.errors);
            result.valid = false;
          }
          
          if (validation.warnings) {
            result.warnings.push(...validation.warnings);
          }
        });
      }

      // Auto-complete missing fields if enabled
      if (!result.valid && this.autoComplete) {
        const completedData = this.completeFields(parsedData, schema);
        result.completed = true;
        result.validatedData = completedData;
        
        // Re-validate completed data
        const revalidation = this.validate(completedData, schemaName);
        result.valid = revalidation.valid;
        result.errors = revalidation.errors;
        result.warnings = revalidation.warnings;
      }

    } catch (error) {
      result.errors.push({
        field: 'root',
        message: `Validation error: ${error.message}`,
        code: 'VALIDATION_ERROR'
      });
      result.valid = false;
    }

    if (!result.valid) {
      this.stats.validationErrors++;
    }

    return result;
  }

  // Validate individual field
  validateField(value, fieldName, rules) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Skip validation if field is not required and value is undefined/null
    if (!rules.required && (value === undefined || value === null)) {
      return result;
    }

    // Type validation
    if (rules.type && value !== undefined && value !== null) {
      if (!this.validateType(value, rules.type)) {
        result.errors.push({
          field: fieldName,
          message: `Expected type ${rules.type}, got ${typeof value}`,
          code: 'FIELD_TYPE_MISMATCH'
        });
        result.valid = false;
      }
    }

    // String validations
    if (typeof value === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        result.errors.push({
          field: fieldName,
          message: `String too short. Minimum length: ${rules.minLength}`,
          code: 'STRING_TOO_SHORT'
        });
        result.valid = false;
      }

      if (rules.maxLength && value.length > rules.maxLength) {
        result.errors.push({
          field: fieldName,
          message: `String too long. Maximum length: ${rules.maxLength}`,
          code: 'STRING_TOO_LONG'
        });
        result.valid = false;
      }

      if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
        result.errors.push({
          field: fieldName,
          message: `String does not match required pattern`,
          code: 'PATTERN_MISMATCH'
        });
        result.valid = false;
      }

      if (rules.format) {
        const formatValidation = this.validateFormat(value, rules.format);
        if (!formatValidation.valid) {
          result.errors.push({
            field: fieldName,
            message: formatValidation.message,
            code: 'FORMAT_INVALID'
          });
          result.valid = false;
        }
      }
    }

    // Number validations
    if (typeof value === 'number') {
      if (rules.minimum !== undefined && value < rules.minimum) {
        result.errors.push({
          field: fieldName,
          message: `Number too small. Minimum: ${rules.minimum}`,
          code: 'NUMBER_TOO_SMALL'
        });
        result.valid = false;
      }

      if (rules.maximum !== undefined && value > rules.maximum) {
        result.errors.push({
          field: fieldName,
          message: `Number too large. Maximum: ${rules.maximum}`,
          code: 'NUMBER_TOO_LARGE'
        });
        result.valid = false;
      }
    }

    // Array validations
    if (Array.isArray(value)) {
      if (rules.minItems && value.length < rules.minItems) {
        result.errors.push({
          field: fieldName,
          message: `Array too short. Minimum items: ${rules.minItems}`,
          code: 'ARRAY_TOO_SHORT'
        });
        result.valid = false;
      }

      if (rules.maxItems && value.length > rules.maxItems) {
        result.errors.push({
          field: fieldName,
          message: `Array too long. Maximum items: ${rules.maxItems}`,
          code: 'ARRAY_TOO_LONG'
        });
        result.valid = false;
      }

      // Validate array items
      if (rules.items) {
        value.forEach((item, index) => {
          const itemValidation = this.validateField(item, `${fieldName}[${index}]`, rules.items);
          if (!itemValidation.valid) {
            result.errors.push(...itemValidation.errors);
            result.valid = false;
          }
        });
      }
    }

    // Enum validation
    if (rules.enum && !rules.enum.includes(value)) {
      result.errors.push({
        field: fieldName,
        message: `Value must be one of: ${rules.enum.join(', ')}`,
        code: 'ENUM_INVALID'
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
        result.valid = /^[\d\s\-\+\(\)]+$/.test(value) && value.replace(/\D/g, '').length >= 10;
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

  // Complete missing fields
  completeFields(data, schema) {
    const completed = { ...data };
    let fieldsCompleted = 0;

    // Add missing required fields with defaults
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([field, rules]) => {
        if (!(field in completed) && this.shouldCompleteField(field, rules)) {
          completed[field] = this.generateFieldValue(field, rules);
          fieldsCompleted++;
          this.stats.fieldsCompleted++;
        }
      });
    }

    // Add timestamps if not present
    if (!completed.created_at && this.shouldAddTimestamps(schema)) {
      completed.created_at = new Date().toISOString();
      fieldsCompleted++;
    }

    if (!completed.updated_at && this.shouldAddTimestamps(schema)) {
      completed.updated_at = new Date().toISOString();
      fieldsCompleted++;
    }

    logger.debug(`[SCHEMA] Completed ${fieldsCompleted} fields`);
    return completed;
  }

  // Determine if field should be completed
  shouldCompleteField(field, rules) {
    if (!this.autoComplete) return false;
    
    // Don't complete required fields in strict mode
    if (this.strictMode && rules.required) return false;
    
    // Complete if field is not required or has a default value
    return !rules.required || rules.default !== undefined;
  }

  // Generate field value
  generateFieldValue(field, rules) {
    // Use default value if specified
    if (rules.default !== undefined) {
      return rules.default;
    }

    // Generate based on type and field name
    switch (rules.type) {
      case 'string':
        return this.generateStringValue(field, rules);
      case 'number':
        return this.generateNumberValue(field, rules);
      case 'boolean':
        return this.generateBooleanValue(field, rules);
      case 'object':
        return this.generateObjectValue(field, rules);
      case 'array':
        return this.generateArrayValue(field, rules);
      default:
        return null;
    }
  }

  // Generate string value
  generateStringValue(field, rules) {
    const fieldName = field.toLowerCase();
    
    if (fieldName.includes('id')) {
      return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    if (fieldName.includes('name')) {
      return `Generated ${field}`;
    }
    
    if (fieldName.includes('email')) {
      return `generated_${field}@example.com`;
    }
    
    if (fieldName.includes('phone')) {
      return '+1-555-000-0000';
    }
    
    if (fieldName.includes('status')) {
      return rules.enum ? rules.enum[0] : 'active';
    }
    
    if (fieldName.includes('description')) {
      return 'Generated description';
    }
    
    if (rules.format === 'date-time' || fieldName.includes('created_at') || fieldName.includes('updated_at')) {
      return new Date().toISOString();
    }
    
    if (rules.format === 'date') {
      return new Date().toISOString().split('T')[0];
    }
    
    return '';
  }

  // Generate number value
  generateNumberValue(field, rules) {
    const fieldName = field.toLowerCase();
    
    if (fieldName.includes('price') || fieldName.includes('cost')) {
      return Math.round(Math.random() * 1000 * 100) / 100; // Price with 2 decimals
    }
    
    if (fieldName.includes('age')) {
      return Math.floor(Math.random() * 80) + 18;
    }
    
    if (fieldName.includes('quantity') || fieldName.includes('count')) {
      return Math.floor(Math.random() * 100) + 1;
    }
    
    if (rules.minimum !== undefined && rules.maximum !== undefined) {
      return Math.floor(Math.random() * (rules.maximum - rules.minimum + 1)) + rules.minimum;
    }
    
    if (rules.minimum !== undefined) {
      return rules.minimum;
    }
    
    return 0;
  }

  // Generate boolean value
  generateBooleanValue(field, rules) {
    const fieldName = field.toLowerCase();
    
    if (fieldName.includes('active') || fieldName.includes('enabled')) {
      return true;
    }
    
    if (fieldName.includes('deleted') || fieldName.includes('disabled')) {
      return false;
    }
    
    return Math.random() > 0.5;
  }

  // Generate object value
  generateObjectValue(field, rules) {
    return {};
  }

  // Generate array value
  generateArrayValue(field, rules) {
    return [];
  }

  // Determine if timestamps should be added
  shouldAddTimestamps(schema) {
    return schema.name !== 'config' && schema.name !== 'settings';
  }

  // Generate defaults for a schema
  generateDefaults(schema) {
    const defaults = {};
    
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([field, rules]) => {
        if (rules.default !== undefined) {
          defaults[field] = rules.default;
        } else if (!rules.required) {
          defaults[field] = this.generateFieldValue(field, rules);
        }
      });
    }
    
    return defaults;
  }

  // Auto-detect schema from data
  detectSchema(data) {
    const detected = {
      type: typeof data,
      properties: {},
      required: []
    };

    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      Object.entries(data).forEach(([key, value]) => {
        detected.properties[key] = {
          type: typeof value,
          required: false
        };
      });
    }

    return detected;
  }

  // Create schema from sample data
  createSchemaFromSample(sampleData, schemaName) {
    const schema = this.detectSchema(sampleData);
    this.addSchema(schemaName, schema);
    return schema;
  }

  // Get schema
  getSchema(name) {
    return this.schemas.get(name);
  }

  // List all schemas
  listSchemas() {
    return Array.from(this.schemas.keys());
  }

  // Remove schema
  removeSchema(name) {
    const removed = this.schemas.delete(name);
    this.fieldCompleters.delete(name);
    
    if (removed) {
      logger.debug(`[SCHEMA] Removed schema: ${name}`);
    }
    
    return removed;
  }

  // Validate multiple items
  validateBatch(items, schemaName) {
    const results = [];
    
    items.forEach((item, index) => {
      try {
        const result = this.validate(item, schemaName);
        results.push({
          index,
          ...result
        });
      } catch (error) {
        results.push({
          index,
          valid: false,
          errors: [{ message: error.message, code: 'VALIDATION_ERROR' }],
          warnings: []
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
    const completed = results.filter(r => r.completed).length;
    
    return {
      total: results.length,
      valid,
      invalid,
      completed,
      successRate: (valid / results.length) * 100
    };
  }

  // Get statistics
  getStats() {
    return {
      ...this.stats,
      schemasLoaded: this.schemas.size,
      fieldCompleters: this.fieldCompleters.size
    };
  }

  // Export schemas
  exportSchemas() {
    const schemas = {};
    
    this.schemas.forEach((schema, name) => {
      schemas[name] = schema;
    });
    
    return {
      schemas,
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  // Import schemas
  importSchemas(schemasData) {
    if (schemasData.schemas) {
      Object.entries(schemasData.schemas).forEach(([name, schema]) => {
        this.addSchema(name, schema);
      });
    }
    
    logger.debug(`[SCHEMA] Imported ${Object.keys(schemasData.schemas || {}).length} schemas`);
  }
}

module.exports = SchemaValidator;
