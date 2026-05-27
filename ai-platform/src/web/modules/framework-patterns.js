/**
 * Framework Patterns Module
 * Defines patterns for detecting mock data in framework-specific code
 */

/**
 * React-specific patterns
 */
export const REACT_PATTERNS = {
    componentMocks: {
        patterns: [
            {
                pattern: 'jest\\.mock\\([\'"]react[\'"]',
                confidence: 0.95,
                category: 'react_mocks',
                description: 'React module mocking',
                framework: 'react'
            },
            {
                pattern: '\\<MockedProvider[^>]*\\>',
                confidence: 0.9,
                category: 'react_mocks',
                description: 'Apollo MockedProvider',
                framework: 'react'
            },
            {
                pattern: '\\<MemoryRouter[^>]*\\>',
                confidence: 0.85,
                category: 'react_mocks',
                description: 'React Router MemoryRouter for testing',
                framework: 'react'
            },
            {
                pattern: 'shallow\\(|mount\\(|render\\(',
                confidence: 0.8,
                category: 'react_testing',
                description: 'Enzyme rendering methods',
                framework: 'react'
            },
            {
                pattern: 'render\\(.*<.*>.*<\\/.*>\\)',
                confidence: 0.75,
                category: 'react_testing',
                description: 'React Testing Library render',
                framework: 'react'
            }
        ]
    },
    hookMocks: {
        patterns: [
            {
                pattern: 'jest\\.mocked\\([\'"]use[A-Z][a-zA-Z]*[\'"]',
                confidence: 0.9,
                category: 'react_hook_mocks',
                description: 'React hook mocking',
                framework: 'react'
            },
            {
                pattern: 'use[A-Z][a-zA-Z]*\\.mockReturnValue',
                confidence: 0.85,
                category: 'react_hook_mocks',
                description: 'Hook mock return value',
                framework: 'react'
            },
            {
                pattern: 'renderHook\\(',
                confidence: 0.9,
                category: 'react_testing',
                description: 'React Testing Library renderHook',
                framework: 'react'
            }
        ]
    },
    stateMocks: {
        patterns: [
            {
                pattern: 'mockStore\\(|createMockStore\\(',
                confidence: 0.9,
                category: 'react_state_mocks',
                description: 'Redux mock store',
                framework: 'react'
            },
            {
                pattern: 'useContext\\(.*mock.*\\)',
                confidence: 0.8,
                category: 'react_state_mocks',
                description: 'Mocked React context',
                framework: 'react'
            },
            {
                pattern: 'React\\.createContext\\(.*mock.*\\)',
                confidence: 0.85,
                category: 'react_state_mocks',
                description: 'Mock React context creation',
                framework: 'react'
            }
        ]
    }
};

/**
 * Vue-specific patterns
 */
export const VUE_PATTERNS = {
    componentMocks: {
        patterns: [
            {
                pattern: 'shallowMount\\(|mount\\(|createLocalVue\\(',
                confidence: 0.9,
                category: 'vue_testing',
                description: 'Vue Test Utils mounting methods',
                framework: 'vue'
            },
            {
                pattern: 'jest\\.mock\\([\'"]vue[\'"]',
                confidence: 0.95,
                category: 'vue_mocks',
                description: 'Vue module mocking',
                framework: 'vue'
            },
            {
                pattern: 'createWrapper\\(',
                confidence: 0.85,
                category: 'vue_testing',
                description: 'Vue Test Utils wrapper creation',
                framework: 'vue'
            }
        ]
    },
    pluginMocks: {
        patterns: [
            {
                pattern: 'mocks:\\s*\\{[^}]*\\$router',
                confidence: 0.9,
                category: 'vue_router_mocks',
                description: 'Vue Router mock',
                framework: 'vue'
            },
            {
                pattern: 'mocks:\\s*\\{[^}]*\\$route',
                confidence: 0.9,
                category: 'vue_router_mocks',
                description: 'Vue Route mock',
                framework: 'vue'
            },
            {
                pattern: 'mocks:\\s*\\{[^}]*\\$store',
                confidence: 0.85,
                category: 'vue_store_mocks',
                description: 'Vuex store mock',
                framework: 'vue'
            },
            {
                pattern: 'stubs:\\s*\\{[^}]*\\[component\\]',
                confidence: 0.8,
                category: 'vue_component_stubs',
                description: 'Vue component stubs',
                framework: 'vue'
            }
        ]
    }
};

/**
 * Angular-specific patterns
 */
export const ANGULAR_PATTERNS = {
    componentMocks: {
        patterns: [
            {
                pattern: 'TestBed\\.configureTestingModule\\(',
                confidence: 0.95,
                category: 'angular_testing',
                description: 'Angular TestBed configuration',
                framework: 'angular'
            },
            {
                pattern: 'ComponentFixture\\(',
                confidence: 0.9,
                category: 'angular_testing',
                description: 'Angular component fixture',
                framework: 'angular'
            },
            {
                pattern: 'detectChanges\(\)|fixture\\.detectChanges',
                confidence: 0.85,
                category: 'angular_testing',
                description: 'Angular change detection in tests',
                framework: 'angular'
            }
        ]
    },
    serviceMocks: {
        patterns: [
            {
                pattern: 'jasmine\\.createSpyObj\\(',
                confidence: 0.95,
                category: 'angular_service_mocks',
                description: 'Jasmine spy object creation',
                framework: 'angular'
            },
            {
                pattern: 'provide:\\s*\\{[^}]*useValue',
                confidence: 0.8,
                category: 'angular_provider_mocks',
                description: 'Angular provider mock with useValue',
                framework: 'angular'
            },
            {
                pattern: 'provide:\\s*\\{[^}]*useClass',
                confidence: 0.75,
                category: 'angular_provider_mocks',
                description: 'Angular provider mock with useClass',
                framework: 'angular'
            }
        ]
    },
    httpMocks: {
        patterns: [
            {
                pattern: 'HttpClientTestingModule',
                confidence: 0.95,
                category: 'angular_http_mocks',
                description: 'Angular HTTP testing module',
                framework: 'angular'
            },
            {
                pattern: 'HttpTestingController',
                confidence: 0.9,
                category: 'angular_http_mocks',
                description: 'Angular HTTP testing controller',
                framework: 'angular'
            },
            {
                pattern: 'expectOne\\(|matchOne\\(',
                confidence: 0.85,
                category: 'angular_http_mocks',
                description: 'Angular HTTP mock expectations',
                framework: 'angular'
            }
        ]
    }
};

/**
 * Express.js patterns
 */
export const EXPRESS_PATTERNS = {
    appMocks: {
        patterns: [
            {
                pattern: 'app\\.use\\(.*mock.*\\)',
                confidence: 0.8,
                category: 'express_mocks',
                description: 'Express middleware mock',
                framework: 'express'
            },
            {
                pattern: 'supertest\\(',
                confidence: 0.9,
                category: 'express_testing',
                description: 'Supertest for HTTP endpoint testing',
                framework: 'express'
            },
            {
                pattern: 'jest\\.mock\\([\'"]express[\'"]',
                confidence: 0.95,
                category: 'express_mocks',
                description: 'Express module mocking',
                framework: 'express'
            }
        ]
    },
    routeMocks: {
        patterns: [
            {
                pattern: '\\.get\\(.*mock.*\\)|\\.post\\(.*mock.*\\)|\\.put\\(.*mock.*\\)',
                confidence: 0.75,
                category: 'express_route_mocks',
                description: 'Express route handler mocks',
                framework: 'express'
            },
            {
                pattern: 'req\\.body\\s*=.*mock|res\\.send\\(.*mock.*\\)',
                confidence: 0.8,
                category: 'express_request_mocks',
                description: 'Express request/response mocks',
                framework: 'express'
            }
        ]
    }
};

/**
 * Database ORM patterns
 */
export const ORM_PATTERNS = {
    sequelize: {
        patterns: [
            {
                pattern: 'sequelize\\.mock|Sequelize\\.mock',
                confidence: 0.9,
                category: 'sequelize_mocks',
                description: 'Sequelize ORM mocking',
                framework: 'sequelize'
            },
            {
                pattern: 'Model\\.bulkCreate\\(.*mock.*\\)',
                confidence: 0.85,
                category: 'sequelize_mocks',
                description: 'Sequelize bulk create with mock data',
                framework: 'sequelize'
            },
            {
                pattern: 'Model\\.findAll\\(.*mock.*\\)',
                confidence: 0.8,
                category: 'sequelize_mocks',
                description: 'Sequelize findAll with mock data',
                framework: 'sequelize'
            }
        ]
    },
    mongoose: {
        patterns: [
            {
                pattern: 'jest\\.mock\\([\'"]mongoose[\'"]',
                confidence: 0.95,
                category: 'mongoose_mocks',
                description: 'Mongoose module mocking',
                framework: 'mongoose'
            },
            {
                pattern: 'mockModel\\.find\\(|mockModel\\.findOne\\(',
                confidence: 0.9,
                category: 'mongoose_mocks',
                description: 'Mongoose model query mocks',
                framework: 'mongoose'
            },
            {
                pattern: 'connectToDatabase\\(.*mock.*\\)',
                confidence: 0.85,
                category: 'mongoose_mocks',
                description: 'Mock database connection',
                framework: 'mongoose'
            }
        ]
    },
    prisma: {
        patterns: [
            {
                pattern: 'prisma\\.mock|jest\\.mock\\([\'"]@prisma/client[\'"]',
                confidence: 0.95,
                category: 'prisma_mocks',
                description: 'Prisma client mocking',
                framework: 'prisma'
            },
            {
                pattern: 'mockPrisma\\.user\\.findMany\\(',
                confidence: 0.9,
                category: 'prisma_mocks',
                description: 'Prisma model query mocks',
                framework: 'prisma'
            }
        ]
    }
};

/**
 * Get all framework patterns
 */
export function getAllFrameworkPatterns() {
    const allPatterns = {};
    
    // Merge all framework patterns
    Object.entries(REACT_PATTERNS).forEach(([category, patterns]) => {
        allPatterns[category] = patterns;
    });
    
    Object.entries(VUE_PATTERNS).forEach(([category, patterns]) => {
        allPatterns[category] = patterns;
    });
    
    Object.entries(ANGULAR_PATTERNS).forEach(([category, patterns]) => {
        allPatterns[category] = patterns;
    });
    
    Object.entries(EXPRESS_PATTERNS).forEach(([category, patterns]) => {
        allPatterns[category] = patterns;
    });
    
    Object.entries(ORM_PATTERNS).forEach(([category, patterns]) => {
        allPatterns[category] = patterns;
    });
    
    return allPatterns;
}

/**
 * Get patterns by framework
 */
export function getPatternsByFramework(framework) {
    const frameworkMap = {
        'react': REACT_PATTERNS,
        'vue': VUE_PATTERNS,
        'angular': ANGULAR_PATTERNS,
        'express': EXPRESS_PATTERNS,
        'sequelize': ORM_PATTERNS.sequelize,
        'mongoose': ORM_PATTERNS.mongoose,
        'prisma': ORM_PATTERNS.prisma
    };
    
    return frameworkMap[framework] || {};
}

/**
 * Get framework pattern categories
 */
export function getFrameworkPatternCategories() {
    const categories = new Set();
    
    Object.values(getAllFrameworkPatterns()).forEach(patternGroup => {
        if (patternGroup.patterns) {
            patternGroup.patterns.forEach(pattern => {
                if (pattern.category) {
                    categories.add(pattern.category);
                }
            });
        }
    });
    
    return Array.from(categories);
}

/**
 * Detect framework from file content
 */
export function detectFramework(content, filePath) {
    const lowerContent = content.toLowerCase();
    const lowerPath = filePath.toLowerCase();
    
    // React detection
    if (lowerContent.includes('import react') || 
        lowerContent.includes('from react') ||
        lowerPath.includes('.jsx') ||
        lowerContent.includes('reactdom')) {
        return 'react';
    }
    
    // Vue detection
    if (lowerContent.includes('<template>') ||
        lowerPath.includes('.vue') ||
        lowerContent.includes('vue.component')) {
        return 'vue';
    }
    
    // Angular detection
    if (lowerContent.includes('@angular/') ||
        lowerContent.includes('@component') ||
        lowerContent.includes('@injectable') ||
        lowerPath.includes('.component.ts') ||
        lowerPath.includes('.service.ts')) {
        return 'angular';
    }
    
    // Express detection
    if (lowerContent.includes('express()') ||
        lowerContent.includes('require(\'express\')') ||
        lowerContent.includes('app.get(') ||
        lowerContent.includes('app.post(')) {
        return 'express';
    }
    
    // Sequelize detection
    if (lowerContent.includes('sequelize') ||
        lowerContent.includes('define(') ||
        lowerContent.includes('hasmany(') ||
        lowerContent.includes('belongsto(')) {
        return 'sequelize';
    }
    
    // Mongoose detection
    if (lowerContent.includes('mongoose') ||
        lowerContent.includes('schema(') ||
        lowerContent.includes('model(') ||
        lowerContent.includes('connect(')) {
        return 'mongoose';
    }
    
    // Prisma detection
    if (lowerContent.includes('@prisma/client') ||
        lowerContent.includes('prisma.') ||
        lowerPath.includes('prisma/')) {
        return 'prisma';
    }
    
    return 'unknown';
}

export default {
    REACT_PATTERNS,
    VUE_PATTERNS,
    ANGULAR_PATTERNS,
    EXPRESS_PATTERNS,
    ORM_PATTERNS,
    getAllFrameworkPatterns,
    getPatternsByFramework,
    getFrameworkPatternCategories,
    detectFramework
};
