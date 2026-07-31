const {
  safeStringify,
  safeJsonParse,
  safeAsync,
  formatCurrency,
  formatDateISO,
  generateInvoiceId,
  maskEmail,
  sanitizeFilename,
  pick,
  omit,
  pluck,
  groupBy,
} = require('../billing-utils.cjs');

describe('billing-utils', () => {
  describe('safeStringify', () => {
    test('stringifies plain object', () => {
      expect(safeStringify({ a: 1 })).toContain('"a": 1');
    });
    test('handles circular reference', () => {
      const obj = { a: 1 };
      obj.self = obj;
      expect(safeStringify(obj)).toContain('[Circular]');
    });
  });

  describe('safeJsonParse', () => {
    test('parses valid JSON', () => {
      expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
    });
    test('returns fallback for invalid JSON', () => {
      expect(safeJsonParse('not json', null)).toBe(null);
    });
  });

  describe('safeAsync', () => {
    test('resolves successful promise', async () => {
      const result = await safeAsync((x) => x * 2, 5);
      expect(result.result).toBe(10);
      expect(result.error).toBeNull();
    });
    test('catches rejected promise', async () => {
      const result = await safeAsync(() => {
        throw new Error('fail');
      });
      expect(result.result).toBeNull();
      expect(result.error.message).toBe('fail');
    });
  });

  describe('formatCurrency', () => {
    test('formats USD cents', () => {
      expect(formatCurrency(1999, 'usd')).toBe('$19.99');
    });
    test('returns placeholder for invalid', () => {
      expect(formatCurrency('abc')).toBe('$—');
    });
  });

  describe('formatDateISO', () => {
    test('formats Date object', () => {
      const d = new Date('2024-01-15');
      expect(formatDateISO(d).startsWith('2024-01-15')).toBe(true);
    });
    test('formats string date', () => {
      expect(formatDateISO('2024-06-01').startsWith('2024-06-01')).toBe(true);
    });
  });

  describe('generateInvoiceId', () => {
    test('has INV- prefix', () => {
      expect(generateInvoiceId().startsWith('INV-')).toBe(true);
    });
  });

  describe('maskEmail', () => {
    test('masks local part', () => {
      expect(maskEmail('alice@example.com')).toBe('a***e@example.com');
    });
    test('returns *** for invalid', () => {
      expect(maskEmail('not-an-email')).toBe('***');
    });
  });

  describe('sanitizeFilename', () => {
    test('replaces bad chars', () => {
      expect(sanitizeFilename('foo:bar')).toBe('foo-bar');
    });
    test('caps at 200 chars', () => {
      expect(sanitizeFilename('a'.repeat(300)).length).toBe(200);
    });
  });

  describe('pick', () => {
    test('selects specified keys', () => {
      expect(pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ a: 1, c: 3 });
    });
    test('returns empty for null', () => {
      expect(pick(null, ['a'])).toEqual({});
    });
  });

  describe('omit', () => {
    test('removes specified keys', () => {
      expect(omit({ a: 1, b: 2, c: 3 }, ['b'])).toEqual({ a: 1, c: 3 });
    });
    test('returns empty for null', () => {
      expect(omit(null, ['a'])).toEqual({});
    });
  });

  describe('pluck', () => {
    test('extracts key values', () => {
      expect(pluck([{ id: 1 }, { id: 2 }], 'id')).toEqual([1, 2]);
    });
    test('returns empty for non-array', () => {
      expect(pluck(null, 'id')).toEqual([]);
    });
  });

  describe('groupBy', () => {
    test('groups by key function', () => {
      const map = groupBy([{ t: 'a' }, { t: 'b' }, { t: 'a' }], (x) => x.t);
      expect(map.get('a').length).toBe(2);
      expect(map.get('b').length).toBe(1);
    });
    test('returns empty map for non-array', () => {
      expect(groupBy(null, () => 'x').size).toBe(0);
    });
  });
});
