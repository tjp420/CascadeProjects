/**
 * Negative Test Case: Fiction KPI Patterns
 * Expected Behavior: PASS — should NOT trigger fiction KPI findings
 * Reason: Uses dynamic/realistic values not in rejected fiction baseline
 * simplebeacon:fiction-kpi-patterns: test-negative-case
 */

function getCurrentMetrics() {
    return {
        completionRate: 87.5,
        aiConfidence: 91.2,
        totalFeatures: 12,
        issuesDetected: 3,
        modelAccuracy: 88.9,
        throughput: '482',
        optimizationsApplied: 5
    };
}

function fetchLiveData() {
    return fetch('/api/metrics').then((r) => r.json());
}

module.exports = { getCurrentMetrics, fetchLiveData };
