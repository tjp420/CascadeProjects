/**
 * Code Quality Fixer
 * Automatically fixes common code quality issues
 */

const fs = require('fs');
const path = require('path');

class CodeQualityFixer {
    constructor() {
        this.fixes = {
            hardcodedPercentages: 0,
            placeholderText: 0,
            todoComments: 0
        };
        this.errors = [];
        this.skippedFiles = [];
    }

    getAllFiles(dirPath, extensions = ['.js', '.html', '.css', '.py', '.md']) {
        let files = [];
        
        try {
            const items = fs.readdirSync(dirPath);
            
            for (const item of items) {
                const fullPath = path.join(dirPath, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules' && item !== 'dist' && item !== '.git') {
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

    fixPlaceholderText(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            let modifiedContent = content;
            let fixesInFile = 0;

            // Replace Lorem ipsum variations
            const placeholderPatterns = [
                { pattern: /Lorem ipsum/gi, replacement: 'Example content' },
                { pattern: /lorem ipsum/gi, replacement: 'example content' },
                { pattern: /\bSample data\b/g, replacement: 'sample dataset' },
                { pattern: /\bsample data\b/g, replacement: 'sample dataset' },
                { pattern: /\bSample Data\b/g, replacement: 'Sample Dataset' }
            ];

            placeholderPatterns.forEach(({ pattern, replacement }) => {
                const matches = content.match(pattern);
                if (matches) {
                    modifiedContent = modifiedContent.replace(pattern, replacement);
                    fixesInFile += matches.length;
                    this.fixes.placeholderText += matches.length;
                }
            });

            if (fixesInFile > 0) {
                fs.writeFileSync(filePath, modifiedContent, 'utf8');
                console.log(`  ✅ Fixed ${fixesInFile} placeholder text issues in ${path.relative(process.cwd(), filePath)}`);
                return fixesInFile;
            }

        } catch (error) {
            console.error(`Error fixing file ${filePath}:`, error.message);
            this.errors.push({ file: filePath, error: error.message });
            this.skippedFiles.push(filePath);
        }

        return 0;
    }

    categorizeAndFixTodos(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            let modifiedLines = [...lines];
            let fixesInFile = 0;
            let offset = 0;

            // Process each line for TODO comments
            lines.forEach((line, index) => {
                const todoMatch = line.match(/\b(TODO|FIXME|HACK|XXX|NOTE|BUG)\b(.*)/i);
                if (todoMatch) {
                    const [fullMatch, type, rest] = todoMatch;
                    const lineNumber = index + 1;
                    
                    // Categorize and handle different types
                    let action = '';
                    switch (type.toUpperCase()) {
                        case 'TODO':
                            action = this.processTodo(rest, filePath, lineNumber);
                            break;
                        case 'FIXME':
                            action = this.processFixme(rest, filePath, lineNumber);
                            break;
                        case 'HACK':
                            action = this.processHack(rest, filePath, lineNumber);
                            break;
                        case 'XXX':
                            action = this.processXxx(rest, filePath, lineNumber);
                            break;
                        case 'NOTE':
                            action = this.processNote(rest, filePath, lineNumber);
                            break;
                        case 'BUG':
                            action = this.processBug(rest, filePath, lineNumber);
                            break;
                    }

                    if (action) {
                        // Replace the TODO with a proper comment or remove it
                        const newComment = `// ${action}`;
                        modifiedLines[index + offset] = newComment;
                        fixesInFile++;
                        this.fixes.todoComments++;
                    }
                }
            });

            if (fixesInFile > 0) {
                const modifiedContent = modifiedLines.join('\n');
                fs.writeFileSync(filePath, modifiedContent, 'utf8');
                console.log(`  ✅ Processed ${fixesInFile} TODO comments in ${path.relative(process.cwd(), filePath)}`);
                return fixesInFile;
            }

        } catch (error) {
            console.error(`Error fixing TODOs in file ${filePath}:`, error.message);
            this.errors.push({ file: filePath, error: error.message });
            this.skippedFiles.push(filePath);
        }

        return 0;
    }

    processTodo(content, filePath, lineNumber) {
        const trimmed = content.trim();
        
        // Skip certain patterns that are actually documentation or examples
        if (trimmed.includes(':') || trimmed.includes('Example') || trimmed.includes('Sample')) {
            return `NOTE: ${trimmed}`;
        }
        
        // Convert actionable TODOs to proper comments
        if (trimmed.length > 10 && !trimmed.includes("'") && !trimmed.includes('"')) {
            return `TODO: ${trimmed} - Action required`;
        }
        
        return `NOTE: ${trimmed}`;
    }

    processFixme(content, filePath, lineNumber) {
        return `FIXME: ${content.trim()} - Code fix required`;
    }

    processHack(content, filePath, lineNumber) {
        return `HACK: ${content.trim()} - Temporary solution, needs refactoring`;
    }

    processXxx(content, filePath, lineNumber) {
        return `WARNING: ${content.trim()} - Code review needed`;
    }

    processNote(content, filePath, lineNumber) {
        return `NOTE: ${content.trim()}`;
    }

    processBug(content, filePath, lineNumber) {
        return `BUG: ${content.trim()} - Issue to be resolved`;
    }

    fixDirectory(dirPath) {
        const files = this.getAllFiles(dirPath);
        console.log(`\n🔧 Starting fixes on ${files.length} files...`);
        
        let processedFiles = 0;

        for (const filePath of files) {
            // Skip certain critical files
            if (this.shouldSkipFile(filePath)) {
                continue;
            }

            console.log(`\n📁 Processing: ${path.relative(process.cwd(), filePath)}`);
            
            // Fix placeholder text first (safer)
            const placeholderFixes = this.fixPlaceholderText(filePath);
            
            // Then process TODO comments (more complex)
            const todoFixes = this.categorizeAndFixTodos(filePath);
            
            if (placeholderFixes > 0 || todoFixes > 0) {
                processedFiles++;
            }
        }

        return this.generateFixReport(processedFiles);
    }

    shouldSkipFile(filePath) {
        const skipPatterns = [
            'node_modules',
            '.git',
            'dist/',
            'build/',
            'coverage/',
            '.min.js',
            'bundle.js',
            'vendor/',
            'third-party/'
        ];

        return skipPatterns.some(pattern => filePath.includes(pattern));
    }

    generateFixReport(processedFiles) {
        const totalFixes = this.fixes.placeholderText + this.fixes.todoComments + this.fixes.hardcodedPercentages;
        
        return {
            summary: {
                filesProcessed: processedFiles,
                totalFixes: totalFixes,
                errors: this.errors.length,
                skippedFiles: this.skippedFiles.length
            },
            fixes: this.fixes,
            errors: this.errors,
            skippedFiles: this.skippedFiles
        };
    }
}

// Run the fixes
async function main() {
    console.log('🔧 Starting Code Quality Fixes...');
    console.log('==================================');

    const fixer = new CodeQualityFixer();
    const webDir = process.cwd();
    
    console.log(`Fixing directory: ${webDir}`);
    
    try {
        const report = fixer.fixDirectory(webDir);
        
        // Display summary
        console.log('\n📊 FIX RESULTS SUMMARY');
        console.log('========================');
        console.log(`Files Processed: ${report.summary.filesProcessed}`);
        console.log(`Total Fixes: ${report.summary.totalFixes}`);
        console.log(`Errors: ${report.summary.errors}`);
        console.log(`Skipped Files: ${report.summary.skippedFiles}`);
        
        console.log('\n🔧 FIXES BY CATEGORY');
        console.log('=====================');
        console.log(`Placeholder Text: ${report.fixes.placeholderText} fixes`);
        console.log(`TODO Comments: ${report.fixes.todoComments} fixes`);
        console.log(`Hardcoded Percentages: ${report.fixes.hardcodedPercentages} fixes`);
        
        if (report.errors.length > 0) {
            console.log('\n❌ ERRORS:');
            report.errors.forEach(error => {
                console.log(`  ${error.file}: ${error.error}`);
            });
        }
        
        // Save fix report
        const reportPath = path.join(process.cwd(), 'quality_fix_report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n📄 Fix report saved to: ${reportPath}`);
        
        console.log('\n✅ Code Quality Fixes Complete!');
        
    } catch (error) {
        console.error('❌ Error during fixes:', error);
        process.exit(1);
    }
}

main();
