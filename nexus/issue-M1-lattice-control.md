# M1 — Lattice Control API & Node Model

**Summary**
Implement core data model and control API for crystalline nodes. Nodes are the primary topology elements (stabilizer, tuner, amplifier, attenuator).

**Description**

- Data model: nodeID, type, resonanceProfile, state, links[], metadata.
- State machine: offline -> online -> tuning -> locked -> degraded -> annealing.
- API: CRUD nodes, attach/detach links, get topology, node actions (tune, anneal).

**Estimate**: 30 person-days
**Complexity**: High
**Dependencies**: none

**Acceptance criteria**

- Unit tests for state transitions
- REST API (OpenAPI v3) with endpoints for nodes and topology
- Integration test: create 3 nodes, link them, run tune operation and read state

**Notes**
Start with an in-memory implementation (Redis optional later). Design data model with future CRDT distribution in mind.
