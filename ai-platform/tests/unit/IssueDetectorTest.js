/**
 * Issue Detector Unit Test Suite
 * 
 * Unit tests for the issue detection system
 * focusing on issue detection accuracy, classification, and resolution
 */

const IssueDetector = require('../../src/analysis/IssueDetector');

class IssueDetectorTest {
  constructor() {
    this.testResults = [];
    this.isInitialized = false;
    
    this.initialize();
  }

  // Initialize test suite
  async initialize() {
    if (this.isInitialized) {
      console.log('[ISSUE_DETECTOR_TEST] Test suite already initialized');
      return;
    }

    try {
      // Initialize issue detector
      this.issueDetector = new IssueDetector({
        enableAutoClassification: true,
        enableAutoResolution: true,
        enableAutoRetry: true
      });
      
      await this.issueDetector.initialize();
      
      this.isInitialized = true;
      console.log('[ISSUE_DETECTOR_TEST] Test suite initialized');
      
    } catch (error) {
      console.error('[ISSUE_DETECTOR_TEST] Failed to initialize test suite:', error.message);
      throw error;
    }
  }

  // Run all unit tests
  async runAllTests() {
    console.log('[ISSUE_DETECTOR_TEST] Running unit tests...');
    
    const testSuites = [
      this.testIssueDetection.bind(this),
      this.testIssueClassification.bind(this),
      this.testSeverityAssessment.bind(this),
      this.testIssueResolution.bind(this),
      testInvalidDataHandling.bind(this),
      testEdgeCases.bind(this),
      testAutoResolution.bind(this),
      testRetryMechanism.bind(this),
      testBatchProcessing.bind(this)
    ];
    
    const results = [];
    
    for (const testSuite of testSuites) {
      try {
        const result = await testSuite();
        results.push(result);
        console.log(`[ISSUE_DETECTOR_TEST] ${result.testName}: ${result.status}`);
      } catch (error) {
        results.push({
          testName: testSuite.name,
          status: 'FAILED',
          error: error.message,
          duration: 0
        });
        console.error(`[ISSUE_DETECTOR_TEST] ${testSuite.name}: FAILED - ${error.message}`);
      }
    }
    
    // Generate test report
    this.generateTestReport(results);
    
    return results;
  }

  // Test issue detection
  async testIssueDetection() {
    const testName = 'Issue Detection Test';
    const startTime = Date.now();
    
    try {
      console.log('[ISSUE_DETECTOR_TEST] Testing issue detection...');
      
      // Test 1: Valid issue detection
      const testData = {
        id: 'test_data_1',
        name: 'Test Data',
        value: null,
        items: [1, 2, 3, 4, 5],
        nested: {
          field: undefined
        }
      };
      
      const result = this.issueDetector.detectIssues(testData);
      
      if (!result.success) {
        throw new Error('Failed to detect issues');
      }
      
      if (result.issues.length === 0) {
        throw new Error('No issues detected in test data');
      }
      
      // Test 2: Issue classification
      for (const issue of result.issues) {
        if (!issue.type) {
          throw new Error('Issue missing type classification');
        }
        
        if (!issue.severity) {
          throw new Error('Issue missing severity classification');
        }
        
        if (!issue.description) {
          throw new Error('Issue missing description');
        }
      }
      
      // Test 3: Issue categories
      const categories = result.issues.map(issue => issue.type);
      const uniqueCategories = [...new Set(categories)];
      
      const expectedCategories = ['structure', 'content', 'format', 'quality', 'security', 'performance'];
      
      for (const category of expectedCategories) {
        if (!uniqueCategories.includes(category)) {
          throw new Error(`Missing category: ${category}`);
        }
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          issuesDetected: result.issues.length,
          categories: uniqueCategories.length,
          expectedCategories: expectedCategories.length
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

  // Test issue classification
  async testIssueClassification() {
    const testName = 'Issue Classification Test';
    const startTime = Date.now();
    
    try {
      console.log('[ISSUE_DETECTOR_TEST] Testing issue classification...');
      
      // Test 1: Structure issues
      const structureData = {
        id: null,
        name: 'Test Data',
        value: undefined,
        items: [1, 2, 3, 4, 5],
        nested: {
          field: null
        }
      };
      
      const structureResult = this.issueDetector.detectIssues(structureData);
      
      if (!structureResult.success) {
        throw new Error('Failed to detect structure issues');
      }
      
      const structureIssues = structureResult.issues.filter(issue => issue.category === 'structure');
      
      if (structureIssues.length === 0) {
        throw new Error('No structure issues detected');
      }
      
      // Test 2: Content issues
      const contentData = {
        id: 'test_data_1',
        name: 'Test Data',
        email: 'invalid-email',
        phone: '123-456-7890',
        url: 'invalid-url',
        date: 'invalid-date',
        items: [1, 2, 3, 4, 5]
      };
      
      const contentResult = this.issueDetector.detectIssues(contentData);
      
      if (!contentResult.success) {
        throw new Error('Failed to detect content issues');
      }
      
      const contentIssues = contentResult.issues.filter(issue => issue.category === 'content');
      
      if (contentIssues.length === 0) {
        throw new Error('No content issues detected');
      }
      
      // Test 3: Quality issues
      const qualityData = {
        id: 'test_data_1',
        name: 'Test Data',
        value: NaN,
        items: [1, 2, 3, 4, 5],
        nested: {
          field: 'test'
        }
      };
      
      const qualityResult = this.issueDetector.detectIssues(qualityData);
      
      if (!qualityResult.success) {
        throw new Error('Failed to detect quality issues');
      }
      
      const qualityIssues = qualityResult.issues.filter(issue => issue.category === 'quality');
      
      if (qualityIssues.length === 0) {
        throw new Error('No quality issues detected');
      }
      
      // Test 4: Security issues
      const securityData = {
        id: 'test_data_1',
        name: 'Test Data',
        password: 'password123',
        secret: 'secret',
        token: 'token123',
        api_key: 'api_key_123',
        credit_card: '4111111111111111111',
        social_security: 'ssn:DROP TABLE users'
      };
      
      const securityResult = this.issueDetector.detectIssues(securityData);
      
      if (!securityResult.success) {
        throw new Error('Failed to detect security issues');
      }
      
      const securityIssues = securityResult.issues.filter(issue => issue.category === 'security');
      
      if (securityIssues.length === 0) {
        throw new Error('No security issues detected');
      }
      
      // Test 5: Performance issues
      const performanceData = {
        id: 'test_data_1',
        name: 'Test Data',
        items: Array.from({ length: 1000 }, (_, i) => i),
        nested: {
          items: Array.from({ length: 100 }, (_, i) => i)
        }
      };
      
      const performanceResult = this.issueDetector.detectIssues(performanceData);
      
      if (!performanceResult.success) {
        throw new Error('Failed to detect performance issues');
      }
      
      const performanceIssues = performanceResult.issues.filter(issue => issue.category === 'performance');
      
      if (performanceIssues.length === 0) {
        throw new Error('No performance issues detected');
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          structureIssues: structureIssues.length,
          contentIssues: contentIssues.length,
          qualityIssues: qualityIssues.length,
          securityIssues: securityIssues.length,
          performanceIssues: performanceIssues.length
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

  // Test severity assessment
  async testSeverityAssessment() {
    const testName = 'Severity Assessment Test';
    const startTime = Date.now();
    
    try {
      console.log('[ISSUE_DETECTOR_TEST] Testing severity assessment...');
      
      // Test 1: Critical issues
      const criticalData = {
        id: 'test_data_1',
        name: 'Test Data',
        value: null,
        items: [1, 2, 3, 4, 5],
        nested: {
          field: null
        }
      };
      
      const criticalResult = this.issueDetector.detectIssues(criticalData);
      
      if (!criticalResult.success) {
        throw new Error('Failed to detect critical issues');
      }
      
      const criticalIssues = criticalResult.issues.filter(issue => issue.severity === 'critical');
      
      if (criticalIssues.length === 0) {
        throw new Error('No critical issues detected');
      }
      
      // Test 2: High issues
      const highData = {
        id: 'test_data_1',
        name: 'Test Data',
        items: [1, 2, 3, 4, 5],
        nested: {
          field: ''
        }
      };
      
      const highResult = this.issueDetector.detectIssues(highData);
      
      if (!highResult.success) {
        throw new Error('Failed to detect high issues');
      }
      
      const highIssues = highResult.issues.filter(issue => issue.severity === 'high');
      
      if (highIssues.length === 0) {
        throw new Error('No high issues detected');
      }
      
      // Test 3: Medium issues
      const mediumData = {
        id: 'test_data_1',
        name: 'Test Data',
        items: [1, 2, 3, 4, 5],
        nested: {
          field: ''
        }
      };
      
      const mediumResult = this.issueDetector.detectIssues(mediumData);
      
      if (!mediumResult.success) {
        throw new Error('Failed to detect medium issues');
      }
      
      const mediumIssues = mediumResult.issues.filter(issue => issue.severity === 'medium');
      
      if (mediumIssues.length === 0) {
        throw new Error('No medium issues detected');
      }
      
      // Test 4: Low issues
      const lowData = {
        id: 'test_data_1',
        name: 'Test Data',
        items: [1, 2, 3, 4, 5],
        nested: {
          field: ''
        }
      };
      
      const lowResult = this.issueDetector.detectIssues(lowData);
      
      if (!lowResult.success) {
        throw new Error('Failed to detect low issues');
      }
      
      const lowIssues = lowResult.issues.filter(issue => issue.severity === 'low');
      
      if (lowIssues.length === 0) {
        throw new Error('No low issues detected');
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          criticalIssues: criticalIssues.length,
          highIssues: highIssues.length,
          mediumIssues: mediumIssues.length,
          lowIssues: lowIssues.length
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

  // Test issue resolution
  async testIssueResolution() {
    const testName = 'Issue Resolution Test';
    const startTime = Date.now();
    
    try {
      console.log('[ISSUE_DETECTOR_TEST] Testing issue resolution...');
      
      // Test 1: Auto-fixable issues
      const fixableData = {
        id: 'test_data_1',
        name: 'Test Data',
        items: [1, 2, 3, 4, 5],
        nested: {
          field: ''
        }
      };
      
      const fixableResult = this.issueDetector.detectIssues(fixableData);
      
      if (!fixableResult.success) {
        throw new Error('Failed to detect fixable issues');
      }
      
      const fixableIssues = fixableIssues.issues.filter(issue => issue.autoFixable);
      
      // Test 2: Auto-fix success rate
      const resolvedIssues = await this.issueDetector.resolveIssues(fixableIssues);
      
      if (!resolvedIssues.success) {
        throw new Error('Failed to resolve issues');
      }
      
      const resolutionRate = resolvedIssues.resolvedIssues.length / fixableIssues.length;
      
      if (resolutionRate < 0.8) {
        throw new Error(`Low resolution rate: ${resolutionRate}`);
      }
      
      // Test 3: Non-fixable issues
      const nonFixableData = {
        id: 'test_data_1',
        name: 'Test Data',
        items: [1, 2, 3, 4, 5],
        nested: {
          field: ''
        }
      };
      
      const nonFixableResult = this.issueDetector.detectIssues(nonFixableData);
      
      if (!nonFixableResult.success) {
        throw new Error('Failed to detect non-fixable issues');
      }
      
      const nonFixableIssues = nonFixableIssues.issues.filter(issue => !issue.autoFixable);
      
      if (nonFixableIssues.length === 0) {
        throw new Error('No non-fixable issues found');
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          fixableIssues: fixableIssues.length,
          nonFixableIssues: nonFixableIssues.length,
          resolutionRate: resolutionRate
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
  async testInvalidDataHandling() {
    const testName = 'Invalid Data Handling';
    const startTime = Date.now();
    
    try {
      console.log('[ISSUE_DETECTOR_TEST] Testing invalid data handling...');
      
      // Test 1: Null data
      const nullResult = this.issueDetector.detectIssues(null);
      
      if (!nullResult.success) {
        throw new Error('Failed to handle null data');
      }
      
      if (nullResult.issues.length > 0) {
        throw new Error('Null data should not produce issues');
      }
      
      // Test 2: Undefined data
      const undefinedResult = this.issueDetector.detectIssues(undefined);
      
      if (!undefinedResult.success) {
        throw new Error('Failed to handle undefined data');
      }
      
      if (undefinedResult.issues.length > 0) {
        throw new Error('Undefined data should not produce issues');
      }
      
      // Test 3: Empty data
      const emptyResult = this.issueDetector.detectIssues({});
      
      if (!emptyResult.success) {
        throw new Error('Failed to handle empty data');
      }
      
      if (emptyResult.issues.length > 0) {
        throw new Error('Empty data should not produce issues');
      }
      
      // Test 4: Circular reference
      const circularData = {};
      circularData.self = circularData;
      
      const circularResult = this.issueDetector.detectIssues(circularData);
      
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
          emptyData: 'PASSED',
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
      console.log('[ISSUEDECTOR_TEST] Testing edge cases...');
      
      // Test 1: Very large dataset
      const largeData = Array.from({ length: 10000 }, (_, i) => ({
        id: `item_${i}`,
        value: i * 2,
        items: Array.from({ length: 10 }, (_, k) => k)
      }));
      
      const largeResult = this.issueDetector.detectIssues(largeData);
      
      if (!largeResult.success) {
        throw new Error('Failed to handle large dataset');
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
      
      const nestedResult = this.issueDetector.detectIssues(nestedData);
      
      if (!nestedResult.success) {
        throw new Error('Failed to handle deeply nested data');
      }
      
      // Test 3: Mixed data types
      const mixedData = {
        string: 'test@example.com',
        number: 42,
        boolean: true,
        array: [1, 2, 3, 4, 5],
        object: { email: 'test@example.com' },
        null: null,
        undefined: undefined,
        date: '2026-05-21',
        url: 'https://example.com'
      };
      
      const mixedResult = this.issueDetector.detectIssues(mixedData);
      
      if (!mixedResult.success) {
        throw new Error('Failed to handle mixed data types');
      }
      
      // Test 4: Special characters
      const specialData = {
        id: 'test_data_1',
        name: 'Test Data',
        value: 'special',
        items: ['\t', '\n', '\r', '\t'],
        characters: ['\\u0000', '\\u0001', '\\u0002'],
        html: '<script>alert(1)</script>',
        sql: 'SELECT * FROM users',
        css: '.test { color: red; }',
        js: 'function() { return 42; }'
      };
      
      const specialResult = this.issueDetector.detectIssues(specialData);
      
      if (!specialResult.success) {
        throw new Error('Failed to handle special characters');
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          largeData: 'PASSED',
          nestedData: 'PASSED',
          mixedData: 'PASSED',
          specialCharacters: 'PASSED'
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

  // Test auto-resolution
  async testAutoResolution() {
    const testName = 'Auto-Resolution Test';
    const startTime = Date.now();
    
    try {
      console.log('[ISSUEDECTOR_TEST] Testing auto-resolution...');
      
      // Test 1: Auto-fixable issues with high confidence
      const autoFixableData = {
        id: 'test_data_1',
        name: 'Test Data',
        email: 'test@example.com',
        items: [1, 2, 3, 4, 5]
      };
      
      const autoFixableResult = this.issueDetector.detectIssues(autoFixableData);
      
      if (!autoFixableResult.success) {
        throw new Error('Failed to detect auto-fixable issues');
      }
      
      const autoFixableIssues = autoFixableResult.issues.filter(issue => issue.autoFixable);
      
      const resolvedIssues = await this.issueDetector.resolveIssues(autoFixableIssues);
      
      if (!resolvedIssues.success) {
        throw new Error('Failed to resolve auto-fixable issues');
      }
      
      const resolutionRate = resolvedIssues.resolvedIssues.length / autoFixableIssues.length;
      
      if (resolutionRate < 0.9) {
        throw new Error(`Low auto-resolution rate: ${resolutionRate}`);
      }
      
      // Test 2: Non-fixable issues
      const nonFixableData = {
        id: 'test_data_1',
        name: 'Test Data',
        items: [1, 2, 3, 4, 5],
        nested: {
          field: 'test'
        }
      };
      
      const nonFixableResult = this.issueDetector.detectIssues(nonFixableData);
      
      if (!nonFixableResult.success) {
        throw new Error('Failed to detect non-fixable issues');
      }
      
      const nonFixableIssues = nonFixableResult.issues.filter(issue => !issue.autoFixable);
      
      const resolvedNonFixableIssues = await this.issueDetector.resolveIssues(nonFixableIssues);
      
      if (resolvedNonFixableIssues.success) {
        throw new Error('Non-fixable issues should not be resolvable');
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          autoFixableIssues: autoFixableIssues.length,
          nonFixableIssues: nonFixableIssues.length,
          resolutionRate: resolutionRate,
          nonFixableResolutionRate: resolvedNonFixableIssues.resolvedIssues.length / nonFixableIssues.length
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

  // Test retry mechanism
  async testRetryMechanism() {
    const testName = 'Retry Mechanism Test';
    const startTime = Date.now();
    
    try {
      console.log('[ISSUEDECTOR_TEST] Testing retry mechanism...');
      
      // Test 1: Retry configuration
      const retryData = {
        id: 'test_data_1',
        name: 'Test Data',
        items: [1, 2, 3, 4, 5],
        nested: {
          field: 'test'
        }
      };
      
      const retryResult = this.issueDetector.detectIssues(retryData);
      
      if (!retryResult.success) {
        throw new Error('Failed to detect issues for retry test');
      }
      
      // Test 2: Retry on failure
      const retryConfig = {
        retryCount: 3,
        retryDelay: 100,
        maxRetries: 3
      };
      
      const retryTestData = {
        id: 'test_data_1',
        name: 'Test Data',
        items: [1, 2, 3, 4, 5],
        nested: {
          field: 'test'
        }
      };
      
      const retryResult2 = this.issueDetector.detectIssues(retryTestData);
      
      if (!retryResult2.success) {
        throw new Error('Failed to detect issues for retry test');
      }
      
      // Test 3: Retry limit exceeded
      const retryLimitTestData = {
        id: 'test_data_1',
        name: 'Test Data',
        items: [1, 2, 3, 4, 5],
        nested: {
          field: 'test'
        }
      };
      
      const retryLimitResult = this.issueDetector.detectIssues(retryLimitTestData);
      
      if (retryLimitResult.success) {
        throw new Error('Retry limit should prevent infinite retries');
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          retryConfiguration: 'PASSED',
          retryLimit: 'PASSED',
          retryLimitHandling: 'PASSED'
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

  // Test batch processing
  async testBatchProcessing() {
    const testName = 'Batch Processing Test';
    const startTime = Date.now();
    
    try {
      console.log('[ISSUE_DETECTORT_TEST] Testing batch processing...');
      
      // Test 1: Large batch processing
      const batchData = Array.from({ length: 100 }, (_, i) => ({
        id: `batch_item_${i}`,
        name: `Batch Item ${i}`,
        value: i * 10,
        items: Array.from({ length: 10 }, (_, k) => k * 2),
        nested: {
          items: Array.from({ length: 5 }, (_, k) => k * 3)
        }
      }));
      
      const batchResult = this.issueDetector.detectIssues(batchData);
      
      if (!batchResult.success) {
        throw new Error('Failed to detect issues in batch processing');
      }
      
      const batchIssues = batchResult.issues;
      
      if (batchIssues.length === 0) {
        throw new Error('No issues detected in batch data');
      }
      
      // Test 2: Batch issue categorization
      const batchCategories = batchIssues.map(issue => issue.category);
      const uniqueCategories = [...new Set(batchCategories)];
      
      const expectedCategories = ['structure', 'content', 'format', 'quality', 'security', 'performance'];
      
      for (const category of expectedCategories) {
        if (!uniqueCategories.includes(category)) {
          throw new Error(`Missing category: ${category}`);
        }
      }
      
      // Test 3: Batch resolution
      const batchResolvedIssues = await this.issueDetector.resolveIssues(batchIssues);
      
      if (!batchResolvedIssues.success) {
        throw new Error('Failed to resolve batch issues');
      }
      
      const resolutionRate = batchResolvedIssues.resolvedIssues.length / batchIssues.length;
      
      if (resolutionRate < 0.7) {
        throw new Error(`Low batch resolution rate: ${resolutionRate}`);
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          batchIssues: batchIssues.length,
          batchCategories: uniqueCategories.length,
          batchResolutionRate: resolutionRate
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
    
    console.log('[ISSUE_DETECTOR_TEST] Test Report:');
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed: ${report.summary.passedTests}`);
    console.log(`Failed: ${report.summary.failedTests}`);
    console.log(`Success Rate: ${report.summary.successRate.toFixed(2)}%`);
    console.log(`Total Duration: ${report.summary.totalDuration}ms`);
    
    // Save report to file
    const reportPath = './issue-detector-test-report.json';
    require('fs').writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`[ISSUE_DETECTOR_TEST] Test report saved to ${reportPath}`);
    
    return report;
  }

  // Generate recommendations
  generateRecommendations(results) {
    const recommendations = [];
    
    const failedTests = results.filter(result => result.status === 'FAILED');
    
    if (failedTests.length > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Fix failed issue detector tests',
        description: `${failedTests.length} tests failed, requiring immediate attention`
      });
    }
    
    const slowTests = results.filter(result => 
      result.duration > 1000
    );
    
    if (slowTests.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Optimize slow issue detector tests',
        description: `${slowTests.length} tests exceeded 1 second target`
      });
    }
    
    const classificationTests = results.filter(result => 
      result.testName && result.testName.includes('Classification')
    );
    
    if (classificationTests.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Review issue classification logic',
        description: `${classificationTests.length} tests require classification review`
      });
    }
    
    const resolutionTests = results.filter(result => 
      result.testName && result.testName.includes('Resolution')
    );
    
    if (resolutionTests.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Review issue resolution logic',
        description: `${resolutionTests.length} tests require resolution review`
      });
    }
    
    return recommendations;
  }

  // Destroy test suite
  destroy() {
    if (this.issueDetector) {
      this.issueDetector.destroy();
    }
    
    this.testResults = [];
    this.isInitialized = false;
    
    console.log('[ISSUE_DETECTOR_TEST] Test suite destroyed');
  }
}

// Global instance
let issueDetectorTest = null;

// Initialize test suite when ready
function initializeIssueDetectorTest() {
  if (!issueDetectorTest) {
    issueDetectorTest = new IssueDetectorTest();
  }
  return issueDetectorTest.initialize();
}

// Export for global access
window.issueDetectorTest = issueDetectorTest;

module.exports = {
  IssueDetectorTest,
  initializeIssueDetectorTest
};
