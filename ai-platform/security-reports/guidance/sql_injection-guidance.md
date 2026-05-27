# SQL Injection Guidance

**Severity:** critical
**ID:** sql_injection

## Description

Injection of malicious SQL queries

## Detection Patterns

- `execute\s*\(\s*["'].*?\%s`
- `query\s*\(\s*["'].*?\+`

## Examples

### Vulnerable Code
```
# Python - Dangerous
cursor.execute("SELECT * FROM users WHERE name = '" + user_input + "'")

cursor.execute("SELECT * FROM users WHERE id = %s" % user_input)
```

### Secure Code
```
# Python - Safe
cursor.execute("SELECT * FROM users WHERE name = %s", (user_input,))

# Using ORM
User.objects.filter(name=user_input)
```

## Solutions

1. Always use parameterized queries
2. Use ORM frameworks when possible
3. Implement input validation
4. Use stored procedures
5. Apply principle of least privilege to database users

## Prevention

1. Enable SQL query logging and monitoring
2. Use database security scanning tools
3. Implement database access controls
4. Regular security assessments
5. Developer training on secure database access

## Testing Approach

SQL injection test suites, database query monitoring, ORM security testing

## Recommended Tools

- **SQLMap**: SQL injection testing tool
- **ORM Security Scanners**: Framework-specific tools
- **Database Activity Monitoring**: Runtime monitoring
