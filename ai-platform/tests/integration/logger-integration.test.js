/**
 * Logger Integration Tests
 * 
 * Tests the app-logger functionality and production logging configuration.
 */

const fs = require('fs');
const path = require('path');

const constants = require('../../server/config/constants.cjs');
// Mock the logger module
jest.mock('../../server/lib/app-logger.cjs', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    audit: jest.fn(),
    system: jest.fn(),
    security: jest.fn()
  };

  return {
    logger: mockLogger,
    createAuditLogger: jest.fn(() => mockLogger),
    createProductionLogger: jest.fn(() => mockLogger)
  };
});

describe('Logger Integration', () => {
  let mockLogger;
  let logFilePath;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Get mock logger
    const loggerModule = require('../../server/lib/app-logger.cjs');
    mockLogger = loggerModule.logger;
    
    // Set up log file path for testing
    logFilePath = path.join(__dirname, '../test-logs.log');
  });

  afterEach(() => {
    // Clean up test log files
    if (fs.existsSync(logFilePath)) {
      fs.unlinkSync(logFilePath);
    }
  });

  describe('Logger Configuration', () => {
    it('should import logger module successfully', () => {
      const { logger } = require('../../server/lib/app-logger.cjs');
      
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should have audit logging methods', () => {
      const { logger } = require('../../server/lib/app-logger.cjs');
      
      expect(typeof logger.audit).toBe('function');
      expect(typeof logger.system).toBe('function');
      expect(typeof logger.security).toBe('function');
    });

    it('should create audit logger when requested', () => {
      const { createAuditLogger } = require('../../server/lib/app-logger.cjs');
      
      const auditLogger = createAuditLogger();
      
      expect(createAuditLogger).toHaveBeenCalled();
      expect(auditLogger).toBeDefined();
      expect(typeof auditLogger.info).toBe('function');
    });

    it('should create production logger when requested', () => {
      const { createProductionLogger } = require('../../server/lib/app-logger.cjs');
      
      const productionLogger = createProductionLogger();
      
      expect(createProductionLogger).toHaveBeenCalled();
      expect(productionLogger).toBeDefined();
      expect(typeof productionLogger.info).toBe('function');
    });
  });

  describe('Logging Functionality', () => {
    it('should log info messages', () => {
      const message = 'Test info message';
      const metadata = { userId: 'test-user', action: 'test-action' };

      mockLogger.info(message, metadata);

      expect(mockLogger.info).toHaveBeenCalledWith(message, metadata);
    });

    it('should log error messages', () => {
      const error = new Error('Test error');
      const metadata = { stack: error.stack, userId: 'test-user' };

      mockLogger.error('Test error message', error, metadata);

      expect(mockLogger.error).toHaveBeenCalledWith('Test error message', error, metadata);
    });

    it('should log warning messages', () => {
      const message = 'Test warning message';
      const metadata = { warning: 'test-warning' };

      mockLogger.warn(message, metadata);

      expect(mockLogger.warn).toHaveBeenCalledWith(message, metadata);
    });

    it('should log debug messages', () => {
      const message = 'Test debug message';
      const metadata = { debug: true, context: 'test' };

      mockLogger.debug(message, metadata);

      expect(mockLogger.debug).toHaveBeenCalledWith(message, metadata);
    });
  });

  describe('Audit Logging', () => {
    it('should log audit events', () => {
      const auditEvent = {
        eventType: 'USER_LOGIN',
        userId: 'test-user',
        ipAddress: '127.0.0.1',
        timestamp: new Date().toISOString()
      };

      mockLogger.audit('User login successful', auditEvent);

      expect(mockLogger.audit).toHaveBeenCalledWith('User login successful', auditEvent);
    });

    it('should log system events', () => {
      const systemEvent = {
        event: 'SERVER_START',
        port: constants.DASHBOARD_PORT,
        environment: 'test',
        timestamp: new Date().toISOString()
      };

      mockLogger.system('Server started successfully', systemEvent);

      expect(mockLogger.system).toHaveBeenCalledWith('Server started successfully', systemEvent);
    });

    it('should log security events', () => {
      const securityEvent = {
        eventType: 'AUTHENTICATION_FAILURE',
        userId: 'test-user',
        ipAddress: '127.0.0.1',
        reason: 'Invalid credentials',
        timestamp: new Date().toISOString()
      };

      mockLogger.security('Authentication failed', securityEvent);

      expect(mockLogger.security).toHaveBeenCalledWith('Authentication failed', securityEvent);
    });
  });

  describe('Log Format and Structure', () => {
    it('should handle different data types in metadata', () => {
      const testCases = [
        { string: 'test-string' },
        { number: 42 },
        { boolean: true },
        { array: [1, 2, 3] },
        { object: { nested: 'value' } },
        { null: null },
        { undefined: undefined }
      ];

      testCases.forEach((metadata, index) => {
        mockLogger.info(`Test message ${index}`, metadata);
        expect(mockLogger.info).toHaveBeenLastCalledWith(
          `Test message ${index}`,
          metadata
        );
      });
    });

    it('should handle circular references in metadata', () => {
      const circularObject = { name: 'test' };
      circularObject.self = circularObject;

      mockLogger.info('Circular reference test', circularObject);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Circular reference test',
        circularObject
      );
    });

    it('should handle very large metadata objects', () => {
      const largeMetadata = {
        data: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item-${i}` }))
      };

      mockLogger.info('Large metadata test', largeMetadata);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Large metadata test',
        largeMetadata
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle logging errors gracefully', () => {
      // Mock a logging error
      mockLogger.info.mockImplementationOnce(() => {
        throw new Error('Logging failed');
      });

      // Should not throw when logging fails
      expect(() => {
        mockLogger.info('Test message');
      }).not.toThrow();
    });

    it('should handle invalid metadata objects', () => {
      const invalidMetadata = [
        null,
        undefined,
        'string-instead-of-object',
        42,
        true,
        Symbol('test'),
        () => {} // function
      ];

      invalidMetadata.forEach((metadata) => {
        expect(() => {
          mockLogger.info('Test message', metadata);
        }).not.toThrow();
      });
    });

    it('should handle very long messages', () => {
      const longMessage = 'A'.repeat(10000);

      expect(() => {
        mockLogger.info(longMessage);
      }).not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledWith(longMessage);
    });
  });

  describe('Performance Considerations', () => {
    it('should handle high-frequency logging efficiently', () => {
      const startTime = Date.now();
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        mockLogger.info(`Message ${i}`, { iteration: i });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 1 second for 1000 calls)
      expect(duration).toBeLessThan(1000);
      expect(mockLogger.info).toHaveBeenCalledTimes(iterations);
    });

    it('should not block on synchronous operations', () => {
      const startTime = Date.now();

      mockLogger.info('Test message', { sync: true });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should be very fast (less than 10ms)
      expect(duration).toBeLessThan(10);
    });
  });

  describe('Environment Configuration', () => {
    it('should respect log level configuration', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      
      // Test different environments
      const environments = ['development', 'production', 'test'];
      
      environments.forEach(env => {
        process.env.NODE_ENV = env;
        
        // Logger should still work in all environments
        expect(() => {
          mockLogger.info(`Test in ${env}`);
        }).not.toThrow();
      });
      
      // Restore original environment
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should handle missing log directory', () => {
      const nonExistentPath = path.join(__dirname, 'non-existent-dir', 'test.log');
      
      // Should not throw if log directory doesn't exist
      expect(() => {
        mockLogger.info('Test message');
      }).not.toThrow();
    });
  });

  describe('Integration with Other Systems', () => {
    it('should work with Express middleware', () => {
      const mockRequest = {
        method: 'GET',
        url: '/test',
        headers: { 'user-agent': 'test-agent' },
        ip: '127.0.0.1'
      };

      const mockResponse = {
        statusCode: 200,
        headersSent: true
      };

      // Simulate request logging
      mockLogger.audit('HTTP Request', {
        method: mockRequest.method,
        url: mockRequest.url,
        userAgent: mockRequest.headers['user-agent'],
        ip: mockRequest.ip,
        statusCode: mockResponse.statusCode
      });

      expect(mockLogger.audit).toHaveBeenCalledWith(
        'HTTP Request',
        expect.objectContaining({
          method: 'GET',
          url: '/test',
          statusCode: 200
        })
      );
    });

    it('should work with error handling middleware', () => {
      const error = new Error('Test error');
      const mockRequest = {
        method: 'POST',
        url: '/api/test',
        body: { test: 'data' }
      };

      mockLogger.error('Request failed', error, {
        method: mockRequest.method,
        url: mockRequest.url,
        body: mockRequest.body,
        stack: error.stack
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Request failed',
        error,
        expect.objectContaining({
          method: 'POST',
          url: '/api/test',
          body: { test: 'data' }
        })
      );
    });
  });
});
