/**
 * Layout Analyzer Engine
 * 
 * Core analysis engine for HTML structure validation, CSS conflict detection,
 * responsive design testing, and accessibility compliance checking.
 */

class LayoutAnalyzerEngine {
    constructor() {
        this.analysisResults = {
            htmlIssues: [],
            cssConflicts: [],
            responsiveIssues: [],
            accessibilityIssues: [],
            performanceIssues: [],
            summary: {
                totalFiles: 0,
                issuesFound: 0,
                fixesAvailable: 0,
                healthScore: 0,
                criticalIssues: 0,
                highIssues: 0,
                mediumIssues: 0,
                lowIssues: 0
            }
        };
        
        this.viewports = {
            mobile: { width: 375, height: 667, name: 'Mobile' },
            tablet: { width: 768, height: 1024, name: 'Tablet' },
            desktop: { width: 1920, height: 1080, name: 'Desktop' }
        };
        
        this.severityLevels = {
            critical: { score: 4, color: '#ef4444' },
            high: { score: 3, color: '#f59e0b' },
            medium: { score: 2, color: '#3b82f6' },
            low: { score: 1, color: '#10b981' }
        };
    }

    /**
     * Analyze all HTML and CSS files in the project
     */
    async analyzeProject(config) {
        console.log('🔍 Starting comprehensive layout analysis...');
        
        this.analysisResults = {
            htmlIssues: [],
            cssConflicts: [],
            responsiveIssues: [],
            accessibilityIssues: [],
            performanceIssues: [],
            summary: {
                totalFiles: 0,
                issuesFound: 0,
                fixesAvailable: 0,
                healthScore: 0,
                criticalIssues: 0,
                highIssues: 0,
                mediumIssues: 0,
                lowIssues: 0
            }
        };

        try {
            // Fetch project files from API
            const filesResponse = await fetch('/api/layout/scan');
            const filesData = await filesResponse.json();
            
            const files = filesData.files || [];
            this.analysisResults.summary.totalFiles = files.length;
            
            // Analyze based on configuration
            if (config.scope === 'all' || config.scope === 'html') {
                if (config.fileTypes.html) {
                    await this.analyzeHTMLFiles(files.filter(f => f.type === 'html'), config);
                }
            }
            
            if (config.scope === 'all' || config.scope === 'css') {
                if (config.fileTypes.css) {
                    await this.analyzeCSSFiles(files.filter(f => f.type === 'css'), config);
                }
            }
            
            // Calculate summary statistics
            this.calculateSummary();
            
            console.log('✅ Layout analysis completed');
            return this.analysisResults;
            
        } catch (error) {
            console.error('❌ Analysis failed:', error);
            throw new Error('Layout analysis failed: ' + error.message);
        }
    }

    /**
     * Analyze HTML files for structural and accessibility issues
     */
    async analyzeHTMLFiles(htmlFiles, config) {
        console.log(`📄 Analyzing ${htmlFiles.length} HTML files...`);
        
        for (const file of htmlFiles) {
            try {
                const response = await fetch(file.name);
                const content = await response.text();
                
                // HTML Structure Analysis
                this.analyzeHTMLStructure(content, file);
                
                // Accessibility Analysis
                this.analyzeAccessibility(content, file);
                
                // Performance Analysis
                if (config.deepScan) {
                    this.analyzePerformance(content, file);
                }
                
            } catch (error) {
                console.warn(`⚠️ Could not analyze HTML file ${file.name}:`, error);
            }
        }
    }

    /**
     * Analyze CSS files for conflicts and optimization opportunities
     */
    async analyzeCSSFiles(cssFiles, config) {
        console.log(`🎨 Analyzing ${cssFiles.length} CSS files...`);
        
        for (const file of cssFiles) {
            try {
                const response = await fetch(file.name);
                const content = await response.text();
                
                // CSS Conflict Analysis
                this.analyzeCSSConflicts(content, file);
                
                // Performance Analysis
                this.analyzeCSSPerformance(content, file);
                
                // Responsive Design Analysis
                this.analyzeResponsiveDesign(content, file);
                
            } catch (error) {
                console.warn(`⚠️ Could not analyze CSS file ${file.name}:`, error);
            }
        }
    }

    /**
     * Analyze HTML structure for semantic issues
     */
    analyzeHTMLStructure(content, file) {
        const issues = [];
        
        // Check for DOCTYPE
        if (!content.trim().startsWith('<!DOCTYPE html>')) {
            issues.push(this.createIssue('html', 'high', 'Missing DOCTYPE declaration', 
                'HTML5 documents should start with <!DOCTYPE html>', file.name, 1, true,
                'Add <!DOCTYPE html> at the beginning of the file'));
        }
        
        // Check for lang attribute
        if (!content.match(/<html[^>]*lang=/)) {
            issues.push(this.createIssue('html', 'medium', 'Missing lang attribute on html element', 
                'HTML documents should specify the language for accessibility', file.name, 1, true,
                'Add lang="en" to the html tag'));
        }
        
        // Check for viewport meta tag
        if (!content.includes('name="viewport"')) {
            issues.push(this.createIssue('html', 'high', 'Missing viewport meta tag', 
                'Responsive design requires viewport meta tag', file.name, 1, true,
                'Add <meta name="viewport" content="width=device-width, initial-scale=1.0"> in head'));
        }
        
        // Check for proper heading hierarchy
        const headings = content.match(/<h[1-6][^>]*>/g) || [];
        if (headings.length > 0) {
            let lastLevel = 0;
            for (const heading of headings) {
                const level = parseInt(heading.match(/h([1-6])/)[1]);
                if (level > lastLevel + 1) {
                    issues.push(this.createIssue('html', 'medium', 'Improper heading hierarchy', 
                        `Found h${level} after h${lastLevel}, skipping levels`, file.name, 0, true,
                        'Use proper heading hierarchy (h1, h2, h3, etc.)'));
                }
                lastLevel = level;
            }
        }
        
        // Check for alt attributes on images
        const images = content.match(/<img[^>]*>/g) || [];
        images.forEach((img, index) => {
            if (!img.includes('alt=')) {
                issues.push(this.createIssue('html', 'high', 'Missing alt attribute on image', 
                    'Images should have alt attributes for accessibility', file.name, 0, true,
                    'Add alt attribute to describe the image content'));
            }
        });
        
        this.analysisResults.htmlIssues.push(...issues);
    }

    /**
     * Analyze accessibility compliance
     */
    analyzeAccessibility(content, file) {
        const issues = [];
        
        // Check for form labels
        const inputs = content.match(/<input[^>]*>/g) || [];
        inputs.forEach(input => {
            if (!content.includes('for=') && !input.includes('aria-label=')) {
                issues.push(this.createIssue('accessibility', 'high', 'Form input missing label', 
                    'Form inputs should have associated labels', file.name, 0, true,
                    'Add <label> with for attribute or aria-label to input'));
            }
        });
        
        // Check for button accessibility
        const buttons = content.match(/<button[^>]*>/g) || [];
        buttons.forEach(button => {
            if (!button.includes('aria-label=') && !button.match(/<button[^>]*>[\s\S]*?<\/button>/)) {
                issues.push(this.createIssue('accessibility', 'medium', 'Button missing accessible text', 
                    'Buttons should have text content or aria-label', file.name, 0, true,
                    'Add text content or aria-label to button'));
            }
        });
        
        // Check for color contrast (simplified check)
        if (content.includes('color:') && !content.includes('contrast')) {
            issues.push(this.createIssue('accessibility', 'low', 'Potential color contrast issue', 
                'Consider color contrast ratios for accessibility', file.name, 0, false,
                'Use tools to verify color contrast meets WCAG standards'));
        }
        
        this.analysisResults.accessibilityIssues.push(...issues);
    }

    /**
     * Analyze CSS conflicts and issues
     */
    analyzeCSSConflicts(content, file) {
        const issues = [];
        
        // Check for !important usage
        const importantCount = (content.match(/!important/g) || []).length;
        if (importantCount > 3) {
            issues.push(this.createIssue('css', 'medium', `Excessive use of !important (${importantCount} times)`, 
                'Overuse of !important can lead to maintenance issues', file.name, 0, true,
                'Refactor CSS specificity instead of using !important'));
        }
        
        // Check for unused selectors (simplified)
        const selectors = content.match(/[^{}]+{[^}]*}/g) || [];
        if (selectors.length > 50) {
            issues.push(this.createIssue('css', 'low', 'Large number of CSS rules', 
                'Consider splitting CSS into smaller, focused files', file.name, 0, false,
                'Organize CSS into logical modules'));
        }
        
        // Check for vendor prefix redundancy
        const vendorPrefixes = content.match(/-(webkit|moz|ms|o)-/g) || [];
        if (vendorPrefixes.length > 10) {
            issues.push(this.createIssue('css', 'low', 'Many vendor prefixes found', 
                'Modern browsers may not require all these prefixes', file.name, 0, true,
                'Review and remove unnecessary vendor prefixes'));
        }
        
        this.analysisResults.cssConflicts.push(...issues);
    }

    /**
     * Analyze responsive design implementation
     */
    analyzeResponsiveDesign(content, file) {
        const issues = [];
        
        // Check for media queries
        const mediaQueries = content.match(/@media[^{]*{/g) || [];
        if (mediaQueries.length === 0) {
            issues.push(this.createIssue('responsive', 'high', 'No media queries found', 
                'Responsive design requires media queries', file.name, 0, true,
                'Add media queries for different screen sizes'));
        }
        
        // Check for fixed widths
        const fixedWidths = content.match(/width:\s*\d+px/g) || [];
        if (fixedWidths.length > 5) {
            issues.push(this.createIssue('responsive', 'medium', `Multiple fixed widths found (${fixedWidths.length})`, 
                'Fixed widths can break responsive design', file.name, 0, true,
                'Use relative units or responsive techniques'));
        }
        
        // Check for viewport units
        if (!content.includes('vw') && !content.includes('vh')) {
            issues.push(this.createIssue('responsive', 'low', 'No viewport units found', 
                'Viewport units can improve responsive design', file.name, 0, false,
                'Consider using vw, vh units for responsive sizing'));
        }
        
        this.analysisResults.responsiveIssues.push(...issues);
    }

    /**
     * Analyze performance issues
     */
    analyzePerformance(content, file) {
        const issues = [];
        
        // Check for inline styles
        const inlineStyles = content.match(/style="[^"]*"/g) || [];
        if (inlineStyles.length > 5) {
            issues.push(this.createIssue('performance', 'medium', `Multiple inline styles found (${inlineStyles.length})`, 
                'Inline styles can increase file size and reduce maintainability', file.name, 0, true,
                'Move styles to external CSS files'));
        }
        
        // Check for large CSS file
        const fileSizeKB = content.length / 1024;
        if (fileSizeKB > 50) {
            issues.push(this.createIssue('performance', 'medium', `Large CSS file (${fileSizeKB.toFixed(1)}KB)`, 
                'Large CSS files can slow down page loading', file.name, 0, true,
                'Split CSS into smaller, loadable modules'));
        }
        
        this.analysisResults.performanceIssues.push(...issues);
    }

    /**
     * Analyze CSS performance specifically
     */
    analyzeCSSPerformance(content, file) {
        const issues = [];
        
        // Check for complex selectors
        const complexSelectors = content.match(/[^{}]*[^{]*[^{]*{[^}]*}/g) || [];
        if (complexSelectors.length > 10) {
            issues.push(this.createIssue('performance', 'low', 'Complex CSS selectors found', 
                'Complex selectors can impact performance', file.name, 0, false,
                'Simplify CSS selectors for better performance'));
        }
        
        this.analysisResults.performanceIssues.push(...issues);
    }

    /**
     * Create a standardized issue object
     */
    createIssue(type, severity, message, description, file, line, fixable, recommendation) {
        return {
            id: Date.now() + Math.random(),
            type,
            severity,
            message,
            description,
            file,
            line,
            fixable,
            recommendation
        };
    }

    /**
     * Calculate summary statistics
     */
    calculateSummary() {
        const allIssues = [
            ...this.analysisResults.htmlIssues,
            ...this.analysisResults.cssConflicts,
            ...this.analysisResults.responsiveIssues,
            ...this.analysisResults.accessibilityIssues,
            ...this.analysisResults.performanceIssues
        ];

        this.analysisResults.summary.issuesFound = allIssues.length;
        this.analysisResults.summary.fixesAvailable = allIssues.filter(i => i.fixable).length;
        
        // Count by severity
        this.analysisResults.summary.criticalIssues = allIssues.filter(i => i.severity === 'critical').length;
        this.analysisResults.summary.highIssues = allIssues.filter(i => i.severity === 'high').length;
        this.analysisResults.summary.mediumIssues = allIssues.filter(i => i.severity === 'medium').length;
        this.analysisResults.summary.lowIssues = allIssues.filter(i => i.severity === 'low').length;
        
        // Calculate health score (0-100)
        const maxPossibleIssues = this.analysisResults.summary.totalFiles * 10;
        const issuesWeighted = 
            (this.analysisResults.summary.criticalIssues * 4) +
            (this.analysisResults.summary.highIssues * 3) +
            (this.analysisResults.summary.mediumIssues * 2) +
            (this.analysisResults.summary.lowIssues * 1);
        
        this.analysisResults.summary.healthScore = Math.max(0, Math.min(100, 
            100 - (issuesWeighted / maxPossibleIssues * 100)));
    }
}
