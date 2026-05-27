/**
 * Mock Patterns Remediation Guide
 * Provides patterns and examples for replacing problematic mock data with proper solutions
 */

/**
 * Remediation patterns for common mock data issues
 */
export const RemediationPatterns = {
    
    /**
     * Replace hardcoded test emails
     */
    hardcodedEmails: {
        problematic: [
            'test@example.com',
            'user@test.org',
            'admin@demo.net'
        ],
        solution: 'Use generateTestEmail() from test-data-generator.js',
        example: {
            before: 'const email = "test@example.com";',
            after: 'import { generateTestEmail } from "../utils/test-data-generator.js";\nconst email = generateTestEmail();'
        }
    },
    
    /**
     * Replace hardcoded phone numbers
     */
    hardcodedPhones: {
        problematic: [
            '+1-555-123-4567',
            '555-987-6543',
            '123-456-7890'
        ],
        solution: 'Use generateTestPhone() from test-data-generator.js',
        example: {
            before: 'const phone = "+1-555-123-4567";',
            after: 'import { generateTestPhone } from "../utils/test-data-generator.js";\nconst phone = generateTestPhone();'
        }
    },
    
    /**
     * Replace hardcoded test dates
     */
    hardcodedDates: {
        problematic: [
            '2024-01-01',
            '2023-12-31',
            '00:00:00'
        ],
        solution: 'Use generateTestDate() from test-data-generator.js',
        example: {
            before: 'const testDate = "2024-01-01";',
            after: 'import { generateTestDate } from "../utils/test-data-generator.js";\nconst testDate = generateTestDate("specific");'
        }
    },
    
    /**
     * Replace hardcoded test IDs
     */
    hardcodedIds: {
        problematic: [
            '1', '2', '3', '4', '5',
            'test_12345678',
            'user-001'
        ],
        solution: 'Use generateTestId() from test-data-generator.js',
        example: {
            before: 'const userId = "1";',
            after: 'import { generateTestId } from "../utils/test-data-generator.js";\nconst userId = generateTestId("user", "numeric", counter++);'
        }
    },
    
    /**
     * Replace hardcoded database connections
     */
    hardcodedDatabases: {
        problematic: [
            ':memory:',
            'mongodb://localhost:27017/test',
            'test_db',
            'demo_db'
        ],
        solution: 'Use generateTestDbName() or getTestConfig() from test-data-generator.js',
        example: {
            before: 'const dbUrl = ":memory:";',
            after: 'import { getTestConfig } from "../utils/test-data-generator.js";\nconst dbUrl = getTestConfig("database.url", "test");'
        }
    },
    
    /**
     * Replace hardcoded API endpoints
     */
    hardcodedApis: {
        problematic: [
            'http://localhost:3000',
            'https://api.example.com',
            'test_api_key',
            'Bearer test_token'
        ],
        solution: 'Use generateTestUrl() or getTestConfig() from test-data-generator.js',
        example: {
            before: 'const apiUrl = "http://localhost:3000";',
            after: 'import { getTestConfig } from "../utils/test-data-generator.js";\nconst apiUrl = getTestConfig("api.baseUrl", "test");'
        }
    },
    
    /**
     * Replace mock functions with standardized patterns
     */
    mockFunctions: {
        problematic: [
            'jest.fn()',
            'sinon.stub()',
            'mock()'
        ],
        solution: 'Use MockFactory.createMockFunction() from mock-factory.js',
        example: {
            before: 'const mockFn = jest.fn().mockReturnValue("test");',
            after: 'import { MockFactory } from "../utils/mock-factory.js";\nconst mockFn = MockFactory.createMockFunction("testFunction", "test");'
        }
    },
    
    /**
     * Replace generic placeholders
     */
    genericPlaceholders: {
        problematic: [
            'lorem ipsum',
            'xxx', 'yyy', 'zzz',
            'placeholder', 'dummy', 'mock_data'
        ],
        solution: 'Use specific test fixtures or generate meaningful test data',
        example: {
            before: 'const content = "lorem ipsum dolor sit amet";',
            after: 'import { generateTestUser } from "../utils/test-data-generator.js";\nconst content = `User profile for ${generateTestUser().firstName}`;'
        }
    }
};

/**
 * File-specific remediation templates
 */
export const FileRemediationTemplates = {
    
    /**
     * Python test file template
     */
    pythonTest: {
        imports: `from utils.test_data_generator import generate_test_email, generate_test_phone, generate_test_date
from utils.mock_factory import MockFactory
from utils.test_fixtures import UserFixtures, ApiFixtures`,
        
        setup: `class TestClass:
    def setUp(self):
        self.mock_factory = MockFactory()
        self.test_user = UserFixtures.valid_user
        self.cleanup = MockCleanup()
        
    def tearDown(self):
        self.cleanup.cleanup()`,
        
        example: `def test_user_creation(self):
    # Instead of: email = "test@example.com"
    email = generate_test_email()
    user_data = generate_test_user({"email": email})
    
    # Test implementation
    result = create_user(user_data)
    self.assertIsNotNone(result.id)
    self.assertEqual(result.email, email)`
    },
    
    /**
     * JavaScript test file template
     */
    javascriptTest: {
        imports: `import { generateTestEmail, generateTestPhone, generateTestDate } from '../utils/test-data-generator.js';
import { MockFactory, MockCleanup } from '../utils/mock-factory.js';
import { UserFixtures, ApiFixtures } from '../utils/test-fixtures.js';`,
        
        setup: `describe('TestClass', () => {
    let mockFactory;
    let cleanup;
    let testUser;
    
    beforeEach(() => {
        mockFactory = new MockFactory();
        cleanup = new MockCleanup();
        testUser = UserFixtures.validUser;
    });
    
    afterEach(() => {
        cleanup.cleanup();
    });`,
        
        example: `test('should create user successfully', () => {
        // Instead of: const email = 'test@example.com';
        const email = generateTestEmail();
        const userData = generateTestUser({ email });
        
        // Test implementation
        const result = createUser(userData);
        expect(result.id).toBeDefined();
        expect(result.email).toBe(email);
    });`
    },
    
    /**
     * Java test file template
     */
    javaTest: {
        imports: `import utils.TestDataGenerator;
import utils.MockFactory;
import utils.test.fixtures.UserFixtures;
import utils.test.fixtures.ApiFixtures;`,
        
        setup: `@BeforeEach
void setUp() {
    mockFactory = new MockFactory();
    testUser = UserFixtures.getValidUser();
    cleanup = new MockCleanup();
}

@AfterEach
void tearDown() {
    cleanup.cleanup();`,
        
        example: `@Test
void shouldCreateUserSuccessfully() {
    // Instead of: String email = "test@example.com";
    String email = TestDataGenerator.generateTestEmail();
    UserData userData = TestDataGenerator.generateTestUser(email);
    
    // Test implementation
    User result = userService.create(userData);
    assertNotNull(result.getId());
    assertEquals(email, result.getEmail());
}`
    }
};

/**
 * Automated remediation functions
 */
export class RemediationHelper {
    
    /**
     * Generate remediation report for a file
     * @param {string} filePath - File path
     * @param {Array} findings - Array of mock data findings
     * @returns {Object} Remediation report
     */
    static generateRemediationReport(filePath, findings) {
        const report = {
            filePath,
            totalFindings: findings.length,
            categories: {},
            remediationPlan: [],
            estimatedEffort: 'medium'
        };
        
        // Group findings by category
        findings.forEach(finding => {
            if (!report.categories[finding.category]) {
                report.categories[finding.category] = [];
            }
            report.categories[finding.category].push(finding);
        });
        
        // Generate remediation plan
        Object.entries(report.categories).forEach(([category, items]) => {
            const pattern = RemediationPatterns[category];
            if (pattern) {
                report.remediationPlan.push({
                    category,
                    count: items.length,
                    solution: pattern.solution,
                    example: pattern.example
                });
            }
        });
        
        // Estimate effort based on findings count
        if (report.totalFindings > 50) {
            report.estimatedEffort = 'high';
        } else if (report.totalFindings < 10) {
            report.estimatedEffort = 'low';
        }
        
        return report;
    }
    
    /**
     * Generate remediation code for a specific finding
     * @param {Object} finding - Mock data finding
     * @returns {string} Remediation code
     */
    static generateRemediationCode(finding) {
        const pattern = RemediationPatterns[finding.category];
        if (!pattern) {
            return `// No remediation pattern available for category: ${finding.category}`;
        }
        
        return `
// Remediation for ${finding.category}
// Original problematic code: ${finding.match}
${pattern.example.after}

// Additional context: ${finding.context || 'N/A'}
`;
    }
    
    /**
     * Create remediation checklist for a file
     * @param {string} filePath - File path
     * @param {Array} findings - Array of findings
     * @returns {Array} Checklist items
     */
    static createRemediationChecklist(filePath, findings) {
        const checklist = [];
        
        findings.forEach((finding, index) => {
            checklist.push({
                id: index + 1,
                category: finding.category,
                description: `Replace ${finding.match} with proper test data`,
                status: 'pending',
                priority: finding.severity === 'high' ? 'high' : 'medium',
                estimatedTime: finding.severity === 'high' ? 15 : 5
            });
        });
        
        return checklist.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }
}

export default {
    RemediationPatterns,
    FileRemediationTemplates,
    RemediationHelper
};
