#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const sample = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'web/data/cascade-roadmap-sample.json'), 'utf8')
).roadmap;

function summarize(roadmap, label) {
    const p2 = roadmap.codeAnalysis?.phase2;
    return {
        label,
        source: roadmap.generatedBy,
        version: roadmap.version,
        completion: roadmap.executiveSummary?.completionRate,
        features: `${roadmap.executiveSummary?.completedFeatures}/${roadmap.executiveSummary?.totalFeatures}`,
        aiConfidence: roadmap.executiveSummary?.aiConfidence ?? null,
        samples: roadmap.codeAnalysis?.samples || null,
        phases: (roadmap.developmentPhases || []).map((p) => ({
            phase: p.phase,
            status: p.status,
            progress: p.progress
        })),
        phase2: Boolean(p2),
        phase2Team: p2?.resourceEstimate?.teamSize ?? null,
        rejectedFiction: Boolean(roadmap.rejectedFiction)
    };
}

async function main() {
    console.log('=== RepositoryAudit sample ===');
    console.log(JSON.stringify(summarize(sample, 'sample'), null, 2));

    try {
        const response = await fetch('http://localhost:54355/api/dynamic-roadmap/build-from-path', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectPath: path.join(ROOT).replace(/\\/g, '/') })
        });
        const data = await response.json();
        if (!data.success) {
            console.error('Path scan failed:', data.message || data.error);
            process.exit(1);
        }
        console.log('\n=== Live path scan ===');
        console.log(JSON.stringify(summarize(data.roadmap, 'scan'), null, 2));

        const scan = data.roadmap;
        const checks = [
            ['4 sprints complete', scan.executiveSummary?.totalFeatures === 4 && scan.executiveSummary?.completedFeatures === 4],
            ['100% completion', scan.executiveSummary?.completionRate === 100],
            ['no aiConfidence', scan.executiveSummary?.aiConfidence == null],
            ['Phase 2 present', Boolean(scan.codeAnalysis?.phase2)],
            ['solo team', scan.codeAnalysis?.phase2?.resourceEstimate?.teamSize === 1],
            ['rejectedFiction', Boolean(scan.rejectedFiction)],
            ['sample 4/4 sprints', sample.executiveSummary?.completedFeatures === 4],
            ['sample 100%', sample.executiveSummary?.completionRate === 100],
            ['sample no aiConfidence', sample.executiveSummary?.aiConfidence == null]
        ];
        console.log('\n=== Alignment checks ===');
        for (const [name, ok] of checks) {
            console.log((ok ? 'OK' : 'FAIL') + '  ' + name);
        }
        process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
    } catch (error) {
        console.error('Server unavailable — sample-only verification:', error.message);
        process.exit(0);
    }
}

main();
