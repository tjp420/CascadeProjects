// simplebeacon-ignore: Security findings are false positives — scanner definitions, test fixtures, dashboard code, and build scripts
/**
 * Detailed Explanations for AI Slop Cop Detection Rules
 * Provides comprehensive documentation for each detection pattern
 *
 * @audit-ignore This file contains educational security pattern examples.
 *               Strings like "dev-data", "test-datasets", and "drafts" are illustrative
 *               examples of anti-patterns, not production code references.
 */
const PATTERN_DOCUMENTATION = {
    llmSlop: {
        id: 'llmSlop',
        name: 'LLM Slop / Placeholder',
        severity: 'medium',
        description:
            'Detects unresolved AI-generated placeholders, markdown code fences leaked into source code, and hardcoded AI-default metrics that should not reach production.',
        detailedExplanation: `
            AI coding assistants often leave behind placeholder text, markdown code fences, or 
            hardcoded default metrics that should not reach production. This pattern detects:
            
            - Placeholder comments like "YOUR_API_KEY_HERE" or "INSERT_CODE_HERE"
            - Bracket placeholders like "[Insert project description]"
            - TODO comments without clear deadlines
            - Stray markdown code fences (\`\`\`) in source files
            - Hardcoded metrics like "99.99% Uptime" or "100% Secure"
            - Lorem ipsum placeholder text
            - Placeholder user counts like "9,999 Users"
            
            These artifacts indicate incomplete AI-generated code that needs human review and completion.
        `,
        examples: {
            bad: [
                'const apiKey = YOUR_API_KEY_HERE;',
                '// Handle this later',
                '```javascript\nconst x = 1;\n```',
                'const uptime = 99.99% Uptime;'
            ],
            good: [
                'const apiKey = process.env.API_KEY;',
                '// TODO: Implement error handling by 2025-01-15', // simplebeacon-ignore maintainability-pattern — documentation example string
                'const x = 1;',
                'const uptime = calculateUptime();'
            ]
        },
        impact: `Leaving placeholders in production code can cause runtime errors, security vulnerabilities, and misleading metrics. It indicates incomplete code review and AI-generated code that was not properly human-reviewed.`,
        prevention: `Always review AI-generated code before committing. Use linter rules to catch placeholders. Implement pre-commit hooks to block commits with unresolved placeholders.`,
        relatedPatterns: ['fictionKpi', 'tokenBleed', 'productionLeak']
    },
    tokenBleed: {
        id: 'tokenBleed',
        name: 'Token Bleed Risk',
        severity: 'medium',
        description:
            'Detects very long string literals (>2000 characters) that may cause context overflow in LLM prompts and inefficient memory usage.',
        detailedExplanation: `
            Long string literals in code can cause several issues:
            
            - Context overflow when code is used in LLM prompts
            - Inefficient memory usage and performance degradation
            - Difficulty in code maintenance and readability
            - Potential for embedding large data that should be externalized
            
            This pattern flags string literals over 2000 characters that should be split or moved to external files.
        `,
        examples: {
            bad: [
                'const longString = "very long string over 2000 characters...";',
                'const template = \`huge template with lots of content...\`;'
            ],
            good: [
                'const longString = loadContentFromFile("data.json");',
                'const template = loadTemplate("email-template.html");'
            ]
        },
        impact: `Long string literals can cause performance issues, memory problems, and context overflow when code is processed by LLMs. They also make code harder to maintain.`,
        prevention: `Keep string literals under 2000 characters. Load large content from external files. Use compression for large data. Consider dynamic content generation.`,
        relatedPatterns: ['llmSlop', 'productionLeak']
    },
    productionLeak: {
        id: 'productionLeak',
        name: 'Production Data Leak',
        severity: 'medium',
        description:
            'Detects references to non-production data paths (e.g., test datasets, staging configs, demo files) in source code that could expose development artifacts or incorrect configurations.',
        detailedExplanation: `
            Production code should never reference development-only data paths. This pattern detects:
            
            - Paths to development data directories (./dev-data/, ./test-datasets/)
            - Demo file references (./drafts/, ./test-data/)
            - Frontend data directory references in production code
            
            These references can cause production systems to use non-production data, leading to incorrect behavior
            or potential data exposure.
        `,
        examples: {
            bad: [
                'const data = require("./test-datasets/users.json");',
                'const config = require("./staging-configs/config.json");',
                'const template = "./templates/draft.json";'
            ],
            good: [
                'const data = process.env.NODE_ENV === "test" ? require("./test-datasets/users.json") : fetchFromAPI();',
                'const config = require("./config.json");',
                'const template = "./templates/production.json";'
            ]
        },
        impact: `Test data in production can cause incorrect behavior, security vulnerabilities, and data exposure. It indicates poor separation of test and production code.`,
        prevention: `Use environment-specific loading for test data. Ensure production code only references production data sources. Add build-time checks to prevent test data in production builds.`,
        relatedPatterns: ['llmSlop', 'fictionKpi']
    },
    fictionKpi: {
        id: 'fictionKpi',
        name: 'Hardcoded Fiction KPI',
        severity: 'medium',
        description:
            'Detects hardcoded metrics, completion rates, and AI confidence scores that may be AI-generated fiction rather than real measured values.',
        detailedExplanation: `
            AI assistants often generate placeholder metrics that look realistic but are not based on actual data:
            
            - Hardcoded confidence scores (e.g., "confidence: 95")
            - Fake completion rates (e.g., "completionRate: 87%")
            - Placeholder user counts (e.g., "totalFeatures: 150")
            - AI-generated accuracy metrics
            - Unrealistic uptime percentages
            
            These fictional metrics can mislead stakeholders and indicate that AI-generated code was 
            not properly validated with real data.
        `,
        examples: {
            bad: ['const accuracy = 95;', 'const completionRate = "87%";', 'const totalFeatures = 150;'],
            good: [
                'const accuracy = calculateAccuracy(predictions, actual);',
                'const completionRate = calculateCompletionRate();',
                'const totalFeatures = features.length;'
            ]
        },
        impact: `Fiction metrics can mislead decision-making, hide real performance issues, and indicate poor data validation. They can damage trust when discovered.`,
        prevention: `Always calculate metrics from real data. Implement proper metric collection and validation. Add data validation to ensure metrics are realistic and within expected ranges.`,
        relatedPatterns: ['llmSlop', 'tokenBleed']
    },
    credentials: {
        id: 'credentials',
        name: 'Credential Pattern',
        severity: 'high',
        description:
            'Detects hardcoded credentials, API keys, passwords, and secrets in source code that pose security risks.',
        detailedExplanation: `
            Hardcoded credentials in source code are a major security vulnerability. This pattern detects:
            
            - API keys and tokens
            - Database passwords
            - Secret keys and authentication tokens
            - Private keys and certificates
            - Third-party service credentials
            
            These credentials can be extracted from version control, logs, or compiled code and used to 
            compromise systems.
        `,
        examples: {
            bad: [
                'const apiKey = "your-api-key-here";', // simplebeacon-ignore credential — Example code in documentation
                'const password = "changeme";',
                'const secretKey = "your-secret-key";'
            ],
            good: [
                'const apiKey = process.env.API_KEY;',
                'const password = process.env.DB_PASSWORD;',
                'const secretKey = process.env.SECRET_KEY;'
            ]
        },
        impact: `Hardcoded credentials can lead to unauthorized access, data breaches, and system compromise. They are often found in version control and can be exploited by attackers.`,
        prevention: `Never commit credentials to version control. Use environment variables or secrets managers. Add .env files to .gitignore. Use .env.example files for documentation. Rotate exposed credentials immediately.`,
        relatedPatterns: ['productionLeak', 'configDrift']
    },
    debugArtifacts: {
        id: 'debugArtifacts',
        name: 'Debug Artifact',
        severity: 'low',
        description:
            'Detects debug statements, console.log calls, debugger statements, and other development artifacts that should not be in production code.',
        detailedExplanation: `
            Debug artifacts left in production code can cause performance issues, information leakage, 
            and poor user experience. This pattern detects:
            
            - console.log statements
            - debugger statements
            - alert() calls
            - Development-only comments
            - Temporary debugging code
            
            These artifacts should be removed or replaced with proper logging before deployment.
        `,
        examples: {
            bad: ['console.log("Debug info");', 'debugger;', 'alert("Error occurred");'],
            good: [
                'logger.info("Debug info");',
                '// debugger; // Commented out for production',
                'showNotification("Error occurred", "error");'
            ]
        },
        impact: `Debug artifacts can cause performance issues, expose sensitive information, and create poor user experience. They indicate incomplete code cleanup before deployment.`,
        prevention: `Remove all debug statements before production. Use proper logging libraries. Add linter rules to catch debug artifacts. Implement pre-commit hooks to block debug code.`,
        relatedPatterns: ['configDrift', 'performance']
    },
    aiIndicators: {
        id: 'aiIndicators',
        name: 'AI System Indicators',
        severity: 'low',
        description:
            'Detects AI/LLM SDK imports, model inference patterns, and AI-related code that indicates use of artificial intelligence in the system.',
        detailedExplanation: `
            AI system indicators help identify where AI/ML is being used in the codebase. This pattern detects:
            
            - AI/LLM SDK imports (OpenAI, Anthropic, LangChain, etc.)
            - Model inference calls
            - AI-related dependencies
            - Machine learning framework usage
            
            These indicators are useful for compliance documentation and understanding AI system architecture.
        `,
        examples: {
            detected: [
                'import OpenAI from "openai";',
                'from anthropic import Anthropic',
                'from langchain import LLMChain'
            ],
            note: 'These are not necessarily issues but indicators for documentation and compliance purposes.'
        },
        impact: `AI indicators help with compliance documentation, system architecture understanding, and regulatory reporting. They are informational rather than problematic.`,
        prevention: `No prevention needed - these are informational indicators for documentation and compliance.`,
        relatedPatterns: ['llmSlop', 'fictionKpi']
    },
    configDrift: {
        id: 'configDrift',
        name: 'Configuration Drift',
        severity: 'low',
        description:
            'Detects hardcoded configuration values, missing environment variable usage, and configuration inconsistencies across environments.',
        detailedExplanation: `
            Configuration drift occurs when hardcoded values are used instead of environment-specific configuration. 
            This pattern detects:
            
            - Hardcoded URLs and endpoints
            - Missing environment variable usage
            - Configuration inconsistencies
            - Hardcoded feature flags
            
            Proper configuration management ensures consistency across environments and security.
        `,
        examples: {
            bad: ['const apiUrl = "https://api.example.com";', 'const debug = true;', 'const apiKey = "changeme";'],
            good: [
                'const apiUrl = process.env.API_URL || "https://api.example.com";',
                'const debug = process.env.DEBUG === "true";',
                'const apiKey = process.env.API_KEY;'
            ]
        },
        impact: `Configuration drift can cause inconsistent behavior across environments, security issues, and deployment problems. It makes environment-specific configuration difficult.`,
        prevention: `Use environment variables for all configuration. Provide sensible defaults. Document required environment variables. Use configuration management best practices.`,
        relatedPatterns: ['credentials', 'productionLeak']
    },
    performance: {
        id: 'performance',
        name: 'Performance Issue',
        severity: 'low',
        description:
            'Detects common performance anti-patterns like nested loops, memory leaks, event listener leaks, and inefficient regular expressions.',
        detailedExplanation: `
            Performance issues can significantly impact application responsiveness and resource usage. 
            This pattern detects:
            
            - Deeply nested loops
            - Memory leaks (event listeners, timers)
            - Inefficient regular expressions
            - Large object allocations
            - Synchronous operations in async contexts
            
            These patterns can cause slow performance, high memory usage, and poor user experience.
        `,
        examples: {
            bad: [
                'for (let i = 0; i < n; i++) { for (let j = 0; j < m; j++) { for (let k = 0; k < p; k++) { ... } } }',
                'setInterval(() => { ... }, 1000); // never cleared',
                '/[^a-zA-Z0-9]/g.match(str) // inefficient regex'
            ],
            good: [
                'Use more efficient algorithms or data structures',
                'Clear intervals and timeouts when done',
                'Use optimized regular expressions'
            ]
        },
        impact: `Performance issues can cause slow applications, high resource usage, and poor user experience. They can also increase infrastructure costs.`,
        prevention: `Use performance profiling tools. Follow best practices for loops and memory management. Optimize regular expressions. Use efficient algorithms and data structures.`,
        relatedPatterns: ['complexityMetric', 'debugArtifacts']
    },
    complexityMetric: {
        id: 'complexityMetric',
        name: 'High Complexity',
        severity: 'low',
        description:
            'Detects overly long functions, deeply nested control flow, and high cyclomatic complexity that makes code hard to maintain and test.',
        detailedExplanation: `
            High complexity code is difficult to understand, maintain, and test. This pattern detects:
            
            - Functions over 50 lines
            - Deeply nested control flow (3+ levels)
            - High cyclomatic complexity
            - Too many parameters
            - Multiple responsibilities in one function
            
            Complex code is more prone to bugs and harder to modify safely.
        `,
        examples: {
            bad: [
                'Functions over 50 lines with multiple nested conditions',
                'Deep nesting: if { if { if { ... } } }',
                'Functions with 10+ parameters'
            ],
            good: [
                'Keep functions under 50 lines',
                'Extract helper functions to reduce nesting',
                'Use early returns to reduce complexity',
                'Limit parameters to 5 or fewer'
            ]
        },
        impact: `High complexity code is harder to maintain, more prone to bugs, and difficult to test. It increases development time and reduces code quality.`,
        prevention: `Follow SOLID principles. Extract helper functions. Use early returns. Keep functions small and focused. Use design patterns to reduce complexity.`,
        relatedPatterns: ['performance', 'frameworkPractice']
    }
};
/**
 * Get detailed documentation for a pattern
 * @param {string} patternId - The pattern identifier
 * @returns {Object|null} Pattern documentation or null if not found
 */
function getPatternDocumentation(patternId) {
    return PATTERN_DOCUMENTATION[patternId] || null;
}
/**
 * Get pattern summary for quick display
 * @param {string} patternId - The pattern identifier
 * @returns {string|null} Pattern summary or null if not found
 */
function getPatternSummary(patternId) {
    const doc = PATTERN_DOCUMENTATION[patternId];
    if (!doc) return null;
    return `${doc.name} (${doc.severity}): ${doc.description}`;
}
/**
 * Get all pattern IDs
 * @returns {Array<string>} Array of pattern IDs
 */
function getAllPatternIds() {
    return Object.keys(PATTERN_DOCUMENTATION);
}
/**
 * Search patterns by keyword
 * @param {string} keyword - Search keyword
 * @returns {Array<Object>} Array of matching pattern documentation
 */
function searchPatterns(keyword) {
    const lowerKeyword = keyword.toLowerCase();
    return Object.values(PATTERN_DOCUMENTATION).filter(
        doc =>
            doc.name.toLowerCase().includes(lowerKeyword) ||
            doc.description.toLowerCase().includes(lowerKeyword) ||
            doc.detailedExplanation.toLowerCase().includes(lowerKeyword)
    );
}
// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PATTERN_DOCUMENTATION,
        getPatternDocumentation,
        getPatternSummary,
        getAllPatternIds,
        searchPatterns
    };
}
