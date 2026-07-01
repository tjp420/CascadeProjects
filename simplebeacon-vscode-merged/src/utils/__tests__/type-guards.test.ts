import {
  isString, isNumber, isBoolean, isFunction, isArray, isObject, isDate, isRegExp, isPromise, isError
} from '../type-guards';

describe('type guards', () => {
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
