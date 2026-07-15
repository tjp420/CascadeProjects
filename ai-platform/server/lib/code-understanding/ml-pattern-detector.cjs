// simplebeacon-ignore workspace-health, test-coverage
/* eslint-disable */
/**
 * ML Pattern Detector
 *
 * Machine learning-inspired pattern detection for code analysis
 * using statistical analysis and heuristics instead of actual ML models.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../../../src/lib/app-logger.cjs');

/**
 * Pattern categories for code analysis
 */
const PATTERN_CATEGORIES = {
    ARCHITECTURE: 'architecture',
    SECURITY: 'security',
    PERFORMANCE: 'performance',
    MAINTAINABILITY: 'maintainability',
    TESTING: 'testing',
    DATA_FLOW: 'data_flow',
    ERROR_HANDLING: 'error_handling',
    API_DESIGN: 'api_design'
};

/**
 * Statistical pattern detection
 */
class StatisticalPatternDetector {
    constructor() {
        this.patterns = new Map();
        this.initializePatterns();
    }
    
    /**
     * Initialize pattern definitions
     */
    initializePatterns() {
        // Architecture patterns
        this.patterns.set('mvc-pattern', {
            category: PATTERN_CATEGORIES.ARCHITECTURE,
            description: 'Model-View-Controller pattern detected',
            confidence: 0.8,
            indicators: [
                { type: 'class_names', pattern: /(Controller|Model|View)$/i, weight: 0.3 },
                { type: 'file_structure', pattern: /controllers\/|models\/|views\//i, weight: 0.4 },
                { type: 'imports', pattern: /import.*from.*['"]\.\.\/(models|views|controllers)/i, weight: 0.3 }
            ]
        });
        
        this.patterns.set('repository-pattern', {
            category: PATTERN_CATEGORIES.ARCHITECTURE,
            description: 'Repository pattern detected',
            confidence: 0.7,
            indicators: [
                { type: 'class_names', pattern: /Repository$/i, weight: 0.4 },
                { type: 'method_names', pattern: /(save|find|delete|update)All/i, weight: 0.3 },
                { type: 'imports', pattern: /import.*Repository/i, weight: 0.3 }
            ]
        });
        
        // Security patterns
        this.patterns.set('input-validation', {
            category: PATTERN_CATEGORIES.SECURITY,
            description: 'Input validation pattern detected',
            confidence: 0.6,
            indicators: [
                { type: 'function_calls', pattern: /(validate|sanitize|clean|escape)/i, weight: 0.4 },
                { type: 'conditionals', pattern: /if\s*\(\s*.*\.(length|size|trim)/i, weight: 0.3 },
                { type: 'regex', pattern: /test\(|match\(|exec\(/i, weight: 0.3 }
            ]
        });
        
        this.patterns.set('authentication-flow', {
            category: PATTERN_CATEGORIES.SECURITY,
            description: 'Authentication flow detected',
            confidence: 0.8,
            indicators: [
                { type: 'function_calls', pattern: /(authenticate|login|signin|jwt|token)/i, weight: 0.4 },
                { type: 'imports', pattern: /import.*(?:bcrypt|jsonwebtoken|passport)/i, weight: 0.4 },
                { type: 'variables', pattern: /(password|token|auth|session)/i, weight: 0.2 }
            ]
        });
        
        // Performance patterns
        this.patterns.set('caching-pattern', {
            category: PATTERN_CATEGORIES.PERFORMANCE,
            description: 'Caching pattern detected',
            confidence: 0.7,
            indicators: [
                { type: 'function_calls', pattern: /(cache|memo|store)/i, weight: 0.4 },
                { type: 'data_structures', pattern: /(Map|Set|Object)\.set\(|\.get\(/i, weight: 0.3 },
                { type: 'conditionals', pattern: /if\s*\(\s*.*cache/i, weight: 0.3 }
            ]
        });
        
        this.patterns.set('async-pattern', {
            category: PATTERN_CATEGORIES.PERFORMANCE,
            description: 'Asynchronous pattern detected',
            confidence: 0.6,
            indicators: [
                { type: 'keywords', pattern: /\b(async|await|Promise|callback)/i, weight: 0.4 },
                { type: 'function_calls', pattern: /\.then\(|\.catch\(|setTimeout\(/i, weight: 0.3 },
                { type: 'error_handling', pattern: /try\s*\{.*await/i, weight: 0.3 }
            ]
        });
        
        // Maintainability patterns
        this.patterns.set('dependency-injection', {
            category: PATTERN_CATEGORIES.MAINTAINABILITY,
            description: 'Dependency injection pattern detected',
            confidence: 0.7,
            indicators: [
                { type: 'constructors', pattern: /constructor\s*\([^)]*\)/i, weight: 0.4 },
                { type: 'parameters', pattern: /\w+\s*:\s*\w+\s*(?:=|,)/i, weight: 0.3 },
                { type: 'assignments', pattern: /this\.\w+\s*=\s*\w+/i, weight: 0.3 }
            ]
        });
        
        // Testing patterns
        this.patterns.set('unit-test-pattern', {
            category: PATTERN_CATEGORIES.TESTING,
            description: 'Unit testing pattern detected',
            confidence: 0.8,
            indicators: [
                { type: 'function_calls', pattern: /(describe|it|test|expect|assert)/i, weight: 0.4 },
                { type: 'imports', pattern: /import.*(?:jest|test|chai|mocha)/i, weight: 0.4 },
                { type: 'file_names', pattern: /\.test\.|\.spec\./i, weight: 0.2 }
            ]
        });
        
        // Data flow patterns
        this.patterns.set('data-pipeline', {
            category: PATTERN_CATEGORIES.DATA_FLOW,
            description: 'Data pipeline pattern detected',
            confidence: 0.7,
            indicators: [
                { type: 'function_calls', pattern: /(pipe|map|filter|reduce|transform)/i, weight: 0.4 },
                { type: 'method_chaining', pattern: /\.pipe\(\s*\w+\)|\.map\(\s*\w+\)/i, weight: 0.3 },
                { type: 'data_operations', pattern: /(forEach|map|filter|reduce)/i, weight: 0.3 }
            ]
        });
        
        // Error handling patterns
        this.patterns.set('error-handling-pattern', {
            category: PATTERN_CATEGORIES.ERROR_HANDLING,
            description: 'Comprehensive error handling detected',
            confidence: 0.6,
            indicators: [
                { type: 'keywords', pattern: /\b(try|catch|throw|Error)/i, weight: 0.4 },
                { type: 'error_objects', pattern: /new\s+Error\(|\.message|\.stack/i, weight: 0.3 },
                { type: 'logging', pattern: /console\.(error|warn|log)|logger\./i, weight: 0.3 }
            ]
        });
        
        // API design patterns
        this.patterns.set('rest-api-pattern', {
            category: PATTERN_CATEGORIES.API_DESIGN,
            description: 'REST API pattern detected',
            confidence: 0.8,
            indicators: [
                { type: 'http_methods', pattern: /\b(get|post|put|delete|patch)\b/i, weight: 0.4 },
                { type: 'routing', pattern: /(router|route|app\.(get|post|put|delete))/i, weight: 0.4 },
                { type: 'status_codes', pattern: /(status|statusCode)\s*:\s*\d{3}/i, weight: 0.2 }
            ]
        });
    }
    
    /**
     * Detect patterns in code content
     */
    detectPatterns(content, context = {}) {
        const detectedPatterns = [];
        const contentLower = content.toLowerCase();
        
        for (const [patternId, pattern] of this.patterns) {
            const detection = this.analyzePattern(content, contentLower, pattern, context);            
            if (detection.confidence > 0.3) { // Minimum confidence threshold
                detectedPatterns.push({
                    id: patternId,
                    category: pattern.category,
                    description: pattern.description,
                    confidence: detection.confidence,
                    matches: detection.matches,
                    locations: detection.locations
                });
            }
        }
        
        // Sort by confidence
        detectedPatterns.sort((a, b) => b.confidence - a.confidence);
        
        return detectedPatterns;
    }
    
    /**
     * Analyze specific pattern
     */
    analyzePattern(content, contentLower, pattern, context) {
        let totalScore = 0;
        let totalWeight = 0;
        const matches = [];
        const locations = [];
        
        for (const indicator of pattern.indicators) {
            const match = this.checkIndicator(content, contentLower, indicator, context);
            
            if (match.found) {
                totalScore += match.score * indicator.weight;
                totalWeight += indicator.weight;
                
                matches.push({
                    type: indicator.type,
                    pattern: indicator.pattern,
                    matches: match.matches,
                    score: match.score
                });
                
                if (match.locations) {
                    locations.push(...match.locations);
                }
            }
        }
        
        const confidence = totalWeight > 0 ? totalScore / totalWeight : 0;
        
        return {
            confidence: Math.min(confidence, 1.0),
            matches,
            locations
        };
    }
    
    /**
     * Check specific indicator
     */
    checkIndicator(content, contentLower, indicator, context = {}) {
        const { type, pattern } = indicator;
        const regex = new RegExp(pattern, 'gi');
        const matches = [];
        const locations = [];
        let found = false;
        let score = 0;
        
        switch (type) {
            case 'class_names':
                const classMatches = content.match(regex);
                if (classMatches) {
                    found = true;
                    score = Math.min(classMatches.length / 3, 1.0);
                    matches.push(...classMatches);
                }
                break;
                
            case 'file_structure':
                // This would need file path context
                found = context.filePath && regex.test(context.filePath);
                score = found ? 0.8 : 0;
                break;
                
            case 'imports':
                const importMatches = content.match(regex);
                if (importMatches) {
                    found = true;
                    score = Math.min(importMatches.length / 2, 1.0);
                    matches.push(...importMatches);
                }
                break;
                
            case 'method_names':
                const methodMatches = content.match(regex);
                if (methodMatches) {
                    found = true;
                    score = Math.min(methodMatches.length / 3, 1.0);
                    matches.push(...methodMatches);
                }
                break;
                
            case 'function_calls':
                const functionMatches = content.match(regex);
                if (functionMatches) {
                    found = true;
                    score = Math.min(functionMatches.length / 2, 1.0);
                    matches.push(...functionMatches);
                }
                break;
                
            case 'keywords':
                const keywordMatches = contentLower.match(regex);
                if (keywordMatches) {
                    found = true;
                    score = Math.min(keywordMatches.length / 3, 1.0);
                    matches.push(...keywordMatches);
                }
                break;
                
            case 'conditionals':
                const conditionalMatches = content.match(regex);
                if (conditionalMatches) {
                    found = true;
                    score = Math.min(conditionalMatches.length / 2, 1.0);
                    matches.push(...conditionalMatches);
                }
                break;
                
            case 'variables':
                const variableMatches = content.match(regex);
                if (variableMatches) {
                    found = true;
                    score = Math.min(variableMatches.length / 3, 1.0);
                    matches.push(...variableMatches);
                }
                break;
                
            case 'constructors':
                const constructorMatches = content.match(regex);
                if (constructorMatches) {
                    found = true;
                    score = Math.min(constructorMatches.length, 1.0);
                    matches.push(...constructorMatches);
                }
                break;
                
            case 'parameters':
                const parameterMatches = content.match(regex);
                if (parameterMatches) {
                    found = true;
                    score = Math.min(parameterMatches.length / 3, 1.0);
                    matches.push(...parameterMatches);
                }
                break;
                
            case 'assignments':
                const assignmentMatches = content.match(regex);
                if (assignmentMatches) {
                    found = true;
                    score = Math.min(assignmentMatches.length / 3, 1.0);
                    matches.push(...assignmentMatches);
                }
                break;
                
            case 'data_structures':
                const dataStructureMatches = content.match(regex);
                if (dataStructureMatches) {
                    found = true;
                    score = Math.min(dataStructureMatches.length / 2, 1.0);
                    matches.push(...dataStructureMatches);
                }
                break;
                
            case 'method_chaining':
                const chainingMatches = content.match(regex);
                if (chainingMatches) {
                    found = true;
                    score = Math.min(chainingMatches.length / 2, 1.0);
                    matches.push(...chainingMatches);
                }
                break;
                
            case 'data_operations':
                const dataOpMatches = content.match(regex);
                if (dataOpMatches) {
                    found = true;
                    score = Math.min(dataOpMatches.length / 3, 1.0);
                    matches.push(...dataOpMatches);
                }
                break;
                
            case 'error_objects':
                const errorMatches = content.match(regex);
                if (errorMatches) {
                    found = true;
                    score = Math.min(errorMatches.length / 2, 1.0);
                    matches.push(...errorMatches);
                }
                break;
                
            case 'logging':
                const loggingMatches = content.match(regex);
                if (loggingMatches) {
                    found = true;
                    score = Math.min(loggingMatches.length / 3, 1.0);
                    matches.push(...loggingMatches);
                }
                break;
                
            case 'http_methods':
                const httpMatches = content.match(regex);
                if (httpMatches) {
                    found = true;
                    score = Math.min(httpMatches.length / 3, 1.0);
                    matches.push(...httpMatches);
                }
                break;
                
            case 'routing':
                const routingMatches = content.match(regex);
                if (routingMatches) {
                    found = true;
                    score = Math.min(routingMatches.length / 2, 1.0);
                    matches.push(...routingMatches);
                }
                break;
                
            case 'status_codes':
                const statusMatches = content.match(regex);
                if (statusMatches) {
                    found = true;
                    score = Math.min(statusMatches.length, 1.0);
                    matches.push(...statusMatches);
                }
                break;
                
            case 'regex':
                const regexMatches = content.match(regex);
                if (regexMatches) {
                    found = true;
                    score = Math.min(regexMatches.length / 2, 1.0);
                    matches.push(...regexMatches);
                }
                break;
                
            case 'file_names':
                found = context.fileName && regex.test(context.fileName);
                score = found ? 0.8 : 0;
                break;
        }
        
        return { found, score, matches, locations };
    }
    
    /**
     * Get pattern summary statistics
     */
    getPatternSummary(detectedPatterns) {
        const summary = {
            totalPatterns: detectedPatterns.length,
            categories: {},
            highConfidence: detectedPatterns.filter(p => p.confidence > 0.7).length,
            mediumConfidence: detectedPatterns.filter(p => p.confidence > 0.4 && p.confidence <= 0.7).length,
            lowConfidence: detectedPatterns.filter(p => p.confidence <= 0.4).length
        };
        
        // Group by category
        for (const pattern of detectedPatterns) {
            if (!summary.categories[pattern.category]) {
                summary.categories[pattern.category] = {
                    count: 0,
                    patterns: []
                };
            }
            summary.categories[pattern.category].count++;
            summary.categories[pattern.category].patterns.push(pattern.id);
        }
        
        return summary;
    }
}

/**
 * Enhanced pattern detection with ML-inspired features
 */
function detectMLPatterns(content, context = {}) {
    const detector = new StatisticalPatternDetector();
    const patterns = detector.detectPatterns(content, context);
    const summary = detector.getPatternSummary(patterns);
    
    return {
        patterns,
        summary,
        insights: generatePatternInsights(patterns, summary)
    };
}

/**
 * Generate insights from detected patterns
 */
function generatePatternInsights(patterns, summary) {
    const insights = [];
    
    // Architecture insights
    if (summary.categories[PATTERN_CATEGORIES.ARCHITECTURE]?.count > 0) {
        insights.push({
            type: 'architecture',
            level: 'info',
            message: `Well-structured architecture detected with ${summary.categories[PATTERN_CATEGORIES.ARCHITECTURE].count} design patterns`
        });
    }
    
    // Security insights
    if (summary.categories[PATTERN_CATEGORIES.SECURITY]?.count > 0) {
        insights.push({
            type: 'security',
            level: 'positive',
            message: `Security-conscious patterns detected: ${summary.categories[PATTERN_CATEGORIES.SECURITY].patterns.join(', ')}`
        });
    } else {
        insights.push({
            type: 'security',
            level: 'warning',
            message: 'No explicit security patterns detected - consider adding input validation and authentication'
        });
    }
    
    // Performance insights
    if (summary.categories[PATTERN_CATEGORIES.PERFORMANCE]?.count > 0) {
        insights.push({
            type: 'performance',
            level: 'positive',
            message: `Performance optimizations detected: ${summary.categories[PATTERN_CATEGORIES.PERFORMANCE].patterns.join(', ')}`
        });
    }
    
    // Testing insights
    if (summary.categories[PATTERN_CATEGORIES.TESTING]?.count === 0) {
        insights.push({
            type: 'testing',
            level: 'warning',
            message: 'No testing patterns detected - consider adding unit tests'
        });
    }
    
    // Error handling insights
    if (summary.categories[PATTERN_CATEGORIES.ERROR_HANDLING]?.count > 0) {
        insights.push({
            type: 'error_handling',
            level: 'positive',
            message: 'Comprehensive error handling patterns detected'
        });
    } else {
        insights.push({
            type: 'error_handling',
            level: 'warning',
            message: 'Limited error handling detected - consider adding try-catch blocks'
        });
    }
    
    return insights;
}

module.exports = {
    StatisticalPatternDetector,
    detectMLPatterns,
    generatePatternInsights,
    PATTERN_CATEGORIES
};
