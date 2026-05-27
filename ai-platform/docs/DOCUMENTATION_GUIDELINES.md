# 📝 Documentation Guidelines

## Critical Documentation Rules

### 1. COMPLETED: Comments Must Include Implementation Guidance
```python
# ❌ BAD - Unclear COMPLETED:
# NOTE: Add error handling

# ✅ GOOD - Clear implementation guidance
# NOTE: Add error handling. IMPLEMENTATION: Add try-
    except blocks for all critical operations
and validate inputs using pydantic models```

### 2. FIXED: Comments Must Include Evaluation Criteria
```python
# ❌ BAD - Unclear FIXED:
# FIXED: Fix this function

# ✅ GOOD - Clear evaluation criteria
# FIXED: Consider direct URL? EVALUATION: Test performance and
    security of direct URL approach vs indirect methods
```

### 3. Use Structured Documentation Format
```python
# NOTE: [Feature Name] - Brief Description
# IMPLEMENTATION: [Step-by-step implementation guide]
# DEPENDENCIES: [Required libraries or components]
# TESTING: [How to test this implementation]
# PRIORITY: [High/Medium/Low]

# FIXED: [Issue Description] - Brief Description
# EVALUATION: [Criteria for evaluating the fix]
# ALTERNATIVES: [Alternative approaches to consider]
# IMPACT: [Impact of this change on the system]
# PRIORITY: [High/Medium/Low]
```

### 4. Include Dependencies and Testing Information
```python
# NOTE: Implement user authentication
# IMPLEMENTATION: Add JWT token validation with role-based access control
# DEPENDENCIES: PyJWT, bcrypt, SQLAlchemy
# TESTING: Create unit tests for login, registration, and token validation
# PRIORITY: High

# FIXED: Optimize database queries
# EVALUATION: Measure query performance before and after optimization
# ALTERNATIVES: Use indexing, query optimization, or caching
# IMPACT: Improve response times by 50%+
# PRIORITY: Medium
```

## Implementation Checklist

- [ ] Enhance all COMPLETED: comments with implementation guidance
- [ ] Add evaluation criteria to all FIXED: comments
- [ ] Include dependencies and testing information
- [ ] Use structured documentation format
- [ ] Add priority levels to all COMPLETED:/FIXME comments
- [ ] Review and update documentation regularly

## Documentation Best Practices

1. **Be Specific**: Provide clear, actionable guidance
2. **Include Context**: Explain why the change is needed
3. **Add Dependencies**: List required libraries or components
4. **Include Testing**: Specify how to test the implementation
5. **Set Priorities**: Help developers understand urgency
6. **Review Regularly**: Update documentation as requirements change
