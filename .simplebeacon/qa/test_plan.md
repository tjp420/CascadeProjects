# Test Plan: Confidential-Sandbox Memory Audit Hardening

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Harden confidential-sandbox memory lifecycle: size limits, buffer isolation, result zeroization, timeout enforcement, audit trail |
| Author (Builder) | Devin |
| Date | 2026-08-03 |
| Branch | `feat/sandbox-memory-audit` |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/confidential-sandbox-engine.cjs` *(harden memory lifecycle)*
- `ai-platform/server/lib/hsm-adapter/__tests__/sandbox-memory-audit.test.cjs` *(new test suite)*

### APIs / routes

- `Sandbox.setMemory(key, data)` — add size limit + buffer copy
- `Sandbox.getMemory(key)` — add audit trail
- `Sandbox.zeroize()` — also zeroize `_executionResult` and operation params
- `ConfidentialSandboxEngine.execute()` — enforce `maxExecutionTimeSeconds` timeout
- `Sandbox.getMemoryAuditLog()` — new: return memory access audit trail

### UI / IDE surfaces

- [ ] Not applicable — backend only

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on confidential-sandbox-engine.cjs | `node -c ai-platform/server/lib/hsm-adapter/confidential-sandbox-engine.cjs` | [ ] |
| L1-02 | Syntax on test file | `node -c ai-platform/server/lib/hsm-adapter/__tests__/sandbox-memory-audit.test.cjs` | [ ] |
| L1-03 | Sandbox memory audit tests | `cd ai-platform && npx jest sandbox-memory-audit --coverage=false` | [ ] |
| L1-04 | Regression: state-snapshot tests | `cd ai-platform && npx jest state-snapshot --coverage=false` | [ ] |
| L1-05 | Regression: IPC boundary tests | `cd ai-platform && npx jest ipc-boundary --coverage=false` | [ ] |
| L1-06 | Regression: epoch-frame tests | `cd ai-platform && npx jest epoch-frame --coverage=false` | [ ] |
| L1-07 | Regression: DKG gossip tests | `cd ai-platform && npx jest dkg-gossip --coverage=false` | [ ] |
| L1-08 | SimpleBeacon gate (full) | `npx simplebeacon scan --full --gate --format json` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | setMemory copies buffer (no external mutation) | Store a Buffer via setMemory, mutate the original, read back from sandbox | Sandbox's copy is unaffected | [ ] |
| L2-02 | setMemory rejects oversized buffer | Store a Buffer > MAX_MEMORY_ENTRY_BYTES (64KB) | Throws MEMORY_ENTRY_TOO_LARGE | [ ] |
| L2-03 | Memory entry count capped at MAX_MEMORY_ENTRIES (16) | Store 17 entries | 17th throws MEMORY_ENTRIES_FULL | [ ] |
| L2-04 | zeroize clears _executionResult | Execute 'derive', then zeroize, then check _executionResult | _executionResult is null, derivedKey buffer is zeroed | [ ] |
| L2-05 | zeroize clears operation params | Execute 'encrypt' with plaintext param, then zeroize | Plaintext param buffer is zeroed | [ ] |
| L2-06 | Timeout enforcement on execute | Create sandbox with maxExecutionTimeSeconds=0, execute | Throws SANDBOX_EXECUTION_TIMEOUT | [ ] |
| L2-07 | Memory access audit trail | setMemory + getMemory, then getMemoryAuditLog | Log contains set + get entries with key, timestamp, operation | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | setMemory with non-Buffer throws | setMemory('key', 'string') | Throws INVALID_MEMORY_TYPE | [ ] |
| L3-02 | setMemory with empty buffer is allowed | setMemory('key', Buffer.alloc(0)) | Succeeds, stored entry has 0 bytes | [ ] |
| L3-03 | getMemory on non-existent key returns undefined | getMemory('nonexistent') | Returns undefined | [ ] |
| L3-04 | Audit log capped at MAX_AUDIT_ENTRIES (50) | Perform 60 set+get operations, check audit log length | Log has 50 entries (ring buffer) | [ ] |
| L3-05 | Existing sandbox lifecycle unaffected | Create → attest → execute → zeroize → destroy | All states transition correctly | [ ] |
| L3-06 | Execution result zeroized on destroy | Execute, then destroy without explicit zeroize | _executionResult is null after destroy | [ ] |
| L3-07 | Multiple sandboxes have independent memory | Create 2 sandboxes, store different data in each | Each sandbox only sees its own data | [ ] |
| L3-08 | Zeroize is idempotent | Call zeroize twice | Second call does not throw | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | setMemory copies buffer to prevent external mutation | [ ] |
| S-02 | Memory entry size capped at 64KB | [ ] |
| S-03 | Memory entry count capped at 16 | [ ] |
| S-04 | Execution result zeroized on zeroize() | [ ] |
| S-05 | Operation params zeroized after execute() | [ ] |
| S-06 | Memory access audit trail recorded | [ ] |
| S-07 | Sandbox timeout enforced | [ ] |

---

## Implementation notes

### Constants

```javascript
const MAX_MEMORY_ENTRY_BYTES = 64 * 1024;  // 64 KB per entry
const MAX_MEMORY_ENTRIES = 16;              // max entries per sandbox
const MAX_AUDIT_ENTRIES = 50;               // ring buffer for memory audit log
```

### setMemory changes

```javascript
setMemory(key, data) {
  if (!Buffer.isBuffer(data)) {
    throw new HsmAdapterError('INVALID_MEMORY_TYPE', 'data must be a Buffer');
  }
  if (data.length > MAX_MEMORY_ENTRY_BYTES) {
    throw new HsmAdapterError('MEMORY_ENTRY_TOO_LARGE', `entry size ${data.length} exceeds max ${MAX_MEMORY_ENTRY_BYTES}`);
  }
  if (!this._memory.has(key) && this._memory.size >= MAX_MEMORY_ENTRIES) {
    throw new HsmAdapterError('MEMORY_ENTRIES_FULL', `memory entries limit ${MAX_MEMORY_ENTRIES} reached`);
  }
  // Copy buffer to prevent external mutation
  const copy = Buffer.allocUnsafe(data.length);
  data.copy(copy);
  this._memory.set(key, copy);
  this._memoryAuditLog.push({ op: 'set', key, size: copy.length, timestamp: Date.now() });
  if (this._memoryAuditLog.length > MAX_AUDIT_ENTRIES) this._memoryAuditLog.shift();
}
```

### getMemory changes

```javascript
getMemory(key) {
  const val = this._memory.get(key);
  this._memoryAuditLog.push({ op: 'get', key, timestamp: Date.now() });
  if (this._memoryAuditLog.length > MAX_AUDIT_ENTRIES) this._memoryAuditLog.shift();
  return val;
}
```

### zeroize changes

```javascript
zeroize() {
  for (const buf of this._memory.values()) {
    _secureZeroize(buf);
  }
  this._memory.clear();
  // Zeroize execution result
  if (this._executionResult) {
    for (const val of Object.values(this._executionResult)) {
      if (Buffer.isBuffer(val)) _secureZeroize(val);
    }
    this._executionResult = null;
  }
  this.state = SANDBOX_STATES.ZEROIZED;
}
```

### execute changes

- Track `_executionStartTime` and check against `maxExecutionTimeSeconds`
- Zeroize operation params after execution (for Buffer values in params)
- Store params reference for zeroization in zeroize()

---

## Approval

- [ ] User approved this plan
- Approved by: __________  Date: __________
