/**
 * Unit tests for ai-platform utils-lib sub-modules.
 * Run with: node --test __tests__.mjs
 */

import assert from 'assert';
import { describe, it } from 'node:test';

// ── string ──
import { escapeRegExp, truncate, capitalize, words, repeat, titleCase, slugify, isBlank, stripHtml, kebabCase, camelCase, snakeCase, padStart, padEnd, pluralize } from './string.js';

// ── format ──
import { formatNumber, formatPercent, formatBytes, formatDuration, formatDate, relativeTime, formatAiSummarySkipMessage } from './format.js';

// ── download ──
import { downloadJson, downloadText } from './download.js';

// ── async ──
import { sleep, memoize, retry, debounce, throttle } from './async.js';

// ── array ──
import { unique, flatten, range, chunk, compact, groupBy, partition, sample, shuffle, sum, mean, sortBy } from './array.js';

// ── object ──
import { deepClone, deepEqual, pick, omit, get, set, isEmpty } from './object.js';

// ── url ──
import { parseQueryString, stringifyQueryString, isValidUrl } from './url.js';

// ── crypto ──
import { randomId, uid, hash } from './crypto.js';

// ── type ──
import { isDefined, isNil } from './type.js';

// ── number ──
import { clamp, roundTo, safeParseInt } from './number.js';

// ── function ──
import { seq, flow, negate, noop } from './function.js';

// ── fetch ──
import { fetchWithTimeout } from './fetch.js';

// ── path ──
import { normalizeSlashes, redactPathForDisplay, isRedactedPathDisplay, formatPathLabel } from './path.js';

describe('string.js', () => {
  it('escapeRegExp escapes regex metachars', () => {
    assert.strictEqual(escapeRegExp('.*+?^${}()|[]\\'), '\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
  });

  it('truncate respects maxLen', () => {
    assert.strictEqual(truncate('hello world', 8), 'hello w…');
    assert.strictEqual(truncate('hi', 8), 'hi');
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

  it('pluralize chooses correct form', () => {
    assert.strictEqual(pluralize(1, 'item'), '1 item');
    assert.strictEqual(pluralize(2, 'item'), '2 items');
  });
});

describe('format.js', () => {
  it('formatNumber formats with locale', () => {
    assert.strictEqual(formatNumber(1234.56), '1,234.56');
    assert.strictEqual(formatNumber(null), '—');
  });

  it('formatPercent formats percentage', () => {
    assert.strictEqual(formatPercent(0.1234), '0.1%');
    assert.strictEqual(formatPercent(100), '100.0%');
    assert.strictEqual(formatPercent(null), '—');
  });

  it('formatBytes formats human readable', () => {
    assert.strictEqual(formatBytes(0), '0 B');
    assert.strictEqual(formatBytes(1024), '1.00 KB');
    assert.strictEqual(formatBytes(1024 * 1024), '1.00 MB');
  });

  it('formatDuration formats ms', () => {
    assert.strictEqual(formatDuration(500), '500ms');
    assert.strictEqual(formatDuration(60000), '1m 0s');
  });

  it('formatDate formats dates', () => {
    const result = formatDate('2024-01-15');
    assert.ok(result !== '—', 'should format date');
  });

  it('relativeTime produces relative string', () => {
    const result = relativeTime(Date.now() - 60000);
    assert.ok(result.includes('ago'), 'should be in the past');
  });

  it('formatAiSummarySkipMessage returns skip message', () => {
    const msg = formatAiSummarySkipMessage('OpenAI is not configured');
    assert.ok(msg.includes('Optional AI narrative skipped'));
  });
});

describe('async.js', () => {
  it('sleep waits specified ms', async () => {
    const start = Date.now();
    await sleep(50);
    assert.ok(Date.now() - start >= 40);
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

  it('sample returns random element', () => {
    const arr = [1, 2, 3];
    const result = sample(arr);
    assert.ok(arr.includes(result));
  });

  it('shuffle returns shuffled copy', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr);
    assert.deepStrictEqual(result.sort(), arr.sort());
    assert.strictEqual(result.length, arr.length);
    // Run multiple times to verify shuffling actually occurs
    let shuffledAtLeastOnce = false;
    for (let i = 0; i < 10; i++) {
      const r = shuffle(arr);
      if (r[0] !== 1 || r[1] !== 2 || r[2] !== 3 || r[3] !== 4 || r[4] !== 5) {
        shuffledAtLeastOnce = true;
        break;
      }
    }
    assert.strictEqual(shuffledAtLeastOnce, true, 'shuffle should change order at least once in 10 tries');
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

  it('pick selects keys', () => {
    assert.deepStrictEqual(pick({ a: 1, b: 2, c: 3 }, ['a', 'c']), { a: 1, c: 3 });
  });

  it('omit removes keys', () => {
    assert.deepStrictEqual(omit({ a: 1, b: 2, c: 3 }, ['b']), { a: 1, c: 3 });
  });

  it('get reads nested path', () => {
    assert.strictEqual(get({ a: { b: 1 } }, 'a.b'), 1);
    assert.strictEqual(get({ a: { b: 1 } }, 'a.c', 'default'), 'default');
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

describe('url.js', () => {
  it('parseQueryString parses query strings', () => {
    assert.deepStrictEqual(parseQueryString('?a=1&b=2'), { a: '1', b: '2' });
  });

  it('stringifyQueryString builds query strings', () => {
    assert.strictEqual(stringifyQueryString({ a: 1, b: 2 }), 'a=1&b=2');
    assert.strictEqual(stringifyQueryString({ a: null, b: '' }), '');
  });

  it('isValidUrl validates URLs', () => {
    assert.strictEqual(isValidUrl('https://example.com'), true);
    assert.strictEqual(isValidUrl('not-a-url'), false);
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

  it('roundTo rounds to decimals', () => {
    assert.strictEqual(roundTo(1.234, 2), 1.23);
    assert.strictEqual(roundTo(1.235, 2), 1.24);
  });

  it('safeParseInt parses safely', () => {
    assert.strictEqual(safeParseInt('42'), 42);
    assert.strictEqual(safeParseInt('abc', 0), 0);
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

describe('path.js', () => {
  it('normalizeSlashes converts backslashes', () => {
    assert.strictEqual(normalizeSlashes('C:\\Users\\test'), 'C:/Users/test');
  });

  it('redactPathForDisplay shortens paths', () => {
    const result = redactPathForDisplay('C:/Users/Trevor/Projects/myapp/src/index.js');
    assert.ok(result.startsWith('…'));
  });

  it('isRedactedPathDisplay detects redacted paths', () => {
    assert.strictEqual(isRedactedPathDisplay('…/src/index.js'), true);
    assert.strictEqual(isRedactedPathDisplay('src/index.js'), false);
  });

  it('formatPathLabel returns basename or redacted', () => {
    // Home paths get redacted first
    assert.ok(formatPathLabel('/home/user/project/file.js').includes('file.js'));
    // Simple relative paths return basename
    assert.strictEqual(formatPathLabel('project/file.js'), 'file.js');
  });
});
