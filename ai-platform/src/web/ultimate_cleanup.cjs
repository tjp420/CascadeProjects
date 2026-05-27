/**
 * Ultimate Cleanup for Remaining Issues
 * Fixes any remaining malformed comments and issues
 */

const fs = require('fs');
const path = require('path');

class UltimateCleanup {
    constructor() {
        this.fixes = 0;
    }

    fixRemainingIssues(filePath) {
        let fixesInFile = 0;
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            let modifiedContent = content;

            // Fix repeated "Empty comment removed" text
            const repeatedEmptyRegex = /\/\/ NOTE: (Empty comment removed)+/g;
            const repeatedMatches = modifiedContent.match(repeatedEmptyRegex);
            
            if (repeatedMatches) {
                repeatedMatches.forEach(match => {
                    modifiedContent = modifiedContent.replace(match, '// NOTE: Empty comment removed');
                    fixesInFile++;
                });
            }

            // Fix malformed long lines with repeated text
            const malformedLineRegex = /\/\/ NOTE: (Empty comment removed)+(.*?)(?=\n|$)/gs;
            const malformedMatches = modifiedContent.match(malformedLineRegex);
            
            if (malformedMatches) {
                malformedMatches.forEach(match => {
                    // Extract the actual content after the repeated text
                    const contentMatch = match.match(/Empty comment removed+(.*)/);
                    if (contentMatch && contentMatch[1] && contentMatch[1].trim()) {
                        const actualContent = contentMatch[1].trim();
                        modifiedContent = modifiedContent.replace(match, `// NOTE: ${actualContent}`);
                    } else {
                        modifiedContent = modifiedContent.replace(match, '// NOTE: Empty comment removed');
                    }
                    fixesInFile++;
                });
            }

            // Remove completely empty NOTE lines
            const emptyNoteLineRegex = /^\s*\/\/ NOTE:\s*$/gm;
            const emptyNoteMatches = modifiedContent.match(emptyNoteLineRegex);
            
            if (emptyNoteMatches) {
                emptyNoteMatches.forEach(match => {
                    modifiedContent = modifiedContent.replace(match, '');
                    fixesInFile++;
                });
            }

            // Fix lines with only "NOTE: " followed by whitespace
            const whitespaceNoteRegex = /^\s*\/\/ NOTE:\s*$/gm;
            const whitespaceMatches = modifiedContent.match(whitespaceNoteRegex);
            
            if (whitespaceMatches) {
                whitespaceMatches.forEach(match => {
                    modifiedContent = modifiedContent.replace(match, '');
                    fixesInFile++;
                });
            }

            if (fixesInFile > 0) {
                fs.writeFileSync(filePath, modifiedContent, 'utf8');
                console.log(`  ✅ Fixed ${fixesInFile} remaining issues in ${path.relative(process.cwd(), filePath)}`);
                this.fixes += fixesInFile;
            }

        } catch (error) {
            console.error(`Error fixing file ${filePath}:`, error.message);
        }

        return fixesInFile;
    }

    processFilesWithIssues(reportPath) {
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        const filesToProcess = new Set();
        
        // Collect all files with TODO issues
        report.findings.todoComments.instances.forEach(issue => {
            filesToProcess.add(issue.file);
        });

        console.log(`Processing ${filesToProcess.size} files with remaining issues...`);

        for (const filePath of filesToProcess) {
            this.fixRemainingIssues(filePath);
        }
    }
}

// Run the ultimate cleanup
async function main() {
    console.log('🚀 Starting Ultimate Cleanup...');
    console.log('===============================');

    const cleanup = new UltimateCleanup();
    const reportPath = path.join(process.cwd(), 'quality_scan_report.json');
    
    try {
        cleanup.processFilesWithIssues(reportPath);
        
        console.log('\n📊 ULTIMATE CLEANUP RESULTS');
        console.log('============================');
        console.log(`Total Fixes Applied: ${cleanup.fixes}`);
        
        console.log('\n✅ Ultimate Cleanup Complete!');
        
    } catch (error) {
        console.error('❌ Error during ultimate cleanup:', error);
        process.exit(1);
    }
}

main();
