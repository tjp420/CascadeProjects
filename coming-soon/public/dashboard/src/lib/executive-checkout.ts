const EXEC_SESSION_KEY = "sb_exec_session";

export type ExecSession = {
  sessionId: string;
  tier?: string;
  expiresAt?: string | null;
  canExportCertificates?: boolean;
  projectName?: string;
};

function nowIso() {
  return new Date().toISOString();
}

export function createExecutiveSession(data: Partial<ExecSession> & { sessionId: string }) {
  const payload: ExecSession = {
    sessionId: data.sessionId,
    tier: data.tier || "executive_clearance",
    expiresAt: data.expiresAt ?? new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    canExportCertificates: data.canExportCertificates ?? true,
    projectName: data.projectName || null,
  };
  try {
    localStorage.setItem(EXEC_SESSION_KEY, JSON.stringify(payload));
    // notify other tabs/windows
    try { window.dispatchEvent(new CustomEvent("sb:exec-session-changed", { detail: payload })); } catch {}
    return payload;
  } catch (err) {
    return null;
  }
}

export function clearExecutiveSession() {
  try {
    localStorage.removeItem(EXEC_SESSION_KEY);
    try { window.dispatchEvent(new CustomEvent("sb:exec-session-changed", { detail: null })); } catch {}
    return true;
  } catch {
    return false;
  }
}

export function getExecutiveSession(): ExecSession | null {
  try {
    const raw = localStorage.getItem(EXEC_SESSION_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj.sessionId) return null;
    if (obj.expiresAt && new Date(obj.expiresAt).getTime() < Date.now()) return null;
    return obj;
  } catch {
    return null;
  }
}

export function isExecutiveAccessActive(): boolean {
  return Boolean(getExecutiveSession()?.canExportCertificates);
}

export function remainingLockedRows(): number {
  // For local flows, executive clearance unlocks all premium rows.
  return isExecutiveAccessActive() ? 0 : 50;
}
export const ROADMAP_PREVIEW_ROWS = 3;
export const EXECUTIVE_CLEARANCE_PRODUCT = "executive_clearance";
export const EXECUTIVE_CLEARANCE_USD = 499;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidCheckoutEmail(email: string): boolean {
  return EMAIL_RE.test(String(email || "").trim());
}

/** Rows after the unredacted preview, never negative. */
export function remainingLockedRows(
  total: number,
  preview = ROADMAP_PREVIEW_ROWS,
): number {
  const n = Math.max(0, Number(total) || 0);
  const shown = Math.max(0, Number(preview) || 0);
  return Math.max(0, n - shown);
}

export function buildExecutiveCheckoutBody(opts: {
  email: string;
  projectName?: string;
}): {
  email: string;
  projectName: string;
  clientName: string;
  scans: string[];
  total: number;
  product: string;
} {
  const email = String(opts.email || "").trim();
  const projectName =
    String(opts.projectName || "local scan")
      .trim()
      .slice(0, 200) || "local scan";
  return {
    email,
    projectName,
    clientName: email,
    scans: [EXECUTIVE_CLEARANCE_PRODUCT],
    total: EXECUTIVE_CLEARANCE_USD,
    product: EXECUTIVE_CLEARANCE_PRODUCT,
  };
}

export async function startExecutiveCheckout(opts: {
  email: string;
  projectName?: string;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!isValidCheckoutEmail(opts.email)) {
    return { ok: false, error: "Enter a valid email so Stripe can send the receipt." };
  }
  const body = buildExecutiveCheckoutBody(opts);
  try {
    const { apiUrl } = await import("@/config");
    const res = await fetch(apiUrl("create-checkout-session"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      url?: string;
      error?: string;
      message?: string;
    };
    if (res.ok && data.url) {
      return { ok: true, url: String(data.url) };
    }
    return {
      ok: false,
      error: String(data.error || data.message || `Checkout failed (${res.status})`),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error";
    return { ok: false, error: message };
  }
}
