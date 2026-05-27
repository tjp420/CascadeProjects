# 🛡️ Exception Handling Guidelines

## Critical Exception Rules

### 1. NEVER use bare except clauses
```python
# ❌ BAD - Bare except clause
try:
risky_operation()
except:
pass  # Silent failure

# ✅ GOOD - Specific exception handling
try:
risky_operation()
except ValueError as e:
logging.error(f"Value error occurred: {e}")
except TypeError as e:
logging.error(f"Type error occurred: {e}")
except Exception as e:
logging.error(f"Unexpected error: {e}")
```

### 2. Use specific exception types
```python
# Good practice with specific exceptions
try:
# File operations
with open(filename, 'r') as f:
content = f.read()
except FileNotFoundError:
logging.error(f"File not found: {filename}")
except PermissionError:
logging.error(f"Permission denied: {filename}")
except IOError as e:
logging.error(f"IO error: {e}")

# Network operations
try:
response = requests.get(url)
except requests.ConnectionError:
logging.error(f"Connection failed: {url}")
except requests.Timeout:
logging.error(f"Request timeout: {url}")
except requests.RequestException as e:
logging.error(f"Request error: {e}")
```

### 3. Handle exceptions appropriately
```python
# Good exception handling pattern
def process_data(data):
try:
# Validate input
if not data:
raise ValueError("Data cannot be empty")

# Process data
result = complex_operation(data)
return result

except ValueError as e:
logging.error(f"Validation error: {e}")
raise  # Re-raise for caller to handle
except ProcessingError as e:
logging.error(f"Processing error: {e}")
return None  # Return default value
except Exception as e:
logging.error(f"Unexpected error in process_data: {e}")
raise  # Re-raise critical errors
```

### 4. Use finally for cleanup
```python
# Good practice with finally
def process_file(filename):
file_handle = None
try:
file_handle = open(filename, 'r')
content = file_handle.read()
return content
except IOError as e:
logging.error(f"File error: {e}")
return None
finally:
if file_handle:
file_handle.close()  # Always close file
```

## Implementation Checklist

- [ ] Replace all bare except clauses with specific exceptions
- [ ] Add logging for all exception handling
- [ ] Use appropriate exception types
- [ ] Implement proper error recovery
- [ ] Add finally clauses for cleanup
- [ ] Document exception handling in functions

## Exception Best Practices

1. **Be specific** - Catch specific exceptions when possible
2. **Log everything** - Log all exceptions with context
3. **Re-raise when appropriate** - Let callers handle critical errors
4. **Use finally** - Ensure cleanup happens
5. **Document exceptions** - Document what exceptions functions can raise
6. **Create custom exceptions** - For domain-specific errors
