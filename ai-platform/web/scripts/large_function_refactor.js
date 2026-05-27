/**
 * Large Function Refactoring Tool
 * Identifies and refactors large functions that violate Single Responsibility Principle
 */

// Prevent redeclaration if already loaded
if (typeof LargeFunctionRefactor === 'undefined') {
    class LargeFunctionRefactor {
        constructor() {
            this.maxLines = 50; // Maximum lines per function
            this.maxComplexity = 10; // Maximum cyclomatic complexity
            this.maxParameters = 5; // Maximum parameters per function
            this.issues = [];
        }

        /**
     * Analyzes functions for size and complexity issues
     * @param {string} code - JavaScript code to analyze
     * @returns {Array} Array of function issues
     */
        analyzeFunctions(code) {
            this.issues = [];
            const functions = this.extractFunctions(code);
        
            functions.forEach(func => {
                const analysis = this.analyzeFunction(func);
                if (analysis.hasIssues) {
                    this.issues.push(analysis);
                }
            });
        
            return this.issues;
        }

        /**
     * Extracts function definitions from code
     * @param {string} code - JavaScript code
     * @returns {Array} Array of function objects
     */
        extractFunctions(code) {
            const functions = [];
        
            // Match function declarations and expressions
            const functionRegex = /(?:function\s+(\w+)\s*\([^)]*\)\s*\{|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function\s*\([^)]*\)\s*\{|(?:const|let|var)\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>\s*\{)/g;
        
            let match;
            while ((match = functionRegex./* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: exec(code)) !== null) {
                const name = match[1] || match[2] || match[3] || 'anonymous';
                const startIndex = match.index;
                const functionBody = this.extractFunctionBody(code, startIndex);
            
                functions.push({
                    name,
                    body: functionBody,
                    startIndex
                });
            }
        
            return functions;
        }

        /**
     * Extracts the complete function body including nested braces
     * @param {string} code - Full code
     * @param {number} startIndex - Start index of function
     * @returns {string} Function body
     */
        extractFunctionBody(code, startIndex) {
            let braceCount = 0;
            let inFunction = false;
            let endIndex = startIndex;
        
            for (let i = startIndex; i < code.length; i++) {
                const char = code[i];
            
                if (char === '{') {
                    if (!inFunction) {
                        inFunction = true;
                    }
                    braceCount++;
                } else if (char === '}') {
                    braceCount--;
                    if (braceCount === 0 && inFunction) {
                        endIndex = i + 1;
                        break;
                    }
                }
            }
        
            return code.substring(startIndex, endIndex);
        }

        /**
     * Analyzes a single function for issues
     * @param {Object} func - Function object
     * @returns {Object} Analysis result
     */
        analyzeFunction(func) {
            const lines = func.body.split('\n');
            const lineCount = lines.length;
            const complexity = this.calculateComplexity(func.body);
            const parameterCount = this.countParameters(func.body);
            const returnCount = this.countReturnStatements(func.body);
        
            const hasIssues = lineCount > this.maxLines || 
                         complexity > this.maxComplexity || 
                         parameterCount > this.maxParameters;
        
            return {
                name: func.name,
                lineCount,
                complexity,
                parameterCount,
                returnCount,
                hasIssues,
                issues: this.identifyIssues(lineCount, complexity, parameterCount)
            };
        }

        /**
     * Calculates cyclomatic complexity
     * @param {string} code - Function code
     * @returns {number} Complexity score
     */
        calculateComplexity(code) {
            const complexityPatterns = [
                /\bif\b/g,
                /\belse\s+if\b/g,
                /\belse\b/g,
                /\bfor\b/g,
                /\bwhile\b/g,
                /\bdo\b/g,
                /\bswitch\b/g,
                /\bcase\b/g,
                /\bcatch\b/g,
                /\b&&/g,
                /\b\|\|/g,
                /\?/g
            ];
        
            let complexity = 1; // Base complexity
        
            complexityPatterns.forEach(pattern => {
                const matches = code.match(pattern);
                if (matches) {
                    complexity += matches.length;
                }
            });
        
            return complexity;
        }

        /**
     * Counts function parameters
     * @param {string} code - Function code
     * @returns {number} Parameter count
     */
        countParameters(code) {
            const paramMatch = code.match(/\(([^)]*)\)/);
            if (!paramMatch) {
                return 0;
            }
        
            const params = paramMatch[1].split(',').filter(param => param.trim());
            return params.length;
        }

        /**
     * Counts return statements
     * @param {string} code - Function code
     * @returns {number} Return statement count
     */
        countReturnStatements(code) {
            const returnMatches = code.match(/\breturn\b/g);
            return returnMatches ? returnMatches.length : 0;
        }

        /**
     * Identifies specific issues with a function
     * @param {number} lineCount - Number of lines
     * @param {number} complexity - Complexity score
     * @param {number} parameterCount - Parameter count
     * @returns {Array} Array of issue descriptions
     */
        identifyIssues(lineCount, complexity, parameterCount) {
            const issues = [];
        
            if (lineCount > this.maxLines) {
                issues.push(`Too many lines: ${lineCount} (max: ${this.maxLines})`);
            }
        
            if (complexity > this.maxComplexity) {
                issues.push(`High complexity: ${complexity} (max: ${this.maxComplexity})`);
            }
        
            if (parameterCount > this.maxParameters) {
                issues.push(`Too many parameters: ${parameterCount} (max: ${this.maxParameters})`);
            }
        
            return issues;
        }

        /**
     * Refactors a large function into smaller functions
     * @param {string} code - Function code to refactor
     * @returns {string} Refactored code
     */
        refactorFunction(code) {
            let refactored = code;
        
            // Apply refactoring patterns
            refactored = this.extractValidationLogic(refactored);
            refactored = this.extractProcessingLogic(refactored);
            refactored = this.extractErrorHandling(refactored);
            refactored = this.extractLogging(refactored);
        
            return refactored;
        }

        /**
     * Extracts validation logic into separate function
     * @param {string} code - Code to refactor
     * @returns {string} Refactored code
     */
        extractValidationLogic(code) {
        // Find validation patterns
            const validationPattern = /(?:if\s*\([^)]+\)\s*\{\s*(?:throw|return)\s*[^;]+;?\s*\})+/g;
        
            const validations = code.match(validationPattern) || [];
            let refactored = code;
            let validationCounter = 1;
        
            validations.forEach(validation => {
                const functionName = `validateInput${validationCounter++}`;
                const extractedFunction = `function ${functionName}() {\n${this.indentCode(validation, 4)}\n}\n\n`;
            
                // Replace validation with function call
                const functionCall = `${functionName}();\n    if (!isValid) return;`;
                refactored = refactored.replace(validation, functionCall);
            
                // Add extracted function at the beginning
                refactored = extractedFunction + refactored;
            });
        
            return refactored;
        }

        /**
     * Extracts processing logic into separate function
     * @param {string} code - Code to refactor
     * @returns {string} Refactored code
     */
        extractProcessingLogic(code) {
        // Find main processing logic (assignments, calculations)
            const processingPattern = /(?:const|let|var)\s+\w+\s*=\s*[^;]+;[\s\S]*?return\s+[^;]+;/g;
        
            const processing = code.match(processingPattern) || [];
            let refactored = code;
            let processingCounter = 1;
        
            processing.forEach(proc => {
                if (proc.split('\n').length > 10) { // Only extract large blocks
                    const functionName = `processData${processingCounter++}`;
                    const extractedFunction = `function ${functionName}() {\n${this.indentCode(proc, 4)}\n}\n\n`;
                
                    // Replace processing with function call
                    const functionCall = `return ${functionName}();`;
                    refactored = refactored.replace(proc, functionCall);
                
                    // Add extracted function at the beginning
                    refactored = extractedFunction + refactored;
                }
            });
        
            return refactored;
        }

        /**
     * Extracts error handling into separate function
     * @param {string} code - Code to refactor
     * @returns {string} Refactored code
     */
        extractErrorHandling(code) {
        // Find try-catch blocks
            const tryCatchPattern = /try\s*\{[\s\S]*?\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\}/g;
        
            const tryCatchBlocks = code.match(tryCatchPattern) || [];
            let refactored = code;
            let errorCounter = 1;
        
            tryCatchBlocks.forEach(tryCatch => {
                const functionName = `handleError${errorCounter++}`;
                const extractedFunction = `function ${functionName}(error) {\n${this.indentCode(tryCatch.replace(/try\s*\{[\s\S]*?\}\s*catch\s*\(/, ''), 4)}\n}\n\n`;
            
                // Replace try-catch with simpler error handling
                const simpleTry = `try {\n        // Main logic\n    } catch (error) {\n        ${functionName}(error);\n    }`;
                refactored = refactored.replace(tryCatch, simpleTry);
            
                // Add extracted function
                refactored = extractedFunction + refactored;
            });
        
            return refactored;
        }

        /**
     * Extracts logging logic into separate function
     * @param {string} code - Code to refactor
     * @returns {string} Refactored code
     */
        extractLogging(code) {
        // Find console.log statements
            const loggingPattern = /console\.(log|warn|error|info)\([^)]+\);?/g;
        
            const logs = code.match(loggingPattern) || [];
            let refactored = code;
        
            if (logs.length > 3) { // Only extract if there are many logs
                const logStatements = logs.join('\n        ');
                const extractedFunction = `function logActivity() {\n        ${logStatements}\n    }\n\n`;
            
                // Remove individual log statements
                logs.forEach(log => {
                    refactored = refactored.replace(log, '');
                });
            
                // Add function call at appropriate places
                refactored = refactored.replace(/function\s+(\w+)\s*\(/, `function logActivity() {\n        ${logStatements}\n    }\n\n    function $1(`);
            }
        
            return refactored;
        }

        /**
     * Indents code by specified number of spaces
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
     * Generates refactoring report
     * @returns {Object} Refactoring report
     */
        generateReport() {
            return {
                totalIssues: this.issues.length,
                functions: this.issues.map(issue => ({
                    name: issue.name,
                    lineCount: issue.lineCount,
                    complexity: issue.complexity,
                    parameterCount: issue.parameterCount,
                    issues: issue.issues,
                    recommendations: this.getRecommendations(issue)
                }))
            };
        }

        /**
     * Get refactoring recommendations for a function
     * @param {Object} issue - Function analysis
     * @returns {Array} Array of recommendations
     */
        getRecommendations(issue) {
            const recommendations = [];
        
            if (issue.lineCount > this.maxLines) {
                recommendations.push({
                    type: 'extract_functions',
                    description: 'Extract logical blocks into separate functions',
                    example: `// Before
function processRequest(data, options, config, user, permissions, context) {
    // 247 lines of code...
}

// After
function processRequest(data, options, config) {
    const validatedData = validateInput(data);
    const processedData = processData(validatedData);
    const result = applyBusinessRules(processedData, config);
    return generateResponse(result);
}`
                });
            }
        
            if (issue.complexity > this.maxComplexity) {
                recommendations.push({
                    type: 'reduce_complexity',
                    description: 'Reduce cyclomatic complexity using early returns',
                    example: `// Before (high complexity)
if (data) {
    if (data.items) {
        if (data.items.length > 0) {
            if (data.items[0].valid) {
                // Process data
            }
        }
    }
}

// After (low complexity)
if (!data) return;
if (!data.items) return;
if (data.items.length === 0) return;
if (!data.items[0].valid) return;
// Process data`
                });
            }
        
            if (issue.parameterCount > this.maxParameters) {
                recommendations.push({
                    type: 'parameter_object',
                    description: 'Use parameter objects instead of multiple parameters',
                    example: `// Before
function processRequest(data, options, config, user, permissions, context, callback) {
    // Function body
}

// After
function processRequest({ data, options, config, user, permissions, context, callback }) {
    // Function body
}`
                });
            }
        
            return recommendations;
        }
    }

    // Example large function refactoring
    class ExampleRefactoring {
    // BEFORE: Large function (247 lines, high complexity)
        problematicProcessRequest(data, options, config, user, permissions, context, callback) {
        // Validation logic (35 lines)
            if (!data) {
                throw new Error('Data is required');
            }
            if (!options) {
                throw new Error('Options are required');
            }
            if (!config) {
                throw new Error('Config is required');
            }
            if (!user) {
                throw new Error('User is required');
            }
            if (!permissions) {
                throw new Error('Permissions are required');
            }
            // ... more validation

            // Data processing (40 lines)
            const processedData = {
                ...data,
                processed: true,
                timestamp: new Date(),
                user: user.id,
                options: options.filter(opt => opt.active)
            };
        
            // Business rules (45 lines)
            if (user.role === 'admin') {
                processedData.adminAccess = true;
            }
            if (permissions.includes('write')) {
                processedData.canWrite = true;
            }
            // ... more business logic

            // Response generation (30 lines)
            const response = {
                success: true,
                data: processedData,
                message: 'Request processed successfully',
                timestamp: new Date()
            };

            // Error handling (25 lines)
            try {
            // Main logic
            } catch (error) {
                console.error('Error processing request:', error);
                response.success = false;
                response.message = 'Error processing request';
            }

            // Logging (20 lines)
            console.log('Request started:', { data, options, config });
            console.log('User:', user);
            console.log('Permissions:', permissions);
            console.log('Response:', response);

            return response;
        }

        // AFTER: Refactored into small, focused functions
        refactoredProcessRequest(data, options, config, user, permissions, context, callback) {
            const validatedData = this.validateInput({ data, options, config, user, permissions, context, callback });
            const processedData = this.processData(validatedData);
            const result = this.applyBusinessRules(processedData, user, permissions);
            const response = this.generateResponse(result);
            this.logActivity('request_completed', { user, response });
            return response;
        }

        validateInput({ data, options, config, user, permissions, context, callback }) {
            const required = ['data', 'options', 'config', 'user', 'permissions'];
            const missing = required.filter(field => !this[field]);
        
            if (missing.length > 0) {
                throw new Error(`Missing required fields: ${missing.join(', ')}`);
            }
        
            return { data, options, config, user, permissions, context, callback };
        }

        processData(validatedData) {
            const { data, options, config, user } = validatedData;
        
            return {
                ...data,
                processed: true,
                timestamp: new Date(),
                user: user.id,
                options: options.filter(opt => opt.active)
            };
        }

        applyBusinessRules(processedData, user, permissions) {
            const result = { ...processedData };
        
            if (user.role === 'admin') {
                result.adminAccess = true;
            }
        
            if (permissions.includes('write')) {
                result.canWrite = true;
            }
        
            return result;
        }

        generateResponse(result) {
            return {
                success: true,
                data: result,
                message: 'Request processed successfully',
                timestamp: new Date()
            };
        }

        logActivity(action, data) {
            console.log(`Activity: ${action}`, data);
        }
    }

    // Global instances
    window.LargeFunctionRefactor = LargeFunctionRefactor;
    window.ExampleRefactoring = ExampleRefactoring;

    // Auto-analyze functions on page load
    // DISABLED: Too many false positives from analyzing inline scripts
    // document.addEventListener('DOMContentLoaded', () => {
    //     const refactor = new LargeFunctionRefactor();
    //     
    //     // Analyze all script tags
    //     const scripts = document.querySelectorAll('script:not([src])');
    //     scripts.forEach(script => {
    //         if (script.textContent) {
    //             const issues = refactor.analyzeFunctions(script.textContent);
    //             if (issues.length > 0) {
    //                 console.warn(`Large function issues found:`, issues);
    //             }
    //         }
    //     });
    // });

    // Export for use in other modules
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { LargeFunctionRefactor, ExampleRefactoring };
    }

} // Close the redeclaration check
