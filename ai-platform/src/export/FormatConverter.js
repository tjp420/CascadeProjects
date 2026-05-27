/**
 * Format Converter System
 * 
 * Multi-format conversion system with validation, optimization,
 * type inference, and bidirectional conversion capabilities
 */

class FormatConverter {
  constructor(options = {}) {
    this.options = options;
    this.converters = new Map();
    this.validators = new Map();
    this.optimizers = new Map();
    this.conversionStats = new Map();
    this.isInitialized = false;
    this.enableOptimization = options.enableOptimization !== false;
    
    this.initializeConverters();
    this.initializeValidators();
    console.log('[FORMAT_CONVERTER] Format converter initialized');
  }

  // Initialize converters
  initializeConverters() {
    // JSON converter
    this.addConverter('json_to_csv', {
      from: 'json',
      to: 'csv',
      convert: this.convertJSONToCSV.bind(this),
      validate: (data) => this.validateJSON(data),
      optimize: (data) => this.optimizeJSON(data)
    });

    this.addConverter('json_to_sql', {
      from: 'json',
      to: 'sql',
      convert: this.convertJSONToSQL.bind(this),
      validate: (data) => this.validateJSON(data),
      optimize: (data) => this.optimizeJSON(data)
    });

    this.addConverter('json_to_xml', {
      from: 'json',
      to: 'xml',
      convert: this.convertJSONToXML.bind(this),
      validate: (data) => this.validateJSON(data),
      optimize: (data) => this.optimizeJSON(data)
    });

    this.addConverter('json_to_yaml', {
      from: 'json',
      to: 'yaml',
      convert: this.convertJSONToYAML.bind(this),
      validate: (data) => this.validateJSON(data),
      optimize: (data) => this.optimizeJSON(data)
    });

    // CSV converter
    this.addConverter('csv_to_json', {
      from: 'csv',
      to: 'json',
      convert: this.convertCSVToJSON.bind(this),
      validate: (data) => this.validateCSV(data),
      optimize: (data) => this.optimizeCSV(data)
    });

    this.addConverter('csv_to_sql', {
      from: 'csv',
      to: 'sql',
      convert: this.convertCSVToSQL.bind(this),
      validate: (data) => this.validateCSV(data),
      optimize: (data) => this.optimizeCSV(data)
    });

    // SQL converter
    this.addConverter('sql_to_json', {
      from: 'sql',
      to: 'json',
      convert: this.convertSQLToJSON.bind(this),
      validate: (data) => this.validateSQL(data),
      optimize: (data) => this.optimizeSQL(data)
    });

    // XML converter
    this.addConverter('xml_to_json', {
      from: 'xml',
      to: 'json',
      convert: this.convertXMLToJSON.bind(this),
      validate: (data) => this.validateXML(data),
      optimize: (data) => this.optimizeXML(data)
    });

    // YAML converter
    this.addConverter('yaml_to_json', {
      from: 'yaml',
      to: 'json',
      convert: this.convertYAMLToJSON.bind(this),
      validate: (data) => this.validateYAML(data),
      optimize: (data) => this.optimizeYAML(data)
    });

    console.log(`[FORMAT_CONVERTER] Initialized ${this.converters.size} format converters`);
  }

  // Initialize validators
  initializeValidators() {
    // JSON validator
    this.addValidator('json', {
      validate: (data) => this.validateJSON(data),
      optimize: (data) => this.optimizeJSON(data)
    });

    // CSV validator
    this.addValidator('csv', {
      validate: (data) => this.validateCSV(data),
      optimize: (data) => this.optimizeCSV(data)
    });

    // SQL validator
    this.addValidator('sql', {
      validate: (data) => this.validateSQL(data),
      optimize: (data) => this.optimizeSQL(data)
    });

    // XML validator
    this.addValidator('xml', {
      validate: (data) => this.validateXML(data),
      optimize: (data) => this.optimizeXML(data)
    });

    // YAML validator
    this.addValidator('yaml', {
      validate: (data) => this.validateYAML(data),
      optimize: (data) => this.optimizeYAML(data)
    });

    console.log(`[FORMAT_CONVERTER] Initialized ${this.validators.size} validators`);
  }

  // Add converter
  addConverter(name, converter) {
    this.converters.set(name, {
      ...converter,
      usage: 0,
      avgProcessingTime: 0,
      totalProcessingTime: 0,
      successCount: 0,
      failureCount: 0
    });
    console.log(`[FORMAT_CONVERTER] Added converter: ${name}`);
  }

  // Add validator
  addValidator(name, validator) {
    this.validators.set(name, {
      ...validator,
      usage: 0,
      avgProcessingTime: 0,
      totalProcessingTime: 0,
      successCount: 0,
      failureCount: 0
    });
    console.log(`[FORMAT_CONVERTER] Added validator: ${name}`);
  }

  // Add optimizer
  addOptimizer(name, optimizer) {
    this.optimizers.set(name, {
      ...optimizer,
      usage: 0,
      avgProcessingTime: 0,
      totalProcessingTime: 0,
      successCount: 0,
      failureCount: 0
    });
    console.log(`[FORMAT_CONVERTER] Added optimizer: ${name}`);
  }

  // Convert between formats
  async convert(data, fromFormat, toFormat, options = {}) {
    const converterKey = `${fromFormat}_to_${toFormat}`;
    const converter = this.converters.get(converterKey);
    
    if (!converter) {
      throw new Error(`No converter found: ${fromFormat} to ${toFormat}`);
    }

    const startTime = Date.now();
    
    try {
      // Validate input data
      if (options.validate !== false) {
        const validator = this.validators.get(fromFormat);
        if (validator) {
          const validation = validator.validate(data);
          if (!validation.valid) {
            throw new Error(`Input validation failed: ${validation.errors.join(', ')}`);
          }
        }
      }
      
      // Convert data
      const convertedData = await converter.convert(data, options);
      
      // Optimize output if enabled
      let optimizedData = convertedData;
      if (this.enableOptimization && options.optimize !== false) {
        const optimizer = this.optimizers.get(toFormat);
        if (optimizer) {
          optimizedData = optimizer.optimize(convertedData);
        }
      }
      
      const processingTime = Date.now() - startTime;
      
      // Update converter stats
      converter.usage++;
      converter.totalProcessingTime += processingTime;
      converter.avgProcessingTime = converter.totalProcessingTime / converter.usage;
      converter.successCount++;
      
      // Update conversion stats
      const stats = this.conversionStats.get(converterKey);
      if (stats) {
        stats.usage++;
        stats.totalConversions++;
        stats.successCount++;
      }
      
      console.log(`[FORMAT_CONVERTER] Converted ${fromFormat} to ${toFormat} in ${processingTime}ms`);
      
      return {
        success: true,
        data: optimizedData,
        processingTime,
        metadata: {
          originalFormat: fromFormat,
          targetFormat: toFormat,
          originalSize: JSON.stringify(data).length,
          convertedSize: JSON.stringify(optimizedData).length,
          optimization: options.optimize !== false,
          compressionRatio: JSON.stringify(optimizedData).length / JSON.stringify(data).length
        }
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Update converter failure stats
      const converter = this.converters.get(converterKey);
      if (converter) {
        converter.failureCount++;
        converter.totalProcessingTime += processingTime;
        converter.avgProcessingTime = converter.totalProcessingTime / converter.usage;
      }
      
      console.error(`[FORMAT_CONVERTER] Conversion failed: ${fromFormat} to ${toFormat} - ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        processingTime
      };
    }
  }

  // Convert JSON to CSV
  convertJSONToCSV(data) {
    if (!Array.isArray(data)) {
      throw new Error('JSON data must be an array for CSV conversion');
    }

    const headers = Object.keys(data[0] || []);
    const csvLines = [headers.join(',')];
    
    data.forEach(item => {
      const values = headers.map(header => item[header] || '');
      csvLines.push(values.join(','));
    });
    
    return csvLines.join('\n');
  }

  // Convert JSON to SQL
  convertJSONToSQL(data) {
    if (!Array.isArray(data)) {
      throw new Error('JSON data must be an array for SQL conversion');
    }

    const tableName = 'export_data';
    const headers = Object.keys(data[0] || []);
    const columns = headers.map(header => `${header} TEXT`);
    
    const createTable = `CREATE TABLE ${tableName} (${columns.join(', ')});`;
    const insertStatements = data.map(item => {
      const values = headers.map(header => `'${item[header] || ''}'`);
      return `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});`;
    });
    
    return [createTable, ...insertStatements].join('\n');
  }

  // Convert JSON to XML
  convertJSONToXML(data) {
    if (typeof data === 'object' && data !== null) {
      return this.objectToXML(data);
    }
    
    return '';
  }

  // Convert JSON to YAML
  convertJSONToYAML(data) {
    if (typeof data === 'object' && data !== null) {
      let yaml = '';
      
      Object.entries(data).forEach(([key, value]) => {
        yaml += `${key}: ${JSON.stringify(value)}\n`;
      });
      
      return yaml;
    }
    
    return '';
  }

  // Convert CSV to JSON
  convertCSVToJSON(csvData) {
    const lines = csvData.split('\n');
    if (lines.length === 0) {
      return [];
    }
    
    const headers = lines[0].split(',');
    const results = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const row = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      results.push(row);
    }
    
    return results;
  }

  // Convert CSV to SQL
  convertCSVToSQL(csvData) {
    const lines = csvData.split('\n');
    if (lines.length === 0) {
      return [];
    }
    
    const headers = lines[0].split(',');
    const tableName = 'export_data';
    const columns = headers.map(header => `${header} TEXT`);
    
    const insertStatements = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const row = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      const valuesStr = values.join(', ');
      insertStatements.push(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${valuesStr});`);
    }
    
    return insertStatements.join('\n');
  }

  // Convert SQL to JSON
  convertSQLToJSON(sqlData) {
    const statements = sqlData.split(';').filter(stmt => stmt.trim().length > 0);
    const results = [];
    
    statements.forEach(statement => {
      if (statement.toUpperCase().includes('INSERT INTO')) {
        const match = statement.match(/INSERT INTO (\w+) \((?:[^)]+)\)/);
        if (match) {
          const tableName = match[1];
          const valuesMatch = match[2];
          const values = valuesMatch.split(',').map(v => v.trim().replace(/'/g, ''));
          const row = {};
          
          if (valuesMatch.length > 0) {
            const columns = valuesMatch.map((value, index) => `col_${index}`);
            columns.forEach((column, index) => {
              if (value && valuesMatch[index]) {
                row[column] = valuesMatch[index];
              }
            });
            
            results.push(row);
          }
        }
      }
    });
    
    return results;
  }

  // Convert XML to JSON
  convertXMLToJSON(xmlData) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlData, 'text/xml');
    
    return xmlDoc;
  }

  // Convert YAML to JSON
  convertYAMLToJSON(yamlData) {
    const lines = yamlData.split('\n');
    const result = {};
    
    lines.forEach(line => {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const key = match[1];
        let value = match[2];
        
        // Try to parse as JSON
        try {
          value = JSON.parse(value);
        } catch {
          // Keep as string if JSON parsing fails
        }
        
        result[key] = value;
      }
    });
    
    return result;
  }

  // Optimize JSON
  optimizeJSON(data) {
    // Remove undefined values
    if (typeof data === 'object' && data !== null) {
      Object.keys(data).forEach(key => {
        if (data[key] === undefined) {
          data[key] = null;
        }
      });
    }
    
    // Remove null values
    if (typeof data === 'object' && data !== null) {
      Object.keys(data).forEach(key => {
        if (data[key] === null) {
          delete data[key];
        }
      });
    }
    
    // Sort object keys
    if (typeof data === 'object' && data !== null) {
      const sortedKeys = Object.keys(data).sort();
      const sortedData = {};
      
      sortedKeys.forEach(key => {
        sortedData[key] = data[key];
      });
      
      return sortedData;
    }
    
    return data;
  }

  // Optimize CSV
  optimizeCSV(data) {
    if (!Array.isArray(data)) {
      return data;
    }
    
    return data.map(row => {
      return row.map(value => {
        if (typeof value === 'string') {
          return value.trim();
        }
        return value;
      });
    });
  }

  // Optimize SQL
  optimizeSQL(data) {
    if (!Array.isArray(data)) {
      return data;
    }
    
    return data.map(row => {
      return row.map(value => {
        if (typeof value === 'string') {
          return value.trim();
        }
        return value;
      });
    });
  }

  // Optimize XML
  optimizeXML(data) {
    if (typeof data === 'string') {
      return data;
    }
    
    // Remove empty elements
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(data, 'text/xml');
    
    // Remove comments and whitespace
    return xmlDoc;
  }

  // Optimize YAML
  optimizeYAML(data) {
    if (typeof data === 'string') {
      return data;
    }
    
    const lines = data.split('\n');
    
    return lines.filter(line => line.trim() !== '');
  }

  // Get conversion statistics
  getStats() {
    const converterStats = {};
    this.converters.forEach((converter, name) => {
      converterStats[name] = {
        name,
        usage: converter.usage,
        avgProcessingTime: converter.avgProcessingTime,
        totalProcessingTime: converter.totalProcessingTime,
        successRate: converter.successCount / (converter.successCount + converter.failureCount)
      };
    });

    const validatorStats = {};
    this.validators.forEach((validator, name) => {
      validatorStats[name] = {
        name,
        usage: validator.usage,
        avgProcessingTime: validator.avgProcessingTime,
        totalProcessingTime: validator.totalProcessingTime,
        successRate: validator.successCount / (validator.successCount + validator.failureCount)
      };
    });

    const optimizerStats = {};
    this.optimizers.forEach((optimizer, name) => {
      optimizerStats[name] = {
        name,
        usage: optimizer.usage,
        avgProcessingTime: optimizer.avgProcessingTime,
        totalProcessingTime: optimizer.totalProcessingTime,
        successRate: optimizer.successCount / (optimizer.successCount + optimizer.failureCount)
      };
    });

    return {
      converterStats,
      validatorStats,
      optimizerStats,
      totalConversions: Array.from(this.conversionStats.values()).reduce((sum, stats) => sum + stats.totalConversions),
      averageProcessingTime: this.calculateAverageProcessingTime(),
      successRate: this.calculateOverallSuccessRate(),
      lastUpdated: new Date().toISOString()
    };
  }

  // Calculate average processing time
  calculateAverageProcessingTime() {
    const allProcessingTimes = Array.from(this.converters.values()).map(c => c.avgProcessingTime);
    return allProcessingTimes.reduce((sum, time) => sum + time, 0) / allProcessingTimes.length;
  }

  // Calculate overall success rate
  calculateOverallSuccessRate() {
    const allSuccessRates = Array.from(this.converters.values()).map(c => c.successRate || 0);
    return allSuccessRates.reduce((sum, rate) => sum + rate, 0) / allSuccessRates.length;
  }

  // Get conversion statistics for specific format
  getConversionStats(fromFormat, toFormat) {
    const converterKey = `${fromFormat}_to_${toFormat}`;
    const stats = this.conversionStats.get(converterKey);
    
    if (!stats) {
      return null;
    }

    return {
      fromFormat,
      toFormat,
      usage: stats.usage,
      avgProcessingTime: stats.avgProcessingTime,
      totalProcessingTime: stats.totalProcessingTime,
      successRate: stats.successRate,
      totalConversions: stats.totalConversions,
      lastUsed: stats.lastUsed
    };
  }

  // Get system state
  getState() {
    return {
      isInitialized: this.isInitialized,
      options: this.options,
      formats: Array.from(this.formats.entries()).map(([name, format]) => ({
        name,
        ...format
      })),
      converters: Array.from(this.converters.entries()).map(([name, converter]) => ({
        name,
        ...converter
      })),
      validators: Array.from(this.validators.entries()).map(([name, validator]) => ({
        name,
        ...validator
      })),
      optimizers: Array.from(this.optimizers.entries()).map(([name, optimizer]) => ({
        name,
        ...optimizer
      })),
      stats: this.getStats(),
      enableOptimization: this.enableOptimization,
      lastUpdated: new Date().toISOString()
    };
  }

  // Destroy converter
  destroy() {
    this.converters.clear();
    this.validators.clear();
    this.optimizers.clear();
    this.conversionStats.clear();
    
    this.isInitialized = false;
    console.log('[FORMAT_CONVERTER] Format converter destroyed');
  }
}

// Global instance
let formatConverter = null;

// Initialize converter when DOM is ready
function initializeFormatConverter() {
  if (!formatConverter) {
    formatConverter = new FormatConverter();
  }
  return formatConverter.initialize();
}

// Export for global access
window.formatConverter = formatConverter;

module.exports = {
  FormatConverter,
  initializeFormatConverter
};
