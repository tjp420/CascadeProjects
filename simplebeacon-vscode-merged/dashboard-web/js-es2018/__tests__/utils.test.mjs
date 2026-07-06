import { describe, it } from 'node:test';
import assert from 'node:assert';

import Utils, {
  compose, pipe, zipWith, curry, partial, tap,
  parseJsonSafe, parseResponseJson,
  getExportNames, getNamespaceNames, validateBarrelIntegrity, __barrel__,
  flatten, range, groupBy, partition
} from '../utils.js';

describe('dashboard-web/js-es2018/utils.js', () => {
  it('getExportNames returns a frozen array of strings', () => {
    const names = getExportNames();
    assert.ok(Array.isArray(names));
    assert.ok(names.length > 0);
    assert.ok(names.every((n) => typeof n === 'string'));
    assert.strictEqual(Object.isFrozen(names), true);
  });

  it('getExportNames includes new utilities', () => {
    const names = getExportNames();
    assert.ok(names.includes('compose'));
    assert.ok(names.includes('pipe'));
    assert.ok(names.includes('zipWith'));
    assert.ok(names.includes('curry'));
    assert.ok(names.includes('partial'));
    assert.ok(names.includes('tap'));
    assert.ok(names.includes('parseJsonSafe'));
    assert.ok(names.includes('parseResponseJson'));
    assert.ok(names.includes('getExportNames'));
    assert.ok(names.includes('validateBarrelIntegrity'));
    assert.ok(names.includes('__barrel__'));
  });

  it('__barrel__ metadata has all required fields', () => {
    assert.ok(__barrel__);
    assert.strictEqual(__barrel__.name, 'simplebeacon-dashboard-utils');
    assert.ok(typeof __barrel__.exportCount === 'number');
    assert.strictEqual(__barrel__.version, '1.0.0');
    assert.ok(typeof __barrel__.timestamp === 'string');
    assert.ok(Array.isArray(__barrel__.exports));
    assert.ok(Array.isArray(__barrel__.namespaces));
  });

  it('__barrel__ is attached to default export', () => {
    assert.strictEqual(Utils.__barrel__, __barrel__);
  });

  it('getNamespaceNames returns frozen array with 13 namespaces including inline', () => {
    const names = getNamespaceNames();
    assert.ok(Array.isArray(names));
    assert.strictEqual(names.length, 13);
    assert.ok(names.includes('inline'));
    assert.strictEqual(Object.isFrozen(names), true);
  });

  it('inline namespace exists on default export and is frozen', () => {
    assert.ok(Utils.inline);
    assert.strictEqual(typeof Utils.inline, 'object');
    assert.strictEqual(Object.isFrozen(Utils.inline), true);
  });

  it('inline namespace contains all barrel-native utilities', () => {
    assert.strictEqual(typeof Utils.inline.compose, 'function');
    assert.strictEqual(typeof Utils.inline.pipe, 'function');
    assert.strictEqual(typeof Utils.inline.zipWith, 'function');
    assert.strictEqual(typeof Utils.inline.curry, 'function');
    assert.strictEqual(typeof Utils.inline.partial, 'function');
    assert.strictEqual(typeof Utils.inline.tap, 'function');
    assert.strictEqual(typeof Utils.inline.parseJsonSafe, 'function');
    assert.strictEqual(typeof Utils.inline.parseResponseJson, 'function');
  });

  it('__barrel__ has correct moduleCount and namespaceCount', () => {
    assert.strictEqual(__barrel__.moduleCount, 13);
    assert.strictEqual(__barrel__.namespaceCount, 13);
  });

  it('validateBarrelIntegrity passes', () => {
    const result = validateBarrelIntegrity(__barrel__);
    assert.strictEqual(result.valid, true, `errors: ${result.errors.join(', ')}`);
    assert.deepStrictEqual(result.errors, []);
  });

  it('compose chains right-to-left', () => {
    const add1 = (x) => x + 1;
    const double = (x) => x * 2;
    assert.strictEqual(compose(double, add1)(3), 8);
  });

  it('pipe chains left-to-right', () => {
    const add1 = (x) => x + 1;
    const double = (x) => x * 2;
    assert.strictEqual(pipe(add1, double)(3), 8);
  });

  it('zipWith applies function to paired elements', () => {
    assert.deepStrictEqual(zipWith([1, 2, 3], [4, 5, 6], (a, b) => a + b), [5, 7, 9]);
  });

  it('curry transforms multi-arg functions', () => {
    const add = curry((a, b, c) => a + b + c);
    assert.strictEqual(add(1)(2)(3), 6);
    assert.strictEqual(add(1, 2)(3), 6);
  });

  it('partial fixes leading arguments', () => {
    const add5 = partial((a, b) => a + b, 5);
    assert.strictEqual(add5(3), 8);
  });

  it('tap runs side effects and returns original value', () => {
    let sideEffect = 0;
    const result = tap(5, (x) => { sideEffect = x; });
    assert.strictEqual(result, 5);
    assert.strictEqual(sideEffect, 5);
  });

  it('flatten flattens one level', () => {
    assert.deepStrictEqual(flatten([[1], [2], [3]]), [1, 2, 3]);
  });

  it('range generates numeric arrays', () => {
    assert.deepStrictEqual(range(3), [0, 1, 2]);
    assert.deepStrictEqual(range(1, 4), [1, 2, 3]);
  });

  it('groupBy groups items by key function', () => {
    const result = groupBy([{ a: 1 }, { a: 2 }, { a: 1 }], (x) => x.a);
    assert.ok(result instanceof Map);
    assert.strictEqual(result.get(1).length, 2);
    assert.strictEqual(result.get(2).length, 1);
  });

  it('partition splits into pass and fail', () => {
    const [even, odd] = partition([1, 2, 3, 4], (x) => x % 2 === 0);
    assert.deepStrictEqual(even, [2, 4]);
    assert.deepStrictEqual(odd, [1, 3]);
  });
});

describe('parseJsonSafe', () => {
  it('parses valid JSON', () => {
    assert.deepStrictEqual(parseJsonSafe('{"a":1}', null), { a: 1 });
  });

  it('returns fallback on invalid JSON', () => {
    assert.strictEqual(parseJsonSafe('not json', 'fallback'), 'fallback');
  });

  it('returns fallback for null input', () => {
    assert.strictEqual(parseJsonSafe(null, 'fallback'), 'fallback');
  });
});

describe('parseResponseJson', () => {
  it('parses JSON response', async () => {
    const res = {
      headers: { get: () => 'application/json' },
      text: async () => '{"a":1}'
    };
    const data = await parseResponseJson(res);
    assert.deepStrictEqual(data, { a: 1 });
  });

  it('returns fallback for non-JSON content type', async () => {
    const res = {
      headers: { get: () => 'text/html' },
      text: async () => '<html></html>'
    };
    const data = await parseResponseJson(res);
    assert.deepStrictEqual(data, {});
  });

  it('returns fallback on JSON parse error', async () => {
    const res = {
      headers: { get: () => 'application/json' },
      text: async () => 'not valid json'
    };
    const data = await parseResponseJson(res, 'fallback');
    assert.strictEqual(data, 'fallback');
  });

  it('returns custom fallback when body empty', async () => {
    const res = {
      headers: { get: () => 'application/json' },
      text: async () => ''
    };
    const data = await parseResponseJson(res, { empty: true });
    assert.deepStrictEqual(data, { empty: true });
  });
});
