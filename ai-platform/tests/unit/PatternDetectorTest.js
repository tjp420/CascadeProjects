/**
 * Pattern Detector Unit Test Suite
 * 
 * Unit tests for the pattern detection system
 * focusing on pattern detection accuracy, confidence scoring, and edge cases
 */

const PatternDetector = require('../../src/analysis/PatternDetector');

class PatternDetectorTest {
  constructor() {
    this.testResults = [];
    this.isInitialized = false;
    
    this.initialize();
  }

  // Initialize test suite
  async initialize() {
    if (this.isInitialized) {
      console.log('[PATTERN_DETECTOR_TEST] Test suite already initialized');
      return;
    }

    try {
      // Initialize pattern detector
      this.patternDetector = new PatternDetector({
        enableMLDetection: true,
        confidenceThreshold: 0.7,
        enableAdaptiveLearning: true
      });
      
      await this.patternDetector.initialize();
      
      this.isInitialized = true;
      console.log('[PATTERN_DETECTOR_TEST] Test suite initialized');
      
    } catch (error) {
      console.error('[PATTERN_DETECTOR_TEST] Failed to initialize test suite:', error.message);
      throw error;
    }
  }

  // Run all unit tests
  async runAllTests() {
    console.log('[PATTERN_DETECTOR_TEST] Running unit tests...');
    
    const testSuites = [
      this.testEmailPatternDetection.bind(this),
      this.testURLPatternDetection.bind(this),
      this.testDatePatternDetection.bind(this),
      this.testNumericPatternDetection.bind(this),
      this.testStructurePatternDetection.bind(this),
      this.testConfidenceScoring.bind(this),
      this.testInvalidData.bind(this),
      this.testEdgeCases.bind(this),
      this.testMLDetection.bind(this),
      this.testTemplateMatching.bind(this)
    ];
    
    const results = [];
    
    for (const testSuite of testSuites) {
      try {
        const result = await testSuite();
        results.push(result);
        console.log(`[PATTERN_DETECTOR_TEST] ${result.testName}: ${result.status}`);
      } catch (error) {
        results.push({
          testName: testSuite.name,
          status: 'FAILED',
          error: error.message,
          duration: 0
        });
        console.error(`[PATTERN_DETECTOR_TEST] ${testSuite.name}: FAILED - ${error.message}`);
      }
    }
    
    // Generate test report
    this.generateTestReport(results);
    
    return results;
  }

  // Test email pattern detection
  async testEmailPatternDetection() {
    const testName = 'Email Pattern Detection';
    const startTime = Date.now();
    
    try {
      console.log('[PATTERN_DETECTOR_TEST] Testing email pattern detection...');
      
      // Test 1: Valid email patterns
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user_name@test-domain.com',
        'user123@sub.domain.com'
      ];
      
      for (const email of validEmails) {
        const result = this.patternDetector.detectPatterns({ email });
        
        if (!result.success) {
          throw new Error(`Failed to detect email pattern for: ${email}`);
        }
        
        const emailPattern = result.patterns.find(p => p.type === 'email');
        if (!emailPattern) {
          throw new Error(`Email pattern not found for: ${email}`);
        }
        
        if (emailPattern.confidence < 0.8) {
          throw new Error(`Email confidence too low for: ${email} (${emailPattern.confidence})`);
        }
      }
      
      // Test 2: Invalid email patterns
      const invalidEmails = [
        'invalid-email',
        'user@',
        '@domain.com',
        'user.domain.com',
        'user@domain',
        'user@domain.',
        ''
      ];
      
      for (const email of invalidEmails) {
        const result = this.patternDetector.detectPatterns({ email });
        
        if (!result.success) {
          throw new Error(`Failed to process invalid email: ${email}`);
        }
        
        const emailPattern = result.patterns.find(p => p.type === 'email');
        if (emailPattern && emailPattern.confidence > 0.5) {
          throw new Error(`Invalid email incorrectly detected as valid: ${email}`);
        }
      }
      
      // Test 3: Mixed data with email
      const mixedData = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        phone: '123-456-7890',
        items: [1, 2, 3]
      };
      
      const mixedResult = this.patternDetector.detectPatterns(mixedData);
      
      if (!mixedResult.success) {
        throw new Error('Failed to detect patterns in mixed data');
      }
      
      const mixedEmailPattern = mixedResult.patterns.find(p => p.type === 'email');
      if (!mixedEmailPattern) {
        throw new Error('Email pattern not found in mixed data');
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          validEmails: validEmails.length,
          invalidEmails: invalidEmails.length,
          mixedData: 'PASSED'
        }
      };
      
    } catch (error) {
      return {
        testName,
        status: 'FAILED',
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  // Test URL pattern detection
  async testURLPatternDetection() {
    const testName = 'URL Pattern Detection';
    const startTime = Date.now();
    
    try {
      console.log('[PATTERN_DETECTOR_TEST] Testing URL pattern detection...');
      
      // Test 1: Valid URL patterns
      const validURLs = [
        'https://example.com',
        'http://www.example.org',
        'https://sub.domain.com/path',
        'https://example.com:8080',
        'https://example.com/path?param=value',
        'https://example.com/path#section'
      ];
      
      for (const url of validURLs) {
        const result = this.patternDetector.detectPatterns({ url });
        
        if (!result.success) {
          throw new Error(`Failed to detect URL pattern for: ${url}`);
        }
        
        const urlPattern = result.patterns.find(p => p.type === 'url');
        if (!urlPattern) {
          throw new Error(`URL pattern not found for: ${url}`);
        }
        
        if (urlPattern.confidence < 0.8) {
          throw new Error(`URL confidence too low for: ${url} (${urlPattern.confidence})`);
        }
      }
      
      // Test 2: Invalid URL patterns
      const invalidURLs = [
        'not-a-url',
        'http://',
        'https://',
        'example.com',
        'www.example',
        ''
      ];
      
      for (const url of invalidURLs) {
        const result = this.patternDetector.detectPatterns({ url });
        
        if (!result.success) {
          throw new Error(`Failed to process invalid URL: ${url}`);
        }
        
        const urlPattern = result.patterns.find(p => p.type === 'url');
        if (urlPattern && urlPattern.confidence > 0.5) {
          throw new Error(`Invalid URL incorrectly detected as valid: ${url}`);
        }
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          validURLs: validURLs.length,
          invalidURLs: invalidURLs.length
        }
      };
      
    } catch (error) {
      return {
        testName,
        status: 'FAILED',
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  // Test date pattern detection
  async testDatePatternDetection() {
    const testName = 'Date Pattern Detection';
    const startTime = Date.now();
    
    try {
      console.log('[PATTERN_DETECTOR_TEST] Testing date pattern detection...');
      
      // Test 1: Valid date patterns
      const validDates = [
        '2026-05-21',
        '05/21/2026',
        '21-05-2026',
        '2026/05/21',
        'May 21, 2026',
        '21 May 2026'
      ];
      
      for (const date of validDates) {
        const result = this.patternDetector.detectPatterns({ date });
        
        if (!result.success) {
          throw new Error(`Failed to detect date pattern for: ${date}`);
        }
        
        const datePattern = result.patterns.find(p => p.type === 'date');
        if (!datePattern) {
          throw new Error(`Date pattern not found for: ${date}`);
        }
        
        if (datePattern.confidence < 0.7) {
          throw new Error(`Date confidence too low for: ${date} (${datePattern.confidence})`);
        }
      }
      
      // Test 2: Invalid date patterns
      const invalidDates = [
        'not-a-date',
        '32/13/2026',
        '2026-13-32',
        '2026-02-30',
        ''
      ];
      
      for (const date of invalidDates) {
        const result = this.patternDetector.detectPatterns({ date });
        
        if (!result.success) {
          throw new Error(`Failed to process invalid date: ${date}`);
        }
        
        const datePattern = result.patterns.find(p => p.type === 'date');
        if (datePattern && datePattern.confidence > 0.5) {
          throw new Error(`Invalid date incorrectly detected as valid: ${date}`);
        }
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          validDates: validDates.length,
          invalidDates: invalidDates.length
        }
      };
      
    } catch (error) {
      return {
        testName,
        status: 'FAILED',
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  // Test numeric pattern detection
  async testNumericPatternDetection() {
    const testName = 'Numeric Pattern Detection';
    const startTime = Date.now();
    
    try {
      console.log('[PATTERN_DETECTOR_TEST] Testing numeric pattern detection...');
      
      // Test 1: Valid numeric patterns
      const validNumbers = [
        42,
        3.14159,
        -123,
        0,
        1.23e-10,
        '123',
        '456.789',
        '-123.456',
        '1.23e5'
      ];
      
      for (const number of validNumbers) {
        const result = this.patternDetector.detectPatterns({ number });
        
        if (!result.success) {
          throw new Error(`Failed to detect numeric pattern for: ${number}`);
        }
        
        const numericPattern = result.patterns.find(p => p.type === 'numeric');
        if (!numericPattern) {
          throw new Error(`Numeric pattern not found for: ${number}`);
        }
        
        if (numericPattern.confidence < 0.8) {
          throw new Error(`Numeric confidence too low for: ${number} (${numericPattern.confidence})`);
        }
      }
      
      // Test 2: Invalid numeric patterns
      const invalidNumbers = [
        'not-a-number',
        'abc123',
        '123abc',
        '',
        'NaN',
        'Infinity'
      ];
      
      for (const number of invalidNumbers) {
        const result = this.patternDetector.detectPatterns({ number });
        
        if (!result.success) {
          throw new Error(`Failed to process invalid number: ${number}`);
        }
        
        const numericPattern = result.patterns.find(p => p.type === 'numeric');
        if (numericPattern && numericPattern.confidence > 0.5) {
          throw new Error(`Invalid number incorrectly detected as valid: ${number}`);
        }
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          validNumbers: validNumbers.length,
          invalidNumbers: invalidNumbers.length
        }
      };
      
    } catch (error) {
      return {
        testName,
        status: 'FAILED',
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  // Test structure pattern detection
  async testStructurePatternDetection() {
    const testName = 'Structure Pattern Detection';
    const startTime = Date.now();
    
    try {
      console.log('[PATTERN_DETECTOR_TEST] Testing structure pattern detection...');
      
      // Test 1: Array patterns
      const arrayData = [1, 2, 3, 4, 5];
      const arrayResult = this.patternDetector.detectPatterns(arrayData);
      
      if (!arrayResult.success) {
        throw new Error('Failed to detect array pattern');
      }
      
      const arrayPattern = arrayResult.patterns.find(p => p.type === 'array');
      if (!arrayPattern) {
        throw new Error('Array pattern not found');
      }
      
      // Test 2: Object patterns
      const objectData = { key1: 'value1', key2: 'value2' };
      const objectResult = this.patternDetector.detectPatterns(objectData);
      
      if (!objectResult.success) {
        throw new Error('Failed to detect object pattern');
      }
      
      const objectPattern = objectResult.patterns.find(p => p.type === 'object');
      if (!objectPattern) {
        throw new Error('Object pattern not found');
      }
      
      // Test 3: Nested structure patterns
      const nestedData = {
        items: [1, 2, 3],
        nested: {
          value: 42,
          items: [4, 5, 6]
        }
      };
      
      const nestedResult = this.patternDetector.detectPatterns(nestedData);
      
      if (!nestedResult.success) {
        throw new Error('Failed to detect nested structure pattern');
      }
      
      const nestedPattern = nestedResult.patterns.find(p => p.type === 'nested_structure');
      if (!nestedPattern) {
        throw new Error('Nested structure pattern not found');
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          arrayPattern: 'PASSED',
          objectPattern: 'PASSED',
          nestedStructurePattern: 'PASSED'
        }
      };
      
    } catch (error) {
      return {
        testName,
        status: 'FAILED',
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  // Test confidence scoring
  async testConfidenceScoring() {
    const testName = 'Confidence Scoring';
    const startTime = Date.now();
    
    try {
      console.log('[PATTERN_DETECTOR_TEST] Testing confidence scoring...');
      
      // Test 1: High confidence patterns
      const highConfidenceData = {
        email: 'test@example.com',
        url: 'https://www.example.com',
        phone: '123-456-7890'
      };
      
      const highResult = this.patternDetector.detectPatterns(highConfidenceData);
      
      if (!highResult.success) {
        throw new Error('Failed to detect high confidence patterns');
      }
      
      for (const pattern of highResult.patterns) {
        if (pattern.confidence < 0.8) {
          throw new Error(`High confidence pattern has low confidence: ${pattern.type} (${pattern.confidence})`);
        }
      }
      
      // Test 2: Medium confidence patterns
      const mediumConfidenceData = {
        date: '2026-05-21',
        value: 42,
        status: 'active'
      };
      
      const mediumResult = this.patternDetector.detectPatterns(mediumConfidenceData);
      
      if (!mediumResult.success) {
        throw new Error('Failed to detect medium confidence patterns');
      }
      
      for (const pattern of mediumResult.patterns) {
        if (pattern.confidence < 0.6 || pattern.confidence > 0.9) {
          throw new Error(`Medium confidence pattern has unexpected confidence: ${pattern.type} (${pattern.confidence})`);
        }
      }
      
      // Test 3: Low confidence patterns
      const lowConfidenceData = {
        maybeEmail: 'test@example',
        maybeURL: 'example.com',
        maybePhone: '1234567890'
      };
      
      const lowResult = this.patternDetector.detectPatterns(lowConfidenceData);
      
      if (!lowResult.success) {
        throw new Error('Failed to detect low confidence patterns');
      }
      
      for (const pattern of lowResult.patterns) {
        if (pattern.confidence < 0.3 || pattern.confidence > 0.7) {
          throw new Error(`Low confidence pattern has unexpected confidence: ${pattern.type} (${pattern.confidence})`);
        }
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          highConfidence: highResult.patterns.length,
          mediumConfidence: mediumResult.patterns.length,
          lowConfidence: lowResult.patterns.length
        }
      };
      
    } catch (error) {
      return {
        testName,
        status: 'FAILED',
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  // Test invalid data handling
  async testInvalidData() {
    const testName = 'Invalid Data Handling';
    const startTime = Date.now();
    
    try {
      console.log('[PATTERN_DETECTOR_TEST] Testing invalid data handling...');
      
      // Test 1: Null data
      const nullResult = this.patternDetector.detectPatterns(null);
      
      if (!nullResult.success) {
        throw new Error('Failed to handle null data');
      }
      
      if (nullResult.patterns.length > 0) {
        throw new Error('Null data should not produce patterns');
      }
      
      // Test 2: Undefined data
      const undefinedResult = this.patternDetector.detectPatterns(undefined);
      
      if (!undefinedResult.success) {
        throw new Error('Failed to handle undefined data');
      }
      
      if (undefinedResult.patterns.length > 0) {
        throw new Error('Undefined data should not produce patterns');
      }
      
      // Test 3: Empty string
      const emptyStringResult = this.patternDetector.detectPatterns('');
      
      if (!emptyStringResult.success) {
        throw new Error('Failed to handle empty string');
      }
      
      if (emptyStringResult.patterns.length > 0) {
        throw new Error('Empty string should not produce patterns');
      }
      
      // Test 4: Circular reference
      const circularData = {};
      circularData.self = circularData;
      
      const circularResult = this.patternDetector.detectPatterns(circularData);
      
      if (!circularResult.success) {
        throw new Error('Failed to handle circular reference');
      }
      
      // Circular reference should not crash the system
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          nullData: 'PASSED',
          undefinedData: 'PASSED',
          emptyString: 'PASSED',
          circularReference: 'PASSED'
        }
      };
      
    } catch (error) {
      return {
        testName,
        status: 'FAILED',
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  // Test edge cases
  async testEdgeCases() {
    const testName = 'Edge Cases';
    const startTime = Date.now();
    
    try {
      console.log('[PATTERN_DETECTOR_TEST] Testing edge cases...');
      
      // Test 1: Very large data
      const largeData = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        email: `test${i}@example.com`,
        value: i * 2
      }));
      
      const largeResult = this.patternDetector.detectPatterns(largeData);
      
      if (!largeResult.success) {
        throw new Error('Failed to handle large data');
      }
      
      if (largeResult.patterns.length === 0) {
        throw new Error('Large data should produce patterns');
      }
      
      // Test 2: Deeply nested data
      const nestedData = {};
      let current = nestedData;
      
      for (let i = 0; i < 100; i++) {
        current.level = {
          value: i,
          next: {}
        };
        current = current.level.next;
      }
      
      current.email = 'test@example.com';
      
      const nestedResult = this.patternDetector.detectPatterns(nestedData);
      
      if (!nestedResult.success) {
        throw new Error('Failed to handle deeply nested data');
      }
      
      // Test 3: Mixed data types
      const mixedData = {
        string: 'test@example.com',
        number: 42,
        boolean: true,
        array: [1, 'test@example.com', 3],
        object: { email: 'test@example.com' },
        null: null,
        undefined: undefined,
        date: '2026-05-21',
        url: 'https://example.com'
      };
      
      const mixedResult = this.patternDetector.detectPatterns(mixedData);
      
      if (!mixedResult.success) {
        throw new Error('Failed to handle mixed data types');
      }
      
      const emailPatterns = mixedResult.patterns.filter(p => p.type === 'email');
      const urlPatterns = mixedResult.patterns.filter(p => p.type === 'url');
      const datePatterns = mixedResult.patterns.filter(p => p.type === 'date');
      
      if (emailPatterns.length === 0 || urlPatterns.length === 0 || datePatterns.length === 0) {
        throw new Error('Mixed data should produce multiple pattern types');
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          largeData: 'PASSED',
          nestedData: 'PASSED',
          mixedData: 'PASSED',
          patternTypes: {
            email: emailPatterns.length,
            url: urlPatterns.length,
            date: datePatterns.length
          }
        }
      };
      
    } catch (error) {
      return {
        testName,
        status: 'FAILED',
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  // Test ML detection
  async testMLDetection() {
    const testName = 'ML Detection';
    const startTime = Date.now();
    
    try {
      console.log('[PATTERN_DETECTOR_TEST] Testing ML detection...');
      
      // Test 1: ML enabled
      const mlEnabledData = {
        email: 'test@example.com',
        phone: '123-456-7890',
        customPattern: 'CUSTOM_VALUE_123'
      };
      
      const mlResult = this.patternDetector.detectPatterns(mlEnabledData);
      
      if (!mlResult.success) {
        throw new Error('Failed to detect patterns with ML enabled');
      }
      
      // Should detect standard patterns
      const emailPattern = mlResult.patterns.find(p => p.type === 'email');
      const phonePattern = mlResult.patterns.find(p => p.type === 'phone');
      
      if (!emailPattern || !phonePattern) {
        throw new Error('Standard patterns not detected with ML enabled');
      }
      
      // Test 2: ML disabled
      const patternDetectorNoML = new PatternDetector({
        enableMLDetection: false,
        confidenceThreshold: 0.7
      });
      
      await patternDetectorNoML.initialize();
      
      const noMLResult = patternDetectorNoML.detectPatterns(mlEnabledData);
      
      if (!noMLResult.success) {
        throw new Error('Failed to detect patterns with ML disabled');
      }
      
      // Should still detect standard patterns
      const noMLEmailPattern = noMLResult.patterns.find(p => p.type === 'email');
      const noMLPhonePattern = noMLResult.patterns.find(p => p.type === 'phone');
      
      if (!noMLEmailPattern || !noMLPhonePattern) {
        throw new Error('Standard patterns not detected with ML disabled');
      }
      
      // Test 3: Custom pattern learning
      const learningData = Array.from({ length: 100 }, (_, i) => ({
        customField: `CUSTOM_VALUE_${i}`,
        otherField: 'other_value'
      }));
      
      const learningResult = this.patternDetector.detectPatterns(learningData);
      
      if (!learningResult.success) {
        throw new Error('Failed to detect patterns for learning');
      }
      
      // Clean up
      patternDetectorNoML.destroy();
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          mlEnabled: 'PASSED',
          mlDisabled: 'PASSED',
          customLearning: 'PASSED'
        }
      };
      
    } catch (error) {
      return {
        testName,
        status: 'FAILED',
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  // Test template matching
  async testTemplateMatching() {
    const testName = 'Template Matching';
    const startTime = Date.now();
    
    try {
      console.log('[PATTERN_DETECTOR_TEST] Testing template matching...');
      
      // Test 1: ID field pattern
      const idData = {
        user_id: 123,
        order_id: 'ORD-001',
        session_id: 'sess-abc123'
      };
      
      const idResult = this.patternDetector.detectPatterns(idData);
      
      if (!idResult.success) {
        throw new Error('Failed to detect ID field patterns');
      }
      
      const idPatterns = idResult.patterns.filter(p => p.type === 'id_field');
      if (idPatterns.length === 0) {
        throw new Error('ID field patterns not detected');
      }
      
      // Test 2: Timestamp pattern
      const timestampData = {
        created_at: '2026-05-21T12:00:00Z',
        updated_at: '2026-05-21T12:00:00Z',
        last_modified: '2026-05-21T12:00:00Z'
      };
      
      const timestampResult = this.patternDetector.detectPatterns(timestampData);
      
      if (!timestampResult.success) {
        throw new Error('Failed to detect timestamp patterns');
      }
      
      const timestampPatterns = timestampResult.patterns.filter(p => p.type === 'timestamp');
      if (timestampPatterns.length === 0) {
        throw new Error('Timestamp patterns not detected');
      }
      
      // Test 3: Status pattern
      const statusData = {
        status: 'active',
        isActive: true,
        isDeleted: false,
        isEnabled: true
      };
      
      const statusResult = this.patternDetector.detectPatterns(statusData);
      
      if (!statusResult.success) {
        throw new Error('Failed to detect status patterns');
      }
      
      const statusPatterns = statusResult.patterns.filter(p => p.type === 'status');
      if (statusPatterns.length === 0) {
        throw new Error('Status patterns not detected');
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          idField: 'PASSED',
          timestamp: 'PASSED',
          status: 'PASSED'
        }
      };
      
    } catch (error) {
      return {
        testName,
        status: 'FAILED',
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  // Generate test report
  generateTestReport(results) {
    const passedTests = results.filter(result => result.status === 'PASSED');
    const failedTests = results.filter(result => result.status === 'FAILED');
    
    const report = {
      timestamp: new Date().toISOString(),
      testEnvironment: 'development',
      summary: {
        totalTests: results.length,
        passedTests: passedTests.length,
        failedTests: failedTests.length,
        successRate: (passedTests.length / results.length) * 100,
        totalDuration: results.reduce((sum, result) => sum + result.duration, 0)
      },
      results: results,
      recommendations: this.generateRecommendations(results)
    };
    
    console.log('[PATTERN_DETECTOR_TEST] Test Report:');
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed: ${report.summary.passedTests}`);
    console.log(`Failed: ${report.summary.failedTests}`);
    console.log(`Success Rate: ${report.summary.successRate.toFixed(2)}%`);
    console.log(`Total Duration: ${report.summary.totalDuration}ms`);
    
    // Save report to file
    const reportPath = './pattern-detector-test-report.json';
    require('fs').writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`[PATTERN_DETECTOR_TEST] Test report saved to ${reportPath}`);
    
    return report;
  }

  // Generate recommendations
  generateRecommendations(results) {
    const recommendations = [];
    
    const failedTests = results.filter(result => result.status === 'FAILED');
    
    if (failedTests.length > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Fix failed pattern detection tests',
        description: `${failedTests.length} tests failed, requiring immediate attention`
      });
    }
    
    const slowTests = results.filter(result => 
      result.duration > 1000
    );
    
    if (slowTests.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Optimize slow pattern detection tests',
        description: `${slowTests.length} tests exceeded 1 second target`
      });
    }
    
    const confidenceTests = results.filter(result => 
      result.testName && result.testName.includes('Confidence')
    );
    
    if (confidenceTests.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Review confidence scoring accuracy',
        description: 'Ensure confidence scoring is accurate and consistent'
      });
    }
    
    return recommendations;
  }

  // Destroy test suite
  destroy() {
    if (this.patternDetector) {
      this.patternDetector.destroy();
    }
    
    this.testResults = [];
    this.isInitialized = false;
    
    console.log('[PATTERN_DETECTOR_TEST] Test suite destroyed');
  }
}

// Global instance
let patternDetectorTest = null;

// Initialize test suite when ready
function initializePatternDetectorTest() {
  if (!patternDetectorTest) {
    patternDetectorTest = new PatternDetectorTest();
  }
  return patternDetectorTest.initialize();
}

// Export for global access
window.patternDetectorTest = patternDetectorTest;

module.exports = {
  PatternDetectorTest,
  initializePatternDetectorTest
};
