# Command Injection Guidance

**Severity:** critical
**ID:** command_injection

## Description

Execution of system commands with user input

## Detection Patterns

- `subprocess\.(call|run|Popen)`
- `os\.system\s*\(`
- `exec\s*\(`

## Examples

### Vulnerable Code
```
# Python - Dangerous
import subprocess
user_input = getUserInput()
subprocess.call(user_input, shell=True)

os.system(user_input)
```

### Secure Code
```
# Python - Safe
import subprocess
user_input = getUserInput()
subprocess.run(['ls', user_input], shell=False)

# Validate input
if not re.match(r'^[a-zA-Z0-9_]+$', user_input):
    raise ValueError('Invalid input')
```

## Solutions

1. Never use shell=True in subprocess calls
2. Use list arguments instead of string commands
3. Validate and sanitize all user inputs
4. Use whitelist-based input validation
5. Implement proper error handling

## Prevention

1. Disable shell execution when possible
2. Use principle of least privilege
3. Implement input validation frameworks
4. Use parameterized APIs
5. Regular security audits

## Testing Approach

Security penetration testing, command injection test suites, subprocess mocking in unit tests

## Recommended Tools

- **Bandit**: Python security linter
- **Semgrep**: Static analysis for security patterns
- **OWASP Dependency-Check**: Dependency vulnerability scanner
