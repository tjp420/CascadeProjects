/**
 * Mock Data Patterns Module
 * Defines patterns for detecting mock data in code files
 */

/**
 * Mock pattern definitions
 */
export const MOCK_PATTERNS = {
    // Test data patterns
    testData: {
        patterns: [
            {
                pattern: 'mock.*data',
                confidence: 0.9,
                category: 'test_data',
                description: 'Mock data variable declarations'
            },
            {
                pattern: 'fake.*data',
                confidence: 0.8,
                category: 'test_data',
                description: 'Fake data variable declarations'
            },
            {
                pattern: 'test.*data',
                confidence: 0.7,
                category: 'test_data',
                description: 'Test data variable declarations'
            }
        ]
    },

    // Mock function patterns
    mockFunctions: {
        patterns: [
            {
                pattern: 'jest\\.fn\\(\\)',
                confidence: 0.95,
                category: 'mock_functions',
                description: 'Jest mock function'
            },
            {
                pattern: 'sinon\\.stub\\(\\)',
                confidence: 0.95,
                category: 'mock_functions',
                description: 'Sinon stub function'
            },
            {
                pattern: 'mock\\(',
                confidence: 0.8,
                category: 'mock_functions',
                description: 'Generic mock function call'
            },
            {
                pattern: 'spy\\(',
                confidence: 0.8,
                category: 'mock_functions',
                description: 'Spy function call'
            }
        ]
    },

    // Hardcoded test values
    hardcodedValues: {
        patterns: [
            {
                pattern: '"test.*"',
                confidence: 0.6,
                category: 'hardcoded_values',
                description: 'Test string values'
            },
            {
                pattern: '\'test.*\'',
                confidence: 0.6,
                category: 'hardcoded_values',
                description: 'Test string values (single quotes)'
            },
            {
                pattern: '\\b(123|456|789|test|demo|example|sample)\\b',
                confidence: 0.5,
                category: 'hardcoded_values',
                description: 'Common test values'
            },
            {
                pattern: '\\b(true|false|null|undefined)\\b',
                confidence: 0.3,
                category: 'hardcoded_values',
                description: 'Boolean and null values (low confidence)'
            }
        ]
    },

    // Enhanced database patterns
    databasePatterns: {
        patterns: [
            {
                pattern: ':memory:',
                confidence: 0.95,
                category: 'test_databases',
                description: 'SQLite in-memory database',
                contextFilter: 'database_connection'
            },
            {
                pattern: 'sqlite:///:memory:',
                confidence: 0.95,
                category: 'test_databases',
                description: 'SQLite memory connection string',
                contextFilter: 'database_connection'
            },
            {
                pattern: 'mongodb://localhost:27017/test',
                confidence: 0.9,
                category: 'test_databases',
                description: 'MongoDB test database',
                contextFilter: 'database_connection'
            },
            {
                pattern: 'mysql://test@localhost',
                confidence: 0.9,
                category: 'test_databases',
                description: 'MySQL test database connection',
                contextFilter: 'database_connection'
            },
            {
                pattern: 'postgresql://test@localhost',
                confidence: 0.9,
                category: 'test_databases',
                description: 'PostgreSQL test database connection',
                contextFilter: 'database_connection'
            },
            {
                pattern: 'Database\\.connect\\(.*test.*\\)',
                confidence: 0.85,
                category: 'test_databases',
                description: 'Test database connection calls',
                contextFilter: 'function_call'
            },
            {
                pattern: 'createTestDatabase\\(|setupTestDB\\(',
                confidence: 0.9,
                category: 'test_databases',
                description: 'Test database setup functions',
                contextFilter: 'function_call'
            },
            {
                pattern: 'mockDatabase|fakeDatabase|testDatabase',
                confidence: 0.8,
                category: 'test_databases',
                description: 'Mock database variable names',
                contextFilter: 'variable'
            },
            {
                pattern: 'DROP TABLE IF EXISTS test_',
                confidence: 0.85,
                category: 'test_databases',
                description: 'Test table cleanup SQL',
                contextFilter: 'sql'
            },
            {
                pattern: 'CREATE TABLE test_',
                confidence: 0.8,
                category: 'test_databases',
                description: 'Test table creation SQL',
                contextFilter: 'sql'
            }
        ]
    },

    // Enhanced API patterns
    apiPatterns: {
        patterns: [
            {
                pattern: 'axios\\.get\\(.*mock.*\\)|axios\\.post\\(.*mock.*\\)',
                confidence: 0.85,
                category: 'test_apis',
                description: 'Axios mock API calls',
                contextFilter: 'function_call'
            },
            {
                pattern: 'fetch\\(.*mock.*\\)|fetch\\(.*test.*\\)',
                confidence: 0.8,
                category: 'test_apis',
                description: 'Fetch mock API calls',
                contextFilter: 'function_call'
            },
            {
                pattern: 'nock\\(|nock\\.back\\(',
                confidence: 0.95,
                category: 'test_apis',
                description: 'Nock HTTP mocking library',
                contextFilter: 'function_call'
            },
            {
                pattern: 'msw\\.mock|rest\\.get\\(|rest\\.post\\(',
                confidence: 0.9,
                category: 'test_apis',
                description: 'MSW API mocking',
                contextFilter: 'function_call'
            },
            {
                pattern: 'graphql-request.*mock|mockGraphQLResponse',
                confidence: 0.85,
                category: 'test_apis',
                description: 'GraphQL mock responses',
                contextFilter: 'function_call'
            },
            {
                pattern: 'XMLHttpRequest.*mock|xhr\\.mock',
                confidence: 0.8,
                category: 'test_apis',
                description: 'XHR mock requests',
                contextFilter: 'function_call'
            },
            {
                pattern: 'mockApiResponse|fakeApiResponse|testApiResponse',
                confidence: 0.8,
                category: 'test_apis',
                description: 'Mock API response variables',
                contextFilter: 'variable'
            },
            {
                pattern: 'api\\.mock|mockApi|testApi',
                confidence: 0.75,
                category: 'test_apis',
                description: 'Mock API object references',
                contextFilter: 'variable'
            }
        ]
    },

    // Email patterns
    emailPatterns: {
        patterns: [
            {
                pattern: '\\b[a-zA-Z0-9._%+-]+@(test|example|demo|sample)\\.[a-zA-Z]{2,}\\b',
                confidence: 0.9,
                category: 'test_emails',
                description: 'Test email addresses'
            },
            {
                pattern: '\\btest@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}\\b',
                confidence: 0.8,
                category: 'test_emails',
                description: 'Email addresses starting with test'
            }
        ]
    },

    // URL patterns (more specific)
    urlPatterns: {
        patterns: [
            {
                pattern: 'https?://(localhost|127\\.0\\.0\\.1)\\b',
                confidence: 0.7, // Lowered - localhost can be legitimate
                category: 'test_urls',
                description: 'Localhost URLs',
                excludeInProduction: true
            },
            {
                pattern: 'https?://.*\\.(test|example|demo|sample)\\.[a-zA-Z]{2,}',
                confidence: 0.9, // High confidence - obvious test domains
                category: 'test_urls',
                description: 'Test domain URLs'
            },
            {
                pattern: 'https?://(api|mock)\\.(test|example|demo)\\.[a-zA-Z]{2,}',
                confidence: 0.95, // Very high confidence - mock API endpoints
                category: 'test_apis',
                description: 'Mock API endpoints'
            },
            {
                pattern: 'https?://jsonplaceholder\\.typicode\\.com',
                confidence: 0.95,
                category: 'test_apis',
                description: 'JSONPlaceholder fake API'
            },
            {
                pattern: 'https?://reqres\\.in/api',
                confidence: 0.95,
                category: 'test_apis',
                description: 'ReqRes fake API'
            },
            {
                pattern: 'https?://fakestoreapi\\.com',
                confidence: 0.95,
                category: 'test_apis',
                description: 'Fake Store API'
            },
            {
                pattern: 'https?://api\\.mocki\\.io',
                confidence: 0.95,
                category: 'test_apis',
                description: 'Mocki fake API service'
            },
            {
                pattern: 'https?://([a-z]+)\\.mock-api\\.io',
                confidence: 0.9,
                category: 'test_apis',
                description: 'Mock API service patterns'
            },
            {
                pattern: 'ws://localhost|wss://localhost',
                confidence: 0.8,
                category: 'test_websockets',
                description: 'WebSocket test endpoints'
            },
            {
                pattern: 'grpc://localhost|grpcs://localhost',
                confidence: 0.8,
                category: 'test_grpc',
                description: 'gRPC test endpoints'
            }
        ]
    },

    // Phone number patterns
    phonePatterns: {
        patterns: [
            {
                pattern: '\\+1-555-\\d{3}-\\d{4}',
                confidence: 0.9,
                category: 'test_phones',
                description: 'Test phone numbers (555 pattern)'
            },
            {
                pattern: '\\b555-\\d{3}-\\d{4}\\b',
                confidence: 0.9,
                category: 'test_phones',
                description: 'Test phone numbers (555 pattern)'
            },
            {
                pattern: '\\b\\d{3}-555-\\d{4}\\b',
                confidence: 0.8,
                category: 'test_phones',
                description: 'Test phone numbers (555 pattern)'
            }
        ]
    },

    // Date patterns
    datePatterns: {
        patterns: [
            {
                pattern: '\\b(2020-01-01|2021-01-01|2022-01-01|2023-01-01|2024-01-01)\\b',
                confidence: 0.8,
                category: 'test_dates',
                description: 'Common test dates'
            },
            {
                pattern: '\\b00:00:00\\b',
                confidence: 0.7,
                category: 'test_dates',
                description: 'Midnight timestamp'
            },
            {
                pattern: '\\b23:59:59\\b',
                confidence: 0.7,
                category: 'test_dates',
                description: 'End of day timestamp'
            }
        ]
    },

    // ID patterns
    idPatterns: {
        patterns: [
            {
                pattern: '\\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\\b',
                confidence: 0.7,
                category: 'test_ids',
                description: 'UUID pattern'
            },
            {
                pattern: '\\btest_[a-f0-9]{8}\\b',
                confidence: 0.8,
                category: 'test_ids',
                description: 'Test ID pattern'
            },
            {
                pattern: '\\b(1|2|3|4|5|6|7|8|9|10)\\b',
                confidence: 0.2,
                category: 'test_ids',
                description: 'Single digit IDs (low confidence)'
            }
        ]
    },

    // Database patterns
    databasePatterns: {
        patterns: [
            {
                pattern: '\\b(test_db|testdb|demo_db|sample_db)\\b',
                confidence: 0.9,
                category: 'test_databases',
                description: 'Test database names'
            },
            {
                pattern: '\\b(test_user|demo_user|sample_user)\\b',
                confidence: 0.8,
                category: 'test_databases',
                description: 'Test user names'
            },
            {
                pattern: '\\b(test_password|demo_password|password123)\\b',
                confidence: 0.9,
                category: 'test_databases',
                description: 'Test passwords'
            }
        ]
    },

    // API patterns
    apiPatterns: {
        patterns: [
            {
                pattern: '\\b(test_api|demo_api|mock_api)\\b',
                confidence: 0.9,
                category: 'test_apis',
                description: 'Test API endpoints'
            },
            {
                pattern: '\\b(api_key_test|test_api_key|demo_api_key)\\b',
                confidence: 0.9,
                category: 'test_apis',
                description: 'Test API keys'
            },
            {
                pattern: '\\bBearer\\s+test_token\\b',
                confidence: 0.9,
                category: 'test_apis',
                description: 'Test bearer tokens'
            }
        ]
    },

    // Development patterns (filtered to reduce false positives)
    developmentPatterns: {
        patterns: [
            {
                pattern: '\\b(debugger|console\\.log|console\\.warn|console\\.error)\\b',
                confidence: 0.3, // Lowered confidence - these are often legitimate
                category: 'development_patterns',
                description: 'Debug statements and console logs',
                excludeInProduction: true
            },
            {
                pattern: '\\b(temp|tmp|sample|demo|example)\\b',
                confidence: 0.4, // Lowered confidence
                category: 'development_patterns',
                description: 'Temporary or placeholder identifiers',
                contextFilter: 'variable_or_function'
            },
            {
                pattern: '\\b(work_in_progress|wip|hack)\\b',
                confidence: 0.3, // Much lower confidence
                category: 'development_patterns',
                description: 'Development status indicators',
                excludePatterns: ['*.backup.*', '.backup.*', 'todo', 'fixme'] // TODO/FIXME are legitimate
            }
        ]
    },

    // Enhanced TODO and FIXME Comments
    todoFixmeComments: {
        patterns: [
            {
                pattern: '//\\s*TODO[:\\s]+(.*(?:mock|placeholder|demo|test|sample|fake|implement|replace|remove|delete|add|create).*)',
                confidence: 0.8, // High confidence for mock-related TODOs
                category: 'todo_mock_related',
                description: 'TODO comments related to mock data and placeholders'
            },
            {
                pattern: '//\\s*FIXME[:\\s]+(.*(?:mock|placeholder|demo|test|sample|fake|implement|replace).*)',
                confidence: 0.85, // Higher confidence for FIXME mock-related
                category: 'fixme_mock_related',
                description: 'FIXME comments related to mock data and placeholders'
            },
            {
                pattern: '/\\*\\*\\s*TODO[:\\s]+[\\s\\S]*?(?:mock|placeholder|demo|test|sample|fake)[\\s\\S]*?\\*/',
                confidence: 0.8,
                category: 'todo_mock_related',
                description: 'Multi-line TODO comments with mock references'
            },
            {
                pattern: '//\\s*TODO[:\\s]+(.*(?:coming soon|not implemented|feature|functionality).*)',
                confidence: 0.9, // Very high confidence for coming soon TODOs
                category: 'todo_coming_soon',
                description: 'TODO comments about coming soon features'
            },
            {
                pattern: '//\\s*TODO[:\\s]+(.*(?:api|endpoint|service|integration|database).*)',
                confidence: 0.7, // Medium confidence - could be legitimate planning
                category: 'todo_infrastructure',
                description: 'TODO comments about infrastructure and APIs'
            },
            {
                pattern: '//\\s*(TODO|FIXME|HACK|XXX|NOTE|BUG|TEMP|TEMPORARY|DEBUG|TBD|WIP|REFACTOR)\\s*[:\\s]+([^^\\n]*)',
                confidence: 0.3, // Low confidence for general development comments
                category: 'development_comments',
                description: 'General development comments and markers'
            }
        ]
    },

    // Coming Soon Features and Placeholders
    comingSoonFeatures: {
        patterns: [
            {
                pattern: '\\b(coming soon|feature coming soon|feature pending|under development|in progress|coming shortly|available soon|launch soon|beta coming|preview coming)\\b',
                confidence: 0.9, // High confidence - clear placeholder text
                category: 'coming_soon_features',
                description: 'Coming soon feature announcements'
            },
            {
                pattern: '\\b(feature.*not.*available|functionality.*coming|implementation.*pending|development.*in.*progress)\\b',
                confidence: 0.8,
                category: 'coming_soon_features',
                description: 'Feature availability placeholders'
            },
            {
                pattern: '\\b(placeholder.*feature|demo.*only|sample.*implementation|mock.*interface)\\b',
                confidence: 0.7,
                category: 'coming_soon_features',
                description: 'Placeholder feature descriptions'
            }
        ]
    },

    // Alert Placeholder Functions
    alertPlaceholders: {
        patterns: [
            {
                pattern: 'alert\\([\'"](.*(?:coming soon|feature|not implemented|placeholder|demo|test|sample|mock|todo|fixme)[^\'"]*)[\'"]\\)',
                confidence: 0.95, // Very high confidence - obvious placeholder alert
                category: 'alert_placeholders',
                description: 'Alert functions with placeholder messages'
            },
            {
                pattern: '\\b(alert\\([\'"][^\'"]*[\'"]\\))\\s*(?:;|//|/\\*.*\\*/|$)',
                confidence: 0.8,
                category: 'alert_placeholders',
                description: 'Standalone alert function calls'
            },
            {
                pattern: '\\b(alert\\([\'"](.*(?:successfully|complete|done|finished)[^\'"]*)[\'"]\\))',
                confidence: 0.6, // Lower confidence - could be legitimate success messages
                category: 'alert_placeholders',
                description: 'Alert success messages (potential placeholders)'
            }
        ]
    },

    // Mock Report Functions
    mockReportFunctions: {
        patterns: [
            {
                pattern: '\\b(downloadMockReport|generateMockReport|createMockReport|mockReport|fakeReport)\\s*\\(',
                confidence: 0.95, // Very high confidence - obvious mock function names
                category: 'mock_report_functions',
                description: 'Mock report generation functions'
            },
            {
                pattern: '\\b(export.*mock|mock.*export|download.*fake|fake.*download)\\s*\\(',
                confidence: 0.9,
                category: 'mock_report_functions',
                description: 'Mock export/download functions'
            },
            {
                pattern: '// Mock report generation implementation|// TODO: implement real report generation',
                confidence: 0.8,
                category: 'mock_report_functions',
                description: 'Mock report implementation comments'
            }
        ]
    },

    // Generic placeholders (more specific)
    genericPlaceholders: {
        patterns: [
            {
                pattern: '\\b(lorem ipsum|dolor sit|consectetur|adipiscing)\\b',
                confidence: 0.9, // High confidence - clear mock text
                category: 'generic_placeholders',
                description: 'Lorem ipsum placeholder text'
            },
            {
                pattern: '\\b(xxx|yyy|zzz)\\b',
                confidence: 0.8, // High confidence - obvious placeholders
                category: 'generic_placeholders',
                description: 'Common placeholder strings'
            },
            {
                pattern: '\\b(placeholder|dummy|mock_data|fake_data)\\b',
                confidence: 0.7,
                category: 'generic_placeholders',
                description: 'Explicit placeholder indicators'
            }
        ]
    },
};

/**
 * Get all patterns as a flat array
 * @returns {Array} Array of all patterns
 */
export function getAllPatterns() {
    const allPatterns = [];
    
    for (const category of Object.values(MOCK_PATTERNS)) {
        for (const pattern of category.patterns) {
            allPatterns.push({
                ...pattern,
                category: pattern.category,
                description: pattern.description
            });
        }
    }
    
    return allPatterns;
}

/**
 * Get patterns by category
 * @param {string} category - Category name
 * @returns {Array} Array of patterns for the category
 */
export function getPatternsByCategory(category) {
    const categoryData = MOCK_PATTERNS[category];
    return categoryData ? categoryData.patterns : [];
}

/**
 * Get pattern categories
 * @returns {Array} Array of category names
 */
export function getPatternCategories() {
    return Object.keys(MOCK_PATTERNS);
}

/**
 * Validate pattern configuration
 * @param {Object} pattern - Pattern to validate
 * @returns {boolean} True if pattern is valid
 */
export function validatePattern(pattern) {
    if (!pattern || typeof pattern !== 'object') {
        return false;
    }
    
    if (!pattern.pattern) {
        return false;
    }
    
    try {
        new RegExp(pattern.pattern);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Add custom pattern
 * @param {string} category - Category to add pattern to
 * @param {Object} pattern - Pattern to add
 * @returns {boolean} True if pattern was added successfully
 */
export function addCustomPattern(category, pattern) {
    if (!validatePattern(pattern)) {
        return false;
    }
    
    if (!MOCK_PATTERNS[category]) {
        MOCK_PATTERNS[category] = { patterns: [] };
    }
    
    MOCK_PATTERNS[category].patterns.push(pattern);
    return true;
}

/**
 * Remove pattern by index
 * @param {string} category - Category
 * @param {number} index - Pattern index
 * @returns {boolean} True if pattern was removed
 */
export function removePattern(category, index) {
    if (!MOCK_PATTERNS[category]) {
        return false;
    }
    
    if (index < 0 || index >= MOCK_PATTERNS[category].patterns.length) {
        return false;
    }
    
    MOCK_PATTERNS[category].patterns.splice(index, 1);
    return true;
}

/**
 * Get pattern statistics
 * @returns {Object} Pattern statistics
 */
export function getPatternStatistics() {
    const stats = {
        totalPatterns: 0,
        categories: 0,
        patternsByCategory: {}
    };
    
    for (const [categoryName, categoryData] of Object.entries(MOCK_PATTERNS)) {
        stats.categories++;
        stats.patternsByCategory[categoryName] = categoryData.patterns.length;
        stats.totalPatterns += categoryData.patterns.length;
    }
    
    return stats;
}
