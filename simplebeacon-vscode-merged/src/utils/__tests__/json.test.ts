import { parseJsonSafe, parseResponseJson, stringifySafe, isJson } from '../json';

describe('json utilities', () => {
  describe('parseJsonSafe', () => {
    test('parses valid JSON', () => {
      expect(parseJsonSafe('{"a":1}', {})).toEqual({ a: 1 });
    });
    test('returns fallback on invalid', () => {
      expect(parseJsonSafe('not json', 'fallback')).toBe('fallback');
    });
    test('returns fallback on null', () => {
      expect(parseJsonSafe(null as any, 'fallback')).toBe('fallback');
    });
  });

  describe('stringifySafe', () => {
    test('stringifies object', () => {
      expect(stringifySafe({ a: 1 })).toBe('{"a":1}');
    });
    test('handles circular ref', () => {
      const obj: any = { a: 1 };
      obj.self = obj;
      expect(stringifySafe(obj)).toContain('[Circular]');
    });
  });

  describe('isJson', () => {
    test('true for valid JSON string', () => {
      expect(isJson('{"a":1}')).toBe(true);
    });
    test('false for invalid', () => {
      expect(isJson('not json')).toBe(false);
    });
  });

  describe('parseResponseJson', () => {
    test('parses JSON response', async () => {
      const res = {
        headers: { get: () => 'application/json' },
        text: async () => '{"a":1}',
      } as any as Response;
      const data = await parseResponseJson(res);
      expect(data).toEqual({ a: 1 });
    });

    test('returns fallback for non-JSON content type', async () => {
      const res = {
        headers: { get: () => 'text/html' },
        text: async () => '<html></html>',
      } as any as Response;
      const data = await parseResponseJson(res);
      expect(data).toEqual({});
    });

    test('returns fallback on JSON parse error', async () => {
      const res = {
        headers: { get: () => 'application/json' },
        text: async () => 'not valid json',
      } as any as Response;
      const data = await parseResponseJson(res, 'fallback');
      expect(data).toBe('fallback');
    });

    test('returns custom fallback when body empty', async () => {
      const res = {
        headers: { get: () => 'application/json' },
        text: async () => '',
      } as any as Response;
      const data = await parseResponseJson(res, { empty: true });
      expect(data).toEqual({ empty: true });
    });
  });
});
