import {
  compose,
  pipe,
  zipWith,
  curry,
  partial,
  tap,
  flip,
  assert,
  tryCatch
} from '../functional';

describe('functional helpers', () => {
  test('compose identity', () => {
    expect(compose<number>()(5)).toBe(5);
  });

  test('compose composes right-to-left', () => {
    const result = compose(
      (x: number) => x + 1,
      (x: number) => x * 2
    )(3);
    expect(result).toBe(7);
  });

  test('pipe identity', () => {
    expect(pipe<number>()(5)).toBe(5);
  });

  test('pipe pipes left-to-right', () => {
    const result = pipe(
      (x: number) => x + 1,
      (x: number) => x * 2
    )(3);
    expect(result).toBe(8);
  });

  test('zipWith pairs elements', () => {
    expect(zipWith([1, 2], [3, 4], (a, b) => a + b)).toEqual([4, 6]);
  });

  test('zipWith handles mismatched lengths', () => {
    expect(zipWith([1, 2, 3], [10, 20], (a, b) => a + b)).toEqual([11, 22]);
  });

  test('zipWith returns empty array for invalid input', () => {
    expect(zipWith(null as any, [1], () => 1)).toEqual([]);
    expect(zipWith([1], null as any, () => 1)).toEqual([]);
  });

  test('curry allows partial application', () => {
    const fn = curry((a: number, b: number, c: number) => a + b + c);
    expect(fn(1)(2)(3)).toBe(6);
  });

  test('partial applies preset arguments', () => {
    const fn = (a: number, b: number, c: number) => a + b + c;
    expect(partial(fn, 1, 2)(3)).toBe(6);
  });

  test('tap returns original value after side effect', () => {
    let called = false;
    const result = tap(5, (value) => { called = true; expect(value).toBe(5); });
    expect(result).toBe(5);
    expect(called).toBe(true);
  });

  test('flip swaps first two arguments', () => {
    const subtract = (a: number, b: number) => a - b;
    expect(flip(subtract)(5, 3)).toBe(-2);
  });

  test('assert throws on falsy values', () => {
    expect(() => assert(false)).toThrow('Assertion failed');
    expect(() => assert(false, 'custom message')).toThrow('custom message');
  });

  test('assert does not throw on truthy values', () => {
    expect(() => assert(true)).not.toThrow();
  });

  test('tryCatch returns ok result', () => {
    const result = tryCatch(() => 42);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(42);
    }
  });

  test('tryCatch returns error result', () => {
    const result = tryCatch(() => { throw new Error('boom'); });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });
});
