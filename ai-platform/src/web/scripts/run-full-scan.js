
/**
 * Full Mock Data Scan
 * Run complete scan and generate comprehensive report
 */

import fs from 'fs/promises';
import path from 'path';

import { MockDataScanner } from '../modules/mock-data-scanner.js';

async function runFullScan() {
    console.log('🔍 Starting full mock data scan...');
    
    try {
        // Initialize scanner
        const scanner = new MockDataScanner({
            confidenceThreshold: 0.7
        });
        console.log('✅ Scanner initialized');
        
        // Get all test files
        const files = await getTestFiles('./');
        console.log(`📁 Found ${files.length} test files`);
        
        // Run full scan
        const results = await scanner.scanFiles(files, (current, total, filename) => {
            if (current % 100 === 0 || current === total) {
                console.log(`📊 Progress: ${current}/${total} files scanned (${Math.round(current/total*100)}%)`);
            }
        });
        
        // Display results
        console.log('\n📊 FULL SCAN RESULTS\n');
        console.log(`📁 Files Scanned: ${results.summary.totalFiles}`);
        console.log(`📝 Files with Findings: ${results.summary.filesWithMatches}`);
        console.log(`🎯 Total Findings: ${results.summary.totalMatches}`);
        console.log(`💚 Health Score: ${results.summary.healthScore}% (${results.summary.healthGrade})`);
        console.log(`📈 Health Status: ${results.summary.healthStatus}\n`);
        
        console.log('🔥 Severity Breakdown:');
        console.log(`  High: ${results.severity.high} 🔴`);
        console.log(`  Medium: ${results.severity.medium} 🟡`);
        console.log(`  Low: ${results.severity.low} 🟢\n`);
        
        console.log('📋 Top 10 Files with Most Findings:');
        results.topFiles.slice(0, 10).forEach((file, index) => {
            const severity = file.highSeverityCount > 0 ? '🔴' : '🟡';
            console.log(`  ${index + 1}. ${file.file}: ${file.matchCount} findings ${severity}`);
        });
        
        console.log('\n📊 Findings by Category:');
        results.categories.forEach(cat => {
            const icon = getCategoryIcon(cat.category);
            console.log(`  ${icon} ${cat.category}: ${cat.count}`);
        });
        
        // Health check analysis
        console.log('\n🏥 HEALTH CHECK ANALYSIS\n');
        const healthScore = results.summary.healthScore;
        
        if (healthScore >= 80) {
            console.log('✅ Excellent mock data health');
        } else if (healthScore >= 60) {
            console.log('⚠️ Good mock data health with room for improvement');
        } else if (healthScore >= 40) {
            console.log('❌ Poor mock data health - remediation recommended');
        } else {
            console.log('🚨 Critical mock data health - immediate action required');
        }
        
        // Recommendations
        console.log('\n💡 RECOMMENDATIONS\n');
        
        if (results.severity.high > 0) {
            console.log(`🔴 URGENT: Address ${results.severity.high} high-severity findings immediately`);
        }
        
        if (results.summary.totalMatches > 1000) {
            console.log('📊 Consider systematic remediation approach (npm run mock:remediate:dry-run)');
        }
        
        if (healthScore < 50) {
            console.log('🚨 Critical health score - run automated remediation immediately');
        }
        
        // Category-specific recommendations
        const testEmailsCat = results.categories.find(c => c.category === 'test_emails');
        if (testEmailsCat && testEmailsCat.count > 50) {
            console.log('📧 High number of test emails - implement email generators');
        }
        
        const testDataCat = results.categories.find(c => c.category === 'test_data');
        if (testDataCat && testDataCat.count > 200) {
            console.log('📋 Extensive test data - create centralized fixtures');
        }
        
        const mockFunctionsCat = results.categories.find(c => c.category === 'mock_functions');
        if (mockFunctionsCat && mockFunctionsCat.count > 100) {
            console.log('🎭 Many mock functions - standardize with MockFactory');
        }
        
        // Save detailed report
        const reportPath = './full-scan-report.json';
        await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
        console.log(`\n📄 Detailed report saved to: ${reportPath}`);
        
        // Exit with appropriate code
        if (healthScore < 50) {
            console.log('\n🚨 EXIT CODE 1: Critical health score requires immediate attention');
            process.exit(1);
        } else if (healthScore < 70) {
            console.log('\n⚠️ EXIT CODE 2: Health score needs improvement');
            process.exit(2);
        } else {
            console.log('\n✅ EXIT CODE 0: Health score is acceptable');
            process.exit(0);
        }
        
    } catch (error) {
        console.error('❌ Scan failed:', error.message);
        console.error('Stack:', error.stack);
        process.exit(3);
    }
}

function getCategoryIcon(category) {
    const icons = {
        'test_data': '📋',
        'mock_functions': '🎭',
        'test_emails': '📧',
        'test_phones': '📱',
        'test_databases': '🗄️',
        'test_apis': '🌐',
        'test_urls': '🔗',
        'hardcoded_values': '⌨️',
        'generic_placeholders': '📝',
        'development_patterns': '🛠️'
    };
    return icons[category] || '📁';
}

async function getTestFiles(dirPath) {
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
                            // Skip files that can't be read
                        }
                    }
                }
            }
        } catch (error) {
            // Skip directories that can't be accessed
        }
    }
    
    await traverse(dirPath);
    return files;
}

// Run the full scan
runFullScan();
