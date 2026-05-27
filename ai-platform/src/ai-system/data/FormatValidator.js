/**
 * Multi-Format Validation and Auto-Correction System
 * 
 * Implements format-specific validators for different file types
 * with automatic correction capabilities, syntax checking, and format conversion
 */

const logger = require('../../lib/app-logger');

class FormatValidator {
  constructor(options = {}) {
    this.validators = new Map();
    this.correctors = new Map();
    this.converters = new Map();
    this.strictMode = options.strictMode || false;
    this.autoCorrect = options.autoCorrect !== false;
    this.stats = {
      validationsPerformed: 0,
      correctionsApplied: 0,
      conversionsPerformed: 0,
      errorsFound: 0,
      warningsIssued: 0
    };
    
    this.initializeValidators();
    logger.info('[FORMAT] Format validator initialized');
  }

  // Initialize default validators for different formats
  initializeValidators() {
    // JSON validator
    this.addValidator('json', {
      validate: (content) => this.validateJSON(content),
      correct: (content) => this.correctJSON(content),
      convert: (content, targetFormat) => this.convertJSON(content, targetFormat)
    });

    // CSV validator
    this.addValidator('csv', {
      validate: (content) => this.validateCSV(content),
      correct: (content) => this.correctCSV(content),
      convert: (content, targetFormat) => this.convertCSV(content, targetFormat)
    });

    // XML validator
    this.addValidator('xml', {
      validate: (content) => this.validateXML(content),
      correct: (content) => this.correctXML(content),
      convert: (content, targetFormat) => this.convertXML(content, targetFormat)
    });

    // HTML validator
    this.addValidator('html', {
      validate: (content) => this.validateHTML(content),
      correct: (content) => this.correctHTML(content),
      convert: (content, targetFormat) => this.convertHTML(content, targetFormat)
    });

    // Text validator
    this.addValidator('txt', {
      validate: (content) => this.validateText(content),
      correct: (content) => this.correctText(content),
      convert: (content, targetFormat) => this.convertText(content, targetFormat)
    });

    // JavaScript validator
    this.addValidator('js', {
      validate: (content) => this.validateJavaScript(content),
      correct: (content) => this.correctJavaScript(content),
      convert: (content, targetFormat) => this.convertJavaScript(content, targetFormat)
    });

    logger.debug(`[FORMAT] Initialized ${this.validators.size} format validators`);
  }

  // Add validator for a format
  addValidator(format, validator) {
    this.validators.set(format, validator);
    logger.debug(`[FORMAT] Added validator for format: ${format}`);
  }

  // Validate content based on format
  validate(content, format) {
    this.stats.validationsPerformed++;
    
    const validator = this.validators.get(format);
    if (!validator) {
      throw new Error(`No validator found for format: ${format}`);
    }

    const result = {
      valid: true,
      errors: [],
      warnings: [],
      corrected: false,
      originalContent: content,
      validatedContent: content,
      format,
      timestamp: new Date().toISOString()
    };

    try {
      const validationResult = validator.validate(content);
      
      if (!validationResult.valid) {
        result.errors.push(...validationResult.errors);
        result.valid = false;
        this.stats.errorsFound += validationResult.errors.length;
      }

      if (validationResult.warnings) {
        result.warnings.push(...validationResult.warnings);
        this.stats.warningsIssued += validationResult.warnings.length;
      }

      // Auto-correct if enabled and there are errors
      if (!result.valid && this.autoCorrect && validator.correct) {
        try {
          const correctedContent = validator.correct(content);
          result.corrected = true;
          result.validatedContent = correctedContent;
          
          // Re-validate corrected content
          const revalidation = validator.validate(correctedContent);
          result.valid = revalidation.valid;
          result.errors = revalidation.errors;
          result.warnings = revalidation.warnings || [];
          
          if (result.valid) {
            this.stats.correctionsApplied++;
            logger.debug(`[FORMAT] Auto-corrected ${format} content`);
          }
        } catch (error) {
          result.errors.push({
            type: 'correction_error',
            message: `Auto-correction failed: ${error.message}`,
            line: 0,
            column: 0
          });
        }
      }

    } catch (error) {
      result.errors.push({
        type: 'validation_error',
        message: `Validation failed: ${error.message}`,
        line: 0,
        column: 0
      });
      result.valid = false;
      this.stats.errorsFound++;
    }

    return result;
  }

  // JSON validation
  validateJSON(content) {
    const result = { valid: true, errors: [], warnings: [] };

    try {
      const parsed = JSON.parse(content);
      
      // Check for common JSON issues
      if (content.includes('undefined') || content.includes('NaN')) {
        result.warnings.push({
          type: 'invalid_values',
          message: 'JSON contains undefined or NaN values',
          line: this.findLineNumber(content, 'undefined') || this.findLineNumber(content, 'NaN')
        });
      }

      // Check for empty JSON
      if (Object.keys(parsed).length === 0) {
        result.warnings.push({
          type: 'empty_object',
          message: 'JSON object is empty',
          line: 1
        });
      }

      // Check for deeply nested objects
      const maxDepth = this.calculateDepth(parsed);
      if (maxDepth > 5) {
        result.warnings.push({
          type: 'deep_nesting',
          message: `JSON is deeply nested (depth: ${maxDepth})`,
          line: 1
        });
      }

    } catch (error) {
      result.valid = false;
      result.errors.push({
        type: 'parse_error',
        message: `JSON parse error: ${error.message}`,
        line: this.extractErrorLine(error.message) || 0,
        column: this.extractErrorColumn(error.message) || 0
      });
    }

    return result;
  }

  // JSON correction
  correctJSON(content) {
    let corrected = content;

    // Fix common JSON issues
    corrected = corrected.replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
    corrected = corrected.replace(/'/g, '"'); // Replace single quotes with double quotes
    corrected = corrected.replace(/(\w+):/g, '"$1":'); // Add quotes to unquoted keys
    corrected = corrected.replace(/:\s*undefined/g, ': null'); // Replace undefined with null
    corrected = corrected.replace(/:\s*NaN/g, ': null'); // Replace NaN with null

    // Try to parse to verify correction
    try {
      JSON.parse(corrected);
      return corrected;
    } catch (error) {
      throw new Error(`JSON correction failed: ${error.message}`);
    }
  }

  // JSON conversion
  convertJSON(content, targetFormat) {
    try {
      const parsed = JSON.parse(content);
      
      switch (targetFormat) {
        case 'csv':
          return this.jsonToCSV(parsed);
        case 'xml':
          return this.jsonToXML(parsed);
        case 'txt':
          return this.jsonToText(parsed);
        default:
          throw new Error(`Conversion from JSON to ${targetFormat} not supported`);
      }
    } catch (error) {
      throw new Error(`JSON conversion failed: ${error.message}`);
    }
  }

  // CSV validation
  validateCSV(content) {
    const result = { valid: true, errors: [], warnings: [] };
    
    try {
      const lines = content.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        result.errors.push({
          type: 'empty_file',
          message: 'CSV file is empty',
          line: 0
        });
        result.valid = false;
        return result;
      }

      // Check for consistent column count
      const columnCounts = lines.map(line => line.split(',').length);
      const uniqueCounts = [...new Set(columnCounts)];
      
      if (uniqueCounts.length > 1) {
        result.errors.push({
          type: 'inconsistent_columns',
          message: `Inconsistent column counts: ${uniqueCounts.join(', ')}`,
          line: this.findInconsistentLine(lines, columnCounts)
        });
        result.valid = false;
      }

      // Check for empty lines
      const emptyLines = lines.filter((line, index) => !line.trim()).length;
      if (emptyLines > 0) {
        result.warnings.push({
          type: 'empty_lines',
          message: `${emptyLines} empty lines found`,
          line: 0
        });
      }

      // Check for quoted fields
      const quotedFields = content.match(/"[^"]*"/g);
      if (quotedFields && quotedFields.length > 0) {
        const unescapedQuotes = quotedFields.filter(field => field.includes('""'));
        if (unescapedQuotes.length > 0) {
          result.warnings.push({
            type: 'escaped_quotes',
            message: `${unescapedQuotes.length} fields with escaped quotes found`,
            line: 0
          });
        }
      }

    } catch (error) {
      result.errors.push({
        type: 'parse_error',
        message: `CSV parsing error: ${error.message}`,
        line: 0
      });
      result.valid = false;
    }

    return result;
  }

  // CSV correction
  correctCSV(content) {
    let corrected = content;

    // Fix inconsistent column counts
    const lines = corrected.split('\n');
    const maxColumns = Math.max(...lines.map(line => line.split(',').length));
    
    corrected = lines.map(line => {
      const columns = line.split(',');
      while (columns.length < maxColumns) {
        columns.push('');
      }
      return columns.join(',');
    }).join('\n');

    // Remove empty lines
    corrected = corrected.split('\n').filter(line => line.trim()).join('\n');

    return corrected;
  }

  // CSV conversion
  convertCSV(content, targetFormat) {
    try {
      const parsed = this.parseCSV(content);
      
      switch (targetFormat) {
        case 'json':
          return this.csvToJSON(parsed);
        case 'xml':
          return this.csvToXML(parsed);
        case 'txt':
          return this.csvToText(parsed);
        default:
          throw new Error(`Conversion from CSV to ${targetFormat} not supported`);
      }
    } catch (error) {
      throw new Error(`CSV conversion failed: ${error.message}`);
    }
  }

  // XML validation
  validateXML(content) {
    const result = { valid: true, errors: [], warnings: [] };

    try {
      // Basic XML structure checks
      if (!content.trim().startsWith('<')) {
        result.errors.push({
          type: 'invalid_start',
          message: 'XML must start with an opening tag',
          line: 1
        });
        result.valid = false;
        return result;
      }

      // Check for matching tags
      const openTags = (content.match(/<[^\/][^>]*>/g) || []).map(tag => tag.replace(/[<>]/g, ''));
      const closeTags = (content.match(/<\/[^>]*>/g) || []).map(tag => tag.replace(/[<\/>]/g, ''));
      
      const unmatchedOpen = openTags.filter(tag => !closeTags.includes(tag));
      const unmatchedClose = closeTags.filter(tag => !openTags.includes(tag));

      if (unmatchedOpen.length > 0) {
        result.errors.push({
          type: 'unmatched_tags',
          message: `Unmatched opening tags: ${unmatchedOpen.join(', ')}`,
          line: this.findTagLine(content, unmatchedOpen[0])
        });
        result.valid = false;
      }

      if (unmatchedClose.length > 0) {
        result.errors.push({
          type: 'unmatched_tags',
          message: `Unmatched closing tags: ${unmatchedClose.join(', ')}`,
          line: this.findTagLine(content, unmatchedClose[0])
        });
        result.valid = false;
      }

      // Check for XML declaration
      if (!content.includes('<?xml')) {
        result.warnings.push({
          type: 'missing_declaration',
          message: 'XML declaration missing',
          line: 1
        });
      }

    } catch (error) {
      result.errors.push({
        type: 'parse_error',
        message: `XML parsing error: ${error.message}`,
        line: 0
      });
      result.valid = false;
    }

    return result;
  }

  // XML correction
  correctXML(content) {
    let corrected = content;

    // Add XML declaration if missing
    if (!corrected.includes('<?xml')) {
      corrected = '<?xml version="1.0" encoding="UTF-8"?>\n' + corrected;
    }

    // Basic tag matching (simplified)
    const openTags = (corrected.match(/<[^\/][^>]*>/g) || []);
    const closeTags = (corrected.match(/<\/[^>]*>/g) || []);

    openTags.forEach(openTag => {
      const tagName = openTag.replace(/[<>]/g, '').split(' ')[0];
      const closeTag = `</${tagName}>`;
      
      if (!closeTags.includes(closeTag)) {
        // Add missing closing tag
        corrected = corrected + `\n${closeTag}`;
      }
    });

    return corrected;
  }

  // XML conversion
  convertXML(content, targetFormat) {
    try {
      const parsed = this.parseXML(content);
      
      switch (targetFormat) {
        case 'json':
          return this.xmlToJSON(parsed);
        case 'csv':
          return this.xmlToCSV(parsed);
        case 'txt':
          return this.xmlToText(parsed);
        default:
          throw new Error(`Conversion from XML to ${targetFormat} not supported`);
      }
    } catch (error) {
      throw new Error(`XML conversion failed: ${error.message}`);
    }
  }

  // HTML validation
  validateHTML(content) {
    const result = { valid: true, errors: [], warnings: [] };

    try {
      // Basic HTML structure checks
      if (!content.includes('<html')) {
        result.warnings.push({
          type: 'missing_html_tag',
          message: 'HTML tag missing',
          line: 1
        });
      }

      if (!content.includes('<head>')) {
        result.warnings.push({
          type: 'missing_head_tag',
          message: 'HEAD tag missing',
          line: 1
        });
      }

      if (!content.includes('<body>')) {
        result.warnings.push({
          type: 'missing_body_tag',
          message: 'BODY tag missing',
          line: 1
        });
      }

      // Check for unclosed tags
      const selfClosingTags = ['img', 'br', 'hr', 'input', 'meta', 'link'];
      const allTags = content.match(/<[^>]*>/g) || [];
      
      allTags.forEach(tag => {
        const tagName = tag.replace(/[<>]/g, '').split(' ')[0];
        
        if (!tag.includes('/') && !selfClosingTags.includes(tagName.toLowerCase())) {
          const closingTag = `</${tagName}>`;
          const tagCount = (content.match(new RegExp(`<${tagName}[^>]*>`, 'g')) || []).length;
          const closingCount = (content.match(new RegExp(closingTag, 'g')) || []).length;
          
          if (tagCount !== closingCount) {
            result.warnings.push({
              type: 'unclosed_tag',
              message: `Tag ${tagName} may not be properly closed`,
              line: this.findTagLine(content, tagName)
            });
          }
        }
      });

    } catch (error) {
      result.errors.push({
        type: 'parse_error',
        message: `HTML parsing error: ${error.message}`,
        line: 0
      });
      result.valid = false;
    }

    return result;
  }

  // HTML correction
  correctHTML(content) {
    let corrected = content;

    // Add basic HTML structure if missing
    if (!corrected.includes('<html')) {
      corrected = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Generated Document</title>
</head>
<body>
${corrected}
</body>
</html>`;
    }

    return corrected;
  }

  // HTML conversion
  convertHTML(content, targetFormat) {
    try {
      const parsed = this.parseHTML(content);
      
      switch (targetFormat) {
        case 'txt':
          return this.htmlToText(parsed);
        case 'json':
          return this.htmlToJSON(parsed);
        default:
          throw new Error(`Conversion from HTML to ${targetFormat} not supported`);
      }
    } catch (error) {
      throw new Error(`HTML conversion failed: ${error.message}`);
    }
  }

  // Text validation
  validateText(content) {
    const result = { valid: true, errors: [], warnings: [] };

    if (content.length === 0) {
      result.errors.push({
        type: 'empty_file',
        message: 'Text file is empty',
        line: 0
      });
      result.valid = false;
      return result;
    }

    // Check for encoding issues
    if (content.includes('')) {
      result.warnings.push({
        type: 'encoding_issue',
        message: 'Possible encoding issues detected',
        line: this.findLineNumber(content, '')
      });
    }

    // Check for very long lines
    const lines = content.split('\n');
    const longLines = lines.filter(line => line.length > 1000);
    
    if (longLines.length > 0) {
      result.warnings.push({
        type: 'long_lines',
        message: `${longLines.length} lines longer than 1000 characters`,
        line: 0
      });
    }

    return result;
  }

  // Text correction
  correctText(content) {
    let corrected = content;

    // Remove multiple consecutive empty lines
    corrected = corrected.replace(/\n\s*\n\s*\n/g, '\n\n');

    // Trim whitespace at end of lines
    corrected = corrected.split('\n').map(line => line.trimEnd()).join('\n');

    return corrected;
  }

  // Text conversion
  convertText(content, targetFormat) {
    try {
      switch (targetFormat) {
        case 'json':
          return this.textToJSON(content);
        case 'csv':
          return this.textToCSV(content);
        case 'xml':
          return this.textToXML(content);
        default:
          throw new Error(`Conversion from text to ${targetFormat} not supported`);
      }
    } catch (error) {
      throw new Error(`Text conversion failed: ${error.message}`);
    }
  }

  // JavaScript validation
  validateJavaScript(content) {
    const result = { valid: true, errors: [], warnings: [] };

    try {
      // Basic syntax checks
      if (content.includes('=>') && !content.includes('const') && !content.includes('let')) {
        result.warnings.push({
          type: 'arrow_function_context',
          message: 'Arrow function without proper context',
          line: this.findLineNumber(content, '=>')
        });
      }

      // Check for console.log statements
      const consoleLogs = content.match(/console\.log/g);
      if (consoleLogs && consoleLogs.length > 0) {
        result.warnings.push({
          type: 'console_statements',
          message: `${consoleLogs.length} console.log statements found`,
          line: 0
        });
      }

      // Check for use of var
      const varDeclarations = content.match(/\bvar\s+/g);
      if (varDeclarations && varDeclarations.length > 0) {
        result.warnings.push({
          type: 'var_usage',
          message: `${varDeclarations.length} var declarations found (prefer const/let)`,
          line: 0
        });
      }

      // Check for missing semicolons (basic check)
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.endsWith(';') && !trimmed.endsWith('{') && !trimmed.endsWith('}') && 
            !trimmed.includes('if') && !trimmed.includes('for') && !trimmed.includes('while') && 
            !trimmed.includes('function') && !trimmed.includes('=>')) {
          result.warnings.push({
            type: 'missing_semicolon',
            message: 'Possible missing semicolon',
            line: index + 1
          });
        }
      });

    } catch (error) {
      result.errors.push({
        type: 'parse_error',
        message: `JavaScript parsing error: ${error.message}`,
        line: 0
      });
      result.valid = false;
    }

    return result;
  }

  // JavaScript correction
  correctJavaScript(content) {
    let corrected = content;

    // Replace var with const (basic replacement)
    corrected = corrected.replace(/\bvar\s+/g, 'const ');

    // Add missing semicolons (basic addition)
    const lines = corrected.split('\n');
    const correctedLines = lines.map(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.endsWith(';') && !trimmed.endsWith('{') && !trimmed.endsWith('}') &&
          !trimmed.includes('if') && !trimmed.includes('for') && !trimmed.includes('while') &&
          !trimmed.includes('function') && !trimmed.includes('=>')) {
        return line + ';';
      }
      return line;
    });

    return correctedLines.join('\n');
  }

  // JavaScript conversion
  convertJavaScript(content, targetFormat) {
    try {
      switch (targetFormat) {
        case 'txt':
          return this.javaScriptToText(content);
        default:
          throw new Error(`Conversion from JavaScript to ${targetFormat} not supported`);
      }
    } catch (error) {
      throw new Error(`JavaScript conversion failed: ${error.message}`);
    }
  }

  // Helper methods for conversion
  jsonToCSV(data) {
    if (!Array.isArray(data)) {
      throw new Error('JSON must be an array for CSV conversion');
    }

    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    data.forEach(item => {
      const row = headers.map(header => {
        const value = item[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  jsonToXML(data) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';
    
    if (Array.isArray(data)) {
      data.forEach(item => {
        xml += this.objectToXML(item, 'item');
      });
    } else {
      xml += this.objectToXML(data, 'data');
    }
    
    xml += '</root>';
    return xml;
  }

  jsonToText(data) {
    return JSON.stringify(data, null, 2);
  }

  csvToJSON(data) {
    const [headers, ...rows] = data;
    const jsonArray = rows.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });
    
    return JSON.stringify(jsonArray, null, 2);
  }

  csvToXML(data) {
    const jsonData = this.csvToJSON(data);
    return this.jsonToXML(JSON.parse(jsonData));
  }

  csvToText(data) {
    return data.join('\n');
  }

  // Helper methods
  parseCSV(content) {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      return obj;
    });
  }

  parseXML(content) {
    // Simplified XML parsing
    const result = {};
    const tagMatches = content.match(/<(\w+)>(.*?)<\/\1>/g);
    
    if (tagMatches) {
      tagMatches.forEach(match => {
        const tagMatch = match.match(/<(\w+)>(.*?)<\/\1>/);
        if (tagMatch) {
          result[tagMatch[1]] = tagMatch[2];
        }
      });
    }
    
    return result;
  }

  parseHTML(content) {
    // Extract text content from HTML
    return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  objectToXML(obj, tagName) {
    let xml = `<${tagName}>\n`;
    
    Object.entries(obj).forEach(([key, value]) => {
      xml += `  <${key}>${value}</${key}>\n`;
    });
    
    xml += `</${tagName}>\n`;
    return xml;
  }

  htmlToText(html) {
    return this.parseHTML(html);
  }

  htmlToJSON(html) {
    const text = this.parseHTML(html);
    return JSON.stringify({ content: text }, null, 2);
  }

  textToJSON(text) {
    return JSON.stringify({ content: text }, null, 2);
  }

  textToCSV(text) {
    return `content\n"${text.replace(/"/g, '""')}"`;
  }

  textToXML(text) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<root>\n  <content>${text}</content>\n</root>`;
  }

  javaScriptToText(js) {
    return js;
  }

  // Utility methods
  findLineNumber(content, searchText) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(searchText)) {
        return i + 1;
      }
    }
    return 0;
  }

  findTagLine(content, tagName) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(tagName)) {
        return i + 1;
      }
    }
    return 0;
  }

  findInconsistentLine(lines, columnCounts) {
    const firstCount = columnCounts[0];
    for (let i = 1; i < columnCounts.length; i++) {
      if (columnCounts[i] !== firstCount) {
        return i + 1;
      }
    }
    return 0;
  }

  extractErrorLine(errorMessage) {
    const match = errorMessage.match(/line (\d+)/i);
    return match ? parseInt(match[1]) : 0;
  }

  extractErrorColumn(errorMessage) {
    const match = errorMessage.match(/column (\d+)/i);
    return match ? parseInt(match[1]) : 0;
  }

  calculateDepth(obj, currentDepth = 0) {
    if (typeof obj !== 'object' || obj === null) {
      return currentDepth;
    }

    let maxDepth = currentDepth;
    
    Object.values(obj).forEach(value => {
      if (typeof value === 'object' && value !== null) {
        const depth = this.calculateDepth(value, currentDepth + 1);
        maxDepth = Math.max(maxDepth, depth);
      }
    });

    return maxDepth;
  }

  // Get statistics
  getStats() {
    return {
      ...this.stats,
      validatorsLoaded: this.validators.size,
      autoCorrectEnabled: this.autoCorrect,
      strictModeEnabled: this.strictMode
    };
  }

  // Reset statistics
  resetStats() {
    this.stats = {
      validationsPerformed: 0,
      correctionsApplied: 0,
      conversionsPerformed: 0,
      errorsFound: 0,
      warningsIssued: 0
    };
  }
}

module.exports = FormatValidator;
