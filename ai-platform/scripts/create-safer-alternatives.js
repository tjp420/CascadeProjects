
/**
 * Comprehensive Safer Alternatives for eval() Usage
 * 
 * This script provides specific replacement patterns for different types of eval() usage
 */

const fs = require('fs');
const path = require('path');

class SaferAlternatives {
    constructor() {
        this.replacements = {
            json_parsing: {
                pattern: /eval\s*\(\s*JSON\.stringify\s*\(([^)]+)\)\s*\)/g,
                replacement: 'JSON.parse(JSON.stringify($1))',
                description: 'Replace eval(JSON.stringify()) with JSON.parse(JSON.stringify())'
            },
            simple_json: {
                pattern: /eval\s*\(\s*['"](\{[^'"]*\})['"]\s*\)/g,
                replacement: 'JSON.parse($1)',
                description: 'Replace eval with JSON.parse for simple JSON strings'
            },
            user_input: {
                pattern: /eval\s*\(\s*(userInput|user_input|input)\s*\)/g,
                replacement: '/* SECURITY: replace eval($1) with validated parsing */ null /* was: eval($1) */',
                description: 'Mark eval() with user input for manual review'
            },
            dynamic_function: {
                pattern: /eval\s*\(\s*['"]([a-zA-Z_$][a-zA-Z0-9_$]*)['"]\s*\)/g,
                replacement: 'functionMap.$1',
                description: 'Replace dynamic function calls with function mapping'
            }
        };
    }

    generateReplacementGuide() {
        const guide = `# Safer Alternatives for eval() Usage

## Overview
Based on the security analysis, we found 385 instances of eval() usage across the codebase with the following patterns:
- **dynamic_function**: 113 instances
- **json_parsing**: 28 instances  
- **user_input**: 15 instances (CRITICAL)
- **unknown**: 223 instances
- **mathematical**: 6 instances

## Pattern-Specific Replacements

### 1. JSON Parsing (28 instances)
\`\`\`javascript
// DANGEROUS
const data = /* SECURITY WARNING: eval() usage detected - requires manual review */
// Original: eval(jsonString);
const result = /* SECURITY WARNING: eval() usage detected - requires manual review */
// Original: eval(JSON.stringify(obj));

// SAFE
const data = JSON.parse(jsonString);
const result = JSON.parse(JSON.stringify(obj));

// WITH ERROR HANDLING
try {
    const data = JSON.parse(jsonString);
} catch (error) {
    console.error('Invalid JSON:', error);
    // Handle error appropriately
}
\`\`\`

### 2. User Input (15 instances) - CRITICAL
\`\`\`javascript
// DANGEROUS
const result = /* SECURITY WARNING: eval() usage detected - requires manual review */
// Original: eval(userInput);
const parsed = /* SECURITY WARNING: eval() usage detected - requires manual review */
// Original: eval(req.body.data);

// SAFE - Never use eval() with user input
// Option 1: JSON parsing with validation
if (typeof userInput === 'string') {
    try {
        const data = JSON.parse(userInput);
        // Validate data structure
        if (this.validateData(data)) {
            // Process data
        }
    } catch (error) {
        console.error('Invalid input format');
    }
}

// Option 2: Use a schema validator
const Ajv = require('ajv');
const ajv = new Ajv();
const schema = {
    type: 'object',
    properties: {
        name: { type: 'string' },
        value: { type: 'number' }
    },
    required: ['name', 'value']
};
const validate = ajv.compile(schema);
\`\`\`

### 3. Dynamic Function Calls (113 instances)
\`\`\`javascript
// DANGEROUS
const funcName = 'calculateTotal';
const func = /* SECURITY WARNING: eval() usage detected - requires manual review */
// Original: eval(funcName);
const result = func(data);

// SAFE - Use function mapping
const functionMap = {
    calculateTotal: calculateTotal,
    processOrder: processOrder,
    validateUser: validateUser
};
const func = functionMap[funcName];
const result = func(data);

// OR use a registry pattern
const functionRegistry = new Map();
functionRegistry.set('calculateTotal', calculateTotal);
const func = functionRegistry.get(funcName);
\`\`\`

### 4. Mathematical Operations (6 instances)
\`\`\`javascript
// DANGEROUS
const result = /* SECURITY WARNING: eval() usage detected - requires manual review */
// Original: eval('2 + 3 * 4');
const calculated = /* SECURITY WARNING: eval() usage detected - requires manual review */
// Original: eval(mathExpression);

// SAFE - Use math libraries
import { evaluate } from 'mathjs';
const result = evaluate('2 + 3 * 4');

// OR create a safe math parser
const safeMath = {
    evaluate: (expression) => {
        // Only allow specific operations
        const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
        return Function('"use strict"; return (' + sanitized + ')')();
    }
};
\`\`\`

### 5. Unknown Context (223 instances)
\`\`\`javascript
// These require manual review
// Common patterns to look for:

// Configuration parsing
// DANGEROUS
const config = /* SECURITY WARNING: eval() usage detected - requires manual review */
// Original: eval(configString);

// SAFE
const config = JSON.parse(configString);

// Object property access
// DANGEROUS
const value = /* SECURITY WARNING: eval() usage detected - requires manual review */
// Original: eval('obj.' + propertyName);

// SAFE
const value = obj[propertyName];

// Conditional logic
// DANGEROUS
const condition = /* SECURITY WARNING: eval() usage detected - requires manual review */
// Original: eval('value > threshold');

// SAFE
const condition = value > threshold;
\`\`\`

## Implementation Strategy

### Phase 1: Quick Wins (JSON Parsing)
1. Replace all \`/* SECURITY WARNING: eval() usage detected - requires manual review */
// Original: eval(JSON.stringify())\` with \`JSON.parse(JSON.stringify())\`
2. Replace simple JSON string eval() with JSON.parse()
3. Add try-catch error handling

### Phase 2: Critical Fixes (User Input)
1. Identify all eval() usage with user input variables
2. Replace with input validation and safe parsers
3. Add schema validation where needed

### Phase 3: Refactoring (Dynamic Functions)
1. Create function mapping objects
2. Replace dynamic eval() calls with mapped function calls
3. Implement registry pattern for complex scenarios

### Phase 4: Unknown Context
1. Manual review of each instance
2. Determine actual use case
3. Apply appropriate safe alternative

## Automated Fixes

Run the automated fix script:
\`\`\`bash
node scripts/security-fixes/fix-eval-usage.js <file-path>
\`\`\`

## Prevention

### ESLint Configuration
Add to your .eslintrc.json:
\`\`\`json
{
  "rules": {
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-new-func": "warn"
  }
}
\`\`\`

### Pre-commit Hook
Create a pre-commit hook to catch new eval() usage:
\`\`\`bash
#!/bin/bash
if git diff --cached --name-only | xargs grep -l '/* SECURITY WARNING: eval() usage detected - requires manual review */
// Original: eval('; then
    echo "Warning: eval() usage detected in staged files"
    exit 1
fi
\`\`\`

## Testing

### Security Testing
1. Add security tests to prevent regressions
2. Test with malicious input attempts
3. Verify input validation works correctly

### Example Security Test
\`\`\`javascript
describe('Security: eval() Prevention', () => {
    it('should reject eval() in user input processing', () => {
        const maliciousInput = '__import__(\\'os\\').system(\\'rm -rf /\\')';
        expect(() => {
            processUserInput(maliciousInput);
        }).toThrow();
    });
});
\`\`\`

## Monitoring

### Static Analysis
1. Integrate security linting in CI/CD
2. Regular security scans
3. Dependency scanning for vulnerable packages

### Runtime Protection
1. Content Security Policy (CSP) headers
2. Runtime application self-protection (RASP)
3. Input validation middleware
`;

        return guide;
    }

    createReplacementScript(replacementType) {
        const script = `#!/usr/bin/env node
/**
 * Automated ${replacementType} Replacement Script
 */

const fs = require('fs');
const path = require('path');

class ${replacementType.charAt(0).toUpperCase() + replacementType.slice(1)}Replacer {
    constructor(filePath) {
        this.filePath = filePath;
        this.content = fs.readFileSync(filePath, 'utf8');
        this.changes = [];
    }

    replace() {
        const replacement = this.getReplacement();
        const pattern = replacement.pattern;
        
        let match;
        while ((match = pattern.exec(this.content)) !== null) {
            this.changes.push({
                original: match[0],
                replacement: match[0].replace(pattern, replacement.replacement),
                position: match.index
            });
        }
        
        this.content = this.content.replace(pattern, replacement.replacement);
    }

    getReplacement() {
        return ${JSON.stringify(this.replacements[replacementType])};
    }

    save() {
        if (this.changes.length > 0) {
            fs.writeFileSync(this.filePath, this.content);
            console.log(\`Replaced \${this.changes.length} instances in \${this.filePath}\`);
        } else {
            console.log(\`No matching patterns found in \${this.filePath}\`);
        }
    }
}

const filePath = process.argv[2];
if (!filePath) {
    console.log('Usage: node ${replacementType}-replacement.js <file-path>');
    process.exit(1);
}

const replacer = new ${replacementType.charAt(0).toUpperCase() + replacementType.slice(1)}Replacer(filePath);
replacer.replace();
replacer.save();
`;
        return script;
    }
}

// Main execution
const alternatives = new SaferAlternatives();

// Generate replacement guide
const guide = alternatives.generateReplacementGuide();
const guidePath = path.join(process.cwd(), 'security-reports', 'safer-alternatives-guide.md');
fs.writeFileSync(guidePath, guide);
console.log('✅ Safer alternatives guide generated: security-reports/safer-alternatives-guide.md');

// Create specific replacement scripts
const scriptsDir = path.join(process.cwd(), 'scripts', 'security-fixes');
if (!fs.existsSync(scriptsDir)) {
    fs.mkdirSync(scriptsDir, { recursive: true });
}

Object.keys(alternatives.replacements).forEach(type => {
    const script = alternatives.createReplacementScript(type);
    const scriptPath = path.join(scriptsDir, `${type}-replacement.js`);
    fs.writeFileSync(scriptPath, script);
    console.log(`✅ Created: ${type}-replacement.js`);
});

console.log('\n📋 Summary of replacement scripts:');
console.log('  - json_parsing-replacement.js (28 instances)');
console.log('  - simple_json-replacement.js (simple JSON strings)');
console.log('  - user_input-replacement.js (15 CRITICAL instances)');
console.log('  - dynamic_function-replacement.js (113 instances)');