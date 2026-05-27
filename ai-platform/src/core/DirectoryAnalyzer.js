/**
 * Directory Analyzer - Advanced directory structure analysis and reporting system
 * Analyzes directory locations and builds comprehensive reports from analyzed data
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class DirectoryAnalyzer {
    constructor() {
        this.analysisResults = {
            directoryStructure: {},
            fileAnalysis: {},
            metrics: {},
            recommendations: [],
            reportData: {}
        };
        this.startTime = Date.now();
        this.globalContext = null;
    }

    /**
     * Analyze directory structure and build comprehensive report
     */
    async analyzeDirectory(directoryPath, options = {}) {
        console.log(`🔍 Starting directory analysis of: ${directoryPath}`);
        
        try {
            // Validate directory exists
            const stats = await fs.stat(directoryPath);
            if (!stats.isDirectory()) {
                throw new Error('Provided path is not a directory');
            }

            // Perform comprehensive analysis
            await this.analyzeDirectoryStructure(directoryPath);
            await this.analyzeFileContents(directoryPath);
            await this.calculateMetrics(directoryPath);
            await this.generateRecommendations();
            await this.buildReport(directoryPath, options);
            
            const analysisDuration = Date.now() - this.startTime;
            console.log(`✅ Directory analysis complete in ${analysisDuration}ms`);
            
            return this.generateComprehensiveReport();
            
        } catch (error) {
            console.error('❌ Directory analysis failed:', error);
            throw error;
        }
    }

    /**
     * Analyze directory structure recursively
     */
    async analyzeDirectoryStructure(directoryPath) {
        console.log('📁 Analyzing directory structure...');
        
        const structure = {
            rootPath: directoryPath,
            totalDirectories: 0,
            totalFiles: 0,
            totalSize: 0,
            maxDepth: 0,
            averageDepth: 0,
            fileTypes: {},
            directoryTree: {},
            pathAnalysis: {
                longestPath: null,
                deepestNesting: null,
                averageItemsPerDirectory: 0
            }
        };

        // Build directory tree
        structure.directoryTree = await this.buildDirectoryTree(directoryPath, structure);
        structure.averageItemsPerDirectory = structure.totalFiles / Math.max(structure.totalDirectories, 1);

        this.analysisResults.directoryStructure = structure;
    }

    /**
     * Build directory tree recursively
     */
    async buildDirectoryTree(dirPath, structure, depth = 0, parentPath = null) {
        const items = await fs.readdir(dirPath, { withFileTypes: true });
        const tree = {
            name: path.basename(dirPath),
            path: dirPath,
            type: 'directory',
            depth: depth,
            parent: parentPath,
            children: {},
            size: 0,
            fileCount: 0,
            directoryCount: 0
        };

        structure.maxDepth = Math.max(structure.maxDepth, depth);
        structure.totalDirectories++;

        for (const item of items) {
            const itemPath = path.join(dirPath, item.name);
            
            if (item.isDirectory()) {
                const childTree = await this.buildDirectoryTree(itemPath, structure, depth + 1, dirPath);
                tree.children[item.name] = childTree;
                tree.directoryCount += childTree.directoryCount + 1;
                tree.size += childTree.size;
                tree.fileCount += childTree.fileCount;
            } else {
                const fileStats = await fs.stat(itemPath);
                const fileType = path.extname(item.name).toLowerCase();
                
                tree.children[item.name] = {
                    name: item.name,
                    path: itemPath,
                    type: 'file',
                    size: fileStats.size,
                    extension: fileType,
                    modified: fileStats.mtime,
                    created: fileStats.birthtime
                };
                
                tree.size += fileStats.size;
                tree.fileCount++;
                structure.totalFiles++;
                structure.totalSize += fileStats.size;
                
                // Track file types
                structure.fileTypes[fileType] = (structure.fileTypes[fileType] || 0) + 1;
            }
        }

        return tree;
    }

    /**
     * Analyze file contents and extract insights
     */
    async analyzeFileContents(directoryPath) {
        console.log('📄 Analyzing file contents...');
        
        const fileAnalysis = {
            codeFiles: {
                total: 0,
                languages: {},
                frameworks: [],
                dependencies: [],
                functions: [],
                classes: []
            },
            configurationFiles: {
                total: 0,
                types: {},
                configurations: []
            },
            documentationFiles: {
                total: 0,
                types: {},
                totalWords: 0,
                totalLines: 0
            },
            dataFiles: {
                total: 0,
                types: {},
                totalSize: 0,
                records: 0
            },
            mediaFiles: {
                total: 0,
                types: {},
                totalSize: 0
            },
            binaryFiles: {
                total: 0,
                totalSize: 0
            }
        };

        // Analyze all files in directory
        const allFiles = await this.getAllFiles(directoryPath);
        
        for (const file of allFiles) {
            const extension = path.extname(file).toLowerCase();
            const stats = await fs.stat(file);
            
            if (this.isTextFile(extension)) {
                await this.analyzeTextFile(file, fileAnalysis);
            } else if (this.isDataFile(extension)) {
                fileAnalysis.dataFiles.total++;
                fileAnalysis.dataFiles.types[extension] = (fileAnalysis.dataFiles.types[extension] || 0) + 1;
                fileAnalysis.dataFiles.totalSize += stats.size;
            } else if (this.isMediaFile(extension)) {
                fileAnalysis.mediaFiles.total++;
                fileAnalysis.mediaFiles.types[extension] = (fileAnalysis.mediaFiles.types[extension] || 0) + 1;
                fileAnalysis.mediaFiles.totalSize += stats.size;
            } else {
                fileAnalysis.binaryFiles.total++;
                fileAnalysis.binaryFiles.totalSize += stats.size;
            }
        }

        this.analysisResults.fileAnalysis = fileAnalysis;
    }

    /**
     * Analyze text file contents
     */
    async analyzeTextFile(filePath, fileAnalysis) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const extension = path.extname(filePath).toLowerCase();
            
            // Detect programming languages
            if (this.isCodeFile(extension)) {
                fileAnalysis.codeFiles.total++;
                const language = this.detectLanguage(extension);
                fileAnalysis.codeFiles.languages[language] = (fileAnalysis.codeFiles.languages[language] || 0) + 1;
                
                // Extract dependencies
                const dependencies = this.extractDependencies(content);
                fileAnalysis.codeFiles.dependencies.push(...dependencies);
                
                // Extract functions and classes
                const functions = this.extractFunctions(content);
                fileAnalysis.codeFiles.functions.push(...functions);
                
                const classes = this.extractClasses(content);
                fileAnalysis.codeFiles.classes.push(...classes);
                
                // Detect frameworks
                const frameworks = this.detectFrameworks(content);
                fileAnalysis.codeFiles.frameworks.push(...frameworks);
            }
            
            // Detect configuration files
            if (this.isConfigFile(extension)) {
                fileAnalysis.configurationFiles.total++;
                fileAnalysis.configurationFiles.types[extension] = (fileAnalysis.configurationFiles.types[extension] || 0) + 1;
                
                const configType = this.detectConfigType(content);
                if (configType) {
                    fileAnalysis.configurationFiles.configurations.push({
                        type: configType,
                        file: path.basename(filePath),
                        path: filePath
                    });
                }
            }
            
            // Analyze documentation
            if (this.isDocumentationFile(extension)) {
                fileAnalysis.documentationFiles.total++;
                fileAnalysis.documentationFiles.types[extension] = (fileAnalysis.documentationFiles.types[extension] || 0) + 1;
                
                const words = content.split(/\s+/).length;
                const lines = content.split('\n').length;
                
                fileAnalysis.documentationFiles.totalWords += words;
                fileAnalysis.documentationFiles.totalLines += lines;
            }
            
        } catch (error) {
            console.warn(`Could not analyze file ${filePath}:`, error.message);
        }
    }

    /**
     * Calculate comprehensive metrics
     */
    async calculateMetrics(directoryPath) {
        console.log('📊 Calculating metrics...');
        
        const structure = this.analysisResults.directoryStructure;
        const fileAnalysis = this.analysisResults.fileAnalysis;
        
        const metrics = {
            structure: {
                totalDirectories: structure.totalDirectories,
                totalFiles: structure.totalFiles,
                totalSize: structure.totalSize,
                maxDepth: structure.maxDepth,
                averageDepth: this.calculateAverageDepth(structure.directoryTree),
                averageItemsPerDirectory: structure.averageItemsPerDirectory,
                largestDirectory: this.findLargestDirectory(structure.directoryTree),
                deepestDirectory: this.findDeepestDirectory(structure.directoryTree)
            },
            files: {
                codeFiles: fileAnalysis.codeFiles.total,
                configurationFiles: fileAnalysis.configurationFiles.total,
                documentationFiles: fileAnalysis.documentationFiles.total,
                dataFiles: fileAnalysis.dataFiles.total,
                mediaFiles: fileAnalysis.mediaFiles.total,
                binaryFiles: fileAnalysis.binaryFiles.total,
                fileTypes: {
                    ...structure.fileTypes,
                    ...fileAnalysis.codeFiles.languages,
                    ...fileAnalysis.configurationFiles.types,
                    ...fileAnalysis.documentationFiles.types,
                    ...fileAnalysis.dataFiles.types,
                    ...fileAnalysis.mediaFiles.types
                }
            },
            complexity: {
                codeComplexity: this.calculateCodeComplexity(fileAnalysis.codeFiles),
                configurationComplexity: this.calculateConfigurationComplexity(fileAnalysis.configurationFiles),
                documentationComplexity: this.calculateDocumentationComplexity(fileAnalysis.documentationFiles),
                overallComplexity: 0
            },
            organization: {
                namingConvention: this.analyzeNamingConvention(structure.directoryTree),
                fileDistribution: this.analyzeFileDistribution(structure),
                directoryStructure: this.analyzeDirectoryStructure(structure.directoryTree),
                organizationScore: 0
            },
            health: {
                duplicateFiles: 0,
                emptyDirectories: 0,
                orphanedFiles: 0,
                largeFiles: 0,
                oldFiles: 0,
                healthScore: 0
            }
        };

        // Calculate overall complexity and organization scores
        metrics.complexity.overallComplexity = this.calculateOverallComplexity(metrics);
        metrics.organization.organizationScore = this.calculateOrganizationScore(metrics);
        metrics.health.healthScore = this.calculateHealthScore(directoryPath, metrics);

        this.analysisResults.metrics = metrics;
    }

    /**
     * Generate recommendations based on analysis
     */
    async generateRecommendations() {
        console.log('💡 Generating recommendations...');
        
        const recommendations = [];
        const metrics = this.analysisResults.metrics;
        const structure = this.analysisResults.directoryStructure;
        const fileAnalysis = this.analysisResults.fileAnalysis;

        // Structure recommendations
        if (metrics.structure.maxDepth > 10) {
            recommendations.push({
                category: 'Structure',
                priority: 'high',
                title: 'Reduce Directory Depth',
                description: `Current max depth is ${metrics.structure.maxDepth}. Consider flattening directory structure to improve maintainability.`,
                impact: 'High',
                effort: 'Medium'
            });
        }

        if (metrics.structure.averageItemsPerDirectory > 50) {
            recommendations.push({
                category: 'Structure',
                priority: 'medium',
                title: 'Organize Large Directories',
                description: `Some directories contain ${Math.round(metrics.structure.averageItemsPerDirectory)} items. Consider breaking them down into smaller, more focused directories.`,
                impact: 'Medium',
                effort: 'Medium'
            });
        }

        // File type recommendations
        if (fileAnalysis.codeFiles.total === 0 && fileAnalysis.dataFiles.total > 0) {
            recommendations.push({
                category: 'Development',
                priority: 'high',
                title: 'Add Source Code',
                description: 'No code files found but data files exist. Consider adding source code files for better project organization.',
                impact: 'High',
                effort: 'Low'
            });
        }

        // Documentation recommendations
        if (fileAnalysis.documentationFiles.total < fileAnalysis.codeFiles.total * 0.1) {
            recommendations.push({
                category: 'Documentation',
                priority: 'medium',
                title: 'Improve Documentation',
                description: `Documentation coverage is low (${fileAnalysis.documentationFiles.total} docs vs ${fileAnalysis.codeFiles.total} code files). Consider adding README files and inline documentation.`,
                impact: 'Medium',
                effort: 'Medium'
            });
        }

        // Configuration recommendations
        if (fileAnalysis.configurationFiles.total === 0 && fileAnalysis.codeFiles.total > 0) {
            recommendations.push({
                category: 'Configuration',
                priority: 'medium',
                title: 'Add Configuration Files',
                description: 'No configuration files found. Consider adding package.json, .env, or other configuration files for better project management.',
                impact: 'Medium',
                effort: 'Low'
            });
        }

        // Health recommendations
        if (metrics.health.healthScore < 70) {
            recommendations.push({
                category: 'Health',
                priority: 'high',
                title: 'Improve Project Health',
                description: `Project health score is ${metrics.health.healthScore}%. Address structural issues and file organization problems.`,
                impact: 'High',
                effort: 'High'
            });
        }

        this.analysisResults.recommendations = recommendations;
    }

    /**
     * Build comprehensive report
     */
    async buildReport(directoryPath, options = {}) {
        console.log('📋 Building comprehensive report...');
        
        const report = {
            type: 'directory-analysis-report',
            title: 'Comprehensive Directory Analysis Report',
            generatedAt: new Date().toISOString(),
            generatedBy: 'Directory Analyzer AI',
            analysisDuration: Date.now() - this.startTime,
            
            directoryInfo: {
                path: directoryPath,
                absolutePath: path.resolve(directoryPath),
                analyzedAt: new Date().toISOString(),
                options: options
            },
            
            executiveSummary: {
                totalItems: this.analysisResults.directoryStructure.totalFiles + this.analysisResults.directoryStructure.totalDirectories,
                totalSize: this.analysisResults.directoryStructure.totalSize,
                averageFileSize: this.analysisResults.directoryStructure.totalSize / Math.max(this.analysisResults.directoryStructure.totalFiles, 1),
                maxDepth: this.analysisResults.directoryStructure.maxDepth,
                healthScore: this.analysisResults.metrics.health.healthScore,
                organizationScore: this.analysisResults.metrics.organization.organizationScore,
                complexityScore: this.analysisResults.metrics.complexity.overallComplexity
            },
            
            structureAnalysis: this.analysisResults.directoryStructure,
            fileAnalysis: this.analysisResults.fileAnalysis,
            metrics: this.analysisResults.metrics,
            recommendations: this.analysisResults.recommendations,
            
            insights: {
                projectType: this.detectProjectType(),
                developmentStage: this.detectDevelopmentStage(),
                technologyStack: this.detectTechnologyStack(),
                architecture: this.detectArchitecture(),
                buildSystem: this.detectBuildSystem(),
                versionControl: this.detectVersionControl()
            }
        };

        this.analysisResults.reportData = report;
    }

    /**
     * Generate comprehensive report
     */
    generateComprehensiveReport() {
        return this.analysisResults.reportData;
    }

    // Helper methods
    async getAllFiles(directoryPath) {
        const files = [];
        
        async function collectFiles(dir) {
            const items = await fs.readdir(dir, { withFileTypes: true });
            
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                
                if (item.isDirectory()) {
                    await collectFiles(fullPath);
                } else {
                    files.push(fullPath);
                }
            }
        }
        
        await collectFiles(directoryPath);
        return files;
    }

    isTextFile(extension) {
        const textExtensions = [
            '.js', '.ts', '.jsx', '.tsx', '.html', '.css', '.scss', '.less',
            '.json', '.xml', '.yaml', '.yml', '.toml', '.md', '.txt',
            '.py', '.java', '.cpp', '.c', '.h', '.cs', '.php', '.rb', '.go',
            '.rs', '.swift', '.kt', '.scala', '.sh', '.bat', '.ps1',
            '.sql', '.graphql', '.gql', '.env', '.gitignore', '.dockerfile',
            '.makefile', '.cmake', '.gradle', '.pom', '.xml', '.properties'
        ];
        
        return textExtensions.includes(extension);
    }

    isCodeFile(extension) {
        const codeExtensions = [
            '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
            '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala'
        ];
        
        return codeExtensions.includes(extension);
    }

    isDataFile(extension) {
        const dataExtensions = [
            '.json', '.xml', '.yaml', '.yml', '.toml', '.csv', '.tsv',
            '.sql', '.db', '.sqlite', '.mdb', '.accdb'
        ];
        
        return dataExtensions.includes(extension);
    }

    isMediaFile(extension) {
        const mediaExtensions = [
            '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp',
            '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm',
            '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'
        ];
        
        return mediaExtensions.includes(extension);
    }

    isConfigFile(extension) {
        const configExtensions = [
            '.json', '.yaml', '.yml', '.toml', '.ini', '.conf',
            '.config', '.env', '.properties', '.xml', '.plist'
        ];
        
        return configExtensions.includes(extension);
    }

    isDocumentationFile(extension) {
        const docExtensions = [
            '.md', '.txt', '.rst', '.doc', '.docx', '.pdf',
            '.html', '.htm', '.readme'
        ];
        
        return docExtensions.includes(extension);
    }

    detectLanguage(extension) {
        const languageMap = {
            '.js': 'JavaScript',
            '.ts': 'TypeScript',
            '.jsx': 'React JSX',
            '.tsx': 'TypeScript React',
            '.py': 'Python',
            '.java': 'Java',
            '.cpp': 'C++',
            '.c': 'C',
            '.cs': 'C#',
            '.php': 'PHP',
            '.rb': 'Ruby',
            '.go': 'Go',
            '.rs': 'Rust',
            '.swift': 'Swift',
            '.kt': 'Kotlin',
            '.scala': 'Scala'
        };
        
        return languageMap[extension] || 'Unknown';
    }

    extractDependencies(content) {
        const dependencies = [];
        
        // Extract import statements
        const importRegex = /import\s+(?:.+\s+from\s+['"`]([^'"`]+)['"`])/g;
        const imports = content.match(importRegex) || [];
        
        imports.forEach(imp => {
            const dependency = imp.match(/['"`]([^'"`]+)['"`]/)[1];
            if (dependency) dependencies.push(dependency);
        });
        
        // Extract require statements
        const requireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
        const requires = content.match(requireRegex) || [];
        
        requires.forEach(req => {
            const dependency = req.match(/['"`]([^'"`]+)['"`]/)[1];
            if (dependency) dependencies.push(dependency);
        });
        
        return [...new Set(dependencies)];
    }

    extractFunctions(content) {
        const functions = [];
        
        // JavaScript/TypeScript functions
        const functionRegex = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\(|function|\()/g;
        const matches = content.match(functionRegex) || [];
        
        matches.forEach(match => {
            const functionName = match[1] || match[2];
            if (functionName && !functions.includes(functionName)) {
                functions.push(functionName);
            }
        });
        
        return functions;
    }

    extractClasses(content) {
        const classes = [];
        
        // JavaScript/TypeScript classes
        const classRegex = /class\s+(\w+)/g;
        const matches = content.match(classRegex) || [];
        
        matches.forEach(match => {
            const className = match[1];
            if (className && !classes.includes(className)) {
                classes.push(className);
            }
        });
        
        return classes;
    }

    detectFrameworks(content) {
        const frameworks = [];
        const frameworkPatterns = {
            'react': /from\s+['"`]react['"`]/,
            'vue': /from\s+['"`]vue['"`]/,
            'angular': /from\s+['"`]@angular\/core['"`]/,
            'express': /require\s*\(\s*['"`]express['"`]\s*\)/,
            'lodash': /require\s*\(\s*['"`]lodash['"`]\s*\)/,
            'moment': /require\s*\(\s*['"`]moment['"`]\s*\)/,
            'axios': /require\s*\(\s*['"`]axios['"`]\s*\)/,
            'bootstrap': /bootstrap/g,
            'tailwind': /tailwindcss/g
        };
        
        Object.entries(frameworkPatterns).forEach(([framework, pattern]) => {
            if (pattern.test(content)) {
                frameworks.push(framework);
            }
        });
        
        return [...new Set(frameworks)];
    }

    detectConfigType(content) {
        if (content.includes('"name"') && content.includes('"version"')) return 'package';
        if (content.includes('dependencies') || content.includes('devDependencies')) return 'package.json';
        if (content.includes('services:') || content.includes('ports:')) return 'docker-compose';
        if (content.includes('version:') && content.includes('services:')) return 'docker-compose';
        if (content.includes('DATABASE_URL') || content.includes('REDIS_URL')) return 'environment';
        if (content.includes('module.exports')) return 'module.exports';
        
        return 'unknown';
    }

    calculateAverageDepth(tree) {
        let totalDepth = 0;
        let nodeCount = 0;
        
        function calculateDepth(node) {
            totalDepth += node.depth;
            nodeCount++;
            
            if (node.children) {
                Object.values(node.children).forEach(child => {
                    calculateDepth(child);
                });
            }
        }
        
        calculateDepth(tree);
        return nodeCount > 0 ? totalDepth / nodeCount : 0;
    }

    findLargestDirectory(tree) {
        let largest = tree;
        
        function findLargest(node) {
            if (node.size > largest.size) {
                largest = node;
            }
            
            if (node.children) {
                Object.values(node.children).forEach(child => {
                    findLargest(child);
                });
            }
        }
        
        findLargest(tree);
        return largest;
    }

    findDeepestDirectory(tree) {
        let deepest = tree;
        
        function findDeepest(node) {
            if (node.depth > deepest.depth) {
                deepest = node;
            }
            
            if (node.children) {
                Object.values(node.children).forEach(child => {
                    findDeepest(child);
                });
            }
        }
        
        findDeepest(tree);
        return deepest;
    }

    calculateCodeComplexity(codeFiles) {
        const totalFunctions = codeFiles.functions.length;
        const totalClasses = codeFiles.classes.length;
        const totalDependencies = codeFiles.dependencies.length;
        const totalFrameworks = codeFiles.frameworks.length;
        
        // Simple complexity calculation based on various factors
        const complexity = (totalFunctions * 1) + (totalClasses * 2) + (totalDependencies * 0.5) + (totalFrameworks * 1.5);
        
        return Math.min(100, complexity);
    }

    calculateConfigurationComplexity(configFiles) {
        const totalConfigs = configFiles.configurations.length;
        const totalTypes = Object.keys(configFiles.types).length;
        
        return Math.min(100, (totalConfigs * 2) + (totalTypes * 1));
    }

    calculateDocumentationComplexity(docFiles) {
        const totalWords = docFiles.totalWords;
        const totalLines = docFiles.totalLines;
        const totalFiles = docFiles.total;
        
        const complexity = Math.min(100, (totalWords / 100) + (totalLines / 500) + (totalFiles * 1));
        
        return complexity;
    }

    calculateOverallComplexity(metrics) {
        const weights = {
            code: 0.4,
            configuration: 0.2,
            documentation: 0.2,
            structure: 0.2
        };
        
        const codeScore = metrics.complexity.codeComplexity * weights.code;
        const configScore = metrics.complexity.configurationComplexity * weights.configuration;
        const docScore = metrics.complexity.documentationComplexity * weights.documentation;
        const structureScore = (100 - metrics.organization.organizationScore) * weights.structure;
        
        return Math.round(codeScore + configScore + docScore + structureScore);
    }

    analyzeNamingConvention(tree) {
        const namingIssues = [];
        
        function checkNaming(node) {
            if (node.type === 'directory') {
                const hasSpaces = /\s/.test(node.name);
                const hasCamelCase = /[a-z][A-Z]/.test(node.name);
                const hasSnakeCase = /_/.test(node.name);
                
                if (hasSpaces) {
                    namingIssues.push({
                        type: 'directory_spaces',
                        path: node.path,
                        name: node.name,
                        suggestion: 'Use kebab-case or camelCase'
                    });
                }
                
                if (node.children) {
                    Object.values(node.children).forEach(child => {
                        checkNaming(child);
                    });
                }
            }
        }
        
        checkNaming(tree);
        
        const totalDirectories = this.analysisResults.directoryStructure.totalDirectories;
        const consistencyScore = Math.max(0, 100 - (namingIssues.length / totalDirectories * 10));
        
        return {
            issues: namingIssues,
            consistencyScore: consistencyScore,
            convention: 'mixed' // Could be enhanced with better analysis
        };
    }

    analyzeFileDistribution(structure) {
        const distribution = {
            byDepth: {},
            bySize: {},
            byType: {}
        };
        
        function analyzeDistribution(node) {
            const depth = node.depth;
            
            distribution.byDepth[depth] = (distribution.byDepth[depth] || 0) + 1;
            
            if (node.type === 'file') {
                const sizeCategory = this.categorizeFileSize(node.size);
                distribution.bySize[sizeCategory] = (distribution.bySize[sizeCategory] || 0) + 1;
                distribution.byType[node.extension || 'unknown'] = (distribution.byType[node.extension || 'unknown'] || 0) + 1;
            }
            
            if (node.children) {
                Object.values(node.children).forEach(child => {
                    analyzeDistribution(child);
                });
            }
        }
        
        analyzeDistribution(structure);
        
        return distribution;
    }

    analyzeDirectoryStructure(tree) {
        const totalDirectories = this.analysisResults.directoryStructure.totalDirectories;
        const maxDepth = this.analysisResults.directoryStructure.maxDepth;
        
        return {
            isBalanced: maxDepth <= 5 && totalDirectories <= 20,
            isDeep: maxDepth > 8,
            isFlat: maxDepth <= 2,
            complexity: maxDepth > 10 ? 'complex' : maxDepth > 5 ? 'moderate' : 'simple'
        };
    }

    categorizeFileSize(size) {
        if (size < 1024) return 'small';
        if (size < 10240) return 'medium';
        if (size < 102400) return 'large';
        return 'xlarge';
    }

    calculateOrganizationScore(metrics) {
        let score = 50; // Base score
        
        // Structure organization
        if (metrics.structure.isBalanced) score += 20;
        if (metrics.structure.isFlat) score -= 10;
        if (metrics.structure.isDeep) score -= 15;
        if (metrics.structure.isComplex) score -= 20;
        
        // File distribution
        const distribution = metrics.files.fileTypes;
        const typeCount = Object.keys(distribution).length;
        if (typeCount > 10) score += 10;
        if (typeCount > 5) score += 5;
        
        // Naming convention
        const namingScore = metrics.organization.namingConvention.consistencyScore;
        score += namingScore * 0.3;
        
        return Math.max(0, Math.min(100, score));
    }

    calculateHealthScore(directoryPath, metrics) {
        let score = 100;
        
        // Deduct for structural issues
        if (metrics.structure.isDeep) score -= 20;
        if (metrics.structure.isComplex) score -= 15;
        if (metrics.structure.totalDirectories > 50) score -= 10;
        
        // Deduct for file issues
        if (metrics.files.binaryFiles.totalSize > metrics.files.totalSize * 0.5) score -= 15;
        if (metrics.files.codeFiles.total === 0 && metrics.files.dataFiles.total > 0) score -= 10;
        
        // Deduct for documentation issues
        if (metrics.files.documentationFiles.total < metrics.files.codeFiles.total * 0.1) score -= 10;
        
        return Math.max(0, score);
    }

    detectProjectType() {
        const fileAnalysis = this.analysisResults.fileAnalysis;
        
        if (fileAnalysis.codeFiles.total > fileAnalysis.dataFiles.total) {
            return 'Software Development';
        } else if (fileAnalysis.dataFiles.total > 0) {
            return 'Data Processing';
        } else if (fileAnalysis.mediaFiles.total > 0) {
            return 'Media Project';
        }
        
        return 'Unknown';
    }

    detectDevelopmentStage() {
        const fileAnalysis = this.analysisResults.fileAnalysis;
        const metrics = this.analysisResults.metrics;
        
        if (fileAnalysis.codeFiles.total === 0) return 'Planning';
        if (fileAnalysis.configurationFiles.total === 0 && fileAnalysis.codeFiles.total > 0) return 'Early Development';
        if (fileAnalysis.documentationFiles.total < fileAnalysis.codeFiles.total * 0.1) return 'Development';
        if (metrics.organization.organizationScore > 80) return 'Mature';
        
        return 'Unknown';
    }

    detectTechnologyStack() {
        const fileAnalysis = this.analysisResults.fileAnalysis;
        const stack = [];
        
        // Languages
        Object.entries(fileAnalysis.codeFiles.languages).forEach(([lang, count]) => {
            if (count > 0) stack.push(lang);
        });
        
        // Frameworks
        fileAnalysis.codeFiles.frameworks.forEach(framework => {
            if (!stack.includes(framework)) stack.push(framework);
        });
        
        return stack;
    }

    detectArchitecture() {
        const fileAnalysis = this.analysisResults.fileAnalysis;
        const languages = Object.keys(fileAnalysis.codeFiles.languages);
        
        if (languages.includes('js') || languages.includes('ts')) {
            return 'JavaScript/Node.js';
        } else if (languages.includes('java')) {
            return 'Java';
        } else if (languages.includes('py')) {
            return 'Python';
        } else if (languages.includes('cpp') || languages.includes('c')) {
            return 'C/C++';
        }
        
        return 'Unknown';
    }

    detectBuildSystem() {
        const fileAnalysis = this.analysisResults.fileAnalysis;
        const frameworks = fileAnalysis.codeFiles.frameworks;
        
        if (frameworks.includes('webpack') || frameworks.includes('rollup')) {
            return 'Module Bundler';
        } else if (frameworks.includes('grunt') || frameworks.includes('gulp')) {
            'Task Runner';
        } else if (fileAnalysis.configurationFiles.types['.json'] > 0) {
            return 'Node.js/npm';
        }
        
        return 'Unknown';
    }

    detectVersionControl() {
        try {
            const gitPath = path.join(this.analysisResults.directoryStructure.rootPath, '.git');
            return fs.existsSync(gitPath) ? 'Git' : 'None';
        } catch (error) {
            return 'None';
        }
    }
}

module.exports = DirectoryAnalyzer;
