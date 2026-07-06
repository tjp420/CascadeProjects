import {
  sleep, delay, debounce, debounceLeading, debounceAsync, once, memoize,
  throttle, throttleAsync, withTimeout, waitFor, poll, waitForAsync,
  memoizeAsync, retry, parallel, series, waterfall, timeout, retryWithBackoff,
  createDeferred
} from '../async';

describe('async utilities', () => {
  describe('sleep', () => {
    test('waits at least N ms', async () => {
      const start = Date.now();
      await sleep(20);
      expect(Date.now() - start).toBeGreaterThanOrEqual(15);
    });
  });

  describe('delay', () => {
    test('is alias for sleep', async () => {
      const start = Date.now();
      await delay(20);
      expect(Date.now() - start).toBeGreaterThanOrEqual(15);
    });
  });

  describe('debounce', () => {
    test('delays invocation', () => {
      let calls = 0;
      const fn = debounce(() => calls++, 10);
      fn(); fn(); fn();
      expect(calls).toBe(0);
      expect(fn.pending()).toBe(true);
    });
    test('fires once after wait', (done) => {
      let calls = 0;
      const fn = debounce(() => calls++, 10);
      fn(); fn(); fn();
      setTimeout(() => {
        expect(calls).toBe(1);
        done();
      }, 40);
    });
    test('cancel works', () => {
      let calls = 0;
      const fn = debounce(() => calls++, 100);
      fn();
      fn.cancel();
      expect(fn.pending()).toBe(false);
    });
    test('flush works', (done) => {
      let calls = 0;
      const fn = debounce(() => calls++, 100);
      fn();
      fn.flush();
      expect(calls).toBe(1);
      done();
    });
  });

  describe('debounceLeading', () => {
    test('fires on first call', () => {
      let calls = 0;
      const fn = debounceLeading(() => calls++, 50);
      fn();
      expect(calls).toBe(1);
    });
  });

  describe('once', () => {
    test('only runs first call', () => {
      let calls = 0;
      const fn = once(() => { calls++; return 42; });
      expect(fn()).toBe(42);
      expect(fn()).toBe(42);
      expect(calls).toBe(1);
    });
  });

  describe('memoize', () => {
    test('caches results', () => {
      let calls = 0;
      const fn = memoize((x: number) => { calls++; return x * 2; });
      expect(fn(5)).toBe(10);
      expect(fn(5)).toBe(10);
      expect(calls).toBe(1);
    });
    test('clear resets cache', () => {
      const fn = memoize((x: number) => x);
      fn(1);
      fn.clear();
      expect(fn.size).toBe(0);
    });
  });

  describe('throttle', () => {
    test('limits rate', () => {
      let calls = 0;
      const fn = throttle(() => calls++, 50);
      fn(); fn(); fn();
      expect(calls).toBe(1);
    });
  });

  describe('withTimeout', () => {
    test('resolves before timeout', async () => {
      const result = await withTimeout(Promise.resolve(42), 100);
      expect(result).toBe(42);
    });
    test('rejects on timeout', async () => {
      await expect(withTimeout(sleep(200), 10, 'too slow')).rejects.toThrow('too slow');
    });
  });

  describe('waitFor', () => {
    test('resolves when predicate is true', async () => {
      let flag = false;
      setTimeout(() => { flag = true; }, 10);
      await waitFor(() => flag, 5, 500);
      expect(flag).toBe(true);
    });
  });

  describe('poll', () => {
    test('returns when fn returns truthy', async () => {
      let count = 0;
      const result = await poll(() => { count++; return count >= 2 ? 'done' : undefined; }, 5, 200);
      expect(result).toBe('done');
    });
  });

  describe('retry', () => {
    test('succeeds on first try', async () => {
      const result = await retry(async () => 'success');
      expect(result).toBe('success');
    });
    test('retries then succeeds', async () => {
      let calls = 0;
      const result = await retry(async () => {
        calls++;
        if (calls < 3) throw new Error('fail');
        return 'success';
      }, 5, 1);
      expect(result).toBe('success');
      expect(calls).toBe(3);
    });
  });

  describe('parallel', () => {
    test('runs in parallel', async () => {
      const results = await parallel(async (x: number) => x * 2, [1, 2, 3]);
      expect(results).toEqual([2, 4, 6]);
    });
    test('respects concurrency', async () => {
      let running = 0;
      let maxRunning = 0;
      const results = await parallel(async (x: number) => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await sleep(20);
        running--;
        return x;
      }, [1, 2, 3, 4], 2);
      expect(results).toEqual([1, 2, 3, 4]);
      expect(maxRunning).toBeLessThanOrEqual(2);
    });
  });

  describe('series', () => {
    test('runs sequentially', async () => {
      const results = await series(async (x: number) => x * 2, [1, 2, 3]);
      expect(results).toEqual([2, 4, 6]);
    });
  });

  describe('waterfall', () => {
    test('chains async functions', async () => {
      const result = await waterfall(1, [
        async (x) => x + 1,
        async (x) => x * 2,
      ]);
      expect(result).toBe(4);
    });
  });

  describe('timeout', () => {
    test('alias for withTimeout', async () => {
      const result = await timeout(Promise.resolve(42), 100);
      expect(result).toBe(42);
    });
  });

  describe('retryWithBackoff', () => {
    test('succeeds eventually', async () => {
      let calls = 0;
      const result = await retryWithBackoff(async () => {
        calls++;
        if (calls < 2) throw new Error('fail');
        return 'ok';
      }, 3, 1);
      expect(result).toBe('ok');
    });
  });

  describe('createDeferred', () => {
    test('resolves via external resolve', async () => {
      const d = createDeferred<string>();
      d.resolve('hello');
      await expect(d.promise).resolves.toBe('hello');
    });
    test('rejects via external reject', async () => {
      const d = createDeferred<number>();
      d.reject(new Error('fail'));
      await expect(d.promise).rejects.toThrow('fail');
    });
    test('can be resolved after awaiting', async () => {
      const d = createDeferred<boolean>();
      setTimeout(() => d.resolve(true), 10);
      await expect(d.promise).resolves.toBe(true);
    });
  });
});
