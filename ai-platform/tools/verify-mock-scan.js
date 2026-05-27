fetch('http://localhost:54355/api/models/active/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
})
    .then((r) => r.json())
    .then((data) => {
        const report = data.report || data;
        console.log(JSON.stringify({
            success: data.success,
            model: data.model?.name,
            inferenceMode: data.inferenceMode,
            generatedBy: report.generatedBy,
            modelName: report.modelInfo?.name,
            confidence: report.modelInfo?.confidence,
            aiConfidence: report.analysisOverview?.aiConfidence,
            mode: report.inferenceMeta?.mode,
            issues: report.analysisOverview?.issuesDetected,
            jestMismatches: (report.detectedIssues || []).filter((i) => i.type === 'Jest Count Mismatch').length,
            hasOracle: JSON.stringify(report).includes('unbreakable-oracle')
        }, null, 2));
    })
    .catch((e) => console.error(e));
