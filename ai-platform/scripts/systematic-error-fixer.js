
/**
 * Systematic Error Fixer
 * 
 * This script provides automated fixes and guidance for common error types
 * identified in the security analysis, including eval() usage, command injection,
 * XSS vulnerabilities, and other security issues.
 */

const fs = require('fs');
const path = require('path');

class SystematicErrorFixer {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.fixesDir = path.join(projectRoot, 'security-reports', 'fixes');
        this.ensureFixesDirectory();
        this.stats = {
            filesProcessed: 0,
            issuesFixed: 0,
            issuesSkipped: 0,
            errors: 0
        };
    }

    ensureFixesDirectory() {
        if (!fs.existsSync(this.fixesDir)) {
            fs.mkdirSync(this.fixesDir, { recursive: true });
        }
    }

    async fixAllIssues() {
        console.log('🔧 Systematic Error Fixing Started...\n');

        const fixers = [
            { name: 'eval() Usage', method: this.fixEvalUsage.bind(this) },
            { name: 'Function Constructor', method: this.fixFunctionConstructor.bind(this) },
            { name: 'innerHTML Assignment', method: this.fixInnerHTML.bind(this) },
            { name: 'Command Injection', method: this.fixCommandInjection.bind(this) },
            { name: 'SQL Injection', method: this.fixSQLInjection.bind(this) }
        ];

        for (const fixer of fixers) {
            console.log(`\n🔍 Fixing: ${fixer.name}`);
            await fixer.method();
        }

        this.generateFixReport();
        console.log('\n✅ Systematic Error Fixing Complete!');
        console.log(`\n📊 Statistics:`);
        console.log(`   Files processed: ${this.stats.filesProcessed}`);
        console.log(`   Issues fixed: ${this.stats.issuesFixed}`);
        console.log(`   Issues skipped: ${this.stats.issuesSkipped}`);
        console.log(`   Errors: ${this.stats.errors}`);
    }

    async fixEvalUsage() {
        const pattern = /eval\s*\(\s*([^)]+)\s*\)/g;
        await this.applyFix(pattern, this.replaceEval.bind(this), 'eval_usage');
    }

    replaceEval(match, content, filePath, lineNumber) {
        // Determine if it's JSON parsing
        if (content.includes('{') || content.includes('[')) {
            this.stats.issuesFixed++;
            return `JSON.parse(${content}) /* Replaced eval with JSON.parse */`;
        }
        
        // Determine if it's a mathematical expression
        if (/^[\d\s\+\-\*\/\(\)\.]+$/.test(content)) {
            this.stats.issuesFixed++;
            return `/* SAFER ALTERNATIVE NEEDED: Mathematical expression - use a math parser library */\n// Original: JSON.parse(${content}) /* Replaced eval with JSON.parse */`;
        }
        
        // For other cases, provide guidance
        this.stats.issuesSkipped++;
        return `/* SECURITY WARNING: eval() usage detected - requires manual review */\n// Original: ${match}`;
    }

    async fixFunctionConstructor() {
        const pattern = /new\s+Function\s*\(([^)]*)\)/g;
        await this.applyFix(pattern, this.replaceFunctionConstructor.bind(this), 'function_constructor');
    }

    replaceFunctionConstructor(match, args, filePath, lineNumber) {
        this.stats.issuesSkipped++;
        return `/* SECURITY WARNING: Function constructor usage - requires manual review */\n// Original: ${match}`;
    }

    async fixInnerHTML() {
        const pattern = /innerHTML\s*=\s*([^;]+);/g;
        await this.applyFix(pattern, this.replaceInnerHTML.bind(this), 'innerHTML');
    }

    replaceInnerHTML(match, content, filePath, lineNumber) {
        this.stats.issuesFixed++;
        return `textContent = ${content} /* Replaced innerHTML with textContent for safety */`;
    }

    async fixCommandInjection() {
        const patterns = [
            { pattern: /subprocess\.call\s*\(/g, language: 'python' },
            { pattern: /subprocess\.run\s*\(/g, language: 'python' },
            { pattern: /subprocess\.Popen\s*\(/g, language: 'python' },
            { pattern: /os\.system\s*\(/g, language: 'python' },
            { pattern: /exec\s*\(/g, language: 'python' }
        ];

        for (const { pattern, language } of patterns) {
            await this.applyFix(pattern, this.replaceCommandInjection.bind(this, language), 'command_injection');
        }
    }

    replaceCommandInjection(language, match, content, filePath, lineNumber) {
        this.stats.issuesSkipped++;
        const comment = language === 'python' ? 
            `/* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */` :
            `/* SECURITY WARNING: Command execution - validate and sanitize inputs */`;
        return `${comment}\n// Original: ${match}`;
    }

    async fixSQLInjection() {
        const patterns = [
            { pattern: /execute\s*\(\s*["'].*?\%s.*?["']/g, language: 'python' },
            { pattern: /query\s*\(\s*["'].*?\+.*?["']/g, language: 'javascript' }
        ];

        for (const { pattern, language } of patterns) {
            await this.applyFix(pattern, this.replaceSQLInjection.bind(this, language), 'sql_injection');
        }
    }

    replaceSQLInjection(language, match, content, filePath, lineNumber) {
        this.stats.issuesSkipped++;
        return `/* SECURITY WARNING: Potential SQL injection - use parameterized queries */\n// Original: ${match}`;
    }

    async applyFix(pattern, replacementFunction, fixType) {
        const files = this.findFilesToFix();
        
        for (const file of files) {
            try {
                const filePath = path.join(this.projectRoot, file);
                const content = fs.readFileSync(filePath, 'utf8');
                
                let modifiedContent = content;
                let matchCount = 0;
                
                modifiedContent = modifiedContent.replace(pattern, (match, ...args) => {
                    matchCount++;
                    const lineNumber = content.substring(0, match.index).split('\n').length;
                    return replacementFunction(match, args[0], file, lineNumber);
                });
                
                if (modifiedContent !== content) {
                    const backupPath = path.join(this.fixesDir, `${path.basename(file)}.backup`);
                    fs.writeFileSync(backupPath, content);
                    
                    fs.writeFileSync(filePath, modifiedContent);
                    this.stats.filesProcessed++;
                    
                    console.log(`   ✅ Fixed ${matchCount} issues in ${file}`);
                }
            } catch (error) {
                this.stats.errors++;
                console.log(`   ❌ Error processing ${file}: ${error.message}`);
            }
        }
    }

    findFilesToFix() {
        const extensions = ['.js', '.jsx', '.ts', '.tsx', '.py'];
        const files = [];
        
        const searchDir = (dir) => {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const item of items) {
                if (item.isDirectory()) {
                    // Skip node_modules and other common exclusions
                    if (!['node_modules', '.git', 'venv', 'env', '__pycache__'].includes(item.name)) {
                        searchDir(path.join(dir, item.name));
                    }
                } else if (item.isFile()) {
                    const ext = path.extname(item.name);
                    if (extensions.includes(ext)) {
                        files.push(path.relative(this.projectRoot, path.join(dir, item.name)));
                    }
                }
            }
        };
        
        searchDir(this.projectRoot);
        return files;
    }

    generateFixReport() {
        const report = {
            generatedAt: new Date().toISOString(),
            statistics: this.stats,
            recommendations: [
                'Review all skipped issues manually',
                'Test all automated fixes thoroughly',
                'Implement security testing to prevent regressions',
                'Add code review guidelines for security patterns',
                'Consider using static analysis tools in CI/CD'
            ],
            nextSteps: [
                'Manual review of skipped issues',
                'Security testing implementation',
                'Team training on secure coding practices',
                'Integration with development workflow'
            ]
        };
        
        const reportPath = path.join(this.fixesDir, 'fix-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        const markdownReport = this.createMarkdownReport(report);
        const markdownPath = path.join(this.fixesDir, 'fix-report.md');
        fs.writeFileSync(markdownPath, markdownReport);
        
        console.log(`\n📋 Fix report saved to: ${reportPath}`);
    }

    createMarkdownReport(report) {
        return `# Systematic Error Fixing Report

**Generated:** ${report.generatedAt}

## Statistics

- **Files Processed:** ${report.statistics.filesProcessed}
- **Issues Fixed:** ${report.statistics.issuesFixed}
- **Issues Skipped (Manual Review Required):** ${report.statistics.issuesSkipped}
- **Errors Encountered:** ${report.statistics.errors}

## Recommendations

${report.recommendations.map(rec => `- ${rec}`).join('\n')}

## Next Steps

${report.nextSteps.map(step => `- ${step}`).join('\n')}

## Important Notes

1. **Backups:** Original files are backed up in the \`fixes\` directory
2. **Manual Review:** All skipped issues require manual security review
3. **Testing:** Thoroughly test all automated fixes before deployment
4. **Security:** Some fixes may require architectural changes
5. **Validation:** Ensure all fixes maintain original functionality

## Automated Fixes Applied

- **eval() → JSON.parse:** For JSON parsing scenarios
- **innerHTML → textContent:** For DOM manipulation safety
- Other patterns flagged for manual review

## Manual Review Required

The following issue types were skipped and require manual review:
- Function constructor usage
- Command injection vulnerabilities
- SQL injection patterns
- Complex eval() usage
- Dynamic code generation

Please review these issues carefully and implement appropriate security measures.
`;
    }
}

// Main execution
const fixer = new SystematicErrorFixer(process.cwd());
fixer.fixAllIssues();