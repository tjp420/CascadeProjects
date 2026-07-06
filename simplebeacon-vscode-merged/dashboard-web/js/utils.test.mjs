/**
 * Unit tests for dashboard-web/js/utils.js inline utility functions.
 * Run with: node utils.test.mjs
 */
import assert from 'assert';

const {
  compose, pipe, curry, partial, tap, flip, tryCatch, defaultTo,
  prop, getPath, pathOr, when, unless, ifElse, cond,
  allPass, anyPass, complement, always, T, F,
  head, tail, last, init, take, drop, takeLast, dropLast,
  pluck, find, findIndex, propEq, pathEq, contains,
  isPlainObject, isElement, isFormData, isBlob, isFile, isArrayLike,
  evolve, dissoc, mergeDeepLeft, mergeDeepRight, project
} = await import('./utils.js');

let pass = 0;
let fail = 0;
function test(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; console.error('FAIL: ' + name + ' — ' + e.message); }
}

// ── Functional helpers ─────────────────────────────────────────
test('compose(f,g)(x) === f(g(x))', () => {
  const result = compose((x) => x + 1, (x) => x * 2)(3);
  assert.strictEqual(result, 7);
});

test('compose() returns identity', () => {
  assert.strictEqual(compose()(42), 42);
});

test('pipe(f,g)(x) === g(f(x))', () => {
  const result = pipe((x) => x + 1, (x) => x * 2)(3);
  assert.strictEqual(result, 8);
});

test('pipe() returns identity', () => {
  assert.strictEqual(pipe()(42), 42);
});

test('curry adds one arg at a time', () => {
  const add = curry((a, b, c) => a + b + c);
  assert.strictEqual(add(1)(2)(3), 6);
  assert.strictEqual(add(1, 2)(3), 6);
});

test('partial presets args', () => {
  const add = (a, b, c) => a + b + c;
  assert.strictEqual(partial(add, 1, 2)(3), 6);
});

test('tap executes side effect and returns value', () => {
  let side = 0;
  const result = tap(5, (v) => { side = v; });
  assert.strictEqual(result, 5);
  assert.strictEqual(side, 5);
});

test('flip swaps first two args', () => {
  const sub = (a, b) => a - b;
  assert.strictEqual(flip(sub)(3, 10), 7);
});

test('tryCatch returns fn result on success', () => {
  const safe = tryCatch((x) => x * 2, () => 0);
  assert.strictEqual(safe(5), 10);
});

test('tryCatch returns handler on error', () => {
  const safe = tryCatch(() => { throw new Error('oops'); }, (e) => e.message);
  assert.strictEqual(safe(), 'oops');
});

test('defaultTo returns default for null/undefined/NaN', () => {
  assert.strictEqual(defaultTo(42, null), 42);
  assert.strictEqual(defaultTo(42, undefined), 42);
  assert.strictEqual(defaultTo(42, NaN), 42);
  assert.strictEqual(defaultTo(42, 0), 0);
  assert.strictEqual(defaultTo(42, ''), '');
});

// ── Conditional / branching ────────────────────────────────────
test('when applies fn when pred true', () => {
  assert.strictEqual(when((x) => x > 0, (x) => x * 2, 3), 6);
  assert.strictEqual(when((x) => x > 0, (x) => x * 2, -1), -1);
});

test('unless applies fn when pred false', () => {
  assert.strictEqual(unless((x) => x > 0, (x) => x * 2, -1), -2);
  assert.strictEqual(unless((x) => x > 0, (x) => x * 2, 3), 3);
});

test('ifElse branches correctly', () => {
  assert.strictEqual(ifElse((x) => x > 0, (x) => x + 1, (x) => x - 1, 5), 6);
  assert.strictEqual(ifElse((x) => x > 0, (x) => x + 1, (x) => x - 1, -3), -4);
});

test('cond returns first match', () => {
  const fn = cond([
    [(x) => x < 0, () => 'negative'],
    [(x) => x === 0, () => 'zero'],
    [(x) => x > 0, () => 'positive']
  ]);
  assert.strictEqual(fn(-1), 'negative');
  assert.strictEqual(fn(0), 'zero');
  assert.strictEqual(fn(1), 'positive');
});

test('allPass requires every pred true', () => {
  const ok = allPass([(x) => x > 0, (x) => x < 10]);
  assert.strictEqual(ok(5), true);
  assert.strictEqual(ok(15), false);
});

test('anyPass requires any pred true', () => {
  const ok = anyPass([(x) => x < 0, (x) => x > 10]);
  assert.strictEqual(ok(15), true);
  assert.strictEqual(ok(5), false);
});

test('complement negates predicate', () => {
  assert.strictEqual(complement((x) => x > 0)(5), false);
  assert.strictEqual(complement((x) => x > 0)(-1), true);
});

test('always returns constant', () => {
  assert.strictEqual(always(42)(), 42);
});

test('T() always true', () => { assert.strictEqual(T()(), true); });
test('F() always false', () => { assert.strictEqual(F()(), false); });

// ── List helpers ───────────────────────────────────────────────
test('head returns first element', () => {
  assert.strictEqual(head([1, 2, 3]), 1);
  assert.strictEqual(head('abc'), 'a');
  assert.strictEqual(head([]), undefined);
});

test('tail returns rest', () => {
  assert.deepStrictEqual(tail([1, 2, 3]), [2, 3]);
  assert.deepStrictEqual(tail([]), []);
});

test('last returns last element', () => {
  assert.strictEqual(last([1, 2, 3]), 3);
  assert.strictEqual(last('abc'), 'c');
});

test('init returns all but last', () => {
  assert.deepStrictEqual(init([1, 2, 3]), [1, 2]);
  assert.deepStrictEqual(init([]), []);
});

test('take first n', () => {
  assert.deepStrictEqual(take(2, [1, 2, 3]), [1, 2]);
  assert.strictEqual(take(2, 'abc'), 'ab');
});

test('drop first n', () => {
  assert.deepStrictEqual(drop(2, [1, 2, 3]), [3]);
  assert.strictEqual(drop(2, 'abc'), 'c');
});

test('takeLast last n', () => {
  assert.deepStrictEqual(takeLast(2, [1, 2, 3]), [2, 3]);
  assert.strictEqual(takeLast(2, 'abc'), 'bc');
});

test('dropLast drops last n', () => {
  assert.deepStrictEqual(dropLast(2, [1, 2, 3]), [1]);
  assert.strictEqual(dropLast(2, 'abc'), 'a');
});

test('pluck extracts key', () => {
  assert.deepStrictEqual(pluck('a', [{ a: 1 }, { a: 2 }]), [1, 2]);
});

test('find returns first match', () => {
  assert.strictEqual(find((x) => x > 2, [1, 3, 2]), 3);
  assert.strictEqual(find((x) => x > 5, [1, 3, 2]), undefined);
});

test('findIndex returns correct index', () => {
  assert.strictEqual(findIndex((x) => x > 2, [1, 3, 2]), 1);
  assert.strictEqual(findIndex((x) => x > 5, [1, 3, 2]), -1);
});

test('contains checks membership', () => {
  assert.strictEqual(contains(2, [1, 2, 3]), true);
  assert.strictEqual(contains(5, [1, 2, 3]), false);
});

// ── Object helpers ─────────────────────────────────────────────
test('prop reads key safely', () => {
  assert.strictEqual(prop('a', { a: 1 }), 1);
  assert.strictEqual(prop('a', null), undefined);
});

test('getPath with array keys', () => {
  assert.strictEqual(getPath(['a', 'b'], { a: { b: 2 } }), 2);
  assert.strictEqual(getPath(['a', 'c'], { a: { b: 2 } }), undefined);
});

test('getPath with dot-notation string', () => {
  assert.strictEqual(getPath('a.b', { a: { b: 2 } }), 2);
  assert.strictEqual(getPath('a.c', { a: { b: 2 } }), undefined);
});

test('getPath returns undefined for null keys', () => {
  assert.strictEqual(getPath(null, { a: 1 }), undefined);
  assert.strictEqual(getPath(undefined, { a: 1 }), undefined);
});

test('pathOr returns default on missing path', () => {
  assert.strictEqual(pathOr(42, ['a', 'c'], { a: { b: 2 } }), 42);
  assert.strictEqual(pathOr(42, 'a.c', { a: { b: 2 } }), 42);
});

test('propEq checks strict equality', () => {
  assert.strictEqual(propEq('a', 1, { a: 1 }), true);
  assert.strictEqual(propEq('a', 2, { a: 1 }), false);
});

test('pathEq checks deep equality', () => {
  assert.strictEqual(pathEq(['a', 'b'], 2, { a: { b: 2 } }), true);
  assert.strictEqual(pathEq('a.b', 2, { a: { b: 2 } }), true);
});

test('evolve transforms keys', () => {
  assert.deepStrictEqual(evolve({ a: (x) => x + 1 }, { a: 1, b: 2 }), { a: 2, b: 2 });
});

test('dissoc removes key', () => {
  assert.deepStrictEqual(dissoc('a', { a: 1, b: 2 }), { b: 2 });
});

test('mergeDeepLeft a wins on conflicts', () => {
  assert.deepStrictEqual(mergeDeepLeft({ a: { b: 1 } }, { a: { b: 2 } }), { a: { b: 1 } });
});

test('mergeDeepRight b wins on conflicts', () => {
  assert.deepStrictEqual(mergeDeepRight({ a: { b: 1 } }, { a: { b: 2 } }), { a: { b: 2 } });
});

test('project picks keys from list', () => {
  assert.deepStrictEqual(project(['a'], [{ a: 1, b: 2 }, { a: 3, b: 4 }]), [{ a: 1 }, { a: 3 }]);
});

// ── Type guards ────────────────────────────────────────────────
test('isPlainObject', () => {
  assert.strictEqual(isPlainObject({}), true);
  assert.strictEqual(isPlainObject([]), false);
  assert.strictEqual(isPlainObject(null), false);
  assert.strictEqual(isPlainObject(new Date()), false);
});

test('isElement', () => {
  assert.strictEqual(isElement({}), false);
  assert.strictEqual(isElement(null), false);
});

test('isFormData', () => {
  assert.strictEqual(isFormData(null), false);
  if (typeof FormData !== 'undefined') {
    assert.strictEqual(isFormData(new FormData()), true);
  }
});

test('isBlob', () => {
  assert.strictEqual(isBlob(null), false);
});

test('isFile', () => {
  assert.strictEqual(isFile(null), false);
});

test('isArrayLike', () => {
  assert.strictEqual(isArrayLike([]), true);
  assert.strictEqual(isArrayLike('abc'), true);
  assert.strictEqual(isArrayLike({ length: 3 }), true);
  assert.strictEqual(isArrayLike(null), false);
});

// ── Summary ────────────────────────────────────────────────────
console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
