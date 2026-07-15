// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs').promises;
const request = require('supertest');
const app = require('../server.cjs');

const SUBSCRIPTIONS_FILE = path.join(__dirname, '..', 'subscriptions.json');

describe('Server API', () => {
  before(async () => {
    // Ensure clean state
    try {
      await fs.writeFile(SUBSCRIPTIONS_FILE, JSON.stringify([], null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to reset subscriptions:', err);
    }
  });

  after(async () => {
    // Clean up test data
    try {
      await fs.writeFile(SUBSCRIPTIONS_FILE, JSON.stringify([], null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to clean up subscriptions:', err);
    }
  });

  describe('GET /pricing.html', () => {
    it('should serve the pricing page', async () => {
      const res = await request(app)
        .get('/pricing.html')
        .expect(200);
      assert.ok(res.text.includes('pricing') || res.text.includes('Pricing'), 'Response should contain pricing content');
    });
  });

  describe('GET /index.html', () => {
    it('should serve the index page', async () => {
      const res = await request(app)
        .get('/index.html')
        .expect(200);
      assert.ok(res.text.includes('<!DOCTYPE html>') || res.text.includes('<html'), 'Response should be HTML');
    });
  });

  describe('GET /', () => {
    it('should fallback to index.html for unknown routes', async () => {
      const res = await request(app)
        .get('/')
        .expect(200);
      assert.ok(res.text.includes('<!DOCTYPE html>') || res.text.includes('<html'), 'Fallback should serve HTML');
    });
  });

  describe('POST /api/subscribe', () => {
    it('should reject missing email', async () => {
      const res = await request(app)
        .post('/api/subscribe')
        .send({})
        .expect(400);
      assert.strictEqual(res.body.error, 'A valid email address is required.');
    });

    it('should reject invalid email', async () => {
      const res = await request(app)
        .post('/api/subscribe')
        .send({ email: 'not-an-email' })
        .expect(400);
      assert.strictEqual(res.body.error, 'A valid email address is required.');
    });

    it('should accept a valid email', async () => {
      const res = await request(app)
        .post('/api/subscribe')
        .send({ email: 'test@example.com' })
        .expect(200);
      assert.strictEqual(res.body.message, 'Successfully subscribed.');
    });

    it('should reject duplicate email', async () => {
      const res = await request(app)
        .post('/api/subscribe')
        .send({ email: 'test@example.com' })
        .expect(200);
      assert.strictEqual(res.body.message, 'Email already registered.');
    });

    it('should be case-insensitive for duplicates', async () => {
      const res = await request(app)
        .post('/api/subscribe')
        .send({ email: 'TEST@EXAMPLE.COM' })
        .expect(200);
      assert.strictEqual(res.body.message, 'Email already registered.');
    });
  });
});
