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

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS, HTML5, CSS3 |
| Backend | Node.js, Express |
| Database | PostgreSQL, Redis |
| Testing | Jest, node:test |
| CI/CD | GitHub Actions |
| Deployment | Docker Compose |

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

## Track 4 — Architecture Ledger

**Audience / confidentiality:** Internal engineering wiki. Not for external distribution.

## 1. Distributed Multi-Node Cluster Keyring Sync (Track 2)

* Mechanism: Deterministic leader election via lowest active NODE_ID string matching. State synchronization operates over tls socket streaming using length-prefixed (UInt32BE) JSON framing under a strict 1 MB maximum payload ceiling to mitigate denial-of-service vulnerabilities.
* Consistency: Requires an active majority quorum to finalize state operations. Partitioned minority rings explicitly fail-closed, blocking administrative configurations to prevent state divergence.

## 2. Cold Archive Streaming Search & Forensic Parser (Track 3)

* Mechanism: Employs sequential, line-by-line decompression streams using native zlib capabilities on .json.gz and .ndjson.gz log archives.
* Performance: Enforces strict limit/offset parameters, scanning historical archives with bounded O(1) memory consumption, avoiding large array buffering in heap space.

## 3. Multi-Tenant HSM Virtualization & Tokenization (Track 4)

* Mechanism: Implements cryptographically isolated tenant namespaces derived on-demand through HKDF-SHA256, utilizing the organization's unique identifier (orgId) as salt against the core HSM master key block.
* Resilience: Operates a strict non-cached derivation process to ensure zero persistence of derived secrets in long-lived memory spaces. Under simulation latency spikes exceeding HSM_TIMEOUT_MS, the engine drops into a non-fallback, fail-closed HsmTimeoutError exception.

## Security and Compliance Framework Cross-Reference

| Implementation Feature | SOC 2 (Trust Services Criteria) | NIST SP 800-53 (Rev. 5) |
|---|---|---|
| HKDF-SHA256 Namespace Derivation | CC6.1, CC6.3 (Logical Segregation) | SC-28 (Protection of Information at Rest) |
| Fail-Closed HSM Timeout Framework | CC7.1 (Vulnerability & Threat Management) | SI-16 (Memory Protection / Failure State) |
| Quorum Cluster Agreement Logic | CC5.2 (Change Management Control) | CM-3 (Configuration Change Control) |
| Line-by-Line GZIP Forensic Stream | CC2.1 (System Monitoring & Operations) | AU-6 (Audit Record Review and Analysis) |
