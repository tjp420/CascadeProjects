# Test Plan — Track 51 Homomorphic Encryption Over Mesh Topologies

**Branch:** `feature/track51-he-mesh-topology`
**Date:** 2026-08-02
**Status:** Active

## Objective

Route encrypted queries across a mesh of enclaves, performing homomorphic evaluation at each hop without decrypting the data. Supports additive and multiplicative HE operations, mesh topology construction, shortest-path routing, and encrypted query plans.

## Change Set

| File | Change |
|------|--------|
| server/lib/hsm-adapter/he-mesh-topology.cjs | New — HeMeshTopology class (602 lines) |
| server/lib/hsm-adapter/hsm-metrics.cjs | Added 9 Track 51 counters |
| server/lib/hsm-adapter/__tests__/he-mesh-topology.test.cjs | New — 53 tests |
| .simplebeacon/qa/test_plan.md | Updated |
| .simplebeacon/qa/software_health_report.md | Updated |

## Architecture

- **MeshTopologyManager**: Builds and maintains enclave mesh graph with nodes and edges
- **HeQueryRouter**: Routes encrypted queries via Dijkstra shortest-path algorithm
- **HeEvaluationEngine**: Performs homomorphic ops (add, subtract, scalar-mul, multiply, compare) at each hop
- **EncryptedQueryPlanner**: Creates multi-hop evaluation plans with operation scheduling
- **MeshNodeRegistry**: Tracks enclave nodes with HE scheme capabilities and status

## Check Items

### Level 1 - Deterministic
- [x] L1.1 node -c all modified JS files - PASS
- [x] L1.2 53 new Track 51 tests pass
- [x] L1.3 278 existing tests pass (no regression)
- [x] L1.4 No new dependencies

### Level 2 - Functional
- [x] L2.01 registerNode (6 tests)
- [x] L2.02 unregisterNode (3 tests)
- [x] L2.03 addEdge (4 tests)
- [x] L2.04 removeEdge (2 tests)
- [x] L2.05 findShortestPath (7 tests)
- [x] L2.06 createQueryPlan (9 tests)
- [x] L2.07 executeQuery (9 tests)
- [x] L2.08 getQuery (3 tests)
- [x] L2.09 getActiveQueries (1 test)
- [x] L2.10 getCompletedQueries (1 test)
- [x] L2.11 checkExpiredQueries (1 test)
- [x] L2.12 updateNodeStatus (3 tests)
- [x] L2.13 getStats (1 test)
- [x] L2.14 getNodes (1 test)
- [x] L2.15 getEdges (1 test)
- [x] L2.16 reset (1 test)
- [x] L2.17 full mesh query flow (1 test)

### Level 3 - Security
- [x] L3.01 No secrets exposed
- [x] L3.02 No scope creep
- [x] L3.03 No regression
