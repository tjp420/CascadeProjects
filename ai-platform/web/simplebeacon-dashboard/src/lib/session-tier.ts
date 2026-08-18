export interface SessionUser {
  email?: string;
  name?: string;
  role?: string;
  plan?: string;
  tier?: string;
  features?: string[];
}

const FREE_TIERS = new Set(['free', 'community', 'sandbox', 'guest', 'instant', '']);
const PAID_TIERS = new Set([
  'pro', 'developer', 'developer_tier', 'team', 'team_pro', 'enterprise',
  'compliance', 'startup', 'growth', 'gold', 'silver', 'platinum',
  'admin', 'superuser', 'superadmin', 'operator', 'handoff', 'business',
]);

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(base64 + pad));
  } catch {
    return null;
  }
}

export function readStoredUser(): SessionUser | null {
  if (typeof localStorage === 'undefined') return null;
  for (const key of ['sb_user', 'sb-user', 'cascadeAuthUser']) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as SessionUser;
    } catch {
      /* try next key */
    }
  }
  return null;
}

export function isAdminSession(user: SessionUser | null, token?: string | null): boolean {
  const email = String(user?.email || '').toLowerCase();
  if (email === 'admin@simplebeacon.ai') return true;

  const role = String(user?.role || '').toLowerCase();
  if (role === 'admin' || role === 'superuser' || role === 'superadmin') return true;

  const tier = String(user?.tier || user?.plan || '').toLowerCase();
  if (tier === 'admin' || tier === 'superuser') return true;

  const features = Array.isArray(user?.features)
    ? user.features.map((f) => String(f).toLowerCase())
    : [];
  if (features.includes('all_modules')) return true;

  if (token) {
    const payload = decodeJwtPayload(token);
    if (payload) {
      if (String(payload.email || payload.sub || '').toLowerCase() === 'admin@simplebeacon.ai') {
        return true;
      }
      const tokenRole = String(payload.role || '').toLowerCase();
      if (tokenRole === 'admin' || tokenRole === 'superuser' || tokenRole === 'superadmin') {
        return true;
      }
      const tokenTier = String(payload.tier || payload.plan || payload.product || '').toLowerCase();
      if (tokenTier === 'admin' || tokenTier === 'superuser') return true;
      const tokenFeatures = Array.isArray(payload.features)
        ? payload.features.map((f) => String(f).toLowerCase())
        : [];
      if (tokenFeatures.includes('all_modules')) return true;
    }
  }

  return false;
}

export function resolveSessionTier(user: SessionUser | null, token?: string | null): string {
  if (isAdminSession(user, token)) return 'enterprise';

  let tier = String(user?.plan || user?.tier || '').toLowerCase();
  if (!tier && token) {
    const payload = decodeJwtPayload(token);
    if (payload) {
      tier = String(payload.tier || payload.plan || payload.product || '').toLowerCase();
    }
  }

  if (PAID_TIERS.has(tier)) return tier;
  if (FREE_TIERS.has(tier)) return 'free';
  return tier || 'free';
}

export function resolveIsFreeTier(user: SessionUser | null, token?: string | null): boolean {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (/^(localhost|127\.0\.0\.1)$/i.test(host)) return false;
  }
  if (isAdminSession(user, token)) return false;
  const tier = resolveSessionTier(user, token);
  return tier === 'free' || tier === 'community' || tier === 'sandbox' || tier === 'guest';
}
