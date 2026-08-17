/**
 * Cross-reference data-cleanup findings across scanners.
 */

function crossReferenceScannerResults(results = {}) {
    const privacyFindings = results['data-privacy']?.findings || [];
    const lineageFindings = results['data-lineage']?.findings || [];
    const deadCodeFindings = results['dead-code']?.findings || [];
    const unusedFindings = results['unused-files']?.findings || [];

    if (privacyFindings.length && lineageFindings.length) {
        const orphanedPaths = new Set(
            lineageFindings
                .filter((finding) => finding.type === 'orphaned-data')
                .map((finding) => finding.path)
        );

        if (orphanedPaths.size) {
            for (const finding of privacyFindings) {
                if (!orphanedPaths.has(finding.path)) continue;
                if (finding.severity === 'medium') {
                    finding.severity = 'high';
                } else if (finding.severity === 'low') {
                    finding.severity = 'medium';
                }
                finding.metadata = {
                    ...(finding.metadata || {}),
                    crossAnalyzerBoost: 'orphaned-data-with-pii'
                };
            }
        }
    }

    if (deadCodeFindings.length && unusedFindings.length) {
        const unusedPaths = new Set(unusedFindings.map((f) => f.path));
        for (const finding of deadCodeFindings) {
            if (!unusedPaths.has(finding.path)) continue;
            finding.metadata = {
                ...(finding.metadata || {}),
                crossAnalyzerBoost: 'dead-export-in-unused-file',
                trimHint: 'File is unused AND has dead exports — strong trim candidate after dynamic-import check'
            };
            if (finding.confidence === 'low') {
                finding.confidence = 'medium';
            }
        }
    }

    return results;
}

module.exports = {
    crossReferenceScannerResults
};
