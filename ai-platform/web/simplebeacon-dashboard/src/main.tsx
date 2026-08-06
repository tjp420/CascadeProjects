import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/globals.css';
import { clearAuthAndRedirect } from './config';

// Ensure all elements that use the legacy `.loading-spinner` class are
// reachable by Playwright via a deterministic `data-testid` attribute.
// This keeps tests stable without touching many template files.
try {
  const setSpinnerTestId = (el: Element) => {
    try {
      if (el && el.classList && el.classList.contains('loading-spinner') && !el.hasAttribute('data-testid')) {
        el.setAttribute('data-testid', 'loading-spinner');
      }
    } catch (e) {
      /* ignore */
    }
  };

  // Hydrate existing elements
  if (typeof document !== 'undefined') {
    document.querySelectorAll('.loading-spinner').forEach(setSpinnerTestId);

    // Watch for dynamically-inserted spinners
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList') {
          m.addedNodes.forEach((n: Node) => {
            if (n && (n as Element).querySelectorAll) {
              (n as Element).querySelectorAll('.loading-spinner').forEach(setSpinnerTestId);
            }
            if (n && (n as Element).classList && (n as Element).classList.contains && (n as Element).classList.contains('loading-spinner')) {
              setSpinnerTestId(n as Element);
            }
          });
        } else if (m.type === 'attributes' && m.target) {
          setSpinnerTestId(m.target as Element);
        }
      }
    });
    mo.observe(document.documentElement || document.body, { childList: true, subtree: true, attributes: true });
  }
} catch (e) {
  // best-effort only
}

const rootEl = document.getElementById('app-main') || document.getElementById('root');

if (rootEl) {
  // Wrap global fetch so a 401 from auth-validation endpoints triggers auth clear + redirect.
  // CAUTION: Only clear auth on 401 from /api/auth/* (excluding login/register). Other endpoints
  // (e.g., /api/vault/consensus/status, /api/outreach/*) may return 401 for reasons other than
  // session expiration (elevated privileges, consensus tokens, tier restrictions). Clearing the
  // session on those would wipe a valid token and cascade 401s across all endpoints.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof window !== 'undefined' && (window as any).fetch) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _origFetch = (window as any).fetch;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).fetch = async function (input: any, init?: any) {
      try {
        const resp = await _origFetch(input, init);
        try {
          if (resp && resp.status === 401) {
            const url = typeof input === 'string' ? input : (input?.url || String(input));
            // Only clear auth + redirect for auth-validation endpoints.
            // Matches /api/auth/verify, /api/auth/me, /api/auth/session, etc.
            // Excludes /api/auth/login and /api/auth/register (wrong credentials, not expiration).
            if (/\/api\/auth\/(?!login|register)/i.test(url)) {
              clearAuthAndRedirect();
            }
          }
        } catch (e) {
          // ignore
        }
        return resp;
      } catch (e) {
        throw e;
      }
    };
  }
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
