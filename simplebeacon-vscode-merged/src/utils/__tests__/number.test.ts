import {
  clamp, formatBytes, formatNumber, safeParseInt, safeParseFloat,
  roundTo, toFixedNumber, isNumeric, randomInt,
  sum, mean, min, max, sumBy, meanBy
} from '../number';

describe('number utilities', () => {
  describe('clamp', () => {
    test('within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });
    test('below min', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });
    test('above max', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('formatBytes', () => {
    test('formats bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });
    test('formats KB', () => {
      expect(formatBytes(1536)).toBe('1.5 KB');
    });
    test('handles null', () => {
      expect(formatBytes(null)).toBe('—');
    });
  });

  describe('formatNumber', () => {
    test('adds locale separators', () => {
      expect(formatNumber(1234567)).toBe('1,234,567');
    });
  });

  describe('safeParseInt', () => {
    test('parses integer', () => {
      expect(safeParseInt('42')).toBe(42);
    });
    test('fallback on NaN', () => {
      expect(safeParseInt('abc', 99)).toBe(99);
    });
  });

  describe('safeParseFloat', () => {
    test('parses float', () => {
      expect(safeParseFloat('3.14')).toBe(3.14);
    });
  });

  describe('roundTo', () => {
    test('rounds to decimals', () => {
      expect(roundTo(3.14159, 2)).toBe(3.14);
    });
  });

  describe('toFixedNumber', () => {
    test('returns number not string', () => {
      expect(toFixedNumber(3.14159, 2)).toBe(3.14);
      expect(typeof toFixedNumber(3.14159, 2)).toBe('number');
    });
  });

  describe('isNumeric', () => {
    test('true for number', () => {
      expect(isNumeric(42)).toBe(true);
    });
    test('true for numeric string', () => {
      expect(isNumeric('42')).toBe(true);
    });
    test('false for non-numeric', () => {
      expect(isNumeric('abc')).toBe(false);
    });
  });

  describe('randomInt', () => {
    test('returns integer in range', () => {
      const r = randomInt(1, 10);
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(10);
      expect(Number.isInteger(r)).toBe(true);
    });
  });

  describe('sum', () => {
    test('sums array', () => {
      expect(sum([1, 2, 3])).toBe(6);
    });
    test('zero for empty', () => {
      expect(sum([])).toBe(0);
    });
  });

  describe('mean', () => {
    test('calculates mean', () => {
      expect(mean([1, 2, 3])).toBe(2);
    });
    test('NaN for empty', () => {
      expect(mean([])).toBeNaN();
    });
  });

  describe('min', () => {
    test('finds minimum', () => {
      expect(min([3, 1, 2])).toBe(1);
    });
  });

  describe('max', () => {
    test('finds maximum', () => {
      expect(max([3, 1, 2])).toBe(3);
    });
  });

  describe('sumBy', () => {
    test('sums extracted values', () => {
      expect(sumBy([{ v: 1 }, { v: 2 }, { v: 3 }], (x) => x.v)).toBe(6);
    });
  });

  describe('meanBy', () => {
    test('calculates mean of extracted values', () => {
      expect(meanBy([{ v: 1 }, { v: 2 }, { v: 3 }], (x) => x.v)).toBe(2);
    });
  });
});
