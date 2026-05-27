/**
 * Repository Analysis Monitor
 * Real-time monitoring and progress tracking for repository analysis
 */
class AnalysisMonitor {
    constructor() {
        this.analysisId = null;
        this.progress = 0;
        this.status = 'idle';
        this.results = null;
        this.startTime = null;
        this.estimatedDuration = 300000; // 5 minutes estimated
        this.callbacks = {
            onProgress: [],
            onComplete: [],
            onError: []
        };
    }

    startMonitoring(repositoryUrl, projectId) {
        this.startTime = Date.now();
        this.status = 'running';
        this.repositoryUrl = repositoryUrl;
        this.projectId = projectId;

        console.log('🔄 Starting repository analysis monitoring...');
        this.simulateProgress();
        this.pollForResults();
    }

    simulateProgress() {
        const progressSteps = [
            { progress: 10, status: 'Cloning repository...', phase: 'setup' },
            { progress: 25, status: 'Scanning code files...', phase: 'scanning' },
            { progress: 45, status: 'Analyzing dependencies...', phase: 'analysis' },
            { progress: 65, status: 'Security vulnerability assessment...', phase: 'security' },
            { progress: 80, status: 'Performance analysis...', phase: 'performance' },
            { progress: 90, status: 'Technical debt evaluation...', phase: 'debt' },
            { progress: 95, status: 'Generating reports...', phase: 'reporting' },
            { progress: 100, status: 'Analysis complete!', phase: 'complete' }
        ];

        let currentStep = 0;
        const progressInterval = setInterval(() => {
            if (currentStep < progressSteps.length && this.status === 'running') {
                const step = progressSteps[currentStep];
                this.progress = step.progress;
                this.currentPhase = step.phase;
                this.currentStatus = step.status;
                
                this.notifyProgress({
                    progress: this.progress,
                    phase: step.phase,
                    status: step.status,
                    elapsed: Date.now() - this.startTime,
                    estimatedRemaining: this.estimatedDuration - (Date.now() - this.startTime)
                });

                currentStep++;

                if (currentStep >= progressSteps.length) {
                    clearInterval(progressInterval);
                    this.completeAnalysis();
                }
            } else {
                clearInterval(progressInterval);
            }
        }, this.estimatedDuration / progressSteps.length);
    }

    async pollForResults() {
        const pollInterval = setInterval(async () => {
            if (this.status === 'running') {
                try {
                    // In a real implementation, this would poll the actual API
                    // For demo purposes, we'll simulate results after completion
                    if (this.progress >= 95) {
                        clearInterval(pollInterval);
                        await this.fetchResults();
                    }
                } catch (error) {
                    this.handleError(error);
                    clearInterval(pollInterval);
                }
            } else {
                clearInterval(pollInterval);
            }
        }, 5000); // Poll every 5 seconds
    }

    async fetchResults() {
        // Simulate fetching analysis results
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        this.results = {
            analysisId: this.analysisId || 'analysis_' + Date.now(),
            timestamp: new Date().toISOString(),
            repository: this.repositoryUrl,
            projectId: this.projectId,
            duration: Date.now() - this.startTime,
            summary: {
                codeQuality: 85,
                testCoverage: 78,
                securityScore: 92,
                performance: 88,
                technicalDebt: 'Medium',
                issuesFound: 2,
                filesAnalyzed: 150,
                linesOfCode: 15420
            },
            securityIssues: [
                {
                    severity: 'medium',
                    type: 'Potential SQL injection',
                    file: 'src/database/connection.js',
                    line: 45,
                    description: 'Unsanitized user input in database query'
                },
                {
                    severity: 'low',
                    type: 'Outdated dependency',
                    file: 'package.json',
                    line: 15,
                    description: 'Dependency lodash@4.17.20 has known vulnerabilities'
                }
            ],
            recommendations: {
                high: [],
                medium: [
                    'Implement input sanitization for database queries',
                    'Update lodash to latest stable version'
                ],
                low: [
                    'Add more comprehensive unit tests',
                    'Consider code splitting for better performance'
                ]
            },
            fileAnalysis: [
                {
                    file: 'src/components/Dashboard.jsx',
                    quality: 92,
                    complexity: 'Low',
                    issues: 0,
                    tests: true
                },
                {
                    file: 'src/api/routes.js',
                    quality: 78,
                    complexity: 'Medium',
                    issues: 1,
                    tests: false
                },
                {
                    file: 'src/utils/helpers.js',
                    quality: 85,
                    complexity: 'Low',
                    issues: 0,
                    tests: true
                }
            ],
            trends: {
                quality: [82, 84, 83, 85],
                coverage: [75, 76, 77, 78],
                security: [88, 90, 91, 92],
                dates: ['2024-01', '2024-02', '2024-03', '2024-04']
            }
        };

        this.completeAnalysis();
    }

    completeAnalysis() {
        this.status = 'completed';
        this.progress = 100;
        this.currentStatus = 'Analysis complete!';
        
        this.notifyComplete(this.results);
        console.log('✅ Repository analysis completed successfully!');
    }

    handleError(error) {
        this.status = 'error';
        this.currentStatus = `Error: ${error.message}`;
        this.notifyError(error);
        console.error('❌ Analysis failed:', error);
    }

    onProgress(callback) {
        this.callbacks.onProgress.push(callback);
    }

    onComplete(callback) {
        this.callbacks.onComplete.push(callback);
    }

    onError(callback) {
        this.callbacks.onError.push(callback);
    }

    notifyProgress(data) {
        this.callbacks.onProgress.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('Progress callback error:', error);
            }
        });
    }

    notifyComplete(results) {
        this.callbacks.onComplete.forEach(callback => {
            try {
                callback(results);
            } catch (error) {
                console.error('Complete callback error:', error);
            }
        });
    }

    notifyError(error) {
        this.callbacks.onError.forEach(callback => {
            try {
                callback(error);
            } catch (error) {
                console.error('Error callback error:', error);
            }
        });
    }

    exportResults(format = 'json') {
        if (!this.results) {
            throw new Error('No results available for export');
        }

        switch (format.toLowerCase()) {
        case 'json':
            return JSON.stringify(this.results, null, 2);
        case 'csv':
            return this.convertToCSV(this.results);
        case 'markdown':
            return this.convertToMarkdown(this.results);
        default:
            throw new Error(`Unsupported export format: ${format}`);
        }
    }

    convertToCSV(results) {
        const headers = ['File', 'Quality Score', 'Complexity', 'Issues', 'Has Tests'];
        const rows = results.fileAnalysis.map(file => [
            file.file,
            file.quality,
            file.complexity,
            file.issues,
            file.tests ? 'Yes' : 'No'
        ]);

        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    convertToMarkdown(results) {
        return `# Repository Analysis Report

## Summary
- **Code Quality**: ${results.summary.codeQuality}%
- **Test Coverage**: ${results.summary.testCoverage}%
- **Security Score**: ${results.summary.securityScore}%
- **Performance**: ${results.summary.performance}%
- **Technical Debt**: ${results.summary.technicalDebt}
- **Files Analyzed**: ${results.summary.filesAnalyzed}
- **Lines of Code**: ${results.summary.linesOfCode.toLocaleString()}

## Security Issues
${results.securityIssues.map(issue => 
        `### ${issue.severity.toUpperCase()}: ${issue.type}
- **File**: \`${issue.file}\` (line ${issue.line})
- **Description**: ${issue.description}
`).join('\n')}

## Recommendations
### Medium Priority
${results.recommendations.medium.map(rec => `- ${rec}`).join('\n')}

### Low Priority
${results.recommendations.low.map(rec => `- ${rec}`).join('\n')}

## File Analysis
${results.fileAnalysis.map(file => 
        `### ${file.file}
- **Quality**: ${file.quality}%
- **Complexity**: ${file.complexity}
- **Issues**: ${file.issues}
- **Tests**: ${file.tests ? '✅' : '❌'}
`).join('\n')}
`;
    }

    getMetrics() {
        return {
            progress: this.progress,
            status: this.status,
            elapsed: this.startTime ? Date.now() - this.startTime : 0,
            estimatedRemaining: this.status === 'running' ? 
                Math.max(0, this.estimatedDuration - (Date.now() - this.startTime)) : 0,
            currentPhase: this.currentPhase,
            currentStatus: this.currentStatus
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalysisMonitor;
}

// Export to global scope for use in regular scripts
if (typeof window !== 'undefined') {
    window.AnalysisMonitor = AnalysisMonitor;
}
