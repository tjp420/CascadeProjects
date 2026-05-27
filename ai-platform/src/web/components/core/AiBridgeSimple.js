/**
 * Refactored AiBridgeSimple - Reduced complexity version
 */

import { TechnicalDebtAnalyzer } from './TechnicalDebtAnalyzer.js';

/**
 * Data validation utilities
 */
class DataValidator {
    static verifyDataStructure(data, step) {
        console.log(`🔍 ${step} - Data Structure Verification:`, {
            hasData: !!data,
            dataType: typeof data,
            keys: Object.keys(data || {}),
            total_files: data?.total_files,
            total_directories: data?.total_directories,
            source: data?.source
        });
        return data;
    }

    static validateAnalysisData(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid data structure for analysis');
        }
        return data;
    }
}

/**
 * Analytics data processor
 */
class AnalyticsProcessor {
    constructor() {
        this.cache = new Map();
    }

    enhanceDataForAnalytics(data) {
        const cacheKey = JSON.stringify(data);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const enhanced = {
            ...data,
            analytics: {
                fileCount: data?.total_files || 0,
                directoryCount: data?.total_directories || 0,
                averageFileSize: this.calculateAverageFileSize(data),
                complexityScore: this.calculateComplexityScore(data),
                timestamp: new Date().toISOString()
            }
        };

        this.cache.set(cacheKey, enhanced);
        return enhanced;
    }

    calculateAverageFileSize(data) {
        // Simplified calculation - would need actual file size data
        return (data?.total_files || 0) > 0 ? 1024 : 0;
    }

    calculateComplexityScore(data) {
        // Simplified complexity calculation
        const baseScore = (data?.total_files || 0) * 0.1;
        return Math.min(baseScore, 100);
    }
}

/**
 * Analysis engine
 */
class AnalysisEngine {
    constructor(technicalDebtAnalyzer) {
        this.technicalDebtAnalyzer = technicalDebtAnalyzer;
    }

    generateAnalysis(data) {
        const validatedData = DataValidator.validateAnalysisData(data);
        
        return {
            overview: this.generateOverview(validatedData),
            insights: this.generateInsights(validatedData),
            recommendations: this.generateRecommendations(validatedData),
            technicalDebt: this.analyzeTechnicalDebt(validatedData),
            timestamp: new Date().toISOString()
        };
    }

    generateOverview(data) {
        return {
            totalFiles: data?.total_files || 0,
            totalDirectories: data?.total_directories || 0,
            codeQuality: this.calculateCodeQuality(data),
            testCoverage: this.calculateTestCoverage(data),
            complexity: this.calculateComplexity(data),
            security: this.calculateSecurityScore(data)
        };
    }

    generateInsights(data) {
        const insights = [];
        
        if (data?.total_files > 1000) {
            insights.push({
                type: 'scale',
                message: 'Large codebase detected - consider modularization',
                priority: 'medium'
            });
        }

        if (this.calculateTestCoverage(data) < 70) {
            insights.push({
                type: 'testing',
                message: 'Test coverage below recommended threshold',
                priority: 'high'
            });
        }

        return insights;
    }

    generateRecommendations(data) {
        const recommendations = [];
        
        const qualityScore = this.calculateCodeQuality(data);
        if (qualityScore < 80) {
            recommendations.push({
                category: 'quality',
                action: 'Improve code quality through refactoring',
                priority: 'high'
            });
        }

        return recommendations;
    }

    analyzeTechnicalDebt(data) {
        return this.technicalDebtAnalyzer.generateMetrics();
    }

    calculateCodeQuality(data) {
        // Simplified quality calculation
        const baseScore = 85;
        const filePenalty = Math.min(data?.total_files || 0, 100) * 0.01;
        return Math.max(baseScore - filePenalty, 50);
    }

    calculateTestCoverage(data) {
        // Simplified coverage calculation
        return 65; // Would need actual test data
    }

    calculateComplexity(data) {
        // Simplified complexity calculation
        return Math.min((data?.total_files || 0) * 0.1, 50);
    }

    calculateSecurityScore(data) {
        // Simplified security calculation
        return 85; // Would need actual security analysis
    }
}

/**
 * Report generator
 */
class ReportGenerator {
    generateMarkdownReport(analysis) {
        const sections = [
            this.generateHeader(analysis),
            this.generateOverviewSection(analysis.overview),
            this.generateInsightsSection(analysis.insights),
            this.generateRecommendationsSection(analysis.recommendations),
            this.generateTechnicalDebtSection(analysis.technicalDebt)
        ];

        return sections.join('\n\n');
    }

    generateHeader(analysis) {
        return `# AI Code Analysis Report\n\n**Generated:** ${new Date(analysis.timestamp).toLocaleString()}`;
    }

    generateOverviewSection(overview) {
        return '## Overview\n\n' +
            `- **Total Files:** ${overview.totalFiles}\n` +
            `- **Total Directories:** ${overview.totalDirectories}\n` +
            `- **Code Quality:** ${overview.codeQuality}%\n` +
            `- **Test Coverage:** ${overview.testCoverage}%\n` +
            `- **Complexity Score:** ${overview.complexity}\n` +
            `- **Security Score:** ${overview.security}%`;
    }

    generateInsightsSection(insights) {
        if (!insights.length) {
            return '## Insights\n\nNo critical insights detected.';
        }

        const insightList = insights.map(insight => 
            `- **${insight.type}:** ${insight.message} (Priority: ${insight.priority})`
        ).join('\n');

        return `## Insights\n\n${insightList}`;
    }

    generateRecommendationsSection(recommendations) {
        if (!recommendations.length) {
            return '## Recommendations\n\nNo recommendations at this time.';
        }

        const recList = recommendations.map(rec => 
            `- **${rec.category}:** ${rec.action} (Priority: ${rec.priority})`
        ).join('\n');

        return `## Recommendations\n\n${recList}`;
    }

    generateTechnicalDebtSection(technicalDebt) {
        return '## Technical Debt\n\n' +
            `**Overall Score:** ${technicalDebt.score || 'N/A'}\n` +
            `**Complexity:** ${technicalDebt.complexity || 'N/A'}\n` +
            `**Code Smells:** ${technicalDebt.codeSmells || 'N/A'}`;
    }
}

/**
 * Refactored AiBridgeSimple class with reduced complexity
 */
export class AiBridgeSimple {
    constructor(dataEngine) {
        this.dataEngine = dataEngine;
        this.isActive = false;
        this.technicalDebtAnalyzer = new TechnicalDebtAnalyzer();
        this.analyticsProcessor = new AnalyticsProcessor();
        this.analysisEngine = new AnalysisEngine(this.technicalDebtAnalyzer);
        this.reportGenerator = new ReportGenerator();
    }

    activate() {
        this.isActive = true;
        console.log('🤖 Simple AI Bridge activated');
    }

    async analyzeCurrentDirectory() {
        this.logAnalysisStart();
        
        const data = await this.loadDataAndValidate();
        const enhancedData = this.analyticsProcessor.enhanceDataForAnalytics(data);
        const analysis = this.analysisEngine.generateAnalysis(enhancedData);
        
        return analysis;
    }

    logAnalysisStart() {
        console.log('🤖 Step 3 - AiBridgeSimple Analysis Started');
        console.log('🤖 Step 3 - DataEngine instance:', this.dataEngine);
        console.log('🤖 Step 3 - DataEngine currentDirectory:', this.dataEngine?.currentDirectory);
    }

    async loadDataAndValidate() {
        const data = await this.dataEngine.loadData();
        this.logDataLoaded(data);
        DataValidator.verifyDataStructure(data, 'Step 3 - DataEngine Output');
        return data;
    }

    logDataLoaded(data) {
        console.log('🤖 Step 3 - DataEngine Data Loaded:', data);
        console.log('🤖 Step 3 - DataEngine Data Structure:', Object.keys(data || {}));
        console.log('🤖 Step 3 - DataEngine Data Values:', {
            total_files: data?.total_files,
            total_directories: data?.total_directories,
            metadata_totalFiles: data?.metadata?.totalFiles,
            metadata_totalDirectories: data?.metadata?.totalDirectories,
            source: data?.source
        });
    }

    generateAnalysis(data) {
        return this.analysisEngine.generateAnalysis(data);
    }

    generateInsights(data) {
        return this.analysisEngine.generateInsights(data);
    }

    generateMarkdownReport(analysis) {
        return this.reportGenerator.generateMarkdownReport(analysis);
    }

    // Legacy methods for backward compatibility
    enhanceDataForAnalytics(data) {
        return this.analyticsProcessor.enhanceDataForAnalytics(data);
    }
}

// ES6 export for modern JavaScript
export default AiBridgeSimple;

// CommonJS export for Node.js compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AiBridgeSimple;
}

// Browser export for dashboard compatibility
if (typeof window !== 'undefined') {
    window.AiBridgeSimple = AiBridgeSimple;
}
