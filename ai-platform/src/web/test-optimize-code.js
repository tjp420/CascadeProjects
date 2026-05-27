/**
 * Test script for Optimize Code button functionality
 * Run this in the browser console to test the implementation
 */

function testOptimizeCodeFunction() {
    console.log('🧪 Testing Optimize Code functionality...');
    
    // Test 1: Check if function exists
    if (typeof window.optimizeCode === 'function') {
        console.log('✅ optimizeCode function exists');
    } else {
        console.log('❌ optimizeCode function not found');
        return false;
    }
    
    // Test 2: Check if modalManager exists
    if (typeof window.modalManager === 'object') {
        console.log('✅ modalManager exists');
    } else {
        console.log('⚠️ modalManager not found, creating fallback...');
        // Create fallback modal manager
        window.modalManager = {
            showModal: function(options) {
                console.log('🪟 Modal opened:', options.title);
                alert(`🔧 ${options.title}\n\n${options.content || 'Loading...'}`);
            },
            closeModal: function() {
                console.log('🪟 Modal closed');
            }
        };
    }
    
    // Test 3: Check if toast functions exist
    const toastFunctions = ['showSuccessToast', 'showErrorToast', 'showWarningToast'];
    toastFunctions.forEach(func => {
        if (typeof window[func] === 'function') {
            console.log(`✅ ${func} exists`);
        } else {
            console.log(`⚠️ ${func} not found, using fallback`);
        }
    });
    
    // Test 4: Mock API client for testing
    if (!window.apiClient) {
        console.log('🔧 Creating mock API client for testing...');
        window.apiClient = {
            getQualityMetrics: async () => ({
                overall: { score: 82, grade: 'B' },
                metrics: { 
                    complexity: 75, 
                    maintainability: 85, 
                    testCoverage: 65,
                    duplication: 20,
                    linesOfCode: 15678
                }
            }),
            getTechnicalDebt: async () => ({
                technicalDebtScore: 25,
                codeSmells: 8,
                complexityIssues: 12,
                estimatedHours: 40
            }),
            getPerformanceMetrics: async () => ({
                responseTime: 150,
                throughput: 800,
                memoryUsage: 40
            })
        };
    }
    
    console.log('✅ All dependencies available for testing');
    return true;
}

function runOptimizeCodeTest() {
    console.log('🚀 Running Optimize Code test...');
    
    if (testOptimizeCodeFunction()) {
        // Call the actual function
        window.optimizeCode().then(() => {
            console.log('✅ Optimize Code test completed successfully!');
        }).catch(error => {
            console.error('❌ Optimize Code test failed:', error);
        });
    } else {
        console.log('❌ Cannot run Optimize Code test - dependencies missing');
    }
}

// Auto-run tests when script is loaded
console.log('🔧 Optimize Code Test Script loaded');
console.log('📋 Available commands:');
console.log('- testOptimizeCodeFunction() - Check if all dependencies are available');
console.log('- runOptimizeCodeTest() - Run the actual Optimize Code function');

// Make functions globally available
window.testOptimizeCodeFunction = testOptimizeCodeFunction;
window.runOptimizeCodeTest = runOptimizeCodeTest;
