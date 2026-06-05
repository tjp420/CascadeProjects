/**
 * EU AI Act export eligibility and sprint freshness checks.
 */

const DEFAULT_MAX_STALE_MS = 72 * 60 * 60 * 1000;

function parseTimestamp(value) {
  const ms = Date.parse(String(value || ''));
  return Number.isFinite(ms) ? ms : null;
}

function evaluateSprintFreshness(bundle = {}, options = {}) {
  const maxStaleMs = options.maxStaleMs ?? DEFAULT_MAX_STALE_MS;
  const candidates = [
    bundle.embeddedInMainReport?.generatedAt,
    bundle.compliance?.evaluatedAt,
    bundle.assessment?.generatedAt,
    bundle.sprintReport?.generatedAt
  ];
  const timestamps = candidates.map(parseTimestamp).filter((ms) => ms != null);
  const latestMs = timestamps.length ? Math.max(...timestamps) : null;
  const fresh = latestMs != null ? (Date.now() - latestMs) <= maxStaleMs : false;
  return {
    fresh,
    latestMs,
    maxStaleMs,
    evaluatedAt: candidates.find(Boolean) || null
  };
}

function evaluateEuExportEligibility(bundle = {}, _options = {}) {
  const errors = [];
  const classification = bundle.classification || null;
  const attestation = bundle.legalAttestation || null;

  if (!classification?.riskTier) {
    errors.push({ code: 'EUAI-000', message: 'Legal classification record missing (EUAI-000)' });
  }
  if (!attestation || attestation.status !== 'legal_review_complete') {
    errors.push({
      code: 'EUAI-ATT',
      message: 'legal_review_complete attestation required for client-facing EU export'
    });
  }

  return {
    eligible: errors.length === 0,
    legalHandoffEligible: false,
    errors
  };
}

module.exports = {
  DEFAULT_MAX_STALE_MS,
  evaluateSprintFreshness,
  evaluateEuExportEligibility
};
