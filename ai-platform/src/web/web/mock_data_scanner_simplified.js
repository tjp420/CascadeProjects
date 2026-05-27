/**
 * Mock Data Scanner - Simplified Version
 * Provides mock data for AI Coding Intelligence Dashboard
 */

window.MockDataScanner = {
    // Mock project data
    getProjectData: function() {
        return {
            name: 'AI Coding Intelligence Dashboard',
            version: '2.1.0',
            totalFiles: 156,
            totalLines: 45892,
            languages: {
                JavaScript: 45,
                Python: 32,
                HTML: 28,
                CSS: 21,
                JSON: 15,
                Other: 15
            },
            lastUpdated: new Date().toISOString()
        };
    },

    // Mock code quality metrics
    getCodeQuality: function() {
        return {
            overallScore: 87,
            maintainability: 82,
            complexity: 75,
            duplication: 92,
            testCoverage: 78,
            technicalDebt: 15
        };
    },

    // Mock recent activity
    getRecentActivity: function() {
        return [
            {
                type: 'commit',
                message: 'Updated dashboard UI components',
                author: 'Developer',
                timestamp: new Date(Date.now() - 3600000).toISOString()
            },
            {
                type: 'issue',
                message: 'Fixed responsive design issues',
                author: 'Team Lead',
                timestamp: new Date(Date.now() - 7200000).toISOString()
            },
            {
                type: 'merge',
                message: 'Merged feature branch to main',
                author: 'DevOps',
                timestamp: new Date(Date.now() - 10800000).toISOString()
            }
        ];
    },

    // Mock performance metrics
    getPerformanceMetrics: function() {
        return {
            loadTime: 1.2,
            firstContentfulPaint: 0.8,
            largestContentfulPaint: 1.5,
            cumulativeLayoutShift: 0.05,
            totalBlockingTime: 45
        };
    },

    // Mock security scan results
    getSecurityResults: function() {
        return {
            critical: 0,
            high: 2,
            medium: 5,
            low: 12,
            info: 28,
            lastScan: new Date().toISOString()
        };
    },

    // Scan selected files (mock implementation)
    scanSelectedFiles: function(files) {
        console.log('Mock scanning files:', files);
        return Promise.resolve({
            success: true,
            data: this.getProjectData(),
            results: this.getProjectData()
        });
    },

    // Import analysis data
    importAnalysis: function() {
        console.log('Importing analysis data...');
        return Promise.resolve({
            success: true,
            data: {
                quality: this.getCodeQuality(),
                performance: this.getPerformanceMetrics(),
                security: this.getSecurityResults()
            }
        });
    },

    // Import mock data
    importMockData: function() {
        console.log('Importing mock data...');
        return Promise.resolve({
            success: true,
            data: this.getProjectData()
        });
    },

    // Generate priority classification
    generatePriorityClassification: function(issues) {
        const priorities = {
            critical: [],
            high: [],
            medium: [],
            low: []
        };

        // Mock classification logic
        const mockIssues = issues || [
            { type: 'security', severity: 'critical', message: 'Critical security vulnerability' },
            { type: 'performance', severity: 'high', message: 'Performance bottleneck detected' },
            { type: 'code-quality', severity: 'medium', message: 'Code quality improvement needed' },
            { type: 'documentation', severity: 'low', message: 'Documentation update required' }
        ];

        mockIssues.forEach(issue => {
            const severity = issue.severity || 'medium';
            if (priorities[severity]) {
                priorities[severity].push(issue);
            }
        });

        return {
            priorities,
            summary: {
                critical: priorities.critical.length,
                high: priorities.high.length,
                medium: priorities.medium.length,
                low: priorities.low.length,
                total: mockIssues.length
            }
        };
    },

    // Initialize the scanner
    init: function() {
        console.log('✅ Mock Data Scanner initialized');
        return true;
    }
};

// Auto-initialize when loaded
window.MockDataScanner.init();

// Make it globally available
if (typeof window !== 'undefined') {
    console.log('📋 MockDataScanner is now available:', typeof window.MockDataScanner);
}
