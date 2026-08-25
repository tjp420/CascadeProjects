# M6 — Security baseline: Spectral Identity, RBAC, Audit Ledger

**Summary**
Implement identity, RBAC, multi-signer operations, and an append-only signed ledger for audit and provenance.

**Description**

- Spectral identity: key pair scheme, fingerprinting format, rotation policy.
- RBAC: roles (operator, auditor, sysadmin), scopes, policy enforcement middleware.
- Multi-signer: 2-of-3 signing for high-impact commands.
- Ledger: append-only signed entries (merkle-chain or signed JSON lines).

**Estimate**: 20 person-days
**Complexity**: High
**Dependencies**: M1 (API), M3 (vessel)

**Acceptance criteria**

- Key management flows (create, rotate, revoke)
- RBAC enforced on control APIs
- Ledger stores signed entries and can be audited

**Notes**
Align crypto primitives with existing infra; avoid inventing new cryptography. Consider hardware-backed keys for production.
