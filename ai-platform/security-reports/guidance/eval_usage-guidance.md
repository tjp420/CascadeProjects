# eval() Usage Guidance

**Severity:** critical
**ID:** eval_usage

## Description

Use of eval() function which executes arbitrary code

## Detection Patterns

- `eval\s*\(`
- `new\s+Function\s*\(`

## Examples

### Vulnerable Code
```
// Dangerous
const userInput = getUserInput();
const result = eval(userInput);

// JSON parsing
const data = eval('(' + jsonString + ')');

// Mathematical expression
const result = eval('2 + 2');
```

### Secure Code
```
// Safe JSON parsing
const data = JSON.parse(jsonString);

// Safe mathematical evaluation
import { parse } from 'expr-eval';
const result = parse('2 + 2').evaluate();

// Avoid dynamic code execution
const functions = { add: (a, b) => a + b };
const result = functions[userInput](a, b);
```

## Solutions

1. Replace eval() with JSON.parse() for JSON parsing
2. Use dedicated expression parser libraries for mathematical expressions
3. Implement function whitelisting for dynamic function calls
4. Use template literals or string interpolation instead of eval
5. Consider using Web Workers for isolated code execution

## Prevention

1. Never use eval() with user input
2. Enable linter rules to detect eval() usage
3. Implement code review checks for eval() patterns
4. Use static analysis tools in CI/CD pipeline
5. Educate developers on eval() dangers

## Testing Approach

Unit tests with malicious input payloads, fuzz testing with random strings, integration tests for JSON parsing

## Recommended Tools

- **ESLint**: JavaScript linter with security rules
- **SonarQube**: Code quality and security analysis
- **Semgrep**: Static analysis for security patterns
