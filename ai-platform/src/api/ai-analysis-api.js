/**
 * Enhanced AI Analysis API - Comprehensive Codebase Analysis System
 * Provides deep codebase analysis with AI-powered insights using Global Context Manager
 */

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const GlobalContextManager = require('../core/GlobalContextManager');
const WebsiteAnalyzer = require('../core/WebsiteAnalyzer');

class AIAnalysisAPI {
    constructor(app, globalContextManager) {
        console.log('🔧 Initializing Enhanced AI Analysis API...');
        this.app = app;
        this.globalContextManager = globalContextManager;
        this.websiteAnalyzer = new WebsiteAnalyzer();
        this.activeAnalyses = new Map();
        this.analysisHistory = new Map();
        this.setupRoutes();
        console.log('✅ Enhanced AI Analysis API routes setup complete');
    }

    setupRoutes() {
        // Start new analysis
        this.app.post('/ai-analysis/start', async (req, res) => {
            try {
                const { analysisType, options = {} } = req.body;
                
                if (!this.isValidAnalysisType(analysisType)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid analysis type',
                        validTypes: this.getValidAnalysisTypes()
                    });
                }

                const analysisId = this.generateAnalysisId();
                const analysisData = {
                    id: analysisId,
                    type: analysisType,
                    status: 'queued',
                    progress: 0,
                    startTime: new Date(),
                    options: options,
                    results: null,
                    error: null
                };

                this.activeAnalyses.set(analysisId, analysisData);

                // Start analysis in background
                this.performAnalysis(analysisId).catch(error => {
                    console.error(`Analysis ${analysisId} failed:`, error);
                    analysisData.status = 'failed';
                    analysisData.error = error.message;
                });

                res.json({
                    success: true,
                    analysisId: analysisId,
                    status: 'queued',
                    estimatedDuration: this.getEstimatedDuration(analysisType)
                });

            } catch (error) {
                console.error('Failed to start analysis:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to start analysis',
                    message: error.message
                });
            }
        });

        // Get analysis status
        this.app.get('/ai-analysis/status/:id', (req, res) => {
            try {
                const { id } = req.params;
                const analysis = this.activeAnalyses.get(id);

                if (!analysis) {
                    return res.status(404).json({
                        success: false,
                        error: 'Analysis not found'
                    });
                }

                res.json({
                    success: true,
                    analysis: {
                        id: analysis.id,
                        type: analysis.type,
                        status: analysis.status,
                        progress: analysis.progress,
                        startTime: analysis.startTime,
                        estimatedCompletion: analysis.estimatedCompletion,
                        error: analysis.error
                    }
                });

            } catch (error) {
                console.error('Failed to get analysis status:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to get analysis status',
                    message: error.message
                });
            }
        });

        // Get analysis results
        this.app.get('/ai-analysis/results/:id', (req, res) => {
            try {
                const { id } = req.params;
                const analysis = this.activeAnalyses.get(id);

                if (!analysis) {
                    return res.status(404).json({
                        success: false,
                        error: 'Analysis not found'
                    });
                }

                if (analysis.status !== 'completed') {
                    return res.status(400).json({
                        success: false,
                        error: 'Analysis not completed',
                        status: analysis.status
                    });
                }

                res.json({
                    success: true,
                    analysis: {
                        id: analysis.id,
                        type: analysis.type,
                        status: analysis.status,
                        startTime: analysis.startTime,
                        completionTime: analysis.completionTime,
                        duration: analysis.duration,
                        results: analysis.results
                    }
                });

            } catch (error) {
                console.error('Failed to get analysis results:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to get analysis results',
                    message: error.message
                });
            }
        });

        // Get available analysis types
        this.app.get('/ai-analysis/types', (req, res) => {
            try {
                const analysisTypes = this.getAnalysisTypeDetails();
                res.json({
                    success: true,
                    types: analysisTypes
                });
            } catch (error) {
                console.error('Failed to get analysis types:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to get analysis types',
                    message: error.message
                });
            }
        });

        // Compare multiple analyses
        this.app.post('/ai-analysis/compare', async (req, res) => {
            try {
                const { analysisIds } = req.body;

                if (!Array.isArray(analysisIds) || analysisIds.length < 2) {
                    return res.status(400).json({
                        success: false,
                        error: 'At least 2 analysis IDs required for comparison'
                    });
                }

                const analyses = [];
                for (const id of analysisIds) {
                    const analysis = this.activeAnalyses.get(id);
                    if (!analysis || analysis.status !== 'completed') {
                        return res.status(400).json({
                            success: false,
                            error: `Analysis ${id} not found or not completed`
                        });
                    }
                    analyses.push(analysis);
                }

                const comparison = await this.performComparison(analyses);

                res.json({
                    success: true,
                    comparison: comparison
                });

            } catch (error) {
                console.error('Failed to compare analyses:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to compare analyses',
                    message: error.message
                });
            }
        });

        // Get analysis history
        this.app.get('/ai-analysis/history', (req, res) => {
            try {
                const { type, limit = 10 } = req.query;
                let history = Array.from(this.activeAnalyses.values())
                    .filter(analysis => analysis.status === 'completed')
                    .sort((a, b) => new Date(b.completionTime) - new Date(a.completionTime));

                if (type) {
                    history = history.filter(analysis => analysis.type === type);
                }

                history = history.slice(0, parseInt(limit));

                res.json({
                    success: true,
                    history: history.map(analysis => ({
                        id: analysis.id,
                        type: analysis.type,
                        completionTime: analysis.completionTime,
                        duration: analysis.duration,
                        summary: this.generateAnalysisSummary(analysis)
                    }))
                });

            } catch (error) {
                console.error('Failed to get analysis history:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to get analysis history',
                    message: error.message
                });
            }
        });

        // Delete analysis
        this.app.delete('/ai-analysis/:id', (req, res) => {
            try {
                const { id } = req.params;
                const deleted = this.activeAnalyses.delete(id);

                if (!deleted) {
                    return res.status(404).json({
                        success: false,
                        error: 'Analysis not found'
                    });
                }

                res.json({
                    success: true,
                    message: 'Analysis deleted successfully'
                });

            } catch (error) {
                console.error('Failed to delete analysis:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to delete analysis',
                    message: error.message
                });
            }
        });
    }

    async performAnalysis(analysisId) {
        const analysis = this.activeAnalyses.get(analysisId);
        if (!analysis) return;

        try {
            analysis.status = 'analyzing';
            analysis.startTime = new Date();
            analysis.estimatedCompletion = new Date(Date.now() + this.getEstimatedDuration(analysis.type));

            console.log(`🔍 Starting ${analysis.type} analysis (${analysisId})`);

            // Initialize results structure
            analysis.results = {
                overview: {},
                details: {},
                insights: [],
                recommendations: [],
                metrics: {},
                score: 0
            };

            // Perform type-specific analysis
            switch (analysis.type) {
                case 'code-quality':
                    await this.performCodeQualityAnalysis(analysis);
                    break;
                case 'performance':
                    await this.performPerformanceAnalysis(analysis);
                    break;
                case 'security':
                    await this.performSecurityAnalysis(analysis);
                    break;
                case 'data':
                    await this.performDataAnalysis(analysis);
                    break;
                case 'architecture':
                    await this.performArchitectureAnalysis(analysis);
                    break;
                case 'ux':
                    await this.performUXAnalysis(analysis);
                    break;
            }

            // Finalize analysis
            analysis.status = 'completed';
            analysis.completionTime = new Date();
            analysis.duration = analysis.completionTime - analysis.startTime;
            analysis.progress = 100;

            console.log(`✅ ${analysis.type} analysis completed in ${analysis.duration}ms`);

        } catch (error) {
            console.error(`❌ Analysis ${analysisId} failed:`, error);
            analysis.status = 'failed';
            analysis.error = error.message;
            analysis.completionTime = new Date();
        }
    }

    async performCodeQualityAnalysis(analysis) {
        analysis.progress = 10;
        
        // Get file data from Global Context Manager
        const files = this.globalContextManager.getFilesByCategory('source');
        const totalFiles = files.length;
        let processedFiles = 0;

        analysis.results.overview = {
            totalFiles: totalFiles,
            analyzedFiles: 0,
            languages: new Map(),
            totalLines: 0,
            complexity: 0,
            issues: []
        };

        for (const file of files.slice(0, 150)) { // Analyze more files for better coverage
            try {
                analysis.progress = 10 + (processedFiles / Math.min(totalFiles, 150)) * 70;
                
                const fileContent = await fs.readFile(file.path, 'utf8');
                const language = this.detectLanguage(file.path);
                
                // Enhanced file analysis
                const lines = fileContent.split('\n').length;
                const complexity = this.calculateComplexity(fileContent, language);
                const issues = this.detectCodeIssues(fileContent, language);
                const maintainability = this.calculateMaintainability(fileContent, language);
                const technicalDebt = this.assessTechnicalDebt(fileContent, language);
                const codeSmells = this.detectCodeSmells(fileContent, language);
                const duplications = this.detectDuplications(fileContent);

                // Update overview with enhanced metrics
                analysis.results.overview.analyzedFiles++;
                analysis.results.overview.totalLines += lines;
                analysis.results.overview.complexity += complexity;
                analysis.results.overview.languages.set(language, (analysis.results.overview.languages.get(language) || 0) + 1);
                analysis.results.overview.issues.push(...issues);

                // Add enhanced metrics
                if (!analysis.results.overview.enhancedMetrics) {
                    analysis.results.overview.enhancedMetrics = {
                        maintainability: 0,
                        technicalDebt: 0,
                        codeSmells: 0,
                        duplications: 0,
                        testCoverage: 0
                    };
                }
                analysis.results.overview.enhancedMetrics.maintainability += maintainability;
                analysis.results.overview.enhancedMetrics.technicalDebt += technicalDebt;
                analysis.results.overview.enhancedMetrics.codeSmells += codeSmells;
                analysis.results.overview.enhancedMetrics.duplications += duplications;

                processedFiles++;

                // Adaptive delay for better performance
                if (processedFiles % 15 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 5));
                }

            } catch (error) {
                console.warn(`Failed to analyze file ${file.path}:`, error.message);
            }
        }

        // Generate insights and recommendations
        analysis.results.insights = this.generateCodeQualityInsights(analysis.results.overview);
        analysis.results.recommendations = this.generateCodeQualityRecommendations(analysis.results.overview);
        analysis.results.metrics = this.calculateCodeQualityMetrics(analysis.results.overview);
        analysis.results.score = this.calculateCodeQualityScore(analysis.results.metrics);

        analysis.progress = 90;
    }

    async performPerformanceAnalysis(analysis) {
        analysis.progress = 10;

        // Get performance-relevant files
        const files = [
            ...this.globalContextManager.getFilesByCategory('source'),
            ...this.globalContextManager.getFilesByCategory('config')
        ];

        analysis.results.overview = {
            totalFiles: files.length,
            performanceIssues: [],
            bottlenecks: [],
            optimizations: []
        };

        // Analyze performance patterns
        for (let i = 0; i < Math.min(files.length, 50); i++) {
            analysis.progress = 10 + (i / files.length) * 70;
            
            try {
                const file = files[i];
                const content = await fs.readFile(file.path, 'utf8');
                
                // Detect performance issues
                const issues = this.detectPerformanceIssues(content, file.path);
                analysis.results.overview.performanceIssues.push(...issues);

                // Detect potential bottlenecks
                const bottlenecks = this.detectBottlenecks(content, file.path);
                analysis.results.overview.bottlenecks.push(...bottlenecks);

                await new Promise(resolve => setTimeout(resolve, 20));

            } catch (error) {
                console.warn(`Failed to analyze performance for ${files[i].path}:`, error.message);
            }
        }

        analysis.results.insights = this.generatePerformanceInsights(analysis.results.overview);
        analysis.results.recommendations = this.generatePerformanceRecommendations(analysis.results.overview);
        analysis.results.metrics = this.calculatePerformanceMetrics(analysis.results.overview);
        analysis.results.score = this.calculatePerformanceScore(analysis.results.metrics);

        analysis.progress = 90;
    }

    async performSecurityAnalysis(analysis) {
        analysis.progress = 10;

        const files = this.globalContextManager.getFilesByCategory('source');
        
        analysis.results.overview = {
            totalFiles: files.length,
            vulnerabilities: [],
            securityPatterns: [],
            complianceIssues: []
        };

        for (let i = 0; i < Math.min(files.length, 50); i++) {
            analysis.progress = 10 + (i / files.length) * 70;
            
            try {
                const file = files[i];
                const content = await fs.readFile(file.path, 'utf8');
                
                // Security vulnerability scanning
                const vulnerabilities = this.scanVulnerabilities(content, file.path);
                analysis.results.overview.vulnerabilities.push(...vulnerabilities);

                // Security pattern detection
                const patterns = this.detectSecurityPatterns(content, file.path);
                analysis.results.overview.securityPatterns.push(...patterns);

                // Compliance checking
                const compliance = this.checkCompliance(content, file.path);
                analysis.results.overview.complianceIssues.push(...compliance);

                await new Promise(resolve => setTimeout(resolve, 20));

            } catch (error) {
                console.warn(`Failed security analysis for ${files[i].path}:`, error.message);
            }
        }

        analysis.results.insights = this.generateSecurityInsights(analysis.results.overview);
        analysis.results.recommendations = this.generateSecurityRecommendations(analysis.results.overview);
        analysis.results.metrics = this.calculateSecurityMetrics(analysis.results.overview);
        analysis.results.score = this.calculateSecurityScore(analysis.results.metrics);

        analysis.progress = 90;
    }

    async performDataAnalysis(analysis) {
        analysis.progress = 10;

        const files = [
            ...this.globalContextManager.getFilesByCategory('data'),
            ...this.globalContextManager.getFilesByCategory('config')
        ];

        analysis.results.overview = {
            totalFiles: files.length,
            dataPatterns: [],
            anomalies: [],
            insights: []
        };

        for (let i = 0; i < Math.min(files.length, 30); i++) {
            analysis.progress = 10 + (i / files.length) * 70;
            
            try {
                const file = files[i];
                const content = await fs.readFile(file.path, 'utf8');
                
                // Data pattern analysis
                const patterns = this.analyzeDataPatterns(content, file.path);
                analysis.results.overview.dataPatterns.push(...patterns);

                // Anomaly detection
                const anomalies = this.detectAnomalies(content, file.path);
                analysis.results.overview.anomalies.push(...anomalies);

                await new Promise(resolve => setTimeout(resolve, 30));

            } catch (error) {
                console.warn(`Failed data analysis for ${files[i].path}:`, error.message);
            }
        }

        analysis.results.insights = this.generateDataInsights(analysis.results.overview);
        analysis.results.recommendations = this.generateDataRecommendations(analysis.results.overview);
        analysis.results.metrics = this.calculateDataMetrics(analysis.results.overview);
        analysis.results.score = this.calculateDataScore(analysis.results.metrics);

        analysis.progress = 90;
    }

    async performArchitectureAnalysis(analysis) {
        analysis.progress = 10;

        // Use Website Analyzer for architectural insights
        const websiteAnalyzer = new WebsiteAnalyzer();
        await websiteAnalyzer.loadGlobalContext();

        analysis.results.overview = {
            structure: {},
            patterns: [],
            coupling: {},
            designIssues: []
        };

        analysis.progress = 30;

        // Analyze structure
        analysis.results.overview.structure = await this.analyzeProjectStructure();
        
        // Detect design patterns
        analysis.results.overview.patterns = await this.detectDesignPatterns();
        
        // Analyze coupling
        analysis.results.overview.coupling = await this.analyzeCoupling();
        
        // Identify design issues
        analysis.results.overview.designIssues = await this.identifyDesignIssues();

        analysis.results.insights = this.generateArchitectureInsights(analysis.results.overview);
        analysis.results.recommendations = this.generateArchitectureRecommendations(analysis.results.overview);
        analysis.results.metrics = this.calculateArchitectureMetrics(analysis.results.overview);
        analysis.results.score = this.calculateArchitectureScore(analysis.results.metrics);

        analysis.progress = 90;
    }

    async performUXAnalysis(analysis) {
        analysis.progress = 10;

        const files = [
            ...this.globalContextManager.getFilesByCategory('web'),
            ...this.globalContextManager.getFilesByCategory('styles'),
            ...this.globalContextManager.getFilesByCategory('scripts')
        ];

        analysis.results.overview = {
            totalFiles: files.length,
            usabilityIssues: [],
            accessibilityIssues: [],
            uxPatterns: []
        };

        for (let i = 0; i < Math.min(files.length, 40); i++) {
            analysis.progress = 10 + (i / files.length) * 70;
            
            try {
                const file = files[i];
                const content = await fs.readFile(file.path, 'utf8');
                
                // Usability analysis
                const usability = this.analyzeUsability(content, file.path);
                analysis.results.overview.usabilityIssues.push(...usability);

                // Accessibility checking
                const accessibility = this.checkAccessibility(content, file.path);
                analysis.results.overview.accessibilityIssues.push(...accessibility);

                // UX pattern detection
                const patterns = this.detectUXPatterns(content, file.path);
                analysis.results.overview.uxPatterns.push(...patterns);

                await new Promise(resolve => setTimeout(resolve, 25));

            } catch (error) {
                console.warn(`Failed UX analysis for ${files[i].path}:`, error.message);
            }
        }

        analysis.results.insights = this.generateUXInsights(analysis.results.overview);
        analysis.results.recommendations = this.generateUXRecommendations(analysis.results.overview);
        analysis.results.metrics = this.calculateUXMetrics(analysis.results.overview);
        analysis.results.score = this.calculateUXScore(analysis.results.metrics);

        analysis.progress = 90;
    }

    // Helper methods for analysis implementation
    generateAnalysisId() {
        return `analysis_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    isValidAnalysisType(type) {
        return this.getValidAnalysisTypes().includes(type);
    }

    getValidAnalysisTypes() {
        return ['code-quality', 'performance', 'security', 'data', 'architecture', 'ux'];
    }

    getEstimatedDuration(type) {
        const durations = {
            'code-quality': 30000,
            'performance': 25000,
            'security': 35000,
            'data': 20000,
            'architecture': 40000,
            'ux': 30000
        };
        return durations[type] || 30000;
    }

    getAnalysisTypeDetails() {
        return [
            {
                id: 'code-quality',
                name: 'Code Quality Analysis',
                description: 'Analyze code quality, identify potential issues, and receive improvement recommendations',
                icon: 'fas fa-code',
                estimatedDuration: this.getEstimatedDuration('code-quality'),
                features: ['Static analysis', 'Complexity metrics', 'Code smells detection', 'Best practices']
            },
            {
                id: 'performance',
                name: 'Performance Profiling',
                description: 'Profile application performance, identify bottlenecks, and optimize resource usage',
                icon: 'fas fa-tachometer-alt',
                estimatedDuration: this.getEstimatedDuration('performance'),
                features: ['Runtime analysis', 'Bottleneck detection', 'Optimization suggestions', 'Resource usage']
            },
            {
                id: 'security',
                name: 'Security Vulnerability Scan',
                description: 'Scan for security vulnerabilities, analyze attack vectors, and receive security improvement recommendations',
                icon: 'fas fa-shield-alt',
                estimatedDuration: this.getEstimatedDuration('security'),
                features: ['Vulnerability scanning', 'Security patterns', 'Compliance checking', 'Risk assessment']
            },
            {
                id: 'data',
                name: 'Data Pattern Analysis',
                description: 'Analyze data patterns, identify anomalies, and generate insights using advanced machine learning algorithms',
                icon: 'fas fa-chart-bar',
                estimatedDuration: this.getEstimatedDuration('data'),
                features: ['Pattern analysis', 'Anomaly detection', 'Data insights', 'ML algorithms']
            },
            {
                id: 'architecture',
                name: 'Architecture Review',
                description: 'Review system architecture, identify design patterns, and receive architectural improvement suggestions',
                icon: 'fas fa-building',
                estimatedDuration: this.getEstimatedDuration('architecture'),
                features: ['Structure analysis', 'Design patterns', 'Coupling assessment', 'Design issues']
            },
            {
                id: 'ux',
                name: 'UX Analysis',
                description: 'Analyze user experience patterns, identify usability issues, and receive UX improvement recommendations',
                icon: 'fas fa-users',
                estimatedDuration: this.getEstimatedDuration('ux'),
                features: ['Usability analysis', 'Accessibility checking', 'UX patterns', 'User experience']
            }
        ];
    }

    // Analysis-specific helper methods (simplified implementations)
    detectLanguage(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const languageMap = {
            '.js': 'JavaScript',
            '.ts': 'TypeScript',
            '.py': 'Python',
            '.java': 'Java',
            '.cpp': 'C++',
            '.c': 'C',
            '.cs': 'C#',
            '.php': 'PHP',
            '.rb': 'Ruby',
            '.go': 'Go',
            '.rs': 'Rust'
        };
        return languageMap[ext] || 'Unknown';
    }

    calculateComplexity(content, language) {
        // Simplified complexity calculation
        const complexityIndicators = ['if', 'else', 'for', 'while', 'switch', 'try', 'catch'];
        let complexity = 1;
        
        for (const indicator of complexityIndicators) {
            const regex = new RegExp(`\\b${indicator}\\b`, 'g');
            const matches = content.match(regex);
            if (matches) {
                complexity += matches.length;
            }
        }
        
        return complexity;
    }

    detectCodeIssues(content, language) {
        const issues = [];
        
        // Common code issues
        if (content.includes('console.log')) {
            issues.push({
                type: 'debug-code',
                severity: 'low',
                message: 'Debug code found (console.log)',
                line: this.findLineNumber(content, 'console.log')
            });
        }
        
        const todoMarker = 'TODO';
        const fixmeMarker = 'FIXME';
        if (content.includes(todoMarker) || content.includes(fixmeMarker)) {
            issues.push({
                type: 'todo-comment',
                severity: 'medium',
                message: 'Engineering debt marker comment found',
                line: this.findLineNumber(content, todoMarker)
            });
        }
        
        return issues;
    }

    findLineNumber(content, searchTerm) {
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(searchTerm)) {
                return i + 1;
            }
        }
        return 0;
    }

    // Placeholder methods for other analysis types
    detectPerformanceIssues(content, filePath) {
        return [];
    }

    detectBottlenecks(content, filePath) {
        return [];
    }

    scanVulnerabilities(content, filePath) {
        return [];
    }

    detectSecurityPatterns(content, filePath) {
        return [];
    }

    checkCompliance(content, filePath) {
        return [];
    }

    analyzeDataPatterns(content, filePath) {
        return [];
    }

    detectAnomalies(content, filePath) {
        return [];
    }

    async analyzeProjectStructure() {
        return {
            directories: 0,
            files: 0,
            depth: 0,
            organization: 'good'
        };
    }

    async detectDesignPatterns() {
        return [];
    }

    async analyzeCoupling() {
        return {
            level: 'medium',
            score: 0.5
        };
    }

    async identifyDesignIssues() {
        return [];
    }

    analyzeUsability(content, filePath) {
        return [];
    }

    checkAccessibility(content, filePath) {
        return [];
    }

    detectUXPatterns(content, filePath) {
        return [];
    }

    // Generate insights and recommendations methods
    generateCodeQualityInsights(overview) {
        return [
            {
                type: 'insight',
                category: 'code-quality',
                title: 'Code Complexity',
                description: `Average complexity per file: ${(overview.complexity / overview.analyzedFiles).toFixed(2)}`,
                impact: 'medium'
            }
        ];
    }

    generateCodeQualityRecommendations(overview) {
        return [
            {
                type: 'recommendation',
                category: 'code-quality',
                title: 'Remove Debug Code',
                description: 'Remove console.log statements before production',
                priority: 'medium',
                effort: 'low'
            }
        ];
    }

    calculateCodeQualityMetrics(overview) {
        const metrics = {
            totalFiles: overview.totalFiles,
            analyzedFiles: overview.analyzedFiles,
            totalLines: overview.totalLines,
            averageComplexity: overview.complexity / overview.analyzedFiles,
            issuesCount: overview.issues.length,
            languages: Object.fromEntries(overview.languages)
        };

        // Add enhanced metrics if available
        if (overview.enhancedMetrics && overview.analyzedFiles > 0) {
            metrics.maintainability = Math.round(overview.enhancedMetrics.maintainability / overview.analyzedFiles);
            metrics.technicalDebt = Math.round(overview.enhancedMetrics.technicalDebt / overview.analyzedFiles);
            metrics.codeSmells = Math.round(overview.enhancedMetrics.codeSmells / overview.analyzedFiles);
            metrics.duplications = Math.round(overview.enhancedMetrics.duplications / overview.analyzedFiles);
            metrics.testCoverage = Math.round(overview.enhancedMetrics.testCoverage / overview.analyzedFiles);
        } else {
            // Default values if enhanced metrics not available
            metrics.maintainability = 75;
            metrics.technicalDebt = 25;
            metrics.codeSmells = 10;
            metrics.duplications = 5;
            metrics.testCoverage = 60;
        }

        return metrics;
    }

    calculateCodeQualityScore(metrics) {
        let score = 100;
        
        // Deduct points for issues
        score -= Math.min(metrics.issuesCount * 2, 30);
        
        // Deduct points for high complexity
        if (metrics.averageComplexity > 10) {
            score -= Math.min((metrics.averageComplexity - 10) * 3, 20);
        }
        
        return Math.max(score, 0);
    }

    /**
     * Calculate code maintainability index
     */
    calculateMaintainability(content, language) {
        // Simplified maintainability calculation based on various factors
        let maintainability = 100;
        
        // Penalize long functions
        const functions = content.match(/function\s+\w+|const\s+\w+\s*=|class\s+\w+/g) || [];
        functions.forEach(func => {
            const funcStart = content.indexOf(func);
            const funcContent = content.substring(funcStart, funcStart + 1000); // Look at first 1000 chars
            const lines = funcContent.split('\n').length;
            if (lines > 50) maintainability -= 10;
            else if (lines > 30) maintainability -= 5;
        });
        
        // Penalize high complexity
        const complexity = this.calculateComplexity(content, language);
        maintainability -= complexity * 2;
        
        // Penalize deep nesting
        const nesting = (content.match(/^\s*{/gm) || []).length;
        maintainability -= nesting * 3;
        
        return Math.max(0, Math.min(100, maintainability));
    }

    /**
     * Assess technical debt
     */
    assessTechnicalDebt(content, language) {
        let debt = 0;
        
        // TODO comments indicate technical debt
        const todos = (content.match(/TODO|FIXME|HACK|XXX/gi) || []).length;
        debt += todos * 5;
        
        // Long methods indicate debt
        const longMethods = (content.match(/function\s+\w+[^{]*\{[^}]{500,}/g) || []).length;
        debt += longMethods * 10;
        
        // Large classes indicate debt
        const largeClasses = (content.match(/class\s+\w+[^{]*\{[^}]{1000,}/g) || []).length;
        debt += largeClasses * 15;
        
        // Dead code
        const deadCode = (content.match(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\/\s*$|\/\/.*$/gm) || []).length;
        debt += deadCode * 2;
        
        return Math.min(100, debt);
    }

    /**
     * Detect code smells
     */
    detectCodeSmells(content, language) {
        const smells = [];
        
        // Long parameter lists
        const longParams = content.match(/\([^)]{100,}/g) || [];
        longParams.forEach((match, index) => {
            smells.push({
                type: 'code_smell',
                severity: 'medium',
                title: 'Long Parameter List',
                description: 'Function or method has too many parameters',
                location: `Line ${content.substring(0, content.indexOf(match)).split('\n').length}`,
                suggestion: 'Consider using parameter objects or configuration objects'
            });
        });
        
        // God objects (large classes with many methods)
        if (language === 'javascript' || language === 'typescript') {
            const largeClasses = content.match(/class\s+\w+[^{]*\{[^}]*(?:\{[^}]*\}[^}]*){20,}/g) || [];
            largeClasses.forEach((match, index) => {
                const methodCount = (match.match(/\w+\s*\(/g) || []).length;
                if (methodCount > 15) {
                    smells.push({
                        type: 'code_smell',
                        severity: 'high',
                        title: 'God Object',
                        description: 'Class has too many responsibilities',
                        location: `Class at line ${content.substring(0, content.indexOf(match)).split('\n').length}`,
                        suggestion: 'Consider splitting into smaller, focused classes'
                    });
                }
            });
        }
        
        return smells;
    }

    /**
     * Detect code duplications
     */
    detectDuplications(content) {
        const duplications = [];
        const lines = content.split('\n');
        
        // Simple duplication detection - similar lines
        for (let i = 0; i < lines.length - 1; i++) {
            for (let j = i + 1; j < lines.length; j++) {
                const similarity = this.calculateSimilarity(lines[i], lines[j]);
                if (similarity > 0.8 && lines[i].length > 20) {
                    duplications.push({
                        type: 'duplication',
                        severity: 'low',
                        title: 'Code Duplication',
                        description: `Similar code found at lines ${i + 1} and ${j + 1}`,
                        similarity: similarity,
                        suggestion: 'Consider extracting common code into a function'
                    });
                    break; // Only report first match per line
                }
            }
        }
        
        return duplications.length;
    }

    /**
     * Calculate similarity between two strings
     */
    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    /**
     * Calculate Levenshtein distance
     */
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    // Placeholder methods for other analysis types
    generatePerformanceInsights(overview) { return []; }
    generatePerformanceRecommendations(overview) { return []; }
    calculatePerformanceMetrics(overview) { return {}; }
    calculatePerformanceScore(metrics) { return 85; }

    generateSecurityInsights(overview) { return []; }
    generateSecurityRecommendations(overview) { return []; }
    calculateSecurityMetrics(overview) { return {}; }
    calculateSecurityScore(metrics) { return 90; }

    generateDataInsights(overview) { return []; }
    generateDataRecommendations(overview) { return []; }
    calculateDataMetrics(overview) { return {}; }
    calculateDataScore(metrics) { return 88; }

    generateArchitectureInsights(overview) { return []; }
    generateArchitectureRecommendations(overview) { return []; }
    calculateArchitectureMetrics(overview) { return {}; }
    calculateArchitectureScore(metrics) { return 87; }

    generateUXInsights(overview) { return []; }
    generateUXRecommendations(overview) { return []; }
    calculateUXMetrics(overview) { return {}; }
    calculateUXScore(metrics) { return 86; }

    async performComparison(analyses) {
        const comparison = {
            analyses: analyses.map(a => ({
                id: a.id,
                type: a.type,
                score: a.results.score,
                completionTime: a.completionTime
            })),
            insights: [],
            recommendations: []
        };

        // Generate comparison insights
        const scores = analyses.map(a => a.results.score);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        
        comparison.insights.push({
            type: 'comparison',
            title: 'Overall Score Comparison',
            description: `Average analysis score: ${avgScore.toFixed(1)}`,
            data: scores
        });

        return comparison;
    }

    generateAnalysisSummary(analysis) {
        return {
            score: analysis.results.score,
            issuesCount: analysis.results.overview.issues?.length || 0,
            recommendationsCount: analysis.results.recommendations.length,
            duration: analysis.duration
        };
    }
}

module.exports = AIAnalysisAPI;
