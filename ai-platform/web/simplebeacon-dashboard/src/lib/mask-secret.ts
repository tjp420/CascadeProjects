export function maskSecret(value: string | undefined | null): string {
  if (!value) return '****';
  if (value.length <= 8) return '****';
  return value.slice(0, 4) + '••••' + value.slice(-4);
}

export function isMasked(value: string | undefined | null): boolean {
  if (!value) return false;
  return value.includes('••••') || value === '****';
}
