# Simplebeacon API Documentation

> **EU AI Act Article 50 Disclosure:** This documentation describes API endpoints that interact with AI systems. Users are informed that outputs may be AI-generated.

## Overview

The Simplebeacon API provides RESTful endpoints for AI safety scanning, compliance checking, and audit management. All API endpoints are protected by JWT authentication and include comprehensive audit logging.

## Base URL

```
Development: http://localhost:55000
v1-Internal: http://localhost:54449
Production: https://your-domain.com
```

## Authentication

### JWT Token Authentication

All API endpoints (except public ones) require a valid JWT token in the Authorization header:

```http
Authorization: Bearer <your-jwt-token>
```

### Getting a Token

```bash
curl -X POST http://localhost:55000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "<your-email>",
    "password": "<your-password>"
  }'
```

Response:

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "vault-operator",
    "email": "<your-email>",
    "name": "Vault Operator",
    "trustLevel": "gold",
    "permissions": ["read:own", "write:own", "analyze:public"]
  }
}
```

### Refresh Token

```bash
curl -X POST http://localhost:55000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

## API Endpoints

### Authentication Endpoints

#### POST /api/auth/login

Authenticate user and return JWT tokens.

**Request Body:**

```json
{
  "email": "<your-email>",
  "password": "<your-password>"
}
```

**Response:**

```json
{
  "success": true,
  "token": "jwt-token",
  "refreshToken": "refresh-token",
  "user": {
    "id": "user-id",
    "email": "<your-email>",
    "name": "User Name",
    "trustLevel": "gold",
    "permissions": ["read:own", "write:own"]
  }
}
```

#### POST /api/auth/refresh

Refresh access token using refresh token.

**Request Body:**

```json
{
  "refreshToken": "refresh-token"
}
```

**Response:**

```json
{
  "success": true,
  "token": "new-jwt-token",
  "user": {
    "id": "user-id",
    "email": "<your-email>",
    "name": "User Name"
  }
}
```

#### GET /api/auth/me

Get current user information.

**Headers:**

```
Authorization: Bearer <jwt-token>
```

**Response:**

```json
{
  "user": {
    "id": "user-id",
    "email": "<your-email>",
    "name": "User Name",
    "trustLevel": "gold",
    "permissions": ["read:own", "write:own"],
    "vaultSession": true
  }
}
```

### Platform Endpoints

#### GET /api/health

Health check endpoint (public).

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2026-06-03T03:48:06.608Z",
  "uptime": 3600,
  "version": "1.0.0",
  "environment": "development"
}
```

#### GET /api/platform/status

Platform status and feature availability (public).

**Response:**

```json
{
  "phase": 1,
  "authRequired": true,
  "features": {
    "jwtAuth": true,
    "demoUsers": true,
    "phase2Database": false,
    "phase2Redis": false
  },
  "timestamp": "2026-06-03T03:48:06.608Z"
}
```

### Simplebeacon Endpoints

#### GET /api/simplebeacon/entitlements

Get user entitlements and feature access (public).

**Response:**

```json
{
  "success": true,
  "publicGateLocked": false,
  "closedVaultMode": false,
  "hasAuditDeliverableAccess": true,
  "auditCheckoutUrl": "mailto:<audit-email>?subject=Unlock%20Pre-Launch%20Audit%20Report",
  "auditPriceLabel": "$499"
}
```

#### GET /api/simplebeacon/user/ai-keys

Get user's AI provider configurations.

**Headers:**

```
Authorization: Bearer <jwt-token>
```

**Response:**

```json
{
  "success": true,
  "email": "<your-email>",
  "providers": {
    "openai": {
      "configured": false,
      "hint": "Set OPENAI_API_KEY in environment"
    },
    "anthropic": {
      "configured": false,
      "hint": "Set ANTHROPIC_API_KEY in environment"
    }
  },
  "ollamaBaseUrl": "http://127.0.0.1:11434",
  "ollamaModel": "unbreakable-oracle:latest",
  "updatedAt": "2026-06-03T00:09:00.220Z"
}
```

#### GET /api/simplebeacon/report

Get Simplebeacon scan report for a project.

**Headers:**

```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**

- `projectPath` (required): Path to project directory
- `profile` (optional): Scan profile (default: "eu-ai-act")

**Example:**

```
GET /api/simplebeacon/report?projectPath=/path/to/project&profile=eu-ai-act
```

**Response:**

```json
{
  "type": "simplebeacon-report",
  "projectRoot": "project-name",
  "gate": {
    "pass": true,
    "blockingCount": 0,
    "warningCount": 2
  },
  "qualityScore": 95,
  "issueCount": 2,
  "issues": [
    {
      "severity": "medium",
      "type": "Credential Pattern",
      "count": 1,
      "description": "Possible API key in production code",
      "pattern": "generic-api-key",
      "line": 42,
      "file": "src/config.js",
      "recommendation": "Replace hardcoded API key with environment variable"
    }
  ],
  "scanScope": {
    "profile": "eu-ai-act",
    "totalFiles": 150,
    "filesScanned": 148,
    "rulesEnabled": ["credentials", "production-leak", "eu-ai-act-patterns"]
  },
  "generatedAt": "2026-06-03T03:48:06.608Z"
}
```

#### POST /api/simplebeacon/scan

Run a new Simplebeacon scan.

**Headers:**

```
Authorization: Bearer <jwt-token>
```

**Request Body:**

```json
{
  "projectPath": "/path/to/project",
  "profile": "eu-ai-act",
  "options": {
    "withJest": true,
    "failOn": "high"
  }
}
```

**Response:**

```json
{
  "success": true,
  "scanId": "scan-uuid-123",
  "status": "running",
  "projectPath": "/path/to/project",
  "profile": "eu-ai-act",
  "startedAt": "2026-06-03T03:48:06.608Z"
}
```

### Analysis Endpoints

#### GET /api/analyze/inventory

Get project inventory and file analysis.

**Headers:**

```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**

- `projectPath` (required): Path to project directory
- `profile` (optional): Analysis profile

**Response:**

```json
{
  "success": true,
  "inventory": {
    "projectRoot": "/path/to/project",
    "totalFiles": 1500,
    "directories": 120,
    "fileTypes": {
      ".js": 800,
      ".json": 200,
      ".md": 100,
      ".yml": 50,
      "other": 350
    },
    "largestFiles": [
      {
        "path": "src/large-file.js",
        "size": 50000,
        "type": ".js"
      }
    ],
    "scanTime": 2.5
  }
}
```

#### POST /api/analyze/compliance-checklist

Run compliance analysis.

**Headers:**

```
Authorization: Bearer <jwt-token>
```

**Request Body:**

```json
{
  "projectPath": "/path/to/project",
  "frameworks": ["SOC2", "ISO27001", "GDPR"]
}
```

**Response:**

```json
{
  "success": true,
  "compliance": {
    "SOC2": {
      "score": 85,
      "issues": [
        {
          "control": "Access Control",
          "status": "partial",
          "recommendation": "Implement role-based access control"
        }
      ]
    },
    "ISO27001": {
      "score": 90,
      "issues": []
    },
    "GDPR": {
      "score": 88,
      "issues": [
        {
          "article": "Article 32",
          "status": "compliant",
          "recommendation": "Data protection measures in place"
        }
      ]
    }
  }
}
```

### Upload Endpoints

#### POST /api/upload

Upload files for analysis.

**Headers:**

```
Authorization: Bearer <jwt-token>
Content-Type: multipart/form-data
```

**Request Body:**

```
file: <file-data>
projectPath: "/path/to/project"
profile: "eu-ai-act"
```

**Response:**

```json
{
  "success": true,
  "uploadId": "upload-uuid-123",
  "filename": "uploaded-file.js",
  "size": 1024,
  "type": ".js",
  "status": "uploaded"
}
```

### Metrics Endpoints

#### GET /api/metrics/path-health

Get path health metrics and statistics.

**Headers:**

```
Authorization: Bearer <jwt-token>
```

**Response:**

```json
{
  "success": true,
  "metrics": {
    "totalPaths": 50,
    "healthyPaths": 48,
    "unhealthyPaths": 2,
    "averageResponseTime": 150,
    "lastScan": "2026-06-03T03:48:06.608Z",
    "issues": [
      {
        "path": "/problematic/path",
        "issue": "Permission denied",
        "severity": "medium"
      }
    ]
  }
}
```

## Error Handling

### Standard Error Response

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error type",
  "message": "Human-readable error message",
  "requestId": "uuid-for-tracking"
}
```

### Common Error Codes

| Status Code | Description           | Example                  |
| ----------- | --------------------- | ------------------------ |
| 400         | Bad Request           | Invalid parameters       |
| 401         | Unauthorized          | Missing or invalid token |
| 403         | Forbidden             | Insufficient permissions |
| 404         | Not Found             | Resource not found       |
| 429         | Too Many Requests     | Rate limit exceeded      |
| 500         | Internal Server Error | Server error             |

### Rate Limiting

- **Default**: 2000 requests per 15 minutes per IP
- **Authenticated**: Higher limits for authenticated users
- **Endpoints**: Different limits per endpoint type

## SDK Examples

### JavaScript/Node.js

```javascript
const axios = require("axios");

class SimplebeaconAPI {
  constructor(baseURL, token) {
    this.baseURL = baseURL;
    this.token = token;
  }

  async login(email, password) {
    const response = await axios.post(`${this.baseURL}/api/auth/login`, {
      email,
      password,
    });
    this.token = response.data.token;
    return response.data;
  }

  async getReport(projectPath, profile = "eu-ai-act") {
    const response = await axios.get(
      `${this.baseURL}/api/simplebeacon/report`,
      {
        params: { projectPath, profile },
        headers: { Authorization: `Bearer ${this.token}` },
      },
    );
    return response.data;
  }

  async scanProject(projectPath, options = {}) {
    const response = await axios.post(
      `${this.baseURL}/api/simplebeacon/scan`,
      { projectPath, ...options },
      {
        headers: { Authorization: `Bearer ${this.token}` },
      },
    );
    return response.data;
  }
}

// Usage
const api = new SimplebeaconAPI("http://localhost:55000");
await api.login("<your-email>", "<your-password>");
const report = await api.getReport("/path/to/project");
```

### Python

```python
import requests

class SimplebeaconAPI:
    def __init__(self, base_url, token=None):
        self.base_url = base_url
        self.token = token
        self.session = requests.Session()

    def login(self, email, password):
        response = self.session.post(
            f"{self.base_url}/api/auth/login",
            json={"email": email, "password": password}
        )
        self.token = response.json()["token"]
        return response.json()

    def get_report(self, project_path, profile="eu-ai-act"):
        headers = {"Authorization": f"Bearer {self.token}"}
        params = {"projectPath": project_path, "profile": profile}
        response = self.session.get(
            f"{self.base_url}/api/simplebeacon/report",
            headers=headers,
            params=params
        )
        return response.json()

# Usage
api = SimplebeaconAPI("http://localhost:55000")
api.login("<your-email>", "<your-password>")
report = api.get_report("/path/to/project")
```

## Webhooks

### Configure Webhooks

Webhooks can be configured to receive notifications about scan completions and security events.

```bash
curl -X POST http://localhost:55000/api/webhooks/configure \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhook",
    "events": ["scan.completed", "security.alert"],
    "secret": "webhook-secret"
  }'
```

### Webhook Payload

```json
{
  "event": "scan.completed",
  "timestamp": "2026-06-03T03:48:06.608Z",
  "data": {
    "scanId": "scan-uuid-123",
    "projectPath": "/path/to/project",
    "status": "completed",
    "gate": {
      "pass": true,
      "blockingCount": 0,
      "warningCount": 2
    }
  },
  "signature": "sha256-signature"
}
```

## Rate Limits

| Endpoint Type  | Rate Limit | Window |
| -------------- | ---------- | ------ |
| Authentication | 100/hour   | 1 hour |
| Scanning       | 50/hour    | 1 hour |
| Analysis       | 200/hour   | 1 hour |
| Upload         | 20/hour    | 1 hour |
| Metrics        | 1000/hour  | 1 hour |

## Support

### Getting Help

- **API Documentation**: This guide
- **Status Page**: `/api/health`
- **Support Email**: <support-email>
- **GitHub Issues**: [Report API Issues](https://github.com/tjp420/simplebeacon/issues)

### Troubleshooting

#### Common Issues

1. **401 Unauthorized**: Check JWT token validity
2. **400 Bad Request**: Verify request parameters
3. **429 Too Many Requests**: Implement rate limiting in client
4. **500 Internal Server Error**: Check server logs

#### Debug Mode

Enable debug logging by setting `DEBUG=api` environment variable.

```bash
DEBUG=api npm run dev
```

---

**Simplebeacon API** - 🛡️ AI Safety Scanning at Scale

For more information, visit [simplebeacon.ai](https://simplebeacon.ai) or check out our [GitHub repository](https://github.com/tjp420/simplebeacon).
