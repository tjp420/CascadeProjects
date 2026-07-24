import { useState, useEffect, useCallback } from 'react';

export interface Route {
  view: string;
  params: Record<string, string>;
}

export function getCurrentRoute(): Route {
  const hash = window.location.hash.slice(1);
  const [path, query] = hash.split('?');
  const segments = path.split('/').filter(Boolean);
  const view = segments[0] || 'dashboard';
  const params: Record<string, string> = {};

  if (query) {
    new URLSearchParams(query).forEach((value: string, key: string) => {
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
}

export function useHashRoute() {
  const [route, setRoute] = useState(getCurrentRoute());

  useEffect(() => {
    const onHashChange = () => setRoute(getCurrentRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleNavigate = useCallback((view: string, params?: Record<string, string>) => {
    navigate(view, params);
    setRoute(getCurrentRoute());
  }, []);

  return { route, navigate: handleNavigate };
}
