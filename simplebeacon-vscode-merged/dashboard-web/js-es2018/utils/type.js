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
    return value !== null && typeof value === 'object' && typeof value.then === 'function';
}

export function isError(value) {
    return value instanceof Error;
}
