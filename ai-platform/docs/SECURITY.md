# Security Policy

## Reporting Security Issues

Please report security vulnerabilities to security@simplebeacon.ai

## Security Features

### Authentication
- JWT tokens with refresh mechanism
- Password hashing with bcrypt
- Session management with Redis

### Authorization
- Role-based access control
- API route protection
- Vault authentication for sensitive operations

### Data Protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection via Helmet headers
- CSRF token validation

### Infrastructure
- HTTPS enforcement in production
- Rate limiting on all endpoints
- Docker security best practices
- Environment variable isolation

## Security Checklist

- [ ] All dependencies audited (`npm audit`)
- [ ] No secrets in code
- [ ] Input validation on all endpoints
- [ ] Proper error handling (no stack traces in production)
- [ ] CORS configured correctly
- [ ] Security headers enabled
