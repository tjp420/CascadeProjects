/**
 * Code Quality Analyzer Test Suite
 * 
 * Comprehensive test suite for the CodeQualityAnalyzer class covering
 * complexity analysis, maintainability assessment, and quality metrics.
 * Tests both happy paths and edge cases to ensure robust functionality.
 * 
 * @fileoverview Test suite for CodeQualityAnalyzer class
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
      head: { appendChild: jest.fn() }
    }
  };
  global.Stripe = jest.fn();
}

// Import the CodeQualityAnalyzer
const CodeQualityAnalyzer = require('../src/js/code-quality-analyzer.js');

describe('CodeQualityAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new CodeQualityAnalyzer();
  });

  describe('Constructor', () => {
    test('should initialize with default thresholds', () => {
      expect(analyzer.thresholds.complexity).toEqual({
        low: 5,
        medium: 10,
        high: 20
      });
      expect(analyzer.thresholds.duplication).toEqual({
        low: 3,
        medium: 5,
        high: 10
      });
      expect(analyzer.thresholds.maintainability).toEqual({
        excellent: 85,
        good: 70,
        fair: 50,
        poor: 30
      });
    });

    test('should accept custom thresholds', () => {
      const customAnalyzer = new CodeQualityAnalyzer({
        complexity: { low: 3, medium: 7, high: 15 },
        duplication: { low: 2, medium: 4, high: 8 },
        maintainability: { excellent: 90, good: 75, fair: 55, poor: 35 }
      });

      expect(customAnalyzer.thresholds.complexity).toEqual({
        low: 3,
        medium: 7,
        high: 15
      });
      expect(customAnalyzer.thresholds.duplication).toEqual({
        low: 2,
        medium: 4,
        high: 8
      });
      expect(customAnalyzer.thresholds.maintainability).toEqual({
        excellent: 90,
        good: 75,
        fair: 55,
        poor: 35
      });
    });

    test('should merge custom thresholds with defaults', () => {
      const customAnalyzer = new CodeQualityAnalyzer({
        complexity: { low: 3, high: 25 },
        maintainability: { excellent: 90 }
      });

      expect(customAnalyzer.thresholds.complexity).toEqual({
        low: 3,
        medium: 10, // default value
        high: 25
      });
      expect(customAnalyzer.thresholds.maintainability).toEqual({
        excellent: 90,
        good: 70, // default value
        fair: 50, // default value
        poor: 30  // default value
      });
    });
  });

  describe('analyzeComplexity', () => {
    test('should analyze simple JavaScript files', () => {
      const jsFiles = [
        {
          path: 'simple.js',
          content: `
            function simpleFunction() {
              return true;
            }
            
            function anotherFunction() {
              if (condition) {
                return true;
              }
              return false;
            }
          `
        }
      ];

      const result = analyzer.analyzeComplexity(jsFiles);

      expect(result.totalFunctions).toBe(2);
      expect(result.avgComplexity).toBeCloseTo(1.5, 0.1);
      expect(result.complexityDistribution.low).toBe(2);
      expect(result.complexityDistribution.medium).toBe(0);
      expect(result.complexityDistribution.high).toBe(0);
    });

    test('should analyze complex JavaScript files', () => {
      const jsFiles = [
        {
          path: 'complex.js',
          content: `
            function complexFunction(param) {
              if (param) {
                switch (param) {
                  case 'a':
                    return param;
                  case 'b':
                    if (param > 0) {
                      return param * 2;
                    }
                    break;
                  default:
                    return null;
                }
              }
              
              for (let i = 0; i < 10; i++) {
                console.log(i);
              }
              
              while (condition) {
                break;
              }
              
              try {
                riskyOperation();
              } catch (error) {
                handleError(error);
              }
            }
          `
        }
      ];

      const result = analyzer.analyzeComplexity(jsFiles);

      expect(result.totalFunctions).toBe(1);
      expect(result.avgComplexity).toBeGreaterThan(5);
      expect(result.complexityDistribution.low).toBe(0);
      expect(result.complexityDistribution.medium).toBe(0);
      expect(result.complexityDistribution.high).toBe(1);
    });

    test('should handle empty files array', () => {
      const result = analyzer.analyzeComplexity([]);
      
      expect(result.totalFunctions).toBe(0);
      expect(result.avgComplexity).toBe(0);
      expect(result.complexityDistribution.low).toBe(0);
      expect(result.complexityDistribution.medium).toBe(0);
      expect(result.complexityDistribution.high).toBe(0);
    });

    test('should handle files without functions', () => {
      const jsFiles = [
        {
          path: 'no-functions.js',
          content: `
            const variable = 'value';
            const another = 'another';
            console.log('no functions here');
          `
        }
      ];

      const result = analyzer.analyzeComplexity(jsFiles);

      expect(result.totalFunctions).toBe(0);
      expect(result.avgComplexity).toBe(0);
    });
  });

  describe('analyzeFileComplexity', () => {
    test('should analyze single file with multiple functions', () => {
      const file = {
        path: 'test.js',
        content: `
          function test1() {
            return true;
          }
          
          function test2(param) {
            if (param) {
              return param;
            }
            return false;
          }
          
          function test3() {
            for (let i = 0; i < 5; i++) {
              console.log(i);
            }
            return i;
          }
        `
      };

      const result = analyzer.analyzeFileComplexity(file);

      expect(result.functions).toHaveLength(3);
      expect(result.functions[0].name).toBe('test1');
      expect(result.functions[0].complexity).toBe(1);
      expect(result.functions[1].name).toBe('test2');
      expect(result.functions[1].complexity).toBe(2);
      expect(result.functions[2].name).toBe('test3');
      expect(result.functions[2].complexity).toBe(2);
      expect(result.avgComplexity).toBeCloseTo(1.67, 0.1);
    });

    test('should handle arrow functions', () => {
      const file = {
        path: 'arrow.js',
        content: `
          const arrow1 = () => true;
          const arrow2 = param => param * 2;
          const arrow3 = (param1, param2) => {
            return param1 + param2;
          };
        `
      };

      const result = analyzer.analyzeFileComplexity(file);

      expect(result.functions).toHaveLength(3);
      expect(result.functions[0].name).toBe('arrow1');
      expect(result.functions[0].complexity).toBe(1);
      expect(result.functions[1].name).toBe('arrow2');
      expect(result.functions[1].complexity).toBe(1);
      expect(result.functions[2].name).toBe('arrow3');
      expect(result.functions[2].complexity).toBe(1);
    });

    test('should handle function expressions', () => {
      const file = {
        path: 'expressions.js',
        content: `
          const obj = {
            method1: function() {
              return true;
            },
            method2: function(param) {
              return param;
            }
          };
        `
      };

      const result = analyzer.analyzeFileComplexity(file);

      expect(result.functions).toHaveLength(2);
      expect(result.functions[0].name).toBe('method1');
      expect(result.functions[0].complexity).toBe(1);
      expect(result.functions[1].name).toBe('method2');
      expect(result.functions[1].complexity).toBe(1);
    });

    test('should handle empty file content', () => {
      const file = {
        path: 'empty.js',
        content: ''
      };

      const result = analyzer.analyzeFileComplexity(file);

      expect(result.functions).toHaveLength(0);
      expect(result.avgComplexity).toBe(0);
    });

    test('should handle null or undefined content', () => {
      const result1 = analyzer.analyzeFileComplexity({ path: 'test.js', content: null });
      const result2 = analyzer.analyzeFileComplexity({ path: 'test.js', content: undefined });

      expect(result1.functions).toHaveLength(0);
      expect(result1.avgComplexity).toBe(0);
      expect(result2.functions).toHaveLength(0);
      expect(result2.avgComplexity).toBe(0);
    });
  });

  describe('calculateFunctionComplexity', () => {
    test('should calculate simple function complexity', () => {
      const content = 'function simple() { return true; }';
      const match = content.match(/function simple/);

      const complexity = analyzer.calculateFunctionComplexity(content, match);

      expect(complexity).toBe(1); // Base complexity
    });

    test('should calculate complexity with if statements', () => {
      const content = `
        function test(param) {
          if (param) {
            return true;
          }
          return false;
        }
      `;
      const match = content.match(/function test/);

      const complexity = analyzer.calculateFunctionComplexity(content, match);

      expect(complexity).toBe(2); // Base + 1 if
    });

    test('should calculate complexity with loops', () => {
      const content = `
        function test() {
          for (let i = 0; i < 10; i++) {
            console.log(i);
          }
          while (condition) {
            break;
          }
        }
      `;
      const match = content.match(/function test/);

      const complexity = analyzer.calculateFunctionComplexity(content, match);

      expect(complexity).toBe(3); // Base + 1 for + 1 for while
    });

    test('should calculate complexity with switch statements', () => {
      const content = `
        function test(param) {
          switch (param) {
            case 'a':
              return param;
            case 'b':
              return param * 2;
            default:
              return null;
          }
        }
      `;
      const match = content.match(/function test/);

      const complexity = analyzer.calculateFunctionComplexity(content, match);

      expect(complexity).toBe(3); // Base + 2 for switch cases
    });

    test('should calculate complexity with try-catch', () => {
      const content = `
        function test() {
          try {
            riskyOperation();
          } catch (error) {
            handleError(error);
          }
        }
      `;
      const match = content.match(/function test/);

      const complexity = analyzer.calculateFunctionComplexity(content, match);

      expect(complexity).toBe(2); // Base + 1 for catch
    });

    test('should calculate complexity with logical operators', () => {
      const content = `
        function test(a, b) {
          return a && b || c;
        }
      `;
      const match = content.match(/function test/);

      const complexity = analyzer.calculateFunctionComplexity(content, match);

      expect(complexity).toBe(3); // Base + 1 for && + 1 for ||
    });
  });

  describe('getLineNumber', () => {
    test('should find line number for function at beginning', () => {
      const content = `
        line 1
        function test() {
          return true;
        }
        line 4
      `;
      const match = content.match(/function test/);

      const line = analyzer.getLineNumber(content, match);

      expect(line).toBe(3);
    });

    test('should find line number for function in middle', () => {
      const content = `
        line 1
        line 2
        function test() {
          return true;
        }
        line 5
        line 6
      `;
      const match = content.match(/function test/);

      const line = analyzer.getLineNumber(content, match);

      expect(line).toBe(4);
    });

    test('should handle invalid match', () => {
      const content = 'no function here';
      const match = content.match(/notfound/);

      const line = analyzer.getLineNumber(content, match);

      expect(line).toBe(0);
    });
  });

  describe('extractFunctionContent', () => {
    test('should extract simple function content', () => {
      const content = `
        function test() {
          return true;
        }
        more code
      `;
      const startIndex = content.indexOf('function test');

      const functionContent = analyzer.extractFunctionContent(content, startIndex);

      expect(functionContent).toContain('function test()');
      expect(functionContent).toContain('return true;');
      expect(functionContent).not.toContain('more code');
    });

    test('should handle nested functions', () => {
      const content = `
        function outer() {
          function inner() {
            return true;
          }
          return false;
        }
      `;
      const startIndex = content.indexOf('function outer');

      const functionContent = analyzer.extractFunctionContent(content, startIndex);

      expect(functionContent).toContain('function outer()');
      expect(functionContent).toContain('function inner()');
      expect(functionContent).toContain('return true;');
      expect(functionContent).toContain('return false;');
    });

    test('should handle function at end of file', () => {
      const content = 'function test() { return true; }';
      const startIndex = content.indexOf('function test');

      const functionContent = analyzer.extractFunctionContent(content, startIndex);

      expect(functionContent).toBe('function test() { return true; }');
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JavaScript gracefully', () => {
      const jsFiles = [
        {
          path: 'malformed.js',
          content: `
            function broken {
              // Missing closing brace
              return true;
            
            function another() {
              return false;
            }
          `
        }
      ];

      // Should not throw error
      expect(() => {
        analyzer.analyzeComplexity(jsFiles);
      }).not.toThrow();
    });

    test('should handle null files array', () => {
      expect(() => {
        analyzer.analyzeComplexity(null);
      }).not.toThrow();
    });

    test('should handle undefined files array', () => {
      expect(() => {
        analyzer.analyzeComplexity(undefined);
      }).not.toThrow();
    });

    test('should handle files with null content', () => {
      const jsFiles = [
        { path: 'test.js', content: null },
        { path: 'test2.js', content: undefined }
      ];

      expect(() => {
        analyzer.analyzeComplexity(jsFiles);
      }).not.toThrow();
    });
  });

  describe('Integration Tests', () => {
    test('should analyze real-world JavaScript file structure', () => {
      const jsFiles = [
        {
          path: 'src/components/Header.jsx',
          content: `
            import React from 'react';
            
            function Header() {
              const [state, setState] = useState(0);
              
              const handleClick = () => {
                setState(prev => prev + 1);
              };
              
              return <div>Header</div>;
            }
            
            export default Header;
          `
        },
        {
          path: 'src/utils/helpers.js',
          content: `
            export function formatDate(date) {
              if (!date) return null;
              
              const options = { 
                year: 'numeric', 
                month: 'long' 
              };
              
              return new Date(date).toLocaleDateString('en-US', options);
            }
            
            export function debounce(func, wait) {
              let timeout;
              return function executedFunction(...args) {
                const later = () => {
                  clearTimeout(timeout);
                  timeout = setTimeout(() => {
                    func.apply(this, args);
                  }, wait);
                };
                clearTimeout(timeout);
                timeout = later;
              };
            }
          `
        },
        {
          path: 'src/api/client.js',
          content: `
            class ApiClient {
              constructor(baseUrl) {
                this.baseUrl = baseUrl;
                this.cache = new Map();
              }
              
              async fetch(endpoint, options = {}) {
                const url = \`\${this.baseUrl}\${endpoint}\`;
                const config = {
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': \`Bearer \${this.getToken()}\`
                  },
                  ...options
                };
                
                const response = await fetch(url, config);
                
                if (!response.ok) {
                  throw new Error(\`HTTP error! status: \${response.status}\`);
                }
                
                return response.json();
              }
              
              getToken() {
                return localStorage.getItem('authToken');
              }
            }
          `
        }
      ];

      const results = jsFiles.map(file => 
        analyzer.analyzeFileComplexity(file)
      );

      expect(results).toHaveLength(3);
      
      // Header.jsx should have 1 function
      expect(results[0].functions).toHaveLength(1);
      expect(results[0].avgComplexity).toBe(1);
      
      // helpers.js should have 2 functions
      expect(results[1].functions).toHaveLength(2);
      expect(results[1].avgComplexity).toBeCloseTo(1.5, 0.1);
      
      // client.js should have 0 functions (class)
      expect(results[2].functions).toHaveLength(0);
      expect(results[2].avgComplexity).toBe(0);
    });

    test('should provide comprehensive complexity analysis', () => {
      const jsFiles = [
        {
          path: 'mixed-complexity.js',
          content: `
            // Simple function
            function simple() {
              return true;
            }
            
            // Medium complexity function
            function medium(param) {
              if (param) {
                switch (param) {
                  case 'simple':
                    return param;
                  case 'complex':
                    for (let i = 0; i < 10; i++) {
                      if (i % 2 === 0) {
                        console.log(i);
                      }
                    }
                    break;
                  default:
                    return null;
                }
              }
              return param;
            }
            
            // High complexity function
            function complex(data) {
              if (data && data.items && data.items.length > 0) {
                for (const item of data.items) {
                  if (item.type === 'action') {
                    try {
                      if (item.handler && typeof item.handler === 'function') {
                        const result = item.handler(item);
                        if (result && result.success) {
                          console.log('Action succeeded');
                        } else {
                          console.error('Action failed');
                        }
                      }
                    } catch (error) {
                      console.error('Handler error:', error);
                    }
                  } else if (item.type === 'validation') {
                    const isValid = item.validator(item);
                    if (!isValid) {
                      throw new Error('Validation failed');
                    }
                  }
                }
              }
              return data;
            }
          `
        }
      ];

      const result = analyzer.analyzeComplexity(jsFiles);

      expect(result.totalFunctions).toBe(3);
      expect(result.avgComplexity).toBeCloseTo(3.67, 0.1);
      expect(result.complexityDistribution.low).toBe(1);
      expect(result.complexityDistribution.medium).toBe(1);
      expect(result.complexityDistribution.high).toBe(1);
    });
  });

  describe('Performance Tests', () => {
    test('should handle large files efficiently', () => {
      const largeContent = Array(100).fill(0).map((_, i) => 
        `function function${i}() { return ${i}; }`
      ).join('\n');
      
      const jsFiles = [
        { path: 'large.js', content: largeContent }
      ];

      const startTime = Date.now();
      const result = analyzer.analyzeComplexity(jsFiles);
      const endTime = Date.now();

      expect(result.totalFunctions).toBe(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    test('should handle many small files efficiently', () => {
      const jsFiles = Array(50).fill(0).map((_, i) => ({
        path: `file${i}.js`,
        content: `function test${i}() { return ${i}; }`
      }));

      const startTime = Date.now();
      const result = analyzer.analyzeComplexity(jsFiles);
      const endTime = Date.now();

      expect(result.totalFunctions).toBe(50);
      expect(endTime - startTime).toBeLessThan(500); // Should complete in under 500ms
    });
  });
});
