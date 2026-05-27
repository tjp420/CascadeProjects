/**
 * Code Quality Scanner
 * Scans code for quality issues including TODO comments, hardcoded values, and placeholders
 */

import fs from 'fs';
import path from 'path';
// import { VALIDATION, ERROR_MESSAGES } from './config/constants.js';

class CodeQualityScanner {
    constructor() {
        this.issues = {
            hardcodedPercentages: [],
            placeholderText: [],
            todoComments: []
        };
        this.scanResults = {
            totalFiles: 0,
            filesWithIssues: 0,
            totalFindings: 0
        };
    }

    async scanDirectory(dirPath) {
        const files = this.getAllFiles(dirPath);
        this.scanResults.totalFiles = files.length;

        for (const filePath of files) {
            await this.scanFile(filePath);
        }

        return this.generateReport();
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

    async scanFile(filePath) {
        try {
            // Skip source map files and other non-code files
            if (filePath.endsWith('.map') || 
                filePath.endsWith('.min.js') || 
                filePath.endsWith('.min.css') ||
                filePath.includes('node_modules')) {
                return;
            }
            
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            let fileHasIssues = false;

            // Scan for hardcoded percentages
            const percentageRegex = /\b(\d+(\.\d+)?%|\d+(\.\d+)?\s*%)\b/g;
            lines.forEach((line, index) => {
                const matches = line.match(percentageRegex);
                if (matches) {
                    matches.forEach(match => {
                        this.issues.hardcodedPercentages.push({
                            file: filePath,
                            line: index + 1,
                            content: line.trim(),
                            value: match
                        });
                        fileHasIssues = true;
                    });
                }
            });

            // Scan for placeholder text
            const placeholderRegex = /\b(Example content|sample dataset|Sample Dataset|sample dataset|Example content)\b/gi;
            lines.forEach((line, index) => {
                const matches = line.match(placeholderRegex);
                if (matches) {
                    matches.forEach(match => {
                        this.issues.placeholderText.push({
                            file: filePath,
                            line: index + 1,
                            content: line.trim(),
                            value: match
                        });
                        fileHasIssues = true;
                    });
                }
            });

            const todoRegex = /(TODO|FIXME|HACK|XXX|NOTE|BUG)\b.*/gi;
            lines.forEach((line, index) => {
                const matches = line.match(todoRegex);
                if (matches) {
                    matches.forEach(match => {
                        this.issues.todoComments.push({
                            file: filePath,
                            line: index + 1,
                            content: line.trim(),
                            value: match.trim()
                        });
                        fileHasIssues = true;
                    });
                }
            });

            if (fileHasIssues) {
                this.scanResults.filesWithIssues++;
            }

        } catch (error) {
            console.error(`Error scanning file ${filePath}:`, error);
        }
    }

    generateReport() {
        const totalFindings = this.issues.hardcodedPercentages.length + 
                            this.issues.placeholderText.length + 
                            this.issues.todoComments.length;
        
        this.scanResults.totalFindings = totalFindings;

        return {
            summary: this.scanResults,
            findings: {
                hardcodedPercentages: {
                    count: this.issues.hardcodedPercentages.length,
                    instances: this.issues.hardcodedPercentages
                },
                placeholderText: {
                    count: this.issues.placeholderText.length,
                    instances: this.issues.placeholderText
                },
                todoComments: {
                    count: this.issues.todoComments.length,
                    instances: this.issues.todoComments
                }
            },
            recommendations: this.generateRecommendations()
        };
    }

    generateRecommendations() {
        const recommendations = [];

        if (this.issues.hardcodedPercentages.length > 0) {
            recommendations.push({
                category: 'Hardcoded Percentages',
                priority: 'High',
                action: 'Replace hardcoded percentage values with constants from config/constants.js',
                count: this.issues.hardcodedPercentages.length,
                examples: this.issues.hardcodedPercentages.slice(0, 3).map(i => i.value)
            });
        }

        if (this.issues.placeholderText.length > 0) {
            recommendations.push({
                category: 'Placeholder Text',
                priority: 'Medium',
                action: 'Remove Example content and sample dataset, replace with meaningful content',
                count: this.issues.placeholderText.length,
                examples: this.issues.placeholderText.slice(0, 3).map(i => i.value)
            });
        }

        if (this.issues.todoComments.length > 0) {
            recommendations.push({
                category: 'TODO Comments',
                priority: 'Medium',
                action: 'Review and categorize TODOs, create actionable tasks',
                count: this.issues.todoComments.length,
                examples: this.issues.todoComments.slice(0, 3).map(i => i.value)
            });
        }

        return recommendations;
    }

    async fixHardcodedPercentages() {
        // Implementation for automated fixing
        console.log('Automated percentage fixing not yet implemented');
    }

    async removePlaceholderText() {
        // Implementation for automated placeholder removal
        console.log('Automated placeholder removal not yet implemented');
    }

    async categorizeTodos() {
        const categories = {
            'bug': [],
            'feature': [],
            'refactor': [],
            'documentation': [],
            'test': [],
            'other': []
        };
        
        const currentDate = new Date().toISOString().split('T')[0];
        
        this.issues.todoComments.forEach(todo => {
            const value = todo.value.toLowerCase();
            
            if (value.includes('fix') || value.includes('bug') || value.includes('error')) {
                categories.bug.push({ ...todo, priority: 'high' });
            } else if (value.includes('add') || value.includes('implement') || value.includes('feature')) {
                categories.feature.push({ ...todo, priority: 'medium' });
            } else if (value.includes('refactor') || value.includes('clean') || value.includes('optimize')) {
                categories.refactor.push({ ...todo, priority: 'medium' });
            } else if (value.includes('doc') || value.includes('comment') || value.includes('readme')) {
                categories.documentation.push({ ...todo, priority: 'low' });
            } else if (value.includes('test') || value.includes('spec') || value.includes('coverage')) {
                categories.test.push({ ...todo, priority: 'medium' });
            } else {
                categories.other.push({ ...todo, priority: 'low' });
            }
        });
        
        return {
            categorized: true,
            date: currentDate,
            categories: categories,
            summary: {
                total: this.issues.todoComments.length,
                bug: categories.bug.length,
                feature: categories.feature.length,
                refactor: categories.refactor.length,
                documentation: categories.documentation.length,
                test: categories.test.length,
                other: categories.other.length
            }
        };
    }
}

export default CodeQualityScanner;
