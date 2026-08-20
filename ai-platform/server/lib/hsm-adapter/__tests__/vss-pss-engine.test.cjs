"use strict";

/**
 * Track 55: Zero-Knowledge Verifiable Secret Sharing (VSS) and
 * Active-Adversary Proactive Secret Sharing (PSS) tests.
 */
const crypto = require("crypto");
const {
  VssPssEngine,
  DEFAULT_OPTIONS,
  VSS_STATUS,
  EPOCH_STATUS,
  SHARE_STATUS,
  FIELD_PRIME,
} = require("../vss-pss-engine.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

describe("Track 55: VssPssEngine", () => {
  let engine;

  beforeEach(() => {
    engine = new VssPssEngine({
      minThreshold: 2,
      maxParticipants: 10,
      epochDurationMs: 60000,
    });
  });

  describe("startEpoch", () => {
    test("starts a new epoch", () => {
      const epoch = engine.startEpoch();
      expect(epoch.epochId).toBeDefined();
      expect(epoch.number).toBe(1);
      expect(epoch.status).toBe(EPOCH_STATUS.ACTIVE);
    });

    test("accepts custom epoch ID", () => {
      const epoch = engine.startEpoch("custom-epoch");
      expect(epoch.epochId).toBe("custom-epoch");
    });

    test("rejects duplicate epoch ID", () => {
      engine.startEpoch("e1");
      expect(() => engine.startEpoch("e1")).toThrow(HsmAdapterError);
    });

    test("increments epoch number", () => {
      engine.startEpoch();
      engine.startEpoch();
      const e3 = engine.startEpoch();
      expect(e3.number).toBe(3);
    });
  });

  describe("expireEpoch", () => {
    test("expires an active epoch", () => {
      const epoch = engine.startEpoch();
      const result = engine.expireEpoch(epoch.epochId);
      expect(result.expired).toBe(true);
      const e = engine.getEpoch(epoch.epochId);
      expect(e.status).toBe(EPOCH_STATUS.EXPIRED);
    });

    test("rejects unknown epoch", () => {
      expect(() => engine.expireEpoch("unknown")).toThrow(HsmAdapterError);
    });

    test("rejects already expired epoch", () => {
      const epoch = engine.startEpoch();
      engine.expireEpoch(epoch.epochId);
      expect(() => engine.expireEpoch(epoch.epochId)).toThrow(HsmAdapterError);
    });
  });

  describe("dealSecret", () => {
    test("deals a secret with VSS", () => {
      const result = engine.dealSecret({
        sessionId: "s1",
        secret: crypto.randomBytes(32),
        threshold: 3,
        participants: 5,
      });
      expect(result.sessionId).toBe("s1");
      expect(result.status).toBe(VSS_STATUS.DEALT);
      expect(result.threshold).toBe(3);
      expect(result.participants).toBe(5);
      expect(result.commitments.length).toBe(3); // threshold coefficients
    });

    test("accepts custom participant IDs", () => {
      const result = engine.dealSecret({
        sessionId: "s1",
        secret: crypto.randomBytes(32),
        threshold: 2,
        participants: 3,
        participantIds: ["alpha", "beta", "gamma"],
      });
      expect(result.participantIds).toEqual(["alpha", "beta", "gamma"]);
    });

    test("rejects null config", () => {
      expect(() => engine.dealSecret(null)).toThrow(HsmAdapterError);
    });

    test("rejects missing sessionId", () => {
      expect(() =>
        engine.dealSecret({
          secret: crypto.randomBytes(32),
          threshold: 2,
          participants: 3,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects duplicate sessionId", () => {
      engine.dealSecret({
        sessionId: "s1",
        secret: crypto.randomBytes(32),
        threshold: 2,
        participants: 3,
      });
      expect(() =>
        engine.dealSecret({
          sessionId: "s1",
          secret: crypto.randomBytes(32),
          threshold: 2,
          participants: 3,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects non-Buffer secret", () => {
      expect(() =>
        engine.dealSecret({
          sessionId: "s1",
          secret: "not-a-buffer",
          threshold: 2,
          participants: 3,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects threshold below minimum", () => {
      expect(() =>
        engine.dealSecret({
          sessionId: "s1",
          secret: crypto.randomBytes(32),
          threshold: 1,
          participants: 3,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects participants < threshold", () => {
      expect(() =>
        engine.dealSecret({
          sessionId: "s1",
          secret: crypto.randomBytes(32),
          threshold: 5,
          participants: 3,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects too many participants", () => {
      expect(() =>
        engine.dealSecret({
          sessionId: "s1",
          secret: crypto.randomBytes(32),
          threshold: 2,
          participants: 20,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects participant ID mismatch", () => {
      expect(() =>
        engine.dealSecret({
          sessionId: "s1",
          secret: crypto.randomBytes(32),
          threshold: 2,
          participants: 3,
          participantIds: ["a", "b"],
        }),
      ).toThrow(HsmAdapterError);
    });
  });

  describe("verifyShare", () => {
    test("verifies a valid share", () => {
      engine.dealSecret({
        sessionId: "s1",
        secret: crypto.randomBytes(32),
        threshold: 3,
        participants: 5,
        participantIds: ["n1", "n2", "n3", "n4", "n5"],
      });
      const result = engine.verifyShare("s1", "n1");
      expect(result.verified).toBe(true);
      expect(result.status).toBe(SHARE_STATUS.VERIFIED);
    });

    test("rejects unknown session", () => {
      expect(() => engine.verifyShare("unknown", "n1")).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects unknown node", () => {
      engine.dealSecret({
        sessionId: "s1",
        secret: crypto.randomBytes(32),
        threshold: 2,
        participants: 3,
        participantIds: ["n1", "n2", "n3"],
      });
      expect(() => engine.verifyShare("s1", "unknown")).toThrow(
        HsmAdapterError,
      );
    });

    test("returns already-verified for re-verification", () => {
      engine.dealSecret({
        sessionId: "s1",
        secret: crypto.randomBytes(32),
        threshold: 2,
        participants: 3,
        participantIds: ["n1", "n2", "n3"],
      });
      engine.verifyShare("s1", "n1");
      const result = engine.verifyShare("s1", "n1");
      expect(result.alreadyVerified).toBe(true);
    });
  });

  describe("fileComplaint", () => {
    test("files a complaint", () => {
      engine.dealSecret({
        sessionId: "s1",
        secret: crypto.randomBytes(32),
        threshold: 2,
        participants: 3,
        participantIds: ["n1", "n2", "n3"],
      });
      const result = engine.fileComplaint("s1", "n1", "n2", "invalid share");
      expect(result.totalComplaints).toBe(1);
    });

    test("rejects unknown session", () => {
      expect(() => engine.fileComplaint("unknown", "n1", "n2")).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects unknown complainant", () => {
      engine.dealSecret({
        sessionId: "s1",
        secret: crypto.randomBytes(32),
        threshold: 2,
        participants: 3,
        participantIds: ["n1", "n2", "n3"],
      });
      expect(() => engine.fileComplaint("s1", "unknown", "n2")).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects unknown accused", () => {
      engine.dealSecret({
        sessionId: "s1",
        secret: crypto.randomBytes(32),
        threshold: 2,
        participants: 3,
        participantIds: ["n1", "n2", "n3"],
      });
      expect(() => engine.fileComplaint("s1", "n1", "unknown")).toThrow(
        HsmAdapterError,
      );
    });
  });

  describe("disqualifyNode", () => {
    test("disqualifies a node", () => {
      engine.dealSecret({
        sessionId: "s1",
        secret: crypto.randomBytes(32),
        threshold: 2,
        participants: 3,
        participantIds: ["n1", "n2", "n3"],
      });
      const result = engine.disqualifyNode("s1", "n3", "byzantine behavior");
      expect(result.disqualified).toBe(true);
      const info = engine.getShareInfo("s1", "n3");
      expect(info.status).toBe(SHARE_STATUS.INVALID);
    });

    test("rejects unknown session", () => {
      expect(() => engine.disqualifyNode("unknown", "n1")).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects unknown node", () => {
      engine.dealSecret({
        sessionId: "s1",
        secret: crypto.randomBytes(32),
        threshold: 2,
        participants: 3,
        participantIds: ["n1", "n2", "n3"],
      });
      expect(() => engine.disqualifyNode("s1", "unknown")).toThrow(
        HsmAdapterError,
      );
    });
  });

  describe("reconstructSecret", () => {
    test("reconstructs the secret from verified shares", () => {
      const secret = crypto.randomBytes(32);
      engine.dealSecret({
        sessionId: "s1",
        secret,
        threshold: 3,
        participants: 5,
        participantIds: ["n1", "n2", "n3", "n4", "n5"],
      });
      // Verify shares
      engine.verifyShare("s1", "n1");
      engine.verifyShare("s1", "n2");
      engine.verifyShare("s1", "n3");
      // Reconstruct
      const result = engine.reconstructSecret("s1", ["n1", "n2", "n3"]);
      expect(result.status).toBe(VSS_STATUS.COMPLETED);
      expect(result.secret.equals(secret)).toBe(true);
    });

    test("rejects insufficient shares", () => {
      engine.dealSecret({
        sessionId: "s1",
        secret: crypto.randomBytes(32),
        threshold: 3,
        participants: 5,
        participantIds: ["n1", "n2", "n3", "n4", "n5"],
      });
      expect(() => engine.reconstructSecret("s1", ["n1", "n2"])).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects unknown session", () => {
      expect(() => engine.reconstructSecret("unknown", ["n1"])).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects disqualified node", () => {
      engine.dealSecret({
        sessionId: "s1",
        secret: crypto.randomBytes(32),
        threshold: 2,
        participants: 3,
        participantIds: ["n1", "n2", "n3"],
      });
      engine.disqualifyNode("s1", "n3");
      expect(() => engine.reconstructSecret("s1", ["n1", "n3"])).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects expired share", () => {
      const epoch = engine.startEpoch();
      engine.dealSecret({
        sessionId: "s1",
        secret: crypto.randomBytes(32),
        threshold: 2,
        participants: 3,
        participantIds: ["n1", "n2", "n3"],
        epochId: epoch.epochId,
      });
      engine.verifyShare("s1", "n1");
      engine.verifyShare("s1", "n2");
      engine.expireEpoch(epoch.epochId);
      expect(() => engine.reconstructSecret("s1", ["n1", "n2"])).toThrow(
        HsmAdapterError,
      );
    });
  });

  describe("refreshShares", () => {
    test("refreshes shares for a new epoch", () => {
      const epoch1 = engine.startEpoch();
      const secret = crypto.randomBytes(32);
      engine.dealSecret({
        sessionId: "s1",
        secret,
        threshold: 3,
        participants: 5,
        participantIds: ["n1", "n2", "n3", "n4", "n5"],
        epochId: epoch1.epochId,
      });
      // Verify shares in epoch 1
      engine.verifyShare("s1", "n1");
      engine.verifyShare("s1", "n2");
      // Start epoch 2 and refresh
      const epoch2 = engine.startEpoch();
      const result = engine.refreshShares("s1", epoch2.epochId);
      expect(result.refreshed).toBe(true);
      // Shares should be pending again
      const info = engine.getShareInfo("s1", "n1");
      expect(info.status).toBe(SHARE_STATUS.PENDING);
      // Verify and reconstruct should still work
      engine.verifyShare("s1", "n1");
      engine.verifyShare("s1", "n2");
      engine.verifyShare("s1", "n3");
      const recon = engine.reconstructSecret("s1", ["n1", "n2", "n3"]);
      expect(recon.secret.equals(secret)).toBe(true);
    });

    test("rejects when proactive refresh disabled", () => {
      const disabled = new VssPssEngine({ enableProactiveRefresh: false });
      disabled.dealSecret({
        sessionId: "s1",
        secret: crypto.randomBytes(32),
        threshold: 2,
        participants: 3,
      });
      expect(() => disabled.refreshShares("s1", "e1")).toThrow(HsmAdapterError);
    });

    test("rejects unknown session", () => {
      engine.startEpoch();
      expect(() => engine.refreshShares("unknown", "e1")).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects unknown epoch", () => {
      engine.dealSecret({
        sessionId: "s1",
        secret: crypto.randomBytes(32),
        threshold: 2,
        participants: 3,
      });
      expect(() => engine.refreshShares("s1", "unknown")).toThrow(
        HsmAdapterError,
      );
    });
  });

  describe("recoverShare", () => {
    test("recovers a compromised share", () => {
      engine.dealSecret({
        sessionId: "s1",
        secret: crypto.randomBytes(32),
        threshold: 3,
        participants: 5,
        participantIds: ["n1", "n2", "n3", "n4", "n5"],
      });
      const result = engine.recoverShare("s1", "n3", ["n1", "n2", "n4"]);
      expect(result.recovered).toBe(true);
      const info = engine.getShareInfo("s1", "n3");
      expect(info.status).toBe(SHARE_STATUS.PENDING);
    });

    test("rejects unknown session", () => {
      expect(() => engine.recoverShare("unknown", "n1", ["n2", "n3"])).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects unknown node", () => {
      engine.dealSecret({
        sessionId: "s1",
        secret: crypto.randomBytes(32),
        threshold: 2,
        participants: 3,
        participantIds: ["n1", "n2", "n3"],
      });
      expect(() => engine.recoverShare("s1", "unknown", ["n1", "n2"])).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects insufficient helpers", () => {
      engine.dealSecret({
        sessionId: "s1",
        secret: crypto.randomBytes(32),
        threshold: 3,
        participants: 5,
        participantIds: ["n1", "n2", "n3", "n4", "n5"],
      });
      expect(() => engine.recoverShare("s1", "n3", ["n1"])).toThrow(
        HsmAdapterError,
      );
    });
  });

  describe("getSession", () => {
    test("returns session metadata", () => {
      engine.dealSecret({
        sessionId: "s1",
        secret: crypto.randomBytes(32),
        threshold: 2,
        participants: 3,
        participantIds: ["n1", "n2", "n3"],
      });
      const session = engine.getSession("s1");
      expect(session).not.toBeNull();
      expect(session.sessionId).toBe("s1");
      expect(session.threshold).toBe(2);
    });

    test("returns null for unknown session", () => {
      expect(engine.getSession("unknown")).toBeNull();
    });
  });

  describe("getShareInfo", () => {
    test("returns share metadata", () => {
      engine.dealSecret({
        sessionId: "s1",
        secret: crypto.randomBytes(32),
        threshold: 2,
        participants: 3,
        participantIds: ["n1", "n2", "n3"],
      });
      const info = engine.getShareInfo("s1", "n1");
      expect(info).not.toBeNull();
      expect(info.nodeId).toBe("n1");
      expect(info.index).toBe(1);
    });

    test("returns null for unknown node", () => {
      engine.dealSecret({
        sessionId: "s1",
        secret: crypto.randomBytes(32),
        threshold: 2,
        participants: 3,
        participantIds: ["n1", "n2", "n3"],
      });
      expect(engine.getShareInfo("s1", "unknown")).toBeNull();
    });
  });

  describe("getEpoch", () => {
    test("returns epoch info", () => {
      const epoch = engine.startEpoch();
      const info = engine.getEpoch(epoch.epochId);
      expect(info).not.toBeNull();
      expect(info.epochId).toBe(epoch.epochId);
      expect(info.number).toBe(1);
    });

    test("returns null for unknown epoch", () => {
      expect(engine.getEpoch("unknown")).toBeNull();
    });
  });

  describe("getEpochs", () => {
    test("returns all epochs", () => {
      engine.startEpoch();
      engine.startEpoch();
      expect(engine.getEpochs().length).toBe(2);
    });
  });

  describe("getCompletedSessions", () => {
    test("returns completed sessions", () => {
      const secret = crypto.randomBytes(32);
      engine.dealSecret({
        sessionId: "s1",
        secret,
        threshold: 2,
        participants: 3,
        participantIds: ["n1", "n2", "n3"],
      });
      engine.verifyShare("s1", "n1");
      engine.verifyShare("s1", "n2");
      engine.reconstructSecret("s1", ["n1", "n2"]);
      expect(engine.getCompletedSessions().length).toBe(1);
    });
  });

  describe("getStats", () => {
    test("returns summary statistics", () => {
      engine.dealSecret({
        sessionId: "s1",
        secret: crypto.randomBytes(32),
        threshold: 2,
        participants: 3,
      });
      const stats = engine.getStats();
      expect(stats.activeSessions).toBe(1);
      expect(stats.totalEpochs).toBe(0);
    });
  });

  describe("reset", () => {
    test("clears all state", () => {
      engine.dealSecret({
        sessionId: "s1",
        secret: crypto.randomBytes(32),
        threshold: 2,
        participants: 3,
      });
      engine.startEpoch();
      engine.reset();
      expect(engine.getStats().activeSessions).toBe(0);
      expect(engine.getStats().totalEpochs).toBe(0);
    });
  });

  describe("full VSS + PSS flow", () => {
    test("complete deal -> verify -> refresh -> reconstruct flow", () => {
      const secret = crypto.randomBytes(32);
      // Start epoch 1
      const epoch1 = engine.startEpoch();
      // Deal secret with VSS
      engine.dealSecret({
        sessionId: "treasury",
        secret,
        threshold: 3,
        participants: 5,
        participantIds: [
          "enclave-a",
          "enclave-b",
          "enclave-c",
          "enclave-d",
          "enclave-e",
        ],
        epochId: epoch1.epochId,
      });
      // Verify shares in epoch 1
      for (const node of ["enclave-a", "enclave-b", "enclave-c"]) {
        const v = engine.verifyShare("treasury", node);
        expect(v.verified).toBe(true);
      }
      // Expire epoch 1 and start epoch 2 (proactive refresh)
      engine.expireEpoch(epoch1.epochId);
      const epoch2 = engine.startEpoch();
      // Refresh shares for epoch 2
      const refresh = engine.refreshShares("treasury", epoch2.epochId);
      expect(refresh.refreshed).toBe(true);
      // Verify refreshed shares
      for (const node of ["enclave-a", "enclave-b", "enclave-c"]) {
        const v = engine.verifyShare("treasury", node);
        expect(v.verified).toBe(true);
      }
      // Reconstruct secret from refreshed shares
      const result = engine.reconstructSecret("treasury", [
        "enclave-a",
        "enclave-b",
        "enclave-c",
      ]);
      expect(result.secret.equals(secret)).toBe(true);
      // Verify stats
      const stats = engine.getStats();
      expect(stats.completedSessions).toBe(1);
      expect(stats.totalEpochs).toBe(2);
    });
  });
});
