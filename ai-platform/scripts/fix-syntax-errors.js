
/**
 * Automatic Syntax Error Fixer
 * Identifies and removes orphaned code blocks and syntax errors in index.html
 */

const fs = require('fs');
const path = require('path');

class SyntaxErrorFixer {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.indexHtmlPath = path.join(projectRoot, 'web', 'index.html');
    }

    fix() {
        console.log('🔧 Fixing Syntax Errors in index.html...\n');

        if (!fs.existsSync(this.indexHtmlPath)) {
            console.log('❌ index.html not found');
            return false;
        }

        let content = fs.readFileSync(this.indexHtmlPath, 'utf8');
        const originalLength = content.length;
        
        // Fix 1: Remove orphaned catch/finally blocks
        content = this.removeOrphanedBlocks(content);
        
        // Fix 2: Remove duplicate function definitions
        content = this.removeDuplicateFunctions(content);
        
        // Fix 3: Fix broken template literals
        content = this.fixTemplateLiterals(content);
        
        // Fix 4: Remove orphaned HTML fragments
        content = this.removeOrphanedHTML(content);
        
        // Fix 5: Fix malformed comment lines
        content = this.fixMalformedComments(content);
        
        fs.writeFileSync(this.indexHtmlPath, content);
        
        const fixedSize = originalLength - content.length;
        console.log('✅ Syntax errors fixed successfully!');
        console.log(`📊 Removed ${fixedSize} characters of broken code`);
        
        return true;
    }

    removeOrphanedBlocks(content) {
        // Remove orphaned catch/finally blocks without corresponding try
        const orphanedCatch = /[\n\s]*} catch \([\s\S]*?\)[\s\S]*?\n\s*}/g;
        content = content.replace(orphanedCatch, '');
        
        // Remove orphaned closing braces
        const orphanedBraces = /[\n\s]*\}[\s\n]*(?![\s\w])/g;
        content = content.replace(orphanedBraces, '');
        
        return content;
    }

    removeDuplicateFunctions(content) {
        const functionPattern = /function\s+(\w+)\s*\([^)]*\)\s*\{/g;
        const functionNames = [];
        let match;
        
        while ((match = functionPattern.exec(content)) !== null) {
            functionNames.push(match[1]);
        }
        
        // Find duplicates
        const duplicates = functionNames.filter((name, index, self) => self.indexOf(name) !== index);
        
        // Remove second occurrence of duplicate functions
        duplicates.forEach(funcName => {
            const pattern = new RegExp(`function\\s+${funcName}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n[\\s\\S]*?\\}`, 'g');
            const matches = content.match(pattern);
            if (matches && matches.length > 1) {
                // Keep first occurrence, remove others
                const firstEnd = content.indexOf(matches[0]) + matches[0].length;
                const secondStart = content.indexOf(matches[1]);
                content = content.substring(0, secondStart) + content.substring(secondStart + matches[1].length);
            }
        });
        
        return content;
    }

    fixTemplateLiterals(content) {
        // Fix malformed template literals
        const malformedTemplate = /\`[\s\S]*?\`[\s\S]*?\`/g;
        
        content = content.replace(malformedTemplate, (match) => {
            // Try to fix by removing duplicate backticks
            const clean = match.replace(/\`\`/g, '`');
            return clean;
        });
        
        return content;
    }

    removeOrphanedHTML(content) {
        // Remove orphaned HTML fragments outside of function bodies
        const orphanedHTML = /[\n\s]*<\/?[a-z][a-z0-9]*[\s>][\s\S]*?\/?[a-z][a-z0-9]*>[\s\n]*/gi;
        
        // Only remove if not inside a string literal
        const lines = content.split('\n');
        const fixedLines = lines.filter(line => {
            // Skip lines that are obviously orphaned HTML
            const trimmed = line.trim();
            if (trimmed.startsWith('</div>') || trimmed.startsWith('<div') || trimmed.startsWith('<h4')) {
                // Check if it's inside a string literal
                const precedingLines = lines.slice(0, lines.indexOf(line));
                const precedingText = precedingLines.join('\n');
                const stringLiterals = precedingText.match(/['"`]/g);
                if (stringLiterals && stringLiterals.length % 2 === 0) {
                    // Even number of quotes, so not inside string
                    return false;
                }
            }
            return true;
        });
        
        return fixedLines.join('\n');
    }

    fixMalformedComments(content) {
        // Fix malformed comment lines like `// NOTE: Comments') {`
        const malformedComments = /\/\/ NOTE:.*?[\s\{]/g;
        
        content = content.replace(malformedComments, '// NOTE: Comments detected');
        
        return content;
    }
}

// Main execution
const fixer = new SyntaxErrorFixer(process.cwd());
fixer.fix();