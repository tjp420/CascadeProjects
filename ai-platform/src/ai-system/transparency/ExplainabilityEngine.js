/**
 * AI Explainability Engine
 * 
 * Provides transparency and explainability for AI-generated code,
 * including attribution, confidence scoring, and decision reasoning.
 */

class ExplainabilityEngine {
    constructor() {
        this.attributionHistory = new Map();
        this.confidenceThresholds = {
            high: 0.9,
            medium: 0.7,
            low: 0.5
        };
        this.modelVersions = new Map();
        this.decisionPatterns = new Map();
    }

    /**
     * Analyze AI-generated code for explainability
     */
    async analyzeCodeGeneration(generatedCode, context, modelInfo) {
        const analysis = {
            timestamp: new Date().toISOString(),
            codeId: this.generateCodeId(),
            modelInfo: this.enhanceModelInfo(modelInfo),
            attribution: this.analyzeAttribution(generatedCode, context),
            confidence: this.calculateConfidence(generatedCode, context),
            reasoning: this.generateReasoning(generatedCode, context),
            provenance: this.trackProvenance(generatedCode, context),
            riskAssessment: this.assessRisks(generatedCode, context)
        };

        // Store for future reference
        this.attributionHistory.set(analysis.codeId, analysis);

        return analysis;
    }

    /**
     * Generate unique code ID
     */
    generateCodeId() {
        return `code_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Enhance model information with additional context
     */
    enhanceModelInfo(modelInfo) {
        return {
            modelId: modelInfo.id || 'unknown',
            version: modelInfo.version || '1.0.0',
            provider: modelInfo.provider || 'cascade-ai',
            trainingData: modelInfo.trainingData || 'proprietary',
            lastUpdated: modelInfo.lastUpdated || new Date().toISOString(),
            capabilities: modelInfo.capabilities || [],
            limitations: modelInfo.limitations || [],
            trustLevel: modelInfo.trustLevel || 'bronze'
        };
    }

    /**
     * Analyze code attribution sources
     */
    analyzeAttribution(generatedCode, context) {
        const attribution = {
            primarySource: 'ai-generation',
            sources: [],
            confidence: 0.8,
            methodology: 'pattern-matching-and-context-analysis'
        };

        // Check for common patterns
        if (this.containsCommonPatterns(generatedCode)) {
            attribution.sources.push({
                type: 'common-pattern',
                description: 'Uses common programming patterns',
                confidence: 0.9
            });
        }

        // Check for framework-specific code
        const frameworkInfo = this.identifyFramework(generatedCode);
        if (frameworkInfo) {
            attribution.sources.push({
                type: 'framework',
                name: frameworkInfo.name,
                description: `Uses ${frameworkInfo.name} framework patterns`,
                confidence: frameworkInfo.confidence
            });
        }

        // Check for library-specific code
        const libraryInfo = this.identifyLibraries(generatedCode);
        libraryInfo.forEach(lib => {
            attribution.sources.push({
                type: 'library',
                name: lib.name,
                version: lib.version,
                description: `Uses ${lib.name} library`,
                confidence: lib.confidence
            });
        });

        // Check context influence
        if (context && context.userInput) {
            attribution.sources.push({
                type: 'user-input',
                description: 'Based on user requirements and context',
                confidence: 0.95
            });
        }

        return attribution;
    }

    /**
     * Calculate confidence score for generated code
     */
    calculateConfidence(generatedCode, context) {
        let confidence = 0.5; // Base confidence

        // Factor in code complexity
        const complexity = this.analyzeComplexity(generatedCode);
        confidence += (complexity < 0.7) ? 0.2 : -0.1;

        // Factor in pattern recognition
        const patternScore = this.scorePatternRecognition(generatedCode);
        confidence += patternScore * 0.3;

        // Factor in context relevance
        if (context && context.userInput) {
            const relevanceScore = this.scoreRelevance(generatedCode, context);
            confidence += relevanceScore * 0.2;
        }

        // Factor in security assessment
        const securityScore = this.scoreSecurity(generatedCode);
        confidence += securityScore * 0.1;

        // Normalize to 0-1 range
        confidence = Math.max(0, Math.min(1, confidence));

        return {
            overall: confidence,
            breakdown: {
                complexity: complexity,
                patterns: patternScore,
                relevance: context ? this.scoreRelevance(generatedCode, context) : 0,
                security: securityScore
            },
            level: this.getConfidenceLevel(confidence)
        };
    }

    /**
     * Generate reasoning for code generation
     */
    generateReasoning(generatedCode, context) {
        const reasoning = {
            approach: this.determineApproach(generatedCode, context),
            keyDecisions: this.identifyKeyDecisions(generatedCode),
            alternatives: this.considerAlternatives(generatedCode, context),
            constraints: this.identifyConstraints(context),
            assumptions: this.identifyAssumptions(generatedCode, context)
        };

        return reasoning;
    }

    /**
     * Track code provenance
     */
    trackProvenance(generatedCode, context) {
        return {
            generatedAt: new Date().toISOString(),
            generatedBy: 'cascade-ai-platform',
            version: '1.0.0',
            lineage: this.buildLineage(generatedCode, context),
            modifications: [],
            reviewStatus: 'pending',
            auditTrail: this.createAuditTrail(generatedCode, context)
        };
    }

    /**
     * Assess risks in generated code
     */
    assessRisks(generatedCode, context) {
        const risks = {
            security: this.assessSecurityRisks(generatedCode),
            performance: this.assessPerformanceRisks(generatedCode),
            maintainability: this.assessMaintainabilityRisks(generatedCode),
            compatibility: this.assessCompatibilityRisks(generatedCode),
            overall: 'medium'
        };

        // Calculate overall risk level
        const riskScores = Object.values(risks).filter(r => typeof r === 'object' ? r.level : r);
        const riskLevels = { low: 1, medium: 2, high: 3, critical: 4 };
        const avgScore = riskScores.reduce((sum, risk) => {
            const level = typeof risk === 'object' ? risk.level : risk;
            return sum + (riskLevels[level] || 2);
        }, 0) / riskScores.length;

        if (avgScore <= 1.5) risks.overall = 'low';
        else if (avgScore <= 2.5) risks.overall = 'medium';
        else if (avgScore <= 3.5) risks.overall = 'high';
        else risks.overall = 'critical';

        return risks;
    }

    /**
     * Helper methods
     */
    containsCommonPatterns(code) {
        const commonPatterns = [
            /function\s+\w+\s*\(/,
            /class\s+\w+/,
            /const\s+\w+\s*=/,
            /if\s*\(/,
            /for\s*\(/,
            /return\s+/,
            /\.then\(/,
            /\.catch\(/,
            /async\s+function/,
            /await\s+/
        ];

        return commonPatterns.some(pattern => pattern.test(code));
    }

    identifyFramework(code) {
        const frameworks = [
            { name: 'React', pattern: /import.*from\s+['"]react['"]/, confidence: 0.9 },
            { name: 'Express', pattern: /require\(['"]express['"]/, confidence: 0.9 },
            { name: 'Vue', pattern: /import.*from\s+['"]vue['"]/, confidence: 0.9 },
            { name: 'Angular', pattern: /import.*from\s+['"]@angular/, confidence: 0.9 },
            { name: 'Node.js', pattern: /require\(['"]/, confidence: 0.7 }
        ];

        for (const framework of frameworks) {
            if (framework.pattern.test(code)) {
                return framework;
            }
        }

        return null;
    }

    identifyLibraries(code) {
        const libraries = [];
        const importPatterns = [
            /require\(['"]([^'"]+)['"]\)/g,
            /import.*from\s+['"]([^'"]+)['"]/g
        ];

        importPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(code)) !== null) {
                const libName = match[1];
                if (!libName.startsWith('.') && !libName.startsWith('/')) {
                    libraries.push({
                        name: libName,
                        version: 'unknown',
                        confidence: 0.8
                    });
                }
            }
        });

        return libraries;
    }

    analyzeComplexity(code) {
        const lines = code.split('\n').length;
        const cyclomaticComplexity = this.calculateCyclomaticComplexity(code);
        
        // Normalize complexity score (0-1, where 1 is simple)
        const lineScore = Math.max(0, 1 - (lines / 100));
        const complexityScore = Math.max(0, 1 - (cyclomaticComplexity / 20));
        
        return (lineScore + complexityScore) / 2;
    }

    calculateCyclomaticComplexity(code) {
        let complexity = 1; // Base complexity
        
        // Add complexity for decision points
        const decisionPatterns = [
            /if\s*\(/g,
            /else\s+if/g,
            /while\s*\(/g,
            /for\s*\(/g,
            /switch\s*\(/g,
            /catch\s*\(/g,
            /&&/g,
            /\|\|/g
        ];

        decisionPatterns.forEach(pattern => {
            const matches = code.match(pattern);
            if (matches) {
                complexity += matches.length;
            }
        });

        return complexity;
    }

    scorePatternRecognition(code) {
        const patterns = [
            { name: 'error-handling', pattern: /try\s*\{|catch\s*\(|throw\s+/, weight: 0.2 },
            { name: 'input-validation', pattern: /if\s*\(!.*\)|typeof.*===|validate/, weight: 0.2 },
            { name: 'async-pattern', pattern: /async|await|Promise|\.then\(|\.catch\(/, weight: 0.15 },
            { name: 'modular-structure', pattern: /function\s+\w+|class\s+\w+|module\.exports/, weight: 0.15 },
            { name: 'documentation', pattern: /\/\*\*|\/\/.*@|@param|@return/, weight: 0.1 }
        ];

        let score = 0;
        patterns.forEach(pattern => {
            if (pattern.pattern.test(code)) {
                score += pattern.weight;
            }
        });

        return Math.min(1, score);
    }

    scoreRelevance(code, context) {
        if (!context || !context.userInput) return 0.5;

        const userKeywords = this.extractKeywords(context.userInput.toLowerCase());
        const codeKeywords = this.extractKeywords(code.toLowerCase());

        const intersection = userKeywords.filter(keyword => 
            codeKeywords.some(codeKeyword => codeKeyword.includes(keyword))
        );

        return Math.min(1, intersection.length / Math.max(userKeywords.length, 1));
    }

    scoreSecurity(code) {
        const securityIssues = [
            { pattern: /eval\(/, penalty: 0.3 },
            { pattern: /Function\s*\(/, penalty: 0.2 },
            { pattern: /innerHTML\s*=/, penalty: 0.2 },
            { pattern: /document\.write/, penalty: 0.2 },
            { pattern: /setTimeout\s*\(/, penalty: 0.1 },
            { pattern: /setInterval\s*\(/, penalty: 0.1 }
        ];

        let score = 1.0;
        securityIssues.forEach(issue => {
            if (issue.pattern.test(code)) {
                score -= issue.penalty;
            }
        });

        return Math.max(0, score);
    }

    getConfidenceLevel(confidence) {
        if (confidence >= this.confidenceThresholds.high) return 'high';
        if (confidence >= this.confidenceThresholds.medium) return 'medium';
        if (confidence >= this.confidenceThresholds.low) return 'low';
        return 'very-low';
    }

    determineApproach(code, context) {
        if (code.includes('class ')) return 'object-oriented';
        if (code.includes('function ') && !code.includes('class ')) return 'functional';
        if (code.includes('async ') || code.includes('await ')) return 'asynchronous';
        if (code.includes('import ') || code.includes('require(')) return 'modular';
        return 'procedural';
    }

    identifyKeyDecisions(code) {
        const decisions = [];
        
        if (code.includes('try')) {
            decisions.push('Implemented error handling');
        }
        if (code.includes('async') || code.includes('await')) {
            decisions.push('Used asynchronous programming');
        }
        if (code.includes('class ')) {
            decisions.push('Adopted object-oriented design');
        }
        if (code.includes('validate') || code.includes('check')) {
            decisions.push('Added input validation');
        }

        return decisions;
    }

    considerAlternatives(code, context) {
        return [
            'Could use different design patterns',
            'Alternative libraries might be available',
            'Different error handling approaches possible',
            'Performance optimizations could be applied'
        ];
    }

    identifyConstraints(context) {
        const constraints = [];
        
        if (context && context.userInput) {
            if (context.userInput.includes('fast')) {
                constraints.push('Performance requirements');
            }
            if (context.userInput.includes('secure')) {
                constraints.push('Security requirements');
            }
            if (context.userInput.includes('simple')) {
                constraints.push('Simplicity requirements');
            }
        }

        return constraints;
    }

    identifyAssumptions(code, context) {
        const assumptions = [
            'Assumes standard JavaScript environment',
            'Assumes required dependencies are available',
            'Assumes user has basic programming knowledge'
        ];

        if (context && context.framework) {
            assumptions.push(`Assumes ${context.framework} framework is available`);
        }

        return assumptions;
    }

    buildLineage(code, context) {
        return {
            parent: null,
            children: [],
            version: 1,
            modified: false,
            source: 'ai-generation'
        };
    }

    createAuditTrail(code, context) {
        return [
            {
                timestamp: new Date().toISOString(),
                action: 'generated',
                actor: 'cascade-ai-platform',
                details: {
                    codeLength: code.length,
                    context: context ? 'provided' : 'none',
                    model: 'cascade-ai-v1.0'
                }
            }
        ];
    }

    assessSecurityRisks(code) {
        const risks = [];
        
        if (/eval\(/.test(code)) {
            risks.push({ type: 'code-injection', severity: 'high', description: 'Use of eval() function' });
        }
        if (/innerHTML\s*=/.test(code)) {
            risks.push({ type: 'xss', severity: 'medium', description: 'Direct innerHTML assignment' });
        }
        if (/password|secret|key/.test(code) && /console\.log/.test(code)) {
            risks.push({ type: 'data-leakage', severity: 'medium', description: 'Potential sensitive data logging' });
        }

        return {
            level: risks.length > 0 ? (risks.some(r => r.severity === 'high') ? 'high' : 'medium') : 'low',
            risks: risks
        };
    }

    assessPerformanceRisks(code) {
        const risks = [];
        
        if (/for\s*\(.*in.*\)/.test(code)) {
            risks.push({ type: 'inefficient-loop', severity: 'medium', description: 'Potentially inefficient for-in loop' });
        }
        if (/DOM.*appendChild.*DOM/.test(code)) {
            risks.push({ type: 'dom-manipulation', severity: 'low', description: 'Multiple DOM operations' });
        }

        return {
            level: risks.length > 0 ? 'medium' : 'low',
            risks: risks
        };
    }

    assessMaintainabilityRisks(code) {
        const risks = [];
        const lines = code.split('\n');
        
        if (lines.length > 100) {
            risks.push({ type: 'length', severity: 'medium', description: 'Code is quite long' });
        }
        
        const complexity = this.calculateCyclomaticComplexity(code);
        if (complexity > 10) {
            risks.push({ type: 'complexity', severity: 'high', description: 'High cyclomatic complexity' });
        }

        return {
            level: risks.length > 0 ? (risks.some(r => r.severity === 'high') ? 'high' : 'medium') : 'low',
            risks: risks
        };
    }

    assessCompatibilityRisks(code) {
        const risks = [];
        
        if (/const|let/.test(code) && /var/.test(code)) {
            risks.push({ type: 'es6-compatibility', severity: 'low', description: 'Mixed ES5/ES6 syntax' });
        }

        return {
            level: risks.length > 0 ? 'low' : 'low',
            risks: risks
        };
    }

    extractKeywords(text) {
        return text.split(/\s+/)
            .filter(word => word.length > 2)
            .filter(word => !['the', 'and', 'for', 'are', 'with', 'not', 'you', 'that', 'this', 'from'].includes(word));
    }

    /**
     * Get explainability report for a code ID
     */
    getReport(codeId) {
        return this.attributionHistory.get(codeId);
    }

    /**
     * Get all explainability reports
     */
    getAllReports() {
        return Array.from(this.attributionHistory.values());
    }

    /**
     * Export explainability data
     */
    exportData() {
        return {
            reports: this.getAllReports(),
            statistics: this.generateStatistics(),
            modelInfo: this.getModelInfo()
        };
    }

    generateStatistics() {
        const reports = this.getAllReports();
        
        return {
            totalReports: reports.length,
            averageConfidence: reports.reduce((sum, r) => sum + r.confidence.overall, 0) / reports.length,
            confidenceDistribution: this.calculateConfidenceDistribution(reports),
            riskDistribution: this.calculateRiskDistribution(reports),
            mostCommonFrameworks: this.getMostCommonFrameworks(reports)
        };
    }

    calculateConfidenceDistribution(reports) {
        const distribution = { high: 0, medium: 0, low: 0, 'very-low': 0 };
        
        reports.forEach(report => {
            distribution[report.confidence.level]++;
        });

        return distribution;
    }

    calculateRiskDistribution(reports) {
        const distribution = { low: 0, medium: 0, high: 0, critical: 0 };
        
        reports.forEach(report => {
            distribution[report.riskAssessment.overall]++;
        });

        return distribution;
    }

    getMostCommonFrameworks(reports) {
        const frameworkCount = {};
        
        reports.forEach(report => {
            report.attribution.sources.forEach(source => {
                if (source.type === 'framework') {
                    frameworkCount[source.name] = (frameworkCount[source.name] || 0) + 1;
                }
            });
        });

        return Object.entries(frameworkCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));
    }

    getModelInfo() {
        return {
            versions: Array.from(this.modelVersions.entries()),
            lastUpdated: new Date().toISOString()
        };
    }
}

export default ExplainabilityEngine;
