## 🛡️ Compliance Remediation: License Vulnerability Fix

### 1. The Conflict

- **Blocked Package:** `corrupt-net-module@1.0.4`
  - **License:** `AGPL-3.0` (Critical Risk)
  - **Implication:** Viral Copyleft (Network). Forces whole codebase to be open-sourced if served over a network.

- **Blocked Package:** `legacy-parser@3.2.1`
  - **License:** `GPL-3.0` (High Risk)
  - **Implication:** Viral Copyleft (Standard). Requires distributing source code if software is distributed.

---

### 2. Resolution Summary

- **Removed / Replaced:** `corrupt-net-module`
  - **Replaced With:** axios / native fetch (License: `MIT`)

- **Removed / Replaced:** `legacy-parser`
  - **Replaced With:** cheerio (License: `MIT`)

---

### 3. Verification Checklist

- [ ] Run local compliance audit check: `python node_license_analyzer.py --package-json package.json --lockfile package-lock.json --output license-compliance-report.html`

- [ ] Verified local registry cache updated at `.cache/npm-licenses.json`

- [ ] Total Critical / High risks in generated `license-compliance-report.html` is now **0**.

- [ ] All deep sub-dependencies conform to permissive corporate standards (MIT, Apache-2.0, ISC, BSD).

---

### 4. Files / Changes in this PR

- `package.json` — dependency removal / replacement
- `package-lock.json` — updated lockfile

---

### 5. Release / Rollout Notes

- This change is safe to ship after CI passes.
- Monitor relevant production traces for 48 hours after deployment.

Best regards,
Alice
