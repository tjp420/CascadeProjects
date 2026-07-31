'use strict';

const fs = require('fs');
const path = require('path');

const EGRESS_POLICY_PATH =
  process.env.EGRESS_POLICY_PATH ||
  path.join(process.cwd(), '.simplebeacon', 'egress-policies.json');

let _cache = null;
let _cacheDirty = true;

function readStore() {
  if (_cache && !_cacheDirty) return _cache;
  try {
    const raw = fs.readFileSync(EGRESS_POLICY_PATH, 'utf8');
    _cache = JSON.parse(raw);
    if (!_cache.policies || !Array.isArray(_cache.policies)) {
      _cache = { policies: [] };
    }
  } catch {
    _cache = { policies: [] };
  }
  _cacheDirty = false;
  return _cache;
}

function writeStore(store) {
  const dir = path.dirname(EGRESS_POLICY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = EGRESS_POLICY_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmp, EGRESS_POLICY_PATH);
  _cache = store;
  _cacheDirty = false;
}

function generateId() {
  return 'egress-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function validateRegex(pattern, flags) {
  if (!pattern || typeof pattern !== 'string') {
    return { valid: false, error: 'Pattern is required' };
  }
  try {
    new RegExp(pattern, flags || '');
    return { valid: true, error: null };
  } catch (err) {
    return { valid: false, error: 'Invalid regex: ' + err.message };
  }
}

function getPolicies(orgId, enabledOnly) {
  const store = readStore();
  return store.policies.filter(
    (p) => p.orgId === orgId && (!enabledOnly || p.enabled)
  );
}

function getPolicy(id) {
  const store = readStore();
  return store.policies.find((p) => p.id === id) || null;
}

function createPolicy(params) {
  const orgId = params.orgId;
  const name = params.name;
  const description = params.description;
  const pattern = params.pattern;
  const flags = params.flags || 'gi';
  const category = params.category;
  const action = params.action;
  const severity = params.severity;
  const replacement = params.replacement;
  const enabled = params.enabled;

  if (!orgId) return { success: false, error: 'orgId is required' };
  if (!name || typeof name !== 'string') return { success: false, error: 'name is required' };

  const validation = validateRegex(pattern, flags);
  if (!validation.valid) return { success: false, error: validation.error };

  const validCategories = ['leak', 'malicious'];
  const cat = validCategories.includes(category) ? category : 'leak';

  const validActions = ['block', 'flag'];
  const act = validActions.includes(action) ? action : 'flag';

  const validSeverities = ['high', 'medium', 'low'];
  const sev = validSeverities.includes(severity) ? severity : 'medium';

  const store = readStore();
  const now = new Date().toISOString();
  const policy = {
    id: generateId(),
    orgId: orgId,
    name: name.trim(),
    description: (description || '').trim(),
    pattern: pattern,
    flags: flags,
    category: cat,
    action: act,
    severity: sev,
    replacement: replacement || '',
    enabled: enabled !== false,
    createdAt: now,
    updatedAt: now,
  };

  store.policies.push(policy);
  writeStore(store);
  return { success: true, policy: policy };
}

function updatePolicy(id, updates) {
  const store = readStore();
  const idx = store.policies.findIndex((p) => p.id === id);
  if (idx === -1) return { success: false, error: 'Policy not found' };

  const policy = store.policies[idx];

  if (updates.pattern !== undefined) {
    const validation = validateRegex(updates.pattern, updates.flags || policy.flags);
    if (!validation.valid) return { success: false, error: validation.error };
  }

  if (updates.severity !== undefined) {
    const validSeverities = ['high', 'medium', 'low'];
    if (!validSeverities.includes(updates.severity)) {
      return { success: false, error: 'Invalid severity' };
    }
  }

  if (updates.category !== undefined) {
    const validCategories = ['leak', 'malicious'];
    if (!validCategories.includes(updates.category)) {
      return { success: false, error: 'Invalid category' };
    }
  }

  if (updates.action !== undefined) {
    const validActions = ['block', 'flag'];
    if (!validActions.includes(updates.action)) {
      return { success: false, error: 'Invalid action' };
    }
  }

  const updated = Object.assign({}, policy, updates, {
    updatedAt: new Date().toISOString(),
  });

  store.policies[idx] = updated;
  writeStore(store);
  return { success: true, policy: updated };
}

function deletePolicy(id) {
  const store = readStore();
  const idx = store.policies.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  store.policies.splice(idx, 1);
  writeStore(store);
  return true;
}

function getCompiledPatterns(orgId) {
  const policies = getPolicies(orgId, true);
  const compiled = [];
  for (const p of policies) {
    try {
      const regex = new RegExp(p.pattern, p.flags);
      compiled.push({
        id: p.id,
        name: p.name,
        regex: regex,
        category: p.category,
        action: p.action,
        severity: p.severity,
        replacement: p.replacement,
        description: p.description,
      });
    } catch {
      // Skip invalid patterns
    }
  }
  return compiled;
}

function scanEgress(text, orgId) {
  if (!text || typeof text !== 'string') {
    return { verdict: 'allow', text: text || '', matches: [], summary: 'No content to scan' };
  }

  const patterns = getCompiledPatterns(orgId);
  if (patterns.length === 0) {
    return { verdict: 'allow', text: text, matches: [], summary: 'No egress policies configured' };
  }

  const matches = [];
  let scannedText = text;
  let shouldBlock = false;

  for (const p of patterns) {
    try {
      const regex = new RegExp(p.regex.source, p.regex.flags);
      if (regex.test(scannedText)) {
        matches.push({
          id: p.id,
          name: p.name,
          category: p.category,
          action: p.action,
          severity: p.severity,
          desc: p.description || p.name,
        });

        if (p.action === 'block') {
          shouldBlock = true;
        }

        if (p.replacement) {
          scannedText = scannedText.replace(
            new RegExp(p.regex.source, p.regex.flags),
            p.replacement
          );
        }
      }
    } catch {
      // Skip invalid patterns
    }
  }

  let verdict = 'allow';
  let summary = 'No egress violations detected';

  if (shouldBlock) {
    verdict = 'block';
    const blockReasons = matches
      .filter((m) => m.action === 'block')
      .map((m) => m.desc);
    summary = 'Outbound content blocked: ' + blockReasons.join('; ');
  } else if (matches.length > 0) {
    verdict = 'flag';
    summary = 'Outbound content flagged: ' + matches.map((m) => m.desc).join(', ');
  }

  return { verdict: verdict, text: scannedText, matches: matches, summary: summary };
}

function getStats(orgId) {
  const policies = getPolicies(orgId);
  const byCategory = { leak: 0, malicious: 0 };
  const byAction = { block: 0, flag: 0 };
  const bySeverity = { high: 0, medium: 0, low: 0 };
  let enabled = 0;
  for (const p of policies) {
    byCategory[p.category] = (byCategory[p.category] || 0) + 1;
    byAction[p.action] = (byAction[p.action] || 0) + 1;
    bySeverity[p.severity] = (bySeverity[p.severity] || 0) + 1;
    if (p.enabled) enabled++;
  }
  return {
    totalPolicies: policies.length,
    enabledPolicies: enabled,
    byCategory: byCategory,
    byAction: byAction,
    bySeverity: bySeverity,
  };
}

module.exports = {
  getPolicies: getPolicies,
  getPolicy: getPolicy,
  createPolicy: createPolicy,
  updatePolicy: updatePolicy,
  deletePolicy: deletePolicy,
  getCompiledPatterns: getCompiledPatterns,
  scanEgress: scanEgress,
  getStats: getStats,
  validateRegex: validateRegex,
  EGRESS_POLICY_PATH: EGRESS_POLICY_PATH,
};
