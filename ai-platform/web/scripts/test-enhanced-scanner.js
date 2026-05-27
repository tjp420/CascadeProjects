// Test the enhanced mock data scanner against index.html
import fs from 'fs/promises';
import path from 'path';

import { MockDataScanner } from './web/modules/mock-data-scanner.js';

async function testEnhancedScanner() {
    console.log('🚀 Testing Enhanced Mock Data Scanner\n');
    console.log('=' .repeat(60));
    
    try {
        // Load the index.html file
        const indexPath = path.join(process.cwd(), 'web', 'index.html');
        const indexContent = await fs.readFile(indexPath, 'utf8');
        
        console.log(`📁 Loaded index.html`);
        console.log(`📊 File size: ${indexContent.length} characters`);
        console.log(`📊 Lines: ${indexContent.split('\n').length}`);
        
        // Create a mock file object
        const mockFile = {
            name: 'index.html',
            content: indexContent,
            size: indexContent.length,
            type: 'text/html'
        };
        
        // Initialize the enhanced scanner
        console.log('\n🔧 Initializing Enhanced Scanner...');
        const scanner = new MockDataScanner({
            confidenceThreshold: 0.5,
            enableContextAnalysis: true
        });
        
        console.log(`✅ Scanner initialized with ${scanner.patternMatcher.compiledPatterns?.length || 0} patterns`);
        
        // Test individual file scanning
        console.log('\n🔍 Scanning index.html...');
        const startTime = Date.now();
        
        const matches = scanner.scanContent(indexContent, 'index.html');
        
        const endTime = Date.now();
        const scanTime = endTime - startTime;
        
        console.log(`⏱️  Scan completed in ${scanTime}ms`);
        console.log(`🎯 Found ${matches.length} total matches`);
        
        if (matches.length > 0) {
            // Analyze matches by category
            const categoryCounts = {};
            const severityCounts = { high: 0, medium: 0, low: 0 };
            
            matches.forEach(match => {
                // Count by category
                categoryCounts[match.category] = (categoryCounts[match.category] || 0) + 1;
                
                // Count by severity
                const severity = scanner.calculateSeverity(match);
                severityCounts[severity]++;
            });
            
            console.log('\n📊 Results by Category:');
            Object.entries(categoryCounts)
                .sort(([,a], [,b]) => b - a)
                .forEach(([category, count]) => {
                    console.log(`  ${category}: ${count}`);
                });
            
            console.log('\n⚠️  Results by Severity:');
            console.log(`  High: ${severityCounts.high}`);
            console.log(`  Medium: ${severityCounts.medium}`);
            console.log(`  Low: ${severityCounts.low}`);
            
            // Show examples of high severity findings
            const highSeverityMatches = matches.filter(match => 
                scanner.calculateSeverity(match) === 'high'
            );
            
            if (highSeverityMatches.length > 0) {
                console.log('\n🚨 High Severity Examples (first 5):');
                highSeverityMatches.slice(0, 5).forEach((match, index) => {
                    const context = indexContent.substring(
                        Math.max(0, match.index - 50),
                        Math.min(indexContent.length, match.index + match.match.length + 50)
                    );
                    console.log(`  ${index + 1}. "${match.match}" (${match.category})`);
                    console.log(`     Context: ...${context.replace(/\n/g, '\\n')}...`);
                });
            }
            
            // Check for specific patterns we expect to find
            console.log('\n🔍 Checking for Expected Patterns:');
            
            const expectedPatterns = [
                { name: 'Coming soon text', pattern: /coming soon/gi },
                { name: 'Alert placeholders', pattern: /alert\([^)]*coming soon[^)]*\)/gi },
                { name: 'Mock report functions', pattern: /downloadMockReport|generateMockReport/gi },
                { name: 'TODO comments', pattern: /\/\/\s*TODO/gi },
                { name: 'FIXME comments', pattern: /\/\/\s*FIXME/gi },
                { name: 'Console.log', pattern: /console\.log/gi },
                { name: 'Mock data variables', pattern: /mockData|mock_data/gi }
            ];
            
            expectedPatterns.forEach(({ name, pattern }) => {
                const matches = indexContent.match(pattern);
                if (matches && matches.length > 0) {
                    console.log(`  ✅ ${name}: ${matches.length} found`);
                } else {
                    console.log(`  ❌ ${name}: 0 found`);
                }
            });
            
        } else {
            console.log('❌ No matches found - this seems unlikely for index.html');
            
            // Debug with basic patterns
            console.log('\n🔍 Debugging with basic patterns:');
            const debugPatterns = [
                { name: 'alert(', pattern: /alert\(/gi },
                { name: 'console.log', pattern: /console\.log/gi },
                { name: 'TODO', pattern: /TODO/gi },
                { name: 'mock', pattern: /mock/gi },
                { name: 'test', pattern: /test/gi }
            ];
            
            debugPatterns.forEach(({ name, pattern }) => {
                const matches = indexContent.match(pattern);
                if (matches && matches.length > 0) {
                    console.log(`  ${name}: ${matches.length} matches`);
                }
            });
        }
        
        // Test with a full scan (simulate multiple files)
        console.log('\n🚀 Testing Full Scan Simulation...');
        const testFiles = [mockFile];
        
        try {
            const report = await scanner.scanFiles(testFiles, (processed, total, fileName) => {
                console.log(`⏳ Progress: ${processed}/${total} - ${fileName}`);
            });
            
            console.log('\n📋 Full Scan Report:');
            console.log(`  Total Files: ${report.summary.totalFiles}`);
            console.log(`  Total Matches: ${report.summary.totalMatches}`);
            console.log(`  Files with Findings: ${report.summary.filesWithFindings}`);
            console.log(`  Health Score: ${report.summary.healthScore}/100 (${report.summary.healthGrade})`);
            console.log(`  Status: ${report.summary.healthStatus}`);
            
            if (report.recommendations && report.recommendations.length > 0) {
                console.log('\n💡 Recommendations:');
                report.recommendations.forEach(rec => {
                    console.log(`  • ${rec.title}: ${rec.description}`);
                });
            }
            
        } catch (error) {
            console.error('❌ Full scan failed:', error.message);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Stack:', error.stack);
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ Enhanced Scanner Test Complete!');
}

// Run the test
testEnhancedScanner().catch(console.error);
