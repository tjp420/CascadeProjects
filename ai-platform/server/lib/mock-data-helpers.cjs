const { calculateFileQuality, contentNeedsValidation } = require('./file-quality-heuristics.cjs');
const constants = require('../config/constants.cjs');

const ALLOWED_EXTENSIONS = constants.MOCK_SCAN_EXTENSIONS;

/**
 * Analyze file content.
 * @param {any} content
 * @param {string} filename
 * @returns {any}
 */
function analyzeFileContent(content, filename) {
  const issues = [];
  const needsConversion = content.includes('mock') || content.includes('sample') || content.includes('demo');
  const needsCleaning = content.includes('duplicate') || content.includes('outdated');
  const needsValidation = contentNeedsValidation(content);

  return {
    type: getMockFileType(filename, content),
    status: needsValidation ? 'needs-validation' : 'clean',
    quality: calculateFileQuality(content),
    needsConversion,
    needsCleaning,
    issues,
    patterns: extractPatterns(content)
  };
}

/**
 * Get mock file type.
 * @param {string} filename
 * @param {any} _content
 * @returns {any}
 */
function getMockFileType(filename, _content) {
  const ext = require('path').extname(filename).toLowerCase();
  if (ext === '.json') return 'json';
  if (ext === '.js' || ext === '.py') return 'code';
  if (ext === '.html') return 'html';
  if (ext === '.csv') return 'csv';
  if (ext === '.xml') return 'xml';
  if (ext === '.txt') return 'text';
  return 'other';
}

/**
 * Calculate quality score.
 * @param {Array} files
 * @param {Array} issues
 * @returns {any}
 */
function calculateQualityScore(files, issues) {
  const totalIssues = issues.length;
  const totalFiles = files.length;
  const cleanFiles = totalFiles - totalIssues;
  return ((cleanFiles / totalFiles) * 100).toFixed(1) + '%';
}

/**
 * Extract patterns.
 * @param {any} content
 * @returns {any}
 */
function extractPatterns(content) {
  const patterns = [];
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.includes('pattern:') || line.includes('template:')) {
      patterns.push(line.trim());
    }
  }
  return patterns;
}

/**
 * Convert file to real format.
 * @param {string} file
 * @returns {any}
 */
function convertFileToRealFormat(file) {
  return {
    originalFile: file.path,
    convertedFile: file.path.replace('.mock.', '.real.'),
    originalSize: file.size,
    convertedSize: file.size * constants.MOCK_CONVERSION_SIZE_FACTOR,
    format: getMockFileType(file.name, ''),
    status: 'converted'
  };
}

/**
 * Clean file content.
 * @param {string} file
 * @returns {any}
 */
function cleanFileContent(file) {
  const issuesFixed = [];
  const optimizedSize = file.size * constants.MOCK_CLEANING_SIZE_FACTOR;

  return {
    originalFile: file.path,
    cleanedFile: file.path.replace('.cleaned.', '.cleaned.'),
    issuesFixed,
    optimization: constants.MOCK_OPTIMIZATION_RATE,
    optimizedSize
  };
}

/**
 * Validate file structure.
 * @param {string} file
 * @returns {any}
 */
function validateFileStructure(file) {
  const tests = [];
  const issues = [];

  if (file.analysis.type === 'json') {
    try {
      JSON.parse(file.content || '{}');
      tests.push('structure_valid');
    } catch (error) {
      issues.push({
        type: 'invalid_json',
        message: error.message,
        severity: 'critical'
      });
    }
  }

  const score = tests.length > 0 ? constants.DEFAULT_RANDOM_MAX : 0;
  const status = issues.length === 0 ? 'passed' : 'failed';

  return {
    file: file.path,
    status,
    tests,
    issues,
    score
  };
}

/**
 * Calculate data size.
 * @param {Array} files
 * @returns {any}
 */
function calculateDataSize(files) {
  return files.reduce((total, file) => total + (file.convertedSize || file.size || 0), 0);
}

/**
 * Calculate optimization.
 * @param {Array} files
 * @returns {any}
 */
function calculateOptimization(files) {
  const totalOptimization = files.reduce((total, file) => total + parseFloat(file.optimization || '0%'), 0);
  return (totalOptimization / files.length).toFixed(1) + '%';
}

/**
 * Count duplicates.
 * @param {Array} files
 * @returns {any}
 */
function countDuplicates(files) {
  const seen = new Set();
  let duplicates = 0;

  for (const file of files) {
    if (seen.has(file.cleanedFile)) {
      duplicates++;
    } else {
      seen.add(file.cleanedFile);
    }
  }

  return duplicates;
}

/**
 * Generate dataset from pattern.
 * @param {any} pattern
 * @returns {any}
 */
function generateDatasetFromPattern(pattern) {
  const fields = pattern.split(',').map(field => field.trim());
  const recordCount = Math.floor(Math.random() * constants.DEFAULT_RANDOM_MAX) + constants.DEFAULT_RECORD_COUNT_BASE;
  const records = [];

  for (let i = 0; i < recordCount; i++) {
    const record = {};
    for (const field of fields) {
      record[field] = generateFieldValue(field);
    }
    records.push(record);
  }

  return {
    name: pattern,
    recordCount,
    fields,
    dataTypes: ['JSON', 'CSV'],
    realismScore: constants.MOCK_REALISM_SCORE,
    filePath: `mock_data_${pattern.replace(/\W+/g, '_')}.json`
  };
}

/**
 * Generate field value.
 * @param {any} field
 * @returns {any}
 */
function generateFieldValue(field) {
  const lowerField = field.toLowerCase();
  if (lowerField.includes('id')) return 'ID_' + Math.random().toString(36).substr(2, 9);
  if (lowerField.includes('name')) return ['John', 'Jane', 'Michael', 'Sarah'][Math.floor(Math.random() * 4)];
  if (lowerField.includes('email')) return 'user@example.com';
  if (lowerField.includes('date')) return new Date().toISOString().split('T')[0];
  if (lowerField.includes('status')) return ['active', 'pending', 'completed'][Math.floor(Math.random() * 3)];
  if (lowerField.includes('price')) return (Math.random() * constants.DEFAULT_RANDOM_MAX).toFixed(2);
  if (lowerField.includes('count')) return Math.floor(Math.random() * constants.DEFAULT_RANDOM_MAX);
  return Math.random().toString(36).substr(2, 9);
}

/**
 * Calculate realism score.
 * @param {Array} datasets
 * @returns {any}
 */
function calculateRealismScore(datasets) {
  const totalScore = datasets.reduce((total, dataset) => total + parseFloat(dataset.realismScore), 0);
  return (totalScore / datasets.length).toFixed(1) + '%';
}

/**
 * Export file.
 * @param {string} file
 * @returns {any}
 */
function exportFile(file) {
  return {
    originalPath: file.path,
    exportedPath: file.path.replace('.json', '.exported.json'),
    originalSize: file.size,
    exportedSize: file.size * constants.MOCK_CONVERSION_SIZE_FACTOR,
    format: 'json',
    checksum: 'hash_' + Math.random().toString(36).substr(2, 9)
  };
}

module.exports = {
  ALLOWED_EXTENSIONS,
  analyzeFileContent,
  getMockFileType,
  calculateQualityScore,
  extractPatterns,
  convertFileToRealFormat,
  cleanFileContent,
  validateFileStructure,
  calculateDataSize,
  calculateOptimization,
  countDuplicates,
  generateDatasetFromPattern,
  generateFieldValue,
  calculateRealismScore,
  exportFile
};
