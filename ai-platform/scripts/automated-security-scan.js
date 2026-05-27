/**
 * Automated Security Scanning Script
 * Comprehensive security vulnerability detection and reporting
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class AutomatedSecurityScanner {
  constructor() {
    this.scanResults = {
      timestamp: new Date().toISOString(),
      scanId: crypto.randomUUID(),
      vulnerabilities: [],
      recommendations: [],
      score: 100,
      metrics: {
        filesScanned: 0,
        linesOfCode: 0,
        issuesFound: 0,
        issuesFixed: 0
      },
      categories: {
        dependencies: [],
        codeQuality: [],
        security: [],
        configuration: [],
        documentation: []
      }
    };
  }

  async runComprehensiveScan() {
    console.log('🔍 Starting comprehensive security scan...');
    
    try {
      // 1. Dependency Security Scan
      await this.scanDependencies();
      
      // 2. Code Quality Scan
      await this.scanCodeQuality();
      
      // 3. Security Configuration Scan
      await this.scanSecurityConfiguration();
      
      // 4. Documentation Security Scan
      await this.scanDocumentation();
      
      // 5. Generate Report
      this.generateReport();
      
      console.log('✅ Security scan completed successfully');
      return this.scanResults;
      
    } catch (error) {
      console.error('❌ Security scan failed:', error.message);
      throw error;
    }
  }

  async scanDependencies() {
    console.log('📦 Scanning dependencies...');
    
    try {
      // npm audit
      const auditOutput = execSync('npm audit --json', { 
        cwd: path.join(__dirname, '..'),
        encoding: 'utf8'
      });
      
      const auditData = JSON.parse(auditOutput);
      
      // Process vulnerabilities
      if (auditData.vulnerabilities && auditData.vulnerabilities.length > 0) {
        auditData.vulnerabilities.forEach(vuln => {
          this.scanResults.vulnerabilities.push({
            type: 'dependency',
            package: vuln.package,
            severity: vuln.severity,
            title: vuln.title,
            url: vuln.url,
            cve: vuln.cve,
            recommendation: this.getDependencyRecommendation(vuln)
          });
          
          this.scanResults.categories.dependencies.push(vuln);
          
          // Adjust score based on severity
          if (vuln.severity === 'high') this.scanResults.score -= 5;
          else if (vuln.severity === 'moderate') this.scanResults.score -= 2;
          else if (vuln.severity === 'low') this.scanResults.score -= 1;
        });
      }
      
      console.log(`✅ Dependencies scanned: ${auditData.vulnerabilities?.length || 0} vulnerabilities found`);
      
    } catch (error) {
      console.error('❌ Dependency scan failed:', error.message);
      this.scanResults.categories.dependencies.push({
        type: 'error',
        message: 'Dependency scan failed',
        error: error.message
      });
    }
  }

  async scanCodeQuality() {
    console.log('🔍 Scanning code quality...');
    
    try {
      // Check if ESLint config exists
      const eslintConfigPath = path.join(__dirname, '..', '.eslintrc.json');
      if (!fs.existsSync(eslintConfigPath)) {
        console.log('⚠️ ESLint configuration not found, skipping code quality scan');
        return;
      }
      
      // ESLint security scan
      const eslintOutput = execSync('npx eslint --format=json src --ext .js,.jsx', {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf8'
      });
      
      if (eslintOutput) {
        const eslintResults = JSON.parse(eslintOutput);
        
        eslintResults.forEach(result => {
          if (result.messages && result.messages.length > 0) {
            result.messages.forEach(message => {
              if (message.ruleId && message.ruleId.includes('security')) {
                this.scanResults.vulnerabilities.push({
                  type: 'code_quality',
                  file: result.filePath,
                  line: message.line,
                  column: message.column,
                  severity: this.getSeverityFromRule(message.severity),
                  rule: message.ruleId,
                  message: message.message,
                  recommendation: this.getCodeQualityRecommendation(message)
                });
                
                this.scanResults.categories.codeQuality.push({
                  type: 'security_issue',
                  file: result.filePath,
                  line: message.line,
                  column: message.column,
                  rule: message.ruleId,
                  message: message.message
                });
                
                if (message.severity === 2) this.scanResults.score -= 2;
                else if (message.severity === 1) this.scanResults.score -= 1;
              }
            });
          }
        });
      }
      
      console.log('✅ Code quality scan completed');
      
    } catch (error) {
      console.error('❌ Code quality scan failed:', error.message);
      this.scanResults.categories.codeQuality.push({
        type: 'error',
        message: 'Code quality scan failed',
        error: error.message
      });
    }
  }

  async scanSecurityConfiguration() {
    console.log('🔒 Scanning security configuration...');
    
    const configFiles = [
      'package.json',
      '.eslintrc.json',
      '.prettierrc.json',
      'vite.config.js'
    ];
    
    for (const configFile of configFiles) {
      try {
        const configPath = path.join(__dirname, '..', configFile);
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          
          // Check for security-related configurations
          this.checkSecurityConfig(config, configFile);
        }
      } catch (error) {
        console.log(`⚠️ Could not read ${configFile}: ${error.message}`);
      }
    }
    
    console.log('✅ Security configuration scan completed');
  }

  checkSecurityConfig(config, filename) {
    const securityIssues = [];
    
    // Check for secure dependencies
    if (config.dependencies) {
      Object.keys(config.dependencies).forEach(pkg => {
        if (this.isInsecurePackage(pkg)) {
          securityIssues.push({
            package: pkg,
            severity: 'high',
            recommendation: `Replace ${pkg} with a secure alternative`
          });
        }
      });
    }
    
    // Check ESLint security rules
    if (filename === '.eslintrc.json' && config.rules) {
      const securityRules = Object.keys(config.rules).filter(rule => 
        rule.includes('security') || rule.includes('xss') || rule.includes('injection')
      );
      
      if (securityRules.length === 0) {
        securityIssues.push({
          type: 'missing_security_rules',
          severity: 'medium',
          recommendation: 'Add ESLint security rules'
        });
      }
    }
    
    if (securityIssues.length > 0) {
      this.scanResults.categories.security.push({
        type: 'configuration_issues',
        file: filename,
        issues: securityIssues
      });
      
      securityIssues.forEach(issue => {
        if (issue.severity === 'high') this.scanResults.score -= 3;
        else if (issue.severity === 'medium') this.scanResults.score -= 1;
      });
    }
  }

  isInsecurePackage(packageName) {
    const insecurePackages = [
      'serialize-javascript',
      'lodash',
      'underscore',
      'request',
      'axios',
      'node-fetch',
      'ws'
    ];
    
    return insecurePackages.includes(packageName);
  }

  async scanDocumentation() {
    console.log('📚 Scanning documentation...');
    
    const docsPath = path.join(__dirname, '..', 'docs');
    
    if (!fs.existsSync(docsPath)) {
      console.log('⚠️ No documentation directory found');
      return;
    }
    
    const docFiles = fs.readdirSync(docsPath, { withFileTypes: true })
      .filter(file => file.name.endsWith('.md'));
    
    const securityDocs = [
      'security-overview.md',
      'security-best-practices.md',
      'security-monitoring.md',
      'incident-response.md'
    ];
    
    const missingDocs = securityDocs.filter(doc => 
      !docFiles.some(file => file.name === doc)
    );
    
    if (missingDocs.length > 0) {
      this.scanResults.categories.documentation.push({
        type: 'missing_security_documentation',
        files: missingDocs,
        recommendation: 'Create comprehensive security documentation'
      });
      
      this.scanResults.score -= missingDocs.length;
    }
    
    console.log(`✅ Documentation scan completed: ${missingDocs.length} missing security docs`);
  }

  getDependencyRecommendation(vulnerability) {
    const recommendations = {
      'serialize-javascript': 'Update to latest version or replace with secure alternative',
      'lodash': 'Update to latest version or use native alternatives',
      'underscore': 'Update to latest version or replace with modern alternatives',
      'axios': 'Update to latest version and implement proper error handling',
      'node-fetch': 'Update to latest version and implement proper error handling',
      'esbuild': 'Update to latest version or use alternative build tool'
    };
    
    return recommendations[vulnerability.package] || 'Update to latest version';
  }

  getCodeQualityRecommendation(message) {
    return 'Fix the security issue by following ESLint recommendations';
  }

  getSeverityFromRule(severity) {
    switch (severity) {
      case 2: return 'high';
      case 1: return 'medium';
      case 0: return 'low';
      default: return 'low';
    }
  }

  generateReport() {
    const report = {
      ...this.scanResults,
      summary: {
        totalVulnerabilities: this.scanResults.vulnerabilities.length,
        securityScore: this.scanResults.score,
        categories: Object.keys(this.scanResults.categories).map(cat => ({
          type: cat,
          count: this.scanResults.categories[cat].length
        })),
        recommendations: this.generateOverallRecommendations()
      },
      timestamp: new Date().toISOString()
    };
    
    // Save report
    const reportPath = path.join(__dirname, '..', 'security-scan-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Update security monitoring
    this.updateSecurityMonitoring(report);
    
    console.log(`📊 Security scan report saved to: ${reportPath}`);
    console.log(`📊 Security Score: ${report.securityScore}/100`);
    console.log(`📊 Total Vulnerabilities: ${report.summary.totalVulnerabilities}`);
  }

  updateSecurityMonitoring(report) {
    try {
      const securityDataPath = path.join(__dirname, '..', 'security-data.json');
      
      if (fs.existsSync(securityDataPath)) {
        const securityData = JSON.parse(fs.readFileSync(securityDataPath, 'utf8'));
        
        securityData.vulnerabilities = report.summary.totalVulnerabilities;
        securityData.score = report.securityScore;
        securityData.lastScan = report.timestamp;
        
        fs.writeFileSync(securityDataPath, JSON.stringify(securityData, null, 2));
      }
    } catch (error) {
      console.error('Error updating security monitoring data:', error.message);
    }
  }

  generateOverallRecommendations() {
    const recommendations = [];
    
    // Dependency recommendations
    const depVulns = this.scanResults.categories.dependencies.filter(v => 
      v.type !== 'error' && v.severity === 'high'
    );
    
    if (depVulns.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'dependencies',
        action: 'Fix high-severity dependency vulnerabilities',
        details: `${depVulns.length} high-severity vulnerabilities found`,
        timeline: 'Immediate'
      });
    }
    
    // Code quality recommendations
    const codeIssues = this.scanResults.categories.codeQuality.filter(v => 
      v.type !== 'error' && v.severity === 'high'
    );
    
    if (codeIssues.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'code_quality',
        action: 'Fix high-severity code quality issues',
        details: `${codeIssues.length} high-severity issues found`,
        timeline: 'Next sprint'
      });
    }
    
    // Security configuration recommendations
    const configIssues = this.scanResults.categories.security.filter(v => 
      v.type === 'configuration_issues'
    );
    
    if (configIssues.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'configuration',
        action: 'Fix security configuration issues',
        details: `${configIssues.length} configuration issues found`,
        timeline: 'Next sprint'
      });
    }
    
    // Documentation recommendations
    const docIssues = this.scanResults.categories.documentation.filter(v => 
      v.type === 'missing_security_documentation'
    );
    
    if (docIssues.length > 0) {
      recommendations.push({
        priority: 'low',
        category: 'documentation',
        action: 'Create missing security documentation',
        details: `${docIssues.length} security documents missing`,
        timeline: 'Next month'
      });
    }
    
    return recommendations;
  }

  // Schedule automated scans
  scheduleAutomatedScans() {
    // Run scan every 6 hours
    setInterval(() => {
      this.runComprehensiveScan().catch(console.error);
    }, 6 * 60 * 60 * 1000);
    
    console.log('🔄 Automated security scans scheduled (every 6 hours)');
  }
}

// Run scan if this script is executed directly
if (require.main === module) {
  const scanner = new AutomatedSecurityScanner();
  scanner.runComprehensiveScan()
    .then(() => {
      scanner.scheduleAutomatedScans();
    })
    .catch(console.error);
}

module.exports = AutomatedSecurityScanner;
