const logger = require('../lib/production-logger.cjs');
/**
 * Roadmap Data Analyzer - Analyzes current database and codebase to generate dynamic roadmaps
 * This system replaces static mock data with real project analysis
 */

const fs = require('fs').promises;
const path = require('path');
const {
    generateCodeRoadmap,
    resolvePlatformRoot,
    sanitizeApiRouteList
} = require('../../server/lib/code-roadmap-generator.cjs');

/**
 * Roadmap data analyzer.
 */
class RoadmapDataAnalyzer {
    constructor(globalContextManager, options = {}) {
        this.globalContextManager = globalContextManager;
        this.projectRoot = options.projectRoot || process.cwd();
        this.includePaths = Array.isArray(options.includePaths)
            ? options.includePaths.filter(Boolean)
            : [];
        this.excludePatterns = Array.isArray(options.excludePatterns)
            ? options.excludePatterns.filter(Boolean)
            : [];
        this.maxStructureDepth = Number.isFinite(options.maxStructureDepth)
            ? options.maxStructureDepth
            : 2;
        this.maxKeyFilesPerDir = Number.isFinite(options.maxKeyFilesPerDir)
            ? options.maxKeyFilesPerDir
            : 12;
        this.analysisCache = new Map();
        this.lastAnalysisTime = null;
    }

    /**
     * Clear the analysis cache and reset the last analysis timestamp.
     */
    clearCache() {
        this.analysisCache.clear();
        this.lastAnalysisTime = null;
    }

    /**
     * Get statistics about the analysis cache.
     * @returns {{size:number,lastAnalysisTime:number|null,keys:string[]}}
     */
    getCacheStats() {
        return {
            size: this.analysisCache.size,
            lastAnalysisTime: this.lastAnalysisTime,
            keys: [...this.analysisCache.keys()]
        };
    }

    /**
     * Remove cache entries matching a string prefix or RegExp pattern.
     * @param {string|RegExp} keyPattern
     * @returns {number} Number of entries removed.
     */
    invalidateCache(keyPattern) {
        let removed = 0;
        for (const key of this.analysisCache.keys()) {
            const matches = keyPattern instanceof RegExp ? keyPattern.test(key) : key.includes(keyPattern);
            if (matches) {
                this.analysisCache.delete(key);
                removed++;
            }
        }
        if (this.analysisCache.size === 0) this.lastAnalysisTime = null;
        return removed;
    }

    shouldSkipDirectory(name) {
        const skip = new Set([
            'node_modules', '.git', '.svn', 'dist', 'build', 'coverage',
            'htmlcov', '__pycache__', '.next', '.nuxt', 'vendor', '.cache',
            'docs', 'archive', 'backups', 'security-reports'
        ]);
        this.excludePatterns.forEach((pattern) => skip.add(pattern));
        return skip.has(name) || name.startsWith('.');
    }

    /**
     * Analyze the current project structure and database to generate roadmap data
     */
    async analyzeProjectForRoadmap() {
        const cacheKey = `roadmap-analysis:${this.projectRoot}`;
        const now = Date.now();
        
        // Check cache (5 minute TTL)
        if (this.analysisCache.has(cacheKey) && 
            this.lastAnalysisTime && 
            (now - this.lastAnalysisTime) < 300000) {
            return this.analysisCache.get(cacheKey);
        }

        logger.debug('🔍 Analyzing project structure for dynamic roadmap generation...');

        try {
            const analysis = {
                timestamp: new Date().toISOString(),
                projectStructure: await this.analyzeProjectStructure(),
                codebaseMetrics: await this.analyzeCodebaseMetrics(),
                databaseAnalysis: await this.analyzeDatabaseStructure(),
                featureAnalysis: await this.analyzeImplementedFeatures(),
                developmentProgress: await this.calculateDevelopmentProgress(),
                recommendations: await this.generateRoadmapRecommendations(),
                aiIntegration: await this.analyzeAIIntegration()
            };

            // Generate comprehensive roadmap data (measured sprint model)
            const roadmapData = await this.generateRoadmapData(analysis);
            
            // Cache results
            this.analysisCache.set(cacheKey, roadmapData);
            this.lastAnalysisTime = now;

            logger.debug('✅ Dynamic roadmap analysis completed');
            return roadmapData;

        } catch (error) {
            console.error('❌ Failed to analyze project for roadmap:', error);
            return this.generateFallbackRoadmapData();
        }
    }

    /**
     * Analyze project structure and organization
     */
    async analyzeProjectStructure() {
        try {
            const { scanRoot, platformRoot } = resolvePlatformRoot(this.projectRoot);
            const structure = {
                projectRoot: scanRoot,
                platformRoot,
                totalDirectories: 0,
                totalFiles: 0,
                mainCategories: {},
                depthAnalysis: {},
                fileTypes: {},
                sizeAnalysis: {}
            };

            const entries = await fs.readdir(scanRoot, { withFileTypes: true });

            for (const entry of entries) {
                if (!entry.isDirectory() || this.shouldSkipDirectory(entry.name)) {
                    continue;
                }

                if (this.includePaths.length && !this.includePaths.includes(entry.name)) {
                    continue;
                }

                const dirPath = path.join(scanRoot, entry.name);
                try {
                    const dirAnalysis = await this.analyzeDirectory(dirPath, entry.name);
                    structure.mainCategories[entry.name] = dirAnalysis;
                    structure.totalDirectories += 1 + (dirAnalysis.subdirectoryCount || 0);
                    structure.totalFiles += dirAnalysis.fileCount || 0;
                } catch (error) {
                    structure.mainCategories[entry.name] = { exists: false, error: error.message };
                }
            }

            return structure;
        } catch (error) {
            console.error('Failed to analyze project structure:', error);
            return { error: error.message };
        }
    }

    /**
     * Recursively analyze directory
     */
    async analyzeDirectory(dirPath, dirName, depth = 0) {
        const analysis = {
            name: dirName,
            path: dirPath,
            exists: true,
            fileCount: 0,
            subdirectoryCount: 0,
            fileTypes: {},
            totalSize: 0,
            depth: depth,
            keyFiles: [],
            subdirectories: {}
        };

        try {
            const items = await fs.readdir(dirPath);
            
            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                const stats = await fs.stat(itemPath);
                
                if (stats.isDirectory()) {
                    if (this.shouldSkipDirectory(item)) {
                        continue;
                    }
                    analysis.subdirectoryCount++;
                    if (depth + 1 <= this.maxStructureDepth) {
                        const subAnalysis = await this.analyzeDirectory(itemPath, item, depth + 1);
                        analysis.subdirectories[item] = subAnalysis;
                    }
                } else {
                    analysis.fileCount++;
                    analysis.totalSize += stats.size;
                    
                    const ext = path.extname(item).toLowerCase();
                    analysis.fileTypes[ext] = (analysis.fileTypes[ext] || 0) + 1;
                    
                    if (this.isKeyFile(item, ext) && analysis.keyFiles.length < this.maxKeyFilesPerDir) {
                        analysis.keyFiles.push({
                            name: item,
                            size: stats.size,
                            type: ext,
                            modified: stats.mtime
                        });
                    }
                }
            }
        } catch (error) {
            analysis.error = error.message;
        }

        return analysis;
    }

    /**
     * Check if file is a key project file
     */
    isKeyFile(fileName, extension) {
        const keyPatterns = {
            '.js': /server|app|main|index|dashboard|api/gi,
            '.json': /package|config|manifest/gi,
            '.html': /index|main|dashboard/gi,
            '.md': /README|CHANGELOG|CONTRIBUTING/gi,
            '.yml': /docker|compose|config/gi,
            '.yaml': /docker|compose|config/gi
        };

        return keyPatterns[extension] && keyPatterns[extension].test(fileName);
    }

    /**
     * Analyze codebase metrics
     */
    async analyzeCodebaseMetrics() {
        try {
            const metrics = {
                totalLinesOfCode: 0,
                languages: {},
                complexity: {},
                testCoverage: 0,
                documentation: {
                    readmeFiles: 0,
                    totalDocs: 0,
                    coverage: 0
                },
                dependencies: {}
            };

            let filesToProcess = [];

            // Get file analysis from Global Context Manager
            if (this.globalContextManager) {
                const context = this.globalContextManager.getContext();
                if (context.files) {
                    filesToProcess = Object.values(context.files).map(file => ({
                        path: file.path,
                        ext: file.extension,
                        content: file.content || null
                    }));
                }
            }

            // Fallback: walk filesystem when global context has no files
            if (!filesToProcess.length && this.projectRoot) {
                filesToProcess = await this.walkCodeFiles(this.projectRoot);
            }

            for (const file of filesToProcess) {
                const ext = file.ext || '';
                let content = file.content;
                if (!content && file.path) {
                    try {
                        content = await fs.readFile(file.path, 'utf8');
                    } catch {
                        continue;
                    }
                }
                if (!content) continue;

                // Count lines of code
                const lines = content.split('\n').length;
                metrics.totalLinesOfCode += lines;

                // Categorize by language
                const language = this.getLanguageFromExtension(ext);
                metrics.languages[language] = (metrics.languages[language] || 0) + 1;

                // Analyze complexity (simplified)
                if (this.isCodeFile(ext)) {
                    const complexity = this.calculateComplexity(content);
                    metrics.complexity[language] = (metrics.complexity[language] || 0) + complexity;
                }

                // Count documentation files
                if (/\.(md|rst|txt)$/i.test(file.path || '')) {
                    metrics.documentation.totalDocs += 1;
                }
                if (/readme/i.test(file.path || '')) {
                    metrics.documentation.readmeFiles += 1;
                }
            }

            // Calculate documentation coverage
            const totalFiles = Object.values(metrics.languages).reduce((sum, count) => sum + count, 0);
            if (totalFiles > 0) {
                metrics.documentation.coverage = (metrics.documentation.totalDocs / totalFiles) * 100;
            }

            return metrics;
        } catch (error) {
            console.error('Failed to analyze codebase metrics:', error);
            return { error: error.message };
        }
    }

    /**
     * Analyze database structure (if exists)
     */
    async analyzeDatabaseStructure() {
        try {
            const dbAnalysis = {
                hasDatabase: false,
                type: 'none',
                tables: 0,
                schemas: [],
                migrations: 0,
                size: 0,
                features: {
                    authentication: false,
                    logging: false,
                    caching: false,
                    backups: false
                }
            };

            // Check for database-related files
            const dbIndicators = [
                'package.json', // Check for db dependencies
                'database', 
                'db',
                'migrations',
                'schema',
                'models'
            ];

            if (this.globalContextManager) {
                const context = this.globalContextManager.getContext();
                if (context.files) {
                    Object.keys(context.files).forEach(filePath => {
                        const lowerPath = filePath.toLowerCase();
                        
                        // Check for database indicators
                        if (dbIndicators.some(indicator => lowerPath.includes(indicator))) {
                            dbAnalysis.hasDatabase = true;
                            
                            // Detect database type
                            if (lowerPath.includes('mongodb') || lowerPath.includes('mongo')) {
                                dbAnalysis.type = 'mongodb';
                            } else if (lowerPath.includes('postgres') || lowerPath.includes('postgresql')) {
                                dbAnalysis.type = 'postgresql';
                            } else if (lowerPath.includes('mysql')) {
                                dbAnalysis.type = 'mysql';
                            } else if (lowerPath.includes('sqlite')) {
                                dbAnalysis.type = 'sqlite';
                            }
                        }

                        // Count migration files
                        if (lowerPath.includes('migration')) {
                            dbAnalysis.migrations++;
                        }

                        // Check for database features
                        if (lowerPath.includes('auth')) dbAnalysis.features.authentication = true;
                        if (lowerPath.includes('log')) dbAnalysis.features.logging = true;
                        if (lowerPath.includes('cache')) dbAnalysis.features.caching = true;
                        if (lowerPath.includes('backup')) dbAnalysis.features.backups = true;
                    });
                }
            }

            return dbAnalysis;
        } catch (error) {
            console.error('Failed to analyze database structure:', error);
            return { error: error.message };
        }
    }

    /**
     * Analyze implemented features based on codebase
     */
    async analyzeImplementedFeatures() {
        try {
            const features = {
                ai: {
                    analysis: false,
                    generation: false,
                    processing: false,
                    models: false
                },
                web: {
                    dashboard: false,
                    api: false,
                    authentication: false,
                    responsive: false
                },
                data: {
                    storage: false,
                    processing: false,
                    export: false,
                    import: false
                },
                devops: {
                    testing: false,
                    deployment: false,
                    monitoring: false,
                    logging: false
                }
            };

            if (this.globalContextManager) {
                const context = this.globalContextManager.getContext();
                if (context.files) {
                    Object.keys(context.files).forEach(filePath => {
                        const content = context.files[filePath].content || '';
                        const lowerPath = filePath.toLowerCase();

                        // AI Features
                        if (lowerPath.includes('ai') || lowerPath.includes('analysis')) {
                            if (content.includes('analysis')) features.ai.analysis = true;
                            if (content.includes('generate')) features.ai.generation = true;
                            if (content.includes('process')) features.ai.processing = true;
                            if (content.includes('model')) features.ai.models = true;
                        }

                        // Web Features
                        if (lowerPath.includes('web') || lowerPath.includes('dashboard')) {
                            if (content.includes('dashboard')) features.web.dashboard = true;
                            if (content.includes('api') || content.includes('endpoint')) features.web.api = true;
                            if (content.includes('auth')) features.web.authentication = true;
                            if (content.includes('responsive') || content.includes('mobile')) features.web.responsive = true;
                        }

                        // Data Features
                        if (lowerPath.includes('data') || lowerPath.includes('export')) {
                            if (content.includes('storage') || content.includes('database')) features.data.storage = true;
                            if (content.includes('process')) features.data.processing = true;
                            if (content.includes('export')) features.data.export = true;
                            if (content.includes('import')) features.data.import = true;
                        }

                        // DevOps Features
                        if (lowerPath.includes('test') || lowerPath.includes('spec')) {
                            features.devops.testing = true;
                        }
                        if (lowerPath.includes('deploy') || lowerPath.includes('docker')) {
                            features.devops.deployment = true;
                        }
                        if (lowerPath.includes('monitor') || lowerPath.includes('metric')) {
                            features.devops.monitoring = true;
                        }
                        if (lowerPath.includes('log')) {
                            features.devops.logging = true;
                        }
                    });
                }
            }

            return features;
        } catch (error) {
            console.error('Failed to analyze implemented features:', error);
            return { error: error.message };
        }
    }

    /**
     * Calculate development progress based on analysis
     */
    async calculateDevelopmentProgress() {
        try {
            const progress = {
                overall: 0,
                phases: {},
                categories: {},
                metrics: {
                    codebaseMaturity: 0,
                    featureCompleteness: 0,
                    documentationCoverage: 0,
                    testCoverage: 0
                }
            };

            // Calculate overall progress based on multiple factors
            const factors = [];

            // Codebase maturity (based on file count and complexity)
            const codebaseScore = await this.calculateCodebaseMaturity();
            factors.push(codebaseScore);
            progress.metrics.codebaseMaturity = codebaseScore;

            // Feature completeness
            const features = await this.analyzeImplementedFeatures();
            const featureScore = this.calculateFeatureScore(features);
            factors.push(featureScore);
            progress.metrics.featureCompleteness = featureScore;

            // Documentation coverage
            const docScore = await this.calculateDocumentationScore();
            factors.push(docScore);
            progress.metrics.documentationCoverage = docScore;

            // Test coverage (simplified)
            const testScore = await this.calculateTestScore();
            factors.push(testScore);
            progress.metrics.testCoverage = testScore;

            // Calculate overall progress
            progress.overall = factors.reduce((sum, score) => sum + score, 0) / factors.length;

            // Calculate phase progress
            progress.phases = await this.calculatePhaseProgress(features);

            // Calculate category progress
            progress.categories = await this.calculateCategoryProgress(features);

            return progress;
        } catch (error) {
            console.error('Failed to calculate development progress:', error);
            return { error: error.message };
        }
    }

    /**
     * Generate roadmap recommendations based on analysis
     */
    async generateRoadmapRecommendations() {
        try {
            const recommendations = {
                immediate: [],
                shortTerm: [],
                longTerm: [],
                priorities: {
                    high: [],
                    medium: [],
                    low: []
                }
            };

            const features = await this.analyzeImplementedFeatures();
            const progress = await this.calculateDevelopmentProgress();

            // Generate recommendations based on gaps
            if (!features.ai.analysis) {
                recommendations.immediate.push('Implement AI analysis capabilities');
                recommendations.priorities.high.push('AI Analysis System');
            }

            if (!features.web.api) {
                recommendations.immediate.push('Complete API implementation');
                recommendations.priorities.high.push('API Development');
            }

            if (!features.devops.testing) {
                recommendations.shortTerm.push('Add comprehensive testing suite');
                recommendations.priorities.medium.push('Testing Infrastructure');
            }

            if (progress.metrics.documentationCoverage < 50) {
                recommendations.shortTerm.push('Improve documentation coverage');
                recommendations.priorities.medium.push('Documentation');
            }

            if (!features.devops.monitoring) {
                recommendations.longTerm.push('Implement monitoring and logging');
                recommendations.priorities.low.push('Monitoring System');
            }

            return recommendations;
        } catch (error) {
            console.error('Failed to generate recommendations:', error);
            return { error: error.message };
        }
    }

    /**
     * Analyze AI integration level
     */
    async analyzeAIIntegration() {
        try {
            const integration = {
                level: 'none',
                features: {
                    analysis: false,
                    generation: false,
                    processing: false,
                    automation: false
                },
                models: [],
                apis: [],
                confidence: 0
            };

            if (this.globalContextManager) {
                const context = this.globalContextManager.getContext();
                if (context.files) {
                    Object.keys(context.files).forEach(filePath => {
                        const normalizedPath = filePath.replace(/\\/g, '/');
                        if (normalizedPath.startsWith('docs/') || normalizedPath.includes('/archive/')) {
                            return;
                        }
                        const content = context.files[filePath].content || '';
                        const lowerPath = filePath.toLowerCase();

                        // Check for AI-related files and content
                        if (lowerPath.includes('ai') || lowerPath.includes('gguf') || 
                            content.includes('AI') || content.includes('artificial')) {
                            
                            integration.level = 'basic';
                            
                            // Detect specific AI features
                            if (content.includes('analysis')) integration.features.analysis = true;
                            if (content.includes('generate')) integration.features.generation = true;
                            if (content.includes('process')) integration.features.processing = true;
                            if (content.includes('automat')) integration.features.automation = true;

                            // Extract model names
                            const modelMatches = content.match(/(gpt|assistant|llama|gguf|bert)/gi);
                            if (modelMatches) {
                                modelMatches.forEach(model => {
                                    if (!integration.models.includes(model.toLowerCase())) {
                                        integration.models.push(model.toLowerCase());
                                    }
                                });
                            }

                        }
                    });
                }
            }

            integration.notes = 'Route list omitted — regex over all files produced false positives from docs and comments';

            return integration;
        } catch (error) {
            console.error('Failed to analyze AI integration:', error);
            return { error: error.message };
        }
    }

    /**
     * Generate comprehensive roadmap data from analysis
     */
    async generateRoadmapData(analysis) {
        const measured = await generateCodeRoadmap(this.projectRoot, {
            projectStructure: analysis.projectStructure,
            codebaseMetrics: analysis.codebaseMetrics,
            developmentProgress: {
                metrics: {
                    documentationCoverage: analysis.developmentProgress?.metrics?.documentationCoverage,
                    testCoverage: analysis.developmentProgress?.metrics?.testCoverage
                }
            }
        }, {
            includePaths: this.includePaths,
            excludePatterns: this.excludePatterns
        });

        const measuredApis = sanitizeApiRouteList(
            measured.codeAnalysis?.aiIntegration?.apis || []
        );

        return {
            ...measured,
            roadmapExportProfile: 'filtered-v3.1',
            aiIntegration: {
                level: analysis.aiIntegration?.level || 'filesystem',
                features: analysis.aiIntegration?.features || {},
                models: (analysis.aiIntegration?.models || []).slice(0, 12),
                apis: measuredApis,
                apiRouteCount: measured.progressMetrics?.metrics?.apiRouteCount ?? measuredApis.length,
                confidence: null,
                notes: measured.codeAnalysis?.aiIntegration?.notes
                    || 'GGUF semantic roadmap not run — use optional Phase 2 inference'
            },
            recommendations: {
                immediate: measured.recommendations?.immediate || [],
                shortTerm: [
                    ...(measured.recommendations?.shortTerm || []),
                    ...(analysis.recommendations?.shortTerm || []).filter(
                        (item) => !/npm audit|Security posture to 80/i.test(String(item))
                    )
                ].filter((item, index, arr) => arr.indexOf(item) === index),
                longTerm: measured.recommendations?.longTerm || analysis.recommendations?.longTerm || [],
                priorities: measured.recommendations?.priorities || analysis.recommendations?.priorities
            }
        };
    }

    /**
     * Generate fallback roadmap data if analysis fails
     */
    async generateFallbackRoadmapData() {
        return generateCodeRoadmap(this.projectRoot, {}, {
            includePaths: this.includePaths,
            excludePatterns: this.excludePatterns,
            fallback: true
        });
    }

    // Helper methods
    getLanguageFromExtension(ext) {
        const languageMap = {
            '.js': 'JavaScript',
            '.ts': 'TypeScript',
            '.py': 'Python',
            '.java': 'Java',
            '.cpp': 'C++',
            '.c': 'C',
            '.html': 'HTML',
            '.css': 'CSS',
            '.json': 'JSON',
            '.md': 'Markdown',
            '.yml': 'YAML',
            '.yaml': 'YAML'
        };
        return languageMap[ext] || 'Other';
    }

    isCodeFile(ext) {
        return ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.php', '.rb', '.go'].includes(ext);
    }

    calculateComplexity(content) {
        // Simplified complexity calculation based on code patterns
        const patterns = [
            /if\s*\(/g,      // Conditional statements
            /for\s*\(/g,     // Loops
            /function\s+\w+/g, // Function definitions
            /class\s+\w+/g,  // Class definitions
            /try\s*\{/g,     // Exception handling
            /catch\s*\(/g    // Exception handling
        ];

        let complexity = 1; // Base complexity
        patterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) complexity += matches.length;
        });

        return Math.min(complexity, 100); // Cap at 100
    }

    async calculateCodebaseMaturity() {
        // Simplified calculation based on file count and structure
        if (this.globalContextManager) {
            const context = this.globalContextManager.getContext();
            const fileCount = context.files ? Object.keys(context.files).length : 0;
            
            // More files = more mature (up to a point)
            return Math.min(fileCount / 100, 1) * 100;
        }
        return 50; // Default score
    }

    calculateFeatureScore(features) {
        const featureGroups = Object.values(features);
        const implementedFeatures = featureGroups.reduce((count, group) => {
            return count + Object.values(group).filter(Boolean).length;
        }, 0);
        
        const totalFeatures = featureGroups.reduce((count, group) => {
            return count + Object.keys(group).length;
        }, 0);

        return totalFeatures > 0 ? (implementedFeatures / totalFeatures) * 100 : 0;
    }

    async calculateDocumentationScore() {
        if (this.globalContextManager) {
            const context = this.globalContextManager.getContext();
            const files = context.files || {};
            
            const docFiles = Object.keys(files).filter(path => 
                path.endsWith('.md') || path.endsWith('.txt') || path.includes('doc')
            ).length;
            
            const totalFiles = Object.keys(files).length;
            
            return totalFiles > 0 ? (docFiles / totalFiles) * 100 : 0;
        }
        return 25; // Default score
    }

    async calculateTestScore() {
        if (this.globalContextManager) {
            const context = this.globalContextManager.getContext();
            const files = context.files || {};
            
            const testFiles = Object.keys(files).filter(path => 
                path.includes('test') || path.includes('spec') || path.endsWith('.test.js')
            ).length;
            
            const codeFiles = Object.keys(files).filter(path => 
                ['.js', '.ts', '.py', '.java'].includes(path.substring(path.lastIndexOf('.')))
            ).length;
            
            return codeFiles > 0 ? (testFiles / codeFiles) * 100 : 0;
        }
        return 30; // Default score
    }

    async calculatePhaseProgress(_features) {
        return {
            'Phase 1: Foundation': 100,
            'Phase 2: AI Integration': 100,
            'Phase 3: Advanced Features': 75,
            'Phase 4: Production Ready': 25
        };
    }

    async calculateCategoryProgress(features) {
        return {
            'AI Tools': features.ai ? this.calculateFeatureScore({ ai: features.ai }) : 85,
            'Analytics': features.data ? this.calculateFeatureScore({ data: features.data }) : 72,
            'Development Tools': features.devops ? this.calculateFeatureScore({ devops: features.devops }) : 90,
            'Infrastructure': 45
        };
    }

    calculateTotalFeatures(_analysis) {
        // Count total potential features based on analysis
        return 47; // Default for now
    }

    calculateCompletedFeatures(analysis) {
        const pct = this.normalizeProgressPercent(analysis.developmentProgress.overall);
        return Math.round((pct / 100) * this.calculateTotalFeatures(analysis));
    }

    normalizeProgressPercent(progress) {
        if (progress == null || Number.isNaN(Number(progress))) return 0;
        const value = Number(progress);
        const pct = value <= 1 ? value * 100 : value;
        return Math.min(100, Math.max(0, Math.round(pct * 100) / 100));
    }

    // ── Static Collection Utilities ─────────────────────────────

    /**
     * Count items by a key extracted from each item.
     * @param {Array} items
     * @param {(item:any)=>string} keyFn
     * @returns {Object<string, number>}
     */
    static countBy(items, keyFn) {
        const counts = /** @type {Object<string, number>} */ ({});
        if (!Array.isArray(items) || typeof keyFn !== 'function') return counts;
        for (const item of items) {
            const key = String(keyFn(item));
            counts[key] = (counts[key] || 0) + 1;
        }
        return counts;
    }

    /**
     * Group items by a key extracted from each item.
     * @param {Array} items
     * @param {(item:any)=>string} keyFn
     * @returns {Map<string, Array>}
     */
    static groupBy(items, keyFn) {
        const map = new Map();
        if (!Array.isArray(items) || typeof keyFn !== 'function') return map;
        for (const item of items) {
            const key = String(keyFn(item));
            if (map.has(key)) {
                map.get(key).push(item);
            } else {
                map.set(key, [item]);
            }
        }
        return map;
    }

    /**
     * Sum numeric values extracted from items.
     * @param {Array} items
     * @param {(item:any)=>number} [keyFn]
     * @returns {number}
     */
    static sumBy(items, keyFn) {
        if (!Array.isArray(items)) return 0;
        let total = 0;
        for (const item of items) {
            const val = typeof keyFn === 'function' ? keyFn(item) : item;
            const n = Number(val);
            if (Number.isFinite(n)) total += n;
        }
        return total;
    }

    /**
     * Arithmetic mean of numeric values extracted from items.
     * @param {Array} items
     * @param {(item:any)=>number} [keyFn]
     * @returns {number}
     */
    static meanBy(items, keyFn) {
        if (!Array.isArray(items) || items.length === 0) return 0;
        return RoadmapDataAnalyzer.sumBy(items, keyFn) / items.length;
    }

    /**
     * Return item with maximum key value.
     * @template T
     * @param {T[]} items
     * @param {(item:T)=>number} keyFn
     * @returns {T | undefined}
     */
    static maxBy(items, keyFn) {
        if (!Array.isArray(items) || items.length === 0 || typeof keyFn !== 'function') return undefined;
        let maxItem = items[0];
        let maxVal = keyFn(maxItem);
        for (let i = 1; i < items.length; i++) {
            const val = keyFn(items[i]);
            if (val > maxVal) { maxVal = val; maxItem = items[i]; }
        }
        return maxItem;
    }

    /**
     * Return item with minimum key value.
     * @template T
     * @param {T[]} items
     * @param {(item:T)=>number} keyFn
     * @returns {T | undefined}
     */
    static minBy(items, keyFn) {
        if (!Array.isArray(items) || items.length === 0 || typeof keyFn !== 'function') return undefined;
        let minItem = items[0];
        let minVal = keyFn(minItem);
        for (let i = 1; i < items.length; i++) {
            const val = keyFn(items[i]);
            if (val < minVal) { minVal = val; minItem = items[i]; }
        }
        return minItem;
    }

    /**
     * Return top N items by extracted key.
     * @template T
     * @param {T[]} items
     * @param {number} n
     * @param {(item:T)=>number} keyFn
     * @param {'asc'|'desc'} [order='desc']
     * @returns {T[]}
     */
    static topN(items, n, keyFn, order = 'desc') {
        if (!Array.isArray(items) || items.length === 0 || typeof keyFn !== 'function') return [];
        const sorted = [...items].sort((a, b) => {
            const ka = keyFn(a);
            const kb = keyFn(b);
            if (typeof ka === 'number' && typeof kb === 'number') return ka - kb;
            return String(ka).localeCompare(String(kb));
        });
        if (order === 'desc') sorted.reverse();
        const limit = Math.max(0, Math.floor(Number(n) || 0));
        return sorted.slice(0, limit);
    }

    /**
     * Split an array into two groups based on a predicate.
     * @template T
     * @param {T[]} items
     * @param {(item:T)=>boolean} predicate
     * @returns {[T[], T[]]}
     */
    static partition(items, predicate) {
        const pass = [];
        const fail = [];
        if (!Array.isArray(items) || typeof predicate !== 'function') return [pass, fail];
        for (const item of items) {
            if (predicate(item)) pass.push(item);
            else fail.push(item);
        }
        return [pass, fail];
    }

    // ── Static Path / File Helpers ──────────────────────────────

    /**
     * Normalize a path to POSIX-style slashes.
     * @param {string} filePath
     * @returns {string}
     */
    static toPosixPath(filePath) {
        return String(filePath || '').replace(/\\/g, '/');
    }

    /**
     * Extract lowercase extension from a path.
     * @param {string} filePath
     * @returns {string}
     */
    static getExt(filePath) {
        const name = String(filePath || '');
        const dot = name.lastIndexOf('.');
        return dot > 0 ? name.slice(dot).toLowerCase() : '';
    }

    /**
     * Append an extension if the path does not already end with it.
     * @param {string} filePath
     * @param {string} ext
     * @returns {string}
     */
    static ensureExt(filePath, ext) {
        const p = String(filePath || '');
        const e = String(ext || '');
        if (!e) return p;
        const dotExt = e.startsWith('.') ? e : `.${e}`;
        return p.toLowerCase().endsWith(dotExt.toLowerCase()) ? p : `${p}${dotExt}`;
    }

    /**
     * Check if a path has a recognized code extension.
     * @param {string} filePath
     * @returns {boolean}
     */
    static isCodeFile(filePath) {
        const codeExts = new Set(['.js', '.ts', '.py', '.java', '.cpp', '.c', '.php', '.rb', '.go', '.cjs', '.mjs', '.jsx', '.tsx']);
        const ext = RoadmapDataAnalyzer.getExt(filePath);
        return codeExts.has(ext);
    }

    // ── Static String / Formatting Helpers ────────────────────────

    /**
     * Truncate a string to a maximum length, adding an ellipsis if trimmed.
     * @param {string} str
     * @param {number} [maxLen=80]
     * @param {string} [suffix='…']
     * @returns {string}
     */
    static truncate(str, maxLen = 80, suffix = '…') {
        const s = String(str ?? '');
        const limit = Number.isFinite(maxLen) && maxLen > 0 ? Math.floor(maxLen) : 80;
        if (s.length <= limit) return s;
        const endLen = Math.max(0, limit - String(suffix ?? '…').length);
        return s.slice(0, endLen) + String(suffix ?? '…');
    }

    /**
     * Convert a string to a URL-safe slug.
     * @param {string} str
     * @returns {string}
     */
    static slugify(str) {
        return String(str ?? '')
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    /**
     * Format a number as a percentage string.
     * @param {number} value
     * @param {number} [digits=1]
     * @returns {string}
     */
    static formatPercent(value, digits = 1) {
        const num = Number(value);
        if (!Number.isFinite(num)) return '—%';
        const d = Number.isFinite(digits) ? Math.max(0, Math.min(20, Math.floor(digits))) : 1;
        const pct = num <= 1 ? num * 100 : num;
        return `${pct.toFixed(d)}%`;
    }

    /**
     * Clamp a number between a minimum and maximum.
     * @param {number} num
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    static clamp(num, min, max) {
        const n = Number(num);
        if (!Number.isFinite(n) || !Number.isFinite(min) || !Number.isFinite(max)) return NaN;
        return Math.min(Math.max(n, min), max);
    }

    getProjectHealth(progress) {
        const pct = this.normalizeProgressPercent(progress);
        if (pct >= 80) return 'Excellent';
        if (pct >= 60) return 'Good';
        if (pct >= 40) return 'Fair';
        return 'Needs Attention';
    }

    generateDevelopmentPhases(analysis) {
        const _baseDate = new Date();
        return [
            {
                phase: 'Phase 1: Foundation',
                status: 'completed',
                progress: 100,
                startDate: new Date(2026, 0, 15).toISOString(),
                endDate: new Date(2026, 2, 15).toISOString(),
                description: 'Core platform architecture and basic AI processing capabilities',
                features: ['AI Platform Setup', 'Basic Processing', 'Core Architecture'],
                duration: '8 weeks',
                teamSize: 8,
                aiConfidence: null  // populated from measured inference metrics, not hardcoded
            },
            {
                phase: 'Phase 2: AI Integration',
                status: 'completed',
                progress: 100,
                startDate: new Date(2026, 1, 28).toISOString(),
                endDate: new Date(2026, 4, 10).toISOString(),
                description: 'Advanced AI features and intelligent automation systems',
                features: ['AI Analysis Tools', 'Smart Processing', 'Automation'],
                duration: '10 weeks',
                teamSize: 10,
                aiConfidence: null  // populated from measured inference metrics, not hardcoded
            },
            {
                phase: 'Phase 3: Advanced Features',
                status: 'in-progress',
                progress: this.normalizeProgressPercent(analysis.developmentProgress.overall),
                startDate: new Date(2026, 3, 20).toISOString(),
                endDate: new Date(2026, 7, 30).toISOString(),
                description: 'Advanced analytics, reporting, and optimization features',
                features: ['Analytics Dashboard', 'Reporting System', 'Performance Optimization'],
                duration: '12 weeks',
                teamSize: 12,
                aiConfidence: null  // populated from measured inference metrics, not hardcoded
            },
            {
                phase: 'Phase 4: Production Ready',
                status: 'planned',
                progress: 0,
                startDate: new Date(2026, 6, 15).toISOString(),
                endDate: new Date(2026, 10, 30).toISOString(),
                description: 'Production deployment, scaling, and enterprise features',
                features: ['Enterprise Features', 'Scaling Solutions', 'Production Deployment'],
                duration: '16 weeks',
                teamSize: 15,
                aiConfidence: null  // populated from measured inference metrics, not hardcoded
            }
        ];
    }

    generateFeatureCategories(_analysis) {
        return [
            {
                category: 'AI Tools',
                completed: 17,
                total: 20,
                completionRate: 85,
                description: 'AI-powered analysis and processing tools'
            },
            {
                category: 'Analytics',
                completed: 13,
                total: 18,
                completionRate: 72,
                description: 'Data analytics and reporting capabilities'
            },
            {
                category: 'Development Tools',
                completed: 9,
                total: 10,
                completionRate: 90,
                description: 'Development and debugging tools'
            },
            {
                category: 'Infrastructure',
                completed: 5,
                total: 11,
                completionRate: 45,
                description: 'Core infrastructure and deployment systems'
            }
        ];
    }

    getFallbackPhases() {
        return [
            {
                phase: 'Phase 1: Foundation',
                status: 'completed',
                progress: 100,
                startDate: '2026-01-15',
                endDate: '2026-03-15',
                description: 'Core platform architecture and basic AI processing capabilities',
                features: ['AI Platform Setup', 'Basic Processing', 'Core Architecture'],
                duration: '8 weeks',
                teamSize: 8,
                aiConfidence: null  // populated from measured inference metrics, not hardcoded
            },
            {
                phase: 'Phase 2: AI Integration',
                status: 'completed',
                progress: 100,
                startDate: '2026-02-28',
                endDate: '2026-05-10',
                description: 'Advanced AI features and intelligent automation systems',
                features: ['AI Analysis Tools', 'Smart Processing', 'Automation'],
                duration: '10 weeks',
                teamSize: 10,
                aiConfidence: null  // populated from measured inference metrics, not hardcoded
            },
            {
                phase: 'Phase 3: Advanced Features',
                status: 'in-progress',
                progress: 75,
                startDate: '2026-04-20',
                endDate: '2026-08-30',
                description: 'Advanced analytics, reporting, and optimization features',
                features: ['Analytics Dashboard', 'Reporting System', 'Performance Optimization'],
                duration: '12 weeks',
                teamSize: 12,
                aiConfidence: null  // populated from measured inference metrics, not hardcoded
            },
            {
                phase: 'Phase 4: Production Ready',
                status: 'planned',
                progress: 0,
                startDate: '2026-07-15',
                endDate: '2026-11-30',
                description: 'Production deployment, scaling, and enterprise features',
                features: ['Enterprise Features', 'Scaling Solutions', 'Production Deployment'],
                duration: '16 weeks',
                teamSize: 15,
                aiConfidence: null  // populated from measured inference metrics, not hardcoded
            }
        ];
    }

    getFallbackCategories() {
        return [
            {
                category: 'AI Tools',
                completed: 17,
                total: 20,
                completionRate: 85,
                description: 'AI-powered analysis and processing tools'
            },
            {
                category: 'Analytics',
                completed: 13,
                total: 18,
                completionRate: 72,
                description: 'Data analytics and reporting capabilities'
            },
            {
                category: 'Development Tools',
                completed: 9,
                total: 10,
                completionRate: 90,
                description: 'Development and debugging tools'
            },
            {
                category: 'Infrastructure',
                completed: 5,
                total: 11,
                completionRate: 45,
                description: 'Core infrastructure and deployment systems'
            }
        ];
    }

    // ── Instance Result-Sorting Helpers ─────────────────────────

    /**
     * Sort features by status: implemented first, then partial, then planned.
     * @param {Array<{status:string}>} features
     * @returns {Array<{status:string}>}
     */
    sortFeaturesByStatus(features) {
        if (!Array.isArray(features)) return [];
        const rank = { implemented: 0, partial: 1, planned: 2, pending: 3 };
        return [...features].sort((a, b) => {
            const ra = rank[a.status] ?? 99;
            const rb = rank[b.status] ?? 99;
            return ra - rb;
        });
    }

    /**
     * Filter features by category string.
     * @param {Array<{category:string}>} features
     * @param {string} category
     * @returns {Array<{category:string}>}
     */
    filterFeaturesByCategory(features, category) {
        if (!Array.isArray(features) || typeof category !== 'string') return [];
        const cat = category.toLowerCase();
        return features.filter((f) => (f.category || '').toLowerCase() === cat);
    }

    /**
     * Deep-merge recommendation objects with deduplication.
     * @param {...{immediate?:string[],shortTerm?:string[],longTerm?:string[],priorities?:{high?:string[],medium?:string[],low?:string[]}}} sources
     * @returns {{immediate:string[],shortTerm:string[],longTerm:string[],priorities:{high:string[],medium:string[],low:string[]}}}
     */
    mergeRecommendations(...sources) {
        const result = {
            immediate: [],
            shortTerm: [],
            longTerm: [],
            priorities: { high: [], medium: [], low: [] }
        };
        for (const src of sources) {
            if (!src || typeof src !== 'object') continue;
            for (const key of ['immediate', 'shortTerm', 'longTerm']) {
                if (Array.isArray(src[key])) {
                    result[key].push(...src[key]);
                }
            }
            if (src.priorities && typeof src.priorities === 'object') {
                for (const p of ['high', 'medium', 'low']) {
                    if (Array.isArray(src.priorities[p])) {
                        result.priorities[p].push(...src.priorities[p]);
                    }
                }
            }
        }
        // Deduplicate
        for (const key of ['immediate', 'shortTerm', 'longTerm']) {
            result[key] = [...new Set(result[key])];
        }
        for (const p of ['high', 'medium', 'low']) {
            result.priorities[p] = [...new Set(result.priorities[p])];
        }
        return result;
    }
}

module.exports = RoadmapDataAnalyzer;

