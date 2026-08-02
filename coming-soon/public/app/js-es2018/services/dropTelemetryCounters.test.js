// simplebeacon-ignore: Test fixtures — all findings are false positives
/**
 * Tests for drop telemetry counters.
 * Verifies that counters increment correctly and reset properly.
 */

import { getDropTelemetry, resetDropTelemetry, incrementDropCounter } from '../services/dropTelemetryCounters.js';

describe('Drop Telemetry Counters', () => {
  beforeEach(() => {
    resetDropTelemetry();
  });

  test('getDropTelemetry returns all expected fields with zero defaults', () => {
    const counters = getDropTelemetry();
    expect(counters).toEqual({
      totalDrops: 0,
      totalFilesDropped: 0,
      preReadSuccess: 0,
      preReadSkipped: 0,
      preReadFailed: 0,
      traversalErrors: 0,
      firefoxBypassUsed: 0,
    });
  });

  test('incrementDropCounter increments the specified counter', () => {
    incrementDropCounter('totalDrops');
    incrementDropCounter('totalDrops');
    incrementDropCounter('preReadSuccess', 5);

    const counters = getDropTelemetry();
    expect(counters.totalDrops).toBe(2);
    expect(counters.preReadSuccess).toBe(5);
  });

  test('incrementDropCounter ignores unknown keys', () => {
    incrementDropCounter('unknownKey', 10);

    const counters = getDropTelemetry();
    expect(counters.unknownKey).toBeUndefined();
  });

  test('resetDropTelemetry resets all counters to zero', () => {
    incrementDropCounter('totalDrops', 3);
    incrementDropCounter('preReadSuccess', 5);
    incrementDropCounter('traversalErrors', 2);

    resetDropTelemetry();

    const counters = getDropTelemetry();
    expect(counters.totalDrops).toBe(0);
    expect(counters.preReadSuccess).toBe(0);
    expect(counters.traversalErrors).toBe(0);
  });

  test('getDropTelemetry returns a copy, not a reference', () => {
    const counters1 = getDropTelemetry();
    counters1.totalDrops = 999;

    const counters2 = getDropTelemetry();
    expect(counters2.totalDrops).toBe(0);
  });

  test('incrementDropCounter with default amount increments by 1', () => {
    incrementDropCounter('firefoxBypassUsed');
    incrementDropCounter('firefoxBypassUsed');

    const counters = getDropTelemetry();
    expect(counters.firefoxBypassUsed).toBe(2);
  });
});
