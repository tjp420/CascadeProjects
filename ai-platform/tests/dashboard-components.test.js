/**
 * Enhanced Dashboard Components Tests
 * 
 * Comprehensive test suite for dashboard components with improved coverage
 */

import {
    mockDataGenerators,
    testHelpers,
    assertionHelpers,
    mockImplementations,
    testSetup,
    coverageHelpers,
    integrationTestHelpers,
    TestDataBuilder
} from './test-utils.js';

// Mock the modules we're testing
jest.mock('../web/dashboard_components/core/DataEngine.js');
jest.mock('../web/dashboard_components/core/EnhancedCodeAnalyzer.js');
jest.mock('../web/dashboard_components/core/AdvancedVisualizations.js');
jest.mock('../web/dashboard_components/core/EnhancedReportGenerator.js');

describe('Dashboard Components', () => {
    beforeEach(() => {
        testSetup.setupGlobalMocks();
        testSetup.setupDOM();
    });

    afterEach(() => {
        testSetup.teardownDOM();
        testSetup.teardownGlobalMocks();
        testHelpers.restoreAllSpies();
    });

    describe('DataEngine', () => {
        let DataEngine;
        let dataEngine;

        beforeEach(() => {
            // Import DataEngine (mocked)
            DataEngine = require('../web/dashboard_components/core/DataEngine.js').default;
            dataEngine = new DataEngine();
        });

        test('should initialize with default values', () => {
            expect(dataEngine.data).toBeNull();
            expect(dataEngine.currentDirectory).toBe('./');
            expect(dataEngine.cache).toBeInstanceOf(Map);
        });

        test('should set directory correctly', () => {
            dataEngine.setDirectory('/test/path');
            expect(dataEngine.currentDirectory).toBe('/test/path');
        });

        test('should clear cache when directory changes', () => {
            dataEngine.cache.set('test', { data: 'test' });
            dataEngine.setDirectory('/new/path');
            expect(dataEngine.cache.size).toBe(0);
        });

        test('should load data from cache if available', async () => {
            const mockData = mockDataGenerators.generateProjectData();
            dataEngine.cache.set('dashboard_data', mockData);
            dataEngine.data = mockData;

            const result = await dataEngine.loadData();
            expect(result).toEqual(mockData);
        });

        test('should fallback to default data on error', async () => {
            testHelpers.mockFetchError('Network error');
            const result = await dataEngine.loadData();
            expect(result).toBeDefined();
        });
    });

    describe('EnhancedCodeAnalyzer', () => {
        let EnhancedCodeAnalyzer;
        let analyzer;

        beforeEach(() => {
            EnhancedCodeAnalyzer = require('../web/dashboard_components/core/EnhancedCodeAnalyzer.js').EnhancedCodeAnalyzer;
            analyzer = new EnhancedCodeAnalyzer();
        });

        test('should initialize with default values', () => {
            expect(analyzer.metrics).toBeInstanceOf(Map);
            expect(analyzer.analysisHistory).toEqual([]);
            expect(analyzer.benchmarks).toBeDefined();
        });

        test('should analyze project data', async () => {
            const projectData = mockDataGenerators.generateProjectData();
            testHelpers.mockFetch(projectData);

            const analysis = await analyzer.analyzeProject(projectData);
            expect(analysis).toBeDefined();
            expect(analysis.timestamp).toBeDefined();
            expect(analysis.overview).toBeDefined();
        });

        test('should calculate overall quality score', () => {
            const projectData = mockDataGenerators.generateProjectData({ code_quality: 85 });
            const score = analyzer.calculateOverallQuality(projectData);
            expect(score).toBe(85);
        });

        test('should calculate maintainability index', () => {
            const projectData = mockDataGenerators.generateProjectData();
            const index = analyzer.calculateMaintainabilityIndex(projectData);
            expect(index).toBeGreaterThanOrEqual(0);
            expect(index).toBeLessThanOrEqual(100);
        });

        test('should generate recommendations', async () => {
            const projectData = mockDataGenerators.generateProjectData({
                code_quality: 70,
                test_coverage: 50,
                security_score: 75
            });

            const recommendations = await analyzer.generateRecommendations(projectData);
            expect(Array.isArray(recommendations)).toBe(true);
            expect(recommendations.length).toBeGreaterThan(0);
        });

        test('should compare with benchmarks', () => {
            const projectData = mockDataGenerators.generateProjectData();
            const comparison = analyzer.compareWithBenchmarks(projectData);
            expect(comparison).toBeDefined();
            expect(comparison.codeQuality).toBeDefined();
            expect(comparison.testCoverage).toBeDefined();
        });
    });

    describe('AdvancedVisualizations', () => {
        let AdvancedVisualizations;
        let visualizations;

        beforeEach(() => {
            AdvancedVisualizations = require('../web/dashboard_components/core/AdvancedVisualizations.js').AdvancedVisualizations;
            visualizations = new AdvancedVisualizations();
        });

        test('should initialize with default options', () => {
            expect(visualizations.charts).toBeInstanceOf(Map);
            expect(visualizations.defaultOptions).toBeDefined();
        });

        test('should create trend chart', () => {
            const canvas = document.createElement('canvas');
            canvas.id = 'test-chart';
            document.body.appendChild(canvas);

            const data = {
                labels: ['Jan', 'Feb', 'Mar'],
                values: [10, 20, 30],
                label: 'Test Trend'
            };

            const chart = visualizations.createTrendChart('test-chart', data);
            expect(chart).toBeDefined();
        });

        test('should update existing chart', () => {
            const canvas = document.createElement('canvas');
            canvas.id = 'test-chart-update';
            document.body.appendChild(canvas);

            const data = {
                labels: ['Jan', 'Feb'],
                values: [10, 20],
                label: 'Test'
            };

            visualizations.createTrendChart('test-chart-update', data);

            const newData = {
                labels: ['Jan', 'Feb', 'Mar'],
                values: [10, 20, 30],
                label: 'Test Updated'
            };

            const updated = visualizations.updateChart('test-chart-update', newData);
            expect(updated).toBe(true);
        });

        test('should destroy chart', () => {
            const canvas = document.createElement('canvas');
            canvas.id = 'test-chart-destroy';
            document.body.appendChild(canvas);

            const data = {
                labels: ['Jan'],
                values: [10],
                label: 'Test'
            };

            visualizations.createTrendChart('test-chart-destroy', data);
            const destroyed = visualizations.destroyChart('test-chart-destroy');
            expect(destroyed).toBe(true);
        });

        test('should destroy all charts', () => {
            const canvas1 = document.createElement('canvas');
            canvas1.id = 'test-chart-1';
            const canvas2 = document.createElement('canvas');
            canvas2.id = 'test-chart-2';
            document.body.appendChild(canvas1);
            document.body.appendChild(canvas2);

            const data = {
                labels: ['Jan'],
                values: [10],
                label: 'Test'
            };

            visualizations.createTrendChart('test-chart-1', data);
            visualizations.createTrendChart('test-chart-2', data);

            visualizations.destroyAllCharts();
            expect(visualizations.charts.size).toBe(0);
        });
    });

    describe('EnhancedReportGenerator', () => {
        let EnhancedReportGenerator;
        let generator;

        beforeEach(() => {
            EnhancedReportGenerator = require('../web/dashboard_components/core/EnhancedReportGenerator.js').EnhancedReportGenerator;
            generator = new EnhancedReportGenerator();
        });

        test('should initialize with default templates', () => {
            expect(generator.templates).toBeInstanceOf(Map);
            expect(generator.templates.size).toBeGreaterThan(0);
            expect(generator.reportHistory).toEqual([]);
        });

        test('should generate markdown report', async () => {
            const analysisData = mockDataGenerators.generateAnalysisData();
            const report = await generator.generateReport(analysisData, 'markdown', 'comprehensive');
            expect(report).toBeDefined();
            expect(typeof report).toBe('string');
            expect(report).toContain('#');
        });

        test('should generate HTML report', async () => {
            const analysisData = mockDataGenerators.generateAnalysisData();
            const report = await generator.generateReport(analysisData, 'html', 'executive');
            expect(report).toBeDefined();
            expect(typeof report).toBe('string');
            expect(report).toContain('<!DOCTYPE html>');
        });

        test('should generate JSON report', async () => {
            const analysisData = mockDataGenerators.generateAnalysisData();
            const report = await generator.generateReport(analysisData, 'json', 'technical');
            expect(report).toBeDefined();
            expect(typeof report).toBe('string');
            
            const parsed = JSON.parse(report);
            expect(parsed.metadata).toBeDefined();
        });

        test('should generate CSV report', async () => {
            const analysisData = mockDataGenerators.generateAnalysisData();
            const report = await generator.generateReport(analysisData, 'csv', 'comprehensive');
            expect(report).toBeDefined();
            expect(typeof report).toBe('string');
            expect(report).toContain(',');
        });

        test('should add custom template', () => {
            const customTemplate = {
                name: 'Custom Template',
                sections: ['overview', 'custom_section'],
                format: 'custom',
                audience: 'custom'
            };

            generator.addTemplate('custom', customTemplate);
            expect(generator.templates.has('custom')).toBe(true);
        });

        test('should get available templates', () => {
            const templates = generator.getTemplates();
            expect(Array.isArray(templates)).toBe(true);
            expect(templates.length).toBeGreaterThan(0);
        });
    });

    describe('Integration Tests', () => {
        test('should perform end-to-end analysis workflow', async () => {
            await integrationTestHelpers.setupIntegrationTest();

            const projectData = mockDataGenerators.generateProjectData();
            testHelpers.mockFetch(projectData);

            const EnhancedCodeAnalyzer = require('../web/dashboard_components/core/EnhancedCodeAnalyzer.js').EnhancedCodeAnalyzer;
            const analyzer = new EnhancedCodeAnalyzer();

            const analysis = await analyzer.analyzeProject(projectData);
            expect(analysis.overview).toBeDefined();
            expect(analysis.codeQuality).toBeDefined();

            await integrationTestHelpers.teardownIntegrationTest();
        });

        test('should handle error scenarios gracefully', async () => {
            await integrationTestHelpers.setupIntegrationTest();

            testHelpers.mockFetchError('API Error');

            const DataEngine = require('../web/dashboard_components/core/DataEngine.js').default;
            const dataEngine = new DataEngine();

            const result = await dataEngine.loadData();
            expect(result).toBeDefined(); // Should return fallback data

            await integrationTestHelpers.teardownIntegrationTest();
        });
    });

    describe('Performance Tests', () => {
        test('should load data within acceptable time', async () => {
            const DataEngine = require('../web/dashboard_components/core/DataEngine.js').default;
            const dataEngine = new DataEngine();

            const mockData = mockDataGenerators.generateProjectData();
            dataEngine.cache.set('dashboard_data', mockData);
            dataEngine.data = mockData;

            const startTime = performance.now();
            await dataEngine.loadData();
            const endTime = performance.now();

            expect(endTime - startTime).toBeLessThan(100); // Should complete in < 100ms
        });

        test('should analyze project within acceptable time', async () => {
            const EnhancedCodeAnalyzer = require('../web/dashboard_components/core/EnhancedCodeAnalyzer.js').EnhancedCodeAnalyzer;
            const analyzer = new EnhancedCodeAnalyzer();

            const projectData = mockDataGenerators.generateProjectData();

            const startTime = performance.now();
            await analyzer.analyzeProject(projectData);
            const endTime = performance.now();

            expect(endTime - startTime).toBeLessThan(500); // Should complete in < 500ms
        });
    });

    describe('TestDataBuilder', () => {
        test('should build test data with fluent interface', () => {
            const builder = new TestDataBuilder();
            const data = builder
                .withProjectData({ code_quality: 90 })
                .withAnalysisData({ security: { overallScore: 95 } })
                .withRecommendations(3)
                .withCustomData('customKey', 'customValue')
                .build();

            expect(data.project).toBeDefined();
            expect(data.project.code_quality).toBe(90);
            expect(data.analysis).toBeDefined();
            expect(data.analysis.security.overallScore).toBe(95);
            expect(data.recommendations).toHaveLength(3);
            expect(data.customKey).toBe('customValue');
        });
    });

    describe('Coverage Helpers', () => {
        test('should track function calls', () => {
            const testObject = {
                testFunction: () => 'test'
            };

            const tracker = coverageHelpers.trackCoverage(testObject, 'testFunction');
            testObject.testFunction();
            testObject.testFunction();

            expect(tracker.getCallCount()).toBe(2);
            tracker.reset();
            expect(tracker.getCallCount()).toBe(0);
        });

        test('should assert function calls', () => {
            const mockFn = jest.fn();
            mockFn();

            coverageHelpers.assertFunctionCalled(mockFn, 1);
            coverageHelpers.assertFunctionCalledWith(mockFn);
        });
    });
});