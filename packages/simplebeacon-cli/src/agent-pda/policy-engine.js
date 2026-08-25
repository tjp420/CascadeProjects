"use strict";

/**
 * Agent PDA — Policy Engine
 *
 * Reads .simplebeacon/policies.json and enforces rules.
 * Policies are the human-defined guardrails that agents must follow.
 */

const fs = require("fs");
const path = require("path");
const { atomicWriteFileSync } = require("../lib/atomic-writer");

const POLICY_TYPES = [
  "forbidden_action",
  "required_check",
  "approval_required",
];

const DEFAULT_POLICIES = [
  {
    id: "default-no-secrets",
    type: "forbidden_action",
    action: "commit-secrets",
    description: "Never commit secrets, API keys, passwords, or tokens",
    severity: "block",
    enabled: true,
  },
  {
    id: "default-no-force-push",
    type: "forbidden_action",
    action: "force-push",
    description: "Never force-push to main/develop branches",
    severity: "block",
    enabled: true,
  },
  {
    id: "default-must-scan",
    type: "required_check",
    action: "finalize-changes",
    description: "Run SimpleBeacon gate scan before claiming work is done",
    severity: "block",
    checkCommand: "npx simplebeacon scan --gate --offline",
    enabled: true,
  },
  {
    id: "default-must-test",
    type: "required_check",
    action: "finalize-changes",
    description: "Run tests before claiming work is done",
    severity: "warn",
    checkCommand: "npm test",
    enabled: false,
  },
  {
    id: "default-approval-delete",
    type: "approval_required",
    action: "delete-files",
    description: "Human approval required before deleting files",
    severity: "block",
    enabled: false,
  },
  {
    id: "default-approval-deploy",
    type: "approval_required",
    action: "deploy",
    description: "Human approval required before deploying",
    severity: "block",
    enabled: false,
  },
];

function getPoliciesPath(projectRoot) {
  return path.join(
    projectRoot || process.cwd(),
    ".simplebeacon",
    "policies.json",
  );
}

/**
 * Load policies from .simplebeacon/policies.json.
 * Falls back to built-in defaults if file doesn't exist.
 * @param {string} projectRoot
 * @returns {object} { policies: [], source: 'file'|'defaults' }
 */
function loadPolicies(projectRoot) {
  const policiesPath = getPoliciesPath(projectRoot);
  try {
    const raw = fs.readFileSync(policiesPath, "utf8");
    const data = JSON.parse(raw);
    const policies = Array.isArray(data.policies) ? data.policies : [];
    return { policies, source: "file" };
  } catch {
    return { policies: DEFAULT_POLICIES, source: "defaults" };
  }
}

/**
 * Save policies to .simplebeacon/policies.json.
 */
function savePolicies(projectRoot, policies) {
  const policiesPath = getPoliciesPath(projectRoot);
  const data = { policies, version: 1, updatedAt: Date.now() };
  atomicWriteFileSync(policiesPath, JSON.stringify(data, null, 2));
  return data;
}

/**
 * Check if an action is allowed under the current policies.
 * @param {string} projectRoot
 * @param {string} action — the action to check (e.g. 'force-push', 'delete-files', 'finalize-changes')
 * @param {object} context — optional context (e.g. { branch: 'main', files: [...] })
 * @returns {object} { allowed, violations, warnings, approvalsNeeded }
 */
function checkAction(projectRoot, action, context = {}) {
  const { policies } = loadPolicies(projectRoot);
  const enabled = policies.filter((p) => p.enabled !== false);

  const violations = [];
  const warnings = [];
  const approvalsNeeded = [];

  for (const policy of enabled) {
    // Match by action or by action pattern
    if (!matchesAction(policy, action, context)) continue;

    if (policy.type === "forbidden_action") {
      if (policy.severity === "block") {
        violations.push({
          policyId: policy.id,
          action: policy.action,
          description: policy.description,
          severity: "block",
        });
      } else {
        warnings.push({
          policyId: policy.id,
          action: policy.action,
          description: policy.description,
          severity: "warn",
        });
      }
    } else if (policy.type === "approval_required") {
      // Check if already approved in context
      if (!context.approved) {
        approvalsNeeded.push({
          policyId: policy.id,
          action: policy.action,
          description: policy.description,
          severity: policy.severity || "block",
        });
      }
    } else if (policy.type === "required_check") {
      // Required checks are warnings unless we can verify them
      // The gate bridge handles actual check execution
      if (policy.severity === "block") {
        violations.push({
          policyId: policy.id,
          action: policy.action,
          description: policy.description,
          severity: "block",
          checkCommand: policy.checkCommand,
        });
      } else {
        warnings.push({
          policyId: policy.id,
          action: policy.action,
          description: policy.description,
          severity: "warn",
          checkCommand: policy.checkCommand,
        });
      }
    }
  }

  const blocked = violations.length > 0;
  const needsApproval = approvalsNeeded.length > 0;
  const allowed = !blocked && !needsApproval;

  return {
    allowed,
    violations,
    warnings,
    approvalsNeeded,
    blocked,
    needsApproval,
  };
}

function matchesAction(policy, action, context) {
  // Exact match
  if (policy.action === action) return true;

  // Wildcard matching — supports:
  // - Prefix: "delete-*" matches "delete-files", "delete-folders"
  // - Suffix: "*-secrets" matches "commit-secrets", "leak-secrets"
  // - Middle: "delete-*-files" matches "delete-old-files", "delete-temp-files"
  // - Full: "*" matches everything
  if (policy.action && policy.action.includes("*")) {
    if (policy.action === "*") return true;

    // Convert glob pattern to regex: escape regex chars, replace * with .*
    const regexStr = policy.action
      .replace(/[.+^${}()|[\]\\]/g, "\\$&") // escape regex special chars
      .replace(/\*/g, ".*"); // convert * to .*
    const regex = new RegExp("^" + regexStr + "$");
    if (regex.test(action)) return true;
  }

  // Check context.branch for branch-specific policies
  if (context.branch && policy.branch) {
    if (Array.isArray(policy.branch) && policy.branch.includes(context.branch))
      return true;
    if (typeof policy.branch === "string" && policy.branch === context.branch)
      return true;
  }
  return false;
}

/**
 * List all policies (enabled and disabled).
 */
function listPolicies(projectRoot) {
  const { policies, source } = loadPolicies(projectRoot);
  return { policies, source };
}

/**
 * Add a policy.
 */
function addPolicy(projectRoot, policy) {
  const { policies } = loadPolicies(projectRoot);
  if (!POLICY_TYPES.includes(policy.type)) {
    throw new Error(
      `Invalid policy type: ${policy.type}. Must be one of: ${POLICY_TYPES.join(", ")}`,
    );
  }
  if (!policy.id) policy.id = "policy_" + Date.now();
  if (!policy.enabled) policy.enabled = true;
  policies.push(policy);
  savePolicies(projectRoot, policies);
  return policy;
}

/**
 * Remove a policy by ID.
 */
function removePolicy(projectRoot, policyId) {
  const { policies } = loadPolicies(projectRoot);
  const filtered = policies.filter((p) => p.id !== policyId);
  if (filtered.length === policies.length) return false;
  savePolicies(projectRoot, filtered);
  return true;
}

/**
 * Enable/disable a policy.
 */
function togglePolicy(projectRoot, policyId, enabled) {
  const { policies } = loadPolicies(projectRoot);
  const idx = policies.findIndex((p) => p.id === policyId);
  if (idx < 0) return null;
  policies[idx].enabled = enabled;
  savePolicies(projectRoot, policies);
  return policies[idx];
}

/**
 * Initialize policies.json with defaults.
 */
function initPolicies(projectRoot, force = false) {
  const policiesPath = getPoliciesPath(projectRoot);
  if (!force && fs.existsSync(policiesPath)) {
    return { created: false, policies: loadPolicies(projectRoot).policies };
  }
  savePolicies(projectRoot, DEFAULT_POLICIES);
  return { created: true, policies: DEFAULT_POLICIES };
}

module.exports = {
  loadPolicies,
  savePolicies,
  checkAction,
  listPolicies,
  addPolicy,
  removePolicy,
  togglePolicy,
  initPolicies,
  POLICY_TYPES,
  DEFAULT_POLICIES,
  _getPoliciesPath: getPoliciesPath,
};
