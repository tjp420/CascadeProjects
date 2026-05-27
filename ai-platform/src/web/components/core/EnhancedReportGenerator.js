/**
 * Enhanced Report Generator
 * 
 * Advanced report generation with multiple formats, templates, and customization
 */

export class EnhancedReportGenerator {
    constructor() {
        this.templates = new Map();
        this.reportHistory = [];
        this.loadDefaultTemplates();
    }

    /**
     * Load default report templates
     */
    loadDefaultTemplates() {
        this.templates.set('executive', {
            name: 'Executive Summary',
            sections: ['overview', 'key_metrics', 'recommendations', 'next_steps'],
            format: 'concise',
            audience: 'executives'
        });

        this.templates.set('technical', {
            name: 'Technical Analysis',
            sections: ['overview', 'code_quality', 'security', 'performance', 'technical_debt', 'detailed_metrics'],
            format: 'detailed',
            audience: 'developers'
        });

        this.templates.set('comprehensive', {
            name: 'Comprehensive Report',
            sections: ['overview', 'code_quality', 'security', 'performance', 'testing', 'documentation', 'dependencies', 'technical_debt', 'recommendations', 'appendices'],
            format: 'comprehensive',
            audience: 'stakeholders'
        });

        this.templates.set('security', {
            name: 'Security Assessment',
            sections: ['security_overview', 'vulnerabilities', 'compliance', 'security_recommendations'],
            format: 'security-focused',
            audience: 'security_team'
        });
    }

    /**
     * Generate report in specified format
     */
    async generateReport(analysisData, format = 'pdf', template = 'comprehensive', options = {}) {
        console.log(`📄 Generating ${format.toUpperCase()} report using ${template} template...`);

        const templateConfig = this.templates.get(template) || this.templates.get('comprehensive');
        const reportData = this.prepareReportData(analysisData, templateConfig, options);

        switch (format.toLowerCase()) {
        case 'pdf':
            return await this.generatePDF(reportData, options);
        case 'html':
            return this.generateHTML(reportData, options);
        case 'markdown':
            return this.generateMarkdown(reportData, options);
        case 'json':
            return this.generateJSON(reportData, options);
        case 'csv':
            return this.generateCSV(reportData, options);
        case 'excel':
            return await this.generateExcel(reportData, options);
        default:
            throw new Error(`Unsupported format: ${format}`);
        }
    }

    /**
     * Prepare report data based on template
     */
    prepareReportData(analysisData, templateConfig, options) {
        const reportData = {
            metadata: {
                title: options.title || 'Code Analysis Report',
                subtitle: options.subtitle || 'AI-Powered Code Quality Assessment',
                generated: new Date().toISOString(),
                generatedFormatted: new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                version: '2.0.0',
                template: templateConfig.name,
                author: options.author || 'AI Coding Intelligence Dashboard',
                project: options.projectName || 'CascadeProjects'
            },
            sections: {}
        };

        // Generate sections based on template
        templateConfig.sections.forEach(section => {
            reportData.sections[section] = this.generateSection(section, analysisData);
        });

        return reportData;
    }

    /**
     * Generate specific section
     */
    generateSection(sectionName, analysisData) {
        switch (sectionName) {
        case 'overview':
            return this.generateOverviewSection(analysisData);
        case 'key_metrics':
            return this.generateKeyMetricsSection(analysisData);
        case 'code_quality':
            return this.generateCodeQualitySection(analysisData);
        case 'security':
            return this.generateSecuritySection(analysisData);
        case 'performance':
            return this.generatePerformanceSection(analysisData);
        case 'testing':
            return this.generateTestingSection(analysisData);
        case 'documentation':
            return this.generateDocumentationSection(analysisData);
        case 'dependencies':
            return this.generateDependenciesSection(analysisData);
        case 'technical_debt':
            return this.generateTechnicalDebtSection(analysisData);
        case 'recommendations':
            return this.generateRecommendationsSection(analysisData);
        case 'next_steps':
            return this.generateNextStepsSection(analysisData);
        case 'detailed_metrics':
            return this.generateDetailedMetricsSection(analysisData);
        case 'security_overview':
            return this.generateSecurityOverviewSection(analysisData);
        case 'vulnerabilities':
            return this.generateVulnerabilitiesSection(analysisData);
        case 'compliance':
            return this.generateComplianceSection(analysisData);
        case 'security_recommendations':
            return this.generateSecurityRecommendationsSection(analysisData);
        case 'appendices':
            return this.generateAppendicesSection(analysisData);
        default:
            return {};
        }
    }

    /**
     * Generate overview section
     */
    generateOverviewSection(analysisData) {
        return {
            title: 'Project Overview',
            content: {
                summary: this.generateSummary(analysisData),
                statistics: this.generateStatistics(analysisData),
                healthScore: this.calculateHealthScore(analysisData)
            }
        };
    }

    /**
     * Generate executive summary
     */
    generateSummary(analysisData) {
        const quality = analysisData.codeQuality?.overallScore || 75;
        const security = analysisData.security?.overallScore || 85;
        const performance = analysisData.performance?.overallScore || 75;

        let overallAssessment = 'good';
        if (quality >= 85 && security >= 85 && performance >= 85) {
            overallAssessment = 'excellent';
        } else if (quality < 60 || security < 70 || performance < 60) {
            overallAssessment = 'needs improvement';
        }

        return {
            assessment: overallAssessment,
            highlights: [
                `Code Quality Score: ${quality}%`,
                `Security Score: ${security}%`,
                `Performance Score: ${performance}%`,
                `Total Files: ${analysisData.overview?.totalFiles || 0}`
            ],
            narrative: this.generateNarrative(analysisData)
        };
    }

    /**
     * Generate narrative summary
     */
    generateNarrative(analysisData) {
        const quality = analysisData.codeQuality?.overallScore || 75;
        const coverage = analysisData.testing?.codeCoverage || 65;

        return `The codebase demonstrates ${quality >= 80 ? 'strong' : 'moderate'} code quality with a score of ${quality}%. ` +
               `Test coverage is at ${coverage}%, which is ${coverage >= 70 ? 'above' : 'below'} the recommended threshold. ` +
               `Security measures are ${analysisData.security?.overallScore >= 80 ? 'well' : 'adequately'} implemented. ` +
               `Overall, the project shows ${quality >= 75 ? 'healthy' : 'room for improvement in'} development practices.`;
    }

    /**
     * Generate statistics
     */
    generateStatistics(analysisData) {
        return {
            projectSize: analysisData.overview?.totalFiles || 0,
            linesOfCode: analysisData.overview?.totalLines || 0,
            languages: analysisData.overview?.languages || [],
            frameworks: analysisData.overview?.frameworks || [],
            teamSize: analysisData.overview?.teamSize || 'Unknown',
            developmentAge: analysisData.overview?.developmentAge || 'Unknown'
        };
    }

    /**
     * Calculate health score
     */
    calculateHealthScore(analysisData) {
        const quality = analysisData.codeQuality?.overallScore || 75;
        const security = analysisData.security?.overallScore || 85;
        const performance = analysisData.performance?.overallScore || 75;
        const testing = analysisData.testing?.overallScore || 65;

        return Math.round((quality + security + performance + testing) / 4);
    }

    /**
     * Generate key metrics section
     */
    generateKeyMetricsSection(analysisData) {
        return {
            title: 'Key Metrics',
            metrics: [
                {
                    name: 'Code Quality',
                    value: analysisData.codeQuality?.overallScore || 75,
                    unit: '%',
                    trend: 'stable',
                    status: this.getStatus(analysisData.codeQuality?.overallScore || 75)
                },
                {
                    name: 'Test Coverage',
                    value: analysisData.testing?.codeCoverage || 65,
                    unit: '%',
                    trend: 'improving',
                    status: this.getStatus(analysisData.testing?.codeCoverage || 65)
                },
                {
                    name: 'Security Score',
                    value: analysisData.security?.overallScore || 85,
                    unit: '%',
                    trend: 'stable',
                    status: this.getStatus(analysisData.security?.overallScore || 85)
                },
                {
                    name: 'Performance Score',
                    value: analysisData.performance?.overallScore || 75,
                    unit: '%',
                    trend: 'improving',
                    status: this.getStatus(analysisData.performance?.overallScore || 75)
                }
            ]
        };
    }

    /**
     * Get status based on score
     */
    getStatus(score) {
        if (score >= 90) {
            return 'excellent';
        }
        if (score >= 75) {
            return 'good';
        }
        if (score >= 60) {
            return 'fair';
        }
        return 'poor';
    }

    /**
     * Generate code quality section
     */
    generateCodeQualitySection(analysisData) {
        return {
            title: 'Code Quality Analysis',
            metrics: {
                overallScore: analysisData.codeQuality?.overallScore || 75,
                maintainability: analysisData.codeQuality?.maintainabilityIndex || 70,
                complexity: analysisData.codeQuality?.complexityScore || 25,
                codeSmells: analysisData.codeQuality?.codeSmellCount || 0,
                duplication: analysisData.codeQuality?.duplicationRate || 5
            },
            findings: this.generateQualityFindings(analysisData),
            recommendations: this.generateQualityRecommendations(analysisData)
        };
    }

    /**
     * Generate quality findings
     */
    generateQualityFindings(analysisData) {
        const findings = [];
        const quality = analysisData.codeQuality?.overallScore || 75;

        if (quality >= 85) {
            findings.push({
                type: 'positive',
                message: 'Code quality is excellent with strong maintainability'
            });
        } else if (quality >= 70) {
            findings.push({
                type: 'neutral',
                message: 'Code quality is good but has room for improvement'
            });
        } else {
            findings.push({
                type: 'concern',
                message: 'Code quality needs attention in several areas'
            });
        }

        return findings;
    }

    /**
     * Generate quality recommendations
     */
    generateQualityRecommendations(analysisData) {
        return [
            'Continue regular code reviews',
            'Implement automated quality gates',
            'Refactor complex functions',
            'Improve code documentation'
        ];
    }

    /**
     * Generate security section
     */
    generateSecuritySection(analysisData) {
        return {
            title: 'Security Assessment',
            metrics: {
                overallScore: analysisData.security?.overallScore || 85,
                vulnerabilities: analysisData.security?.vulnerabilities?.length || 0,
                hotspots: analysisData.security?.securityHotspots?.length || 0,
                dependencyIssues: analysisData.security?.dependencyVulnerabilities?.length || 0
            },
            findings: this.generateSecurityFindings(analysisData),
            recommendations: this.generateSecurityRecommendations(analysisData)
        };
    }

    /**
     * Generate security findings
     */
    generateSecurityFindings(analysisData) {
        const findings = [];
        const security = analysisData.security?.overallScore || 85;

        if (security >= 90) {
            findings.push({
                type: 'positive',
                message: 'Security posture is strong with no critical vulnerabilities'
            });
        } else if (security >= 75) {
            findings.push({
                type: 'neutral',
                message: 'Security measures are adequate but could be enhanced'
            });
        } else {
            findings.push({
                type: 'concern',
                message: 'Security vulnerabilities require immediate attention'
            });
        }

        return findings;
    }

    /**
     * Generate security recommendations
     */
    generateSecurityRecommendations(analysisData) {
        return [
            'Update vulnerable dependencies',
            'Implement security headers',
            'Add input validation',
            'Conduct regular security audits'
        ];
    }

    /**
     * Generate performance section
     */
    generatePerformanceSection(analysisData) {
        return {
            title: 'Performance Analysis',
            metrics: {
                overallScore: analysisData.performance?.overallScore || 75,
                loadTime: analysisData.performance?.loadTime || 1200,
                bundleSize: analysisData.performance?.bundleSize || 250,
                memoryUsage: analysisData.performance?.memoryUsage || 45
            },
            findings: this.generatePerformanceFindings(analysisData),
            recommendations: this.generatePerformanceRecommendations(analysisData)
        };
    }

    /**
     * Generate performance findings
     */
    generatePerformanceFindings(analysisData) {
        return [
            {
                type: 'neutral',
                message: 'Performance is within acceptable ranges'
            }
        ];
    }

    /**
     * Generate performance recommendations
     */
    generatePerformanceRecommendations(analysisData) {
        return [
            'Implement caching strategies',
            'Optimize bundle size',
            'Improve database query performance',
            'Add performance monitoring'
        ];
    }

    /**
     * Generate remaining sections (simplified implementations)
     */
    generateTestingSection(analysisData) {
        return {
            title: 'Testing Analysis',
            metrics: {
                coverage: analysisData.testing?.codeCoverage || 65,
                testCount: analysisData.testing?.testCount || 150
            }
        };
    }

    generateDocumentationSection(analysisData) {
        return {
            title: 'Documentation Analysis',
            metrics: {
                coverage: analysisData.documentation?.overallScore || 70
            }
        };
    }

    generateDependenciesSection(analysisData) {
        return {
            title: 'Dependencies Analysis',
            metrics: {
                total: analysisData.dependencies?.totalDependencies || 25,
                outdated: analysisData.dependencies?.outdatedDependencies?.length || 0,
                vulnerable: analysisData.dependencies?.vulnerableDependencies?.length || 0
            }
        };
    }

    generateTechnicalDebtSection(analysisData) {
        return {
            title: 'Technical Debt Analysis',
            metrics: {
                score: analysisData.technicalDebt?.overallScore || 30,
                ratio: analysisData.technicalDebt?.debtRatio || 0.15
            }
        };
    }

    generateRecommendationsSection(analysisData) {
        return {
            title: 'Recommendations',
            items: analysisData.recommendations || []
        };
    }

    generateNextStepsSection(analysisData) {
        return {
            title: 'Next Steps',
            items: [
                'Address high-priority security vulnerabilities',
                'Improve test coverage to 80%+',
                'Refactor complex code sections',
                'Update documentation'
            ]
        };
    }

    generateDetailedMetricsSection(analysisData) {
        return {
            title: 'Detailed Metrics',
            data: analysisData
        };
    }

    generateSecurityOverviewSection(analysisData) {
        return this.generateSecuritySection(analysisData);
    }

    generateVulnerabilitiesSection(analysisData) {
        return {
            title: 'Vulnerability Details',
            vulnerabilities: analysisData.security?.vulnerabilities || []
        };
    }

    generateComplianceSection(analysisData) {
        return {
            title: 'Compliance Status',
            score: analysisData.security?.complianceScore || 85
        };
    }

    generateSecurityRecommendationsSection(analysisData) {
        return this.generateSecurityRecommendations(analysisData);
    }

    generateAppendicesSection(analysisData) {
        return {
            title: 'Appendices',
            content: 'Additional technical details and raw data'
        };
    }

    /**
     * Generate HTML report
     */
    generateHTML(reportData, options) {
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${reportData.metadata.title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 0; padding: 20px; }
        .header { border-bottom: 2px solid #6366f1; padding-bottom: 20px; margin-bottom: 30px; }
        .title { font-size: 2em; color: #1e293b; margin-bottom: 10px; }
        .subtitle { color: #64748b; font-size: 1.1em; }
        .metadata { background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 30px; }
        .section { margin-bottom: 30px; }
        .section-title { color: #6366f1; font-size: 1.5em; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }
        .metric { display: inline-block; margin: 10px; padding: 15px; background: #f1f5f9; border-radius: 8px; min-width: 150px; }
        .metric-value { font-size: 1.5em; font-weight: bold; color: #6366f1; }
        .metric-label { color: #64748b; font-size: 0.9em; }
        .status-excellent { color: #10b981; }
        .status-good { color: #3b82f6; }
        .status-fair { color: #f59e0b; }
        .status-poor { color: #ef4444; }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="title">${reportData.metadata.title}</h1>
        <p class="subtitle">${reportData.metadata.subtitle}</p>
    </div>
    
    <div class="metadata">
        <p><strong>Generated:</strong> ${reportData.metadata.generatedFormatted}</p>
        <p><strong>Project:</strong> ${reportData.metadata.project}</p>
        <p><strong>Template:</strong> ${reportData.metadata.template}</p>
        <p><strong>Version:</strong> ${reportData.metadata.version}</p>
    </div>

    ${this.generateHTMLSections(reportData.sections)}
</body>
</html>`;

        return html;
    }

    /**
     * Generate HTML sections
     */
    generateHTMLSections(sections) {
        return Object.entries(sections).map(([key, section]) => `
            <div class="section">
                <h2 class="section-title">${section.title}</h2>
                ${this.generateSectionContent(section)}
            </div>
        `).join('');
    }

    /**
     * Generate section content
     */
    generateSectionContent(section) {
        if (section.content) {
            return this.generateContentHTML(section.content);
        }
        if (section.metrics) {
            return this.generateMetricsHTML(section.metrics);
        }
        if (section.items) {
            return `<ul>${section.items.map(item => `<li>${item}</li>`).join('')}</ul>`;
        }
        return '<p>No content available</p>';
    }

    /**
     * Generate content HTML
     */
    generateContentHTML(content) {
        if (content.summary) {
            return `
                <p>${content.summary.narrative}</p>
                <h3>Highlights</h3>
                <ul>${content.summary.highlights.map(h => `<li>${h}</li>`).join('')}</ul>
                <h3>Health Score</h3>
                <p><strong>${content.healthScore}/100</strong></p>
            `;
        }
        return '<p>Content details</p>';
    }

    /**
     * Generate metrics HTML
     */
    generateMetricsHTML(metrics) {
        if (metrics.overallScore !== undefined) {
            return `
                <div class="metric">
                    <div class="metric-value">${metrics.overallScore}%</div>
                    <div class="metric-label">Overall Score</div>
                </div>
            `;
        }
        
        return Object.entries(metrics).map(([key, value]) => `
            <div class="metric">
                <div class="metric-value">${value}</div>
                <div class="metric-label">${key}</div>
            </div>
        `).join('');
    }

    /**
     * Generate Markdown report
     */
    generateMarkdown(reportData, options) {
        let markdown = `# ${reportData.metadata.title}\n\n`;
        markdown += `${reportData.metadata.subtitle}\n\n`;
        markdown += `**Generated:** ${reportData.metadata.generatedFormatted}\n`;
        markdown += `**Project:** ${reportData.metadata.project}\n`;
        markdown += `**Template:** ${reportData.metadata.template}\n\n`;
        markdown += '---\n\n';

        Object.entries(reportData.sections).forEach(([key, section]) => {
            markdown += `## ${section.title}\n\n`;
            markdown += this.generateMarkdownSection(section);
            markdown += '\n';
        });

        return markdown;
    }

    /**
     * Generate Markdown section
     */
    generateMarkdownSection(section) {
        if (section.content) {
            return section.content.summary?.narrative || '';
        }
        if (section.metrics) {
            return Object.entries(section.metrics).map(([key, value]) => `- **${key}:** ${value}`).join('\n');
        }
        if (section.items) {
            return section.items.map(item => `- ${item}`).join('\n');
        }
        return '';
    }

    /**
     * Generate JSON report
     */
    generateJSON(reportData, options) {
        return JSON.stringify(reportData, null, 2);
    }

    /**
     * Generate CSV report
     */
    generateCSV(reportData, options) {
        const headers = ['Section', 'Metric', 'Value'];
        const rows = [];

        Object.entries(reportData.sections).forEach(([sectionKey, section]) => {
            if (section.metrics) {
                Object.entries(section.metrics).forEach(([metricKey, value]) => {
                    rows.push([section.title, metricKey, value]);
                });
            }
        });

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        return csvContent;
    }

    /**
     * Generate PDF report (placeholder - would use a PDF library)
     */
    async generatePDF(reportData, options) {
        // This would integrate with a PDF generation library like jsPDF or pdfkit
        // For now, return the HTML which can be converted to PDF
        const html = this.generateHTML(reportData, options);
        
        return {
            format: 'pdf',
            content: html,
            note: 'Convert HTML to PDF using a PDF generation library'
        };
    }

    /**
     * Generate Excel report (placeholder)
     */
    async generateExcel(reportData, options) {
        // This would integrate with an Excel library like exceljs
        return {
            format: 'excel',
            data: reportData,
            note: 'Use exceljs or similar library for Excel generation'
        };
    }

    /**
     * Save report to file
     */
    async saveReport(content, filename, format) {
        const blob = new Blob([content], { type: this.getMimeType(format) });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.reportHistory.push({
            filename,
            format,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Get MIME type for format
     */
    getMimeType(format) {
        const mimeTypes = {
            html: 'text/html',
            json: 'application/json',
            csv: 'text/csv',
            markdown: 'text/markdown',
            pdf: 'application/pdf'
        };
        return mimeTypes[format] || 'text/plain';
    }

    /**
     * Get report history
     */
    getReportHistory() {
        return this.reportHistory;
    }

    /**
     * Add custom template
     */
    addTemplate(name, template) {
        this.templates.set(name, template);
    }

    /**
     * Get available templates
     */
    getTemplates() {
        return Array.from(this.templates.entries()).map(([key, value]) => ({
            key,
            ...value
        }));
    }
}

export default EnhancedReportGenerator;