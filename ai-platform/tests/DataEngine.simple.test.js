/**
 * @jest-environment jsdom
 */

// Simple test for DataEngine using CommonJS require
const DataEngine = require('../web/dashboard_components/core/DataEngine.js');

describe('DataEngine (Simple)', () => {
  let dataEngine;

  beforeEach(() => {
    // Reset the singleton instance
    if (DataEngine.instance) {
      delete DataEngine.instance;
    }
    dataEngine = new DataEngine();
  });

  describe('Constructor', () => {
    test('should initialize with default values', () => {
      expect(dataEngine.currentDirectory).toBe('./');
      expect(dataEngine.cache).toBeDefined();
      expect(dataEngine.apiEndpoint).toBe('http://localhost:8081/api/project/overview');
    });

    test('should use singleton pattern', () => {
      const engine1 = new DataEngine();
      const engine2 = new DataEngine();
      expect(engine1).toBe(engine2);
    });
  });

  describe('Basic functionality', () => {
    test('should set directory correctly', () => {
      dataEngine.setDirectory('./test');
      expect(dataEngine.currentDirectory).toBe('./test');
    });

    test('should have cache functionality', () => {
      expect(dataEngine.cache).toBeDefined();
      expect(typeof dataEngine.cache.get).toBe('function');
      expect(typeof dataEngine.cache.set).toBe('function');
    });

    test('should have API endpoint configured', () => {
      expect(dataEngine.apiEndpoint).toContain('localhost');
      expect(dataEngine.apiEndpoint).toContain('/api/');
    });
  });

  describe('Data loading', () => {
    test('should load fallback data when API fails', async () => {
      const data = await dataEngine.loadData();
      expect(data).toBeDefined();
      expect(data.name).toBeDefined();
      expect(data.metrics).toBeDefined();
    });

    test('should return project structure', async () => {
      const data = await dataEngine.loadData();
      expect(data.overview).toBeDefined();
      expect(data.metrics).toBeDefined();
      expect(data.languages).toBeDefined();
    });
  });
});
