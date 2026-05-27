const RoadmapDataAnalyzer = require('../../src/core/RoadmapDataAnalyzer');
const RoadmapDataService = require('../../web/scripts/roadmap-data-service.js');

describe('RoadmapDataService.normalizeRoadmapData', () => {
    test('maps legacy phases and metadata into dashboard shape', () => {
        const service = new RoadmapDataService();
        const normalized = service.normalizeRoadmapData({
            type: 'gguf-development-roadmap-report',
            title: 'Development Roadmap Report',
            generatedAt: '2026-05-23T07:10:31.316Z',
            projectOverview: {},
            developmentPhases: [],
            phases: [
                {
                    id: 'phase_1',
                    name: 'Foundation & Infrastructure',
                    status: 'completed',
                    progress: 100,
                    startDate: '2026-01-23T07:09:48.270Z',
                    endDate: '2026-02-22T07:09:48.270Z',
                    milestones: [{ id: 'm1', name: 'Infrastructure Setup', completed: true }]
                },
                {
                    id: 'phase_4',
                    name: 'Advanced Features',
                    status: 'upcoming',
                    progress: 25,
                    startDate: '2026-04-23T07:09:48.270Z',
                    endDate: '2026-05-23T07:09:48.270Z',
                    milestones: []
                }
            ],
            metadata: {
                totalPhases: 5,
                completedPhases: 2,
                inProgressPhases: 1,
                upcomingPhases: 2,
                overallProgress: 50
            }
        });

        expect(normalized.developmentPhases).toHaveLength(2);
        expect(normalized.developmentPhases[0].title).toBe('Foundation & Infrastructure');
        expect(normalized.developmentPhases[1].status).toBe('planned');
        expect(normalized.projectOverview.totalFeatures).toBe(5);
        expect(normalized.projectOverview.completedFeatures).toBe(2);
        expect(normalized.projectOverview.completionRate).toBe(50);
    });
});

describe('RoadmapDataAnalyzer scan options', () => {
    function createAnalyzer(options = {}) {
        return new RoadmapDataAnalyzer(null, {
            projectRoot: '/tmp/project',
            ...options
        });
    }

    test('shouldSkipDirectory honors custom exclude patterns', () => {
        const analyzer = createAnalyzer({ excludePatterns: ['tests', 'docs'] });
        expect(analyzer.shouldSkipDirectory('node_modules')).toBe(true);
        expect(analyzer.shouldSkipDirectory('tests')).toBe(true);
        expect(analyzer.shouldSkipDirectory('docs')).toBe(true);
        expect(analyzer.shouldSkipDirectory('src')).toBe(false);
    });

    test('stores includePaths from constructor options', () => {
        const analyzer = createAnalyzer({ includePaths: ['src', 'web'] });
        expect(analyzer.includePaths).toEqual(['src', 'web']);
    });
});
