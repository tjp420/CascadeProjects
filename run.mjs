import { runSimpleBeaconAudit } from './SimpleBeaconPoC.mjs';
import path from 'path';

const projectRoot = path.resolve('./');

console.log('🚀 Running SimpleBeacon Static Analysis Audit Pipeline...');
runSimpleBeaconAudit(projectRoot).then(report => {
    console.log('\n=== RECONCILED METRICS REPORT ===');
    console.log(`Total Core Scope Files: ${report.reconciledMetrics.totalFiles}`);
    console.log(`Total Core Scope Lines: ${report.reconciledMetrics.totalLines}`);
    console.log('\n=== ARCHITECTURAL GRAPH DEFENSE ===');
    console.log(`Cycles Detected: ${report.architecturalCyclesCount}`);
    if (report.detectedCycles.length > 0) {
        console.log('🚨 Critical Cycles Identified:\n', JSON.stringify(report.detectedCycles, null, 2));
    } else {
        console.log('✅ Graph contains 0 structural cycles.');
    }
    console.log('\n=== EU AI ACT COMPLIANCE FINDINGS ===');
    console.log(JSON.stringify(report.complianceFindings, null, 2));
}).catch(err => {
    console.error('Audit run encountered a fatal exception:', err);
});
