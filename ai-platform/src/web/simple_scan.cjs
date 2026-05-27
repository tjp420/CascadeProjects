/**
 * Simple Code Quality Scan
 * Direct implementation without complex dependencies
 */

const fs = require('fs');
const path = require('path');

class SimpleScanner {
    constructor() {
        this.issues = {
            hardcodedPercentages: [],
            placeholderText: [],
            todoComments: []
        };
        this.scanResults = {
            totalFiles: 0,
            filesWithIssues: 0,
            totalFindings: 0
        };
    }

    getAllFiles(dirPath, extensions = ['.js', '.html', '.css', '.py', '.md']) {
        let files = [];
        
        try {
            const items = fs.readdirSync(dirPath);
            
            for (const item of items) {
                const fullPath = path.join(dirPath, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                    files = files.concat(this.getAllFiles(fullPath, extensions));
                } else if (stat.isFile() && extensions.includes(path.extname(item))) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            console.error(`Error scanning directory ${dirPath}:`, error.message);
        }
        
        return files;
    }

    scanFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            let fileHasIssues = false;

            // Scan for hardcoded percentages
            const percentageRegex = /\b(\d+(\.\d+)?%|\d+(\.\d+)?\s*%)\b/g;
            lines.forEach((line, index) => {
                const matches = line.match(percentageRegex);
                if (matches) {
                    matches.forEach(match => {
                        this.issues.hardcodedPercentages.push({
                            file: filePath,
                            line: index + 1,
                            content: line.trim(),
                            value: match
                        });
                        fileHasIssues = true;
                    });
                }
            });

            // Scan for placeholder text
            const placeholderRegex = /\b(Lorem ipsum|Sample data|Sample Data|sample data|lorem ipsum)\b/gi;
            lines.forEach((line, index) => {
                const matches = line.match(placeholderRegex);
                if (matches) {
                    matches.forEach(match => {
                        this.issues.placeholderText.push({
                            file: filePath,
                            line: index + 1,
                            content: line.trim(),
                            value: match
                        });
                        fileHasIssues = true;
                    });
                }
            });

            // Scan for TODO comments
            const todoRegex = /\b(TODO|FIXME|HACK|XXX|NOTE|BUG)\b.*/gi;
            lines.forEach((line, index) => {
                const matches = line.match(todoRegex);
                if (matches) {
                    matches.forEach(match => {
                        this.issues.todoComments.push({
                            file: filePath,
                            line: index + 1,
                            content: line.trim(),
                            value: match.trim()
                        });
                        fileHasIssues = true;
                    });
                }
            });

            if (fileHasIssues) {
                this.scanResults.filesWithIssues++;
            }

        } catch (error) {
            console.error(`Error scanning file ${filePath}:`, error.message);
        }
    }

    scanDirectory(dirPath) {
        const files = this.getAllFiles(dirPath);
        this.scanResults.totalFiles = files.length;

        console.log(`Scanning ${files.length} files...`);

        for (const filePath of files) {
            this.scanFile(filePath);
        }

        return this.generateReport();
    }

    generateReport() {
        const totalFindings = this.issues.hardcodedPercentages.length + 
                            this.issues.placeholderText.length + 
                            this.issues.todoComments.length;
        
        this.scanResults.totalFindings = totalFindings;

        return {
            summary: this.scanResults,
            findings: {
                hardcodedPercentages: {
                    count: this.issues.hardcodedPercentages.length,
                    instances: this.issues.hardcodedPercentages
                },
                placeholderText: {
                    count: this.issues.placeholderText.length,
                    instances: this.issues.placeholderText
                },
                todoComments: {
                    count: this.issues.todoComments.length,
                    instances: this.issues.todoComments
                }
            }
        };
    }
}

// Run the scan
async function main() {
    console.log('🔍 Starting Simple Code Quality Scan...');
    console.log('=====================================');

    const scanner = new SimpleScanner();
    const webDir = process.cwd();
    
    console.log(`Scanning directory: ${webDir}`);
    
    try {
        const report = scanner.scanDirectory(webDir);
        
        // Display summary
        console.log('\n📊 SCAN RESULTS SUMMARY');
        console.log('========================');
        console.log(`Files Scanned: ${report.summary.totalFiles}`);
        console.log(`Files with Findings: ${report.summary.filesWithIssues}`);
        console.log(`Total Findings: ${report.summary.totalFindings}`);
        
        console.log('\n📈 FINDINGS BY CATEGORY');
        console.log('========================');
        console.log(`Hardcoded Percentages: ${report.findings.hardcodedPercentages.count} instances`);
        console.log(`Placeholder Text: ${report.findings.placeholderText.count} instances`);
        console.log(`TODO Comments: ${report.findings.todoComments.count} instances`);
        
        // Show top issues
        console.log('\n🔍 TOP ISSUES BY CATEGORY');
        console.log('========================');
        
        if (report.findings.hardcodedPercentages.count > 0) {
            console.log('\nHardcoded Percentages:');
            report.findings.hardcodedPercentages.instances.slice(0, 5).forEach(issue => {
                console.log(`  ${path.relative(webDir, issue.file)}:${issue.line} - ${issue.value}`);
            });
        }
        
        if (report.findings.placeholderText.count > 0) {
            console.log('\nPlaceholder Text:');
            report.findings.placeholderText.instances.slice(0, 5).forEach(issue => {
                console.log(`  ${path.relative(webDir, issue.file)}:${issue.line} - ${issue.value}`);
            });
        }
        
        if (report.findings.todoComments.count > 0) {
            console.log('\nTODO Comments:');
            report.findings.todoComments.instances.slice(0, 5).forEach(issue => {
                console.log(`  ${path.relative(webDir, issue.file)}:${issue.line} - ${issue.value}`);
            });
        }
        
        // Save detailed report
        const reportPath = path.join(process.cwd(), 'quality_scan_report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n📄 Detailed report saved to: ${reportPath}`);
        
        console.log('\n✅ Code Quality Scan Complete!');
        
    } catch (error) {
        console.error('❌ Error during scan:', error);
        process.exit(1);
    }
}

main();
