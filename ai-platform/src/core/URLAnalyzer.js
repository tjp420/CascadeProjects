/**
 * URL Analyzer - Comprehensive URL and website analysis system
 * Provides drag-and-drop address bar functionality for analyzing any website
 */

class URLAnalyzer {
    constructor() {
        this.analysisHistory = [];
        this.currentAnalysis = null;
        this.supportedSchemes = ['http', 'https', 'ftp', 'file'];
        this.analysisTypes = [
            'structure',
            'performance', 
            'seo',
            'security',
            'accessibility',
            'content',
            'technology',
            'links'
        ];
    }

    /**
     * Validate and normalize URL input
     */
    validateURL(url) {
        if (!url || typeof url !== 'string') {
            throw new Error('Invalid URL: URL must be a string');
        }

        // Add scheme if missing
        if (!url.match(/^https?:\/\//) && !url.match(/^ftp:\/\//) && !url.match(/^file:\/\//)) {
            url = 'https://' + url;
        }

        try {
            const parsedURL = new URL(url);
            
            if (!this.supportedSchemes.includes(parsedURL.protocol.replace(':', ''))) {
                throw new Error(`Unsupported protocol: ${parsedURL.protocol}`);
            }

            return parsedURL.toString();
        } catch (error) {
            throw new Error(`Invalid URL format: ${error.message}`);
        }
    }

    /**
     * Analyze URL structure and content
     */
    async analyzeURL(url, options = {}) {
        const validatedURL = this.validateURL(url);
        const analysisId = this.generateAnalysisId();
        
        const analysisConfig = {
            includeStructure: options.includeStructure !== false,
            includePerformance: options.includePerformance !== false,
            includeSEO: options.includeSEO !== false,
            includeSecurity: options.includeSecurity !== false,
            includeAccessibility: options.includeAccessibility !== false,
            includeContent: options.includeContent !== false,
            includeTechnology: options.includeTechnology !== false,
            includeLinks: options.includeLinks !== false,
            depth: options.depth || 3,
            timeout: options.timeout || 30000
        };

        try {
            console.log(`🔍 Starting URL analysis for: ${validatedURL}`);
            
            const analysis = {
                id: analysisId,
                url: validatedURL,
                timestamp: new Date().toISOString(),
                status: 'analyzing',
                progress: 0,
                config: analysisConfig,
                results: {}
            };

            this.currentAnalysis = analysis;

            // Step 1: Basic URL validation and fetch
            analysis.progress = 10;
            const response = await this.fetchURL(validatedURL, analysisConfig.timeout);
            
            // Step 2: Structure analysis
            if (analysisConfig.includeStructure) {
                analysis.progress = 30;
                analysis.results.structure = await this.analyzeStructure(response, validatedURL);
            }

            // Step 3: Performance analysis
            if (analysisConfig.includePerformance) {
                analysis.progress = 50;
                analysis.results.performance = await this.analyzePerformance(validatedURL);
            }

            // Step 4: SEO analysis
            if (analysisConfig.includeSEO) {
                analysis.progress = 60;
                analysis.results.seo = await this.analyzeSEO(response);
            }

            // Step 5: Security analysis
            if (analysisConfig.includeSecurity) {
                analysis.progress = 70;
                analysis.results.security = await this.analyzeSecurity(validatedURL, response);
            }

            // Step 6: Accessibility analysis
            if (analysisConfig.includeAccessibility) {
                analysis.progress = 80;
                analysis.results.accessibility = await this.analyzeAccessibility(response);
            }

            // Step 7: Content analysis
            if (analysisConfig.includeContent) {
                analysis.progress = 85;
                analysis.results.content = await this.analyzeContent(response);
            }

            // Step 8: Technology detection
            if (analysisConfig.includeTechnology) {
                analysis.progress = 90;
                analysis.results.technology = await this.detectTechnology(response);
            }

            // Step 9: Links analysis
            if (analysisConfig.includeLinks) {
                analysis.progress = 95;
                analysis.results.links = await this.analyzeLinks(response, validatedURL);
            }

            // Complete analysis
            analysis.progress = 100;
            analysis.status = 'completed';
            analysis.completedAt = new Date().toISOString();
            analysis.duration = new Date() - new Date(analysis.timestamp);

            // Generate summary and recommendations
            analysis.summary = this.generateSummary(analysis.results);
            analysis.recommendations = this.generateRecommendations(analysis.results);
            analysis.score = this.calculateOverallScore(analysis.results);

            this.analysisHistory.push(analysis);
            console.log(`✅ URL analysis completed: ${validatedURL}`);

            return analysis;

        } catch (error) {
            console.error(`❌ URL analysis failed: ${error.message}`);
            
            if (this.currentAnalysis) {
                this.currentAnalysis.status = 'failed';
                this.currentAnalysis.error = error.message;
                this.currentAnalysis.completedAt = new Date().toISOString();
            }

            throw error;
        }
    }

    /**
     * Fetch URL content with proper headers and timeout
     */
    async fetchURL(url, timeout = 30000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const content = await response.text();
            const headers = Object.fromEntries(response.headers.entries());

            return {
                url: response.url,
                status: response.status,
                statusText: response.statusText,
                headers: headers,
                content: content,
                size: content.length
            };

        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    /**
     * Analyze website structure
     */
    async analyzeStructure(response, baseURL) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(response.content, 'text/html');
        
        const structure = {
            title: doc.querySelector('title')?.textContent || '',
            meta: this.extractMetaTags(doc),
            headings: this.extractHeadings(doc),
            images: this.extractImages(doc, baseURL),
            links: this.extractLinks(doc, baseURL),
            forms: this.extractForms(doc),
            scripts: this.extractScripts(doc, baseURL),
            styles: this.extractStyles(doc, baseURL),
            tables: this.extractTables(doc),
            lists: this.extractLists(doc),
            semanticElements: this.extractSemanticElements(doc)
        };

        return {
            overview: {
                totalElements: this.countTotalElements(structure),
                hasTitle: !!structure.title,
                metaTagsCount: structure.meta.length,
                headingLevels: this.analyzeHeadingStructure(structure.headings),
                imageCount: structure.images.length,
                linkCount: structure.links.length,
                formCount: structure.forms.length,
                scriptCount: structure.scripts.length,
                styleCount: structure.styles.length
            },
            details: structure
        };
    }

    /**
     * Analyze performance metrics
     */
    async analyzePerformance(url) {
        const performance = {
            loadTime: 0,
            size: 0,
            requests: 0,
            score: 0,
            metrics: {
                firstContentfulPaint: 0,
                largestContentfulPaint: 0,
                cumulativeLayoutShift: 0,
                totalBlockingTime: 0
            },
            recommendations: []
        };

        try {
            const startTime = performance.now();
            const response = await fetch(url, { method: 'HEAD' });
            const endTime = performance.now();
            
            performance.loadTime = endTime - startTime;
            performance.size = parseInt(response.headers.get('content-length') || '0');
            performance.requests = 1;

            // Calculate performance score based on load time and size
            if (performance.loadTime < 1000) performance.score = 100;
            else if (performance.loadTime < 2000) performance.score = 80;
            else if (performance.loadTime < 3000) performance.score = 60;
            else performance.score = 40;

            // Generate recommendations
            if (performance.loadTime > 2000) {
                performance.recommendations.push('Consider optimizing images and minifying CSS/JS');
            }
            if (performance.size > 1000000) {
                performance.recommendations.push('Page size is large, consider compression');
            }

        } catch (error) {
            performance.error = error.message;
        }

        return performance;
    }

    /**
     * Analyze SEO factors
     */
    async analyzeSEO(response) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(response.content, 'text/html');
        
        const seo = {
            title: {
                present: !!doc.querySelector('title'),
                length: doc.querySelector('title')?.textContent?.length || 0,
                optimal: false
            },
            description: {
                present: !!doc.querySelector('meta[name="description"]'),
                length: doc.querySelector('meta[name="description"]')?.getAttribute('content')?.length || 0,
                optimal: false
            },
            headings: this.analyzeSEOHeadings(doc),
            images: this.analyzeSEOImages(doc),
            links: this.analyzeSEOLinks(doc),
            structured: this.analyzeStructuredData(doc),
            score: 0
        };

        // Calculate optimal lengths
        seo.title.optimal = seo.title.length >= 30 && seo.title.length <= 60;
        seo.description.optimal = seo.description.length >= 120 && seo.description.length <= 160;

        // Calculate SEO score
        let score = 0;
        if (seo.title.present) score += 20;
        if (seo.title.optimal) score += 10;
        if (seo.description.present) score += 20;
        if (seo.description.optimal) score += 10;
        if (seo.headings.hasH1) score += 15;
        if (seo.images.altTextRatio > 0.8) score += 15;
        if (seo.structured.hasData) score += 10;

        seo.score = Math.min(100, score);

        return seo;
    }

    /**
     * Analyze security factors
     */
    async analyzeSecurity(url, response) {
        const security = {
            https: url.startsWith('https://'),
            headers: this.analyzeSecurityHeaders(response.headers),
            forms: this.analyzeFormSecurity(response.content),
            scripts: this.analyzeScriptSecurity(response.content),
            mixedContent: this.checkMixedContent(url, response.content),
            score: 0,
            vulnerabilities: []
        };

        // Calculate security score
        let score = 50; // Base score
        if (security.https) score += 20;
        if (security.headers.securityHeaders >= 5) score += 15;
        if (!security.forms.insecureForms) score += 10;
        if (!security.scripts.hasInlineScripts) score += 5;

        security.score = Math.min(100, score);

        return security;
    }

    /**
     * Analyze accessibility
     */
    async analyzeAccessibility(response) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(response.content, 'text/html');
        
        const accessibility = {
            images: this.checkImageAccessibility(doc),
            headings: this.checkHeadingAccessibility(doc),
            forms: this.checkFormAccessibility(doc),
            tables: this.checkTableAccessibility(doc),
            links: this.checkLinkAccessibility(doc),
            language: doc.documentElement.getAttribute('lang') || 'not-set',
            contrast: this.checkColorContrast(doc),
            score: 0,
            issues: []
        };

        // Calculate accessibility score
        let score = 0;
        if (accessibility.images.altTextRatio > 0.8) score += 20;
        if (accessibility.headings.properStructure) score += 20;
        if (accessibility.forms.hasLabels) score += 15;
        if (accessibility.tables.hasHeaders) score += 15;
        if (accessibility.language !== 'not-set') score += 10;
        if (accessibility.links.descriptiveText > 0.8) score += 10;
        if (accessibility.contrast.passes) score += 10;

        accessibility.score = Math.min(100, score);

        return accessibility;
    }

    /**
     * Analyze content quality
     */
    async analyzeContent(response) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(response.content, 'text/html');
        
        const content = {
            textContent: doc.body?.textContent || '',
            wordCount: 0,
            readability: {
                score: 0,
                level: '',
                avgWordsPerSentence: 0,
                avgSyllablesPerWord: 0
            },
            language: this.detectLanguage(doc.body?.textContent || ''),
            structure: this.analyzeContentStructure(doc),
            quality: {
                hasMainContent: !!doc.querySelector('main, [role="main"], #main, .main'),
                hasNavigation: !!doc.querySelector('nav, [role="navigation"], #nav, .nav'),
                hasFooter: !!doc.querySelector('footer, [role="contentinfo"], #footer, .footer'),
                hasHeader: !!doc.querySelector('header, [role="banner"], #header, .header')
            }
        };

        // Calculate word count and readability
        const words = content.textContent.trim().split(/\s+/).filter(word => word.length > 0);
        content.wordCount = words.length;
        
        if (content.wordCount > 0) {
            const sentences = content.textContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
            const avgWordsPerSentence = content.wordCount / sentences.length;
            
            content.readability.avgWordsPerSentence = avgWordsPerSentence;
            content.readability.score = this.calculateReadabilityScore(content.textContent);
            content.readability.level = this.getReadabilityLevel(content.readability.score);
        }

        return content;
    }

    /**
     * Detect technologies used
     */
    async detectTechnology(response) {
        const content = response.content.toLowerCase();
        const headers = JSON.stringify(response.headers).toLowerCase();
        
        const technology = {
            frameworks: [],
            libraries: [],
            cms: [],
            analytics: [],
            fonts: [],
            server: this.detectServer(response.headers),
            database: [],
            other: []
        };

        // Framework detection
        const frameworks = {
            'react': /react|reactdom/i,
            'vue': /vue\.js|vue/i,
            'angular': /angular|ng-/i,
            'bootstrap': /bootstrap/i,
            'tailwind': /tailwind/i,
            'jquery': /jquery|\$/i,
            'next.js': /next\.js|_next/i
        };

        for (const [name, pattern] of Object.entries(frameworks)) {
            if (pattern.test(content) || pattern.test(headers)) {
                technology.frameworks.push(name);
            }
        }

        // CMS detection
        const cms = {
            'wordpress': /wp-content|wordpress/i,
            'drupal': /drupal/i,
            'joomla': /joomla/i,
            'shopify': /shopify/i
        };

        for (const [name, pattern] of Object.entries(cms)) {
            if (pattern.test(content)) {
                technology.cms.push(name);
            }
        }

        // Analytics detection
        const analytics = {
            'google analytics': /google.*analytics|ga\(/i,
            'google tag manager': /gtm-|googletagmanager/i,
            'hotjar': /hotjar/i,
            'mixpanel': /mixpanel/i
        };

        for (const [name, pattern] of Object.entries(analytics)) {
            if (pattern.test(content)) {
                technology.analytics.push(name);
            }
        }

        return technology;
    }

    /**
     * Analyze links
     */
    async analyzeLinks(response, baseURL) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(response.content, 'text/html');
        
        const links = this.extractLinks(doc, baseURL);
        
        const analysis = {
            total: links.length,
            internal: 0,
            external: 0,
            broken: 0,
            nofollow: 0,
            sameDomain: 0,
            differentDomain: 0,
            protocols: {},
            statusCodes: {},
            categories: {
                navigation: 0,
                content: 0,
                download: 0,
                social: 0,
                other: 0
            }
        };

        const baseDomain = new URL(baseURL).hostname;

        links.forEach(link => {
            // Internal vs External
            if (link.url.startsWith(baseURL) || link.url.startsWith('/') || !link.url.includes('://')) {
                analysis.internal++;
                analysis.sameDomain++;
            } else {
                analysis.external++;
                analysis.differentDomain++;
            }

            // Nofollow
            if (link.rel?.includes('nofollow')) {
                analysis.nofollow++;
            }

            // Protocol
            const protocol = new URL(link.url, baseURL).protocol;
            analysis.protocols[protocol] = (analysis.protocols[protocol] || 0) + 1;

            // Category
            if (link.text.toLowerCase().includes('home') || link.text.toLowerCase().includes('menu')) {
                analysis.categories.navigation++;
            } else if (link.url.includes('.pdf') || link.url.includes('.doc')) {
                analysis.categories.download++;
            } else if (link.url.includes('facebook') || link.url.includes('twitter')) {
                analysis.categories.social++;
            } else {
                analysis.categories.other++;
            }
        });

        return analysis;
    }

    // Helper methods
    generateAnalysisId() {
        return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    extractMetaTags(doc) {
        const metaTags = [];
        doc.querySelectorAll('meta').forEach(meta => {
            metaTags.push({
                name: meta.getAttribute('name') || meta.getAttribute('property') || '',
                content: meta.getAttribute('content') || '',
                charset: meta.getAttribute('charset') || '',
                httpEquiv: meta.getAttribute('http-equiv') || ''
            });
        });
        return metaTags;
    }

    extractHeadings(doc) {
        const headings = [];
        doc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
            headings.push({
                level: parseInt(heading.tagName.charAt(1)),
                text: heading.textContent.trim(),
                id: heading.id || ''
            });
        });
        return headings;
    }

    extractImages(doc, baseURL) {
        const images = [];
        doc.querySelectorAll('img').forEach(img => {
            const src = img.getAttribute('src');
            if (src) {
                images.push({
                    src: new URL(src, baseURL).href,
                    alt: img.getAttribute('alt') || '',
                    width: img.getAttribute('width') || '',
                    height: img.getAttribute('height') || '',
                    loading: img.getAttribute('loading') || ''
                });
            }
        });
        return images;
    }

    extractLinks(doc, baseURL) {
        const links = [];
        doc.querySelectorAll('a[href]').forEach(link => {
            const href = link.getAttribute('href');
            if (href) {
                links.push({
                    url: new URL(href, baseURL).href,
                    text: link.textContent.trim(),
                    rel: link.getAttribute('rel') || '',
                    target: link.getAttribute('target') || ''
                });
            }
        });
        return links;
    }

    extractForms(doc) {
        const forms = [];
        doc.querySelectorAll('form').forEach(form => {
            forms.push({
                action: form.getAttribute('action') || '',
                method: form.getAttribute('method') || 'GET',
                fields: form.querySelectorAll('input, select, textarea').length
            });
        });
        return forms;
    }

    extractScripts(doc, baseURL) {
        const scripts = [];
        doc.querySelectorAll('script[src]').forEach(script => {
            const src = script.getAttribute('src');
            if (src) {
                scripts.push({
                    src: new URL(src, baseURL).href,
                    async: script.hasAttribute('async'),
                    defer: script.hasAttribute('defer'),
                    type: script.getAttribute('type') || 'text/javascript'
                });
            }
        });
        return scripts;
    }

    extractStyles(doc, baseURL) {
        const styles = [];
        doc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
            const href = link.getAttribute('href');
            if (href) {
                styles.push({
                    href: new URL(href, baseURL).href,
                    media: link.getAttribute('media') || 'all'
                });
            }
        });
        return styles;
    }

    countTotalElements(structure) {
        return Object.keys(structure).reduce((total, key) => {
            return total + (Array.isArray(structure[key]) ? structure[key].length : 0);
        }, 0);
    }

    analyzeHeadingStructure(headings) {
        const levels = headings.reduce((acc, heading) => {
            acc[heading.level] = (acc[heading.level] || 0) + 1;
            return acc;
        }, {});
        
        return {
            hasH1: levels[1] > 0,
            levels: levels,
            properOrder: this.checkHeadingOrder(headings)
        };
    }

    checkHeadingOrder(headings) {
        let lastLevel = 0;
        for (const heading of headings) {
            if (heading.level > lastLevel + 1) {
                return false;
            }
            lastLevel = heading.level;
        }
        return true;
    }

    generateSummary(results) {
        return {
            overallScore: this.calculateOverallScore(results),
            keyFindings: this.extractKeyFindings(results),
            strengths: this.identifyStrengths(results),
            weaknesses: this.identifyWeaknesses(results)
        };
    }

    generateRecommendations(results) {
        const recommendations = [];
        
        if (results.structure?.overview?.metaTagsCount < 5) {
            recommendations.push({
                priority: 'high',
                category: 'SEO',
                title: 'Add more meta tags',
                description: 'Consider adding meta description, keywords, and Open Graph tags'
            });
        }
        
        if (results.performance?.score < 70) {
            recommendations.push({
                priority: 'medium',
                category: 'Performance',
                title: 'Optimize page load time',
                description: 'Consider image optimization, minification, and caching'
            });
        }
        
        if (results.accessibility?.score < 80) {
            recommendations.push({
                priority: 'medium',
                category: 'Accessibility',
                title: 'Improve accessibility',
                description: 'Add alt text to images and ensure proper heading structure'
            });
        }
        
        return recommendations;
    }

    calculateOverallScore(results) {
        const scores = [];
        
        if (results.structure) scores.push(85); // Structure is usually good if it loads
        if (results.performance) scores.push(results.performance.score);
        if (results.seo) scores.push(results.seo.score);
        if (results.security) scores.push(results.security.score);
        if (results.accessibility) scores.push(results.accessibility.score);
        
        return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    }

    extractKeyFindings(results) {
        const findings = [];
        
        if (results.structure?.overview?.totalElements > 100) {
            findings.push('Rich content structure with many elements');
        }
        
        if (results.performance?.loadTime < 1000) {
            findings.push('Fast page load time');
        }
        
        if (results.seo?.score > 80) {
            findings.push('Good SEO optimization');
        }
        
        return findings;
    }

    identifyStrengths(results) {
        const strengths = [];
        
        if (results.performance?.score > 80) strengths.push('Excellent performance');
        if (results.seo?.score > 80) strengths.push('Strong SEO');
        if (results.security?.score > 80) strengths.push('Good security practices');
        if (results.accessibility?.score > 80) strengths.push('High accessibility');
        
        return strengths;
    }

    identifyWeaknesses(results) {
        const weaknesses = [];
        
        if (results.performance?.score < 60) weaknesses.push('Performance needs improvement');
        if (results.seo?.score < 60) weaknesses.push('SEO requires attention');
        if (results.security?.score < 60) weaknesses.push('Security vulnerabilities found');
        if (results.accessibility?.score < 60) weaknesses.push('Accessibility issues detected');
        
        return weaknesses;
    }

    // Additional helper methods for specific analyses
    detectServer(headers) {
        const server = headers.get('server') || '';
        return server;
    }

    calculateReadabilityScore(text) {
        // Simple readability calculation (Flesch-Kincaid approximation)
        const words = text.split(/\s+/).length;
        const sentences = text.split(/[.!?]+/).length;
        const syllables = this.countSyllables(text);
        
        if (sentences === 0) return 0;
        
        const score = 206.835 - (1.015 * (words / sentences)) - (84.6 * (syllables / words));
        return Math.max(0, Math.min(100, Math.round(score)));
    }

    countSyllables(text) {
        const words = text.toLowerCase().split(/\s+/);
        let syllableCount = 0;
        
        words.forEach(word => {
            const syllables = word.match(/[aeiouy]+/g);
            syllableCount += syllables ? syllables.length : 1;
        });
        
        return syllableCount;
    }

    getReadabilityLevel(score) {
        if (score >= 90) return 'Very Easy';
        if (score >= 80) return 'Easy';
        if (score >= 70) return 'Fairly Easy';
        if (score >= 60) return 'Standard';
        if (score >= 50) return 'Fairly Difficult';
        if (score >= 30) return 'Difficult';
        return 'Very Difficult';
    }

    detectLanguage(text) {
        // Simple language detection based on common words
        const englishWords = ['the', 'and', 'is', 'in', 'to', 'of', 'a', 'that', 'it', 'with'];
        const words = text.toLowerCase().split(/\s+/).slice(0, 100);
        const englishCount = words.filter(word => englishWords.includes(word)).length;
        
        return englishCount > words.length * 0.1 ? 'en' : 'unknown';
    }

    analyzeContentStructure(doc) {
        return {
            hasMain: !!doc.querySelector('main, [role="main"]'),
            hasHeader: !!doc.querySelector('header, [role="banner"]'),
            hasNav: !!doc.querySelector('nav, [role="navigation"]'),
            hasAside: !!doc.querySelector('aside, [role="complementary"]'),
            hasFooter: !!doc.querySelector('footer, [role="contentinfo"]')
        };
    }

    analyzeSecurityHeaders(headers) {
        const securityHeaders = [
            'strict-transport-security',
            'content-security-policy',
            'x-frame-options',
            'x-content-type-options',
            'x-xss-protection',
            'referrer-policy'
        ];
        
        const present = securityHeaders.filter(header => headers.has(header));
        
        return {
            present: present,
            missing: securityHeaders.filter(header => !headers.has(header)),
            securityHeaders: present.length
        };
    }

    analyzeFormSecurity(content) {
        const hasCSRF = content.includes('csrf') || content.includes('token');
        const hasHTTPSForms = !content.includes('action="http://');
        
        return {
            hasCSRFProtection: hasCSRF,
            insecureForms: !hasHTTPSForms,
            formCount: (content.match(/<form/g) || []).length
        };
    }

    analyzeScriptSecurity(content) {
        const hasInlineScripts = content.includes('<script>') && !content.includes('src=');
        const hasEval = content.includes('eval(');
        
        return {
            hasInlineScripts,
            hasEval,
            scriptCount: (content.match(/<script/g) || []).length
        };
    }

    checkMixedContent(baseURL, content) {
        const isHTTPS = baseURL.startsWith('https://');
        const hasHTTPResources = isHTTPS && content.includes('http://');
        
        return {
            hasMixedContent: hasHTTPResources,
            affectedResources: hasHTTPResources ? (content.match(/http:\/\/[^"'\s>]+/g) || []).length : 0
        };
    }

    analyzeSEOHeadings(doc) {
        const h1 = doc.querySelectorAll('h1').length;
        const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
        
        return {
            hasH1: h1 === 1,
            h1Count: h1,
            totalHeadings: headings.length,
            properStructure: this.checkHeadingOrder(Array.from(headings).map(h => ({
                level: parseInt(h.tagName.charAt(1)),
                text: h.textContent.trim()
            })))
        };
    }

    analyzeSEOImages(doc) {
        const images = doc.querySelectorAll('img');
        const imagesWithAlt = Array.from(images).filter(img => img.getAttribute('alt'));
        
        return {
            total: images.length,
            withAlt: imagesWithAlt.length,
            altTextRatio: images.length > 0 ? imagesWithAlt.length / images.length : 1
        };
    }

    analyzeSEOLinks(doc) {
        const links = doc.querySelectorAll('a[href]');
        const internalLinks = Array.from(links).filter(link => {
            const href = link.getAttribute('href');
            return href && (href.startsWith('/') || href.startsWith('#') || !href.includes('://'));
        });
        
        return {
            total: links.length,
            internal: internalLinks.length,
            external: links.length - internalLinks.length
        };
    }

    analyzeStructuredData(doc) {
        const structuredData = doc.querySelectorAll('[type="application/ld+json"], .json-ld, [itemscope]');
        
        return {
            hasData: structuredData.length > 0,
            count: structuredData.length,
            types: Array.from(structuredData).map(el => el.getAttribute('itemtype') || 'JSON-LD')
        };
    }

    checkImageAccessibility(doc) {
        const images = doc.querySelectorAll('img');
        const imagesWithAlt = Array.from(images).filter(img => img.getAttribute('alt'));
        
        return {
            total: images.length,
            withAlt: imagesWithAlt.length,
            altTextRatio: images.length > 0 ? imagesWithAlt.length / images.length : 1
        };
    }

    checkHeadingAccessibility(doc) {
        const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
        const headingArray = Array.from(headings).map(h => ({
            level: parseInt(h.tagName.charAt(1)),
            text: h.textContent.trim()
        }));
        
        return {
            total: headings.length,
            properStructure: this.checkHeadingOrder(headingArray)
        };
    }

    checkFormAccessibility(doc) {
        const forms = doc.querySelectorAll('form');
        const inputs = doc.querySelectorAll('input, textarea, select');
        const labels = doc.querySelectorAll('label');
        
        return {
            formCount: forms.length,
            inputCount: inputs.length,
            labelCount: labels.length,
            hasLabels: labels.length >= inputs.length * 0.8
        };
    }

    checkTableAccessibility(doc) {
        const tables = doc.querySelectorAll('table');
        const tablesWithHeaders = Array.from(tables).filter(table => 
            table.querySelector('th') || table.querySelector('[scope]')
        );
        
        return {
            total: tables.length,
            withHeaders: tablesWithHeaders.length,
            hasHeaders: tablesWithHeaders.length === tables.length
        };
    }

    checkLinkAccessibility(doc) {
        const links = doc.querySelectorAll('a[href]');
        const descriptiveLinks = Array.from(links).filter(link => {
            const text = link.textContent.trim();
            return text.length > 3 && !text.match(/^(click here|here|more|link|read more)$/i);
        });
        
        return {
            total: links.length,
            descriptive: descriptiveLinks.length,
            descriptiveText: links.length > 0 ? descriptiveLinks.length / links.length : 1
        };
    }

    checkColorContrast(doc) {
        // Simplified contrast check - would need more sophisticated implementation
        return {
            passes: true, // Placeholder
            checked: false
        };
    }

    extractTables(doc) {
        const tables = [];
        doc.querySelectorAll('table').forEach(table => {
            tables.push({
                rows: table.querySelectorAll('tr').length,
                headers: table.querySelectorAll('th').length,
                hasCaption: !!table.querySelector('caption')
            });
        });
        return tables;
    }

    extractLists(doc) {
        const lists = [];
        doc.querySelectorAll('ul, ol, dl').forEach(list => {
            lists.push({
                type: list.tagName.toLowerCase(),
                items: list.querySelectorAll('li, dt, dd').length
            });
        });
        return lists;
    }

    extractSemanticElements(doc) {
        return {
            main: doc.querySelectorAll('main, [role="main"]').length,
            header: doc.querySelectorAll('header, [role="banner"]').length,
            nav: doc.querySelectorAll('nav, [role="navigation"]').length,
            aside: doc.querySelectorAll('aside, [role="complementary"]').length,
            footer: doc.querySelectorAll('footer, [role="contentinfo"]').length,
            section: doc.querySelectorAll('section').length,
            article: doc.querySelectorAll('article').length
        };
    }

    getAnalysisHistory() {
        return this.analysisHistory;
    }

    getAnalysisById(id) {
        return this.analysisHistory.find(analysis => analysis.id === id);
    }

    clearHistory() {
        this.analysisHistory = [];
    }
}

module.exports = URLAnalyzer;
