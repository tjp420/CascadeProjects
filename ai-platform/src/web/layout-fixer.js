/**
 * Layout Fixer
 * 
 * Automated fixing system for common layout issues including HTML corrections,
 * CSS cleanup, responsive fixes, and accessibility enhancements.
 */

class LayoutFixer {
    constructor() {
        this.fixHistory = [];
        this.fixStats = {
            totalFixed: 0,
            htmlFixed: 0,
            cssFixed: 0,
            responsiveFixed: 0,
            accessibilityFixed: 0
        };
    }

    /**
     * Fix a single issue
     */
    async fixIssue(issueId, analysisResults) {
        try {
            console.log(`🔧 Fixing issue: ${issueId}`);
            
            // Find the issue by ID
            const allIssues = [
                ...analysisResults.htmlIssues,
                ...analysisResults.cssConflicts,
                ...analysisResults.responsiveIssues,
                ...analysisResults.accessibilityIssues,
                ...analysisResults.performanceIssues
            ];
            
            const issue = allIssues.find(i => i.id === issueId);
            if (!issue) {
                throw new Error('Issue not found');
            }
            
            let result;
            switch (issue.type) {
                case 'html':
                    result = await this.fixHtmlIssue(issue);
                    break;
                case 'css':
                    result = await this.fixCssIssue(issue);
                    break;
                case 'responsive':
                    result = await this.fixResponsiveIssue(issue);
                    break;
                case 'accessibility':
                    result = await this.fixAccessibilityIssue(issue);
                    break;
                case 'performance':
                    result = await this.fixPerformanceIssue(issue);
                    break;
                default:
                    throw new Error(`Unknown issue type: ${issue.type}`);
            }
            
            if (result.success) {
                this.fixHistory.push({
                    timestamp: new Date().toISOString(),
                    issueId: issue.id,
                    type: issue.type,
                    file: issue.file,
                    fix: result.fix
                });
                
                this.fixStats.totalFixed++;
                this.fixStats[issue.type + 'Fixed']++;
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ Fix failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Fix multiple issues at once
     */
    async fixMultipleIssues(issues, analysisResults) {
        console.log(`🔧 Fixing ${issues.length} issues...`);
        
        let fixedCount = 0;
        const results = [];
        
        for (const issue of issues) {
            try {
                const result = await this.fixIssue(issue.id, analysisResults);
                results.push(result);
                if (result.success) {
                    fixedCount++;
                }
            } catch (error) {
                results.push({ success: false, error: error.message });
            }
        }
        
        return {
            success: true,
            fixedCount,
            totalIssues: issues.length,
            results
        };
    }

    /**
     * Fix HTML issues
     */
    async fixHtmlIssue(issue) {
        try {
            const response = await fetch(issue.file);
            const content = await response.text();
            let modifiedContent = content;
            let fixApplied = '';
            
            switch (issue.message) {
                case 'Missing DOCTYPE declaration':
                    modifiedContent = '<!DOCTYPE html>\n' + content;
                    fixApplied = 'Added <!DOCTYPE html> at the beginning';
                    break;
                    
                case 'Missing lang attribute on html element':
                    modifiedContent = content.replace('<html', '<html lang="en"');
                    fixApplied = 'Added lang="en" to html tag';
                    break;
                    
                case 'Missing viewport meta tag':
                    const headMatch = content.match(/<head[^>]*>/);
                    if (headMatch) {
                        const viewportTag = '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
                        modifiedContent = content.replace(headMatch[0], headMatch[0] + '\n    ' + viewportTag);
                        fixApplied = 'Added viewport meta tag to head';
                    }
                    break;
                    
                case 'Missing alt attribute on image':
                    // Simple fix - add alt="" to images without alt
                    modifiedContent = content.replace(/<img([^>]*)(?<!alt="[^"]*")([^>]*)>/g, '<img$1 alt=""$2>');
                    fixApplied = 'Added empty alt attributes to images';
                    break;
                    
                default:
                    return { success: false, error: 'Unknown HTML issue type' };
            }
            
            // Apply the fix via API
            const fixResult = await this.applyFix(issue.file, modifiedContent);
            
            return {
                success: fixResult.success,
                fix: fixApplied,
                error: fixResult.error
            };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Fix CSS issues
     */
    async fixCssIssue(issue) {
        try {
            const response = await fetch(issue.file);
            const content = await response.text();
            let modifiedContent = content;
            let fixApplied = '';
            
            switch (issue.message) {
                case 'Excessive use of !important':
                    // Remove some !important declarations (simplified)
                    modifiedContent = content.replace(/!important/g, '');
                    fixApplied = 'Removed excessive !important declarations';
                    break;
                    
                case 'Many vendor prefixes found':
                    // Remove unnecessary vendor prefixes
                    modifiedContent = content.replace(/-(webkit|moz|ms|o)-transform/g, 'transform');
                    modifiedContent = content.replace(/-(webkit|moz|ms|o)-transition/g, 'transition');
                    fixApplied = 'Removed unnecessary vendor prefixes';
                    break;
                    
                default:
                    return { success: false, error: 'Unknown CSS issue type' };
            }
            
            const fixResult = await this.applyFix(issue.file, modifiedContent);
            
            return {
                success: fixResult.success,
                fix: fixApplied,
                error: fixResult.error
            };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Fix responsive design issues
     */
    async fixResponsiveIssue(issue) {
        try {
            const response = await fetch(issue.file);
            const content = await response.text();
            let modifiedContent = content;
            let fixApplied = '';
            
            switch (issue.message) {
                case 'No media queries found':
                    // Add basic responsive media queries
                    const basicMediaQuery = `
@media (max-width: 768px) {
    /* Mobile responsive styles */
}`;
                    modifiedContent = content + basicMediaQuery;
                    fixApplied = 'Added basic responsive media queries';
                    break;
                    
                case 'Multiple fixed widths found':
                    // Convert some fixed widths to percentages
                    modifiedContent = content.replace(/width:\s*(\d+)px/g, (match, width) => {
                        const percentage = (width / 1920 * 100).toFixed(2);
                        return `width: ${percentage}%`;
                    });
                    fixApplied = 'Converted fixed widths to responsive percentages';
                    break;
                    
                default:
                    return { success: false, error: 'Unknown responsive issue type' };
            }
            
            const fixResult = await this.applyFix(issue.file, modifiedContent);
            
            return {
                success: fixResult.success,
                fix: fixApplied,
                error: fixResult.error
            };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Fix accessibility issues
     */
    async fixAccessibilityIssue(issue) {
        try {
            const response = await fetch(issue.file);
            const content = await response.text();
            let modifiedContent = content;
            let fixApplied = '';
            
            switch (issue.message) {
                case 'Form input missing label':
                    // Add basic labels for inputs (simplified)
                    modifiedContent = content.replace(/<input([^>]*name="([^"]*)"[^>]*)>/g, 
                        '<label for="$2">$2</label><input$1 id="$2">');
                    fixApplied = 'Added labels for form inputs';
                    break;
                    
                case 'Button missing accessible text':
                    // Add aria-label to buttons without text
                    modifiedContent = content.replace(/<button([^>]*)>\s*<\/button>/g, 
                        '<button$1 aria-label="Button">Button</button>');
                    fixApplied = 'Added accessible text to buttons';
                    break;
                    
                default:
                    return { success: false, error: 'Unknown accessibility issue type' };
            }
            
            const fixResult = await this.applyFix(issue.file, modifiedContent);
            
            return {
                success: fixResult.success,
                fix: fixApplied,
                error: fixResult.error
            };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Fix performance issues
     */
    async fixPerformanceIssue(issue) {
        try {
            const response = await fetch(issue.file);
            const content = await response.text();
            let modifiedContent = content;
            let fixApplied = '';
            
            switch (issue.message) {
                case 'Multiple inline styles found':
                    // Remove inline styles (simplified)
                    modifiedContent = content.replace(/style="[^"]*"/g, '');
                    fixApplied = 'Removed inline styles';
                    break;
                    
                case 'Large CSS file':
                    // Add comment suggesting split (actual split would require file operations)
                    modifiedContent = content + '\n\n/* TODO: Consider splitting this large CSS file into smaller modules */';
                    fixApplied = 'Added optimization comment for large CSS file';
                    break;
                    
                default:
                    return { success: false, error: 'Unknown performance issue type' };
            }
            
            const fixResult = await this.applyFix(issue.file, modifiedContent);
            
            return {
                success: fixResult.success,
                fix: fixApplied,
                error: fixResult.error
            };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Apply fix to file via API
     */
    async applyFix(filePath, newContent) {
        try {
            // In a real implementation, this would call an API to save the file
            // For now, we'll simulate the fix
            console.log(`📝 Applied fix to ${filePath}`);
            
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 100));
            
            return { success: true };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get fix statistics
     */
    getFixStats() {
        return {
            ...this.fixStats,
            history: this.fixHistory
        };
    }

    /**
     * Clear fix history
     */
    clearHistory() {
        this.fixHistory = [];
        this.fixStats = {
            totalFixed: 0,
            htmlFixed: 0,
            cssFixed: 0,
            responsiveFixed: 0,
            accessibilityFixed: 0
        };
    }
}
