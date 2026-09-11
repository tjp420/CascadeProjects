# SimpleBeacon Secret Scanner Exception Allowlist

This file registers authorized exceptions for the automated secret scanning gates.
To allowlist a false positive or an intentional **production-path** dummy string, calculate its
non-reversible SHA-256 fingerprint from the scanner output and append it below with a clear
business justification.

**Note:** `packages/simplebeacon-cli/scripts/secret-scanner.js` already skips `node_modules`,
`.git`, build outputs, and test/fixture trees (`tests/`, `__tests__/`, `fixtures/`, `*.test.js`,
etc.). Do **not** dump every unit-test mock into this file — only rare non-test false positives.

---

## Approved Telemetry Signatures

# Example entry:
# - **Signature:** `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
#   - **Reason:** Public mock key used in integration tests.
#   - **Authorized By:** App Security Team

<!-- Add 64-hex lowercase SHA-256 fingerprints (one per line) for allowed exceptions below -->
## Automated test allowlist entries (added by installer)

- **Signature:** `fddd84a5efc5786b4b999e8e3087b5ab87bc76975c9a9dbd4d02ebbc8b20c388`
	- **Reason:** Authorized internal test fixture used in `packages/simplebeacon-cli/tests/advanced-security-rules.test.js` (internal mock token).

- **Signature:** `d593452fff54f1f9f2571537e1c06b180d2d012cbe57e18877b0dae98fcabb6e`
	- **Reason:** Authorized Slack token mock in `packages/simplebeacon-cli/tests/advanced-security-rules.test.js` for detection unit tests.

- **Signature:** `9a3c7a5f76005fdf29183f5c426a14d09786c20186462b1d96481f9b1091121b`
	- **Reason:** Authorized internal service token mock in `packages/simplebeacon-cli/tests/advanced-security-rules.test.js`.

- **Signature:** `72be84b4aa965ff33697618039c635042ca25a9b1f33bfc06bfa6660546bba51`
	- **Reason:** Authorized OAuth2/google token mock in `packages/simplebeacon-cli/tests/advanced-security-rules.test.js` (duplicate entry removed if present).

- **Signature:** `20b0b2951c990e4f41cc1210f55f4275106e00f459e4a1778190b5637d0823ce`
	- **Reason:** Authorized AWS mock credential used in `tests/test_ast_scanner.py` for scanner unit tests.

2f11b0d03b26099dc20c85355bd7c54a0f522e3780e0baacbaab75cecb793b57  # test: tmp-prepush-leak.js

- **Signature:** `82c63bb92c67394bcf49a60a297ba5a8e6088b409c1a108e3399da11dd14b593`
	- **Reason:** Authorized PEM header snippet used in `packages/simplebeacon-cli/src/rules/security-pattern-scanner.js` test fixtures.

- **Signature:** `3316382a35bbc0edf5271f7b5ef9ce75b30119ce4d4db21b8aeb64550ba9e3a8`
	- **Reason:** Authorized PEM snippet in `packages/simplebeacon-cli/tests/advanced-security-rules.test.js` (test fixture).

- **Signature:** `1a5d44a2dca19669d72edf4c4f1c27c4c1ca4b4408fbb17f6ce4ad452d78ddb3`
	- **Reason:** Authorized AWS Access Key ID mock found in `tests/test_ast_scanner.py` for unit tests.
