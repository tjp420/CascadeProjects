// Simple test for mock data scanner
import fs from 'fs/promises';
import path from 'path';

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
    },
    {
        name: 'test3.js',
        content: `// Database test setup
const testData = {
    connection: 'mysql://test@localhost:3306/testdb',
    user: 'test_user',
    password: 'password123',
    tables: ['test_users', 'test_orders']
};

// Jest mock setup
jest.mock('./api', () => ({
    getUsers: jest.fn(() => Promise.resolve(mockData)),
    createUser: jest.fn()
}));

// Test data factory
function createTestUser() {
    return {
        id: 'test_12345',
        email: 'sample@example.com',
        name: 'Demo User'
    };
}`
    }
];

// Simple pattern matcher test
function testPatternMatching() {
    console.log('🧪 Testing Pattern Matching...\n');
    
    // Test patterns that should match
    const testPatterns = [
        { pattern: /mock.*data/gi, name: 'mock data' },
        { pattern: /test.*@.*\.com/gi, name: 'test emails' },
        { pattern: /alert\(/gi, name: 'alert calls' },
        { pattern: /console\.log/gi, name: 'console.log' },
        { pattern: /https?:\/\/.*test/gi, name: 'test URLs' },
        { pattern: /lorem ipsum/gi, name: 'lorem ipsum' },
        { pattern: /\+1-555-\d{3}-\d{4}/gi, name: '555 phone numbers' },
        { pattern: /jest\.mock/gi, name: 'jest mocks' }
    ];
    
    testFiles.forEach((file, fileIndex) => {
        console.log(`📁 Testing file: ${file.name}`);
        console.log(`📊 Content length: ${file.content.length} characters`);
        
        testPatterns.forEach(({ pattern, name }) => {
            const matches = file.content.match(pattern);
            if (matches && matches.length > 0) {
                console.log(`  ✅ Found ${matches.length} ${name}: ${matches.slice(0, 3).join(', ')}`);
            } else {
                console.log(`  ❌ No ${name} found`);
            }
        });
        
        console.log('');
    });
}

// Test the actual scanner modules
async function testScannerModules() {
    console.log('🔧 Testing Scanner Modules...\n');
    
    try {
        // Try to import the modules
        const mockPatternsPath = path.join(process.cwd(), 'web', 'modules', 'mock-patterns.js');
        const scannerCorePath = path.join(process.cwd(), 'web', 'modules', 'scanner-core.js');
        
        console.log('📦 Checking module files...');
        
        try {
            await fs.access(mockPatternsPath);
            console.log('✅ mock-patterns.js exists');
        } catch (error) {
            console.log('❌ mock-patterns.js not found');
        }
        
        try {
            await fs.access(scannerCorePath);
            console.log('✅ scanner-core.js exists');
        } catch (error) {
            console.log('❌ scanner-core.js not found');
        }
        
        // Read and validate pattern structure
        console.log('\n🔍 Examining mock patterns...');
        const mockPatternsContent = await fs.readFile(mockPatternsPath, 'utf8');
        
        // Check for pattern definitions
        const patternMatches = mockPatternsContent.match(/pattern:\s*['"`]([^'"`]+)['"`]/g);
        if (patternMatches) {
            console.log(`✅ Found ${patternMatches.length} pattern definitions`);
            patternMatches.slice(0, 5).forEach((match, index) => {
                console.log(`  ${index + 1}: ${match}`);
            });
        } else {
            console.log('❌ No pattern definitions found');
        }
        
    } catch (error) {
        console.error('❌ Module test failed:', error.message);
    }
}

// Test pattern compilation
function testPatternCompilation() {
    console.log('🔨 Testing Pattern Compilation...\n');
    
    const testStringPatterns = [
        'mock.*data',
        'test.*@.*\\.com',
        'alert\\(',
        'console\\.log',
        'https?://.*test',
        'lorem ipsum',
        '\\+1-555-\\d{3}-\\d{4}',
        'jest\\.mock'
    ];
    
    testStringPatterns.forEach((patternStr, index) => {
        try {
            const regex = new RegExp(patternStr, 'gi');
            console.log(`✅ Pattern ${index + 1} compiled: ${patternStr}`);
            
            // Test against our test files
            let totalMatches = 0;
            testFiles.forEach(file => {
                const matches = file.content.match(regex);
                if (matches) {
                    totalMatches += matches.length;
                }
            });
            
            console.log(`   📊 Found ${totalMatches} total matches across test files`);
            
        } catch (error) {
            console.log(`❌ Pattern ${index + 1} failed to compile: ${patternStr}`);
            console.log(`   Error: ${error.message}`);
        }
    });
}

// Run all tests
async function runAllTests() {
    console.log('🚀 Starting Mock Data Scanner Tests\n');
    console.log('=' .repeat(50));
    
    testPatternMatching();
    console.log('-'.repeat(50));
    
    testPatternCompilation();
    console.log('-'.repeat(50));
    
    await testScannerModules();
    
    console.log('=' .repeat(50));
    console.log('✅ All tests completed!');
}

// Run the tests
runAllTests().catch(console.error);
