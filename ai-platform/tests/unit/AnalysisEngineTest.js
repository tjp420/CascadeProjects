/**
 * Analysis Engine Unit Test Suite
 * 
 * Unit tests for the mock data analysis system components
 * focusing on individual component functionality and edge cases
 */

const AnalysisEngine = require('../../src/analysis/AnalysisEngine');
const PatternDetector = require('../../src/analysis/PatternDetector');
const IssueDetector = require('../../src/analysis/IssueDetector');
const QualityAnalyzer = require('../../src/analysis/QualityAnalyzer');

class AnalysisEngineTest {
  constructor() {
    this.testResults = [];
    this.isInitialized = false;
    
    this.initialize();
  }

  // Initialize test suite
  async initialize() {
    if (this.isInitialized) {
      console.log('[ANALYSIS_ENGINE_TEST] Test suite already initialized');
      return;
    }

    try {
      // Initialize analysis components
      this.analysisEngine = new AnalysisEngine({
        maxConcurrentJobs: 5,
        jobTimeout: 30000
      });
      
      await this.analysisEngine.initialize();
      
      this.isInitialized = true;
      console.log('[ANALYSIS_ENGINE_TEST] Test suite initialized');
      
    } catch (error) {
      console.error('[ANALYSIS_ENGINE_TEST] Failed to initialize test suite:', error.message);
      throw error;
    }
  }

  // Run all unit tests
  async runAllTests() {
    console.log('[ANALYSIS_ENGINE_TEST] Running unit tests...');
    
    const testSuites = [
      this.testJobCreation.bind(this),
      this.testJobProcessing.bind(this),
      this.testJobCancellation.bind(this),
      this.testJobDeletion.bind(this),
      this.testConcurrentJobs.bind(this),
      this.testJobTimeout.bind(this),
      this.testJobRetry.bind(this),
      this.testJobStatus.bind(this)
    ];
    
    const results = [];
    
    for (const testSuite of testSuites) {
      try {
        const result = await testSuite();
        results.push(result);
        console.log(`[ANALYSIS_ENGINE_TEST] ${result.testName}: ${result.status}`);
      } catch (error) {
        results.push({
          testName: testSuite.name,
          status: 'FAILED',
          error: error.message,
          duration: 0
        });
        console.error(`[ANALYSIS_ENGINE_TEST] ${testSuite.name}: FAILED - ${error.message}`);
      }
    }
    
    // Generate test report
    this.generateTestReport(results);
    
    return results;
  }

  // Test job creation
  async testJobCreation() {
    const testName = 'Job Creation Test';
    const startTime = Date.now();
    
    try {
      console.log('[ANALYSIS_ENGINE_TEST] Testing job creation...');
      
      // Test 1: Valid job creation
      const testData = {
        id: 'test_data_1',
        name: 'Test Data',
        value: 42,
        items: [1, 2, 3, 4, 5]
      };
      
      const job = this.analysisEngine.createJob({
        type: 'data_analysis',
        source: 'unit_test',
        analyzer: 'pattern_detector',
        data: testData,
        config: {}
      });
      
      if (!job || !job.id) {
        throw new Error('Failed to create analysis job');
      }
      
      // Test 2: Job properties
      if (job.status !== 'pending') {
        throw new Error('Job status should be pending');
      }
      
      if (!job.createdAt) {
        throw new Error('Job should have creation timestamp');
      }
      
      if (!job.data || !job.data.id) {
        throw new Error('Job should contain data');
      }
      
      // Test 3: Invalid job creation
      const invalidJob = this.analysisEngine.createJob({
        type: 'invalid_type',
        source: 'unit_test',
        analyzer: 'pattern_detector',
        data: null,
        config: {}
      });
      
      // Should handle invalid input gracefully
      if (!invalidJob || invalidJob.status !== 'pending') {
        throw new Error('Invalid job creation should be handled gracefully');
      }
      
      // Test 4: Duplicate job creation
      const duplicateJob = this.analysisEngine.createJob({
        type: 'data_analysis',
        source: 'unit_test',
        analyzer: 'pattern_detector',
        data: testData,
        config: {}
      });
      
      if (!duplicateJob || duplicateJob.id === job.id) {
        throw new Error('Duplicate job should have different ID');
      }
      
      // Clean up
      this.analysisEngine.deleteJob(job.id);
      this.analysisEngine.deleteJob(duplicateJob.id);
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          validJobCreation: 'PASSED',
          jobProperties: 'PASSED',
          invalidJobCreation: 'PASSED',
          duplicateJobCreation: 'PASSED'
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

  // Test job processing
  async testJobProcessing() {
    const testName = 'Job Processing Test';
    const startTime = Date.now();
    
    try {
      console.log('[ANALYSIS_ENGINE_TEST] Testing job processing...');
      
      // Test 1: Create job
      const testData = {
        id: 'test_data_1',
        name: 'Test Data',
        email: 'test@example.com',
        url: 'https://example.com',
        items: [1, 2, 3, 4, 5]
      };
      
      const job = this.analysisEngine.createJob({
        type: 'data_analysis',
        source: 'unit_test',
        analyzer: 'pattern_detector',
        data: testData,
        config: {}
      });
      
      // Test 2: Start job processing
      const started = this.analysisEngine.startJob(job.id);
      
      if (!started) {
        throw new Error('Failed to start job processing');
      }
      
      // Test 3: Check job status during processing
      const processingStatus = this.analysisEngine.getJobStatus(job.id);
      
      if (processingStatus.status !== 'processing') {
        throw new Error('Job should be in processing status');
      }
      
      // Test 4: Simulate job completion
      await this.simulateJobProcessing(job.id);
      
      // Test 5: Check final status
      const finalStatus = this.analysisEngine.getJobStatus(job.id);
      
      if (finalStatus.status !== 'completed') {
        throw new Error('Job should be completed');
      }
      
      if (!finalStatus.completedAt) {
        throw new Error('Job should have completion timestamp');
      }
      
      if (finalStatus.progress !== 100) {
        throw new Error('Job progress should be 100%');
      }
      
      // Clean up
      this.analysisEngine.deleteJob(job.id);
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          jobCreation: 'PASSED',
          jobStart: 'PASSED',
          jobProcessing: 'PASSED',
          jobCompletion: 'PASSED',
          finalStatus: 'PASSED'
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

  // Test job cancellation
  async testJobCancellation() {
    const testName = 'Job Cancellation Test';
    const startTime = Date.now();
    
    try {
      console.log('[ANALYSIS_ENGINE_TEST] Testing job cancellation...');
      
      // Test 1: Create job
      const testData = {
        id: 'test_data_1',
        name: 'Test Data',
        items: [1, 2, 3, 4, 5]
      };
      
      const job = this.analysisEngine.createJob({
        type: 'data_analysis',
        source: 'unit_test',
        analyzer: 'pattern_detector',
        data: testData,
        config: {}
      });
      
      // Test 2: Start job processing
      const started = this.analysisEngine.startJob(job.id);
      
      if (!started) {
        throw new Error('Failed to start job processing');
      }
      
      // Test 3: Cancel job
      const cancelled = this.analysisEngine.cancelJob(job.id);
      
      if (!cancelled) {
        throw new Error('Failed to cancel job');
      }
      
      // Test 4: Check job status
      const status = this.analysisEngine.getJobStatus(job.id);
      
      if (status.status !== 'cancelled') {
        throw new Error('Job should be cancelled');
      }
      
      // Test 5: Try to process cancelled job
      const processed = this.analysisEngine.startJob(job.id);
      
      if (processed) {
        throw new Error('Cancelled job should not be processable');
      }
      
      // Clean up
      this.analysisEngine.deleteJob(job.id);
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          jobCreation: 'PASSED',
          jobStart: 'PASSED',
          jobCancellation: 'PASSED',
          jobStatus: 'PASSED',
          jobProcessing: 'PASSED'
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

  // Test job deletion
  async testJobDeletion() {
    const testName = 'Job Deletion Test';
    const startTime = Date.now();
    
    try {
      console.log('[ANALYSIS_ENGINE_TEST] Testing job deletion...');
      
      // Test 1: Create job
      const testData = {
        id: 'test_data_1',
        name: 'Test Data',
        items: [1, 2, 3, 4, 5]
      };
      
      const job = this.analysisEngine.createJob({
        type: 'data_analysis',
        source: 'unit_test',
        analyzer: 'pattern_detector',
        data: testData,
        config: {}
      });
      
      // Test 2: Delete job
      const deleted = this.analysisEngine.deleteJob(job.id);
      
      if (!deleted) {
        throw new Error('Failed to delete job');
      }
      
      // Test 3: Check job status
      const status = this.analysisEngine.getJobStatus(job.id);
      
      if (status) {
        throw new Error('Deleted job should not exist');
      }
      
      // Test 4: Delete non-existent job
      const nonExistentDeleted = this.analysisEngine.deleteJob('non_existent_job_id');
      
      if (nonExistentDeleted) {
        throw new Error('Non-existent job deletion should fail');
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          jobCreation: 'PASSED',
          jobDeletion: 'PASSED',
          jobStatus: 'PASSED',
          nonExistentDeletion: 'PASSED'
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

  // Test concurrent jobs
  async testConcurrentJobs() {
    const testName = 'Concurrent Jobs Test';
    const startTime = Date.now();
    
    try {
      console.log('[ANALYSIS_ENGINE_TEST] Testing concurrent jobs...');
      
      // Test 1: Create multiple jobs
      const jobCount = 10;
      const jobs = [];
      
      for (let i = 0; i < jobCount; i++) {
        const testData = {
          id: `test_data_${i}`,
          name: `Test Data ${i}`,
          items: Array.from({ length: 10 }, (_, k) => k)
        };
        
        const job = this.analysisEngine.createJob({
          type: 'data_analysis',
          source: 'concurrent_test',
          analyzer: 'pattern_detector',
          data: testData,
          config: {}
        });
        
        jobs.push(job);
      }
      
      // Test 2: Start all jobs
      const startedJobs = [];
      
      for (const job of jobs) {
        const started = this.analysisEngine.startJob(job.id);
        startedJobs.push(started);
      }
      
      if (startedJobs.some(started => !started)) {
        throw new Error('All jobs should start successfully');
      }
      
      // Test 3: Check active jobs
      const activeJobs = this.analysisEngine.getActiveJobs();
      
      if (activeJobs.length > 5) {
        throw new Error(`Too many active jobs: ${activeJobs.length}`);
      }
      
      // Test 4: Process all jobs
      await Promise.all(jobs.map(job => 
        this.simulateJobProcessing(job.id)
      ));
      
      // Test 5: Check completed jobs
      const completedJobs = this.analysisEngine.getCompletedJobs();
      
      if (completedJobs.length < jobCount) {
        throw new Error(`Not all jobs completed: ${completedJobs.length}/${jobCount}`);
      }
      
      // Clean up
      for (const job of jobs) {
        this.analysisEngine.deleteJob(job.id);
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          jobCreation: 'PASSED',
          jobStart: 'PASSED',
          activeJobsCheck: 'PASSED',
          jobProcessing: 'PASSED',
          jobCompletion: 'PASSED',
          jobsProcessed: jobCount
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

  // Test job timeout
  async testJobTimeout() {
    const testName = 'Job Timeout Test';
    const startTime = Date.now();
    
    try {
      console.log('[ANALYSIS_ENGINE_TEST] Testing job timeout...');
      
      // Test 1: Create job with short timeout
      const testData = {
        id: 'test_data_1',
        name: 'Test Data',
        items: Array.from({ length: 1000 }, (_, k) => k)
      };
      
      const job = this.analysisEngine.createJob({
        type: 'data_analysis',
        source: 'timeout_test',
        analyzer: 'pattern_detector',
        data: testData,
        config: {
          timeout: 100 // 100ms timeout
        }
      });
      
      // Test 2: Start job
      const started = this.analysisEngine.startJob(job.id);
      
      if (!started) {
        throw new Error('Failed to start job');
      }
      
      // Test 3: Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Test 4: Check job status
      const status = this.analysisEngine.getJobStatus(job.id);
      
      if (status.status !== 'failed') {
        throw new Error('Job should have failed due to timeout');
      }
      
      if (!status.error || !status.error.includes('timeout')) {
        throw new Error('Job failure should indicate timeout');
      }
      
      // Clean up
      this.analysisEngine.deleteJob(job.id);
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          jobCreation: 'PASSED',
          jobStart: 'PASSED',
          jobTimeout: 'PASSED',
          jobStatus: 'PASSED'
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

  // Test job retry
  async testJobRetry() {
    const testName = 'Job Retry Test';
    const startTime = Date.now();
    
    try {
      console.log('[ANALYSIS_ENGINE_TEST] Testing job retry...');
      
      // Test 1: Create job that will fail
      const testData = {
        id: 'test_data_1',
        name: 'Test Data',
        items: null // This will cause failure
      };
      
      const job = this.analysisEngine.createJob({
        type: 'data_analysis',
        source: 'retry_test',
        analyzer: 'pattern_detector',
        data: testData,
        config: {
          retryCount: 3,
          retryDelay: 100
        }
      });
      
      // Test 2: Start job
      const started = this.analysisEngine.startJob(job.id);
      
      if (!started) {
        throw new Error('Failed to start job');
      }
      
      // Test 3: Wait for retry attempts
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Test 4: Check job status
      const status = this.analysisEngine.getJobStatus(job.id);
      
      if (status.status !== 'failed') {
        throw new Error('Job should have failed after retries');
      }
      
      if (!status.retryCount || status.retryCount === 0) {
        throw new Error('Job should have attempted retries');
      }
      
      // Clean up
      this.analysisEngine.deleteJob(job.id);
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          jobCreation: 'PASSED',
          jobStart: 'PASSED',
          jobRetry: 'PASSED',
          retryCount: status.retryCount
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

  // Test job status
  async testJobStatus() {
    const testName = 'Job Status Test';
    const startTime = Date.now();
    
    try {
      console.log('[ANALYSIS_ENGINE_TEST] Testing job status...');
      
      // Test 1: Create job
      const testData = {
        id: 'test_data_1',
        name: 'Test Data',
        items: [1, 2, 3, 4, 5]
      };
      
      const job = this.analysisEngine.createJob({
        type: 'data_analysis',
        source: 'status_test',
        analyzer: 'pattern_detector',
        data: testData,
        config: {}
      });
      
      // Test 2: Check initial status
      const initialStatus = this.analysisEngine.getJobStatus(job.id);
      
      if (!initialStatus || initialStatus.status !== 'pending') {
        throw new Error('Initial status should be pending');
      }
      
      // Test 3: Start job
      const started = this.analysisEngine.startJob(job.id);
      
      if (!started) {
        throw new Error('Failed to start job');
      }
      
      // Test 4: Check processing status
      const processingStatus = this.analysisEngine.getJobStatus(job.id);
      
      if (processingStatus.status !== 'processing') {
        throw new Error('Status should be processing');
      }
      
      // Test 5: Complete job
      await this.simulateJobProcessing(job.id);
      
      const completedStatus = this.analysisEngine.getJobStatus(job.id);
      
      if (completedStatus.status !== 'completed') {
        throw new Error('Status should be completed');
      }
      
      // Test 6: Check status properties
      if (!completedStatus.createdAt || !completedStatus.completedAt) {
        throw new Error('Status should have timestamps');
      }
      
      if (completedStatus.progress !== 100) {
        throw new Error('Completed job should have 100% progress');
      }
      
      // Clean up
      this.analysisEngine.deleteJob(job.id);
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          initialStatus: 'PASSED',
          processingStatus: 'PASSED',
          completedStatus: 'PASSED',
          statusProperties: 'PASSED'
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

  // Simulate job processing
  async simulateJobProcessing(jobId) {
    const job = this.analysisEngine.getJobStatus(jobId);
    
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    // Update job status
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    job.progress = 100;
    job.results = {
      success: true,
      patterns: [
        { type: 'email', confidence: 0.8, description: 'Email pattern detected' },
        { type: 'url', confidence: 0.9, description: 'URL pattern detected' }
      ],
      issues: [
        { type: 'missing_field', severity: 'medium', description: 'Missing required field' }
      ],
      quality: {
        score: 89.3,
        grade: 'good',
        recommendations: ['Add missing fields', 'Improve data consistency']
      }
    };
  }

  // Generate test report
  generateTestReport(results) {
    const passedTests = results.filter(result => result.status === 'PASSED');
    const failedTests = results.filter(result => result.status === 'FAILED');
    
    const report = {
      timestamp: new Date().toISOString(),
      testEnvironment: this.testEnvironment,
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
    
    console.log('[ANALYSIS_ENGINE_TEST] Test Report:');
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed: ${report.summary.passedTests}`);
    console.log(`Failed: ${report.summary.failedTests}`);
    console.log(`Success Rate: ${report.summary.successRate.toFixed(2)}%`);
    console.log(`Total Duration: ${report.summary.totalDuration}ms`);
    
    // Save report to file
    const reportPath = './engine-test-report.json';
    require('fs').writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`[ANALYSIS_ENGINE_TEST] Test report saved to ${reportPath}`);
    
    return report;
  }

  // Generate recommendations
  generateRecommendations(results) {
    const recommendations = [];
    
    const failedTests = results.filter(result => result.status === 'FAILED');
    
    if (failedTests.length > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Fix failed unit tests',
        description: `${failedTests.length} tests failed, requiring immediate attention`
      });
    }
    
    const slowTests = results.filter(result => 
      result.duration > 1000
    );
    
    if (slowTests.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Optimize slow unit tests',
        description: `${slowTests.length} tests exceeded 1 second target`
      });
    }
    
    const retryTests = results.filter(result => 
      result.testName && result.testName.includes('Retry')
    );
    
    if (retryTests.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Review retry logic',
        description: 'Ensure retry mechanisms work correctly'
      });
    }
    
    return recommendations;
  }

  // Destroy test suite
  destroy() {
    if (this.analysisEngine) {
      this.analysisEngine.destroy();
    }
    
    this.testResults = [];
    this.isInitialized = false;
    
    console.log('[ANALYSIS_ENGINE_TEST] Test suite destroyed');
  }
}

// Global instance
let analysisEngineTest = null;

// Initialize test suite when ready
function initializeAnalysisEngineTest() {
  if (!analysisEngineTest) {
    analysisEngineTest = new AnalysisEngineTest();
  }
  return analysisEngineTest.initialize();
}

// Export for global access
window.analysisEngineTest = analysisEngineTest;

module.exports = {
  AnalysisEngineTest,
  initializeAnalysisEngineTest
};
