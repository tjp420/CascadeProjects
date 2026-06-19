/* eslint-disable no-constant-binary-expression */
/**
 * Core JavaScript Tests
 *
 * Tests that work without any external dependencies
 */

describe('Core JavaScript Tests', () => {
  describe('Basic Arithmetic', () => {
    test('should add numbers', () => {
      expect(1 + 1).toBe(2);
      expect(2 + 3).toBe(5);
      expect(5 + 7).toBe(12);
    });

    test('should subtract numbers', () => {
      expect(10 - 5).toBe(5);
      expect(7 - 2).toBe(5);
      expect(3 - 1).toBe(2);
    });

    test('should multiply numbers', () => {
      expect(3 * 4).toBe(12);
      expect(5 * 6).toBe(30);
      expect(2 * 8).toBe(16);
    });

    test('should divide numbers', () => {
      expect(8 / 2).toBe(4);
      expect(9 / 3).toBe(3);
      expect(6 / 2).toBe(3);
    });
  });

  describe('String Operations', () => {
    test('should get string length', () => {
      expect('hello'.length).toBe(5);
      expect('world'.length).toBe(5);
      expect(''.length).toBe(0);
    });

    test('should concatenate strings', () => {
      expect('hello' + ' ' + 'world').toBe('hello world');
      expect('a' + 'b' + 'c').toBe('abc');
      expect('test' + '123').toBe('test123');
    });

    test('should convert case', () => {
      expect('TEST'.toLowerCase()).toBe('test');
      expect('test'.toUpperCase()).toBe('TEST');
      expect('Hello'.toUpperCase()).toBe('HELLO');
    });

    test('should check substring', () => {
      expect('hello world'.includes('hello')).toBe(true);
      expect('hello world'.includes('world')).toBe(true);
      expect('hello world'.includes('test')).toBe(false);
    });
  });

  describe('Array Operations', () => {
    test('should create arrays', () => {
      const arr = [1, 2, 3];
      expect(arr.length).toBe(3);
      expect(arr[0]).toBe(1);
      expect(arr[2]).toBe(3);
    });

    test('should push to arrays', () => {
      const arr = [1, 2];
      arr.push(3);
      expect(arr.length).toBe(3);
      expect(arr).toEqual([1, 2, 3]);
    });

    test('should pop from arrays', () => {
      const arr = [1, 2, 3];
      const popped = arr.pop();
      expect(popped).toBe(3);
      expect(arr.length).toBe(2);
    });

    test('should filter arrays', () => {
      const arr = [1, 2, 3, 4, 5];
      const filtered = arr.filter(x => x > 2);
      expect(filtered).toEqual([3, 4, 5]);
    });

    test('should map arrays', () => {
      const arr = [1, 2, 3];
      const mapped = arr.map(x => x * 2);
      expect(mapped).toEqual([2, 4, 6]);
    });
  });

  describe('Object Operations', () => {
    test('should create objects', () => {
      const obj = { name: 'test', value: 42 };
      expect(obj.name).toBe('test');
      expect(obj.value).toBe(42);
    });

    test('should access properties', () => {
      const obj = { a: 1, b: 2, c: 3 };
      expect(obj.a).toBe(1);
      expect(obj.b).toBe(2);
      expect(obj.c).toBe(3);
    });

    test('should check property existence', () => {
      const obj = { name: 'test' };
      expect('name' in obj).toBe(true);
      expect('missing' in obj).toBe(false);
    });

    test('should get keys', () => {
      const obj = { x: 1, y: 2 };
      const keys = Object.keys(obj);
      expect(keys).toEqual(['x', 'y']);
    });
  });

  describe('Boolean Logic', () => {
    test('should handle AND operations', () => {
      expect(true && true).toBe(true);
      expect(true && false).toBe(false);
      expect(false && false).toBe(false);
      expect(false && true).toBe(false);
    });

    test('should handle OR operations', () => {
      expect(true || true).toBe(true);
      expect(true || false).toBe(true);
      expect(false || false).toBe(false);
      expect(false || true).toBe(true);
    });

    test('should handle NOT operations', () => {
      expect(!true).toBe(false);
      expect(!false).toBe(true);
      expect(!!true).toBe(true);
      expect(!!false).toBe(false);
    });
  });

  describe('Type Checking', () => {
    test('should check primitive types', () => {
      expect(typeof 'string').toBe('string');
      expect(typeof 42).toBe('number');
      expect(typeof true).toBe('boolean');
      expect(typeof undefined).toBe('undefined');
      expect(typeof null).toBe('object');
    });

    test('should check array types', () => {
      expect(Array.isArray([])).toBe(true);
      expect(Array.isArray({})).toBe(false);
      expect(Array.isArray('string')).toBe(false);
    });

    test('should check null and undefined', () => {
      const value = null;
      expect(value === null).toBe(true);
      expect(value === undefined).toBe(false);
      
      const undef = undefined;
      expect(undef === null).toBe(false);
      expect(undef === undefined).toBe(true);
    });
  });

  describe('Math Functions', () => {
    test('should use Math.abs', () => {
      expect(Math.abs(-5)).toBe(5);
      expect(Math.abs(5)).toBe(5);
      expect(Math.abs(0)).toBe(0);
    });

    test('should use Math.round', () => {
      expect(Math.round(3.7)).toBe(4);
      expect(Math.round(3.2)).toBe(3);
      expect(Math.round(3.5)).toBe(4);
    });

    test('should use Math.floor and Math.ceil', () => {
      expect(Math.floor(3.7)).toBe(3);
      expect(Math.ceil(3.2)).toBe(4);
      expect(Math.floor(3.5)).toBe(3);
      expect(Math.ceil(3.5)).toBe(4);
    });

    test('should use Math.random', () => {
      const random = Math.random();
      expect(random).toBeGreaterThanOrEqual(0);
      expect(random).toBeLessThan(1);
    });

    test('should use Math.max and Math.min', () => {
      expect(Math.max(1, 2, 3)).toBe(3);
      expect(Math.min(1, 2, 3)).toBe(1);
      expect(Math.max(-1, -2, -3)).toBe(-1);
      expect(Math.min(-1, -2, -3)).toBe(-3);
    });
  });

  describe('Date Operations', () => {
    test('should create dates', () => {
      const date = new Date();
      expect(date instanceof Date).toBe(true);
      expect(date.getFullYear()).toBeGreaterThanOrEqual(2020);
      expect(date.getMonth()).toBeGreaterThanOrEqual(0);
      expect(date.getDate()).toBeGreaterThanOrEqual(1);
    });

    test('should parse dates', () => {
      const date = new Date('2026-06-03T03:48:06.608Z');
      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(5); // June
      expect(date.getUTCDate()).toBe(3); // Use UTC to avoid timezone issues
    });

    test('should format dates', () => {
      const date = new Date('2026-06-03T03:48:06.608Z');
      const iso = date.toISOString();
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('JSON Operations', () => {
    test('should parse JSON', () => {
      const json = '{"name": "test", "value": 42}';
      const parsed = JSON.parse(json);
      expect(parsed.name).toBe('test');
      expect(parsed.value).toBe(42);
    });

    test('should stringify JSON', () => {
      const obj = { name: 'test', value: 42 };
      const json = JSON.stringify(obj);
      expect(json).toContain('"name":"test"');
      expect(json).toContain('"value":42');
    });

    test('should handle JSON errors', () => {
      expect(() => JSON.parse('invalid')).toThrow(SyntaxError);
      expect(JSON.stringify(null)).toBe('null');
      expect(JSON.stringify(undefined)).toBe(undefined);
    });
  });

  describe('Regular Expressions', () => {
    test('should match patterns', () => {
      const regex = /test/;
      expect(regex.test('test')).toBe(true);
      expect(regex.test('testing')).toBe(true);
      expect(regex.test('other')).toBe(false);
    });

    test('should extract matches', () => {
      const regex = /(\d+)/g;
      const matches = 'test 123 test 456'.match(regex);
      expect(matches).toEqual(['123', '456']);
    });

    test('should replace patterns', () => {
      const result = 'hello world'.replace(/world/, 'universe');
      expect(result).toBe('hello universe');
    });
  });

  describe('Error Handling', () => {
    test('should create errors', () => {
      const error = new Error('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('Error');
    });

    test('should throw and catch errors', () => {
      let caught = false;
      try {
        throw new Error('Test error');
      } catch (error) {
        caught = true;
        expect(error.message).toBe('Test error');
      }
      expect(caught).toBe(true);
    });

    test('should use try-catch-finally', () => {
      let result = '';
      try {
        result = 'success';
      } catch (error) {
        result = 'error';
      } finally {
        result = result + '-finally';
      }
      expect(result).toBe('success-finally');
    });
  });

  describe('Promise Operations', () => {
    test('should resolve promises', async () => {
      const promise = Promise.resolve('success');
      const result = await promise;
      expect(result).toBe('success');
    });

    test('should reject promises', async () => {
      const promise = Promise.reject(new Error('failure'));
      try {
        await promise;
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error.message).toBe('failure');
      }
    });

    test('should use Promise.all', async () => {
      const promises = [
        Promise.resolve(1),
        Promise.resolve(2),
        Promise.resolve(3)
      ];
      const results = await Promise.all(promises);
      expect(results).toEqual([1, 2, 3]);
    });
  });

  describe('Set Operations', () => {
    test('should create sets', () => {
      const set = new Set([1, 2, 3]);
      expect(set.size).toBe(3);
      expect(set.has(1)).toBe(true);
      expect(set.has(4)).toBe(false);
    });

    test('should add to sets', () => {
      const set = new Set();
      set.add(1);
      set.add(2);
      set.add(3);
      expect(set.size).toBe(3);
      expect(set.has(1)).toBe(true);
      expect(set.has(2)).toBe(true);
      expect(set.has(3)).toBe(true);
    });

    test('should delete from sets', () => {
      const set = new Set([1, 2, 3]);
      set.delete(2);
      expect(set.size).toBe(2);
      expect(set.has(2)).toBe(false);
    });
  });

  describe('Map Operations', () => {
    test('should create maps', () => {
      const map = new Map([['a', 1], ['b', 2]]);
      expect(map.size).toBe(2);
      expect(map.get('a')).toBe(1);
      expect(map.get('b')).toBe(2);
    });

    test('should set and get values', () => {
      const map = new Map();
      map.set('x', 10);
      map.set('y', 20);
      expect(map.get('x')).toBe(10);
      expect(map.get('y')).toBe(20);
    });

    test('should check map size', () => {
      const map = new Map();
      map.set('a', 1);
      map.set('b', 2);
      expect(map.size).toBe(2);
    });
  });

  describe('Utility Functions', () => {
    test('should check isNaN', () => {
      expect(isNaN(NaN)).toBe(true);
      expect(isNaN(0)).toBe(false);
      expect(isNaN('string')).toBe(true);
      expect(isNaN(42)).toBe(false);
    });

    test('should check isFinite', () => {
      expect(isFinite(42)).toBe(true);
      expect(isFinite(Infinity)).toBe(false);
      expect(isFinite(-Infinity)).toBe(false);
      expect(isFinite(NaN)).toBe(false);
    });

    test('should use parseInt', () => {
      expect(parseInt('42')).toBe(42);
      expect(parseInt('42.5')).toBe(42);
      expect(parseInt('0x10')).toBe(16);
    });

    test('should use parseFloat', () => {
      expect(parseFloat('42.5')).toBe(42.5);
      expect(parseFloat('0x10')).toBe(0); // parseFloat parses '0x10' as 0
    });
  });

  describe('Performance Tests', () => {
    test('should handle large arrays', () => {
      const start = Date.now();
      const largeArray = Array.from({ length: 1000 }, (_, i) => i);
      const sum = largeArray.reduce((acc, curr) => acc + curr, 0);
      expect(sum).toBe(499500); // 0+1+2+...+998+999
      expect(Date.now() - start).toBeLessThan(100);
    });

    test('should handle string operations', () => {
      const start = Date.now();
      const longString = 'x'.repeat(1000);
      const result = longString.toUpperCase();
      expect(result).toBe('X'.repeat(1000));
      expect(Date.now() - start).toBeLessThan(50);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty values', () => {
      expect(''.length).toBe(0);
      expect([].length).toBe(0);
      expect({}.length).toBe(undefined);
      expect(() => null.length).toThrow(TypeError);
    });

    test('should handle undefined values', () => {
      let value;
      expect(value).toBe(undefined);
      value = undefined;
      expect(value).toBe(undefined);
    });

    test('should handle null values', () => {
      let value = null;
      expect(value).toBe(null);
      value = null;
      expect(value).toBe(null);
    });

    test('should handle type coercion', () => {
      expect('5' + 5).toBe('55'); // string concatenation
      expect('5' - 2).toBe(3); // string subtraction
      expect('5' * 2).toBe(10); // string multiplication
      expect('5' / 2).toBe(2.5); // string division
    });
  });
});
