// Test to verify MockDataScanner has generatePriorityClassification method

console.log('Testing MockDataScanner fix...');

// Test 1: Check if MockDataScanner exists
if (typeof MockDataScanner !== 'undefined') {
    console.log('✓ MockDataScanner is defined');
    
    // Test 2: Create instance and check for generatePriorityClassification method
    const scanner = new MockDataScanner();
    if (typeof scanner.generatePriorityClassification === 'function') {
        console.log('✓ generatePriorityClassification method exists');
        
        // Test 3: Call the method with sample data
        const sampleResults = {
            summary: {
                criticalIssues: 2,
                totalIssues: 15
            }
        };
        
        const result = scanner.generatePriorityClassification(sampleResults);
        console.log('✓ Method returned:', result);
        
        if (result === 'high') {
            console.log('✓ Method returned expected result (high priority due to critical issues)');
        }
    } else {
        console.log('✗ generatePriorityClassification method is missing');
    }
} else {
    console.log('✗ MockDataScanner is not defined');
}

console.log('Test complete');