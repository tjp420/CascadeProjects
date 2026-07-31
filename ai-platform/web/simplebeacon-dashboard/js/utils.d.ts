// TypeScript declarations for js/utils.js

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
export function normalizeSlashes(
  path: string,
  opts?: { stripLeadingDot?: boolean; lowercase?: boolean }
): string;
export function truncate(str: string | null | undefined, maxLen?: number, suffix?: string): string;
export function capitalize(str: string | null | undefined): string;
export function hash(str: string): number;
export function kebabCase(str: string): string;
export function camelCase(str: string): string;
export function snakeCase(str: string): string;
export function padStart(str: string, length: number, padStr?: string): string;
export function padEnd(str: string, length: number, padStr?: string): string;
export function stripHtml(str: string): string;
export function pluralize(count: number, singular: string, plural?: string): string;

// ── Number helpers ────────────────────────────────────────────

export function formatNumber(n: number | string | null | undefined): string;
export function formatPercent(
  value: number | string | null | undefined,
  fractionDigits?: number
): string;
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
export function safeParseFloat(
  value: string | number | null | undefined,
  fallback?: number
): number;
export function random(min?: number, max?: number): number;
export function randomId(prefix?: string): string;
export function uid(): string;

// ── Async helpers ────────────────────────────────────────────

export function sleep(ms: number): Promise<void>;
export function delay<T>(ms: number, value?: T): Promise<T | undefined>;
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  ms?: number
): T & { cancel(): void; flush(): void; pending(): boolean };
export function debounceAsync<T extends (...args: any[]) => any>(
  fn: T,
  ms?: number
): T & { cancel(): void };
export function debounceLeading<T extends (...args: any[]) => any>(
  fn: T,
  ms?: number
): T & { cancel(): void };
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  wait?: number
): T & { cancel(): void; flush(): void; pending(): boolean };
export function throttleAsync<T extends (...args: any[]) => any>(
  fn: T,
  wait?: number
): T & { cancel(): void };
export function once<T extends (...args: any[]) => any>(fn: T): T;
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  maxSize?: number
): T & { clear(): void; size: number; has(...args: any[]): boolean };
export function memoizeAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  maxSize?: number
): T & { clear(): void };
export function withTimeout<T>(promise: Promise<T>, ms: number, message?: string): Promise<T>;
export function tryFn<T extends (...args: any[]) => any>(
  fn: T,
  ...args: Parameters<T>
): { ok: true; value: ReturnType<T> } | { ok: false; error: Error };
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
export function countBy<T>(
  arr: T[],
  keyFn: (item: T) => string | number
): Record<string | number, number>;

// ── Object helpers ───────────────────────────────────────────

export function deepClone<T>(obj: T): T;
export function clone<T>(obj: T): T;
export function deepEqual(a: unknown, b: unknown): boolean;
export function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>;
export function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K>;
export function defaults<T>(obj: T, ...sources: Partial<T>[]): T;
export function merge<T>(target: T, ...sources: Partial<T>[]): T;
export function invert<T extends Record<string, string>>(obj: T): Record<T[keyof T], keyof T>;
export function mapValues<T, U>(
  obj: Record<string, T>,
  fn: (value: T, key: string) => U
): Record<string, U>;
export function mapKeys<T>(
  obj: Record<string, T>,
  fn: (key: string, value: T) => string
): Record<string, T>;
export function has(obj: Record<string, unknown>, path: string | string[]): boolean;
export function get<T>(
  obj: Record<string, unknown>,
  path: string | string[],
  defaultValue?: T
): T | undefined;
export function set<T extends Record<string, unknown>>(
  obj: T,
  path: string | string[],
  value: unknown
): T;
export function zipObject<T>(keys: string[], values: T[]): Record<string, T>;
export function identity<T>(value: T): T;
export function constant<T>(value: T): () => T;
export function at(obj: Record<string, unknown>, paths: string[]): unknown[];
export function unset<T>(obj: T, path: string | string[]): boolean;
export function defaultsDeep<T>(obj: T, ...sources: Partial<T>[]): T;

// ── URL helpers ──────────────────────────────────────────────

export function apiBaseUrl(): string;
export function apiUrl(path: string): string;
export function fetchWithTimeout(
  url: string,
  options?: RequestInit & { timeout?: number }
): Promise<Response>;
export function parseQueryString(query: string): Record<string, string>;
export function stringifyQueryString(params: Record<string, string | number | boolean>): string;
export function getQueryParam(key: string, defaultValue?: string): string | undefined;
export function setQueryParam(key: string, value: string): string;
export function buildUrl(base: string, params: Record<string, string>): string;
export function isValidUrl(url: string): boolean;
export function isUrl(url: string): boolean;

// ── Storage helpers ───────────────────────────────────────────

export function localStorageGet(key: string): any;
export function localStorageSet(key: string, value: any): void;
export function localStorageRemove(key: string): void;
export function localStorageGetString(key: string): string | null;
export function localStorageSetString(key: string, value: string): void;
export function sessionStorageGet(key: string): any;
export function sessionStorageSet(key: string, value: any): void;
export function sessionStorageRemove(key: string): void;

// ── Theme helpers ────────────────────────────────────────────

export function hexToRgba(hex: string, alpha?: number): string;
export function shadeColor(color: string, percent: number): string;
export function contrastColor(hex: string): string;
export function getCssVar(name: string): string;
export function setCssVar(name: string, value: string): void;
export function prefersReducedMotion(): boolean;
export function prefersDarkMode(): boolean;

// ── DOM helpers ──────────────────────────────────────────────

export function showToast(message: string, type?: 'info' | 'success' | 'error' | 'warning'): void;
export function removeToastContainer(): void;
export function downloadFile(blob: Blob, filename: string): void;
export function downloadJson(data: any, filename: string): void;
export function downloadBlob(blob: Blob, filename: string): void;
export function downloadText(content: string, filename: string): void;
export function downloadCsv(content: string, filename: string): void;
export function hasClass(el: Element, className: string): boolean;
export function addClass(el: Element, className: string): void;
export function removeClass(el: Element, className: string): void;
export function toggleClass(el: Element, className: string): void;
export function getFocusableElements(container?: HTMLElement): HTMLElement[];
export function focusFirst(container?: HTMLElement): void;
export function createElement(
  tag: string,
  attrs?: Record<string, string>,
  children?: (Node | string)[]
): HTMLElement;
export function removeAllChildren(el: HTMLElement): void;
export function scrollToElement(el: Element, behavior?: ScrollBehavior): void;
export function elementInViewport(el: Element): boolean;
export function observeIntersection(
  el: Element,
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit
): IntersectionObserver;
export function preloadImage(src: string): Promise<void>;
export function copyToClipboard(text: string): Promise<void>;
export function renderEmptyState(
  opts: Record<string, unknown>
): string | { html: string; attach(container: HTMLElement): void };

// ── Format helpers ───────────────────────────────────────────

export function formatDate(date: Date | string | number, format?: string): string;
export function relativeTime(date: Date | string | number): string;
export function redactPathForDisplay(projectPath: string): string;
export function isRedactedPathDisplay(displayPath: string): boolean;
export function formatPathInputValue(projectPath: string): string;
export function formatScanPathForDisplay(scanPath: string, projectRoot?: string): string;
export function formatPathLabel(projectPath: string): string;
export function formatAiSummarySkipMessage(errorMessage: string): string;
export function sanitizePrivacyData(text: string): string;

// ── Type guards ──────────────────────────────────────────────

export function isBlank(value: unknown): boolean;
export function isEmail(value: string): boolean;
export function isNumeric(value: unknown): boolean;
export function isInteger(value: unknown): boolean;
export function isHexColor(value: string): boolean;
export function isEmpty(value: unknown): boolean;
export function isDefined<T>(value: T | null | undefined): value is T;
export function noop(): void;
export function assertNever(value: never, message?: string): never;
export function parseJsonSafe<T>(json: string, fallback?: T): T | undefined;
export function parseResponseJson(res: Response, fallback?: any): Promise<any>;
export function isOnline(): boolean;
export function isVSCodeWebview(): boolean;
export function isStandalone(): boolean;
export function getVSCodeApi(): any;
export function getNonce(): string;
export function isNull(value: unknown): value is null;
export function isUndefined(value: unknown): value is undefined;
export function isNil(value: unknown): boolean;
export function isSymbol(value: unknown): value is symbol;
export function isMap(value: unknown): value is Map<unknown, unknown>;
export function isSet(value: unknown): value is Set<unknown>;

// ── Barrel-native utilities ──────────────────────────────────

export function compose<T>(...fns: Array<(v: T) => T>): (value: T) => T;
export function pipe<T>(...fns: Array<(v: T) => T>): (value: T) => T;
export function zipWith<T, U, V>(arr1: T[], arr2: U[], fn: (a: T, b: U) => V): V[];
export function curry<T extends (...args: any[]) => any>(fn: T): T;
export function partial<T extends (...args: any[]) => any>(fn: T, ...presetArgs: any[]): T;
export function tap<T>(value: T, fn: (value: T) => void): T;

// ── Metadata & discovery ─────────────────────────────────────

export function deepFreeze<T>(obj: T): T;
export function getExportNames(): ReadonlyArray<string>;
export const exportNames: typeof getExportNames;
export function stringifySafe(value: any, fallback?: any): string | any;
export function getNamespaceNames(): ReadonlyArray<string>;
export function getBarrelMeta(): BarrelMeta;
export function validateBarrelIntegrity(): IntegrityResult;
export const __barrel__: BarrelMeta;

// ── Namespaces ───────────────────────────────────────────────

export namespace string {
  export {
    escapeHtml,
    escapeRegExp,
    normalizeSlashes,
    truncate,
    capitalize,
    hash,
    kebabCase,
    camelCase,
    snakeCase,
    padStart,
    padEnd,
    stripHtml,
    pluralize,
  };
}
export namespace number {
  export {
    formatNumber,
    formatPercent,
    formatBytes,
    clamp,
    roundTo,
    toFixedNumber,
    formatDuration,
    sum,
    mean,
    maxBy,
    minBy,
    safeParseInt,
    safeParseFloat,
    random,
    randomId,
    uid,
  };
}
export namespace async {
  export {
    sleep,
    delay,
    debounce,
    debounceAsync,
    debounceLeading,
    throttle,
    throttleAsync,
    once,
    memoize,
    memoizeAsync,
    withTimeout,
    tryFn,
    seq,
    flow,
    negate,
  };
}
export namespace array {
  export {
    unique,
    compact,
    flatten,
    range,
    chunk,
    sample,
    shuffle,
    reverse,
    union,
    intersection,
    difference,
    groupBy,
    partition,
    sortBy,
    keyBy,
    times,
    randomChoice,
    ensureArray,
    countBy,
  };
}
export namespace object {
  export {
    deepClone,
    clone,
    deepEqual,
    pick,
    omit,
    defaults,
    merge,
    invert,
    mapValues,
    mapKeys,
    has,
    get,
    set,
    zipObject,
    identity,
    constant,
    at,
    unset,
    defaultsDeep,
  };
}
export namespace url {
  export {
    apiBaseUrl,
    apiUrl,
    fetchWithTimeout,
    parseQueryString,
    stringifyQueryString,
    getQueryParam,
    setQueryParam,
    buildUrl,
    isValidUrl,
    isUrl,
  };
}
export namespace storage {
  export {
    localStorageGet,
    localStorageSet,
    localStorageRemove,
    localStorageGetString,
    localStorageSetString,
    sessionStorageGet,
    sessionStorageSet,
    sessionStorageRemove,
  };
}
export namespace theme {
  export {
    hexToRgba,
    shadeColor,
    contrastColor,
    getCssVar,
    setCssVar,
    prefersReducedMotion,
    prefersDarkMode,
  };
}
export namespace dom {
  export {
    showToast,
    removeToastContainer,
    downloadFile,
    downloadJson,
    downloadBlob,
    downloadText,
    downloadCsv,
    hasClass,
    addClass,
    removeClass,
    toggleClass,
    getFocusableElements,
    focusFirst,
    createElement,
    removeAllChildren,
    scrollToElement,
    elementInViewport,
    observeIntersection,
    preloadImage,
    copyToClipboard,
    renderEmptyState,
  };
}
export namespace format {
  export {
    formatDate,
    relativeTime,
    redactPathForDisplay,
    isRedactedPathDisplay,
    formatPathInputValue,
    formatScanPathForDisplay,
    formatPathLabel,
    formatAiSummarySkipMessage,
    sanitizePrivacyData,
  };
}
export namespace type {
  export {
    isBlank,
    isEmail,
    isNumeric,
    isInteger,
    isHexColor,
    isEmpty,
    isDefined,
    noop,
    assertNever,
    parseJsonSafe,
    parseResponseJson,
    isOnline,
    isVSCodeWebview,
    isStandalone,
    getVSCodeApi,
    getNonce,
    isNull,
    isUndefined,
    isNil,
    isSymbol,
    isMap,
    isSet,
  };
}

export namespace inline {
  export {
    compose,
    pipe,
    zipWith,
    curry,
    partial,
    tap,
    parseJsonSafe,
    parseResponseJson,
    stringifySafe,
  };
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
  theme: typeof theme;
  dom: typeof dom;
  format: typeof format;
  type: typeof type;
  accessibility: typeof accessibility;
  clipboard: typeof clipboard;
  crypto: typeof crypto;
  download: typeof download;
  fetch: typeof fetch;
  fn: typeof fn;
  path: typeof path;
  privacy: typeof privacy;
  vscode: typeof vscode;
  event: typeof event;
  polling: typeof polling;
  inline: typeof inline;
  getExportNames: typeof getExportNames;
  exportNames: typeof exportNames;
  getNamespaceNames: typeof getNamespaceNames;
  getBarrelMeta: typeof getBarrelMeta;
  validateBarrelIntegrity: typeof validateBarrelIntegrity;
  freezeNamespace: typeof freezeNamespace;
  stringifySafe: typeof stringifySafe;
  __barrel__: BarrelMeta;
}>;

export default _default;
