// TypeScript declarations for dashboard-web/js/utils.js

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
export function padStart(str: string, len: number, char?: string): string;
export function padEnd(str: string, len: number, char?: string): string;
export function stripHtml(str: string): string;

// ── Number helpers ────────────────────────────────────────────

export function formatNumber(n: number | string | null | undefined): string;
export function formatPercent(value: number | string | null | undefined, fractionDigits?: number): string;
export function formatBytes(bytes: number, decimals?: number): string;
export function clamp(val: number | string, min: number, max: number): number;
export function formatDuration(ms: number): string;

// ── Async helpers ────────────────────────────────────────────

export function sleep(ms: number): Promise<void>;
export function debounce<T extends (...args: any[]) => any>(fn: T, ms?: number): T & { cancel(): void; flush(): void; pending(): boolean };
export function throttle<T extends (...args: any[]) => any>(fn: T, wait?: number): T & { cancel(): void; flush(): void; pending(): boolean };
export function once<T extends (...args: any[]) => any>(fn: T): T;
export function memoize<T extends (...args: any[]) => any>(fn: T, maxSize?: number): T & { clear(): void; size: number; has(...args: any[]): boolean };

// ── Array helpers ────────────────────────────────────────────

export function unique<T>(arr: T[], keyFn?: (item: T) => any): T[];
export function compact<T>(arr: (T | null | undefined)[]): T[];
export function flatten<T>(arr: (T | T[])[]): T[];
export function range(end: number): number[];
export function range(start: number, end: number, step?: number): number[];
export function chunk<T>(arr: T[], size: number): T[][];

// ── Object helpers ───────────────────────────────────────────

export function deepClone<T>(obj: T): T;
export function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>;
export function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K>;
export function merge<T>(target: T, ...sources: Partial<T>[]): T;

// ── Format helpers ───────────────────────────────────────────

export function redactPathForDisplay(projectPath: string): string;
export function formatPathInputValue(projectPath: string): string;
export function formatScanPathForDisplay(scanPath: string, projectRoot?: string): string;
export function formatPathLabel(projectPath: string): string;
export function formatAiSummarySkipMessage(errorMessage: string): string;
export function sanitizePrivacyData(text: string): string;

// ── DOM helpers ──────────────────────────────────────────────

export function showToast(message: string, type?: 'info' | 'success' | 'error' | 'warning'): void;
export function removeToastContainer(): void;
export function renderEmptyState(opts: Record<string, unknown>): string | { html: string; attach(container: HTMLElement): void };
export function copyToClipboard(text: string): Promise<void>;
export function downloadBlob(blob: Blob, filename: string): void;
export function downloadJson(data: any, filename: string): void;
export function downloadText(content: string, filename: string): void;

// ── Type guards ──────────────────────────────────────────────

export function isBlank(value: unknown): boolean;
export function noop(): void;
export function isDefined<T>(value: T | null | undefined): value is T;

// ── Functional helpers ───────────────────────────────────────

export function compose<T>(...fns: Array<(v: T) => T>): (value: T) => T;
export function pipe<T>(...fns: Array<(v: T) => T>): (value: T) => T;
export function zipWith<T, U, V>(arr1: T[], arr2: U[], fn: (a: T, b: U) => V): V[];
export function curry<T extends (...args: any[]) => any>(fn: T): T;
export function partial<T extends (...args: any[]) => any>(fn: T, ...presetArgs: any[]): T;
export function tap<T>(value: T, fn: (value: T) => void): T;

// ── Barrel helpers ─────────────────────────────────────────────

export function getExportNames(): ReadonlyArray<string>;
export function validateBarrelIntegrity(): IntegrityResult;
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
  inline: Readonly<{
    compose: typeof compose;
    pipe: typeof pipe;
    zipWith: typeof zipWith;
    curry: typeof curry;
    partial: typeof partial;
    tap: typeof tap;
  }>;
  __barrel__: BarrelMeta;
}>;

export default Utils;
