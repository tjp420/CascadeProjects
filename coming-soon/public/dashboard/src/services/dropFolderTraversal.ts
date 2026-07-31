/**
 * Synchronous drop capture + recursive directory traversal for browser-local scans.
 * Mirrors the /audit page pipeline (webkitGetAsEntry + readEntries batches).
 * DataTransfer items must be captured before the drop handler yields.
 */

export type VirtualFile = File & {
    _virtualPath?: string;
};

type TraversalState = {
    errors: number;
    maxFiles: number;
};

const DEFAULT_MAX_FILES = 100_000;

/** Capture FileSystemEntry objects synchronously during the drop event. */
export function captureDropEntries(items: DataTransferItemList | null | undefined): FileSystemEntry[] {
    const entries: FileSystemEntry[] = [];
    if (!items || items.length === 0) return entries;
    for (let i = 0; i < items.length; i += 1) {
        const item = items[i] as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null };
        if (typeof item.webkitGetAsEntry !== 'function') continue;
        try {
            const entry = item.webkitGetAsEntry();
            if (entry) entries.push(entry);
        } catch {
            /* stale or unsupported drop item */
        }
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

    const currentPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;

    if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry;
        await new Promise<void>(resolve => {
            fileEntry.file(
                file => {
                    const virtualFile = file as VirtualFile;
                    try {
                        Object.defineProperty(virtualFile, 'webkitRelativePath', {
                            value: currentPath.replace(/\\/g, '/'),
                            configurable: true
                        });
                    } catch {
                        /* ignore */
                    }
                    virtualFile._virtualPath = currentPath.replace(/\\/g, '/');
                    files.push(virtualFile);
                    resolve();
                },
                () => {
                    state.errors += 1;
                    resolve();
                }
            );
        });
        return;
    }

    if (!entry.isDirectory) return;

    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    let batch: FileSystemEntry[] = [];
    do {
        batch = await new Promise<FileSystemEntry[]>(resolve => {
            reader.readEntries(resolve, () => {
                state.errors += 1;
                resolve([]);
            });
        });
        for (const child of batch) {
            if (files.length >= state.maxFiles) break;
            await traverseFileSystemEntry(child, currentPath, files, state);
        }
    } while (batch.length > 0 && files.length < state.maxFiles);
}

function appendFlatDataTransferFiles(dataTransfer: DataTransfer, files: VirtualFile[]): void {
    if (!dataTransfer.files?.length) return;
    const dtFiles = Array.from(dataTransfer.files);
    const hasRelativePath = dtFiles.some(f => {
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
    dataTransfer: DataTransfer,
    preCapturedEntries?: FileSystemEntry[],
    options: { maxFiles?: number } = {}
): Promise<{ files: VirtualFile[]; rootName: string; traverseErrors: number }> {
    const state: TraversalState = {
        errors: 0,
        maxFiles: options.maxFiles ?? DEFAULT_MAX_FILES
    };
    const files: VirtualFile[] = [];
    const entries = preCapturedEntries ?? captureDropEntries(dataTransfer.items);

    for (const entry of entries) {
        if (files.length >= state.maxFiles) break;
        await traverseFileSystemEntry(entry, '', files, state);
    }

    if (files.length === 0) {
        appendFlatDataTransferFiles(dataTransfer, files);
    }

    const firstRel =
        files[0]?._virtualPath ||
        (files[0] as File & { webkitRelativePath?: string })?.webkitRelativePath ||
        files[0]?.name ||
        'dropped-folder';
    const rootName = String(firstRel).split('/')[0] || 'dropped-folder';

    return { files, rootName, traverseErrors: state.errors };
}
