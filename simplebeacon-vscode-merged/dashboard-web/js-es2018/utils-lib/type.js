/**
 * type utilities.
 */


/**
 * Type guard: returns true if the value is neither null nor undefined.
 * @template T
 * @param {T | null | undefined} value
 * @returns {value is T}
 */
export function isDefined(value) {
  return value !== null && value !== undefined;
}


/** Type guard: value is null.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isNull(value) {
  return value === null;
}


/** Type guard: value is undefined.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isUndefined(value) {
  return value === undefined;
}


/** Type guard: value is null or undefined.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isNil(value) {
  return value == null;
}


/** Type guard: value is a symbol.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSymbol(value) {
  return typeof value === 'symbol';
}


/** Type guard: value is a Map.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isMap(value) {
  return value instanceof Map;
}


/** Type guard: value is a Set.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSet(value) {
  return value instanceof Set;
}

/** Type guard: value is a boolean.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isBoolean(value) {
  return typeof value === 'boolean';
}

/** Type guard: value is a number (and not NaN).
 * @param {unknown} value
 * @returns {boolean}
 */
export function isNumber(value) {
  return typeof value === 'number' && !Number.isNaN(value);
}

/** Type guard: value is a string.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isString(value) {
  return typeof value === 'string';
}

/** Type guard: value is an Array.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isArray(value) {
  return Array.isArray(value);
}

/** Type guard: value is a function.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isFunction(value) {
  return typeof value === 'function';
}

/** Type guard: value is a plain object (not null, not array, not function).
 * @param {unknown} value
 * @returns {boolean}
 */
export function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Type guard: value is a Date.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isDate(value) {
  return value instanceof Date;
}

/** Type guard: value is a RegExp.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRegExp(value) {
  return value instanceof RegExp;
}

/** Type guard: value is a Promise.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPromise(value) {
  return value !== null && typeof value === 'object' && typeof value.then === 'function';
}

/** Type guard: value is an Error.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isError(value) {
  return value instanceof Error;
}
