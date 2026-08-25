import { useState, useEffect, useCallback } from 'react';

export interface Route {
  view: string;
  params: Record<string, string>;
}

export function getCurrentRoute(): Route {
  let pathStr = '';
  let queryStr = '';

  // Prefer hash-based routing (#/view)
  const hash = window.location.hash.slice(1);
  if (hash && hash.length > 1) {
    const [hPath, hQuery] = hash.split('?');
    pathStr = hPath;
    queryStr = hQuery || '';
  } else {
    // Fall back to path-based routing (e.g. /dashboard/repository-health)
    const fullPath = window.location.pathname;
    // Strip /dashboard prefix if present
    let cleaned = fullPath;
    if (cleaned.startsWith('/dashboard')) {
      cleaned = cleaned.slice('/dashboard'.length);
    }
    // Strip leading slash
    cleaned = cleaned.replace(/^\//, '');
    if (cleaned) {
      pathStr = '/' + cleaned;
      queryStr = window.location.search.slice(1);
    }
  }

  const segments = pathStr.split('/').filter(Boolean);
  const view = segments[0] || 'dashboard';
  const params: Record<string, string> = {};

  if (queryStr) {
    new URLSearchParams(queryStr).forEach((value: string, key: string) => {
      params[key] = value;
    });
  }

  if (segments[1]) {
    params.mode = segments[1];
  }

  return { view, params };
}

export function navigate(view: string, params?: Record<string, string>) {
  let hash = `/${view}`;
  if (params?.mode) {
    hash += `/${params.mode}`;
  }
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (key !== 'mode') searchParams.set(key, value);
    });
  }
  const qs = searchParams.toString();
  if (qs) hash += `?${qs}`;
  window.location.hash = hash;
  try {
    // Ensure scroll resets for embedded hosts
    const sc =
      document.querySelector('#app-main') ||
      document.querySelector('.app-main') ||
      document.scrollingElement ||
      document.documentElement;
    if (sc && typeof (sc as any).scrollTo === 'function') (sc as any).scrollTo(0, 0);
    else if (typeof window.scrollTo === 'function') window.scrollTo(0, 0);
  } catch (e) {
    /* ignore */
  }
}

export function useHashRoute() {
  const [route, setRoute] = useState(getCurrentRoute());

  // simplebeacon-ignore: framework-practices — standard React useEffect hook
  useEffect(() => {
    const onHashChange = () => setRoute(getCurrentRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleNavigate = useCallback((view: string, params?: Record<string, string>) => {
    navigate(view, params);
    setRoute(getCurrentRoute());
    try {
      const sc =
        document.querySelector('#app-main') ||
        document.querySelector('.app-main') ||
        document.scrollingElement ||
        document.documentElement;
      if (sc && typeof (sc as any).scrollTo === 'function') (sc as any).scrollTo(0, 0);
      else if (typeof window.scrollTo === 'function') window.scrollTo(0, 0);
    } catch (e) {
      /* ignore */
    }
  }, []);

  return { route, navigate: handleNavigate };
}
