/**
 * Refactored Code Quality Scanner - Reduced complexity version
 */

import fs from 'fs';
import path from 'path';

/**
 * File system utilities
 */
class FileSystemUtils {
    static getAllFiles(dirPath, extensions = ['.js', '.html', '.css', '.py', '.md']) {
        let files = [];
        
        try {
            const items = fs.readdirSync(dirPath);
            
            for (const item of items) {
                const fullPath = path.join(dirPath, item);
                const stat = fs.statSync(fullPath);
                
                if (this.shouldScanDirectory(item, stat)) {
                    files = files.concat(this.getAllFiles(fullPath, extensions));
                } else if (this.shouldScanFile(item, stat, extensions)) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            console.warn(`Warning: Could not read directory ${dirPath}: ${error.message}`);
        }
        
        return files;
    }

    static shouldScanDirectory(item, stat) {
        return stat.isDirectory() && 
               !item.startsWith('.') && 
               item !== 'node_modules' && 
               item !== 'coverage' &&
               item !== 'dist';
    }

    static shouldScanFile(item, stat, extensions) {
        return stat.isFile() && extensions.includes(path.extname(item));
    }

    static readFile(filePath) {
        try {
            return fs.readFileSync(filePath, 'utf8');
        } catch (error) {
            console.warn(`Warning: Could not read file ${filePath}: ${error.message}`);
            return '';
        }
    }
}

/**
 * Pattern detection utilities
 */
class PatternDetector {
    static findHardcodedPercentages(content, filePath) {
        const findings = [];
        const patterns = [
            /\b(\d{1,3})\s*%/g,
            /\b(\d{1,2})\s*percent/gi,
            /\b(\d{1,2})\s*per\s*cent/gi
        ];

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern./* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: exec(content)) !== null) {
                const percentage = parseInt(match[1]);
                if (percentage >= 0 && percentage <= 100) {
                    findings.push({
                        file: filePath,
                        line: this.getLineNumber(content, match.index),
                        match: match[0],
                        percentage: percentage,
                        context: this.getContext(content, match.index)
                    });
                }
            }
        });

        return findings;
    }

    static findPlaceholderText(content, filePath) {
        const findings = [];
        const patterns = [
            /TODO\s*[:\-]\s*implement/gi,
            /FIXME\s*[:\-]\s*/gi,
            /XXX\s*[:\-]\s*/gi,
            /\bplaceholder\b/gi,
            /\btemp\b\s*(?:variable|file|data)?/gi
        ];

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern./* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: exec(content)) !== null) {
                findings.push({
                    file: filePath,
                    line: this.getLineNumber(content, match.index),
                    match: match[0],
                    type: 'placeholder',
                    context: this.getContext(content, match.index)
                });
            }
        });

        return findings;
    }

    static findTodoComments(content, filePath) {
        const findings = [];
        const patterns = [
            /TODO\s*[:\-]\s*.+/gi,
            /FIXME\s*[:\-]\s*.+/gi,
            /HACK\s*[:\-]\s*.+/gi,
            /NOTE\s*[:\-]\s*.+/gi,
            /BUG\s*[:\-]\s*.+/gi
        ];

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern./* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: exec(content)) !== null) {
                findings.push({
                    file: filePath,
                    line: this.getLineNumber(content, match.index),
                    match: match[0].trim(),
                    type: 'todo',
                    context: this.getContext(content, match.index)
                });
            }
        });

        return findings;
    }

    static getLineNumber(content, index) {
        const lines = content.substring(0, index).split('\n');
        return lines.length;
    }

    static getContext(content, index, contextSize = 50) {
        const start = Math.max(0, index - contextSize);
        const end = Math.min(content.length, index + contextSize);
        return content.substring(start, end).replace(/\s+/g, ' ').trim();
    }
}

/**
 * Report generator
 */
class ReportGenerator {
    static generateSummary(issues, scanResults) {
        return {
            summary: {
                totalFiles: scanResults.totalFiles,
                filesWithIssues: scanResults.filesWithIssues,
                totalFindings: scanResults.totalFindings,
                hardcodedPercentages: issues.hardcodedPercentages.length,
                placeholderText: issues.placeholderText.length,
                todoComments: issues.todoComments.length
            },
            details: issues
        };
    }

    static generateDetailedReport(issues, scanResults) {
        const report = this.generateSummary(issues, scanResults);
        
        report.analysis = {
            mostProblematicFiles: this.getMostProblematicFiles(issues),
            issueDistribution: this.getIssueDistribution(issues),
            recommendations: this.generateRecommendations(issues)
        };

        return report;
    }

    static getMostProblematicFiles(issues) {
        const fileCounts = {};
        
        [...issues.hardcodedPercentages, ...issues.placeholderText, ...issues.todoComments]
            .forEach(issue => {
                fileCounts[issue.file] = (fileCounts[issue.file] || 0) + 1;
            });

        return Object.entries(fileCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([file, count]) => ({ file, issueCount: count }));
    }

    static getIssueDistribution(issues) {
        return {
            hardcodedPercentages: issues.hardcodedPercentages.length,
            placeholderText: issues.placeholderText.length,
            todoComments: issues.todoComments.length
        };
    }

    static generateRecommendations(issues) {
        const recommendations = [];
        
        if (issues.hardcodedPercentages.length > 0) {
            recommendations.push({
                type: 'hardcoded_percentages',
                priority: 'medium',
                message: `Found ${issues.hardcodedPercentages.length} hardcoded percentages. Consider using configuration constants.`,
                action: 'Extract hardcoded values to configuration files or constants'
            });
        }

        if (issues.placeholderText.length > 0) {
            recommendations.push({
                type: 'placeholder_text',
                priority: 'high',
                message: `Found ${issues.placeholderText.length} placeholder text instances. These should be resolved.`,
                action: 'Replace placeholder text with actual implementation or proper comments'
            });
        }

        if (issues.todoComments.length > 10) {
            recommendations.push({
                type: 'todo_comments',
                priority: 'medium',
                message: `Found ${issues.todoComments.length} TODO comments. Consider addressing them.`,
                action: 'Review and resolve TODO comments, or move to project management system'
            });
        }

        return recommendations;
    }
}

/**
 * Refactored CodeQualityScanner class with reduced complexity
 */
class CodeQualityScanner {
    constructor() {
        this.resetIssues();
        this.scanResults = {
            totalFiles: 0,
            filesWithIssues: 0,
            totalFindings: 0
        };
    }

    resetIssues() {
        this.issues = {
            hardcodedPercentages: [],
            placeholderText: [],
            todoComments: []
        };
    }

    async scanDirectory(dirPath) {
        this.resetIssues();
        
        const files = FileSystemUtils.getAllFiles(dirPath);
        this.scanResults.totalFiles = files.length;

        for (const filePath of files) {
            await this.scanFile(filePath);
        }

        return this.generateReport();
    }

    async scanFile(filePath) {
        const content = FileSystemUtils.readFile(filePath);
        if (!content.trim()) {
            return;
        }

        const fileIssues = this.analyzeFile(content, filePath);
        this.addFileIssues(fileIssues);
    }

    analyzeFile(content, filePath) {
        return {
            hardcodedPercentages: PatternDetector.findHardcodedPercentages(content, filePath),
            placeholderText: PatternDetector.findPlaceholderText(content, filePath),
            todoComments: PatternDetector.findTodoComments(content, filePath)
        };
    }

    addFileIssues(fileIssues) {
        const hasIssues = Object.values(fileIssues).some(issueList => issueList.length > 0);
        
        if (hasIssues) {
            this.scanResults.filesWithIssues++;
            this.issues.hardcodedPercentages.push(...fileIssues.hardcodedPercentages);
            this.issues.placeholderText.push(...fileIssues.placeholderText);
            this.issues.todoComments.push(...fileIssues.todoComments);
            this.scanResults.totalFindings += 
                fileIssues.hardcodedPercentages.length + 
                fileIssues.placeholderText.length + 
                fileIssues.todoComments.length;
        }
    }

    generateReport() {
        return ReportGenerator.generateDetailedReport(this.issues, this.scanResults);
    }

    // Legacy methods for backward compatibility
    getAllFiles(dirPath, extensions) {
        return FileSystemUtils.getAllFiles(dirPath, extensions);
    }

    findHardcodedPercentages(content, filePath) {
        return PatternDetector.findHardcodedPercentages(content, filePath);
    }

    findPlaceholderText(content, filePath) {
        return PatternDetector.findPlaceholderText(content, filePath);
    }

    findTodoComments(content, filePath) {
        return PatternDetector.findTodoComments(content, filePath);
    }
}

export default CodeQualityScanner;
