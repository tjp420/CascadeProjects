// simplebeacon-ignore: test fixtures, dev-only
const request = require('supertest');
const express = require('express');
const { setChatbotMockMode, clearChatbotMockMode } = require('./helpers/chatbot-mock-env.js');

jest.mock('../server/config/constants.cjs', () => ({
  TIMEOUT_8S: 8000,
  TIMEOUT_12S: 12000,
  TIMEOUT_1M: 60000,
  MAX_RATE_LIMIT: 1000,
  safeJsonLimit: () => '1mb',
}));

jest.mock('../server/middleware/audit.cjs', () => ({
  logSecurityEvent: () => {},
  logUserAction: () => {},
}));

describe('Chatbot mock provider mode', () => {
  let serverApp;
  let chatbotApi;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '0';
    setChatbotMockMode(true);

    serverApp = express();
    serverApp.use(express.json());
    serverApp.use(express.urlencoded({ extended: true }));

    chatbotApi = require('../server/routes/chatbot-api.cjs');
    chatbotApi.setupChatbotAPI(serverApp);
  });

  afterAll(() => {
    jest.restoreAllMocks();
    clearChatbotMockMode();
  });

  test('POST /api/chatbot/message returns mock response without API keys', async () => {
    const res = await request(serverApp)
      .post('/api/chatbot/message')
      .send({ message: 'Hello world', provider: 'openai', personality: 'helpful' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.mock).toBe(true);
    expect(res.body.provider).toBe('mock');
    expect(res.body.response).toContain('[MOCK]');
    expect(res.body.response).toContain('Hello world');
  });

  test('POST /api/chatbot/message respects personality in mock response', async () => {
    const res = await request(serverApp)
      .post('/api/chatbot/message')
      .send({ message: 'test', provider: 'ollama', personality: 'sarcastic' });
    expect(res.status).toBe(200);
    expect(res.body.response).toContain('[MOCK]');
    expect(res.body.response).toContain('witty');
  });

  test('POST /api/chatbot/message still validates empty messages in mock mode', async () => {
    const res = await request(serverApp)
      .post('/api/chatbot/message')
      .send({ message: '', provider: 'openai' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Message is required');
  });

  test('POST /api/chatbot/message still validates invalid providers in mock mode', async () => {
    const res = await request(serverApp)
      .post('/api/chatbot/message')
      .send({ message: 'test', provider: 'invalid' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Unsupported provider');
  });

  test('GET /api/chatbot/providers marks all providers as available in mock mode', async () => {
    const res = await request(serverApp).get('/api/chatbot/providers');
    expect(res.status).toBe(200);
    expect(res.body.providers).toHaveLength(3);
    for (const p of res.body.providers) {
      expect(p.available).toBe(true);
    }
    expect(res.body.needsConfiguration).toBe(false);
  });
});

describe('Chatbot message rate limiting', () => {
  let rateApp;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '0';
    setChatbotMockMode(true);

    rateApp = express();
    rateApp.use(express.json());
    rateApp.use(express.urlencoded({ extended: true }));

    const chatbotApi = require('../server/routes/chatbot-api.cjs');
    chatbotApi.setupChatbotAPI(rateApp);
  });

  afterAll(() => {
    clearChatbotMockMode();
  });

  test('POST /api/chatbot/message returns 429 after 30 messages in 1 minute', async () => {
    // Send 30 messages — all should succeed (mock mode)
    for (let i = 0; i < 30; i++) {
      const res = await request(rateApp)
        .post('/api/chatbot/message')
        .send({ message: `msg-${i}`, provider: 'openai' });
      expect(res.status).toBe(200);
    }
    // 31st message should be rate limited
    const res = await request(rateApp)
      .post('/api/chatbot/message')
      .send({ message: 'msg-31', provider: 'openai' });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('rate_limited');
  });
});
