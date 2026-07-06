// TypeScript declarations for js-es2018/utils-lib/index.js

// ── Barrel metadata ────────────────────────────────────────────

export interface BarrelMeta {
  name: string;
  description: string;
  moduleCount: number;
  exportCount: number;
  namespaceCount: number;
  version: string;
  timestamp: string;
  exports: ReadonlyArray<string>;
  namespaces: ReadonlyArray<string>;
}

export interface IntegrityResult {
  valid: boolean;
  errors: string[];
}

// ── String helpers ─────────────────────────────────────────────

export function escapeHtml(str: string | null | undefined): string;
export function escapeRegExp(str: string | null | undefined): string;
export function normalizeSlashes(path: string, opts?: { stripLeadingDot?: boolean; lowercase?: boolean }): string;
export function truncate(str: string | null | undefined, maxLen?: number, suffix?: string): string;
export function capitalize(str: string | null | undefined): string;
export function words(str: string): string[];
export function repeat(str: string, count: number): string;
export function titleCase(str: string): string;
export function slugify(str: string): string;
export function stripHtml(str: string): string;
export function kebabCase(str: string): string;
export function camelCase(str: string): string;
export function snakeCase(str: string): string;
export function padStart(str: string, length: number, padStr?: string): string;
export function padEnd(str: string, length: number, padStr?: string): string;

// ── Number helpers ────────────────────────────────────────────

export function formatNumber(n: number | string | null | undefined): string;
export function formatPercent(value: number | string | null | undefined, fractionDigits?: number): string;
export function formatBytes(bytes: number, decimals?: number): string;
export function clamp(val: number | string, min: number, max: number): number;
export function roundTo(num: number, precision?: number): number;
export function toFixedNumber(num: number, digits?: number): number;
export function formatDuration(ms: number): string;
export function sum(arr: number[]): number;
export function mean(arr: number[]): number;
export function maxBy<T>(arr: T[], keyFn: (item: T) => number): T | undefined;
export function minBy<T>(arr: T[], keyFn: (item: T) => number): T | undefined;
export function safeParseInt(value: string | number | null | undefined, fallback?: number): number;
export function safeParseFloat(value: string | number | null | undefined, fallback?: number): number;
export function random(min?: number, max?: number): number;
export function randomId(prefix?: string): string;
export function uid(): string;

// ── Async helpers ────────────────────────────────────────────

export function sleep(ms: number): Promise<void>;
export function delay<T>(ms: number, value?: T): Promise<T | undefined>;
export function debounce<T extends (...args: any[]) => any>(fn: T, ms?: number): T & { cancel(): void; flush(): void; pending(): boolean };
export function debounceAsync<T extends (...args: any[]) => any>(fn: T, ms?: number): T & { cancel(): void };
export function debounceLeading<T extends (...args: any[]) => any>(fn: T, ms?: number): T & { cancel(): void };
export function throttle<T extends (...args: any[]) => any>(fn: T, wait?: number): T & { cancel(): void; flush(): void; pending(): boolean };
export function throttleAsync<T extends (...args: any[]) => any>(fn: T, wait?: number): T & { cancel(): void };
export function once<T extends (...args: any[]) => any>(fn: T): T;
export function memoize<T extends (...args: any[]) => any>(fn: T, maxSize?: number): T & { clear(): void; size: number; has(...args: any[]): boolean };
export function memoizeAsync<T extends (...args: any[]) => Promise<any>>(fn: T, maxSize?: number): T & { clear(): void };
export function withTimeout<T>(promise: Promise<T>, ms: number, message?: string): Promise<T>;
export function retry<T>(fn: () => Promise<T>, options?: { attempts?: number; delay?: number }): Promise<T>;
export function seq<T>(...fns: Array<(v: T) => T>): (value: T) => T;
export function flow<T>(...fns: Array<(v: T) => T>): (value: T) => T;
export function negate(predicate: (...args: any[]) => boolean): (...args: any[]) => boolean;

// ── Array helpers ────────────────────────────────────────────

export function unique<T>(arr: T[], keyFn?: (item: T) => any): T[];
export function compact<T>(arr: (T | null | undefined)[]): T[];
export function flatten<T>(arr: (T | T[])[]): T[];
export function range(end: number): number[];
export function range(start: number, end: number, step?: number): number[];
export function chunk<T>(arr: T[], size: number): T[][];
export function sample<T>(arr: T[]): T | undefined;
export function shuffle<T>(arr: T[]): T[];
export function reverse<T>(arr: T[]): T[];
export function union<T>(...arrays: T[][]): T[];
export function intersection<T>(...arrays: T[][]): T[];
export function difference<T>(arr: T[], ...others: T[][]): T[];
export function groupBy<T, K>(arr: T[], keyFn: (item: T) => K): Map<K, T[]>;
export function partition<T>(arr: T[], predicate: (item: T) => boolean): [T[], T[]];
export function sortBy<T>(arr: T[], keyFn: (item: T) => any): T[];
export function keyBy<T, K>(arr: T[], keyFn: (item: T) => K): Map<K, T>;
export function times<T>(n: number, fn: (index: number) => T): T[];
export function randomChoice<T>(arr: T[]): T | undefined;
export function ensureArray<T>(value: T | T[]): T[];
export function countBy<T>(arr: T[], keyFn: (item: T) => string | number): Record<string | number, number>;

// ── Object helpers ───────────────────────────────────────────

export function deepClone<T>(obj: T): T;
export function clone<T>(obj: T): T;
export function deepEqual(a: any, b: any): boolean;
export function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>;
export function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K>;
export function defaults<T>(obj: T, ...sources: Partial<T>[]): T;
export function merge<T>(target: T, ...sources: Partial<T>[]): T;
export function invert<T extends Record<string, string>>(obj: T): Record<T[keyof T], keyof T>;
export function mapValues<T, U>(obj: Record<string, T>, fn: (value: T, key: string) => U): Record<string, U>;
export function mapKeys<T>(obj: Record<string, T>, fn: (key: string, value: T) => string): Record<string, T>;
export function has<T>(obj: T, path: string | string[]): boolean;
export function get<T>(obj: any, path: string | string[], defaultValue?: T): T | undefined;
export function set<T>(obj: T, path: string | string[], value: any): T;
export function zipObject<T>(keys: string[], values: T[]): Record<string, T>;
export function identity<T>(value: T): T;
export function constant<T>(value: T): () => T;
export function at<T>(obj: T, paths: string[]): any[];
export function unset<T>(obj: T, path: string | string[]): boolean;
export function defaultsDeep<T>(obj: T, ...sources: Partial<T>[]): T;

// ── URL helpers ──────────────────────────────────────────────

export function parseQueryString(query: string): Record<string, string>;
export function stringifyQueryString(params: Record<string, string | number | boolean>): string;
export function isValidUrl(url: string): boolean;

// ── Storage helpers ───────────────────────────────────────────

export function localStorageGet(key: string): any;
export function localStorageSet(key: string, value: any): void;
export function localStorageRemove(key: string): void;
export function localStorageGetString(key: string): string | null;
export function localStorageSetString(key: string, value: string): void;
export function sessionStorageGet(key: string): any;
export function sessionStorageSet(key: string, value: any): void;

// ── Accessibility helpers ────────────────────────────────────

export function prefersReducedMotion(): boolean;
export function prefersDarkMode(): boolean;

// ── DOM helpers ──────────────────────────────────────────────

export function showToast(message: string, type?: 'info' | 'success' | 'error' | 'warning'): void;
export function removeToastContainer(): void;
export function hasClass(el: Element, className: string): boolean;
export function addClass(el: Element, className: string): void;
export function removeClass(el: Element, className: string): void;
export function toggleClass(el: Element, className: string): void;

// ── Format helpers ───────────────────────────────────────────

export function formatDate(date: Date | string | number, format?: string): string;
export function relativeTime(date: Date | string | number): string;
export function redactPathForDisplay(projectPath: string): string;
export function isRedactedPathDisplay(displayPath: string): boolean;
export function formatPathLabel(projectPath: string): string;

// ── Type guards ──────────────────────────────────────────────

export function isBlank(value: any): boolean;
export function isDefined<T>(value: T | null | undefined): value is T;
export function isNil(value: any): boolean;
export function noop(): void;
export function assertNever(value: never, message?: string): never;
export function parseJsonSafe<T>(json: string, fallback?: T): T | undefined;

// ── Crypto helpers ───────────────────────────────────────────

export function hash(str: string): number;

// ── Color helpers ────────────────────────────────────────────

export function hexToRgba(hex: string, alpha?: number): string;
export function contrastColor(hex: string): string;

// ── Download helpers ─────────────────────────────────────────

export function downloadJson(data: any, filename: string): void;
export function downloadText(content: string, filename: string): void;
export function downloadCsv(content: string, filename: string): void;

// ── Fetch helpers ──────────────────────────────────────────

export function fetchWithTimeout(url: string, options?: RequestInit & { timeout?: number }): Promise<Response>;

// ── Privacy helpers ──────────────────────────────────────────

export function sanitizePrivacyData(text: string): string;

// ── Clipboard helpers ────────────────────────────────────────

export function copyToClipboard(text: string): Promise<void>;

// ── VS Code helpers ──────────────────────────────────────────

export function isVSCodeWebview(): boolean;
export function isStandalone(): boolean;
export function getVSCodeApi(): any;

// ── Barrel-native utilities ──────────────────────────────────

export function zipWith<T, U, V>(arr1: T[], arr2: U[], fn: (a: T, b: U) => V): V[];
export function curry<T extends (...args: any[]) => any>(fn: T): T;
export function partial<T extends (...args: any[]) => any>(fn: T, ...presetArgs: any[]): T;
export function tap<T>(value: T, fn: (value: T) => void): T;

// ── Metadata & discovery ─────────────────────────────────────

export const exportNames: ReadonlyArray<string>;
export function getExportNames(): ReadonlyArray<string>;
export function getNamespaceNames(): ReadonlyArray<string>;
export function validateBarrelIntegrity(): IntegrityResult;
export const __barrel__: BarrelMeta;

// ── Namespaces ───────────────────────────────────────────────

export namespace string {
  export { escapeHtml, escapeRegExp, normalizeSlashes, truncate, capitalize, words, repeat, titleCase, slugify, stripHtml, kebabCase, camelCase, snakeCase, padStart, padEnd };
}
export namespace number {
  export { formatNumber, formatPercent, formatBytes, clamp, roundTo, toFixedNumber, formatDuration, sum, mean, maxBy, minBy, safeParseInt, safeParseFloat, random, randomId, uid };
}
export namespace async {
  export { sleep, delay, debounce, debounceAsync, debounceLeading, throttle, throttleAsync, once, memoize, memoizeAsync, withTimeout, retry };
}
export namespace array {
  export { unique, compact, flatten, range, chunk, sample, shuffle, reverse, union, intersection, difference, groupBy, partition, sortBy, keyBy, times, randomChoice, ensureArray, countBy };
}
export namespace object {
  export { deepClone, clone, deepEqual, pick, omit, defaults, merge, invert, mapValues, mapKeys, has, get, set, zipObject, identity, constant, at, unset, defaultsDeep };
}
export namespace url {
  export { parseQueryString, stringifyQueryString, isValidUrl };
}
export namespace storage {
  export { localStorageGet, localStorageSet, localStorageRemove, localStorageGetString, localStorageSetString, sessionStorageGet, sessionStorageSet };
}
export namespace accessibility {
  export { prefersReducedMotion, prefersDarkMode };
}
export namespace dom {
  export { showToast, removeToastContainer, hasClass, addClass, removeClass, toggleClass };
}
export namespace format {
  export { formatDate, relativeTime, redactPathForDisplay, isRedactedPathDisplay, formatPathLabel };
}
export namespace type {
  export { isBlank, isDefined, isNil, noop, assertNever, parseJsonSafe };
}
export namespace crypto {
  export { hash };
}
export namespace color {
  export { hexToRgba, contrastColor };
}
export namespace download {
  export { downloadJson, downloadText, downloadCsv };
}
export namespace fetch {
  export { fetchWithTimeout };
}
export namespace privacy {
  export { sanitizePrivacyData };
}
export namespace clipboard {
  export { copyToClipboard };
}
export namespace vscode {
  export { isVSCodeWebview, isStandalone, getVSCodeApi };
}
export namespace composition {
  export { seq, flow, negate, zipWith, curry, partial, tap };
}

// ── Default export ───────────────────────────────────────────

declare const _default: Readonly<{
  string: typeof string;
  number: typeof number;
  async: typeof async;
  array: typeof array;
  object: typeof object;
  url: typeof url;
  storage: typeof storage;
  accessibility: typeof accessibility;
  dom: typeof dom;
  format: typeof format;
  type: typeof type;
  crypto: typeof crypto;
  color: typeof color;
  download: typeof download;
  fetch: typeof fetch;
  privacy: typeof privacy;
  clipboard: typeof clipboard;
  vscode: typeof vscode;
  composition: typeof composition;
  __barrel__: BarrelMeta;
}>;

export default _default;
