/** Chrome/Firefox webkitdirectory caps — not a SimpleBeacon limit. */
export function isLikelyWebkitDirectoryFileCap(fileCount: number): boolean {
  const n = Number(fileCount) || 0;
  if (n < 2000) return false;
  const knownCaps = [2048, 2500, 3000, 3250, 4096, 8192, 10000];
  if (knownCaps.includes(n)) return true;
  if (n >= 2900 && n <= 3300) return true;
  if (n >= 7500 && n <= 8500) return true;
  return false;
}

export function browserFolderCapMessage(fileCount: number): string {
  const n = Number(fileCount) || 0;
  return `Your browser limited folder selection to ${n.toLocaleString()} files (webkitdirectory cap). `
    + 'Click Select Folder again — Chrome/Edge will use the unlimited folder picker — or run '
    + '`npx simplebeacon scan --full --gate --format json --output .simplebeacon/report.json`.';
}

export function canUseUnlimitedDirectoryPicker(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof (window as Window & { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker === 'function';
}
