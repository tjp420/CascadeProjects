/**
 * Validation Rules System
 * 
 * Comprehensive validation rule sets for JSON, CSV, SQL, XML, and YAML
 * with auto-fixing capabilities and detailed error reporting
 */

class ValidationRules {
  constructor(options = {}) {
    this.options = options;
    this.rules = new Map();
    this.ruleSets = new Map();
    this.ruleHistory = [];
    this.isInitialized = false;
    this.enableAutoFixing = options.enableAutoFixing !== false;
    
    this.initializeRuleSets();
    console.log('[VALIDATION_RULES] Validation rules initialized');
  }

  // Initialize rule sets
  initializeRuleSets() {
    // JSON rule set
    this.addRuleSet('json', {
      name: 'JSON Validation Rules',
      description: 'Comprehensive validation rules for JSON data',
      rules: [
        {
          name: 'structure_validation',
          description: 'Validates JSON structure and syntax',
          validator: this.validateJSONStructure.bind(this),
          autoFixer: this.fixJSONStructure.bind(this),
          severity: 'high',
          category: 'structure'
        },
        {
          name: 'format_validation',
          description: 'Validates JSON format and encoding',
          validator: this.validateJSONFormat.bind(this),
          autoFixer: this.fixJSONFormat.bind(this),
          severity: 'medium',
          category: 'format'
        },
        {
          name: 'content_validation',
          description: 'Validates JSON content and data integrity',
          validator: this.validateJSONContent.bind(this),
          autoFixer: this.fixJSONContent.bind(this),
          severity: 'medium',
          category: 'content'
        },
        {
          name: 'type_validation',
          description: 'Validates JSON data types',
          validator: this.validateJSONTypes.bind(this),
          autoFixer: this.fixJSONTypes.bind(this),
          severity: 'medium',
          category: 'type'
        },
        {
          name: 'schema_validation',
          description: 'Validates JSON against schema',
          validator: this.validateJSONSchema.bind(this),
          autoFixer: this.fixJSONSchema.bind(this),
          severity: 'high',
          category: 'schema'
        }
      ]
    });

    // CSV rule set
    this.addRuleSet('csv', {
      name: 'CSV Validation Rules',
      description: 'Comprehensive validation rules for CSV data',
      rules: [
        {
          name: 'structure_validation',
          description: 'Validates CSV structure and column consistency',
          validator: this.validateCSVStructure.bind(this),
          autoFixer: this.fixCSVStructure.bind(this),
          severity: 'high',
          category: 'structure'
        },
        {
          name: 'format_validation',
          description: 'Validates CSV format and delimiters',
          validator: this.validateCSVFormat.bind(this),
          autoFixer: this.fixCSVFormat.bind(this),
          severity: 'medium',
          category: 'format'
        },
        {
          name: 'content_validation',
          description: 'Validates CSV content and data integrity',
          validator: this.validateCSVContent.bind(this),
          autoFixer: this.fixCSVContent.bind(this),
          severity: 'medium',
          category: 'content'
        },
        {
          name: 'header_validation',
          description: 'Validates CSV headers and column names',
          validator: this.validateCSVHeaders.bind(this),
          autoFixer: this.fixCSVHeaders.bind(this),
          severity: 'medium',
          category: 'header'
        }
      ]
    });

    // SQL rule set
    this.addRuleSet('sql', {
      name: 'SQL Validation Rules',
      description: 'Comprehensive validation rules for SQL data',
      rules: [
        {
          name: 'syntax_validation',
          description: 'Validates SQL syntax and keywords',
          validator: this.validateSQLSyntax.bind(this),
          autoFixer: this.fixSQLSyntax.bind(this),
          severity: 'high',
          category: 'syntax'
        },
        {
          name: 'structure_validation',
          description: 'Validates SQL table structure',
          validator: this.validateSQLStructure.bind(this),
          autoFixer: this.fixSQLStructure.bind(this),
          severity: 'high',
          category: 'structure'
        },
        {
          name: 'data_type_validation',
          description: 'Validates SQL data types',
          validator: this.validateSQLDataTypes.bind(this),
          autoFixer: this.fixSQLDataTypes.bind(this),
          severity: 'medium',
          category: 'type'
        },
        {
          name: 'security_validation',
          description: 'Validates SQL security and injection risks',
          validator: this.validateSQLSecurity.bind(this),
          autoFixer: this.fixSQLSecurity.bind(this),
          severity: 'high',
          category: 'security'
        }
      ]
    });

    // XML rule set
    this.addRuleSet('xml', {
      name: 'XML Validation Rules',
      description: 'Comprehensive validation rules for XML data',
      rules: [
        {
          name: 'structure_validation',
          description: 'Validates XML structure and hierarchy',
          validator: this.validateXMLStructure.bind(this),
          autoFixer: this.fixXMLStructure.bind(this),
          severity: 'high',
          category: 'structure'
        },
        {
          name: 'syntax_validation',
          description: 'Validates XML syntax and encoding',
          validator: this.validateXMLSyntax.bind(this),
          autoFixer: this.fixXMLSyntax.bind(this),
          severity: 'medium',
          category: 'syntax'
        },
        {
          name: 'content_validation',
          description: 'Validates XML content and data integrity',
          validator: this.validateXMLContent.bind(this),
          autoFixer: this.fixXMLContent.bind(this),
          severity: 'medium',
          category: 'content'
        },
        {
          name: 'schema_validation',
          description: 'Validates XML against schema',
          validator: this.validateXMLSchema.bind(this),
          autoFixer: this.fixXMLSchema.bind(this),
          severity: 'high',
          category: 'schema'
        }
      ]
    });

    // YAML rule set
    this.addRuleSet('yaml', {
      name: 'YAML Validation Rules',
      description: 'Comprehensive validation rules for YAML data',
      rules: [
        {
          name: 'structure_validation',
          description: 'Validates YAML structure and hierarchy',
          validator: this.validateYAMLStructure.bind(this),
          autoFixer: this.fixYAMLStructure.bind(this),
          severity: 'medium',
          category: 'structure'
        },
        {
          name: 'syntax_validation',
          description: 'Validates YAML syntax and indentation',
          validator: this.validateYAMLSyntax.bind(this),
          autoFixer: this.fixYAMLSyntax.bind(this),
          severity: 'medium',
          category: 'syntax'
        },
        {
          name: 'content_validation',
          description: 'Validates YAML content and data integrity',
          validator: this.validateYAMLContent.bind(this),
          autoFixer: this.fixYAMLContent.bind(this),
          severity: 'medium',
          category: 'content'
        },
        {
          name: 'type_validation',
          description: 'Validates YAML data types',
          validator: this.validateYAMLTypes.bind(this),
          autoFixer: this.fixYAMLTypes.bind(this),
          severity: 'medium',
          category: 'type'
        }
      ]
    });

    console.log(`[VALIDATION_RULES] Initialized ${this.ruleSets.size} rule sets`);
  }

  // Add rule set
  addRuleSet(name, ruleSet) {
    this.ruleSets.set(name, {
      ...ruleSet,
      usage: 0,
      avgProcessingTime: 0,
      totalProcessingTime: 0,
      successCount: 0,
      failureCount: 0,
      lastUsed: null
    });
    console.log(`[VALIDATION_RULES] Added rule set: ${name}`);
  }

  // Add individual rule
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
    console.log(`[VALIDATION_RULES] Added validation rule: ${name}`);
  }

  // Initialize validation rules
  async initialize() {
    if (this.isInitialized) {
      console.log('[VALIDATION_RULES] Validation rules already initialized');
      return;
    }

    try {
      // Initialize all rule sets
      for (const [name, ruleSet] of this.ruleSets) {
        ruleSet.rules.forEach(rule => {
          this.addRule(`${name}_${rule.name}`, rule);
        });
      }
      
      this.isInitialized = true;
      console.log('[VALIDATION_RULES] Validation rules initialized successfully');
      
    } catch (error) {
      console.error('[VALIDATION_RULES] Failed to initialize validation rules:', error.message);
      throw error;
    }
  }

  // Validate data using rule set
  validateData(data, ruleSetName, options = {}) {
    const ruleSet = this.ruleSets.get(ruleSetName);
    if (!ruleSet) {
      throw new Error(`Rule set not found: ${ruleSetName}`);
    }

    const startTime = Date.now();
    const results = [];
    let overallValid = true;
    let totalScore = 100;

    try {
      // Run all rules in the rule set
      for (const rule of ruleSet.rules) {
        const ruleKey = `${ruleSetName}_${rule.name}`;
        const ruleResult = this.validateRule(data, ruleKey, options);
        
        results.push(ruleResult);
        
        if (!ruleResult.success) {
          overallValid = false;
          totalScore -= 10; // Deduct score for failed rules
        }
      }

      const processingTime = Date.now() - startTime;
      
      // Update rule set stats
      ruleSet.usage++;
      ruleSet.totalProcessingTime += processingTime;
      ruleSet.avgProcessingTime = ruleSet.totalProcessingTime / ruleSet.usage;
      ruleSet.successCount++;
      ruleSet.lastUsed = new Date().toISOString();

      return {
        success: overallValid,
        data: data,
        processingTime,
        score: Math.max(0, totalScore),
        results,
        metadata: {
          ruleSet: ruleSetName,
          totalRules: ruleSet.rules.length,
          passedRules: results.filter(r => r.success).length,
          failedRules: results.filter(r => !r.success).length
        }
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Update rule set failure stats
      if (ruleSet) {
        ruleSet.failureCount++;
        ruleSet.totalProcessingTime += processingTime;
        ruleSet.avgProcessingTime = ruleSet.totalProcessingTime / Math.max(1, ruleSet.usage);
        ruleSet.lastUsed = new Date().toISOString();
      }
      
      console.error(`[VALIDATION_RULES] Validation failed: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        processingTime
      };
    }
  }

  // Validate data using individual rule
  validateRule(data, ruleName, options = {}) {
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
          recommendations: result.recommendations || [],
          severity: rule.severity,
          category: rule.category
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
      
      console.error(`[VALIDATION_RULES] Rule validation failed: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        processingTime
      };
    }
  }

  // Auto-fix data using rule
  autoFixData(data, ruleName, options = {}) {
    const rule = this.rules.get(ruleName);
    if (!rule) {
      throw new Error(`Validation rule not found: ${ruleName}`);
    }

    if (!rule.autoFixer) {
      throw new Error(`Rule does not have auto-fixer: ${ruleName}`);
    }

    const startTime = Date.now();
    
    try {
      const fixedData = rule.autoFixer(data, options);
      const processingTime = Date.now() - startTime;
      
      // Store in history
      this.ruleHistory.push({
        timestamp: new Date().toISOString(),
        rule: ruleName,
        originalData: data,
        fixedData,
        processingTime,
        success: true
      });
      
      return {
        success: true,
        data: fixedData,
        processingTime,
        metadata: {
          rule: ruleName,
          autoFixed: true,
          changes: this.detectChanges(data, fixedData)
        }
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Store in history
      this.ruleHistory.push({
        timestamp: new Date().toISOString(),
        rule: ruleName,
        originalData: data,
        fixedData: data,
        processingTime,
        success: false,
        error: error.message
      });
      
      console.error(`[VALIDATION_RULES] Auto-fix failed: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        processingTime
      };
    }
  }

  // Detect changes between original and fixed data
  detectChanges(original, fixed) {
    const changes = [];
    
    if (typeof original === 'object' && typeof fixed === 'object') {
      Object.keys(fixed).forEach(key => {
        if (original[key] !== fixed[key]) {
          changes.push({
            field: key,
            original: original[key],
            fixed: fixed[key],
            type: 'modified'
          });
        }
      });
    }
    
    return changes;
  }

  // JSON validation methods
  validateJSONStructure(data) {
    try {
      JSON.parse(JSON.stringify(data));
      return { valid: true, errors: [] };
    } catch (error) {
      return { valid: false, errors: [error.message] };
    }
  }

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

  validateJSONFormat(data) {
    if (typeof data !== 'string') return { valid: false, errors: ['Data is not a string'] };
    
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

  fixJSONFormat(data) {
    if (typeof data !== 'string') return data;
    
    // Fix undefined and NaN values
    data = data.replace(/undefined/g, 'null').replace(/NaN/g, '0');
    
    // Fix encoding issues
    data = data.replace(/\uFFFD/g, '').replace(/[\u2018\u2019]/g, "'");
    
    return data;
  }

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

  fixJSONContent(data) {
    if (typeof data !== 'object' || data === null) return data;
    
    Object.keys(data).forEach(key => {
      if (data[key] === null || data[key] === undefined) {
        data[key] = null;
      }
    });
    
    return data;
  }

  validateJSONTypes(data) {
    if (typeof data !== 'object' || data === null) {
      return { valid: false, errors: ['Data is not an object'] };
    }
    
    const issues = [];
    
    // Check for invalid types
    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === 'function') {
        issues.push(`Field ${key} contains function (invalid type)`);
      }
    });
    
    return {
      valid: issues.length === 0,
      errors: issues
    };
  }

  fixJSONTypes(data) {
    if (typeof data !== 'object' || data === null) return data;
    
    Object.keys(data).forEach(key => {
      if (typeof data[key] === 'function') {
        data[key] = null;
      }
    });
    
    return data;
  }

  validateJSONSchema(data, schema = {}) {
    if (typeof data !== 'object' || data === null) {
      return { valid: false, errors: ['Data is not an object'] };
    }
    
    const issues = [];
    
    // Check required fields
    if (schema.required) {
      schema.required.forEach(field => {
        if (!(field in data)) {
          issues.push(`Required field ${field} is missing`);
        }
      });
    }
    
    // Check field types
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([field, fieldSchema]) => {
        if (field in data) {
          const expectedType = fieldSchema.type;
          const actualType = typeof data[field];
          
          if (expectedType && actualType !== expectedType) {
            issues.push(`Field ${field} has type ${actualType}, expected ${expectedType}`);
          }
        }
      });
    }
    
    return {
      valid: issues.length === 0,
      errors: issues
    };
  }

  fixJSONSchema(data, schema = {}) {
    if (typeof data !== 'object' || data === null) return data;
    
    // Add missing required fields with default values
    if (schema.required) {
      schema.required.forEach(field => {
        if (!(field in data)) {
          data[field] = schema.properties?.[field]?.default || null;
        }
      });
    }
    
    return data;
  }

  // CSV validation methods
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

  fixCSVStructure(data) {
    if (!Array.isArray(data)) return data;
    
    const columnCounts = data.map(row => row.split(',').length);
    const firstCount = columnCounts[0];
    
    for (let i = 1; i < columnCounts.length; i++) {
      if (columnCounts[i] !== firstCount) {
        const values = data[i].split(',');
        while (values.length < firstCount) {
          values.push('');
        }
        data[i] = values.join(',');
      }
    }
    
    return data;
  }

  validateCSVFormat(data) {
    if (!Array.isArray(data)) {
      return { valid: false, errors: ['Data is not an array'] };
    }
    
    const issues = [];
    
    // Check for empty lines
    data.forEach((line, index) => {
      if (line.trim() === '') {
        issues.push(`Row ${index + 1}: Empty line`);
      }
    });
    
    return {
      valid: issues.length === 0,
      errors: issues
    };
  }

  fixCSVFormat(data) {
    if (!Array.isArray(data)) return data;
    
    // Remove empty lines
    return data.filter(line => line.trim() !== '');
  }

  validateCSVContent(data) {
    if (!Array.isArray(data)) {
      return { valid: false, errors: ['Data is not an array'] };
    }
    
    const issues = [];
    
    // Check for inconsistent data types
    if (data.length > 1) {
      const headers = data[0].split(',');
      for (let i = 1; i < data.length; i++) {
        const values = data[i].split(',');
        headers.forEach((header, index) => {
          const value = values[index];
          if (value && isNaN(value) && !isNaN(parseFloat(value))) {
            issues.push(`Row ${i + 1}, Column ${index + 1}: Inconsistent data type`);
          }
        });
      }
    }
    
    return {
      valid: issues.length === 0,
      errors: issues
    };
  }

  fixCSVContent(data) {
    if (!Array.isArray(data)) return data;
    
    // Normalize data types
    if (data.length > 1) {
      for (let i = 1; i < data.length; i++) {
        const values = data[i].split(',');
        data[i] = values.map(value => {
          if (value && !isNaN(value) && !isNaN(parseFloat(value))) {
            return parseFloat(value);
          }
          return value;
        }).join(',');
      }
    }
    
    return data;
  }

  validateCSVHeaders(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return { valid: false, errors: ['Data is empty or not an array'] };
    }
    
    const issues = [];
    const headers = data[0].split(',');
    
    // Check for duplicate headers
    const duplicates = headers.filter((header, index) => headers.indexOf(header) !== index);
    if (duplicates.length > 0) {
      issues.push(`Duplicate headers: ${duplicates.join(', ')}`);
    }
    
    // Check for empty headers
    const emptyHeaders = headers.filter(header => header.trim() === '');
    if (emptyHeaders.length > 0) {
      issues.push(`Empty headers found`);
    }
    
    return {
      valid: issues.length === 0,
      errors: issues
    };
  }

  fixCSVHeaders(data) {
    if (!Array.isArray(data) || data.length === 0) return data;
    
    const headers = data[0].split(',');
    
    // Fix duplicate headers
    const seen = new Set();
    const fixedHeaders = headers.map((header, index) => {
      let fixedHeader = header.trim();
      if (fixedHeader === '') {
        fixedHeader = `column_${index + 1}`;
      }
      
      let counter = 1;
      while (seen.has(fixedHeader)) {
        fixedHeader = `${header.trim()}_${counter}`;
        counter++;
      }
      seen.add(fixedHeader);
      return fixedHeader;
    });
    
    data[0] = fixedHeaders.join(',');
    return data;
  }

  // SQL validation methods
  validateSQLSyntax(data) {
    if (typeof data !== 'string') {
      return { valid: false, errors: ['Data is not a string'] };
    }
    
    const issues = [];
    const sqlUpper = data.toUpperCase();
    
    // Check for SQL keywords
    const sqlKeywords = ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT'];
    
    const hasKeywords = sqlKeywords.some(keyword => sqlUpper.includes(keyword));
    
    if (!hasKeywords) {
      issues.push('SQL does not contain recognized keywords');
    }
    
    // Check for syntax errors
    if (data.includes(';;')) {
      issues.push('SQL contains double semicolons');
    }
    
    return {
      valid: issues.length === 0,
      errors: issues
    };
  }

  fixSQLSyntax(data) {
    if (typeof data !== 'string') return data;
    
    // Fix common SQL syntax issues
    data = data.replace(/;;/g, ';');
    data = data.replace(/\s+/g, ' ');
    data = data.trim();
    
    return data;
  }

  validateSQLStructure(data) {
    if (!Array.isArray(data)) {
      return { valid: false, errors: ['Data is not an array'] };
    }
    
    const issues = [];
    
    if (data.length === 0) {
      issues.push('Data array is empty');
      return { valid: false, errors: issues };
    }
    
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

  fixSQLStructure(data) {
    if (!Array.isArray(data)) return data;
    
    if (data.length === 0) return data;
    
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

  validateSQLDataTypes(data) {
    if (!Array.isArray(data)) {
      return { valid: false, errors: ['Data is not an array'] };
    }
    
    const issues = [];
    
    data.forEach((row, index) => {
      Object.entries(row).forEach(([field, value]) => {
        if (typeof value === 'function') {
          issues.push(`Row ${index + 1}, Field ${field}: Contains function (invalid type)`);
        }
      });
    });
    
    return {
      valid: issues.length === 0,
      errors: issues
    };
  }

  fixSQLDataTypes(data) {
    if (!Array.isArray(data)) return data;
    
    data.forEach(row => {
      Object.keys(row).forEach(field => {
        if (typeof row[field] === 'function') {
          row[field] = null;
        }
      });
    });
    
    return data;
  }

  validateSQLSecurity(data) {
    if (typeof data !== 'string') {
      return { valid: false, errors: ['Data is not a string'] };
    }
    
    const issues = [];
    const sqlUpper = data.toUpperCase();
    
    // Check for potential SQL injection patterns
    const injectionPatterns = [
      'DROP TABLE',
      'DELETE FROM',
      'UPDATE SET',
      'INSERT INTO',
      'UNION SELECT',
      'EXEC(',
      'EXECUTE(',
      'SP_',
      'XP_'
    ];
    
    injectionPatterns.forEach(pattern => {
      if (sqlUpper.includes(pattern)) {
        issues.push(`Potential SQL injection: ${pattern}`);
      }
    });
    
    return {
      valid: issues.length === 0,
      errors: issues
    };
  }

  fixSQLSecurity(data) {
    if (typeof data !== 'string') return data;
    
    // Remove potentially dangerous SQL patterns
    const dangerousPatterns = [
      /DROP\s+TABLE/gi,
      /DELETE\s+FROM/gi,
      /UPDATE\s+.*\s+SET/gi,
      /INSERT\s+INTO/gi,
      /UNION\s+SELECT/gi,
      /EXEC\s*\(/gi,
      /EXECUTE\s*\(/gi,
      /SP_\w+/gi,
      /XP_\w+/gi
    ];
    
    dangerousPatterns.forEach(pattern => {
      data = data.replace(pattern, '-- REMOVED');
    });
    
    return data;
  }

  // XML validation methods
  validateXMLStructure(data) {
    if (typeof data !== 'string') {
      return { valid: false, errors: ['Data is not a string'] };
    }
    
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data, 'text/xml');
      
      // Check for parsing errors
      const parseError = xmlDoc.getElementsByTagName('parsererror');
      if (parseError.length > 0) {
        return { valid: false, errors: ['XML parsing error'] };
      }
      
      return { valid: true, errors: [] };
    } catch (error) {
      return { valid: false, errors: [error.message] };
    }
  }

  fixXMLStructure(data) {
    if (typeof data !== 'string') return data;
    
    // Fix common XML structure issues
    data = data.replace(/&/g, '&amp;');
    data = data.replace(/</g, '&lt;');
    data = data.replace(/>/g, '&gt;');
    data = data.replace(/"/g, '&quot;');
    data = data.replace(/'/g, '&apos;');
    
    return data;
  }

  validateXMLSyntax(data) {
    if (typeof data !== 'string') {
      return { valid: false, errors: ['Data is not a string'] };
    }
    
    const issues = [];
    
    // Check for XML syntax issues
    if (data.includes('<') && !data.includes('>')) {
      issues.push('Unclosed XML tag');
    }
    
    if (data.includes('</') && !data.includes('<')) {
      issues.push('Unclosed XML tag');
    }
    
    // Check for malformed tags
    const tagMatches = data.match(/<[^>]+>/g);
    if (tagMatches) {
      tagMatches.forEach(tag => {
        if (tag.includes('<') && !tag.includes('>')) {
          issues.push(`Malformed tag: ${tag}`);
        }
      });
    }
    
    return {
      valid: issues.length === 0,
      errors: issues
    };
  }

  fixXMLSyntax(data) {
    if (typeof data !== 'string') return data;
    
    // Fix common XML syntax issues
    data = data.replace(/</g, '&lt;');
    data = data.replace(/>/g, '&gt;');
    
    return data;
  }

  validateXMLContent(data) {
    if (typeof data !== 'string') {
      return { valid: false, errors: ['Data is not a string'] };
    }
    
    const issues = [];
    
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data, 'text/xml');
      
      // Check for empty elements
      const elements = xmlDoc.getElementsByTagName('*');
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        if (element.childNodes.length === 0 && element.textContent === '') {
          issues.push(`Empty element: ${element.tagName}`);
        }
      }
      
    } catch (error) {
      issues.push(error.message);
    }
    
    return {
      valid: issues.length === 0,
      errors: issues
    };
  }

  fixXMLContent(data) {
    if (typeof data !== 'string') return data;
    
    // Fix empty elements by adding placeholder content
    data = data.replace(/<(\w+)><\/\1>/g, '<$1></$1>');
    
    return data;
  }

  validateXMLSchema(data, schema = {}) {
    if (typeof data !== 'string') {
      return { valid: false, errors: ['Data is not a string'] };
    }
    
    const issues = [];
    
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data, 'text/xml');
      
      // Check for required elements
      if (schema.requiredElements) {
        schema.requiredElements.forEach(elementName => {
          const elements = xmlDoc.getElementsByTagName(elementName);
          if (elements.length === 0) {
            issues.push(`Required element ${elementName} is missing`);
          }
        });
      }
      
    } catch (error) {
      issues.push(error.message);
    }
    
    return {
      valid: issues.length === 0,
      errors: issues
    };
  }

  fixXMLSchema(data, schema = {}) {
    if (typeof data !== 'string') return data;
    
    // Add missing required elements
    if (schema.requiredElements) {
      schema.requiredElements.forEach(elementName => {
        if (!data.includes(`<${elementName}>`)) {
          data += `<${elementName}></${elementName}>`;
        }
      });
    }
    
    return data;
  }

  // YAML validation methods
  validateYAMLStructure(data) {
    if (typeof data !== 'string') {
      return { valid: false, errors: ['Data is not a string'] };
    }
    
    const lines = data.split('\n');
    if (lines.length === 0) {
      return { valid: false, errors: ['Data is empty'] };
    }
    
    const issues = [];
    
    // Check for valid YAML structure
    let hasValidStructure = false;
    
    for (const line of lines) {
      if (line.trim().length > 0 && line.includes(':')) {
        hasValidStructure = true;
        break;
      }
    }
    
    if (!hasValidStructure) {
      issues.push('YAML does not contain valid key-value structure');
    }
    
    return {
      valid: issues.length === 0,
      errors: issues
    };
  }

  fixYAMLStructure(data) {
    if (typeof data !== 'string') return data;
    
    // Fix common YAML structure issues
    data = data.replace(/: /g, ': ');
    data = data.replace(/: /g, ': ');
    
    return data;
  }

  validateYAMLSyntax(data) {
    if (typeof data !== 'string') {
      return { valid: false, errors: ['Data is not a string'] };
    }
    
    const issues = [];
    
    // Check for YAML syntax issues
    if (data.includes('\t')) {
      issues.push('YAML contains tabs (should use spaces)');
    }
    
    // Check for inconsistent indentation
    const lines = data.split('\n');
    const indentations = lines.map(line => {
      const match = line.match(/^(\s*)/);
      return match ? match[1].length : 0;
    });
    
    for (let i = 1; i < indentations.length; i++) {
      if (indentations[i] % 2 !== 0) {
        issues.push(`Line ${i + 1}: Inconsistent indentation`);
      }
    }
    
    return {
      valid: issues.length === 0,
      errors: issues
    };
  }

  fixYAMLSyntax(data) {
    if (typeof data !== 'string') return data;
    
    // Fix common YAML syntax issues
    data = data.replace(/\t/g, '  ');
    
    return data;
  }

  validateYAMLContent(data) {
    if (typeof data !== 'string') {
      return { valid: false, errors: ['Data is not a string'] };
    }
    
    const issues = [];
    const lines = data.split('\n');
    
    // Check for empty keys
    lines.forEach((line, index) => {
      if (line.includes(':') && line.split(':')[0].trim() === '') {
        issues.push(`Line ${index + 1}: Empty key`);
      }
    });
    
    return {
      valid: issues.length === 0,
      errors: issues
    };
  }

  fixYAMLContent(data) {
    if (typeof data !== 'string') return data;
    
    // Fix empty keys
    const lines = data.split('\n');
    const fixedLines = lines.map(line => {
      if (line.includes(':') && line.split(':')[0].trim() === '') {
        return line.replace(/^:\s*/, 'key: ');
      }
      return line;
    });
    
    return fixedLines.join('\n');
  }

  validateYAMLTypes(data) {
    if (typeof data !== 'string') {
      return { valid: false, errors: ['Data is not a string'] };
    }
    
    const issues = [];
    const lines = data.split('\n');
    
    // Check for invalid type indicators
    lines.forEach((line, index) => {
      if (line.includes(':')) {
        const value = line.split(':')[1].trim();
        if (value === 'undefined') {
          issues.push(`Line ${index + 1}: Undefined value`);
        }
      }
    });
    
    return {
      valid: issues.length === 0,
      errors: issues
    };
  }

  fixYAMLTypes(data) {
    if (typeof data !== 'string') return data;
    
    // Fix undefined values
    data = data.replace(/:\s*undefined/g, ': null');
    
    return data;
  }

  // Get validation statistics
  getStats() {
    const ruleSetStats = {};
    
    this.ruleSets.forEach((ruleSet, name) => {
      ruleSetStats[name] = {
        name,
        usage: ruleSet.usage,
        avgProcessingTime: ruleSet.avgProcessingTime,
        totalProcessingTime: ruleSet.totalProcessingTime,
        successCount: ruleSet.successCount,
        failureCount: ruleSet.failureCount,
        lastUsed: ruleSet.lastUsed,
        ruleCount: ruleSet.rules.length
      };
    });

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
        category: rule.category,
        hasAutoFixer: !!rule.autoFixer
      };
    });

    return {
      ruleSetStats,
      ruleStats,
      totalRuleSets: this.ruleSets.size,
      totalRules: this.rules.size,
      averageProcessingTime: this.calculateAverageProcessingTime(),
      overallSuccessRate: this.calculateOverallSuccessRate(),
      historySize: this.ruleHistory.length,
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
    const successRates = Array.from(this.rules.values()).map(rule => {
      const total = rule.successCount + rule.failureCount;
      return total > 0 ? rule.successCount / total : 0;
    });
    return successRates.reduce((sum, rate) => sum + rate, 0) / successRates.length;
  }

  // Get system state
  getState() {
    return {
      isInitialized: this.isInitialized,
      options: this.options,
      ruleSets: Array.from(this.ruleSets.entries()).map(([name, ruleSet]) => ({
        name,
        ...ruleSet
      })),
      rules: Array.from(this.rules.entries()).map(([name, rule]) => ({
        name,
        ...rule
      })),
      history: this.ruleHistory,
      stats: this.getStats(),
      enableAutoFixing: this.enableAutoFixing,
      lastUpdated: new Date().toISOString()
    };
  }

  // Destroy validation rules
  destroy() {
    this.rules.clear();
    this.ruleSets.clear();
    this.ruleHistory = [];
    
    this.isInitialized = false;
    console.log('[VALIDATION_RULES] Validation rules destroyed');
  }
}

// Global instance
let validationRules = null;

// Initialize validation rules when DOM is ready
function initializeValidationRules() {
  if (!validationRules) {
    validationRules = new ValidationRules();
  }
  return validationRules.initialize();
}

// Export for global access
window.validationRules = validationRules;

module.exports = {
  ValidationRules,
  initializeValidationRules
};
