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
