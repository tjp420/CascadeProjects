const { validateConfig } = require('../../packages/simplebeacon-cli/src/config-schema');

describe('config-schema validation hardening', () => {
    test('rejects absolute and traversing scanPaths entries', () => {
        const result = validateConfig({
            profile: 'standard',
            scanPaths: ['web/data', '/abs/path', '..\\outside']
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(
            expect.arrayContaining([
                expect.stringContaining('scanPaths entry must be repository-relative')
            ])
        );
    });

    test('rejects absolute and traversing productionPaths entries', () => {
        const result = validateConfig({
            profile: 'standard',
            productionPaths: ['server/', 'C:\\temp', '../src']
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(
            expect.arrayContaining([
                expect.stringContaining('productionPaths entry must be repository-relative')
            ])
        );
    });

    test('accepts normal relative scan and production paths', () => {
        const result = validateConfig({
            profile: 'standard',
            scanPaths: ['web/data', 'data/roadmap'],
            productionPaths: ['server/', 'src/']
        });

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });
});
