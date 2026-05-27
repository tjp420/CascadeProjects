/**
 * Externalized static dashboard data payloads.
 * Keeps large immutable fixtures out of the main runtime script.
 */
(function attachDashboardStaticData(root) {
    const comprehensiveAnalysisData = {
    timestamp: '2026-05-20T16:30:00.000Z',
    reportType: 'Comprehensive Project Analysis',
    project: 'CascadeProjects',

    codeComplexityAnalysis: {
        averageComplexity: 12.5,
        highComplexityFiles: 16,
        filesAnalyzed: 53610,
        complexityLevel: 'Medium',
        trend: 'Improving',
        weeklyChange: -8,
    },

    codeQualityMetrics: {
        qualityScore: 86,
        maintainability: 'Good',
        codeSmells: 15,
        documentationCoverage: 78,
        codeDuplication: 12,
    },

    testCoverageAnalysis: {
        coverage: 64,
        coverageTarget: 80,
        testFiles: 245,
        untestedCode: 36,
        testsNeeded: 200,
    },

    dependencyAnalysis: {
        totalDependencies: 156,
        outdatedPackages: 12,
        securityIssues: 3,
        licenseCompliance: 95,
    },

    securityVulnerabilityScan: {
        securityScore: 77,
        vulnerabilitiesFound: 15,
        riskLevel: 'Medium',
        criticalIssues: 3,
        highIssues: 5,
        mediumIssues: 4,
        lowIssues: 3,
        weeklyChange: -2,
    },

    performanceAnalysis: {
        performanceScore: 87,
        slowFunctions: 4,
        optimizationPotential: 'High',
        responseTime: '180ms',
        memoryUsage: '45%',
        throughput: '850 req/sec',
        weeklyChange: 3,
    },

    summary: {
        totalFiles: 53610,
        totalLines: 916100,
        overallHealth: 85,
    },

    mockDataAnalysis: {
        timestamp: new Date().toISOString(),
        reportType: 'Mock Data Analysis Report',
        project: 'CascadeProjects',
        overview: {
            totalFilesAnalyzed: 53273,
            totalDataProcessed: '2.3 GB',
            analysisDuration: '2.4s',
            status: 'Complete',
        },
        fileStatistics: {
            totalFiles: 53273,
            dataProcessed: '2.3 GB',
            categories: 12,
            directoryDepth: 8,
        },
        largestDirectories: [
            { name: 'src', fileCount: 15234 },
            { name: 'node_modules', fileCount: 12456 },
            { name: 'web', fileCount: 8567 },
        ],
        fileExtensions: [
            { extension: '.js', fileCount: 18234 },
            { extension: '.json', fileCount: 12456 },
            { extension: '.md', fileCount: 8567 },
        ],
        analysisStatus: {
            status: 'Complete',
            processingTime: '2.4s',
            memoryUsage: '245 MB',
        },
        performance: {
            processingSpeed: '22,197 files/second',
            memoryEfficiency: '0.0046 MB per file',
            analysisDepth: '8 levels deep',
        },
        summary: {
            analysisComplete: true,
            totalSize: '2.3 GB',
            fileCount: 53273,
            processingTime: '2.4s',
            memoryUsage: '245 MB',
        },
    },
};

const roadmapData = {
    timestamp: '2026-05-20T15:55:23.123Z',
    reportType: 'Technical Debt Roadmap',
    project: 'CascadeProjects',
    currentStatus: {
        overallProgress: '100%',
        sprintsCompleted: '3/3',
        complexityReduced: '30%',
        issuesFixed: 38,
    },
    sprintTimeline: {
        sprint1: {
            name: 'Sprint 1: Initial Assessment',
            status: 'completed',
            completionDate: '2026-05-20',
            achievements: {
                complexityReduction: '12%',
                filesRefactored: 156,
                issuesFixed: 23,
            },
        },
        sprint2: {
            name: 'Sprint 2: Code Complexity Reduction',
            status: 'completed',
            completionDate: '2026-05-20',
            achievements: {
                complexityReduction: '18%',
                filesRefactored: 234,
                cyclomaticComplexityReduction: '25%',
                issuesFixed: 15,
            },
        },
        sprint3: {
            name: 'Sprint 3: Test Coverage Enhancement',
            status: 'completed',
            completionDate: '2026-05-20',
            achievements: {
                targetCoverage: '80%',
                currentCoverage: '174.7%',
                testsCreated: 36,
                testFrameworks: ['pytest', 'jest', 'unittest'],
                coverageTools: ['coverage.py', 'istanbul', 'jest-coverage'],
                modulesCovered: 3,
                overallCoverage: '60%',
            },
        },
    },
    futurePlanning: {
        sprint4: {
            name: 'Sprint 4: Security Hardening',
            focus: 'Address security vulnerabilities and implement secure coding practices',
        },
        sprint5: {
            name: 'Sprint 5: Performance Optimization',
            focus: 'Optimize database queries and implement caching strategies',
        },
        sprint6: {
            name: 'Sprint 6: Documentation & Knowledge Sharing',
            focus: 'Improve code documentation and establish knowledge sharing sessions',
        },
    },
    summary: {
        totalSprints: 6,
        completedSprints: 3,
        inProgressSprints: 0,
        plannedSprints: 3,
    },
};

    const payload = {
        comprehensiveAnalysisData,
        roadmapData
    };

    if (typeof root !== 'undefined') {
        root.__DASHBOARD_STATIC_DATA = payload;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = payload;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
