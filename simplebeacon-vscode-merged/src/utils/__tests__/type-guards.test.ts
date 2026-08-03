import {
  isDefined,
  isString,
  isNumber,
  isBoolean,
  isFunction,
  isArray,
  isObject,
  isDate,
  isRegExp,
  isPromise,
  isError,
  isNull,
  isUndefined,
  isNil,
  isSymbol,
  isMap,
  isSet,
  isPlainObject,
} from '../type-guards';

describe('type guards', () => {
  describe('isDefined', () => {
    test('true for string', () => expect(isDefined('hello')).toBe(true));
    test('true for zero', () => expect(isDefined(0)).toBe(true));
    test('true for false', () => expect(isDefined(false)).toBe(true));
    test('false for null', () => expect(isDefined(null)).toBe(false));
    test('false for undefined', () => expect(isDefined(undefined)).toBe(false));
  });

  describe('isNull', () => {
    test('true for null', () => expect(isNull(null)).toBe(true));
    test('false for undefined', () => expect(isNull(undefined)).toBe(false));
    test('false for string', () => expect(isNull('null')).toBe(false));
  });

  describe('isUndefined', () => {
    test('true for undefined', () => expect(isUndefined(undefined)).toBe(true));
    test('false for null', () => expect(isUndefined(null)).toBe(false));
    test('false for string', () => expect(isUndefined('undefined')).toBe(false));
  });

  describe('isNil', () => {
    test('true for null', () => expect(isNil(null)).toBe(true));
    test('true for undefined', () => expect(isNil(undefined)).toBe(true));
    test('false for zero', () => expect(isNil(0)).toBe(false));
    test('false for empty string', () => expect(isNil('')).toBe(false));
  });

  describe('isSymbol', () => {
    test('true for symbol', () => expect(isSymbol(Symbol('a'))).toBe(true));
    test('false for string', () => expect(isSymbol('sym')).toBe(false));
  });

  describe('isMap', () => {
    test('true for Map', () => expect(isMap(new Map())).toBe(true));
    test('false for plain object', () => expect(isMap({})).toBe(false));
  });

  describe('isSet', () => {
    test('true for Set', () => expect(isSet(new Set())).toBe(true));
    test('false for array', () => expect(isSet([])).toBe(false));
  });

  describe('isString', () => {
    test('true for string', () => expect(isString('hello')).toBe(true));
    test('false for number', () => expect(isString(42)).toBe(false));
  });

  describe('isNumber', () => {
    test('true for number', () => expect(isNumber(42)).toBe(true));
    test('false for NaN', () => expect(isNumber(NaN)).toBe(false));
    test('false for string', () => expect(isNumber('42')).toBe(false));
  });

  describe('isBoolean', () => {
    test('true for boolean', () => expect(isBoolean(false)).toBe(true));
    test('false for string', () => expect(isBoolean('true')).toBe(false));
  });

  describe('isFunction', () => {
    test('true for function', () => expect(isFunction(() => {})).toBe(true));
    test('false for object', () => expect(isFunction({})).toBe(false));
  });

  describe('isArray', () => {
    test('true for array', () => expect(isArray([])).toBe(true));
    test('false for object', () => expect(isArray({})).toBe(false));
  });

  describe('isObject', () => {
    test('true for plain object', () => expect(isObject({})).toBe(true));
    test('false for array', () => expect(isObject([])).toBe(false));
    test('false for null', () => expect(isObject(null)).toBe(false));
  });

  describe('isPlainObject', () => {
    test('true for plain object', () => expect(isPlainObject({})).toBe(true));
    test('true for object literal', () => expect(isPlainObject({ a: 1 })).toBe(true));
    test('false for null', () => expect(isPlainObject(null)).toBe(false));
    test('false for array', () => expect(isPlainObject([])).toBe(false));
    test('false for Date', () => expect(isPlainObject(new Date())).toBe(false));
    test('false for RegExp', () => expect(isPlainObject(/test/)).toBe(false));
    test('false for function', () => expect(isPlainObject(() => {})).toBe(false));
    test('true for object with null prototype', () => expect(isPlainObject(Object.create(null))).toBe(true));
  });

  describe('isDate', () => {
    test('true for Date', () => expect(isDate(new Date())).toBe(true));
    test('false for string', () => expect(isDate('2024-01-01')).toBe(false));
  });

  describe('isRegExp', () => {
    test('true for RegExp', () => expect(isRegExp(/test/)).toBe(true));
    test('false for string', () => expect(isRegExp('test')).toBe(false));
  });

  describe('isPromise', () => {
    test('true for Promise', () => expect(isPromise(Promise.resolve(1))).toBe(true));
    test('true for thenable', () => expect(isPromise({ then: () => {} })).toBe(true));
    test('false for plain object', () => expect(isPromise({})).toBe(false));
  });

  describe('isError', () => {
    test('true for Error', () => expect(isError(new Error('fail'))).toBe(true));
    test('false for string', () => expect(isError('fail')).toBe(false));
  });
});
