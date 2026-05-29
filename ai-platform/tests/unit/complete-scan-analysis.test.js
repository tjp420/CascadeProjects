const {
    classifyRegenerableArtifacts,
    softenPriorityActions
} = require('../../server/lib/complete-scan-artifact-profile');

describe('complete scan artifact profile', () => {
    test('classifyRegenerableArtifacts returns regenerableOnly for node_modules-only scan', () => {
        const analysis = {
            fileReduction: {
                safeToDeleteBytes: 91292524,
                reviewBeforeDeleteBytes: 0,
                unusedFileCandidates: 0,
                topSafeDirectories: [{
                    path: 'ai-platform/node_modules',
                    bytes: 91292524,
                    files: 16669,
                    category: 'node_modules'
                }]
            }
        };

        expect(classifyRegenerableArtifacts(analysis)).toBe('regenerableOnly');
    });

    test('classifyRegenerableArtifacts returns mixed when review bytes are present', () => {
        const analysis = {
            fileReduction: {
                safeToDeleteBytes: 91292524,
                reviewBeforeDeleteBytes: 4096,
                unusedFileCandidates: 0,
                topSafeDirectories: [{
                    path: 'ai-platform/node_modules',
                    category: 'node_modules'
                }]
            }
        };

        expect(classifyRegenerableArtifacts(analysis)).toBe('mixed');
    });

    test('classifyRegenerableArtifacts returns empty when no safe-to-delete signal', () => {
        expect(classifyRegenerableArtifacts({ fileReduction: { safeToDeleteBytes: 0, topSafeDirectories: [] } })).toBe('empty');
    });

    test('softenPriorityActions rewrites generic build-artifact priority for regenerableOnly', () => {
        const softened = softenPriorityActions([
            {
                priority: 'medium',
                title: 'Reclaim build artifact space',
                detail: '91292524 bytes in regenerable artifact directories'
            }
        ], 'regenerableOnly');

        expect(softened[0].title).toBe('Optional disk hygiene');
        expect(softened[0].detail).toMatch(/npm install/i);
    });
});
