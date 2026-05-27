# Insecure Deserialization Guidance

**Severity:** high
**ID:** insecure_deserialization

## Description

Untrusted data deserialization leading to code execution

## Detection Patterns

- `pickle\.loads`
- `unpickle`
- `JSON\.parse`

## Examples

### Vulnerable Code
```
# Python - Dangerous
import pickle
data = pickle.loads(user_input)

# JavaScript - Potentially dangerous
const data = JSON.parse(user_input);
```

### Secure Code
```
# Python - Safe
import json
data = json.loads(user_input)

# Use safe formats
import yaml
data = yaml.safe_load(user_input)
```

## Solutions

1. Avoid pickle for untrusted data
2. Use JSON or other safe serialization formats
3. Implement integrity checks (HMAC)
4. Use type-safe deserialization
5. Validate deserialized objects

## Prevention

1. Never deserialize untrusted data
2. Use digital signatures
3. Implement object validation
4. Use safe serialization formats
5. Regular security testing

## Testing Approach

Deserialization fuzzing, object validation testing, integrity check testing

## Recommended Tools

- **Serialization Libraries**: Safe serialization frameworks
- **Fuzzing Tools**: Input fuzzing for deserialization
- **Object Validation Frameworks**: Type-safe deserialization
