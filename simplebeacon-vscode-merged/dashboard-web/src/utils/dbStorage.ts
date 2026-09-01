/**
 * IndexedDB-backed large item storage with localStorage fallback.
 *
 * Provides async get/set/remove for payloads that may exceed the
 * ~5 MB localStorage quota. The fallback chain is:
 *   1. IndexedDB (unlimited storage, async)
 *   2. localStorage (sync, ~5 MB limit)
 *   3. Compact localStorage (JSON with whitespace stripped)
 */

const DB_NAME = "simplebeacon-storage";
const STORE_NAME = "large-items";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
  });
}

/**
 * Store a large value in IndexedDB, falling back to localStorage.
 * @param key Storage key
 * @param value JSON-serializable value
 */
export async function setLargeItem(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("IndexedDB put failed"));
      tx.onabort = () => reject(tx.error || new Error("IndexedDB put aborted"));
    });
    db.close();
  } catch {
    // Fallback to localStorage
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Last resort: compact JSON (no whitespace)
      try {
        localStorage.setItem(key, JSON.stringify(value).replace(/\s+/g, ""));
      } catch {
        throw new Error(
          `Failed to store "${key}" in both IndexedDB and localStorage`,
        );
      }
    }
  }
}

/**
 * Retrieve a large value from IndexedDB, falling back to localStorage.
 * @param key Storage key
 * @returns The stored value, or null if not found
 */
export async function getLargeItem<T = unknown>(
  key: string,
): Promise<T | null> {
  try {
    const db = await openDB();
    const result = await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () =>
        reject(req.error || new Error("IndexedDB get failed"));
    });
    db.close();
    return result;
  } catch {
    // Fallback to localStorage
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }
}

/**
 * Remove a large value from both IndexedDB and localStorage.
 * @param key Storage key
 */
export async function removeLargeItem(key: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error || new Error("IndexedDB delete failed"));
    });
    db.close();
  } catch {
    // ignore — best effort
  }
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
