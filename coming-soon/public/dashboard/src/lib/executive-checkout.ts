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
    projectName: data.projectName || undefined,
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

export const ROADMAP_PREVIEW_ROWS = 3;
export const EXECUTIVE_CLEARANCE_PRODUCT = "executive_clearance";
export const EXECUTIVE_CLEARANCE_USD = 499;
export const EXECUTIVE_CLEARANCE_FLAG_KEY = "sb_executive_clearance";

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

export function parseCheckoutReturnParams(
  search = "",
  hash = "",
): { sessionId: string | null; checkoutSuccess: boolean } {
  const query = search.startsWith("?") ? search.slice(1) : search;
  const fromSearch = new URLSearchParams(query);
  let hashQuery = "";
  const hashMark = hash.indexOf("?");
  if (hashMark >= 0) hashQuery = hash.slice(hashMark + 1);
  const fromHash = new URLSearchParams(hashQuery);
  const sessionId = fromSearch.get("session_id") || fromHash.get("session_id");
  const checkoutSuccess =
    fromSearch.get("checkout") === "success" ||
    fromHash.get("checkout") === "success";
  return {
    sessionId: sessionId && sessionId.trim() ? sessionId.trim() : null,
    checkoutSuccess,
  };
}

export function applyExecutiveClearanceLocally(opts: {
  email?: string | null;
  token?: string | null;
  projectName?: string | null;
  tier?: string | null;
}): void {
  if (typeof window === "undefined") return;
  let user: Record<string, unknown> = {};
  try {
    user = JSON.parse(
      localStorage.getItem("sb_user") || localStorage.getItem("sb-user") || "{}",
    );
  } catch {
    user = {};
  }
  if (!user || typeof user !== "object") user = {};
  if (opts.email) user.email = opts.email;
  user.plan = "executive_clearance";
  user.tier = String(opts.tier || "executive_clearance");
  if (opts.projectName) user.projectName = opts.projectName;
  localStorage.setItem("sb_user", JSON.stringify(user));
  localStorage.setItem(EXECUTIVE_CLEARANCE_FLAG_KEY, "1");
  if (opts.token) {
    localStorage.setItem("sb_license", opts.token);
  }
  try {
    window.dispatchEvent(new Event("sb:license"));
    window.dispatchEvent(new CustomEvent("sb:exec-session-changed"));
  } catch {
    /* ignore */
  }
}

function escapeXml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildExecutiveCertificateSvg(opts: {
  projectName?: string;
  email?: string;
  issuedAt?: string;
}): string {
  const project = escapeXml(opts.projectName || "local scan");
  const email = escapeXml(opts.email || "");
  const issued = escapeXml(
    opts.issuedAt || new Date().toISOString().slice(0, 10),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <rect width="800" height="500" fill="#0f172a"/>
  <rect x="24" y="24" width="752" height="452" fill="none" stroke="#38bdf8" stroke-width="2"/>
  <text x="400" y="90" text-anchor="middle" fill="#e2e8f0" font-size="28" font-family="sans-serif">Executive Risk Certificate</text>
  <text x="400" y="140" text-anchor="middle" fill="#94a3b8" font-size="14" font-family="sans-serif">SimpleBeacon executive clearance</text>
  <text x="80" y="220" fill="#cbd5e1" font-size="16" font-family="sans-serif">Project: ${project}</text>
  <text x="80" y="255" fill="#cbd5e1" font-size="16" font-family="sans-serif">Issued: ${issued}</text>
  ${email ? `<text x="80" y="290" fill="#cbd5e1" font-size="16" font-family="sans-serif">Account: ${email}</text>` : ""}
  <text x="80" y="360" fill="#64748b" font-size="13" font-family="sans-serif">Records a completed $${EXECUTIVE_CLEARANCE_USD} checkout.</text>
  <text x="80" y="385" fill="#64748b" font-size="13" font-family="sans-serif">Not a security attestation or verified-vulnerability count.</text>
</svg>
`;
}

export function downloadExecutiveCertificateSvg(opts: {
  projectName?: string;
  email?: string;
}): void {
  const svg = buildExecutiveCertificateSvg(opts);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `simplebeacon-executive-certificate-${stamp}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function completeExecutiveCheckoutReturn(): Promise<{
  applied: boolean;
  canExportCertificates: boolean;
}> {
  if (typeof window === "undefined") {
    return { applied: false, canExportCertificates: false };
  }
  const { sessionId } = parseCheckoutReturnParams(
    window.location.search,
    window.location.hash,
  );
  if (!sessionId) {
    try {
      const unlocked =
        localStorage.getItem(EXECUTIVE_CLEARANCE_FLAG_KEY) === "1";
      return { applied: unlocked, canExportCertificates: unlocked };
    } catch {
      return { applied: false, canExportCertificates: false };
    }
  }
  try {
    const { apiUrl } = await import("@/config");
    let payload: Record<string, unknown> = {};
    const sessionRes = await fetch(
      `${apiUrl("simplebeacon/billing/session")}?session_id=${encodeURIComponent(sessionId)}`,
      { credentials: "include" },
    );
    if (sessionRes.ok) {
      payload = (await sessionRes.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
    } else {
      const tokenRes = await fetch(
        apiUrl(`session-token/${encodeURIComponent(sessionId)}`),
        { credentials: "include" },
      );
      if (tokenRes.ok) {
        payload = (await tokenRes.json().catch(() => ({}))) as Record<
          string,
          unknown
        >;
      }
    }
    const product = String(payload.product || "");
    const tier = String(payload.tier || "");
    const paid =
      payload.paymentStatus === "paid" ||
      payload.success === true ||
      Boolean(payload.token || payload.licenseToken);
    const executive =
      payload.canExportCertificates === true ||
      product === EXECUTIVE_CLEARANCE_PRODUCT ||
      tier === EXECUTIVE_CLEARANCE_PRODUCT ||
      tier === "executive";
    if (!paid || !executive) {
      return { applied: false, canExportCertificates: false };
    }
    applyExecutiveClearanceLocally({
      email: payload.email ? String(payload.email) : null,
      token: payload.token
        ? String(payload.token)
        : payload.licenseToken
          ? String(payload.licenseToken)
          : null,
      projectName: payload.projectName
        ? String(payload.projectName)
        : payload.certProfile &&
            typeof payload.certProfile === "object" &&
            (payload.certProfile as { projectName?: string }).projectName
          ? String(
              (payload.certProfile as { projectName?: string }).projectName,
            )
          : null,
      tier: "executive_clearance",
    });
    createExecutiveSession({
      sessionId,
      tier: "executive_clearance",
      canExportCertificates: true,
      projectName:
        payload.projectName != null ? String(payload.projectName) : undefined,
    });
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("session_id");
      url.searchParams.delete("checkout");
      const hashQ = url.hash.indexOf("?");
      if (hashQ >= 0) {
        const hashParams = new URLSearchParams(url.hash.slice(hashQ + 1));
        hashParams.delete("session_id");
        hashParams.delete("checkout");
        const nextHash = hashParams.toString();
        url.hash = nextHash
          ? `${url.hash.slice(0, hashQ)}?${nextHash}`
          : url.hash.slice(0, hashQ);
      }
      window.history.replaceState({}, "", url.toString());
    } catch {
      /* ignore */
    }
    return { applied: true, canExportCertificates: true };
  } catch {
    return { applied: false, canExportCertificates: false };
  }
}
