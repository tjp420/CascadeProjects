export function isBenchmarkCachePath(path) {
  if (!path) return false;
  const str = String(path).toLowerCase();
  return str.includes('github-cache') || str.includes('benchmark');
}
