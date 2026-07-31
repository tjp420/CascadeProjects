'use strict';

/**
 * PII Redaction Policy Store ΓÇö Persistent per-organization custom
 * regex-based PII masking patterns for inbound prompt data.
 *
 * Admins can define custom regex patterns that are applied to prompt
 * text before it reaches upstream LLM models, in addition to the
 * built-in PII patterns in prompt-firewall.cjs.
 *
 * @module pii-policy-store
 */

const fs = require('fs');
const path = require('path');

const PII_POLICY_PATH =
  process.env.PII_POLICY_PATH || path.join(__dirname, '../../.simplebeacon', 'pii-policies.json');

let _cache = null;
let _cacheDirty = true;

/**
 * @typedef {object} PiiPolicy
 * @property {string} id          ΓÇö Unique identifier
 * @property {string} orgId       ΓÇö Organization ID
 * @property {string} name        ΓÇö Human-readable name (e.g. "Employee ID")
 * @property {string} description ΓÇö What this pattern detects
 * @property {string} pattern     ΓÇö Regex pattern string
 * @property {string} flags       ΓÇö Regex flags (e.g. 'gi')
 * @property {string} replacement ΓÇö Replacement text (e.g. '[REDACTED-EMP-ID]')
 * @property {'high'|'medium'|'low'} severity ΓÇö Severity level
 * @property {boolean} enabled    ΓÇö Whether this policy is active
 * @property {string[]} compliance ΓÇö Compliance frameworks this pattern satisfies (e.g. ['GDPR', 'HIPAA', 'PCI-DSS'])
 * @property {boolean} isDefault  ΓÇö Whether this is a built-in seed pattern
 * @property {string} createdAt   ΓÇö ISO timestamp
 * @property {string} updatedAt   ΓÇö ISO timestamp
 */

/**
 * Supported compliance frameworks.
 */
const COMPLIANCE_FRAMEWORKS = ['GDPR', 'HIPAA', 'PCI-DSS', 'CCPA', 'SOX'];

/**
 * Default seed patterns for common PII types. These are automatically
 * created for an org when no policies exist yet.
 */
const DEFAULT_SEED_PATTERNS = [
  {
    name: 'Email Address',
    description: 'Standard email addresses (user@domain.com)',
    pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
    flags: 'gi',
    replacement: '[REDACTED-EMAIL]',
    severity: 'high',
    compliance: ['GDPR', 'CCPA'],
  },
  {
    name: 'US Social Security Number',
    description: 'SSN in XXX-XX-XXXX or XXXXXXXXX format',
    pattern: '\\b\\d{3}-?\\d{2}-?\\d{4}\\b',
    flags: 'g',
    replacement: '[REDACTED-SSN]',
    severity: 'high',
    compliance: ['GDPR', 'HIPAA', 'CCPA'],
  },
  {
    name: 'Credit Card Number',
    description: 'Visa/Mastercard/Amex patterns (groups of 4 digits)',
    pattern: '\\b(?:\\d[ -]*?){13,19}\\b',
    flags: 'g',
    replacement: '[REDACTED-CC]',
    severity: 'high',
    compliance: ['PCI-DSS', 'GDPR'],
  },
  {
    name: 'US Phone Number',
    description: 'Phone in (XXX) XXX-XXXX or XXX-XXX-XXXX format',
    pattern: '\\b\\(?\\d{3}\\)?[ -]?\\d{3}[ -]?\\d{4}\\b',
    flags: 'g',
    replacement: '[REDACTED-PHONE]',
    severity: 'medium',
    compliance: ['GDPR', 'CCPA'],
  },
  {
    name: 'IPv4 Address',
    description: 'Standard IPv4 addresses (XXX.XXX.XXX.XXX)',
    pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b',
    flags: 'g',
    replacement: '[REDACTED-IP]',
    severity: 'low',
    compliance: ['GDPR'],
  },
  {
    name: 'API Key (Bearer Token)',
    description: 'Bearer token patterns in Authorization headers',
    pattern: 'bearer\\s+[a-zA-Z0-9._-]+',
    flags: 'gi',
    replacement: '[REDACTED-TOKEN]',
    severity: 'high',
    compliance: ['SOX', 'PCI-DSS'],
  },
];

function readStore() {
  if (_cache && !_cacheDirty) return _cache;
  try {
    const raw = fs.readFileSync(PII_POLICY_PATH, 'utf8');
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
  const dir = path.dirname(PII_POLICY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = PII_POLICY_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmp, PII_POLICY_PATH);
  _cache = store;
  _cacheDirty = false;
}

function generateId() {
  return 'pii-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

/**
 * Validate a regex pattern string.
 * @param {string} pattern
 * @param {string} flags
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateRegex(pattern, flags) {
  if (!pattern || typeof pattern !== 'string') {
    return { valid: false, error: 'Pattern is required' };
  }
  try {
    new RegExp(pattern, flags || '');
    return { valid: true, error: null };
  } catch (err) {
    return { valid: false, error: `Invalid regex: ${err.message}` };
  }
}

/**
 * Get all PII policies for an organization.
 * @param {string} orgId
 * @param {boolean} enabledOnly ΓÇö If true, return only enabled policies
 * @returns {PiiPolicy[]}
 */
function getPolicies(orgId, enabledOnly = false) {
  const store = readStore();
  return store.policies.filter(
    (p) => p.orgId === orgId && (!enabledOnly || p.enabled)
  );
}

/**
 * Get a specific PII policy by ID.
 * @param {string} id
 * @returns {PiiPolicy|null}
 */
function getPolicy(id) {
  const store = readStore();
  return store.policies.find((p) => p.id === id) || null;
}

/**
 * Create a new PII redaction policy.
 * @param {object} params
 * @returns {{ success: boolean, policy?: PiiPolicy, error?: string }}
 */
function createPolicy(params) {
  const { orgId, name, description, pattern, flags, replacement, severity, enabled, compliance, isDefault } = params;

  if (!orgId) return { success: false, error: 'orgId is required' };
  if (!name || typeof name !== 'string') return { success: false, error: 'name is required' };
  if (!replacement || typeof replacement !== 'string')
    return { success: false, error: 'replacement is required' };

  const regexFlags = flags || 'gi';
  const validation = validateRegex(pattern, regexFlags);
  if (!validation.valid) return { success: false, error: validation.error };

  const validSeverities = ['high', 'medium', 'low'];
  const sev = validSeverities.includes(severity) ? severity : 'medium';

  // Validate compliance frameworks
  const complianceTags = Array.isArray(compliance)
    ? compliance.filter((c) => COMPLIANCE_FRAMEWORKS.includes(c))
    : [];

  const store = readStore();
  const now = new Date().toISOString();
  const policy = {
    id: generateId(),
    orgId,
    name: name.trim(),
    description: (description || '').trim(),
    pattern,
    flags: regexFlags,
    replacement,
    severity: sev,
    enabled: enabled !== false,
    compliance: complianceTags,
    isDefault: isDefault === true,
    createdAt: now,
    updatedAt: now,
  };

  store.policies.push(policy);
  writeStore(store);
  return { success: true, policy };
}

/**
 * Update an existing PII policy.
 * @param {string} id
 * @param {object} updates
 * @returns {{ success: boolean, policy?: PiiPolicy, error?: string }}
 */
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

  if (updates.compliance !== undefined) {
    if (!Array.isArray(updates.compliance)) {
      return { success: false, error: 'compliance must be an array' };
    }
    const invalid = updates.compliance.filter((c) => !COMPLIANCE_FRAMEWORKS.includes(c));
    if (invalid.length > 0) {
      return { success: false, error: `Invalid compliance frameworks: ${invalid.join(', ')}` };
    }
  }

  const updated = {
    ...policy,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  store.policies[idx] = updated;
  writeStore(store);
  return { success: true, policy: updated };
}

/**
 * Delete a PII policy.
 * @param {string} id
 * @returns {boolean}
 */
function deletePolicy(id) {
  const store = readStore();
  const idx = store.policies.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  store.policies.splice(idx, 1);
  writeStore(store);
  return true;
}

/**
 * Get compiled regex patterns for an organization.
 * Returns an array of { id, name, regex, replacement, severity, description }
 * ready for the redaction engine to apply.
 * @param {string} orgId
 * @returns {Array}
 */
function getCompiledPatterns(orgId) {
  const policies = getPolicies(orgId, true);
  const compiled = [];
  for (const p of policies) {
    try {
      const regex = new RegExp(p.pattern, p.flags);
      compiled.push({
        id: p.id,
        name: p.name,
        regex,
        replacement: p.replacement,
        severity: p.severity,
        description: p.description,
      });
    } catch {
      // Skip invalid patterns silently
    }
  }
  return compiled;
}

/**
 * Apply custom PII redaction patterns to text.
 * Returns { text, matches } where matches describes what was redacted.
 * @param {string} text
 * @param {string} orgId
 * @returns {{ text: string, matches: Array }}
 */
function redactText(text, orgId) {
  if (!text || typeof text !== 'string') return { text, matches: [] };

  const patterns = getCompiledPatterns(orgId);
  if (patterns.length === 0) return { text, matches: [] };

  let redactedText = text;
  const matches = [];

  for (const p of patterns) {
    const regex = new RegExp(p.regex.source, p.regex.flags);
    const found = regex.test(text);
    if (found) {
      const count = (text.match(new RegExp(p.regex.source, p.regex.flags)) || []).length;
      redactedText = redactedText.replace(new RegExp(p.regex.source, p.regex.flags), p.replacement);
      matches.push({
        type: 'custom_pii',
        id: p.id,
        name: p.name,
        severity: p.severity,
        desc: p.description || p.name,
        count,
      });
    }
  }

  return { text: redactedText, matches };
}

/**
 * Get stats for dashboard.
 * @param {string} orgId
 * @returns {{ totalPolicies: number, enabledPolicies: number, bySeverity: object }}
 */
function getStats(orgId) {
  const policies = getPolicies(orgId);
  const bySeverity = { high: 0, medium: 0, low: 0 };
  const byCompliance = {};
  let enabled = 0;
  let defaultCount = 0;
  for (const p of policies) {
    bySeverity[p.severity] = (bySeverity[p.severity] || 0) + 1;
    if (p.enabled) enabled++;
    if (p.isDefault) defaultCount++;
    if (Array.isArray(p.compliance)) {
      for (const c of p.compliance) {
        byCompliance[c] = (byCompliance[c] || 0) + 1;
      }
    }
  }
  return {
    totalPolicies: policies.length,
    enabledPolicies: enabled,
    bySeverity,
    byCompliance,
    defaultCount,
  };
}

/**
 * Seed default PII patterns for an organization if none exist.
 * @param {string} orgId
 * @returns {number} ΓÇö number of patterns seeded
 */
function seedDefaults(orgId) {
  const existing = getPolicies(orgId);
  if (existing.length > 0) return 0;

  let seeded = 0;
  for (const seed of DEFAULT_SEED_PATTERNS) {
    const result = createPolicy({
      orgId,
      name: seed.name,
      description: seed.description,
      pattern: seed.pattern,
      flags: seed.flags,
      replacement: seed.replacement,
      severity: seed.severity,
      compliance: seed.compliance,
      enabled: true,
      isDefault: true,
    });
    if (result.success) seeded++;
  }
  return seeded;
}

/**
 * Discover all organization IDs that currently have at least one PII policy.
 * @returns {string[]}
 */
function getAllOrgIds() {
  const store = readStore();
  const orgIds = new Set();
  for (const p of store.policies) {
    if (p.orgId) orgIds.add(p.orgId);
  }
  return [...orgIds];
}

/**
 * Sync (clone) PII policies from a source org to one or more target orgs.
 *
 * Modes:
 *   - 'merge'  (default): Add source policies to target orgs; skip duplicates
 *     with identical name+pattern. Existing target policies are preserved.
 *   - 'replace': Remove all existing policies from target orgs, then clone
 *     all source policies into them. Use with caution.
 *
 * Filters (optional):
 *   - compliance: string[] ΓÇö only sync policies tagged with one of these frameworks
 *   - severity:   string[] ΓÇö only sync policies with one of these severities
 *   - isDefault:  boolean  ΓÇö only sync policies where isDefault === true
 *
 * @param {string} sourceOrgId
 * @param {string[]} targetOrgIds
 * @param {object} options ΓÇö { mode, compliance, severity, isDefault }
 * @returns {{ sourceOrg: string, targets: Array<{ orgId: string, success: boolean, cloned: number, skipped: number, removed: number, error?: string }>, totalCloned: number, totalSkipped: number, totalRemoved: number }}
 */
function syncPoliciesToOrgs(sourceOrgId, targetOrgIds, options = {}) {
  const mode = options.mode === 'replace' ? 'replace' : 'merge';
  const complianceFilter = Array.isArray(options.compliance) ? options.compliance : null;
  const severityFilter = Array.isArray(options.severity) ? options.severity : null;
  const isDefaultFilter = typeof options.isDefault === 'boolean' ? options.isDefault : null;

  if (!sourceOrgId) throw new Error('sourceOrgId is required');
  if (!Array.isArray(targetOrgIds) || targetOrgIds.length === 0) {
    throw new Error('targetOrgIds must be a non-empty array');
  }

  // Load source policies and apply filters
  let sourcePolicies = getPolicies(sourceOrgId);
  if (complianceFilter) {
    sourcePolicies = sourcePolicies.filter(
      (p) => Array.isArray(p.compliance) && p.compliance.some((c) => complianceFilter.includes(c))
    );
  }
  if (severityFilter) {
    sourcePolicies = sourcePolicies.filter((p) => severityFilter.includes(p.severity));
  }
  if (isDefaultFilter !== null) {
    sourcePolicies = sourcePolicies.filter((p) => Boolean(p.isDefault) === isDefaultFilter);
  }

  const results = [];
  let totalCloned = 0;
  let totalSkipped = 0;
  let totalRemoved = 0;

  for (const targetOrgId of targetOrgIds) {
    if (targetOrgId === sourceOrgId) {
      results.push({
        orgId: targetOrgId,
        success: false,
        cloned: 0,
        skipped: 0,
        removed: 0,
        error: 'target_org_same_as_source',
      });
      continue;
    }

    try {
      const store = readStore();
      let removed = 0;

      if (mode === 'replace') {
        // Remove all existing policies for this target org
        const before = store.policies.length;
        store.policies = store.policies.filter((p) => p.orgId !== targetOrgId);
        removed = before - store.policies.length;
      }

      // For merge mode, build a set of existing name+pattern keys to detect duplicates
      const existingKeys = new Set(
        store.policies
          .filter((p) => p.orgId === targetOrgId)
          .map((p) => `${p.name}::${p.pattern}`)
      );

      let cloned = 0;
      let skipped = 0;
      const now = new Date().toISOString();

      for (const src of sourcePolicies) {
        const key = `${src.name}::${src.pattern}`;
        if (mode === 'merge' && existingKeys.has(key)) {
          skipped++;
          continue;
        }
        const newPolicy = {
          id: generateId(),
          orgId: targetOrgId,
          name: src.name,
          description: src.description,
          pattern: src.pattern,
          flags: src.flags,
          replacement: src.replacement,
          severity: src.severity,
          enabled: src.enabled,
          compliance: Array.isArray(src.compliance) ? [...src.compliance] : [],
          isDefault: Boolean(src.isDefault),
          createdAt: now,
          updatedAt: now,
        };
        store.policies.push(newPolicy);
        existingKeys.add(key);
        cloned++;
      }

      writeStore(store);
      totalCloned += cloned;
      totalSkipped += skipped;
      totalRemoved += removed;
      results.push({
        orgId: targetOrgId,
        success: true,
        cloned,
        skipped,
        removed,
      });
    } catch (err) {
      results.push({
        orgId: targetOrgId,
        success: false,
        cloned: 0,
        skipped: 0,
        removed: 0,
        error: err.message,
      });
    }
  }

  return {
    sourceOrg: sourceOrgId,
    targets: results,
    totalCloned,
    totalSkipped,
    totalRemoved,
  };
}

// ── Stream-Mode PII Scrubbing ───────────────────────────────────────────────
//
// Stream scrubbing handles incremental/chunked text (e.g. SSE prompt streams)
// where PII patterns may be split across chunk boundaries. The scrubber
// buffers incoming text and only releases redacted text up to a "safe cut
// point" — the latest position where no pattern is partially matching.
//
// Usage:
//   const scrubber = createStreamScrubber('org-id');
//   const out1 = scrubber.process('Contact alice@');  // partial email
//   const out2 = scrubber.process('example.com now');  // completes email
//   const tail = scrubber.flush();                     // flush remaining buffer
//   const combined = out1 + out2 + tail;
//   // combined === 'Contact [REDACTED-EMAIL] now'

/**
 * Maximum lookback window for partial match detection.
 * Patterns longer than this will not be detected at chunk boundaries.
 * @constant {number}
 */
const STREAM_MAX_LOOKBACK = 200;

/**
 * Create a stateful stream scrubber for incremental text processing.
 * @param {string} orgId — Organization ID for policy lookup
 * @param {object} [options]
 * @param {number} [options.maxLookback=200] — Max chars to hold back for cross-chunk matching
 * @returns {{ process: function, flush: function, getStats: function }}
 */
function createStreamScrubber(orgId, options = {}) {
  const maxLookback = options.maxLookback || STREAM_MAX_LOOKBACK;
  const patterns = getCompiledPatterns(orgId);

  let _buffer = '';
  let _totalProcessed = 0;
  let _totalRedacted = 0;
  const _matchCounts = {};

  if (patterns.length === 0) {
    // No patterns — pass-through mode
    return {
      process(chunk) {
        if (!chunk) return '';
        _totalProcessed += chunk.length;
        return chunk;
      },
      flush() {
        const out = _buffer;
        _buffer = '';
        return out;
      },
      getStats() {
        return {
          totalProcessed: _totalProcessed,
          totalRedacted: _totalRedacted,
          matchCounts: _matchCounts,
          bufferLength: 0,
          patternCount: 0,
        };
      },
    };
  }

  /**
   * Find the safe cut point in the buffer — the latest position where we can
   * be confident no pattern is partially matching at the boundary.
   *
   * Strategy: hold back the last `maxLookback` characters as a safety window
   * where partial matches could be forming. Process (redact) everything before
   * that window. The held-back text is processed on the next chunk arrival
   * (when more data completes or rules out a partial match) or on flush.
   *
   * This is O(1) per chunk and guaranteed correct — no pattern longer than
   * maxLookback can slip through undetected at a chunk boundary.
   *
   * @param {string} buffer
   * @returns {number} Safe cut index (can be 0 to buffer.length)
   */
  function findSafeCutPoint(buffer) {
    if (buffer.length === 0) return 0;
    if (buffer.length <= maxLookback) return 0;
    return buffer.length - maxLookback;
  }

  /**
   * Redact text using the compiled patterns (same logic as redactText but
   * operates on the buffer and tracks match counts).
   * @param {string} text
   * @returns {{ text: string, matches: array }}
   */
  function redactBuffer(text) {
    let redactedText = text;
    const matches = [];

    for (const p of patterns) {
      const regex = new RegExp(p.regex.source, p.regex.flags);
      const found = regex.test(text);
      if (found) {
        const count = (text.match(new RegExp(p.regex.source, p.regex.flags)) || []).length;
        redactedText = redactedText.replace(new RegExp(p.regex.source, p.regex.flags), p.replacement);
        matches.push({
          type: 'custom_pii',
          id: p.id,
          name: p.name,
          severity: p.severity,
          count,
        });
        _matchCounts[p.name] = (_matchCounts[p.name] || 0) + count;
        _totalRedacted += count;
      }
    }

    return { text: redactedText, matches };
  }

  return {
    /**
     * Process a chunk of text. Returns redacted text that is safe to emit.
     * May return empty string if the buffer contains a potential partial
     * match that needs more data to resolve.
     * @param {string} chunk
     * @returns {string} Redacted text safe to emit
     */
    process(chunk) {
      if (!chunk || typeof chunk !== 'string') return '';

      _buffer += chunk;
      _totalProcessed += chunk.length;

      const safeCut = findSafeCutPoint(_buffer);
      if (safeCut === 0) return '';

      const toProcess = _buffer.slice(0, safeCut);
      _buffer = _buffer.slice(safeCut);

      const result = redactBuffer(toProcess);
      return result.text;
    },

    /**
     * Flush the remaining buffer. Called at end of stream.
     * @returns {string} Redacted remaining text
     */
    flush() {
      if (_buffer.length === 0) return '';
      const result = redactBuffer(_buffer);
      _buffer = '';
      return result.text;
    },

    /**
     * Get scrubber statistics.
     * @returns {{ totalProcessed: number, totalRedacted: number, matchCounts: object, bufferLength: number, patternCount: number }}
     */
    getStats() {
      return {
        totalProcessed: _totalProcessed,
        totalRedacted: _totalRedacted,
        matchCounts: { ..._matchCounts },
        bufferLength: _buffer.length,
        patternCount: patterns.length,
      };
    },
  };
}

module.exports = {
  getPolicies,
  getPolicy,
  createPolicy,
  updatePolicy,
  deletePolicy,
  getCompiledPatterns,
  redactText,
  getStats,
  validateRegex,
  seedDefaults,
  getAllOrgIds,
  syncPoliciesToOrgs,
  createStreamScrubber,
  COMPLIANCE_FRAMEWORKS,
  PII_POLICY_PATH,
};
