/**
 * Context Filter Module
 * Provides context-aware filtering for mock data detection
 */

import { detectFramework } from './framework-patterns.js';
import { LanguageDetector, CodeStructureAnalyzer } from './language-analyzer.js';

/**
 * Context Filter
 * Filters findings based on file type, content context, and project-specific rules
 */
export class ContextFilter {
    constructor() {
        this.fileTypeRules = {
            test: {
                allowedPatterns: ['test_data', 'mock_functions', 'test_emails', 'test_phones', 'react_mocks', 'vue_testing', 'angular_testing'],
                excludedPatterns: ['development_patterns'],
                confidenceThreshold: 0.6
            },
            source: {
                allowedPatterns: ['test_databases', 'test_apis', 'hardcoded_values', 'database_patterns', 'api_patterns'],
                excludedPatterns: ['development_patterns', 'generic_placeholders'],
                confidenceThreshold: 0.7
            },
            config: {
                allowedPatterns: ['generic_placeholders', 'database_patterns'],
                excludedPatterns: ['development_patterns'],
                confidenceThreshold: 0.5
            },
            documentation: {
                allowedPatterns: ['generic_placeholders'],
                excludedPatterns: ['test_databases', 'test_apis', 'database_patterns'],
                confidenceThreshold: 0.4
            }
        };

        this.contextRules = {
            comments: {
                excludePatterns: ['*.backup.*', '.backup.*', 'development_patterns'],
                confidenceReduction: 0.3
            },
            strings: {
                excludePatterns: ['*.backup.*', '.backup.*', 'development_patterns'],
                confidenceReduction: 0.2
            },
            variables: {
                excludePatterns: ['*.backup.*', '.backup.*', 'generic_placeholders'],
                confidenceReduction: 0.1
            }
        };

        this.projectExclusions = [
            'node_modules',
            '.git',
            'dist',
            'build',
            'coverage',
            'vendor',
            '.next',
            '.nuxt',
            'target',
            'bin'
        ];

        // Enhanced context analysis
        this.codeStructureCache = new Map();
        this.languageCache = new Map();
        this.frameworkCache = new Map();
    }

    /**
     * Filter findings based on context with enhanced analysis
     * @param {Array} findings - Array of findings
     * @param {string} filePath - File path
     * @param {string} content - File content for analysis
     * @returns {Array} Filtered findings
     */
    filterFindings(findings, filePath, content = '') {
        const fileType = this.getFileType(filePath);
        const fileTypeRule = this.fileTypeRules[fileType] || this.fileTypeRules.source;

        // Get enhanced context information
        const language = this.getLanguage(filePath, content);
        const framework = this.getFramework(filePath, content);
        const codeStructure = this.getCodeStructure(filePath, content, language);

        return findings.filter(finding => {
            // Check if pattern is allowed for this file type
            if (!this.isPatternAllowed(finding.category, fileTypeRule)) {
                return false;
            }

            // Check if pattern is excluded for this file type
            if (this.isPatternExcluded(finding.category, fileTypeRule)) {
                return false;
            }

            // Check confidence threshold
            if (finding.confidence < fileTypeRule.confidenceThreshold) {
                return false;
            }

            // Enhanced context-specific filtering
            return this.passesEnhancedContextFilter(finding, filePath, fileType, language, framework, codeStructure);
        });
    }

    /**
     * Get programming language for file
     */
    getLanguage(filePath, content) {
        const cacheKey = `${filePath}:${content.length}`;
        
        if (this.languageCache.has(cacheKey)) {
            return this.languageCache.get(cacheKey);
        }

        const language = LanguageDetector.detectLanguage(filePath, content);
        this.languageCache.set(cacheKey, language);
        return language;
    }

    /**
     * Get framework for file
     */
    getFramework(filePath, content) {
        const cacheKey = `${filePath}:${content.length}`;
        
        if (this.frameworkCache.has(cacheKey)) {
            return this.frameworkCache.get(cacheKey);
        }

        const framework = detectFramework(content, filePath);
        this.frameworkCache.set(cacheKey, framework);
        return framework;
    }

    /**
     * Get code structure for file
     */
    getCodeStructure(filePath, content, language) {
        const cacheKey = `${filePath}:${content.length}:${language}`;
        
        if (this.codeStructureCache.has(cacheKey)) {
            return this.codeStructureCache.get(cacheKey);
        }

        const structure = CodeStructureAnalyzer.analyzeStructure(content, language);
        this.codeStructureCache.set(cacheKey, structure);
        return structure;
    }

    /**
     * Get file type based on file path
     * @param {string} filePath - File path
     * @returns {string} File type
     */
    getFileType(filePath) {
        const extension = filePath.split('.').pop().toLowerCase();
        const basename = filePath.split('/').pop().toLowerCase();

        // Test files
        if (basename.includes('.test') || basename.includes('.spec') || 
            basename.startsWith('test') || basename.includes('test')) {
            return 'test';
        }

        // Configuration files
        if (['json', 'yaml', 'yml', 'toml', 'ini', 'conf'].includes(extension)) {
            return 'config';
        }

        // Documentation files
        if (['md', 'txt', 'rst', 'adoc'].includes(extension)) {
            return 'documentation';
        }

        // Source files (default)
        return 'source';
    }

    /**
     * Check if pattern is allowed for file type
     * @param {string} category - Pattern category
     * @param {Object} fileTypeRule - File type rule
     * @returns {boolean} True if allowed
     */
    isPatternAllowed(category, fileTypeRule) {
        if (!fileTypeRule.allowedPatterns) {
            return true;
        }

        return fileTypeRule.allowedPatterns.includes(category);
    }

    /**
     * Check if pattern is excluded for file type
     * @param {string} category - Pattern category
     * @param {Object} fileTypeRule - File type rule
     * @returns {boolean} True if excluded
     */
    isPatternExcluded(category, fileTypeRule) {
        if (!fileTypeRule.excludedPatterns) {
            return false;
        }

        return fileTypeRule.excludedPatterns.includes(category);
    }

    /**
     * Enhanced context filtering with language and framework awareness
     * @param {Object} finding - Finding object
     * @param {string} filePath - File path
     * @param {string} fileType - File type
     * @param {string} language - Programming language
     * @param {string} framework - Framework
     * @param {Object} codeStructure - Code structure analysis
     * @returns {boolean} True if passes filter
     */
    passesEnhancedContextFilter(finding, filePath, fileType, language, framework, codeStructure) {
        // Check if file is in excluded directory
        if (this.isInExcludedDirectory(filePath)) {
            return false;
        }

        // Apply language-specific filtering
        if (!this.passesLanguageFilter(finding, language)) {
            return false;
        }

        // Apply framework-specific filtering
        if (!this.passesFrameworkFilter(finding, framework)) {
            return false;
        }

        // Apply code structure analysis
        if (!this.passesStructureFilter(finding, codeStructure)) {
            return false;
        }

        // Apply context-specific rules
        const context = finding.context || '';
        
        // Check if finding is in a comment
        if (this.isInComment(context, finding)) {
            return this.passesCommentFilter(finding, fileType);
        }

        // Check if finding is in a string literal
        if (this.isInString(context, finding)) {
            return this.passesStringFilter(finding, fileType);
        }

        // Check if finding is a variable name
        if (this.isVariableName(context, finding)) {
            return this.passesVariableFilter(finding, fileType);
        }

        return true;
    }

    /**
     * Language-specific filtering
     */
    passesLanguageFilter(finding, language) {
        // Language-specific exclusions
        const languageExclusions = {
            'javascript': ['development_patterns'],
            'python': ['development_patterns'],
            'java': ['development_patterns'],
            'csharp': ['development_patterns']
        };

        const exclusions = languageExclusions[language] || [];
        return !exclusions.includes(finding.category);
    }

    /**
     * Framework-specific filtering
     */
    passesFrameworkFilter(finding, framework) {
        // Framework-specific pattern allowances
        const frameworkAllowances = {
            'react': ['react_mocks', 'react_testing', 'react_hook_mocks'],
            'vue': ['vue_mocks', 'vue_testing'],
            'angular': ['angular_testing', 'angular_service_mocks', 'angular_http_mocks'],
            'express': ['express_mocks', 'express_testing'],
            'sequelize': ['sequelize_mocks'],
            'mongoose': ['mongoose_mocks'],
            'prisma': ['prisma_mocks']
        };

        const allowances = frameworkAllowances[framework] || [];
        
        // If framework is detected and pattern is allowed, allow it
        if (framework !== 'unknown' && allowances.includes(finding.category)) {
            return true;
        }

        // If framework is detected but pattern is not allowed, exclude it
        if (framework !== 'unknown' && finding.category.includes(framework)) {
            return allowances.includes(finding.category);
        }

        return true; // No framework detected, allow by default
    }

    /**
     * Code structure-based filtering
     */
    passesStructureFilter(finding, codeStructure) {
        // Filter based on import statements
        if (codeStructure.imports && codeStructure.imports.length > 0) {
            const hasTestImports = codeStructure.imports.some(imp => 
                imp.content.includes('test') || 
                imp.content.includes('jest') || 
                imp.content.includes('mock') ||
                imp.content.includes('sinon')
            );

            // If no test imports found, be more strict with mock patterns
            if (!hasTestImports && finding.category.includes('mock')) {
                return finding.confidence >= 0.8; // Higher confidence required
            }
        }

        // Filter based on function context
        if (codeStructure.functions && codeStructure.functions.length > 0) {
            const hasTestFunctions = codeStructure.functions.some(func => 
                func.content.includes('test') || 
                func.content.includes('spec') ||
                func.content.includes('it(') ||
                func.content.includes('describe(')
            );

            // If no test functions found, be more strict
            if (!hasTestFunctions && finding.category.includes('test')) {
                return finding.confidence >= 0.7;
            }
        }

        return true;
    }

    /**
     * Check if file is in excluded directory
     * @param {string} filePath - File path
     * @returns {boolean} True if excluded
     */
    isInExcludedDirectory(filePath) {
        return this.projectExclusions.some(exclusion => 
            filePath.includes(`/${exclusion}/`) || filePath.startsWith(exclusion + '/')
        );
    }

    /**
     * Check if finding is in a comment
     * @param {string} context - Context string
     * @param {Object} finding - Finding object
     * @returns {boolean} True if in comment
     */
    isInComment(context, finding) {
        // Simple heuristic: check for comment indicators before the match
        const beforeMatch = context.substring(0, context.indexOf(finding.match));
        return beforeMatch.includes('//') || beforeMatch.includes('#') || 
               beforeMatch.includes('/*') || beforeMatch.includes('*');
    }

    /**
     * Check if finding is in a string literal
     * @param {string} context - Context string
     * @param {Object} finding - Finding object
     * @returns {boolean} True if in string
     */
    isInString(context, finding) {
        // Simple heuristic: check for quotes around the match
        const matchIndex = context.indexOf(finding.match);
        const before = context.substring(Math.max(0, matchIndex - 10), matchIndex);
        const after = context.substring(matchIndex + finding.match.length, 
            Math.min(context.length, matchIndex + finding.match.length + 10));
        
        return (before.endsWith('"') || before.endsWith('\'')) && 
               (after.startsWith('"') || after.startsWith('\''));
    }

    /**
     * Check if finding is a variable name
     * @param {string} context - Context string
     * @param {Object} finding - Finding object
     * @returns {boolean} True if variable name
     */
    isVariableName(context, finding) {
        // Simple heuristic: check if match is surrounded by word boundaries and assignment
        const matchIndex = context.indexOf(finding.match);
        const before = context.substring(Math.max(0, matchIndex - 5), matchIndex);
        const after = context.substring(matchIndex + finding.match.length, 
            Math.min(context.length, matchIndex + 5));
        
        return /[a-zA-Z_$]/.test(before.slice(-1)) && /[a-zA-Z0-9_$]/.test(after.charAt(0));
    }

    /**
     * Enhanced comment-specific filtering with context analysis
     * @param {Object} finding - Finding object
     * @param {string} fileType - File type
     * @returns {boolean} True if passes filter
     */
    passesCommentFilter(finding, fileType) {
        // Comments are less reliable, so be more strict
        const commentRules = this.contextRules.comments;
        
        // Check if pattern is excluded in comments
        if (commentRules.excludePatterns.includes(finding.category)) {
            return false;
        }

        // Enhanced comment analysis
        const commentContext = this.analyzeCommentContext(finding);
        
        // Filter out legitimate TODO/FIXME comments
        if (this.isLegitimateDevelopmentComment(commentContext)) {
            return false;
        }

        // Filter out example/documentation comments
        if (this.isDocumentationComment(commentContext)) {
            // Allow documentation comments but with reduced confidence
            finding.confidence = Math.max(0.4, finding.confidence - 0.3);
        } else {
            // Regular comment confidence reduction
            finding.confidence = Math.max(0.3, finding.confidence - commentRules.confidenceReduction);
        }
        
        return finding.confidence >= 0.5;
    }

    /**
     * Analyze comment context for enhanced filtering
     */
    analyzeCommentContext(finding) {
        const context = finding.context || '';
        const lowerContext = context.toLowerCase();
        
        return {
            isTodo: lowerContext.includes('todo') || lowerContext.includes('fixme'),
            isNote: lowerContext.includes('note') || lowerContext.includes('comment'),
            isExample: lowerContext.includes('example') || lowerContext.includes('sample'),
            isDocumentation: lowerContext.includes('/**') || lowerContext.includes('*/'),
            isInline: context.includes('//') && !context.includes('\n'),
            isBlock: context.includes('/*') || context.includes('*/'),
            hasKeywords: this.hasCommentKeywords(lowerContext),
            severity: this.assessCommentSeverity(lowerContext)
        };
    }

    /**
     * Check if comment is legitimate development comment
     */
    isLegitimateDevelopmentComment(commentContext) {
        const { isTodo, isNote, hasKeywords } = commentContext;
        
        // TODO/FIXME comments with development keywords are legitimate
        if (isTodo && hasKeywords) {
            return true;
        }
        
        // Notes about implementation are legitimate
        if (isNote && hasKeywords) {
            return true;
        }
        
        return false;
    }

    /**
     * Check if comment is documentation
     */
    isDocumentationComment(commentContext) {
        const { isDocumentation, isExample, isBlock } = commentContext;
        
        return isDocumentation || isExample || isBlock;
    }

    /**
     * Check if comment has legitimate development keywords
     */
    hasCommentKeywords(lowerContext) {
        const legitimateKeywords = [
            'implement', 'add', 'fix', 'update', 'change', 'refactor',
            'optimize', 'improve', 'remove', 'delete', 'modify',
            'check', 'verify', 'validate', 'test', 'handle', 'process'
        ];
        
        return legitimateKeywords.some(keyword => lowerContext.includes(keyword));
    }

    /**
     * Assess comment severity for filtering
     */
    assessCommentSeverity(lowerContext) {
        const highSeverityKeywords = ['critical', 'urgent', 'important', 'security'];
        const mediumSeverityKeywords = ['bug', 'error', 'issue', 'problem'];
        
        if (highSeverityKeywords.some(keyword => lowerContext.includes(keyword))) {
            return 'high';
        }
        
        if (mediumSeverityKeywords.some(keyword => lowerContext.includes(keyword))) {
            return 'medium';
        }
        
        return 'low';
    }

    /**
     * Apply string-specific filtering
     * @param {Object} finding - Finding object
     * @param {string} fileType - File type
     * @returns {boolean} True if passes filter
     */
    passesStringFilter(finding, fileType) {
        // Strings in source files are more likely to be mock data
        if (fileType === 'source') {
            return finding.confidence >= 0.6;
        }

        // In other file types, be more cautious
        const stringRules = this.contextRules.strings;
        
        // Check if pattern is excluded in strings
        if (stringRules.excludePatterns.includes(finding.category)) {
            return false;
        }

        // Reduce confidence for findings in strings
        finding.confidence = Math.max(0.4, finding.confidence - stringRules.confidenceReduction);
        
        return finding.confidence >= 0.5;
    }

    /**
     * Apply variable-specific filtering
     * @param {Object} finding - Finding object
     * @param {string} fileType - File type
     * @returns {boolean} True if passes filter
     */
    passesVariableFilter(finding, fileType) {
        // Variable names are less likely to be mock data
        const variableRules = this.contextRules.variables;
        
        // Check if pattern is excluded for variables
        if (variableRules.excludePatterns.includes(finding.category)) {
            return false;
        }

        // Reduce confidence for findings in variable names
        finding.confidence = Math.max(0.5, finding.confidence - variableRules.confidenceReduction);
        
        return finding.confidence >= 0.6;
    }

    /**
     * Apply project-specific filtering
     * @param {Array} findings - Array of findings
     * @param {Object} projectConfig - Project configuration
     * @returns {Array} Filtered findings
     */
    applyProjectFiltering(findings, projectConfig = {}) {
        const customRules = projectConfig.customRules || {};
        const exclusions = projectConfig.exclusions || [];

        return findings.filter(finding => {
            // Apply custom exclusions
            for (const exclusion of exclusions) {
                if (this.matchesExclusion(finding, exclusion)) {
                    return false;
                }
            }

            // Apply custom rules
            for (const rule of customRules) {
                if (this.matchesRule(finding, rule)) {
                    return rule.action === 'allow';
                }
            }

            return true;
        });
    }

    /**
     * Check if finding matches exclusion pattern
     * @param {Object} finding - Finding object
     * @param {Object} exclusion - Exclusion pattern
     * @returns {boolean} True if matches
     */
    matchesExclusion(finding, exclusion) {
        if (exclusion.category && finding.category !== exclusion.category) {
            return false;
        }

        if (exclusion.pattern && !new RegExp(exclusion.pattern).test(finding.match)) {
            return false;
        }

        if (exclusion.filePattern && finding.file && !new RegExp(exclusion.filePattern).test(finding.file)) {
            return false;
        }

        return true;
    }

    /**
     * Check if finding matches custom rule
     * @param {Object} finding - Finding object
     * @param {Object} rule - Custom rule
     * @returns {boolean} True if matches
     */
    matchesRule(finding, rule) {
        if (rule.category && finding.category !== rule.category) {
            return false;
        }

        if (rule.pattern && !new RegExp(rule.pattern).test(finding.match)) {
            return false;
        }

        if (rule.confidenceMin && finding.confidence < rule.confidenceMin) {
            return false;
        }

        return true;
    }

    /**
     * Get filtering statistics
     * @param {Array} originalFindings - Original findings
     * @param {Array} filteredFindings - Filtered findings
     * @returns {Object} Filtering statistics
     */
    getFilteringStats(originalFindings, filteredFindings) {
        return {
            originalCount: originalFindings.length,
            filteredCount: filteredFindings.length,
            reduction: originalFindings.length - filteredFindings.length,
            reductionPercentage: ((originalFindings.length - filteredFindings.length) / originalFindings.length * 100).toFixed(2),
            filtersApplied: ['fileType', 'context', 'project']
        };
    }
}

/**
 * Default context filter instance
 */
export const defaultContextFilter = new ContextFilter();
