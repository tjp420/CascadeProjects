/**
 * Automated Issue Fixing System
 * 
 * Automatic issue detection and fixing capabilities with
 * rollback mechanisms, fix validation, and success tracking
 */

const logger = require('../../lib/app-logger');

class AutoFixer {
  constructor(options = {}) {
    this.options = options;
    this.fixStrategies = new Map();
    this.fixHistory = [];
    this.rollbackStack = new Map();
    this.maxHistory = options.maxHistory || 1000;
    this.maxRollbackStack = options.maxRollbackStack || 100;
    this.autoFixEnabled = options.autoFixEnabled !== false;
    this.validationEnabled = options.validationEnabled !== false;
    this.rollbackEnabled = options.rollbackEnabled !== false;
    this.stats = {
      fixesAttempted: 0,
      fixesSucceeded: 0,
      fixesFailed: 0,
      rollbacksPerformed: 0
    };
    
    this.initializeFixStrategies();
    logger.info('[AUTO_FIXER] Auto fixer initialized');
  }

  // Initialize fix strategies
  initializeFixStrategies() {
    // Missing field fix
    this.addFixStrategy('missing_field', {
      canFix: (issue) => issue.autoFixable && issue.type === 'missing_field',
      fix: (issue, data) => this.fixMissingField(issue, data),
      validate: (originalData, fixedData, issue) => this.validateMissingFieldFix(originalData, fixedData, issue),
      rollback: (originalData, fixedData, issue) => this.rollbackMissingFieldFix(originalData, fixedData, issue)
    });

    // Invalid format fix
    this.addFixStrategy('invalid_format', {
      canFix: (issue) => issue.autoFixable && issue.type === 'invalid_format',
      fix: (issue, data) => this.fixInvalidFormat(issue, data),
      validate: (originalData, fixedData, issue) => this.validateFormatFix(originalData, fixedData, issue),
      rollback: (originalData, fixedData, issue) => this.rollbackFormatFix(originalData, fixedData, issue)
    });

    // Duplicate data fix
    this.addFixStrategy('duplicate_data', {
      canFix: (issue) => issue.autoFixable && issue.type === 'duplicate_data',
      fix: (issue, data) => this.fixDuplicateData(issue, data),
      validate: (originalData, fixedData, issue) => this.validateDuplicateFix(originalData, fixedData, issue),
      rollback: (originalData, fixedData, issue) => this.rollbackDuplicateFix(originalData, fixedData, issue)
    });

    // Null value fix
    this.addFixStrategy('null_value', {
      canFix: (issue) => issue.autoFixable && issue.type === 'null_value',
      fix: (issue, data) => this.fixNullValue(issue, data),
      validate: (originalData, fixedData, issue) => this.validateNullValueFix(originalData, fixedData, issue),
      rollback: (originalData, fixedData, issue) => this.rollbackNullValueFix(originalData, fixedData, issue)
    });

    // Type mismatch fix
    this.addFixStrategy('type_mismatch', {
      canFix: (issue) => issue.autoFixable && issue.type === 'type_mismatch',
      fix: (issue, data) => this.fixTypeMismatch(issue, data),
      validate: (originalData, fixedData, issue) => this.validateTypeMismatchFix(originalData, fixedData, issue),
      rollback: (originalData, fixedData, issue) => this.rollbackTypeMismatchFix(originalData, fixedData, issue)
    });

    // Schema violation fix
    this.addFixStrategy('schema_violation', {
      canFix: (issue) => issue.autoFixable && issue.type === 'schema_violation',
      fix: (issue, data) => this.fixSchemaViolation(issue, data),
      validate: (originalData, fixedData, issue) => this.validateSchemaFix(originalData, fixedData, issue),
      rollback: (originalData, fixedData, issue) => this.rollbackSchemaFix(originalData, fixedData, issue)
    });

    // Insecure format fix
    this.addFixStrategy('insecure_format', {
      canFix: (issue) => issue.autoFixable && issue.type === 'insecure_format',
      fix: (issue, data) => this.fixInsecureFormat(issue, data),
      validate: (originalData, fixedData, issue) => this.validateInsecureFormatFix(originalData, fixedData, issue),
      rollback: (originalData, fixedData, issue) => this.rollbackInsecureFormatFix(originalData, fixedData, issue)
    });

    logger.debug(`[AUTO_FIXER] Initialized ${this.fixStrategies.size} fix strategies`);
  }

  // Add fix strategy
  addFixStrategy(issueType, strategy) {
    this.fixStrategies.set(issueType, {
      ...strategy,
      fixCount: 0,
      successCount: 0,
      failureCount: 0,
      lastUsed: null
    });
    logger.debug(`[AUTO_FIXER] Added fix strategy for: ${issueType}`);
  }

  // Attempt to fix issue
  async attemptFix(issue, data, context = {}) {
    if (!this.autoFixEnabled) {
      return {
        success: false,
        reason: 'Auto-fix is disabled',
        fixedData: data
      };
    }

    const strategy = this.fixStrategies.get(issue.type);
    if (!strategy) {
      return {
        success: false,
        reason: `No fix strategy available for issue type: ${issue.type}`,
        fixedData: data
      };
    }

    if (!strategy.canFix(issue)) {
      return {
        success: false,
        reason: 'Issue cannot be automatically fixed',
        fixedData: data
      };
    }

    this.stats.fixesAttempted++;
    strategy.fixCount++;
    strategy.lastUsed = new Date().toISOString();

    try {
      // Store original data for rollback
      const originalData = JSON.parse(JSON.stringify(data));
      
      // Apply fix
      const fixedData = await strategy.fix(issue, data);
      
      // Validate fix if enabled
      if (this.validationEnabled) {
        const validation = await strategy.validate(originalData, fixedData, issue);
        if (!validation.valid) {
          throw new Error(`Fix validation failed: ${validation.reason}`);
        }
      }

      // Store rollback information
      if (this.rollbackEnabled) {
        this.storeRollbackInfo(issue.id, originalData, fixedData, strategy);
      }

      // Update statistics
      this.stats.fixesSucceeded++;
      strategy.successCount++;

      const fixResult = {
        success: true,
        issueId: issue.id,
        issueType: issue.type,
        fixedData,
        originalData,
        fixApplied: new Date().toISOString(),
        strategy: issue.type,
        validation: this.validationEnabled ? 'passed' : 'skipped'
      };

      // Add to history
      this.addToHistory(fixResult);

      logger.info(`[AUTO_FIXER] Fix successful: ${issue.type} - ${issue.title}`);
      return fixResult;

    } catch (error) {
      this.stats.fixesFailed++;
      strategy.failureCount++;

      const fixResult = {
        success: false,
        issueId: issue.id,
        issueType: issue.type,
        fixedData: data, // Return original data on failure
        error: error.message,
        fixAttempted: new Date().toISOString(),
        strategy: issue.type
      };

      // Add to history
      this.addToHistory(fixResult);

      console.error(`[AUTO_FIXER] Fix failed: ${issue.type} - ${error.message}`);
      return fixResult;
    }
  }

  // Fix implementations
  async fixMissingField(issue, data) {
    const location = issue.location;
    const fieldMatch = location.match(/field:(.+)/);
    
    if (!fieldMatch) {
      throw new Error('Cannot extract field name from location');
    }

    const fieldName = fieldMatch[1];
    const defaultValue = this.getDefaultValueForField(fieldName, data);

    if (typeof data === 'object' && data !== null) {
      data[fieldName] = defaultValue;
    } else {
      throw new Error('Cannot add field to non-object data');
    }

    return data;
  }

  async fixInvalidFormat(issue, data) {
    const location = issue.location;
    
    if (location === 'string_content') {
      // Fix undefined/NaN values
      if (typeof data === 'string') {
        data = data.replace(/undefined/g, 'null').replace(/NaN/g, '0');
      }
    } else if (location.startsWith('field:')) {
      const fieldMatch = location.match(/field:(.+)/);
      if (fieldMatch && typeof data === 'object' && data !== null) {
        const fieldName = fieldMatch[1];
        const value = data[fieldName];
        
        if (typeof value === 'string') {
          // Fix email format
          if (fieldName.toLowerCase().includes('email')) {
            data[fieldName] = this.fixEmailFormat(value);
          }
          // Fix date format
          else if (fieldName.toLowerCase().includes('date') || fieldName.toLowerCase().includes('time')) {
            data[fieldName] = this.fixDateFormat(value);
          }
        }
      }
    }

    return data;
  }

  async fixDuplicateData(issue, data) {
    // For duplicate data, we'll mark it with a duplicate flag
    if (typeof data === 'object' && data !== null) {
      data._duplicateFlag = true;
      data._duplicateDetected = new Date().toISOString();
    }

    return data;
  }

  async fixNullValue(issue, data) {
    const location = issue.location;
    const fieldMatch = location.match(/field:(.+)/);
    
    if (!fieldMatch) {
      throw new Error('Cannot extract field name from location');
    }

    const fieldName = fieldMatch[1];
    
    if (typeof data === 'object' && data !== null) {
      const currentValue = data[fieldName];
      
      if (currentValue === null || currentValue === undefined) {
        data[fieldName] = this.getDefaultValueForField(fieldName, data);
      } else if (typeof currentValue === 'string' && currentValue.trim() === '') {
        data[fieldName] = this.getDefaultValueForField(fieldName, data);
      }
    }

    return data;
  }

  async fixTypeMismatch(issue, data) {
    const location = issue.location;
    const fieldMatch = location.match(/field:(.+)/);
    
    if (!fieldMatch) {
      throw new Error('Cannot extract field name from location');
    }

    const fieldName = fieldMatch[1];
    
    if (typeof data === 'object' && data !== null && data.hasOwnProperty(fieldName)) {
      const currentValue = data[fieldName];
      const expectedType = this.getExpectedTypeForField(fieldName, data);
      
      data[fieldName] = this.convertType(currentValue, expectedType);
    }

    return data;
  }

  async fixSchemaViolation(issue, data) {
    // For schema violations, we'll add missing required fields
    if (typeof data === 'object' && data !== null) {
      // Add common required fields if missing
      if (!data.id) data.id = this.generateId();
      if (!data.created_at) data.created_at = new Date().toISOString();
      if (!data.updated_at) data.updated_at = new Date().toISOString();
    }

    return data;
  }

  async fixInsecureFormat(issue, data) {
    const location = issue.location;
    
    if (location === 'content') {
      // Convert HTTP URLs to HTTPS
      if (typeof data === 'string') {
        data = data.replace(/http:\/\//g, 'https://');
      }
    }

    return data;
  }

  // Validation methods
  async validateMissingFieldFix(originalData, fixedData, issue) {
    const location = issue.location;
    const fieldMatch = location.match(/field:(.+)/);
    
    if (!fieldMatch) {
      return { valid: false, reason: 'Cannot extract field name for validation' };
    }

    const fieldName = fieldMatch[1];
    
    if (typeof fixedData === 'object' && fixedData !== null) {
      if (!fixedData.hasOwnProperty(fieldName)) {
        return { valid: false, reason: `Field ${fieldName} still missing after fix` };
      }
      
      if (fixedData[fieldName] === null || fixedData[fieldName] === undefined) {
        return { valid: false, reason: `Field ${fieldName} is still null/undefined after fix` };
      }
    }

    return { valid: true };
  }

  async validateFormatFix(originalData, fixedData, issue) {
    // Check if the format issue is resolved
    if (typeof fixedData === 'string') {
      if (fixedData.includes('undefined') || fixedData.includes('NaN')) {
        return { valid: false, reason: 'String still contains undefined/NaN values' };
      }
    }

    return { valid: true };
  }

  async validateDuplicateFix(originalData, fixedData, issue) {
    if (typeof fixedData === 'object' && fixedData !== null) {
      if (!fixedData._duplicateFlag) {
        return { valid: false, reason: 'Duplicate flag not added' };
      }
    }

    return { valid: true };
  }

  async validateNullValueFix(originalData, fixedData, issue) {
    const location = issue.location;
    const fieldMatch = location.match(/field:(.+)/);
    
    if (!fieldMatch) {
      return { valid: false, reason: 'Cannot extract field name for validation' };
    }

    const fieldName = fieldMatch[1];
    
    if (typeof fixedData === 'object' && fixedData !== null) {
      const value = fixedData[fieldName];
      
      if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
        return { valid: false, reason: `Field ${fieldName} is still null/undefined/empty after fix` };
      }
    }

    return { valid: true };
  }

  async validateTypeMismatchFix(originalData, fixedData, issue) {
    const location = issue.location;
    const fieldMatch = location.match(/field:(.+)/);
    
    if (!fieldMatch) {
      return { valid: false, reason: 'Cannot extract field name for validation' };
    }

    const fieldName = fieldMatch[1];
    
    if (typeof fixedData === 'object' && fixedData !== null && fixedData.hasOwnProperty(fieldName)) {
      const currentValue = fixedData[fieldName];
      const expectedType = this.getExpectedTypeForField(fieldName, fixedData);
      
      if (!this.typeMatches(typeof currentValue, expectedType)) {
        return { valid: false, reason: `Field ${fieldName} type still mismatched after fix` };
      }
    }

    return { valid: true };
  }

  async validateSchemaFix(originalData, fixedData, issue) {
    // Basic schema validation
    if (typeof fixedData === 'object' && fixedData !== null) {
      if (!fixedData.id || !fixedData.created_at || !fixedData.updated_at) {
        return { valid: false, reason: 'Required schema fields still missing' };
      }
    }

    return { valid: true };
  }

  async validateInsecureFormatFix(originalData, fixedData, issue) {
    if (typeof fixedData === 'string') {
      if (fixedData.includes('http://')) {
        return { valid: false, reason: 'Insecure HTTP URLs still present' };
      }
    }

    return { valid: true };
  }

  // Rollback methods
  async rollbackMissingFieldFix(originalData, fixedData, issue) {
    return originalData;
  }

  async rollbackFormatFix(originalData, fixedData, issue) {
    return originalData;
  }

  async rollbackDuplicateFix(originalData, fixedData, issue) {
    if (typeof originalData === 'object' && originalData !== null) {
      delete originalData._duplicateFlag;
      delete originalData._duplicateDetected;
    }
    return originalData;
  }

  async rollbackNullValueFix(originalData, fixedData, issue) {
    return originalData;
  }

  async rollbackTypeMismatchFix(originalData, fixedData, issue) {
    return originalData;
  }

  async rollbackSchemaFix(originalData, fixedData, issue) {
    return originalData;
  }

  async rollbackInsecureFormatFix(originalData, fixedData, issue) {
    return originalData;
  }

  // Helper methods
  getDefaultValueForField(fieldName, data) {
    const fieldLower = fieldName.toLowerCase();
    
    if (fieldLower.includes('id')) {
      return this.generateId();
    }
    if (fieldLower.includes('name')) {
      return 'Default Name';
    }
    if (fieldLower.includes('email')) {
      return 'default@example.com';
    }
    if (fieldLower.includes('phone')) {
      return '+1-555-000-0000';
    }
    if (fieldLower.includes('created_at') || fieldLower.includes('updated_at')) {
      return new Date().toISOString();
    }
    if (fieldLower.includes('status')) {
      return 'active';
    }
    if (fieldLower.includes('price') || fieldLower.includes('cost')) {
      return 0;
    }
    if (fieldLower.includes('count') || fieldLower.includes('quantity')) {
      return 1;
    }
    
    return null;
  }

  getExpectedTypeForField(fieldName, data) {
    const fieldLower = fieldName.toLowerCase();
    
    if (fieldLower.includes('id')) {
      return 'string';
    }
    if (fieldLower.includes('name') || fieldLower.includes('email') || fieldLower.includes('phone')) {
      return 'string';
    }
    if (fieldLower.includes('created_at') || fieldLower.includes('updated_at')) {
      return 'string';
    }
    if (fieldLower.includes('status')) {
      return 'string';
    }
    if (fieldLower.includes('price') || fieldLower.includes('cost')) {
      return 'number';
    }
    if (fieldLower.includes('count') || fieldLower.includes('quantity')) {
      return 'number';
    }
    if (fieldLower.includes('active') || fieldLower.includes('enabled')) {
      return 'boolean';
    }
    
    return 'string';
  }

  convertType(value, targetType) {
    switch (targetType) {
      case 'string':
        return String(value);
      case 'number':
        return Number(value);
      case 'boolean':
        return Boolean(value);
      case 'date':
        return new Date(value).toISOString();
      default:
        return value;
    }
  }

  typeMatches(actual, expected) {
    const typeMap = {
      'string': ['string'],
      'number': ['number'],
      'boolean': ['boolean'],
      'object': ['object'],
      'array': ['array'],
      'date': ['string']
    };
    
    const expectedTypes = typeMap[expected] || [expected];
    return expectedTypes.includes(actual);
  }

  fixEmailFormat(email) {
    // Basic email format fix
    if (!email.includes('@')) {
      return `${email}@example.com`;
    }
    
    const [local, domain] = email.split('@');
    if (!domain.includes('.')) {
      return `${local}@${domain}.com`;
    }
    
    return email.toLowerCase();
  }

  fixDateFormat(dateString) {
    // Try to parse and reformat date
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    
    // If parsing fails, return current date
    return new Date().toISOString();
  }

  generateId() {
    return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  storeRollbackInfo(issueId, originalData, fixedData, strategy) {
    const rollbackInfo = {
      issueId,
      originalData: JSON.parse(JSON.stringify(originalData)),
      fixedData: JSON.parse(JSON.stringify(fixedData)),
      strategy: strategy,
      timestamp: new Date().toISOString()
    };

    this.rollbackStack.set(issueId, rollbackInfo);

    // Keep only max rollback entries
    if (this.rollbackStack.size > this.maxRollbackStack) {
      const oldestId = this.rollbackStack.keys().next().value;
      this.rollbackStack.delete(oldestId);
    }
  }

  addToHistory(fixResult) {
    this.fixHistory.push(fixResult);
    
    // Keep only max history entries
    if (this.fixHistory.length > this.maxHistory) {
      this.fixHistory = this.fixHistory.slice(-this.maxHistory);
    }
  }

  // Rollback fix
  async rollbackFix(issueId) {
    if (!this.rollbackEnabled) {
      return {
        success: false,
        reason: 'Rollback is disabled'
      };
    }

    const rollbackInfo = this.rollbackStack.get(issueId);
    if (!rollbackInfo) {
      return {
        success: false,
        reason: 'No rollback information available for this issue'
      };
    }

    try {
      const strategy = this.fixStrategies.get(rollbackInfo.strategy);
      if (!strategy || !strategy.rollback) {
        throw new Error('No rollback strategy available');
      }

      const rolledBackData = await strategy.rollback(
        rollbackInfo.originalData,
        rollbackInfo.fixedData,
        { id: issueId }
      );

      this.stats.rollbacksPerformed++;

      const rollbackResult = {
        success: true,
        issueId,
        rolledBackData,
        originalData: rollbackInfo.originalData,
        timestamp: new Date().toISOString()
      };

      // Remove from rollback stack
      this.rollbackStack.delete(issueId);

      logger.info(`[AUTO_FIXER] Rollback successful for issue: ${issueId}`);
      return rollbackResult;

    } catch (error) {
      console.error(`[AUTO_FIXER] Rollback failed for issue ${issueId}:`, error.message);
      return {
        success: false,
        reason: error.message,
        issueId
      };
    }
  }

  // Batch fix issues
  async batchFixIssues(issues, dataArray, context = {}) {
    const results = [];
    
    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];
      const data = dataArray[i];
      
      try {
        const result = await this.attemptFix(issue, data, context);
        results.push({
          index: i,
          issueId: issue.id,
          ...result
        });
      } catch (error) {
        results.push({
          index: i,
          issueId: issue.id,
          success: false,
          error: error.message
        });
      }
    }

    return {
      results,
      summary: this.generateBatchSummary(results)
    };
  }

  // Generate batch summary
  generateBatchSummary(results) {
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    return {
      total: results.length,
      successful,
      failed,
      successRate: results.length > 0 ? (successful / results.length) * 100 : 0,
      timestamp: new Date().toISOString()
    };
  }

  // Get fix statistics
  getFixStats() {
    const strategyStats = {};
    
    this.fixStrategies.forEach((strategy, name) => {
      strategyStats[name] = {
        fixCount: strategy.fixCount,
        successCount: strategy.successCount,
        failureCount: strategy.failureCount,
        successRate: strategy.fixCount > 0 ? (strategy.successCount / strategy.fixCount) * 100 : 0,
        lastUsed: strategy.lastUsed
      };
    });

    return {
      ...this.stats,
      successRate: this.stats.fixesAttempted > 0 ? (this.stats.fixesSucceeded / this.stats.fixesAttempted) * 100 : 0,
      strategyStats,
      rollbackStack: this.rollbackStack.size,
      historySize: this.fixHistory.length,
      autoFixEnabled: this.autoFixEnabled,
      validationEnabled: this.validationEnabled,
      rollbackEnabled: this.rollbackEnabled
    };
  }

  // Enable/disable auto-fix
  setAutoFixEnabled(enabled) {
    this.autoFixEnabled = enabled;
    logger.debug(`[AUTO_FIXER] Auto-fix ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Enable/disable validation
  setValidationEnabled(enabled) {
    this.validationEnabled = enabled;
    logger.debug(`[AUTO_FIXER] Validation ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Enable/disable rollback
  setRollbackEnabled(enabled) {
    this.rollbackEnabled = enabled;
    logger.debug(`[AUTO_FIXER] Rollback ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Clear history
  clearHistory() {
    this.fixHistory = [];
    logger.debug('[AUTO_FIXER] Fix history cleared');
  }

  // Clear rollback stack
  clearRollbackStack() {
    this.rollbackStack.clear();
    logger.debug('[AUTO_FIXER] Rollback stack cleared');
  }

  // Export fix history
  exportFixHistory() {
    const exportData = {
      history: this.fixHistory,
      rollbackStack: Array.from(this.rollbackStack.entries()).map(([id, info]) => ({
        issueId: id,
        ...info
      })),
      stats: this.getFixStats(),
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `fix-history-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObject(url);
    
    logger.debug('[AUTO_FIXER] Fix history exported');
  }

  // Get system state
  getState() {
    return {
      fixStrategies: Array.from(this.fixStrategies.entries()).map(([name, strategy]) => ({
        name,
        ...strategy
      })),
      fixHistory: this.fixHistory,
      rollbackStack: Array.from(this.rollbackStack.entries()),
      stats: this.getFixStats(),
      options: this.options
    };
  }

  // Destroy auto fixer
  destroy() {
    this.clearHistory();
    this.clearRollbackStack();
    
    logger.info('[AUTO_FIXER] Auto fixer destroyed');
  }
}

// Global instance
let autoFixer = null;

// Initialize auto fixer when DOM is ready
function initializeAutoFixer() {
  if (!autoFixer) {
    autoFixer = new AutoFixer();
  }
  return autoFixer;
}

// Export for global access
window.autoFixer = autoFixer;

module.exports = {
  AutoFixer,
  initializeAutoFixer
};
