// simplebeacon-ignore memory-leak — pure path utility functions
import * as path from 'path';

/**
 * Normalize a file path for cross-platform consistency.
 * Converts backslashes to forward slashes and removes trailing slashes.
 * @param {string} scanPath Raw path string.
 * @returns {string} Normalized path, or '/' if input is empty.
 */
export function normalizeScanPath(scanPath: string): string {
  if (typeof scanPath !== 'string') return '/';
  let normalized = scanPath.replace(/\\/g, '/');
  normalized = normalized.replace(/\/+/g, '/');
  normalized = normalized.replace(/\/+$/, '') || '/';
  if (/^[a-zA-Z]:$/.test(normalized)) return normalized + '/';
  return normalized;
}

/**
 * Compute the relative path from `from` to `to`.
 * Falls back to `to` if either path is empty or the relative path cannot be computed.
 * @param {string} from Base directory path.
 * @param {string} to Target path.
 * @returns {string}
 */
export function relativePath(from: string, to: string): string {
  if (typeof from !== 'string' || typeof to !== 'string') return to || '';
  if (!from || !to) return to || '';
  try {
    return path.relative(from, to);
  } catch {
    return to;
  }
}

/**
 * Check whether `child` is inside `parent` directory.
 * Both paths are resolved to absolute before comparison.
 * @param {string} parent Parent directory path.
 * @param {string} child Path to test.
 * @returns {boolean}
 */
export function isSubPath(parent: string, child: string): boolean {
  if (typeof parent !== 'string' || typeof child !== 'string') return false;
  if (!parent || !child) return false;
  try {
    const resolvedParent = path.resolve(parent).toLowerCase();
    const resolvedChild = path.resolve(child).toLowerCase();
    const sep = path.sep;
    if (resolvedChild === resolvedParent) return true;
    return resolvedChild.startsWith(resolvedParent + sep);
  } catch {
    return false;
  }
}

/**
 * Extract the lowercase file extension from a path.
 * @param {string} filePath
 * @returns {string}
 */
export function getExt(filePath: string): string {
  if (typeof filePath !== 'string') return '';
  const ext = path.extname(filePath);
  return ext ? ext.toLowerCase() : '';
}

/**
 * Ensure a path ends with the given extension.
 * Appends only if the extension is missing.
 * @param {string} filePath
 * @param {string} ext Extension including leading dot (e.g. '.json').
 * @returns {string}
 */
export function ensureExt(filePath: string, ext: string): string {
  if (typeof filePath !== 'string' || typeof ext !== 'string') return filePath;
  const lowerPath = filePath.toLowerCase();
  const lowerExt = ext.toLowerCase();
  if (lowerPath.endsWith(lowerExt)) return filePath;
  return filePath + ext;
}
