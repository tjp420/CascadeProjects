// simplebeacon-ignore: test fixtures, dev-only
const request = require('supertest');
const express = require('express');
const { clearChatbotMockMode } = require('./helpers/chatbot-mock-env.js');

// Prevent prompt-firewall from blocking test messages — force allow verdict
jest.mock('../server/lib/prompt-firewall.cjs', () => ({
  analyzePrompt: jest.fn(() => ({ verdict: 'allow', text: '', matches: [], summary: '' })),
  shouldBlockPrompt: jest.fn(() => false),
}));

jest.mock('../server/config/constants.cjs', () => ({
  TIMEOUT_8S: 8000,
  TIMEOUT_12S: 12000,
  TIMEOUT_1M: 60000,
  MAX_RATE_LIMIT: 1000,
  safeJsonLimit: () => '1mb',
}));

describe('Chatbot knowledge injection', () => {
  let serverApp;
  let chatbotApi;
  let cloudInf;
  let generateSpy;
  let audit;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '0';
    process.env.OPENAI_API_KEY = 'test-key';
    clearChatbotMockMode();

    serverApp = express();
    serverApp.use(express.json());
    serverApp.use(express.urlencoded({ extended: true }));

    audit = require('../server/middleware/audit.cjs');
    jest.spyOn(audit, 'logSecurityEvent').mockImplementation(() => {});
    jest.spyOn(audit, 'logUserAction').mockImplementation(() => {});

    // Prevent prompt-firewall from blocking test messages — force allow verdict
    jest.mock('../server/lib/prompt-firewall.cjs', () => ({
      analyzePrompt: jest.fn(() => ({ verdict: 'allow', text: '', matches: [], summary: '' })),
      shouldBlockPrompt: jest.fn(() => false),
    }));

    cloudInf = require('../server/services/cloud-inference-service.cjs');
    generateSpy = jest.fn(async (provider, messages) => ({
      text: 'stubbed reply',
      provider: provider || 'stub',
      timing: null,
    }));
    cloudInf.generateWithProvider = generateSpy;

    chatbotApi = require('../server/routes/chatbot-api.cjs');
    chatbotApi.setupChatbotAPI(serverApp);
  });

  afterAll(() => {
    jest.restoreAllMocks();
    delete process.env.OPENAI_API_KEY;
    clearChatbotMockMode();
  });

  test('getRelevantKnowledge matches remove-filters triggers', () => {
    const result = chatbotApi.getRelevantKnowledge('how do I remove filters from MobileNetV2?');
    expect(result).toContain('[remove-filters-vs-top-layers]');
    expect(result).toContain('include_top=False');
  });

  test('getRelevantKnowledge returns empty for unrelated messages', () => {
    const result = chatbotApi.getRelevantKnowledge('what is the weather today?');
    expect(result).toBe('');
  });

  test('chatbot API injects knowledge into system prompt for matching message', async () => {
    const response = await request(serverApp).post('/api/chatbot/message').send({
      message: 'How do I remove filters from MobileNetV2?',
      provider: 'openai',
      personality: 'helpful',
    });
    // Debug: print response for failing case
    // eslint-disable-next-line no-console
    console.log('TEST RESPONSE BODY:', response.status, JSON.stringify(response.body));
    expect(response.status).toBe(200);
    expect(generateSpy).toHaveBeenCalled();
    const messages = generateSpy.mock.calls[0][1];
    const systemMessage = messages.find((m) => m.role === 'system');
    expect(systemMessage.content).toContain('[Domain Knowledge]');
    expect(systemMessage.content).toContain('include_top=False');
  });
});
