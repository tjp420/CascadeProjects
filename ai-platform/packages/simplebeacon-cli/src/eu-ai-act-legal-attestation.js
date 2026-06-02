/**
 * Legal review attestation shape checks for EU AI Act exports.
 */

function isLegalReviewAttestation(attestation) {
  if (!attestation || typeof attestation !== 'object') return false;
  const status = String(attestation.status || '').toLowerCase();
  return status === 'legal_review_complete' || status === 'complete';
}

module.exports = {
  isLegalReviewAttestation
};
