/**
 * Performance Profiler Test Suite
 * 
 * Comprehensive test suite for the PerformanceProfiler class covering
 * API performance analysis, metric collection, and performance reporting.
 * Tests both happy paths and edge cases to ensure robust functionality.
 * 
 * @fileoverview Test suite for PerformanceProfiler class
 * @author Technical Debt Analysis Team
 * @since 1.0.0
 * @version 1.0.0
 */

// Mock DOM environment for testing
if (typeof window === 'undefined') {
  global.window = {
    fetch: jest.fn(),
    performance: {
      now: jest.fn(() => Date.now()),
      mark: jest.fn(),
      measure: jest.fn(),
      getEntriesByName: jest.fn(() => [])
    }
  };
  global.document = {
    createElement: jest.fn(),
    head: { appendChild: jest.fn() }
  };
}

// Import the PerformanceProfiler
const PerformanceProfiler = require('../src/js/performance-profiler.js');

describe('PerformanceProfiler', () => {
  let profiler;

  beforeEach(() => {
    profiler = new PerformanceProfiler();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with default configuration', () => {
      expect(profiler.metrics).toBeDefined();
      expect(profiler.thresholds).toBeDefined();
      expect(profiler.thresholds.responseTime).toBe(1000);
      expect(profiler.thresholds.memoryUsage).toBe(50);
      expect(profiler.thresholds.cpuUsage).toBe(80);
    });

    test('should accept custom thresholds', () => {
      const customProfiler = new PerformanceProfiler({
        thresholds: {
          responseTime: 500,
          memoryUsage: 30,
          cpuUsage: 60
        }
      });

      expect(customProfiler.thresholds.responseTime).toBe(500);
      expect(customProfiler.thresholds.memoryUsage).toBe(30);
      expect(customProfiler.thresholds.cpuUsage).toBe(60);
    });
  });

  describe('initializeApiAnalysis', () => {
    test('should initialize API analysis with default metrics', () => {
      const result = profiler.initializeApiAnalysis();

      expect(result).toBeDefined();
      expect(result.startTime).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.metrics.totalRequests).toBe(0);
      expect(result.metrics.averageResponseTime).toBe(0);
      expect(result.metrics.errorRate).toBe(0);
    });

    test('should initialize API analysis with custom start time', () => {
      const customStartTime = Date.now() - 1000;
      const result = profiler.initializeApiAnalysis(customStartTime);

      expect(result.startTime).toBe(customStartTime);
    });
  });

  describe('processApiMetrics', () => {
    test('should process API metrics correctly', () => {
      const metrics = {
        requests: [
          { url: '/api/test', responseTime: 100, status: 200 },
          { url: '/api/test2', responseTime: 200, status: 200 },
          { url: '/api/error', responseTime: 50, status: 500 }
        ]
      };

      const result = profiler.processApiMetrics(metrics);

      expect(result.totalRequests).toBe(3);
      expect(result.averageResponseTime).toBeCloseTo(116.67, 0.1);
      expect(result.errorRate).toBeCloseTo(33.33, 0.1);
      expect(result.successRate).toBeCloseTo(66.67, 0.1);
    });

    test('should handle empty metrics array', () => {
      const metrics = { requests: [] };

      const result = profiler.processApiMetrics(metrics);

      expect(result.totalRequests).toBe(0);
      expect(result.averageResponseTime).toBe(0);
      expect(result.errorRate).toBe(0);
      expect(result.successRate).toBe(0);
    });

    test('should handle null metrics', () => {
      const result = profiler.processApiMetrics(null);

      expect(result.totalRequests).toBe(0);
      expect(result.averageResponseTime).toBe(0);
      expect(result.errorRate).toBe(0);
    });
  });

  describe('categorizeApiMetric', () => {
    test('should categorize fast API calls as good', () => {
      const metric = { responseTime: 100, status: 200 };
      const category = profiler.categorizeApiMetric(metric);

      expect(category).toBe('good');
    });

    test('should categorize slow API calls as poor', () => {
      const metric = { responseTime: 1500, status: 200 };
      const category = profiler.categorizeApiMetric(metric);

      expect(category).toBe('poor');
    });

    test('should categorize error responses as poor', () => {
      const metric = { responseTime: 100, status: 500 };
      const category = profiler.categorizeApiMetric(metric);

      expect(category).toBe('poor');
    });

    test('should categorize medium response times as fair', () => {
      const metric = { responseTime: 800, status: 200 };
      const category = profiler.categorizeApiMetric(metric);

      expect(category).toBe('fair');
    });
  });

  describe('calculatePerformanceScore', () => {
    test('should calculate high score for good performance', () => {
      const metrics = {
        averageResponseTime: 200,
        errorRate: 0,
        totalRequests: 100
      };

      const score = profiler.calculatePerformanceScore(metrics);

      expect(score).toBeGreaterThan(80);
    });

    test('should calculate low score for poor performance', () => {
      const metrics = {
        averageResponseTime: 2000,
        errorRate: 50,
        totalRequests: 100
      };

      const score = profiler.calculatePerformanceScore(metrics);

      expect(score).toBeLessThan(50);
    });

    test('should calculate medium score for average performance', () => {
      const metrics = {
        averageResponseTime: 600,
        errorRate: 10,
        totalRequests: 100
      };

      const score = profiler.calculatePerformanceScore(metrics);

      expect(score).toBeGreaterThan(50);
      expect(score).toBeLessThan(80);
    });
  });

  describe('generatePerformanceReport', () => {
    test('should generate comprehensive performance report', () => {
      const metrics = {
        totalRequests: 100,
        averageResponseTime: 300,
        errorRate: 5,
        successRate: 95,
        endpoints: {
          '/api/test': { count: 50, avgTime: 200 },
          '/api/test2': { count: 30, avgTime: 400 },
          '/api/error': { count: 20, avgTime: 100 }
        }
      };

      const report = profiler.generatePerformanceReport(metrics);

      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.summary.totalRequests).toBe(100);
      expect(report.summary.averageResponseTime).toBe(300);
      expect(report.summary.errorRate).toBe(5);
      expect(report.summary.performanceScore).toBeDefined();
      expect(report.endpoints).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    test('should generate recommendations for slow endpoints', () => {
      const metrics = {
        totalRequests: 100,
        averageResponseTime: 1500,
        errorRate: 10,
        successRate: 90,
        endpoints: {
          '/api/slow': { count: 50, avgTime: 2000 },
          '/api/fast': { count: 50, avgTime: 100 }
        }
      };

      const report = profiler.generatePerformanceReport(metrics);

      expect(report.recommendations).toContain(
        expect.stringMatching(/slow|optimization|performance/i)
      );
    });

    test('should generate recommendations for high error rates', () => {
      const metrics = {
        totalRequests: 100,
        averageResponseTime: 300,
        errorRate: 25,
        successRate: 75,
        endpoints: {
          '/api/error': { count: 50, avgTime: 100 },
          '/api/normal': { count: 50, avgTime: 500 }
        }
      };

      const report = profiler.generatePerformanceReport(metrics);

      expect(report.recommendations).toContain(
        expect.stringMatching(/error|reliability|stability/i)
      );
    });
  });

  describe('analyzeApiPerformance', () => {
    test('should analyze API performance end-to-end', () => {
      const mockApiData = [
        { url: '/api/test', responseTime: 100, status: 200 },
        { url: '/api/test', responseTime: 150, status: 200 },
        { url: '/api/error', responseTime: 50, status: 500 },
        { url: '/api/slow', responseTime: 1200, status: 200 }
      ];

      // Mock the data collection
      jest.spyOn(profiler, 'collectApiData').mockResolvedValue(mockApiData);

      const result = profiler.analyzeApiPerformance();

      expect(result).toBeDefined();
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();
      expect(result.duration).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.report).toBeDefined();
    });

    test('should handle API data collection errors gracefully', () => {
      jest.spyOn(profiler, 'collectApiData').mockRejectedValue(new Error('API Error'));

      expect(() => {
        profiler.analyzeApiPerformance();
      }).not.toThrow();
    });
  });

  describe('collectApiData', () => {
    test('should collect API data from performance entries', () => {
      const mockEntries = [
        { name: 'API: /api/test', duration: 100 },
        { name: 'API: /api/test2', duration: 200 },
        { name: 'Other: something', duration: 50 }
      ];

      global.performance.getEntriesByName.mockReturnValue(mockEntries);

      const result = profiler.collectApiData();

      expect(result).toHaveLength(2);
      expect(result[0].url).toBe('/api/test');
      expect(result[0].responseTime).toBe(100);
      expect(result[1].url).toBe('/api/test2');
      expect(result[1].responseTime).toBe(200);
    });

    test('should handle empty performance entries', () => {
      global.performance.getEntriesByName.mockReturnValue([]);

      const result = profiler.collectApiData();

      expect(result).toHaveLength(0);
    });
  });

  describe('trackApiCall', () => {
    test('should track individual API calls', () => {
      const startTime = Date.now();
      const endTime = startTime + 100;
      const url = '/api/test';
      const status = 200;

      profiler.trackApiCall(url, startTime, endTime, status);

      expect(profiler.metrics.requests).toHaveLength(1);
      expect(profiler.metrics.requests[0]).toEqual({
        url,
        responseTime: 100,
        status,
        timestamp: startTime
      });
    });

    test('should handle multiple API calls', () => {
      const calls = [
        { url: '/api/test1', startTime: 1000, endTime: 1100, status: 200 },
        { url: '/api/test2', startTime: 1200, endTime: 1400, status: 500 },
        { url: '/api/test3', startTime: 1500, endTime: 1550, status: 200 }
      ];

      calls.forEach(call => {
        profiler.trackApiCall(call.url, call.startTime, call.endTime, call.status);
      });

      expect(profiler.metrics.requests).toHaveLength(3);
      expect(profiler.metrics.requests[0].responseTime).toBe(100);
      expect(profiler.metrics.requests[1].responseTime).toBe(200);
      expect(profiler.metrics.requests[2].responseTime).toBe(50);
    });
  });

  describe('getEndpointStats', () => {
    test('should calculate statistics for specific endpoint', () => {
      const calls = [
        { url: '/api/test', responseTime: 100, status: 200 },
        { url: '/api/test', responseTime: 150, status: 200 },
        { url: '/api/test', responseTime: 200, status: 500 },
        { url: '/api/other', responseTime: 300, status: 200 }
      ];

      calls.forEach(call => {
        profiler.metrics.requests.push(call);
      });

      const stats = profiler.getEndpointStats('/api/test');

      expect(stats.count).toBe(3);
      expect(stats.averageResponseTime).toBeCloseTo(150, 0.1);
      expect(stats.errorRate).toBeCloseTo(33.33, 0.1);
      expect(stats.successRate).toBeCloseTo(66.67, 0.1);
    });

    test('should return empty stats for unknown endpoint', () => {
      const stats = profiler.getEndpointStats('/api/unknown');

      expect(stats.count).toBe(0);
      expect(stats.averageResponseTime).toBe(0);
      expect(stats.errorRate).toBe(0);
      expect(stats.successRate).toBe(0);
    });
  });

  describe('resetMetrics', () => {
    test('should reset all metrics to initial state', () => {
      // Add some metrics first
      profiler.metrics.requests = [
        { url: '/api/test', responseTime: 100, status: 200 }
      ];

      profiler.resetMetrics();

      expect(profiler.metrics.requests).toHaveLength(0);
      expect(profiler.metrics.startTime).toBeUndefined();
      expect(profiler.metrics.endTime).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid API call data', () => {
      expect(() => {
        profiler.trackApiCall(null, null, null, null);
      }).not.toThrow();

      expect(() => {
        profiler.trackApiCall('', 'invalid', 'invalid', 'invalid');
      }).not.toThrow();
    });

    test('should handle performance API unavailability', () => {
      global.performance.getEntriesByName.mockImplementation(() => {
        throw new Error('Performance API not available');
      });

      expect(() => {
        profiler.collectApiData();
      }).not.toThrow();
    });
  });

  describe('Integration Tests', () => {
    test('should handle real-world API performance scenario', () => {
      // Simulate a typical API usage pattern
      const apiCalls = [
        { url: '/api/users', startTime: 1000, endTime: 1200, status: 200 },
        { url: '/api/users', startTime: 1300, endTime: 1350, status: 200 },
        { url: '/api/posts', startTime: 1400, endTime: 1600, status: 200 },
        { url: '/api/posts', startTime: 1700, endTime: 1900, status: 200 },
        { url: '/api/comments', startTime: 2000, endTime: 2100, status: 500 },
        { url: '/api/comments', startTime: 2200, endTime: 2250, status: 500 },
        { url: '/api/search', startTime: 2300, endTime: 2800, status: 200 }, // Slow call
        { url: '/api/search', startTime: 2900, endTime: 3100, status: 200 }
      ];

      apiCalls.forEach(call => {
        profiler.trackApiCall(call.url, call.startTime, call.endTime, call.status);
      });

      const analysis = profiler.analyzeApiPerformance();
      const report = analysis.report;

      expect(analysis.metrics.totalRequests).toBe(8);
      expect(analysis.metrics.averageResponseTime).toBeCloseTo(187.5, 0.1);
      expect(analysis.metrics.errorRate).toBeCloseTo(25, 0.1);
      expect(report.summary.performanceScore).toBeDefined();
      expect(report.endpoints).toBeDefined();
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    test('should provide actionable recommendations', () => {
      // Simulate poor performance scenario
      const apiCalls = [
        { url: '/api/slow', startTime: 1000, endTime: 2500, status: 200 }, // Very slow
        { url: '/api/slow', startTime: 2600, endTime: 4000, status: 200 }, // Very slow
        { url: '/api/error', startTime: 4100, endTime: 4150, status: 500 }, // Error
        { url: '/api/error', startTime: 4200, endTime: 4250, status: 500 }, // Error
        { url: '/api/error', startTime: 4300, endTime: 4350, status: 500 }  // Error
      ];

      apiCalls.forEach(call => {
        profiler.trackApiCall(call.url, call.startTime, call.endTime, call.status);
      });

      const analysis = profiler.analyzeApiPerformance();
      const recommendations = analysis.report.recommendations;

      expect(recommendations).toContain(
        expect.stringMatching(/slow|optimization|performance/i)
      );
      expect(recommendations).toContain(
        expect.stringMatching(/error|reliability|stability/i)
      );
    });
  });

  describe('Performance Tests', () => {
    test('should handle large number of API calls efficiently', () => {
      const startTime = Date.now();
      
      // Track 1000 API calls
      for (let i = 0; i < 1000; i++) {
        profiler.trackApiCall(`/api/test${i}`, i, i + 100, 200);
      }

      const analysis = profiler.analyzeApiPerformance();
      const endTime = Date.now();

      expect(analysis.metrics.totalRequests).toBe(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    test('should maintain performance with complex endpoint patterns', () => {
      const endpoints = ['/api/users', '/api/posts', '/api/comments', '/api/search'];
      const startTime = Date.now();

      // Create complex API call patterns
      for (let i = 0; i < 100; i++) {
        endpoints.forEach(endpoint => {
          const responseTime = Math.random() * 1000;
          const status = Math.random() > 0.9 ? 500 : 200;
          profiler.trackApiCall(endpoint, i, i + responseTime, status);
        });
      }

      const analysis = profiler.analyzeApiPerformance();
      const endTime = Date.now();

      expect(analysis.metrics.totalRequests).toBe(400);
      expect(Object.keys(analysis.report.endpoints)).toHaveLength(4);
      expect(endTime - startTime).toBeLessThan(500); // Should complete in under 500ms
    });
  });
});
