/**
 * Auto-Fixer System
 * 
 * Automatic issue fixing with validation rule-based corrections,
 * rollback capabilities, and comprehensive fix tracking
 */

class AutoFixer {
  constructor(options = {}) {
    this.options = options;
    this.fixers = new Map();
    this.fixHistory = [];
    this.rollbackStack = [];
    this.isInitialized = false;
    this.enableRollback = options.enableRollback !== false;
    this.maxRollbackDepth = options.maxRollbackDepth || 10;
    
    this.initializeFixers();
    console.log('[AUTO_FIXER] Auto-fixer initialized');
  }

  // Initialize auto-fixers
  initializeFixers() {
    // JSON structure fixer
    this.addFixer('json_structure', {
      name: 'JSON Structure Fixer',
      description: 'Fixes JSON structure issues',
      fixer: this.fixJSONStructure.bind(this),
      validator: this.validateJSONStructure.bind(this),
      rollback: this.rollbackJSONStructure.bind(this),
      severity: 'high',
      category: 'structure'
    });

    // JSON format fixer
    this.addFixer('json_format', {
      name: 'JSON Format Fixer',
      description: 'Fixes JSON format issues',
      fixer: this.fixJSONFormat.bind(this),
      validator: this.validateJSONFormat.bind(this),
      rollback: this.rollbackJSONFormat.bind(this),
      severity: 'medium',
      category: 'format'
    });

    // JSON content fixer
    this.addFixer('json_content', {
      name: 'JSON Content Fixer',
      description: 'Fixes JSON content issues',
      fixer: this.fixJSONContent.bind(this),
      validator: this.validateJSONContent.bind(this),
      rollback: this.rollbackJSONContent.bind(this),
      severity: 'medium',
      category: 'content'
    });

    // CSV structure fixer
    this.addFixer('csv_structure', {
      name: 'CSV Structure Fixer',
      description: 'Fixes CSV structure issues',
      fixer: this.fixCSVStructure.bind(this),
      validator: this.validateCSVStructure.bind(this),
      rollback: this.rollbackCSVStructure.bind(this),
      severity: 'high',
      category: 'structure'
    });

    // CSV format fixer
    this.addFixer('csv_format', {
      name: 'CSV Format Fixer',
      description: 'Fixes CSV format issues',
      fixer: this.fixCSVFormat.bind(this),
      validator: this.validateCSVFormat.bind(this),
      rollback: this.rollbackCSVFormat.bind(this),
      severity: 'medium',
      category: 'format'
    });

    // SQL syntax fixer
    this.addFixer('sql_syntax', {
      name: 'SQL Syntax Fixer',
      description: 'Fixes SQL syntax issues',
      fixer: this.fixSQLSyntax.bind(this),
      validator: this.validateSQLSyntax.bind(this),
      rollback: this.rollbackSQLSyntax.bind(this),
      severity: 'high',
      category: 'syntax'
    });

    // SQL structure fixer
    this.addFixer('sql_structure', {
      name: 'SQL Structure Fixer',
      description: 'Fixes SQL structure issues',
      fixer: this.fixSQLStructure.bind(this),
      validator: this.validateSQLStructure.bind(this),
      rollback: this.rollbackSQLStructure.bind(this),
      severity: 'high',
      category: 'structure'
    });

    // XML structure fixer
    this.addFixer('xml_structure', {
      name: 'XML Structure Fixer',
      description: 'Fixes XML structure issues',
      fixer: this.fixXMLStructure.bind(this),
      validator: this.validateXMLStructure.bind(this),
      rollback: this.rollbackXMLStructure.bind(this),
      severity: 'high',
      category: 'structure'
    });

    // XML syntax fixer
    this.addFixer('xml_syntax', {
      name: 'XML Syntax Fixer',
      description: 'Fixes XML syntax issues',
      fixer: this.fixXMLSyntax.bind(this),
      validator: this.validateXMLSyntax.bind(this),
      rollback: this.rollbackXMLSyntax.bind(this),
      severity: 'medium',
      category: 'syntax'
    });

    // YAML structure fixer
    this.addFixer('yaml_structure', {
      name: 'YAML Structure Fixer',
      description: 'Fixes YAML structure issues',
      fixer: this.fixYAMLStructure.bind(this),
      validator: this.validateYAMLStructure.bind(this),
      rollback: this.rollbackYAMLStructure.bind(this),
      severity: 'medium',
      category: 'structure'
    });

    // YAML syntax fixer
    this.addFixer('yaml_syntax', {
      name: 'YAML Syntax Fixer',
      description: 'Fixes YAML syntax issues',
      fixer: this.fixYAMLSyntax.bind(this),
      validator: this.validateYAMLSyntax.bind(this),
      rollback: this.rollbackYAMLSyntax.bind(this),
      severity: 'medium',
      category: 'syntax'
    });

    console.log(`[AUTO_FIXER] Initialized ${this.fixers.size} auto-fixers`);
  }

  // Add fixer
  addFixer(name, fixer) {
    this.fixers.set(name, {
      ...fixer,
      usage: 0,
      avgProcessingTime: 0,
      totalProcessingTime: 0,
      successCount: 0,
      failureCount: 0,
      lastUsed: null
    });
    console.log(`[AUTO_FIXER] Added auto-fixer: ${name}`);
  }

  // Initialize auto-fixer
  async initialize() {
    if (this.isInitialized) {
      console.log('[AUTO_FIXER] Auto-fixer already initialized');
      return;
    }

    try {
      // Initialize rollback stack
      this.rollbackStack = [];
      
      this.isInitialized = true;
      console.log('[AUTO_FIXER] Auto-fixer initialized successfully');
      
    } catch (error) {
      console.error('[AUTO_FIXER] Failed to initialize auto-fixer:', error.message);
      throw error;
    }
  }

  // Fix data using specified fixer
  async fixData(data, fixerName, options = {}) {
    const fixer = this.fixers.get(fixerName);
    if (!fixer) {
      throw new Error(`Auto-fixer not found: ${fixerName}`);
    }

    const startTime = Date.now();
    const fixId = this.generateFixId();
    
    try {
      // Create rollback point if enabled
      let rollbackData = null;
      if (this.enableRollback) {
        rollbackData = this.createRollbackPoint(data, fixerName);
      }
      
      // Apply fix
      const fixedData = await fixer.fixer(data, options);
      
      // Validate the fix
      const validationResult = fixer.validator(fixedData);
      
      if (!validationResult.valid) {
        throw new Error(`Fix validation failed: ${validationResult.errors.join(', ')}`);
      }
      
      const processingTime = Date.now() - startTime;
      
      // Update fixer stats
      fixer.usage++;
      fixer.totalProcessingTime += processingTime;
      fixer.avgProcessingTime = fixer.totalProcessingTime / fixer.usage;
      fixer.successCount++;
      fixer.lastUsed = new Date().toISOString();
      
      // Add to rollback stack
      if (this.enableRollback && rollbackData) {
        this.rollbackStack.push({
          id: fixId,
          fixerName,
          originalData: data,
          fixedData,
          rollbackData,
          timestamp: new Date().toISOString(),
          processingTime
        });
        
        // Limit rollback stack size
        if (this.rollbackStack.length > this.maxRollbackDepth) {
          this.rollbackStack.shift();
        }
      }
      
      // Add to fix history
      this.fixHistory.push({
        id: fixId,
        fixerName,
        originalData: data,
        fixedData,
        processingTime,
        success: true,
        timestamp: new Date().toISOString(),
        changes: this.detectChanges(data, fixedData)
      });
      
      console.log(`[AUTO_FIXER] Fix applied: ${fixerName} (${processingTime}ms)`);
      
      return {
        success: true,
        data: fixedData,
        processingTime,
        metadata: {
          fixId,
          fixer: fixerName,
          changes: this.detectChanges(data, fixedData),
          validationResult,
          rollbackAvailable: this.enableRollback
        }
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Update fixer failure stats
      if (fixer) {
        fixer.failureCount++;
        fixer.totalProcessingTime += processingTime;
        fixer.avgProcessingTime = fixer.totalProcessingTime / Math.max(1, fixer.usage);
        fixer.lastUsed = new Date().toISOString();
      }
      
      // Add to fix history
      this.fixHistory.push({
        id: fixId,
        fixerName,
        originalData: data,
        fixedData: data,
        processingTime,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      console.error(`[AUTO_FIXER] Fix failed: ${fixerName} - ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        processingTime
      };
    }
  }

  // Batch fix data using multiple fixers
  async batchFixData(data, fixerNames, options = {}) {
    const results = [];
    let currentData = data;
    
    for (const fixerName of fixerNames) {
      const result = await this.fixData(currentData, fixerName, options);
      
      if (result.success) {
        currentData = result.data;
        results.push(result);
      } else {
        // Stop on first failure
        results.push(result);
        break;
      }
    }
    
    return {
      success: results.every(r => r.success),
      data: currentData,
      results,
      metadata: {
        totalFixers: fixerNames.length,
        successfulFixers: results.filter(r => r.success).length,
        failedFixers: results.filter(r => !r.success).length,
        totalProcessingTime: results.reduce((sum, r) => sum + r.processingTime, 0)
      }
    };
  }

  // Rollback last fix
  async rollback(fixId = null) {
    if (!this.enableRollback) {
      throw new Error('Rollback is not enabled');
    }
    
    if (this.rollbackStack.length === 0) {
      throw new Error('No fixes to rollback');
    }
    
    let rollbackEntry = null;
    
    if (fixId) {
      rollbackEntry = this.rollbackStack.find(entry => entry.id === fixId);
      if (!rollbackEntry) {
        throw new Error(`Fix not found: ${fixId}`);
      }
    } else {
      rollbackEntry = this.rollbackStack[this.rollbackStack.length - 1];
    }
    
    try {
      // Apply rollback
      const rolledBackData = await this.applyRollback(rollbackEntry);
      
      // Remove from rollback stack
      const index = this.rollbackStack.indexOf(rollbackEntry);
      if (index > -1) {
        this.rollbackStack.splice(index, 1);
      }
      
      // Add to fix history
      this.fixHistory.push({
        id: this.generateFixId(),
        fixerName: `rollback_${rollbackEntry.fixerName}`,
        originalData: rollbackEntry.fixedData,
        fixedData: rolledBackData,
        processingTime: 0,
        success: true,
        timestamp: new Date().toISOString(),
        isRollback: true,
        originalFixId: rollbackEntry.id
      });
      
      console.log(`[AUTO_FIXER] Rollback applied: ${rollbackEntry.fixerName}`);
      
      return {
        success: true,
        data: rolledBackData,
        metadata: {
          originalFixId: rollbackEntry.id,
          originalFixerName: rollbackEntry.fixerName,
          rollbackTimestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      console.error(`[AUTO_FIXER] Rollback failed: ${error.message}`);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Create rollback point
  createRollbackPoint(data, fixerName) {
    return {
      data: JSON.parse(JSON.stringify(data)),
      fixerName,
      timestamp: new Date().toISOString()
    };
  }

  // Apply rollback
  async applyRollback(rollbackEntry) {
    const fixer = this.fixers.get(rollbackEntry.fixerName);
    if (fixer && fixer.rollback) {
      return await fixer.rollback(rollbackEntry.rollbackData);
    }
    
    // Default rollback: restore original data
    return rollbackEntry.originalData;
  }

  // Generate fix ID
  generateFixId() {
    return `fix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
      
      // Check for removed fields
      Object.keys(original).forEach(key => {
        if (!(key in fixed)) {
          changes.push({
            field: key,
            original: original[key],
            fixed: null,
            type: 'removed'
          });
        }
      });
      
      // Check for added fields
      Object.keys(fixed).forEach(key => {
        if (!(key in original)) {
          changes.push({
            field: key,
            original: null,
            fixed: fixed[key],
            type: 'added'
          });
        }
      });
    }
    
    return changes;
  }

  // JSON fixing methods
  async fixJSONStructure(data) {
    if (typeof data === 'object' && data !== null) {
      const fixed = JSON.parse(JSON.stringify(data));
      
      // Fix undefined values
      Object.keys(fixed).forEach(key => {
        if (fixed[key] === undefined) {
          fixed[key] = null;
        }
      });
      
      return fixed;
    }
    
    return data;
  }

  validateJSONStructure(data) {
    try {
      JSON.parse(JSON.stringify(data));
      return { valid: true, errors: [] };
    } catch (error) {
      return { valid: false, errors: [error.message] };
    }
  }

  async rollbackJSONStructure(rollbackData) {
    return rollbackData.data;
  }

  async fixJSONFormat(data) {
    if (typeof data === 'string') {
      let fixed = data;
      
      // Fix undefined and NaN values
      fixed = fixed.replace(/undefined/g, 'null').replace(/NaN/g, '0');
      
      // Fix encoding issues
      fixed = fixed.replace(/\uFFFD/g, '').replace(/[\u2018\u2019]/g, "'");
      
      return fixed;
    }
    
    return data;
  }

  validateJSONFormat(data) {
    if (typeof data !== 'string') {
      return { valid: false, errors: ['Data is not a string'] };
    }
    
    const issues = [];
    
    if (data.includes('undefined') || data.includes('NaN')) {
      issues.push('JSON contains undefined or NaN values');
    }
    
    if (data.includes('') || data.includes('')) {
      issues.push('JSON contains encoding issues');
    }
    
    return {
      valid: issues.length === 0,
      errors: issues
    };
  }

  async rollbackJSONFormat(rollbackData) {
    return rollbackData.data;
  }

  async fixJSONContent(data) {
    if (typeof data === 'object' && data !== null) {
      const fixed = JSON.parse(JSON.stringify(data));
      
      // Fix null and undefined values
      Object.keys(fixed).forEach(key => {
        if (fixed[key] === null || fixed[key] === undefined) {
          fixed[key] = null;
        }
      });
      
      return fixed;
    }
    
    return data;
  }

  validateJSONContent(data) {
    if (typeof data !== 'object' || data === null) {
      return { valid: false, errors: ['Data is not an object'] };
    }
    
    const issues = [];
    
    if (Object.keys(data).length === 0) {
      issues.push('Object is empty');
    }
    
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

  async rollbackJSONContent(rollbackData) {
    return rollbackData.data;
  }

  // CSV fixing methods
  async fixCSVStructure(data) {
    if (Array.isArray(data)) {
      const fixed = [...data];
      const columnCounts = fixed.map(row => row.split(',').length);
      const firstCount = columnCounts[0];
      
      for (let i = 1; i < fixed.length; i++) {
        if (columnCounts[i] !== firstCount) {
          const values = fixed[i].split(',');
          while (values.length < firstCount) {
            values.push('');
          }
          fixed[i] = values.join(',');
        }
      }
      
      return fixed;
    }
    
    return data;
  }

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

  async rollbackCSVStructure(rollbackData) {
    return rollbackData.data;
  }

  async fixCSVFormat(data) {
    if (Array.isArray(data)) {
      // Remove empty lines
      return data.filter(line => line.trim() !== '');
    }
    
    return data;
  }

  validateCSVFormat(data) {
    if (!Array.isArray(data)) {
      return { valid: false, errors: ['Data is not an array'] };
    }
    
    const issues = [];
    
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

  async rollbackCSVFormat(rollbackData) {
    return rollbackData.data;
  }

  // SQL fixing methods
  async fixSQLSyntax(data) {
    if (typeof data === 'string') {
      let fixed = data;
      
      // Fix common SQL syntax issues
      fixed = fixed.replace(/;;/g, ';');
      fixed = fixed.replace(/\s+/g, ' ');
      fixed = fixed.trim();
      
      return fixed;
    }
    
    return data;
  }

  validateSQLSyntax(data) {
    if (typeof data !== 'string') {
      return { valid: false, errors: ['Data is not a string'] };
    }
    
    const issues = [];
    const sqlUpper = data.toUpperCase();
    
    const sqlKeywords = ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT'];
    
    const hasKeywords = sqlKeywords.some(keyword => sqlUpper.includes(keyword));
    
    if (!hasKeywords) {
      issues.push('SQL does not contain recognized keywords');
    }
    
    if (data.includes(';;')) {
      issues.push('SQL contains double semicolons');
    }
    
    return {
      valid: issues.length === 0,
      errors: issues
    };
  }

  async rollbackSQLSyntax(rollbackData) {
    return rollbackData.data;
  }

  async fixSQLStructure(data) {
    if (Array.isArray(data) && data.length > 0) {
      const fixed = [...data];
      const headers = Object.keys(fixed[0] || []);
      
      fixed.forEach((row, index) => {
        const rowKeys = Object.keys(row);
        const missingFields = headers.filter(header => !rowKeys.includes(header));
        if (missingFields.length > 0) {
          missingFields.forEach(field => {
            row[field] = '';
          });
        }
      });
      
      return fixed;
    }
    
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

  async rollbackSQLStructure(rollbackData) {
    return rollbackData.data;
  }

  // XML fixing methods
  async fixXMLStructure(data) {
    if (typeof data === 'string') {
      let fixed = data;
      
      // Fix common XML structure issues
      fixed = fixed.replace(/&/g, '&amp;');
      fixed = fixed.replace(/</g, '&lt;');
      fixed = fixed.replace(/>/g, '&gt;');
      fixed = fixed.replace(/"/g, '&quot;');
      fixed = fixed.replace(/'/g, '&apos;');
      
      return fixed;
    }
    
    return data;
  }

  validateXMLStructure(data) {
    if (typeof data !== 'string') {
      return { valid: false, errors: ['Data is not a string'] };
    }
    
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data, 'text/xml');
      
      const parseError = xmlDoc.getElementsByTagName('parsererror');
      if (parseError.length > 0) {
        return { valid: false, errors: ['XML parsing error'] };
      }
      
      return { valid: true, errors: [] };
    } catch (error) {
      return { valid: false, errors: [error.message] };
    }
  }

  async rollbackXMLStructure(rollbackData) {
    return rollbackData.data;
  }

  async fixXMLSyntax(data) {
    if (typeof data === 'string') {
      let fixed = data;
      
      // Fix common XML syntax issues
      fixed = fixed.replace(/</g, '&lt;');
      fixed = fixed.replace(/>/g, '&gt;');
      
      return fixed;
    }
    
    return data;
  }

  validateXMLSyntax(data) {
    if (typeof data !== 'string') {
      return { valid: false, errors: ['Data is not a string'] };
    }
    
    const issues = [];
    
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

  async rollbackXMLSyntax(rollbackData) {
    return rollbackData.data;
  }

  // YAML fixing methods
  async fixYAMLStructure(data) {
    if (typeof data === 'string') {
      let fixed = data;
      
      // Fix common YAML structure issues
      fixed = fixed.replace(/: /g, ': ');
      fixed = fixed.replace(/: /g, ': ');
      
      return fixed;
    }
    
    return data;
  }

  validateYAMLStructure(data) {
    if (typeof data !== 'string') {
      return { valid: false, errors: ['Data is not a string'] };
    }
    
    const lines = data.split('\n');
    if (lines.length === 0) {
      return { valid: false, errors: ['Data is empty'] };
    }
    
    const issues = [];
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

  async rollbackYAMLStructure(rollbackData) {
    return rollbackData.data;
  }

  async fixYAMLSyntax(data) {
    if (typeof data === 'string') {
      let fixed = data;
      
      // Fix common YAML syntax issues
      fixed = fixed.replace(/\t/g, '  ');
      
      return fixed;
    }
    
    return data;
  }

  validateYAMLSyntax(data) {
    if (typeof data !== 'string') {
      return { valid: false, errors: ['Data is not a string'] };
    }
    
    const issues = [];
    
    if (data.includes('\t')) {
      issues.push('YAML contains tabs (should use spaces)');
    }
    
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

  async rollbackYAMLSyntax(rollbackData) {
    return rollbackData.data;
  }

  // Get auto-fixer statistics
  getStats() {
    const fixerStats = {};
    
    this.fixers.forEach((fixer, name) => {
      fixerStats[name] = {
        name,
        usage: fixer.usage,
        avgProcessingTime: fixer.avgProcessingTime,
        totalProcessingTime: fixer.totalProcessingTime,
        successCount: fixer.successCount,
        failureCount: fixer.failureCount,
        lastUsed: fixer.lastUsed,
        severity: fixer.severity,
        category: fixer.category,
        hasRollback: !!fixer.rollback
      };
    });

    const historyStats = {
      totalFixes: this.fixHistory.length,
      successfulFixes: this.fixHistory.filter(f => f.success).length,
      failedFixes: this.fixHistory.filter(f => !f.success).length,
      rollbacks: this.fixHistory.filter(f => f.isRollback).length
    };

    return {
      fixerStats,
      historyStats,
      totalFixers: this.fixers.size,
      rollbackStackSize: this.rollbackStack.length,
      maxRollbackDepth: this.maxRollbackDepth,
      averageProcessingTime: this.calculateAverageProcessingTime(),
      overallSuccessRate: this.calculateOverallSuccessRate(),
      lastUpdated: new Date().toISOString()
    };
  }

  // Calculate average processing time
  calculateAverageProcessingTime() {
    const processingTimes = Array.from(this.fixers.values()).map(fixer => fixer.avgProcessingTime);
    return processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
  }

  // Calculate overall success rate
  calculateOverallSuccessRate() {
    const successRates = Array.from(this.fixers.values()).map(fixer => {
      const total = fixer.successCount + fixer.failureCount;
      return total > 0 ? fixer.successCount / total : 0;
    });
    return successRates.reduce((sum, rate) => sum + rate, 0) / successRates.length;
  }

  // Get fix history
  getFixHistory(limit = 100) {
    return this.fixHistory.slice(-limit);
  }

  // Get rollback stack
  getRollbackStack() {
    return [...this.rollbackStack];
  }

  // Clear rollback stack
  clearRollbackStack() {
    this.rollbackStack = [];
    console.log('[AUTO_FIXER] Rollback stack cleared');
  }

  // Clear fix history
  clearFixHistory() {
    this.fixHistory = [];
    console.log('[AUTO_FIXER] Fix history cleared');
  }

  // Get system state
  getState() {
    return {
      isInitialized: this.isInitialized,
      options: this.options,
      fixers: Array.from(this.fixers.entries()).map(([name, fixer]) => ({
        name,
        ...fixer
      })),
      fixHistory: this.fixHistory,
      rollbackStack: this.rollbackStack,
      stats: this.getStats(),
      enableRollback: this.enableRollback,
      maxRollbackDepth: this.maxRollbackDepth,
      lastUpdated: new Date().toISOString()
    };
  }

  // Destroy auto-fixer
  destroy() {
    this.fixers.clear();
    this.fixHistory = [];
    this.rollbackStack = [];
    
    this.isInitialized = false;
    console.log('[AUTO_FIXER] Auto-fixer destroyed');
  }
}

// Global instance
let autoFixer = null;

// Initialize auto-fixer when DOM is ready
function initializeAutoFixer() {
  if (!autoFixer) {
    autoFixer = new AutoFixer();
  }
  return autoFixer.initialize();
}

// Export for global access
window.autoFixer = autoFixer;

module.exports = {
  AutoFixer,
  initializeAutoFixer
};
