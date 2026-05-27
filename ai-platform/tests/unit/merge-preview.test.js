const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildMergePreview, loadPreview } = require('../../server/lib/merge-preview');
const { executeSafeMerge, rollbackMerge, CONFIRMATION_PHRASE } = require('../../server/lib/safe-merge-guard');
const { buildDevSecOpsCompliancePayload } = require('../../server/lib/devsecops-compliance-payload');

describe('merge-preview + safe-merge-guard', () => {
    let tmpRoot;

    beforeEach(() => {
        tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-preview-'));
    });

    afterEach(() => {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    function writeJson(relativePath, payload) {
        const abs = path.join(tmpRoot, relativePath);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
        return relativePath.replace(/\\/g, '/');
    }

    test('buildMergePreview detects exact duplicate candidate', async () => {
        const relA = writeJson('data/a.json', { hello: 'world' });
        const relB = writeJson('data/b.json', { hello: 'world' });
        const preview = await buildMergePreview({
            projectRoot: tmpRoot,
            candidate: {
                id: 'exact-dup-1',
                mergeType: 'exact-duplicate',
                mergeStrategy: 'keep-one-delete-others',
                files: [
                    { path: relA, name: 'a.json', sizeBytes: 20 },
                    { path: relB, name: 'b.json', sizeBytes: 20 }
                ],
                savingsBytes: 20
            }
        });

        expect(preview.safeToExecute).toBe(true);
        expect(preview.removeFiles).toHaveLength(1);
        expect(preview.requiresConfirmation).toBe(true);
        expect(preview.riskAssessment.level).toBe('low');
        expect(preview.riskAssessment.quarantineOnly).toBe(true);
        expect(preview.confirmationPhrase).toBe(CONFIRMATION_PHRASE);
    });

    test('executeSafeMerge requires confirmation and quarantines duplicates', async () => {
        const relA = writeJson('samples/keep.json', { same: true });
        const relB = writeJson('samples/remove.json', { same: true });
        const preview = await buildMergePreview({
            projectRoot: tmpRoot,
            candidate: {
                id: 'exact-dup-2',
                mergeType: 'exact-duplicate',
                files: [
                    { path: relA, name: 'keep.json', sizeBytes: 16 },
                    { path: relB, name: 'remove.json', sizeBytes: 16 }
                ]
            }
        });

        await expect(executeSafeMerge({
            projectRoot: tmpRoot,
            previewId: preview.previewId,
            confirmed: false,
            confirmationPhrase: CONFIRMATION_PHRASE
        })).rejects.toThrow(/Confirmation required/);

        const result = await executeSafeMerge({
            projectRoot: tmpRoot,
            previewId: preview.previewId,
            confirmed: true,
            confirmationPhrase: CONFIRMATION_PHRASE
        });

        expect(result.quarantined).toHaveLength(1);
        expect(fs.existsSync(path.join(tmpRoot, relB))).toBe(false);
        expect(fs.existsSync(path.join(tmpRoot, relA))).toBe(true);

        const rolled = await rollbackMerge(tmpRoot, preview.previewId);
        expect(rolled.restored).toContain(relB);
        expect(fs.existsSync(path.join(tmpRoot, relB))).toBe(true);
    });

    test('buildDevSecOpsCompliancePayload includes unified scores', () => {
        const payload = buildDevSecOpsCompliancePayload({
            platformRoot: path.join(__dirname, '../..'),
            monorepoRoot: path.join(__dirname, '../../..')
        });
        expect(payload.type).toBe('simplebeacon-devsecops-compliance');
        expect(payload).toHaveProperty('securityScore');
        expect(payload).toHaveProperty('repositoryHealthScore');
        expect(payload.mergeAutoDeleteEnabled).toBe(false);
    });

    test('loadPreview marks expired previews', () => {
        const preview = {
            previewId: 'expired-1',
            generatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        };
        const dir = path.join(tmpRoot, '.simplebeacon', 'merge-previews');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'expired-1.json'), JSON.stringify(preview));
        expect(loadPreview(tmpRoot, 'expired-1')?.expired).toBe(true);
    });
});
