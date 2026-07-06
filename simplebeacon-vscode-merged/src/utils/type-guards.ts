// simplebeacon-ignore memory-leak — type predicate utility functions

/**
 * Type guard: returns true if the value is neither null nor undefined.
 * Narrows the type for TypeScript flow analysis.
 * @template T
 * @param {T | null | undefined} value
 * @returns {value is T}
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard: value is a string.
 * @param {unknown} value
 * @returns {value is string}
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard: value is a number (and not NaN).
 * @param {unknown} value
 * @returns {value is number}
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/**
 * Type guard: value is a boolean.
 * @param {unknown} value
 * @returns {value is boolean}
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Type guard: value is a function.
 * @param {unknown} value
 * @returns {value is Function}
 */
export function isFunction(value: unknown): value is (...args: any[]) => any {
  return typeof value === 'function';
}

/**
 * Type guard: value is an array.
 * @param {unknown} value
 * @returns {value is unknown[]}
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Type guard: value is a plain object (not null, not array, not date, etc.).
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Type guard: value is a Date instance.
 * @param {unknown} value
 * @returns {value is Date}
 */
export function isDate(value: unknown): value is Date {
  return value instanceof Date;
}

/**
 * Type guard: value is a RegExp instance.
 * @param {unknown} value
 * @returns {value is RegExp}
 */
export function isRegExp(value: unknown): value is RegExp {
  return value instanceof RegExp;
}

/**
 * Type guard: value is a Promise-like object.
 * @param {unknown} value
 * @returns {value is Promise<unknown>}
 */
export function isPromise(value: unknown): value is Promise<unknown> {
  return value != null && typeof value === 'object' && typeof (value as Promise<unknown>).then === 'function';
}

/**
 * Type guard: value is an Error instance.
 * @param {unknown} value
 * @returns {value is Error}
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Type guard: value is null.
 * @param {unknown} value
 * @returns {value is null}
 */
export function isNull(value: unknown): value is null {
  return value === null;
}

/**
 * Type guard: value is undefined.
 * @param {unknown} value
 * @returns {value is undefined}
 */
export function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

/**
 * Type guard: value is null or undefined.
 * @param {unknown} value
 * @returns {value is null | undefined}
 */
export function isNil(value: unknown): value is null | undefined {
  return value == null;
}

/**
 * Type guard: value is a symbol.
 * @param {unknown} value
 * @returns {value is symbol}
 */
export function isSymbol(value: unknown): value is symbol {
  return typeof value === 'symbol';
}

/**
 * Type guard: value is a Map.
 * @param {unknown} value
 * @returns {value is Map<unknown, unknown>}
 */
export function isMap(value: unknown): value is Map<unknown, unknown> {
  return value instanceof Map;
}

/**
 * Type guard: value is a Set.
 * @param {unknown} value
 * @returns {value is Set<unknown>}
 */
export function isSet(value: unknown): value is Set<unknown> {
  return value instanceof Set;
}

/**
 * Type guard: value is a plain object (Object.prototype, not null, not array, not date, etc.).
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
