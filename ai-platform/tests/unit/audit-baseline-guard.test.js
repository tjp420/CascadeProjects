const fs = require('fs');
const path = require('path');

describe('audit baseline tracker artifact', () => {
    const root = path.join(__dirname, '..', '..');
    const trackerPath = path.join(root, '.simplebeacon', 'audit-baseline-tracker.json');

    test('has required top-level metric keys', () => {
        const tracker = JSON.parse(fs.readFileSync(trackerPath, 'utf8'));

        expect(tracker).toHaveProperty('metrics.securityPosture');
        expect(tracker).toHaveProperty('metrics.testCountPassRate');
        expect(tracker).toHaveProperty('metrics.schemaCompliance');
        expect(tracker).toHaveProperty('metrics.scanQuality');
        expect(tracker).toHaveProperty('metrics.mockFileCount');
        expect(tracker).toHaveProperty('metrics.scanPathCount');
    });

    test('defines weekly commands for local and CI cadence', () => {
        const tracker = JSON.parse(fs.readFileSync(trackerPath, 'utf8'));
        const commands = tracker.weeklyReviewCommands || [];

        expect(commands).toEqual(
            expect.arrayContaining([
                'npm run simplebeacon:report',
                'npm run test:coverage',
                'npm run compliance:audit-baseline'
            ])
        );
    });
});
