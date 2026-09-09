import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles/globals.css";
import { clearAuthAndRedirect } from "./config";

// Ensure all elements that use the legacy `.loading-spinner` class are
// reachable by Playwright via a deterministic `data-testid` attribute.
// This keeps tests stable without touching many template files.
try {
  const setSpinnerTestId = (el: Element) => {
    try {
      if (
        el &&
        el.classList &&
        el.classList.contains("loading-spinner") &&
        !el.hasAttribute("data-testid")
      ) {
        el.setAttribute("data-testid", "loading-spinner");
      }
    } catch (e) {
      /* ignore */
    }
  };

  // Hydrate existing elements
  if (typeof document !== "undefined") {
    document.querySelectorAll(".loading-spinner").forEach(setSpinnerTestId);

    // Watch for dynamically-inserted spinners
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "childList") {
          m.addedNodes.forEach((n: Node) => {
            if (n && (n as Element).querySelectorAll) {
              (n as Element)
                .querySelectorAll(".loading-spinner")
                .forEach(setSpinnerTestId);
            }
            if (
              n &&
              (n as Element).classList &&
              (n as Element).classList.contains &&
              (n as Element).classList.contains("loading-spinner")
            ) {
              setSpinnerTestId(n as Element);
            }
          });
        } else if (m.type === "attributes" && m.target) {
          setSpinnerTestId(m.target as Element);
        }
      }
    });
    mo.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  }
} catch (e) {
  console.error("main.tsx error:", e);
  // best-effort only
}

const rootEl =
  document.getElementById("app-main") || document.getElementById("root");

if (rootEl) {
  // Wrap global fetch so 401 from auth-specific API endpoints triggers auth clear + redirect to signin.
  // Background sync calls (e.g. /scans/count) and non-auth endpoints should NOT trigger
  // a full auth clear — they may return 401 for sandbox/free tokens without meaning the
  // session is invalid. Only auth verification endpoints are authoritative for session state.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof window !== "undefined" && (window as any).fetch) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _origFetch = (window as any).fetch;
    // Auth endpoints that authoritatively indicate session invalidity on 401.
    const AUTH_ENDPOINTS = [
      "/auth/me",
      "/auth/verify",
      "/auth/session",
      "/users/me",
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).fetch = async function (input: any, init?: any) {
      // Offline guard: short-circuit API calls when the browser is offline.
      // Returns a synthetic empty JSON response so views don't spam DNS
      // lookups that all fail with NS_ERROR_UNKNOWN_HOST.
      try {
        const url = String(
          typeof input === "string"
            ? input
            : input?.url || input?.href || "",
        );
        const isApiCall = url.includes("/api/") || url.includes("/api?");
        if (isApiCall && typeof navigator !== "undefined" && !navigator.onLine) {
          const body = JSON.stringify({
            ok: false,
            offline: true,
            error: "Browser is offline. Scans still run locally — dashboard data is unavailable until connectivity returns.",
            data: null,
            results: [],
            items: [],
            entries: [],
            stats: {},
            total: 0,
          });
          return new Response(body, {
            status: 503,
            statusText: "Offline",
            headers: { "Content-Type": "application/json" },
          });
        }
      } catch (_) {
        // best-effort — fall through to real fetch
      }
      try {
        const resp = await _origFetch(input, init);
        try {
          if (resp && resp.status === 401) {
            // Only clear auth + redirect for auth-specific endpoints.
            // Background calls (scans/count, scans/increment, etc.) may return 401
            // for sandbox/free tokens — that doesn't mean the session is invalid.
            const url = String(
              typeof input === "string"
                ? input
                : input?.url || input?.href || "",
            );
            const isAuthEndpoint = AUTH_ENDPOINTS.some((ep) =>
              url.includes(ep),
            );
            if (isAuthEndpoint) {
              clearAuthAndRedirect();
            }
          }
        } catch (e) {
          console.error("main.tsx error:", e);
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
    </React.StrictMode>,
  );
}
