// simplebeacon-ignore memory-leak — filesystem utility functions
import * as fs from 'fs';
import * as crypto from 'crypto';

const VALID_DIGEST_ENCODINGS = new Set<string>(['base64', 'hex', 'latin1']);

/**
 * Hash a string or buffer with SHA-256.
 * @param {string | Buffer} input Data to hash.
 * @param {BinaryToTextEncoding} [encoding='hex'] Output encoding.
 * @returns {string}
 */
export function sha256(input: string | Buffer, encoding: crypto.BinaryToTextEncoding = 'hex'): string {
  if (input == null || (typeof input !== 'string' && !Buffer.isBuffer(input))) {
    throw new TypeError('sha256 input must be a string or Buffer');
  }
  return crypto.createHash('sha256').update(input).digest(encoding);
}

/**
 * Compute the SHA-256 hash of a file.
 * @param {string} filePath Absolute path to the file.
 * @param {BinaryToTextEncoding} [encoding='hex'] Output encoding.
 * @returns {string | undefined} Hash string, or undefined if the file cannot be read.
 */
export function getFileHash(filePath: string, encoding: crypto.BinaryToTextEncoding = 'hex'): string | undefined {
  if (typeof filePath !== 'string' || !filePath) return undefined;
  const enc = VALID_DIGEST_ENCODINGS.has(encoding) ? encoding : 'hex';
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest(enc);
  } catch {
    return undefined;
  }
}

/**
 * Compute the SHA-256 hash of a file using a stream.
 * Suitable for large files that should not be loaded into memory at once.
 * @param {string} filePath Absolute path to the file.
 * @param {BinaryToTextEncoding} [encoding='hex'] Output encoding.
 * @returns {Promise<string | undefined>} Hash string, or undefined if the file cannot be read.
 */
export async function getFileHashAsync(
  filePath: string,
  encoding: crypto.BinaryToTextEncoding = 'hex'
): Promise<string | undefined> {
  if (typeof filePath !== 'string' || !filePath) return undefined;
  const enc = VALID_DIGEST_ENCODINGS.has(encoding) ? encoding : 'hex';
  try {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    return new Promise<string | undefined>((resolve) => {
      stream.on('data', (chunk) => {
        try {
          hash.update(chunk);
        } catch {
          stream.destroy();
          resolve(undefined);
        }
      });
      stream.on('end', () => {
        try {
          stream.close();
        } catch {
          /* ignore close errors */
        }
        resolve(hash.digest(enc));
      });
      stream.on('error', () => {
        try {
          stream.destroy();
        } catch {
          /* ignore destroy errors */
        }
        resolve(undefined);
      });
    });
  } catch {
    return undefined;
  }
}

/**
 * Safely read and parse a JSON file.
 * Returns the fallback (or undefined) on any error.
 * @param {string} filePath Absolute path to the JSON file.
 * @param {T} [fallback] Value returned when reading or parsing fails.
 * @returns {T | undefined}
 */
export function readJsonFile<T>(filePath: string, fallback?: T): T | undefined {
  if (typeof filePath !== 'string' || !filePath) return fallback;
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/**
 * Safely read a text file.
 * Returns the fallback (or undefined) on any error.
 * @param {string} filePath Absolute path to the file.
 * @param {string} [fallback] String returned when reading fails.
 * @returns {string | undefined}
 */
export function readTextFile(filePath: string, fallback?: string): string | undefined {
  if (typeof filePath !== 'string' || !filePath) return fallback;
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return fallback;
  }
}

/**
 * Safely read and parse a JSON file asynchronously.
 * @param {string} filePath Absolute path to the JSON file.
 * @param {T} [fallback] Value returned when reading or parsing fails.
 * @returns {Promise<T | undefined>}
 */
export async function readJsonFileAsync<T>(filePath: string, fallback?: T): Promise<T | undefined> {
  if (typeof filePath !== 'string' || !filePath) return fallback;
  try {
    const text = await fs.promises.readFile(filePath, 'utf8');
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/**
 * Safely read a text file asynchronously.
 * @param {string} filePath Absolute path to the file.
 * @param {string} [fallback] String returned when reading fails.
 * @returns {Promise<string | undefined>}
 */
export async function readTextFileAsync(filePath: string, fallback?: string): Promise<string | undefined> {
  if (typeof filePath !== 'string' || !filePath) return fallback;
  try {
    return await fs.promises.readFile(filePath, 'utf8');
  } catch {
    return fallback;
  }
}

/**
 * Atomically write JSON data to a file (writes to temp then renames).
 * @param {string} filePath Absolute path to the file.
 * @param {unknown} data Serializable data to write.
 * @returns {boolean} True if the write succeeded.
 */
export function writeJsonFile(filePath: string, data: unknown): boolean {
  if (typeof filePath !== 'string' || !filePath) return false;
  try {
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Atomically write text to a file (writes to temp then renames).
 * @param {string} filePath Absolute path to the file.
 * @param {string} text Text to write.
 * @returns {boolean} True if the write succeeded.
 */
export function writeTextFile(filePath: string, text: string): boolean {
  if (typeof filePath !== 'string' || !filePath) return false;
  try {
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, String(text), 'utf8');
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure a directory exists, creating it recursively if necessary.
 * Silently swallows permission errors so the caller can decide how to handle them.
 * @param {string} dirPath Absolute directory path.
 * @returns {boolean} True if the directory now exists.
 */
export function ensureDir(dirPath: string): boolean {
  if (typeof dirPath !== 'string' || !dirPath) return false;
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Sanitize a string so it can be used as a safe filename.
 * Replaces illegal characters with underscores and trims trailing dots/spaces.
 * @param {string} name Proposed filename.
 * @param {string} [replacement='_'] Character used to replace illegal chars.
 * @returns {string}
 */
export function sanitizeFilename(name: string, replacement = '_'): string {
  if (name == null || typeof name === 'symbol') return 'untitled';
  const repl = typeof replacement === 'string' && replacement ? replacement : '_';
  const sanitized = String(name)
    .replace(/[<>:"\/\\|?*\x00-\x1f]/g, repl)
    .replace(/[\.\s]+$/, '');
  const reserved = /^(CON|PRN|AUX|NUL|COM[1-9]\d?|LPT[1-9]\d?)$/i;
  const baseName = sanitized.replace(/\.[^.]*$/, '');
  if (reserved.test(sanitized) || reserved.test(baseName)) {
    return `_${sanitized}`;
  }
  return sanitized || 'untitled';
}
