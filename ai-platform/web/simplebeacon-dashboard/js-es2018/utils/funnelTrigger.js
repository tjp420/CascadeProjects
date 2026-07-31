// simplebeacon-ignore: Dashboard code — tech-debt markers are intentional documentation
/**
 * SimpleBeacon Automated Funnel Trigger Engine
 * Evaluates free tier scan metrics to trigger contextual enterprise upsells.
 */
export function evaluateFunnelMetrics(reportData) {
  var _a;
  const triggers = {
    shouldPromptUpgrade: false,
    reason: null,
    targetTier: 'team',
  };
  if (!reportData) return triggers;
  // 1. Enterprise Scale Check: Large file volume footprint
  if (reportData.files_scanned > 5000 || reportData.total_files > 15000) {
    triggers.shouldPromptUpgrade = true;
    triggers.reason = 'monorepo_scale';
    triggers.targetTier = 'enterprise';
    return triggers;
  }
  // 2. Multi-Team Check: Stale TODO items or varying metadata flags
  if (
    reportData.quality_score < 80 &&
    ((_a = reportData.findings) === null || _a === void 0
      ? void 0
      : _a.some((f) => f.rule_id === 'SB-FICTION-003'))
  ) {
    triggers.shouldPromptUpgrade = true;
    triggers.reason = 'hallucinated_dependency_risk';
    triggers.targetTier = 'team';
    return triggers;
  }
  return triggers;
}
function decodeJwtPayload(token) {
  if (!token || !token.includes('.') || token.split('.').length !== 3) return null;
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch (_a) {
    return null;
  }
}

/**
 * Resolve auth context for funnel gating (session user + JWT claims).
 */
export function buildFunnelAuthOptions(authService) {
  if (!authService) {
    return { isAdmin: false, isSignedIn: false, isFreeTier: undefined, tier: '', trustLevel: '' };
  }
  const sessionUser = authService.getUser ? authService.getUser() : null;
  const isSignedIn = authService.isAuthenticated ? authService.isAuthenticated() : false;
  const tokenPayload = decodeJwtPayload(authService.getToken ? authService.getToken() : '');
  const tokenRole = String(
    (tokenPayload === null || tokenPayload === void 0 ? void 0 : tokenPayload.role) || ''
  ).toLowerCase();
  const tokenTrust = String(
    (tokenPayload === null || tokenPayload === void 0 ? void 0 : tokenPayload.trustLevel) || ''
  ).toLowerCase();
  const tokenTier = String(
    (tokenPayload === null || tokenPayload === void 0 ? void 0 : tokenPayload.tier) ||
      (tokenPayload === null || tokenPayload === void 0 ? void 0 : tokenPayload.plan) ||
      ''
  ).toLowerCase();
  const sessionRole = String(
    (sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.role) || ''
  ).toLowerCase();
  const sessionFeatures = Array.isArray(
    sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.features
  )
    ? sessionUser.features.map(String).map((s) => s.toLowerCase())
    : [];
  const tokenFeatures = Array.isArray(
    tokenPayload === null || tokenPayload === void 0 ? void 0 : tokenPayload.features
  )
    ? tokenPayload.features.map(String).map((s) => s.toLowerCase())
    : [];
  const sessionEmail = String(
    (sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.email) || ''
  ).toLowerCase();
  const tokenEmail = String(
    (tokenPayload === null || tokenPayload === void 0 ? void 0 : tokenPayload.email) || ''
  ).toLowerCase();
  const isAdmin = Boolean(
    (authService.isAdmin && authService.isAdmin()) ||
    tokenRole === 'admin' ||
    tokenRole === 'superuser' ||
    sessionRole === 'admin' ||
    sessionRole === 'superuser' ||
    sessionFeatures.includes('all_modules') ||
    tokenFeatures.includes('all_modules') ||
    sessionEmail === 'admin@simplebeacon.ai' ||
    tokenEmail === 'admin@simplebeacon.ai'
  );
  return {
    isAdmin,
    isSignedIn,
    isFreeTier: authService.isFreeTier ? authService.isFreeTier() : undefined,
    tier: String(
      (sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.tier) ||
        (sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.plan) ||
        tokenTier ||
        (authService.getTokenTier ? authService.getTokenTier() : '') ||
        ''
    ).toLowerCase(),
    trustLevel: String(
      (sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.trustLevel) ||
        tokenTrust ||
        ''
    ).toLowerCase(),
  };
}

/**
 * Returns true when the enterprise upsell card should render.
 */
export function shouldShowEnterpriseFunnel(options = {}) {
  if (options.isAdmin) return false;
  if (options.isLocalScan || options.isClientScan || options.isPrivateScan) return false;
  if (options.isSignedIn && options.isFreeTier !== true) return false;
  if (options.isFreeTier === false) return false;
  const tier = String(options.tier || '').toLowerCase();
  const paidTiers = [
    'team',
    'enterprise',
    'operator',
    'handoff',
    'pro',
    'business',
    'gold',
    'platinum',
    'admin',
    'superuser',
  ];
  if (paidTiers.includes(tier)) return false;
  const trust = String(options.trustLevel || '').toLowerCase();
  if (trust === 'gold' || trust === 'platinum' || trust === 'silver') return false;
  return true;
}

/**
 * Returns tailored conversion copy blocks based on the trigger context
 */
export function getFunnelCopy(reason) {
  const copyMap = {
    monorepo_scale: {
      title: 'Scaling SimpleBeacon for Large Monorepos',
      body: 'Your repository size exceeds the standard developer free tier limits. Unlock premium multi-threaded scan processing, custom rule profiles, and centralized compliance reporting.',
      cta: 'Contact Enterprise Sales',
    },
    hallucinated_dependency_risk: {
      title: 'Protect Your Supply Chain',
      body: 'We detected suspicious or unverified dependency footprints in this workspace. Upgrade to the Team plan to activate automated real-time npm registry 404 validation gates.',
      cta: 'Upgrade to Team ($149/mo)',
    },
  };
  return (
    copyMap[reason] || {
      title: 'Unlock Advanced Analytics',
      body: 'Get deep KPI tracking, code history metrics, and cryptographically signed release certificates.',
      cta: 'View Premium Tiers',
    }
  );
}
