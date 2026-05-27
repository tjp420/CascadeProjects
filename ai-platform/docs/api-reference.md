# 📡 API Reference

**Version**: 1.1.0  
**Last Updated**: 2026-05-21  
**Base URL**: http://localhost:3003

---

## 🔍 API Overview

The AI Platform provides a comprehensive RESTful API for accessing AI analytics, security monitoring, and real-time data. All API endpoints are secured with enterprise-grade security measures.

### **🔒 Authentication**
Currently, the API uses rate limiting and CORS protection. Future versions will include OAuth 2.0 authentication.

### **📊 Response Format**
```json
{
  "success": true,
  "data": {},
  "message": "Success",
  "timestamp": "2026-05-21T07:55:00.000Z"
}
```

---

## 🚀 Core Endpoints

### **📊 Health & Status**

#### **Health Check**
```http
GET /api/health
```

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-05-21T07:55:00.000Z",
  "version": "1.1.0",
  "uptime": "2 days, 14 hours",
  "securityScore": 100
}
```

#### **Security Status**
```http
GET /api/security/status
```

**Response**:
```json
{
  "securityScore": 100,
  "vulnerabilities": 0,
  "lastScan": "2026-05-21T07:55:00.000Z",
  "threatsBlocked": 0,
  "recentAlerts": [
    {
      "timestamp": "2026-05-21T07:55:00.000Z",
      "type": "server_start",
      "severity": "info",
      "message": "Server started on port 3003",
      "ip": "localhost"
    }
  ]
}
```

#### **Security Test**
```http
GET /api/security/test
```

**Response**:
```json
{
  "cspPolicy": {
    "passed": true,
    "details": "CSP policy properly blocks unauthorized scripts"
  },
  "securityHeaders": {
    "passed": true,
    "headers": ["X-Frame-Options", "X-Content-Type-Options", "X-XSS-Protection"]
  },
  "xssProtection": {
    "passed": true,
    "xssBlocked": true
  },
  "rateLimiting": {
    "passed": true,
    "limit": 100,
    "window": 900000
  }
}
```

---

## 🤖 AI Analytics Endpoints

### **📊 AI Build Request**
```http
POST /api/ai-build
```

**Request Body**:
```json
{
  "prompt": "Generate a comprehensive analysis report",
  "type": "analysis",
  "parameters": {
    "depth": "comprehensive",
    "format": "json"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "analysis": "Comprehensive analysis completed",
    "insights": ["Insight 1", "Insight 2"],
    "recommendations": ["Recommendation 1", "Recommendation 2"],
    "timestamp": "2026-05-21T07:55:00.000Z"
  },
  "message": "AI build request processed successfully",
  "timestamp": "2026-05-21T07:55:00.000Z"
}
```

---

## 🔧 Server Management

### **📊 Server Information**
```http
GET /api/server/info
```

**Response**:
```json
{
  "success": true,
  "data": {
    "version": "1.1.0",
    "nodeVersion": "v18.17.0",
    "platform": "darwin",
    "architecture": "x64",
    "uptime": "2 days, 14 hours",
    "memoryUsage": {
      "used": "245MB",
      "total": "8GB",
      "percentage": 3%
    },
    "cpuUsage": {
      "current": "5.2%",
      "average": "3.8%"
    }
  },
  "message": "Server information retrieved successfully",
  "timestamp": "2026-05-21T07:55:00.000Z"
}
```

---

## 📈 Real-time Data

### **🔗 WebSocket Connection**
```javascript
// Connect to real-time updates
const socket = io('http://localhost:3003');

// Join security monitoring room
socket.emit('join-room', 'security-monitoring');

// Listen for security updates
socket.on('security-update', (data) => {
  console.log('Security update:', data);
});
```

### **📡 Real-time Events**
```javascript
// Security events
socket.on('security-alert', (alert) => {
  console.log('Security alert:', alert);
});

// Server events
socket.on('server-status', (status) => {
  console.log('Server status:', status);
});

// AI processing events
socket.on('ai-processing', (data) => {
  console.log('AI processing:', data);
});
```

---

## 📝 Error Handling

### **🚨 Error Response Format**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "prompt",
      "issue": "Required field missing"
    }
  },
  "timestamp": "2026-05-21T07:55:00.000Z"
}
```

### **⚠️ Common Error Codes**
| Code | Description | HTTP Status |
|------|-------------|------------|
| `VALIDATION_ERROR` | Invalid request parameters | 400 |
| `UNAUTHORIZED` | Authentication required | 401 |
| `FORBIDDEN` | Access denied | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `INTERNAL_ERROR` | Server error | 500 |

---

## 🔒 Rate Limiting

### **📊 Rate Limit Configuration**
```json
{
  "windowMs": 900000,
  "max": 100,
  "message": "Too many requests from this IP, please try again later.",
  "retryAfter": 900000
}
```

### **📊 Rate Limit Headers**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1621587307321
```

---

## 🛡️ Security Headers

### **🔒 Security Headers Applied**
```http
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=()
Strict-Transport-Security: max-age=31536000; includeSubDomains=true; preload
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com'; img-src 'self' data: https:; connect-src 'self' https://fonts.googleapis.com; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
```

---

## 📚 Development Examples

### **📡 JavaScript/Node.js**
```javascript
// Fetch API data
async function getSecurityStatus() {
  try {
    const response = await fetch('/api/security/status');
    const data = await response.json();
    console.log('Security Score:', data.securityScore);
    return data;
  } catch (error) {
    console.error('API Error:', error);
  }
}

// AI Build Request
async function requestAIAnalysis(prompt) {
  try {
    const response = await fetch('/api/ai-build', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        type: 'analysis'
      })
    });
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('AI Build Error:', error);
  }
}
```

### **🐍 Python Requests**
```python
import requests
import json

def get_security_status():
    """Get current security status"""
    try:
        response = requests.get('http://localhost:3003/api/security/status')
        data = response.json()
        return data
    except requests.exceptions.RequestException as e:
        print(f"API Error: {e}")
        return None

def request_ai_analysis(prompt):
    """Request AI analysis"""
    try:
        response = requests.post(
            'http://localhost:3003/api/ai-build',
            json={
                'prompt': prompt,
                'type': 'analysis'
            }
        )
        data = response.json()
        return data['data']
    except requests.exceptions.RequestException as e:
        print(f"AI Build Error: {e}")
        return None
```

### **📡 cURL Examples**
```bash
# Health check
curl http://localhost:3003/api/health

# Security status
curl http://localhost:3003/api/security/status

# AI Build Request
curl -X POST http://localhost:3003/api/ai-build \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Generate analysis report", "type": "analysis"}'

# Server information
curl http://localhost:3003/api/server/info
```

---

## 📊 WebSocket Events

### **🔗 Event Types**
```javascript
// Security Events
socket.on('security-update', (data) => {
  // Handle security updates
  console.log('Security Score:', data.securityScore);
  console.log('New Alerts:', data.alerts);
});

// Server Events
socket.on('server-status', (status) => {
  // Handle server status changes
  console.log('Server Status:', status.uptime);
  console.log('Memory Usage:', status.memoryUsage);
});

// AI Processing Events
socket.on('ai-processing', (data) => {
  // Handle AI processing updates
  console.log('AI Processing:', data.status);
  console.log('Progress:', data.progress);
});

// Connection Events
socket.on('connect', () => {
  console.log('Connected to AI Platform');
});

socket.on('disconnect', () => {
  console.log('Disconnected from AI Platform');
});
```

---

## 📚 API Testing

### **🧪 Test Suite**
```javascript
// API Test Suite
const API_BASE_URL = 'http://localhost:3003/api';

describe('API Tests', () => {
  test('Health Check', async () => {
    const response = await fetch(`${API_BASE_URL}/health`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('healthy');
  });

  test('Security Status', async () => {
    const response = await fetch(`${API_BASE_URL}/security/status`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.securityScore).toBe(100);
  });

  test('Security Test', async () => {
    const response = await fetch(`${API_BASE_URL}/security/test`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.cspPolicy.passed).toBe(true);
  });
});
```

---

## 📞 Support

### **🐛 Troubleshooting**
- **API Not Responding**: Check if server is running
- **CORS Errors**: Verify CORS configuration
- **Rate Limited**: Wait and retry after timeout
- **Authentication**: Check API key configuration

### **📚 Documentation**
- [Installation Guide](./installation.md)
- [User Manual](./user-manual.md)
- [Troubleshooting](./troubleshooting.md)
- [Architecture Overview](./architecture.md)

---

**Last Updated**: 2026-05-21 07:55:00  
**Version**: 1.1.0  
**API Version**: v1  
**Base URL**: http://localhost:3003/api
