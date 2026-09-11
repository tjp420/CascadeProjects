# SimpleBeacon Developer Runbook: Artifact Interpretation & Remediation

This runbook guides engineers through executing local scans, interpreting SimpleBeacon's core compliance outputs, and remediating high-severity blocks before code hits a remote branch.

---

## 1. Quick Start — Run a Local Scan

Execute a local scan and generate the compliance bundle without any external network dependencies:

```bash
npx simplebeacon scan --format json --output .simplebeacon/report.json --gate
```

Optional: verify the zero-data-custody architecture by running the same command offline (disconnect network interfaces first).

```bash
# Disable network (Wi-Fi/Ethernet) and re-run
npx simplebeacon scan --format json --output .simplebeacon/report.json --gate
```

The scanner will run locally (AST engines and dependency checks operate from local caches or deterministic analysis) and produce an artifact bundle under `.simplebeacon/`.

---

## 2. Where to Look After a Failure

If the `--gate` flag causes a non-zero exit (CI/pre-commit block), inspect the artifact bundle inside `.simplebeacon/`. The three most-critical files you will use are:

- `human-oversight-art14.json` — AST findings and human-oversight failures (placeholders, hollow functions, LLM-inserted bypasses).
- `cyber-robustness-sbom.json` — CycloneDX 1.5 SBOM with resolved dependency versions and registry status flags.
- `governance-mapping-art10.json` — Environment, data-flow, and configuration boundary violations.

Each file includes scanner metadata (version, timestamp, invocation), findings with severity, file path and line ranges, and a short `remediation_hint` where applicable.

---

## 3. Interpreting Findings & Remediation Recipes

Below are compact remediation recipes you can follow directly.

### A. `human-oversight-art14.json` — AI Slop & Placeholder Code

- Problem: Hollow functions, `TODO`/`FIXME` placeholders, or LLM-generated stubs that bypass real logic.
- Example finding snippet:

```json
{
  "engine_module": "Semantic_SAST_PlaceholderDetector",
  "severity": "HIGH",
  "file_path": "src/services/crypto.js",
  "line_range": "12-16",
  "code_context": "function protectPayload(payload) { return payload; }",
  "remediation_hint": "Replace with vetted crypto library and add tests"
}
```

How to fix:

1. Open the listed file and remove placeholder logic.
2. Replace with the team's approved implementation (e.g., `node:crypto` or Web Crypto API wrapper).
3. Add or update unit and integration tests that exercise the real path.
4. Re-run the scan until the finding clears.

### B. `cyber-robustness-sbom.json` — Hallucinated / Problematic Dependencies

- Problem: Non-existent or untrusted packages (hallucinated names) or viral copyleft licenses (AGPL/GPL variants) flagged in SBOM.
- Example finding snippet:

```json
{
  "type": "library",
  "name": "stable-payments-client",
  "version": "1.2.0",
  "properties": [
    {
      "name": "simplebeacon:registry-status",
      "value": "FAILED_HALLUCINATION_RISK"
    }
  ]
}
```

How to fix:

1. Verify the package: `npm view stable-payments-client` (or your registry's equivalent). If `404`, it's invalid.
2. Remove the dependency from `package.json` and replace with an approved package.
3. Audit license flags in the SBOM for AGPL/GPL; if a transitively included viral license appears, either replace the dependency or obtain legal signoff.
4. Remove `package-lock.json` and re-run `npm install` (or `pip` equivalent), then re-scan.

### C. `governance-mapping-art10.json` — Environment Leakage & Hardcoded Production Values

- Problem: Hardcoded endpoints, credentials, or silent production fallbacks in configuration files.
- Example finding snippet:

```json
{
  "engine_module": "Environment_Boundary_Checker",
  "severity": "CRITICAL",
  "file_path": "config/environments.py",
  "violation": "Static string fallback to mock-payments-stage.example found outside test suite boundaries."
}
```

How to fix:

1. Remove hardcoded production/staging endpoints from source.
2. Use required environment variable patterns that fail loudly in production (example):

```python
# Secure: throw on missing variable in production
PAYMENT_GATEWAY_URL = os.environ["PAYMENT_GATEWAY_URL"]
```

3. Move any test-stub configuration into test-only fixtures.
4. Re-scan and ensure the `CRITICAL` violation is cleared.

---

## 4. Verifying the Evidence Bundle Integrity

Before committing or publishing the compliance pack, verify its cryptographic integrity:

```bash
npx simplebeacon verify --bundle .simplebeacon/compliance-pack-latest/
```

What the verification does:

1. Recomputes the deterministic SHA-256 checksum across the artifact folder.
2. Compares the checksum to the value in `evidence-signature.json`.
3. Verifies scanner metadata (version, fingerprint) matches the invocation log.

If verification passes, you can safely tag the release and upload the compressed compliance bundle to your internal artifact store or link it in your risk register.

---

## 5. Fast Recovery Checklist (for devs who hit a gate)

1. Re-run the scan locally: `npx simplebeacon scan --format json --output .simplebeacon/report.json --gate` and capture the failing artifact.
2. Open the artifact file and find the top `CRITICAL`/`HIGH` entries. Follow the remediation_hint.
3. Make a small, focused code change and add a unit test (where applicable).
4. Re-run `npx simplebeacon scan ...` until green.
5. Push and create a succinct PR message: include the compliance artifact filename + the resolved issue IDs.

---

## 6. When to involve Security/Legal

- If SBOM flags a viral copyleft (AGPL/GPL): escalate to Legal for licensing signoff.
- If an external dependency is flagged as malicious or suddenly changes checksum: escalate to Security and rotate keys/secrets if suspicion exists.

---

## 7. Want this in your repo root automatically?

If you want the runbook added to your repository root, rename or move this file to `DEVELOPER_RUNBOOK.md` (already created) and commit. For CI integration hints, see `.github/workflows/simplebeacon.yml` in the examples folder.

---

If you'd like, I can also:

1. Convert this runbook into a compact `docs/` page and add links to the repo README.
2. Add a small `bin/` helper script that parses `report.json` and prints the top 5 failing findings with file/line links for quick triage.
