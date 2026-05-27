# Path Traversal Guidance

**Severity:** high
**ID:** path_traversal

## Description

Access to files outside intended directory

## Detection Patterns

- `\.\.\/|\.\.\\`

## Examples

### Vulnerable Code
```
# Python - Dangerous
filename = getUserInput()
with open('/var/www/' + filename, 'r') as f:
    content = f.read()
```

### Secure Code
```
# Python - Safe
import os
filename = getUserInput()
safe_path = os.path.join('/var/www', os.path.basename(filename))
if not safe_path.startswith('/var/www/'):
    raise ValueError('Invalid path')
with open(safe_path, 'r') as f:
    content = f.read()
```

## Solutions

1. Use os.path.basename() to extract filename
2. Validate paths against allowed directories
3. Use chroot or containerization
4. Implement file access controls
5. Use file access libraries with built-in security

## Prevention

1. Never concatenate user input with file paths
2. Implement strict path validation
3. Use filesystem sandboxing
4. Regular security testing
5. Monitor file access patterns

## Testing Approach

File access testing, path validation unit tests, filesystem sandbox testing

## Recommended Tools

- **Path Sanitization Libraries**: Language-specific libraries
- **File Access Auditing Tools**: Filesystem monitoring
- **Static Analysis Tools**: Code pattern detection
