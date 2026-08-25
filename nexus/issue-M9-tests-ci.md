# M9 — Test Harness, CI, and Smoke Tests

**Summary**
Scaffold test harness, CI pipelines, and reproducible smoke tests for core flows.

**Description**

- Unit test structure and guidelines.
- Integration test harness for simulation + lattice + ledger interactions.
- CI: GitHub Actions workflows for unit, integration, linting, and security scans.
- Smoke tests: end-to-end scenario (create nodes, run simulation, ledger entry).

**Estimate**: 12 person-days
**Complexity**: Medium
**Dependencies**: M1, M2, M4

**Acceptance criteria**

- CI pipeline runs on PRs with passing unit tests
- Integration test demonstrates end-to-end core flow
- Test artifacts stored for debugging

**Notes**
Use Docker Compose for local integration test environment; persist test artifacts under .ci/artifacts/.
