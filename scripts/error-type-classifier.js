#!/usr/bin/env node

/**
 * Error Type Classifier and Guidance System
 * 
 * This script classifies different error types found in the codebase
 * and provides comprehensive guidance for addressing each type systematically.
 */

const fs = require('fs');
const path = require('path');

class ErrorTypeClassifier {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.guidanceDir = path.join(projectRoot, 'security-reports', 'guidance');
        this.ensureGuidanceDirectory();
    }

    ensureGuidanceDirectory() {
        if (!fs.existsSync(this.guidanceDir)) {
            fs.mkdirSync(this.guidanceDir, { recursive: true });
        }
    }

    async classifyAndGenerateGuidance() {
        console.log('📋 Error Type Classification and Guidance System\n');

        const errorTypes = [
            {
                id: 'eval_usage',
                name: 'eval() Usage',
                severity: 'critical',
                description: 'Use of eval() function which executes arbitrary code',
                patterns: [/eval\s*\(/g, /new\s+Function\s*\(/g],
                examples: this.getEvalExamples(),
                solutions: this.getEvalSolutions(),
                prevention: this.getEvalPrevention()
            },
            {
                id: 'command_injection',
                name: 'Command Injection',
                severity: 'critical',
                description: 'Execution of system commands with user input',
                patterns: [/subprocess\.(call|run|Popen)/g, /os\.system\s*\(/g, /exec\s*\(/g],
                examples: this.getCommandInjectionExamples(),
                solutions: this.getCommandInjectionSolutions(),
                prevention: this.getCommandInjectionPrevention()
            },
            {
                id: 'xss_vulnerability',
                name: 'Cross-Site Scripting (XSS)',
                severity: 'high',
                description: 'Injection of malicious scripts into web pages',
                patterns: [/innerHTML\s*=/g, /document\.write\s*\(/g, /outerHTML\s*=/g],
                examples: this.getXSSExamples(),
                solutions: this.getXSSSolutions(),
                prevention: this.getXSSPrevention()
            },
            {
                id: 'sql_injection',
                name: 'SQL Injection',
                severity: 'critical',
                description: 'Injection of malicious SQL queries',
                patterns: [/execute\s*\(\s*["'].*?\%s/g, /query\s*\(\s*["'].*?\+/g],
                examples: this.getSQLInjectionExamples(),
                solutions: this.getSQLInjectionSolutions(),
                prevention: this.getSQLInjectionPrevention()
            },
            {
                id: 'path_traversal',
                name: 'Path Traversal',
                severity: 'high',
                description: 'Access to files outside intended directory',
                patterns: [/\.\.\/|\.\.\\/g],
                examples: this.getPathTraversalExamples(),
                solutions: this.getPathTraversalSolutions(),
                prevention: this.getPathTraversalPrevention()
            },
            {
                id: 'insecure_deserialization',
                name: 'Insecure Deserialization',
                severity: 'high',
                description: 'Untrusted data deserialization leading to code execution',
                patterns: [/pickle\.loads/g, /unpickle/g, /JSON\.parse/g],
                examples: this.getInsecureDeserializationExamples(),
                solutions: this.getInsecureDeserializationSolutions(),
                prevention: this.getInsecureDeserializationPrevention()
            }
        ];

        for (const errorType of errorTypes) {
            this.generateErrorTypeGuidance(errorType);
        }

        this.generateMasterGuidance(errorTypes);
        console.log('\n✅ Error Type Classification Complete!');
    }

    generateErrorTypeGuidance(errorType) {
        const guidance = {
            metadata: {
                id: errorType.id,
                name: errorType.name,
                severity: errorType.severity,
                generatedAt: new Date().toISOString()
            },
            description: errorType.description,
            detectionPatterns: errorType.patterns.map(p => p.source),
            examples: errorType.examples,
            solutions: errorType.solutions,
            prevention: errorType.prevention,
            testingApproach: this.getTestingApproach(errorType.id),
            tools: this.getRecommendedTools(errorType.id)
        };

        const fileName = `${errorType.id}-guidance.json`;
        const filePath = path.join(this.guidanceDir, fileName);
        fs.writeFileSync(filePath, JSON.stringify(guidance, null, 2));

        // Also create markdown version
        const markdownGuidance = this.createMarkdownGuidance(guidance);
        const markdownPath = path.join(this.guidanceDir, `${errorType.id}-guidance.md`);
        fs.writeFileSync(markdownPath, markdownGuidance);

        console.log(`   ✅ Generated guidance for: ${errorType.name}`);
    }

    createMarkdownGuidance(guidance) {
        return `# ${guidance.metadata.name} Guidance

**Severity:** ${guidance.metadata.severity}
**ID:** ${guidance.metadata.id}

## Description

${guidance.description}

## Detection Patterns

${guidance.detectionPatterns.map(pattern => `- \`${pattern}\``).join('\n')}

## Examples

### Vulnerable Code
\`\`\`
${guidance.examples.vulnerable}
\`\`\`

### Secure Code
\`\`\`
${guidance.examples.secure}
\`\`\`

## Solutions

${guidance.solutions.map((solution, index) => 
    `${index + 1}. ${solution}`
).join('\n')}

## Prevention

${guidance.prevention.map((prevention, index) => 
    `${index + 1}. ${prevention}`
).join('\n')}

## Testing Approach

${guidance.testingApproach}

## Recommended Tools

${guidance.tools.map(tool => `- **${tool.name}**: ${tool.description}`).join('\n')}
`;
    }

    getEvalExamples() {
        return {
            vulnerable: `// Dangerous
const userInput = getUserInput();
const result = eval(userInput);

// JSON parsing
const data = eval('(' + jsonString + ')');

// Mathematical expression
const result = eval('2 + 2');`,
            secure: `// Safe JSON parsing
const data = JSON.parse(jsonString);

// Safe mathematical evaluation
import { parse } from 'expr-eval';
const result = parse('2 + 2').evaluate();

// Avoid dynamic code execution
const functions = { add: (a, b) => a + b };
const result = functions[userInput](a, b);`
        };
    }

    getEvalSolutions() {
        return [
            'Replace eval() with JSON.parse() for JSON parsing',
            'Use dedicated expression parser libraries for mathematical expressions',
            'Implement function whitelisting for dynamic function calls',
            'Use template literals or string interpolation instead of eval',
            'Consider using Web Workers for isolated code execution'
        ];
    }

    getEvalPrevention() {
        return [
            'Never use eval() with user input',
            'Enable linter rules to detect eval() usage',
            'Implement code review checks for eval() patterns',
            'Use static analysis tools in CI/CD pipeline',
            'Educate developers on eval() dangers'
        ];
    }

    getCommandInjectionExamples() {
        return {
            vulnerable: `# Python - Dangerous
import subprocess
user_input = getUserInput()
subprocess.call(user_input, shell=True)

os.system(user_input)`,
            secure: `# Python - Safe
import subprocess
user_input = getUserInput()
subprocess.run(['ls', user_input], shell=False)

# Validate input
if not re.match(r'^[a-zA-Z0-9_]+$', user_input):
    raise ValueError('Invalid input')`
        };
    }

    getCommandInjectionSolutions() {
        return [
            'Never use shell=True in subprocess calls',
            'Use list arguments instead of string commands',
            'Validate and sanitize all user inputs',
            'Use whitelist-based input validation',
            'Implement proper error handling'
        ];
    }

    getCommandInjectionPrevention() {
        return [
            'Disable shell execution when possible',
            'Use principle of least privilege',
            'Implement input validation frameworks',
            'Use parameterized APIs',
            'Regular security audits'
        ];
    }

    getXSSExamples() {
        return {
            vulnerable: `// Dangerous
element.innerHTML = userInput;
document.write(userInput);

// React
<div dangerouslySetInnerHTML={{ __html: userInput }} />`,
            secure: `// Safe
element.textContent = userInput;
element.innerText = userInput;

// React
<div>{userInput}</div>

// Sanitization
import DOMPurify from 'dompurify';
element.innerHTML = DOMPurify.sanitize(userInput);`
        };
    }

    getXSSSolutions() {
        return [
            'Use textContent instead of innerHTML',
            'Implement content security policy (CSP)',
            'Use HTML sanitization libraries',
            'Encode user input before rendering',
            'Validate and sanitize on both client and server'
        ];
    }

    getXSSPrevention() {
        return [
            'Implement Content Security Policy headers',
            'Use HTTP-only and Secure cookies',
            'Enable XSS protection in frameworks',
            'Regular security testing',
            'Input validation and output encoding'
        ];
    }

    getSQLInjectionExamples() {
        return {
            vulnerable: `# Python - Dangerous
cursor.execute("SELECT * FROM users WHERE name = '" + user_input + "'")

cursor.execute("SELECT * FROM users WHERE id = %s" % user_input)`,
            secure: `# Python - Safe
cursor.execute("SELECT * FROM users WHERE name = %s", (user_input,))

# Using ORM
User.objects.filter(name=user_input)`
        };
    }

    getSQLInjectionSolutions() {
        return [
            'Always use parameterized queries',
            'Use ORM frameworks when possible',
            'Implement input validation',
            'Use stored procedures',
            'Apply principle of least privilege to database users'
        ];
    }

    getSQLInjectionPrevention() {
        return [
            'Enable SQL query logging and monitoring',
            'Use database security scanning tools',
            'Implement database access controls',
            'Regular security assessments',
            'Developer training on secure database access'
        ];
    }

    getPathTraversalExamples() {
        return {
            vulnerable: `# Python - Dangerous
filename = getUserInput()
with open('/var/www/' + filename, 'r') as f:
    content = f.read()`,
            secure: `# Python - Safe
import os
filename = getUserInput()
safe_path = os.path.join('/var/www', os.path.basename(filename))
if not safe_path.startswith('/var/www/'):
    raise ValueError('Invalid path')
with open(safe_path, 'r') as f:
    content = f.read()`
        };
    }

    getPathTraversalSolutions() {
        return [
            'Use os.path.basename() to extract filename',
            'Validate paths against allowed directories',
            'Use chroot or containerization',
            'Implement file access controls',
            'Use file access libraries with built-in security'
        ];
    }

    getPathTraversalPrevention() {
        return [
            'Never concatenate user input with file paths',
            'Implement strict path validation',
            'Use filesystem sandboxing',
            'Regular security testing',
            'Monitor file access patterns'
        ];
    }

    getInsecureDeserializationExamples() {
        return {
            vulnerable: `# Python - Dangerous
import pickle
data = pickle.loads(user_input)

# JavaScript - Potentially dangerous
const data = JSON.parse(user_input);`,
            secure: `# Python - Safe
import json
data = json.loads(user_input)

# Use safe formats
import yaml
data = yaml.safe_load(user_input)`
        };
    }

    getInsecureDeserializationSolutions() {
        return [
            'Avoid pickle for untrusted data',
            'Use JSON or other safe serialization formats',
            'Implement integrity checks (HMAC)',
            'Use type-safe deserialization',
            'Validate deserialized objects'
        ];
    }

    getInsecureDeserializationPrevention() {
        return [
            'Never deserialize untrusted data',
            'Use digital signatures',
            'Implement object validation',
            'Use safe serialization formats',
            'Regular security testing'
        ];
    }

    getTestingApproach(errorTypeId) {
        const approaches = {
            eval_usage: 'Unit tests with malicious input payloads, fuzz testing with random strings, integration tests for JSON parsing',
            command_injection: 'Security penetration testing, command injection test suites, subprocess mocking in unit tests',
            xss_vulnerability: 'XSS scanning tools (OWASP ZAP), browser security testing, content security policy testing',
            sql_injection: 'SQL injection test suites, database query monitoring, ORM security testing',
            path_traversal: 'File access testing, path validation unit tests, filesystem sandbox testing',
            insecure_deserialization: 'Deserialization fuzzing, object validation testing, integrity check testing'
        };
        return approaches[errorTypeId] || 'Security-focused testing approach';
    }

    getRecommendedTools(errorTypeId) {
        const tools = {
            eval_usage: [
                { name: 'ESLint', description: 'JavaScript linter with security rules' },
                { name: 'SonarQube', description: 'Code quality and security analysis' },
                { name: 'Semgrep', description: 'Static analysis for security patterns' }
            ],
            command_injection: [
                { name: 'Bandit', description: 'Python security linter' },
                { name: 'Semgrep', description: 'Static analysis for security patterns' },
                { name: 'OWASP Dependency-Check', description: 'Dependency vulnerability scanner' }
            ],
            xss_vulnerability: [
                { name: 'DOMPurify', description: 'HTML sanitization library' },
                { name: 'OWASP ZAP', description: 'Security testing tool' },
                { name: 'Content Security Policy Builder', description: 'CSP generation tool' }
            ],
            sql_injection: [
                { name: 'SQLMap', description: 'SQL injection testing tool' },
                { name: 'ORM Security Scanners', description: 'Framework-specific tools' },
                { name: 'Database Activity Monitoring', description: 'Runtime monitoring' }
            ],
            path_traversal: [
                { name: 'Path Sanitization Libraries', description: 'Language-specific libraries' },
                { name: 'File Access Auditing Tools', description: 'Filesystem monitoring' },
                { name: 'Static Analysis Tools', description: 'Code pattern detection' }
            ],
            insecure_deserialization: [
                { name: 'Serialization Libraries', description: 'Safe serialization frameworks' },
                { name: 'Fuzzing Tools', description: 'Input fuzzing for deserialization' },
                { name: 'Object Validation Frameworks', description: 'Type-safe deserialization' }
            ]
        };
        return tools[errorTypeId] || [];
    }

    generateMasterGuidance(errorTypes) {
        const masterGuidance = {
            generatedAt: new Date().toISOString(),
            errorTypes: errorTypes.map(type => ({
                id: type.id,
                name: type.name,
                severity: type.severity,
                description: type.description
            })),
            prioritization: this.prioritizeErrorTypes(errorTypes),
            remediationPlan: this.createRemediationPlan(errorTypes),
            resources: this.getResources()
        };

        const masterPath = path.join(this.guidanceDir, 'master-guidance.json');
        fs.writeFileSync(masterPath, JSON.stringify(masterGuidance, null, 2));

        const markdownMaster = this.createMarkdownMasterGuidance(masterGuidance);
        const markdownPath = path.join(this.guidanceDir, 'master-guidance.md');
        fs.writeFileSync(markdownPath, markdownMaster);

        console.log('   ✅ Generated master guidance document');
    }

    prioritizeErrorTypes(errorTypes) {
        return errorTypes
            .sort((a, b) => {
                const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                return severityOrder[a.severity] - severityOrder[b.severity];
            })
            .map((type, index) => ({
                rank: index + 1,
                ...type
            }));
    }

    createRemediationPlan(errorTypes) {
        const critical = errorTypes.filter(t => t.severity === 'critical');
        const high = errorTypes.filter(t => t.severity === 'high');
        
        return {
            immediate: critical.map(t => t.name),
            shortTerm: high.map(t => t.name),
            phases: [
                {
                    phase: 1,
                    duration: '1-2 weeks',
                    focus: 'Critical vulnerabilities',
                    actions: critical.map(t => `Address ${t.name}`)
                },
                {
                    phase: 2,
                    duration: '2-4 weeks',
                    focus: 'High severity issues',
                    actions: high.map(t => `Address ${t.name}`)
                },
                {
                    phase: 3,
                    duration: 'Ongoing',
                    focus: 'Prevention and monitoring',
                    actions: [
                        'Implement security testing',
                        'Set up CI/CD security scanning',
                        'Developer training',
                        'Regular security audits'
                    ]
                }
            ]
        };
    }

    getResources() {
        return [
            { name: 'OWASP Top 10', url: 'https://owasp.org/www-project-top-ten/' },
            { name: 'CWE Top 25', url: 'https://cwe.mitre.org/top25/' },
            { name: 'Security Best Practices', url: 'https://cheatsheetseries.owasp.org/' },
            { name: 'SANS Security Resources', url: 'https://www.sans.org/' }
        ];
    }

    createMarkdownMasterGuidance(guidance) {
        return `# Master Security Guidance

**Generated:** ${guidance.generatedAt}

## Error Types Overview

| Rank | ID | Name | Severity |
|------|----|----|----------|
${guidance.prioritization.map(type => 
    `| ${type.rank} | ${type.id} | ${type.name} | ${type.severity} |`
).join('\n')}

## Remediation Plan

### Immediate Actions (Critical)
${guidance.remediationPlan.immediate.map(action => `- **${action}**: Address immediately`).join('\n')}

### Short-term Actions (High)
${guidance.remediationPlan.shortTerm.map(action => `- **${action}**: Address within 2-4 weeks`).join('\n')}

### Phased Approach

#### Phase 1: Critical Vulnerabilities (1-2 weeks)
${guidance.remediationPlan.phases[0].actions.map(action => `- ${action}`).join('\n')}

#### Phase 2: High Severity Issues (2-4 weeks)
${guidance.remediationPlan.phases[1].actions.map(action => `- ${action}`).join('\n')}

#### Phase 3: Prevention and Monitoring (Ongoing)
${guidance.remediationPlan.phases[2].actions.map(action => `- ${action}`).join('\n')}

## Resources

${guidance.resources.map(resource => 
    `- [${resource.name}](${resource.url})`
).join('\n')}

## Individual Guidance Documents

Detailed guidance for each error type is available in separate files:
${guidance.errorTypes.map(type => 
    `- [${type.name} guidance](${type.id}-guidance.md)`
).join('\n')}
`;
    }
}

// Main execution
const classifier = new ErrorTypeClassifier(process.cwd());
classifier.classifyAndGenerateGuidance();