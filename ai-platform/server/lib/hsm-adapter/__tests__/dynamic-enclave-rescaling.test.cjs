'use strict';

/**
 * Track 49: Dynamic Enclave Rescaling and Predictive Load Balancing tests.
 */
const {
  DynamicEnclaveRescaler,
  DEFAULT_OPTIONS,
  SCALE_ACTION,
  SCALE_STATUS,
} = require('../dynamic-enclave-rescaling.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

describe('Track 49: DynamicEnclaveRescaler', () => {
  let rescaler;

  beforeEach(() => {
    rescaler = new DynamicEnclaveRescaler({
      minEnclaves: 2,
      maxEnclaves: 10,
      scaleUpThreshold: 0.85,
      scaleDownThreshold: 0.3,
      cooldownPeriodMs: 0, // no cooldown for testing
      rebalanceThreshold: 0.2,
      forecastAlgorithm: 'moving-average',
    });
  });

  describe('registerEnclave', () => {
    test('registers an enclave', () => {
      rescaler.registerEnclave('e1');
      const enclaves = rescaler.getEnclaves();
      expect(enclaves.length).toBe(1);
      expect(enclaves[0].id).toBe('e1');
      expect(enclaves[0].capacity).toBe(1);
    });

    test('registers with custom capacity', () => {
      rescaler.registerEnclave('e1', { capacity: 5 });
      const enclaves = rescaler.getEnclaves();
      expect(enclaves[0].capacity).toBe(5);
    });

    test('rejects empty ID', () => {
      expect(() => rescaler.registerEnclave('')).toThrow(HsmAdapterError);
    });

    test('rejects duplicate', () => {
      rescaler.registerEnclave('e1');
      expect(() => rescaler.registerEnclave('e1')).toThrow(HsmAdapterError);
    });

    test('enforces max enclaves', () => {
      const small = new DynamicEnclaveRescaler({ minEnclaves: 1, maxEnclaves: 2 });
      small.registerEnclave('e1');
      small.registerEnclave('e2');
      expect(() => small.registerEnclave('e3')).toThrow(HsmAdapterError);
    });
  });

  describe('unregisterEnclave', () => {
    test('removes an enclave', () => {
      rescaler.registerEnclave('e1');
      rescaler.unregisterEnclave('e1');
      expect(rescaler.getEnclaves().length).toBe(0);
    });

    test('rejects unknown enclave', () => {
      expect(() => rescaler.unregisterEnclave('unknown')).toThrow(HsmAdapterError);
    });
  });

  describe('recordLoad', () => {
    test('records a load sample', () => {
      rescaler.registerEnclave('e1');
      rescaler.recordLoad('e1', 0.5);
      const history = rescaler.getLoadHistory('e1');
      expect(history.length).toBe(1);
      expect(history[0].load).toBe(0.5);
    });

    test('rejects unknown enclave', () => {
      expect(() => rescaler.recordLoad('unknown', 0.5)).toThrow(HsmAdapterError);
    });

    test('rejects invalid load value', () => {
      rescaler.registerEnclave('e1');
      expect(() => rescaler.recordLoad('e1', -0.1)).toThrow(HsmAdapterError);
      expect(() => rescaler.recordLoad('e1', 1.5)).toThrow(HsmAdapterError);
      expect(() => rescaler.recordLoad('e1', 'high')).toThrow(HsmAdapterError);
    });

    test('trims history to configured size', () => {
      const small = new DynamicEnclaveRescaler({ loadHistorySize: 3 });
      small.registerEnclave('e1');
      small.recordLoad('e1', 0.1);
      small.recordLoad('e1', 0.2);
      small.recordLoad('e1', 0.3);
      small.recordLoad('e1', 0.4);
      const history = small.getLoadHistory('e1');
      expect(history.length).toBe(3);
      expect(history[0].load).toBe(0.2);
    });
  });

  describe('getAverageLoad', () => {
    test('returns average across active enclaves', () => {
      rescaler.registerEnclave('e1');
      rescaler.registerEnclave('e2');
      rescaler.recordLoad('e1', 0.4);
      rescaler.recordLoad('e2', 0.6);
      expect(rescaler.getAverageLoad()).toBeCloseTo(0.5);
    });

    test('returns 0 when no enclaves', () => {
      expect(rescaler.getAverageLoad()).toBe(0);
    });
  });

  describe('getMaxLoad', () => {
    test('returns max load', () => {
      rescaler.registerEnclave('e1');
      rescaler.registerEnclave('e2');
      rescaler.recordLoad('e1', 0.3);
      rescaler.recordLoad('e2', 0.8);
      expect(rescaler.getMaxLoad()).toBeCloseTo(0.8);
    });
  });

  describe('forecastLoad', () => {
    test('moving average forecast', () => {
      rescaler.registerEnclave('e1');
      for (let i = 0; i < 10; i++) {
        rescaler.recordLoad('e1', 0.5);
      }
      const forecast = rescaler.forecastLoad('e1');
      expect(forecast).toBeCloseTo(0.5);
    });

    test('linear trend forecast predicts increase', () => {
      const trend = new DynamicEnclaveRescaler({
        forecastAlgorithm: 'linear-trend',
        forecastWindow: 5,
      });
      trend.registerEnclave('e1');
      // Record increasing load
      for (let i = 0; i < 10; i++) {
        trend.recordLoad('e1', 0.1 * i + 0.1);
      }
      const forecast = trend.forecastLoad('e1');
      expect(forecast).toBeGreaterThan(0.5);
    });

    test('returns 0 for enclave with no history', () => {
      rescaler.registerEnclave('e1');
      expect(rescaler.forecastLoad('e1')).toBe(0);
    });
  });

  describe('getImbalance', () => {
    test('returns 0 for single enclave', () => {
      rescaler.registerEnclave('e1');
      rescaler.recordLoad('e1', 0.5);
      expect(rescaler.getImbalance()).toBe(0);
    });

    test('returns imbalance ratio', () => {
      rescaler.registerEnclave('e1');
      rescaler.registerEnclave('e2');
      rescaler.recordLoad('e1', 0.2);
      rescaler.recordLoad('e2', 0.8);
      const imbalance = rescaler.getImbalance();
      expect(imbalance).toBeCloseTo(0.75, 1);
    });

    test('returns 0 when all loads are 0', () => {
      rescaler.registerEnclave('e1');
      rescaler.registerEnclave('e2');
      expect(rescaler.getImbalance()).toBe(0);
    });
  });

  describe('evaluateScaling', () => {
    test('returns scale-up when load is high', () => {
      for (let i = 0; i < 3; i++) {
        rescaler.registerEnclave(`e${i + 1}`);
        for (let j = 0; j < 10; j++) rescaler.recordLoad(`e${i + 1}`, 0.9);
      }
      const decision = rescaler.evaluateScaling();
      expect(decision.action).toBe(SCALE_ACTION.SCALE_UP);
      expect(decision.targetCount).toBeGreaterThan(3);
    });

    test('returns scale-down when load is low', () => {
      for (let i = 0; i < 5; i++) {
        rescaler.registerEnclave(`e${i + 1}`);
        for (let j = 0; j < 10; j++) rescaler.recordLoad(`e${i + 1}`, 0.1);
      }
      const decision = rescaler.evaluateScaling();
      expect(decision.action).toBe(SCALE_ACTION.SCALE_DOWN);
      expect(decision.targetCount).toBeLessThan(5);
    });

    test('returns no-action when load is balanced', () => {
      for (let i = 0; i < 3; i++) {
        rescaler.registerEnclave(`e${i + 1}`);
        for (let j = 0; j < 10; j++) rescaler.recordLoad(`e${i + 1}`, 0.5);
      }
      const decision = rescaler.evaluateScaling();
      expect(decision.action).toBe(SCALE_ACTION.NO_ACTION);
    });

    test('returns rebalance when imbalanced', () => {
      rescaler.registerEnclave('e1');
      rescaler.registerEnclave('e2');
      rescaler.recordLoad('e1', 0.1);
      rescaler.recordLoad('e2', 0.9);
      const decision = rescaler.evaluateScaling();
      expect(decision.action).toBe(SCALE_ACTION.REBALANCE);
    });

    test('respects cooldown period', () => {
      const cool = new DynamicEnclaveRescaler({
        cooldownPeriodMs: 10000,
        minEnclaves: 1,
        maxEnclaves: 10,
      });
      cool.registerEnclave('e1');
      for (let i = 0; i < 10; i++) cool.recordLoad('e1', 0.9);
      // First evaluation should trigger scale-up
      const first = cool.evaluateScaling();
      expect(first.action).toBe(SCALE_ACTION.SCALE_UP);
      cool.executeScaling(first);
      // Second evaluation should be in cooldown
      const second = cool.evaluateScaling();
      expect(second.action).toBe(SCALE_ACTION.NO_ACTION);
      expect(second.reason).toBe('cooldown');
    });

    test('returns no-action when no active enclaves', () => {
      const decision = rescaler.evaluateScaling();
      expect(decision.action).toBe(SCALE_ACTION.NO_ACTION);
    });

    test('does not scale up beyond max', () => {
      const capped = new DynamicEnclaveRescaler({
        minEnclaves: 1,
        maxEnclaves: 3,
        cooldownPeriodMs: 0,
      });
      for (let i = 0; i < 3; i++) {
        capped.registerEnclave(`e${i + 1}`);
        for (let j = 0; j < 10; j++) capped.recordLoad(`e${i + 1}`, 0.95);
      }
      const decision = capped.evaluateScaling();
      expect(decision.action).toBe(SCALE_ACTION.NO_ACTION);
    });

    test('does not scale down below min', () => {
      const capped = new DynamicEnclaveRescaler({
        minEnclaves: 3,
        maxEnclaves: 10,
        cooldownPeriodMs: 0,
      });
      for (let i = 0; i < 3; i++) {
        capped.registerEnclave(`e${i + 1}`);
        for (let j = 0; j < 10; j++) capped.recordLoad(`e${i + 1}`, 0.05);
      }
      const decision = capped.evaluateScaling();
      expect(decision.action).toBe(SCALE_ACTION.NO_ACTION);
    });
  });

  describe('executeScaling', () => {
    test('executes scale-up', () => {
      for (let i = 0; i < 3; i++) {
        rescaler.registerEnclave(`e${i + 1}`);
        for (let j = 0; j < 10; j++) rescaler.recordLoad(`e${i + 1}`, 0.9);
      }
      const decision = rescaler.evaluateScaling();
      const result = rescaler.executeScaling(decision);
      expect(result.executed).toBe(true);
      expect(result.status).toBe(SCALE_STATUS.COMPLETED);
      expect(result.affectedEnclaves.length).toBeGreaterThan(0);
    });

    test('executes scale-down', () => {
      for (let i = 0; i < 5; i++) {
        rescaler.registerEnclave(`e${i + 1}`);
        for (let j = 0; j < 10; j++) rescaler.recordLoad(`e${i + 1}`, 0.1);
      }
      const decision = rescaler.evaluateScaling();
      const result = rescaler.executeScaling(decision);
      expect(result.executed).toBe(true);
      expect(result.status).toBe(SCALE_STATUS.COMPLETED);
    });

    test('executes rebalance', () => {
      rescaler.registerEnclave('e1');
      rescaler.registerEnclave('e2');
      rescaler.registerShard('shard-1', ['e1']);
      rescaler.recordLoad('e1', 0.1);
      rescaler.recordLoad('e2', 0.9);
      const decision = rescaler.evaluateScaling();
      const result = rescaler.executeScaling(decision);
      expect(result.executed).toBe(true);
      expect(result.action).toBe(SCALE_ACTION.REBALANCE);
    });

    test('returns not executed for no-action', () => {
      const result = rescaler.executeScaling({ action: SCALE_ACTION.NO_ACTION });
      expect(result.executed).toBe(false);
    });

    test('uses hooks when provided', () => {
      const added = [];
      const hooks = {
        addEnclave: (id) => added.push(id),
      };
      for (let i = 0; i < 2; i++) {
        rescaler.registerEnclave(`e${i + 1}`);
        for (let j = 0; j < 10; j++) rescaler.recordLoad(`e${i + 1}`, 0.95);
      }
      const decision = rescaler.evaluateScaling();
      const result = rescaler.executeScaling(decision, hooks);
      expect(result.executed).toBe(true);
      expect(added.length).toBeGreaterThan(0);
    });
  });

  describe('registerShard', () => {
    test('registers a shard', () => {
      rescaler.registerEnclave('e1');
      rescaler.registerEnclave('e2');
      rescaler.registerShard('shard-1', ['e1', 'e2']);
      const shards = rescaler.getShards();
      expect(shards.length).toBe(1);
      expect(shards[0].enclaveIds).toContain('e1');
    });

    test('rejects duplicate shard', () => {
      rescaler.registerShard('shard-1', []);
      expect(() => rescaler.registerShard('shard-1', [])).toThrow(HsmAdapterError);
    });

    test('rejects empty shard ID', () => {
      expect(() => rescaler.registerShard('', [])).toThrow(HsmAdapterError);
    });
  });

  describe('onChaosEvent', () => {
    test('triggers rescaling on chaos event', () => {
      rescaler.registerEnclave('e1');
      rescaler.registerEnclave('e2');
      for (let i = 0; i < 10; i++) {
        rescaler.recordLoad('e1', 0.9);
        rescaler.recordLoad('e2', 0.9);
      }
      const result = rescaler.onChaosEvent({
        targetEnclaveId: 'e1',
        faultType: 'enclave-crash',
      });
      expect(result.triggered).toBe(true);
      const enclave = rescaler.getEnclaves().find(e => e.id === 'e1');
      expect(enclave.status).toBe('degraded');
    });

    test('returns not triggered when disabled', () => {
      const disabled = new DynamicEnclaveRescaler({ chaosTriggerEnabled: false });
      const result = disabled.onChaosEvent({ targetEnclaveId: 'e1' });
      expect(result.triggered).toBe(false);
    });

    test('returns not triggered for invalid event', () => {
      const result = rescaler.onChaosEvent(null);
      expect(result.triggered).toBe(false);
    });
  });

  describe('getEnclaves', () => {
    test('returns enclaves with predicted load', () => {
      rescaler.registerEnclave('e1');
      rescaler.recordLoad('e1', 0.5);
      const enclaves = rescaler.getEnclaves();
      expect(enclaves[0].predictedLoad).toBeDefined();
    });
  });

  describe('getActionHistory', () => {
    test('returns action history', () => {
      for (let i = 0; i < 3; i++) {
        rescaler.registerEnclave(`e${i + 1}`);
        for (let j = 0; j < 10; j++) rescaler.recordLoad(`e${i + 1}`, 0.9);
      }
      const decision = rescaler.evaluateScaling();
      rescaler.executeScaling(decision);
      const history = rescaler.getActionHistory();
      expect(history.length).toBe(1);
    });
  });

  describe('getStats', () => {
    test('returns summary statistics', () => {
      rescaler.registerEnclave('e1');
      rescaler.registerEnclave('e2');
      rescaler.recordLoad('e1', 0.4);
      rescaler.recordLoad('e2', 0.6);
      const stats = rescaler.getStats();
      expect(stats.enclaveCount).toBe(2);
      expect(stats.activeEnclaves).toBe(2);
      expect(stats.averageLoad).toBeCloseTo(0.5);
      expect(stats.minEnclaves).toBe(2);
      expect(stats.maxEnclaves).toBe(10);
    });
  });

  describe('reset', () => {
    test('clears all state', () => {
      rescaler.registerEnclave('e1');
      rescaler.registerEnclave('e2');
      rescaler.reset();
      expect(rescaler.getEnclaves().length).toBe(0);
      expect(rescaler.getActionHistory().length).toBe(0);
    });
  });
});
