const { toClientError, clientErrorPayload } = require('../../server/lib/client-error');

describe('client-error', () => {
    const originalEnv = process.env;

    afterEach(() => {
        process.env = originalEnv;
    });

    test('toClientError hides internal messages in production', () => {
        process.env = { ...originalEnv, NODE_ENV: 'production' };
        expect(toClientError(new Error('database connection refused'), 'Request failed')).toBe('Request failed');
    });

    test('toClientError exposes messages in development', () => {
        process.env = { ...originalEnv, NODE_ENV: 'development' };
        expect(toClientError(new Error('database connection refused'))).toBe('database connection refused');
    });

    test('toClientError exposes path allowlist errors in production', () => {
        process.env = { ...originalEnv, NODE_ENV: 'production' };
        const message = 'projectPath is outside allowed analysis roots. Requested: C:\\outside';
        expect(toClientError(new Error(message), 'Invalid projectPath')).toBe(message);
    });

    test('clientErrorPayload includes requestId when provided', () => {
        process.env = { ...originalEnv, NODE_ENV: 'production' };
        const payload = clientErrorPayload(new Error('secret'), {
            fallback: 'Request failed',
            requestId: 'req-123'
        });
        expect(payload.message).toBe('Request failed');
        expect(payload.requestId).toBe('req-123');
    });
});
