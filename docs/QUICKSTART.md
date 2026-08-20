# SimpleBeacon Quickstart Guide

## Overview

SimpleBeacon is a comprehensive security scanning and vulnerability assessment platform built on Node.js and React. This quickstart guide provides essential steps to get started with the platform, including API integration examples and key documentation needs.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Running the Platform](#running-the-platform)
4. [API Quickstart](#api-quickstart)
5. [Basic Scanning Workflow](#basic-scanning-workflow)
6. [Documentation Checklist](#documentation-checklist)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Git**: v2.30.0 or higher
- **Docker** (optional): For containerized deployment
- **Redis** (optional): For caching and session management

### System Requirements

- **RAM**: Minimum 4GB; recommended 8GB+
- **Disk Space**: Minimum 2GB for dependencies and data
- **Network**: Internet connectivity for vulnerability database updates

---

## Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/tjp420/CascadeProjects.git
cd CascadeProjects
```

### Step 2: Install Dependencies

```bash
npm install
```

This installs all root-level dependencies. For monorepo packages:

```bash
npm ci
npm run bootstrap
```

### Step 3: Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# API Server
API_PORT=3001
API_HOST=localhost
NODE_ENV=development

# Database
DB_TYPE=sqlite
DB_PATH=./data/simplebeacon.db

# Authentication
JWT_SECRET=your_secret_key_here
JWT_EXPIRY=24h

# Scanning
MAX_WORKERS=4
SCAN_TIMEOUT=300000

# Redis (optional)
REDIS_URL=redis://localhost:6379
```

### Step 4: Initialize Database

```bash
npm run db:init
npm run db:migrate
```

---

## Running the Platform

### Development Mode

Start the full stack with hot-reload:

```bash
npm run dev
```

This launches:
- API server on `http://localhost:3001`
- Dashboard on `http://localhost:3000`
- Development tools with watch mode

### Production Build

```bash
npm run build
npm run start
```

### Individual Services

**Start API Server Only**:
```bash
npm run api:dev
```

**Start Dashboard Only**:
```bash
npm run dashboard:dev
```

**Start Local Analyzer**:
```bash
npm run analyzer:dev
```

### Docker Deployment

```bash
docker-compose -f docker-compose.yml up -d
```

For enterprise with GPU:
```bash
docker-compose -f docker-compose.enterprise.gpu.yml up -d
```

---

## API Quickstart

### Authentication

All API calls require authentication via JWT token. Obtain a token:

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your_password"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "role": "admin"
    }
  }
}
```

### Initialize a Scan

**Endpoint**: `POST /api/v1/scans`

```bash
curl -X POST http://localhost:3001/api/v1/scans \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First Scan",
    "targets": [
      {
        "type": "url",
        "value": "https://example.com"
      }
    ],
    "scanType": "full",
    "priority": "high"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "scanId": "scan_abc123",
    "status": "queued",
    "createdAt": "2026-08-19T21:27:04Z",
    "estimatedDuration": 300
  }
}
```

### Get Scan Results

**Endpoint**: `GET /api/v1/scans/{scanId}`

```bash
curl -X GET http://localhost:3001/api/v1/scans/scan_abc123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "success": true,
  "data": {
    "scanId": "scan_abc123",
    "status": "completed",
    "results": {
      "vulnerabilities": 42,
      "critical": 3,
      "high": 7,
      "medium": 18,
      "low": 14
    },
    "completedAt": "2026-08-19T21:32:14Z",
    "duration": 310000
  }
}
```

### List Recent Scans

**Endpoint**: `GET /api/v1/scans`

```bash
curl -X GET "http://localhost:3001/api/v1/scans?limit=10&offset=0" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Export Scan Report

**Endpoint**: `GET /api/v1/scans/{scanId}/export`

```bash
curl -X GET http://localhost:3001/api/v1/scans/scan_abc123/export?format=pdf \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o scan_report.pdf
```

---

## Basic Scanning Workflow

### Scenario: Security Audit of a Web Application

1. **Authenticate**
   ```bash
   TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"user@example.com","password":"password"}' | \
     jq -r '.data.token')
   ```

2. **Create a Scan Target**
   ```bash
   curl -X POST http://localhost:3001/api/v1/targets \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Production API",
       "url": "https://api.example.com",
       "tags": ["production", "critical"]
     }'
   ```

3. **Start Scan**
   ```bash
   curl -X POST http://localhost:3001/api/v1/scans \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "targetId": "target_xyz",
       "scanType": "full",
       "priority": "high"
     }'
   ```

4. **Monitor Progress**
   ```bash
   curl -X GET http://localhost:3001/api/v1/scans/scan_abc123/status \
     -H "Authorization: Bearer $TOKEN"
   ```

5. **Review Results in Dashboard**
   - Open `http://localhost:3000`
   - Navigate to "Scans" section
   - Click on the completed scan to view vulnerability details

6. **Export Report**
   ```bash
   curl -X GET http://localhost:3001/api/v1/scans/scan_abc123/export?format=html \
     -H "Authorization: Bearer $TOKEN" \
     -o report.html
   ```

---

## Documentation Checklist

This checklist identifies documentation that needs creation, updates, or multimedia enhancements:

### Critical Documentation (High Priority)

- [ ] **API Reference Documentation**
  - [ ] Complete endpoint documentation with parameter validation rules
  - [ ] Response schema definitions and error handling codes
  - [ ] Authentication flow diagrams and token lifecycle
  - [ ] Code examples: cURL, Node.js, Python, JavaScript
  - [ ] Screenshots: API Explorer interface

- [ ] **Installation Guide**
  - [ ] Step-by-step setup for Windows, macOS, Linux
  - [ ] Docker/Kubernetes deployment instructions
  - [ ] Cloud deployment guides (AWS, Azure, GCP)
  - [ ] Screenshots: Environment setup, database initialization
  - [ ] Videos: 5-minute setup walkthrough

- [ ] **User Dashboard Guide**
  - [ ] Feature overview and navigation
  - [ ] Scan creation and configuration workflows
  - [ ] Results interpretation and vulnerability prioritization
  - [ ] Screenshots: Dashboard layout, scan results view
  - [ ] Video tutorials: Creating and monitoring scans

### Core Features Documentation (Medium Priority)

- [ ] **Vulnerability Management**
  - [ ] Vulnerability classification and severity levels
  - [ ] Remediation workflows and ticket integration
  - [ ] Code examples: Custom vulnerability parsing
  - [ ] Screenshots: Vulnerability details view

- [ ] **Scanning Engine**
  - [ ] Supported scan types (static, dynamic, SCA, etc.)
  - [ ] Target configuration and scope management
  - [ ] Custom rule creation and management
  - [ ] Code examples: Custom scanners
  - [ ] Screenshots: Scan configuration interface

- [ ] **Integration Documentation**
  - [ ] CI/CD pipeline integration (GitHub Actions, GitLab CI, Jenkins)
  - [ ] SIEM integration (Splunk, ELK, Datadog)
  - [ ] Slack, Teams, PagerDuty notifications
  - [ ] Code examples: Webhook handlers
  - [ ] Screenshots: Integration setup screens

- [ ] **User Management & RBAC**
  - [ ] Role definitions and permissions matrix
  - [ ] User provisioning and access control
  - [ ] SSO/SAML configuration guide
  - [ ] Screenshots: User management interface

### Advanced Documentation (Lower Priority)

- [ ] **Enterprise Features**
  - [ ] Multi-tenancy configuration
  - [ ] Advanced compliance reporting (SOC2, PCI-DSS, HIPAA)
  - [ ] Custom fields and metadata management
  - [ ] Screenshots: Enterprise dashboard

- [ ] **Performance & Scaling**
  - [ ] Capacity planning guidelines
  - [ ] Database optimization and tuning
  - [ ] Horizontal scaling setup with Kubernetes
  - [ ] Code examples: Performance monitoring

- [ ] **Developer Guide**
  - [ ] Plugin/extension development
  - [ ] Custom rule language specification
  - [ ] Testing framework and test utilities
  - [ ] Code examples: Building custom scanners

- [ ] **Troubleshooting & FAQ**
  - [ ] Common issues and solutions
  - [ ] Debugging techniques
  - [ ] Performance optimization tips
  - [ ] Screenshots: Common error messages

### Documentation Deliverables Format

Each documentation item should include:

1. **Narrative Description** (~500-1000 words)
   - Clear, step-by-step instructions
   - Context and prerequisites
   - Expected outcomes

2. **Code Examples** (minimum 3 per feature)
   - cURL requests with full payloads
   - Node.js/JavaScript implementations
   - Python alternative implementations
   - Real-world scenarios

3. **Visual Assets**
   - Screenshots (at least 2-3 per section)
   - Architecture diagrams
   - Workflow flowcharts
   - Video demonstrations (5-10 minutes)

4. **Validation Checklist**
   - Prerequisites verified
   - Example commands tested
   - Screenshots current and relevant
   - Code examples executable

---

## Troubleshooting

### Server Won't Start

**Issue**: Port already in use

```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :3001
kill -9 <PID>
```

**Issue**: Database connection error

```bash
# Reset database
npm run db:reset
npm run db:migrate
```

### Scans Not Running

**Check API server status**:
```bash
curl http://localhost:3001/api/v1/health
```

**Check worker status**:
```bash
curl http://localhost:3001/api/v1/workers/status \
  -H "Authorization: Bearer $TOKEN"
```

### Dashboard Not Loading

**Clear browser cache and restart**:
```bash
npm run clean
npm run dev
```

### Performance Issues

**Enable debug logging**:
```bash
DEBUG=simplebeacon:* npm run dev
```

---

## Next Steps

1. Review the [Installation Guide](#installation) for detailed setup
2. Run the [Basic Scanning Workflow](#basic-scanning-workflow) example
3. Explore the Dashboard at `http://localhost:3000`
4. Integrate with your CI/CD pipeline
5. Configure notifications and integrations
6. Read the [Documentation Checklist](#documentation-checklist) for deeper learning

## Support

- **GitHub Issues**: https://github.com/tjp420/CascadeProjects/issues
- **Documentation**: Check the `/docs` folder
- **Email**: support@simplebeacon.com

---

**Last Updated**: 2026-08-19  
**Version**: 1.0.0  
**Status**: Draft - Awaiting content review and multimedia assets
