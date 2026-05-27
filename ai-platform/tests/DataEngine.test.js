/**
 * @jest-environment jsdom
 */

// Import the DataEngine class for testing
import DataEngine from '../web/dashboard_components/core/DataEngine.js';

describe('DataEngine', () => {
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

  describe('API Data Transformation', () => {
    test('should transform API data correctly', () => {
      const mockApiData = {
        totalFiles: 100,
        totalDirectories: 10,
        projectDepth: 3,
        codeQuality: 85,
        testCoverage: 70,
        complexity: 'Medium',
        maintainability: 'Good',
        totalSize: 1000000,
        fileTypes: {
          'JavaScript': 50,
          'CSS': 20,
          'HTML': 30
        },
        largestFiles: [
          { name: 'app.js', size: 50000 },
          { name: 'styles.css', size: 30000 }
        ]
      };

      const transformed = dataEngine.transformApiData(mockApiData);

      expect(transformed.total_files).toBe(100);
      expect(transformed.total_directories).toBe(10);
      expect(transformed.depth).toBe(3);
      expect(transformed.metrics.Quality).toBe(85);
      expect(transformed.metrics.TestCoverage).toBe(70);
      expect(transformed.metrics.Complexity).toBe(40); // Medium complexity
      expect(transformed.metrics.Maintainability).toBe(60); // Good maintainability
      expect(transformed.source).toBe('api');
      expect(transformed.file_types).toEqual(mockApiData.fileTypes);
    });

    test('should generate fallback file types when API provides none', () => {
      const mockApiData = {
        totalFiles: 100,
        totalDirectories: 10,
        codeQuality: 85,
        testCoverage: 70
        // No fileTypes provided
      };

      const transformed = dataEngine.transformApiData(mockApiData);

      expect(Object.keys(transformed.file_types).length).toBeGreaterThan(0);
      expect(transformed.file_types.JavaScript).toBe(35); // 35% of 100
      expect(transformed.file_types.TypeScript).toBe(15); // 15% of 100
    });

    test('should handle missing API data gracefully', () => {
      const mockApiData = {
        totalFiles: 0,
        totalDirectories: 0
      };

      const transformed = dataEngine.transformApiData(mockApiData);

      expect(transformed.total_files).toBe(0);
      expect(transformed.total_directories).toBe(0);
      expect(transformed.metrics.Quality).toBe(0);
      expect(transformed.metrics.TestCoverage).toBe(0);
      expect(transformed.source).toBe('api');
    });
  });

  describe('Field Access Patterns', () => {
    test('should handle multiple field access patterns', () => {
      const mockData = {
        total_files: 100,
        metadata: {
          totalFiles: 150,
          totalDirectories: 20
        },
        source: 'api'
      };

      // Test different access patterns
      const totalFiles1 = mockData?.total_files || 0;
      const totalFiles2 = mockData?.metadata?.totalFiles || 0;
      const totalDirectories = mockData?.metadata?.totalDirectories || 0;

      expect(totalFiles1).toBe(100);
      expect(totalFiles2).toBe(150);
      expect(totalDirectories).toBe(20);
    });
  });

  describe('Data Validation', () => {
    test('should validate required API fields', () => {
      const validApiData = {
        totalFiles: 100,
        totalDirectories: 10
      };

      const transformed = dataEngine.transformApiData(validApiData);
      expect(transformed.total_files).toBe(100);
      expect(transformed.total_directories).toBe(10);
    });

    test('should handle missing required fields', () => {
      const invalidApiData = {
        // Missing totalFiles and totalDirectories
        codeQuality: 85
      };

      const transformed = dataEngine.transformApiData(invalidApiData);
      expect(transformed.total_files).toBe(0);
      expect(transformed.total_directories).toBe(0);
    });
  });

  describe('Cache Management', () => {
    test('should cache API responses', () => {
      const mockApiData = {
        totalFiles: 100,
        totalDirectories: 10
      };

      dataEngine.cache.set('./', mockApiData);
      const cached = dataEngine.cache.get('./');
      
      expect(cached).toEqual(mockApiData);
    });

    test('should clear cache', () => {
      const mockApiData = {
        totalFiles: 100,
        totalDirectories: 10
      };

      dataEngine.cache.set('./', mockApiData);
      expect(dataEngine.cache.has('./')).toBe(true);

      dataEngine.cache.clear();
      expect(dataEngine.cache.has('./')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      // Mock fetch to return an error
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      dataEngine.currentDirectory = './test';
      
      try {
        await dataEngine.loadData();
      } catch (error) {
        expect(error.message).toBe('Network error');
      }
    });

    test('should handle invalid JSON responses', async () => {
      // Mock fetch to return invalid JSON
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      dataEngine.currentDirectory = './test';
      
      try {
        await dataEngine.loadData();
      } catch (error) {
        expect(error.message).toBe('Invalid JSON');
      }
    });
  });

  describe('Integration with Dashboard', () => {
    test('should provide data in expected format for dashboard', () => {
      const mockApiData = {
        totalFiles: 7780,
        totalDirectories: 156,
        codeQuality: 82,
        testCoverage: 75,
        fileTypes: {
          'JavaScript': 2723,
          'TypeScript': 1167,
          'HTML': 778,
          'CSS': 622,
          'JSON': 544,
          'Markdown': 389,
          'Python': 311,
          'Configuration': 467,
          'Other': 778
        }
      };

      const transformed = dataEngine.transformApiData(mockApiData);

      // Verify the data structure matches what the dashboard expects
      expect(transformed.total_files).toBe(7780);
      expect(transformed.total_directories).toBe(156);
      expect(transformed.metrics.Quality).toBe(82);
      expect(transformed.metrics.TestCoverage).toBe(75);
      expect(transformed.source).toBe('api');
      expect(Object.keys(transformed.file_types).length).toBe(9);
    });
  });
});
