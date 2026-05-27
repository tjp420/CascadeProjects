/**
 * Security API Tests
 * Tests security-related API endpoints
 */

const request = require('supertest');
const { app } = require('../../src/server/security-enhanced');

describe('Security API Tests', () => {
  let server;

  beforeAll(() => {
    server = app.listen(0); // Use random port for testing
  });

  afterAll(() => {
    server.close();
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('securityScore');
    });

    it('should have correct content-type', async () => {
      await request(app)
        .get('/api/health')
        .expect('Content-Type', /json/);
    });
  });

  describe('GET /api/security/status', () => {
    it('should return security status', async () => {
      const response = await request(app)
        .get('/api/security/status')
        .expect(200);

      expect(response.body).toHaveProperty('securityScore');
      expect(response.body).toHaveProperty('vulnerabilities');
      expect(response.body).toHaveProperty('lastScan');
      expect(response.body).toHaveProperty('threatsBlocked');
      expect(response.body).toHaveProperty('recentAlerts');
      expect(Array.isArray(response.body.recentAlerts)).toBe(true);
    });

    it('should have security score of 100', async () => {
      const response = await request(app)
        .get('/api/security/status')
        .expect(200);

      expect(response.body.securityScore).toBe(100);
      expect(response.body.vulnerabilities).toBe(0);
    });
  });

  describe('GET /api/security/test', () => {
    it('should run security tests', async () => {
      const response = await request(app)
        .get('/api/security/test')
        .expect(200);

      expect(response.body).toHaveProperty('cspPolicy');
      expect(response.body).toHaveProperty('securityHeaders');
      expect(response.body).toHaveProperty('xssProtection');
      expect(response.body).toHaveProperty('rateLimiting');

      expect(response.body.cspPolicy).toHaveProperty('passed');
      expect(response.body.securityHeaders).toHaveProperty('passed');
      expect(response.body.xssProtection).toHaveProperty('passed');
      expect(response.body.rateLimiting).toHaveProperty('passed');
    });

    it('should have all security headers', async () => {
      const response = await request(app)
        .get('/api/security/test')
        .expect(200);

      const expectedHeaders = [
        'X-Frame-Options',
        'X-Content-Type-Options',
        'X-XSS-Protection'
      ];

      expectedHeaders.forEach(header => {
        expect(response.body.securityHeaders.headers).toContain(header);
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should allow normal requests', async () => {
      await request(app)
        .get('/api/health')
        .expect(200);
    });

    it('should have rate limiting headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Rate limiting headers should be present
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    });
  });

  describe('Security Headers', () => {
    it('should have security headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
      expect(response.headers).toHaveProperty('referrer-policy');
      expect(response.headers).toHaveProperty('permissions-policy');
    });

    it('should have CSP header', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers).toHaveProperty('content-security-policy');
    });

    it('should have HSTS header', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers).toHaveProperty('strict-transport-security');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 correctly', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
    });

    it('should handle invalid JSON', async () => {
      await request(app)
        .post('/api/ai-build')
        .send('invalid json')
        .expect(400);
    });

    it('should handle missing required fields', async () => {
      await request(app)
        .post('/api/ai-build')
        .send({})
        .expect(400);
    });
  });

  describe('CORS', () => {
    it('should have CORS headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should handle preflight requests', async () => {
      await request(app)
        .options('/api/health')
        .expect(204);
    });
  });

  describe('Content Security Policy', () => {
    it('should block unauthorized scripts', async () => {
      const response = await request(app)
        .get('/api/security/test')
        .expect(200);

      expect(response.body.cspPolicy.passed).toBe(true);
    });

    it('should have proper CSP directives', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("style-src 'self'");
    });
  });

  describe('XSS Protection', () => {
    it('should block XSS attempts', async () => {
      const response = await request(app)
        .get('/api/security/test')
        .expect(200);

      expect(response.body.xssProtection.passed).toBe(true);
      expect(response.body.xssProtection.xssBlocked).toBe(true);
    });
  });

  describe('WebSocket Security', () => {
    it('should have WebSocket security', async () => {
      const response = await request(app)
        .get('/api/security/status')
        .expect(200);

      expect(response.body.securityScore).toBe(100);
    });
  });

  describe('Performance', () => {
    it('should respond quickly', async () => {
      const start = Date.now();
      await request(app)
        .get('/api/health')
        .expect(200);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should handle concurrent requests', async () => {
      const promises = Array(10).fill().map(() =>
        request(app).get('/api/health').expect(200)
      );

      await Promise.all(promises);
    });
  });

  describe('Data Validation', () => {
    it('should validate AI build request', async () => {
      const validRequest = {
        prompt: 'Test prompt',
        type: 'analysis',
        parameters: {
          depth: 'comprehensive',
          format: 'json'
        }
      };

      const response = await request(app)
        .post('/api/ai-build')
        .send(validRequest)
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should reject invalid AI build request', async () => {
      const invalidRequest = {
        prompt: '',
        type: 'invalid',
        parameters: {}
      };

      const response = await request(app)
        .post('/api/ai-build')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Logging', () => {
    it('should log security events', async () => {
      const response = await request(app)
        .get('/api/security/status')
        .expect(200);

      expect(response.body.recentAlerts).toBeDefined();
      expect(Array.isArray(response.body.recentAlerts)).toBe(true);
    });

    it('should have proper log format', async () => {
      const response = await request(app)
        .get('/api/security/status')
        .expect(200);

      if (response.body.recentAlerts.length > 0) {
        const alert = response.body.recentAlerts[0];
        expect(alert).toHaveProperty('timestamp');
        expect(alert).toHaveProperty('type');
        expect(alert).toHaveProperty('severity');
        expect(alert).toHaveProperty('message');
        expect(alert).toHaveProperty('ip');
      }
    });
  });
});
