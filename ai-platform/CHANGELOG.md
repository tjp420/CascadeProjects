# Changelog

All notable changes to the Simplebeacon Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Comprehensive test suite with integration tests
- Complete API documentation
- Production deployment readiness verification
- Enhanced security configuration
- Docker Phase 2 infrastructure

### Changed

- Improved Jest configuration with realistic coverage thresholds
- Enhanced error handling and logging
- Updated authentication middleware

### Fixed

- Module loading issues in test environment
- Environment variable validation
- Path safety validation improvements

## [3.1.0] - 2026-08-03

### Added

- **JCS Canonicalization**: Implemented RFC 8785 JSON Canonicalization (JCS) canonicalizer to generate deterministic JSON digests used for PoRep verification and upload commit signature validation. (See: ai-platform/server/lib/canonical/jcs.cjs)
- **Distributed Request Tracing**: Added Track112 request tracing propagation through HTTP middleware, ingest queue envelopes, and worker pool logs to correlate background work with incoming requests.
- **Disk-backed UploadManager**: Introduced a durable, disk-backed `UploadManager` for multipart uploads with chunking, root computation, and commit verification.

### Changed

- **Purger & Forensics**: Added a background `Purger` that scans and purges expired uncommitted upload sessions; purger now falls back to directory mtime when metadata is missing. Forensic sparse events are recorded to `.simplebeacon/forensic-events.log`.
- **Verification Hardening**: PoRep verifier now uses canonical digests for root comparisons and emits sparse forensic events on verification failures (low-cardinality telemetry).

### Fixed

- Corrected module resolution issues for the forensic events adapter and hardened purger TTL handling (accepts `ttlHours=0` for immediate evaluation).

### Notes

- PR: https://github.com/tjp420/CascadeProjects/pull/402 — **feat/v3.1.0-upload-cleanup**
- Full parallel test sweep: **103/103** passing suites (90.8s)

## [1.0.0-internal] - 2026-06-03

### Added

- **Production Authentication System**
  - JWT-based authentication with access and refresh tokens
  - Vault authentication for local development
  - Rate limiting and security headers
  - Session management with database backing

- **Phase 2 Infrastructure**
  - PostgreSQL 15 with connection pooling
  - Redis 7 with password protection
  - Docker Compose configuration
  - Database schema with audit trails
  - Health checks and monitoring

- **CI/CD Pipeline**
  - GitHub Actions workflow with 6 job types
  - Automated security scanning
  - Test coverage reporting with Istanbul
  - Production deployment verification

- **Documentation**
  - Complete v1-internal runbook (2,500+ lines)
  - API documentation with examples
  - Production deployment guide
  - Troubleshooting procedures

- **Testing Infrastructure**
  - Integration test framework
  - Authentication flow testing
  - Server integration tests
  - Path safety validation tests
  - Logger integration tests

- **Security Features**
  - Comprehensive audit logging
  - Input validation and sanitization
  - CORS configuration
  - SQL injection protection
  - XSS protection with CSP

- **Developer Tools**
  - Production deploy readiness checker
  - Environment configuration verifier
  - Automated quality gates
  - Performance monitoring

### Changed

- **Authentication Flow**: Moved from optional to required authentication in production
- **Database Architecture**: Added Phase 2 database support with audit trails
- **Testing Strategy**: Implemented comprehensive integration testing
- **Security Posture**: Enhanced with multiple security layers

### Security

- Added JWT token rotation and refresh mechanism
- Implemented comprehensive audit logging system
- Added rate limiting to prevent API abuse
- Enhanced input validation and sanitization
- Added security headers with Helmet.js

### Performance

- Optimized database connection pooling
- Added Redis caching layer
- Implemented health check endpoints
- Added performance monitoring metrics
- Optimized logging for production use

## [0.9.0] - 2026-05-31

### Added

- Basic dashboard functionality
- Simplebeacon CLI integration
- Initial API endpoints
- Development environment setup

### Changed

- Updated project structure for better organization
- Improved error handling
- Enhanced logging configuration

## [0.8.0] - 2026-05-15

### Added

- Simplebeacon scanner integration
- Basic authentication framework
- API interface implementations
- Initial test framework

### Fixed

- Environment variable loading issues
- Basic security vulnerabilities

## [0.7.0] - 2026-05-01

### Added

- Express.js server setup
- Basic middleware configuration
- Initial API structure
- Development tools

### Changed

- Migrated from prototype to production architecture
- Improved project organization

## [0.6.0] - 2026-04-15

### Added

- Initial project structure
- Basic package configuration
- Development environment setup

### Changed

- Restructured for monorepo architecture
- Added workspace configuration

## [0.5.0] - 2026-04-01

### Added

- Proof of concept implementation
- Basic scanning functionality
- Simple web interface

### Changed

- Moved from experimental to development phase

## [0.4.0] - 2026-03-15

### Added

- Core scanning engine
- Basic rule implementations
- Simple CLI interface

### Fixed

- Critical scanning bugs
- Performance improvements

## [0.3.0] - 2026-03-01

### Added

- Initial Simplebeacon CLI
- Basic rule engine
- Configuration system

### Changed

- Improved scanning accuracy
- Enhanced rule definitions

## [0.2.0] - 2026-02-15

### Added

- Basic scanning capabilities
- Rule framework
- Configuration files

### Fixed

- Major stability issues
- Memory leaks

## [0.1.0] - 2026-02-01

### Added

- Project initialization
- Basic structure
- Initial concept implementation

---

## Version History

### Major Milestones

- **v1.0.0-internal**: Production-ready platform with full authentication and infrastructure
- **v0.9.0**: Beta release with dashboard and API
- **v0.5.0**: Alpha release with core functionality
- **v0.1.0**: Initial concept and prototype

### Breaking Changes

- **v1.0.0**: Authentication now required for production deployment
- **v0.9.0**: Database schema changes for Phase 2 features
- **v0.5.0**: API endpoint restructuring
- **v0.2.0**: Configuration file format changes

### Security Updates

- **v1.0.0**: Added comprehensive authentication and audit logging
- **v0.9.0**: Enhanced input validation and sanitization
- **v0.7.0**: Added rate limiting and security headers
- **v0.5.0**: Fixed XSS and SQL injection vulnerabilities

### Performance Improvements

- **v1.0.0**: Added database connection pooling and Redis caching
- **v0.9.0**: Optimized scanning performance
- **v0.7.0**: Improved memory usage
- **v0.5.0**: Enhanced scanning speed

### API Changes

#### v1.0.0

- Added authentication middleware to all endpoints
- Enhanced error responses with request IDs
- Added rate limiting headers
- Improved documentation

#### v0.9.0

- Added `/api/platform/status` endpoint
- Enhanced `/api/simplebeacon/report` with more metadata
- Added `/api/analyze/compliance-checklist` endpoint
- Improved error handling

#### v0.7.0

- Added `/api/auth/login` and `/api/auth/refresh` endpoints
- Added `/api/simplebeacon/user/ai-keys` endpoint
- Enhanced `/api/health` with more metrics
- Added CORS support

### Database Changes

#### v1.0.0

- Added Phase 2 database schema
- Created audit logging tables
- Added user session management
- Added API key management

#### v0.9.0

- Enhanced scan result storage
- Added metadata to scan reports
- Improved indexing for performance

### Configuration Changes

#### v1.0.0

- Added `REQUIRE_AUTH` environment variable
- Added JWT secret configuration
- Added database connection settings
- Added Redis configuration

#### v0.9.0

- Enhanced CORS configuration
- Added rate limiting settings
- Improved security header configuration

### Dependencies

#### Major Dependencies Added

- `jsonwebtoken`: JWT authentication
- `bcryptjs`: Password hashing
- `helmet`: Security headers
- `express-rate-limit`: Rate limiting
- `pg`: PostgreSQL client
- `redis`: Redis client

#### Dependencies Updated

- `express`: Updated to latest stable version
- `jest`: Updated for enhanced test coverage
- `nodemon`: Updated for development experience

### Development Tools

#### v1.0.0

- Added production deploy readiness checker
- Added environment configuration verifier
- Enhanced test framework
- Added comprehensive documentation

#### v0.9.0

- Added integration test suite
- Enhanced development scripts
- Improved error reporting
- Added performance monitoring

---

## Upgrade Guide

### From v0.9.x to v1.0.0

1. **Environment Variables**: Add `REQUIRE_AUTH=true` and JWT secrets
2. **Database**: Run Phase 2 migration scripts
3. **Authentication**: Update client code to handle JWT tokens
4. **Docker**: Update to new Docker Compose configuration

### From v0.8.x to v0.9.0

1. **Dependencies**: Update to latest package versions
2. **API**: Update API endpoints for new authentication
3. **Tests**: Run new test suite
4. **Documentation**: Review updated API documentation

### From v0.7.x to v0.8.x

1. **Configuration**: Update environment variables
2. **Dependencies**: Install new packages
3. **Database**: Run migration scripts
4. **Tests**: Update test configurations

---

## Support

### Getting Help

- **Documentation**: Check the [v1-internal runbook](docs/v1-internal-runbook.md)
- **API Reference**: See [API documentation](docs/api/README.md)
- **Issues**: [GitHub Issues](https://github.com/tjp420/simplebeacon/issues)
- **Support**: support@simplebeacon.ai

### Reporting Bugs

When reporting bugs, please include:

- Version number
- Environment details
- Steps to reproduce
- Expected vs actual behavior
- Error logs and screenshots

### Feature Requests

Feature requests are welcome! Please:

- Check existing issues first
- Provide clear description
- Include use case and benefits
- Consider implementation complexity

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Simplebeacon Platform** - 🛡️ AI Safety for Enterprise Codebases

Built with ❤️ by the Simplebeacon Team
