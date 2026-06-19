const fs = require('fs');
const report = JSON.parse(fs.readFileSync('C:/Users/Trevor/CascadeProjects/ai-platform/.simplebeacon/report.json', 'utf8'));

// Simulate loadReport stale check
const src = report.sourceReport || report;
const qs = report.qualityScore != null ? report.qualityScore : src.qualityScore;
const sc = report.schemaCompliance != null ? report.schemaCompliance : src.schemaCompliance;
const cs = report.consistencyScore != null ? report.consistencyScore : src.consistencyScore;
console.log('Stale check values:', {qs, sc, cs});
console.log('Would reject?', qs == null && sc == null && cs == null);

// Check report structure
console.log('report.gate:', JSON.stringify(report.gate, null, 2).slice(0, 200));
console.log('report.detectedIssues length:', report.detectedIssues?.length);
console.log('report.remediationPhases length:', report.remediationPhases?.length);
