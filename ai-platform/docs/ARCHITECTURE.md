# Simplebeacon Platform Architecture

## Overview

The Simplebeacon Platform is a modular AI safety scanning and audit platform built with Node.js, Express, and PostgreSQL.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Web UI     │  │    CLI       │  │   MCP Server │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
└─────────┼─────────────────┼─────────────────┼────────────┘
          │                 │                 │
┌─────────┼─────────────────┼─────────────────┼────────────┐
│         │                 │                 │            │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐  │
│  │  REST API    │  │  REST API    │  │  REST API    │  │
│  │  (/api/auth) │  │ (/api/scan)  │  │ (/api/analyze│  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │            │
│  ┌──────┴─────────────────┴─────────────────┴───────┐   │
│  │              Express Server (Node.js)              │   │
│  │         ┌─────────┐    ┌─────────┐               │   │
│  │         │  Auth   │    │  Scan   │               │   │
│  │         │Middleware│    │ Engine  │               │   │
│  │         └────┬────┘    └────┬────┘               │   │
│  └──────────────┼──────────────┼────────────────────┘   │
│                 │              │                         │
│  ┌──────────────┼──────────────┼────────────────────┐   │
│  │              Data Layer                              │   │
│  │         ┌─────────┐    ┌─────────┐               │   │
│  │         │PostgreSQL│    │  Redis  │               │   │
│  │         │(Reports)│    │ (Cache) │               │   │
│  │         └─────────┘    └─────────┘               │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Authentication System
- JWT-based authentication with refresh tokens
- Vault authentication for local development
- Role-based access control (RBAC)

### 2. Scan Engine
- Multi-engine analysis pipeline
- File system walker with path safety validation
- Pattern matching for credentials, leaks, fiction KPI

### 3. Dashboard
- Real-time metrics and analytics
- Interactive scan results visualization
- Audit trail and compliance reporting

### 4. CI/CD Integration
- GitHub Actions workflows
- Automated hygiene gates
- Coverage reporting with Istanbul

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS, HTML5, CSS3 |
| Backend | Node.js, Express |
| Database | PostgreSQL, Redis |
| Testing | Jest, node:test |
| CI/CD | GitHub Actions |
| Deployment | Docker Compose |

## Security Features

- HTTPS enforcement
- Security headers (Helmet)
- Rate limiting
- Input validation and sanitization
- Path safety checks
- Secret management with environment variables

## Data Flow

1. **Scan Request** → API Gateway → Auth Check
2. **File System Walk** → Pattern Matching → Rule Engine
3. **Results Aggregation** → Database Storage → Cache
4. **Dashboard Update** → Real-time Metrics → User Notification

## Deployment Architecture

```
Production Environment:
- Docker Compose with PostgreSQL and Redis
- Cloudflare Tunnel for secure access
- Environment-specific configuration
- Health checks and monitoring
```

## Configuration

Key configuration files:
- `.env.v1-internal` - Development environment
- `.env.production` - Production environment
- `docker-compose.phase2.yml` - Infrastructure services
- `jest.config.js` - Test configuration

## Track 4 — Architecture Ledger

**Audience / confidentiality:** Internal engineering wiki. Not for external distribution.

## 1. Distributed Multi-Node Cluster Keyring Sync (Track 2)

* Mechanism: Deterministic leader election via lowest active NODE_ID string matching. State synchronization operates over tls socket streaming using length-prefixed (UInt32BE) JSON framing under a strict 1 MB maximum payload ceiling to mitigate denial-of-service vulnerabilities.
* Consistency: Requires an active majority quorum to finalize state operations. Partitioned minority rings explicitly fail-closed, blocking administrative configurations to prevent state divergence.

## 2. Cold Archive Streaming Search & Forensic Parser (Track 3)

* Mechanism: Employs sequential, line-by-line decompression streams using native zlib capabilities on .json.gz and .ndjson.gz log archives.
* Performance: Enforces strict limit/offset parameters, scanning historical archives with bounded O(1) memory consumption, avoiding large array buffering in heap space.

## 3. Multi-Tenant HSM Virtualization & Tokenization (Track 4)

* Mechanism: Implements cryptographically isolated tenant namespaces derived on-demand through HKDF-SHA256, utilizing the organization's unique identifier (orgId) as salt against the core HSM master key block.
* Resilience: Operates a strict non-cached derivation process to ensure zero persistence of derived secrets in long-lived memory spaces. Under simulation latency spikes exceeding HSM_TIMEOUT_MS, the engine drops into a non-fallback, fail-closed HsmTimeoutError exception.

## Security and Compliance Framework Cross-Reference

| Implementation Feature | SOC 2 (Trust Services Criteria) | NIST SP 800-53 (Rev. 5) |
|---|---|---|
| HKDF-SHA256 Namespace Derivation | CC6.1, CC6.3 (Logical Segregation) | SC-28 (Protection of Information at Rest) |
| Fail-Closed HSM Timeout Framework | CC7.1 (Vulnerability & Threat Management) | SI-16 (Memory Protection / Failure State) |
| Quorum Cluster Agreement Logic | CC5.2 (Change Management Control) | CM-3 (Configuration Change Control) |
| Line-by-Line GZIP Forensic Stream | CC2.1 (System Monitoring & Operations) | AU-6 (Audit Record Review and Analysis) |
| Admin Endpoint IP/Subnet Throttling | CC6.6 (Boundary Protection) | AC-2, SC-7 (Access Control / Boundary Protection) |
| Auth-Before-Throttle Middleware Ordering | CC6.1 (Logical Access) | AC-3 (Access Enforcement) |
| Redis-Backed Distributed Token Bucket | CC7.2 (System Monitoring) | SI-4 (System Monitoring) |
| In-Memory Fallback with Inherited Count | CC7.4 (Resilience) | CP-10 (System Recovery) |
| Auto-Recovery on Redis Reconnect | CC7.4 (Resilience) | CP-10 (System Recovery) |
| Hybrid KEM (ECDH + ML-KEM-768) Handshake | CC6.7 (Transmission Protection) | SC-12, SC-13 (Cryptographic Key Establishment) |
| Key-Confirmation MAC (HMAC-SHA256) | CC6.1 (Logical Access) | IA-7 (Cryptographic Authentication) |
| Quantum Downgrade Rejection | CC6.6 (Boundary Protection) | SC-12 (Cryptographic Key Establishment) |
| PFS Re-key HKDF Ratchet | CC6.7 (Transmission Protection) | SC-12, SC-13 (Cryptographic Key Establishment) |
| Outbound Queue Suspension during Re-key | CC7.4 (Resilience) | CP-10 (System Recovery) |
| MitM Penetration Test Suite | CC7.1 (Vulnerability Management) | CA-8 (Penetration Testing) |

## 4. Advanced Defense Automation — IP/Subnet Throttling (Track 5)

* Mechanism: Implements a token-bucket rate limiter (`lib/admin-throttle.cjs`) with per-IP and per-subnet (/24 IPv4, /64 IPv6) buckets. Default capacity is 20 tokens with a leak rate of 5 tokens/second, configurable via `ADMIN_THROTTLE_CAPACITY` and `ADMIN_THROTTLE_LEAK_RATE` environment variables.
* Distributed State: Token buckets are stored in Redis for cluster-wide consistency. A Lua script performs atomic check-and-decrement operations to prevent race conditions under concurrent admin requests.
* Fail-Closed Fallback: On Redis failure, the throttle falls back to in-memory state, inheriting the last known token count from a pre-failure snapshot. If no prior state is available, it starts from a 25% reserve (not a full bucket) to avoid opening the floodgates during a cold start.
* Auto-Recovery: The `usingRedis` flag is temporarily disabled on Redis errors and automatically restored when the ioredis client emits a `'ready'` event on reconnection. A `_probeRedisHealth()` function is also exported for manual health checks.
* Middleware Ordering: In `hsm-vault-routes.cjs`, `authorize('admin:all')` runs before `adminThrottle` via the `authBeforeThrottle` wrapper, ensuring unauthenticated requests are rejected with 403 before consuming throttle tokens. In `audit-routes.cjs`, non-admin routes (`/log`, `/stats`, `/export`, `/partition-status`, `/verify-stream`) are excluded from throttling via `NON_ADMIN_AUDIT_PATHS`.
* Penalty System: The middleware monitors response status codes and drains the token bucket on `423 Locked`, `403 Forbidden` (isolation violation), and `503 Service Unavailable` (HSM timeout) responses, providing automatic defense against brute-force admin operations.

## 5. Quantum-Resistant KEM Hybrid Handshake (Track 6)

* Mechanism: Combines classical ECDH (X25519) with post-quantum ML-KEM-768 (NIST FIPS 203) to derive a shared session key for cluster keyring replication. The handshake is performed over the existing TLS/TCP transport when `CLUSTER_QUANTUM_HYBRID=1` is set.
* Cryptographic Primitive: ML-KEM-768 via the `mlkem` npm package (v2.7.0), vendored through `lib/vendor/mlkem.cjs`. Public keys are 1184 bytes, secret keys 2400 bytes, ciphertexts 1088 bytes, shared secrets 32 bytes.
* Secret Combination: `PRK = HKDF-Extract(salt="simplebeacon:hybrid:v1", IKM = ECDH_Secret || ML-KEM_Secret)`, then `SessionKeyRing = HKDF-Expand(PRK, info="session:keyring", L=32)`.
* Key-Confirmation MAC: After deriving the session key, the server includes `HMAC-SHA256(sessionKey, "server-confirmation")` in its response. The client verifies this MAC to detect replay attacks, ciphertext substitution, and key mismatches that ML-KEM's implicit fail-closed decapsulation would otherwise absorb silently.
* Downgrade Protection: Fail-closed by default. Legacy nodes that omit `EK_pq` are rejected and emit `quantum_downgrade_rejected`. Setting `QUANTUM_DEGRADE_ALLOWED=1` permits classic-only with a `quantum_downgrade` audit event.
* Protocol: Length-prefixed JSON over the existing socket. Client sends `{ ek_classic, ek_pq }`, server responds with `{ c_classic, c_pq, mac }`. Both sides derive the same 32-byte session key.

## 6. Automated MitM Penetration Testing (Track 7)

* Mechanism: A mocked `EventEmitter` socket pair with a byte-level man-in-the-middle shim that supports `clientToServer` and `serverToClient` mutation callbacks for injecting faults into the hybrid KEM handshake.
* Fault Vectors: Public key bit-flip, ciphertext truncation, ciphertext substitution/replay, length-prefix fuzzing, full-handshake replay, forced downgrade strip, and classic-secret desync.
* Audit Verification: Rejected attacks record `quantum_downgrade_rejected` via `cluster-keyring-sync._recordEvent`. The test suite verifies both cryptographic rejection (MAC mismatch) and audit timeline visibility.
* Key-Confirmation Hardening: The MAC confirmation step added in Track 6 causes all active manipulation attacks (L2-01, L2-03, L2-05, L2-07) to be detected and rejected cleanly, rather than silently producing mismatched keys. Tests assert rejection with `MAC mismatch` error messages.

## 7. Ephemeral Session Perfect Forward Secrecy (Track 8)

* Mechanism: Mid-stream re-keying using an HKDF ratchet for forward secrecy. The `HybridSession` class manages state transitions between `IDLE`, `ACTIVE`, and `REKEYING` states, with automatic re-key at a configurable interval (`REKEY_INTERVAL_SEC`, default 3600s).
* Ratchet: `newRoot = HKDF-Extract(salt="simplebeacon:pfs:v1", IKM = prevRoot || newECDHSecret || newMLKEMSecret)`, then `sessionKey = HKDF-Expand(newRoot, info="pfs:root", L=32)`. Each re-key generates fresh X25519 and ML-KEM-768 ephemeral keypairs.
* Protocol: In-band `REKEY_INIT` / `REKEY_RESP` / `REKEY_ACK` control frames over the existing length-prefixed JSON stream. Each frame includes a transcript MAC (`HMAC-SHA256(rootKey, label || extras)`) to detect tampering.
* Suspension State: During `REKEYING`, outbound data frames are queued in `writeQueue` and flushed after the new key is confirmed. Inbound data frames are buffered until the re-key completes. This prevents data transmission under an unconfirmed key.
* Forward Secrecy: Compromise of a past session root does not compromise future roots, because each ratchet step mixes in fresh ECDH and ML-KEM secrets that are not derivable from the compromised root. Break-in recovery is guaranteed once a single clean re-key completes with fresh ephemerals.
* Bounded Queue: The `writeQueue` is bounded by `MAX_QUEUE_BYTES` (default 16 MB). If the queue exceeds this limit during an extended re-key, a `QueueFullError` is thrown and the session is torn down to prevent unbounded memory growth.
