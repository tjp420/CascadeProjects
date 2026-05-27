/**
 * Code Quality Analyzer Unit Tests
 * Sprint 3 Test Coverage Enhancement - Target: 85% coverage
 */

const CodeQualityAnalyzer = require('../../src/js/code-quality-analyzer');

describe('CodeQualityAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new CodeQualityAnalyzer();
  });

  describe('Constructor', () => {
    test('should initialize with default thresholds', () => {
      expect(analyzer.thresholds.complexity.low).toBe(5);
      expect(analyzer.thresholds.complexity.medium).toBe(10);
      expect(analyzer.thresholds.complexity.high).toBe(20);
      expect(analyzer.thresholds.duplication.low).toBe(3);
      expect(analyzer.thresholds.maintainability.excellent).toBe(85);
    });

    test('should accept custom thresholds', () => {
      const customAnalyzer = new CodeQualityAnalyzer({
        complexity: { low: 3, medium: 7, high: 15 },
        duplication: { low: 2, medium: 4, high: 8 }
      });

      expect(customAnalyzer.thresholds.complexity.low).toBe(3);
      expect(customAnalyzer.thresholds.complexity.medium).toBe(7);
      expect(customAnalyzer.thresholds.complexity.high).toBe(15);
      expect(customAnalyzer.thresholds.duplication.low).toBe(2);
    });

    test('should initialize metrics map', () => {
      expect(analyzer.metrics).toBeInstanceOf(Map);
      expect(analyzer.metrics.size).toBe(0);
    });
  });

  describe('analyzeComplexity', () => {
    test('should return complexity analysis results', () => {
      const mockCode = `
        function simpleFunction() {
          return 'simple';
        }
        
        function complexFunction(param1, param2, param3) {
          if (param1) {
            for (let i = 0; i < param2; i++) {
              if (param3) {
                try {
                  // complex logic
                } catch (e) {
                  // error handling
                }
              }
            }
          }
        }
      `;

      const results = analyzer.analyzeComplexity(mockCode);
      
      expect(results).toHaveProperty('totalFunctions');
      expect(results).toHaveProperty('complexityScore');
      expect(results).toHaveProperty('functions');
      expect(Array.isArray(results.functions)).toBe(true);
    });

    test('should handle empty code', () => {
      const results = analyzer.analyzeComplexity('');
      
      expect(results.totalFunctions).toBe(0);
      expect(results.complexityScore).toBe(0);
      expect(results.functions).toHaveLength(0);
    });

    test('should categorize functions by complexity', () => {
      const mockCode = `
        function lowComplexity() { return 1; }
        function mediumComplexity(x) { return x > 0 ? x : -x; }
        function highComplexity(a, b, c) {
          if (a) {
            for (let i = 0; i < b; i++) {
              if (c) {
                while (i < c) {
                  i++;
                }
              }
            }
          }
        }
      `;

      const results = analyzer.analyzeComplexity(mockCode);
      
      expect(results.functions).toHaveLength(3);
      expect(results.functions[0].complexity).toBe('low');
      expect(results.functions[1].complexity).toBe('medium');
      expect(results.functions[2].complexity).toBe('high');
    });
  });

  describe('analyzeDuplication', () => {
    test('should detect code duplication', () => {
      const mockCode = `
        function function1() {
          // Common logic
          const result = calculate();
          return result * 2;
        }
        
        function function2() {
          // Common logic
          const result = calculate();
          return result * 2;
        }
      `;

      const results = analyzer.analyzeDuplication(mockCode);
      
      expect(results).toHaveProperty('duplicationScore');
      expect(results).toHaveProperty('duplicatedBlocks');
      expect(results).toHaveProperty('totalLines');
      expect(Array.isArray(results.duplicatedBlocks)).toBe(true);
    });

    test('should handle code without duplication', () => {
      const mockCode = `
        function unique1() { return 'a'; }
        function unique2() { return 'b'; }
        function unique3() { return 'c'; }
      `;

      const results = analyzer.analyzeDuplication(mockCode);
      
      expect(results.duplicationScore).toBe(0);
      expect(results.duplicatedBlocks).toHaveLength(0);
    });
  });

  describe('calculateMaintainability', () => {
    test('should calculate maintainability index', () => {
      const mockMetrics = {
        complexity: 10,
        linesOfCode: 100,
        comments: 20,
        duplication: 5
      };

      const maintainability = analyzer.calculateMaintainability(mockMetrics);
      
      expect(typeof maintainability).toBe('number');
      expect(maintainability).toBeGreaterThanOrEqual(0);
      expect(maintainability).toBeLessThanOrEqual(100);
    });

    test('should categorize maintainability levels', () => {
      const testCases = [
        { metrics: { complexity: 5, linesOfCode: 100, comments: 30, duplication: 2 }, expected: 'excellent' },
        { metrics: { complexity: 10, linesOfCode: 100, comments: 20, duplication: 5 }, expected: 'good' },
        { metrics: { complexity: 20, linesOfCode: 100, comments: 10, duplication: 10 }, expected: 'fair' },
        { metrics: { complexity: 30, linesOfCode: 100, comments: 5, duplication: 15 }, expected: 'poor' }
      ];

      testCases.forEach(({ metrics, expected }) => {
        const maintainability = analyzer.calculateMaintainability(metrics);
        const level = analyzer.getMaintainabilityLevel(maintainability);
        expect(level).toBe(expected);
      });
    });
  });

  describe('generateReport', () => {
    test('should generate comprehensive analysis report', () => {
      const mockCode = `
        function testFunction() {
          return 'test';
        }
      `;

      const report = analyzer.generateReport(mockCode);
      
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('complexity');
      expect(report).toHaveProperty('duplication');
      expect(report).toHaveProperty('maintainability');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('timestamp');
      
      expect(typeof report.summary.overallScore).toBe('number');
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    test('should include relevant recommendations', () => {
      const mockCode = `
        function complexFunction(a, b, c, d, e) {
          if (a) {
            for (let i = 0; i < b; i++) {
              if (c) {
                while (i < d) {
                  if (e) {
                    // deeply nested logic
                  }
                  i++;
                }
              }
            }
          }
        }
        
        function duplicateFunction() {
          // Same logic as another function
          const result = calculate();
          return result * 2;
        }
      `;

      const report = analyzer.generateReport(mockCode);
      
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations.some(rec => rec.type === 'complexity')).toBe(true);
      expect(report.recommendations.some(rec => rec.type === 'duplication')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle null input gracefully', () => {
      expect(() => analyzer.analyzeComplexity(null)).not.toThrow();
      expect(() => analyzer.analyzeDuplication(null)).not.toThrow();
    });

    test('should handle undefined input gracefully', () => {
      expect(() => analyzer.analyzeComplexity(undefined)).not.toThrow();
      expect(() => analyzer.analyzeDuplication(undefined)).not.toThrow();
    });

    test('should handle very large code files', () => {
      const largeCode = 'function test() { return 1; }\n'.repeat(10000);
      
      expect(() => analyzer.analyzeComplexity(largeCode)).not.toThrow();
      const results = analyzer.analyzeComplexity(largeCode);
      expect(results.totalFunctions).toBe(10000);
    });
  });

  describe('Performance', () => {
    test('should complete analysis within reasonable time', () => {
      const mockCode = `
        function test1() { return 1; }
        function test2() { return 2; }
        function test3() { return 3; }
      `;

      const startTime = performance.now();
      analyzer.generateReport(mockCode);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});
