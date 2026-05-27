/**
 * Dashboard Analytics Test Suite
 * 
 * Comprehensive test suite for the DashboardAnalytics class covering
 * dashboard controls, detailed reports, and analytics functionality.
 * Tests both happy paths and edge cases to ensure robust functionality.
 * 
 * @fileoverview Test suite for DashboardAnalytics class
 * @author Technical Debt Analysis Team
 * @since 1.0.0
 * @version 1.0.0
 */

// Mock DOM environment for testing
if (typeof window === 'undefined') {
  global.window = {
    fetch: jest.fn(),
    document: {
      createElement: jest.fn(),
      querySelector: jest.fn(),
      head: { appendChild: jest.fn() }
    },
    performance: {
      now: jest.fn(() => Date.now())
    }
  };
}

// Import the DashboardAnalytics
const DashboardAnalytics = require('../src/js/dashboard-analytics.js');

describe('DashboardAnalytics', () => {
  let analytics;

  beforeEach(() => {
    analytics = new DashboardAnalytics();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with default configuration', () => {
      expect(analytics).toBeDefined();
      expect(analytics.analyzers).toBeDefined();
      expect(analytics.metrics).toBeDefined();
      expect(analytics.isInitialized).toBe(false);
    });

    test('should accept custom configuration', () => {
      const customAnalytics = new DashboardAnalytics({
        refreshInterval: 5000,
        enableAutoRefresh: false
      });

      expect(customAnalytics.refreshInterval).toBe(5000);
      expect(customAnalytics.enableAutoRefresh).toBe(false);
    });
  });

  describe('findDashboardContainer', () => {
    test('should find dashboard container when it exists', () => {
      const mockContainer = { className: 'dashboard-content' };
      global.window.document.querySelector.mockReturnValue(mockContainer);

      const result = analytics.findDashboardContainer();

      expect(result).toBe(mockContainer);
      expect(global.window.document.querySelector).toHaveBeenCalledWith('.dashboard-content');
    });

    test('should return null when dashboard container not found', () => {
      global.window.document.querySelector.mockReturnValue(null);

      const result = analytics.findDashboardContainer();

      expect(result).toBeNull();
    });
  });

  describe('createAnalyticsSection', () => {
    test('should create analytics section with proper structure', () => {
      const section = analytics.createAnalyticsSection();

      expect(section).toBeDefined();
      expect(section.className).toBe('analytics-section');
      expect(section.innerHTML).toContain('📊 Analytics & Insights');
    });

    test('should include all required control buttons', () => {
      const section = analytics.createAnalyticsSection();

      expect(section.innerHTML).toContain('Run Analysis');
      expect(section.innerHTML).toContain('Export Reports');
      expect(section.innerHTML).toContain('Detailed Reports');
    });
  });

  describe('createAnalyticsCards', () => {
    test('should create all analytics cards', () => {
      const cards = analytics.createAnalyticsCards();

      expect(cards).toBeDefined();
      expect(cards.innerHTML).toContain('Code Quality');
      expect(cards.innerHTML).toContain('Security');
      expect(cards.innerHTML).toContain('Performance');
      expect(cards.innerHTML).toContain('Usage');
    });

    test('should include metric placeholders', () => {
      const cards = analytics.createAnalyticsCards();

      expect(cards.innerHTML).toContain('quality-score');
      expect(cards.innerHTML).toContain('security-score');
      expect(cards.innerHTML).toContain('performance-score');
      expect(cards.innerHTML).toContain('session-count');
    });
  });

  describe('createAnalyticsDetails', () => {
    test('should create analytics details section', () => {
      const details = analytics.createAnalyticsDetails();

      expect(details).toBeDefined();
      expect(details.className).toBe('analytics-details');
      expect(details.innerHTML).toContain('Code Quality');
      expect(details.innerHTML).toContain('Security');
      expect(details.innerHTML).toContain('Performance');
      expect(details.innerHTML).toContain('Usage');
    });

    test('should include tab navigation', () => {
      const details = analytics.createAnalyticsDetails();

      expect(details.innerHTML).toContain('tab-buttons');
      expect(details.innerHTML).toContain('tab-content');
      expect(details.innerHTML).toContain('quality-tab');
      expect(details.innerHTML).toContain('security-tab');
      expect(details.innerHTML).toContain('performance-tab');
      expect(details.innerHTML).toContain('usage-tab');
    });
  });

  describe('createTabButtons', () => {
    test('should create tab buttons for all categories', () => {
      const buttons = analytics.createTabButtons();

      expect(buttons).toBeDefined();
      expect(buttons.innerHTML).toContain('Code Quality');
      expect(buttons.innerHTML).toContain('Security');
      expect(buttons.innerHTML).toContain('Performance');
      expect(buttons.innerHTML).toContain('Usage');
    });

    test('should include proper onclick handlers', () => {
      const buttons = analytics.createTabButtons();

      expect(buttons.innerHTML).toContain('showTab(\'quality\')');
      expect(buttons.innerHTML).toContain('showTab(\'security\')');
      expect(buttons.innerHTML).toContain('showTab(\'performance\')');
      expect(buttons.innerHTML).toContain('showTab(\'usage\')');
    });
  });

  describe('createTabContent', () => {
    test('should create tab content panels', () => {
      const content = analytics.createTabContent();

      expect(content).toBeDefined();
      expect(content.innerHTML).toContain('quality-tab');
      expect(content.innerHTML).toContain('security-tab');
      expect(content.innerHTML).toContain('performance-tab');
      expect(content.innerHTML).toContain('usage-tab');
    });

    test('should include loading placeholders', () => {
      const content = analytics.createTabContent();

      expect(content.innerHTML).toContain('Loading quality report');
      expect(content.innerHTML).toContain('Loading security report');
      expect(content.innerHTML).toContain('Loading performance report');
      expect(content.innerHTML).toContain('Loading usage report');
    });
  });

  describe('addDashboardControls', () => {
    test('should add controls to existing dashboard', () => {
      const mockContainer = { appendChild: jest.fn() };
      global.window.document.querySelector.mockReturnValue(mockContainer);

      analytics.addDashboardControls();

      expect(mockContainer.appendChild).toHaveBeenCalledTimes(1);
      expect(global.window.document.querySelector).toHaveBeenCalledWith('.dashboard-content');
    });

    test('should handle missing dashboard container gracefully', () => {
      global.window.document.querySelector.mockReturnValue(null);

      expect(() => {
        analytics.addDashboardControls();
      }).not.toThrow();
    });
  });

  describe('showTab', () => {
    beforeEach(() => {
      // Mock DOM elements
      const mockTabs = [
        { className: 'tab-panel', style: { display: 'block' } },
        { className: 'tab-panel', style: { display: 'block' } },
        { className: 'tab-panel', style: { display: 'block' } },
        { className: 'tab-panel', style: { display: 'block' } }
      ];
      
      const mockButtons = [
        { className: 'tab-btn', classList: { remove: jest.fn(), add: jest.fn() } },
        { className: 'tab-btn', classList: { remove: jest.fn(), add: jest.fn() } },
        { className: 'tab-btn', classList: { remove: jest.fn(), add: jest.fn() } },
        { className: 'tab-btn', classList: { remove: jest.fn(), add: jest.fn() } }
      ];

      global.window.document.querySelectorAll = jest.fn((selector) => {
        if (selector === '.tab-panel') {
return mockTabs;
}
        if (selector === '.tab-btn') {
return mockButtons;
}
        return [];
      });
    });

    test('should show quality tab when requested', () => {
      analytics.showTab('quality');

      const mockTabs = global.window.document.querySelectorAll('.tab-panel');
      const mockButtons = global.window.document.querySelectorAll('.tab-btn');

      expect(mockTabs[0].style.display).toBe('block');
      expect(mockTabs[1].style.display).toBe('none');
      expect(mockTabs[2].style.display).toBe('none');
      expect(mockTabs[3].style.display).toBe('none');

      expect(mockButtons[0].classList.remove).toHaveBeenCalledWith('active');
      expect(mockButtons[0].classList.add).toHaveBeenCalledWith('active');
    });

    test('should show security tab when requested', () => {
      analytics.showTab('security');

      const mockTabs = global.window.document.querySelectorAll('.tab-panel');

      expect(mockTabs[0].style.display).toBe('none');
      expect(mockTabs[1].style.display).toBe('block');
      expect(mockTabs[2].style.display).toBe('none');
      expect(mockTabs[3].style.display).toBe('none');
    });

    test('should handle invalid tab names gracefully', () => {
      expect(() => {
        analytics.showTab('invalid');
      }).not.toThrow();
    });
  });

  describe('runAllAnalysis', () => {
    test('should run all analyzer modules', async () => {
      // Mock analyzer methods
      analytics.analyzers = {
        codeQuality: { analyze: jest.fn().mockResolvedValue({ score: 85 }) },
        security: { analyze: jest.fn().mockResolvedValue({ score: 90 }) },
        performance: { analyze: jest.fn().mockResolvedValue({ score: 80 }) },
        usage: { analyze: jest.fn().mockResolvedValue({ score: 75 }) }
      };

      const results = await analytics.runAllAnalysis();

      expect(results).toBeDefined();
      expect(results.codeQuality).toBeDefined();
      expect(results.security).toBeDefined();
      expect(results.performance).toBeDefined();
      expect(results.usage).toBeDefined();

      expect(analytics.analyzers.codeQuality.analyze).toHaveBeenCalled();
      expect(analytics.analyzers.security.analyze).toHaveBeenCalled();
      expect(analytics.analyzers.performance.analyze).toHaveBeenCalled();
      expect(analytics.analyzers.usage.analyze).toHaveBeenCalled();
    });

    test('should handle analyzer errors gracefully', async () => {
      analytics.analyzers = {
        codeQuality: { analyze: jest.fn().mockRejectedValue(new Error('Analysis failed')) },
        security: { analyze: jest.fn().mockResolvedValue({ score: 90 }) },
        performance: { analyze: jest.fn().mockResolvedValue({ score: 80 }) },
        usage: { analyze: jest.fn().mockResolvedValue({ score: 75 }) }
      };

      const results = await analytics.runAllAnalysis();

      expect(results.codeQuality).toBeNull();
      expect(results.security).toBeDefined();
      expect(results.performance).toBeDefined();
      expect(results.usage).toBeDefined();
    });
  });

  describe('updateMetrics', () => {
    test('should update metrics display', () => {
      const mockElement = { innerText: '' };
      global.window.document.getElementById = jest.fn((id) => {
        if (id === 'quality-score') {
return mockElement;
}
        if (id === 'security-score') {
return mockElement;
}
        return null;
      });

      const results = {
        codeQuality: { score: 85 },
        security: { score: 90 },
        performance: { score: 80 },
        usage: { score: 75 }
      };

      analytics.updateMetrics(results);

      expect(mockElement.innerText).toBe('85');
      expect(global.window.document.getElementById).toHaveBeenCalledWith('quality-score');
      expect(global.window.document.getElementById).toHaveBeenCalledWith('security-score');
    });

    test('should handle missing DOM elements gracefully', () => {
      global.window.document.getElementById = jest.fn(() => null);

      const results = {
        codeQuality: { score: 85 },
        security: { score: 90 }
      };

      expect(() => {
        analytics.updateMetrics(results);
      }).not.toThrow();
    });
  });

  describe('generateQualityReportHTML', () => {
    test('should generate quality report HTML', () => {
      const results = {
        codeQuality: {
          score: 85,
          complexity: { average: 5, high: 2 },
          maintainability: { average: 75, poor: 1 },
          issues: [
            { type: 'High Complexity', severity: 'high', file: 'test.js', line: 10 },
            { type: 'Low Maintainability', severity: 'medium', file: 'test2.js', line: 20 }
          ]
        }
      };

      const html = analytics.generateQualityReportHTML(results);

      expect(html).toBeDefined();
      expect(html).toContain('85');
      expect(html).toContain('High Complexity');
      expect(html).toContain('Low Maintainability');
      expect(html).toContain('test.js');
      expect(html).toContain('test2.js');
    });

    test('should handle empty results gracefully', () => {
      const results = { codeQuality: {} };

      const html = analytics.generateQualityReportHTML(results);

      expect(html).toBeDefined();
      expect(html).toContain('No quality data available');
    });
  });

  describe('generateSecurityReportHTML', () => {
    test('should generate security report HTML', () => {
      const results = {
        security: {
          score: 90,
          vulnerabilities: { critical: 0, high: 1, medium: 2, low: 3 },
          issues: [
            { type: 'SQL Injection', severity: 'high', file: 'api.js', line: 15 },
            { type: 'XSS Vulnerability', severity: 'medium', file: 'ui.js', line: 25 }
          ]
        }
      };

      const html = analytics.generateSecurityReportHTML(results);

      expect(html).toBeDefined();
      expect(html).toContain('90');
      expect(html).toContain('SQL Injection');
      expect(html).toContain('XSS Vulnerability');
      expect(html).toContain('api.js');
      expect(html).toContain('ui.js');
    });

    test('should handle empty security results', () => {
      const results = { security: {} };

      const html = analytics.generateSecurityReportHTML(results);

      expect(html).toBeDefined();
      expect(html).toContain('No security data available');
    });
  });

  describe('generatePerformanceReportHTML', () => {
    test('should generate performance report HTML', () => {
      const results = {
        performance: {
          score: 80,
          responseTime: { average: 200, slow: 1 },
          throughput: { requests: 1000, errors: 5 },
          metrics: [
            { endpoint: '/api/test', responseTime: 150, status: 200 },
            { endpoint: '/api/slow', responseTime: 800, status: 200 }
          ]
        }
      };

      const html = analytics.generatePerformanceReportHTML(results);

      expect(html).toBeDefined();
      expect(html).toContain('80');
      expect(html).toContain('/api/test');
      expect(html).toContain('/api/slow');
      expect(html).toContain('200');
    });

    test('should handle empty performance results', () => {
      const results = { performance: {} };

      const html = analytics.generatePerformanceReportHTML(results);

      expect(html).toBeDefined();
      expect(html).toContain('No performance data available');
    });
  });

  describe('generateUsageReportHTML', () => {
    test('should generate usage report HTML', () => {
      const results = {
        usage: {
          score: 75,
          sessions: { total: 100, active: 25 },
          pageViews: { total: 500, top: ['home', 'profile', 'settings'] },
          interactions: { total: 1000, top: ['button-click', 'form-submit'] }
        }
      };

      const html = analytics.generateUsageReportHTML(results);

      expect(html).toBeDefined();
      expect(html).toContain('75');
      expect(html).toContain('100');
      expect(html).toContain('500');
      expect(html).toContain('home');
      expect(html).toContain('profile');
    });

    test('should handle empty usage results', () => {
      const results = { usage: {} };

      const html = analytics.generateUsageReportHTML(results);

      expect(html).toBeDefined();
      expect(html).toContain('No usage data available');
    });
  });

  describe('showDetailedReports', () => {
    test('should show detailed reports section', () => {
      const mockDetails = { style: { display: 'none' } };
      global.window.document.getElementById = jest.fn(() => mockDetails);

      analytics.showDetailedReports();

      expect(mockDetails.style.display).toBe('block');
      expect(global.window.document.getElementById).toHaveBeenCalledWith('analytics-details');
    });

    test('should handle missing details section gracefully', () => {
      global.window.document.getElementById = jest.fn(() => null);

      expect(() => {
        analytics.showDetailedReports();
      }).not.toThrow();
    });
  });

  describe('exportReports', () => {
    test('should export reports as JSON', () => {
      const mockResults = {
        codeQuality: { score: 85 },
        security: { score: 90 },
        performance: { score: 80 },
        usage: { score: 75 }
      };

      analytics.metrics = mockResults;

      const exportData = analytics.exportReports();

      expect(exportData).toBeDefined();
      expect(exportData.timestamp).toBeDefined();
      expect(exportData.results).toEqual(mockResults);
      expect(exportData.version).toBeDefined();
    });

    test('should handle empty metrics gracefully', () => {
      analytics.metrics = {};

      const exportData = analytics.exportReports();

      expect(exportData).toBeDefined();
      expect(exportData.results).toEqual({});
    });
  });

  describe('getComprehensiveReport', () => {
    test('should return comprehensive report data', () => {
      const mockResults = {
        codeQuality: { score: 85 },
        security: { score: 90 },
        performance: { score: 80 },
        usage: { score: 75 }
      };

      analytics.metrics = mockResults;

      const report = analytics.getComprehensiveReport();

      expect(report).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.summary.overallScore).toBeDefined();
      expect(report.summary.codeQuality).toBe(85);
      expect(report.summary.security).toBe(90);
      expect(report.summary.performance).toBe(80);
      expect(report.summary.usage).toBe(75);
    });

    test('should calculate overall score correctly', () => {
      analytics.metrics = {
        codeQuality: { score: 85 },
        security: { score: 90 },
        performance: { score: 80 },
        usage: { score: 75 }
      };

      const report = analytics.getComprehensiveReport();

      expect(report.summary.overallScore).toBeCloseTo(82.5, 0.1);
    });
  });

  describe('Error Handling', () => {
    test('should handle DOM API unavailability', () => {
      global.window.document.querySelector = jest.fn(() => {
        throw new Error('DOM API not available');
      });

      expect(() => {
        analytics.addDashboardControls();
      }).not.toThrow();
    });

    test('should handle analyzer module errors', async () => {
      analytics.analyzers = {
        codeQuality: { analyze: jest.fn().mockImplementation(() => {
          throw new Error('Analyzer error');
        }) }
      };

      const results = await analytics.runAllAnalysis();

      expect(results.codeQuality).toBeNull();
    });

    test('should handle report generation errors', () => {
      const results = { codeQuality: null };

      expect(() => {
        analytics.generateQualityReportHTML(results);
      }).not.toThrow();
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete dashboard workflow', async () => {
      // Mock successful workflow
      const mockContainer = { appendChild: jest.fn() };
      const mockElement = { innerText: '', style: { display: 'none' } };
      
      global.window.document.querySelector = jest.fn(() => mockContainer);
      global.window.document.getElementById = jest.fn(() => mockElement);
      global.window.document.querySelectorAll = jest.fn(() => [
        { className: 'tab-panel', style: { display: 'block' } },
        { className: 'tab-btn', classList: { remove: jest.fn(), add: jest.fn() } }
      ]);

      analytics.analyzers = {
        codeQuality: { analyze: jest.fn().mockResolvedValue({ score: 85 }) },
        security: { analyze: jest.fn().mockResolvedValue({ score: 90 }) },
        performance: { analyze: jest.fn().mockResolvedValue({ score: 80 }) },
        usage: { analyze: jest.fn().mockResolvedValue({ score: 75 }) }
      };

      // Complete workflow
      analytics.addDashboardControls();
      await analytics.runAllAnalysis();
      analytics.updateMetrics(analytics.metrics);
      analytics.showTab('quality');
      analytics.showDetailedReports();
      const exportData = analytics.exportReports();

      expect(mockContainer.appendChild).toHaveBeenCalled();
      expect(analytics.analyzers.codeQuality.analyze).toHaveBeenCalled();
      expect(exportData).toBeDefined();
      expect(exportData.results).toBeDefined();
    });

    test('should handle workflow with errors gracefully', async () => {
      const mockContainer = { appendChild: jest.fn() };
      global.window.document.querySelector = jest.fn(() => mockContainer);

      analytics.analyzers = {
        codeQuality: { analyze: jest.fn().mockRejectedValue(new Error('Analysis failed')) },
        security: { analyze: jest.fn().mockRejectedValue(new Error('Security error')) },
        performance: { analyze: jest.fn().mockResolvedValue({ score: 80 }) },
        usage: { analyze: jest.fn().mockResolvedValue({ score: 75 }) }
      };

      // Workflow with errors
      analytics.addDashboardControls();
      const results = await analytics.runAllAnalysis();
      analytics.updateMetrics(results);

      expect(mockContainer.appendChild).toHaveBeenCalled();
      expect(results.codeQuality).toBeNull();
      expect(results.security).toBeNull();
      expect(results.performance).toBeDefined();
      expect(results.usage).toBeDefined();
    });
  });

  describe('Performance Tests', () => {
    test('should handle large datasets efficiently', async () => {
      const startTime = Date.now();

      // Mock large dataset
      analytics.analyzers = {
        codeQuality: { 
          analyze: jest.fn().mockResolvedValue({ 
            score: 85,
            issues: Array(100).fill(0).map((_, i) => ({
              type: `Issue ${i}`,
              severity: 'medium',
              file: `file${i}.js`,
              line: i * 10
            }))
          })
        },
        security: { analyze: jest.fn().mockResolvedValue({ score: 90 }) },
        performance: { analyze: jest.fn().mockResolvedValue({ score: 80 }) },
        usage: { analyze: jest.fn().mockResolvedValue({ score: 75 }) }
      };

      const results = await analytics.runAllAnalysis();
      const endTime = Date.now();

      expect(results.codeQuality.issues).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    test('should handle rapid tab switching efficiently', () => {
      const mockTabs = Array(4).fill(0).map(() => ({ 
        style: { display: 'block' } 
      }));
      const mockButtons = Array(4).fill(0).map(() => ({ 
        classList: { remove: jest.fn(), add: jest.fn() } 
      }));

      global.window.document.querySelectorAll = jest.fn((selector) => {
        if (selector === '.tab-panel') {
return mockTabs;
}
        if (selector === '.tab-btn') {
return mockButtons;
}
        return [];
      });

      const startTime = Date.now();

      // Rapid tab switching
      for (let i = 0; i < 100; i++) {
        analytics.showTab(['quality', 'security', 'performance', 'usage'][i % 4]);
      }

      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(500); // Should complete in under 500ms
    });
  });
});
