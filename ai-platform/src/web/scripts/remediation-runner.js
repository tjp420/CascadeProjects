
/**
 * Mock Data Remediation Runner
 * Automated script to apply remediation patterns to problematic files
 */

import fs from 'fs/promises';
import path from 'path';

import { MockDataScanner } from '../modules/mock-data-scanner.js';
import { RemediationHelper, RemediationPatterns } from '../utils/mock-patterns-remediation.js';

/**
 * Remediation Runner class
 */
class RemediationRunner {
    constructor(options = {}) {
        this.options = {
            dryRun: options.dryRun || false,
            backup: options.backup !== false,
            verbose: options.verbose || false,
            targetPath: options.targetPath || './',
            outputDir: options.outputDir || './remediation-reports'
        };
        this.scanner = new MockDataScanner();
        this.stats = {
            filesProcessed: 0,
            filesModified: 0,
            totalFindings: 0,
            findingsFixed: 0,
            errors: []
        };
    }

    /**
     * Run the remediation process
     */
    async run() {
        console.log('🚀 Starting mock data remediation...');
        console.log(`📁 Target path: ${this.options.targetPath}`);
        console.log(`🔍 Dry run: ${this.options.dryRun}`);
        console.log(`💾 Backup enabled: ${this.options.backup}`);
        
        try {
            // Ensure output directory exists
            await this.ensureDirectory(this.options.outputDir);
            
            // Scan for mock data issues
            console.log('\n🔍 Scanning for mock data issues...');
            const scanResults = await this.scanFiles();
            
            // Generate remediation reports
            console.log('\n📋 Generating remediation reports...');
            await this.generateReports(scanResults);
            
            // Apply remediations (if not dry run)
            if (!this.options.dryRun) {
                console.log('\n🔧 Applying remediations...');
                await this.applyRemediations(scanResults);
            }
            
            // Print summary
            this.printSummary();
            
        } catch (error) {
            console.error('❌ Remediation failed:', error);
            this.stats.errors.push(error.message);
        }
    }

    /**
     * Scan files for mock data issues
     */
    async scanFiles() {
        const files = await this.getTestFiles(this.options.targetPath);
        console.log(`📁 Found ${files.length} test files to scan`);
        
        const scanResults = await this.scanner.scanFiles(files, (current, total, filename) => {
            if (this.options.verbose) {
                console.log(`🔍 Scanning ${current}/${total}: ${filename}`);
            }
        });
        
        this.stats.totalFindings = scanResults.summary.totalMatches;
        console.log(`🎯 Found ${this.stats.totalFindings} mock data issues`);
        
        return scanResults;
    }

    /**
     * Get all test files from directory
     */
    async getTestFiles(dirPath) {
        const files = [];
        
        async function traverse(currentPath) {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                
                if (entry.isDirectory()) {
                    // Skip common non-test directories
                    if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
                        await traverse(fullPath);
                    }
                } else if (entry.isFile()) {
                    // Include test files
                    const ext = path.extname(entry.name).toLowerCase();
                    const name = entry.name.toLowerCase();
                    
                    if (['.js', '.ts', '.py', '.java', '.cs', '.rb', '.php'].includes(ext) &&
                        (name.includes('test') || name.includes('spec'))) {
                        const content = await fs.readFile(fullPath, 'utf8');
                        files.push({
                            name: entry.name,
                            path: fullPath,
                            content: content,
                            size: content.length,
                            type: ext,
                            lastModified: (await fs.stat(fullPath)).mtime
                        });
                    }
                }
            }
        }
        
        await traverse(dirPath);
        return files;
    }

    /**
     * Generate remediation reports
     */
    async generateReports(scanResults) {
        const reportPath = path.join(this.options.outputDir, 'remediation-report.json');
        const summaryPath = path.join(this.options.outputDir, 'remediation-summary.md');
        
        // Generate detailed JSON report
        const detailedReport = {
            timestamp: new Date().toISOString(),
            scanResults,
            remediationPlans: {},
            statistics: this.stats
        };
        
        // Generate remediation plans for each file
        for (const result of scanResults.results) {
            if (result.matches.length > 0) {
                detailedReport.remediationPlans[result.file] = 
                    RemediationHelper.generateRemediationReport(result.file, result.matches);
            }
        }
        
        await fs.writeFile(reportPath, JSON.stringify(detailedReport, null, 2));
        
        // Generate markdown summary
        const markdownSummary = this.generateMarkdownSummary(detailedReport);
        await fs.writeFile(summaryPath, markdownSummary);
        
        console.log(`📄 Reports generated in ${this.options.outputDir}`);
    }

    /**
     * Generate markdown summary report
     */
    generateMarkdownSummary(report) {
        const { scanResults, remediationPlans } = report;
        
        let markdown = '# Mock Data Remediation Report\n\n';
        markdown += `**Generated:** ${new Date(report.timestamp).toLocaleString()}\n\n`;
        
        // Summary section
        markdown += '## Summary\n\n';
        markdown += `- **Files Scanned:** ${scanResults.summary.totalFiles}\n`;
        markdown += `- **Files with Findings:** ${scanResults.summary.filesWithMatches}\n`;
        markdown += `- **Total Findings:** ${scanResults.summary.totalMatches}\n`;
        markdown += `- **Health Score:** ${scanResults.summary.healthScore}% (${scanResults.summary.healthGrade})\n\n`;
        
        // Top files
        markdown += '## Top Files Requiring Remediation\n\n';
        markdown += '| File | Findings | High Severity |\n';
        markdown += '|------|----------|---------------|\n';
        
        scanResults.topFiles.slice(0, 10).forEach(file => {
            markdown += `| ${file.file} | ${file.matchCount} | ${file.highSeverityCount} |\n`;
        });
        
        // Category breakdown
        markdown += '\n## Findings by Category\n\n';
        markdown += '| Category | Count | Priority |\n';
        markdown += '|----------|-------|----------|\n';
        
        scanResults.categories.forEach(cat => {
            const priority = this.getCategoryPriority(cat.category);
            markdown += `| ${cat.category} | ${cat.count} | ${priority} |\n`;
        });
        
        // Remediation plans
        markdown += '\n## Remediation Plans\n\n';
        
        Object.entries(remediationPlans).slice(0, 5).forEach(([file, plan]) => {
            markdown += `### ${file}\n\n`;
            markdown += `**Total Findings:** ${plan.totalFindings}\n`;
            markdown += `**Estimated Effort:** ${plan.estimatedEffort}\n\n`;
            
            plan.remediationPlan.forEach(item => {
                markdown += `- **${item.category}:** ${item.count} instances\n`;
                markdown += `  - Solution: ${item.solution}\n\n`;
            });
        });
        
        // Next steps
        markdown += '## Next Steps\n\n';
        markdown += '1. Review the detailed remediation report\n';
        markdown += '2. Prioritize high-severity findings\n';
        markdown += '3. Apply remediation patterns systematically\n';
        markdown += '4. Re-scan to verify improvements\n';
        markdown += '5. Update coding standards to prevent recurrence\n\n';
        
        return markdown;
    }

    /**
     * Apply remediations to files
     */
    async applyRemediations(scanResults) {
        for (const result of scanResults.results) {
            if (result.matches.length === 0) {
                continue;
            }
            
            try {
                await this.remediateFile(result);
                this.stats.filesModified++;
            } catch (error) {
                console.error(`❌ Failed to remediate ${result.file}:`, error);
                this.stats.errors.push(`Failed to remediate ${result.file}: ${error.message}`);
            }
        }
    }

    /**
     * Remediate a single file
     */
    async remediateFile(fileResult) {
        const filePath = fileResult.file;
        console.log(`🔧 Remediating ${filePath} (${fileResult.matches.length} findings)`);
        
        // Create backup if enabled
        if (this.options.backup) {
            const backupPath = `${filePath}.backup.${Date.now()}`;
            await fs.copyFile(filePath, backupPath);
        }
        
        // Read current content
        let content = await fs.readFile(filePath, 'utf8');
        let modified = false;
        
        // Apply remediations in reverse order to maintain line numbers
        const sortedMatches = fileResult.matches.sort((a, b) => b.index - a.index);
        
        for (const match of sortedMatches) {
            const remediation = RemediationHelper.generateRemediationCode(match);
            
            // Replace the problematic pattern with remediation
            const beforeContent = content;
            content = content.substring(0, match.index) + 
                      remediation + 
                      content.substring(match.index + match.match.length);
            
            if (content !== beforeContent) {
                modified = true;
                this.stats.findingsFixed++;
            }
        }
        
        // Write modified content back
        if (modified) {
            await fs.writeFile(filePath, content);
            console.log(`✅ Remediated ${filePath}`);
        }
        
        this.stats.filesProcessed++;
    }

    /**
     * Get priority level for category
     */
    getCategoryPriority(category) {
        const highPriority = ['test_databases', 'test_apis', 'hardcoded_values'];
        const mediumPriority = ['test_data', 'mock_functions', 'generic_placeholders'];
        
        if (highPriority.includes(category)) {
            return 'High';
        }
        if (mediumPriority.includes(category)) {
            return 'Medium';
        }
        return 'Low';
    }

    /**
     * Ensure directory exists
     */
    async ensureDirectory(dirPath) {
        try {
            await fs.mkdir(dirPath, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    /**
     * Print execution summary
     */
    printSummary() {
        console.log('\n📊 Remediation Summary\n');
        console.log(`📁 Files Processed: ${this.stats.filesProcessed}`);
        console.log(`📝 Files Modified: ${this.stats.filesModified}`);
        console.log(`🎯 Total Findings: ${this.stats.totalFindings}`);
        console.log(`✅ Findings Fixed: ${this.stats.findingsFixed}`);
        
        if (this.stats.errors.length > 0) {
            console.log(`\n❌ Errors (${this.stats.errors.length}):`);
            this.stats.errors.forEach(error => console.log(`  - ${error}`));
        }
        
        console.log(`\n📄 Reports available in: ${this.options.outputDir}`);
        
        if (!this.options.dryRun) {
            console.log('\n💡 Next steps:');
            console.log('1. Review the remediation reports');
            console.log('2. Test the modified files');
            console.log('3. Commit the changes');
            console.log('4. Update coding standards');
        }
    }
}

/**
 * CLI interface
 */
async function main() {
    const args = process.argv.slice(2);
    const options = {};
    
    // Parse command line arguments
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        switch (arg) {
        case '--dry-run':
            options.dryRun = true;
            break;
        case '--no-backup':
            options.backup = false;
            break;
        case '--verbose':
            options.verbose = true;
            break;
        case '--target':
            options.targetPath = args[++i];
            break;
        case '--output':
            options.outputDir = args[++i];
            break;
        case '--help':
            console.log(`
Mock Data Remediation Runner

Usage: node remediation-runner.js [options]

Options:
  --dry-run          Generate reports without modifying files
  --no-backup        Skip creating backup files
  --verbose          Show detailed progress
  --target <path>    Target directory to scan (default: ./)
  --output <path>    Output directory for reports (default: ./remediation-reports)
  --help             Show this help message

Examples:
  node remediation-runner.js --dry-run --target ./src
  node remediation-runner.js --verbose --output ./reports
                `);
            process.exit(0);
            break;
        }
    }
    
    const runner = new RemediationRunner(options);
    await runner.run();
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { RemediationRunner };
