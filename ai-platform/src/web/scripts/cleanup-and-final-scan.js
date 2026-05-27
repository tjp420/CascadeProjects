
/**
 * Cleanup Backup Files and Final Scan
 * Organize backups and run accurate final assessment
 */

import fs from 'fs/promises';
import path from 'path';

import { MockDataScanner } from '../modules/mock-data-scanner.js';

class CleanupAndFinalScan {
    constructor() {
        this.stats = {
            backupsMoved: 0,
            filesScanned: 0,
            totalFindings: 0,
            remediationImpact: {}
        };
    }

    async run() {
        console.log('🧹 Starting Backup Cleanup and Final Scan\n');
        
        try {
            // Phase 1: Organize backup files
            await this.organizeBackups();
            
            // Phase 2: Run clean scan
            await this.runCleanScan();
            
            // Phase 3: Generate final report
            await this.generateFinalReport();
            
            this.printSummary();
            
        } catch (error) {
            console.error('❌ Cleanup failed:', error.message);
        }
    }

    async organizeBackups() {
        console.log('📁 Organizing backup files...');
        
        // Create backup directory
        const backupDir = './remediation-backups';
        await fs.mkdir(backupDir, { recursive: true });
        console.log(`✅ Created backup directory: ${backupDir}`);
        
        // Find and move backup files
        const backups = await this.findBackupFiles('./');
        console.log(`🔍 Found ${backups.length} backup files`);
        
        for (const backup of backups) {
            try {
                const fileName = path.basename(backup);
                const targetPath = path.join(backupDir, fileName);
                
                await fs.rename(backup, targetPath);
                this.stats.backupsMoved++;
                
                console.log(`  📦 Moved: ${fileName}`);
            } catch (error) {
                console.warn(`  ⚠️ Could not move ${backup}: ${error.message}`);
            }
        }
        
        console.log(`✅ Moved ${this.stats.backupsMoved} backup files`);
    }

    async findBackupFiles(dirPath) {
        const backups = [];
        
        async function traverse(currentPath) {
            try {
                const entries = await fs.readdir(currentPath, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(currentPath, entry.name);
                    
                    if (entry.isFile() && entry.name.includes('.backup.')) {
                        backups.push(fullPath);
                    } else if (entry.isDirectory() && 
                              !['node_modules', '.git', 'dist', 'build', 'coverage', '__pycache__', '.venv', 'remediation-backups'].includes(entry.name)) {
                        await traverse(fullPath);
                    }
                }
            } catch (error) {
                // Skip inaccessible directories
            }
        }
        
        await traverse(dirPath);
        return backups;
    }

    async runCleanScan() {
        console.log('\n🔍 Running clean scan (excluding backups)...');
        
        // Create scanner with backup exclusion
        const scanner = new MockDataScanner();
        const files = await this.getTestFiles('./');
        
        console.log(`📁 Found ${files.length} test files (excluding backups)`);
        
        const results = await scanner.scanFiles(files, (current, total, filename) => {
            if (current % 50 === 0 || current === total) {
                console.log(`📊 Progress: ${current}/${total} (${Math.round(current/total*100)}%)`);
            }
        });
        
        this.stats.filesScanned = results.summary.totalFiles;
        this.stats.totalFindings = results.summary.totalMatches;
        
        console.log('\n📊 CLEAN SCAN RESULTS:');
        console.log(`📁 Files Scanned: ${results.summary.totalFiles}`);
        console.log(`🎯 Total Findings: ${results.summary.totalMatches}`);
        console.log(`💚 Health Score: ${results.summary.healthScore}% (${results.summary.healthGrade})`);
        
        // Store results for final report
        this.scanResults = results;
    }

    async getTestFiles(dirPath) {
        const files = [];
        
        async function traverse(currentPath) {
            try {
                const entries = await fs.readdir(currentPath, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(currentPath, entry.name);
                    
                    if (entry.isDirectory()) {
                        if (!['node_modules', '.git', 'dist', 'build', 'coverage', '__pycache__', '.venv', 'remediation-backups'].includes(entry.name)) {
                            await traverse(fullPath);
                        }
                    } else if (entry.isFile()) {
                        // Exclude backup files
                        if (entry.name.includes('.backup.')) {
                            continue;
                        }
                        
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

    async generateFinalReport() {
        console.log('\n📋 Generating final remediation report...');
        
        const report = {
            timestamp: new Date().toISOString(),
            cleanupStats: this.stats,
            scanResults: this.scanResults,
            remediationImpact: this.calculateImpact(),
            recommendations: this.generateRecommendations()
        };
        
        const reportPath = './final-remediation-report.json';
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        console.log(`📄 Final report saved to: ${reportPath}`);
    }

    calculateImpact() {
        // Original metrics before remediation
        const originalFindings = 1088;
        const originalMockFunctions = 546;
        const originalTestEmails = 134;
        
        // Current metrics after cleanup
        const currentFindings = this.stats.totalFindings;
        const currentMockFunctions = this.scanResults.categories.find(c => c.category === 'mock_functions')?.count || 0;
        const currentTestEmails = this.scanResults.categories.find(c => c.category === 'test_emails')?.count || 0;
        
        return {
            totalFindings: {
                original: originalFindings,
                current: currentFindings,
                reduction: originalFindings - currentFindings,
                percentage: Math.round((originalFindings - currentFindings) / originalFindings * 100)
            },
            mockFunctions: {
                original: originalMockFunctions,
                current: currentMockFunctions,
                reduction: originalMockFunctions - currentMockFunctions,
                percentage: Math.round((originalMockFunctions - currentMockFunctions) / originalMockFunctions * 100)
            },
            testEmails: {
                original: originalTestEmails,
                current: currentTestEmails,
                reduction: originalTestEmails - currentTestEmails,
                percentage: Math.round((originalTestEmails - currentTestEmails) / originalTestEmails * 100)
            }
        };
    }

    generateRecommendations() {
        const recommendations = [];
        
        if (this.stats.totalFindings > 500) {
            recommendations.push({
                priority: 'high',
                title: 'Continue Remediation',
                description: `${this.stats.totalFindings} findings remain - consider additional remediation passes`,
                action: 'Run targeted remediation on remaining high-impact files'
            });
        }
        
        if (this.scanResults.summary.healthScore < 40) {
            recommendations.push({
                priority: 'medium',
                title: 'Health Score Improvement',
                description: `Health score is ${this.scanResults.summary.healthScore}% - room for improvement`,
                action: 'Focus on test_data category for biggest impact'
            });
        }
        
        recommendations.push({
            priority: 'low',
            title: 'Maintain Gains',
            description: 'Establish coding standards to prevent regression',
            action: 'Implement pre-commit hooks and CI/CD scanning'
        });
        
        return recommendations;
    }

    printSummary() {
        console.log('\n📊 CLEANUP AND FINAL SCAN SUMMARY\n');
        console.log(`📦 Backups Moved: ${this.stats.backupsMoved}`);
        console.log(`📁 Files Scanned: ${this.stats.filesScanned}`);
        console.log(`🎯 Total Findings: ${this.stats.totalFindings}`);
        
        if (this.scanResults) {
            console.log(`💚 Health Score: ${this.scanResults.summary.healthScore}% (${this.scanResults.summary.healthGrade})`);
            
            console.log('\n📈 REMEDIATION IMPACT:');
            const impact = this.calculateImpact();
            console.log(`  Total Findings: ${impact.totalFindings.original} → ${impact.totalFindings.current} (${impact.totalFindings.percentage}% reduction)`);
            console.log(`  Mock Functions: ${impact.mockFunctions.original} → ${impact.mockFunctions.current} (${impact.mockFunctions.percentage}% reduction)`);
            console.log(`  Test Emails: ${impact.testEmails.original} → ${impact.testEmails.current} (${impact.testEmails.percentage}% reduction)`);
        }
        
        console.log('\n💡 NEXT STEPS:');
        console.log('1. Review final remediation report');
        console.log('2. Address remaining high-impact files if needed');
        console.log('3. Implement ongoing monitoring practices');
        console.log('4. Maintain backup files for reference');
    }
}

// Run the cleanup and final scan
const cleanup = new CleanupAndFinalScan();
cleanup.run();
