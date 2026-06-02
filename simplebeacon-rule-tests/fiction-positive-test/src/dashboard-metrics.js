/**
 * Positive Test Case: Fiction KPI Patterns
 * Expected Behavior: FAIL — should trigger fiction KPI findings
 * Reason: Contains hardcoded rejected fiction values from baseline
 * simplebeacon:fiction-kpi-patterns: test-positive-case
 */

const dashboardMetrics = {
    completionRate: 74.17,
    aiConfidence: 98.5,
    totalFeatures: 47,
    issuesDetected: 156,
    modelAccuracy: 94.3,
    throughput: '1,559',
    optimizationsApplied: 8
};

const legacyReport = {
    featuresTracked: 9,
    openIssues: 1247,
    patternsIdentified: 156,
    aiOptimizationsApplied: 47
};

module.exports = { dashboardMetrics, legacyReport };
