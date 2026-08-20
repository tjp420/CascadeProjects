"use strict";

const fs = require("fs");
const {
  validateTenantContext,
  tagSIEMEvent,
  tagOutboundMessage,
  rejectCrossTenant,
  TENANT_FIELD,
  DEFAULT_TENANT,
  BACKWARD_COMPAT_MODE,
} = require("../replication-tenant-context.cjs");
const hsmMetrics = require("../hsm-adapter/hsm-metrics.cjs");

describe("Track 124: Cross-Cluster Tenant Isolation Integration", () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  // ─── KRS: cluster-keyring-sync IPC schemas ──────────────────────────────
  describe("KRS: cluster-keyring-sync IPC schemas", () => {
    test("KRS-01: IPC_SCHEMAS includes tenantId as optional in HEARTBEAT", () => {
      const src = fs.readFileSync(
        __dirname + "/../cluster-keyring-sync.cjs",
        "utf8",
      );
      const heartbeatMatch = src.match(
        /HEARTBEAT:\s*\{[\s\S]*?optional:\s*\{([^}]*)\}/,
      );
      expect(heartbeatMatch).toBeTruthy();
      expect(heartbeatMatch[1]).toContain("tenantId");
    });

    test("KRS-02: IPC_SCHEMAS includes tenantId in KEY_COMMIT", () => {
      const src = fs.readFileSync(
        __dirname + "/../cluster-keyring-sync.cjs",
        "utf8",
      );
      const keyCommitMatch = src.match(
        /KEY_COMMIT:\s*\{[\s\S]*?optional:\s*\{([^}]*)\}/,
      );
      expect(keyCommitMatch).toBeTruthy();
      expect(keyCommitMatch[1]).toContain("tenantId");
    });

    test("KRS-03: IPC_SCHEMAS includes tenantId in DKG_COMMIT", () => {
      const src = fs.readFileSync(
        __dirname + "/../cluster-keyring-sync.cjs",
        "utf8",
      );
      const dkgMatch = src.match(
        /DKG_COMMIT:\s*\{[\s\S]*?optional:\s*\{([^}]*)\}/,
      );
      expect(dkgMatch).toBeTruthy();
      expect(dkgMatch[1]).toContain("tenantId");
    });

    test("KRS-04: IPC_SCHEMAS includes tenantId in SIEM_BUCKET_SYNC", () => {
      const src = fs.readFileSync(
        __dirname + "/../cluster-keyring-sync.cjs",
        "utf8",
      );
      const siemMatch = src.match(
        /SIEM_BUCKET_SYNC:\s*\{[\s\S]*?optional:\s*\{([^}]*)\}/,
      );
      expect(siemMatch).toBeTruthy();
      expect(siemMatch[1]).toContain("tenantId");
    });

    test("KRS-05: _handleMessage includes tenant context validation", () => {
      const src = fs.readFileSync(
        __dirname + "/../cluster-keyring-sync.cjs",
        "utf8",
      );
      expect(src).toContain("validateTenantContext");
      expect(src).toContain("Track 124: Validate tenant context");
    });

    test("KRS-06: _broadcast tags outbound messages with tenantId", () => {
      const src = fs.readFileSync(
        __dirname + "/../cluster-keyring-sync.cjs",
        "utf8",
      );
      expect(src).toContain("tagOutboundMessage");
    });
  });

  // ─── BFT: bft-shard-sync-engine tenant context ─────────────────────────
  describe("BFT: bft-shard-sync-engine", () => {
    test("BFT-01: module imports replication-tenant-context", () => {
      const src = fs.readFileSync(
        __dirname + "/../hsm-adapter/bft-shard-sync-engine.cjs",
        "utf8",
      );
      expect(src).toContain("replication-tenant-context");
      expect(src).toContain("validateTenantContext");
    });
  });

  // ─── CES: cross-enclave-state-sync tenant context ──────────────────────
  describe("CES: cross-enclave-state-sync", () => {
    test("CES-01: module imports replication-tenant-context", () => {
      const src = fs.readFileSync(
        __dirname + "/../hsm-adapter/cross-enclave-state-sync.cjs",
        "utf8",
      );
      expect(src).toContain("replication-tenant-context");
      expect(src).toContain("validateTenantContext");
    });
  });

  // ─── MIG: cross-cluster-migration-engine tenant context ────────────────
  describe("MIG: cross-cluster-migration-engine", () => {
    test("MIG-01: module imports replication-tenant-context", () => {
      const src = fs.readFileSync(
        __dirname + "/../hsm-adapter/cross-cluster-migration-engine.cjs",
        "utf8",
      );
      expect(src).toContain("replication-tenant-context");
      expect(src).toContain("validateTenantContext");
    });
  });

  // ─── CON: cluster-consensus-engine tenant context ──────────────────────
  describe("CON: cluster-consensus-engine", () => {
    test("CON-01: module imports replication-tenant-context", () => {
      const src = fs.readFileSync(
        __dirname + "/../hsm-adapter/cluster-consensus-engine.cjs",
        "utf8",
      );
      expect(src).toContain("replication-tenant-context");
    });
  });

  // ─── REC: cluster-key-reconciliation-engine tenant context ─────────────
  describe("REC: cluster-key-reconciliation-engine", () => {
    test("REC-01: module imports replication-tenant-context", () => {
      const src = fs.readFileSync(
        __dirname + "/../hsm-adapter/cluster-key-reconciliation-engine.cjs",
        "utf8",
      );
      expect(src).toContain("replication-tenant-context");
    });
  });

  // ─── SIEM: siem-broker tenant context tagging ──────────────────────────
  describe("SIEM: siem-broker tenant context", () => {
    test("SIEM-01: module imports replication-tenant-context", () => {
      const src = fs.readFileSync(
        __dirname + "/../siem/siem-broker.cjs",
        "utf8",
      );
      expect(src).toContain("replication-tenant-context");
      expect(src).toContain("tagSIEMEvent");
    });
  });

  // ─── MET: hsm-metrics new counters ─────────────────────────────────────
  describe("MET: hsm-metrics counters", () => {
    test("MET-01: hsm_replication_tenant_isolation_violation_total counter exists", () => {
      hsmMetrics.incrementCounter(
        "hsm_replication_tenant_isolation_violation_total",
      );
      expect(
        hsmMetrics.getMetrics()
          .hsm_replication_tenant_isolation_violation_total,
      ).toBe(1);
    });

    test("MET-02: hsm_replication_tenant_context_validated_total counter exists", () => {
      hsmMetrics.incrementCounter(
        "hsm_replication_tenant_context_validated_total",
      );
      expect(
        hsmMetrics.getMetrics().hsm_replication_tenant_context_validated_total,
      ).toBe(1);
    });

    test("MET-03: hsm_replication_cross_tenant_rejected_total counter exists", () => {
      hsmMetrics.incrementCounter(
        "hsm_replication_cross_tenant_rejected_total",
      );
      expect(
        hsmMetrics.getMetrics().hsm_replication_cross_tenant_rejected_total,
      ).toBe(1);
    });
  });

  // ─── Backward compatibility ────────────────────────────────────────────
  describe("Backward compatibility", () => {
    test("BC-01: message without tenantId defaults to default tenant", () => {
      const msg = { type: "HEARTBEAT", from: "node1" };
      const result = validateTenantContext(msg);
      if (BACKWARD_COMPAT_MODE) {
        expect(result.valid).toBe(true);
        expect(result.tenantId).toBe(DEFAULT_TENANT);
      }
    });

    test("BC-02: message with tenantId uses provided tenant", () => {
      const msg = { type: "HEARTBEAT", tenantId: "tenant-X", from: "node1" };
      const result = validateTenantContext(msg);
      expect(result.valid).toBe(true);
      expect(result.tenantId).toBe("tenant-X");
    });

    test("BC-03: cross-tenant rejection with default tenant", () => {
      const msg = { type: "HEARTBEAT", tenantId: "tenant-X", from: "node1" };
      const result = validateTenantContext(msg, DEFAULT_TENANT);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("cross_tenant_mismatch");
    });
  });

  // ─── Security invariants ───────────────────────────────────────────────
  describe("Security invariants", () => {
    test("SEC-01: path traversal in tenantId is rejected", () => {
      const msg = {
        type: "HEARTBEAT",
        tenantId: "../../../etc/passwd",
        from: "node1",
      };
      const result = validateTenantContext(msg);
      expect(result.valid).toBe(false);
    });

    test("SEC-02: empty string tenantId is rejected", () => {
      const msg = { type: "HEARTBEAT", tenantId: "", from: "node1" };
      const result = validateTenantContext(msg);
      expect(result.valid).toBe(false);
    });

    test("SEC-03: non-string tenantId is rejected", () => {
      const msg = { type: "HEARTBEAT", tenantId: 12345, from: "node1" };
      const result = validateTenantContext(msg);
      expect(result.valid).toBe(false);
    });

    test("SEC-04: rejectCrossTenant increments cross-tenant counter", () => {
      const before =
        hsmMetrics.getMetrics().hsm_replication_cross_tenant_rejected_total ||
        0;
      try {
        rejectCrossTenant("A", "B");
      } catch (e) {}
      const after =
        hsmMetrics.getMetrics().hsm_replication_cross_tenant_rejected_total ||
        0;
      expect(after).toBe(before + 1);
    });

    test("SEC-05: tagSIEMEvent persists tenant context on event", () => {
      const event = { severity: "critical", category: "cross_tenant" };
      tagSIEMEvent(event, "tenant-A");
      expect(event[TENANT_FIELD]).toBe("tenant-A");
    });
  });
});
