export const GUEST_FUNNEL_EVENTS = [
  "guest_scan_started",
  "guest_scan_completed",
  "upgrade_cta_viewed",
  "upgrade_cta_clicked",
  "checkout_opened",
  "checkout_completed",
] as const;

export type GuestFunnelEvent = (typeof GUEST_FUNNEL_EVENTS)[number];

const SESSION_KEY = "sb_guest_funnel_sid";
const ALLOWED_DATA_KEYS = new Set(["scan_size_bucket", "surface"]);

const BLOCKED_DATA_KEYS = [
  "email",
  "file",
  "filePath",
  "filename",
  "findings",
  "issues",
  "source",
  "code",
  "repository",
  "projectName",
  "path",
  "token",
];

export function scanSizeBucket(fileCount: unknown): string {
  const n = Number(fileCount);
  if (!Number.isFinite(n) || n < 0) return "unknown";
  if (n === 0) return "0";
  if (n <= 100) return "1-100";
  if (n <= 1000) return "101-1000";
  if (n <= 10000) return "1001-10000";
  return "10000+";
}

export function isGuestFunnelEvent(name: string): name is GuestFunnelEvent {
  return (GUEST_FUNNEL_EVENTS as readonly string[]).includes(name);
}

export function getGuestFunnelSessionId(
  storage: Pick<Storage, "getItem" | "setItem"> | null = null,
): string {
  try {
    const store =
      storage ||
      (typeof localStorage !== "undefined" ? localStorage : null);
    if (!store) return "anon";
    const existing = String(store.getItem(SESSION_KEY) || "").trim();
    if (existing && existing.length <= 64) return existing;
    const sid =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `anon-${Date.now().toString(36)}`;
    store.setItem(SESSION_KEY, sid);
    return sid;
  } catch {
    return "anon";
  }
}

export function buildGuestFunnelPayload(
  event: string,
  data: Record<string, unknown> = {},
  options: { sessionId?: string; page?: string; now?: string } = {},
): Record<string, unknown> | null {
  if (!isGuestFunnelEvent(event)) return null;
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (BLOCKED_DATA_KEYS.includes(key)) continue;
    if (!ALLOWED_DATA_KEYS.has(key)) continue;
    const text = String(value ?? "").slice(0, 32);
    if (text) cleaned[key] = text;
  }
  return {
    event,
    sessionId: String(options.sessionId || "anon").slice(0, 64),
    page: String(options.page || "/dashboard/#/analyze").slice(0, 200),
    timestamp: options.now || new Date().toISOString(),
    data: cleaned,
  };
}

export async function trackGuestFunnelEvent(
  event: GuestFunnelEvent,
  data: Record<string, unknown> = {},
): Promise<boolean> {
  try {
    const payload = buildGuestFunnelPayload(event, data, {
      sessionId: getGuestFunnelSessionId(),
      page:
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.hash || ""}`
          : "/dashboard",
    });
    if (!payload) return false;
    const body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const ok = navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      if (ok) return true;
    }
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => null);
    return true;
  } catch {
    return false;
  }
}
