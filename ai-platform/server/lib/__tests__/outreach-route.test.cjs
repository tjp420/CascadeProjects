'use strict';

jest.mock('../outreach-mail.cjs', () => ({
  getOutreachFrom: jest.fn().mockReturnValue('outreach@simplebeacon.ai'),
  getOutreachReplyTo: jest.fn().mockReturnValue('outreach@simplebeacon.ai'),
  isOutreachConfigured: jest.fn().mockReturnValue(false),
  loadSentLog: jest.fn().mockResolvedValue([]),
  removeSentLogEntry: jest.fn(),
  sentEntryId: jest.fn().mockReturnValue('id-1'),
  sendOutreachEmail: jest.fn(),
}));
jest.mock('../outreach-resend-webhook.cjs', () => ({
  setupOutreachResendWebhook: jest.fn(),
}));

const {
  OUTREACH_ROUTE_PREFIXES,
  registerOutreachRoutes,
  handleOutreachConfig,
  handleOutreachSend,
  handleOutreachSent,
  handleOutreachSentDelete,
} = require('../outreach-route.cjs');
const {
  isOutreachConfigured,
  getOutreachFrom,
  loadSentLog,
  sendOutreachEmail,
} = require('../outreach-mail.cjs');

function mockRes() {
  return { json: jest.fn().mockReturnThis(), status: jest.fn().mockReturnThis() };
}

describe('outreach-route', () => {
  beforeEach(() => jest.clearAllMocks());

  test('exports expected functions and constants', () => {
    expect(OUTREACH_ROUTE_PREFIXES).toBeDefined();
    expect(typeof registerOutreachRoutes).toBe('function');
    expect(typeof handleOutreachConfig).toBe('function');
    expect(typeof handleOutreachSend).toBe('function');
    expect(typeof handleOutreachSent).toBe('function');
    expect(typeof handleOutreachSentDelete).toBe('function');
  });

  test('handleOutreachConfig returns config JSON', async () => {
    const res = mockRes();
    await handleOutreachConfig({}, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        configured: false,
        from: 'outreach@simplebeacon.ai',
      })
    );
  });

  test('handleOutreachSent returns sent log items', async () => {
    loadSentLog.mockResolvedValue([
      { id: '1', to: 'a@b.com' },
      { id: '2', to: 'c@d.com' },
    ]);
    const res = mockRes();
    await handleOutreachSent({ query: { limit: '10' } }, res, {});
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 2,
        items: expect.any(Array),
      })
    );
  });

  test('handleOutreachSent respects limit', async () => {
    loadSentLog.mockResolvedValue(Array.from({ length: 50 }, (_, i) => ({ id: String(i) })));
    const res = mockRes();
    await handleOutreachSent({ query: { limit: '5' } }, res, {});
    const call = res.json.mock.calls[0][0];
    expect(call.items).toHaveLength(5);
  });

  test('registerOutreachRoutes registers routes on app', () => {
    const app = { get: jest.fn(), post: jest.fn(), delete: jest.fn() };
    registerOutreachRoutes(app, {});
    expect(app.get).toHaveBeenCalled();
    expect(app.post).toHaveBeenCalled();
  });
});
