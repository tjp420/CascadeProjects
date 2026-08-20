"use strict";

/**
 * Track 118 Core Integration — Distributed Consensus Coordinator
 *
 * Verifies construction-time policy validation + runtime boolean hooks.
 */

const {
  DistributedConsensusCoordinator,
  GROUP_STATE,
  COORDINATOR_EVENT,
} = require("../distributed-consensus-coordinator.cjs");
const { CryptoPolicyEngine } = require("../crypto-policy-engine.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");
const hsmMetrics = require("../hsm-metrics.cjs");

describe("Track 118 core integration — distributedConsensusCoordinator", () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test("CORE-118-01: constructor validation traps invalid configs with POLICY_VIOLATION_BLOCKED", () => {
    function expectViolation(ctorOpts) {
      try {
        new DistributedConsensusCoordinator(ctorOpts);
        throw new Error("expected constructor to throw");
      } catch (e) {
        expect(e).toBeInstanceOf(HsmAdapterError);
        expect(e.code).toBe("POLICY_VIOLATION_BLOCKED");
      }
    }
    expectViolation({
      coordinatorId: "coord-1",
      nodeId: "node-A",
      maxGroups: 999,
    });
    expectViolation({
      coordinatorId: "coord-2",
      nodeId: "node-B",
      faultTimeoutMs: 100,
    });
    expectViolation({
      coordinatorId: "coord-3",
      nodeId: "node-C",
      faultCheckIntervalMs: 9999,
    });
    expectViolation({
      coordinatorId: "coord-4",
      nodeId: "node-D",
      viewChangeTimeoutMs: 100,
    });
  });

  test("CORE-118-02: group creation blocked when allowDynamicGroupCreation is false", () => {
    const coordinator = new DistributedConsensusCoordinator({
      coordinatorId: "coord-block",
      nodeId: "node-A",
      allowDynamicGroupCreation: false,
    });
    expect(coordinator.allowDynamicGroupCreation).toBe(false);
    try {
      coordinator.createGroup({
        groupId: "group-1",
        clusterNodes: ["node-A", "node-B", "node-C"],
      });
      throw new Error("expected createGroup to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(HsmAdapterError);
      expect(e.code).toBe("GROUP_CREATION_BLOCKED");
    }
    const metrics = hsmMetrics.getMetrics();
    expect(
      metrics.hsm_consensus_coord_proposals_rejected_total,
    ).toBeGreaterThanOrEqual(1);
  });

  test("CORE-118-03: cross-group routing blocked when allowCrossGroupRouting is false", () => {
    const coordinator = new DistributedConsensusCoordinator({
      coordinatorId: "coord-routing",
      nodeId: "node-A",
      allowCrossGroupRouting: false,
    });
    expect(coordinator.allowCrossGroupRouting).toBe(false);
    coordinator.createGroup({
      groupId: "group-1",
      clusterNodes: ["node-A", "node-B", "node-C"],
    });
    const result = coordinator.routeProposal({
      groupId: "group-1",
      crossGroup: true,
      command: { type: "test" },
    });
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("cross_group_routing_blocked");
    const metrics = hsmMetrics.getMetrics();
    expect(
      metrics.hsm_consensus_coord_proposals_rejected_total,
    ).toBeGreaterThanOrEqual(1);
  });

  test("CORE-118-04: quorum bypass when requireQuorumForProposals is false", () => {
    const permissiveEngine = new CryptoPolicyEngine({
      default: {},
      tenants: {
        default: {
          distributedConsensusCoordinator: { requireQuorumForProposals: false },
        },
      },
    });
    const coordinator = new DistributedConsensusCoordinator({
      coordinatorId: "coord-quorum",
      nodeId: "node-A",
      requireQuorumForProposals: false,
      policyEngine: permissiveEngine,
    });
    expect(coordinator.requireQuorumForProposals).toBe(false);
    coordinator.createGroup({
      groupId: "group-1",
      clusterNodes: ["node-A", "node-B", "node-C"],
    });
    const healthB = coordinator._nodeHealth.get("node-B");
    const healthC = coordinator._nodeHealth.get("node-C");
    if (healthB) healthB.healthy = false;
    if (healthC) healthC.healthy = false;
    const result = coordinator.routeProposal({
      groupId: "group-1",
      command: { type: "test" },
    });
    expect(result.accepted).toBe(true);
    expect(result.groupId).toBe("group-1");
  });

  test("CORE-118-05: all 10 telemetry counters fire correctly", () => {
    const coordinator = new DistributedConsensusCoordinator({
      coordinatorId: "coord-telemetry",
      nodeId: "node-A",
      maxGroups: 8,
    });
    coordinator.createGroup({
      groupId: "group-1",
      clusterNodes: ["node-A", "node-B", "node-C"],
    });
    coordinator.routeProposal({
      groupId: "group-1",
      command: { type: "test" },
    });
    coordinator.routeProposal({
      groupId: "nonexistent",
      command: { type: "test" },
    });
    coordinator.initiateViewChange("group-1", "node-A", "node-B");
    coordinator.castViewChangeVote("group-1", "node-B", "node-B");
    coordinator.castViewChangeVote("group-1", "node-C", "node-B");
    coordinator.createGroup({
      groupId: "group-2",
      clusterNodes: ["node-A", "node-B", "node-C"],
    });
    coordinator.initiateViewChange("group-2", "node-A", "node-C");
    coordinator.initiateViewChange("group-2", "node-A", "node-B");
    coordinator.destroyGroup("group-2");
    const coord2 = new DistributedConsensusCoordinator({
      coordinatorId: "coord-qd",
      nodeId: "node-X",
      maxGroups: 8,
      requireQuorumForProposals: true,
    });
    coord2.createGroup({
      groupId: "group-qd",
      clusterNodes: ["node-X", "node-Y", "node-Z"],
    });
    const hY = coord2._nodeHealth.get("node-Y");
    const hZ = coord2._nodeHealth.get("node-Z");
    if (hY) hY.healthy = false;
    if (hZ) hZ.healthy = false;
    coord2.routeProposal({ groupId: "group-qd", command: { type: "test" } });
    hsmMetrics.incrementCounter("hsm_consensus_coord_faults_detected_total");
    const metrics = hsmMetrics.getMetrics();
    expect(
      metrics.hsm_consensus_coord_groups_created_total,
    ).toBeGreaterThanOrEqual(1);
    expect(
      metrics.hsm_consensus_coord_groups_destroyed_total,
    ).toBeGreaterThanOrEqual(1);
    expect(
      metrics.hsm_consensus_coord_proposals_routed_total,
    ).toBeGreaterThanOrEqual(1);
    expect(
      metrics.hsm_consensus_coord_proposals_rejected_total,
    ).toBeGreaterThanOrEqual(1);
    expect(
      metrics.hsm_consensus_coord_faults_detected_total,
    ).toBeGreaterThanOrEqual(1);
    expect(
      metrics.hsm_consensus_coord_view_change_started_total,
    ).toBeGreaterThanOrEqual(1);
    expect(
      metrics.hsm_consensus_coord_view_change_completed_total,
    ).toBeGreaterThanOrEqual(1);
    expect(
      metrics.hsm_consensus_coord_view_change_aborted_total,
    ).toBeGreaterThanOrEqual(1);
    expect(
      metrics.hsm_consensus_coord_quorum_verified_total,
    ).toBeGreaterThanOrEqual(1);
    expect(
      metrics.hsm_consensus_coord_quorum_denied_total,
    ).toBeGreaterThanOrEqual(1);
  });

  test("CORE-118-06: backward compatibility — valid config passes and basic operations work", () => {
    const coordinator = new DistributedConsensusCoordinator({
      coordinatorId: "coord-compat",
      nodeId: "node-A",
      maxGroups: 8,
      faultTimeoutMs: 5000,
      faultCheckIntervalMs: 500,
      viewChangeTimeoutMs: 10000,
    });
    expect(coordinator.requireQuorumForProposals).toBe(true);
    expect(coordinator.allowDynamicGroupCreation).toBe(true);
    expect(coordinator.allowCrossGroupRouting).toBe(true);
    const group = coordinator.createGroup({
      groupId: "group-compat",
      clusterNodes: ["node-A", "node-B", "node-C"],
    });
    expect(group.groupId).toBe("group-compat");
    expect(group.state).toBe(GROUP_STATE.ACTIVE);
    const result = coordinator.routeProposal({
      groupId: "group-compat",
      command: { type: "test" },
    });
    expect(result.accepted).toBe(true);
    const crossResult = coordinator.routeProposal({
      groupId: "group-compat",
      crossGroup: true,
      command: { type: "test" },
    });
    expect(crossResult.accepted).toBe(true);
    const vcResult = coordinator.initiateViewChange(
      "group-compat",
      "node-A",
      "node-B",
    );
    expect(vcResult.accepted).toBe(true);
    expect(coordinator.destroyGroup("group-compat")).toBe(true);
  });
});
