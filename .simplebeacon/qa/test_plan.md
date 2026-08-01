# test_plan.md

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Distributed Multi-Node Cluster Keyring Sync |
| Author (Builder) | Devin |
| Date | 2026-08-01 |
| Branch | main |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/cluster-keyring-sync.cjs` (new)
- `ai-platform/server/lib/key-rotation-store.cjs` (extend)
- `ai-platform/server/routes/audit-routes.cjs` (add status route)
- `ai-platform/server/lib/__tests__/cluster-keyring-sync.test.cjs` (new)

### APIs / routes

- `GET /api/audit/cluster/keyring` — cluster membership, leader, keyring state
- `POST /api/audit/cluster/keyring/rotate` — admin trigger of cluster-wide rotation (leader only)
- Cluster gossip protocol over TLS/TCP port `process.env.CLUSTER_KEYRING_PORT`

### UI / IDE surfaces

- [ ] Sidebar webview
- [x] Main dashboard iframe / address bar
- [ ] Welcome / main window panel
- [ ] Simple Browser / external browser

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on new `.cjs` | `node -c ai-platform/server/lib/cluster-keyring-sync.cjs` | [ ] |
| L1-02 | Existing key-rotation tests still pass | `cd ai-platform && npx jest --config jest.config.cjs key-rotation` | [ ] |
| L1-03 | New cluster sync tests pass | `cd ai-platform && npx jest --config jest.config.cjs cluster-keyring` | [ ] |
| L1-04 | Full platform test suite | `cd ai-platform && npm test` | [ ] |
| L1-05 | SimpleBeacon full gate | `node packages/simplebeacon-cli/bin/simplebeacon.js scan --full --gate --format json` | [ ] |
| L1-06 | No secrets in diff | `git diff --cached` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Three-node cluster forms | Start nodes A, B, C; A is leader (lowest NODE_ID) | All report same leader and keyring state | [ ] |
| L2-02 | Leader rotation propagates | Leader calls `rotate()` | Followers update active/previous key with same grace window | [ ] |
| L2-03 | Leader failure re-election | Kill A; B and C re-elect lowest available leader | No split-brain; keyring unchanged | [ ] |
| L2-04 | Dashboard shows cluster status | `GET /api/audit/cluster/keyring` | Returns `{ leader, members, activeFingerprint, previousFingerprint, rotatedAt }` | [ ] |
| L2-05 | Non-leader admin rotate is rejected | `POST /api/audit/cluster/keyring/rotate` on follower | 423 Locked with `error: not_leader` | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Network partition split-brain | Partition A vs B/C; each side has < majority | No new leader on minority side; no key material changes | [ ] |
| L3-02 | Non-leader receives local HSM rotate | Node receives HSM/HSM admin rotate event | Forwards to leader as `KEY_PROPOSE` or rejects; does not commit unilaterally | [ ] |
| L3-03 | Duplicate/old rotation ignored | Follower receives `KEY_COMMIT` with `rotatedAt <=` current | Ignored; idempotent | [ ] |
| L3-04 | Node rejoins after partition | Rejoining node reconciles with current leader | Catches up to latest committed keyring state | [ ] |
| L3-05 | Grace window preserved across nodes | Leader rotates with 24h grace | Followers use same `rotatedAt` and grace override | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No raw key material leaves node over network | Only fingerprints sent in cluster messages | [ ] |
| S-02 | mTLS required for cluster gossip | `CLUSTER_CA_CERT`, `CLUSTER_CERT`, `CLUSTER_KEY` env vars | [ ] |
| S-03 | Only `admin:all` can trigger cluster rotate | `authorize('admin:all')` on POST route | [ ] |
| S-04 | No credentials / PII in logs or commits | Gate and manual diff | [ ] |

---

## Answers to edge-case questions

### Split-brain during network partition
A node may only win leadership when it has a majority of the known cluster members in its reachable set. If a partition occurs, the side with fewer than `floor(N/2) + 1` nodes cannot promote a leader and must keep the previous leader (even unreachable) or remain leader-less. No keyring mutation is accepted without a leader with majority. This prevents two sub-clusters from rotating independently.

### Non-leader receives a local HSM/admin rotation
The non-leader must not commit the new key locally. It has two safe options:
1. **Forward as `KEY_PROPOSE`**: send the proposed new key fingerprint to the current leader, which runs the standard two-phase cluster commit.
2. **Reject locally**: return `error: not_leader` so the admin retries the rotation against the leader.

The implementation will use option 2 for the test plan (reject) and forward internally if we add a dashboard convenience later. This avoids any node holding a key that other nodes have not agreed on.

---

## Approval

- [ ] User approved this plan
