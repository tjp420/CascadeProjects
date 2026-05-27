# API Documentation

## Overview

The AI Coding Intelligence Dashboard provides a comprehensive REST API for accessing code analysis data, security metrics, and performance insights.

## Base URL

```
http://localhost:8081/api
```

## Authentication

Most endpoints require authentication using Bearer tokens.

### Authentication Header
```
Authorization: Bearer <token>
```

### Login Endpoint
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "expiresIn": 3600
}
```

## Endpoints

### Analysis Endpoints

#### Get Code Quality Analysis
```http
GET /api/analysis/quality
Authorization: Bearer <token>
```

**Response:**
```json
{
  "overall_score": 85,
  "maintainability": "Good",
  "complexity": "Medium",
  "test_coverage": "78%",
  "code_smells": 12,
  "duplications": 5,
  "timestamp": "2026-05-18T15:20:49.803Z"
}
```

#### Get Security Analysis
```http
GET /api/analysis/security
Authorization: Bearer <token>
```

**Response:**
```json
{
  "security_score": 92,
  "vulnerabilities": 2,
  "security_issues": [
    {
      "severity": "medium",
      "description": "Potential SQL injection",
      "file": "src/database.js",
      "line": 45
    },
    {
      "severity": "low",
      "description": "Outdated dependency",
      "package": "lodash@4.17.21"
    }
  ],
  "timestamp": "2026-05-18T15:20:49.803Z"
}
```

#### Get Performance Analysis
```http
GET /api/analysis/performance
Authorization: Bearer <token>
```

**Response:**
```json
{
  "response_time": 120,
  "throughput": 1000,
  "memory_usage": "45%",
  "cpu_usage": "30%",
  "timestamp": "2026-05-18T15:20:49.803Z"
}
```

#### Get Project Overview
```http
GET /api/analysis/project/overview
Authorization: Bearer <token>
```

**Response:**
```json
{
  "name": "CascadeProjects",
  "totalFiles": 150,
  "linesOfCode": 15678,
  "languages": {
    "JavaScript": 65,
    "Python": 25,
    "HTML": 10
  },
  "timestamp": "2026-05-18T15:20:49.803Z"
}
```

#### Get File Structure Analysis
```http
GET /api/analysis/file-structure
Authorization: Bearer <token>
```

**Query Parameters:**
- `path` (optional): Specific path to analyze
- `depth` (optional): Analysis depth (default: 3)

**Response:**
```json
{
  "files": [
    {
      "name": "app.js",
      "path": "/src/app.js",
      "size": 1024,
      "type": "javascript",
      "lastModified": "2026-05-18T14:30:00Z"
    }
  ],
  "directories": [
    {
      "name": "src",
      "path": "/src",
      "fileCount": 25,
      "totalSize": 51200
    }
  ],
  "totalSize": 3584,
  "timestamp": "2026-05-18T15:20:49.803Z"
}
```

### Recommendations Endpoints

#### Get Recommendations
```http
GET /api/recommendations
Authorization: Bearer <token>
```

**Query Parameters:**
- `priority` (optional): Filter by priority (high, medium, low)
- `category` (optional): Filter by category (quality, security, performance)

**Response:**
```json
{
  "recommendations": [
    {
      "id": "rec_001",
      "title": "Improve Test Coverage",
      "description": "Current test coverage is 65%. Add unit tests for critical components to reach 80% coverage.",
      "priority": "high",
      "category": "quality",
      "impact": "high",
      "effort": "medium",
      "actionable": true
    }
  ],
  "timestamp": "2026-05-18T15:20:49.803Z"
}
```

#### Get Recommendation Details
```http
GET /api/recommendations/{id}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "rec_001",
  "title": "Improve Test Coverage",
  "description": "Current test coverage is 65%. Add unit tests for critical components to reach 80% coverage.",
  "priority": "high",
  "category": "quality",
  "impact": "high",
  "effort": "medium",
  "actionable": true,
  "affectedFiles": [
    "src/components/dashboard.js",
    "src/utils/api.js"
  ],
  "suggestedActions": [
    "Add unit tests for dashboard component",
    "Create test fixtures for API utilities",
    "Set up coverage reporting in CI/CD"
  ],
  "resources": [
    {
      "title": "Testing Best Practices",
      "url": "https://example.com/testing-guide"
    }
  ]
}
```

### Notifications Endpoints

#### Get Notifications
```http
GET /api/notifications
Authorization: Bearer <token>
```

**Query Parameters:**
- `read` (optional): Filter by read status (true, false)
- `type` (optional): Filter by type (info, warning, error, success)
- `limit` (optional): Maximum number of notifications (default: 50)

**Response:**
```json
{
  "notifications": [
    {
      "id": "notif_001",
      "type": "info",
      "title": "Analysis Completed",
      "message": "Code analysis completed successfully",
      "timestamp": "2026-05-18T15:20:49.803Z",
      "read": false,
      "actions": [
        {
          "label": "View Results",
          "url": "/dashboard/analysis"
        }
      ]
    }
  ],
  "unreadCount": 3,
  "timestamp": "2026-05-18T15:20:49.803Z"
}
```

#### Mark Notification as Read
```http
PUT /api/notifications/{id}/read
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

### Export Endpoints

#### Export Analysis Report
```http
POST /api/export/report
Authorization: Bearer <token>
Content-Type: application/json

{
  "format": "pdf",
  "sections": ["quality", "security", "performance"],
  "includeRecommendations": true
}
```

**Response:**
```json
{
  "success": true,
  "exportId": "exp_001",
  "downloadUrl": "/api/export/download/exp_001",
  "expiresAt": "2026-05-18T16:20:49.803Z"
}
```

#### Download Export
```http
GET /api/export/download/{exportId}
Authorization: Bearer <token>
```

**Response:** Binary file download

## Error Handling

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      "field": "Additional error details"
    }
  },
  "timestamp": "2026-05-18T15:20:49.803Z"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing authentication token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## Rate Limiting

- **Standard endpoints**: 100 requests per minute
- **Analysis endpoints**: 10 requests per minute
- **Export endpoints**: 5 requests per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1642678800
```

## CORS

The API supports Cross-Origin Resource Sharing (CORS) with the following headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

## WebSocket Support

Real-time updates are available via WebSocket connections.

### WebSocket URL
```
ws://localhost:8081/ws
```

### Authentication
WebSocket connections must include the JWT token in the query string:
```
ws://localhost:8081/ws?token=jwt_token_here
```

### Message Format
```json
{
  "type": "analysis_update",
  "data": {
    "quality": 86,
    "security": 93,
    "performance": 88
  },
  "timestamp": "2026-05-18T15:20:49.803Z"
}
```

## SDK Examples

### JavaScript/Node.js
```javascript
import axios from 'axios';

// Create API client
const api = axios.create({
  baseURL: 'http://localhost:8081/api',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Get quality analysis
const quality = await api.get('/analysis/quality');
console.log(quality.data);
```

### Python
```python
import requests

# API client
class DashboardAPI:
    def __init__(self, token):
        self.base_url = 'http://localhost:8081/api'
        self.headers = {'Authorization': f'Bearer {token}'}
    
    def get_quality_analysis(self):
        response = requests.get(
            f'{self.base_url}/analysis/quality',
            headers=self.headers
        )
        return response.json()

# Usage
api = DashboardAPI(token)
quality = api.get_quality_analysis()
```

### cURL Examples
```bash
# Login
curl -X POST http://localhost:8081/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"pass"}'

# Get quality analysis
curl -X GET http://localhost:8081/api/analysis/quality \
  -H "Authorization: Bearer <token>"
```

## Testing

### Test Environment
A test environment is available at:
```
http://localhost:8082/api
```

### Mock Data
The test environment provides mock data for testing without affecting production data.

## Changelog

### v1.0.0 (2026-05-18)
- Initial API release
- Authentication endpoints
- Analysis endpoints
- Recommendations system
- Export functionality
- WebSocket support

## Support

For API support and questions:
- Email: api-support@example.com
- Documentation: https://docs.example.com
- Issues: https://github.com/example/issues
