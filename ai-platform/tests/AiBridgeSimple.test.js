/**
 * @jest-environment jsdom
 */

// Mock the AiBridgeSimple class for testing
const AiBridgeSimple = require('../web/dashboard_components/core/AiBridgeSimple.js');

describe('AiBridgeSimple', () => {
  let aiBridge;
  let mockData;
  let mockAnalysis;

  beforeEach(() => {
    aiBridge = new AiBridgeSimple();
    
    mockData = {
      total_files: 7780,
      total_directories: 156,
      file_types: {
        'JavaScript': 2723,
        'TypeScript': 1167,
        'HTML': 778,
        'CSS': 622,
        'JSON': 544,
        'Markdown': 389,
        'Python': 311,
        'Configuration': 467,
        'Other': 778
      },
      metrics: {
        Quality: 82,
        TestCoverage: 75,
        Complexity: 40,
        Maintainability: 60,
        Security: 90,
        Documentation: 85
      },
      source: 'api'
    };

    mockAnalysis = {
      overview: {
        totalFiles: 7780,
        totalDirectories: 156,
        totalLines: 1000000,
        codeQuality: 82,
        testCoverage: 75
      },
      fileTypes: mockData.file_types,
      recommendations: [],
      insights: []
    };
  });

  describe('Constructor', () => {
    test('should initialize with default values', () => {
      expect(aiBridge).toBeDefined();
    });
  });

  describe('Analysis Methods', () => {
    test('should analyze data correctly', () => {
      const analysis = aiBridge.analyze(mockData);
      
      expect(analysis.overview.totalFiles).toBe(7780);
      expect(analysis.overview.totalDirectories).toBe(156);
      expect(analysis.overview.codeQuality).toBe(82); // Should use API data
      expect(analysis.overview.testCoverage).toBe(75); // Should use API data
    });

    test('should use API metrics when available', () => {
      const analysis = aiBridge.analyze(mockData);
      
      expect(analysis.overview.codeQuality).toBe(82);
      expect(analysis.overview.testCoverage).toBe(75);
    });

    test('should fall back to calculated metrics when API data unavailable', () => {
      const dataWithoutMetrics = {
        total_files: 100,
        total_directories: 10,
        // No metrics object
      };

      const analysis = aiBridge.analyze(dataWithoutMetrics);
      
      expect(analysis.overview.codeQuality).toBeGreaterThanOrEqual(0);
      expect(analysis.overview.testCoverage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Code Quality Calculation', () => {
    test('should use API code quality when available', () => {
      const quality = aiBridge.calculateCodeQuality(mockData);
      expect(quality).toBe(82);
    });

    test('should fall back to calculation when API data unavailable', () => {
      const dataWithoutMetrics = {
        files: [
          { name: 'test.js', lines: 100 },
          { name: 'test.test.js', lines: 50 }
        ]
      };

      const quality = aiBridge.calculateCodeQuality(dataWithoutMetrics);
      expect(quality).toBeGreaterThanOrEqual(0);
      expect(quality).toBeLessThanOrEqual(100);
    });
  });

  describe('Test Coverage Calculation', () => {
    test('should use API test coverage when available', () => {
      const coverage = aiBridge.calculateTestCoverage(mockData);
      expect(coverage).toBe(75);
    });

    test('should fall back to calculation when API data unavailable', () => {
      const dataWithTestFiles = {
        files: [
          { name: 'app.js' },
          { name: 'app.test.js' },
          { name: 'utils.js' },
          { name: 'utils.spec.js' }
        ]
      };

      const coverage = aiBridge.calculateTestCoverage(dataWithTestFiles);
      expect(coverage).toBe(50); // 2 test files out of 4 total files
    });

    test('should return 0 when no test files found', () => {
      const dataWithoutTestFiles = {
        files: [
          { name: 'app.js' },
          { name: 'utils.js' }
        ]
      };

      const coverage = aiBridge.calculateTestCoverage(dataWithoutTestFiles);
      expect(coverage).toBe(0);
    });
  });

  describe('File Type Analysis', () => {
    test('should analyze file types correctly', () => {
      const fileTypes = aiBridge.analyzeFileTypes(mockData);
      
      expect(fileTypes).toEqual(mockData.file_types);
      expect(Object.keys(fileTypes).length).toBe(9);
    });

    test('should handle empty file types', () => {
      const dataWithoutFileTypes = {
        total_files: 100,
        total_directories: 10
      };

      const fileTypes = aiBridge.analyzeFileTypes(dataWithoutFileTypes);
      expect(Object.keys(fileTypes).length).toBe(0);
    });
  });

  describe('Recommendations Generation', () => {
    test('should generate recommendations based on analysis', () => {
      const recommendations = aiBridge.generateRecommendations(mockData);
      
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
    });

    test('should recommend test coverage improvements when coverage is low', () => {
      const dataWithLowCoverage = {
        ...mockData,
        metrics: {
          ...mockData.metrics,
          TestCoverage: 20
        }
      };

      const recommendations = aiBridge.generateRecommendations(dataWithLowCoverage);
      
      const testCoverageRec = recommendations.find(rec => 
        rec.title.includes('Test Coverage')
      );
      expect(testCoverageRec).toBeDefined();
      expect(testCoverageRec.priority).toBe('high');
    });

    test('should recommend code quality improvements when quality is low', () => {
      const dataWithLowQuality = {
        ...mockData,
        metrics: {
          ...mockData.metrics,
          Quality: 40
        }
      };

      const recommendations = aiBridge.generateRecommendations(dataWithLowQuality);
      
      const qualityRec = recommendations.find(rec => 
        rec.title.includes('Code Quality')
      );
      expect(qualityRec).toBeDefined();
      expect(qualityRec.priority).toBe('medium');
    });
  });

  describe('Insights Generation', () => {
    test('should generate insights based on analysis', () => {
      const insights = aiBridge.generateInsights(mockData);
      
      expect(Array.isArray(insights)).toBe(true);
      expect(insights.length).toBeGreaterThan(0);
    });

    test('should include project size insights', () => {
      const insights = aiBridge.generateInsights(mockData);
      
      const sizeInsight = insights.find(insight => 
        insight.includes('7780 files')
      );
      expect(sizeInsight).toBeDefined();
    });

    test('should include quality insights', () => {
      const insights = aiBridge.generateInsights(mockData);
      
      const qualityInsight = insights.find(insight => 
        insight.includes('82%')
      );
      expect(qualityInsight).toBeDefined();
    });
  });

  describe('Checklist Generation', () => {
    test('should generate comprehensive checklist', () => {
      const checklist = aiBridge.generateChecklist(mockData, mockAnalysis);
      
      expect(checklist).toBeDefined();
      expect(checklist.projectOverview).toBeDefined();
      expect(checklist.codeQuality).toBeDefined();
      expect(checklist.testing).toBeDefined();
      expect(checklist.security).toBeDefined();
      expect(checklist.documentation).toBeDefined();
      expect(checklist.deployment).toBeDefined();
      expect(checklist.monitoring).toBeDefined();
    });

    test('should mark completed items correctly', () => {
      const checklist = aiBridge.generateChecklist(mockData, mockAnalysis);
      
      const projectOverviewItems = checklist.projectOverview.items;
      const structureItem = projectOverviewItems.find(item => 
        item.task.includes('project structure')
      );
      expect(structureItem.status).toBe('✅'); // Should be completed with 7780 files
    });

    test('should mark incomplete items correctly', () => {
      const dataWithoutDocumentation = {
        ...mockData,
        file_types: {
          'JavaScript': 2723,
          'TypeScript': 1167
          // No README.md
        }
      };

      const checklist = aiBridge.generateChecklist(dataWithoutDocumentation, mockAnalysis);
      
      const docItems = checklist.documentation.items;
      const readmeItem = docItems.find(item => 
        item.task.includes('README')
      );
      expect(readmeItem.status).toBe('❌'); // Should be incomplete
    });
  });

  describe('Report Generation', () => {
    test('should generate markdown report', () => {
      const mockDownloadFile = jest.fn();
      aiBridge.downloadFile = mockDownloadFile;

      aiBridge.downloadReport(mockData, mockAnalysis, 'markdown');

      expect(mockDownloadFile).toHaveBeenCalledWith(
        expect.stringContaining('# Code Analysis Report'),
        'code-analysis-report.md',
        'text/markdown'
      );
    });

    test('should include correct metrics in report', () => {
      const mockDownloadFile = jest.fn();
      aiBridge.downloadFile = mockDownloadFile;

      aiBridge.downloadReport(mockData, mockAnalysis, 'markdown');

      const reportContent = mockDownloadFile.mock.calls[0][0];
      expect(reportContent).toContain('7780');
      expect(reportContent).toContain('156');
      expect(reportContent).toContain('82%');
      expect(reportContent).toContain('75%');
    });
  });

  describe('Checklist Report Generation', () => {
    test('should generate checklist report', () => {
      const mockDownloadFile = jest.fn();
      aiBridge.downloadFile = mockDownloadFile;

      aiBridge.generateChecklistReport(mockData, mockAnalysis);

      expect(mockDownloadFile).toHaveBeenCalledWith(
        expect.stringContaining('# Development Checklist'),
        'development-checklist.md',
        'text/markdown'
      );
    });

    test('should include progress summary in checklist', () => {
      const mockDownloadFile = jest.fn();
      aiBridge.downloadFile = mockDownloadFile;

      aiBridge.generateChecklistReport(mockData, mockAnalysis);

      const reportContent = mockDownloadFile.mock.calls[0][0];
      expect(reportContent).toContain('## 📋 Executive Summary');
      expect(reportContent).toContain('7780');
      expect(reportContent).toContain('156');
      expect(reportContent).toContain('82%');
      expect(reportContent).toContain('75%');
    });
  });

  describe('Error Handling', () => {
    test('should handle missing data gracefully', () => {
      const emptyData = {};
      
      expect(() => {
        aiBridge.analyze(emptyData);
      }).not.toThrow();
    });

    test('should handle null/undefined data', () => {
      expect(() => {
        aiBridge.analyze(null);
      }).not.toThrow();
      
      expect(() => {
        aiBridge.analyze(undefined);
      }).not.toThrow();
    });
  });
});
