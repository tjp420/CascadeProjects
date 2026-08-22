/**
 * Confidence calibrator — adjusts the minimum confidence threshold
 * for a finding based on the file's role. A `console.log` in a test file
 * needs higher confidence to fire than in app code, because the prior
 * probability of it being a real problem is lower.
 *
 * Milestone 1: Trust and Noise Reduction
 */

import { FileRole } from './fileRoleClassifier';

/**
 * Confidence adjustments by file role.
 * Positive values = require MORE confidence (suppress noise).
 * Negative values = require LESS confidence (catch more).
 */
const CONFIDENCE_ADJUSTMENTS: Record<FileRole, number> = {
  app: 0,        // No adjustment — base threshold applies
  config: -0.05, // Slightly lower threshold — config issues are important
  infra: -0.05,  // Slightly lower threshold — infra issues are important
  test: 0.15,    // Higher threshold — test files have lots of expected "issues"
  sample: 0.25,  // Even higher — samples/demos are expected to have patterns
  docs: 0.30,    // Highest — docs mentioning code patterns are not issues
  generated: 0.50, // Almost suppress — generated code can't be fixed here
  vendor: 0.50,    // Almost suppress — vendor code is not ours to fix
};

/**
 * Calculate the effective minimum confidence for a finding given the file role.
 *
 * @param baseThreshold The user's configured threshold (0-1)
 * @param fileRole The classified role of the file
 * @returns The adjusted threshold (0-1, clamped)
 */
export function getEffectiveConfidence(baseThreshold: number, fileRole: FileRole): number {
  const adjustment = CONFIDENCE_ADJUSTMENTS[fileRole] || 0;
  return Math.max(0, Math.min(1, baseThreshold + adjustment));
}

/**
 * Determine if a finding's confidence meets the threshold for its file role.
 *
 * @param findingConfidence The confidence of the finding (0-1)
 * @param baseThreshold The user's configured base threshold (0-1)
 * @param fileRole The classified role of the file
 * @returns true if the finding should be reported, false if suppressed
 */
export function meetsConfidenceThreshold(
  findingConfidence: number | undefined,
  baseThreshold: number,
  fileRole: FileRole
): boolean {
  if (findingConfidence === undefined || findingConfidence === null) {
    // No confidence set — use base threshold with role adjustment
    const effective = getEffectiveConfidence(baseThreshold, fileRole);
    // If no confidence is set, default to passing (backwards compat)
    return true;
  }

  const effective = getEffectiveConfidence(baseThreshold, fileRole);
  return findingConfidence >= effective;
}

/**
 * Get a human-readable explanation of the confidence adjustment.
 */
export function explainConfidenceAdjustment(fileRole: FileRole, baseThreshold: number): string {
  const adjustment = CONFIDENCE_ADJUSTMENTS[fileRole] || 0;
  const effective = getEffectiveConfidence(baseThreshold, fileRole);

  if (adjustment === 0) {
    return `No adjustment for ${fileRole} role (threshold: ${baseThreshold.toFixed(2)})`;
  }

  const direction = adjustment > 0 ? 'raised' : 'lowered';
  return `${fileRole} role — threshold ${direction} by ${Math.abs(adjustment).toFixed(2)} (${baseThreshold.toFixed(2)} → ${effective.toFixed(2)})`;
}
