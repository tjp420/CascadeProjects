/**
 * Mock Data Scanner - Simplified
 * Provides file scanning functionality with reduced complexity
 */

class MockDataScanner {
    constructor() {
        this.scanResults = null;
        this.isScanning = false;
        this.scanProgress = 0;
        this.totalFiles = 0;
        this.processedFiles = 0;
    }

    async scanFiles(files, progressCallback) {
        if (this.isScanning) {
            throw new Error('Scan already in progress');
        }

        this.isScanning = true;
        this.totalFiles = files.length;
        this.processedFiles = 0;
        this.scanProgress = 0;

        try {
            const results = {
                timestamp: new Date().toISOString(),
                summary: {
                    totalFiles: files.length,
                    totalIssues: 0,
                    criticalIssues: 0,
                    fixableIssues: 0,
                    filesWithIssues: 0
                },
                results: []
            };

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileResult = await this.scanFile(file);
                results.results.push(fileResult);
                
                this.processedFiles++;
                this.scanProgress = Math.round((i + 1) / files.length * 100);
                
                if (progressCallback) {
                    progressCallback(this.scanProgress, this.processedFiles, this.totalFiles);
                }

                // Add small delay to simulate processing
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            // Update summary
            results.summary.totalIssues = results.results.reduce((sum, file) => sum + file.issues.length, 0);
            results.summary.criticalIssues = results.results.reduce((sum, file) => 
                sum + file.issues.filter(issue => issue.severity === 'high').length, 0);
            results.summary.fixableIssues = results.results.reduce((sum, file) => 
                sum + file.issues.filter(issue => issue.fixable).length, 0);
            results.summary.filesWithIssues = results.results.filter(file => file.issues.length > 0).length;

            this.scanResults = results;
            return results;

        } finally {
            this.isScanning = false;
        }
    }

    async scanFile(file) {
        const fileExtension = this.getFileExtension(file.name);
        const fileSize = file.size || 0;
        
        // Generate mock issues based on file characteristics
        const issues = this.generateMockIssues(file.name, fileExtension, fileSize);

        return {
            file: file.name,
            path: file.path || file.name,
            size: fileSize,
            type: fileExtension,
            issues: issues
        };
    }

    getFileExtension(filename) {
        const parts = filename.split('.');
        return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'unknown';
    }

    generateMockIssues(filename, extension, size) {
        const issues = [];
        
        // Generate issues based on file type
        if (extension === 'js' || extension === 'ts') {
            if (Math.random() > 0.5) {
                issues.push({
                    type: 'Style',
                    severity: 'low',
                    description: 'Unused variable detected',
                    line: Math.floor(Math.random() * 100) + 1,
                    suggestion: 'Remove unused variable',
                    fixable: true
                });
            }
            
            if (Math.random() > 0.7) {
                issues.push({
                    type: 'Complexity',
                    severity: 'medium',
                    description: 'Function too complex',
                    line: Math.floor(Math.random() * 100) + 1,
                    suggestion: 'Break down into smaller functions',
                    fixable: true
                });
            }
        } else if (extension === 'py') {
            if (Math.random() > 0.6) {
                issues.push({
                    type: 'Style',
                    severity: 'low',
                    description: 'Line too long',
                    line: Math.floor(Math.random() * 100) + 1,
                    suggestion: 'Break long lines',
                    fixable: true
                });
            }
        }

        // Add file size related issue
        if (size > 10000 && Math.random() > 0.8) {
            issues.push({
                type: 'Performance',
                severity: 'medium',
                description: 'Large file detected',
                line: 1,
                suggestion: 'Consider splitting into smaller files',
                fixable: false
            });
        }

        return issues;
    }

    getScanResults() {
        return this.scanResults;
    }

    getHealthScore() {
        if (!this.scanResults) {
            return null;
        }
        
        const { totalIssues, criticalIssues, totalFiles } = this.scanResults.summary;
        
        if (totalFiles === 0) {
            return 100;
        }
        
        const issueRatio = totalIssues / totalFiles;
        const criticalRatio = criticalIssues / totalFiles;
        
        // Calculate health score (100 = perfect, 0 = worst)
        let score = 100;
        
        // Deduct points for issues
        score -= issueRatio * 10;  // 10 points per issue per file
        score -= criticalRatio * 30; // 30 points per critical issue per file
        
        // Ensure score is within bounds
        score = Math.max(0, Math.min(100, Math.round(score)));
        
        return score;
    }

    generatePriorityClassification(results) {
        if (!results || !results.summary) {
            return 'medium';
        }
        
        const { criticalIssues, totalIssues } = results.summary;
        
        if (criticalIssues > 0) {
            return 'high';
        } else if (totalIssues > 10) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    reset() {
        this.scanResults = null;
        this.isScanning = false;
        this.scanProgress = 0;
        this.totalFiles = 0;
        this.processedFiles = 0;
    }
}

// Export for global use
window.MockDataScanner = MockDataScanner;

// Also export the scan function for compatibility
window.scanSelectedFiles = async function(files, progressCallback) {
    if (!window.MockDataScanner) {
        throw new Error('MockDataScanner is not defined');
    }
    const scanner = new window.MockDataScanner();
    const results = await scanner.scanFiles(files, progressCallback);
    return {
        ...results,
        healthScore: scanner.getHealthScore(),
        priorityClassification: scanner.generatePriorityClassification(results)
    };
};
