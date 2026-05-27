
/**
 * Mock Data Scanner CLI
 * Command-line interface for scanning mock data issues
 */

import fs from 'fs/promises';
import path from 'path';

import { MockDataScanner } from '../modules/mock-data-scanner.js';

/**
 * CLI Scanner class
 */
class MockDataScannerCLI {
    constructor(options = {}) {
        this.options = {
            targetPath: options.targetPath || './',
            outputPath: options.outputPath || './mock-scan-results',
            format: options.format || 'json',
            verbose: options.verbose || false,
            healthCheck: options.healthCheck || false,
            threshold: options.threshold || 0.7
        };
        this.scanner = new MockDataScanner({
            confidenceThreshold: this.options.threshold
        });
    }

    /**
     * Run the scanner
     */
    async run() {
        console.log('🔍 Mock Data Scanner v1.0.0');
        console.log(`📁 Target: ${this.options.targetPath}`);
        
        try {
            // Get files to scan
            const files = await this.getTestFiles(this.options.targetPath);
            console.log(`📊 Found ${files.length} test files`);
            
            // Scan files
            const results = await this.scanner.scanFiles(files, (current, total, filename) => {
                if (this.options.verbose) {
                    console.log(`🔍 Scanning ${current}/${total}: ${filename}`);
                }
            });
            
            // Output results
            await this.outputResults(results);
            
            // Health check if requested
            if (this.options.healthCheck) {
                await this.performHealthCheck(results);
            }
            
            // Exit with appropriate code
            process.exit(results.summary.healthScore < 50 ? 1 : 0);
            
        } catch (error) {
            console.error('❌ Scan failed:', error.message);
            process.exit(1);
        }
    }

    /**
     * Get test files from directory
     */
    async getTestFiles(dirPath) {
        const files = [];
        
        async function traverse(currentPath) {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                
                if (entry.isDirectory()) {
                    if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
                        await traverse(fullPath);
                    }
                } else if (entry.isFile()) {
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
     * Output scan results
     */
    async outputResults(results) {
        await fs.mkdir(this.options.outputPath, { recursive: true });
        
        if (this.options.format === 'json') {
            await this.outputJson(results);
        } else if (this.options.format === 'markdown') {
            await this.outputMarkdown(results);
        } else {
            await this.outputConsole(results);
        }
        
        console.log(`📄 Results saved to ${this.options.outputPath}`);
    }

    /**
     * Output JSON results
     */
    async outputJson(results) {
        const jsonPath = path.join(this.options.outputPath, 'scan-results.json');
        await fs.writeFile(jsonPath, JSON.stringify(results, null, 2));
    }

    /**
     * Output Markdown results
     */
    async outputMarkdown(results) {
        const mdPath = path.join(this.options.outputPath, 'scan-results.md');
        const markdown = this.generateMarkdownReport(results);
        await fs.writeFile(mdPath, markdown);
    }

    /**
     * Output to console
     */
    async outputConsole(results) {
        console.log('\n📊 Scan Results Summary\n');
        console.log(`📁 Files Scanned: ${results.summary.totalFiles}`);
        console.log(`📝 Files with Findings: ${results.summary.filesWithMatches}`);
        console.log(`🎯 Total Findings: ${results.summary.totalMatches}`);
        console.log(`💚 Health Score: ${results.summary.healthScore}% (${results.summary.healthGrade})`);
        console.log(`📈 Health Status: ${results.summary.healthStatus}\n`);
        
        console.log('📋 Findings by Category:');
        results.categories.forEach(cat => {
            console.log(`  ${cat.category}: ${cat.count}`);
        });
        
        console.log('\n🔥 Severity Breakdown:');
        console.log(`  High: ${results.severity.high}`);
        console.log(`  Medium: ${results.severity.medium}`);
        console.log(`  Low: ${results.severity.low}`);
        
        console.log('\n📁 Top Files with Most Findings:');
        results.topFiles.slice(0, 10).forEach((file, index) => {
            console.log(`  ${index + 1}. ${file.file}: ${file.matchCount} findings`);
        });
    }

    /**
     * Generate markdown report
     */
    generateMarkdownReport(results) {
        let markdown = '# Mock Data Scan Report\n\n';
        markdown += `**Generated:** ${new Date().toLocaleString()}\n`;
        markdown += `**Target:** ${this.options.targetPath}\n\n`;
        
        markdown += '## Summary\n\n';
        markdown += `- **Files Scanned:** ${results.summary.totalFiles}\n`;
        markdown += `- **Files with Findings:** ${results.summary.filesWithMatches}\n`;
        markdown += `- **Total Findings:** ${results.summary.totalMatches}\n`;
        markdown += `- **Health Score:** ${results.summary.healthScore}% (${results.summary.healthGrade})\n`;
        markdown += `- **Health Status:** ${results.summary.healthStatus}\n\n`;
        
        markdown += '## Severity Breakdown\n\n';
        markdown += '| Severity | Count |\n';
        markdown += '|----------|-------|\n';
        markdown += `| High | ${results.severity.high} |\n`;
        markdown += `| Medium | ${results.severity.medium} |\n`;
        markdown += `| Low | ${results.severity.low} |\n\n`;
        
        markdown += '## Findings by Category\n\n';
        markdown += '| Category | Count |\n';
        markdown += '|----------|-------|\n';
        results.categories.forEach(cat => {
            markdown += `| ${cat.category} | ${cat.count} |\n`;
        });
        
        markdown += '\n## Top Files\n\n';
        markdown += '| File | Findings | High Severity |\n';
        markdown += '|------|----------|---------------|\n';
        results.topFiles.slice(0, 20).forEach(file => {
            markdown += `| ${file.file} | ${file.matchCount} | ${file.highSeverityCount} |\n`;
        });
        
        return markdown;
    }

    /**
     * Perform health check
     */
    async performHealthCheck(results) {
        console.log('\n🏥 Health Check Results\n');
        
        const healthScore = results.summary.healthScore;
        const status = results.summary.healthStatus;
        
        if (healthScore >= 80) {
            console.log('✅ Excellent mock data health');
        } else if (healthScore >= 60) {
            console.log('⚠️ Good mock data health with room for improvement');
        } else if (healthScore >= 40) {
            console.log('❌ Poor mock data health - remediation recommended');
        } else {
            console.log('🚨 Critical mock data health - immediate action required');
        }
        
        console.log(`\n📊 Health Score: ${healthScore}%`);
        console.log(`📈 Status: ${status}`);
        
        // Recommendations
        console.log('\n💡 Recommendations:');
        
        if (results.severity.high > 0) {
            console.log('- Address high severity findings immediately');
        }
        
        if (results.summary.totalMatches > 100) {
            console.log('- Consider systematic remediation approach');
        }
        
        if (healthScore < 50) {
            console.log('- Run automated remediation: npm run mock:remediate:dry-run');
        }
        
        if (results.categories.find(c => c.category === 'test_databases' && c.count > 5)) {
            console.log('- Review database connection patterns');
        }
        
        if (results.categories.find(c => c.category === 'test_apis' && c.count > 10)) {
            console.log('- Implement API mocking strategies');
        }
    }
}

/**
 * CLI interface
 */
async function main() {
    const args = process.argv.slice(2);
    const options = {};
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        switch (arg) {
        case '--target':
            options.targetPath = args[++i];
            break;
        case '--output':
            options.outputPath = args[++i];
            break;
        case '--format':
            options.format = args[++i];
            break;
        case '--verbose':
            options.verbose = true;
            break;
        case '--health-check':
            options.healthCheck = true;
            break;
        case '--threshold':
            options.threshold = parseFloat(args[++i]);
            break;
        case '--dry-run':
            options.dryRun = true;
            break;
        case '--help':
            console.log(`
Mock Data Scanner CLI

Usage: node mock-data-scanner.js [options]

Options:
  --target <path>        Target directory to scan (default: ./)
  --output <path>        Output directory for results (default: ./mock-scan-results)
  --format <format>      Output format: json, markdown, console (default: json)
  --verbose              Show detailed progress
  --health-check         Perform health check analysis
  --threshold <number>   Confidence threshold (default: 0.7)
  --dry-run              Preview scan without saving results
  --help                 Show this help message

Examples:
  node mock-data-scanner.js --target ./src --health-check
  node mock-data-scanner.js --format markdown --verbose
  node mock-data-scanner.js --dry-run --threshold 0.8
                `);
            process.exit(0);
            break;
        }
    }
    
    const scanner = new MockDataScannerCLI(options);
    await scanner.run();
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { MockDataScannerCLI };
