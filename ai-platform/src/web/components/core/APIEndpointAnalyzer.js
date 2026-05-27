/**
 * API Endpoint Analyzer Component
 * Analyzes API endpoints for security, performance, and documentation completeness
 */

export class APIEndpointAnalyzer {
    constructor() {
        this.apiData = null;
    }

    /**
     * Analyze API endpoints
     */
    async analyzeEndpoints(projectData) {
        console.log('🌐 Analyzing API endpoints...');
        
        // Simulated API endpoint data (in real implementation, this would parse actual API files)
        const endpoints = [
            {
                id: 'api-001',
                path: '/api/users',
                method: 'GET',
                file: 'api/routes/users.js',
                authentication: true,
                rateLimit: true,
                documentation: true,
                inputValidation: true,
                errorHandling: true,
                statusCode: 200,
                responseTime: 120,
                severity: 'LOW',
                issues: [],
                recommendation: 'Consider adding pagination for large datasets'
            },
            {
                id: 'api-002',
                path: '/api/users',
                method: 'POST',
                file: 'api/routes/users.js',
                authentication: true,
                rateLimit: false,
                documentation: true,
                inputValidation: true,
                errorHandling: true,
                statusCode: 201,
                responseTime: 250,
                severity: 'MEDIUM',
                issues: ['Missing rate limiting'],
                recommendation: 'Add rate limiting to prevent abuse'
            },
            {
                id: 'api-003',
                path: '/api/auth/login',
                method: 'POST',
                file: 'api/routes/auth.js',
                authentication: false,
                rateLimit: false,
                documentation: false,
                inputValidation: true,
                errorHandling: false,
                statusCode: 200,
                responseTime: 450,
                severity: 'HIGH',
                issues: ['Missing documentation', 'Missing rate limiting', 'Missing error handling'],
                recommendation: 'Add comprehensive documentation, rate limiting, and proper error handling'
            },
            {
                id: 'api-004',
                path: '/api/products',
                method: 'GET',
                file: 'api/routes/products.js',
                authentication: false,
                rateLimit: true,
                documentation: true,
                inputValidation: false,
                errorHandling: true,
                statusCode: 200,
                responseTime: 180,
                severity: 'MEDIUM',
                issues: ['Missing input validation'],
                recommendation: 'Add input validation for query parameters'
            },
            {
                id: 'api-005',
                path: '/api/admin/delete',
                method: 'DELETE',
                file: 'api/routes/admin.js',
                authentication: false,
                rateLimit: false,
                documentation: false,
                inputValidation: false,
                errorHandling: false,
                statusCode: 200,
                responseTime: 350,
                severity: 'CRITICAL',
                issues: ['Missing authentication', 'Missing documentation', 'Missing input validation', 'Missing error handling'],
                recommendation: 'CRITICAL: Add authentication immediately. This endpoint is exposed without protection.'
            }
        ];
        
        // Calculate API summary
        const severityCount = {
            CRITICAL: 0,
            HIGH: 0,
            MEDIUM: 0,
            LOW: 0
        };
        
        const methodCount = {
            GET: 0,
            POST: 0,
            PUT: 0,
            DELETE: 0,
            PATCH: 0
        };
        
        const securityGaps = {
            missingAuth: 0,
            missingRateLimit: 0,
            missingInputValidation: 0,
            missingErrorHandling: 0,
            missingDocumentation: 0
        };
        
        endpoints.forEach(e => {
            severityCount[e.severity]++;
            methodCount[e.method] = (methodCount[e.method] || 0) + 1;
            
            if (!e.authentication) {
                securityGaps.missingAuth++;
            }
            if (!e.rateLimit) {
                securityGaps.missingRateLimit++;
            }
            if (!e.inputValidation) {
                securityGaps.missingInputValidation++;
            }
            if (!e.errorHandling) {
                securityGaps.missingErrorHandling++;
            }
            if (!e.documentation) {
                securityGaps.missingDocumentation++;
            }
        });
        
        const overallAPIScore = this.calculateAPIScore(endpoints, securityGaps);
        
        this.apiData = {
            endpoints: endpoints,
            total: endpoints.length,
            severityCount: severityCount,
            methodCount: methodCount,
            securityGaps: securityGaps,
            overallScore: overallAPIScore,
            criticalEndpoints: endpoints.filter(e => e.severity === 'CRITICAL' || e.severity === 'HIGH')
        };
        
        console.log(`✅ API analysis complete: ${endpoints.length} endpoints analyzed`);
        return this.apiData;
    }

    /**
     * Calculate overall API security score
     */
    calculateAPIScore(endpoints, securityGaps) {
        let score = 100;
        const totalEndpoints = endpoints.length;
        
        // Deduct points for security gaps
        score -= (securityGaps.missingAuth / totalEndpoints) * 40;
        score -= (securityGaps.missingRateLimit / totalEndpoints) * 15;
        score -= (securityGaps.missingInputValidation / totalEndpoints) * 20;
        score -= (securityGaps.missingErrorHandling / totalEndpoints) * 15;
        score -= (securityGaps.missingDocumentation / totalEndpoints) * 10;
        
        return Math.max(Math.min(Math.round(score), 100), 0);
    }

    /**
     * Get endpoints by method
     */
    filterByMethod(method) {
        if (method === 'all') {
            return this.apiData.endpoints;
        }
        return this.apiData.endpoints.filter(e => e.method === method);
    }

    /**
     * Get endpoints by severity
     */
    filterBySeverity(severity) {
        if (severity === 'all') {
            return this.apiData.endpoints;
        }
        return this.apiData.endpoints.filter(e => e.severity === severity);
    }

    /**
     * Get endpoints by file
     */
    filterByFile(fileName) {
        return this.apiData.endpoints.filter(e => 
            e.file.includes(fileName)
        );
    }

    /**
     * Generate API report
     */
    generateAPIReport() {
        const report = {
            summary: {
                totalEndpoints: this.apiData.total,
                overallScore: this.apiData.overallScore,
                severityBreakdown: this.apiData.severityCount,
                methodBreakdown: this.apiData.methodCount,
                securityGaps: this.apiData.securityGaps
            },
            criticalEndpoints: this.apiData.criticalEndpoints.map(e => ({
                path: e.path,
                method: e.method,
                severity: e.severity,
                issues: e.issues,
                recommendation: e.recommendation
            })),
            allEndpoints: this.apiData.endpoints
        };
        
        return report;
    }

    /**
     * Export report as markdown
     */
    exportReportAsMarkdown() {
        const report = this.generateAPIReport();
        
        let markdown = '# API Endpoint Analysis Report\n\n';
        markdown += `**Generated:** ${new Date().toISOString()}\n\n`;
        markdown += '## Summary\n\n';
        markdown += `- **Total Endpoints:** ${report.summary.totalEndpoints}\n`;
        markdown += `- **Overall API Security Score:** ${report.summary.overallScore}/100\n\n`;
        
        markdown += '### Method Breakdown\n\n';
        Object.entries(report.summary.methodBreakdown).forEach(([method, count]) => {
            markdown += `- **${method}:** ${count}\n`;
        });
        
        markdown += '\n### Severity Breakdown\n\n';
        markdown += `- **CRITICAL:** ${report.summary.severityBreakdown.CRITICAL}\n`;
        markdown += `- **HIGH:** ${report.summary.severityBreakdown.HIGH}\n`;
        markdown += `- **MEDIUM:** ${report.summary.severityBreakdown.MEDIUM}\n`;
        markdown += `- **LOW:** ${report.summary.severityBreakdown.LOW}\n\n`;
        
        markdown += '### Security Gaps\n\n';
        markdown += `- **Missing Authentication:** ${report.summary.securityGaps.missingAuth}\n`;
        markdown += `- **Missing Rate Limiting:** ${report.summary.securityGaps.missingRateLimit}\n`;
        markdown += `- **Missing Input Validation:** ${report.summary.securityGaps.missingInputValidation}\n`;
        markdown += `- **Missing Error Handling:** ${report.summary.securityGaps.missingErrorHandling}\n`;
        markdown += `- **Missing Documentation:** ${report.summary.securityGaps.missingDocumentation}\n\n`;
        
        if (report.criticalEndpoints.length > 0) {
            markdown += '## Critical Endpoints\n\n';
            report.criticalEndpoints.forEach((endpoint, index) => {
                const emoji = endpoint.severity === 'CRITICAL' ? '🔴' : '🟡';
                markdown += `${index + 1}. ${emoji} ${endpoint.method} ${endpoint.path}\n`;
                markdown += `   - Severity: ${endpoint.severity}\n`;
                markdown += `   - Issues: ${endpoint.issues.join(', ')}\n`;
                markdown += `   - Recommendation: ${endpoint.recommendation}\n\n`;
            });
        }
        
        markdown += '## All Endpoints\n\n';
        report.allEndpoints.forEach((e, index) => {
            const emoji = e.severity === 'CRITICAL' ? '🔴' : e.severity === 'HIGH' ? '🟡' : e.severity === 'MEDIUM' ? '🟠' : '🟢';
            markdown += `### ${index + 1}. ${emoji} ${e.method} ${e.path} (${e.severity})\n\n`;
            markdown += `**File:** ${e.file}\n\n`;
            markdown += `**Status Code:** ${e.statusCode}\n\n`;
            markdown += `**Response Time:** ${e.responseTime}ms\n\n`;
            markdown += `**Authentication:** ${e.authentication ? '✅' : '❌'}\n\n`;
            markdown += `**Rate Limiting:** ${e.rateLimit ? '✅' : '❌'}\n\n`;
            markdown += `**Input Validation:** ${e.inputValidation ? '✅' : '❌'}\n\n`;
            markdown += `**Error Handling:** ${e.errorHandling ? '✅' : '❌'}\n\n`;
            markdown += `**Documentation:** ${e.documentation ? '✅' : '❌'}\n\n`;
            if (e.issues.length > 0) {
                markdown += `**Issues:** ${e.issues.join(', ')}\n\n`;
            }
            markdown += `**Recommendation:** ${e.recommendation}\n\n`;
            markdown += '---\n\n';
        });
        
        return markdown;
    }

    /**
     * Export report as JSON
     */
    exportReportAsJSON() {
        return JSON.stringify(this.generateAPIReport(), null, 2);
    }
}
