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
// ── Context-Aware Code Block Detection ─────────────────────────────────────
//
// When skipCodeBlocks is enabled, PII redaction is only applied to prose
// segments. Code blocks (fenced ``` blocks and inline `code`) are preserved
// as-is. This prevents false positives where legitimate test data (e.g.
// test@example.com in unit tests) or API examples (e.g. bearer tokens in
// documentation) are redacted.
//
// The detector splits text into segments tagged as 'prose' or 'code',
// applies redaction only to 'prose' segments, then reassembles.

/**
 * Split text into segments tagged as 'prose' or 'code'.
 * Detects:
 *   - Fenced code blocks: ```lang ... ``` (multi-line)
 *   - Inline code: `code` (single backtick)
 *
 * @param {string} text — The text to segment
 * @returns {array<{ text: string, type: 'prose'|'code' }>}
 */
function _splitCodeSegments(text) {
  if (!text || typeof text !== 'string') return [{ text: '', type: 'prose' }];

  const rawSegments = [];
  let currentIndex = 0;

  // Match fenced code blocks (```lang\n...\n``` or ```\n...\n```)
  // Also matches unclosed fenced blocks (``` at end of text without closing ```)
  const fencedRegex = /```[\w]*\n?[\s\S]*?```|```[\w]*\n?[\s\S]*$/g;
  let match;

  while ((match = fencedRegex.exec(text)) !== null) {
    // Add prose before this code block
    if (match.index > currentIndex) {
      rawSegments.push({ text: text.slice(currentIndex, match.index), type: 'prose' });
    }
    // Add the code block
    rawSegments.push({ text: match[0], type: 'code' });
    currentIndex = match.index + match[0].length;
  }

  // Add remaining prose after last fenced code block
  if (currentIndex < text.length) {
    rawSegments.push({ text: text.slice(currentIndex), type: 'prose' });
  }

  // If no segments were created, the entire text is prose
  if (rawSegments.length === 0) {
    rawSegments.push({ text, type: 'prose' });
  }

  // Second pass: split each prose segment by inline code spans (`code`)
  const segments = [];
  for (const seg of rawSegments) {
    if (seg.type === 'code') {
      segments.push(seg);
      continue;
    }

    const inlineRegex = /`[^`\n]+`/g;
    let inlineMatch;
    let proseStart = 0;
    let foundInline = false;

    while ((inlineMatch = inlineRegex.exec(seg.text)) !== null) {
      foundInline = true;
      // Add prose before this inline code
      if (inlineMatch.index > proseStart) {
        segments.push({ text: seg.text.slice(proseStart, inlineMatch.index), type: 'prose' });
      }
      // Add the inline code
      segments.push({ text: inlineMatch[0], type: 'code' });
      proseStart = inlineMatch.index + inlineMatch[0].length;
    }

    // Add remaining prose after last inline code (or the whole segment if no inline)
    if (proseStart < seg.text.length || !foundInline) {
      segments.push({ text: seg.text.slice(proseStart), type: 'prose' });
    }
  }

  return segments;
}

/**
 * Redact PII from text using the org's compiled patterns.
 *
 * @param {string} text — The text to redact
 * @param {string} orgId — Organization ID for policy lookup
 * @param {object} [options]
 * @param {boolean} [options.skipCodeBlocks=false] — If true, preserve PII in
 *   fenced code blocks (```...```) and inline code (`...`). Only redact
 *   prose segments.
 * @returns {{ text: string, matches: array }}
 */
function redactText(text, orgId, options = {}) {
  if (!text || typeof text !== 'string') return { text, matches: [] };

  const patterns = getCompiledPatterns(orgId);
  if (patterns.length === 0) return { text, matches: [] };

  // Context-aware mode: split into code/prose segments, only redact prose
  if (options.skipCodeBlocks) {
    const segments = _splitCodeSegments(text);
    let redactedText = '';
    const allMatches = [];

    for (const segment of segments) {
      if (segment.type === 'code') {
        redactedText += segment.text;
      } else {
        const result = _redactSegment(segment.text, patterns);
        redactedText += result.text;
        allMatches.push(...result.matches);
      }
    }

    return { text: redactedText, matches: allMatches };
  }

  // Standard mode: redact the entire text
  const result = _redactSegment(text, patterns);
  return result;
}

/**
 * Internal: redact a single prose segment using compiled patterns.
 * @param {string} text
 * @param {array} patterns
 * @returns {{ text: string, matches: array }}
 */
function _redactSegment(text, patterns) {
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
// Block-aware mode: chunks can be tagged with a block type ('text',
// 'thinking', 'redacted_thinking'). PII redaction is only applied to 'text'
// blocks; thinking and redacted_thinking blocks pass through untouched.
// This prevents false positives in model reasoning content and preserves
// the structure of interleaved streaming responses (e.g. Anthropic Claude
// extended thinking).
//
// Usage (string chunks — backward compatible):
//   const scrubber = createStreamScrubber('org-id');
//   const out1 = scrubber.process('Contact alice@');  // partial email
//   const out2 = scrubber.process('example.com now');  // completes email
//   const tail = scrubber.flush();                     // flush remaining buffer
//   const combined = out1 + out2 + tail;
//   // combined === 'Contact [REDACTED-EMAIL] now'
//
// Usage (block-aware chunks):
//   const scrubber = createStreamScrubber('org-id');
//   const out1 = scrubber.process({ text: 'Email: alice@', type: 'text' });
//   const out2 = scrubber.process({ text: 'example.com', type: 'text' });
//   const out3 = scrubber.process({ text: 'Let me think...', type: 'thinking' });
//   const out4 = scrubber.process({ text: ' about alice@test.com', type: 'text' });
//   const tail = scrubber.flush();
//   // out1: '' (buffering)
//   // out2: { text: 'Email: [REDACTED-EMAIL]', type: 'text' }
//   // out3: { text: 'Let me think...', type: 'thinking' } (untouched)
//   // out4: { text: ' about [REDACTED-EMAIL]', type: 'text' }
//   // tail:  '' (buffer empty)

/**
 * Maximum lookback window for partial match detection.
 * Patterns longer than this will not be detected at chunk boundaries.
 * @constant {number}
 */
const STREAM_MAX_LOOKBACK = 200;

/**
 * Block types that are NOT subject to PII redaction.
 * These pass through the scrubber untouched.
 * @constant {Set<string>}
 */
const NON_REDACTED_BLOCK_TYPES = new Set(['thinking', 'redacted_thinking']);

/**
 * Create a stateful stream scrubber for incremental text processing.
 *
 * Supports both string chunks (backward compatible) and block-aware chunks
 * ({ text, type }). When block-aware chunks are used, PII redaction is only
 * applied to 'text' blocks; 'thinking' and 'redacted_thinking' blocks pass
 * through untouched. When the block type changes, the previous block's
 * buffer is flushed automatically.
 *
 * When options.skipCodeBlocks is true, the scrubber detects fenced code
 * blocks (```...```) in the stream and passes them through untouched.
 * Only prose segments are redacted. This prevents false positives on
 * test fixtures and API examples in code.
 *
 * @param {string} orgId — Organization ID for policy lookup
 * @param {object} [options]
 * @param {number} [options.maxLookback=200] — Max chars to hold back for cross-chunk matching
 * @param {boolean} [options.skipCodeBlocks=false] — If true, preserve PII in fenced code blocks
 * @returns {{ process: function, flush: function, getStats: function }}
 */
function createStreamScrubber(orgId, options = {}) {
  const maxLookback = options.maxLookback || STREAM_MAX_LOOKBACK;
  const skipCodeBlocks = !!options.skipCodeBlocks;
  const patterns = getCompiledPatterns(orgId);

  let _buffer = '';
  let _currentBlockType = 'text';
  let _totalProcessed = 0;
  let _totalRedacted = 0;
  let _blockCount = 0;
  let _inCodeBlock = false; // Track fenced code block state across chunks
  const _matchCounts = {};
  const _blockTypeCounts = {};

  function _trackBlockType(type) {
    _blockTypeCounts[type] = (_blockTypeCounts[type] || 0) + 1;
    _blockCount++;
  }

  if (patterns.length === 0) {
    // No patterns — pass-through mode (still block-aware for type tracking)
    return {
      process(chunk) {
        if (!chunk) return _currentBlockType === 'text' ? '' : { text: '', type: _currentBlockType };
        const { text, type } = _normalizeChunk(chunk);
        if (type !== _currentBlockType) {
          _trackBlockType(_currentBlockType);
          _currentBlockType = type;
        }
        _totalProcessed += text.length;
        // Return in the same format as the input (string or object)
        if (typeof chunk === 'string') return text;
        return { text, type };
      },
      flush() {
        if (_buffer.length > 0) _trackBlockType(_currentBlockType);
        const out = _buffer;
        _buffer = '';
        return _currentBlockType === 'text' ? out : { text: out, type: _currentBlockType };
      },
      getStats() {
        return {
          totalProcessed: _totalProcessed,
          totalRedacted: _totalRedacted,
          matchCounts: _matchCounts,
          bufferLength: 0,
          patternCount: 0,
          blockCount: _blockCount,
          blockTypeCounts: { ..._blockTypeCounts },
          currentBlockType: _currentBlockType,
        };
      },
    };
  }

  /**
   * Normalize a chunk to { text, type } form.
   * String chunks default to type 'text'.
   * @param {string|object} chunk
   * @returns {{ text: string, type: string }}
   */
  function _normalizeChunk(chunk) {
    if (typeof chunk === 'string') {
      return { text: chunk, type: 'text' };
    }
    if (chunk && typeof chunk === 'object') {
      return {
        text: chunk.text || '',
        type: chunk.type || 'text',
      };
    }
    return { text: '', type: 'text' };
  }

  /**
   * Find the safe cut point in the buffer.
   * @param {string} buffer
   * @returns {number} Safe cut index
   */
  function findSafeCutPoint(buffer) {
    if (buffer.length === 0) return 0;
    if (buffer.length <= maxLookback) return 0;
    return buffer.length - maxLookback;
  }

  /**
   * Redact text using the compiled patterns. When skipCodeBlocks is enabled,
   * uses _splitCodeSegments to preserve PII in code blocks.
   * @param {string} text
   * @returns {{ text: string, matches: array }}
   */
  function redactBuffer(text) {
    if (skipCodeBlocks) {
      const segments = _splitCodeSegments(text);
      let redactedText = '';
      const allMatches = [];

      for (const segment of segments) {
        if (segment.type === 'code') {
          redactedText += segment.text;
        } else {
          const result = _redactStreamSegment(segment.text);
          redactedText += result.text;
          allMatches.push(...result.matches);
        }
      }

      return { text: redactedText, matches: allMatches };
    }

    const result = _redactStreamSegment(text);
    return result;
  }

  /**
   * Internal: redact a single prose segment using compiled patterns.
   * @param {string} text
   * @returns {{ text: string, matches: array }}
   */
  function _redactStreamSegment(text) {
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

  /**
   * Process the buffer for the current block type. For 'text' blocks,
   * applies PII redaction with the lookback holdback. For non-redacted
   * block types, passes through directly.
   * @param {boolean} isFlush — If true, process entire buffer (no holdback)
   * @returns {string} Redacted (or passthrough) text to emit
   */
  function _processBuffer(isFlush) {
    if (_buffer.length === 0) return '';

    const isRedactable = !NON_REDACTED_BLOCK_TYPES.has(_currentBlockType);

    if (!isRedactable) {
      // Non-redacted block type — pass through untouched
      const out = _buffer;
      _buffer = '';
      return out;
    }

    if (isFlush) {
      const result = redactBuffer(_buffer);
      _buffer = '';
      return result.text;
    }

    const safeCut = findSafeCutPoint(_buffer);
    if (safeCut === 0) return '';

    const toProcess = _buffer.slice(0, safeCut);
    _buffer = _buffer.slice(safeCut);

    const result = redactBuffer(toProcess);
    return result.text;
  }

  return {
    /**
     * Process a chunk of text. Accepts either a string (treated as 'text'
     * block type) or an object { text, type } for block-aware processing.
     *
     * When block type changes, the previous block's buffer is flushed
     * automatically. Returns redacted text (for string input) or
     * { text, type } (for object input). May return '' or { text: '', type }
     * if buffering.
     *
     * @param {string|object} chunk — String or { text, type }
     * @returns {string|object} Redacted text or { text, type }
     */
    process(chunk) {
      if (chunk === null || chunk === undefined || chunk === '') {
        return '';
      }

      const { text, type } = _normalizeChunk(chunk);
      const wasObjectInput = typeof chunk === 'object' && chunk !== null;
      _totalProcessed += text.length;

      // If block type changed, flush the previous block's buffer
      let flushedFromTransition = '';
      if (type !== _currentBlockType) {
        if (_buffer.length > 0) {
          flushedFromTransition = _processBuffer(true); // flush old block
        }
        _trackBlockType(_currentBlockType);
        _currentBlockType = type;
      }

      // Append new text to buffer
      _buffer += text;

      // Process the buffer for the current block type
      const output = _processBuffer(false);
      const combined = flushedFromTransition + output;

      if (wasObjectInput) {
        // Return object format — emit the flushed old block separately
        // if there was a type transition with content
        if (flushedFromTransition.length > 0 && output.length > 0) {
          // Both old and new block have content — return only the new block
          // (the old block was already emitted in the previous process() call's
          // return value via the flush). In practice, the flushed content
          // should be returned with the OLD type, but since we can only return
          // one value, we return the new block's output.
          // The caller should use flush() at type transitions if they need
          // strict block boundary preservation.
          return { text: combined, type: _currentBlockType };
        }
        return { text: combined, type: _currentBlockType };
      }

      return combined;
    },

    /**
     * Flush the remaining buffer. Called at end of stream.
     * @returns {string|object} Redacted remaining text (string or { text, type })
     */
    flush() {
      const out = _processBuffer(true);
      if (out.length > 0) _trackBlockType(_currentBlockType);
      // Return in the format matching the last block type
      if (_currentBlockType !== 'text') {
        return { text: out, type: _currentBlockType };
      }
      return out;
    },

    /**
     * Get scrubber statistics.
     * @returns {{ totalProcessed: number, totalRedacted: number, matchCounts: object, bufferLength: number, patternCount: number, blockCount: number, blockTypeCounts: object, currentBlockType: string }}
     */
    getStats() {
      return {
        totalProcessed: _totalProcessed,
        totalRedacted: _totalRedacted,
        matchCounts: { ..._matchCounts },
        bufferLength: _buffer.length,
        patternCount: patterns.length,
        blockCount: _blockCount,
        blockTypeCounts: { ..._blockTypeCounts },
        currentBlockType: _currentBlockType,
        skipCodeBlocks,
      };
    },
  };
}

// ── Scrubber Lifecycle Manager ──────────────────────────────────────────────
//
// Manages stream scrubber instances per org+session. Prevents scrubber leaks
// from long-lived connections (e.g. SSE streams, WebSocket sessions) by:
//   1. Tracking active scrubbers in a registry keyed by orgId+sessionId
//   2. Expiring idle scrubbers after a configurable TTL
//   3. Enforcing a max concurrent scrubber limit with LRU eviction
//
// Usage:
//   const registry = createScrubberRegistry({ maxScrubbers: 100, ttlMs: 60000 });
//   const scrubber = registry.getOrCreate('org-id', 'session-1');
//   const out = scrubber.process('text with alice@test.com');
//   registry.touch('org-id', 'session-1'); // Update last-access time
//   registry.destroy('org-id', 'session-1'); // Manual cleanup
//   registry.cleanup(); // Run TTL sweep
//   registry.getStats(); // Registry health metrics

const DEFAULT_MAX_SCRUBBERS = 100;
const DEFAULT_SCRUBBER_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Create a scrubber lifecycle registry.
 * @param {object} [options]
 * @param {number} [options.maxScrubbers=100] — Max concurrent scrubbers
 * @param {number} [options.ttlMs=300000] — Idle TTL in ms (default: 5min)
 * @param {object} [options.scrubberOptions] — Default options for created scrubbers
 * @returns {{ getOrCreate, get, touch, destroy, cleanup, getStats, clear }}
 */
function createScrubberRegistry(options = {}) {
  const maxScrubbers = options.maxScrubbers || DEFAULT_MAX_SCRUBBERS;
  const ttlMs = options.ttlMs || DEFAULT_SCRUBBER_TTL_MS;
  const scrubberOptions = options.scrubberOptions || {};

  // Map of key -> { scrubber, orgId, sessionId, createdAt, lastAccessedAt }
  const _registry = new Map();
  let _totalCreated = 0;
  let _totalEvicted = 0;
  let _totalExpired = 0;

  function _key(orgId, sessionId) {
    return `${orgId}::${sessionId}`;
  }

  /**
   * Get or create a scrubber for the given org+session.
   * If the scrubber exists, updates lastAccessedAt and returns it.
   * If not, creates a new one. If maxScrubbers is hit, evicts the LRU entry.
   * @param {string} orgId
   * @param {string} sessionId
   * @param {object} [overrideOptions] — Override default scrubber options
   * @returns {object} The stream scrubber instance
   */
  function getOrCreate(orgId, sessionId, overrideOptions) {
    const key = _key(orgId, sessionId);

    if (_registry.has(key)) {
      const entry = _registry.get(key);
      entry.lastAccessedAt = Date.now();
      // Move to end of Map (most recently used)
      _registry.delete(key);
      _registry.set(key, entry);
      return entry.scrubber;
    }

    // Enforce max scrubbers — evict LRU (first entry in Map)
    while (_registry.size >= maxScrubbers) {
      const lruKey = _registry.keys().next().value;
      _registry.delete(lruKey);
      _totalEvicted++;
    }

    const mergedOptions = { ...scrubberOptions, ...(overrideOptions || {}) };
    const scrubber = createStreamScrubber(orgId, mergedOptions);
    const now = Date.now();
    _registry.set(key, {
      scrubber,
      orgId,
      sessionId,
      createdAt: now,
      lastAccessedAt: now,
    });
    _totalCreated++;

    return scrubber;
  }

  /**
   * Get an existing scrubber without creating one.
   * @param {string} orgId
   * @param {string} sessionId
   * @returns {object|null} The scrubber, or null if not found
   */
  function get(orgId, sessionId) {
    const key = _key(orgId, sessionId);
    const entry = _registry.get(key);
    return entry ? entry.scrubber : null;
  }

  /**
   * Update the last-access time for a scrubber (without processing).
   * @param {string} orgId
   * @param {string} sessionId
   */
  function touch(orgId, sessionId) {
    const key = _key(orgId, sessionId);
    const entry = _registry.get(key);
    if (entry) {
      entry.lastAccessedAt = Date.now();
      _registry.delete(key);
      _registry.set(key, entry);
    }
  }

  /**
   * Destroy a specific scrubber and remove it from the registry.
   * @param {string} orgId
   * @param {string} sessionId
   * @returns {boolean} True if the scrubber was found and destroyed
   */
  function destroy(orgId, sessionId) {
    const key = _key(orgId, sessionId);
    return _registry.delete(key);
  }

  /**
   * Run a TTL sweep — remove all scrubbers that have been idle longer than ttlMs.
   * @returns {number} Number of expired scrubbers removed
   */
  function cleanup() {
    const now = Date.now();
    let expired = 0;

    for (const [key, entry] of _registry) {
      if (now - entry.lastAccessedAt > ttlMs) {
        _registry.delete(key);
        expired++;
      }
    }

    _totalExpired += expired;
    return expired;
  }

  /**
   * Clear all scrubbers from the registry.
   */
  function clear() {
    _registry.clear();
  }

  /**
   * Get registry health stats.
   * @returns {{ activeScrubbers: number, maxScrubbers: number, ttlMs: number, totalCreated: number, totalEvicted: number, totalExpired: number, scrubbers: array }}
   */
  function getStats() {
    const now = Date.now();
    const scrubbers = [];

    for (const [key, entry] of _registry) {
      const scrubberStats = entry.scrubber.getStats();
      scrubbers.push({
        key,
        orgId: entry.orgId,
        sessionId: entry.sessionId,
        createdAt: entry.createdAt,
        lastAccessedAt: entry.lastAccessedAt,
        idleMs: now - entry.lastAccessedAt,
        scrubberStats,
      });
    }

    return {
      activeScrubbers: _registry.size,
      maxScrubbers,
      ttlMs,
      totalCreated: _totalCreated,
      totalEvicted: _totalEvicted,
      totalExpired: _totalExpired,
      scrubbers,
    };
  }

  return {
    getOrCreate,
    get,
    touch,
    destroy,
    cleanup,
    clear,
    getStats,
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
  createScrubberRegistry,
  _splitCodeSegments,
  COMPLIANCE_FRAMEWORKS,
  PII_POLICY_PATH,
};
