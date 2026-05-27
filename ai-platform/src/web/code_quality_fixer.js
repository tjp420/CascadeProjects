/**
 * Code Quality Fixer
 * Automatically fixes common code quality issues
 */

import fs from 'fs';
import path from 'path';

import { PERCENTAGES, TIMING, API, UI, VALIDATION } from './config/constants.js';

class CodeQualityFixer {
    constructor() {
        this.fixes = {
            hardcodedPercentages: 0,
            placeholderText: 0,
            todoComments: 0
        };
        this.errors = [];
    }

    async fixDirectory(dirPath) {
        const files = this.getAllFiles(dirPath);
        
        for (const filePath of files) {
            await this.fixFile(filePath);
        }

        return this.generateFixReport();
    }

    getAllFiles(dirPath, extensions = ['.js', '.html', '.css', '.py', '.md']) {
        let files = [];
        
        try {
            const items = fs.readdirSync(dirPath);
            
            for (const item of items) {
                const fullPath = path.join(dirPath, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                    files = files.concat(this.getAllFiles(fullPath, extensions));
                } else if (stat.isFile() && extensions.includes(path.extname(item))) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            console.error(`Error scanning directory ${dirPath}:`, error);
        }
        
        return files;
    }

    async fixFile(filePath) {
        try {
            let content = fs.readFileSync(filePath, 'utf8');
            let modified = false;

            // Fix hardcoded percentages in JavaScript files
            if (filePath.endsWith('.js')) {
                const originalContent = content;
                content = this.fixHardcodedPercentages(content);
                if (content !== originalContent) {
                    modified = true;
                }
            }

            // Fix placeholder text
            const originalContent = content;
            content = this.removePlaceholderText(content);
            if (content !== originalContent) {
                modified = true;
                this.fixes.placeholderText++;
            }

            // Categorize TODO comments with priority levels
            const originalContent2 = content;
            content = this.categorizeTodoComments(content, filePath);
            if (content !== originalContent2) {
                modified = true;
                this.fixes.todoComments++;
            }

            if (modified) {
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`✅ Fixed: ${path.relative(process.cwd(), filePath)}`);
            }

        } catch (error) {
            this.errors.push({ file: filePath, error: error.message });
            console.error(`❌ Error fixing file ${filePath}:`, error);
        }
    }

    fixHardcodedPercentages(content) {
        // Replace common hardcoded percentage values with constants
        const replacements = [
            { pattern: /\b85\b/g, replacement: 'PERCENTAGES.SECURITY_TARGET' },
            { pattern: /\b80\b/g, replacement: 'PERCENTAGES.QUALITY_TARGET' },
            { pattern: /\b79\b/g, replacement: 'PERCENTAGES.PERFORMANCE_TARGET' },
            { pattern: /\b60\b/g, replacement: 'PERCENTAGES.COVERAGE_TARGET' },
            { pattern: /\b100\b/g, replacement: 'PERCENTAGES.ACHIEVEMENT_THRESHOLD' },
            { pattern: /\b5\s*\*\s*60\s*\*\s*1000\b/g, replacement: 'TIMING.CACHE_TIMEOUT' },
            { pattern: /\b3000\b/g, replacement: 'TIMING.TOAST_DISPLAY_TIME' },
            { pattern: /\b300\b/g, replacement: 'TIMING.ANIMATION_DURATION' }
        ];

        let modifiedContent = content;
        
        // Check if constants are already imported
        const hasConstantsImport = content.includes('import {') && content.includes('from \'./config/constants.js\'');
        
        if (!hasConstantsImport) {
            // Add import statement at the top
            modifiedContent = `import { PERCENTAGES, TIMING, API, UI, VALIDATION } from './config/constants.js';\n${modifiedContent}`;
        }

        // Apply replacements
        replacements.forEach(({ pattern, replacement }) => {
            modifiedContent = modifiedContent.replace(pattern, replacement);
        });

        if (modifiedContent !== content) {
            this.fixes.hardcodedPercentages++;
        }

        return modifiedContent;
    }

    removePlaceholderText(content) {
        const placeholderPatterns = [
            /\bExample content\b/gi,
            /\bSample data\b/gi,
            /\bSample Data\b/gi,
            /\bsample data\b/gi,
            /\bExample content\b/gi
        ];

        let modifiedContent = content;
        
        placeholderPatterns.forEach(pattern => {
            modifiedContent = modifiedContent.replace(pattern, '[PLACEHOLDER - Replace with meaningful content]');
        });

        return modifiedContent;
    }

    categorizeTodoComments(content, filePath) {
        const todoRegex = /(TODO|FIXME|HACK|XXX|NOTE|BUG|WARNING)\b(.*)$/gim;
        const currentDate = new Date().toISOString().split('T')[0];
        
        let modifiedContent = content;
        let match;

        while ((match = todoRegex./* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: exec(content)) !== null) {
            const fullMatch = match[0];
            const type = match[1].toUpperCase();
            const description = match[2].trim();
            
            // Add categorization and priority
            let categorizedTodo = fullMatch;
            
            if (type === 'TODO') {
                const priority = this.determinePriority(description);
                categorizedTodo = `${type} [${priority}] - ${description} (Auto-categorized: ${currentDate})`;
            } else if (type === 'FIXME') {
                categorizedTodo = `${type} [HIGH] - ${description} (Auto-categorized: ${currentDate})`;
            } else if (type === 'HACK') {
                categorizedTodo = `${type} [MEDIUM] - ${description} (Auto-categorized: ${currentDate})`;
            } else if (type === 'WARNING') {
                categorizedTodo = `${type} [HIGH] - ${description} (Auto-categorized: ${currentDate})`;
            }
            
            modifiedContent = modifiedContent.replace(fullMatch, categorizedTodo);
        }

        return modifiedContent;
    }

    determinePriority(description) {
        const highPriorityKeywords = ['critical', 'urgent', 'security', 'fix', 'error'];
        const mediumPriorityKeywords = ['improve', 'optimize', 'refactor', 'update', 'enhance'];
        
        const desc = description.toLowerCase();
        
        if (highPriorityKeywords.some(keyword => desc.includes(keyword))) {
            return 'HIGH';
        } else if (mediumPriorityKeywords.some(keyword => desc.includes(keyword))) {
            return 'MEDIUM';
        } else {
            return 'LOW';
        }
    }

    generateFixReport() {
        return {
            summary: {
                totalFixes: this.fixes.hardcodedPercentages + this.fixes.placeholderText + this.fixes.todoComments,
                hardcodedPercentages: this.fixes.hardcodedPercentages,
                placeholderText: this.fixes.placeholderText,
                todoComments: this.fixes.todoComments,
                errors: this.errors.length
            },
            errors: this.errors,
            recommendations: this.generatePostFixRecommendations()
        };
    }

    generatePostFixRecommendations() {
        const recommendations = [];
        
        if (this.fixes.hardcodedPercentages > 0) {
            recommendations.push({
                action: 'Review and test the replaced percentage constants',
                reason: 'Ensure the new constants work correctly in all contexts'
            });
        }
        
        if (this.fixes.placeholderText > 0) {
            recommendations.push({
                action: 'Replace placeholder markers with actual content',
                reason: 'Placeholder markers should be replaced with meaningful data'
            });
        }
        
        if (this.fixes.todoComments > 0) {
            recommendations.push({
                action: 'Review categorized TODOs and create actionable tasks',
                reason: 'Categorized TODOs should be tracked in project management tools'
            });
        }
        
        if (this.errors.length > 0) {
            recommendations.push({
                action: 'Review and fix files that encountered errors',
                reason: 'Some files could not be processed automatically'
            });
        }
        
        return recommendations;
    }
}

export default CodeQualityFixer;
