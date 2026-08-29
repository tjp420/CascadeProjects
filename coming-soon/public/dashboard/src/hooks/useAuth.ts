import { useState, useEffect, useCallback } from "react";
import { navigate } from "../router/HashRouter";
import { isTokenExpired, clearAuthToken } from "../config";

/**
 * Decode a JWT payload without verifying (verification happens server-side).
 * Returns null if the token is malformed.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    // 2-part license tokens (data.signature) — payload is first part
    // 3-part JWT tokens (header.data.signature) — payload is second part
    if (parts.length !== 2 && parts.length !== 3) return null;
    const payloadPart = parts.length === 2 ? parts[0] : parts[1];
    return JSON.parse(atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
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
          localStorage.getItem("sb_auth_token") ||
          localStorage.getItem("sb_token") ||
          localStorage.getItem("sb-token") ||
          localStorage.getItem("auth_token");
        if (token && !isTokenExpired()) {
          setIsAuthenticated(true);
          // Start with sb_user localStorage data, fall back to sb-user (legacy)
          let userData: Record<string, unknown> = {};
          const stored = localStorage.getItem("sb_user") || localStorage.getItem("sb-user");
          if (stored) {
            try {
              userData = JSON.parse(stored);
            } catch {
              /* ignore */
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
      } catch {
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
    window.addEventListener("sb:license", checkAuth);
    return () => {
      window.removeEventListener("storage", checkAuth);
      window.removeEventListener("sb:login", checkAuth);
      window.removeEventListener("sb:logout", checkAuth);
      window.removeEventListener("sb:license", checkAuth);
    };
  }, []);

  const signOut = useCallback(() => {
    clearAuthToken();
    localStorage.removeItem("sb_user");
    localStorage.removeItem("sb-user");
    setIsAuthenticated(false);
    setUser(null);
    try {
      window.dispatchEvent(new Event("sb:logout"));
    } catch {
      /* ignore */
    }
    navigate("signin");
  }, []);

  return { isAuthenticated, isFreeTier, user, signOut };
}
