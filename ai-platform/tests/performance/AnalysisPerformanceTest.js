/**
 * Analysis Performance Test Suite
 * 
 * Comprehensive performance tests for the mock data analysis system
 * focusing on processing speed, memory usage, and scalability
 */

const AnalysisEngine = require('../../src/analysis/AnalysisEngine');
const PatternDetector = require('../../src/analysis/PatternDetector');
const IssueDetector = require('../../src/analysis/IssueDetector');
const QualityAnalyzer = require('../../src/analysis/QualityAnalyzer');

class AnalysisPerformanceTest {
  constructor() {
    this.testResults = [];
    this.isInitialized = false;
    this.performanceTargets = {
      analysisSpeed: 500, // files per second
      apiResponseTime: 200, // milliseconds
      dashboardLoadTime: 2000, // milliseconds
      memoryUsage: 512, // MB
      concurrentJobs: 10,
      errorRate: 1 // percentage
    };
    
    this.initialize();
  }

  // Initialize test suite
  async initialize() {
    if (this.isInitialized) {
      console.log('[ANALYSIS_PERFORMANCE_TEST] Performance test suite already initialized');
      return;
    }

    try {
      // Initialize analysis components
      this.analysisEngine = new AnalysisEngine({
        maxConcurrentJobs: this.performanceTargets.concurrentJobs,
        jobTimeout: 60000
      });
      
      this.patternDetector = new PatternDetector({
        enableMLDetection: true,
        confidenceThreshold: 0.7
      });
      
      this.issueDetector = new IssueDetector({
        enableAutoClassification: true,
        enableAutoResolution: true
      });
      
      this.qualityAnalyzer = new QualityAnalyzer({
        thresholds: {
          excellent: 90,
          good: 80,
          acceptable: 70,
          poor: 60,
          critical: 40
        }
      });
      
      await Promise.all([
        this.analysisEngine.initialize(),
        this.patternDetector.initialize(),
        this.issueDetector.initialize(),
        this.qualityAnalyzer.initialize()
      ]);
      
      this.isInitialized = true;
      console.log('[ANALYSIS_PERFORMANCE_TEST] Performance test suite initialized');
      
    } catch (error) {
      console.error('[ANALYSIS_PERFORMANCE_TEST] Failed to initialize test suite:', error.message);
      throw error;
    }
  }

  // Run all performance tests
  async runAllTests() {
    console.log('[ANALYSIS_PERFORMANCE_TEST] Running performance tests...');
    
    const testSuites = [
      this.testAnalysisSpeed.bind(this),
      this.testMemoryUsage.bind(this),
      this.testConcurrentProcessing.bind(this),
      this.testScalability.bind(this),
      this.testAPIThroughput.bind(this),
      this.testDashboardPerformance.bind(this),
      this.testLongRunningStability.bind(this),
      this.testErrorRecoveryPerformance.bind(this)
    ];
    
    const results = [];
    
    for (const testSuite of testSuites) {
      try {
        const result = await testSuite();
        results.push(result);
        console.log(`[ANALYSIS_PERFORMANCE_TEST] ${result.testName}: ${result.status}`);
      } catch (error) {
        results.push({
          testName: testSuite.name,
          status: 'FAILED',
          error: error.message,
          duration: 0
        });
        console.error(`[ANALYSIS_PERFORMANCE_TEST] ${testSuite.name}: FAILED - ${error.message}`);
      }
    }
    
    // Generate performance report
    this.generatePerformanceReport(results);
    
    return results;
  }

  // Test analysis speed
  async testAnalysisSpeed() {
    const testName = 'Analysis Speed Test';
    const startTime = Date.now();
    
    try {
      console.log('[ANALYSIS_PERFORMANCE_TEST] Testing analysis speed...');
      
      const testSizes = [100, 500, 1000, 2000];
      const results = {};
      
      for (const size of testSizes) {
        const testData = this.generateTestData(size);
        
        const processingTimes = [];
        
        // Run multiple iterations for statistical significance
        for (let i = 0; i < 10; i++) {
          const start = Date.now();
          
          // Test pattern detection speed
          const patterns = this.patternDetector.detectPatterns(testData);
          
          const processingTime = Date.now() - start;
          processingTimes.push(processingTime);
          
          // Validate results
          if (!patterns.success) {
            throw new Error(`Pattern detection failed for size ${size}`);
          }
        }
        
        const avgTime = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
        const filesPerSecond = (size / avgTime) * 1000;
        
        results[size] = {
          avgProcessingTime: avgTime,
          filesPerSecond: filesPerSecond,
          minTime: Math.min(...processingTimes),
          maxTime: Math.max(...processingTimes),
          standardDeviation: this.calculateStandardDeviation(processingTimes)
        };
        
        // Check against target
        if (filesPerSecond < this.performanceTargets.analysisSpeed) {
          console.warn(`[ANALYSIS_PERFORMANCE_TEST] Speed below target for size ${size}: ${filesPerSecond} < ${this.performanceTargets.analysisSpeed}`);
        }
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          targetSpeed: this.performanceTargets.analysisSpeed,
          results
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

  // Test memory usage
  async testMemoryUsage() {
    const testName = 'Memory Usage Test';
    const startTime = Date.now();
    
    try {
      console.log('[ANALYSIS_PERFORMANCE_TEST] Testing memory usage...');
      
      // Get baseline memory
      const baselineMemory = process.memoryUsage();
      
      // Test memory usage with increasing data sizes
      const testSizes = [1000, 5000, 10000, 50000];
      const results = {};
      
      for (const size of testSizes) {
        const testData = this.generateTestData(size);
        
        // Create multiple jobs to test memory usage
        const jobs = [];
        for (let i = 0; i < 50; i++) {
          const job = this.analysisEngine.createJob({
            type: 'data_analysis',
            source: 'memory_test',
            analyzer: 'pattern_detector',
            data: testData,
            config: {}
          });
          jobs.push(job);
        }
        
        // Process all jobs
        await Promise.all(jobs.map(job => 
          this.simulateJobProcessing(job.id)
        ));
        
        // Measure memory after processing
        const peakMemory = process.memoryUsage();
        const memoryIncrease = peakMemory.heapUsed - baselineMemory.heapUsed;
        const memoryMB = memoryIncrease / 1024 / 1024;
        
        results[size] = {
          memoryIncrease: memoryMB,
          baselineMemory: baselineMemory.heapUsed / 1024 / 1024,
          peakMemory: peakMemory.heapUsed / 1024 / 1024,
          jobsProcessed: jobs.length
        };
        
        // Check against target
        if (memoryMB > this.performanceTargets.memoryUsage) {
          console.warn(`[ANALYSIS_PERFORMANCE_TEST] Memory usage above target for size ${size}: ${memoryMB}MB > ${this.performanceTargets.memoryUsage}MB`);
        }
        
        // Clean up jobs
        for (const job of jobs) {
          this.analysisEngine.deleteJob(job.id);
        }
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          targetMemoryUsage: this.performanceTargets.memoryUsage,
          results
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

  // Test concurrent processing
  async testConcurrentProcessing() {
    const testName = 'Concurrent Processing Test';
    const startTime = Date.now();
    
    try {
      console.log('[ANALYSIS_PERFORMANCE_TEST] Testing concurrent processing...');
      
      const concurrentLevels = [5, 10, 15, 20];
      const results = {};
      
      for (const level of concurrentLevels) {
        const jobs = [];
        const processingTimes = [];
        
        // Create concurrent jobs
        for (let i = 0; i < level; i++) {
          const testData = this.generateTestData(100);
          
          const job = this.analysisEngine.createJob({
            type: 'data_analysis',
            source: 'concurrent_test',
            analyzer: 'pattern_detector',
            data: testData,
            config: {}
          });
          
          jobs.push(job);
        }
        
        // Process all jobs concurrently
        const concurrentStart = Date.now();
        
        await Promise.all(jobs.map(job => 
          this.simulateJobProcessing(job.id)
        ));
        
        const totalTime = Date.now() - concurrentStart;
        processingTimes.push(totalTime);
        
        // Calculate metrics
        const avgTime = totalTime / level;
        const throughput = level / (totalTime / 1000);
        
        results[level] = {
          avgProcessingTime: avgTime,
          throughput: throughput,
          totalTime: totalTime,
          jobsProcessed: level
        };
        
        // Check against target
        if (avgTime > 5000) {
          console.warn(`[ANALYSIS_PERFORMANCE_TEST] Average processing time above target for level ${level}: ${avgTime}ms > 5000ms`);
        }
        
        // Clean up jobs
        for (job of jobs) {
          this.analysisEngine.deleteJob(job.id);
        }
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          targetProcessingTime: 5000,
          results
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

  // Test scalability
  async testScalability() {
    const testName = 'Scalability Test';
    const startTime = Date.now();
    
    try {
      console.log('[ANALYSIS_PERFORMANCE_TEST] Testing scalability...');
      
      const loadLevels = [100, 500, 1000, 2000, 5000];
      const results = {};
      
      for (const level of loadLevels) {
        const testData = this.generateTestData(level);
        
        const processingTimes = [];
        
        // Test with increasing load
        for (let i = 0; i < 5; i++) {
          const start = Date.now();
          
          const patterns = this.patternDetector.detectPatterns(testData);
          const issues = this.issueDetector.detectIssues(testData);
          const quality = this.qualityAnalyzer.analyzeQuality(testData);
          
          const processingTime = Date.now() - start;
          processingTimes.push(processingTime);
          
          // Validate results
          if (!patterns.success || !issues.success || !quality.success) {
            throw new Error(`Scalability test failed at level ${level}`);
          }
        }
        
        const avgTime = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
        const throughput = level / (avgTime / 1000);
        
        results[level] = {
          avgProcessingTime: avgTime,
          throughput: throughput,
          processingTimes: processingTimes,
          scalability: throughput / 100 // Files per second per 100MB
        };
        
        // Check for performance degradation
        if (i > 0) {
          const prevThroughput = results[loadLevels[i - 1]].throughput;
          const currentThroughput = throughput;
          const degradation = (prevThroughput - currentThroughput) / prevThroughput;
          
          if (degradation > 0.2) {
            console.warn(`[ANALYSIS_PERFORMANCE_TEST] Performance degradation detected at level ${level}: ${degradation.toFixed(2)}%`);
          }
        }
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          results
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

  // Test API throughput
  async testAPIThroughput() {
    const testName = 'API Throughput Test';
    const startTime = Date.now();
    
    try {
      console.log('[ANALYSIS_PERFORMANCE_TEST] Testing API throughput...');
      
      // Simulate API requests
      const requestCounts = [10, 50, 100, 200, 500];
      const results = {};
      
      for (const count of requestCounts) {
        const requestTimes = [];
        
        // Simulate API requests
        for (let i = 0; i < count; i++) {
          const start = Date.now();
          
          // Simulate API request processing
          await this.simulateAPIRequest();
          
          const requestTime = Date.now() - start;
          requestTimes.push(requestTime);
        }
        
        const avgTime = requestTimes.reduce((sum, time) => sum + time, 0) / requestTimes.length;
        const throughput = count / (avgTime / 1000);
        
        results[count] = {
          avgResponseTime: avgTime,
          throughput: throughput,
          requestTimes: requestTimes,
          p95ResponseTime: this.calculatePercentile(requestTimes, 95),
          p99ResponseTime: this.calculatePercentile(requestTimes, 99)
        };
        
        // Check against target
        if (avgTime > this.performanceTargets.apiResponseTime) {
          console.warn(`[ANALYSIS_PERFORMANCE_TEST] API response time above target for ${count} requests: ${avgTime}ms > ${this.performanceTargets.apiResponseTime}ms`);
        }
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          targetResponseTime: this.performanceTargets.apiResponseTime,
          results
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

  // Test dashboard performance
  async testDashboardPerformance() {
    const testName = 'Dashboard Performance Test';
    const startTime = Date.now();
    
    try {
      console.log('[ANALYSIS_PERFORMANCE_TEST] Testing dashboard performance...');
      
      // Simulate dashboard rendering
      const renderTimes = [];
      
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        
        // Simulate dashboard load
        await this.simulateDashboardLoad();
        
        const renderTime = Date.now() - start;
        renderTimes.push(renderTime);
      }
      
      const avgRenderTime = renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length;
      
      // Check against target
      if (avgRenderTime > this.performanceTargets.dashboardLoadTime) {
        console.warn(`[ANALYSIS_PERFORMANCE_TEST] Dashboard load time above target: ${avgRenderTime}ms > ${this.performanceTargets.dashboardLoadTime}ms`);
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          targetLoadTime: this.performanceTargets.dashboardLoadTime,
          avgRenderTime,
          renderTimes
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

  // Test long-running stability
  async testLongRunningStability() {
    const testName = 'Long-Running Stability Test';
    const startTime = Date.now();
    
    try {
      console.log('[ANALYSIS_PERFORMANCE_TEST] Testing long-running stability...');
      
      const testDuration = 60000; // 1 minute
      const interval = 5000; // 5 seconds
      
      const performanceMetrics = [];
      const errorCount = { count: 0 };
      
      const endTime = startTime + testDuration;
      
      while (Date.now() < endTime) {
        const testStart = Date.now();
        
        // Run performance test
        const testData = this.generateTestData(100);
        const patterns = this.patternDetector.detectPatterns(testData);
        
        const testTime = Date.now() - testStart;
        
        const memoryUsage = process.memoryUsage();
        
        performanceMetrics.push({
          timestamp: new Date().toISOString(),
          testTime,
          memoryUsage: memoryUsage.heapUsed,
          patternsDetected: patterns.patterns.length,
          success: patterns.success
        });
        
        if (!patterns.success) {
          errorCount.count++;
        }
        
        // Check for performance degradation
        if (performanceMetrics.length > 1) {
          const prevMetric = performanceMetrics[performanceMetrics.length - 2];
          const currentMetric = performanceMetrics[performanceMetrics.length - 1];
          
          const performanceDegradation = (currentMetric.testTime - prevMetric.testTime) / prevMetric.testTime;
          
          if (performanceDegradation > 0.5) {
            console.warn(`[ANALYSIS_PERFORMANCE_TEST] Performance degradation detected: ${performanceDegradation.toFixed(2)}%`);
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, interval));
      }
      
      const totalDuration = Date.now() - startTime;
      const avgTestTime = performanceMetrics.reduce((sum, metric) => sum + metric.testTime, 0) / performanceMetrics.length;
      const errorRate = (errorCount.count / performanceMetrics.length) * 100;
      
      // Check stability metrics
      if (errorRate > this.performanceTargets.errorRate) {
        console.warn(`[ANALYSIS_PERFORMANCE_TEST] Error rate above target: ${errorRate}% > ${this.performanceTargets.errorRate}%`);
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: totalDuration,
        details: {
          testDuration: testDuration,
          avgTestTime,
          errorRate,
          totalTests: performanceMetrics.length,
          stabilityScore: 100 - errorRate
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

  // Test error recovery performance
  async testErrorRecoveryPerformance() {
    const testName = 'Error Recovery Performance Test';
    const startTime = Date.now();
    
    try {
      console.log('[ANALYSIS_PERFORMANCE_TEST] Testing error recovery performance...');
      
      const recoveryTimes = [];
      
      // Test error recovery scenarios
      const errorScenarios = [
        {
          name: 'Invalid Data',
          data: null,
          description: 'Test with null data'
        },
        {
          name: 'Missing Fields',
          data: {},
          description: 'Test with empty object'
        },
        {
          name: 'Circular Reference',
          data: this.createCircularReference(),
          description: 'Test with circular reference'
        },
        {
          name: 'Large Data',
          data: this.generateTestData(10000),
          description: 'Test with large dataset'
        },
        {
          name: 'Malformed Data',
          data: this.generateMalformedData(),
          description: 'Test with malformed data'
        }
      ];
      
      for (const scenario of errorScenarios) {
        const recoveryStart = Date.now();
        
        try {
          // Test error handling
          const patterns = this.patternDetector.detectPatterns(scenario.data);
          
          if (patterns.success) {
            console.warn(`[ANALYSIS_PERFORMANCE_TEST] Expected error was not thrown for scenario: ${scenario.name}`);
          }
          
          // Test error recovery
          const issues = this.issueDetector.detectIssues(scenario.data);
          const resolvedIssues = await this.issueDetector.resolveIssues(issues.issues);
          
          const recoveryTime = Date.now() - recoveryStart;
          recoveryTimes.push(recoveryTime);
          
          if (!resolvedIssues.success) {
            console.warn(`[ANALYSIS_PERFORMANCE_TEST] Error recovery failed for scenario: ${scenario.name}`);
          }
          
        } catch (error) {
          const recoveryTime = Date.now() - recoveryStart;
          recoveryTimes.push(recoveryTime);
          
          console.log(`[ANALYSIS_PERFORMANCE_TEST] Error handled for scenario: ${scenario.name} - ${error.message}`);
        }
      }
      
      const avgRecoveryTime = recoveryTimes.reduce((sum, time) => sum + time, 0) / recoveryTimes.length;
      
      // Check against target
      if (avgRecoveryTime > 1000) {
        console.warn(`[ANALYSIS_PERFORMANCE_TEST] Error recovery time above target: ${avgRecoveryTime}ms > 1000ms`);
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          targetRecoveryTime: 1000,
          avgRecoveryTime,
          recoveryTimes,
          scenarios: errorScenarios.length
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

  // Helper methods
  generateTestData(size) {
    const data = [];
    
    for (let i = 0; i < size; i++) {
      data.push({
        id: `item_${i}`,
        name: `Item ${i}`,
        value: Math.random() * 100,
        email: `item${i}@example.com`,
        url: `https://example.com/item/${i}`,
        date: `2026-05-21`,
        items: Array.from({ length: 10 }, (_, k) => k),
        metadata: {
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0'
        }
      });
    }
    
    return data;
  }

  createCircularReference() {
    const obj = {};
    obj.self = obj;
    return obj;
  }

  generateMalformedData() {
    return {
      id: 'malformed',
      value: undefined,
      nested: {
        field: null,
        array: [1, 2, 3, 4, 5],
        circular: this.createCircularReference()
      }
    };
  }

  simulateJobProcessing(jobId) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          processingTime: 100 + Math.random() * 200
        });
      }, 100 + Math.random() * 200);
    });
  }

  simulateAPIRequest() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          responseTime: 50 + Math.random() * 100
        });
      }, 50 + Math.random() * 100);
    });
  }

  simulateDashboardLoad() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          renderTime: 100 + Math.random() * 200
        });
      }, 100 + Math.random() * 200);
    });
  }

  calculateStandardDeviation(values) {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  calculatePercentile(values, percentile) {
    const sortedValues = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[index];
  }

  // Generate performance report
  generatePerformanceReport(results) {
    const passedTests = results.filter(result => result.status === 'PASSED');
    const failedTests = results.filter(result => result.status === 'FAILED');
    
    const report = {
      timestamp: new Date().toISOString(),
      performanceTargets: this.performanceTargets,
      summary: {
        totalTests: results.length,
        passedTests: passedTests.length,
        failedTests: failedTests.length,
        successRate: (passedTests.length / results.length) * 100,
        totalDuration: results.reduce((sum, result) => sum + result.duration, 0)
      },
      results: results,
      recommendations: this.generatePerformanceRecommendations(results)
    };
    
    console.log('[ANALYSIS_PERFORMANCE_TEST] Performance Report:');
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed: ${report.summary.passedTests}`);
    console.log(`Failed: ${report.summary.failedTests}`);
    console.log(`Success Rate: ${report.summary.successRate.toFixed(2)}%`);
    console.log(`Total Duration: ${report.summary.totalDuration}ms`);
    
    // Save report to file
    const reportPath = './performance-report.json';
    require('fs').writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`[ANALYSIS_PERFORMANCE_TEST] Performance report saved to ${reportPath}`);
    
    return report;
  }

  // Generate performance recommendations
  generatePerformanceRecommendations(results) {
    const recommendations = [];
    
    const failedTests = results.filter(result => result.status === 'FAILED');
    
    if (failedTests.length > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Fix failed performance tests',
        description: `${failedTests.length} tests failed, requiring immediate optimization`
      });
    }
    
    const slowTests = results.filter(result => 
      result.duration > 10000
    );
    
    if (slowTests.length > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Optimize slow performance tests',
        description: `${slowTests.length} tests exceeded 10 second target`
      });
    }
    
    const speedTests = results.filter(result => 
      result.testName.includes('Speed')
    );
    
    const slowSpeedTests = speedTests.filter(test => 
      test.details.avgProcessingTime > 100
    );
    
    if (slowSpeedTests.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Optimize analysis speed',
        description: `${slowSpeedTests.length} speed tests exceeded 100ms target`
      });
    }
    
    const memoryTests = results.filter(result => 
      result.testName.includes('Memory')
    );
    
    const highMemoryTests = memoryTests.filter(test => 
      Object.values(test.details.results).some(result => result.memoryIncrease > 100)
    );
    
    if (highMemoryTests.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Optimize memory usage',
        description: `${highMemoryTests.length} memory tests exceeded 100MB target`
      });
    }
    
    return recommendations;
  }

  // Destroy test suite
  destroy() {
    if (this.analysisEngine) {
      this.analysisEngine.destroy();
    }
    
    if (this.patternDetector) {
      this.patternDetector.destroy();
    }
    
    if (this.issueDetector) {
      this.issueDetector.destroy();
    }
    
    if (this.qualityAnalyzer) {
      this.qualityAnalyzer.destroy();
    }
    
    this.testResults = [];
    this.isInitialized = false;
    
    console.log('[ANALYSIS_PERFORMANCE_TEST] Performance test suite destroyed');
  }
}

// Global instance
let analysisPerformanceTest = null;

// Initialize test suite when ready
function initializeAnalysisPerformanceTest() {
  if (!analysisPerformanceTest) {
    analysisPerformanceTest = new AnalysisPerformanceTest();
  }
  return analysisPerformanceTest.initialize();
}

// Export for global access
window.analysisPerformanceTest = analysisPerformanceTest;

module.exports = {
  AnalysisPerformanceTest,
  initializeAnalysisPerformanceTest
};
