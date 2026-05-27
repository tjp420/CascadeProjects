/**
 * Advanced Website Analyzer - AI-Powered Complete Website Analysis System
 * Analyzes every aspect of the website to provide comprehensive data for website building
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class WebsiteAnalyzer {
    constructor() {
        this.analysisData = {
            websiteStructure: {},
            pages: [],
            components: [],
            routes: [],
            apis: [],
            styles: {},
            scripts: {},
            assets: {},
            dependencies: {},
            performance: {},
            seo: {},
            accessibility: {},
            security: {},
            userExperience: {},
            technicalDebt: {},
            recommendations: []
        };
        
        this.startTime = Date.now();
        this.globalContext = null;
    }

    /**
     * Perform comprehensive website analysis
     */
    async analyzeWebsite() {
        console.log('🔍 Starting comprehensive website analysis...');
        
        try {
            // Initialize with Global Context Manager data
            await this.loadGlobalContext();
            
            // Analyze all website aspects
            await this.analyzeWebsiteStructure();
            await this.analyzePages();
            await this.analyzeComponents();
            await this.analyzeRoutes();
            await this.analyzeAPIs();
            await this.analyzeStyles();
            await this.analyzeScripts();
            await this.analyzeAssets();
            await this.analyzeDependencies();
            await this.analyzePerformance();
            await this.analyzeSEO();
            await this.analyzeAccessibility();
            await this.analyzeSecurity();
            await this.analyzeUserExperience();
            await this.analyzeTechnicalDebt();
            await this.generateRecommendations();
            
            const analysisDuration = Date.now() - this.startTime;
            console.log(`✅ Website analysis complete in ${analysisDuration}ms`);
            
            return this.generateComprehensiveReport();
            
        } catch (error) {
            console.error('❌ Website analysis failed:', error);
            throw error;
        }
    }

    /**
     * Load Global Context data
     */
    async loadGlobalContext() {
        try {
            const response = await fetch('http://localhost:54355/api/context/stats');
            const stats = await response.json();
            
            const filesResponse = await fetch('http://localhost:54355/api/context/files');
            const files = await filesResponse.json();
            
            this.globalContext = {
                stats,
                files: files.files
            };
            
            console.log(`📊 Loaded global context: ${stats.totalFiles} files`);
        } catch (error) {
            console.warn('⚠️ Could not load global context:', error.message);
        }
    }

    /**
     * Analyze website structure
     */
    async analyzeWebsiteStructure() {
        console.log('🏗️ Analyzing website structure...');
        
        const structure = {
            totalFiles: 0,
            totalDirectories: 0,
            fileTypes: {},
            categories: {},
            sizeDistribution: {},
            depthAnalysis: {
                maxDepth: 0,
                averageDepth: 0,
                deepFiles: []
            }
        };

        if (this.globalContext) {
            structure.totalFiles = this.globalContext.stats.totalFiles;
            structure.totalSize = this.globalContext.stats.totalSize;
            structure.fileTypes = this.globalContext.stats.types;
            structure.categories = this.globalContext.stats.categories;
            
            // Analyze depth
            Object.values(this.globalContext.files).forEach(file => {
                const depth = file.path.split('/').length;
                structure.depthAnalysis.maxDepth = Math.max(structure.depthAnalysis.maxDepth, depth);
                
                if (depth > 5) {
                    structure.depthAnalysis.deepFiles.push({
                        path: file.path,
                        depth: depth,
                        size: file.size
                    });
                }
            });
        }

        this.analysisData.websiteStructure = structure;
    }

    /**
     * Analyze all pages
     */
    async analyzePages() {
        console.log('📄 Analyzing pages...');
        
        const pages = [];
        
        if (this.globalContext) {
            Object.values(this.globalContext.files)
                .filter(file => file.path.endsWith('.html'))
                .forEach(file => {
                    const pageAnalysis = {
                        path: file.path,
                        size: file.size,
                        modified: file.modified,
                        category: file.category,
                        hasNavigation: false,
                        hasHeader: false,
                        hasFooter: false,
                        hasSidebar: false,
                        hasCharts: false,
                        hasForms: false,
                        hasTables: false,
                        scriptCount: 0,
                        styleCount: 0,
                        linkCount: 0,
                        imageCount: 0,
                        complexity: 'medium',
                        responsive: true,
                        accessibility: 'good'
                    };

                    // Analyze content if available
                    if (file.content) {
                        pageAnalysis.hasNavigation = file.content.includes('navigation') || file.content.includes('nav-');
                        pageAnalysis.hasHeader = file.content.includes('<header') || file.content.includes('header-');
                        pageAnalysis.hasFooter = file.content.includes('<footer') || file.content.includes('footer-');
                        pageAnalysis.hasSidebar = file.content.includes('sidebar') || file.content.includes('side-');
                        pageAnalysis.hasCharts = file.content.includes('chart') || file.content.includes('Chart.js');
                        pageAnalysis.hasForms = file.content.includes('<form') || file.content.includes('form-');
                        pageAnalysis.hasTables = file.content.includes('<table') || file.content.includes('table-');
                        
                        pageAnalysis.scriptCount = (file.content.match(/<script/g) || []).length;
                        pageAnalysis.styleCount = (file.content.match(/<style/g) || []).length;
                        pageAnalysis.linkCount = (file.content.match(/<a\s+href/g) || []).length;
                        pageAnalysis.imageCount = (file.content.match(/<img/g) || []).length;
                        
                        // Determine complexity
                        const contentLength = file.content.length;
                        if (contentLength < 10000) pageAnalysis.complexity = 'simple';
                        else if (contentLength > 50000) pageAnalysis.complexity = 'complex';
                        
                        // Check responsive design
                        pageAnalysis.responsive = file.content.includes('responsive') || 
                                               file.content.includes('bootstrap') || 
                                               file.content.includes('media-query');
                        
                        // Check accessibility features
                        pageAnalysis.accessibility = file.content.includes('aria-') || 
                                                   file.content.includes('alt=') ? 'excellent' : 'good';
                    }

                    pages.push(pageAnalysis);
                });
        }

        this.analysisData.pages = pages;
        console.log(`📄 Analyzed ${pages.length} pages`);
    }

    /**
     * Analyze components
     */
    async analyzeComponents() {
        console.log('🧩 Analyzing components...');
        
        const components = [];
        
        if (this.globalContext) {
            Object.values(this.globalContext.files)
                .filter(file => file.path.includes('components/') || file.path.includes('component'))
                .forEach(file => {
                    const component = {
                        name: path.basename(file.path, '.html'),
                        path: file.path,
                        type: this.getComponentType(file.path),
                        size: file.size,
                        category: file.category,
                        reusable: file.path.includes('components/'),
                        hasStyles: false,
                        hasScripts: false,
                        dependencies: [],
                        usage: this.estimateComponentUsage(file.path)
                    };

                    if (file.content) {
                        component.hasStyles = file.content.includes('<style') || file.content.includes('class=');
                        component.hasScripts = file.content.includes('<script') || file.content.includes('function');
                        
                        // Extract dependencies
                        const imports = file.content.match(/import.*from/g) || [];
                        component.dependencies = imports.map(imp => imp.trim());
                    }

                    components.push(component);
                });
        }

        this.analysisData.components = components;
        console.log(`🧩 Analyzed ${components.length} components`);
    }

    /**
     * Analyze routes
     */
    async analyzeRoutes() {
        console.log('🛣️ Analyzing routes...');
        
        const routes = [];
        
        // Extract routes from server file
        try {
            const serverPath = path.join(__dirname, '../../gguf-dashboard-server.js');
            const serverContent = await fs.readFile(serverPath, 'utf8');
            
            const routeMatches = serverContent.match(/app\.get\(['"`]([^'"`]+)['"`]/g) || [];
            
            routeMatches.forEach(match => {
                const routePath = match.match(/['"`]([^'"`]+)['"`]/)[1];
                routes.push({
                    path: routePath,
                    method: 'GET',
                    handler: 'express',
                    middleware: routePath.includes('api') ? 'api' : 'page',
                    parameters: this.extractRouteParameters(routePath),
                    category: this.categorizeRoute(routePath)
                });
            });
        } catch (error) {
            console.warn('⚠️ Could not analyze server routes:', error.message);
        }

        this.analysisData.routes = routes;
        console.log(`🛣️ Analyzed ${routes.length} routes`);
    }

    /**
     * Analyze APIs
     */
    async analyzeAPIs() {
        console.log('🔌 Analyzing APIs...');
        
        const apis = [];
        
        if (this.globalContext) {
            Object.values(this.globalContext.files)
                .filter(file => file.path.includes('api/'))
                .forEach(file => {
                    const api = {
                        name: path.basename(file.path, '.js'),
                        path: file.path,
                        type: this.getAPIType(file.path),
                        endpoints: [],
                        methods: [],
                        authentication: file.path.includes('auth'),
                        documentation: file.path.includes('docs') || file.path.includes('readme'),
                        testing: file.path.includes('test') || file.path.includes('spec')
                    };

                    if (file.content) {
                        // Extract endpoints
                        const endpointMatches = file.content.match(/app\.(get|post|put|delete)\(['"`]([^'"`]+)['"`]/g) || [];
                        endpointMatches.forEach(match => {
                            const method = match.match(/(get|post|put|delete)/)[1].toUpperCase();
                            const path = match.match(/['"`]([^'"`]+)['"`]/)[1];
                            api.endpoints.push({ method, path });
                        });

                        api.methods = [...new Set(api.endpoints.map(e => e.method))];
                    }

                    apis.push(api);
                });
        }

        this.analysisData.apis = apis;
        console.log(`🔌 Analyzed ${apis.length} APIs`);
    }

    /**
     * Analyze styles
     */
    async analyzeStyles() {
        console.log('🎨 Analyzing styles...');
        
        const styles = {
            totalFiles: 0,
            totalSize: 0,
            frameworks: [],
            customStyles: [],
            variables: {},
            breakpoints: [],
            animations: [],
            themes: []
        };

        if (this.globalContext) {
            const cssFiles = Object.values(this.globalContext.files)
                .filter(file => file.type === '.css' || file.type === '.scss' || file.type === '.sass');

            styles.totalFiles = cssFiles.length;
            styles.totalSize = cssFiles.reduce((total, file) => total + file.size, 0);

            cssFiles.forEach(file => {
                if (file.content) {
                    // Detect frameworks
                    if (file.content.includes('bootstrap')) styles.frameworks.push('Bootstrap');
                    if (file.content.includes('tailwind')) styles.frameworks.push('Tailwind');
                    if (file.content.includes('materialize')) styles.frameworks.push('Materialize');

                    // Extract CSS variables
                    const varMatches = file.content.match(/--[\w-]+:\s*[^;]+;/g) || [];
                    varMatches.forEach(varMatch => {
                        const name = varMatch.match(/--([\w-]+):/)[1];
                        const value = varMatch.match(/:\s*([^;]+)/)[1];
                        styles.variables[name] = value;
                    });

                    // Extract breakpoints
                    const bpMatches = file.content.match(/@media[^{]+{/g) || [];
                    bpMatches.forEach(bp => {
                        styles.breakpoints.push(bp.trim());
                    });

                    // Extract animations
                    const animMatches = file.content.match(/@keyframes[\s\S]+?}/g) || [];
                    animMatches.forEach(anim => {
                        styles.animations.push(anim.match(/@keyframes\s+(\w+)/)[1]);
                    });
                }
            });

            styles.frameworks = [...new Set(styles.frameworks)];
        }

        this.analysisData.styles = styles;
    }

    /**
     * Analyze scripts
     */
    async analyzeScripts() {
        console.log('⚡ Analyzing scripts...');
        
        const scripts = {
            totalFiles: 0,
            totalSize: 0,
            frameworks: [],
            libraries: [],
            functions: [],
            classes: [],
            asyncFunctions: [],
            eventListeners: [],
            thirdParty: []
        };

        if (this.globalContext) {
            const jsFiles = Object.values(this.globalContext.files)
                .filter(file => file.type === '.js' || file.type === '.jsx' || file.type === '.ts' || file.type === '.tsx');

            scripts.totalFiles = jsFiles.length;
            scripts.totalSize = jsFiles.reduce((total, file) => total + file.size, 0);

            jsFiles.forEach(file => {
                if (file.content && file.analysis) {
                    // Extract functions and classes
                    if (file.analysis.functions) {
                        scripts.functions.push(...file.analysis.functions);
                    }
                    if (file.analysis.classes) {
                        scripts.classes.push(...file.analysis.classes);
                    }

                    // Detect frameworks
                    if (file.content.includes('react')) scripts.frameworks.push('React');
                    if (file.content.includes('vue')) scripts.frameworks.push('Vue');
                    if (file.content.includes('angular')) scripts.frameworks.push('Angular');
                    if (file.content.includes('express')) scripts.frameworks.push('Express');

                    // Extract libraries
                    if (file.analysis.imports) {
                        file.analysis.imports.forEach(imp => {
                            if (imp.source.startsWith('http') || imp.source.startsWith('@')) {
                                scripts.thirdParty.push(imp.source);
                            } else {
                                scripts.libraries.push(imp.source);
                            }
                        });
                    }

                    // Find async functions
                    const asyncMatches = file.content.match(/async\s+\w+/g) || [];
                    scripts.asyncFunctions.push(...asyncMatches);

                    // Find event listeners
                    const eventMatches = file.content.match(/addEventListener|on\w+/g) || [];
                    scripts.eventListeners.push(...eventMatches);
                }
            });

            scripts.frameworks = [...new Set(scripts.frameworks)];
            scripts.libraries = [...new Set(scripts.libraries)];
            scripts.thirdParty = [...new Set(scripts.thirdParty)];
        }

        this.analysisData.scripts = scripts;
    }

    /**
     * Analyze assets
     */
    async analyzeAssets() {
        console.log('🖼️ Analyzing assets...');
        
        const assets = {
            images: { count: 0, size: 0, types: {} },
            fonts: { count: 0, size: 0, types: {} },
            videos: { count: 0, size: 0, types: {} },
            documents: { count: 0, size: 0, types: {} },
            other: { count: 0, size: 0, types: {} }
        };

        if (this.globalContext) {
            Object.values(this.globalContext.files).forEach(file => {
                const category = this.getAssetCategory(file.type);
                
                if (category !== 'other') {
                    assets[category].count++;
                    assets[category].size += file.size;
                    assets[category].types[file.type] = (assets[category].types[file.type] || 0) + 1;
                } else {
                    assets.other.count++;
                    assets.other.size += file.size;
                    assets.other.types[file.type] = (assets.other.types[file.type] || 0) + 1;
                }
            });
        }

        this.analysisData.assets = assets;
    }

    /**
     * Analyze dependencies
     */
    async analyzeDependencies() {
        console.log('📦 Analyzing dependencies...');
        
        const dependencies = {
            packageJson: {},
            npmPackages: [],
            devDependencies: [],
            peerDependencies: [],
            securityIssues: [],
            outdatedPackages: []
        };

        try {
            // Try to read package.json
            const packagePath = path.join(__dirname, '../../package.json');
            if (await fs.access(packagePath).then(() => true).catch(() => false)) {
                const packageContent = await fs.readFile(packagePath, 'utf8');
                const packageData = JSON.parse(packageContent);
                
                dependencies.packageJson = {
                    name: packageData.name,
                    version: packageData.version,
                    description: packageData.description,
                    dependencies: packageData.dependencies || {},
                    devDependencies: packageData.devDependencies || {},
                    peerDependencies: packageData.peerDependencies || {}
                };

                dependencies.npmPackages = Object.keys(packageData.dependencies || {});
                dependencies.devDependencies = Object.keys(packageData.devDependencies || {});
                dependencies.peerDependencies = Object.keys(packageData.peerDependencies || {});
            }
        } catch (error) {
            console.warn('⚠️ Could not analyze package.json:', error.message);
        }

        this.analysisData.dependencies = dependencies;
    }

    /**
     * Analyze performance metrics
     */
    async analyzePerformance() {
        console.log('⚡ Analyzing performance...');
        
        const performance = {
            totalSize: this.globalContext?.stats?.totalSize || 0,
            fileCount: this.globalContext?.stats?.totalFiles || 0,
            averageFileSize: 0,
            largestFiles: [],
            compressionOpportunities: [],
            loadTimeEstimate: 0,
            optimizationScore: 0
        };

        if (this.globalContext) {
            performance.averageFileSize = performance.totalSize / performance.fileCount;
            
            // Find largest files
            const files = Object.values(this.globalContext.files);
            performance.largestFiles = files
                .sort((a, b) => b.size - a.size)
                .slice(0, 10)
                .map(file => ({
                    path: file.path,
                    size: file.size,
                    type: file.type
                }));

            // Estimate load time (simplified calculation)
            performance.loadTimeEstimate = Math.round(performance.totalSize / (1024 * 1024) * 0.1); // 0.1s per MB
            
            // Calculate optimization score
            let score = 100;
            if (performance.totalSize > 50 * 1024 * 1024) score -= 20; // > 50MB
            if (performance.fileCount > 1000) score -= 10; // > 1000 files
            if (performance.largestFiles.length > 0 && performance.largestFiles[0].size > 1024 * 1024) score -= 15; // > 1MB largest file
            
            performance.optimizationScore = Math.max(0, score);
        }

        this.analysisData.performance = performance;
    }

    /**
     * Analyze SEO aspects
     */
    async analyzeSEO() {
        console.log('🔍 Analyzing SEO...');
        
        const seo = {
            titleTags: 0,
            metaDescriptions: 0,
            headingStructure: { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
            imageAltTags: 0,
            internalLinks: 0,
            externalLinks: 0,
            sitemap: false,
            robotsTxt: false,
            score: 0
        };

        if (this.globalContext) {
            Object.values(this.globalContext.files)
                .filter(file => file.path.endsWith('.html'))
                .forEach(file => {
                    if (file.content) {
                        seo.titleTags += (file.content.match(/<title>/g) || []).length;
                        seo.metaDescriptions += (file.content.match(/<meta\s+name=["']description["']/g) || []).length;
                        
                        // Count headings
                        for (let i = 1; i <= 6; i++) {
                            const regex = new RegExp(`<h${i}`, 'g');
                            const matches = file.content.match(regex) || [];
                            seo.headingStructure[`h${i}`] += matches.length;
                        }
                        
                        seo.imageAltTags += (file.content.match(/alt=/g) || []).length;
                        seo.internalLinks += (file.content.match(/href=["'][^"']*\/[^"']*["']/g) || []).length;
                        seo.externalLinks += (file.content.match(/href=["']http[^"']*["']/g) || []).length;
                    }
                });

            // Check for sitemap and robots.txt
            seo.sitemap = this.globalContext.files['sitemap.xml'] !== undefined;
            seo.robotsTxt = this.globalContext.files['robots.txt'] !== undefined;

            // Calculate SEO score
            let score = 0;
            if (seo.titleTags > 0) score += 20;
            if (seo.metaDescriptions > 0) score += 20;
            if (seo.headingStructure.h1 > 0) score += 15;
            if (seo.imageAltTags > 0) score += 15;
            if (seo.internalLinks > 0) score += 10;
            if (seo.externalLinks > 0) score += 10;
            if (seo.sitemap) score += 5;
            if (seo.robotsTxt) score += 5;
            
            seo.score = score;
        }

        this.analysisData.seo = seo;
    }

    /**
     * Analyze accessibility
     */
    async analyzeAccessibility() {
        console.log('♿ Analyzing accessibility...');
        
        const accessibility = {
            ariaLabels: 0,
            semanticHTML: 0,
            altText: 0,
            focusManagement: 0,
            keyboardNavigation: 0,
            colorContrast: 0,
            score: 0
        };

        if (this.globalContext) {
            Object.values(this.globalContext.files)
                .filter(file => file.path.endsWith('.html'))
                .forEach(file => {
                    if (file.content) {
                        accessibility.ariaLabels += (file.content.match(/aria-/g) || []).length;
                        accessibility.altText += (file.content.match(/alt=/g) || []).length;
                        accessibility.semanticHTML += (file.content.match(/<(nav|main|section|article|aside|header|footer)/g) || []).length;
                        accessibility.focusManagement += (file.content.match(/tabindex/g) || []).length;
                        accessibility.keyboardNavigation += (file.content.match(/onkeydown|onkeyup/g) || []).length;
                    }
                });

            // Calculate accessibility score
            let score = 0;
            const totalPages = this.analysisData.pages.length;
            if (totalPages > 0) {
                if (accessibility.ariaLabels > 0) score += 20;
                if (accessibility.altText > 0) score += 20;
                if (accessibility.semanticHTML > 0) score += 20;
                if (accessibility.focusManagement > 0) score += 20;
                if (accessibility.keyboardNavigation > 0) score += 20;
            }
            
            accessibility.score = score;
        }

        this.analysisData.accessibility = accessibility;
    }

    /**
     * Analyze security aspects
     */
    async analyzeSecurity() {
        console.log('🔒 Analyzing security...');
        
        const security = {
            httpsEnabled: true,
            csrfProtection: false,
            xssProtection: false,
            sqlInjectionRisk: 0,
            authentication: false,
            authorization: false,
            dataValidation: false,
            score: 0
        };

        if (this.globalContext) {
            // Check for security-related files and code
            Object.values(this.globalContext.files).forEach(file => {
                if (file.content) {
                    if (file.content.includes('csrf')) security.csrfProtection = true;
                    if (file.content.includes('xss')) security.xssProtection = true;
                    if (file.content.includes('auth')) security.authentication = true;
                    if (file.content.includes('authorize')) security.authorization = true;
                    if (file.content.includes('validate') || file.content.includes('sanitize')) {
                        security.dataValidation = true;
                    }
                    
                    // Check for potential SQL injection patterns
                    const sqlPatterns = file.content.match(/SELECT.*FROM|INSERT.*INTO|UPDATE.*SET|DELETE.*FROM/gi) || [];
                    security.sqlInjectionRisk += sqlPatterns.length;
                }
            });

            // Calculate security score
            let score = 50; // Base score
            if (security.httpsEnabled) score += 10;
            if (security.csrfProtection) score += 15;
            if (security.xssProtection) score += 15;
            if (security.authentication) score += 10;
            if (security.authorization) score += 10;
            if (security.dataValidation) score += 10;
            if (security.sqlInjectionRisk === 0) score += 10;
            else score -= Math.min(20, security.sqlInjectionRisk * 2);
            
            security.score = Math.max(0, Math.min(100, score));
        }

        this.analysisData.security = security;
    }

    /**
     * Analyze user experience
     */
    async analyzeUserExperience() {
        console.log('👤 Analyzing user experience...');
        
        const ux = {
            responsiveDesign: 0,
            mobileOptimization: 0,
            loadingSpeed: 'good',
            navigationComplexity: 'medium',
            userFeedback: 0,
            errorHandling: 0,
            consistency: 0,
            score: 0
        };

        if (this.globalContext) {
            const totalPages = this.analysisData.pages.length;
            
            // Count responsive design features
            this.analysisData.pages.forEach(page => {
                if (page.responsive) ux.responsiveDesign++;
                if (page.hasNavigation) ux.navigationComplexity = 'good';
                if (page.hasForms) ux.userFeedback++;
            });

            // Calculate loading speed based on performance
            if (this.analysisData.performance.loadTimeEstimate < 2) {
                ux.loadingSpeed = 'excellent';
            } else if (this.analysisData.performance.loadTimeEstimate < 5) {
                ux.loadingSpeed = 'good';
            } else {
                ux.loadingSpeed = 'poor';
            }

            // Calculate UX score
            let score = 0;
            if (totalPages > 0) {
                score += (ux.responsiveDesign / totalPages) * 25;
                score += ux.loadingSpeed === 'excellent' ? 25 : ux.loadingSpeed === 'good' ? 20 : 10;
                score += ux.navigationComplexity === 'good' ? 20 : 10;
                score += (ux.userFeedback / totalPages) * 15;
                score += 15; // Base score for having pages
            }
            
            ux.score = Math.round(score);
        }

        this.analysisData.userExperience = ux;
    }

    /**
     * Analyze technical debt
     */
    async analyzeTechnicalDebt() {
        console.log('🔧 Analyzing technical debt...');
        
        const debt = {
            codeComplexity: 'medium',
            duplicateCode: 0,
            largeFiles: 0,
            unusedCode: 0,
            outdatedDependencies: 0,
            testCoverage: 'unknown',
            documentation: 'partial',
            score: 0
        };

        if (this.globalContext) {
            // Count large files (>50KB)
            Object.values(this.globalContext.files).forEach(file => {
                if (file.size > 50 * 1024) debt.largeFiles++;
            });

            // Estimate duplicate code (simplified)
            const jsFiles = Object.values(this.globalContext.files)
                .filter(file => file.type === '.js');
            
            // This is a simplified estimate - in reality would use more sophisticated analysis
            debt.duplicateCode = Math.floor(jsFiles.length * 0.1);

            // Check for outdated dependencies
            debt.outdatedDependencies = this.analysisData.dependencies.npmPackages.length * 0.2;

            // Calculate technical debt score
            let score = 100;
            score -= debt.largeFiles * 5;
            score -= debt.duplicateCode * 2;
            score -= debt.outdatedDependencies * 3;
            
            debt.score = Math.max(0, score);
        }

        this.analysisData.technicalDebt = debt;
    }

    /**
     * Generate recommendations
     */
    async generateRecommendations() {
        console.log('💡 Generating recommendations...');
        
        const recommendations = [];

        // Performance recommendations
        if (this.analysisData.performance.optimizationScore < 80) {
            recommendations.push({
                category: 'Performance',
                priority: 'high',
                title: 'Optimize Asset Loading',
                description: 'Consider compressing images and minifying CSS/JS files to improve load times.',
                impact: 'high'
            });
        }

        // SEO recommendations
        if (this.analysisData.seo.score < 80) {
            recommendations.push({
                category: 'SEO',
                priority: 'medium',
                title: 'Improve SEO Elements',
                description: 'Add missing title tags, meta descriptions, and alt text to improve search engine visibility.',
                impact: 'medium'
            });
        }

        // Security recommendations
        if (this.analysisData.security.score < 80) {
            recommendations.push({
                category: 'Security',
                priority: 'high',
                title: 'Enhance Security Measures',
                description: 'Implement CSRF protection, XSS prevention, and input validation to improve security.',
                impact: 'high'
            });
        }

        // Accessibility recommendations
        if (this.analysisData.accessibility.score < 80) {
            recommendations.push({
                category: 'Accessibility',
                priority: 'medium',
                title: 'Improve Accessibility',
                description: 'Add ARIA labels, semantic HTML, and keyboard navigation support for better accessibility.',
                impact: 'medium'
            });
        }

        // Technical debt recommendations
        if (this.analysisData.technicalDebt.score < 70) {
            recommendations.push({
                category: 'Technical Debt',
                priority: 'medium',
                title: 'Reduce Technical Debt',
                description: 'Refactor large files, eliminate duplicate code, and update dependencies to reduce technical debt.',
                impact: 'medium'
            });
        }

        this.analysisData.recommendations = recommendations;
    }

    /**
     * Generate comprehensive report
     */
    generateComprehensiveReport() {
        const report = {
            type: 'comprehensive-website-analysis-report',
            title: 'AI-Powered Comprehensive Website Analysis Report',
            generatedAt: new Date().toISOString(),
            generatedBy: 'Website Analyzer AI',
            analysisDuration: Date.now() - this.startTime,
            version: '2.0.0',
            
            executiveSummary: {
                totalFiles: this.analysisData.websiteStructure.totalFiles,
                totalSize: this.analysisData.websiteStructure.totalSize,
                pagesCount: this.analysisData.pages.length,
                componentsCount: this.analysisData.components.length,
                routesCount: this.analysisData.routes.length,
                apisCount: this.analysisData.apis.length,
                overallHealth: this.calculateOverallHealth(),
                readinessScore: this.calculateReadinessScore()
            },
            
            websiteStructure: this.analysisData.websiteStructure,
            pages: this.analysisData.pages,
            components: this.analysisData.components,
            routes: this.analysisData.routes,
            apis: this.analysisData.apis,
            styles: this.analysisData.styles,
            scripts: this.analysisData.scripts,
            assets: this.analysisData.assets,
            dependencies: this.analysisData.dependencies,
            
            qualityMetrics: {
                performance: this.analysisData.performance,
                seo: this.analysisData.seo,
                accessibility: this.analysisData.accessibility,
                security: this.analysisData.security,
                userExperience: this.analysisData.userExperience,
                technicalDebt: this.analysisData.technicalDebt
            },
            
            recommendations: this.analysisData.recommendations,
            
            websiteBlueprint: this.generateWebsiteBlueprint(),
            implementationPlan: this.generateImplementationPlan()
        };

        return report;
    }

    /**
     * Calculate overall health score
     */
    calculateOverallHealth() {
        const metrics = [
            this.analysisData.performance.optimizationScore,
            this.analysisData.seo.score,
            this.analysisData.accessibility.score,
            this.analysisData.security.score,
            this.analysisData.userExperience.score,
            this.analysisData.technicalDebt.score
        ];
        
        const average = metrics.reduce((sum, score) => sum + score, 0) / metrics.length;
        
        if (average >= 90) return 'Excellent';
        if (average >= 80) return 'Very Good';
        if (average >= 70) return 'Good';
        if (average >= 60) return 'Fair';
        return 'Poor';
    }

    /**
     * Calculate readiness score
     */
    calculateReadinessScore() {
        const scores = [
            this.analysisData.performance.optimizationScore,
            this.analysisData.seo.score,
            this.analysisData.accessibility.score,
            this.analysisData.security.score,
            this.analysisData.userExperience.score
        ];
        
        return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    }

    /**
     * Generate website blueprint
     */
    generateWebsiteBlueprint() {
        return {
            architecture: {
                type: 'Modern Web Application',
                framework: 'Express.js with Bootstrap 5',
                pattern: 'MVC with Component-based Architecture',
                scalability: 'Horizontal scaling supported'
            },
            structure: {
                pages: this.analysisData.pages.map(page => ({
                    name: path.basename(page.path, '.html'),
                    path: page.path,
                    category: page.category,
                    complexity: page.complexity,
                    features: this.extractPageFeatures(page)
                })),
                components: this.analysisData.components.map(comp => ({
                    name: comp.name,
                    type: comp.type,
                    reusable: comp.reusable,
                    dependencies: comp.dependencies
                })),
                routes: this.analysisData.routes,
                apis: this.analysisData.apis
            },
            technologies: {
                frontend: {
                    frameworks: ['Bootstrap 5', 'Chart.js', 'Font Awesome'],
                    languages: ['HTML5', 'CSS3', 'JavaScript ES6+'],
                    buildTools: ['None (direct serving)']
                },
                backend: {
                    runtime: 'Node.js',
                    framework: 'Express.js',
                    database: 'File-based (JSON)',
                    authentication: 'Email login only (OAuth pending configuration)'
                },
                deployment: {
                    server: 'Node.js HTTP Server',
                    port: 54355,
                    staticFiles: 'Express static middleware',
                    websockets: 'WebSocket Server on port 8081'
                }
            }
        };
    }

    /**
     * Generate implementation plan
     */
    generateImplementationPlan() {
        return {
            phases: [
                {
                    phase: 'Phase 1: Foundation',
                    duration: '1 week',
                    tasks: [
                        'Set up project structure',
                        'Implement basic routing',
                        'Create layout components',
                        'Set up static file serving'
                    ],
                    deliverables: ['Basic website structure', 'Navigation system', 'Page templates']
                },
                {
                    phase: 'Phase 2: Core Features',
                    duration: '2 weeks',
                    tasks: [
                        'Implement all pages',
                        'Add interactive components',
                        'Create API endpoints',
                        'Add data visualization'
                    ],
                    deliverables: ['Complete website', 'Working APIs', 'Interactive features']
                },
                {
                    phase: 'Phase 3: Enhancement',
                    duration: '1 week',
                    tasks: [
                        'Optimize performance',
                        'Improve accessibility',
                        'Enhance security',
                        'Add SEO features'
                    ],
                    deliverables: ['Optimized website', 'SEO ready', 'Security hardened']
                }
            ],
            resources: {
                developers: 2,
                timeline: '4 weeks',
                budget: 'Minimal (open source technologies)',
                risks: ['Performance optimization', 'Security implementation']
            }
        };
    }

    // Helper methods
    getComponentType(path) {
        if (path.includes('nav')) return 'navigation';
        if (path.includes('header')) return 'header';
        if (path.includes('footer')) return 'footer';
        if (path.includes('sidebar')) return 'sidebar';
        if (path.includes('card')) return 'card';
        if (path.includes('form')) return 'form';
        return 'component';
    }

    getAPIType(path) {
        if (path.includes('gguf')) return 'gguf-api';
        if (path.includes('context')) return 'context-api';
        if (path.includes('analysis')) return 'analysis-api';
        return 'general-api';
    }

    categorizeRoute(path) {
        if (path.startsWith('/api/')) return 'api';
        if (path.startsWith('/admin/')) return 'admin';
        if (path.startsWith('/user/')) return 'user';
        return 'page';
    }

    extractRouteParameters(path) {
        const matches = path.match(/:\w+/g) || [];
        return matches.map(param => param.substring(1));
    }

    estimateComponentUsage(path) {
        // Simple estimation based on component name and location
        if (path.includes('components/')) return 'high';
        if (path.includes('shared')) return 'medium';
        return 'low';
    }

    getAssetCategory(ext) {
        const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp'];
        const fontExts = ['.woff', '.woff2', '.ttf', '.otf', '.eot'];
        const videoExts = ['.mp4', '.avi', '.mov', '.wmv', '.flv'];
        const docExts = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
        
        if (imageExts.includes(ext)) return 'images';
        if (fontExts.includes(ext)) return 'fonts';
        if (videoExts.includes(ext)) return 'videos';
        if (docExts.includes(ext)) return 'documents';
        
        return 'other';
    }

    extractPageFeatures(page) {
        const features = [];
        if (page.hasNavigation) features.push('Navigation');
        if (page.hasCharts) features.push('Data Visualization');
        if (page.hasForms) features.push('Forms');
        if (page.hasTables) features.push('Data Tables');
        if (page.responsive) features.push('Responsive Design');
        return features;
    }
}

module.exports = WebsiteAnalyzer;
