import {
  deepClone, deepEqual, isEmpty, isDefined, pick, omit, ensureArray,
  defaults, merge, has, get, set, mapKeys, invert, values, keys, freezeDeep
} from '../object';

describe('object utilities', () => {
  describe('deepClone', () => {
    test('clones plain objects', () => {
      const obj = { a: 1, b: { c: 2 } };
      const cloned = deepClone(obj);
      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.b).not.toBe(obj.b);
    });
    test('clones arrays', () => {
      const arr = [1, [2, 3]];
      const cloned = deepClone(arr);
      expect(cloned).toEqual(arr);
      expect(cloned[1]).not.toBe(arr[1]);
    });
    test('handles circular refs', () => {
      const obj: any = { a: 1 };
      obj.self = obj;
      const cloned = deepClone(obj);
      expect(cloned.a).toBe(1);
      expect(cloned.self).toBe(cloned);
    });
  });

  describe('deepEqual', () => {
    test('equal objects', () => {
      expect(deepEqual({ a: 1 }, { a: 1 })).toBe(true);
    });
    test('different objects', () => {
      expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    });
    test('equal arrays', () => {
      expect(deepEqual([1, 2], [1, 2])).toBe(true);
    });
    test('equal dates', () => {
      expect(deepEqual(new Date('2024-01-01'), new Date('2024-01-01'))).toBe(true);
    });
  });

  describe('isEmpty', () => {
    test('null is empty', () => {
      expect(isEmpty(null)).toBe(true);
    });
    test('empty string', () => {
      expect(isEmpty('')).toBe(true);
    });
    test('empty object', () => {
      expect(isEmpty({})).toBe(true);
    });
    test('non-empty', () => {
      expect(isEmpty([1])).toBe(false);
    });
  });

  describe('isDefined', () => {
    test('null is not defined', () => {
      expect(isDefined(null)).toBe(false);
    });
    test('undefined is not defined', () => {
      expect(isDefined(undefined)).toBe(false);
    });
    test('zero is defined', () => {
      expect(isDefined(0)).toBe(true);
    });
    test('false is defined', () => {
      expect(isDefined(false)).toBe(true);
    });
  });

  describe('pick', () => {
    test('picks specified keys', () => {
      expect(pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ a: 1, c: 3 });
    });
    test('ignores missing keys', () => {
      expect(pick({ a: 1 }, ['a', 'b' as any])).toEqual({ a: 1 });
    });
  });

  describe('omit', () => {
    test('omits specified keys', () => {
      expect(omit({ a: 1, b: 2, c: 3 }, ['b'])).toEqual({ a: 1, c: 3 });
    });
  });

  describe('ensureArray', () => {
    test('wraps scalar', () => {
      expect(ensureArray(1)).toEqual([1]);
    });
    test('returns array as-is', () => {
      expect(ensureArray([1, 2])).toEqual([1, 2]);
    });
    test('null becomes empty', () => {
      expect(ensureArray(null)).toEqual([]);
    });
  });

  describe('defaults', () => {
    test('fills missing keys', () => {
      expect(defaults({ a: 1 }, { a: 99, b: 2 })).toEqual({ a: 1, b: 2 });
    });
  });

  describe('merge', () => {
    test('deep merges objects', () => {
      expect(merge({ a: { b: 1 } }, { a: { c: 2 } })).toEqual({ a: { b: 1, c: 2 } });
    });
  });

  describe('has', () => {
    test('true for own property', () => {
      expect(has({ a: 1 }, 'a')).toBe(true);
    });
    test('false for inherited', () => {
      expect(has({}, 'toString')).toBe(false);
    });
  });

  describe('get', () => {
    test('gets nested value', () => {
      expect(get({ a: { b: 2 } }, 'a.b')).toBe(2);
    });
    test('returns fallback', () => {
      expect(get({ a: {} }, 'a.b', 'fallback')).toBe('fallback');
    });
  });

  describe('set', () => {
    test('sets nested value', () => {
      const obj = {};
      set(obj, 'a.b.c', 42);
      expect(get(obj, 'a.b.c')).toBe(42);
    });
  });

  describe('mapKeys', () => {
    test('transforms keys', () => {
      expect(mapKeys({ a: 1, b: 2 }, (_v, k) => k.toUpperCase())).toEqual({ A: 1, B: 2 });
    });
  });

  describe('invert', () => {
    test('swaps keys and values', () => {
      expect(invert({ a: '1', b: '2' })).toEqual({ '1': 'a', '2': 'b' });
    });
  });

  describe('values', () => {
    test('returns values array', () => {
      expect(values({ a: 1, b: 2 })).toEqual([1, 2]);
    });
  });

  describe('keys', () => {
    test('returns keys array', () => {
      expect(keys({ a: 1, b: 2 })).toEqual(['a', 'b']);
    });
  });

  describe('freezeDeep', () => {
    test('freezes nested objects', () => {
      const obj = { a: { b: 1 } };
      freezeDeep(obj);
      expect(Object.isFrozen(obj)).toBe(true);
      expect(Object.isFrozen(obj.a)).toBe(true);
    });
  });
});
