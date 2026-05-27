# Secure Coding Guidelines

## 🎯 Objective
Establish secure coding standards to prevent common vulnerabilities.

## 🔧 Python Security Guidelines

### Input Validation
```python
# GOOD: Validate input
import re

def validate_user_input(user_input):
    # Check for dangerous patterns
    dangerous_patterns = ['eval', 'exec', '__import__', 'subprocess']
    for pattern in dangerous_patterns:
        if pattern in user_input.lower():
            raise ValueError("Dangerous input detected")
    
    # Validate format
    if not re.match(r'^[a-zA-Z0-9_]+$', user_input):
        raise ValueError("Invalid input format")
    
    return user_input

# BAD: Direct use of input
user_input = input("Enter command: ")
eval(user_input)  # DANGEROUS!
```

### Safe Subprocess Usage
```python
# GOOD: Use subprocess.run with list arguments
import subprocess

def safe_command(filename):
    try:
        # Validate filename
        if not filename.endswith('.txt'):
            raise ValueError("Only .txt files allowed")
        
        result = subprocess.run(['cat', filename], 
                              capture_output=True, 
                              text=True, 
                              check=True)
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"Command failed: {e}")
        return None

# BAD: Shell=True with user input
user_input = input("Enter filename: ")
subprocess.call(f"cat {user_input}", shell=True)  # DANGEROUS!
```

### Secure Serialization
```python
# GOOD: Use JSON for serialization
import json

def serialize_data(data):
    return json.dumps(data)

def deserialize_data(json_data):
    try:
        return json.loads(json_data)
    except json.JSONDecodeError:
        raise ValueError("Invalid data format")

# BAD: Pickle with untrusted data
import pickle
user_data = pickle.loads(untrusted_data)  # DANGEROUS!
```

## 🔧 JavaScript Security Guidelines

### Safe DOM Manipulation
```javascript
// GOOD: Use textContent instead of innerHTML
element.textContent = userInput;

// BAD: Direct innerHTML assignment
element.innerHTML = userInput;  // DANGEROUS!
```

### Secure Event Handling
```javascript
// GOOD: Use addEventListener
button.addEventListener('click', handleClick);

// BAD: Inline event handlers
button.onclick = function() { eval(userInput); };  // DANGEROUS!
```

## 🛡️ General Security Principles

### 1. Principle of Least Privilege
- Give minimal necessary permissions
- Use role-based access control
- Implement proper authentication

### 2. Defense in Depth
- Multiple layers of security
- Don't rely on single security measure
- Implement monitoring and logging

### 3. Secure by Default
- Enable security features by default
- Require explicit action to disable
- Use secure configurations

### 4. Fail Securely
- Error handling should not expose information
- Default to secure state on failure
- Log security events

## 📝 Code Review Checklist

### Security Review Points
- [ ] Input validation implemented
- [ ] No eval() or exec() usage
- [ ] Safe subprocess handling
- [ ] Proper error handling
- [ ] No hardcoded secrets
- [ ] Secure data storage
- [ ] Authentication/authorization checks
- [ ] Logging and monitoring

### Testing Requirements
- [ ] Security unit tests
- [ ] Input validation tests
- [ ] Authentication tests
- [ ] Error handling tests
- [ ] Penetration tests

## 🚨 Common Mistakes to Avoid

1. **Trusting user input**
2. **Using eval() or exec()**
3. **Hardcoding secrets**
4. **Ignoring error handling**
5. **Skipping security testing**

## 📚 Additional Resources

- OWASP Secure Coding Practices
- NIST Security Guidelines
- Company Security Policies
- Security Team Documentation

## 🎯 Key Takeaways

1. **Always validate input**
2. **Never use eval/exec**
3. **Implement proper error handling**
4. **Use secure coding patterns**
5. **Test security thoroughly**
