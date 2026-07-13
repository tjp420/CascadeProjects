/**
 * @module type
 */

export function isBlank(value) {
    return value == null || (typeof value === 'string' && value.trim().length === 0);
}

export function noop() { }

export function isDefined(value) {
    return value !== null && value !== undefined;
}

export function isNull(value) {
    return value === null;
}

export function isUndefined(value) {
    return value === undefined;
}

export function isNil(value) {
    return value == null;
}

export function isSymbol(value) {
    return typeof value === 'symbol';
}

export function isMap(value) {
    return value instanceof Map;
}

export function isSet(value) {
    return value instanceof Set;
}

export function isBoolean(value) {
    return typeof value === 'boolean';
}

export function isNumber(value) {
    return typeof value === 'number' && !Number.isNaN(value);
}

export function isString(value) {
    return typeof value === 'string';
}

export function isArray(value) {
    return Array.isArray(value);
}

export function isFunction(value) {
    return typeof value === 'function';
}

export function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isDate(value) {
    return value instanceof Date;
}

export function isRegExp(value) {
    return value instanceof RegExp;
}

export function isPromise(value) {
    return value != null && (value instanceof Promise || Object.prototype.toString.call(value) === '[object Promise]');
}

export function isError(value) {
    return value instanceof Error;
}

export function isPlainObject(value) {
    return value != null && Object.prototype.toString.call(value) === '[object Object]' && value.constructor === Object;
}

export function isElement(value) {
    return value != null && typeof value === 'object' && value.nodeType === 1;
}

export function isFormData(value) {
    return value != null && typeof value === 'object' && value.constructor === FormData;
}

export function isBlob(value) {
    return value != null && typeof value === 'object' && value.constructor === Blob;
}

export function isFile(value) {
    return value != null && typeof value === 'object' && value.constructor === File;
}

export function isArrayLike(value) {
    return value != null && typeof value.length === 'number' && value.length >= 0;
}

export function isWeakMap(value) {
    return value != null && typeof value === 'object' && value.constructor === WeakMap;
}

export function isWeakSet(value) {
    return value != null && typeof value === 'object' && value.constructor === WeakSet;
}

export function isArrayBuffer(value) {
    return value != null && typeof value === 'object' && value.constructor === ArrayBuffer;
}

export function isSharedArrayBuffer(value) {
    return value != null && typeof value === 'object' && value.constructor === SharedArrayBuffer;
}

export function isDataView(value) {
    return value != null && typeof value === 'object' && value.constructor === DataView;
}

export function isTypedArray(value) {
    return value != null && ArrayBuffer.isView(value) && !(value instanceof DataView);
}

export function isGenerator(value) {
    return typeof value === 'function' && value.constructor && value.constructor.name === 'GeneratorFunction';
}

export function isAsyncGenerator(value) {
    return typeof value === 'function' && value.constructor && value.constructor.name === 'AsyncGeneratorFunction';
}

export function isIterable(value) {
    return value != null && typeof value[Symbol.iterator] === 'function';
}

export function isAsyncIterable(value) {
    return value != null && typeof value[Symbol.asyncIterator] === 'function';
}
