/**
 * Run scanner and measure health score improvement
 */

const MockDataScanner = require('./mock_data_scanner.js');
const path = require('path');

const config = {
    excludeDirectories: ['remediation-backups', 'node_modules', 'dist', 'build', '.git', 'vendor', '__tests__', 'tests'],
    excludeExtensions: ['.pyc', '.exe', '.dll', '.so', '.bin', '.jpg', '.png', '.gif', '.pdf', '.zip', '.min.js', '.min.css'],
    maxFileSize: 10 * 1024 * 1024,
    confidenceThreshold: 0.7,
    enableContextAnalysis: true
};

const scanner = new MockDataScanner(config);

console.log('🔍 Scanning web/ directory for code quality issues...\n');

async function runScan() {
    try {
        const results = await scanner.scanDirectory(__dirname);
        
        console.log('\n📊 SCAN RESULTS');
        console.log('================');
        console.log(`Total Files Scanned: ${results.summary.totalFiles}`);
        console.log(`Files with Findings: ${results.summary.filesWithIssues}`);
        console.log(`Total Findings: ${results.summary.totalFindings}`);
        console.log(`Health Score: ${results.healthScore}/100`);
        console.log(`Status: ${results.healthScore >= 80 ? 'Good' : results.healthScore >= 60 ? 'Fair' : 'Needs Improvement'}`);
        
        console.log('\n📈 FINDINGS BY CATEGORY');
        console.log('========================');
        Object.entries(results.byCategory).forEach(([category, data]) => {
            console.log(`${category}: ${data.count} instances (confidence: ${(data.avgConfidence * 100).toFixed(1)}%)`);
        });
        
        console.log('\n🎯 TOP ISSUES BY CATEGORY');
        console.log('========================');
        Object.entries(results.byCategory).forEach(([category, data]) => {
            if (data.count > 0) {
                console.log(`\n${category} (${data.count} instances):`);
                data.instances.slice(0, 3).forEach(instance => {
                    console.log(`  - ${path.relative(__dirname, instance.file)}:${instance.line} - ${instance.value.substring(0, 50)}...`);
                });
            }
        });
        
        console.log('\n✅ Scan complete!');
        
    } catch (error) {
        console.error('❌ Error during scan:', error);
    }
}

runScan();
