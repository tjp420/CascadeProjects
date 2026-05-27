# API Documentation for AI Coding Intelligence Dashboard

## 📋 Overview

The AI Coding Intelligence Dashboard provides RESTful API endpoints for project analysis, metrics, and real-time data. This documentation covers all available endpoints, request/response formats, and usage examples.

## 🔗 Base URL

```
Production: http://localhost:8081/api
Staging: http://localhost:8082/api
Development: http://localhost:8083/api
```

## 🚀 Quick Start

```bash
# Check API health
curl -f http://localhost:8081/api/health

# Get project overview
curl http://localhost:8081/api/project/overview

# Get project metrics
curl http://localhost:8081/api/project/metrics
```

## 📊 Endpoints

### Health Check

**GET** `/api/health`

Check if the API server is running and healthy.

**Response:**
```json
{
    "status": "healthy",
    "timestamp": "2023-12-01T12:00:00Z",
    "version": "2.0.0",
    "uptime": 3600
}
```

**Status Codes:**
- `200 OK` - API is healthy
- `503 Service Unavailable` - API is unhealthy

---

### Project Overview

**GET** `/api/project/overview`

Get comprehensive project overview including file counts, code quality, and project essentials.

**Response:**
```json
{
    "totalFiles": 7780,
    "totalDirectories": 156,
    "projectDepth": 8,
    "linesOfCode": 50000,
    "codeQuality": 82,
    "testCoverage": 75,
    "technicalDebt": "Low",
    "maintainability": "Good",
    "healthScore": 85,
    "developmentVelocity": "High",
    "teamProductivity": 85,
    "projectComplexity": "Medium",
    "languages": ["JavaScript", "Python", "HTML", "CSS"],
    "frameworks": ["Web Technologies", "Build Tools"],
    "fileTypes": {
        ".eslintrc.js": 1,
        ".prettierrc": 1,
        "jest.config.js": 1,
        "package.json": 1,
        "README.md": 1,
        ".test.js": 2,
        "json": 1,
        "js": 1000,
        "py": 500,
        "html": 200,
        "css": 150,
        "md": 1
    },
    "timestamp": "2023-12-01T12:00:00Z"
}
```

**Status Codes:**
- `200 OK` - Data retrieved successfully
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - API unavailable

---

### Project Metrics

**GET** `/api/project/metrics`

Get detailed project metrics and analytics.

**Response:**
```json
{
    "codeMetrics": {
        "totalLines": 50000,
        "codeLines": 40000,
        "commentLines": 8000,
        "blankLines": 2000,
        "cyclomaticComplexity": 2.5
    },
    "testMetrics": {
        "totalTests": 2,
        "passedTests": 2,
        "failedTests": 0,
        "coverage": 75,
        "testFiles": ["test1.test.js", "test2.test.js"]
    },
    "qualityMetrics": {
        "codeQuality": 82,
        "maintainability": "Good",
        "technicalDebt": "Low",
        "duplicatedCode": 5
    },
    "performanceMetrics": {
        "buildTime": 1200,
        "bundleSize": 2048000,
        "loadTime": 800
    }
}
```

---

### File Analysis

**GET** `/api/project/files`

Get detailed file analysis and breakdown.

**Query Parameters:**
- `type` (optional) - Filter by file type (e.g., `js`, `py`, `html`)
- `sort` (optional) - Sort order (`name`, `size`, `modified`)
- `limit` (optional) - Maximum number of files to return

**Response:**
```json
{
    "files": [
        {
            "name": "dashboard.js",
            "path": "/web/dashboard.js",
            "size": 10240,
            "type": "js",
            "lines": 500,
            "lastModified": "2023-12-01T10:00:00Z",
            "complexity": 3
        }
    ],
    "total": 7780,
    "filtered": 1000
}
```

---

### Project Essentials

**GET** `/api/project/essentials`

Get status of project essentials and configuration files.

**Response:**
```json
{
    "essentials": {
        "eslint": {
            "detected": true,
            "configFile": ".eslintrc.js",
            "rules": 25,
            "status": "active"
        },
        "prettier": {
            "detected": true,
            "configFile": ".prettierrc",
            "status": "active"
        },
        "jest": {
            "detected": true,
            "configFile": "jest.config.js",
            "status": "active"
        },
        "package": {
            "detected": true,
            "configFile": "package.json",
            "version": "2.0.0",
            "scripts": 15
        },
        "readme": {
            "detected": true,
            "configFile": "README.md",
            "size": 2048,
            "sections": 5
        },
        "tests": {
            "detected": true,
            "testFiles": 2,
            "testTypes": [".test.js", ".spec.js"],
            "coverage": 75
        }
    },
    "overallStatus": "complete",
    "missingEssentials": []
}
```

---

### Real-time Updates

**WebSocket** `/ws/realtime`

Establish WebSocket connection for real-time updates.

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:8081/ws/realtime');

ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    console.log('Real-time update:', data);
};
```

**Message Format:**
```json
{
    "type": "project_update",
    "timestamp": "2023-12-01T12:00:00Z",
    "data": {
        "totalFiles": 7781,
        "codeQuality": 83
    }
}
```

---

## 🔧 Configuration

### Request Headers

```http
Content-Type: application/json
Accept: application/json
User-Agent: AI-Dashboard/2.0.0
```

### Response Headers

```http
Content-Type: application/json
Cache-Control: max-age=300
X-API-Version: 2.0.0
```

## 🚨 Error Handling

### Error Response Format

```json
{
    "error": {
        "code": "INTERNAL_ERROR",
        "message": "An internal server error occurred",
        "details": "Database connection failed",
        "timestamp": "2023-12-01T12:00:00Z",
        "requestId": "req_123456789"
    }
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `INVALID_REQUEST` | Invalid request format | 400 |
| `UNAUTHORIZED` | Authentication required | 401 |
| `FORBIDDEN` | Access denied | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `INTERNAL_ERROR` | Server error | 500 |
| `SERVICE_UNAVAILABLE` | API unavailable | 503 |

## 📈 Rate Limiting

- **Rate Limit**: 100 requests per minute
- **Burst Limit**: 10 requests per second
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### Rate Limit Exceeded Response

```json
{
    "error": {
        "code": "RATE_LIMIT_EXCEEDED",
        "message": "Rate limit exceeded",
        "retryAfter": 60
    }
}
```

## 🔍 Examples

### JavaScript/Node.js

```javascript
// Fetch project overview
async function getProjectOverview() {
    try {
        const response = await fetch('http://localhost:8081/api/project/overview');
        const data = await response.json();
        console.log('Project data:', data);
        return data;
    } catch (error) {
        console.error('Error:', error);
    }
}
```

### Python

```python
import requests

def get_project_overview():
    try:
        response = requests.get('http://localhost:8081/api/project/overview')
        response.raise_for_status()
        data = response.json()
        print('Project data:', data)
        return data
    except requests.exceptions.RequestException as error:
        print('Error:', error)
```

### cURL

```bash
# Get project overview with pretty printing
curl -s http://localhost:8081/api/project/overview | python -m json.tool

# Get project metrics
curl -H "Accept: application/json" http://localhost:8081/api/project/metrics

# Check API health
curl -f http://localhost:8081/api/health
```

## 🧪 Testing

### Test Endpoints

**GET** `/api/test/health`

Test API health and connectivity.

**Response:**
```json
{
    "status": "ok",
    "timestamp": "2023-12-01T12:00:00Z",
    "database": "connected",
    "filesystem": "accessible"
}
```

**GET** `/api/test/metrics`

Test metrics calculation.

**Response:**
```json
{
    "testMetrics": {
        "calculationTime": 0.05,
        "filesProcessed": 100,
        "memoryUsage": 50
    }
}
```

## 🔄 Versioning

### API Versioning

- Current version: `v2.0.0`
- Version in URL: `/api/v2/...`
- Backward compatibility: Supported for `v1.x.x`

### Version Response

```json
{
    "version": "2.0.0",
    "buildDate": "2023-12-01T12:00:00Z",
    "gitCommit": "abc123def456",
    "apiVersion": "v2"
}
```

## 📞 Support

### Troubleshooting

1. **API Not Responding**
   - Check if the API server is running
   - Verify the port and URL
   - Check network connectivity

2. **Authentication Issues**
   - Verify API keys or tokens
   - Check request headers
   - Review access permissions

3. **Rate Limiting**
   - Check rate limit headers
   - Implement exponential backoff
   - Consider upgrading your plan

### Contact

- **API Support**: api-support@example.com
- **Documentation**: docs@example.com
- **Issues**: https://github.com/your-repo/issues

---

**Note**: This API is continuously evolving. Check for updates and new endpoints regularly.
