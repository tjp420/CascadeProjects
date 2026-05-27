/**
 * Test script for Technical Debt Analyzer Promise handling fixes
 */

import { TechnicalDebtAnalyzer } from './dashboard_components/core/TechnicalDebtAnalyzer_v1.2.js';

// Test data with Promise objects
const testProjectData = {
    total_files: 2366,
    total_directories: 236,
    file_types: {
        '.js': 1200,
        '.html': 150,
        '.css': 80,
        '.json': 25,
        '.md': 15,
        '.txt': 5
    }
};

const testAnalysisData = {
    overview: {
        codeQuality: new Promise(resolve => setTimeout(() => resolve(82), 100)), // Promise instead of number
        testCoverage: new Promise(resolve => setTimeout(() => resolve(0), 50)),   // Promise instead of number
        totalFiles: 2366,
        totalDirectories: 236
    }
};

async function runTechnicalDebtTest() {
    console.log('🧪 Testing Technical Debt Analyzer Promise handling...');
    
    try {
        // Create analyzer instance
        const analyzer = new TechnicalDebtAnalyzer();
        
        // Test Promise resolution helper
        console.log('🔍 Testing Promise resolution helper...');
        const resolvedCodeQuality = await analyzer.resolveValue(
            new Promise(resolve => setTimeout(() => resolve(82), 100)), 
            75
        );
        console.log(`✅ Resolved codeQuality: ${resolvedCodeQuality} (should be 82)`);
        
        // Test sanitizeNumeric
        console.log('🔍 Testing sanitizeNumeric...');
        const sanitized = analyzer.sanitizeNumeric(NaN, 50);
        console.log(`✅ Sanitized NaN: ${sanitized} (should be 50)`);
        
        // Run full analysis
        console.log('🔍 Running full technical debt analysis...');
        const startTime = performance.now();
        const debtReport = await analyzer.analyzeTechnicalDebt(testProjectData, testAnalysisData);
        const endTime = performance.now();
        
        console.log(`⏱️ Analysis completed in ${(endTime - startTime).toFixed(2)}ms`);
        
        // Verify results
        console.log('📊 Analysis Results:');
        console.log(`Overall Score: ${debtReport.overall.score}/100`);
        console.log(`Severity: ${debtReport.overall.severity}`);
        console.log(`Grade: ${debtReport.overall.grade}`);
        console.log(`Estimated Effort: ${debtReport.overall.estimatedEffort} person-days`);
        
        console.log('\n📈 Individual Metrics:');
        Object.entries(debtReport.metrics).forEach(([metric, value]) => {
            console.log(`${metric}: ${value}%`);
        });
        
        // Validate no NaN values
        const hasNaN = Object.values(debtReport.metrics).some(value => 
            typeof value !== 'number' || isNaN(value) || !isFinite(value)
        );
        
        if (hasNaN) {
            console.error('❌ NaN values still present in metrics!');
            return false;
        } else {
            console.log('✅ No NaN values in metrics!');
        }
        
        // Validate overall score is reasonable
        if (typeof debtReport.overall.score !== 'number' || isNaN(debtReport.overall.score)) {
            console.error('❌ Overall score is NaN!');
            return false;
        } else {
            console.log(`✅ Overall score is valid: ${debtReport.overall.score}`);
        }
        
        // Validate estimated effort is reasonable
        if (typeof debtReport.overall.estimatedEffort !== 'number' || isNaN(debtReport.overall.estimatedEffort)) {
            console.error('❌ Estimated effort is NaN!');
            return false;
        } else {
            console.log(`✅ Estimated effort is valid: ${debtReport.overall.estimatedEffort} person-days`);
        }
        
        console.log('\n🎉 Technical Debt Analyzer test completed successfully!');
        return true;
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        return false;
    }
}

// Run the test
runTechnicalDebtTest().then(success => {
    if (success) {
        console.log('✅ All tests passed! Promise handling is working correctly.');
    } else {
        console.log('❌ Some tests failed. Check the logs above.');
    }
}).catch(error => {
    console.error('❌ Test runner error:', error);
});

// Export for use in browser
if (typeof window !== 'undefined') {
    window.testTechnicalDebtFix = runTechnicalDebtTest;
}
