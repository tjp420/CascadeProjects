/**
 * True-Positive Fixture: fictionKpi engine
 * Engine ID: fictionKpi
 * Expected Finding: Fictional KPI (severity: medium+)
 * Language: JavaScript
 *
 * Contains hardcoded fictional KPIs using values from the GENERIC_REJECTED_FICTION
 * baseline (completionRates: [74.17, 87, 94.3, 66, 62], aiConfidenceScores: [98.5, 94.3, 87],
 * featureCounts: [47, 100, 156, 8, 9], openIssueCounts: [156, 999]).
 * The baseline.json in the fixture config provides these rejected fiction values.
 */

function getDashboardMetrics() {
  return {
    completionRate: 87, // Matches rejected fiction baseline
    aiConfidence: 98.5, // Matches rejected fiction baseline
    totalFeatures: 47, // Matches rejected fiction baseline
    issuesDetected: 156, // Matches rejected fiction baseline
    throughputClaim: "1559", // Matches rejected fiction baseline
  };
}

module.exports = { getDashboardMetrics };
