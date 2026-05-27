
/**
 * Detailed File Analysis Report Generator
 * 
 * This script generates detailed reports for files with the highest issue concentration,
 * including line-by-line analysis, context, and specific recommendations.
 */

const fs = require('fs');
const path = require('path');

class DetailedReportGenerator {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.reportsDir = path.join(projectRoot, 'security-reports', 'detailed');
        this.ensureReportsDirectory();
    }

    ensureReportsDirectory() {
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir, { recursive: true });
        }
    }

    async generateReports() {
        console.log('📊 Generating Detailed File Analysis Reports...\n');

        const topFiles = [
            { path: 'src/python/escalated_security_system.py', issues: 32, severity: 'critical' },
            { path: 'src/javascript/page.js', issues: 21, severity: 'critical' },
            { path: 'src/python/security_training_generator.py', issues: 18, severity: 'critical' },
            { path: 'src/python/security_review_system.py', issues: 14, severity: 'critical' },
            { path: 'src/javascript/heroicons.js', issues: 13, severity: 'critical' }
        ];

        for (const file of topFiles) {
            await this.generateFileReport(file);
        }

        this.generateExecutiveSummary(topFiles);
        console.log('\n✅ Detailed Reports Generated!');
    }

    async generateFileReport(fileInfo) {
        console.log(`📄 Analyzing: ${fileInfo.path} (${fileInfo.issues} issues)`);

        const filePath = path.join(this.projectRoot, fileInfo.path);
        
        if (!fs.existsSync(filePath)) {
            console.log(`   ⚠️  File not found: ${filePath}`);
            return;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        const report = {
            filePath: fileInfo.path,
            issueCount: fileInfo.issues,
            severity: fileInfo.severity,
            lastModified: fs.statSync(filePath).mtime.toISOString(),
            fileSize: content.length,
            lineCount: lines.length,
            analysis: this.analyzeFile(content, lines),
            recommendations: this.generateRecommendations(fileInfo.path, fileInfo.issues)
        };

        const reportName = path.basename(fileInfo.path).replace(/\.[^.]+$/, '') + '-detailed-report.json';
        const reportPath = path.join(this.reportsDir, reportName);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        console.log(`   ✅ Report saved: ${reportName}`);
    }

    analyzeFile(content, lines) {
        const analysis = {
            evalPatterns: [],
            securityRisks: [],
            codeMetrics: {},
            problematicLines: []
        };

        // Count eval patterns
        const evalPattern = /eval\s*\(/g;
        const functionPattern = /new\s+Function\s*\(/g;
        const setTimeoutPattern = /setTimeout\s*\(/g;
        const setIntervalPattern = /setInterval\s*\(/g;

        const evalMatches = content.match(evalPattern) || [];
        const functionMatches = content.match(functionPattern) || [];
        const setTimeoutMatches = content.match(setTimeoutPattern) || [];
        const setIntervalMatches = content.match(setIntervalPattern) || [];

        analysis.evalPatterns = {
            eval: evalMatches.length,
            newFunction: functionMatches.length,
            setTimeout: setTimeoutMatches.length,
            setInterval: setIntervalMatches.length
        };

        // Identify security risks
        const riskPatterns = [
            { pattern: /eval\s*\(/, type: 'eval_usage', severity: 'critical' },
            { pattern: /new\s+Function\s*\(/, type: 'function_constructor', severity: 'critical' },
            { pattern: /innerHTML\s*=/, type: 'dom_manipulation', severity: 'high' },
            { pattern: /document\.write\s*\(/, type: 'document_write', severity: 'high' },
            { pattern: /exec\s*\(/, type: 'command_execution', severity: 'critical' },
            { pattern: /subprocess\.(call|run|Popen)/, type: 'subprocess_execution', severity: 'high' },
            { pattern: /os\.system\s*\(/, type: 'os_system', severity: 'critical' }
        ];

        lines.forEach((line, index) => {
            riskPatterns.forEach(risk => {
                if (risk.pattern.test(line)) {
                    analysis.securityRisks.push({
                        line: index + 1,
                        type: risk.type,
                        severity: risk.severity,
                        context: line.trim()
                    });
                }
            });
        });

        // Code metrics
        analysis.codeMetrics = {
            avgLineLength: Math.round(lines.reduce((sum, line) => sum + line.length, 0) / lines.length),
            maxLineLength: Math.max(...lines.map(line => line.length)),
            commentLines: lines.filter(line => line.trim().startsWith('#') || line.trim().startsWith('//')).length,
            blankLines: lines.filter(line => line.trim() === '').length
        };

        // Flag problematic lines (long lines, complex expressions)
        lines.forEach((line, index) => {
            if (line.length > 200) {
                analysis.problematicLines.push({
                    line: index + 1,
                    issue: 'line_too_long',
                    length: line.length,
                    context: line.trim().substring(0, 100) + '...'
                });
            }
        });

        return analysis;
    }

    generateRecommendations(filePath, issueCount) {
        const recommendations = [];

        // General recommendations based on issue count
        if (issueCount > 20) {
            recommendations.push({
                priority: 'critical',
                action: 'Complete rewrite recommended',
                reason: 'Extremely high issue concentration suggests fundamental security problems'
            });
        } else if (issueCount > 10) {
            recommendations.push({
                priority: 'high',
                action: 'Major refactoring required',
                reason: 'High issue concentration requires significant security improvements'
            });
        }

        // File-specific recommendations
        if (filePath.includes('python')) {
            recommendations.push({
                priority: 'high',
                action: 'Replace subprocess calls with safer alternatives',
                reason: 'Python subprocess execution poses command injection risks'
            });
            recommendations.push({
                priority: 'medium',
                action: 'Use ast.literal_eval instead of eval',
                reason: 'Safer alternative for evaluating literal Python expressions'
            });
        }

        if (filePath.includes('javascript')) {
            recommendations.push({
                priority: 'high',
                action: 'Replace eval() with JSON.parse for JSON data',
                reason: 'eval() executes arbitrary code, JSON.parse only parses JSON'
            });
            recommendations.push({
                priority: 'medium',
                action: 'Use Function constructor only in controlled environments',
                reason: 'Function constructor is slightly safer than eval but still risky'
            });
        }

        // Security best practices
        recommendations.push({
            priority: 'medium',
            action: 'Implement input validation and sanitization',
            reason: 'Validate all user inputs before processing'
        });
        recommendations.push({
            priority: 'medium',
            action: 'Add security unit tests',
            reason: 'Test for security vulnerabilities and edge cases'
        });
        recommendations.push({
            priority: 'low',
            action: 'Add code comments explaining security decisions',
            reason: 'Document why certain patterns are used or avoided'
        });

        return recommendations;
    }

    generateExecutiveSummary(topFiles) {
        const summary = {
            generatedAt: new Date().toISOString(),
            totalFilesAnalyzed: topFiles.length,
            totalIssues: topFiles.reduce((sum, file) => sum + file.issues, 0),
            averageIssuesPerFile: Math.round(topFiles.reduce((sum, file) => sum + file.issues, 0) / topFiles.length),
            severityDistribution: {
                critical: topFiles.filter(f => f.severity === 'critical').length,
                high: topFiles.filter(f => f.severity === 'high').length,
                medium: topFiles.filter(f => f.severity === 'medium').length
            },
            topFiles: topFiles.map(file => ({
                path: file.path,
                issues: file.issues,
                severity: file.severity,
                recommendation: file.issues > 20 ? 'Complete rewrite' : 'Major refactoring'
            })),
            immediateActions: [
                'Address files with 20+ issues first (escalated_security_system.py, page.js)',
                'Implement security testing framework',
                'Create automated security scanning in CI/CD pipeline',
                'Establish code review guidelines for security patterns'
            ],
            longTermActions: [
                'Comprehensive security audit of entire codebase',
                'Developer security training program',
                'Implement security-focused development practices',
                'Regular security assessments and penetration testing'
            ]
        };

        const summaryPath = path.join(this.reportsDir, 'executive-summary.json');
        fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

        // Create a human-readable markdown summary
        const markdownSummary = this.createMarkdownSummary(summary);
        const markdownPath = path.join(this.reportsDir, 'executive-summary.md');
        fs.writeFileSync(markdownPath, markdownSummary);

        console.log(`   ✅ Executive summary saved`);
    }

    createMarkdownSummary(summary) {
        return `# Security Analysis Executive Summary

**Generated:** ${summary.generatedAt}

## Overview

- **Total Files Analyzed:** ${summary.totalFilesAnalyzed}
- **Total Security Issues:** ${summary.totalIssues}
- **Average Issues per File:** ${summary.averageIssuesPerFile}

## Severity Distribution

- **Critical:** ${summary.severityDistribution.critical} files
- **High:** ${summary.severityDistribution.high} files
- **Medium:** ${summary.severityDistribution.medium} files

## Files Requiring Immediate Attention

| File Path | Issues | Severity | Recommendation |
|-----------|--------|----------|----------------|
${summary.topFiles.map(file => 
    `| \`${file.path}\` | ${file.issues} | ${file.severity} | ${file.recommendation} |`
).join('\n')}

## Immediate Actions

${summary.immediateActions.map(action => `- ${action}`).join('\n')}

## Long-term Actions

${summary.longTermActions.map(action => `- ${action}`).join('\n')}

## Detailed Reports

Individual detailed reports for each file are available in this directory:
- \`escalated_security_system.py-detailed-report.json\`
- \`page.js-detailed-report.json\`
- \`security_training_generator.py-detailed-report.json\`
- \`security_review_system.py-detailed-report.json\`
- \`heroicons.js-detailed-report.json\`
`;
    }
}

// Main execution
const generator = new DetailedReportGenerator(process.cwd());
generator.generateReports();