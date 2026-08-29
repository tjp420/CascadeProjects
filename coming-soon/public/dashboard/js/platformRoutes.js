/** Deep-link targets within the Simplebeacon SPA (legacy HTML retired). */
export function spaUrl(view, params = {}) {
  const hash = `#/${view}`;
  const query = new URLSearchParams(params).toString();
  return query ? `${hash}?${query}` : hash;
}
