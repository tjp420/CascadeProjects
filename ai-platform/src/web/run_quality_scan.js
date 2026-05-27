/**
 * Run Code Quality Scan
 * Executes the code quality scanner and generates a report
 */

import fs from 'fs';
import path from 'path';

import CodeQualityScanner from './code_quality_scanner.js';

async function main() {
    console.log('🔍 Starting Code Quality Scan...');
    console.log('=====================================');

    const scanner = new CodeQualityScanner();
    const webDir = process.cwd();
    
    console.log(`Scanning directory: ${webDir}`);
    
    try {
        // Test scanner creation
        console.log('Scanner created successfully');
        
        // Test directory scan
        const files = scanner.getAllFiles(webDir);
        console.log(`Found ${files.length} files to scan`);
        
        const report = await scanner.scanDirectory(webDir);
        
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
        
        // Show recommendations
        console.log('\n💡 RECOMMENDATIONS');
        console.log('==================');
        report.recommendations.forEach(rec => {
            console.log(`\n${rec.category} (${rec.priority} Priority):`);
            console.log(`  Action: ${rec.action}`);
            console.log(`  Count: ${rec.count}`);
            if (rec.examples.length > 0) {
                console.log(`  Examples: ${rec.examples.join(', ')}`);
            }
        });
        
        // Save detailed report
        const reportPath = path.join(process.cwd(), 'quality_scan_report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n📄 Detailed report saved to: ${reportPath}`);
        
        // Generate summary for tracking
        const summaryPath = path.join(process.cwd(), 'quality_scan_summary.md');
        const summaryContent = generateMarkdownSummary(report);
        fs.writeFileSync(summaryPath, summaryContent);
        console.log(`📋 Summary report saved to: ${summaryPath}`);
        
        console.log('\n✅ Code Quality Scan Complete!');
        
    } catch (error) {
        console.error('❌ Error during scan:', error);
        process.exit(1);
    }
}

function generateMarkdownSummary(report) {
    return `# Code Quality Scan Report

Generated: ${new Date().toISOString()}

## Summary
- **Files Scanned:** ${report.summary.totalFiles}
- **Files with Findings:** ${report.summary.filesWithIssues}
- **Total Findings:** ${report.summary.totalFindings}

## Findings by Category

### Hardcoded Percentages: ${report.findings.hardcodedPercentages.count} instances
${report.findings.hardcodedPercentages.instances.slice(0, 10).map(issue => 
        `- \`${path.relative('web', issue.file)}:${issue.line}\` - ${issue.value}`
    ).join('\n')}

### Placeholder Text: ${report.findings.placeholderText.count} instances
${report.findings.placeholderText.instances.slice(0, 10).map(issue => 
        `- \`${path.relative('web', issue.file)}:${issue.line}\` - ${issue.value}`
    ).join('\n')}

### TODO Comments: ${report.findings.todoComments.count} instances
${report.findings.todoComments.instances.slice(0, 10).map(issue => 
        `- \`${path.relative('web', issue.file)}:${issue.line}\` - ${issue.value}`
    ).join('\n')}

## Recommendations

${report.recommendations.map(rec => 
        `### ${rec.category} (${rec.priority} Priority)
- **Action:** ${rec.action}
- **Count:** ${rec.count}
- **Examples:** ${rec.examples.join(', ')}
`
    ).join('\n')}

## Next Steps

1. Replace hardcoded percentages with constants from \`config/constants.js\`
2. Remove placeholder text and replace with meaningful content
3. Review and categorize TODO comments
4. Implement automated scanning in CI/CD pipeline
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
