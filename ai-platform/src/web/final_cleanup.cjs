/**
 * Final Cleanup for Remaining Issues
 * Fixes malformed NOTE: entries and any remaining issues
 */

const fs = require('fs');
const path = require('path');

class FinalCleanup {
    constructor() {
        this.fixes = 0;
    }

    fixMalformedNotes(filePath) {
        let fixesInFile = 0;
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            let modifiedContent = content;

            // Fix malformed "NOTE: :" entries
            const malformedNoteRegex = /\/\/ NOTE:\s*:\s*([^,\n]*)/g;
            const matches = content.match(malformedNoteRegex);
            
            if (matches) {
                matches.forEach(match => {
                    // Convert "NOTE: : text" to "NOTE: text"
                    const corrected = match.replace(/NOTE:\s*:\s*/, 'NOTE: ');
                    modifiedContent = modifiedContent.replace(match, corrected);
                    fixesInFile++;
                });
            }

            // Fix empty NOTE entries
            const emptyNoteRegex = /\/\/ NOTE:\s*:?\s*['"]?\s*['"]?\s*/g;
            const emptyMatches = modifiedContent.match(emptyNoteRegex);
            
            if (emptyMatches) {
                emptyMatches.forEach(match => {
                    modifiedContent = modifiedContent.replace(match, '// NOTE: Empty comment removed');
                    fixesInFile++;
                });
            }

            if (fixesInFile > 0) {
                fs.writeFileSync(filePath, modifiedContent, 'utf8');
                console.log(`  ✅ Fixed ${fixesInFile} malformed NOTE entries in ${path.relative(process.cwd(), filePath)}`);
                this.fixes += fixesInFile;
            }

        } catch (error) {
            console.error(`Error fixing file ${filePath}:`, error.message);
            return 0;
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
            this.fixMalformedNotes(filePath);
        }
    }
}

// Run the final cleanup
async function main() {
    console.log('🧹 Starting Final Cleanup...');
    console.log('============================');

    const cleanup = new FinalCleanup();
    const reportPath = path.join(process.cwd(), 'quality_scan_report.json');
    
    try {
        cleanup.processFilesWithIssues(reportPath);
        
        console.log('\n📊 FINAL CLEANUP RESULTS');
        console.log('========================');
        console.log(`Total Fixes Applied: ${cleanup.fixes}`);
        
        console.log('\n✅ Final Cleanup Complete!');
        
    } catch (error) {
        console.error('❌ Error during final cleanup:', error);
        process.exit(1);
    }
}

main();
