// Test the actual scanner modules
import { MockDataScanner } from './web/modules/mock-data-scanner.js';

// Test files with mock data patterns
const testFiles = [
    {
        name: 'test1.js',
        content: `// Test file with mock data patterns
const mockData = {
    users: [
        { name: 'John Doe', email: 'test@example.com' },
        { name: 'Jane Smith', email: 'demo@test.com' }
    ],
    apiEndpoint: 'https://jsonplaceholder.typicode.com/users',
    testDatabase: 'sqlite:///:memory:'
};

function testFunction() {
    alert('This is a test alert');
    console.log('Debug log message');
    return mockData.users.length;
}

// TODO: Implement proper API integration
// FIXME: Replace mock data with real data`
    },
    {
        name: 'test2.jsx',
        content: `import React from 'react';

const TestComponent = () => {
    const [data, setData] = React.useState([]);
    
    // Mock API call
    React.useEffect(() => {
        fetch('https://reqres.in/api/users')
            .then(response => response.json())
            .then(data => setData(data));
    }, []);
    
    return (
        <div>
            <h1>Sample Component</h1>
            <p>This is example content with lorem ipsum placeholder text.</p>
            <p>Phone: +1-555-123-4567</p>
            <p>Date: 2023-01-01</p>
        </div>
    );
};

export default TestComponent;`
    }
];

// Create File objects for testing
function createFileObjects() {
    return testFiles.map(testFile => {
        const blob = new Blob([testFile.content], { type: 'text/javascript' });
        return new File([blob], testFile.name, { type: 'text/javascript' });
    });
}

// Test scanner initialization
async function testScannerInitialization() {
    console.log('🔧 Testing Scanner Initialization...\n');
    
    try {
        const scanner = new MockDataScanner({
            confidenceThreshold: 0.5,
            enableContextAnalysis: true
        });
        
        console.log('✅ Scanner initialized successfully');
        console.log(`📊 Pattern matcher has ${scanner.patternMatcher.compiledPatterns?.length || 0} compiled patterns`);
        console.log(`🎯 Confidence threshold: ${scanner.config.confidenceThreshold}`);
        
        return scanner;
    } catch (error) {
        console.error('❌ Scanner initialization failed:', error);
        console.error('Stack:', error.stack);
        return null;
    }
}

// Test individual file scanning
async function testFileScanning(scanner) {
    console.log('\n🔍 Testing File Scanning...\n');
    
    if (!scanner) {
        console.log('❌ Cannot test scanning - scanner not initialized');
        return;
    }
    
    for (const testFile of testFiles) {
        console.log(`📁 Scanning: ${testFile.name}`);
        
        try {
            const matches = scanner.scanContent(testFile.content, testFile.name);
            console.log(`  📊 Found ${matches.length} matches`);
            
            if (matches.length > 0) {
                matches.slice(0, 3).forEach((match, index) => {
                    console.log(`    ${index + 1}. "${match.match}" (confidence: ${match.confidence}, category: ${match.category})`);
                });
            }
            
        } catch (error) {
            console.error(`  ❌ Error scanning ${testFile.name}:`, error.message);
        }
        
        console.log('');
    }
}

// Test full scan with File objects
async function testFullScan(scanner) {
    console.log('🚀 Testing Full Scan with File Objects...\n');
    
    if (!scanner) {
        console.log('❌ Cannot test full scan - scanner not initialized');
        return;
    }
    
    try {
        const fileObjects = createFileObjects();
        console.log(`📁 Created ${fileObjects.length} File objects`);
        
        const report = await scanner.scanFiles(fileObjects, (processed, total, fileName) => {
            console.log(`⏳ Progress: ${processed}/${total} - ${fileName}`);
        });
        
        console.log('\n📊 Scan Results:');
        console.log(`  Total Files: ${report.summary.totalFiles}`);
        console.log(`  Total Matches: ${report.summary.totalMatches}`);
        console.log(`  Files with Findings: ${report.summary.filesWithFindings}`);
        console.log(`  Health Score: ${report.summary.healthScore}/100 (${report.summary.healthGrade})`);
        console.log(`  Status: ${report.summary.healthStatus}`);
        
        if (report.categories && report.categories.length > 0) {
            console.log('\n📋 Categories:');
            report.categories.forEach(category => {
                console.log(`  ${category.category}: ${category.count} - ${category.description}`);
            });
        }
        
        if (report.severity) {
            console.log('\n⚠️ Severity Breakdown:');
            console.log(`  High: ${report.severity.high}`);
            console.log(`  Medium: ${report.severity.medium}`);
            console.log(`  Low: ${report.severity.low}`);
        }
        
        return report;
        
    } catch (error) {
        console.error('❌ Full scan failed:', error);
        console.error('Stack:', error.stack);
        return null;
    }
}

// Test pattern matching directly
async function testPatternMatchingDirectly(scanner) {
    console.log('\n🎯 Testing Pattern Matching Directly...\n');
    
    if (!scanner || !scanner.patternMatcher) {
        console.log('❌ Cannot test pattern matching - scanner not initialized');
        return;
    }
    
    const testContent = testFiles[0].content; // Use first test file
    console.log(`📝 Testing with content from ${testFiles[0].name}`);
    console.log(`📊 Content length: ${testContent.length} characters`);
    
    try {
        const matches = scanner.patternMatcher.match(testContent);
        console.log(`🔍 Pattern matcher found ${matches.length} raw matches`);
        
        if (matches.length > 0) {
            console.log('\n📋 First 5 matches:');
            matches.slice(0, 5).forEach((match, index) => {
                console.log(`  ${index + 1}. "${match.match}" (confidence: ${match.confidence}, category: ${match.category})`);
            });
            
            // Test confidence filtering
            const threshold = scanner.config.confidenceThreshold;
            const filteredMatches = matches.filter(match => match.confidence >= threshold);
            console.log(`\n✅ After filtering (threshold ${threshold}): ${filteredMatches.length} matches remain`);
        }
        
    } catch (error) {
        console.error('❌ Pattern matching failed:', error);
        console.error('Stack:', error.stack);
    }
}

// Run all tests
async function runAllTests() {
    console.log('🚀 Starting Mock Data Scanner Module Tests\n');
    console.log('=' .repeat(60));
    
    const scanner = await testScannerInitialization();
    
    await testPatternMatchingDirectly(scanner);
    console.log('-'.repeat(60));
    
    await testFileScanning(scanner);
    console.log('-'.repeat(60));
    
    await testFullScan(scanner);
    
    console.log('=' .repeat(60));
    console.log('✅ All module tests completed!');
}

// Run the tests
runAllTests().catch(console.error);
