/**
 * @module utils.test
 * Unit tests for the moved/refactored utils submodules.
 * Run with: node --test js-es2018/utils.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as string from './utils/string.js';
import * as array from './utils/array.js';
import * as type from './utils/type.js';
import * as functional from './utils/functional.js';
import * as object from './utils/object.js';

describe('string', () => {
    it('trims whitespace', () => { assert.equal(string.trim('  hello  '), 'hello'); });
    it('lowercases', () => { assert.equal(string.toLower('Hello'), 'hello'); });
    it('uppercases', () => { assert.equal(string.toUpper('hello'), 'HELLO'); });
    it('startsWith', () => { assert.equal(string.startsWith('he', 'hello'), true); });
    it('endsWith', () => { assert.equal(string.endsWith('lo', 'hello'), true); });
    it('includes', () => { assert.equal(string.includes('ell', 'hello'), true); });
    it('split', () => { assert.deepStrictEqual(string.split('-', 'a-b-c'), ['a', 'b', 'c']); });
    it('join', () => { assert.equal(string.join('-', ['a', 'b']), 'a-b'); });
    it('match', () => { assert.ok(string.match(/h.l/, 'hello')); });
    it('replace', () => { assert.equal(string.replace('l', 'L', 'hello'), 'heLlo'); });
    it('isBlank null', () => { assert.equal(string.isBlank(null), true); });
    it('isBlank whitespace', () => { assert.equal(string.isBlank('   '), true); });
    it('isBlank value', () => { assert.equal(string.isBlank('hello'), false); });
    it('words', () => { assert.deepStrictEqual(string.words('hello world'), ['hello', 'world']); });
    it('wordCount', () => { assert.equal(string.wordCount('hello world'), 2); });
    it('repeat', () => { assert.equal(string.repeat('ab', 3), 'ababab'); });
    it('titleCase', () => { assert.equal(string.titleCase('hello world'), 'Hello World'); });
    it('slugify', () => { assert.equal(string.slugify('Hello World!'), 'hello-world'); });
    it('reverse', () => { assert.equal(string.reverse('hello'), 'olleh'); });
    it('splitLines', () => { assert.deepStrictEqual(string.splitLines('a\r\nb\nc'), ['a', 'b', 'c']); });
    it('stripAnsi', () => { assert.equal(string.stripAnsi('\u001B[31mred\u001B[0m'), 'red'); });
});

describe('array', () => {
    it('head', () => { assert.equal(array.head([1, 2, 3]), 1); });
    it('tail', () => { assert.deepStrictEqual(array.tail([1, 2, 3]), [2, 3]); });
    it('last', () => { assert.equal(array.last([1, 2, 3]), 3); });
    it('init', () => { assert.deepStrictEqual(array.init([1, 2, 3]), [1, 2]); });
    it('take', () => { assert.deepStrictEqual(array.take(2, [1, 2, 3]), [1, 2]); });
    it('drop', () => { assert.deepStrictEqual(array.drop(1, [1, 2, 3]), [2, 3]); });
    it('takeLast', () => { assert.deepStrictEqual(array.takeLast(2, [1, 2, 3]), [2, 3]); });
    it('dropLast', () => { assert.deepStrictEqual(array.dropLast(1, [1, 2, 3]), [1, 2]); });
    it('pluck', () => { assert.deepStrictEqual(array.pluck('a', [{ a: 1 }, { a: 2 }]), [1, 2]); });
    it('find', () => { assert.equal(array.find(x => x > 1, [1, 2, 3]), 2); });
    it('findIndex', () => { assert.equal(array.findIndex(x => x > 1, [1, 2, 3]), 1); });
    it('contains', () => { assert.equal(array.contains(2, [1, 2, 3]), true); });
    it('sort', () => { assert.deepStrictEqual(array.sort([3, 1, 2]), [1, 2, 3]); });
    it('uniqBy', () => { assert.deepStrictEqual(array.uniqBy(x => x, [1, 2, 2, 3]), [1, 2, 3]); });
    it('sortByInline', () => { assert.deepStrictEqual(array.sortByInline(x => x, [3, 1, 2]), [1, 2, 3]); });
    it('flattenInline', () => { assert.deepStrictEqual(array.flattenInline(2, [[1, 2], [3, [4]]]), [1, 2, 3, [4]]); });
    it('reverseInline', () => { assert.deepStrictEqual(array.reverseInline([1, 2, 3]), [3, 2, 1]); });
    it('zip', () => { assert.deepStrictEqual(array.zip([1, 2], ['a', 'b']), [[1, 'a'], [2, 'b']]); });
    it('unzip', () => { assert.deepStrictEqual(array.unzip([[1, 'a'], [2, 'b']]), [[1, 2], ['a', 'b']]); });
    it('project', () => { assert.deepStrictEqual(array.project(['a'], [{ a: 1, b: 2 }]), [{ a: 1 }]); });
    it('compact does not throw', () => { assert.deepStrictEqual(array.compact([1, null, 2]), [1, 2]); });
});

describe('type', () => {
    it('isPlainObject', () => { assert.equal(type.isPlainObject({}), true); });
    it('isPlainObject false for array', () => { assert.equal(type.isPlainObject([]), false); });
    it('isFormData', () => { assert.equal(type.isFormData(new FormData()), true); });
    it('isBlob', () => { assert.equal(type.isBlob(new Blob()), true); });
    it('isFile', () => { assert.equal(type.isFile(new File([], 'x')), true); });
    it('isArrayLike', () => { assert.equal(type.isArrayLike([1, 2, 3]), true); });
    it('isTypedArray', () => { assert.equal(type.isTypedArray(new Uint8Array(1)), true); });
    it('isGenerator', () => { assert.equal(type.isGenerator(function* () {}), true); });
    it('isIterable', () => { assert.equal(type.isIterable([1, 2, 3]), true); });
    it('isPromise cross-realm safe', () => { assert.equal(type.isPromise(Promise.resolve(1)), true); });
});

describe('functional', () => {
    it('flip', () => { assert.equal(functional.flip((a, b) => a - b)(2, 5), 3); });
    it('tryCatch', () => { assert.equal(functional.tryCatch(() => { throw new Error('x'); }, () => 'caught')(), 'caught'); });
    it('defaultTo NaN', () => { assert.equal(functional.defaultTo('def', NaN), 'def'); });
    it('prop', () => { assert.equal(functional.prop('a', { a: 1 }), 1); });
    it('getPath', () => { assert.equal(functional.getPath(['a', 'b'], { a: { b: 1 } }), 1); });
    it('pathOr', () => { assert.equal(functional.pathOr('def', ['a', 'b'], { a: {} }), 'def'); });
    it('when', () => { assert.equal(functional.when(x => x > 0, x => x * 2, 5), 10); });
    it('unless', () => { assert.equal(functional.unless(x => x > 0, x => x * 2, 5), 5); });
    it('ifElse', () => { assert.equal(functional.ifElse(x => x > 0, x => x * 2, x => x * 3, -5), -15); });
    it('cond', () => { assert.equal(functional.cond([[x => x > 0, x => x * 2]])(5), 10); });
    it('allPass', () => { assert.equal(functional.allPass([x => x > 0, x => x < 10])(5), true); });
    it('anyPass', () => { assert.equal(functional.anyPass([x => x > 0, x => x > 10])(5), true); });
    it('complement', () => { assert.equal(functional.complement(x => x > 0)(-1), true); });
    it('always', () => { assert.equal(functional.always(7)(), 7); });
    it('T', () => { assert.equal(functional.T()(), true); });
    it('F', () => { assert.equal(functional.F()(), false); });
    it('propEq', () => { assert.equal(functional.propEq('a', 1, { a: 1 }), true); });
    it('pathEq', () => { assert.equal(functional.pathEq(['a', 'b'], 2, { a: { b: 2 } }), true); });
    it('onceInline', () => {
        const fn = functional.onceInline(() => Math.random());
        assert.equal(fn(), fn());
    });
});

describe('object', () => {
    it('evolve', () => { assert.deepStrictEqual(object.evolve({ a: x => x + 1 }, { a: 1, b: 2 }), { a: 2, b: 2 }); });
    it('dissoc', () => { assert.deepStrictEqual(object.dissoc('a', { a: 1, b: 2 }), { b: 2 }); });
    it('mergeDeepLeft', () => { assert.deepStrictEqual(object.mergeDeepLeft({ a: 1 }, { a: 2, b: 3 }), { a: 1, b: 3 }); });
    it('mergeDeepRight', () => { assert.deepStrictEqual(object.mergeDeepRight({ a: 1 }, { a: 2, b: 3 }), { a: 2, b: 3 }); });
    it('memoizeBy', () => { assert.equal(object.memoizeBy(x => x * 2, x => x)(3), 6); });
});
