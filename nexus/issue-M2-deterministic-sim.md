# M2 — Deterministic Simulation Core + Checkpointing

**Summary**
Build a deterministic, replayable simulation core with checkpointing and rollback.

**Description**

- Deterministic engine API (step(), runUntil(), snapshot()).
- Checkpoint frames: immutable frames, delta-compressed storage.
- Rollback and validation harness to assert bit-exact replay.

**Estimate**: 25 person-days
**Complexity**: High
**Dependencies**: M1 (node model)

**Acceptance criteria**

- Able to run a simulation scenario and produce a checkpoint
- Replaying from the checkpoint reproduces identical output
- Storage layer supports efficient delta checkpointing

**Notes**
Prototype in a single process with pluggable storage adapter (local fs -> object store).
