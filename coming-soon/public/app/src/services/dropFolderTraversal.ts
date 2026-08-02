/**
 * Synchronous drop capture + recursive directory traversal for browser-local scans.
 * Mirrors the /audit page pipeline (webkitGetAsEntry + readEntries batches).
 * DataTransfer items must be captured before the drop handler yields.
 */

export type VirtualFile = File & {
  _virtualPath?: string;
  _preReadText?: string;
  _preReadSize?: number;
};

type TraversalState = {
  errors: number;
  maxFiles: number;
  preReadContent: boolean;
};

const DEFAULT_MAX_FILES = 100_000;
const PRE_READ_MAX_SIZE = 2 * 1024 * 1024; // 2 MB — skip pre-reading very large files

/** Capture FileSystemEntry objects synchronously during the drop event. */
export function captureDropEntries(items: DataTransferItemList | null | undefined): FileSystemEntry[] {
  const entries: FileSystemEntry[] = [];
  if (!items) return entries;
  try {
    const len = items.length;
    if (!len) return entries;
    for (let i = 0; i < len; i += 1) {
      try {
        const item = items[i] as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null };
        if (typeof item.webkitGetAsEntry !== 'function') continue;
        const entry = item.webkitGetAsEntry();
        if (entry) entries.push(entry);
      } catch {
        /* stale or unsupported drop item */
      }
    }
  } catch {
    /* DataTransferItemList is no longer usable after the event yielded */
  }
  return entries;
}

async function traverseFileSystemEntry(
  entry: FileSystemEntry,
  parentPath: string,
  files: VirtualFile[],
  state: TraversalState
): Promise<void> {
  if (files.length >= state.maxFiles) return;

  try {
    const currentPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;

    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      await new Promise<void>((resolve) => {
        try {
          fileEntry.file(
            async (file) => {
              const virtualFile = file as VirtualFile;
              try {
                Object.defineProperty(virtualFile, 'webkitRelativePath', {
                  value: currentPath.replace(/\\/g, '/'),
                  configurable: true,
                });
              } catch {
                /* ignore */
              }
              virtualFile._virtualPath = currentPath.replace(/\\/g, '/');
              // Pre-read file text immediately while the File object is still valid.
              // Firefox invalidates File objects from DataTransfer after the drop event yields,
              // causing DOMException when postMessage tries to serialize them for the worker.
              if (state.preReadContent && file.size <= PRE_READ_MAX_SIZE) {
                try {
                  virtualFile._preReadText = await file.text();
                  virtualFile._preReadSize = file.size;
                } catch {
                  /* File may already be stale or unreadable — skip pre-read */
                }
              }
              files.push(virtualFile);
              resolve();
            },
            () => {
              state.errors += 1;
              resolve();
            }
          );
        } catch {
          state.errors += 1;
          resolve();
        }
      });
      return;
    }

    if (!entry.isDirectory) return;

    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    let batch: FileSystemEntry[] = [];
    do {
      batch = await new Promise<FileSystemEntry[]>((resolve) => {
        try {
          reader.readEntries(resolve, () => {
            state.errors += 1;
            resolve([]);
          });
        } catch {
          state.errors += 1;
          resolve([]);
        }
      });
      for (const child of batch) {
        if (files.length >= state.maxFiles) break;
        await traverseFileSystemEntry(child, currentPath, files, state);
      }
    } while (batch.length > 0 && files.length < state.maxFiles);
  } catch {
    // FileSystemEntry became invalid after the drop event; treat as a traversal error
    state.errors += 1;
  }
}

function appendFlatDataTransferFiles(dataTransfer: DataTransfer, files: VirtualFile[]): void {
  if (!dataTransfer.files?.length) return;
  const dtFiles = Array.from(dataTransfer.files);
  const hasRelativePath = dtFiles.some((f) => {
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
    return rel && rel.includes('/');
  });

  if (hasRelativePath) {
    for (const f of dtFiles) {
      const virtualFile = f as VirtualFile;
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      virtualFile._virtualPath = rel.replace(/\\/g, '/');
      files.push(virtualFile);
    }
    return;
  }

  for (const f of dtFiles) {
    const virtualFile = f as VirtualFile;
    const rel = f.name;
    try {
      Object.defineProperty(virtualFile, 'webkitRelativePath', { value: rel, configurable: true });
    } catch {
      /* ignore */
    }
    virtualFile._virtualPath = rel;
    files.push(virtualFile);
  }
}

/**
 * Collect all files from a drop event. Pass entries captured synchronously in handleDrop.
 */
export async function collectFilesFromDrop(
  dataTransfer: DataTransfer | undefined,
  preCapturedEntries?: FileSystemEntry[],
  options: { maxFiles?: number; preReadContent?: boolean } = {}
): Promise<{ files: VirtualFile[]; rootName: string; traverseErrors: number }> {
  const state: TraversalState = {
    errors: 0,
    maxFiles: options.maxFiles ?? DEFAULT_MAX_FILES,
    preReadContent: options.preReadContent ?? false,
  };
  const files: VirtualFile[] = [];
  const entries = preCapturedEntries ?? (dataTransfer ? captureDropEntries(dataTransfer.items) : []);

  for (const entry of entries) {
    if (files.length >= state.maxFiles) break;
    await traverseFileSystemEntry(entry, '', files, state);
  }

  if (files.length === 0 && dataTransfer) {
    try {
      appendFlatDataTransferFiles(dataTransfer, files);
    } catch {
      /* DataTransfer may no longer be usable after an await */
    }
  }

  const firstRel = files[0]?._virtualPath
    || (files[0] as File & { webkitRelativePath?: string })?.webkitRelativePath
    || files[0]?.name
    || 'dropped-folder';
  const rootName = String(firstRel).split('/')[0] || 'dropped-folder';

  return { files, rootName, traverseErrors: state.errors };
}
