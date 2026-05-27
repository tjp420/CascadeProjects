/**
 * Export Validation System
 * 
 * Comprehensive validation for exported data with integrity checking,
 * format-specific validation rules, and quality assessment
 */

class ExportValidator {
  constructor(options = {}) {
    this.options = options;
    this.validationRules = new Map();
    this.validationHistory = [];
    this.qualityScores = new Map();
    this.isInitialized = false;
    this.strictMode = options.strictMode || false;
    this.enableAutoFixing = options.enableAutoFixing !== false;
    
    this.initializeValidationRules();
    console.log('[EXPORT_VALIDATOR] Export validator initialized');
  }

  // Initialize validation rules
  initializeValidationRules() {
    // JSON validation rules
    this.addValidationRule('json', {
      type: 'json',
      rules: [
        {
          name: 'valid_json_structure',
          description: 'JSON must be valid JSON',
          validator: (data) => this.validateJSONStructure(data),
          autoFix: (data) => this.fixJSONStructure(data)
        },
        {
          name: 'no_undefined_values',
          description: 'JSON should not contain undefined values',
          validator: (data) => this.checkForUndefinedValues(data),
          autoFix: (data) => this.fixUndefinedValues(data)
        },
        {
          name: 'no_null_values',
          description: 'JSON should not contain null values',
          validator: (data) => this.checkForNullValues(data),
          autoFix: (data) => this.fixNullValues(data)
        },
        {
          name: 'valid_string_format',
          description: 'String values must be properly formatted',
          validator: (data) => this.checkStringFormat(data),
          autoFix: (data) => this.fixStringFormat(data)
        }
      ],
      severity: {
        'valid_json_structure': 'high',
        'no_undefined_values': 'medium',
        'no_null_values': 'medium',
        'no_string_format': 'low',
        'valid_string_format': 'low'
      }
    });

    // CSV validation rules
    this.addValidationRule('csv', {
      type: 'csv',
      rules: [
        {
          name: 'valid_csv_structure',
          description: 'CSV must have consistent column count',
          validator: (data) => this.validateCSVStructure(data),
          autoFix: (data) => this.fixCSVStructure(data)
        },
        {
          name: 'no_empty_lines',
          description: 'CSV should not have empty lines',
          validator: (data) => this.checkEmptyLines(data),
          autoFix: (data) => this.fixEmptyLines(data)
        },
        {
          name: 'consistent_columns',
          description: 'CSV columns must be consistent',
          validator: (data) => this.checkColumnConsistency(data),
          autoFix: (data) => this.fixColumnConsistency(data)
        }
      ],
      severity: {
        'valid_csv_structure': 'high',
        'no_empty_lines': 'medium',
        'consistent_columns': 'medium',
        'inconsistent_columns': 'medium'
      }
    });

    // SQL validation rules
    this.addValidationRule('sql', {
      type: 'sql',
      rules: [
        {
          name: 'valid_sql_syntax',
          description: 'SQL must have valid syntax',
          validator: (data) => this.validateSQLSyntax(data),
          autoFix: (data) => this.fixSQLSyntax(data)
        },
        {
          name: 'valid_table_structure',
          description: 'SQL must have valid table structure',
          validator: (data) => this.validateTableStructure(data),
          autoFix: (data) => this.fixTableStructure(data)
        },
        {
          name: 'valid_data_types',
          description: 'SQL must have valid data types',
          validator: (data) => this.validateDataTypes(data),
          autoFix: (data) => this.fixDataTypes(data)
        }
      ],
      severity: {
        'valid_sql_syntax': 'high',
        'valid_table_structure': 'high',
        'valid_data_types': 'medium'
      }
    });

    // XML validation rules
    this.addValidationRule('xml', {
      type: 'xml',
      rules: [
        {
          name: 'valid_xml_structure',
          description: 'XML must have valid structure',
          validator: (data) => this.validateXMLStructure(data),
          autoFix: (data) => this.fixXMLStructure(data)
        },
        {
          name: 'valid_xml_syntax',
          description: 'XML must have valid syntax',
          validator: (data) => this.validateXMLSyntax(data),
          autoFix: (data) => this.fixXMLSyntax(data)
        },
        {
          name: 'valid_encoding',
          description: 'XML must have valid encoding',
          validator: (data) => this.checkXMLEncoding(data),
          autoFix: (data) => this.fixXMLEncoding(data)
        }
      ],
      severity: {
        'valid_xml_structure': 'high',
        'valid_xml_syntax': 'high',
        'valid_encoding': 'medium'
      }
    });

    // YAML validation rules
    this.addValidationRule('yaml', {
      type: 'yaml',
      rules: [
        {
          name: 'valid_yaml_structure',
          description: 'YAML must have valid structure',
          validator: (data) => this.validateYAMLStructure(data),
          autoFix: (data) => this.fixYAMLStructure(data)
        },
        {
          name: 'valid_yaml_syntax',
          description: 'YAML must have valid syntax',
          validator: (data) => this.validateYAMLSyntax(data),
          autoFix: (data) => this.fixYAMLSyntax(data)
        },
        {
          name: 'valid_yaml_encoding',
          description: 'YAML must have valid encoding',
          validator: (data) => this.checkYAMLEncoding(data),
          autoFix: (data) => this.fixYAMLEncoding(data)
        }
      ],
      severity: {
        'valid_yaml_structure': 'high',
        'valid_yaml_syntax': 'high',
        'valid_yaml_encoding': 'medium'
      }
    });

    console.log(`[EXPORT_VALIDATOR] Initialized ${this.validationRules.size} validation rule sets`);
  }

  // Add validation rule
  addValidationRule(type, rule) {
    this.validationRules.set(type, {
      ...rule,
      usage: 0,
      successCount: 0,
      failureCount: 0,
      lastUsed: null
    });
    console.log(`[EXPORT_VALIDATOR] Added validation rule for: ${type}`);
  }

  // Validate data using rules
  validateData(data, type, options = {}) {
    const rules = this.validationRules.get(type);
    if (!rules) {
      throw new Error(`No validation rules found for type: ${type}`);
    }

    const result = {
      valid: true,
      errors: [],
      warnings: [],
      score: 100,
      issues: [],
      recommendations: []
    };

    rules.rules.forEach(rule => {
      try {
        const ruleResult = rule.validator(data);
        
        if (!ruleResult.valid) {
          result.errors.push({
            type: rule.name,
            message: rule.description,
            code: rule.code || 'VALIDATION_ERROR',
            severity: rule.severity || 'medium'
          });
          result.valid = false;
        }
        
        if (rule.autoFix && options.autoFix !== false) {
          try {
            const fixedData = rule.autoFix(data);
            data = fixedData;
            result.fixed = true;
            result.warnings.push({
              type: 'auto_fixed',
              message: `Auto-fixed: ${rule.name}`,
              code: 'AUTO_FIX',
              severity: 'low'
            });
          } catch (autoFixError) {
            result.warnings.push({
              type: 'auto_fix_failed',
              message: autoFixError.message,
              code: 'AUTO_FIX',
              severity: 'low'
            });
          }
        }

        result.issues.push(...ruleResult.errors);
        result.warnings.push(...ruleResult.warnings);
      } catch (error) {
        result.errors.push({
          type: rule.name,
          message: `Validation error: ${error.message}`,
          code: 'VALIDATION_ERROR',
          severity: 'medium'
        });
        result.valid = false;
      }
    });

    // Calculate overall score
    const totalIssues = result.errors.length + result.warnings.length;
    const totalChecks = rules.rules.length;
    
    if (totalIssues === 0) {
      result.score = 100;
    } else {
      result.score = Math.max(0, 100 - (totalIssues / totalChecks) * 100);
    }

    return result;
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

  // Check for undefined values
  checkForUndefinedValues(data) {
    if (typeof data === 'object' && data !== null) {
      const undefinedCount = Object.values(data).filter(value => value === undefined).length;
      return undefinedCount > 0;
    }
    return false;
  }

  // Fix undefined values
  fixUndefinedValues(data) {
    if (typeof data === 'object' && data !== null) {
      Object.keys(data).forEach(key => {
        if (data[key] === undefined) {
          data[key] = null;
        }
      });
    }
  }

  // Check for null values
  checkForNullValues(data) {
    if (typeof data === 'object' && data !== null) {
      const nullCount = Object.values(data).filter(value => value === null).length;
      return nullCount > 0;
    }
    return false;
  }

  // Fix null values
  fixNullValues(data) {
    if (typeof data === 'object' && data !== null) {
      Object.keys(data).forEach(key => {
        if (data[key] === null) {
          data[key] = null;
        }
      });
    }
  }

  // Check string format
  checkStringFormat(data) {
    if (typeof data !== 'string') return false;
    
    // Check for common string issues
    if (data.includes('undefined') || data.includes('NaN')) {
      return false;
    }
    
    // Check for encoding issues
    if (data.includes('') || data.includes('')) {
      return false;
    }
    
    return true;
  }

  // Fix string format
  fixStringFormat(data) {
    if (typeof data !== 'string') return data;
    
    // Fix undefined and NaN values
    data = data.replace(/undefined/g, 'null').replace(/NaN/g, '0');
    
    // Fix encoding issues
    data = data.replace(/\uFFFD/g, '').replace(/[\u2018\u2019]/g, "'");
    
    return data;
  }

  // Check CSV structure
  validateCSVStructure(data) {
    if (!Array.isArray(data)) return false;
    
    const columnCounts = data.map(row => row.split(',').length);
    const firstCount = columnCounts[0];
    
    for (let i = 1; i < columnCounts.length; i++) {
      if (columnCounts[i] !== firstCount) {
        return false;
      }
    }
    
    return true;
  }

  // Fix column consistency
  fixColumnConsistency(data) {
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

  // Check YAML structure
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

  // Fix YAML syntax
  fixYAMLSyntax(data) {
    if (typeof data !== 'string') return data;
    
    // Fix common YAML syntax issues
    data = data.replace(/: /g, ':');
    data = data.replace(/: /g, ':');
    
    return data;
  }

  // Fix YAML encoding
  fixYAMLEncoding(data) {
    if (typeof data !== 'string') return data;
    
    // Fix encoding issues
    data = data.replace(/\uFFFD/g, '').replace(/[\u2018\u2019]/g, "'");
    return data;
  }

  // Validate SQL syntax
  validateSQLSyntax(data) {
    if (typeof data !== 'string') return false;
    
    const sqlUpper = data.toUpperCase();
    
    // Check for SQL keywords
    const sqlKeywords = ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT'];
    
    const hasKeywords = sqlKeywords.some(keyword => sqlUpper.includes(keyword));
    
    if (!hasKeywords) {
      return false;
    }
    
    return true;
  }

  // Fix table structure
  fixTableStructure(data) {
    if (!Array.isArray(data)) return data;
    
    // Ensure all rows have the same structure
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

  // Fix data types
  fixDataTypes(data) {
    if (typeof data === 'object' && data !== null) {
      Object.keys(data).forEach(key => {
        const value = data[key];
        if (typeof value === 'number' && isNaN(value)) {
          data[key] = 0;
        }
      });
    }
    
    return data;
  }

  // Get validation statistics
  getValidationStats() {
    const ruleStats = {};
    
    this.validationRules.forEach((rule, name) => {
      ruleStats[name] = {
        name,
        usage: rule.usage,
        successCount: rule.successCount,
        failureCount: rule.failureCount,
        lastUsed: rule.lastUsed,
        severity: rule.severity
      };
    });

    return ruleStats;
  }

  // Get system state
  getState() {
    return {
      isInitialized: this.isInitialized,
      options: this.options,
      validationRules: Array.from(this.validationRules.entries()).map(([name, rule]) => ({
        name,
        ...rule
      })),
      validators: Array.from(this.validators.entries()).map(([name, validator]) => ({
        name,
        ...validator
      })),
      stats: this.getValidationStats(),
      lastUpdated: new Date().toISOString()
    };
  }

  // Destroy validator
  destroy() {
    this.validationRules.clear();
    this.validationHistory = [];
    this.qualityScores.clear();
    
    this.isInitialized = false;
    console.log('[EXPORT_VALIDATOR] Export validator destroyed');
  }
}

// Global instance
let exportValidator = null;

// Initialize validator when DOM is ready
function initializeExportValidator() {
  if (!exportValidator) {
    exportValidator = new ExportValidator();
  }
  return exportValidator.initialize();
}

// Export for global access
window.exportValidator = exportValidator;

module.exports = {
  ExportValidator,
  initializeExportValidator
};
