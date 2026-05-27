# 🔧 Debug Statement Guidelines

## Critical Debug Rules

### 1. NEVER use print() in production code
```python
# ❌ BAD - Do not use in production
print("Debug info: " + str(data))
print("Processing step " + str(step))

# ✅ GOOD - Use proper logging
import logging
logging.debug("Debug info: %s", data)
logging.info("Processing step: %d", step)
```

### 2. Use appropriate logging levels
```python
import logging

# DEBUG: Detailed information for debugging
logging.debug("Variable x = %s", x)

# INFO: General information about program execution
logging.info("Processing %d files", file_count)

# WARNING: Something unexpected happened
logging.warning("File %s not found, using default", filename)

# ERROR: Serious problem occurred
logging.error("Failed to process file: %s", error)

# CRITICAL: Very serious error
logging.critical("System failure: %s", error)
```

### 3. Use structured logging
```python
# Good practice
logging.info(
"User action completed",
extra={
"user_id": user.id,
"action": action,
"timestamp": datetime.now().isoformat()
}
)

# With placeholders
logging.info("User %s performed %s at %s", user.id, action, timestamp)
```

## Implementation Checklist

- [ ] Replace all print() statements with logging
- [ ] Add logging configuration to all files
- [ ] Use appropriate logging levels
- [ ] Add structured logging where needed
- [ ] Remove sensitive information from logs
- [ ] Add log rotation for production

## Debug Best Practices

1. **Use logging levels appropriately**
2. **Never log sensitive data** (passwords, tokens, etc.)
3. **Use structured logging** for better analysis
4. **Add context** to log messages
5. **Configure log rotation** in production
6. **Monitor logs** for errors and warnings
