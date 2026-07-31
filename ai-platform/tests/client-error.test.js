/**
 * Tests for client-error.cjs
 */

const {
  isProduction,
  toClientError,
  clientErrorPayload,
  sendClientError,
  ERROR_CODES,
} = require('../server/lib/client-error.cjs');

describe('client-error', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  describe('isProduction', () => {
    test('returns true when NODE_ENV=production', () => {
      process.env.NODE_ENV = 'production';
      expect(isProduction()).toBe(true);
    });

    test('returns false when NODE_ENV=development', () => {
      process.env.NODE_ENV = 'development';
      expect(isProduction()).toBe(false);
    });

    test('returns false when NODE_ENV is unset', () => {
      delete process.env.NODE_ENV;
      expect(isProduction()).toBe(false);
    });

    test('is case-insensitive', () => {
      process.env.NODE_ENV = 'Production';
      expect(isProduction()).toBe(true);
      process.env.NODE_ENV = 'PRODUCTION';
      expect(isProduction()).toBe(true);
    });
  });

  describe('toClientError', () => {
    test('returns fallback for falsy error', () => {
      expect(toClientError(null, 'fallback')).toBe('fallback');
      expect(toClientError(undefined, 'fallback')).toBe('fallback');
      expect(toClientError('', 'fallback')).toBe('fallback');
    });

    test('returns string error directly in dev', () => {
      process.env.NODE_ENV = 'development';
      expect(toClientError('something broke')).toBe('something broke');
    });

    test('returns error.message in dev', () => {
      process.env.NODE_ENV = 'development';
      expect(toClientError(new Error('boom'))).toBe('boom');
    });

    test('returns fallback in production', () => {
      process.env.NODE_ENV = 'production';
      expect(toClientError(new Error('sensitive'))).toBe('An unexpected error occurred');
    });

    test('returns fallback string for custom fallback', () => {
      process.env.NODE_ENV = 'production';
      expect(toClientError(new Error('sensitive'), 'Custom fallback')).toBe('Custom fallback');
    });

    test('returns path-safety message even in production', () => {
      process.env.NODE_ENV = 'production';
      const msg = 'Path is outside allowed analysis roots. Requested: /etc.';
      expect(toClientError(new Error(msg))).toBe(msg);
      expect(toClientError(msg)).toBe(msg);
    });

    test('uses fallback when error has no message', () => {
      process.env.NODE_ENV = 'development';
      expect(toClientError({})).toBe('An unexpected error occurred');
    });
  });

  describe('clientErrorPayload', () => {
    test('builds basic payload', () => {
      const payload = clientErrorPayload(new Error('oops'));
      expect(payload.error).toBe('Request failed');
      expect(payload.message).toBe('oops');
    });

    test('uses custom fallback', () => {
      const payload = clientErrorPayload(null, { fallback: 'nothing' });
      expect(payload.message).toBe('nothing');
    });

    test('uses custom errorLabel', () => {
      const payload = clientErrorPayload(new Error('x'), { errorLabel: 'Scan failed' });
      expect(payload.error).toBe('Scan failed');
    });

    test('includes requestId when provided', () => {
      const payload = clientErrorPayload(new Error('x'), { requestId: 'req-123' });
      expect(payload.requestId).toBe('req-123');
    });

    test('merges extra object', () => {
      const payload = clientErrorPayload(new Error('x'), { extra: { code: 42, details: 'more' } });
      expect(payload.code).toBe(42);
      expect(payload.details).toBe('more');
    });

    test('does not merge non-object extra', () => {
      const payload = clientErrorPayload(new Error('x'), { extra: 'string' });
      expect(payload.code).toBeUndefined();
    });
  });

  describe('sendClientError', () => {
    test('sends JSON with status', () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      sendClientError(res, 400, new Error('bad'));
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Request failed',
          message: expect.any(String),
        })
      );
    });

    test('passes options through', () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      sendClientError(res, 500, new Error('fail'), { errorLabel: 'Server error' });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Server error',
        })
      );
    });
  });

  describe('ERROR_CODES', () => {
    test('contains expected error codes', () => {
      expect(ERROR_CODES.ERR_OUTREACH_MISSING_ID).toBe('missing_id');
      expect(ERROR_CODES.ERR_OUTREACH_LOG_NOT_FOUND).toBe('not_found');
      expect(ERROR_CODES.ERR_INVALID_EMAIL).toBe('invalid_email');
      expect(ERROR_CODES.ERR_EMAIL_SEND_FAILED).toBe('email_send_failed');
    });
  });
});
