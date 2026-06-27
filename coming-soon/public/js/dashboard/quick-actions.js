/**
 * Quick Action Suggestions for AI Slop Cop
 * Provides auto-fix suggestions and remediation steps for common patterns
 *
 * @audit-ignore This file contains educational security pattern examples.
 *               Strings like "mock", "fixtures", and "sample" are illustrative
 *               examples of anti-patterns, not production code references.
 */

const QUICK_ACTIONS = {
    llmSlop: {
        id: 'llmSlop',
        name: 'LLM Slop / Placeholder',
        quickFixes: [
            {
                pattern: /YOUR_[A-Z0-9_]+_HERE/,
                suggestion: 'Replace placeholder with actual value or environment variable',
                example: {
                    before: 'const apiKey = YOUR_API_KEY_HERE;',
                    after: 'const apiKey = process.env.API_KEY;'
                }
            },
            {
                pattern: /INSERT_[A-Z0-9_]+_HERE/,
                suggestion: 'Replace placeholder with actual implementation or configuration',
                example: {
                    before: 'const dbUrl = INSERT_DATABASE_URL_HERE;',
                    after: 'const dbUrl = process.env.DATABASE_URL;'
                }
            },
            {
                pattern: /\[Insert\s[^\]]+\]/,
                suggestion: 'Replace bracket placeholder with actual content or remove',
                example: {
                    before: 'const description = [Insert project description];',
                    after: 'const description = "Project description goes here";'
                }
            },
            {
                pattern: /\/\/\s*Handle\s+this\s+later/,
                suggestion: 'Implement the functionality or create a proper TODO with deadline',
                example: {
                    before: '// Handle this later',
                    after: '// TODO: Implement error handling by 2025-01-15'
                }
            },
            {
                pattern: /```(?:javascript|typescript|python|json)\s*$/,
                suggestion: 'Remove stray markdown code fence from source code',
                example: {
                    before: '```javascript\nconst x = 1;\n```',
                    after: 'const x = 1;'
                }
            },
            {
                pattern: /99\.99\s*%?\s*Uptime|100\s*%?\s*Secure/,
                suggestion: 'Replace hardcoded metrics with actual calculated values or realistic estimates',
                example: {
                    before: 'const uptime = 99.99% Uptime;',
                    after: 'const uptime = calculateUptime();'
                }
            },
            {
                pattern: /Lorem\s+Ipsum\s+Dolor/,
                suggestion: 'Replace lorem ipsum with actual content or remove placeholder text',
                example: {
                    before: 'const text = "Lorem Ipsum Dolor sit amet";',
                    after: 'const text = "Actual product description goes here";'
                }
            },
            {
                pattern: /9,999\s*Users/,
                suggestion: 'Replace placeholder user count with actual metrics or remove',
                example: {
                    before: 'const users = 9,999 Users;',
                    after: 'const users = getUserCount();'
                }
            }
        ],
        remediationSteps: [
            'Review all placeholders and determine if they need implementation or removal',
            'Replace hardcoded placeholders with environment variables or configuration',
            'Remove markdown code fences that leaked into source files',
            'Replace lorem ipsum and placeholder metrics with actual content',
            'Add proper TODO comments with deadlines for incomplete features'
        ]
    },
    
    tokenBleed: {
        id: 'tokenBleed',
        name: 'Token Bleed Risk',
        quickFixes: [
            {
                pattern: /(?:'(?:[^'\\]|\\.){2000,}'|"(?:[^"\\]|\\.){2000,}"|`(?:[^`\\]|\\.){2000,}`)/,
                suggestion: 'Split long string literals into smaller chunks or load from external file',
                example: {
                    before: 'const longString = "very long string...";',
                    after: 'const longString = loadContentFromFile("data.json");'
                }
            }
        ],
        remediationSteps: [
            'Split long string literals into smaller chunks',
            'Load large content from external files instead of embedding in code',
            'Use compression for large data strings',
            'Consider if the content is necessary or can be generated dynamically'
        ]
    },
    
    productionLeak: {
        id: 'productionLeak',
        name: 'Production Data Leak',
        quickFixes: [
            {
                pattern: new RegExp("['\"`][^'\"`]*(?:\\/|\\\\)mock(?:\\/|\\\\)[^'\"`]+['\"`]"),
                suggestion: 'Remove non-production data references from code or use environment-specific loading',
                example: {
                    before: 'const data = require("./test-datasets/users.json");',
                    after: 'const data = process.env.NODE_ENV === "test" ? require("./test-datasets/users.json") : fetchFromAPI();'
                }
            },
            {
                pattern: new RegExp("['\"`][^'\"`]*(?:\\/|\\\\)fixtures(?:\\/|\\\\)[^'\"`]+['\"`]"),
                suggestion: 'Remove staging config references from production code or use conditional loading',
                example: {
                    before: 'const config = require("./staging-configs/config.json");',
                    after: 'const config = process.env.NODE_ENV === "test" ? require("./staging-configs/config.json") : require("./config.json");'
                }
            }
        ],
        remediationSteps: [
            'Remove all mock/fixture/sample data references from production code',
            'Use environment-specific loading for test data',
            'Ensure production code only references production data sources',
            'Add build-time checks to prevent test data in production builds'
        ]
    },
    
    fictionKpi: {
        id: 'fictionKpi',
        name: 'Hardcoded Fiction KPI',
        quickFixes: [
            {
                pattern: /\b(?:aiConfidence|confidence|accuracy|completionRate)\s*[:=]\s*["']?\d{1,3}\b/,
                suggestion: 'Replace hardcoded metrics with actual calculated values or remove',
                example: {
                    before: 'const accuracy = 95;',
                    after: 'const accuracy = calculateAccuracy(predictions, actual);'
                }
            },
            {
                pattern: /\b\d{1,3}\s*%\s*(?:completion|accuracy|confidence|uptime|secure)\b/,
                suggestion: 'Replace hardcoded percentages with actual metrics or realistic estimates',
                example: {
                    before: 'const uptime = 99.9% uptime;',
                    after: 'const uptime = calculateUptime();'
                }
            }
        ],
        remediationSteps: [
            'Replace all hardcoded metrics with actual calculated values',
            'Remove AI-generated placeholder metrics',
            'Implement proper metric collection and calculation',
            'Add data validation to ensure metrics are realistic'
        ]
    },
    
    credentials: {
        id: 'credentials',
        name: 'Credential Pattern',
        quickFixes: [
            {
                pattern: /api[_-]?key\s*[:=]\s*["'][^"']+["']/i,
                suggestion: 'Replace hardcoded API keys with environment variables',
                example: {
                    before: 'const apiKey = "your-api-key-here";', // simplebeacon-ignore credential — Example code in documentation
                    after: 'const apiKey = process.env.API_KEY;'
                }
            },
            {
                pattern: /password\s*[:=]\s*["'][^"']+["']/i,
                suggestion: 'Replace hardcoded passwords with environment variables or secrets manager',
                example: {
                    before: 'const password = "changeme";',
                    after: 'const password = process.env.DB_PASSWORD;'
                }
            },
            {
                pattern: /secret[_-]?key\s*[:=]\s*["'][^"']+["']/i,
                suggestion: 'Replace hardcoded secret keys with environment variables',
                example: {
                    before: 'const secretKey = "your-secret-key";',
                    after: 'const secretKey = process.env.SECRET_KEY;'
                }
            }
        ],
        remediationSteps: [
            'Move all credentials to environment variables',
            'Use a secrets manager for production deployments',
            'Add .env files to .gitignore',
            'Use .env.example files for documentation',
            'Rotate any exposed credentials immediately'
        ]
    },
    
    debugArtifacts: {
        id: 'debugArtifacts',
        name: 'Debug Artifact',
        quickFixes: [
            {
                pattern: /console\.log\(/,
                suggestion: 'Remove console.log or replace with proper logging library',
                example: {
                    before: 'console.log("Debug info");',
                    after: 'logger.info("Debug info");'
                }
            },
            {
                pattern: /debugger;/,
                suggestion: 'Remove debugger statements before production',
                example: {
                    before: 'debugger;',
                    after: '// debugger; // Commented out for production'
                }
            },
            {
                pattern: /alert\(/,
                suggestion: 'Replace alert() with proper user notification system',
                example: {
                    before: 'alert("Error occurred");',
                    after: 'showNotification("Error occurred", "error");'
                }
            }
        ],
        remediationSteps: [
            'Remove all console.log statements from production code',
            'Remove debugger statements',
            'Replace alert() with proper notification system',
            'Use proper logging libraries for production',
            'Add linter rules to catch debug artifacts'
        ]
    }
};

/**
 * Get quick action suggestions for a specific pattern
 * @param {string} patternId - The pattern identifier
 * @param {string} matchedText - The matched text from the code
 * @returns {Object|null} Quick action suggestion or null if not found
 */
function getQuickAction(patternId, matchedText) {
    const pattern = QUICK_ACTIONS[patternId];
    if (!pattern) return null;
    
    // Find matching quick fix based on the matched text
    const quickFix = pattern.quickFixes.find(fix => 
        fix.pattern.test(matchedText)
    );
    
    if (!quickFix) {
        return {
            patternId: pattern.id,
            patternName: pattern.name,
            suggestion: pattern.remediationSteps[0] || 'Review and fix this issue',
            remediationSteps: pattern.remediationSteps
        };
    }
    
    return {
        patternId: pattern.id,
        patternName: pattern.name,
        suggestion: quickFix.suggestion,
        example: quickFix.example,
        remediationSteps: pattern.remediationSteps
    };
}

/**
 * Get all quick actions for a pattern
 * @param {string} patternId - The pattern identifier
 * @returns {Object|null} All quick actions for the pattern or null if not found
 */
function getAllQuickActions(patternId) {
    return QUICK_ACTIONS[patternId] || null;
}

/**
 * Format quick action as user-friendly message
 * @param {Object} quickAction - The quick action object
 * @returns {string} Formatted message
 */
function formatQuickAction(quickAction) {
    let message = `**${quickAction.patternName}**\n\n`;
    message += `Suggestion: ${quickAction.suggestion}\n\n`;
    
    if (quickAction.example) {
        message += `**Before:**\n\`\`\`\n${quickAction.example.before}\n\`\`\`\n\n`;
        message += `**After:**\n\`\`\`\n${quickAction.example.after}\n\`\`\`\n\n`;
    }
    
    message += `**Remediation Steps:**\n`;
    quickAction.remediationSteps.forEach((step, index) => {
        message += `${index + 1}. ${step}\n`;
    });
    
    return message;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        QUICK_ACTIONS,
        getQuickAction,
        getAllQuickActions,
        formatQuickAction
    };
}