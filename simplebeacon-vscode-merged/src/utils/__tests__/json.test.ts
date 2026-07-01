import { parseJsonSafe, stringifySafe, isJson } from '../json';

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
});
