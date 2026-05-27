# 🔒 Security Guidelines for Code Execution

## Critical Security Rules

### 1. NEVER use eval() with user input
# ❌ DANGEROUS - Do not use
result = eval(user_input)

# ✅ SAFE - Use ast.literal_eval for literals
import ast
result = ast.literal_eval(user_input)

### 2. NEVER use exec() with user code
# ❌ DANGEROUS - Do not use
exec(user_code)

# ✅ SAFE - Use restricted execution
def safe_exec(code_string, restricted_globals=None):
safe_globals = {'__builtins__': {'print': print, 'len': len, 'str': str}}
exec(code_string, safe_globals)

### 3. Input Validation
import re

def validate_input(input_data):
dangerous_patterns = [
r'import\\s+os',
r'__import__',
r'__builtins__',
r'eval\\s*\\(',
r'exec\\s*\\(',
r'open\\s*\\(',
r'file\\s*\\(',
]

for pattern in dangerous_patterns:
if re.search(pattern, input_data, re.IGNORECASE):
return False
return True

## Implementation Checklist

- [ ] Replace all eval() calls with ast.literal_eval()
- [ ] Replace all exec() calls with safe_exec()
- [ ] Add input validation for all user inputs
- [ ] Implement logging for security events
- [ ] Use code reviews for security issues
- [ ] Add unit tests for security functions

## Security Best Practices

1. **Principle of Least Privilege**: Only expose necessary functions
2. **Input Validation**: Always validate and sanitize user input
3. **Logging**: Log all security-relevant events
4. **Code Review**: Regular security code reviews
5. **Testing**: Include security tests in CI/CD pipeline
