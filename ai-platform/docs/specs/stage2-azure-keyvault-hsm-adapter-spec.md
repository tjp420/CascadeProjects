# Stage 2 — Azure Key Vault Managed HSM Adapter Design Spec

> Design specification for the next-generation vendor HSM adapter targeting
> Azure Key Vault Managed HSM (FIPS 140-2 Level 3). This spec mirrors the
> validated `BaseHsmAdapter` contract from Stage 1 (Tracks 10-21) and maps
> each method to Azure SDK REST API operations.

## Metadata

| Field            | Value                                                                     |
| ---------------- | ------------------------------------------------------------------------- |
| Feature / change | Stage 2: Azure Key Vault Managed HSM Adapter                              |
| Author           | Devin                                                                     |
| Date             | 2026-08-01                                                                |
| Branch           | `feature/stage2-azure-keyvault-adapter` (to be created)                   |
| Packages touched | ai-platform                                                               |
| Target provider  | Azure Key Vault Managed HSM ( Dedicated HSM pool, FIPS 140-2 L3 )         |
| SDK packages     | `@azure/keyvault-keys`, `@azure/keyvault-certificates`, `@azure/identity` |
| Prerequisite     | PR #119 merged (Stage 1 tracks 10-21 on `main`)                           |

---

## 1. Architecture Overview

### 1.1 Design Goals

1. **Drop-in compatibility**: `AzureKeyVaultAdapter` extends `BaseHsmAdapter` and implements all 7 required `_`-prefixed hooks: `_initialize`, `_createKEK`, `_wrap`, `_unwrap`, `_rotateKEK`, `_listKEKs`, `_zeroize`.
2. **Hardware isolation**: All key material is generated and stored inside the Managed HSM pool. Plaintext KEK values never leave the HSM boundary — wrap/unwrap use server-side `wrapKey`/`unwrapKey` REST calls.
3. **Audit synchronicity**: Every SDK call is intercepted by `_audit()` under the existing action constants (`CREATE_KEK`, `WRAP`, `UNWRAP`, `ROTATE_KEK`, `KEY_ZEROIZED`, `KEY_EVICTED`).
4. **Tenant isolation**: KEK names are prefixed with `tenantId` to enforce per-tenant key namespacing at the Azure resource level.
5. **Graceful degradation**: If the Azure SDK is not installed or credentials are missing, the adapter throws `HsmAdapterError` with clear codes rather than crashing.

### 1.2 Class Hierarchy

```
BaseHsmAdapter (base-adapter.cjs)
├── SoftwareHsmAdapter   (in-process, fallback)
├── SoftHsmAdapter       (PKCS#11, Stage 1 CI)
└── AzureKeyVaultAdapter (NEW — Stage 2, cloud HSM)
```

### 1.3 Module Layout

```
ai-platform/server/lib/hsm-adapter/
├── azure-keyvault-adapter.cjs          (NEW — main adapter)
├── azure-credential-provider.cjs       (NEW — credential chain factory)
├── azure-audit-interceptor.cjs         (NEW — SDK call wrapper for audit)
└── __tests__/
    └── azure-keyvault-adapter.test.cjs (NEW — unit tests with mocked SDK)
```

---

## 2. Authentication & Connectivity

### 2.1 Credential Chain

Use `@azure/identity` `DefaultAzureCredential` with the following chain order:

1. **Managed Identity** — `ManagedIdentityCredential` for production Azure VMs / App Service / Container Apps.
2. **Service Principal** — `EnvironmentCredential` reading `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` from environment.
3. **Azure CLI** — `AzureCliCredential` for local development.
4. **Interactive Browser** — `InteractiveBrowserCredential` as last-resort fallback for local dev.

```javascript
// azure-credential-provider.cjs
const { DefaultAzureCredential } = require("@azure/identity");

function createCredential(options = {}) {
  // DefaultAzureCredential tries all of the above in order.
  // For Managed HSM, the credential must have the "Managed HSM Crypto User"
  // or "Managed HSM Crypto Officer" role assignment on the target pool.
  return new DefaultAzureCredential({
    tenantId: options.tenantId, // override for multi-tenant SP
    managedIdentityClientId: options.managedIdentityClientId, // user-assigned MI
  });
}
```

### 2.2 Configuration

```javascript
const adapter = new AzureKeyVaultAdapter({
  vaultUrl: "https://my-hsm.managedhsm.azure.net",
  credentialOptions: {
    managedIdentityClientId: process.env.AZURE_MANAGED_IDENTITY_CLIENT_ID,
  },
  // Optional: override default API version
  apiVersion: "7.5",
  // Optional: retry policy
  retryOptions: {
    maxRetries: 3,
    retryDelayInMs: 800,
  },
  // Standard BaseHsmAdapter options
  logger: console,
  policyEngine: myPolicyEngine,
  volatileEvictionEngine: myEvictionEngine,
  provenanceTracker: myProvenanceTracker,
});
```

### 2.3 Environment Variables

| Variable                           | Required | Description                                                       |
| ---------------------------------- | -------- | ----------------------------------------------------------------- |
| `AZURE_MANAGED_HSM_URL`            | Yes      | Managed HSM pool URL (e.g. `https://my-hsm.managedhsm.azure.net`) |
| `AZURE_TENANT_ID`                  | SP only  | Azure AD tenant ID for service principal auth                     |
| `AZURE_CLIENT_ID`                  | SP/MI    | Client ID (SP or user-assigned MI)                                |
| `AZURE_CLIENT_SECRET`              | SP only  | Client secret for service principal auth                          |
| `AZURE_MANAGED_IDENTITY_CLIENT_ID` | MI only  | User-assigned managed identity client ID                          |

### 2.4 Initialization Flow

```
initialize()
  └── _initialize()
       ├── createCredential() → DefaultAzureCredential
       ├── new KeyClient(vaultUrl, credential)
       ├── new CryptographyClient(vaultUrl, credential)
       ├── ping: keyClient.getPropertiesOfKey('healthcheck')
       │    └── if 404 → HSM reachable, no healthcheck key (OK)
       │    └── if 401 → AUTH_FAILURE
       │    └── if timeout → CONNECTION_FAILURE
       └── set _initialized = true
```

---

## 3. Cryptographic Mapping

### 3.1 Method-to-API Mapping

| Adapter Method                       | Azure SDK Call                                          | REST Endpoint                 | Algorithm                            |
| ------------------------------------ | ------------------------------------------------------- | ----------------------------- | ------------------------------------ |
| `_createKEK(tenantId, meta)`         | `keyClient.createKey(name, 'AES', { size: 256, tags })` | `PUT /keys/{name}`            | AES-256                              |
| `_wrap(tenantId, kekId, plaintext)`  | `cryptoClient.encrypt('A256KW', plaintext)`             | `POST /keys/{name}/wrapkey`   | A256KW (AES-KW with 256-bit KEK)     |
| `_unwrap(tenantId, kekId, wrapped)`  | `cryptoClient.decrypt('A256KW', wrapped)`               | `POST /keys/{name}/unwrapkey` | A256KW                               |
| `_rotateKEK(tenantId, oldKekId)`     | `keyClient.rotateKey(oldKekId)` + create new            | `POST /keys/{name}/rotate`    | AES-256                              |
| `_listKEKs(tenantId)`                | `keyClient.listPropertiesOfKeys()` filtered by tag      | `GET /keys`                   | —                                    |
| `_zeroize(tenantId, kekId)`          | `keyClient.beginDeleteKey(kekId)` + poll                | `DELETE /keys/{name}`         | —                                    |
| `exportKeyring(data, masterKek)`     | (inherited from BaseHsmAdapter)                         | —                             | AES-KWP via `keyring-serializer.cjs` |
| `importKeyring(envelope, masterKek)` | (inherited from BaseHsmAdapter)                         | —                             | AES-KWP via `keyring-serializer.cjs` |

### 3.2 Key Naming Convention

KEK names in Azure Key Vault must be unique within the vault and match `^[0-9a-zA-Z-]+$`. The adapter uses:

```
{tenantId}-{kekId}
```

Where `kekId` is a 12-char hex string (6 random bytes). The `tenantId` is also stored as a tag (`tenant`) for list filtering:

```javascript
{
  tags: {
    tenant: tenantId,
    created: String(Date.now()),
    track: 'stage2',
    ...meta,
  }
}
```

### 3.3 Algorithm Details

**A256KW** (AES Key Wrap with 256-bit KEK) is the JSON Web Algorithm (JWA) name for RFC 3394 AES-KW using a 256-bit key. This maps directly to our Stage 1 `aes-kw.cjs` `wrap()`/`unwrap()` functions, ensuring wire-level compatibility:

- **Input**: 32-byte CEK (256-bit AES key)
- **Output**: 40-byte wrapped key (32 + 8-byte IV per RFC 3394)
- **Integrity**: Provided by the AES-KW IV check (0xA6A6A6A6A6A6A6A6)

For 128-bit or 192-bit KEKs, use `A128KW` or `A192KW` respectively. The adapter validates `kekBits` at construction time and rejects unsupported sizes.

### 3.4 Key Rotation Policy

Azure Managed HSM supports server-side rotation policies. The adapter sets a default rotation policy of 90 days, configurable via `policyEngine`:

```javascript
{
  lifetimeDays: 90,
  action: 'rotate',
}
```

`_rotateKEK` calls `keyClient.rotateKey()` which creates a new key version. The old version remains available for decrypting existing wrapped keys but cannot be used for new wrap operations.

---

## 4. Security & Audit Synchronicity

### 4.1 Audit Interceptor

All Azure SDK client calls are wrapped by `azure-audit-interceptor.cjs`:

```javascript
// azure-audit-interceptor.cjs
class AuditInterceptor {
  constructor(logger, providerName) {
    this.logger = logger;
    this.providerName = providerName;
  }

  async wrapCall(action, operation, fn) {
    const start = Date.now();
    try {
      const result = await fn();
      this._audit(action, {
        operation,
        durationMs: Date.now() - start,
        status: "success",
      });
      return result;
    } catch (err) {
      this._audit(action, {
        operation,
        durationMs: Date.now() - start,
        status: "failure",
        error: err.code || err.message,
      });
      throw err;
    }
  }

  _audit(event, extra) {
    if (!this.logger || !this.logger.info) return;
    this.logger.info(event, {
      sub: "hsm-adapter",
      provider: this.providerName,
      ...extra,
    });
  }
}
```

### 4.2 Audit Event Constants

| Event                | Trigger                    | Extra Fields                                     |
| -------------------- | -------------------------- | ------------------------------------------------ |
| `CREATE_KEK`         | `_createKEK` success       | `tenantId`, `kekId`, `keyType`, `keySize`        |
| `WRAP`               | `_wrap` success            | `tenantId`, `kekId`, `plaintextLen`, `outputLen` |
| `UNWRAP`             | `_unwrap` success          | `tenantId`, `kekId`, `wrappedLen`, `outputLen`   |
| `ROTATE_KEK`         | `_rotateKEK` success       | `tenantId`, `oldKekId`, `newKekId`               |
| `KEY_ZEROIZED`       | `_zeroize` success         | `tenantId`, `kekId`, `reason`                    |
| `KEY_EVICTED`        | eviction engine callback   | `tenantId`, `kekId`, `reason`                    |
| `AUTH_FAILURE`       | credential chain exhausted | `tenantId?`, `error`                             |
| `CONNECTION_FAILURE` | HSM unreachable            | `vaultUrl`, `error`                              |

### 4.3 Sensitive Data Handling

- **Plaintext KEK values**: Never extracted from the HSM. Unlike SoftHSM2 (Stage 1), Azure Managed HSM supports native `wrapKey`/`unwrapKey` without requiring key extraction.
- **CEK buffers**: Zeroized after wrap using `secureZeroize.cjs` (same as Stage 1).
- **Audit logs**: Never include key material, only lengths and identifiers.
- **Network transport**: All Azure SDK calls use HTTPS/TLS 1.2+.

---

## 5. Hardware Isolation & FIPS Compliance

### 5.1 Managed HSM Pool

Azure Key Vault Managed HSM is a dedicated, customer-isolated HSM pool that provides:

- **FIPS 140-2 Level 3** validated hardware (the underlying HSM modules are Thales Luna 7)
- **Single-tenant isolation**: Each Managed HSM pool is dedicated to one subscription; no shared infrastructure
- **Key isolation**: Keys generated inside the pool cannot be exported in plaintext (HSM-enforced, not policy-enforced)
- **Tamper resistance**: Physical tamper detection with key zeroization

### 5.2 Role Assignments

The adapter requires the following Azure RBAC role on the Managed HSM pool:

| Role                       | Operations                        |
| -------------------------- | --------------------------------- |
| Managed HSM Crypto Officer | Create, list, rotate, delete keys |
| Managed HSM Crypto User    | Wrap, unwrap, encrypt, decrypt    |
| Managed HSM Crypto Auditor | Read audit logs (optional)        |

### 5.3 Network Security

- **Private endpoints**: Managed HSM supports Azure Private Link for network isolation
- **Firewall rules**: IP allowlist for the HSM pool
- **No public access**: HSM pool can be configured with `publicNetworkAccess: 'disabled'`

---

## 6. Error Mapping

Azure SDK errors are mapped to `HsmAdapterError` codes consistent with Stage 1:

| Azure Error Code          | HsmAdapterError Code      | Description                                                         |
| ------------------------- | ------------------------- | ------------------------------------------------------------------- |
| `401` / `Unauthorized`    | `AUTH_FAILURE`            | Credential chain exhausted or invalid                               |
| `403` / `Forbidden`       | `UNAUTHORIZED_KEY_ACCESS` | Missing RBAC role assignment                                        |
| `404` / `KeyNotFound`     | `KEK_NOT_FOUND`           | Key does not exist in the vault                                     |
| `409` / `Conflict`        | `KEK_EXISTS`              | Key name collision (should not happen with random IDs)              |
| `429` / `TooManyRequests` | `RATE_LIMITED`            | Azure throttling; retry with backoff                                |
| `5xx`                     | `HSM_UNAVAILABLE`         | Managed HSM service error                                           |
| Timeout                   | `CONNECTION_FAILURE`      | Network timeout to HSM pool                                         |
| `A256KW` unsupported      | `MECHANISM_INVALID`       | HSM pool does not support AES-KW (should not happen on Managed HSM) |

---

## 7. Test Plan

### 7.1 Unit Tests (Mocked SDK)

File: `ai-platform/server/lib/hsm-adapter/__tests__/azure-keyvault-adapter.test.cjs`

All Azure SDK calls are mocked using `jest.mock()` or a custom mock layer. No real Azure credentials required.

| Test                                               | Description                                          |
| -------------------------------------------------- | ---------------------------------------------------- |
| `initialize resolves with valid credentials`       | Mock `KeyClient.getPropertiesOfKey` → resolves       |
| `initialize rejects with AUTH_FAILURE`             | Mock credential chain → 401                          |
| `initialize rejects with CONNECTION_FAILURE`       | Mock `KeyClient` → timeout                           |
| `createKEK returns kekId and tags tenant`          | Mock `createKey` → verify name format and tags       |
| `createKEK rejects unsupported key size`           | `kekBits=512` → `INVALID_KEK_BITS`                   |
| `wrap returns 40-byte A256KW output`               | Mock `encrypt` → verify buffer length                |
| `wrap rejects unknown KEK`                         | Mock `encrypt` → 404 → `KEK_NOT_FOUND`               |
| `wrap rejects non-Buffer plaintext`                | Pass string → `INVALID_INPUT`                        |
| `unwrap returns 32-byte plaintext`                 | Mock `decrypt` → verify buffer                       |
| `unwrap rejects corrupted wrapped key`             | Mock `decrypt` → throws                              |
| `rotateKEK creates new key and returns new kekId`  | Mock `rotateKey` → verify new ID                     |
| `listKEKs filters by tenant tag`                   | Mock `listPropertiesOfKeys` → filter by `tenant` tag |
| `zeroize deletes key and emits KEY_ZEROIZED audit` | Mock `beginDeleteKey` → verify audit log             |
| `exportKeyring inherits from BaseHsmAdapter`       | Verify T10K envelope serialization works             |
| `importKeyring inherits from BaseHsmAdapter`       | Verify T10K envelope deserialization works           |
| `audit interceptor logs success and failure`       | Verify `_audit` called with correct event and status |
| `tenant isolation: wrap with wrong tenantId`       | Verify `UNAUTHORIZED_KEY_ACCESS`                     |

### 7.2 Integration Tests (Live Azure — Optional)

gated behind `AZURE_MANAGED_HSM_URL` environment variable. Skipped in CI by default.

| Test                                           | Description                         |
| ---------------------------------------------- | ----------------------------------- |
| `live: createKEK → wrap → unwrap round-trip`   | End-to-end against real Managed HSM |
| `live: rotateKEK preserves old key for unwrap` | Old version still decrypts          |
| `live: listKEKs returns only current tenant`   | Cross-tenant isolation verified     |

### 7.3 CI Strategy

- **Unit tests**: Run in existing `npm test` (Jest) — no Azure credentials needed
- **Integration tests**: Run in a separate `track-stage2-azure.yml` workflow, triggered manually with `AZURE_MANAGED_HSM_URL` secret
- **Mock layer**: `azure-sdk-mock.cjs` provides deterministic responses for all SDK methods

---

## 8. Implementation Plan

### Phase 1: Scaffold & Mocks (1 session)

1. Install dependencies: `@azure/keyvault-keys`, `@azure/identity`
2. Create `azure-keyvault-adapter.cjs` extending `BaseHsmAdapter`
3. Create `azure-credential-provider.cjs`
4. Create `azure-audit-interceptor.cjs`
5. Create `azure-sdk-mock.cjs` for unit tests
6. Write all unit tests (17 tests from section 7.1)
7. Verify: `npx jest --config jest.config.cjs azure-keyvault-adapter`

### Phase 2: Integration (1 session)

1. Provision Azure Managed HSM pool (manual or Terraform)
2. Configure RBAC role assignments
3. Set environment variables in GitHub Actions secrets
4. Create `track-stage2-azure.yml` workflow
5. Run live integration tests
6. Verify: CI green on `track-stage2-azure.yml`

### Phase 3: Production Hardening (1 session)

1. Add retry policies with exponential backoff
2. Add connection pooling for `CryptographyClient`
3. Add Prometheus metrics for audit events
4. Add health check endpoint (`/health/hsm`)
5. Document deployment guide in `ai-platform/docs/deployment/azure-managed-hsm.md`

---

## 9. Dependency Manifest

| Package                | Version                 | Purpose                         |
| ---------------------- | ----------------------- | ------------------------------- |
| `@azure/keyvault-keys` | `^4.8.0` (>=7 days old) | Key CRUD, rotation, wrap/unwrap |
| `@azure/identity`      | `^4.5.0` (>=7 days old) | DefaultAzureCredential chain    |

Both packages are ESM-only in recent versions. The adapter will use dynamic `import()` wrapped in a CommonJS `require()` shim to maintain compatibility with the existing `.cjs` codebase:

```javascript
// azure-keyvault-adapter.cjs (CommonJS)
let KeyClient, CryptographyClient, DefaultAzureCredential;

async function loadAzureSDKs() {
  const keys = await import("@azure/keyvault-keys");
  const identity = await import("@azure/identity");
  KeyClient = keys.KeyClient;
  CryptographyClient = keys.CryptographyClient;
  DefaultAzureCredential = identity.DefaultAzureCredential;
}
```

---

## 10. Open Questions

1. **Key vault vs Managed HSM**: Should we also support standard Key Vault (shared, FIPS 140-2 L1) as a fallback, or strictly require Managed HSM (dedicated, L3)?
2. **BYOK (Bring Your Own Key)**: Should the adapter support importing externally-generated keys via `importKey`? This would require key material in a specific wrap format.
3. **Key versions**: Should `unwrap` always use the latest key version, or should the wrapped blob embed the version ID for deterministic decryption?
4. **Multi-region**: Should the adapter support failover across multiple Managed HSM pools in different Azure regions?
5. **Cost**: Managed HSM pools incur hourly charges (~$1.50/hour for standard). Should we add a "dry-run" mode that uses `SoftwareHsmAdapter` for development?

---

## References

- [Azure Key Vault Managed HSM documentation](https://docs.microsoft.com/en-us/azure/key-vault/managed-hsm/)
- [@azure/keyvault-keys npm package](https://www.npmjs.com/package/@azure/keyvault-keys)
- [RFC 3394: AES Key Wrap](https://tools.ietf.org/html/rfc3394)
- [RFC 5649: AES Key Wrap with Padding](https://tools.ietf.org/html/rfc5649)
- [JSON Web Algorithms (JWA) — A256KW](https://tools.ietf.org/html/rfc7518#section-4.4)
- Stage 1 implementation: `ai-platform/server/lib/hsm-adapter/softHsmAdapter.cjs`
- Base adapter contract: `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- T10K envelope spec: `ai-platform/docs/specs/t10k-envelope-spec.md`
