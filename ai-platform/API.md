# Simplebeacon API Reference

> **EU AI Act Article 50 Disclosure:** This documentation describes API endpoints that interact with AI systems. Users are informed that outputs may be AI-generated.

## Base URL

```
Development: http://localhost:55000
v1-Internal: http://localhost:54449
Production:  https://your-domain.com
```

## Authentication

Most endpoints require a JWT token:

```http
Authorization: Bearer <your-jwt-token>
```

Obtain a token via `POST /api/auth/login`.

## Core Endpoints

### Health & Status

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | No | Server health check |
| GET | `/api/health/db` | No | Database connectivity |
| GET | `/api/health/redis` | No | Redis connectivity |
| GET | `/api/platform/status` | No | Platform status overview |

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | No | Authenticate and receive JWT |
| POST | `/api/auth/refresh` | No | Refresh access token |
| GET | `/api/auth/me` | Yes | Current user profile |
| POST | `/api/auth/logout` | Yes | Invalidate session |

### Analysis

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/analyze/flexible` | Yes | Flexible codebase analysis |
| GET | `/api/analyze/progress` | Yes | Scan progress polling |
| GET | `/api/analyze/summary` | Yes | Analysis summary |
| POST | `/api/analyze/compliance-checklist` | Yes | EU AI Act compliance |
| POST | `/api/analyze/data-cleanup` | Yes | Data cleanup analysis |
| POST | `/api/analyze/npm-audit` | Yes | npm audit results |
| POST | `/api/analyze/codebase` | Yes | Full codebase analysis |
| POST | `/api/analyze/complete-audit-report` | Yes | Complete audit bundle |

### Simplebeacon Core

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/simplebeacon/report` | Yes | Latest scan report |
| GET | `/api/simplebeacon/gate-status` | Yes | Gate pass/fail status |
| POST | `/api/simplebeacon/scan` | Yes | Trigger new scan |
| GET | `/api/simplebeacon/entitlements` | Yes | User tier & modules |

### Chatbot

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/chatbot/message` | Yes | Send chat message |
| GET | `/api/chatbot/providers` | No | Available AI providers |
| GET | `/api/chatbot/disclosure` | No | EU AI Act disclosure |

## Response Format

All API responses follow this structure:

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional human-readable message"
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error code",
  "message": "Human-readable error description"
}
```

## Rate Limits

- Authentication endpoints: 30 requests per 15 minutes
- Analysis endpoints: 60 requests per 15 minutes
- General API: 100 requests per 15 minutes

## See Also

- [Full API docs](docs/api/README.md)
- [v1-Internal Runbook](docs/v1-internal-runbook.md)
- [Security Policy](docs/SECURITY.md)
