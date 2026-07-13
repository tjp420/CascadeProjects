// TypeScript declarations for js-es2018/utils.js

// ── Barrel metadata ────────────────────────────────────────────

export interface BarrelMeta {
  name: string;
  description: string;
  moduleCount: number;
  exportCount: number;
  version: string;
  timestamp: string;
  exports: ReadonlyArray<string>;
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
export function kebabCase(str: string): string;
export function camelCase(str: string): string;
export function snakeCase(str: string): string;
export function padStart(str: string, length: number, padStr?: string): string;
export function padEnd(str: string, length: number, padStr?: string): string;
export function stripHtml(str: string): string;
export function pluralize(count: number, singular: string, plural?: string): string;
export function isBlank(value: any): boolean;
export function words(str: string | null | undefined): string[];
export function wordCount(str: string | null | undefined): number;
export function repeat(str: string | null | undefined, count: number): string;
export function titleCase(str: string | null | undefined): string;
export function slugify(str: string | null | undefined): string;
export function reverse(str: string | null | undefined): string;
export function splitLines(str: string | null | undefined): string[];
export function stripAnsi(str: string | null | undefined): string;

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
export function tryFn<T extends (...args: any[]) => any>(fn: T, ...args: Parameters<T>): { ok: true; value: ReturnType<T> } | { ok: false; error: Error };
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

// ── Format helpers ───────────────────────────────────────────

export function redactPathForDisplay(projectPath: string): string;
export function isRedactedPathDisplay(displayPath: string): boolean;
export function formatPathInputValue(projectPath: string): string;
export function formatScanPathForDisplay(scanPath: string, projectRoot?: string): string;
export function formatPathLabel(projectPath: string): string;
export function formatAiSummarySkipMessage(errorMessage: string): string;
export function sanitizePrivacyData(text: string): string;
export function formatDate(date: Date | string | number, format?: string): string;
export function relativeTime(date: Date | string | number): string;
export function timeAgo(date: Date | string | number): string;

// ── DOM helpers ──────────────────────────────────────────────

export function showToast(message: string, type?: 'info' | 'success' | 'error' | 'warning'): void;
export function removeToastContainer(): void;
export function renderEmptyState(opts: any): string | { html: string; attach(container: HTMLElement): void };
export function copyToClipboard(text: string): Promise<void>;
export function downloadBlob(blob: Blob, filename: string): void;
export function downloadJson(data: any, filename: string): void;
export function downloadText(content: string, filename: string): void;
export function downloadCsv(content: string, filename: string): void;

// ── Type guards ──────────────────────────────────────────────

export function isBlank(value: any): boolean;
export function noop(): void;
export function isDefined<T>(value: T | null | undefined): value is T;
export function isNull(value: any): boolean;
export function isUndefined(value: any): boolean;
export function isNil(value: any): boolean;
export function isSymbol(value: any): boolean;
export function isMap(value: any): boolean;
export function isSet(value: any): boolean;
export function isBoolean(value: any): boolean;
export function isNumber(value: any): boolean;
export function isString(value: any): boolean;
export function isArray(value: any): boolean;
export function isFunction(value: any): boolean;
export function isObject(value: any): boolean;
export function isDate(value: any): boolean;
export function isRegExp(value: any): boolean;
export function isPromise(value: any): boolean;
export function isError(value: any): boolean;

// ── Functional helpers ───────────────────────────────────────

export function compose<T>(...fns: Array<(v: T) => T>): (value: T) => T;
export function pipe<T>(...fns: Array<(v: T) => T>): (value: T) => T;
export function zipWith<T, U, V>(arr1: T[], arr2: U[], fn: (a: T, b: U) => V): V[];
export function curry<T extends (...args: any[]) => any>(fn: T): T;
export function partial<T extends (...args: any[]) => any>(fn: T, ...presetArgs: any[]): T;
export function tap<T>(value: T, fn: (value: T) => void): T;

// ── Storage helpers ──────────────────────────────────────────

export function localStorageGet(key: string): any;
export function localStorageSet(key: string, value: any): void;
export function localStorageRemove(key: string): void;
export function localStorageGetString(key: string): string | null;
export function localStorageSetString(key: string, value: string): void;
export function sessionStorageGet(key: string): any;
export function sessionStorageSet(key: string, value: any): void;
export function sessionStorageRemove(key: string): void;

// ── URL helpers ──────────────────────────────────────────────

export function apiBaseUrl(): string;
export function apiUrl(path: string): string;
export function isOnline(): boolean;
export function getNonce(): string;
export function parseQueryString(query: string): Record<string, string>;
export function stringifyQueryString(params: Record<string, string | number | boolean>): string;
export function isValidUrl(url: string): boolean;

// ── Misc helpers ─────────────────────────────────────────────

export function assertNever(value: never, message?: string): never;
export function parseJsonSafe<T>(json: string, fallback?: T): T | undefined;
export function parseResponseJson<T>(res: Response, fallback?: T): Promise<T>;
export function stringifySafe<T>(value: any, fallback?: T): string | T;
export function prefersReducedMotion(): boolean;
export function prefersDarkMode(): boolean;
export function isEqual(a: any, b: any): boolean;
export function isEmpty(value: any): boolean;
export function findIndex<T>(arr: T[], predicate: (item: T) => boolean): number;

// ── Barrel helpers ─────────────────────────────────────────────

export function getExportNames(): ReadonlyArray<string>;
export const exportNames: typeof getExportNames;
export function getNamespaceNames(): ReadonlyArray<string>;
export function validateBarrelIntegrity(barrel?: BarrelMeta | null): IntegrityResult;
export function setDefaultBarrel(barrel: BarrelMeta | null): void;
export function getBarrelMeta(): BarrelMeta;
export function deepFreeze<T>(obj: T): T;
export const __barrel__: BarrelMeta;

// ── Default export namespace ─────────────────────────────────

declare const Utils: Readonly<{
  string: typeof import('./utils/string.js');
  number: typeof import('./utils/number.js');
  async: typeof import('./utils/async.js');
  array: typeof import('./utils/array.js');
  object: typeof import('./utils/object.js');
  format: typeof import('./utils/format.js');
  dom: typeof import('./utils/dom.js');
  type: typeof import('./utils/type.js');
  functional: typeof import('./utils/functional.js');
  storage: typeof import('./utils/storage.js');
  url: typeof import('./utils/url.js');
  misc: typeof import('./utils/misc.js');
  safeStorage: typeof import('./utils/safe-storage.js');
  eventBus: typeof import('./utils/event-bus.js');
  inline: Readonly<Record<string, any>>;
  __barrel__: BarrelMeta;
}>;

export default Utils;
