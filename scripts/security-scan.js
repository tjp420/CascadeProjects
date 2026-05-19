#!/usr/bin/env node

/**
 * Security Scan Script
 * Performs comprehensive security analysis of the codebase
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class SecurityScanner {
    constructor() {
        this.results = {
            vulnerabilities: [],
            evalUsage: [],
            securityIssues: [],
            recommendations: [],
            summary: {
                totalFiles: 0,
                filesWithIssues: 0,
                criticalIssues: 0,
                highIssues: 0,
                mediumIssues: 0,
                lowIssues: 0
            }
        };
    }

    // Scan for eval() usage
    scanEvalUsage(directory) {
        console.log('🔍 Scanning for eval() usage...');
        
        const files = this.getAllFiles(directory, ['.js', '.html', '.jsx', '.ts']);
        this.results.summary.totalFiles += files.length;
        
        files.forEach(file => {
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');
            
            lines.forEach((line, index) => {
                const evalMatches = line.match(/eval\s*\(/gi);
                if (evalMatches) {
                    this.results.evalUsage.push({
                        file: path.relative(process.cwd(), file),
                        line: index + 1,
                        content: line.trim(),
                        count: evalMatches.length
                    });
                    
                    this.results.summary.criticalIssues += evalMatches.length;
                }
            });
        });
    }

    // Scan for dangerous patterns
    scanDangerousPatterns(directory) {
        console.log('🔍 Scanning for dangerous patterns...');
        
        const dangerousPatterns = [
            { pattern: /Function\s*\(/gi, severity: 'critical', description: 'Function constructor usage' },
            { pattern: /setTimeout\s*\(/gi, severity: 'high', description: 'setTimeout usage' },
            { pattern: /setInterval\s*\(/gi, severity: 'high', description: 'setInterval usage' },
            { pattern: /document\.write/gi, severity: 'high', description: 'document.write usage' },
            { pattern: /innerHTML\s*=/gi, severity: 'medium', description: 'innerHTML assignment' },
            { pattern: /outerHTML\s*=/gi, severity: 'medium', description: 'outerHTML assignment' },
            { pattern: /javascript:/gi, severity: 'high', description: 'javascript: protocol' },
            { pattern: /onload\s*=/gi, severity: 'medium', description: 'onload event handler' },
            { pattern: /onerror\s*=/gi, severity: 'medium', description: 'onerror event handler' },
            { pattern: /onclick\s*=/gi, severity: 'medium', description: 'onclick event handler' }
        ];
        
        const files = this.getAllFiles(directory, ['.js', '.html', '.jsx', '.ts']);
        
        files.forEach(file => {
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');
            
            dangerousPatterns.forEach(({ pattern, severity, description }) => {
                lines.forEach((line, index) => {
                    if (pattern.test(line)) {
                        this.results.securityIssues.push({
                            file: path.relative(process.cwd(), file),
                            line: index + 1,
                            content: line.trim(),
                            severity,
                            description,
                            pattern: pattern.source
                        });
                        
                        this.results.summary[`${severity}Issues`]++;
                    }
                });
            });
        });
    }

    // Scan for missing security headers
    scanSecurityHeaders(directory) {
        console.log('🔍 Scanning for security headers...');
        
        const serverFiles = this.getAllFiles(directory, ['.js']);
        
        serverFiles.forEach(file => {
            const content = fs.readFileSync(file, 'utf8');
            
            const requiredHeaders = [
                'Content-Security-Policy',
                'X-Content-Type-Options',
                'X-Frame-Options',
                'X-XSS-Protection',
                'Referrer-Policy'
            ];
            
            const missingHeaders = requiredHeaders.filter(header => !content.includes(header));
            
            if (missingHeaders.length > 0) {
                this.results.recommendations.push({
                    file: path.relative(process.cwd(), file),
                    type: 'missing-headers',
                    description: 'Missing security headers',
                    recommendation: `Add these headers: ${missingHeaders.join(', ')}`,
                    severity: 'medium'
                });
            }
        });
    }

    // Run npm audit
    runNpmAudit() {
        console.log('🔍 Running npm audit...');
        
        try {
            const auditOutput = execSync('npm audit --json', { encoding: 'utf8' });
            const auditResults = JSON.parse(auditOutput);
            
            if (auditResults.vulnerabilities) {
                Object.entries(auditResults.vulnerabilities).forEach(([packageName, vulnerability]) => {
                    this.results.vulnerabilities.push({
                        package: packageName,
                        severity: vulnerability.severity,
                        title: vulnerability.title,
                        url: vulnerability.url,
                        fixAvailable: vulnerability.fixAvailable
                    });
                    
                    this.results.summary[`${vulnerability.severity}Issues`]++;
                });
            }
        } catch (error) {
            console.log('⚠️ npm audit failed, but continuing...');
        }
    }

    // Get all files of specific types
    getAllFiles(directory, extensions) {
        const files = [];
        
        function traverse(dir) {
            const items = fs.readdirSync(dir);
            
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                    traverse(fullPath);
                } else if (stat.isFile()) {
                    const ext = path.extname(item);
                    if (extensions.includes(ext)) {
                        files.push(fullPath);
                    }
                }
            }
        }
        
        traverse(directory);
        return files;
    }

    // Generate recommendations
    generateRecommendations() {
        console.log('💡 Generating recommendations...');
        
        // Eval usage recommendations
        if (this.results.evalUsage.length > 0) {
            this.results.recommendations.push({
                type: 'eval-replacement',
                description: 'Replace eval() usage with safer alternatives',
                recommendation: 'Use JSON.parse() for JSON data, Function constructor with validation, or avoid dynamic code execution entirely',
                severity: 'critical',
                affectedFiles: this.results.evalUsage.length
            });
        }

        // Security header recommendations
        this.results.recommendations.push({
            type: 'security-headers',
            description: 'Implement comprehensive security headers',
            recommendation: 'Add CSP, X-Frame-Options, X-Content-Type-Options, and other security headers to all server responses',
            severity: 'medium'
        });

        // Input validation recommendations
        this.results.recommendations.push({
            type: 'input-validation',
            description: 'Implement input sanitization and validation',
            recommendation: 'Use the SecurityUtils.sanitizeInput() function for all user inputs',
            severity: 'high'
        });

        // Testing recommendations
        this.results.recommendations.push({
            type: 'security-testing',
            description: 'Add comprehensive security tests',
            recommendation: 'Run npm run test:security to validate security implementations',
            severity: 'medium'
        });
    }

    // Generate report
    generateReport() {
        console.log('\n📊 Security Scan Report');
        console.log('='.repeat(50));
        
        console.log('\n📈 Summary:');
        console.log(`Total files scanned: ${this.results.summary.totalFiles}`);
        console.log(`Files with issues: ${this.results.evalUsage.length + this.results.securityIssues.length}`);
        console.log(`Critical issues: ${this.results.summary.criticalIssues}`);
        console.log(`High issues: ${this.results.summary.highIssues}`);
        console.log(`Medium issues: ${this.results.summary.mediumIssues}`);
        console.log(`Low issues: ${this.results.summary.lowIssues}`);
        
        if (this.results.evalUsage.length > 0) {
            console.log('\n🚨 Critical: eval() Usage Found:');
            this.results.evalUsage.forEach(issue => {
                console.log(`  ${issue.file}:${issue.line} - ${issue.content}`);
            });
        }
        
        if (this.results.securityIssues.length > 0) {
            console.log('\n⚠️ Security Issues:');
            this.results.securityIssues.slice(0, 10).forEach(issue => {
                console.log(`  ${issue.severity.toUpperCase()}: ${issue.file}:${issue.line} - ${issue.description}`);
            });
            
            if (this.results.securityIssues.length > 10) {
                console.log(`  ... and ${this.results.securityIssues.length - 10} more issues`);
            }
        }
        
        if (this.results.vulnerabilities.length > 0) {
            console.log('\n🔓 Dependency Vulnerabilities:');
            this.results.vulnerabilities.forEach(vuln => {
                console.log(`  ${vuln.severity.toUpperCase()}: ${vuln.package} - ${vuln.title}`);
            });
        }
        
        console.log('\n💡 Recommendations:');
        this.results.recommendations.forEach((rec, index) => {
            console.log(`${index + 1}. ${rec.description}`);
            console.log(`   Severity: ${rec.severity.toUpperCase()}`);
            console.log(`   Action: ${rec.recommendation}`);
            console.log();
        });
        
        // Save detailed report
        const reportPath = 'security-scan-report.json';
        fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
        console.log(`📄 Detailed report saved to: ${reportPath}`);
        
        // Return exit code based on critical issues
        return this.results.summary.criticalIssues > 0 ? 1 : 0;
    }

    // Run complete scan
    async run(directory = '.') {
        console.log('🔒 Starting Security Scan...\n');
        
        this.scanEvalUsage(directory);
        this.scanDangerousPatterns(directory);
        this.scanSecurityHeaders(directory);
        this.runNpmAudit();
        this.generateRecommendations();
        
        return this.generateReport();
    }
}

// Run the scanner if called directly
if (require.main === module) {
    const scanner = new SecurityScanner();
    scanner.run().then(exitCode => {
        process.exit(exitCode);
    }).catch(error => {
        console.error('Security scan failed:', error);
        process.exit(1);
    });
}

module.exports = SecurityScanner;
