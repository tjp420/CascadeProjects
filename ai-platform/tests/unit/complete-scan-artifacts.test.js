const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    buildCompleteScanSummary,
    writeCompleteScanOutput
} = require('../../server/lib/complete-scan-artifacts');

describe('complete-scan artifacts', () => {
    let tempDir;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'complete-scan-artifacts-'));
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('writeCompleteScanOutput splits latest path into archive + summary', () => {
        const payload = {
            type: 'simplebeacon-complete-scan',
            version: '1.3.0',
            generatedAt: '2026-05-27T00:00:00.000Z',
            projectPath: tempDir,
            scanDurationMs: 1000,
            errors: [],
            summary: { stepCount: 8, stepsCompleted: 8 },
            results: { simplebeacon: { issueCount: 0 } }
        };
        const latestPath = path.join(tempDir, 'complete-scan-latest.json');
        const written = writeCompleteScanOutput(latestPath, payload);

        expect(written.archivePath).toBe(path.join(tempDir, 'archive', 'complete-scan-latest.json'));
        expect(fs.existsSync(written.archivePath)).toBe(true);
        expect(fs.existsSync(latestPath)).toBe(true);

        const archive = JSON.parse(fs.readFileSync(written.archivePath, 'utf8'));
        const summary = JSON.parse(fs.readFileSync(latestPath, 'utf8'));

        expect(archive.results.simplebeacon).toEqual({ issueCount: 0 });
        expect(summary.type).toBe('simplebeacon-complete-scan-summary');
        expect(summary.results).toBeUndefined();
        expect(summary.archivePath).toContain('archive/complete-scan-latest.json');
    });

    test('writeCompleteScanOutput writes full payload for non-latest paths', () => {
        const payload = {
            type: 'simplebeacon-complete-scan',
            version: '1.3.0',
            summary: { stepCount: 1 },
            results: { roadmap: { ok: true } }
        };
        const exportPath = path.join(tempDir, 'complete-scan-export.json');
        writeCompleteScanOutput(exportPath, payload);

        const saved = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
        expect(saved.results.roadmap).toEqual({ ok: true });
    });

    test('writeCompleteScanOutput writes full payload when path is under archive/', () => {
        const payload = {
            type: 'simplebeacon-complete-scan',
            version: '1.3.0',
            summary: { stepCount: 8 },
            results: { codebase: { ok: true } }
        };
        const archivePath = path.join(tempDir, 'archive', 'complete-scan-latest.json');
        const written = writeCompleteScanOutput(archivePath, payload);

        expect(written.archivePath).toBeNull();
        expect(written.summaryPath).toBeNull();
        expect(fs.existsSync(archivePath)).toBe(true);

        const saved = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
        expect(saved.type).toBe('simplebeacon-complete-scan');
        expect(saved.results.codebase).toEqual({ ok: true });
    });

    test('buildCompleteScanSummary preserves summary fields', () => {
        const summary = buildCompleteScanSummary({
            version: '1.2.0',
            generatedAt: '2026-01-01T00:00:00.000Z',
            projectPath: '/tmp/proj',
            scanDurationMs: 500,
            errors: ['x'],
            summary: { simplebeaconGatePass: true }
        });
        expect(summary.summary.simplebeaconGatePass).toBe(true);
        expect(summary.note).toMatch(/regenerate/i);
    });
});
