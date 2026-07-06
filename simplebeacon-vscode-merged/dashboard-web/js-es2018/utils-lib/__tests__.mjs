/**
 * Unit tests for utils-lib sub-modules.
 * Run with: node --test __tests__.mjs
 */

import assert from 'assert';
import { describe, it, beforeEach, afterEach } from 'node:test';

// ── string ──
import { escapeHtml, escapeRegExp, truncate, capitalize, words, repeat, titleCase, slugify, isBlank, stripHtml, kebabCase, camelCase, snakeCase, padStart, padEnd } from './string.js';

// ── format ──
import { formatNumber, formatPercent, normalizeSlashes, redactPathForDisplay, isRedactedPathDisplay, formatPathLabel } from './format.js';

// ── download ──
import { downloadJson, downloadText, downloadCsv } from './download.js';

// ── async ──
import { sleep, memoize, retry, debounce, debounceLeading, throttle } from './async.js';

// ── array ──
import { unique, flatten, range, chunk, head, tail, sum, mean, sortBy, compact, groupBy, partition } from './array.js';

// ── object ──
import { deepClone, deepEqual, pick, omit, get, set, isEmpty } from './object.js';

// ── color ──
import { hexToRgba, contrastColor } from './color.js';

// ── url ──
import { parseQueryString, stringifyQueryString, isValidUrl } from './url.js';

// ── crypto ──
import { randomId, uid, hash } from './crypto.js';

// ── type ──
import { isDefined, isNil } from './type.js';

// ── number ──
import { clamp, inRange, roundTo, safeParseInt, safeParseFloat } from './number.js';

// ── function ──
import { seq, flow, negate, identity, noop, zipWith, curry, partial, tap } from './function.js';

// ── fetch ──
import { fetchWithTimeout } from './fetch.js';

// ── storage ── (test pure logic, not localStorage)
import { localStorageGet, localStorageSet, localStorageRemove, localStorageGetString, localStorageSetString, sessionStorageGet, sessionStorageSet } from './storage.js';

// ── accessibility ──
import { prefersReducedMotion, prefersDarkMode } from './accessibility.js';

// ── privacy ──
import { sanitizePrivacyData } from './privacy.js';

// ── clipboard ──
import { copyToClipboard } from './clipboard.js';

// ── dom ──
import { escapeHtml as domEscapeHtml } from './dom.js';

// ── vscode ──
import { isVSCodeWebview, isStandalone, getVSCodeApi } from './vscode.js';

// ── Shared helpers ──
function mockWindow(props = {}) {
  const saved = globalThis.window;
  globalThis.window = { ...props };
  return () => { globalThis.window = saved; };
}

describe('string.js', () => {
  it('escapeHtml escapes special chars', () => {
    assert.strictEqual(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    assert.strictEqual(escapeHtml("it's"), 'it&#039;s');
    assert.strictEqual(escapeHtml(null), '');
    assert.strictEqual(escapeHtml(undefined), '');
  });

  it('escapeRegExp escapes regex metachars', () => {
    assert.strictEqual(escapeRegExp('.*+?^${}()|[]\\'), '\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
  });

  it('truncate respects maxLen', () => {
    assert.strictEqual(truncate('hello world', 8), 'hello w…');
    assert.strictEqual(truncate('hi', 8), 'hi');
  });

  it('truncate handles edge cases', () => {
    assert.strictEqual(truncate(null, 5), '');
    assert.strictEqual(truncate(undefined, 5), '');
    assert.strictEqual(truncate('hello', 0), 'hello'); // 0 falls back to default 80
    assert.strictEqual(truncate('hello', 100), 'hello');
  });

  it('capitalizes first letter', () => {
    assert.strictEqual(capitalize('hello'), 'Hello');
    assert.strictEqual(capitalize(''), '');
  });

  it('words splits on non-word', () => {
    assert.deepStrictEqual(words('hello world 123'), ['hello', 'world', '123']);
    assert.deepStrictEqual(words(''), []);
  });

  it('repeat repeats N times', () => {
    assert.strictEqual(repeat('ab', 3), 'ababab');
    assert.strictEqual(repeat('ab', 0), '');
  });

  it('titleCase capitalizes each word', () => {
    assert.strictEqual(titleCase('hello world'), 'Hello World');
  });

  it('slugify creates url-safe slug', () => {
    assert.strictEqual(slugify('Hello World!'), 'hello-world');
  });

  it('isBlank detects empty/whitespace', () => {
    assert.strictEqual(isBlank(null), true);
    assert.strictEqual(isBlank(undefined), true);
    assert.strictEqual(isBlank(''), true);
    assert.strictEqual(isBlank('  '), true);
    assert.strictEqual(isBlank('a'), false);
    assert.strictEqual(isBlank(0), false);
  });

  it('stripHtml removes tags', () => {
    assert.strictEqual(stripHtml('<p>hello</p>'), 'hello');
    assert.strictEqual(stripHtml(''), '');
  });

  it('kebabCase converts to kebab-case', () => {
    assert.strictEqual(kebabCase('helloWorld'), 'hello-world');
    assert.strictEqual(kebabCase('hello_world'), 'hello-world');
  });

  it('camelCase converts to camelCase', () => {
    assert.strictEqual(camelCase('hello-world'), 'helloWorld');
    assert.strictEqual(camelCase('Hello World'), 'helloWorld');
  });

  it('snakeCase converts to snake_case', () => {
    assert.strictEqual(snakeCase('helloWorld'), 'hello_world');
    assert.strictEqual(snakeCase('hello-world'), 'hello_world');
  });

  it('padStart pads beginning', () => {
    assert.strictEqual(padStart('42', 5, '0'), '00042');
  });

  it('padEnd pads end', () => {
    assert.strictEqual(padEnd('42', 5, '0'), '42000');
  });
});

describe('format.js', () => {
  it('formatNumber formats with locale', () => {
    assert.strictEqual(formatNumber(1234.56), '1,234.56');
    assert.strictEqual(formatNumber(1234.56, 2), '1,234.56');
  });

  it('formatNumber handles edge cases', () => {
    assert.strictEqual(formatNumber(null), '—');
    assert.strictEqual(formatNumber(undefined), '—');
    assert.strictEqual(formatNumber(NaN), '—');
    assert.strictEqual(formatNumber(Infinity), '—');
  });

  it('formatPercent formats percentage', () => {
    assert.strictEqual(formatPercent(0.1234), '0.1%');
    assert.strictEqual(formatPercent(100), '100.0%');
  });

  it('formatPercent handles edge cases', () => {
    assert.strictEqual(formatPercent(null), '—');
    assert.strictEqual(formatPercent(undefined), '—');
    assert.strictEqual(formatPercent(''), '—');
    assert.strictEqual(formatPercent('12.5%'), '12.5%');
    assert.strictEqual(formatPercent(NaN), '—');
  });

  it('normalizeSlashes converts backslashes', () => {
    assert.strictEqual(normalizeSlashes('C:\\Users\\test'), 'C:/Users/test');
  });

  it('redactPathForDisplay shortens paths', () => {
    assert.strictEqual(redactPathForDisplay('C:/Users/Trevor/Projects/myapp/src/index.js'), '…/Projects/myapp/src/index.js');
    assert.strictEqual(redactPathForDisplay('myapp/src/index.js'), 'myapp/src/index.js');
    assert.strictEqual(redactPathForDisplay(''), '');
  });

  it('isRedactedPathDisplay detects redacted paths', () => {
    assert.strictEqual(isRedactedPathDisplay('…/src/index.js'), true);
    assert.strictEqual(isRedactedPathDisplay('src/index.js'), false);
  });
});

describe('async.js', () => {
  it('sleep waits specified ms', async () => {
    const start = Date.now();
    await sleep(50);
    assert.ok(Date.now() - start >= 10, 'sleep should wait at least 10ms');
  });

  it('memoize caches results', () => {
    let calls = 0;
    const fn = memoize((x) => { calls++; return x * 2; });
    assert.strictEqual(fn(5), 10);
    assert.strictEqual(fn(5), 10);
    assert.strictEqual(calls, 1);
    fn.clear();
  });

  it('retry succeeds on first attempt', async () => {
    const result = await retry(() => Promise.resolve('ok'));
    assert.strictEqual(result, 'ok');
  });

  it('retry fails after exhausted retries', async () => {
    await assert.rejects(
      retry(() => Promise.reject(new Error('fail')), 2, 10),
      /fail/
    );
  });

  it('retry succeeds after transient failures', async () => {
    let attempts = 0;
    const result = await retry(() => {
      attempts++;
      if (attempts < 3) return Promise.reject(new Error('transient'));
      return Promise.resolve('ok');
    }, 5, 50);
    assert.strictEqual(result, 'ok');
    assert.strictEqual(attempts, 3);
  });
});

describe('array.js', () => {
  it('unique deduplicates', () => {
    assert.deepStrictEqual(unique([1, 2, 2, 3]), [1, 2, 3]);
  });

  it('flatten flattens nested', () => {
    assert.deepStrictEqual(flatten([1, [2, [3]]]), [1, 2, 3]);
  });

  it('range generates numbers', () => {
    assert.deepStrictEqual(range(3), [0, 1, 2]);
    assert.deepStrictEqual(range(1, 4), [1, 2, 3]);
  });

  it('chunk splits into groups', () => {
    assert.deepStrictEqual(chunk([1, 2, 3, 4], 2), [[1, 2], [3, 4]]);
  });

  it('head returns first N', () => {
    assert.deepStrictEqual(head([1, 2, 3]), [1]);
    assert.deepStrictEqual(head([1, 2, 3], 2), [1, 2]);
  });

  it('tail returns last N', () => {
    assert.deepStrictEqual(tail([1, 2, 3]), [3]);
    assert.deepStrictEqual(tail([1, 2, 3], 2), [2, 3]);
  });

  it('sum adds numbers', () => {
    assert.strictEqual(sum([1, 2, 3]), 6);
    assert.strictEqual(sum([{ v: 1 }, { v: 2 }], (x) => x.v), 3);
  });

  it('mean calculates average', () => {
    assert.strictEqual(mean([2, 4, 6]), 4);
  });

  it('sortBy sorts by key', () => {
    assert.deepStrictEqual(sortBy([{ a: 3 }, { a: 1 }, { a: 2 }], (x) => x.a), [{ a: 1 }, { a: 2 }, { a: 3 }]);
  });

  it('compact removes null/undefined', () => {
    assert.deepStrictEqual(compact([1, null, 2, undefined, 3]), [1, 2, 3]);
  });

  it('groupBy groups by key', () => {
    const map = groupBy([{ t: 'a' }, { t: 'b' }, { t: 'a' }], (x) => x.t);
    assert.strictEqual(map.get('a').length, 2);
    assert.strictEqual(map.get('b').length, 1);
  });

  it('partition splits by predicate', () => {
    const [evens, odds] = partition([1, 2, 3, 4], (x) => x % 2 === 0);
    assert.deepStrictEqual(evens, [2, 4]);
    assert.deepStrictEqual(odds, [1, 3]);
  });
});

describe('object.js', () => {
  it('deepClone clones deeply', () => {
    const obj = { a: { b: 1 }, c: [1, 2] };
    const cloned = deepClone(obj);
    assert.deepStrictEqual(cloned, obj);
    assert.notStrictEqual(cloned, obj);
    assert.notStrictEqual(cloned.a, obj.a);
  });

  it('deepEqual checks equality', () => {
    assert.strictEqual(deepEqual({ a: 1 }, { a: 1 }), true);
    assert.strictEqual(deepEqual({ a: 1 }, { a: 2 }), false);
    assert.strictEqual(deepEqual([1, 2], [1, 2]), true);
  });

  it('deepEqual handles edge cases', () => {
    assert.strictEqual(deepEqual(null, null), true);
    assert.strictEqual(deepEqual(null, {}), false);
    assert.strictEqual(deepEqual([1, 2], [1, 2, 3]), false);
    assert.strictEqual(deepEqual({ a: { b: 1 } }, { a: { b: 1 } }), true);
  });

  it('pick selects keys', () => {
    assert.deepStrictEqual(pick({ a: 1, b: 2, c: 3 }, ['a', 'c']), { a: 1, c: 3 });
  });

  it('omit removes keys', () => {
    assert.deepStrictEqual(omit({ a: 1, b: 2, c: 3 }, ['b']), { a: 1, c: 3 });
  });

  it('get reads nested path', () => {
    assert.strictEqual(get({ a: { b: 1 } }, 'a.b'), 1);
    assert.strictEqual(get({ a: { b: 1 } }, 'a.c', 'default'), 'default');
    assert.strictEqual(get({ a: [10, 20, 30] }, 'a.1'), 20);
    assert.strictEqual(get({}, ''), undefined);
  });

  it('set writes nested path', () => {
    const obj = {};
    set(obj, 'a.b.c', 1);
    assert.deepStrictEqual(obj, { a: { b: { c: 1 } } });
  });

  it('isEmpty detects emptiness', () => {
    assert.strictEqual(isEmpty(null), true);
    assert.strictEqual(isEmpty(''), true);
    assert.strictEqual(isEmpty([]), true);
    assert.strictEqual(isEmpty({}), true);
    assert.strictEqual(isEmpty({ a: 1 }), false);
  });
});

describe('color.js', () => {
  it('hexToRgba converts hex to rgba', () => {
    assert.strictEqual(hexToRgba('#ff0000'), 'rgba(255,0,0,1)');
    assert.strictEqual(hexToRgba('#f00'), 'rgba(255,0,0,1)');
    assert.strictEqual(hexToRgba('#ff0000', 0.5), 'rgba(255,0,0,0.5)');
  });

  it('contrastColor returns black or white', () => {
    assert.strictEqual(contrastColor('#ffffff'), '#000000');
    assert.strictEqual(contrastColor('#000000'), '#ffffff');
  });
});

describe('url.js', () => {
  it('parseQueryString parses query strings', () => {
    assert.deepStrictEqual(parseQueryString('?a=1&b=2'), { a: '1', b: '2' });
    assert.deepStrictEqual(parseQueryString('a=1&a=2'), { a: ['1', '2'] });
  });

  it('stringifyQueryString builds query strings', () => {
    assert.strictEqual(stringifyQueryString({ a: 1, b: 2 }), 'a=1&b=2');
    assert.strictEqual(stringifyQueryString({ a: null, b: '' }), '');
  });

  it('isValidUrl validates URLs', () => {
    assert.strictEqual(isValidUrl('https://example.com'), true);
    assert.strictEqual(isValidUrl('not-a-url'), false);
  });

  it('isValidUrl handles edge cases', () => {
    assert.strictEqual(isValidUrl(''), false);
    assert.strictEqual(isValidUrl(null), false);
    assert.strictEqual(isValidUrl('//example.com/path'), false); // needs base URL
    assert.strictEqual(isValidUrl('https://example.com'), true);
  });
});

describe('crypto.js', () => {
  it('randomId generates alphanumeric string', () => {
    const id = randomId(8);
    assert.strictEqual(id.length, 8);
    assert.ok(/^[A-Za-z0-9]+$/.test(id));
  });

  it('uid is 8 chars', () => {
    assert.strictEqual(uid().length, 8);
  });

  it('hash is deterministic', () => {
    assert.strictEqual(hash('hello'), hash('hello'));
    assert.notStrictEqual(hash('hello'), hash('world'));
  });
});

describe('type.js', () => {
  it('isDefined excludes null/undefined', () => {
    assert.strictEqual(isDefined(0), true);
    assert.strictEqual(isDefined(''), true);
    assert.strictEqual(isDefined(null), false);
    assert.strictEqual(isDefined(undefined), false);
  });

  it('isNil includes null/undefined', () => {
    assert.strictEqual(isNil(null), true);
    assert.strictEqual(isNil(undefined), true);
    assert.strictEqual(isNil(0), false);
  });
});

describe('number.js', () => {
  it('clamp constrains value', () => {
    assert.strictEqual(clamp(5, 0, 10), 5);
    assert.strictEqual(clamp(-1, 0, 10), 0);
    assert.strictEqual(clamp(15, 0, 10), 10);
  });

  it('clamp handles edge cases', () => {
    assert.strictEqual(clamp(NaN, 0, 10), 0); // NaN input returns min bound
    assert.ok(Number.isNaN(clamp(5, Infinity, 10))); // non-finite bounds return NaN
  });

  it('roundTo rounds to decimals', () => {
    assert.strictEqual(roundTo(1.234, 2), 1.23);
    assert.strictEqual(roundTo(1.235, 2), 1.24);
  });

  it('roundTo handles edge cases', () => {
    assert.ok(Number.isNaN(roundTo(NaN, 2)));
    assert.strictEqual(roundTo(1.5, 0), 2);
    assert.strictEqual(roundTo(1.234, -1), 1); // negative decimals clamped to 0
  });

  it('safeParseInt parses safely', () => {
    assert.strictEqual(safeParseInt('42'), 42);
    assert.strictEqual(safeParseInt('abc', 0), 0);
  });

  it('safeParseInt handles edge cases', () => {
    assert.strictEqual(safeParseInt(''), 0);
    assert.strictEqual(safeParseInt('  42  '), 42);
    assert.strictEqual(safeParseInt('3.14'), 3);
  });
});

describe('function.js', () => {
  it('seq composes left-to-right', () => {
    const fn = seq((x) => x + 1, (x) => x * 2);
    assert.strictEqual(fn(3), 8);
  });

  it('flow composes right-to-left', () => {
    const fn = flow((x) => x + 1, (x) => x * 2);
    assert.strictEqual(fn(3), 7);
  });

  it('negate inverts predicate', () => {
    const isEven = (x) => x % 2 === 0;
    assert.strictEqual(negate(isEven)(3), true);
    assert.strictEqual(negate(isEven)(2), false);
  });

  it('identity returns input', () => {
    assert.strictEqual(identity(42), 42);
  });

  it('noop does nothing', () => {
    assert.strictEqual(noop(), undefined);
  });
});

describe('fetch.js', () => {
  it('fetchWithTimeout rejects on timeout', async () => {
    await assert.rejects(
      fetchWithTimeout('http://localhost:59999/test', { method: 'GET' }, 10),
      /timed out/
    );
  });
});

describe('async.js debounce & throttle', () => {
  it('debounce delays execution', async () => {
    let calls = 0;
    const fn = debounce(() => calls++, 50);
    fn();
    fn();
    assert.strictEqual(calls, 0);
    await sleep(150);
    assert.strictEqual(calls, 1);
  });

  it('debounce cancel prevents call', async () => {
    let calls = 0;
    const fn = debounce(() => calls++, 50);
    fn();
    fn.cancel();
    await sleep(150);
    assert.strictEqual(calls, 0);
  });

  it('debounce flush triggers immediately', () => {
    let calls = 0;
    const fn = debounce(() => calls++, 50);
    fn();
    assert.strictEqual(calls, 0);
    fn.flush();
    assert.strictEqual(calls, 1);
  });

  it('debounce pending returns true while scheduled', () => {
    const fn = debounce(() => {}, 50);
    assert.strictEqual(fn.pending(), false);
    fn();
    assert.strictEqual(fn.pending(), true);
    fn.cancel();
    assert.strictEqual(fn.pending(), false);
  });

  it('throttle rate-limits calls', async () => {
    let calls = 0;
    const fn = throttle(() => calls++, 100);
    fn();
    fn();
    fn();
    assert.strictEqual(calls, 1);
    await sleep(200);
    assert.ok(calls >= 1);
  });

  it('throttle cancel prevents pending flush', async () => {
    let calls = 0;
    const fn = throttle(() => calls++, 100);
    fn();
    fn.cancel();
    await sleep(200);
    assert.strictEqual(calls, 1);
  });
});

function mockStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k)
  };
}

describe('storage.js localStorage', () => {
  it('round-trips JSON values', () => {
    const saved = globalThis.window;
    globalThis.window = { localStorage: mockStorage() };
    assert.strictEqual(localStorageSet('key', { a: 1 }), true);
    assert.deepStrictEqual(localStorageGet('key'), { a: 1 });
    globalThis.window = saved;
  });

  it('returns fallback for missing key', () => {
    const saved = globalThis.window;
    globalThis.window = { localStorage: mockStorage() };
    assert.strictEqual(localStorageGet('missing', 'fb'), 'fb');
    globalThis.window = saved;
  });

  it('removes keys', () => {
    const saved = globalThis.window;
    globalThis.window = { localStorage: mockStorage() };
    localStorageSet('key', 'val');
    assert.strictEqual(localStorageRemove('key'), true);
    assert.strictEqual(localStorageGet('key'), undefined);
    globalThis.window = saved;
  });

  it('round-trips raw strings', () => {
    const saved = globalThis.window;
    globalThis.window = { localStorage: mockStorage() };
    localStorageSetString('raw', 'hello');
    assert.strictEqual(localStorageGetString('raw'), 'hello');
    assert.strictEqual(localStorageGetString('missing', 'fb'), 'fb');
    globalThis.window = saved;
  });
});

describe('storage.js sessionStorage', () => {
  it('round-trips JSON values', () => {
    const saved = globalThis.window;
    globalThis.window = { sessionStorage: mockStorage() };
    assert.strictEqual(sessionStorageSet('skey', { b: 2 }), true);
    assert.deepStrictEqual(sessionStorageGet('skey'), { b: 2 });
    globalThis.window = saved;
  });
});

describe('accessibility.js', () => {
  it('prefersReducedMotion returns false when window is missing', () => {
    const restore = mockWindow(undefined);
    assert.strictEqual(prefersReducedMotion(), false);
    restore();
  });

  it('prefersReducedMotion returns false when matchMedia is missing', () => {
    const restore = mockWindow({});
    assert.strictEqual(prefersReducedMotion(), false);
    restore();
  });

  it('prefersDarkMode returns false when window is missing', () => {
    const restore = mockWindow(undefined);
    assert.strictEqual(prefersDarkMode(), false);
    restore();
  });

  it('prefersDarkMode returns false when matchMedia is missing', () => {
    const restore = mockWindow({});
    assert.strictEqual(prefersDarkMode(), false);
    restore();
  });
});

describe('download.js', () => {
  it('downloadJson throws on invalid filename', () => {
    assert.throws(() => downloadJson({}, null), /filename/);
    assert.throws(() => downloadJson({}, 123), /filename/);
  });

  it('downloadText throws on null content', () => {
    assert.throws(() => downloadText(null, 'file.txt'), /content/);
  });
});

describe('privacy.js', () => {
  it('redacts emails', () => {
    assert.ok(sanitizePrivacyData('Contact admin@example.com').includes('[REDACTED_EMAIL]'));
  });

  it('redacts IPv4 addresses', () => {
    assert.ok(sanitizePrivacyData('Server 192.168.1.1 online').includes('[REDACTED_IP]'));
  });

  it('redacts phone numbers', () => {
    assert.ok(sanitizePrivacyData('Call 555-123-4567').includes('[REDACTED_PHONE]'));
  });

  it('redacts Bearer tokens', () => {
    assert.ok(sanitizePrivacyData('Bearer abc123xyz').includes('[REDACTED_TOKEN]'));
  });

  it('redacts AWS keys', () => {
    assert.ok(sanitizePrivacyData('AKIAIOSFODNN7EXAMPLE').includes('[REDACTED_AWS_KEY]'));
  });

  it('redacts OpenAI keys', () => {
    assert.ok(sanitizePrivacyData('sk-abcdefghijklmnopqrst').includes('[REDACTED_OPENAI_KEY]'));
  });

  it('redacts quoted credentials', () => {
    assert.ok(sanitizePrivacyData('test_key="demo_value"').includes('[REDACTED_CREDENTIAL]'));
  });

  it('returns empty string for non-string input', () => {
    assert.strictEqual(sanitizePrivacyData(null), '');
    assert.strictEqual(sanitizePrivacyData(123), '');
  });
});

describe('vscode.js', () => {
  it('isVSCodeWebview returns false when window is missing', () => {
    const restore = mockWindow(undefined);
    assert.strictEqual(isVSCodeWebview(), false);
    restore();
  });

  it('isStandalone returns true when window is missing', () => {
    const restore = mockWindow(undefined);
    assert.strictEqual(isStandalone(), true);
    restore();
  });

  it('getVSCodeApi returns null when window is missing', () => {
    const restore = mockWindow(undefined);
    assert.strictEqual(getVSCodeApi(), null);
    restore();
  });

  it('getVSCodeApi returns null when acquireVsCodeApi is missing', () => {
    const restore = mockWindow({});
    assert.strictEqual(getVSCodeApi(), null);
    restore();
  });
});

describe('clipboard.js', () => {
  it('throws on null input', async () => {
    await assert.rejects(copyToClipboard(null), /Cannot copy null/);
  });

  it('throws on undefined input', async () => {
    await assert.rejects(copyToClipboard(undefined), /Cannot copy null/);
  });

  it('throws when document is unavailable', async () => {
    await assert.rejects(copyToClipboard('hello'), /Clipboard unavailable/);
  });
});

describe('dom.js', () => {
  it('escapeHtml escapes special chars', () => {
    assert.strictEqual(domEscapeHtml('<div>"test"</div>'), '&lt;div&gt;&quot;test&quot;&lt;/div&gt;');
    assert.strictEqual(domEscapeHtml(null), '');
    assert.strictEqual(domEscapeHtml(undefined), '');
  });
});

describe('download.js downloadCsv', () => {
  it('throws on empty rows', () => {
    assert.throws(() => downloadCsv([], 'test.csv'), /non-empty array/);
    assert.throws(() => downloadCsv(null, 'test.csv'), /non-empty array/);
  });
});

describe('format.js edge cases', () => {
  it('formatPathLabel with various inputs', () => {
    assert.strictEqual(formatPathLabel('myapp/src'), 'src');
    assert.strictEqual(formatPathLabel('myapp'), 'myapp');
    assert.strictEqual(formatPathLabel(null), '');
  });

  it('redactPathForDisplay with very long paths', () => {
    assert.strictEqual(redactPathForDisplay('C:/Users/Trevor/very/long/path/to/project/file.js'), '…/very/long/path/to/project/file.js');
    assert.strictEqual(redactPathForDisplay('/home/user/project'), '…/project');
  });
});

describe('array.js edge cases', () => {
  it('sortBy with desc order', () => {
    assert.deepStrictEqual(sortBy([{ a: 1 }, { a: 3 }, { a: 2 }], (x) => x.a, 'desc'), [{ a: 3 }, { a: 2 }, { a: 1 }]);
  });

  it('sortBy with invalid inputs', () => {
    assert.deepStrictEqual(sortBy(null, (x) => x), []);
    assert.deepStrictEqual(sortBy([1, 2], null), [1, 2]);
  });

  it('sum with keyFn', () => {
    assert.strictEqual(sum([{ v: 2 }, { v: 3 }], (x) => x.v), 5);
    assert.strictEqual(sum([]), 0);
    assert.strictEqual(sum(null), 0);
  });

  it('mean with empty or null array', () => {
    assert.strictEqual(mean([]), 0);
    assert.strictEqual(mean(null), 0);
  });

  it('unique with keyFn', () => {
    assert.deepStrictEqual(unique([{ id: 1 }, { id: 2 }, { id: 1 }], (x) => x.id), [{ id: 1 }, { id: 2 }]);
  });

  it('flatten with non-array returns empty', () => {
    assert.deepStrictEqual(flatten(null), []);
    assert.deepStrictEqual(flatten(42), []);
  });

  it('range with invalid step returns empty', () => {
    assert.deepStrictEqual(range(0, 5, 0), []);
    assert.deepStrictEqual(range(0, 5, Infinity), []);
  });

  it('chunk with invalid size defaults to 1', () => {
    assert.deepStrictEqual(chunk([1, 2], 0), [[1], [2]]);
  });

  it('head and tail with non-arrays return empty', () => {
    assert.deepStrictEqual(head(null), []);
    assert.deepStrictEqual(tail(null), []);
  });
});

describe('object.js edge cases', () => {
  it('deepClone with null input', () => {
    assert.strictEqual(deepClone(null), null);
  });

  it('deepEqual with nested arrays', () => {
    assert.strictEqual(deepEqual([1, [2, 3]], [1, [2, 3]]), true);
    assert.strictEqual(deepEqual([1, [2, 3]], [1, [2, 4]]), false);
  });

  it('deepEqual with Date and RegExp', () => {
    assert.strictEqual(deepEqual(new Date('2024-01-01'), new Date('2024-01-01')), true);
    assert.strictEqual(deepEqual(/abc/g, /abc/g), true);
    assert.strictEqual(deepEqual(/abc/g, /abc/i), false);
  });

  it('deepEqual with Map and Set', () => {
    assert.strictEqual(deepEqual(new Map([['a', 1]]), new Map([['a', 1]])), true);
    assert.strictEqual(deepEqual(new Set([1, 2]), new Set([1, 2])), true);
    assert.strictEqual(deepEqual(new Set([1, 2]), new Set([1, 3])), false);
  });

  it('isEmpty with Map, Set, Date', () => {
    assert.strictEqual(isEmpty(new Map()), true);
    assert.strictEqual(isEmpty(new Map([['a', 1]])), false);
    assert.strictEqual(isEmpty(new Set()), true);
    assert.strictEqual(isEmpty(new Set([1])), false);
    assert.strictEqual(isEmpty(new Date()), true); // Date has no enumerable keys
    assert.strictEqual(isEmpty({ a: 1 }), false);
  });

  it('pick with empty keys', () => {
    assert.deepStrictEqual(pick({ a: 1, b: 2 }, []), {});
  });

  it('omit with empty keys', () => {
    assert.deepStrictEqual(omit({ a: 1, b: 2 }, []), { a: 1, b: 2 });
  });
});

describe('color.js edge cases', () => {
  it('hexToRgba with invalid hex returns default', () => {
    assert.strictEqual(hexToRgba('not-a-color'), 'rgba(0,0,0,1)');
    assert.strictEqual(hexToRgba('#gggggg'), 'rgba(0,0,0,1)');
    assert.strictEqual(hexToRgba(null), 'rgba(0,0,0,1)');
  });

  it('hexToRgba with alpha clamping', () => {
    assert.strictEqual(hexToRgba('#ff0000', 2), 'rgba(255,0,0,1)');
    assert.strictEqual(hexToRgba('#ff0000', -0.5), 'rgba(255,0,0,0)');
  });

  it('contrastColor with invalid input returns black', () => {
    assert.strictEqual(contrastColor(null), '#000000');
    assert.strictEqual(contrastColor('invalid'), '#000000');
  });
});

describe('number.js edge cases', () => {
  it('clamp with string inputs', () => {
    assert.strictEqual(clamp('5', 0, 10), 5);
    assert.strictEqual(clamp('abc', 0, 10), 0); // non-finite returns min
  });

  it('inRange with various inputs', () => {
    assert.strictEqual(inRange(5, 0, 10), true);
    assert.strictEqual(inRange(10, 0, 10), false);
    assert.strictEqual(inRange(-1, 0, 10), false);
    assert.strictEqual(inRange('abc', 0, 10), false); // non-finite returns false
  });

  it('safeParseInt with edge cases', () => {
    assert.strictEqual(safeParseInt(''), 0);
    assert.strictEqual(safeParseInt('  42  '), 42);
    assert.strictEqual(safeParseInt('3.14'), 3);
    assert.strictEqual(safeParseInt('abc', 99), 99);
    assert.strictEqual(safeParseInt(Infinity), 0);
  });

  it('safeParseFloat with edge cases', () => {
    assert.strictEqual(safeParseFloat('3.14'), 3.14);
    assert.strictEqual(safeParseFloat('abc', 99), 99);
    assert.strictEqual(safeParseFloat(''), 0);
  });
});

describe('url.js edge cases', () => {
  it('parseQueryString with empty input', () => {
    assert.deepStrictEqual(parseQueryString(''), {});
    assert.deepStrictEqual(parseQueryString('?'), {});
  });

  it('stringifyQueryString with empty object', () => {
    assert.strictEqual(stringifyQueryString({}), '');
  });
});

describe('crypto.js edge cases', () => {
  it('randomId handles edge lengths', () => {
    assert.strictEqual(randomId(0).length, 8); // falsy length falls back to default 8
    assert.strictEqual(randomId(-5).length, 1); // negative clamps to 1
  });

  it('hash is deterministic and stringifies objects', () => {
    assert.strictEqual(hash({ a: 1 }), hash({ a: 1 }));
    assert.strictEqual(hash({ a: 1 }), hash({ a: 2 })); // both stringify to '[object Object]'
    assert.notStrictEqual(hash('hello'), hash('world'));
  });
});

describe('type.js edge cases', () => {
  it('isDefined with falsy values', () => {
    assert.strictEqual(isDefined(0), true);
    assert.strictEqual(isDefined(''), true);
    assert.strictEqual(isDefined(false), true);
    assert.strictEqual(isDefined(null), false);
  });

  it('isNil with various inputs', () => {
    assert.strictEqual(isNil(undefined), true);
    assert.strictEqual(isNil(null), true);
    assert.strictEqual(isNil(0), false);
    assert.strictEqual(isNil(''), false);
  });
});

describe('function.js edge cases', () => {
  it('seq with single function', () => {
    assert.strictEqual(seq((x) => x + 1)(5), 6);
  });

  it('flow with single function', () => {
    assert.strictEqual(flow((x) => x + 1)(5), 6);
  });

  it('negate with truthy/falsy', () => {
    assert.strictEqual(negate(() => true)(), false);
    assert.strictEqual(negate(() => false)(), true);
  });
});

describe('fetch.js edge cases', () => {
  it('fetchWithTimeout throws on invalid url', async () => {
    await assert.rejects(fetchWithTimeout(null), /Invalid URL|Failed to parse URL/);
  });
});

describe('async.js memoize edge cases', () => {
  it('memoize caches with different arguments', () => {
    let calls = 0;
    const fn = memoize((x) => { calls++; return x * 2; });
    assert.strictEqual(fn(5), 10);
    assert.strictEqual(fn(6), 12);
    assert.strictEqual(calls, 2);
    fn.clear();
  });

  it('memoize clear resets cache', () => {
    let calls = 0;
    const fn = memoize((x) => { calls++; return x; });
    fn(1);
    fn(1);
    assert.strictEqual(calls, 1);
    fn.clear();
    fn(1);
    assert.strictEqual(calls, 2);
  });
});

describe('object.js edge cases — circular references', () => {
  it('deepClone handles circular references', () => {
    const obj = { a: 1 };
    obj.self = obj;
    const cloned = deepClone(obj);
    assert.strictEqual(cloned.a, 1);
    assert.strictEqual(cloned.self, cloned);
  });
});

describe('async.js edge cases', () => {
  it('memoize caches object keys', () => {
    let calls = 0;
    const fn = memoize((obj) => { calls++; return obj.x * 2; });
    const key = { x: 5 };
    assert.strictEqual(fn(key), 10);
    assert.strictEqual(fn(key), 10);
    assert.strictEqual(calls, 1);
    fn.clear();
  });

  it('retry resolves immediately on first success', async () => {
    const start = Date.now();
    const result = await retry(() => Promise.resolve('ok'), 3, 100);
    assert.strictEqual(result, 'ok');
    assert.ok(Date.now() - start < 50, 'should resolve immediately without delay');
  });
});

describe('barrel integrity', () => {
  it('utils.js exports expected functions', async () => {
    const utils = await import('../utils.js');
    assert.ok(typeof utils.escapeHtml === 'function', 'escapeHtml');
    assert.ok(typeof utils.clamp === 'function', 'clamp');
    assert.ok(typeof utils.deepClone === 'function', 'deepClone');
    assert.ok(typeof utils.sleep === 'function', 'sleep');
    assert.ok(typeof utils.formatNumber === 'function', 'formatNumber');
    assert.ok(typeof utils.debounce === 'function', 'debounce');
    assert.ok(typeof utils.memoize === 'function', 'memoize');
    assert.ok(typeof utils.once === 'function', 'once');
    assert.ok(typeof utils.unique === 'function', 'unique');
    assert.ok(typeof utils.showToast === 'function', 'showToast');
  });

  it('default export is a frozen namespace object', async () => {
    const { default: Utils } = await import('../utils.js');
    assert.ok(Utils, 'default export exists');
    assert.strictEqual(typeof Utils, 'object', 'default export is an object');
    assert.strictEqual(Object.isFrozen(Utils), true, 'default export is frozen');
  });
});

describe('async.js advanced edge cases', () => {
  it('debounceLeading fires immediately on first call', () => {
    let calls = 0;
    const fn = debounceLeading(() => calls++, 100);
    fn();
    assert.strictEqual(calls, 1, 'should fire immediately on first call');
    fn();
    assert.strictEqual(calls, 1, 'should not fire again within wait');
  });

  it('throttle trailing call is flushed after cooldown', async () => {
    let calls = 0;
    const fn = throttle(() => calls++, 50);
    fn(); // fires immediately
    fn(); // queued as trailing
    assert.strictEqual(calls, 1);
    await sleep(80);
    assert.strictEqual(calls, 2, 'trailing call should be flushed after cooldown');
  });

  it('retry with zero retries fails immediately', async () => {
    let calls = 0;
    await assert.rejects(
      retry(() => { calls++; return Promise.reject(new Error('fail')); }, 0, 10),
      /fail/
    );
    assert.strictEqual(calls, 1, 'should only call once with zero retries');
  });

  it('memoize accepts maxSize without crashing', () => {
    let calls = 0;
    const fn = memoize((x) => { calls++; return x * 2; }, 2);
    fn(1); fn(2);
    assert.strictEqual(calls, 2);
    fn(1); // cached
    assert.strictEqual(calls, 2, 'should be cached');
  });
});

describe('number.js advanced edge cases', () => {
  it('clamp with Infinity bounds returns NaN', () => {
    assert.ok(Number.isNaN(clamp(5, 0, Infinity)), 'non-finite max returns NaN');
    assert.ok(Number.isNaN(clamp(5, -Infinity, 10)), 'non-finite min returns NaN');
    assert.ok(Number.isNaN(clamp(5, Infinity, 10)), 'non-finite min returns NaN');
  });
});

describe('object.js advanced edge cases', () => {
  it('deepEqual with null prototype objects', () => {
    const a = Object.create(null);
    a.x = 1;
    const b = Object.create(null);
    b.x = 1;
    assert.strictEqual(deepEqual(a, b), true);
  });
});

describe('url.js advanced edge cases', () => {
  it('parseQueryString with URL-encoded values', () => {
    assert.deepStrictEqual(parseQueryString('?a=hello%20world'), { a: 'hello world' });
    assert.deepStrictEqual(parseQueryString('?b=100%25'), { b: '100%' });
  });
});

describe('Parameterized tests', () => {
  it('clamp handles many value combinations', () => {
    const cases = [
      [5, 0, 10, 5], [-1, 0, 10, 0], [15, 0, 10, 10],
      [3, 3, 3, 3], [0, 0, 10, 0], [10, 0, 10, 10],
      ['5', 0, 10, 5], ['abc', 0, 10, 0]
    ];
    for (const [val, min, max, expected] of cases) {
      assert.strictEqual(clamp(val, min, max), expected, `clamp(${val}, ${min}, ${max})`);
    }
  });

  it('escapeHtml escapes many special characters', () => {
    const cases = [
      ['<div>', '&lt;div&gt;'],
      ['"test"', '&quot;test&quot;'],
      ["it's", 'it&#039;s'],
      ['a & b', 'a &amp; b']
    ];
    for (const [input, expected] of cases) {
      assert.strictEqual(escapeHtml(input), expected, `escapeHtml(${JSON.stringify(input)})`);
    }
  });

  it('isBlank detects many empty/whitespace inputs', () => {
    const blanks = [null, undefined, '', '   ', '\t', '\n', ' \t\n '];
    for (const input of blanks) {
      assert.strictEqual(isBlank(input), true, `isBlank(${JSON.stringify(input)}) should be true`);
    }
    const nonBlanks = ['a', '  a  ', '0', 0, false];
    for (const input of nonBlanks) {
      assert.strictEqual(isBlank(input), false, `isBlank(${JSON.stringify(input)}) should be false`);
    }
  });

  it('deepEqual compares many object pairs', () => {
    const equalCases = [
      [{ a: 1 }, { a: 1 }],
      [[1, 2], [1, 2]],
      [{ a: { b: 2 } }, { a: { b: 2 } }],
      [new Date('2024-01-01'), new Date('2024-01-01')],
      [/abc/g, /abc/g]
    ];
    for (const [a, b] of equalCases) {
      assert.strictEqual(deepEqual(a, b), true, `deepEqual(${JSON.stringify(a)}, ${JSON.stringify(b)})`);
    }
    const unequalCases = [
      [{ a: 1 }, { a: 2 }],
      [[1, 2], [1, 3]],
      [{ a: { b: 2 } }, { a: { b: 3 } }],
      [/abc/g, /abc/i]
    ];
    for (const [a, b] of unequalCases) {
      assert.strictEqual(deepEqual(a, b), false, `deepEqual(${JSON.stringify(a)}, ${JSON.stringify(b)}) should be false`);
    }
  });

  it('formatNumber handles many edge inputs', () => {
    const cases = [
      [null, '—'], [undefined, '—'], [NaN, '—'], [Infinity, '—'],
      [1234.56, '1,234.56'], [0, '0'], [-5, '-5']
    ];
    for (const [input, expected] of cases) {
      assert.strictEqual(formatNumber(input), expected, `formatNumber(${JSON.stringify(input)})`);
    }
  });
});

describe('Stress tests', () => {
  it('flatten handles 10,000 nested items', () => {
    const nested = Array.from({ length: 10000 }, (_, i) => [i]);
    const result = flatten(nested);
    assert.strictEqual(result.length, 10000, 'flatten should flatten 10,000 nested items');
    assert.strictEqual(result[0], 0, 'first item should be 0');
    assert.strictEqual(result[9999], 9999, 'last item should be 9999');
  });

  it('memoize handles 10,000 unique calls', () => {
    let calls = 0;
    const fn = memoize((x) => { calls++; return x * 2; }, 15000);
    for (let i = 0; i < 10000; i++) {
      fn(i);
    }
    assert.strictEqual(calls, 10000, 'memoize should call fn once per unique value');
    for (let i = 0; i < 10000; i++) {
      fn(i);
    }
    assert.strictEqual(calls, 10000, 'memoize should cache all 10,000 values');
  });

  it('unique handles 10,000 mixed values', () => {
    const arr = Array.from({ length: 10000 }, (_, i) => i % 100);
    const result = unique(arr);
    assert.strictEqual(result.length, 100, 'unique should deduplicate 10,000 values to 100 unique values');
  });

  it('clamp handles 1,000 random values without exceptions', () => {
    for (let i = 0; i < 1000; i++) {
      const val = Math.floor(Math.random() * 200) - 100;
      const min = Math.floor(Math.random() * 100) - 50;
      const max = min + Math.floor(Math.random() * 100) + 1;
      const result = clamp(val, min, max);
      assert.ok(result >= min && result <= max, `clamp(${val}, ${min}, ${max}) should be within bounds`);
    }
  });
});

describe('Fuzz / property-based tests', () => {
  it('escapeHtml handles random strings with injected specials', () => {
    for (let i = 0; i < 100; i++) {
      const random = Math.random().toString(36).substring(2);
      const injected = `<script>${random}</script>`;
      const result = escapeHtml(injected);
      assert.ok(!result.includes('<script>'), 'escapeHtml should remove script tags');
      assert.ok(result.includes(random), 'escapeHtml should preserve non-special content');
    }
  });

  it('isBlank handles random whitespace and falsy inputs', () => {
    const blanks = [
      null, undefined, '', ' ', '\t', '\n', '  ', '\t\n\r ',
      '        ', '\n\n\n'
    ];
    for (const input of blanks) {
      assert.strictEqual(isBlank(input), true, `isBlank(${JSON.stringify(input)}) should be true`);
    }
  });

  it('deepEqual is reflexive for random objects', () => {
    for (let i = 0; i < 50; i++) {
      const obj = { a: Math.random(), b: [Math.random(), { c: Math.random() }] };
      assert.strictEqual(deepEqual(obj, obj), true, 'deepEqual should be reflexive');
    }
  });

  it('deepEqual detects mutation in random objects', () => {
    for (let i = 0; i < 50; i++) {
      const obj = { a: Math.random(), b: [Math.random()] };
      const copy = deepClone(obj);
      assert.strictEqual(deepEqual(obj, copy), true, 'deepClone should produce equal copy');
      copy.a = Math.random() + 1;
      assert.strictEqual(deepEqual(obj, copy), false, 'deepEqual should detect mutated copy');
    }
  });

  it('parseQueryString round-trips with stringifyQueryString', () => {
    for (let i = 0; i < 50; i++) {
      const key = `k${i}`;
      const val = `v${i}`;
      const qs = `?${key}=${val}`;
      const parsed = parseQueryString(qs);
      assert.strictEqual(parsed[key], val, `parseQueryString should round-trip ${qs}`);
    }
  });

  it('clamp fuzz with random triples', () => {
    for (let i = 0; i < 200; i++) {
      const val = (Math.random() * 200) - 100;
      const min = (Math.random() * 100) - 50;
      const max = min + Math.random() * 100;
      const result = clamp(val, min, max);
      if (Number.isFinite(min) && Number.isFinite(max)) {
        assert.ok(result >= Math.min(min, max) && result <= Math.max(min, max), `clamp(${val}, ${min}, ${max}) should be within bounds`);
      }
    }
  });
});

describe('New function utilities', () => {
  it('zipWith applies function to paired elements', () => {
    assert.deepStrictEqual(zipWith([1, 2, 3], [4, 5, 6], (a, b) => a + b), [5, 7, 9]);
    assert.deepStrictEqual(zipWith([1, 2], [10, 20, 30], (a, b) => a * b), [10, 40]);
  });

  it('curry transforms multi-arg functions', () => {
    const add = curry((a, b, c) => a + b + c);
    assert.strictEqual(add(1)(2)(3), 6);
    assert.strictEqual(add(1, 2)(3), 6);
    assert.strictEqual(add(1)(2, 3), 6);
  });

  it('partial fixes leading arguments', () => {
    const add5 = partial((a, b) => a + b, 5);
    assert.strictEqual(add5(3), 8);
    assert.strictEqual(add5(10), 15);
  });

  it('tap runs side effects and returns original value', () => {
    let sideEffect = 0;
    const result = tap(5, (x) => { sideEffect = x; });
    assert.strictEqual(result, 5);
    assert.strictEqual(sideEffect, 5);
  });
});

describe('Barrel metadata (index.js)', async () => {
  const barrel = await import('./index.js');

  it('getExportNames returns a frozen array of strings', () => {
    const names = barrel.getExportNames();
    assert.ok(Array.isArray(names), 'should be an array');
    assert.ok(names.length > 0, 'should not be empty');
    assert.ok(names.every((n) => typeof n === 'string'), 'every item should be a string');
    assert.strictEqual(Object.isFrozen(names), true, 'should be frozen');
  });

  it('getNamespaceNames returns all 19 namespaces', () => {
    const names = barrel.getNamespaceNames();
    const expected = [
      'string', 'number', 'async', 'array', 'object', 'url', 'storage',
      'accessibility', 'dom', 'format', 'type', 'function', 'crypto',
      'color', 'download', 'fetch', 'privacy', 'clipboard', 'vscode'
    ];
    for (const ns of expected) {
      assert.ok(names.includes(ns), `should include namespace "${ns}"`);
    }
  });

  it('__barrel__ metadata has all required fields', () => {
    assert.ok(barrel.__barrel__, '__barrel__ should be defined');
    assert.strictEqual(barrel.__barrel__.name, 'simplebeacon-vscode-utils');
    assert.strictEqual(barrel.__barrel__.moduleCount, 19);
    assert.ok(typeof barrel.__barrel__.exportCount === 'number');
    assert.ok(typeof barrel.__barrel__.namespaceCount === 'number');
    assert.strictEqual(barrel.__barrel__.version, '1.0.0');
    assert.ok(typeof barrel.__barrel__.timestamp === 'string');
    assert.ok(Array.isArray(barrel.__barrel__.exports));
    assert.ok(Array.isArray(barrel.__barrel__.namespaces));
  });

  it('validateBarrelIntegrity passes for healthy barrel', () => {
    const result = barrel.validateBarrelIntegrity();
    assert.strictEqual(result.valid, true, `integrity errors: ${result.errors.join(', ')}`);
    assert.deepStrictEqual(result.errors, []);
  });

  it('default export contains all namespaces', () => {
    const expected = [
      'string', 'number', 'async', 'array', 'object', 'url', 'storage',
      'accessibility', 'dom', 'format', 'type', 'function', 'crypto',
      'color', 'download', 'fetch', 'privacy', 'clipboard', 'vscode'
    ];
    for (const key of expected) {
      assert.ok(barrel.default[key], `namespace "${key}" should exist on default export`);
    }
  });

  it('default export contains inline namespace', () => {
    assert.ok(barrel.default.inline, 'inline namespace should exist on default export');
    assert.strictEqual(Object.isFrozen(barrel.default.inline), true, 'inline namespace should be frozen');
  });

  it('inline namespace contains barrel-native utilities', () => {
    assert.strictEqual(typeof barrel.default.inline.seq, 'function');
    assert.strictEqual(typeof barrel.default.inline.flow, 'function');
    assert.strictEqual(typeof barrel.default.inline.negate, 'function');
    assert.strictEqual(typeof barrel.default.inline.zipWith, 'function');
    assert.strictEqual(typeof barrel.default.inline.curry, 'function');
    assert.strictEqual(typeof barrel.default.inline.partial, 'function');
    assert.strictEqual(typeof barrel.default.inline.tap, 'function');
  });
});

describe('Snapshot-style tests', () => {
  it('formatNumber produces expected outputs', () => {
    assert.strictEqual(formatNumber(1234.56), '1,234.56');
    assert.strictEqual(formatNumber(0), '0');
    assert.strictEqual(formatNumber(-5), '-5');
    assert.strictEqual(formatNumber(null), '—');
    assert.strictEqual(formatNumber(undefined), '—');
    assert.strictEqual(formatNumber(NaN), '—');
  });

  it('formatPercent produces expected outputs', () => {
    assert.strictEqual(formatPercent(0.5), '0.5%');
    assert.strictEqual(formatPercent(0.123), '0.1%');
    assert.strictEqual(formatPercent(50), '50.0%');
    assert.strictEqual(formatPercent('75%'), '75%');
  });

  it('deepClone produces independent copies', () => {
    const original = { a: 1, b: { c: [2, 3] } };
    const cloned = deepClone(original);
    assert.deepStrictEqual(cloned, original, 'clone should match original');
    cloned.b.c.push(4);
    assert.strictEqual(original.b.c.length, 2, 'original should be unaffected');
  });

  it('parseQueryString produces expected objects', () => {
    assert.deepStrictEqual(parseQueryString('?a=1&b=2'), { a: '1', b: '2' });
    assert.deepStrictEqual(parseQueryString('?x=hello%20world'), { x: 'hello world' });
  });

  it('redactPathForDisplay masks sensitive paths', () => {
    const redacted = redactPathForDisplay('C:/Users/secret/file.txt');
    assert.ok(redacted.startsWith('…'), `expected redacted path to start with …, got: ${redacted}`);
    assert.strictEqual(isRedactedPathDisplay(redacted), true);
  });
});
