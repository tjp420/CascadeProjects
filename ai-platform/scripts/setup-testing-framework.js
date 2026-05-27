
/**
 * Testing Framework Setup Script
 * 
 * This script sets up Jest testing framework with configuration,
 * test utilities, and example tests for the project.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class TestingFrameworkSetup {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
    }

    async setup() {
        console.log('🧪 Setting up Testing Framework...\n');
        
        this.createJestConfig();
        this.createTestDirectoryStructure();
        this.createTestUtils();
        this.createExampleTests();
        this.createSecurityTests();
        this.createPackageJsonScripts();
        this.createCIConfiguration();
        
        console.log('\n✅ Testing Framework Setup Complete!');
    }

    createJestConfig() {
        console.log('📝 Creating Jest configuration...');
        
        const jestConfig = {
            preset: 'ts-jest',
            testEnvironment: 'node',
            roots: ['<rootDir>/src', '<rootDir>/web'],
            testMatch: [
                '**/__tests__/**/*.+(ts|tsx|js)',
                '**/?(*.)+(spec|test).+(ts|tsx|js)'
            ],
            transform: {
                '^.+\\.(ts|tsx)$': 'ts-jest'
            },
            moduleNameMapper: {
                '^@/(.*)$': '<rootDir>/src/$1',
                '^@web/(.*)$': '<rootDir>/web/$1'
            },
            collectCoverageFrom: [
                'src/**/*.{js,jsx,ts,tsx}',
                'web/**/*.{js,jsx,ts,tsx}',
                '!**/*.d.ts',
                '!**/node_modules/**',
                '!**/tests/**',
                '!**/test/**'
            ],
            coverageThreshold: {
                global: {
                    branches: 70,
                    functions: 70,
                    lines: 70,
                    statements: 70
                }
            },
            coverageReporters: ['text', 'lcov', 'html'],
            coverageDirectory: 'coverage',
            testTimeout: 10000,
            verbose: true
        };
        
        const configPath = path.join(this.projectRoot, 'jest.config.json');
        fs.writeFileSync(configPath, JSON.stringify(jestConfig, null, 2));
        console.log(`   - jest.config.json`);
    }

    createTestDirectoryStructure() {
        console.log('📁 Creating test directory structure...');
        
        const testDirs = [
            'src/__tests__',
            'src/__tests__/unit',
            'src/__tests__/integration',
            'src/__tests__/e2e',
            'src/__tests__/security',
            'web/__tests__',
            'web/__tests__/unit',
            'web/__tests__/components',
            'tests',
            'tests/unit',
            'tests/integration',
            'tests/security',
            'test-utils'
        ];
        
        testDirs.forEach(dir => {
            const fullPath = path.join(this.projectRoot, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }
        });
        
        console.log(`   - Created ${testDirs.length} test directories`);
    }

    createTestUtils() {
        console.log('🔧 Creating test utilities...');
        
        // Test setup file
        const setupFile = `// Test setup file
import { jest } from '@jest/globals';

jest.setTimeout(10000);

// Mock console methods to reduce noise in tests
global.console = {
    ...console,
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn()
};

// Mock window for browser environment tests
global.window = {
    localStorage: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn()
    },
    sessionStorage: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn()
    }
};

// Mock fetch
global.fetch = jest.fn();

// Setup for each test
beforeEach(() => {
    jest.clearAllMocks();
});
`;
        
        const setupPath = path.join(this.projectRoot, 'tests', 'setup.js');
        fs.writeFileSync(setupPath, setupFile);
        
        // Test helper utilities
        const helpersFile = `// Test helper utilities

export const createMockResponse = (data, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data)
});

export const createMockFile = (name, content = '') => ({
    name,
    path: \`/mock/path/\${name}\`,
    content: Buffer.from(content),
    size: content.length
});

export const waitFor = (condition, timeout = 5000) => {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const check = () => {
            if (condition()) {
                resolve();
            } else if (Date.now() - startTime > timeout) {
                reject(new Error('Timeout waiting for condition'));
            } else {
                setTimeout(check, 100);
            }
        };
        
        check();
    });
};

export const mockDate = (date) => {
    jest.spyOn(global.Date, 'now').mockReturnValue(date.getTime());
    jest.spyOn(global.Date, 'constructor').mockReturnValue(date);
};

export const restoreDate = () => {
    global.Date.now.mockRestore();
    global.Date.constructor.mockRestore();
};

export const createMockEvent = (type, properties = {}) => ({
    type,
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    target: {},
    currentTarget: {},
    ...properties
});

export const flushPromises = () => new Promise(resolve => setImmediate(resolve));
`;
        
        const helpersPath = path.join(this.projectRoot, 'test-utils', 'helpers.js');
        fs.writeFileSync(helpersPath, helpersFile);
        
        // Security testing utilities
        const securityHelpers = String.raw`// Security testing utilities

export const createMaliciousInput = () => ({
    // SQL injection attempts
    sqlInjection: [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "admin'/*"
    ],
    // XSS attempts
    xss: [
        '<script>alert(1)</script>',
        '<img src=x onerror=alert(1)>',
        'javascript:alert(1)',
        '<svg onload=alert(1)>'
    ],
    // Command injection
    commandInjection: [
        '; rm -rf /',
        '| cat /etc/passwd',
        '$(whoami)'
    ],
    // Path traversal
    pathTraversal: [
        '../../../etc/passwd',
        '..\\..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
        '/etc/passwd'
    ]
});

export const testInputValidation = (input, validator) => {
    try {
        validator(input);
        return { valid: true, error: null };
    } catch (error) {
        return { valid: false, error: error.message };
    }
};

export const testSecurityHeaders = (headers) => {
    const requiredHeaders = [
        'X-Content-Type-Options',
        'X-Frame-Options',
        'X-XSS-Protection',
        'Strict-Transport-Security'
    ];
    
    const missingHeaders = requiredHeaders.filter(header => !headers[header]);
    
    return {
        hasAllHeaders: missingHeaders.length === 0,
        missingHeaders
    };
};

export const testEvalPrevention = (code) => {
    const evalPatterns = [
        /eval\s*\(/g,
        /new\s+Function\s*\(/g,
        /setTimeout\s*\(/g,
        /setInterval\s*\(/g
    ];
    
    const foundPatterns = [];
    evalPatterns.forEach(pattern => {
        const matches = code.match(pattern);
        if (matches) {
            foundPatterns.push(pattern.source);
        }
    });
    
    return {
        hasEvalUsage: foundPatterns.length > 0,
        foundPatterns
    };
};

export const testContentTypeValidation = (contentType, expectedType) => {
    return {
        isValid: contentType === expectedType,
        actual: contentType,
        expected: expectedType
    };
};
`;
        
        const securityPath = path.join(this.projectRoot, 'tests', 'security', 'security-helpers.js');
        fs.writeFileSync(securityPath, securityHelpers);
        
        console.log('   - tests/setup.js');
        console.log('   - test-utils/helpers.js');
        console.log('   - tests/security/security-helpers.js');
    }

    createExampleTests() {
        console.log('🧪 Creating example tests...');
        
        // Unit test example
        const unitTest = `// Unit test example
const { calculateTotal } = require('../../src/utils/calculator');

describe('Calculator', () => {
    describe('calculateTotal', () => {
        it('should return the sum of all numbers', () => {
            const numbers = [1, 2, 3, 4, 5];
            const result = calculateTotal(numbers);
            expect(result).toBe(15);
        });

        it('should handle empty array', () => {
            const result = calculateTotal([]);
            expect(result).toBe(0);
        });

        it('should handle negative numbers', () => {
            const numbers = [1, -2, 3, -4, 5];
            const result = calculateTotal(numbers);
            expect(result).toBe(3);
        });
    });
});
`;
        
        fs.writeFileSync(path.join(this.projectRoot, 'src/__tests__/unit/calculator.test.js'), unitTest);
        
        // Integration test example
        const integrationTest = `// Integration test example
const { processOrder } = require('../../src/services/orderService');

describe('Order Processing Integration', () => {
    it('should process order end-to-end', async () => {
        const order = {
            id: 'test-123',
            items: [
                { productId: 'prod-1', quantity: 2 },
                { productId: 'prod-2', quantity: 1 }
            ],
            customer: {
                id: 'cust-123',
                email: 'test@example.com'
            }
        };
        
        const result = await processOrder(order);
        
        expect(result.status).toBe('completed');
        expect(result.orderId).toBe(order.id);
        expect(result.total).toBeDefined();
    });

    it('should handle payment processing', async () => {
        const payment = {
            orderId: 'test-123',
            amount: 100,
            paymentMethod: 'credit_card'
        };
        
        const result = await processPayment(payment);
        
        expect(result.status).toBe('success');
        expect(result.transactionId).toBeDefined();
    });
});
`;
        
        fs.writeFileSync(path.join(this.projectRoot, 'src/__tests__/integration/orderProcessing.test.js'), integrationTest);
        
        console.log('   - src/__tests__/unit/calculator.test.js');
        console.log('   - src/__tests__/integration/orderProcessing.test.js');
    }

    createSecurityTests() {
        console.log('🔒 Creating security tests...');
        
        const securityTest = `// Security tests
const { 
    createMaliciousInput,
    testInputValidation,
    testEvalPrevention,
    testSecurityHeaders 
} = require('../security/security-helpers');

describe('Security Tests', () => {
    describe('Input Validation', () => {
        it('should reject SQL injection attempts', () => {
            const maliciousInputs = createMaliciousInput().sqlInjection;
            
            maliciousInputs.forEach(input => {
                const result = testInputValidation(input, validateInput);
                expect(result.valid).toBe(false);
            });
        });

        it('should reject XSS attempts', () => {
            const maliciousInputs = createMaliciousInput().xss;
            
            maliciousInputs.forEach(input => {
                const result = testInputValidation(input, validateInput);
                expect(result.valid).toBe(false);
            });
        });
    });

    describe('eval() Prevention', () => {
        it('should detect eval() usage in code', () => {
            const safeCode = 'const x = 5;';
            const unsafeCode = '/* SECURITY WARNING: eval() usage detected - requires manual review */
// Original: eval("alert(1)")';
            
            const safeResult = testEvalPrevention(safeCode);
            const unsafeResult = testEvalPrevention(unsafeCode);
            
            expect(safeResult.hasEvalUsage).toBe(false);
            expect(unsafeResult.hasEvalUsage).toBe(true);
        });

        it('should detect Function constructor usage', () => {
            const unsafeCode = '/* SECURITY WARNING: Function constructor usage - requires manual review */
// Original: new Function("return 5")';
            const result = testEvalPrevention(unsafeCode);
            
            expect(result.hasEvalUsage).toBe(true);
        });
    });

    describe('Security Headers', () => {
        it('should require all security headers', () => {
            const incompleteHeaders = {
                'X-Content-Type-Options': 'nosniff'
            };
            
            const result = testSecurityHeaders(incompleteHeaders);
            
            expect(result.hasAllHeaders).toBe(false);
            expect(result.missingHeaders.length).toBeGreaterThan(0);
        });

        it('should pass with all security headers', () => {
            const completeHeaders = {
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY',
                'X-XSS-Protection': '1; mode=block',
                'Strict-Transport-Security': 'max-age=31536000'
            };
            
            const result = testSecurityHeaders(completeHeaders);
            
            expect(result.hasAllHeaders).toBe(true);
        });
    });
});

// Helper function for input validation
function validateInput(input) {
    if (typeof input !== 'string') {
        throw new Error('Input must be a string');
    }
    
    // Check for dangerous patterns
    const dangerousPatterns = [
        /['";;]|<script|<img|javascript:|eval\(|new\s+Function/,
        /['"]\s*(OR|AND)\s*['"]/i,
        /\.\.\/|\.\.\\/
    ];
    
    for (const pattern of dangerousPatterns) {
        if (pattern.test(input)) {
            throw new Error('Potentially malicious input detected');
        }
    }
    
    return true;
}
`;
        
        fs.writeFileSync(path.join(this.projectRoot, 'tests/security/security.test.js'), securityTest);
        
        console.log('   - tests/security/security.test.js');
    }

    createPackageJsonScripts() {
        console.log('📦 Updating package.json with test scripts...');
        
        const packageJsonPath = path.join(this.projectRoot, 'package.json');
        
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            
            // Add test scripts if they don't exist
            packageJson.scripts = {
                ...packageJson.scripts,
                'test': 'jest',
                'test:watch': 'jest --watch',
                'test:coverage': 'jest --coverage',
                'test:security': 'jest tests/security',
                'test:unit': 'jest src/__tests__/unit',
                'test:integration': 'jest src/__tests__/integration'
            };
            
            // Add dev dependencies if they don't exist
            packageJson.devDependencies = {
                ...packageJson.devDependencies,
                'jest': '^29.0.0',
                '@types/jest': '^29.0.0',
                'ts-jest': '^29.0.0',
                'jest-environment-jsdom': '^29.0.0',
                '@testing-library/react': '^14.0.0',
                '@testing-library/jest-dom': '^6.0.0',
                'supertest': '^6.3.0'
            };
            
            fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
            console.log('   - Updated package.json');
        } else {
            console.log('   ⚠️  package.json not found, skipping');
        }
    }

    createCIConfiguration() {
        console.log('🔄 Creating CI configuration...');
        
        // GitHub Actions workflow
        const githubActions = `name: CI Pipeline

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [16.x, 18.x]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js \${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: \${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linter
      run: npm run lint
    
    - name: Run tests
      run: npm test
    
    - name: Generate coverage report
      run: npm run test:coverage
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        files: ./coverage/lcov.info
        flags: unittests
        name: codecov-umbrella
    
    - name: Run security tests
      run: npm run test:security
    
    - name: Security scan
      run: npm audit --audit-level=moderate
`;
        
        const githubPath = path.join(this.projectRoot, '.github', 'workflows', 'ci.yml');
        
        if (!fs.existsSync(path.join(this.projectRoot, '.github'))) {
            fs.mkdirSync(path.join(this.projectRoot, '.github', 'workflows'), { recursive: true });
        }
        
        fs.writeFileSync(githubPath, githubActions);
        console.log('   - .github/workflows/ci.yml');
        
        // GitLab CI example
        const gitlabCi = `stages:
  - test
  - security

test:
  stage: test
  script:
    - npm ci
    - npm run lint
    - npm test
    - npm run test:coverage
  coverage: '/All files[^.]+\\|\\s+Lines\\s*:\\s*\\d+\\.\\d+%/'

security:
  stage: security
  script:
    - npm run test:security
    - npm audit --audit-level=moderate
  only:
    - master
    - develop
`;
        
        const gitlabPath = path.join(this.projectRoot, '.gitlab-ci.yml');
        fs.writeFileSync(gitlabPath, gitlabCi);
        console.log('   - .gitlab-ci.yml');
    }
}

// Main execution
const setup = new TestingFrameworkSetup(process.cwd());
setup.setup();