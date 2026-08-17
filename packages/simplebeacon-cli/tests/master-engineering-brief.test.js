const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    buildMasterEngineeringBrief,
    formatMasterEngineeringMarkdown,
    writeMasterEngineeringArtifacts,
    YES_YOU_CAN_PLAYBOOKS
} = require('../src/lib/master-engineering-brief');
const { crossReferenceScannerResults } = require('../src/lib/cross-analyzer-intelligence');

test('buildMasterEngineeringBrief synthesizes ten cylinders and phases', () => {
    const brief = buildMasterEngineeringBrief(process.cwd(), {
        gateReport: {
            type: 'simplebeacon-report',
            gate: { pass: false, blockingCount: 2 },
            qualityScore: 72,
            rawIssues: [
                { severity: 'high', type: 'Production leak', pattern: 'sample-json', filePath: 'src/load.js' }
            ]
        },
        fileReduction: {
            type: 'data-cleanup-report',
            summary: { totalFindings: 10, unusedFileCandidates: 200 },
            fileReductionPlan: {
                totals: { safeToDeleteBytes: 1024 * 1024, reclaimableBytes: 2 * 1024 * 1024 },
                unusedFiles: { candidates: 200 },
                deadCode: { deadExports: 5 }
            },
            scanScope: { reportHealth: 'platform-scoped' }
        }
    });

    assert.equal(brief.tenCylinders.length, 10);
    assert.ok(brief.overallScore >= 0 && brief.overallScore <= 100);
    assert.ok((brief.phasedPlan || []).length >= 2);
    assert.ok((brief.yesYouCan || []).length >= 1);
    assert.match(formatMasterEngineeringMarkdown(brief), /Ten cylinders/);
    assert.match(brief.agentPrompt, /master engineer/i);
});

test('writeMasterEngineeringArtifacts persists json and markdown', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-master-'));
    const sb = path.join(root, '.simplebeacon');
    fs.mkdirSync(sb, { recursive: true });
    fs.writeFileSync(path.join(sb, 'report.json'), JSON.stringify({
        type: 'simplebeacon-report',
        gate: { pass: true, blockingCount: 0 },
        qualityScore: 95
    }), 'utf8');

    const out = writeMasterEngineeringArtifacts(root);
    assert.ok(fs.existsSync(out.jsonPath));
    assert.ok(fs.existsSync(out.mdPath));
    assert.match(fs.readFileSync(out.mdPath, 'utf8'), /Yes you can/i);
});

test('crossReferenceScannerResults boosts dead exports in unused files', () => {
    const results = crossReferenceScannerResults({
        'dead-code': {
            findings: [{
                type: 'dead-export',
                path: 'src/orphan.js',
                confidence: 'low',
                metadata: { symbol: 'x' }
            }]
        },
        'unused-files': {
            findings: [{ type: 'unused-file', path: 'src/orphan.js' }]
        }
    });
    const finding = results['dead-code'].findings[0];
    assert.equal(finding.confidence, 'medium');
    assert.equal(finding.metadata.crossAnalyzerBoost, 'dead-export-in-unused-file');
});

test('YES_YOU_CAN playbooks have triggers and resources', () => {
    assert.ok(YES_YOU_CAN_PLAYBOOKS.length >= 5);
    for (const pb of YES_YOU_CAN_PLAYBOOKS) {
        assert.ok(typeof pb.trigger === 'function');
        assert.ok(pb.othersSay && pb.youCan && pb.steps.length);
    }
});
