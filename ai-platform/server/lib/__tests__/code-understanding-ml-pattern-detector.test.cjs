'use strict';

jest.mock('../../../src/lib/app-logger.cjs', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const {
  StatisticalPatternDetector,
  detectMLPatterns,
  generatePatternInsights,
} = require('../code-understanding/ml-pattern-detector.cjs');

describe('code-understanding/ml-pattern-detector', () => {
  test('exports expected functions and classes', () => {
    expect(typeof StatisticalPatternDetector).toBe('function');
    expect(typeof detectMLPatterns).toBe('function');
    expect(typeof generatePatternInsights).toBe('function');
  });

  test('StatisticalPatternDetector can be instantiated', () => {
    const detector = new StatisticalPatternDetector();
    expect(detector).toBeDefined();
    expect(detector.patterns).toBeDefined();
  });

  test('detectMLPatterns returns object with patterns, summary, insights', () => {
    const content = 'class UserController { authenticate(user) { } function validate(input) { } }';
    const result = detectMLPatterns(content, { filePath: 'test.js' });
    expect(typeof result).toBe('object');
    expect(result.patterns).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.insights).toBeDefined();
  });

  test('generatePatternInsights returns array', () => {
    const patterns = [];
    const summary = { categories: {} };
    const insights = generatePatternInsights(patterns, summary);
    expect(Array.isArray(insights)).toBe(true);
  });
});
