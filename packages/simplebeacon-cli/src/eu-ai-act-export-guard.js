const constants = require('../../../ai-platform/server/config/constants.cjs');
const { isLegalReviewAttestation } = require('./eu-ai-act-legal-attestation.js');
/**
 * EU AI Act export eligibility and sprint freshness checks.
 */

const DEFAULT_MAX_STALE_MS = 72 * 60 * 60 * constants.MS_PER_SECOND;

function parseTimestamp(value) {
  const ms = Date.parse(String(value || ''));
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Evaluate whether a sprint bundle is fresh based on its most recent timestamp.
 * @param {Object} bundle
 * @param {{maxStaleMs?: number}} [options]
 * @returns {{fresh:boolean, latestMs:number|null, maxStaleMs:number, evaluatedAt:string|null}}
 */
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

/**
 * Evaluate whether a bundle is eligible for EU AI Act export.
 * @param {Object} bundle
 * @returns {{eligible:boolean, legalHandoffEligible:boolean, errors:Array<{code:string,message:string}>}}
 */
function evaluateEuExportEligibility(bundle = {}) {
  const errors = [];
  const classification = bundle.classification || null;
  const attestation = bundle.legalAttestation || null;

  if (!classification?.riskTier) {
    errors.push({ code: 'EUAI-000', message: 'Legal classification record missing (EUAI-000)' });
  }
  if (!isLegalReviewAttestation(attestation)) {
    errors.push({
      code: 'EUAI-ATT',
      message: 'legal_review_complete attestation required for client-facing EU export'
    });
  }

  const legalHandoffEligible = classification?.riskTier != null && isLegalReviewAttestation(attestation);

  return {
    eligible: errors.length === 0,
    legalHandoffEligible,
    errors
  };
}

module.exports = {
  DEFAULT_MAX_STALE_MS,
  evaluateSprintFreshness,
  evaluateEuExportEligibility
};
