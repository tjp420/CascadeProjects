'use strict';

const {
  IMPACT_BY_KIND,
  DEFAULT_RECIPES,
  ESTIMATED_MINUTES_BY_KIND,
  BUSINESS_IMPACT_BY_KIND,
  GATE_BLOCKING_KINDS,
  FIX_SPEC_VERSION,
  SEVERITY_ORDER
} = require('../audit-remediation-recipes/data.cjs');

describe('audit-remediation-recipes/data', () => {
  test('IMPACT_BY_KIND has entries for all major kinds', () => {
    expect(IMPACT_BY_KIND.credentials).toBeDefined();
    expect(IMPACT_BY_KIND['production-leak']).toBeDefined();
    expect(IMPACT_BY_KIND['debug-artifact']).toBeDefined();
    expect(IMPACT_BY_KIND.general).toBeDefined();
  });

  test('DEFAULT_RECIPES has entries for all major kinds', () => {
    expect(DEFAULT_RECIPES.credentials).toBeDefined();
    expect(DEFAULT_RECIPES['production-leak']).toBeDefined();
    expect(DEFAULT_RECIPES.general).toBeDefined();
  });

  test('ESTIMATED_MINUTES_BY_KIND has numeric values', () => {
    expect(typeof ESTIMATED_MINUTES_BY_KIND.credentials).toBe('number');
    expect(ESTIMATED_MINUTES_BY_KIND.credentials).toBeGreaterThan(0);
    expect(ESTIMATED_MINUTES_BY_KIND.general).toBeGreaterThan(0);
  });

  test('BUSINESS_IMPACT_BY_KIND has entries', () => {
    expect(BUSINESS_IMPACT_BY_KIND.credentials).toBeDefined();
    expect(BUSINESS_IMPACT_BY_KIND.general).toBeDefined();
  });

  test('GATE_BLOCKING_KINDS contains credentials and production-leak', () => {
    expect(GATE_BLOCKING_KINDS.has('credentials')).toBe(true);
    expect(GATE_BLOCKING_KINDS.has('production-leak')).toBe(true);
  });

  test('FIX_SPEC_VERSION is a number', () => {
    expect(typeof FIX_SPEC_VERSION).toBe('number');
  });

  test('SEVERITY_ORDER has expected ordering', () => {
    expect(SEVERITY_ORDER.critical).toBeLessThan(SEVERITY_ORDER.high);
    expect(SEVERITY_ORDER.high).toBeLessThan(SEVERITY_ORDER.medium);
    expect(SEVERITY_ORDER.medium).toBeLessThan(SEVERITY_ORDER.low);
  });
});
