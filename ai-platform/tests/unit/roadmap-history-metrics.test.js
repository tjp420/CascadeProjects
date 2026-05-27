const {
    normalizeProgressPercent,
    extractRoadmapHistoryMetrics,
    buildHistoryEntryFromRoadmap,
    isMisScopedFilesystemScan
} = require('../../server/lib/roadmap-history-metrics');

describe('roadmap history metrics', () => {
    test('prefers executiveSummary completion over legacy progressMetrics', () => {
        const metrics = extractRoadmapHistoryMetrics({
            executiveSummary: { completionRate: 100, projectHealth: 'Healthy' },
            progressMetrics: { overall: 73.07 },
            developmentProgress: { overall: 58 },
            projectStructure: { totalFiles: 187 },
            codeAnalysis: { structure: { totalFiles: 11226 } }
        });

        expect(metrics.progressPercent).toBe(100);
        expect(metrics.filesScanned).toBe(11226);
        expect(metrics.projectHealth).toBe('Healthy');
    });

    test('normalizeProgressPercent handles fractional values', () => {
        expect(normalizeProgressPercent(0.73)).toBe(73);
        expect(normalizeProgressPercent(73.07)).toBe(73);
    });

    test('buildHistoryEntryFromRoadmap preserves scan options', () => {
        const entry = buildHistoryEntryFromRoadmap({
            executiveSummary: { completionRate: 100, projectHealth: 'Healthy' },
            codeAnalysis: { structure: { totalFiles: 5000 } }
        }, {
            projectPath: 'C:\\Users\\Trevor\\CascadeProjects',
            title: 'CascadeProjects',
            scanOptions: {
                includePaths: ['ai-platform'],
                excludePatterns: ['node_modules']
            }
        });

        expect(entry.projectPath).toBe('C:\\Users\\Trevor\\CascadeProjects');
        expect(entry.progressPercent).toBe(100);
        expect(entry.filesScanned).toBe(5000);
        expect(entry.includePaths).toEqual(['ai-platform']);
        expect(entry.excludePatterns).toEqual(['node_modules']);
    });

    test('detects mis-scoped parent-repo filesystem scans', () => {
        expect(isMisScopedFilesystemScan({
            executiveSummary: { completionRate: 58 },
            progressMetrics: { overall: 73.07 },
            codeAnalysis: {
                signals: {
                    serverEntry: true,
                    stubApi: false,
                    pageSampleDir: false,
                    phase2Auth: false
                },
                samples: { onDisk: 0, withSpecs: 0 }
            }
        })).toBe(true);

        expect(isMisScopedFilesystemScan({
            executiveSummary: { completionRate: 100 },
            progressMetrics: { overall: 100 },
            codeAnalysis: {
                signals: {
                    serverEntry: true,
                    stubApi: true,
                    pageSampleDir: true,
                    phase2Auth: true
                },
                samples: { onDisk: 38, withSpecs: 38 }
            }
        })).toBe(false);
    });
});
