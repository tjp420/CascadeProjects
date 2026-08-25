"use strict";

/**
 * Stage 3: Unit tests for the HSM circuit breaker and metrics modules.
 *
 * Tests the circuit breaker state machine (CLOSED → OPEN → HALF_OPEN → CLOSED)
 * and the metrics registry (counters, histograms, Prometheus exposition format).
 */

const {
  CircuitBreaker,
  STATES,
  DEFAULT_THRESHOLD,
  DEFAULT_COOLDOWN_MS,
} = require("../circuit-breaker.cjs");
const metrics = require("../hsm-metrics.cjs");

describe("CircuitBreaker", () => {
  let transitions;
  let breaker;

  beforeEach(() => {
    transitions = [];
    breaker = new CircuitBreaker({
      threshold: 3,
      cooldownMs: 100,
      name: "test-hsm",
      onTransition: (newState, prev, info) =>
        transitions.push({ newState, prev, info }),
    });
  });

  test("starts in CLOSED state", () => {
    expect(breaker.state).toBe(STATES.CLOSED);
    expect(breaker.isBlocked()).toBe(false);
  });

  test("does not open before threshold failures", () => {
    breaker.recordFailure(new Error("fail-1"));
    breaker.recordFailure(new Error("fail-2"));
    expect(breaker.state).toBe(STATES.CLOSED);
    expect(breaker.isBlocked()).toBe(false);
    expect(transitions).toHaveLength(0);
  });

  test("opens after threshold consecutive failures", () => {
    breaker.recordFailure(new Error("fail-1"));
    breaker.recordFailure(new Error("fail-2"));
    breaker.recordFailure(new Error("fail-3"));
    expect(breaker.state).toBe(STATES.OPEN);
    expect(breaker.isBlocked()).toBe(true);
    expect(transitions).toHaveLength(1);
    expect(transitions[0].newState).toBe(STATES.OPEN);
    expect(transitions[0].prev).toBe(STATES.CLOSED);
    expect(transitions[0].info.reason).toBe("threshold_exceeded");
    expect(transitions[0].info.failures).toBe(3);
  });

  test("rejects all requests while OPEN and cooldown has not elapsed", () => {
    breaker.recordFailure(new Error("fail-1"));
    breaker.recordFailure(new Error("fail-2"));
    breaker.recordFailure(new Error("fail-3"));
    // Immediately after opening — still blocked
    expect(breaker.isBlocked()).toBe(true);
    expect(breaker.state).toBe(STATES.OPEN);
  });

  test("transitions to HALF_OPEN after cooldown and allows one probe", async () => {
    breaker.recordFailure(new Error("fail-1"));
    breaker.recordFailure(new Error("fail-2"));
    breaker.recordFailure(new Error("fail-3"));
    expect(breaker.state).toBe(STATES.OPEN);

    // Wait for cooldown to elapse
    await new Promise((r) => setTimeout(r, 120));

    // First call: transitions to half-open, allows probe
    expect(breaker.isBlocked()).toBe(false);
    expect(breaker.state).toBe(STATES.HALF_OPEN);
    expect(transitions).toHaveLength(2);
    expect(transitions[1].newState).toBe(STATES.HALF_OPEN);

    // Second call: probe already pending, blocked
    expect(breaker.isBlocked()).toBe(true);
  });

  test("closes on successful probe in HALF_OPEN", async () => {
    breaker.recordFailure(new Error("fail-1"));
    breaker.recordFailure(new Error("fail-2"));
    breaker.recordFailure(new Error("fail-3"));
    await new Promise((r) => setTimeout(r, 120));
    breaker.isBlocked(); // triggers half-open

    breaker.recordSuccess();
    expect(breaker.state).toBe(STATES.CLOSED);
    expect(transitions).toHaveLength(3);
    expect(transitions[2].newState).toBe(STATES.CLOSED);
    expect(breaker.isBlocked()).toBe(false);
  });

  test("reopens on failed probe in HALF_OPEN", async () => {
    breaker.recordFailure(new Error("fail-1"));
    breaker.recordFailure(new Error("fail-2"));
    breaker.recordFailure(new Error("fail-3"));
    await new Promise((r) => setTimeout(r, 120));
    breaker.isBlocked(); // triggers half-open

    breaker.recordFailure(new Error("probe-fail"));
    expect(breaker.state).toBe(STATES.OPEN);
    expect(transitions).toHaveLength(3);
    expect(transitions[2].newState).toBe(STATES.OPEN);
    expect(transitions[2].info.reason).toBe("probe_failed");
  });

  test("recordSuccess resets failure count in CLOSED state", () => {
    breaker.recordFailure(new Error("fail-1"));
    breaker.recordFailure(new Error("fail-2"));
    breaker.recordSuccess();
    expect(breaker.state).toBe(STATES.CLOSED);
    // Now need 3 more failures to open
    breaker.recordFailure(new Error("fail-1"));
    breaker.recordFailure(new Error("fail-2"));
    expect(breaker.state).toBe(STATES.CLOSED);
  });

  test("reset() forces transition to CLOSED", () => {
    breaker.recordFailure(new Error("fail-1"));
    breaker.recordFailure(new Error("fail-2"));
    breaker.recordFailure(new Error("fail-3"));
    expect(breaker.state).toBe(STATES.OPEN);

    breaker.reset();
    expect(breaker.state).toBe(STATES.CLOSED);
    expect(breaker.isBlocked()).toBe(false);
    expect(transitions).toHaveLength(2);
    expect(transitions[1].info.reason).toBe("manual_reset");
  });

  test("getSnapshot returns internal state", () => {
    breaker.recordFailure(new Error("fail-1"));
    const snap = breaker.getSnapshot();
    expect(snap.state).toBe(STATES.CLOSED);
    expect(snap.failures).toBe(1);
    expect(snap.threshold).toBe(3);
    expect(snap.cooldownMs).toBe(100);
    expect(snap.probePending).toBe(false);
  });

  test("uses default threshold and cooldown when not specified", () => {
    const b = new CircuitBreaker();
    expect(b.threshold).toBe(DEFAULT_THRESHOLD);
    expect(b.cooldownMs).toBe(DEFAULT_COOLDOWN_MS);
  });

  test("onTransition callback receives provider name", () => {
    let receivedName = null;
    const b = new CircuitBreaker({
      threshold: 1,
      name: "azure-prod",
      onTransition: (_new, _prev, info) => {
        receivedName = info.name;
      },
    });
    b.recordFailure(new Error("fail"));
    expect(receivedName).toBe("azure-prod");
  });
});

describe("HSM Metrics", () => {
  beforeEach(() => {
    metrics.reset();
  });

  test("incrementCounter increases counter value", () => {
    metrics.incrementCounter("hsm_wrap_total");
    metrics.incrementCounter("hsm_wrap_total");
    metrics.incrementCounter("hsm_wrap_total", 3);
    const m = metrics.getMetrics();
    expect(m.hsm_wrap_total).toBe(5);
  });

  test("incrementCounter ignores unknown counter names", () => {
    metrics.incrementCounter("nonexistent_counter");
    const m = metrics.getMetrics();
    expect(m.nonexistent_counter).toBeUndefined();
  });

  test("observeHistogram records latency in correct bucket", () => {
    metrics.observeHistogram("hsm_wrap_duration_ms", 5);
    metrics.observeHistogram("hsm_wrap_duration_ms", 50);
    metrics.observeHistogram("hsm_wrap_duration_ms", 500);
    metrics.observeHistogram("hsm_wrap_duration_ms", 10000); // overflow

    const m = metrics.getMetrics();
    expect(m.hsm_wrap_duration_ms_count).toBe(4);
    expect(m.hsm_wrap_duration_ms_sum).toBe(10555);
    // Bucket le=5 should have 1 (cumulative in renderPrometheus, but getMetrics is raw)
    expect(m['hsm_wrap_duration_ms_bucket{le="5"}']).toBe(1);
    expect(m['hsm_wrap_duration_ms_bucket{le="50"}']).toBe(1);
    expect(m['hsm_wrap_duration_ms_bucket{le="500"}']).toBe(1);
  });

  test("observeHistogram ignores unknown histogram names", () => {
    metrics.observeHistogram("nonexistent", 100);
    const m = metrics.getMetrics();
    expect(m.nonexistent_count).toBeUndefined();
  });

  test("reset clears all counters and histograms", () => {
    metrics.incrementCounter("hsm_wrap_total", 10);
    metrics.observeHistogram("hsm_wrap_duration_ms", 100);
    metrics.reset();
    const m = metrics.getMetrics();
    expect(m.hsm_wrap_total).toBe(0);
    expect(m.hsm_wrap_duration_ms_count).toBe(0);
    expect(m.hsm_wrap_duration_ms_sum).toBe(0);
  });

  test("renderPrometheus produces valid exposition format", () => {
    metrics.incrementCounter("hsm_wrap_total", 5);
    metrics.observeHistogram("hsm_wrap_duration_ms", 50);

    const output = metrics.renderPrometheus();
    expect(output).toContain("# HELP hsm_wrap_total");
    expect(output).toContain("# TYPE hsm_wrap_total counter");
    expect(output).toContain("hsm_wrap_total 5");
    expect(output).toContain("# TYPE hsm_wrap_duration_ms histogram");
    expect(output).toContain("hsm_wrap_duration_ms_count 1");
    expect(output).toContain("hsm_wrap_duration_ms_sum 50");
    expect(output).toContain('hsm_wrap_duration_ms_bucket{le="+Inf"}');
    expect(output.endsWith("\n")).toBe(true);
  });

  test("renderPrometheus includes all circuit breaker counters", () => {
    metrics.incrementCounter("hsm_circuit_opened_total");
    metrics.incrementCounter("hsm_circuit_closed_total");
    metrics.incrementCounter("hsm_circuit_half_open_total");

    const output = metrics.renderPrometheus();
    expect(output).toContain("hsm_circuit_opened_total 1");
    expect(output).toContain("hsm_circuit_closed_total 1");
    expect(output).toContain("hsm_circuit_half_open_total 1");
  });

  test("renderPrometheus histogram buckets are cumulative", () => {
    // Observe values: 5, 50, 500
    metrics.observeHistogram("hsm_wrap_duration_ms", 5);
    metrics.observeHistogram("hsm_wrap_duration_ms", 50);
    metrics.observeHistogram("hsm_wrap_duration_ms", 500);

    const output = metrics.renderPrometheus();
    // le=5: cumulative=1, le=50: cumulative=2, le=500: cumulative=3, le=+Inf: cumulative=3
    expect(output).toMatch(/hsm_wrap_duration_ms_bucket\{le="5"\} 1/);
    expect(output).toMatch(/hsm_wrap_duration_ms_bucket\{le="50"\} 2/);
    expect(output).toMatch(/hsm_wrap_duration_ms_bucket\{le="500"\} 3/);
    expect(output).toMatch(/hsm_wrap_duration_ms_bucket\{le="\+Inf"\} 3/);
  });

  test("all expected counter names are present", () => {
    const m = metrics.getMetrics();
    const expectedCounters = [
      "hsm_wrap_total",
      "hsm_wrap_failures_total",
      "hsm_unwrap_total",
      "hsm_unwrap_failures_total",
      "hsm_create_kek_total",
      "hsm_create_kek_failures_total",
      "hsm_rotate_kek_total",
      "hsm_zeroize_total",
      "hsm_circuit_opened_total",
      "hsm_circuit_closed_total",
      "hsm_circuit_half_open_total",
      "hsm_recovery_started_total",
      "hsm_recovery_synced_total",
      "hsm_recovery_failures_total",
      "hsm_recovery_catchup_batches_total",
    ];
    for (const name of expectedCounters) {
      expect(m[name]).toBeDefined();
    }
  });

  test("all expected histogram names are present", () => {
    const m = metrics.getMetrics();
    const expectedHistograms = [
      "hsm_wrap_duration_ms",
      "hsm_unwrap_duration_ms",
      "hsm_create_kek_duration_ms",
    ];
    for (const name of expectedHistograms) {
      expect(m[`${name}_count`]).toBeDefined();
      expect(m[`${name}_sum`]).toBeDefined();
    }
  });

  // ── Track 33 recovery sync metrics ──────────────────────────────

  test("renderPrometheus includes recovery sync counters", () => {
    metrics.incrementCounter("hsm_recovery_started_total");
    metrics.incrementCounter("hsm_recovery_synced_total");
    metrics.incrementCounter("hsm_recovery_failures_total");
    metrics.incrementCounter("hsm_recovery_catchup_batches_total", 3);

    const output = metrics.renderPrometheus();
    expect(output).toContain("# HELP hsm_recovery_started_total");
    expect(output).toContain("# TYPE hsm_recovery_started_total counter");
    expect(output).toContain("hsm_recovery_started_total 1");
    expect(output).toContain("hsm_recovery_synced_total 1");
    expect(output).toContain("hsm_recovery_failures_total 1");
    expect(output).toContain("hsm_recovery_catchup_batches_total 3");
  });

  test("recovery sync counters start at zero after reset", () => {
    metrics.incrementCounter("hsm_recovery_started_total", 5);
    metrics.reset();
    const m = metrics.getMetrics();
    expect(m.hsm_recovery_started_total).toBe(0);
    expect(m.hsm_recovery_synced_total).toBe(0);
    expect(m.hsm_recovery_failures_total).toBe(0);
    expect(m.hsm_recovery_catchup_batches_total).toBe(0);
  });

  test("recovery catchup batches counter accumulates multiple increments", () => {
    metrics.incrementCounter("hsm_recovery_catchup_batches_total", 3);
    metrics.incrementCounter("hsm_recovery_catchup_batches_total", 2);
    metrics.incrementCounter("hsm_recovery_catchup_batches_total");
    const m = metrics.getMetrics();
    expect(m.hsm_recovery_catchup_batches_total).toBe(6);
  });
});
