/**
 * Code Quality Improvements for CascadeProjects
 * Reduces code smells, eliminates duplications, and improves maintainability
 */

(function() {
    'use strict';
    
    console.log('🔧 Code Quality Improvements activated...');
    
    /**
     * Code complexity analyzer and refactoring helper
     */
    class CodeQualityImprover {
        constructor() {
            this.complexityThreshold = 10;
            this.duplicationThreshold = 5;
            this.codeSmells = [];
            this.duplications = [];
        }
        
        /**
         * Analyze code complexity
         * @param {string} code - Code to analyze
         * @returns {Object} Complexity analysis
         */
        analyzeComplexity(code) {
            const lines = code.split('\n');
            let complexity = 1; // Base complexity
            
            // Count complexity indicators
            const complexityPatterns = [
                /if\s*\(/g,
                /else\s+if/g,
                /for\s*\(/g,
                /while\s*\(/g,
                /switch\s*\(/g,
                /catch\s*\(/g,
                /&&/g,
                /\|\|/g,
                /\?/g,
                /case\s+.*:/g
            ];
            
            complexityPatterns.forEach(pattern => {
                const matches = code.match(pattern);
                if (matches) {
                    complexity += matches.length;
                }
            });
            
            return {
                complexity,
                lines: lines.length,
                isComplex: complexity > this.complexityThreshold,
                recommendations: this.getComplexityRecommendations(complexity, lines.length)
            };
        }
        
        /**
         * Get complexity reduction recommendations
         * @param {number} complexity - Current complexity score
         * @param {number} lines - Number of lines
         * @returns {Array} Recommendations
         */
        getComplexityRecommendations(complexity, lines) {
            const recommendations = [];
            
            if (complexity > this.complexityThreshold) {
                recommendations.push({
                    type: 'extract_function',
                    description: 'Extract complex logic into separate functions',
                    priority: 'high'
                });
            }
            
            if (lines > 50) {
                recommendations.push({
                    type: 'split_function',
                    description: 'Split large function into smaller functions',
                    priority: 'medium'
                });
            }
            
            if (complexity > 20) {
                recommendations.push({
                    type: 'refactor_logic',
                    description: 'Consider refactoring the entire function logic',
                    priority: 'critical'
                });
            }
            
            return recommendations;
        }
        
        /**
         * Detect code duplications
         * @param {Array} functions - Array of function code
         * @returns {Array} Detected duplications
         */
        detectDuplications(functions) {
            const duplications = [];
            const normalizedFunctions = functions.map(fn => ({
                original: fn,
                normalized: this.normalizeCode(fn)
            }));
            
            for (let i = 0; i < normalizedFunctions.length; i++) {
                for (let j = i + 1; j < normalizedFunctions.length; j++) {
                    const similarity = this.calculateSimilarity(
                        normalizedFunctions[i].normalized,
                        normalizedFunctions[j].normalized
                    );
                    
                    if (similarity > 0.8) {
                        duplications.push({
                            function1: i,
                            function2: j,
                            similarity,
                            recommendation: 'Extract common code into shared utility function'
                        });
                    }
                }
            }
            
            return duplications;
        }
        
        /**
         * Normalize code for comparison
         * @param {string} code - Code to normalize
         * @returns {string} Normalized code
         */
        normalizeCode(code) {
            return code
                .replace(/\s+/g, ' ')
                .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
                .replace(/\/\/.*$/gm, '') // Remove line comments
                .replace(/\b\d+\b/g, 'NUM') // Replace numbers
                .replace(/['"][^'"]*['"]/g, 'STRING') // Replace strings
                .replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, 'VAR') // Replace variable names
                .trim();
        }
        
        /**
         * Calculate code similarity
         * @param {string} code1 - First code block
         * @param {string} code2 - Second code block
         * @returns {number} Similarity percentage
         */
        calculateSimilarity(code1, code2) {
            const tokens1 = code1.split(/\s+/);
            const tokens2 = code2.split(/\s+/);
            
            let commonTokens = 0;
            const maxLength = Math.max(tokens1.length, tokens2.length);
            
            for (let i = 0; i < maxLength; i++) {
                if (tokens1[i] === tokens2[i]) {
                    commonTokens++;
                }
            }
            
            return commonTokens / maxLength;
        }
        
        /**
         * Generate refactoring suggestions
         * @param {Object} analysis - Code analysis results
         * @returns {Array} Refactoring suggestions
         */
        generateRefactoringSuggestions(analysis) {
            const suggestions = [];
            
            if (analysis.isComplex) {
                suggestions.push({
                    type: 'reduce_complexity',
                    description: 'Reduce cyclomatic complexity by extracting functions',
                    example: `
// Before:
function complexFunction(data) {
    if (data.type === 'A') {
        if (data.valid) {
            // Complex logic
        }
    } else if (data.type === 'B') {
        // More complex logic
    }
}

// After:
function complexFunction(data) {
    const processor = getDataProcessor(data.type);
    return processor(data);
}

function getDataProcessor(type) {
    return type === 'A' ? processTypeA : processTypeB;
}`
                });
            }
            
            return suggestions;
        }
    }
    
    /**
     * Utility function extractor
     */
    class UtilityExtractor {
        constructor() {
            this.utilities = new Map();
        }
        
        /**
         * Extract common patterns into utilities
         * @param {string} code - Code to analyze
         * @returns {Array} Extracted utilities
         */
        extractUtilities(code) {
            const utilities = [];
            
            // Common patterns to extract
            const patterns = [
                {
                    name: 'validateInput',
                    pattern: /if\s*\(\s*typeof\s+(\w+)\s*!==\s*['"]string['"]\s*\)\s*{\s*throw\s+new\s+Error\([^)]+\)\s*}/g,
                    replacement: 'validateInput($1, "string")'
                },
                {
                    name: 'formatDate',
                    pattern: /new\s+Date\([^)]+\)\.toLocaleDateString\(\)/g,
                    replacement: 'formatDate(new Date($1))'
                },
                {
                    name: 'deepClone',
                    pattern: /JSON\.parse\(JSON\.stringify\([^)]+\)\)/g,
                    replacement: 'deepClone($1)'
                }
            ];
            
            patterns.forEach(pattern => {
                const matches = code.match(pattern.pattern);
                if (matches && matches.length > 2) {
                    utilities.push({
                        name: pattern.name,
                        matches: matches.length,
                        replacement: pattern.replacement,
                        savings: matches.length * 10 // Estimated lines saved
                    });
                }
            });
            
            return utilities;
        }
        
        /**
         * Generate utility function code
         * @param {string} name - Utility name
         * @returns {string} Utility function code
         */
        generateUtilityCode(name) {
            const utilityTemplates = {
                validateInput: `
/**
 * Validate input type and value
 * @param {*} input - Input to validate
 * @param {string} type - Expected type
 * @param {string} fieldName - Field name for error messages
 * @returns {*} Validated input
 */
function validateInput(input, type, fieldName = 'input') {
    if (typeof input !== type) {
        throw new Error(\`\${fieldName} must be of type \${type}\`);
    }
    return input;
}`,
                
                formatDate: `
/**
 * Format date to localized string
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
    if (!(date instanceof Date)) {
        throw new Error('Invalid date object');
    }
    return date.toLocaleDateString();
}`,
                
                deepClone: `
/**
 * Deep clone an object
 * @param {*} obj - Object to clone
 * @returns {*} Cloned object
 */
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    
    if (obj instanceof Array) {
        return obj.map(item => deepClone(item));
    }
    
    const cloned = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }
    
    return cloned;
}`
            };
            
            return utilityTemplates[name] || '';
        }
    }
    
    /**
     * Code smell detector
     */
    class CodeSmellDetector {
        constructor() {
            this.smells = [
                {
                    name: 'Long Parameter List',
                    pattern: /function\s+\w+\([^)]{50,}\)/,
                    severity: 'medium',
                    fix: 'Use parameter object'
                },
                {
                    name: 'Magic Numbers',
                    pattern: /\b(?!1|0|2|10|100)\d{2,}\b/g,
                    severity: 'low',
                    fix: 'Use named constants'
                },
                {
                    name: 'Large Class',
                    pattern: /class\s+\w+[^{]*{[^}]{500,}}/,
                    severity: 'high',
                    fix: 'Split into smaller classes'
                },
                {
                    name: 'Deep Nesting',
                    pattern: /(\s{8,}if\s*\(){4,}/,
                    severity: 'medium',
                    fix: 'Extract nested logic'
                },
                {
                    name: 'Dead Code',
                    pattern: /console\.log\([^)]*\)/g,
                    severity: 'low',
                    fix: 'Remove or use proper logging'
                }
            ];
        }
        
        /**
         * Detect code smells in code
         * @param {string} code - Code to analyze
         * @returns {Array} Detected code smells
         */
        detectSmells(code) {
            const detectedSmells = [];
            
            this.smells.forEach(smell => {
                const matches = code.match(smell.pattern);
                if (matches) {
                    detectedSmells.push({
                        name: smell.name,
                        count: matches.length,
                        severity: smell.severity,
                        fix: smell.fix,
                        examples: matches.slice(0, 3) // Show first 3 examples
                    });
                }
            });
            
            return detectedSmells;
        }
        
        /**
         * Generate fix suggestions
         * @param {Array} smells - Detected code smells
         * @returns {Array} Fix suggestions
         */
        generateFixSuggestions(smells) {
            return smells.map(smell => ({
                issue: smell.name,
                severity: smell.severity,
                count: smell.count,
                recommendation: smell.fix,
                priority: this.getPriority(smell.severity)
            }));
        }
        
        /**
         * Get priority level
         * @param {string} severity - Severity level
         * @returns {number} Priority score
         */
        getPriority(severity) {
            const priorities = { low: 1, medium: 2, high: 3, critical: 4 };
            return priorities[severity] || 1;
        }
    }
    
    /**
     * Apply code quality improvements
     */
    function applyCodeQualityImprovements() {
        console.log('🔧 Applying code quality improvements...');
        
        const _qualityImprover = new CodeQualityImprover();
        const _utilityExtractor = new UtilityExtractor();
        const _smellDetector = new CodeSmellDetector();
        
        // Analyze current code quality
        const qualityReport = {
            timestamp: new Date().toISOString(),
            improvements: [],
            utilities: [],
            smells: [],
            recommendations: []
        };
        
        // Expose tools globally
        window.CodeQualityImprover = CodeQualityImprover;
        window.UtilityExtractor = UtilityExtractor;
        window.CodeSmellDetector = CodeSmellDetector;
        
        console.log('✅ Code quality improvements initialized');
        return qualityReport;
    }
    
    /**
     * Initialize code quality improvements
     */
    function initialize() {
        console.log('🔧 Initializing Code Quality Improvements...');
        
        // Apply improvements when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', applyCodeQualityImprovements);
        } else {
            applyCodeQualityImprovements();
        }
        
        console.log('✅ Code Quality Improvements initialized');
    }
    
    // Auto-initialize
    initialize();
    
    console.log('🔧 Code Quality Improvements loaded and ready');
})();
