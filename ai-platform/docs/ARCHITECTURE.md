# Simplebeacon Platform Architecture

## Overview

The Simplebeacon Platform is a modular AI safety scanning and audit platform built with Node.js, Express, and PostgreSQL.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Web UI     │  │    CLI       │  │   MCP Server │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
└─────────┼─────────────────┼─────────────────┼────────────┘
          │                 │                 │
┌─────────┼─────────────────┼─────────────────┼────────────┐
│         │                 │                 │            │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐  │
│  │  REST API    │  │  REST API    │  │  REST API    │  │
│  │  (/api/auth) │  │ (/api/scan)  │  │ (/api/analyze│  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │            │
│  ┌──────┴─────────────────┴─────────────────┴───────┐   │
│  │              Express Server (Node.js)              │   │
│  │         ┌─────────┐    ┌─────────┐               │   │
│  │         │  Auth   │    │  Scan   │               │   │
│  │         │Middleware│    │ Engine  │               │   │
│  │         └────┬────┘    └────┬────┘               │   │
│  └──────────────┼──────────────┼────────────────────┘   │
│                 │              │                         │
│  ┌──────────────┼──────────────┼────────────────────┐   │
│  │              Data Layer                              │   │
│  │         ┌─────────┐    ┌─────────┐               │   │
│  │         │PostgreSQL│    │  Redis  │               │   │
│  │         │(Reports)│    │ (Cache) │               │   │
│  │         └─────────┘    └─────────┘               │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Authentication System

- JWT-based authentication with refresh tokens
- Vault authentication for local development
- Role-based access control (RBAC)

### 2. Scan Engine

- Multi-engine analysis pipeline
- File system walker with path safety validation
- Pattern matching for credentials, leaks, fiction KPI

### 3. Dashboard

- Real-time metrics and analytics
- Interactive scan results visualization
- Audit trail and compliance reporting

### 4. CI/CD Integration

- GitHub Actions workflows
- Automated hygiene gates
- Coverage reporting with Istanbul

## Technology Stack

| Layer      | Technology              |
| ---------- | ----------------------- |
| Frontend   | Vanilla JS, HTML5, CSS3 |
| Backend    | Node.js, Express        |
| Database   | PostgreSQL, Redis       |
| Testing    | Jest, node:test         |
| CI/CD      | GitHub Actions          |
| Deployment | Docker Compose          |

## Security Features

- HTTPS enforcement
- Security headers (Helmet)
- Rate limiting
- Input validation and sanitization
- Path safety checks
- Secret management with environment variables

## Data Flow

1. **Scan Request** → API Gateway → Auth Check
2. **File System Walk** → Pattern Matching → Rule Engine
3. **Results Aggregation** → Database Storage → Cache
4. **Dashboard Update** → Real-time Metrics → User Notification

## Deployment Architecture

```
Production Environment:
- Docker Compose with PostgreSQL and Redis
- Cloudflare Tunnel for secure access
- Environment-specific configuration
- Health checks and monitoring
```

## Configuration

Key configuration files:

- `.env.v1-internal` - Development environment
- `.env.production` - Production environment
- `docker-compose.phase2.yml` - Infrastructure services
- `jest.config.js` - Test configuration
