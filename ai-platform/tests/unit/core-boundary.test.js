const fs = require('fs');
const os = require('os');
const path = require('path');

const core = require('../../core');

describe('core extraction boundary', () => {
    test('exports issue analyzer, fix engine, api, severity hooks, and monitor', () => {
        expect(typeof core.GGUFIssueAnalyzer).toBe('function');
        expect(typeof core.GGUFFixEngine).toBe('function');
        expect(typeof core.GGUFIssuesAPI).toBe('function');
        expect(typeof core.severityScoring.analyzeWithModel).toBe('function');
        expect(typeof core.severityScoring.listAvailableProviders).toBe('function');
        expect(typeof core.fileMonitor.createIssueFileMonitor).toBe('function');
    });

    test('core engines map to legacy module implementations', () => {
        const legacyAnalyzer = require('../../src/core/GGUFIssueAnalyzer');
        const legacyFixEngine = require('../../src/core/GGUFFixEngine');
        expect(core.GGUFIssueAnalyzer).toBe(legacyAnalyzer);
        expect(core.GGUFFixEngine).toBe(legacyFixEngine);
    });

    test('file monitor creates analyzer with realtime enabled by default', () => {
        const monitor = core.fileMonitor.createIssueFileMonitor({ enableRealTime: false });
        expect(monitor).toBeInstanceOf(core.GGUFIssueAnalyzer);
        expect(monitor.options.enableRealTime).toBe(false);
        return monitor.cleanup();
    });

    test('core scan + fix + rollback flow runs without dashboard stack', async () => {
        const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'core-flow-'));
        const fixturePath = path.join(__dirname, '..', 'fixtures', 'core', 'core-flow.json');
        const fixtureContent = await fs.promises.readFile(fixturePath, 'utf8');
        const targetFile = path.join(tempDir, 'core-flow.js');
        const sourceWithIssue = `const fixture = ${fixtureContent};\nconsole.log(fixture);\n`;
        await fs.promises.writeFile(targetFile, sourceWithIssue, 'utf8');
        await fs.promises.mkdir(path.join(tempDir, 'data'), { recursive: true });
        const originalCwd = process.cwd();
        process.chdir(tempDir);

        const analyzer = new core.GGUFIssueAnalyzer({
            enableRealTime: false,
            enableAI: false
        });
        const fixEngine = new core.GGUFFixEngine({
            enableAI: false,
            enableValidation: true,
            backupDirectory: path.join(tempDir, 'backups')
        });

        try {
            const scan = await analyzer.analyzeFiles([targetFile]);
            expect(scan.totalFiles).toBe(1);
            expect(scan.issues.length).toBeGreaterThan(0);
            const targetIssue = scan.issues.find((issue) => issue.type === 'Console Statement');
            expect(targetIssue).toBeTruthy();

            const apply = await fixEngine.applyFix(targetIssue, 'console-statement');
            expect(apply.success).toBe(true);
            expect(apply.fixId).toBeTruthy();

            const afterFix = await fs.promises.readFile(targetFile, 'utf8');
            expect(afterFix).toMatch(/^\s*\/\/\s*console\.log\(fixture\)\s*;?\s*$/m);

            const rollback = await fixEngine.rollbackFix(apply.fixId);
            expect(rollback.success).toBe(true);

            const afterRollback = await fs.promises.readFile(targetFile, 'utf8');
            expect(afterRollback).toBe(sourceWithIssue);
        } finally {
            await analyzer.cleanup();
            await fixEngine.cleanup();
            process.chdir(originalCwd);
            await fs.promises.rm(tempDir, { recursive: true, force: true });
        }
    });
});
