/**
 * Hand a successful dashboard login back to the VS Code / Cursor extension.
 */

const IDE_SCHEMES = new Set([
  "vscode",
  "cursor",
  "vscode-insiders",
  "windsurf",
]);

const RELAY_HOST = "simplebeacon.simplebeacon-vscode";

export function isIdeAuthRelayUri(uri: string | null | undefined): boolean {
  if (!uri || typeof uri !== "string") return false;
  try {
    const parsed = new URL(uri);
    const scheme = String(parsed.protocol || "")
      .replace(/:$/, "")
      .toLowerCase();
    const host = String(parsed.hostname || parsed.host || "").toLowerCase();
    const path = String(parsed.pathname || "").replace(/\/+$/, "") || "/";
    return (
      IDE_SCHEMES.has(scheme) &&
      host === RELAY_HOST &&
      (path === "/relay/auth" || path.endsWith("/relay/auth"))
    );
  } catch {
    return /^(vscode|cursor|vscode-insiders|windsurf):\/\/simplebeacon\.simplebeacon-vscode\/relay\/auth/i.test(
      uri,
    );
  }
}

export function buildIdeAuthRelayHref(
  redirectUri: string,
  token: string,
  options: { tier?: string; isAdmin?: boolean } = {},
): string {
  const join = redirectUri.includes("?") ? "&" : "?";
  const tier = options.tier || "";
  const isAdmin = options.isAdmin === true;
  return `${redirectUri}${join}token=${encodeURIComponent(token)}&signedIn=true&tier=${encodeURIComponent(tier)}&isAdmin=${isAdmin}`;
}

export function isEmbeddedIdeSurface(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const proto = String(window.location?.protocol || "").toLowerCase();
  return proto === "vscode-webview:" || proto === "vscode-file:";
}

export function shouldAssignIdeAuthRelayLocation(
  redirectUri: string | null | undefined,
): boolean {
  return isIdeAuthRelayUri(redirectUri) && !isEmbeddedIdeSurface();
}

export function completeIdeAuthRelay(
  token: string,
  user?: { tier?: string; plan?: string; role?: string } | null,
): void {
  if (typeof window === "undefined" || !token) return;
  const tier = String(user?.tier || user?.plan || "");
  const role = String(user?.role || "").toLowerCase();
  const isAdmin =
    ["admin", "owner", "superuser", "superadmin"].includes(role) ||
    tier.toLowerCase() === "admin";
  const payload = {
    command: "setAuthState",
    signedIn: true,
    tier,
    token,
    isAdmin,
  };
  try {
    window.parent.postMessage(payload, "*");
  } catch {
    /* ignore */
  }
  try {
    const params = new URLSearchParams(window.location.search);
    const notify =
      params.get("sb_notify_base") || sessionStorage.getItem("sb_notify_base");
    if (notify) {
      const base = notify.replace(/\/+$/, "");
      fetch(`${base}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "setAuthState", payload }),
      }).catch(() => {});
    }
    const redirectUri = params.get("redirect_uri");
    if (shouldAssignIdeAuthRelayLocation(redirectUri)) {
      const allowedRelayHref = buildIdeAuthRelayHref(
        redirectUri as string,
        token,
        { tier, isAdmin },
      );
      window.location.assign(allowedRelayHref);
    }
  } catch {
    /* ignore */
  }
}
