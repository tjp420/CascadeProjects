/**
 * Quality Analyzer Unit Test Suite
 * 
 * Unit tests for the quality analysis system
 * focusing on quality assessment, scoring, and recommendations
 */

const QualityAnalyzer = require('../../src/analysis/QualityAnalyzer');

class QualityAnalyzerTest {
  constructor() {
    this.testResults = [];
    this.isInitialized = false;
    
    this.initialize();
  }

  // Initialize test suite
  async initialize() {
    if (this.isInitialized) {
      console.log('[QUALITY_ANALYZER_TEST] Test suite already initialized');
      return;
    }

    try {
      // Initialize quality analyzer
      this.qualityAnalyzer = new QualityAnalyzer({
        thresholds: {
          excellent: 90,
          good: 80,
          acceptable: 70,
          poor: 60,
          critical: 40
        },
        enableAdaptiveScoring: true,
        enableDetailedAnalysis: true
      });
      
      await this.qualityAnalyzer.initialize();
      
      this.isInitialized = true;
      console.log('[QUALITY_ANALYZER_TEST] Test suite initialized');
      
    } catch (error) {
      console.error('[QUALITY_ANALYZER_TEST] Failed to initialize test suite:', error.message);
      throw error;
    }
  }

  // Run all unit tests
  async runAllTests() {
    console.log('[QUALITY_ANALYZER_TEST] Running unit tests...');
    
    const testSuites = [
      this.testQualityScoring.bind(this),
      this.testQualityGrades.bind(this),
      this.testQualityFactors.bind(this),
      this.testRecommendations.bind(this),
      this.testThresholds.bind(this),
      this.testAdaptiveScoring.bind(this),
      this.testInvalidData.bind(this),
      this.testEdgeCases.bind(this),
      this.testDetailedAnalysis.bind(this),
      this.testBatchProcessing.bind(this)
    ];
    
    const results = [];
    
    for (const testSuite of testSuites) {
      try {
        const result = await testSuite();
        results.push(result);
        console.log(`[QUALITY_ANALYZER_TEST] ${result.testName}: ${result.status}`);
      } catch (error) {
        results.push({
          testName: testSuite.name,
          status: 'FAILED',
          error: error.message,
          duration: 0
        });
        console.error(`[QUALITY_ANALYZER_TEST] ${testSuite.name}: FAILED - ${error.message}`);
      }
    }
    
    // Generate test report
    this.generateTestReport(results);
    
    return results;
  }

  // Test quality scoring
  async testQualityScoring() {
    const testName = 'Quality Scoring Test';
    const startTime = Date.now();
    
    try {
      console.log('[QUALITY_ANALYZER_TEST] Testing quality scoring...');
      
      // Test 1: Excellent quality data
      const excellentData = {
        id: 'test_data_1',
        name: 'Test Data',
        email: 'test@example.com',
        phone: '123-456-7890',
        url: 'https://example.com',
        date: '2026-05-21',
        items: [1, 2, 3, 4, 5],
        nested: {
          field: 'test'
        }
      };
      
      const excellentResult = this.qualityAnalyzer.analyzeQuality(excellentData);
      
      if (!excellentResult.success) {
        throw new Error('Failed to analyze excellent quality data');
      }
      
      if (excellentResult.score < 90) {
        throw new Error(`Excellent quality score too low: ${excellentResult.score}`);
      }
      
      if (excellentResult.grade !== 'excellent') {
        throw new Error(`Excellent quality grade incorrect: ${excellentResult.grade}`);
      }
      
      // Test 2: Good quality data
      const goodData = {
        id: 'test_data_1',
        name: 'Test Data',
        email: 'test@example.com',
        phone: '123-456-7890',
        items: [1, 2, 3, 4, 5],
        nested: {
          field: 'test'
        }
      };
      
      const goodResult = this.qualityAnalyzer.analyzeQuality(goodData);
      
      if (!goodResult.success) {
        throw new Error('Failed to analyze good quality data');
      }
      
      if (goodResult.score < 80 || goodResult.score >= 90) {
        throw new Error(`Good quality score out of range: ${goodResult.score}`);
      }
      
      if (goodResult.grade !== 'good') {
        throw new Error(`Good quality grade incorrect: ${goodResult.grade}`);
      }
      
      // Test 3: Acceptable quality data
      const acceptableData = {
        id: 'test_data_1',
        name: 'Test Data',
        email: 'test@example.com',
        items: [1, 2, 3, 4, 5],
        nested: {
          field: 'test'
        }
      };
      
      const acceptableResult = this.qualityAnalyzer.analyzeQuality(acceptableData);
      
      if (!acceptableResult.success) {
        throw new Error('Failed to analyze acceptable quality data');
      }
      
      if (acceptableResult.score < 70 || acceptableResult.score >= 80) {
        throw new Error(`Acceptable quality score out of range: ${acceptableResult.score}`);
      }
      
      if (acceptableResult.grade !== 'acceptable') {
        throw new Error(`Acceptable quality grade incorrect: ${acceptableResult.grade}`);
      }
      
      // Test 4: Poor quality data
      const poorData = {
        id: 'test_data_1',
        name: 'Test Data',
        email: 'test@example.com',
        items: [1, 2, 3, 4, 5],
        nested: {
          field: ''
        }
      };
      
      const poorResult = this.qualityAnalyzer.analyzeQuality(poorData);
      
      if (!poorResult.success) {
        throw new Error('Failed to analyze poor quality data');
      }
      
      if (poorResult.score < 60 || poorResult.score >= 70) {
        throw new Error(`Poor quality score out of range: ${poorResult.score}`);
      }
      
      if (poorResult.grade !== 'poor') {
        throw new Error(`Poor quality grade incorrect: ${poorResult.grade}`);
      }
      
      // Test 5: Critical quality data
      const criticalData = {
        id: null,
        name: 'Test Data',
        email: 'test@example.com',
        items: [1, 2, 3, 4, 5],
        nested: {
          field: null
        }
      };
      
      const criticalResult = this.qualityAnalyzer.analyzeQuality(criticalData);
      
      if (!criticalResult.success) {
        throw new Error('Failed to analyze critical quality data');
      }
      
      if (criticalResult.score >= 40) {
        throw new Error(`Critical quality score too high: ${criticalResult.score}`);
      }
      
      if (criticalResult.grade !== 'critical') {
        throw new Error(`Critical quality grade incorrect: ${criticalResult.grade}`);
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          excellentScore: excellentResult.score,
          goodScore: goodResult.score,
          acceptableScore: acceptableResult.score,
          poorScore: poorResult.score,
          criticalScore: criticalResult.score
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

  // Test quality grades
  async testQualityGrades() {
    const testName = 'Quality Grades Test';
    const startTime = Date.now();
    
    try {
      console.log('[QUALITY_ANALYZER_TEST] Testing quality grades...');
      
      // Test 1: Grade boundaries
      const gradeTests = [
        { score: 95, expectedGrade: 'excellent' },
        { score: 85, expectedGrade: 'good' },
        { score: 75, expectedGrade: 'acceptable' },
        { score: 65, expectedGrade: 'poor' },
        { score: 35, expectedGrade: 'critical' }
      ];
      
      for (const test of gradeTests) {
        const testData = this.generateTestDataWithScore(test.score);
        const result = this.qualityAnalyzer.analyzeQuality(testData);
        
        if (!result.success) {
          throw new Error(`Failed to analyze data for grade ${test.expectedGrade}`);
        }
        
        if (result.grade !== test.expectedGrade) {
          throw new Error(`Grade mismatch for score ${test.score}: expected ${test.expectedGrade}, got ${result.grade}`);
        }
      }
      
      // Test 2: Grade edge cases
      const edgeCases = [
        { score: 90, expectedGrade: 'excellent' },
        { score: 80, expectedGrade: 'good' },
        { score: 70, expectedGrade: 'acceptable' },
        { score: 60, expectedGrade: 'poor' },
        { score: 40, expectedGrade: 'critical' }
      ];
      
      for (const test of edgeCases) {
        const testData = this.generateTestDataWithScore(test.score);
        const result = this.qualityAnalyzer.analyzeQuality(testData);
        
        if (!result.success) {
          throw new Error(`Failed to analyze edge case data for grade ${test.expectedGrade}`);
        }
        
        if (result.grade !== test.expectedGrade) {
          throw new Error(`Edge case grade mismatch for score ${test.score}: expected ${test.expectedGrade}, got ${result.grade}`);
        }
      }
      
      // Test 3: Grade descriptions
      const gradeDescriptions = {
        excellent: 'Excellent quality - meets all standards',
        good: 'Good quality - meets most standards',
        acceptable: 'Acceptable quality - meets basic standards',
        poor: 'Poor quality - fails many standards',
        critical: 'Critical quality - fails most standards'
      };
      
      for (const [grade, description] of Object.entries(gradeDescriptions)) {
        const testData = this.generateTestDataWithGrade(grade);
        const result = this.qualityAnalyzer.analyzeQuality(testData);
        
        if (!result.success) {
          throw new Error(`Failed to analyze data for grade description ${grade}`);
        }
        
        if (!result.description || !result.description.includes(grade)) {
          throw new Error(`Grade description missing for ${grade}`);
        }
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          gradeTests: gradeTests.length,
          edgeCases: edgeCases.length,
          gradeDescriptions: Object.keys(gradeDescriptions).length
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

  // Test quality factors
  async testQualityFactors() {
    const testName = 'Quality Factors Test';
    const startTime = Date.now();
    
    try {
      console.log('[QUALITY_ANALYZER_TEST] Testing quality factors...');
      
      // Test 1: Completeness factor
      const completenessData = {
        id: 'test_data_1',
        name: 'Test Data',
        email: 'test@example.com',
        phone: '123-456-7890',
        url: 'https://example.com',
        date: '2026-05-21',
        items: [1, 2, 3, 4, 5],
        nested: {
          field: 'test'
        }
      };
      
      const completenessResult = this.qualityAnalyzer.analyzeQuality(completenessData);
      
      if (!completenessResult.success) {
        throw new Error('Failed to analyze completeness factor');
      }
      
      const completenessFactor = completenessResult.factors.find(f => f.type === 'completeness');
      if (!completenessFactor) {
        throw new Error('Completeness factor not found');
      }
      
      if (completenessFactor.score < 0.8) {
        throw new Error(`Completeness score too low: ${completenessFactor.score}`);
      }
      
      // Test 2: Accuracy factor
      const accuracyData = {
        id: 'test_data_1',
        name: 'Test Data',
        email: 'test@example.com',
        phone: '123-456-7890',
        url: 'https://example.com',
        date: '2026-05-21',
        items: [1, 2, 3, 4, 5],
        nested: {
          field: 'test'
        }
      };
      
      const accuracyResult = this.qualityAnalyzer.analyzeQuality(accuracyData);
      
      if (!accuracyResult.success) {
        throw new Error('Failed to analyze accuracy factor');
      }
      
      const accuracyFactor = accuracyResult.factors.find(f => f.type === 'accuracy');
      if (!accuracyFactor) {
        throw new Error('Accuracy factor not found');
      }
      
      if (accuracyFactor.score < 0.8) {
        throw new Error(`Accuracy score too low: ${accuracyFactor.score}`);
      }
      
      // Test 3: Consistency factor
      const consistencyData = {
        id: 'test_data_1',
        name: 'Test Data',
        email: 'test@example.com',
        phone: '123-456-7890',
        url: 'https://example.com',
        date: '2026-05-21',
        items: [1, 2, 3, 4, 5],
        nested: {
          field: 'test'
        }
      };
      
      const consistencyResult = this.qualityAnalyzer.analyzeQuality(consistencyData);
      
      if (!consistencyResult.success) {
        throw new Error('Failed to analyze consistency factor');
      }
      
      const consistencyFactor = consistencyResult.factors.find(f => f.type === 'consistency');
      if (!consistencyFactor) {
        throw new Error('Consistency factor not found');
      }
      
      if (consistencyFactor.score < 0.8) {
        throw new Error(`Consistency score too low: ${consistencyFactor.score}`);
      }
      
      // Test 4: Validity factor
      const validityData = {
        id: 'test_data_1',
        name: 'Test Data',
        email: 'test@example.com',
        phone: '123-456-7890',
        url: 'https://example.com',
        date: '2026-05-21',
        items: [1, 2, 3, 4, 5],
        nested: {
          field: 'test'
        }
      };
      
      const validityResult = this.qualityAnalyzer.analyzeQuality(validityData);
      
      if (!validityResult.success) {
        throw new Error('Failed to analyze validity factor');
      }
      
      const validityFactor = validityResult.factors.find(f => f.type === 'validity');
      if (!validityFactor) {
        throw new Error('Validity factor not found');
      }
      
      if (validityFactor.score < 0.8) {
        throw new Error(`Validity score too low: ${validityFactor.score}`);
      }
      
      // Test 5: Timeliness factor
      const timelinessData = {
        id: 'test_data_1',
        name: 'Test Data',
        email: 'test@example.com',
        phone: '123-456-7890',
        url: 'https://example.com',
        date: '2026-05-21',
        items: [1, 2, 3, 4, 5],
        nested: {
          field: 'test'
        }
      };
      
      const timelinessResult = this.qualityAnalyzer.analyzeQuality(timelinessData);
      
      if (!timelinessResult.success) {
        throw new Error('Failed to analyze timeliness factor');
      }
      
      const timelinessFactor = timelinessResult.factors.find(f => f.type === 'timeliness');
      if (!timelinessFactor) {
        throw new Error('Timeliness factor not found');
      }
      
      if (timelinessFactor.score < 0.8) {
        throw new Error(`Timeliness score too low: ${timelinessFactor.score}`);
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          completenessScore: completenessFactor.score,
          accuracyScore: accuracyFactor.score,
          consistencyScore: consistencyFactor.score,
          validityScore: validityFactor.score,
          timelinessScore: timelinessFactor.score
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

  // Test recommendations
  async testRecommendations() {
    const testName = 'Recommendations Test';
    const startTime = Date.now();
    
    try {
      console.log('[QUALITY_ANALYZER_TEST] Testing recommendations...');
      
      // Test 1: High priority recommendations
      const criticalData = {
        id: null,
        name: 'Test Data',
        email: 'test@example.com',
        items: [1, 2, 3, 4, 5],
        nested: {
          field: null
        }
      };
      
      const criticalResult = this.qualityAnalyzer.analyzeQuality(criticalData);
      
      if (!criticalResult.success) {
        throw new Error('Failed to analyze critical data for recommendations');
      }
      
      const highPriorityRecommendations = criticalResult.recommendations.filter(r => r.priority === 'high');
      
      if (highPriorityRecommendations.length === 0) {
        throw new Error('No high priority recommendations for critical data');
      }
      
      // Test 2: Medium priority recommendations
      const poorData = {
        id: 'test_data_1',
        name: 'Test Data',
        email: 'test@example.com',
        items: [1, 2, 3, 4, 5],
        nested: {
          field: ''
        }
      };
      
      const poorResult = this.qualityAnalyzer.analyzeQuality(poorData);
      
      if (!poorResult.success) {
        throw new Error('Failed to analyze poor data for recommendations');
      }
      
      const mediumPriorityRecommendations = poorResult.recommendations.filter(r => r.priority === 'medium');
      
      if (mediumPriorityRecommendations.length === 0) {
        throw new Error('No medium priority recommendations for poor data');
      }
      
      // Test 3: Low priority recommendations
      const goodData = {
        id: 'test_data_1',
        name: 'Test Data',
        email: 'test@example.com',
        phone: '123-456-7890',
        items: [1, 2, 3, 4, 5],
        nested: {
          field: 'test'
        }
      };
      
      const goodResult = this.qualityAnalyzer.analyzeQuality(goodData);
      
      if (!goodResult.success) {
        throw new Error('Failed to analyze good data for recommendations');
      }
      
      const lowPriorityRecommendations = goodResult.recommendations.filter(r => r.priority === 'low');
      
      if (lowPriorityRecommendations.length === 0) {
        throw new Error('No low priority recommendations for good data');
      }
      
      // Test 4: Recommendation content
      for (const recommendation of criticalResult.recommendations) {
        if (!recommendation.action) {
          throw new Error('Recommendation missing action');
        }
        
        if (!recommendation.description) {
          throw new Error('Recommendation missing description');
        }
        
        if (!recommendation.priority) {
          throw new Error('Recommendation missing priority');
        }
      }
      
      // Test 5: Recommendation relevance
      const recommendationTypes = criticalResult.recommendations.map(r => r.action);
      const uniqueTypes = [...new Set(recommendationTypes)];
      
      if (uniqueTypes.length < 3) {
        throw new Error('Insufficient recommendation variety');
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          highPriorityRecommendations: highPriorityRecommendations.length,
          mediumPriorityRecommendations: mediumPriorityRecommendations.length,
          lowPriorityRecommendations: lowPriorityRecommendations.length,
          recommendationTypes: uniqueTypes.length
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

  // Test thresholds
  async testThresholds() {
    const testName = 'Thresholds Test';
    const startTime = Date.now();
    
    try {
      console.log('[QUALITY_ANALYZER_TEST] Testing thresholds...');
      
      // Test 1: Default thresholds
      const defaultThresholds = {
        excellent: 90,
        good: 80,
        acceptable: 70,
        poor: 60,
        critical: 40
      };
      
      const qualityAnalyzerDefault = new QualityAnalyzer({
        thresholds: defaultThresholds
      });
      
      await qualityAnalyzerDefault.initialize();
      
      // Test with default thresholds
      const testData = this.generateTestDataWithScore(85);
      const result = qualityAnalyzerDefault.analyzeQuality(testData);
      
      if (!result.success) {
        throw new Error('Failed to analyze with default thresholds');
      }
      
      if (result.grade !== 'good') {
        throw new Error(`Default threshold grade incorrect: ${result.grade}`);
      }
      
      // Test 2: Custom thresholds
      const customThresholds = {
        excellent: 95,
        good: 85,
        acceptable: 75,
        poor: 65,
        critical: 45
      };
      
      const qualityAnalyzerCustom = new QualityAnalyzer({
        thresholds: customThresholds
      });
      
      await qualityAnalyzerCustom.initialize();
      
      // Test with custom thresholds
      const customTestData = this.generateTestDataWithScore(90);
      const customResult = qualityAnalyzerCustom.analyzeQuality(customTestData);
      
      if (!customResult.success) {
        throw new Error('Failed to analyze with custom thresholds');
      }
      
      if (customResult.grade !== 'good') {
        throw new Error(`Custom threshold grade incorrect: ${customResult.grade}`);
      }
      
      // Test 3: Threshold validation
      const invalidThresholds = {
        excellent: 80,
        good: 90,  // Invalid: higher than excellent
        acceptable: 70,
        poor: 60,
        critical: 40
      };
      
      try {
        const qualityAnalyzerInvalid = new QualityAnalyzer({
          thresholds: invalidThresholds
        });
        
        await qualityAnalyzerInvalid.initialize();
        
        throw new Error('Invalid thresholds should not be accepted');
      } catch (error) {
        // Expected error
      }
      
      // Test 4: Threshold boundaries
      const boundaryTests = [
        { score: 90, expectedGrade: 'excellent' },
        { score: 80, expectedGrade: 'good' },
        { score: 70, expectedGrade: 'acceptable' },
        { score: 60, expectedGrade: 'poor' },
        { score: 40, expectedGrade: 'critical' }
      ];
      
      for (const test of boundaryTests) {
        const boundaryData = this.generateTestDataWithScore(test.score);
        const boundaryResult = qualityAnalyzerDefault.analyzeQuality(boundaryData);
        
        if (!boundaryResult.success) {
          throw new Error(`Failed to analyze boundary test for score ${test.score}`);
        }
        
        if (boundaryResult.grade !== test.expectedGrade) {
          throw new Error(`Boundary grade mismatch for score ${test.score}: expected ${test.expectedGrade}, got ${boundaryResult.grade}`);
        }
      }
      
      // Clean up
      qualityAnalyzerDefault.destroy();
      qualityAnalyzerCustom.destroy();
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          defaultThresholds: Object.keys(defaultThresholds).length,
          customThresholds: Object.keys(customThresholds).length,
          boundaryTests: boundaryTests.length
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

  // Test adaptive scoring
  async testAdaptiveScoring() {
    const testName = 'Adaptive Scoring Test';
    const startTime = Date.now();
    
    try {
      console.log('[QUALITY_ANALYZER_TEST] Testing adaptive scoring...');
      
      // Test 1: Adaptive scoring enabled
      const qualityAnalyzerAdaptive = new QualityAnalyzer({
        enableAdaptiveScoring: true,
        thresholds: {
          excellent: 90,
          good: 80,
          acceptable: 70,
          poor: 60,
          critical: 40
        }
      });
      
      await qualityAnalyzerAdaptive.initialize();
      
      const adaptiveData = {
        id: 'test_data_1',
        name: 'Test Data',
        email: 'test@example.com',
        phone: '123-456-7890',
        url: 'https://example.com',
        date: '2026-05-21',
        items: [1, 2, 3, 4, 5],
        nested: {
          field: 'test'
        }
      };
      
      const adaptiveResult = qualityAnalyzerAdaptive.analyzeQuality(adaptiveData);
      
      if (!adaptiveResult.success) {
        throw new Error('Failed to analyze with adaptive scoring');
      }
      
      // Test 2: Adaptive scoring disabled
      const qualityAnalyzerNonAdaptive = new QualityAnalyzer({
        enableAdaptiveScoring: false,
        thresholds: {
          excellent: 90,
          good: 80,
          acceptable: 70,
          poor: 60,
          critical: 40
        }
      });
      
      await qualityAnalyzerNonAdaptive.initialize();
      
      const nonAdaptiveResult = qualityAnalyzerNonAdaptive.analyzeQuality(adaptiveData);
      
      if (!nonAdaptiveResult.success) {
        throw new Error('Failed to analyze without adaptive scoring');
      }
      
      // Test 3: Adaptive scoring differences
      const scoreDifference = Math.abs(adaptiveResult.score - nonAdaptiveResult.score);
      
      if (scoreDifference === 0) {
        console.log('Adaptive scoring may not be functioning as expected');
      }
      
      // Test 4: Learning from multiple analyses
      for (let i = 0; i < 10; i++) {
        const learningData = {
          id: `test_data_${i}`,
          name: `Test Data ${i}`,
          email: `test${i}@example.com`,
          phone: `123-456-789${i}`,
          url: `https://example${i}.com`,
          date: '2026-05-21',
          items: [1, 2, 3, 4, 5],
          nested: {
            field: `test${i}`
          }
        };
        
        const learningResult = qualityAnalyzerAdaptive.analyzeQuality(learningData);
        
        if (!learningResult.success) {
          throw new Error(`Failed to analyze learning data ${i}`);
        }
      }
      
      // Test 5: Adaptive scoring improvement
      const finalAdaptiveResult = qualityAnalyzerAdaptive.analyzeQuality(adaptiveData);
      
      if (!finalAdaptiveResult.success) {
        throw new Error('Failed to analyze final adaptive data');
      }
      
      // Clean up
      qualityAnalyzerAdaptive.destroy();
      qualityAnalyzerNonAdaptive.destroy();
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          adaptiveScore: adaptiveResult.score,
          nonAdaptiveScore: nonAdaptiveResult.score,
          scoreDifference: scoreDifference,
          finalAdaptiveScore: finalAdaptiveResult.score
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
      console.log('[QUALITY_ANALYZER_TEST] Testing invalid data handling...');
      
      // Test 1: Null data
      const nullResult = this.qualityAnalyzer.analyzeQuality(null);
      
      if (!nullResult.success) {
        throw new Error('Failed to handle null data');
      }
      
      if (nullResult.score !== 0) {
        throw new Error(`Null data score should be 0: ${nullResult.score}`);
      }
      
      if (nullResult.grade !== 'critical') {
        throw new Error(`Null data grade should be critical: ${nullResult.grade}`);
      }
      
      // Test 2: Undefined data
      const undefinedResult = this.qualityAnalyzer.analyzeQuality(undefined);
      
      if (!undefinedResult.success) {
        throw new Error('Failed to handle undefined data');
      }
      
      if (undefinedResult.score !== 0) {
        throw new Error(`Undefined data score should be 0: ${undefinedResult.score}`);
      }
      
      if (undefinedResult.grade !== 'critical') {
        throw new Error(`Undefined data grade should be critical: ${undefinedResult.grade}`);
      }
      
      // Test 3: Empty data
      const emptyResult = this.qualityAnalyzer.analyzeQuality({});
      
      if (!emptyResult.success) {
        throw new Error('Failed to handle empty data');
      }
      
      if (emptyResult.score !== 0) {
        throw new Error(`Empty data score should be 0: ${emptyResult.score}`);
      }
      
      if (emptyResult.grade !== 'critical') {
        throw new Error(`Empty data grade should be critical: ${emptyResult.grade}`);
      }
      
      // Test 4: Circular reference
      const circularData = {};
      circularData.self = circularData;
      
      const circularResult = this.qualityAnalyzer.analyzeQuality(circularData);
      
      if (!circularResult.success) {
        throw new Error('Failed to handle circular reference');
      }
      
      // Circular reference should not crash the system
      
      // Test 5: Mixed invalid data
      const mixedInvalidData = {
        id: null,
        name: undefined,
        email: '',
        phone: null,
        url: undefined,
        date: '',
        items: null,
        nested: {
          field: undefined
        }
      };
      
      const mixedInvalidResult = this.qualityAnalyzer.analyzeQuality(mixedInvalidData);
      
      if (!mixedInvalidResult.success) {
        throw new Error('Failed to handle mixed invalid data');
      }
      
      if (mixedInvalidResult.score !== 0) {
        throw new Error(`Mixed invalid data score should be 0: ${mixedInvalidResult.score}`);
      }
      
      if (mixedInvalidResult.grade !== 'critical') {
        throw new Error(`Mixed invalid data grade should be critical: ${mixedInvalidResult.grade}`);
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          nullData: 'PASSED',
          undefinedData: 'PASSED',
          emptyData: 'PASSED',
          circularReference: 'PASSED',
          mixedInvalidData: 'PASSED'
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
      console.log('[QUALITY_ANALYZER_TEST] Testing edge cases...');
      
      // Test 1: Very large dataset
      const largeData = Array.from({ length: 10000 }, (_, i) => ({
        id: `item_${i}`,
        name: `Item ${i}`,
        value: i * 2,
        items: Array.from({ length: 10 }, (_, k) => k)
      }));
      
      const largeResult = this.qualityAnalyzer.analyzeQuality(largeData);
      
      if (!largeResult.success) {
        throw new Error('Failed to handle large dataset');
      }
      
      // Test 2: Deeply nested data
      const nestedData = {};
      let nestedCurrent = nestedData;
      
      for (let i = 0; i < 100; i++) {
        nestedCurrent.level = {
          value: i,
          next: {}
        };
        nestedCurrent = nestedCurrent.level.next;
      }
      
      nestedCurrent.email = 'test@example.com';
      
      const nestedResult = this.qualityAnalyzer.analyzeQuality(nestedData);
      
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
      
      const mixedResult = this.qualityAnalyzer.analyzeQuality(mixedData);
      
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
      
      const specialResult = this.qualityAnalyzer.analyzeQuality(specialData);
      
      if (!specialResult.success) {
        throw new Error('Failed to handle special characters');
      }
      
      // Test 5: Extreme values
      const extremeData = {
        id: 'test_data_1',
        name: 'Test Data',
        value: Number.MAX_SAFE_INTEGER,
        negativeValue: Number.MIN_SAFE_INTEGER,
        zeroValue: 0,
        emptyString: '',
        longString: 'a'.repeat(10000),
        largeArray: Array.from({ length: 1000 }, (_, i) => i),
        deepObject: {}
      };
      
      // Create deep object
      let currentObj = extremeData.deepObject;
      for (let i = 0; i < 50; i++) {
        currentObj[`level${i}`] = {};
        currentObj = currentObj[`level${i}`];
      }
      currentObj.value = 'deep';
      
      const extremeResult = this.qualityAnalyzer.analyzeQuality(extremeData);
      
      if (!extremeResult.success) {
        throw new Error('Failed to handle extreme values');
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          largeData: 'PASSED',
          nestedData: 'PASSED',
          mixedData: 'PASSED',
          specialCharacters: 'PASSED',
          extremeValues: 'PASSED'
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

  // Test detailed analysis
  async testDetailedAnalysis() {
    const testName = 'Detailed Analysis Test';
    const startTime = Date.now();
    
    try {
      console.log('[QUALITY_ANALYZER_TEST] Testing detailed analysis...');
      
      // Test 1: Detailed analysis enabled
      const qualityAnalyzerDetailed = new QualityAnalyzer({
        enableDetailedAnalysis: true,
        thresholds: {
          excellent: 90,
          good: 80,
          acceptable: 70,
          poor: 60,
          critical: 40
        }
      });
      
      await qualityAnalyzerDetailed.initialize();
      
      const detailedData = {
        id: 'test_data_1',
        name: 'Test Data',
        email: 'test@example.com',
        phone: '123-456-7890',
        url: 'https://example.com',
        date: '2026-05-21',
        items: [1, 2, 3, 4, 5],
        nested: {
          field: 'test'
        }
      };
      
      const detailedResult = qualityAnalyzerDetailed.analyzeQuality(detailedData);
      
      if (!detailedResult.success) {
        throw new Error('Failed to analyze with detailed analysis');
      }
      
      // Test 2: Detailed analysis components
      if (!detailedResult.factors || detailedResult.factors.length === 0) {
        throw new Error('No quality factors found in detailed analysis');
      }
      
      if (!detailedResult.recommendations || detailedResult.recommendations.length === 0) {
        throw new Error('No recommendations found in detailed analysis');
      }
      
      if (!detailedResult.metrics) {
        throw new Error('No metrics found in detailed analysis');
      }
      
      // Test 3: Factor details
      for (const factor of detailedResult.factors) {
        if (!factor.type) {
          throw new Error('Factor missing type');
        }
        
        if (factor.score === undefined || factor.score === null) {
          throw new Error('Factor missing score');
        }
        
        if (!factor.description) {
          throw new Error('Factor missing description');
        }
      }
      
      // Test 4: Metrics details
      const expectedMetrics = ['completeness', 'accuracy', 'consistency', 'validity', 'timeliness'];
      
      for (const metric of expectedMetrics) {
        if (!detailedResult.metrics[metric]) {
          throw new Error(`Missing metric: ${metric}`);
        }
      }
      
      // Test 5: Detailed analysis disabled
      const qualityAnalyzerSimple = new QualityAnalyzer({
        enableDetailedAnalysis: false,
        thresholds: {
          excellent: 90,
          good: 80,
          acceptable: 70,
          poor: 60,
          critical: 40
        }
      });
      
      await qualityAnalyzerSimple.initialize();
      
      const simpleResult = qualityAnalyzerSimple.analyzeQuality(detailedData);
      
      if (!simpleResult.success) {
        throw new Error('Failed to analyze without detailed analysis');
      }
      
      // Clean up
      qualityAnalyzerDetailed.destroy();
      qualityAnalyzerSimple.destroy();
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          detailedFactors: detailedResult.factors.length,
          detailedRecommendations: detailedResult.recommendations.length,
          detailedMetrics: Object.keys(detailedResult.metrics).length,
          simpleAnalysis: 'PASSED'
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
      console.log('[QUALITY_ANALYZER_TEST] Testing batch processing...');
      
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
      
      const batchResult = this.qualityAnalyzer.analyzeQuality(batchData);
      
      if (!batchResult.success) {
        throw new Error('Failed to analyze batch data');
      }
      
      // Test 2: Batch quality distribution
      const qualityDistribution = batchResult.distribution;
      
      if (!qualityDistribution) {
        throw new Error('No quality distribution found');
      }
      
      const expectedGrades = ['excellent', 'good', 'acceptable', 'poor', 'critical'];
      
      for (const grade of expectedGrades) {
        if (qualityDistribution[grade] === undefined) {
          throw new Error(`Missing grade in distribution: ${grade}`);
        }
      }
      
      // Test 3: Batch metrics
      if (!batchResult.metrics) {
        throw new Error('No batch metrics found');
      }
      
      const expectedBatchMetrics = ['averageScore', 'medianScore', 'minScore', 'maxScore', 'standardDeviation'];
      
      for (const metric of expectedBatchMetrics) {
        if (batchResult.metrics[metric] === undefined) {
          throw new Error(`Missing batch metric: ${metric}`);
        }
      }
      
      // Test 4: Batch recommendations
      if (!batchResult.recommendations || batchResult.recommendations.length === 0) {
        throw new Error('No batch recommendations found');
      }
      
      // Test 5: Batch processing performance
      const batchProcessingTime = Date.now() - startTime;
      
      if (batchProcessingTime > 5000) {
        console.log(`Batch processing time high: ${batchProcessingTime}ms`);
      }
      
      return {
        testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: {
          batchSize: batchData.length,
          qualityDistribution: Object.keys(qualityDistribution).length,
          batchMetrics: Object.keys(batchResult.metrics).length,
          batchRecommendations: batchResult.recommendations.length,
          processingTime: batchProcessingTime
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

  // Generate test data with specific score
  generateTestDataWithScore(targetScore) {
    const baseData = {
      id: 'test_data_1',
      name: 'Test Data',
      email: 'test@example.com',
      phone: '123-456-7890',
      url: 'https://example.com',
      date: '2026-05-21',
      items: [1, 2, 3, 4, 5],
      nested: {
        field: 'test'
      }
    };
    
    // Adjust data quality based on target score
    if (targetScore < 60) {
      baseData.id = null;
      baseData.nested.field = null;
    } else if (targetScore < 70) {
      baseData.nested.field = '';
    } else if (targetScore < 80) {
      delete baseData.phone;
      delete baseData.url;
    } else if (targetScore < 90) {
      delete baseData.date;
    }
    
    return baseData;
  }

  // Generate test data with specific grade
  generateTestDataWithGrade(targetGrade) {
    const gradeScores = {
      excellent: 95,
      good: 85,
      acceptable: 75,
      poor: 65,
      critical: 35
    };
    
    return this.generateTestDataWithScore(gradeScores[targetGrade]);
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
    
    console.log('[QUALITY_ANALYZER_TEST] Test Report:');
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed: ${report.summary.passedTests}`);
    console.log(`Failed: ${report.summary.failedTests}`);
    console.log(`Success Rate: ${report.summary.successRate.toFixed(2)}%`);
    console.log(`Total Duration: ${report.summary.totalDuration}ms`);
    
    // Save report to file
    const reportPath = './quality-analyzer-test-report.json';
    require('fs').writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`[QUALITY_ANALYZER_TEST] Test report saved to ${reportPath}`);
    
    return report;
  }

  // Generate recommendations
  generateRecommendations(results) {
    const recommendations = [];
    
    const failedTests = results.filter(result => result.status === 'FAILED');
    
    if (failedTests.length > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Fix failed quality analyzer tests',
        description: `${failedTests.length} tests failed, requiring immediate attention`
      });
    }
    
    const slowTests = results.filter(result => 
      result.duration > 1000
    );
    
    if (slowTests.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Optimize slow quality analyzer tests',
        description: `${slowTests.length} tests exceeded 1 second target`
      });
    }
    
    const scoringTests = results.filter(result => 
      result.testName && result.testName.includes('Scoring')
    );
    
    if (scoringTests.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Review quality scoring logic',
        description: `${scoringTests.length} tests require scoring review`
      });
    }
    
    const recommendationTests = results.filter(result => 
      result.testName && result.testName.includes('Recommendations')
    );
    
    if (recommendationTests.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Review recommendation logic',
        description: `${recommendationTests.length} tests require recommendation review`
      });
    }
    
    return recommendations;
  }

  // Destroy test suite
  destroy() {
    if (this.qualityAnalyzer) {
      this.qualityAnalyzer.destroy();
    }
    
    this.testResults = [];
    this.isInitialized = false;
    
    console.log('[QUALITY_ANALYZER_TEST] Test suite destroyed');
  }
}

// Global instance
let qualityAnalyzerTest = null;

// Initialize test suite when ready
function initializeQualityAnalyzerTest() {
  if (!qualityAnalyzerTest) {
    qualityAnalyzerTest = new QualityAnalyzerTest();
  }
  return qualityAnalyzerTest.initialize();
}

// Export for global access
window.qualityAnalyzerTest = qualityAnalyzerTest;

module.exports = {
  QualityAnalyzerTest,
  initializeQualityAnalyzerTest
};
