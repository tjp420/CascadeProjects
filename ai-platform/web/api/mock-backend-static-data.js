/**
 * Static payloads externalized from mock-backend.js.
 * Keeping large immutable fixtures in a companion file trims parse cost
 * and keeps endpoint behavior stable.
 */
(function attachMockBackendStaticData(root) {
    const staticData = {
        mockMockAnalysisReport: {
            type: 'mock-mock-data-analysis-report',
            title: 'Simplebeacon-Powered Mock Data Analysis Report',
            generatedAt: '2026-05-21T23:34:54.262Z',
            generatedBy: 'Simplebeacon (repository-audit)',
            modelInfo: {
                name: 'platform-checklist',
                type: 'Simplebeacon',
                size: '1.88GB',
                confidence: null,
                hash: 'sha256-dde5aa3fc5ffc17176b5e8bdc82f587b24b2678c6c66101bf7da77af9f7ccdff',
                status: 'active'
            },
            analysisOverview: {
                totalMockFiles: 48,
                dataQualityScore: 89.2,
                totalMockDataSize: '73.4MB',
                issuesDetected: null,
                aiConfidence: null,
                analysisSpeed: null,
                memoryUsage: '288MB',
                cpuUsage: '1%'
            },
            mockDataCategories: [
                {
                    category: 'User Profile Data',
                    fileCount: 342,
                    totalSize: '23.1MB',
                    qualityScore: 91.2,
                    issues: 2,
                    confidence: 96.5,
                    description: 'User authentication and profile mock datasets'
                },
                {
                    category: 'API Response Data',
                    fileCount: 289,
                    totalSize: '18.7MB',
                    qualityScore: 89.8,
                    issues: 3,
                    confidence: 94.2,
                    description: 'API endpoint response mock data and schemas'
                },
                {
                    category: 'Analytics Data',
                    fileCount: 198,
                    totalSize: '15.2MB',
                    qualityScore: 85.4,
                    issues: 1,
                    confidence: 92.1,
                    description: 'Analytics and metrics mock datasets'
                },
                {
                    category: 'Configuration Data',
                    fileCount: 156,
                    totalSize: '8.9MB',
                    qualityScore: 93.1,
                    issues: 1,
                    confidence: 95.8,
                    description: 'System configuration and environment mock data'
                },
                {
                    category: 'Test Scenario Data',
                    fileCount: 262,
                    totalSize: '7.5MB',
                    qualityScore: 88.7,
                    issues: 1,
                    confidence: 93.4,
                    description: 'Test case and scenario mock datasets'
                }
            ],
            qualityMetrics: {
                dataIntegrity: 92.3,
                schemaCompliance: 89.7,
                consistencyScore: 87.6,
                completenessScore: 91.2,
                accuracyScore: 88.9,
                overallQuality: 89.2
            },
            detectedIssues: [
                {
                    severity: 'medium',
                    type: 'Data Inconsistency',
                    count: 45,
                    description: 'Inconsistent data formats across similar mock files',
                    recommendedAction: 'Standardize data formats and schemas',
                    affectedFiles: [
                        'mock_data_1.json',
                        'mock_data_7.json',
                        'mock_data_15.json'
                    ]
                },
                {
                    severity: 'low',
                    type: 'Missing Fields',
                    count: 67,
                    description: 'Required fields missing in some mock datasets',
                    recommendedAction: 'Add missing required fields to ensure completeness',
                    affectedFiles: [
                        'mock_data_3.json',
                        'mock_data_11.json'
                    ]
                },
                {
                    severity: 'low',
                    type: 'Duplicate Data',
                    count: 23,
                    description: 'Duplicate entries found in mock datasets',
                    recommendedAction: 'Remove duplicate entries to optimize data size',
                    affectedFiles: [
                        'mock_data_4.json',
                        'mock_data_9.json'
                    ]
                },
                {
                    severity: 'high',
                    type: 'Schema Violation',
                    count: 21,
                    description: "Mock data doesn't match expected schema structure",
                    recommendedAction: 'Update mock data to conform to schema requirements',
                    affectedFiles: ['mock_data_6.json']
                }
            ],
            mockAIInsights: {
                dataPatterns: [
                    'User authentication flows with session management',
                    'API response structures following REST conventions',
                    'Analytics metrics with time-series data patterns',
                    'Configuration objects with environment-specific settings',
                    'Test scenarios covering edge cases and boundary conditions'
                ],
                optimizationRecommendations: [
                    {
                        priority: 'high',
                        action: 'Consolidate duplicate mock data patterns',
                        description: 'Simplebeacon AI identified 23 duplicate patterns that can be consolidated',
                        potentialSavings: '15.2MB reduction',
                        impact: 'High'
                    },
                    {
                        priority: 'medium',
                        action: 'Standardize JSON schema across all mock files',
                        description: 'Implement consistent schema structure for better maintainability',
                        potentialSavings: 'Improved data consistency',
                        impact: 'Medium'
                    },
                    {
                        priority: 'low',
                        action: 'Optimize data sizes for frequently used mocks',
                        description: 'Reduce file sizes for mock data used in automated testing',
                        potentialSavings: '8.7MB reduction',
                        impact: 'Low'
                    }
                ],
                qualityImprovements: [
                    'Add data validation rules to prevent schema violations',
                    'Implement automated testing for mock data integrity',
                    'Create mock data templates for consistent structure',
                    'Add documentation for mock data usage patterns'
                ]
            },
            performanceMetrics: {
                analysisDuration: '0.8 seconds',
                filesProcessedPerSecond: null,
                memoryEfficiency: 'High',
                cpuOptimization: 'Excellent',
                scalabilityRating: 'Very Good'
            },
            provenance: {
                confidence: 'Unverified historical fixture value removed during fiction remediation tranche.',
                issuesDetected: 'Unverified historical fixture value removed during fiction remediation tranche.',
                authoritativeSource: 'No deterministic source artifact available in this static fixture file.'
            },
            nextSteps: [
                'Address high-priority schema violations',
                'Implement Simplebeacon AI optimization recommendations',
                'Standardize mock data schemas',
                'Add automated validation for new mock data',
                'Create comprehensive mock data documentation'
            ],
            privacyAndSecurity: {
                localProcessing: 'All mock data analysis stays on your machine',
                completePrivacy: 'No data sent to external services',
                secure: 'No external security risks',
                offline: 'Works without internet connection',
                control: 'You have complete control',
                cost: 'No API costs or subscription fees'
            }
        }
    };

    if (typeof root !== 'undefined') {
        root.__MOCK_BACKEND_STATIC_DATA = staticData;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = staticData;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
