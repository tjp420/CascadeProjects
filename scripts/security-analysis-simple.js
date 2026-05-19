#!/usr/bin/env node

/**
 * Security Analysis and Improvement Script (Simplified)
 */

const fs = require('fs');
const path = require('path');

class SecurityAnalyzer {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.results = {
            evalUsage: [],
            highIssueFiles: [],
            commonErrorTypes: {}
        };
    }

    analyze() {
        console.log('🔍 Starting Security Analysis...\n');
        
        this.findEvalUsage();
        this.analyzeIssueConcentration();
        this.identifyCommonErrorPatterns();
        this.generateReports();
        this.createSecurityFixes();
        
        console.log('\n✅ Security Analysis Complete!');
    }

    findEvalUsage() {
        console.log('📊 Searching for eval() usage patterns...');
        
        const sourceDirs = ['./src', './web'];
        const fileExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py'];
        
        for (const dir of sourceDirs) {
            if (!fs.existsSync(dir)) continue;
            
            this.searchDirectory(dir, fileExtensions);
        }
        
        console.log(`   Found ${this.results.evalUsage.length} instances of eval() usage`);
    }

    searchDirectory(dir, extensions) {
        const files = this.getFilesRecursive(dir, extensions);
        
        for (const file of files) {
            this.analyzeFileForEval(file);
        }
    }

    getFilesRecursive(dir, extensions) {
        const files = [];
        
        if (!fs.existsSync(dir)) return files;
        
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                if (!item.startsWith('.') && item !== 'node_modules' && item !== 'tests' && item !== 'test') {
                    files.push(...this.getFilesRecursive(fullPath, extensions));
                }
            } else if (stat.isFile()) {
                const ext = path.extname(item);
                if (extensions.includes(ext)) {
                    files.push(fullPath);
                }
            }
        }
        
        return files;
    }

    analyzeFileForEval(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const lineNumber = i + 1;
                
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('//') || trimmedLine.startsWith('#') || 
                    trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
                    continue;
                }
                
                const evalMatch = line.match(/eval\s*\(/);
                if (evalMatch) {
                    const context = this.getEvalContext(line, lines, i);
                    this.results.evalUsage.push({
                        file: filePath,
                        line: lineNumber,
                        context: context,
                        severity: 'critical',
                        suggestedFix: this.getSuggestedFix(context)
                    });
                }
            }
        } catch (error) {
            // Skip files that can't be read
        }
    }

    getEvalContext(line, lines, index) {
        const start = Math.max(0, index - 2);
        const end = Math.min(lines.length, index + 3);
        const context = lines.slice(start, end).join('\n');
        
        if (line.includes('JSON') || line.includes('parse')) {
            return 'json_parsing';
        } else if (line.includes('math') || line.includes('calc')) {
            return 'mathematical';
        } else if (line.includes('function') || line.includes('=>')) {
            return 'dynamic_function';
        } else if (line.includes('user') || line.includes('input')) {
            return 'user_input';
        } else {
            return 'unknown';
        }
    }

    getSuggestedFix(context) {
        const fixes = {
            json_parsing: 'Replace with JSON.parse() and try-catch error handling',
            mathematical: 'Use math libraries or safe evaluation functions',
            dynamic_function: 'Use function references or object mapping instead',
            user_input: 'CRITICAL: Never use eval() with user input. Use input validation and safe parsers',
            unknown: 'Review usage and replace with safer alternatives'
        };
        
        return fixes[context] || fixes.unknown;
    }

    analyzeIssueConcentration() {
        console.log('📈 Analyzing issue concentration by file...');
        
        const fileIssueCount = {};
        this.results.evalUsage.forEach(issue => {
            fileIssueCount[issue.file] = (fileIssueCount[issue.file] || 0) + 1;
        });
        
        const sortedFiles = Object.entries(fileIssueCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        
        this.results.highIssueFiles = sortedFiles.map(([file, count]) => ({
            file,
            issueCount: count,
            relativePath: path.relative(this.projectRoot, file)
        }));
        
        console.log(`   Identified ${this.results.highIssueFiles.length} files with highest issue concentration`);
    }

    identifyCommonErrorPatterns() {
        console.log('🔎 Identifying common error patterns...');
        
        const errorTypes = {};
        this.results.evalUsage.forEach(issue => {
            errorTypes[issue.context] = (errorTypes[issue.context] || 0) + 1;
        });
        
        this.results.commonErrorTypes = errorTypes;
        
        console.log(`   Found ${Object.keys(errorTypes).length} distinct error patterns`);
    }

    generateReports() {
        console.log('📋 Generating detailed reports...');
        
        const reportDir = path.join(this.projectRoot, 'security-reports');
        if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
        }
        
        this.generateEvalReport(reportDir);
        this.generateConcentrationReport(reportDir);
        this.generateSecurityFixesReport(reportDir);
        
        console.log(`   Reports generated in ${reportDir}`);
    }

    generateEvalReport(reportDir) {
        const reportPath = path.join(reportDir, 'eval-usage-report.json');
        const report = {
            summary: {
                totalEvalUsage: this.results.evalUsage.length,
                criticalIssues: this.results.evalUsage.filter(i => i.severity === 'critical').length,
                generatedAt: new Date().toISOString()
            },
            usageByContext: this.results.commonErrorTypes,
            detailedFindings: this.results.evalUsage
        };
        
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`   - eval-usage-report.json`);
    }

    generateConcentrationReport(reportDir) {
        const reportPath = path.join(reportDir, 'issue-concentration-report.json');
        const report = {
            summary: {
                totalFilesAnalyzed: this.results.highIssueFiles.length,
                totalIssues: this.results.evalUsage.length
            },
            topFiles: this.results.highIssueFiles.map(file => ({
                path: file.relativePath,
                issueCount: file.issueCount,
                severity: file.issueCount > 5 ? 'critical' : file.issueCount > 2 ? 'high' : 'medium'
            }))
        };
        
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`   - issue-concentration-report.json`);
    }

    generateSecurityFixesReport(reportDir) {
        const reportPath = path.join(reportDir, 'security-fixes-guide.md');
        
        let markdown = `# Security Fixes Guide

## Executive Summary
- **Total eval() instances found**: ${this.results.evalUsage.length}
- **Critical severity**: ${this.results.evalUsage.filter(i => i.severity === 'critical').length}
- **Files requiring attention**: ${this.results.highIssueFiles.length}

## Priority Files

`;
        
        this.results.highIssueFiles.forEach((file, index) => {
            markdown += `### ${index + 1}. ${file.relativePath}
- **Issues**: ${file.issueCount}
- **Priority**: ${file.issueCount > 5 ? 'CRITICAL' : file.issueCount > 2 ? 'HIGH' : 'MEDIUM'}

`;
        });
        
        markdown += `## Common Patterns

`;
        
        Object.entries(this.results.commonErrorTypes).forEach(([pattern, count]) => {
            markdown += `- **${pattern}**: ${count} instances\n`;
        });
        
        markdown += `
## Recommended Actions

### 1. Immediate Actions (Critical Priority)
- Review all files with 5+ eval() instances
- Replace eval() with JSON.parse() for JSON parsing
- Implement input validation for any user input handling

### 2. Short-term Actions (High Priority)
- Set up linting rules to prevent future eval() usage
- Implement safe evaluation alternatives for dynamic code
- Add security testing to CI/CD pipeline

### 3. Long-term Actions (Medium Priority)
- Conduct security audit of all dynamic code execution
- Implement sandboxing for necessary dynamic execution
- Provide security training for development team

## Safer Alternatives

### JSON Parsing
\`\`\`javascript
// DANGEROUS
const data = eval(jsonString);

// SAFE
const data = JSON.parse(jsonString);
\`\`\`

### Mathematical Operations
\`\`\`javascript
// DANGEROUS
const result = eval(mathExpression);

// SAFE
import { evaluate } from 'mathjs';
const result = evaluate(mathExpression);
\`\`\`

### Dynamic Function Calls
\`\`\`javascript
// DANGEROUS
const func = eval('functionName');
func();

// SAFE
const functionMap = {
    functionName: actualFunction
};
const func = functionMap[functionName];
func();
\`\`\`
`;
        
        fs.writeFileSync(reportPath, markdown);
        console.log(`   - security-fixes-guide.md`);
    }

    createSecurityFixes() {
        console.log('🔧 Creating security fix scripts...');
        
        const scriptsDir = path.join(this.projectRoot, 'scripts', 'security-fixes');
        if (!fs.existsSync(scriptsDir)) {
            fs.mkdirSync(scriptsDir, { recursive: true });
        }
        
        this.createEvalReplacementScript(scriptsDir);
        this.createSecurityLintingConfig(scriptsDir);
        
        console.log(`   Security fix scripts created in ${scriptsDir}`);
    }

    createEvalReplacementScript(scriptsDir) {
        const scriptPath = path.join(scriptsDir, 'fix-eval-usage.js');
        
        const script = `#!/usr/bin/env node
/**
 * Automated eval() Replacement Script
 */

const fs = require('fs');
const path = require('path');

class EvalReplacer {
    constructor(filePath) {
        this.filePath = filePath;
        this.content = fs.readFileSync(filePath, 'utf8');
        this.changes = [];
    }

    replaceJSONParse() {
        this.content = this.content.replace(
            /eval\\s*\\(\\s*JSON\\.stringify\\s*\\(([^)]+)\\)\\s*\\)/g,
            'JSON.parse(JSON.stringify($1))'
        );
    }

    addSecurityComment() {
        this.content = this.content.replace(
            /(eval\\s*\\()/g,
            '// SECURITY WARNING: eval() usage detected - review for safer alternatives\\n    $1'
        );
    }

    save() {
        fs.writeFileSync(this.filePath, this.content);
        console.log(\`Fixed \${this.filePath}\`);
    }
}

const filePath = process.argv[2];
if (!filePath) {
    console.log('Usage: node fix-eval-usage.js <file-path>');
    process.exit(1);
}

const replacer = new EvalReplacer(filePath);
replacer.replaceJSONParse();
replacer.addSecurityComment();
replacer.save();
`;
        
        fs.writeFileSync(scriptPath, script);
        console.log(`   - fix-eval-usage.js`);
    }

    createSecurityLintingConfig(scriptsDir) {
        const configPath = path.join(scriptsDir, '.eslintrc.security.json');
        
        const config = {
            extends: ['eslint:recommended'],
            rules: {
                'no-eval': 'error',
                'no-implied-eval': 'error',
                'no-new-func': 'warn',
                'no-script-url': 'error'
            },
            globals: {
                console: 'readonly',
                window: 'readonly',
                document: 'readonly'
            }
        };
        
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(`   - .eslintrc.security.json`);
    }
}

const analyzer = new SecurityAnalyzer(process.cwd());
analyzer.analyze();