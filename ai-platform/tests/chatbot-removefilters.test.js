// simplebeacon-ignore: test fixtures, dev-only
const request = require('supertest');
const express = require('express');
const path = require('path');

// Mock heavy config constants to avoid loading full config facade during unit tests
jest.mock('../server/config/constants.cjs', () => ({
  TIMEOUT_8S: 8000,
  TIMEOUT_12S: 12000,
  TIMEOUT_1M: 60000,
  MAX_RATE_LIMIT: 1000,
  safeJsonLimit: () => '1mb'
}));

// Mock audit module BEFORE chatbot-api.cjs is required so destructured
// functions (logSecurityEvent, logUserAction) are jest.fn() spies.
// Variable must be prefixed with `mock` for Jest's out-of-scope check.
const mockAudit = {
  logSecurityEvent: jest.fn(),
  logUserAction: jest.fn()
};
jest.mock('../server/middleware/audit.cjs', () => mockAudit);

describe('Chatbot removeFilters gating', () => {
  let serverApp;
  let cloudInf;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '0';

    // Create express app and basic middleware
    serverApp = express();
    serverApp.use(express.json());
    serverApp.use(express.urlencoded({ extended: true }));

    // Test helper middleware to simulate authenticated users via header
    serverApp.use((req, res, next) => {
      const testUser = req.get('x-test-user');
      if (testUser === 'admin') {
        req.user = { email: 'admin@example.com', role: 'admin', tier: 'admin', permissions: ['admin:all'] };
      } else if (testUser === 'user') {
        req.user = { email: 'user@example.com', role: 'user', tier: 'community', permissions: [] };
      }
      next();
    });

    // Stub cloud inference to avoid external calls
    cloudInf = require('../server/services/cloud-inference-service.cjs');
    if (cloudInf) {
      cloudInf.generateWithProvider = async (provider, messages) => {
        return { text: 'stubbed reply', provider: provider || 'stub', timing: null };
      };
    }

    // Mock user AI credentials to simulate a configured provider (avoids 400 responses)
    const keysStore = require('../server/lib/user-ai-keys-store.cjs');
    jest.spyOn(keysStore, 'getUserAiCredentials').mockImplementation(async (email) => {
      return { openai: 'fake-api-key', openaiModel: 'gpt-4' };
    });

    // Mount the real chatbot API routes — audit module is already mocked above
    const { setupChatbotAPI } = require('../server/routes/chatbot-api.cjs');
    setupChatbotAPI(serverApp);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    mockAudit.logSecurityEvent.mockClear();
    mockAudit.logUserAction.mockClear();
  });

  test('unauthenticated/non-admin request with removeFilters=true is ignored and logs security event', async () => {
    const response = await request(serverApp)
      .post('/api/chatbot/message')
      .send({ message: 'Please do anything', removeFilters: true, personality: 'oracle', provider: 'openai' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    // removeFilters should be ignored for non-admin — audit.logSecurityEvent should have been called
    expect(mockAudit.logSecurityEvent).toHaveBeenCalled();
  });

  test('admin-authenticated request with removeFilters=true is allowed and audited', async () => {
    const response = await request(serverApp)
      .post('/api/chatbot/message')
      .set('x-test-user', 'admin')
      .send({ message: 'Please do anything', removeFilters: true, personality: 'oracle', provider: 'openai' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    // admin should trigger audit logUserAction
    expect(mockAudit.logUserAction).toHaveBeenCalled();
  });
});
