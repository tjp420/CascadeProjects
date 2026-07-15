'use strict';

jest.mock('../eu-ai-act-sprint-service.cjs', () => ({
  runEuAiActSprint: jest.fn()
}));
jest.mock('../flexible-analyze-utils.cjs', () => ({
  resolveProjectPath: jest.fn()
}));

const { registerEuAiActSprintRoute } = require('../eu-ai-act-sprint-route.cjs');
const { runEuAiActSprint } = require('../eu-ai-act-sprint-service.cjs');
const { resolveProjectPath } = require('../flexible-analyze-utils.cjs');

function createMockApp() {
  const routes = {};
  return {
    get: jest.fn((path, handler) => { routes[`GET ${path}`] = handler; }),
    post: jest.fn((path, handler) => { routes[`POST ${path}`] = handler; }),
    _routes: routes
  };
}

describe('eu-ai-act-sprint-route', () => {
  test('exports registerEuAiActSprintRoute function', () => {
    expect(typeof registerEuAiActSprintRoute).toBe('function');
  });

  test('registerEuAiActSprintRoute registers GET and POST routes', () => {
    const app = createMockApp();
    registerEuAiActSprintRoute(app, {});
    expect(app.get).toHaveBeenCalledWith('/api/operator/eu-ai-act/bootstrap', expect.any(Function));
    expect(app.post).toHaveBeenCalledWith('/api/operator/eu-ai-act/sprint', expect.any(Function));
  });

  test('bootstrap endpoint returns expected JSON', () => {
    const app = createMockApp();
    registerEuAiActSprintRoute(app, {});
    const handler = app._routes['GET /api/operator/eu-ai-act/bootstrap'];
    const res = { json: jest.fn() };
    handler({}, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      sku: 'euai2499',
      label: expect.stringContaining('EU AI Act')
    }));
  });

  test('sprint POST returns 400 when no path provided', async () => {
    const app = createMockApp();
    registerEuAiActSprintRoute(app, {});
    const handler = app._routes['POST /api/operator/eu-ai-act/sprint'];
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await handler({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'missing_path' }));
  });

  test('sprint POST calls runEuAiActSprint when path resolves', async () => {
    resolveProjectPath.mockReturnValue('/resolved/path');
    runEuAiActSprint.mockResolvedValue({ ok: true, artifacts: {} });
    const app = createMockApp();
    registerEuAiActSprintRoute(app, {});
    const handler = app._routes['POST /api/operator/eu-ai-act/sprint'];
    const res = { json: jest.fn() };
    await handler({ body: { projectPath: '/test' } }, res);
    expect(runEuAiActSprint).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });
});
