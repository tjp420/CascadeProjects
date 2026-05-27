/**
 * Roadmap Data Service
 * Dynamic data management system for roadmap data
 * Provides centralized data loading, caching, and validation
 */

class RoadmapDataService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.dataSources = {
            gguf: '/api/roadmap/data?type=gguf',
            ai: '/api/roadmap/data?type=ai-powered',
            static: 'static'
        };
    }

    /**
     * Load roadmap data from various sources
     */
    async loadRoadmapData(type = 'gguf') {
        const cacheKey = `roadmap_${type}`;
        const cached = this.cache.get(cacheKey);
        
        // Return cached data if still valid
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }

        try {
            let data;
            
            if (type === 'static') {
                data = await this.loadFromFile('/data/gguf-roadmap-sample.json');
            } else {
                data = await this.loadFromFile(this.dataSources[type]);
            }

            data = this.normalizeRoadmapData(data);

            // Validate data structure
            this.validateRoadmapData(data);
            
            // Cache the data
            this.cache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });

            return data;
        } catch (error) {
            console.error(`Failed to load roadmap data for type ${type}:`, error);
            try {
                return this.normalizeRoadmapData(await this.loadFromFile('/data/gguf-roadmap-sample.json'));
            } catch (fallbackError) {
                console.error('Roadmap sample fallback failed:', fallbackError);
                return this.normalizeRoadmapData({
                    type: 'gguf-development-roadmap-report',
                    title: 'Development Roadmap',
                    dataSource: 'repository-audit',
                    generatedAt: new Date().toISOString(),
                    projectOverview: {
                        totalFeatures: 0,
                        completedFeatures: 0,
                        inProgressFeatures: 0,
                        completionRate: '0%'
                    },
                    developmentPhases: []
                });
            }
        }
    }

    /**
     * Load data from external JSON file
     */
    async loadFromFile(filePath) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const payload = await response.json();
            return payload.data || payload;
        } catch (error) {
            console.error(`Failed to load file ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Get static roadmap data (fallback)
     */
    getStaticRoadmapData() {
        return {
            "type": "gguf-development-roadmap-report",
            "title": "GGUF-Powered Development Roadmap Report",
            "generatedAt": "2026-05-22T00:31:50.345Z",
            "generatedBy": "GGUF AI Model (unbreakable-oracle)",
            "modelInfo": {
                "name": "unbreakable-oracle",
                "type": "GGUF",
                "size": "1.88GB",
                "confidence": 98.5,
                "hash": "sha256-dde5aa3fc5ffc17176b5e8bdc82f587b24b2678c6c66101bf7da77af9f7ccdff",
                "status": "active"
            },
            "projectOverview": {
                "projectName": "AI Platform",
                "projectType": "Development Platform",
                "totalFeatures": 47,
                "completedFeatures": 31,
                "inProgressFeatures": 16,
                "plannedFeatures": 0,
                "completionRate": "66.0%",
                "overallProgress": "On Track",
                "projectHealth": "Excellent",
                "developmentVelocity": "High",
                "teamProductivity": "Very High"
            },
            "analysisOverview": {
                "totalMockFiles": 1247,
                "dataQualityScore": 89.2,
                "totalMockDataSize": "73.4MB",
                "issuesDetected": 156,
                "aiConfidence": 98,
                "analysisSpeed": "1559 files/second",
                "memoryUsage": "288MB",
                "cpuUsage": "1%"
            },
            "mockDataCategories": [
                {
                    "category": "User Profile Data",
                    "fileCount": 342,
                    "totalSize": "23.1MB",
                    "qualityScore": 91.2,
                    "issues": 2,
                    "confidence": 96.5,
                    "description": "User authentication and profile mock datasets"
                },
                {
                    "category": "API Response Data",
                    "fileCount": 289,
                    "totalSize": "18.7MB",
                    "qualityScore": 89.8,
                    "issues": 3,
                    "confidence": 94.2,
                    "description": "API endpoint response mock data and schemas"
                },
                {
                    "category": "Analytics Data",
                    "fileCount": 198,
                    "totalSize": "15.2MB",
                    "qualityScore": 85.4,
                    "issues": 1,
                    "confidence": 92.1,
                    "description": "Analytics and metrics mock datasets"
                },
                {
                    "category": "Configuration Data",
                    "fileCount": 156,
                    "totalSize": "8.9MB",
                    "qualityScore": 93.1,
                    "issues": 1,
                    "confidence": 95.8,
                    "description": "System configuration and environment mock data"
                },
                {
                    "category": "Test Scenario Data",
                    "fileCount": 262,
                    "totalSize": "7.5MB",
                    "qualityScore": 88.7,
                    "issues": 1,
                    "confidence": 93.4,
                    "description": "Test case and scenario mock datasets"
                }
            ],
            "qualityMetrics": {
                "dataIntegrity": 92.3,
                "schemaCompliance": 89.7,
                "consistencyScore": 87.6,
                "completenessScore": 91.2,
                "accuracyScore": 88.9,
                "overallQuality": 89.2
            },
            "detectedIssues": [
                {
                    "severity": "medium",
                    "type": "Data Inconsistency",
                    "count": 45,
                    "description": "Inconsistent data formats across similar mock files",
                    "recommendedAction": "Standardize data formats and schemas",
                    "affectedFiles": [
                        "mock_data_1.json",
                        "mock_data_7.json",
                        "mock_data_15.json"
                    ]
                },
                {
                    "severity": "low",
                    "type": "Missing Fields",
                    "count": 67,
                    "description": "Required fields missing in some mock datasets",
                    "recommendedAction": "Add missing required fields to ensure completeness",
                    "affectedFiles": [
                        "mock_data_3.json",
                        "mock_data_11.json"
                    ]
                },
                {
                    "severity": "low",
                    "type": "Duplicate Data",
                    "count": 23,
                    "description": "Duplicate entries found in mock datasets",
                    "recommendedAction": "Remove duplicate entries to optimize data size",
                    "affectedFiles": [
                        "mock_data_4.json",
                        "mock_data_9.json"
                    ]
                },
                {
                    "severity": "high",
                    "type": "Schema Violation",
                    "count": 21,
                    "description": "Mock data doesn't match expected schema structure",
                    "recommendedAction": "Update mock data to conform to schema requirements",
                    "affectedFiles": [
                        "mock_data_6.json"
                    ]
                }
            ],
            "ggufAIInsights": {
                "dataPatterns": [
                    "User authentication flows with session management",
                    "API response structures following REST conventions",
                    "Analytics metrics with time-series data patterns",
                    "Configuration objects with environment-specific settings",
                    "Test scenarios covering edge cases and boundary conditions"
                ],
                "optimizationRecommendations": [
                    {
                        "priority": "high",
                        "action": "Consolidate duplicate mock data patterns",
                        "description": "GGUF AI identified 23 duplicate patterns that can be consolidated",
                        "potentialSavings": "15.2MB reduction",
                        "impact": "High"
                    },
                    {
                        "priority": "medium",
                        "action": "Standardize JSON schema across all mock files",
                        "description": "Implement consistent schema structure for better maintainability",
                        "potentialSavings": "Improved data consistency",
                        "impact": "Medium"
                    },
                    {
                        "priority": "low",
                        "action": "Optimize data sizes for frequently used mocks",
                        "description": "Reduce file sizes for mock data used in automated testing",
                        "potentialSavings": "8.7MB reduction",
                        "impact": "Low"
                    }
                ],
                "qualityImprovements": [
                    "Add data validation rules to prevent schema violations",
                    "Implement automated testing for mock data integrity",
                    "Create mock data templates for consistent structure",
                    "Add documentation for mock data usage patterns"
                ]
            },
            "developmentPhases": [
                {
                    "phase": "Phase 1: Foundation",
                    "status": "completed",
                    "progress": 100,
                    "startDate": "2026-05-01",
                    "endDate": "2026-05-07",
                    "description": "Core infrastructure setup",
                    "features": [
                        "Server Setup",
                        "Database Integration",
                        "API Framework"
                    ],
                    "milestones": [
                        "✅ Environment Ready",
                        "✅ Database Connected",
                        "✅ API Endpoints Live"
                    ]
                },
                {
                    "phase": "Phase 2: GGUF Integration",
                    "status": "completed",
                    "progress": 100,
                    "startDate": "2026-05-08",
                    "endDate": "2026-05-14",
                    "description": "GGUF AI model integration",
                    "features": [
                        "GGUF Model Loading",
                        "Analysis Engine",
                        "Data Processing"
                    ],
                    "milestones": [
                        "✅ Model Integrated",
                        "✅ Analysis Working",
                        "✅ Data Pipeline Ready"
                    ]
                },
                {
                    "phase": "Phase 3: Dashboard Development",
                    "status": "completed",
                    "progress": 100,
                    "startDate": "2026-05-15",
                    "endDate": "2026-05-21",
                    "description": "Interactive dashboard creation",
                    "features": [
                        "UI Components",
                        "Data Visualization",
                        "User Interface"
                    ],
                    "milestones": [
                        "✅ Dashboard Live",
                        "✅ Interactive Charts",
                        "✅ User Testing Complete"
                    ]
                },
                {
                    "phase": "Phase 4: Enhancement",
                    "status": "in-progress",
                    "progress": 75,
                    "startDate": "2026-05-22",
                    "endDate": "2026-05-28",
                    "description": "Advanced features and optimization",
                    "features": [
                        "Real-time Updates",
                        "Export Features",
                        "Advanced Filtering"
                    ],
                    "milestones": [
                        "✅ Real-time Refresh",
                        "✅ Export System",
                        "🔄 Advanced Filters"
                    ]
                }
            ],
            "releaseTimeline": [
                {
                    "version": "v1.0.0",
                    "title": "AI Platform Foundation",
                    "date": "2026-05-21",
                    "status": "completed",
                    "description": "Initial release with core AI capabilities",
                    "features": [
                        "AI Platform Setup",
                        "Basic Processing",
                        "Core Architecture",
                        "GGUF Integration"
                    ],
                    "metrics": {
                        "performance": "Excellent",
                        "stability": "High",
                        "userSatisfaction": "95%",
                        "adoptionRate": "High"
                    }
                },
                {
                    "version": "v1.1.0",
                    "title": "AI Integration Complete",
                    "date": "2026-05-21",
                    "status": "completed",
                    "description": "Full AI integration with GGUF local processing",
                    "features": [
                        "AI Analysis Tools",
                        "Smart Processing",
                        "Automation",
                        "GGUF AI Enhancement"
                    ],
                    "metrics": {
                        "performance": "Excellent",
                        "stability": "High",
                        "userSatisfaction": "97%",
                        "adoptionRate": "Very High"
                    }
                },
                {
                    "version": "v2.0.0",
                    "title": "Advanced Analytics",
                    "date": "2026-07-15",
                    "status": "planned",
                    "description": "Advanced analytics and reporting with GGUF AI insights",
                    "features": [
                        "Analytics Dashboard",
                        "Reporting System",
                        "Performance Optimization",
                        "GGUF AI Insights"
                    ],
                    "metrics": {
                        "performance": "Target: Outstanding",
                        "stability": "Target: Very High",
                        "userSatisfaction": "Target: 98%",
                        "adoptionRate": "Target: Maximum"
                    }
                },
                {
                    "version": "v3.0.0",
                    "title": "Production Scale",
                    "date": "2026-12-15",
                    "status": "planned",
                    "description": "Production-scale deployment with GGUF AI orchestration",
                    "features": [
                        "Enterprise Features",
                        "Scaling Solutions",
                        "Production Deployment",
                        "GGUF AI Monitoring"
                    ],
                    "metrics": {
                        "performance": "Target: Exceptional",
                        "stability": "Target: Maximum",
                        "userSatisfaction": "Target: 99%",
                        "adoptionRate": "Target: Maximum"
                    }
                }
            ],
            "featureCategories": [
                {
                    "category": "AI Tools",
                    "totalFeatures": 20,
                    "completedFeatures": 17,
                    "completionRate": "85%",
                    "confidence": 96.5,
                    "description": "AI-powered development tools and utilities"
                },
                {
                    "category": "Analytics",
                    "totalFeatures": 18,
                    "completedFeatures": 13,
                    "completionRate": "72%",
                    "confidence": 94.2,
                    "description": "Analytics and reporting capabilities"
                },
                {
                    "category": "Development Tools",
                    "totalFeatures": 10,
                    "completedFeatures": 9,
                    "completionRate": "90%",
                    "confidence": 97.8,
                    "description": "Development and productivity tools"
                },
                {
                    "category": "Infrastructure",
                    "totalFeatures": 11,
                    "completedFeatures": 5,
                    "completionRate": "45%",
                    "confidence": 89.1,
                    "description": "Infrastructure and deployment systems"
                }
            ],
            "keyMilestones": [
                {
                    "milestone": "MVP Launch",
                    "date": "2026-05-21",
                    "status": "completed",
                    "description": "Minimum viable product with core AI features",
                    "achievement": "Successfully launched AI platform with GGUF integration"
                },
                {
                    "milestone": "AI Integration Complete",
                    "date": "2026-05-21",
                    "status": "completed",
                    "description": "Full AI processing and analysis capabilities",
                    "achievement": "GGUF AI fully integrated for local processing"
                },
                {
                    "milestone": "Performance Optimization",
                    "date": "2026-07-15",
                    "status": "in-progress",
                    "description": "System optimization for production readiness",
                    "achievement": "Performance improvements with GGUF AI insights"
                },
                {
                    "milestone": "Production Release",
                    "date": "2026-12-15",
                    "status": "planned",
                    "description": "Full production deployment and enterprise features",
                    "achievement": "Production-ready with GGUF AI monitoring"
                }
            ],
            "ggufAIInsights": {
                "projectHealth": "Excellent foundation with strong GGUF AI integration",
                "developmentVelocity": "High development velocity with AI assistance",
                "technicalDebt": "Low technical debt with GGUF optimization",
                "riskLevel": "Low risk with current implementation",
                "scalability": "Good scalability with GGUF AI orchestration",
                "innovation": "High innovation with local AI capabilities"
            },
            "ggufAIRecommendations": [
                {
                    "priority": "high",
                    "action": "Continue using GGUF AI for all development phases",
                    "description": "GGUF AI provides excellent insights for planning and optimization",
                    "impact": "High",
                    "effort": "Low",
                    "timeline": "Immediate"
                },
                {
                    "priority": "medium",
                    "action": "Expand GGUF model capabilities for advanced analytics",
                    "description": "Consider upgrading to larger GGUF models for enhanced capabilities",
                    "impact": "Medium",
                    "effort": "Medium",
                    "timeline": "Next Phase"
                },
                {
                    "priority": "medium",
                    "action": "Integrate GGUF AI with CI/CD pipeline",
                    "description": "Add GGUF AI to continuous integration and deployment",
                    "impact": "High",
                    "effort": "Medium",
                    "timeline": "Next Phase"
                },
                {
                    "priority": "low",
                    "action": "Monitor GGUF AI performance and usage patterns",
                    "description": "Track AI performance metrics and usage patterns",
                    "impact": "Low",
                    "effort": "Low",
                    "timeline": "Ongoing"
                }
            ],
            "performanceMetrics": {
                "analysisDuration": "0.8 seconds",
                "filesProcessedPerSecond": 1559,
                "memoryEfficiency": "High",
                "cpuOptimization": "Excellent",
                "scalabilityRating": "Very Good",
                "ggufProcessing": "Local and efficient"
            },
            "nextSteps": [
                "Complete Advanced Features phase (v2.0.0)",
                "Implement Testing & QA procedures",
                "Prepare for Production deployment (v3.0.0)",
                "Monitor and optimize GGUF AI performance",
                "Gather user feedback and iterate"
            ],
            "privacyAndSecurity": {
                "localProcessing": "All roadmap analysis stays on your machine",
                "completePrivacy": "No data sent to external services",
                "secure": "No external security risks",
                "offline": "Works without internet connection",
                "control": "You have complete control",
                "cost": "No API costs or subscription fees"
            },
            "aiTools": {
                "tools": [
                    {
                        "name": "GGUF Analysis Engine",
                        "status": "active",
                        "performance": {
                            "accuracy": 98.5,
                            "speed": "1559 files/second",
                            "memory": "288MB",
                            "cpu": "1%"
                        },
                        "usage": {
                            "totalAnalyses": 1247,
                            "successRate": 98.5,
                            "avgProcessingTime": "0.8 seconds"
                        }
                    },
                    {
                        "name": "Data Quality Monitor",
                        "status": "active",
                        "performance": {
                            "accuracy": 89.2,
                            "speed": "500 files/second",
                            "memory": "156MB",
                            "cpu": "0.5%"
                        },
                        "usage": {
                            "totalChecks": 1247,
                            "issuesFound": 156,
                            "avgProcessingTime": "0.3 seconds"
                        }
                    },
                    {
                        "name": "Optimization Engine",
                        "status": "active",
                        "performance": {
                            "accuracy": 95,
                            "speed": "200 patterns/second",
                            "memory": "98MB",
                            "cpu": "0.8%"
                        },
                        "usage": {
                            "totalOptimizations": 5,
                            "successRate": 100,
                            "avgProcessingTime": "1.2 seconds"
                        }
                    }
                ],
                "insights": {
                    "dataPatterns": [
                        "User authentication flows with session management",
                        "API response structures following REST conventions",
                        "Analytics metrics with time-series data patterns",
                        "Configuration objects with environment-specific settings",
                        "Test scenarios covering edge cases and boundary conditions"
                    ],
                    "optimizationRecommendations": [
                        {
                            "priority": "high",
                            "action": "Consolidate duplicate mock data patterns",
                            "description": "GGUF AI identified 23 duplicate patterns that can be consolidated",
                            "potentialSavings": "15.2MB reduction",
                            "impact": "High"
                        },
                        {
                            "priority": "medium",
                            "action": "Standardize JSON schema across all mock files",
                            "description": "Implement consistent schema structure for better maintainability",
                            "potentialSavings": "Improved data consistency",
                            "impact": "Medium"
                        },
                        {
                            "priority": "low",
                            "action": "Optimize data sizes for frequently used mocks",
                            "description": "Reduce file sizes for mock data used in automated testing",
                            "potentialSavings": "8.7MB reduction",
                            "impact": "Low"
                        }
                    ],
                    "qualityImprovements": [
                        "Add data validation rules to prevent schema violations",
                        "Implement automated testing for mock data integrity",
                        "Create mock data templates for consistent structure",
                        "Add documentation for mock data usage patterns"
                    ]
                },
                "metrics": {
                    "analysisDuration": "0.8 seconds",
                    "filesProcessedPerSecond": 1559,
                    "memoryEfficiency": "High",
                    "cpuOptimization": "Excellent",
                    "scalabilityRating": "Very Good"
                }
            },
            "analytics": {
                "performanceMetrics": {
                    "analysisDuration": "0.8 seconds",
                    "filesProcessedPerSecond": 1559,
                    "memoryEfficiency": "High",
                    "cpuOptimization": "Excellent",
                    "scalabilityRating": "Very Good"
                },
                "analysisOverview": {
                    "totalMockFiles": 1247,
                    "dataQualityScore": 89.2,
                    "totalMockDataSize": "73.4MB",
                    "issuesDetected": 156,
                    "aiConfidence": 98,
                    "analysisSpeed": "1559 files/second",
                    "memoryUsage": "288MB",
                    "cpuUsage": "1%"
                },
                "qualityMetrics": {
                    "dataIntegrity": 92.3,
                    "schemaCompliance": 89.7,
                    "consistencyScore": 87.6,
                    "completenessScore": 91.2,
                    "accuracyScore": 88.9,
                    "overallQuality": 89.2
                },
                "categories": [
                    {
                        "category": "User Profile Data",
                        "fileCount": 342,
                        "totalSize": "23.1MB",
                        "qualityScore": 91.2,
                        "issues": 2,
                        "confidence": 96.5,
                        "description": "User authentication and profile mock datasets"
                    },
                    {
                        "category": "API Response Data",
                        "fileCount": 289,
                        "totalSize": "18.7MB",
                        "qualityScore": 89.8,
                        "issues": 3,
                        "confidence": 94.2,
                        "description": "API endpoint response mock data and schemas"
                    },
                    {
                        "category": "Analytics Data",
                        "fileCount": 198,
                        "totalSize": "15.2MB",
                        "qualityScore": 85.4,
                        "issues": 1,
                        "confidence": 92.1,
                        "description": "Analytics and metrics mock datasets"
                    },
                    {
                        "category": "Configuration Data",
                        "fileCount": 156,
                        "totalSize": "8.9MB",
                        "qualityScore": 93.1,
                        "issues": 1,
                        "confidence": 95.8,
                        "description": "System configuration and environment mock data"
                    },
                    {
                        "category": "Test Scenario Data",
                        "fileCount": 262,
                        "totalSize": "7.5MB",
                        "qualityScore": 88.7,
                        "issues": 1,
                        "confidence": 93.4,
                        "description": "Test case and scenario mock datasets"
                    }
                ],
                "trends": {
                    "qualityTrend": [
                        {
                            "date": "2026-05-15",
                            "score": 85
                        },
                        {
                            "date": "2026-05-16",
                            "score": 87.2
                        },
                        {
                            "date": "2026-05-17",
                            "score": 88.5
                        },
                        {
                            "date": "2026-05-18",
                            "score": 89.2
                        },
                        {
                            "date": "2026-05-19",
                            "score": 89.2
                        },
                        {
                            "date": "2026-05-20",
                            "score": 89.2
                        },
                        {
                            "date": "2026-05-21",
                            "score": 89.2
                        }
                    ],
                    "volumeTrend": [
                        {
                            "date": "2026-05-15",
                            "files": 1100
                        },
                        {
                            "date": "2026-05-16",
                            "files": 1180
                        },
                        {
                            "date": "2026-05-17",
                            "files": 1220
                        },
                        {
                            "date": "2026-05-18",
                            "files": 1240
                        },
                        {
                            "date": "2026-05-19",
                            "files": 1247
                        },
                        {
                            "date": "2026-05-20",
                            "files": 1247
                        },
                        {
                            "date": "2026-05-21",
                            "files": 1247
                        }
                    ]
                }
            },
            "developmentTools": {
                "tools": [
                    {
                        "name": "Mock Data Generator",
                        "status": "active",
                        "usage": {
                            "totalGenerated": 1247,
                            "avgTime": "0.1 seconds",
                            "successRate": 99.8
                        }
                    },
                    {
                        "name": "Schema Validator",
                        "status": "active",
                        "usage": {
                            "totalValidations": 1247,
                            "avgTime": "0.05 seconds",
                            "successRate": 98.5
                        }
                    },
                    {
                        "name": "Quality Analyzer",
                        "status": "active",
                        "usage": {
                            "totalAnalyses": 1247,
                            "avgTime": "0.3 seconds",
                            "successRate": 97.2
                        }
                    }
                ],
                "patterns": [
                    "User authentication flows with session management",
                    "API response structures following REST conventions",
                    "Analytics metrics with time-series data patterns",
                    "Configuration objects with environment-specific settings",
                    "Test scenarios covering edge cases and boundary conditions"
                ],
                "issues": [
                    {
                        "severity": "medium",
                        "type": "Data Inconsistency",
                        "count": 45,
                        "description": "Inconsistent data formats across similar mock files",
                        "recommendedAction": "Standardize data formats and schemas",
                        "affectedFiles": [
                            "mock_data_1.json",
                            "mock_data_7.json",
                            "mock_data_15.json"
                        ]
                    },
                    {
                        "severity": "low",
                        "type": "Missing Fields",
                        "count": 67,
                        "description": "Required fields missing in some mock datasets",
                        "recommendedAction": "Add missing required fields to ensure completeness",
                        "affectedFiles": [
                            "mock_data_3.json",
                            "mock_data_11.json"
                        ]
                    },
                    {
                        "severity": "low",
                        "type": "Duplicate Data",
                        "count": 23,
                        "description": "Duplicate entries found in mock datasets",
                        "recommendedAction": "Remove duplicate entries to optimize data size",
                        "affectedFiles": [
                            "mock_data_4.json",
                            "mock_data_9.json"
                        ]
                    },
                    {
                        "severity": "high",
                        "type": "Schema Violation",
                        "count": 21,
                        "description": "Mock data doesn't match expected schema structure",
                        "recommendedAction": "Update mock data to conform to schema requirements",
                        "affectedFiles": [
                            "mock_data_6.json"
                        ]
                    }
                ],
                "recommendations": [
                    {
                        "priority": "high",
                        "action": "Consolidate duplicate mock data patterns",
                        "description": "GGUF AI identified 23 duplicate patterns that can be consolidated",
                        "potentialSavings": "15.2MB reduction",
                        "impact": "High"
                    },
                    {
                        "priority": "medium",
                        "action": "Standardize JSON schema across all mock files",
                        "description": "Implement consistent schema structure for better maintainability",
                        "potentialSavings": "Improved data consistency",
                        "impact": "Medium"
                    },
                    {
                        "priority": "low",
                        "action": "Optimize data sizes for frequently used mocks",
                        "description": "Reduce file sizes for mock data used in automated testing",
                        "potentialSavings": "8.7MB reduction",
                        "impact": "Low"
                    }
                ]
            },
            "technicalDebt": {
                "debtScore": 10.7,
                "categories": [
                    {
                        "category": "Schema Violations",
                        "score": 21,
                        "severity": "high",
                        "description": "Schema violations in mock data",
                        "affectedFiles": 1
                    },
                    {
                        "category": "Data Inconsistency",
                        "score": 45,
                        "severity": "medium",
                        "description": "Inconsistent data formats",
                        "affectedFiles": 3
                    },
                    {
                        "category": "Missing Fields",
                        "score": 67,
                        "severity": "low",
                        "description": "Missing required fields",
                        "affectedFiles": 2
                    },
                    {
                        "category": "Duplicate Data",
                        "score": 23,
                        "severity": "low",
                        "description": "Duplicate entries",
                        "affectedFiles": 2
                    }
                ],
                "qualityMetrics": {
                    "dataIntegrity": 92.3,
                    "schemaCompliance": 89.7,
                    "consistencyScore": 87.6,
                    "completenessScore": 91.2,
                    "accuracyScore": 88.9,
                    "overallQuality": 89.2
                },
                "recommendations": [
                    "Add data validation rules to prevent schema violations",
                    "Implement automated testing for mock data integrity",
                    "Create mock data templates for consistent structure",
                    "Add documentation for mock data usage patterns"
                ]
            },
            "projectResources": {
                "categories": [
                    {
                        "category": "User Profile Data",
                        "fileCount": 342,
                        "totalSize": "23.1MB",
                        "qualityScore": 91.2,
                        "issues": 2,
                        "confidence": 96.5,
                        "description": "User authentication and profile mock datasets"
                    },
                    {
                        "category": "API Response Data",
                        "fileCount": 289,
                        "totalSize": "18.7MB",
                        "qualityScore": 89.8,
                        "issues": 3,
                        "confidence": 94.2,
                        "description": "API endpoint response mock data and schemas"
                    },
                    {
                        "category": "Analytics Data",
                        "fileCount": 198,
                        "totalSize": "15.2MB",
                        "qualityScore": 85.4,
                        "issues": 1,
                        "confidence": 92.1,
                        "description": "Analytics and metrics mock datasets"
                    },
                    {
                        "category": "Configuration Data",
                        "fileCount": 156,
                        "totalSize": "8.9MB",
                        "qualityScore": 93.1,
                        "issues": 1,
                        "confidence": 95.8,
                        "description": "System configuration and environment mock data"
                    },
                    {
                        "category": "Test Scenario Data",
                        "fileCount": 262,
                        "totalSize": "7.5MB",
                        "qualityScore": 88.7,
                        "issues": 1,
                        "confidence": 93.4,
                        "description": "Test case and scenario mock datasets"
                    }
                ],
                "overview": {
                    "totalMockFiles": 1247,
                    "dataQualityScore": 89.2,
                    "totalMockDataSize": "73.4MB",
                    "issuesDetected": 156,
                    "aiConfidence": 98,
                    "analysisSpeed": "1559 files/second",
                    "memoryUsage": "288MB",
                    "cpuUsage": "1%"
                },
                "resources": [
                    {
                        "type": "Storage",
                        "used": "73.4MB",
                        "available": "500MB",
                        "utilization": 14.7
                    },
                    {
                        "type": "Processing",
                        "used": "288MB",
                        "available": "1GB",
                        "utilization": 28.1
                    },
                    {
                        "type": "Memory",
                        "used": "156MB",
                        "available": "2GB",
                        "utilization": 7.8
                    }
                ],
                "metrics": {
                    "analysisDuration": "0.8 seconds",
                    "filesProcessedPerSecond": 1559,
                    "memoryEfficiency": "High",
                    "cpuOptimization": "Excellent",
                    "scalabilityRating": "Very Good"
                },
                "nextSteps": [
                    "Address high-priority schema violations",
                    "Implement GGUF AI optimization recommendations",
                    "Standardize mock data schemas",
                    "Add automated validation for new mock data",
                    "Create comprehensive mock data documentation"
                ]
            }
        };
    }

    /**
     * Normalize roadmap payloads from API wrappers or legacy phase shapes
     */
    normalizePhaseStatus(status) {
        const normalized = String(status || 'planned').toLowerCase().replace('_', '-');
        if (normalized === 'upcoming') return 'planned';
        return normalized;
    }

    convertLegacyPhase(phase, index, generatedAt) {
        const title = phase.title || phase.phase || phase.name || `Phase ${index + 1}`;
        const status = this.normalizePhaseStatus(phase.status);
        const milestones = (phase.milestones || []).map((milestone) => {
            if (typeof milestone === 'string') return milestone;
            const name = milestone.name || milestone.milestone || milestone.title || 'Milestone';
            return {
                ...milestone,
                name,
                milestone: name,
                title: name
            };
        });
        const featureList = phase.features?.length
            ? phase.features
            : milestones.map((milestone) => {
                if (typeof milestone === 'string') return milestone;
                return milestone.completed ? `✓ ${milestone.name}` : `⏳ ${milestone.name}`;
            });

        return {
            ...phase,
            phase: phase.phase || title,
            title,
            status,
            date: phase.date || phase.endDate || phase.startDate || generatedAt || new Date().toISOString(),
            startDate: phase.startDate,
            endDate: phase.endDate,
            progress: phase.progress ?? 0,
            milestones,
            features: featureList
        };
    }

    buildProjectOverviewFromMetadata(metadata, phases, title) {
        const meta = metadata || {};
        const completed = meta.completedPhases ?? phases.filter((p) => this.normalizePhaseStatus(p.status) === 'completed').length;
        const inProgress = meta.inProgressPhases ?? phases.filter((p) => this.normalizePhaseStatus(p.status) === 'in-progress').length;
        const total = meta.totalPhases ?? phases.length;
        const upcoming = meta.upcomingPhases ?? Math.max(0, total - completed - inProgress);
        const overall = meta.overallProgress ?? (phases.length
            ? Math.round(phases.reduce((sum, phase) => sum + (phase.progress || 0), 0) / phases.length)
            : 0);

        return {
            projectName: meta.projectName || String(title || 'Development Roadmap').replace(/\s+Report$/i, ''),
            totalFeatures: meta.totalFeatures ?? total,
            completedFeatures: meta.completedFeatures ?? completed,
            inProgressFeatures: meta.inProgressFeatures ?? inProgress,
            plannedFeatures: meta.plannedFeatures ?? upcoming,
            completionRate: overall,
            overallProgress: meta.overallProgressLabel || (overall >= 75 ? 'On Track' : overall >= 40 ? 'In Progress' : 'Early Stage'),
            projectHealth: meta.projectHealth || 'Good',
            lastUpdated: meta.lastUpdated || null
        };
    }

    normalizeRoadmapData(data) {
        if (!data || typeof data !== 'object') {
            return data;
        }

        const normalized = { ...data };
        const generatedAt = normalized.generatedAt || normalized.timestamp || new Date().toISOString();

        if (!normalized.type) {
            normalized.type = 'gguf-development-roadmap-report';
        }
        if (!normalized.title) {
            normalized.title = normalized.projectOverview?.projectName
                ? `${normalized.projectOverview.projectName} Roadmap`
                : 'Development Roadmap Report';
        }
        if (!normalized.generatedAt) {
            normalized.generatedAt = generatedAt;
        }

        const legacyPhases = Array.isArray(normalized.phases) ? normalized.phases : [];
        const hasDevelopmentPhases = Array.isArray(normalized.developmentPhases) && normalized.developmentPhases.length > 0;

        if (!hasDevelopmentPhases && legacyPhases.length > 0) {
            normalized.developmentPhases = legacyPhases.map((phase, index) =>
                this.convertLegacyPhase(phase, index, generatedAt)
            );
        } else if (!Array.isArray(normalized.developmentPhases)) {
            normalized.developmentPhases = [];
        } else {
            normalized.developmentPhases = normalized.developmentPhases.map((phase, index) =>
                this.convertLegacyPhase(phase, index, generatedAt)
            );
        }

        const overview = normalized.projectOverview || {};
        const overviewEmpty = !overview.projectName
            && overview.totalFeatures == null
            && overview.completionRate == null
            && Object.keys(overview).length === 0;

        if (overviewEmpty && (normalized.metadata || normalized.developmentPhases.length)) {
            normalized.projectOverview = this.buildProjectOverviewFromMetadata(
                normalized.metadata,
                normalized.developmentPhases,
                normalized.title
            );
        } else if (!normalized.projectOverview) {
            normalized.projectOverview = {};
        }

        return normalized;
    }

    /**
     * Validate roadmap data structure
     */
    validateRoadmapData(data) {
        const requiredFields = ['type', 'title', 'generatedAt', 'projectOverview', 'developmentPhases'];
        
        for (const field of requiredFields) {
            if (!data[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        if (!Array.isArray(data.developmentPhases)) {
            throw new Error('developmentPhases must be an array');
        }

        // Validate each phase
        data.developmentPhases.forEach((phase, index) => {
            const requiredPhaseFields = ['phase', 'title', 'status', 'date'];
            for (const field of requiredPhaseFields) {
                if (!phase[field]) {
                    throw new Error(`Phase ${index} missing required field: ${field}`);
                }
            }
        });

        return true;
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get cache status
     */
    getCacheStatus() {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.entries()).map(([key, value]) => ({
                key,
                age: Date.now() - value.timestamp,
                valid: Date.now() - value.timestamp < this.cacheTimeout
            }))
        };
    }

    /**
     * Update roadmap data
     */
    async updateRoadmapData(type, data) {
        this.validateRoadmapData(data);
        
        // Update cache
        this.cache.set(`roadmap_${type}`, {
            data,
            timestamp: Date.now()
        });

        // Optionally save to external file (if implemented)
        // await this.saveToFile(type, data);
        
        return data;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoadmapDataService;
} else if (typeof window !== 'undefined') {
    window.RoadmapDataService = RoadmapDataService;
}
