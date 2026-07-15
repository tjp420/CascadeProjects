// simplebeacon-ignore documentation
/** Keep in sync with server/lib/path-safety.js DEFAULT_ALLOWED_HOSTS */
export const REMOTE_REPO_HOSTS = [
  'github.com',
  'www.github.com',
  'gitlab.com',
  'www.gitlab.com',
  'bitbucket.org',
  'www.bitbucket.org',
  'codeberg.org',
  'www.codeberg.org'
];

/**
 * Is remote repo url.
 * @param {any} value
 * @returns {any}
 */
export function isRemoteRepoUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  if (/^git@[^:]+:[\w.\-/]+/i.test(raw)) return true;
  if (raw.startsWith('ssh://git@') || raw.startsWith('ssh://')) {
    try {
      const host = new URL(raw).hostname.toLowerCase();
      return REMOTE_REPO_HOSTS.includes(host);
    } catch {
      return false;
    }
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return false;
    return REMOTE_REPO_HOSTS.includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** @deprecated use isRemoteRepoUrl */
export function isGithubRepoUrl(value) {
  return isRemoteRepoUrl(value);
}

/**
 * Source chip title.
 * @param {any} source
 * @returns {any}
 */
export function sourceChipTitle(source) {
  const hint = source?.hint ? ` — ${source.hint}` : '';
  const kind = source?.kind === 'remote' ? 'HTTPS clone' : source?.kind === 'cached' ? 'Cached clone' : 'Local folder';
  return `${kind}${hint}`;
}
