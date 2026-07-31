const { test } = require('node:test');
const assert = require('node:assert');

/**
 * Mirrors the confidence-threshold logic used in the VS Code extension realtime monitor.
 * Numeric floors keep the rule engine deterministic and comparable across presets.
 *
 * @param {string} preset - 'default' | 'ai-only' | 'low-noise'
 * @param {string} manualThreshold - 'low' | 'medium' | 'high'
 * @param {number} [fallbackMinConfidence] - numeric fallback when manualThreshold is unknown
 * @returns {number} effective minimum confidence floor
 */
function getEffectiveMinConfidence(
  preset,
  manualThreshold = 'medium',
  fallbackMinConfidence = 0.6
) {
  const thresholdMap = {
    low: 0.4,
    medium: 0.6,
    high: 0.85,
  };

  if (preset === 'low-noise') {
    return 0.85;
  }

  return thresholdMap[manualThreshold] ?? fallbackMinConfidence;
}

/**
 * Filters a list of rules to those meeting or exceeding the confidence floor.
 *
 * @param {Array<{id: string, confidence?: number}>} rules
 * @param {number} minConfidence
 * @returns {Array<{id: string, confidence?: number}>}
 */
function filterRulesByConfidence(rules, minConfidence) {
  return rules.filter((rule) => (rule.confidence ?? 0) >= minConfidence);
}

test('low-noise preset forces a high (0.85) confidence floor regardless of manual threshold', () => {
  assert.strictEqual(getEffectiveMinConfidence('low-noise', 'low'), 0.85);
  assert.strictEqual(getEffectiveMinConfidence('low-noise', 'medium'), 0.85);
  assert.strictEqual(getEffectiveMinConfidence('low-noise', 'high'), 0.85);
});

test('default and ai-only presets fall back to the manual threshold configuration', () => {
  assert.strictEqual(getEffectiveMinConfidence('default', 'low'), 0.4);
  assert.strictEqual(getEffectiveMinConfidence('default', 'medium'), 0.6);
  assert.strictEqual(getEffectiveMinConfidence('default', 'high'), 0.85);

  assert.strictEqual(getEffectiveMinConfidence('ai-only', 'low'), 0.4);
  assert.strictEqual(getEffectiveMinConfidence('ai-only', 'medium'), 0.6);
  assert.strictEqual(getEffectiveMinConfidence('ai-only', 'high'), 0.85);
});

test('unknown manual threshold falls back to the provided numeric default', () => {
  assert.strictEqual(getEffectiveMinConfidence('default', 'unknown', 0.5), 0.5);
});

test('filterRulesByConfidence keeps only rules at or above the floor', () => {
  const sampleRules = [
    { id: 'SB-FICTION-001', confidence: 0.85 },
    { id: 'SB-FICTION-002', confidence: 0.4 },
    { id: 'SB-FICTION-003', confidence: 0.6 },
    { id: 'SB-FICTION-004', confidence: 0.55 },
  ];

  const highConfidenceOnly = filterRulesByConfidence(sampleRules, 0.85);
  assert.strictEqual(highConfidenceOnly.length, 1);
  assert.strictEqual(highConfidenceOnly[0].id, 'SB-FICTION-001');

  const mediumAndAbove = filterRulesByConfidence(sampleRules, 0.6);
  assert.strictEqual(mediumAndAbove.length, 2);
  assert.deepStrictEqual(
    mediumAndAbove.map((r) => r.id),
    ['SB-FICTION-001', 'SB-FICTION-003']
  );
});

test('rules without a confidence property are treated as zero confidence and filtered out', () => {
  const rules = [{ id: 'no-confidence' }, { id: 'low-confidence', confidence: 0.4 }];
  const filtered = filterRulesByConfidence(rules, 0.6);
  assert.strictEqual(filtered.length, 0);
});
