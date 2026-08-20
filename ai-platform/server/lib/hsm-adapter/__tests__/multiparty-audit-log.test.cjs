"use strict";

/**
 * Track 43: Multiparty Auditing and Remote Attestation Logs tests.
 */
const {
  MultipartyAuditLog,
  DEFAULT_OPTIONS,
} = require("../multiparty-audit-log.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

describe("Track 43: MultipartyAuditLog", () => {
  let log;

  beforeEach(() => {
    log = new MultipartyAuditLog({ minVerifiers: 2, maxVerifiers: 5 });
  });

  describe("verifier management", () => {
    test("registerVerifier adds a verifier", () => {
      log.registerVerifier("verifier-1");
      expect(log.getVerifiers()).toContain("verifier-1");
    });

    test("registerVerifier rejects empty ID", () => {
      expect(() => log.registerVerifier("")).toThrow(HsmAdapterError);
    });

    test("registerVerifier rejects non-string ID", () => {
      expect(() => log.registerVerifier(123)).toThrow(HsmAdapterError);
    });

    test("registerVerifier enforces max limit", () => {
      const small = new MultipartyAuditLog({
        minVerifiers: 1,
        maxVerifiers: 2,
      });
      small.registerVerifier("v1");
      small.registerVerifier("v2");
      expect(() => small.registerVerifier("v3")).toThrow(HsmAdapterError);
    });

    test("unregisterVerifier removes a verifier", () => {
      log.registerVerifier("verifier-1");
      log.unregisterVerifier("verifier-1");
      expect(log.getVerifiers()).not.toContain("verifier-1");
    });
  });

  describe("append", () => {
    test("appends a valid event and returns pending entry", () => {
      const result = log.append({
        eventType: "ENCLAVE_HARDWARE_BOOTSTRAPPED",
        data: { node: "node-1" },
      });
      expect(result.pending).toBe(true);
      expect(result.entryId).toBeDefined();
      expect(result.eventType).toBe("ENCLAVE_HARDWARE_BOOTSTRAPPED");
    });

    test("rejects disallowed event type", () => {
      expect(() =>
        log.append({ eventType: "UNKNOWN_EVENT", data: {} }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects missing event", () => {
      expect(() => log.append(null)).toThrow(HsmAdapterError);
    });

    test("rejects missing eventType", () => {
      expect(() => log.append({ data: {} })).toThrow(HsmAdapterError);
    });

    test("uses provided timestamp", () => {
      const ts = 1234567890;
      const result = log.append({
        eventType: "ENCLAVE_HARDWARE_BOOTSTRAPPED",
        data: {},
        timestamp: ts,
      });
      expect(result.pending).toBe(true);
    });
  });

  describe("signEntry and commit", () => {
    test("commits entry when min verifiers sign", () => {
      log.registerVerifier("v1");
      log.registerVerifier("v2");
      const result = log.append({
        eventType: "ENCLAVE_HARDWARE_BOOTSTRAPPED",
        data: { node: "n1" },
      });
      log.signEntry(result.entryId, "v1", "sig-1");
      expect(log.getPendingEntries().length).toBe(1);
      expect(log.queryEntries().length).toBe(0);
      log.signEntry(result.entryId, "v2", "sig-2");
      expect(log.getPendingEntries().length).toBe(0);
      expect(log.queryEntries().length).toBe(1);
      const entry = log.queryEntries()[0];
      expect(entry.committed).toBe(true);
      expect(entry.signatures["v1"]).toBe("sig-1");
      expect(entry.signatures["v2"]).toBe("sig-2");
    });

    test("rejects signature from unregistered verifier", () => {
      const result = log.append({
        eventType: "ENCLAVE_HARDWARE_BOOTSTRAPPED",
        data: {},
      });
      expect(() => log.signEntry(result.entryId, "unknown", "sig")).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects signature for non-existent entry", () => {
      log.registerVerifier("v1");
      expect(() => log.signEntry("fake-id", "v1", "sig")).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects duplicate signature from same verifier", () => {
      log.registerVerifier("v1");
      const result = log.append({
        eventType: "ENCLAVE_HARDWARE_BOOTSTRAPPED",
        data: {},
      });
      log.signEntry(result.entryId, "v1", "sig-1");
      expect(() => log.signEntry(result.entryId, "v1", "sig-2")).toThrow(
        HsmAdapterError,
      );
    });
  });

  describe("verification timeout", () => {
    test("rejects signature after timeout", () => {
      const fastLog = new MultipartyAuditLog({
        minVerifiers: 2,
        verifierTimeoutMs: 50,
      });
      fastLog.registerVerifier("v1");
      fastLog.registerVerifier("v2");
      const result = fastLog.append({
        eventType: "ENCLAVE_HARDWARE_BOOTSTRAPPED",
        data: {},
      });
      fastLog.signEntry(result.entryId, "v1", "sig-1");
      return new Promise((resolve) => setTimeout(resolve, 60)).then(() => {
        expect(() => fastLog.signEntry(result.entryId, "v2", "sig-2")).toThrow(
          HsmAdapterError,
        );
      });
    });
  });

  describe("queryEntries", () => {
    test("returns all committed entries", () => {
      log.registerVerifier("v1");
      log.registerVerifier("v2");
      log.append({
        eventType: "ENCLAVE_HARDWARE_BOOTSTRAPPED",
        data: { n: 1 },
      });
      const r2 = log.append({
        eventType: "ENCLAVE_KEY_PROVISIONED",
        data: { n: 2 },
      });
      // Sign first entry
      const pending = log.getPendingEntries();
      const id1 = pending[0].id;
      log.signEntry(id1, "v1", "s1");
      log.signEntry(id1, "v2", "s2");
      // Sign second entry
      log.signEntry(r2.entryId, "v1", "s3");
      log.signEntry(r2.entryId, "v2", "s4");
      const all = log.queryEntries();
      expect(all.length).toBe(2);
    });

    test("filters by eventType", () => {
      log.registerVerifier("v1");
      log.registerVerifier("v2");
      const r1 = log.append({
        eventType: "ENCLAVE_HARDWARE_BOOTSTRAPPED",
        data: {},
      });
      const r2 = log.append({ eventType: "ENCLAVE_KEY_PROVISIONED", data: {} });
      log.signEntry(r1.entryId, "v1", "s1");
      log.signEntry(r1.entryId, "v2", "s2");
      log.signEntry(r2.entryId, "v1", "s3");
      log.signEntry(r2.entryId, "v2", "s4");
      const filtered = log.queryEntries({
        eventType: "ENCLAVE_KEY_PROVISIONED",
      });
      expect(filtered.length).toBe(1);
      expect(filtered[0].eventType).toBe("ENCLAVE_KEY_PROVISIONED");
    });

    test("filters by since timestamp", () => {
      log.registerVerifier("v1");
      log.registerVerifier("v2");
      const r1 = log.append({
        eventType: "ENCLAVE_HARDWARE_BOOTSTRAPPED",
        data: {},
        timestamp: 1000,
      });
      const r2 = log.append({
        eventType: "ENCLAVE_KEY_PROVISIONED",
        data: {},
        timestamp: 5000,
      });
      log.signEntry(r1.entryId, "v1", "s1");
      log.signEntry(r1.entryId, "v2", "s2");
      log.signEntry(r2.entryId, "v1", "s3");
      log.signEntry(r2.entryId, "v2", "s4");
      const filtered = log.queryEntries({ since: 3000 });
      expect(filtered.length).toBe(1);
      expect(filtered[0].timestamp).toBe(5000);
    });

    test("limits results", () => {
      log.registerVerifier("v1");
      log.registerVerifier("v2");
      for (let i = 0; i < 5; i++) {
        const r = log.append({
          eventType: "ENCLAVE_HARDWARE_BOOTSTRAPPED",
          data: { i },
        });
        log.signEntry(r.entryId, "v1", "s");
        log.signEntry(r.entryId, "v2", "s");
      }
      const limited = log.queryEntries({ limit: 2 });
      expect(limited.length).toBe(2);
    });
  });

  describe("getEntry", () => {
    test("returns entry by ID", () => {
      log.registerVerifier("v1");
      log.registerVerifier("v2");
      const r = log.append({
        eventType: "ENCLAVE_HARDWARE_BOOTSTRAPPED",
        data: { x: 1 },
      });
      log.signEntry(r.entryId, "v1", "s1");
      log.signEntry(r.entryId, "v2", "s2");
      const entry = log.getEntry(r.entryId);
      expect(entry).not.toBeNull();
      expect(entry.id).toBe(r.entryId);
    });

    test("returns null for non-existent ID", () => {
      expect(log.getEntry("fake")).toBeNull();
    });
  });

  describe("verifyChain", () => {
    test("validates a clean chain", () => {
      log.registerVerifier("v1");
      log.registerVerifier("v2");
      for (let i = 0; i < 3; i++) {
        const r = log.append({
          eventType: "ENCLAVE_HARDWARE_BOOTSTRAPPED",
          data: { i },
        });
        log.signEntry(r.entryId, "v1", "s1-" + i);
        log.signEntry(r.entryId, "v2", "s2-" + i);
      }
      const result = log.verifyChain();
      expect(result.valid).toBe(true);
      expect(result.entryCount).toBe(3);
    });

    test("detects tampered chain", () => {
      log.registerVerifier("v1");
      log.registerVerifier("v2");
      const r = log.append({
        eventType: "ENCLAVE_HARDWARE_BOOTSTRAPPED",
        data: { i: 1 },
      });
      log.signEntry(r.entryId, "v1", "s1");
      log.signEntry(r.entryId, "v2", "s2");
      // Tamper with the entry data
      const entry = log.queryEntries()[0];
      entry.data = { tampered: true };
      const result = log.verifyChain();
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("mismatch");
    });
  });

  describe("exportLog", () => {
    test("exports entries, verifiers, and counts", () => {
      log.registerVerifier("v1");
      log.registerVerifier("v2");
      const r = log.append({
        eventType: "ENCLAVE_HARDWARE_BOOTSTRAPPED",
        data: {},
      });
      log.signEntry(r.entryId, "v1", "s1");
      log.signEntry(r.entryId, "v2", "s2");
      const exported = log.exportLog();
      expect(exported.entries.length).toBe(1);
      expect(exported.verifiers.length).toBe(2);
      expect(exported.entryCount).toBe(1);
      expect(exported.pendingCount).toBe(0);
      expect(exported.lastHash).toBeDefined();
    });
  });

  describe("getStats", () => {
    test("returns summary statistics", () => {
      log.registerVerifier("v1");
      log.registerVerifier("v2");
      const r = log.append({
        eventType: "ENCLAVE_HARDWARE_BOOTSTRAPPED",
        data: {},
      });
      log.signEntry(r.entryId, "v1", "s1");
      log.signEntry(r.entryId, "v2", "s2");
      const stats = log.getStats();
      expect(stats.totalEntries).toBe(1);
      expect(stats.pendingEntries).toBe(0);
      expect(stats.verifierCount).toBe(2);
      expect(stats.minVerifiers).toBe(2);
      expect(stats.byType["ENCLAVE_HARDWARE_BOOTSTRAPPED"]).toBe(1);
    });
  });

  describe("getPendingEntries", () => {
    test("returns pending entries with signature info", () => {
      log.registerVerifier("v1");
      log.registerVerifier("v2");
      const r = log.append({
        eventType: "ENCLAVE_HARDWARE_BOOTSTRAPPED",
        data: {},
      });
      log.signEntry(r.entryId, "v1", "s1");
      const pending = log.getPendingEntries();
      expect(pending.length).toBe(1);
      expect(pending[0].signatureCount).toBe(1);
      expect(pending[0].requiredSignatures).toBe(2);
    });
  });

  describe("reset", () => {
    test("clears all state", () => {
      log.registerVerifier("v1");
      log.registerVerifier("v2");
      const r = log.append({
        eventType: "ENCLAVE_HARDWARE_BOOTSTRAPPED",
        data: {},
      });
      log.signEntry(r.entryId, "v1", "s1");
      log.signEntry(r.entryId, "v2", "s2");
      expect(log.queryEntries().length).toBe(1);
      log.reset();
      expect(log.queryEntries().length).toBe(0);
      expect(log.getVerifiers().length).toBe(0);
    });
  });

  describe("hash chaining", () => {
    test("each entry prevHash matches previous entryHash", () => {
      log.registerVerifier("v1");
      log.registerVerifier("v2");
      let prevHash = null;
      for (let i = 0; i < 3; i++) {
        const r = log.append({
          eventType: "ENCLAVE_HARDWARE_BOOTSTRAPPED",
          data: { i },
        });
        if (prevHash !== null) {
          expect(r.prevHash).toBe(prevHash);
        }
        log.signEntry(r.entryId, "v1", "s1-" + i);
        log.signEntry(r.entryId, "v2", "s2-" + i);
        const entry = log.getEntry(r.entryId);
        prevHash = entry.entryHash;
      }
    });
  });

  describe("pruning", () => {
    test("prunes oldest entries when maxEntries exceeded", () => {
      const small = new MultipartyAuditLog({
        minVerifiers: 1,
        maxVerifiers: 3,
        maxEntries: 3,
      });
      small.registerVerifier("v1");
      for (let i = 0; i < 5; i++) {
        const r = small.append({
          eventType: "ENCLAVE_HARDWARE_BOOTSTRAPPED",
          data: { i },
        });
        small.signEntry(r.entryId, "v1", "s-" + i);
      }
      expect(small.queryEntries().length).toBe(3);
    });
  });

  describe("custom event types", () => {
    test("accepts custom allowed event types", () => {
      const custom = new MultipartyAuditLog({
        minVerifiers: 1,
        allowedEventTypes: ["CUSTOM_EVENT"],
      });
      custom.registerVerifier("v1");
      const r = custom.append({ eventType: "CUSTOM_EVENT", data: {} });
      expect(r.pending).toBe(true);
    });
  });
});
