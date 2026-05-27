const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('trust CI helper tools', () => {
    let tmpRoot;

    beforeEach(() => {
        tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'trust-ci-'));
    });

    afterEach(() => {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    test('append-trust-step-summary prints fiction scope from published trust', () => {
        const platformRoot = path.join(tmpRoot, 'ai-platform');
        fs.mkdirSync(path.join(platformRoot, 'public'), { recursive: true });
        fs.mkdirSync(path.join(platformRoot, '.simplebeacon'), { recursive: true });
        fs.writeFileSync(path.join(platformRoot, 'public', 'trust-verification.json'), JSON.stringify({
            fictionScope: {
                mode: 'repository-json',
                walkRoot: '…/ai-platform',
                fictionJsonFilesScanned: 67,
                fictionSampleFilesScanned: 40
            }
        }), 'utf8');
        fs.writeFileSync(path.join(platformRoot, '.simplebeacon', 'trust-publish-audit.json'), JSON.stringify({
            verificationId: 'abc',
            remote: { status: 'skipped' }
        }), 'utf8');

        const result = spawnSync(
            process.execPath,
            [path.join(__dirname, '../../tools/append-trust-step-summary.js'), platformRoot],
            { encoding: 'utf8' }
        );
        expect(result.status).toBe(0);
        expect(result.stdout).toMatch(/Fiction \/ KPI scope/);
        expect(result.stdout).toMatch(/JSON pattern-checked: 67/);
    });

    test('scan-monorepo-report skips when roots are equal', () => {
        const result = spawnSync(
            process.execPath,
            [path.join(__dirname, '../../tools/scan-monorepo-report.js'), tmpRoot, tmpRoot],
            { encoding: 'utf8' }
        );
        expect(result.status).toBe(0);
        expect(result.stdout).toMatch(/skipped/i);
    });
});
