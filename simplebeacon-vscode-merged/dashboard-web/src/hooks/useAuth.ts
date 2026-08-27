import { useState, useEffect, useCallback } from "react";
import { navigate } from "../router/HashRouter";
import { isTokenExpired } from "../config";

/**
 * Decode a JWT payload without verifying (verification happens server-side).
 * Returns null if the token is malformed.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1]));
  } catch (err) {
    console.warn("[useAuth] Failed to decode JWT payload:", err);
    return null;
  }
}

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isFreeTier, setIsFreeTier] = useState(true);
  const [user, setUser] = useState<{
    email?: string;
    name?: string;
    role?: string;
    plan?: string;
    tier?: string;
  } | null>(null);

  // simplebeacon-ignore: framework-practices — standard React useEffect hook
  useEffect(() => {
    const checkAuth = () => {
      try {
        const token =
          localStorage.getItem("sb_token") ||
          localStorage.getItem("sb-token") ||
          localStorage.getItem("auth_token");
        if (token && !isTokenExpired()) {
          setIsAuthenticated(true);
          // Start with sb_user localStorage data
          let userData: Record<string, unknown> = {};
          const stored = localStorage.getItem("sb_user");
          if (stored) {
            try {
              userData = JSON.parse(stored);
            } catch (err) {
              console.warn("[useAuth] Failed to parse sb_user:", err);
            }
          }
          // Fall back to decoding the JWT for role/email/name if sb_user is
          // missing or stale (e.g. license activation hardcodes role:'user')
          const payload = decodeJwtPayload(token);
          if (payload) {
            if (!userData.role && payload.role) userData.role = payload.role;
            if (!userData.email && payload.email)
              userData.email = payload.email;
            if (!userData.name && payload.name) userData.name = payload.name;
            if (!userData.tier && payload.tier) userData.tier = payload.tier;
            if (!userData.plan && payload.tier) userData.plan = payload.tier;
            // If JWT says admin but localStorage says user, trust the JWT
            // (the server is the source of truth for roles)
            const jwtRole = String(payload.role || "").toLowerCase();
            const storedRole = String(userData.role || "").toLowerCase();
            const adminRoles = ["admin", "owner", "superuser", "superadmin"];
            if (
              adminRoles.includes(jwtRole) &&
              !adminRoles.includes(storedRole)
            ) {
              userData.role = payload.role;
            }
          }
          setUser(userData as typeof user);
          const tier =
            (userData.plan as string) || (userData.tier as string) || "";
          const role = String(userData.role || "").toLowerCase();
          const isAdmin = [
            "admin",
            "owner",
            "superuser",
            "superadmin",
          ].includes(role);
          setIsFreeTier(!isAdmin && (tier === "free" || !tier));
        } else {
          // Token missing or expired — clear all auth state
          setIsAuthenticated(false);
          setUser(null);
          setIsFreeTier(true);
        }
      } catch (err) {
        console.error("[useAuth] Auth check failed:", err);
        setIsAuthenticated(false);
        setUser(null);
        setIsFreeTier(true);
      }
    };

    checkAuth();
    window.addEventListener("storage", checkAuth);
    // Listen for same-tab login/logout events dispatched by SignInView
    window.addEventListener("sb:login", checkAuth);
    window.addEventListener("sb:logout", checkAuth);

    // Listen for setAuthState messages from the IDE parent wrapper.
    // When the dashboard is embedded in the IDE sidebar, the sidebar webview
    // and the dashboard iframe have separate localStorage. The extension sends
    // the auth token via postMessage through the wrapper, and we sync it here.
    const onMessage = (ev: MessageEvent) => {
      if (!ev.data || typeof ev.data !== "object") return;
      if (ev.data.command !== "setAuthState") return;
      const data = ev.data as {
        signedIn?: boolean;
        token?: string;
        tier?: string;
        isAdmin?: boolean;
      };
      if (data.signedIn && data.token) {
        localStorage.setItem("sb_token", data.token);
        if (data.tier) {
          try {
            const existing = JSON.parse(localStorage.getItem("sb_user") || "{}");
            existing.tier = data.tier;
            existing.plan = data.tier;
            if (data.isAdmin) existing.role = "admin";
            localStorage.setItem("sb_user", JSON.stringify(existing));
          } catch {
            /* ignore */
          }
        }
        try {
          window.dispatchEvent(new Event("sb:login"));
        } catch {
          /* ignore */
        }
      } else if (data.signedIn === false) {
        localStorage.removeItem("sb_token");
        localStorage.removeItem("sb-token");
        localStorage.removeItem("auth_token");
        try {
          window.dispatchEvent(new Event("sb:logout"));
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener("message", onMessage);

    return () => {
      window.removeEventListener("storage", checkAuth);
      window.removeEventListener("sb:login", checkAuth);
      window.removeEventListener("sb:logout", checkAuth);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  const signOut = useCallback(() => {
    // Notify the VS Code extension of sign-out before clearing the token
    try {
      const params = new URLSearchParams(window.location.search);
      const notifyBase = params.get("sb_notify_base");
      const redirectUri = params.get("redirect_uri");
      if (notifyBase || redirectUri) {
        const token = localStorage.getItem("sb_token") || "";
        const payload = { signedIn: false, token, tier: "", isAdmin: false };
        if (notifyBase) {
          fetch(`${notifyBase}/notify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "setAuthState", payload }),
          }).catch((err) => {
            console.warn("[useAuth] Fetch notify failed:", err);
            try {
              const beaconUrl = `${notifyBase}/notify/beacon?type=setAuthState&payload=${encodeURIComponent(JSON.stringify(payload))}`;
              new Image().src = beaconUrl;
            } catch (err2) {
              console.warn("[useAuth] Beacon fallback failed:", err2);
            }
          });
        }
        if (redirectUri) {
          const sep = redirectUri.includes("?") ? "&" : "?";
          try {
            window.location.href = `${redirectUri}${sep}signedIn=false&token=${encodeURIComponent(token)}`;
          } catch (err) {
            console.warn("[useAuth] Redirect failed:", err);
          }
        }
      }
    } catch (err) {
      console.error("[useAuth] Sign-out notification failed:", err);
    }
    localStorage.removeItem("sb_token");
    localStorage.removeItem("sb-token");
    localStorage.removeItem("sb_user");
    localStorage.removeItem("auth_token");
    setIsAuthenticated(false);
    setUser(null);
    try {
      window.dispatchEvent(new Event("sb:logout"));
    } catch (err) {
      console.warn("[useAuth] Failed to dispatch logout event:", err);
    }
    navigate("signin");
  }, []);

  return { isAuthenticated, isFreeTier, user, signOut };
}
