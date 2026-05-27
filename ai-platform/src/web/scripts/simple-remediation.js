
/**
 * Simple Mock Data Remediation Script
 * Basic implementation to test remediation functionality
 */

import fs from 'fs/promises';
import path from 'path';

import { MockDataScanner } from '../modules/mock-data-scanner.js';

async function runSimpleRemediation() {
    console.log('🔍 Starting simple mock data remediation...');
    
    try {
        // Initialize scanner
        const scanner = new MockDataScanner();
        console.log('✅ Scanner initialized');
        
        // Get test files
        const files = await getTestFiles('./');
        console.log(`📁 Found ${files.length} test files`);
        
        // Scan first 5 files for testing
        const testFiles = files.slice(0, 5);
        console.log(`🔍 Testing with ${testFiles.length} files`);
        
        const results = await scanner.scanFiles(testFiles, (current, total, filename) => {
            console.log(`📊 Scanning ${current}/${total}: ${filename}`);
        });
        
        console.log('\n📊 Scan Results:');
        console.log(`📁 Files Scanned: ${results.summary.totalFiles}`);
        console.log(`🎯 Total Findings: ${results.summary.totalMatches}`);
        console.log(`💚 Health Score: ${results.summary.healthScore}%`);
        
        // Show top findings
        console.log('\n🔍 Top Findings:');
        results.topFiles.slice(0, 3).forEach((file, index) => {
            console.log(`  ${index + 1}. ${file.file}: ${file.matchCount} findings`);
        });
        
        // Generate basic report
        const reportPath = './simple-remediation-report.json';
        await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
        console.log(`\n📄 Report saved to: ${reportPath}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

async function getTestFiles(dirPath) {
    const files = [];
    
    async function traverse(currentPath) {
        try {
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
                            console.warn(`⚠️ Could not read file: ${fullPath}`);
                        }
                    }
                }
            }
        } catch (error) {
            console.warn(`⚠️ Could not access directory: ${currentPath}`);
        }
    }
    
    await traverse(dirPath);
    return files;
}

// Run the script
runSimpleRemediation();
