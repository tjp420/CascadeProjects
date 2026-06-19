# v1-Internal Runbook

This runbook covers the deployment and operation of the Simplebeacon v1-internal platform with production-grade authentication and infrastructure.

## Overview

v1-internal is the production-ready version of the Simplebeacon platform with:
- **Required Authentication**: `REQUIRE_AUTH=true`
- **Phase 2 Infrastructure**: PostgreSQL + Redis
- **Production Security**: JWT tokens, rate limiting, audit logging
- **CI/CD Pipeline**: GitHub Actions with testing and deployment

## Prerequisites

### Environment Setup
1. **Node.js**: >=16.0.0
2. **Docker & Docker Compose**: For Phase 2 infrastructure
3. **PostgreSQL Client**: For database management
4. **Redis CLI**: For cache management

### Configuration Files
- `.env.v1-internal` - Production environment configuration
- `docker-compose.phase2.yml` - Phase 2 infrastructure
- `docs/v1-internal-runbook.md` - This documentation

## Quick Start

### 1. Environment Configuration
```bash
# Copy the example configuration
cp .env.v1-internal.example .env.v1-internal

# Edit the configuration with your values
# Update JWT secrets, database passwords, and Stripe keys
```

### 2. Start Phase 2 Infrastructure
```bash
# Start PostgreSQL and Redis
npm run phase2:infra

# Verify services are running
docker ps
```

### 3. Start the Platform
```bash
# Start with v1-internal profile
npm run dashboard:v1-internal

# Or start with specific environment
REQUIRE_AUTH=true npm run dev
```

### 4. Verify Deployment
```bash
# Run verification suite
npm run verify:v1-internal-profile

# Run smoke tests
npm run smoke:test
```

## Authentication Setup

### JWT Configuration
The platform uses JWT tokens for authentication with refresh token support:

```javascript
// Token Configuration
JWT_SECRET=your-production-jwt-secret-key-minimum-32-characters
JWT_REFRESH_SECRET=your-production-jwt-refresh-secret-key-minimum-32-characters
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
```

### User Management
For v1-internal, demo users are seeded automatically:

```bash
# Demo Users (SEED_DEMO_USERS=true)
dev@simplebeacon.ai / demo123
admin@simplebeacon.ai / admin123
test@simplebeacon.ai / test123
```

### Authentication Flow
1. **Login**: `POST /api/auth/login` with email/password
2. **Access Token**: JWT token returned (1 hour expiry)
3. **Refresh Token**: Use refresh token to get new access token
4. **Protected Routes**: All API endpoints require valid JWT

## Phase 2 Infrastructure

### Database Setup
```bash
# Initialize database
npm run phase2:infra

# Run migrations (if applicable)
npm run db:migrate

# Seed data
npm run db:seed
```

### Redis Setup
```bash
# Start Redis service
docker compose -f docker-compose.phase2.yml up redis -d

# Verify Redis connection
redis-cli -h localhost -p 6379 ping
```

### Service Health Checks
```bash
# Check database connection
curl http://localhost:3002/api/health

# Check Redis status
curl http://localhost:3002/api/platform/status
```

## Security Configuration

### Required Security Headers
- **Helmet**: Security headers enabled
- **CORS**: Configured for localhost:3002
- **Rate Limiting**: 2000 requests per 15 minutes
- **Audit Logging**: All API calls logged

### Environment Security
```bash
# Production secrets must be configured when REQUIRE_AUTH=true
JWT_SECRET=must-be-set
JWT_REFRESH_SECRET=must-be-set
POSTGRES_PASSWORD=must-be-set
REDIS_PASSWORD=must-be-set
```

## Testing and Verification

### Unit Tests
```bash
# Run all tests with coverage
npm run test:coverage

# Run critical path tests
npm run test:coverage:critical-path

# Verify coverage thresholds
npm run verify:critical-path-coverage
```

### Integration Tests
```bash
# Run API integration tests
npm run test:api

# Run authentication tests
npm run test:auth

# Run full integration suite
npm run test:integration
```

### Smoke Tests
```bash
# Run smoke test suite
npm run smoke:test

# Run production smoke tests
npm run smoke:test:production
```

## Deployment Checklist

### Deploy Gates (Mandatory)
The deploy script enforces three gates before any production deployment:

1. **Production Readiness Gate**: `npm run verify:production-deploy`
   - Validates environment variables, security config, database, infrastructure
   - Fails the deploy if any critical check does not pass

2. **v1-Internal Profile Gate**: `npm run verify:v1-internal-profile`
   - Confirms `.env.v1-internal` exists and contains valid values
   - Checks JWT secret length, auth configuration, Phase 2 readiness

3. **Smoke Test Gate**: `npm run smoke:test:production`
   - Runs route smoke tests against the production profile
   - Warnings are interactive (requires confirmation to proceed)

### Pre-deployment Checks
- [ ] Environment variables configured in `.env.v1-internal`
- [ ] JWT secrets are strong (32+ characters)
- [ ] Database and Redis passwords are secure
- [ ] SSL certificates configured (if using HTTPS)
- [ ] CORS origins properly set
- [ ] Rate limits configured appropriately

### Health Verification
- [ ] `npm run verify:v1-internal-profile` passes
- [ ] `npm run verify:production-deploy` passes
- [ ] `npm run smoke:test:production` passes
- [ ] Database connectivity confirmed
- [ ] Redis connectivity confirmed
- [ ] Authentication flows working
- [ ] All API endpoints responding

### Post-deployment Monitoring
- [ ] Application logs monitored
- [ ] Database performance monitored
- [ ] Redis performance monitored
- [ ] API response times monitored
- [ ] Error rates tracked
- [ ] Security events logged

## Troubleshooting

### Common Issues

#### Authentication Failures
```bash
# Check JWT configuration
curl http://localhost:3002/api/platform/status | jq .authRequired

# Verify JWT secrets are set
env | grep JWT

# Check auth logs
tail -f logs/audit.log | grep auth
```

#### Database Connection Issues
```bash
# Check database status
docker compose -f docker-compose.phase2.yml ps postgres

# Test database connection
npm run verify:production-host-readiness

# Check database logs
docker compose -f docker-compose.phase2.yml logs postgres
```

#### Redis Connection Issues
```bash
# Check Redis status
docker compose -f docker-compose.phase2.yml ps redis

# Test Redis connection
redis-cli -h localhost -p 6379 ping

# Check Redis logs
docker compose -f docker-compose.phase2.yml logs redis
```

#### Service Startup Issues
```bash
# Check all services
docker compose -f docker-compose.phase2.yml ps

# Restart services
npm run phase2:infra:down
npm run phase2:infra

# Check application logs
npm run dashboard:v1-internal
```

### Performance Issues

#### Slow API Response
```bash
# Check database performance
docker stats

# Monitor Redis performance
redis-cli --latency-history

# Check application metrics
curl http://localhost:3002/api/metrics/path-health
```

#### Memory Issues
```bash
# Monitor memory usage
docker stats

# Check Node.js memory
node --max-old-space-size=4096 server/index.cjs

# Restart services if needed
npm run phase2:infra:down && npm run phase2:infra
```

## Maintenance

### Regular Tasks
- **Daily**: Monitor logs and error rates
- **Weekly**: Review security audit logs
- **Monthly**: Update dependencies and security patches
- **Quarterly**: Review and rotate secrets

### Backup Procedures
```bash
# Backup database
docker exec postgres_container pg_dump simplebeacon_v1_internal > backup.sql

# Backup Redis
docker exec redis_container redis-cli BGSAVE

# Backup configuration
cp .env.v1-internal .env.v1-internal.backup
```

### Log Management
```bash
# Rotate audit logs
logrotate -f /etc/logrotate.d/simplebeacon

# Clean old logs
find logs/ -name "*.log" -mtime +30 -delete

# Monitor disk space
df -h
```

## Emergency Procedures

### Security Incident
1. **Immediate**: Rotate all secrets and passwords
2. **Investigation**: Review audit logs for unauthorized access
3. **Containment**: Block suspicious IP addresses
4. **Recovery**: Restore from clean backup if needed

### Service Outage
1. **Diagnosis**: Check service status and logs
2. **Recovery**: Restart affected services
3. **Verification**: Run smoke tests
4. **Communication**: Notify stakeholders of resolution

### Data Corruption
1. **Stop Services**: Prevent further damage
2. **Assessment**: Determine extent of corruption
3. **Recovery**: Restore from recent backup
4. **Verification**: Validate data integrity

## Support and Escalation

### Internal Resources
- **Documentation**: `docs/` directory
- **Configuration Examples**: `.env.v1-internal.example`
- **Test Suites**: `tests/` directory
- **Health Checks**: `/api/health` endpoint

### External Resources
- **Node.js Documentation**: https://nodejs.org/docs/
- **PostgreSQL Documentation**: https://www.postgresql.org/docs/
- **Redis Documentation**: https://redis.io/documentation
- **Express.js Documentation**: https://expressjs.com/

---

**Version**: 1.0.0  
**Last Updated**: 2026-06-03  
**Maintainer**: Simplebeacon Platform Team
