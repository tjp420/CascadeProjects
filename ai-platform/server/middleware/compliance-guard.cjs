const { getActivePolicy } = require("../lib/policy-syncer.cjs");
let auditLogger;
try {
  auditLogger = require("../lib/audit-logger.cjs");
} catch (_) {
  auditLogger = null;
}

/**
 * Global or router-level gatekeeper that stops transactions violating active tenant blueprints.
 */
function enforceCompliancePolicy() {
  return async (req, res, next) => {
    // Extract multi-tenant metadata established by upstream authorization layers
    const orgId = req.resolvedOrgId || (req.user && req.user.orgId);
    if (!orgId) return next();

    const activePolicy = getActivePolicy(orgId);
    if (!activePolicy || !Array.isArray(activePolicy.rules)) return next();

    for (const rule of activePolicy.rules) {
      if (rule.effect === "DENY" && rule.condition) {
        const { field, operator, value } = rule.condition;

        // Simple condition extractor mapping dotted headers
        if (
          field === "req.headers.x-dlp-token" &&
          operator === "EXISTS" &&
          value === false
        ) {
          const hasToken =
            req.headers && req.headers["x-dlp-token"] !== undefined;

          if (!hasToken) {
            // Immutable forensic trace logging via native logger module
            if (auditLogger && typeof auditLogger.log === "function") {
              try {
                auditLogger.log({
                  orgId,
                  actorId: req.user?.id || "anonymous::client",
                  action: "compliance_policy_violation",
                  entity: "policy_system",
                  entityId: rule.ruleId,
                  metadata: {
                    policyId: activePolicy.policyId,
                    ruleId: rule.ruleId,
                    remediation: rule.remediation,
                  },
                });
              } catch (e) {
                // swallow logging errors to avoid affecting request flow
                console.warn(
                  "[policy-guard] auditLogger.log failed",
                  e && e.message,
                );
              }
            }

            return res.status(403).json({
              success: false,
              error: "compliance_policy_violation",
              ruleId: rule.ruleId,
              message: rule.remediation,
            });
          }
        }
      }
    }

    next();
  };
}

module.exports = {
  enforceCompliancePolicy,
};
