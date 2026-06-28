
[![CI Status](https://github.com/tjp420/simplebeacon/workflows/Simplebeacon%20AI%20Hygiene%20Gate/badge.svg)](https://github.com/tjp420/simplebeacon/actions)
[![Coverage](https://codecov.io/gh/tjp420/simplebeacon/branch/main/graph/badge.svg)](https://codecov.io/gh/tjp420/simplebeacon)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

🛡️ **Simplebeacon** is an AI safety scanning and audit platform designed for enterprise codebases, providing comprehensive security analysis, compliance checking, and quality assurance for AI-powered applications.

## 🚀 Features

### 🔍 AI Safety Scanning
- **Multi-Engine Analysis**: Credential detection, production leaks, fiction KPI patterns
- **EU AI Act Compliance**: Automated compliance checking for AI systems
- **LLM Content Analysis**: Detect AI-generated content, template text, and conversational debris
- **Security Audit**: Comprehensive security vulnerability scanning

### 📊 Dashboard & Analytics
- **Real-time Dashboard**: Interactive web interface for scan results
- **Audit Trails**: Complete audit logging and compliance reporting
- **Quality Metrics**: Code quality scores and trend analysis
- **Team Collaboration**: Multi-user support with role-based access

### 🔧 Developer Tools
- **CLI Integration**: Command-line tools for CI/CD pipelines
- **API-First Design**: RESTful APIs for integration with existing workflows
- **Docker Support**: Containerized deployment with Docker Compose
- **GitHub Actions**: Automated scanning and quality gates

### 🏢 Enterprise Features
- **Production Authentication**: JWT-based auth with refresh tokens
- **Database Integration**: PostgreSQL and Redis for scalable data storage
- **Audit Logging**: Comprehensive audit trails for compliance
- **Rate Limiting**: Built-in protection against API abuse

## 📦 Installation

### Prerequisites
- **Node.js**: >= 16.0.0
- **npm**: >= 8.0.0
- **Docker**: >= 20.0.0 (optional, for Phase 2 features)
- **PostgreSQL**: >= 13 (optional, for Phase 2 features)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/tjp420/simplebeacon.git
   cd simplebeacon/ai-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.v1-internal.example .env.v1-internal
   # Edit .env.v1-internal with your configuration
   ```

4. **Start the platform**
   ```bash
   npm run dev
   ```

5. **Access the dashboard**
   ```
   http://localhost:3002
   ```

### Docker Installation

1. **Start Phase 2 infrastructure**
   ```bash
   npm run phase2:infra
   ```

2. **Run with Docker**
   ```bash
   npm run simplebeacon:docker
   ```

## 🔧 Configuration

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Server Configuration
PORT=3002
NODE_ENV=development
REQUIRE_AUTH=true
SIMPLEBEACON_INTERNAL_DASHBOARD=true

# Authentication
JWT_SECRET=your-jwt-secret-key-32-characters-minimum
JWT_REFRESH_SECRET=your-jwt-refresh-secret-key-32-characters-min
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Database (Phase 2)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=simplebeacon
POSTGRES_USER=simplebeacon_user
POSTGRES_PASSWORD=your-postgres-password

# Redis (Phase 2)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Analysis Configuration
ANALYZE_ALLOWED_ROOTS=/path/to/your/projects
```

### v1-Internal Configuration

For production-like development:

```bash
# Copy the v1-internal template
cp .env.v1-internal.example .env.v1-internal

# Verify configuration
npm run verify:v1-internal-profile

# Start with v1-internal profile
npm run dashboard:v1-internal
```

## 📚 Usage

### CLI Scanning

```bash
# Basic scan
npm run simplebeacon

# Full scan with gate
npm run simplebeacon:full

# Compliance check
npm run compliance:check

# Security scan
npm run security:scan
```

### Dashboard Usage

1. **Navigate to the dashboard**: `http://localhost:3002`
2. **Sign in** with credentials:
   - Email: `dev@simplebeacon.ai`
   - Password: `dev-password`
3. **Configure project paths** in the Analyze section
4. **Run scans** and view results in real-time

### API Integration

```bash
# Get platform status
curl http://localhost:3002/api/platform/status

# Get user entitlements
curl http://localhost:3002/api/simplebeacon/entitlements

# Run a scan
curl -X POST http://localhost:3002/api/analyze/scan \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "/path/to/project", "profile": "eu-ai-act"}'
```

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration

# Run API tests
npm run test:api
```

### Verification

```bash
# Verify v1-internal configuration
npm run verify:v1-internal-profile

# Verify production readiness
npm run verify:production-deploy

# Run smoke tests
npm run smoke:test
```

## 🐳 Docker Deployment

### Phase 2 Infrastructure

```bash
# Start PostgreSQL and Redis
npm run phase2:infra

# Check services status
docker compose -f docker-compose.phase2.yml ps

# View logs
docker compose -f docker-compose.phase2.yml logs
```

### Production Deployment

```bash
# Build and run
npm run simplebeacon:docker:detached

# Scale services
docker compose -f docker-compose.simplebeacon.yml up -d --scale app=3
```

## 📊 Monitoring & Logging

### Health Checks

```bash
# Application health
curl http://localhost:3002/api/health

# Platform status
curl http://localhost:3002/api/platform/status

# Path health metrics
curl http://localhost:3002/api/metrics/path-health
```

### Audit Logs

Audit logs are stored in `logs/audit.log` and include:
- Authentication events
- API access patterns
- Security incidents
- System events

### Monitoring Dashboard

Access monitoring metrics at:
- **Health Checks**: `/api/health`
- **Platform Status**: `/api/platform/status`
- **Metrics**: `/api/metrics/path-health`

## 🔒 Security

### Authentication

Simplebeacon uses JWT-based authentication with:
- **Access Tokens**: 1-hour expiry
- **Refresh Tokens**: 7-day expiry
- **Vault Authentication**: Local development bypass
- **Rate Limiting**: 2000 requests per 15 minutes

### Security Features

- **Input Validation**: All inputs validated and sanitized
- **CORS Protection**: Configurable CORS policies
- **Security Headers**: Helmet.js middleware
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Content Security Policy

### Compliance

- **EU AI Act**: Automated compliance checking
- **SOC 2**: Audit logging and access controls
- **ISO 27001**: Security management framework
- **GDPR**: Data protection and privacy

## 🛠️ Development

### Project Structure

```
ai-platform/
├── server/                 # Express.js server
│   ├── index.cjs           # Main server entry point
│   ├── middleware/        # Authentication, security, audit
│   ├── lib/              # Utility libraries
│   ├── routes/           # API route handlers
│   └── services/         # Business logic services
├── src/                   # Source code
│   ├── api/              # API implementations
│   ├── lib/              # Core libraries
│   └── web/              # Frontend assets
├── web/simplebeacon-dashboard/ # React dashboard
├── tests/                 # Test suites
├── tools/                 # Build and utility scripts
└── docs/                  # Documentation
```

### Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make changes** and add tests
4. **Run tests**: `npm test`
5. **Run quality checks**: `npm run quality:check`
6. **Commit changes**: `git commit -m 'Add amazing feature'`
7. **Push to branch**: `git push origin feature/amazing-feature`
8. **Open a Pull Request**

### Code Quality

```bash
# Run linting
npm run lint

# Run security audit
npm audit

# Run Simplebeacon scan
npm run simplebeacon:hygiene-gate
```

## 📖 Documentation

- **[v1-Internal Runbook](docs/v1-internal-runbook.md)**: Production deployment guide
- **[API Documentation](docs/api/)**: REST API reference
- **[Security Guide](docs/security.md)**: Security best practices
- **[Troubleshooting](docs/troubleshooting.md)**: Common issues and solutions

## 🤝 Support

### Getting Help

- **GitHub Issues**: [Report bugs and request features](https://github.com/tjp420/simplebeacon/issues)
- **Documentation**: [Read the docs](docs/)
- **Community**: [Join discussions](https://github.com/tjp420/simplebeacon/discussions)

### Professional Support

For enterprise support and custom deployments:
- **Email**: support@simplebeacon.ai
- **Documentation**: [Enterprise Guide](docs/enterprise.md)
- **SLA**: [Service Level Agreement](docs/sla.md)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Simplebeacon Team**: Core development and maintenance
- **Contributors**: All the amazing people who contribute to this project
- **Open Source Community**: For the tools and libraries that make this possible

## 📈 Roadmap

### v1.0-Internal (Current)
- ✅ Production authentication system
- ✅ Phase 2 infrastructure (PostgreSQL, Redis)
- ✅ CI/CD pipeline with GitHub Actions
- ✅ Comprehensive audit logging
- ✅ Docker deployment support

### v1.1 (Planned)
- 🔄 Enhanced AI model integration
- 🔄 Advanced compliance reporting
- 🔄 Multi-tenant support
- 🔄 Performance optimizations

### v2.0 (Future)
- 📋 Cloud-native architecture
- 📋 Automated inference pipeline integration
- 📋 Advanced threat detection
- 📋 Global compliance frameworks

---

**Simplebeacon** - 🛡️ AI Safety for Enterprise Codebases

Built with ❤️ by the Simplebeacon Team
