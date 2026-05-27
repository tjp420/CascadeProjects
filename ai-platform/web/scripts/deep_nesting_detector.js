/**
 * Deep Nesting Detector and Refactoring Tool
 * Identifies and refactors deeply nested code patterns
 */

class DeepNestingDetector {
    constructor() {
        this.nestingThreshold = 4; // Maximum allowed nesting levels
        this.issues = [];
    }

    /**
     * Analyzes JavaScript code for deep nesting patterns
     * @param {string} code - JavaScript code to analyze
     * @returns {Array} Array of nesting issues found
     */
    analyzeCode(code) {
        this.issues = [];
        const lines = code.split('\n');
        
        lines.forEach((line, index) => {
            const nestingLevel = this.calculateNestingLevel(line);
            if (nestingLevel >= this.nestingThreshold) {
                this.issues.push({
                    line: index + 1,
                    content: line.trim(),
                    nestingLevel,
                    type: 'deep_nesting'
                });
            }
        });
        
        return this.issues;
    }

    /**
     * Calculate nesting level of a line based on indentation and if statements
     * @param {string} line - Line of code
     * @returns {number} Nesting level
     */
    calculateNestingLevel(line) {
        const trimmed = line.trim();
        
        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
            return 0;
        }
        
        // Count if/else/for/while/try/catch patterns
        const patterns = [
            /\bif\s*\(/,
            /\belse\s+if\s*\(/,
            /\belse\b/,
            /\bfor\s*\(/,
            /\bwhile\s*\(/,
            /\btry\b/,
            /\bcatch\s*\(/,
            /\bswitch\s*\(/,
            /\bcase\b/,
            /\bfunction\b/,
            /\bclass\b/
        ];
        
        let level = 0;
        patterns.forEach(pattern => {
            if (pattern.test(trimmed)) {
                level++;
            }
        });
        
        // Add indentation level (2 spaces = 1 level)
        const indentation = line.length - line.replace(/^\s+/, '').length;
        level += Math.floor(indentation / 2);
        
        return level;
    }

    /**
     * Refactors deeply nested code using early returns and function extraction
     * @param {string} code - Code to refactor
     * @returns {string} Refactored code
     */
    refactorCode(code) {
        let refactoredCode = code;
        
        // Apply refactoring patterns
        refactoredCode = this.applyEarlyReturns(refactoredCode);
        refactoredCode = this.extractFunctions(refactoredCode);
        refactoredCode = this.simplifyConditionals(refactoredCode);
        
        return refactoredCode;
    }

    /**
     * Apply early return pattern to reduce nesting
     * @param {string} code - Code to refactor
     * @returns {string} Refactored code
     */
    applyEarlyReturns(code) {
        // Replace nested if-else with early returns
        const patterns = [
            {
                // Pattern: if (condition) { if (condition2) { ... } }
                regex: /if\s*\(([^)]+)\)\s*\{\s*if\s*\(([^)]+)\)\s*\{([\s\S]*?)\}\s*\}/g,
                replacement: 'if (!($1)) return;\nif (!($2)) return;\n$3'
            },
            {
                // Pattern: if (condition) { if (condition2) { if (condition3) { ... } } }
                regex: /if\s*\(([^)]+)\)\s*\{\s*if\s*\(([^)]+)\)\s*\{\s*if\s*\(([^)]+)\)\s*\{([\s\S]*?)\}\s*\}\s*\}/g,
                replacement: 'if (!($1)) return;\nif (!($2)) return;\nif (!($3)) return;\n$4'
            }
        ];
        
        let refactored = code;
        patterns.forEach(pattern => {
            refactored = refactored.replace(pattern.regex, pattern.replacement);
        });
        
        return refactored;
    }

    /**
     * Extract nested logic into separate functions
     * @param {string} code - Code to refactor
     * @returns {string} Refactored code
     */
    extractFunctions(code) {
        // Find deeply nested blocks and extract them
        const nestedBlocks = code.match(/if\s*\([^)]+\)\s*\{[\s\S]{1,500}\}/g) || [];
        
        let refactored = code;
        let functionCounter = 1;
        
        nestedBlocks.forEach(block => {
            if (this.calculateNestingLevel(block) >= this.nestingThreshold) {
                const functionName = `extractedFunction${functionCounter++}`;
                const extractedFunction = `function ${functionName}() {\n${this.indentCode(block, 4)}\n}\n\n`;
                
                // Replace the nested block with function call
                const functionCall = `${functionName}();`;
                refactored = refactored.replace(block, functionCall);
                
                // Add the extracted function at the beginning
                refactored = extractedFunction + refactored;
            }
        });
        
        return refactored;
    }

    /**
     * Simplify complex conditional expressions
     * @param {string} code - Code to refactor
     * @returns {string} Refactored code
     */
    simplifyConditionals(code) {
        // Replace complex nested conditionals with guard clauses
        const patterns = [
            {
                // Pattern: if (a && b && c && d)
                regex: /if\s*\(([^&]+)&&\s*([^&]+)&&\s*([^&]+)&&\s*([^)]+)\)/g,
                replacement: 'if (!($1)) return;\nif (!($2)) return;\nif (!($3)) return;\nif (!($4)) return;'
            }
        ];
        
        let refactored = code;
        patterns.forEach(pattern => {
            refactored = refactored.replace(pattern.regex, pattern.replacement);
        });
        
        return refactored;
    }

    /**
     * Indent code by specified number of spaces
     * @param {string} code - Code to indent
     * @param {number} spaces - Number of spaces for indentation
     * @returns {string} Indented code
     */
    indentCode(code, spaces) {
        const lines = code.split('\n');
        const indentation = ' '.repeat(spaces);
        
        return lines.map(line => {
            if (line.trim()) {
                return indentation + line.trim();
            }
            return line;
        }).join('\n');
    }

    /**
     * Generate refactoring report
     * @returns {Object} Refactoring report
     */
    generateReport() {
        return {
            totalIssues: this.issues.length,
            maxNestingLevel: Math.max(...this.issues.map(issue => issue.nestingLevel), 0),
            issues: this.issues,
            recommendations: this.getRecommendations()
        };
    }

    /**
     * Get refactoring recommendations
     * @returns {Array} Array of recommendations
     */
    getRecommendations() {
        const recommendations = [];
        
        if (this.issues.length > 0) {
            recommendations.push({
                type: 'early_returns',
                description: 'Use early returns to reduce nesting levels',
                example: `// Before
if (data) {
    if (data.items) {
        for (let item of data.items) {
            if (item.valid) {
                processItem(item);
            }
        }
    }
}

// After
if (!data || !data.items) return;
data.items.forEach(item => {
    if (item.valid) processItem(item);
});`
            });
            
            recommendations.push({
                type: 'function_extraction',
                description: 'Extract nested logic into separate functions',
                example: `// Before
function processData(data) {
    if (data) {
        if (data.items) {
            data.items.forEach(item => {
                if (item.type === 'A') {
                    if (item.subtype) {
                        processTypeA(item);
                    }
                }
            });
        }
    }
}

// After
function processData(data) {
    if (!data || !data.items) return;
    data.items.forEach(processItem);
}

function processItem(item) {
    if (item.type === 'A') {
        processTypeA(item);
    }
}`
            });
        }
        
        return recommendations;
    }
}

// Example usage
window.DeepNestingDetector = DeepNestingDetector;

// Auto-detect and report nesting issues in current page
// DISABLED: Too many false positives (12,000+) from analyzing inline scripts
// document.addEventListener('DOMContentLoaded', () => {
//     const detector = new DeepNestingDetector();
//     
//     // Analyze all script tags
//     const scripts = document.querySelectorAll('script:not([src])');
//     scripts.forEach(script => {
//         if (script.textContent) {
//             const issues = detector.analyzeCode(script.textContent);
//             if (issues.length > 0) {
//                 console.warn(`Deep nesting issues found in script:`, issues);
//             }
//         }
//     });
// });

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeepNestingDetector;
}
