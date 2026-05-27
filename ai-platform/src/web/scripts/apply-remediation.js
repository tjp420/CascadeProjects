
/**
 * Apply Mock Data Remediation
 * Automated remediation script with dry-run and execution modes
 */

import fs from 'fs/promises';
import path from 'path';

import { MockDataScanner } from '../modules/mock-data-scanner.js';

class RemediationApplier {
    constructor(options = {}) {
        this.options = {
            dryRun: options.dryRun || false,
            backup: options.backup !== false,
            targetPath: options.targetPath || './',
            outputDir: options.outputDir || './remediation-results'
        };
        this.stats = {
            filesProcessed: 0,
            filesModified: 0,
            totalFindings: 0,
            findingsFixed: 0,
            errors: []
        };
    }

    async run() {
        console.log('🔧 Starting mock data remediation...');
        console.log(`📁 Target: ${this.options.targetPath}`);
        console.log(`🔍 Dry run: ${this.options.dryRun}`);
        console.log(`💾 Backup: ${this.options.backup}\n`);
        
        try {
            // Ensure output directory
            await fs.mkdir(this.options.outputDir, { recursive: true });
            
            // Scan for issues
            console.log('🔍 Scanning for mock data issues...');
            const scanResults = await this.scanFiles();
            
            // Apply remediations
            console.log('\n🔧 Applying remediations...');
            await this.applyRemediations(scanResults);
            
            // Generate report
            await this.generateReport(scanResults);
            
            // Print summary
            this.printSummary();
            
        } catch (error) {
            console.error('❌ Remediation failed:', error.message);
            this.stats.errors.push(error.message);
        }
    }

    async scanFiles() {
        const scanner = new MockDataScanner();
        const files = await this.getTestFiles(this.options.targetPath);
        
        console.log(`📁 Found ${files.length} test files`);
        
        const results = await scanner.scanFiles(files, (current, total, filename) => {
            if (current % 50 === 0 || current === total) {
                console.log(`📊 Scanning: ${current}/${total} (${Math.round(current/total*100)}%)`);
            }
        });
        
        this.stats.totalFindings = results.summary.totalMatches;
        console.log(`🎯 Found ${this.stats.totalFindings} issues`);
        
        return results;
    }

    async applyRemediations(scanResults) {
        for (const result of scanResults.results) {
            if (result.matches.length === 0) {
                continue;
            }
            
            try {
                await this.remediateFile(result);
                this.stats.filesModified++;
            } catch (error) {
                console.error(`❌ Failed to remediate ${result.file}:`, error.message);
                this.stats.errors.push(`Failed to remediate ${result.file}: ${error.message}`);
            }
        }
    }

    async remediateFile(fileResult) {
        const filePath = fileResult.file;
        const matches = fileResult.matches;
        
        console.log(`🔧 Processing ${filePath} (${matches.length} findings)`);
        
        if (this.options.dryRun) {
            console.log(`  📋 Dry run: Would remediate ${matches.length} findings`);
            this.stats.findingsFixed += matches.length;
            this.stats.filesProcessed++;
            return;
        }
        
        // Create backup
        if (this.options.backup) {
            const backupPath = `${filePath}.backup.${Date.now()}`;
            await fs.copyFile(filePath, backupPath);
            console.log(`  💾 Backup created: ${backupPath}`);
        }
        
        // Read file content
        let content = await fs.readFile(filePath, 'utf8');
        let modified = false;
        
        // Apply remediations in reverse order
        const sortedMatches = matches.sort((a, b) => b.index - a.index);
        
        for (const match of sortedMatches) {
            const remediation = this.generateRemediation(match);
            
            const beforeContent = content;
            content = content.substring(0, match.index) + 
                      remediation + 
                      content.substring(match.index + match.match.length);
            
            if (content !== beforeContent) {
                modified = true;
                this.stats.findingsFixed++;
            }
        }
        
        // Write back if modified
        if (modified) {
            await fs.writeFile(filePath, content);
            console.log(`  ✅ Remediated ${filePath}`);
        } else {
            console.log(`  ℹ️ No changes needed for ${filePath}`);
        }
        
        this.stats.filesProcessed++;
    }

    generateRemediation(match) {
        const remediationPatterns = {
            'test_data': () => {
                if (match.match.includes('test') || match.match.includes('mock')) {
                    return 'generateTestUser()';
                }
                return 'generateTestData()';
            },
            'test_emails': () => {
                return 'generateTestEmail()';
            },
            'test_phones': () => {
                return 'generateTestPhone()';
            },
            'mock_functions': () => {
                if (match.match.includes('jest.fn')) {
                    return 'MockFactory.createMockFunction()';
                }
                return 'createMock()';
            },
            'generic_placeholders': () => {
                return 'generateTestData()';
            }
        };
        
        const pattern = remediationPatterns[match.category];
        return pattern ? pattern() : match.match;
    }

    async getTestFiles(dirPath) {
        const files = [];
        
        async function traverse(currentPath) {
            try {
                const entries = await fs.readdir(currentPath, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(currentPath, entry.name);
                    
                    if (entry.isDirectory()) {
                        if (!['node_modules', '.git', 'dist', 'build', 'coverage', '__pycache__'].includes(entry.name)) {
                            await traverse(fullPath);
                        }
                    } else if (entry.isFile()) {
                        const ext = path.extname(entry.name).toLowerCase();
                        const name = entry.name.toLowerCase();
                        
                        if (['.js', '.ts', '.py', '.java', '.cs', '.rb', '.php'].includes(ext) &&
                            (name.includes('test') || name.includes('spec'))) {
                            try {
                                const content = await fs.readFile(fullPath, 'utf8');
                                files.push({
                                    name: entry.name,
                                    path: fullPath,
                                    content: content,
                                    size: content.length,
                                    type: ext,
                                    lastModified: (await fs.stat(fullPath)).mtime
                                });
                            } catch (fileError) {
                                // Skip unreadable files
                            }
                        }
                    }
                }
            } catch (error) {
                // Skip inaccessible directories
            }
        }
        
        await traverse(dirPath);
        return files;
    }

    async generateReport(scanResults) {
        const report = {
            timestamp: new Date().toISOString(),
            options: this.options,
            scanResults,
            remediationStats: this.stats,
            recommendations: this.generateRecommendations()
        };
        
        const reportPath = path.join(this.options.outputDir, 'remediation-report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`📄 Report saved to: ${reportPath}`);
    }

    generateRecommendations() {
        const recommendations = [];
        
        if (this.stats.findingsFixed > 0) {
            recommendations.push('Add import statements for test data generators');
            recommendations.push('Run tests to verify remediation worked correctly');
            recommendations.push('Commit changes with descriptive message');
        }
        
        if (this.stats.errors.length > 0) {
            recommendations.push('Review and manually fix files that failed automated remediation');
        }
        
        if (this.stats.findingsFixed < this.stats.totalFindings) {
            recommendations.push('Run additional remediation passes for remaining issues');
        }
        
        return recommendations;
    }

    printSummary() {
        console.log('\n📊 REMEDIATION SUMMARY\n');
        console.log(`📁 Files Processed: ${this.stats.filesProcessed}`);
        console.log(`📝 Files Modified: ${this.stats.filesModified}`);
        console.log(`🎯 Total Findings: ${this.stats.totalFindings}`);
        console.log(`✅ Findings Fixed: ${this.stats.findingsFixed}`);
        console.log(`📈 Fix Rate: ${Math.round(this.stats.findingsFixed / this.stats.totalFindings * 100)}%`);
        
        if (this.stats.errors.length > 0) {
            console.log(`\n❌ Errors (${this.stats.errors.length}):`);
            this.stats.errors.slice(0, 5).forEach(error => {
                console.log(`  - ${error}`);
            });
            if (this.stats.errors.length > 5) {
                console.log(`  ... and ${this.stats.errors.length - 5} more`);
            }
        }
        
        if (this.options.dryRun) {
            console.log('\n🔍 DRY RUN COMPLETED - No files were modified');
            console.log('💡 Run without --dry-run to apply changes');
        } else {
            console.log('\n✅ REMEDIATION COMPLETED');
            console.log('💡 Next steps: npm test to verify changes');
        }
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const options = {};
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        switch (arg) {
        case '--dry-run':
            options.dryRun = true;
            break;
        case '--no-backup':
            options.backup = false;
            break;
        case '--target':
            options.targetPath = args[++i];
            break;
        case '--output':
            options.outputDir = args[++i];
            break;
        case '--help':
            console.log(`
Mock Data Remediation Applier

Usage: node apply-remediation.js [options]

Options:
  --dry-run          Preview changes without modifying files
  --no-backup        Skip creating backup files
  --target <path>    Target directory (default: ./)
  --output <path>    Output directory (default: ./remediation-results)
  --help             Show this help message

Examples:
  node apply-remediation.js --dry-run
  node apply-remediation.js --target ./src
                `);
            process.exit(0);
            break;
        }
    }
    
    const applier = new RemediationApplier(options);
    await applier.run();
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { RemediationApplier };
