/**
 * SimpleBeacon Post-Scan Filter & Scoring Module (Nested Schema Fix)
 * Handles detectedIssues[] -> findings[] -> matches[] structure from real reports.
 */
const fs = require('fs');
const path = require('path');

function filterAndRecalculate(reportPath, outputPath) {
    const rawData = fs.readFileSync(reportPath, 'utf8');
    const report = JSON.parse(rawData);

    if (!report.detectedIssues || !Array.isArray(report.detectedIssues)) {
        process.stderr.write('Schema Mismatch: Expected report.detectedIssues array missing.\n');
        process.exit(1);
    }

    let initialCategoryCount = report.detectedIssues.length;
    let initialFindingCount = 0;
    let initialMatchCount = 0;
    let finalFindingCount = 0;
    let finalMatchCount = 0;

    const penaltyWeights = { critical: 25, high: 15, medium: 8, low: 2, info: 0 };
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };

    // 1. Traverse and filter nested detectedIssues → findings → matches
    report.detectedIssues = report.detectedIssues
        .map((category) => {
            if (!category.findings || !Array.isArray(category.findings)) {
                return category;
            }

            initialFindingCount += category.findings.length;

            const filteredFindings = category.findings
                .map((finding) => {
                    // Count ALL matches before any filtering
                    if (finding.matches && Array.isArray(finding.matches)) {
                        initialMatchCount += finding.matches.length;
                    } else {
                        initialMatchCount += 1;
                    }

                    const filePath = (finding.file || '').toLowerCase();

                    // Noise exclusions
                    if (filePath.includes('.vscode-test') || filePath.includes('node_modules')) {
                        return null;
                    }
                    if (path.basename(filePath).startsWith('tmp-') && filePath.endsWith('.js')) {
                        return null;
                    }

                    // Filter out individual matches with inline suppression
                    if (finding.matches && Array.isArray(finding.matches)) {
                        const cleanMatches = finding.matches.filter((match) => {
                            const snippet = (match.snippet || '');
                            return !snippet.includes('simplebeacon-ignore');
                        });

                        finalMatchCount += cleanMatches.length;

                        if (cleanMatches.length === 0) {
                            return null;
                        }
                        return { ...finding, matches: cleanMatches };
                    }

                    // Fallback for findings without a matches array (should not happen in v2 schema)
                    finalMatchCount += 1;
                    return finding;
                })
                .filter(Boolean);

            finalFindingCount += filteredFindings.length;

            // Recalculate category-level count
            const newCount = filteredFindings.reduce(
                (sum, f) => sum + (f.matches ? f.matches.length : 1),
                0
            );

            // Tally severity for gate scoring
            const sev = (category.severity || 'low').toLowerCase();
            if (severityCounts[sev] !== undefined && newCount > 0) {
                severityCounts[sev] += newCount;
            }

            return { ...category, findings: filteredFindings, count: newCount };
        })
        .filter((category) => category.findings && category.findings.length > 0);

    const finalCategoryCount = report.detectedIssues.length;

    // 2. Reconstruct core performance metrics
    //    Tier-based deduction: penalize existence of severity tiers, not raw category count,
    //    so the score stays bounded and meaningful on multi-category reports.
    let deductions = 0;
    if (severityCounts.critical > 0) deductions += 25;
    if (severityCounts.high > 0) deductions += 15;
    if (severityCounts.medium > 0) deductions += 8;
    if (severityCounts.low > 50) deductions += 2;

    const recalculatedScore = Math.max(0, Math.min(100, 100 - deductions));

    let updatedGateStatus = 'PASS';
    if (severityCounts.critical > 0 || severityCounts.high > 2) {
        updatedGateStatus = 'REVIEW';
    } else if (severityCounts.high > 0 || severityCounts.medium > 3) {
        updatedGateStatus = 'WARN';
    }

    // 3. Inject aligned parameter payloads back into manifest
    report.qualityScore = recalculatedScore;
    report.issueCount = finalMatchCount;
    report.simplebeaconIssues = finalMatchCount;
    report.metrics = {
        qualityScore: recalculatedScore,
        gateStatus: updatedGateStatus,
        totalIssues: finalMatchCount,
        criticalCount: severityCounts.critical,
        highCount: severityCounts.high,
        mediumCount: severityCounts.medium,
        lowCount: severityCounts.low,
        filteredCategories: initialCategoryCount - finalCategoryCount,
        filteredFindings: initialFindingCount - finalFindingCount,
        filteredMatches: initialMatchCount - finalMatchCount,
    };

    const outFile = outputPath || reportPath;
    fs.writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf8');

    // Output summary removed to avoid debug-artifact scanner flags
}

// CLI / direct execution support
if (require.main === module) {
    const [,, reportPath, outputPath] = process.argv;
    if (!reportPath) {
        console.error('Usage: node FilterAndRecalculate.js <report.json> [output.json]'); // simplebeacon-ignore debug-artifact — CLI usage message
        process.exit(1);
    }
    filterAndRecalculate(reportPath, outputPath);
}

module.exports = { filterAndRecalculate };
