// Test script to verify scanner improvements
import { MockDataScanner } from './mock_data_scanner.js';

// Test configuration with improved filtering
const config = {
    excludeDirectories: ['remediation-backups''node_modules', 'dist', 'build', '.git'],
    excludeExtensions: ['.pyc', '.exe', '.dll', '.so', '.bin', '.jpg', '.png', '.gif', '.pdf', '.zip'],
    maxFileSize: 10 * 1024 * 1024,
    confidenceThreshold: 0.7,
    enableContextAnalysis: true
};

// Create scanner instance
const scanner = new MockDataScanner(config);

// Test content samples
const testContent = {
    // Should be detected as Test Mock (high confidence)
    testFile: `
        const mockUser = jest.fn(() => ({ id: 1, name: 'Test User' }));
        const mockApi = vi.mock('./api');
        sinon.stub(database, 'query');
    `,
    
    // Should be detected as Development Placeholder (medium confidence)
    sourceFile: `
        // TODO: mock this implementation later
        const mockResponse = { data: 'placeholder' };
        function fetchData() {
            return mockData; // mockResponse to be implemented
        }
    `,
    
    // Should be filtered out (framework code)
    frameworkFile: `
        var ReactCurrentDispatcher = ReactSharedInternals.ReactCurrentDispatcher;
        function injectInternals(internals) {
            if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === 'undefined') {
                return false;
            }
        }
    `,
    
    // Binary content simulation (should be filtered)
    binaryContent: '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f'
};

console.log('Testing Mock Data Scanner Improvements...\n');

// Test 1: Test file detection
console.log('1. Testing Test Mock Detection:');
const testResult = scanner.scanContent(testContent.testFile, 'test.user.js', 'text/javascript', {
    isTestFile: true,
    isSourceFile: false,
    isFrameworkCode: false,
    confidence: 1.0
});
console.log('Test file results:', testResult.findings);

// Test 2: Source file detection
console.log('\n2. Testing Development Placeholder Detection:');
const sourceResult = scanner.scanContent(testContent.sourceFile, 'app.js', 'text/javascript', {
    isTestFile: false,
    isSourceFile: true,
    isFrameworkCode: false,
    confidence: 0.8
});
console.log('Source file results:', sourceResult.findings);

// Test 3: Framework code filtering
console.log('\n3. Testing Framework Code Filtering:');
const frameworkResult = scanner.scanContent(testContent.frameworkFile, 'react-dom.js', 'text/javascript', {
    isTestFile: false,
    isSourceFile: true,
    isFrameworkCode: true,
    confidence: 0.3
});
console.log('Framework file results:', frameworkResult.findings);

// Test 4: Binary content detection
console.log('\n4. Testing Binary Content Detection:');
console.log('Is binary content:', scanner.isBinaryFile(testContent.binaryContent));

// Test 5: File filtering
console.log('\n5. Testing File Filtering:');
const mockFiles = [
    { name: 'test.js', size: 1000, webkitRelativePath: 'src/test.js' },
    { name: 'app.pyc', size: 5000, webkitRelativePath: 'compiled/app.pyc' },
    { name: 'react.min.js', size: 200000, webkitRelativePath: 'node_modules/react/react.min.js' },
    { name: 'large_file.js', size: 15000000, webkitRelativePath: 'src/large_file.js' }
];

mockFiles.forEach(file => {
    const shouldExclude = scanner.shouldExcludeFile(file);
    console.log(`${file.name}: ${shouldExclude ? 'EXCLUDED' : 'INCLUDED'}`);
});

console.log('\nScanner improvements test completed!');
