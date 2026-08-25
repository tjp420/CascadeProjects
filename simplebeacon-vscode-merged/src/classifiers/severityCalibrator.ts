/**
 * Severity calibrator — downshifts or suppresses finding severity based on
 * the file's role in the repository. This is the core of false-positive
 * suppression: a `console.log` in a test file is not the same as in production.
 *
 * Milestone 1: Trust and Noise Reduction
 */

import { FileRole } from './fileRoleClassifier';

export type Severity = 'error' | 'warning' | 'info' | 'suppressed';

export interface SeverityDecision {
  severity: Severity;
  reason: string;
  /** Original severity before calibration */
  originalSeverity: 'error' | 'warning' | 'info';
}

/**
 * Rule-specific severity adjustments by file role.
 *
 * The principle:
 * - Security rules (hardcoded credentials) stay high in app/config/infra,
 *   but are downshifted in test/sample (where fake credentials are expected)
 *   and suppressed in generated/vendor/docs.
 * - Code quality rules (console.log, TODO) are downshifted in test files
 *   and suppressed in generated/vendor/docs/sample.
 * - AI slop rules are downshifted in test/sample and suppressed in docs/generated/vendor.
 */
const SEVERITY_MATRIX: Record<string, Partial<Record<FileRole, Severity>>> = {
  // ─── Security: credentials ───
  'hardcoded-password': {
    app: 'error',
    config: 'error',
    infra: 'error',
    test: 'info',
    sample: 'info',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },
  'hardcoded-api-key': {
    app: 'error',
    config: 'error',
    infra: 'error',
    test: 'info',
    sample: 'info',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },
  'hardcoded-token': {
    app: 'error',
    config: 'error',
    infra: 'error',
    test: 'info',
    sample: 'info',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },
  'secret-password': {
    app: 'error',
    config: 'error',
    infra: 'error',
    test: 'info',
    sample: 'info',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },
  'secret-api-key': {
    app: 'error',
    config: 'error',
    infra: 'error',
    test: 'info',
    sample: 'info',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },
  'secret-token': {
    app: 'error',
    config: 'error',
    infra: 'error',
    test: 'info',
    sample: 'info',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },
  'secret-aws-key': {
    app: 'error',
    config: 'error',
    infra: 'error',
    test: 'info',
    sample: 'info',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },
  'secret-connection-string': {
    app: 'error',
    config: 'error',
    infra: 'error',
    test: 'info',
    sample: 'info',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },

  // ─── Security: PII logging ───
  'pii-credential-logging': {
    app: 'error',
    config: 'error',
    infra: 'error',
    test: 'warning',
    sample: 'warning',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },
  'pii-national-id-logging': {
    app: 'error',
    config: 'error',
    infra: 'error',
    test: 'warning',
    sample: 'warning',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },
  'pii-credit-card-logging': {
    app: 'error',
    config: 'error',
    infra: 'error',
    test: 'warning',
    sample: 'warning',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },

  // ─── Security: weak crypto ───
  'weak-crypto-hash': {
    app: 'warning',
    config: 'warning',
    infra: 'warning',
    test: 'info',
    sample: 'info',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },
  'weak-crypto-random': {
    app: 'warning',
    config: 'warning',
    infra: 'warning',
    test: 'info',
    sample: 'info',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },

  // ─── Code quality: console.log / debugger ───
  'console-log': {
    app: 'warning',
    config: 'warning',
    infra: 'warning',
    test: 'info',
    sample: 'suppressed',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },
  'debugger-statement': {
    app: 'warning',
    config: 'warning',
    infra: 'warning',
    test: 'info',
    sample: 'suppressed',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },
  'print-statement': {
    app: 'warning',
    config: 'warning',
    infra: 'warning',
    test: 'info',
    sample: 'suppressed',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },

  // ─── TODO / FIXME ───
  'todo-comment': {
    app: 'info',
    config: 'info',
    infra: 'info',
    test: 'info',
    sample: 'suppressed',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },
  'todo-marker': {
    app: 'info',
    config: 'info',
    infra: 'info',
    test: 'info',
    sample: 'suppressed',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },

  // ─── Dangerous code: eval / innerHTML ───
  'eval-usage': {
    app: 'warning',
    config: 'warning',
    infra: 'warning',
    test: 'warning',
    sample: 'warning',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },
  'innerhtml-usage': {
    app: 'warning',
    config: 'warning',
    infra: 'warning',
    test: 'info',
    sample: 'info',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },
  'code-execution': {
    app: 'warning',
    config: 'warning',
    infra: 'warning',
    test: 'warning',
    sample: 'warning',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },

  // ─── AI slop patterns ───
  'ai-boilerplate': {
    app: 'warning',
    config: 'warning',
    infra: 'warning',
    test: 'info',
    sample: 'suppressed',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },
  'verbose-comment': {
    app: 'info',
    config: 'info',
    infra: 'info',
    test: 'info',
    sample: 'suppressed',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },
  'generic-variable': {
    app: 'info',
    config: 'info',
    infra: 'info',
    test: 'info',
    sample: 'suppressed',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },
  'repetitive-comment': {
    app: 'info',
    config: 'info',
    infra: 'info',
    test: 'info',
    sample: 'suppressed',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },
  'ai-todo': {
    app: 'warning',
    config: 'warning',
    infra: 'warning',
    test: 'info',
    sample: 'suppressed',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },
  'placeholder-copyright': {
    app: 'error',
    config: 'error',
    infra: 'error',
    test: 'info',
    sample: 'info',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },
  'llm-placeholder': {
    app: 'high',
    config: 'high',
    infra: 'high',
    test: 'info',
    sample: 'info',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  } as any, // 'high' maps to 'error' via normalize

  // ─── Empty catch / broad catch ───
  'empty-catch': {
    app: 'warning',
    config: 'warning',
    infra: 'warning',
    test: 'info',
    sample: 'info',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },
  'broad-catch': {
    app: 'info',
    config: 'info',
    infra: 'info',
    test: 'info',
    sample: 'info',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },

  // ─── SSL / auth / CORS ─── (security — keep high in app, downshift in test)
  'ssl-disabled': {
    app: 'warning',
    config: 'warning',
    infra: 'warning',
    test: 'info',
    sample: 'info',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },
  'auth-disabled': {
    app: 'warning',
    config: 'warning',
    infra: 'warning',
    test: 'info',
    sample: 'info',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },
  'wildcard-cors': {
    app: 'warning',
    config: 'warning',
    infra: 'warning',
    test: 'info',
    sample: 'info',
    docs: 'suppressed',
    generated: 'suppressed',
    vendor: 'suppressed',
  },
};

/**
 * Normalize severity strings to the canonical set.
 */
function normalizeSeverity(sev: string): 'error' | 'warning' | 'info' {
  const lower = sev.toLowerCase();
  if (lower === 'critical' || lower === 'error' || lower === 'high') return 'error';
  if (lower === 'warning' || lower === 'medium') return 'warning';
  return 'info';
}

/**
 * Calibrate the severity of a finding based on the file's role.
 *
 * @param issueType The rule type (e.g. 'hardcoded-password', 'console-log')
 * @param originalSeverity The severity before calibration
 * @param fileRole The classified role of the file
 * @returns SeverityDecision with the calibrated severity and reason
 */
export function calibrateSeverity(
  issueType: string,
  originalSeverity: 'error' | 'warning' | 'info',
  fileRole: FileRole
): SeverityDecision {
  const matrix = SEVERITY_MATRIX[issueType];

  // If no matrix entry for this rule type, use default behavior:
  // - app/config/infra: keep original severity
  // - test: downshift one level (error→warning, warning→info, info→info)
  // - sample/docs/generated/vendor: suppress
  if (!matrix) {
    if (fileRole === 'app' || fileRole === 'config' || fileRole === 'infra') {
      return {
        severity: originalSeverity,
        reason: 'production role — original severity retained',
        originalSeverity,
      };
    }
    if (fileRole === 'test') {
      const downshifted: Severity =
        originalSeverity === 'error' ? 'warning' : originalSeverity === 'warning' ? 'info' : 'info';
      return {
        severity: downshifted,
        reason: 'test role — severity downshifted one level',
        originalSeverity,
      };
    }
    // sample, docs, generated, vendor
    return {
      severity: 'suppressed',
      reason: `${fileRole} role — finding suppressed (not production code)`,
      originalSeverity,
    };
  }

  // Use the matrix
  const calibrated = matrix[fileRole];
  if (!calibrated) {
    // No specific entry for this role — keep original
    return {
      severity: originalSeverity,
      reason: 'no matrix entry for this role — original severity retained',
      originalSeverity,
    };
  }

  if (calibrated === 'suppressed') {
    return {
      severity: 'suppressed',
      reason: `${fileRole} role — finding suppressed by severity matrix`,
      originalSeverity,
    };
  }

  // Normalize matrix severity (handles 'high' → 'error' etc.)
  const normalized = normalizeSeverity(calibrated as string);
  const reason =
    normalized === originalSeverity
      ? `${fileRole} role — severity retained`
      : `${fileRole} role — severity ${originalSeverity} → ${normalized}`;

  return {
    severity: normalized,
    reason,
    originalSeverity,
  };
}
