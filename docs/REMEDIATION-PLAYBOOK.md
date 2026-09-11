# Remediation Playbook — License Compliance

This short playbook helps engineering teams triage, fix, and verify license gate failures produced by `node_license_analyzer.py`.

## 1. Triage

1. Inspect the CI artifact `license-compliance-report.html` (attached to the failed job).
2. Identify the blocked packages and the _root cause_ (direct dependency vs nested transitive dependency).
3. If uncertain whether a license is truly blocking, tag Legal: `@legal` with the report.

## 2. Remediation Strategies (ordered by preference)

- Replace with a permissively licensed maintained alternative (MIT, Apache-2.0, BSD, ISC).
- Remove the dependency and implement a thin wrapper with native APIs (e.g., `fetch`, `crypto`).
- Vendor a minimal, audited copy of the required code under an approved license (follow Legal guidance).
- Contact the upstream owner to obtain a license exception or dual-license (requires Legal sign-off).
- As a last resort, consider forking and relicensing (Legal + long-term maintenance cost).

## 3. Quick Commands

Run locally (Python required):

```bash
python node_license_analyzer.py --package-json package.json --lockfile package-lock.json --output license-compliance-report.html
```

If Windows Python is problematic, run via Docker (PowerShell-friendly):

```powershell
docker run --rm -v "${PWD}:/work" -w /work python:3.11-slim python node_license_analyzer.py --package-json package.json --lockfile package-lock.json --output license-compliance-report.html
```

## 4. PR Template

Use the repository PR template: `.github/pull_request_template/compliance-remediation.md` — copy/paste the blocked packages + remediation steps and checklist.

## 5. Verification

- Ensure `license-compliance-report.html` shows `0` Critical/High findings after changes.
- Re-run CI on the branch; gate will pass only if the analyzer exits `0`.

## 6. Legal Considerations

- AGPL-style network-copyleft packages frequently require open-sourcing server code — engage Legal immediately.
- GPL-family licenses can impose distribution conditions; Legal must confirm business risk.

## 7. Optional: Fast Remediation Patterns

- Network clients → replace with `axios`/native `fetch`/maintained MIT client
- Parsers → replace with `cheerio` or other MIT parsers
- CLI utils → replace with `execa` or native Node APIs where possible

## 8. Contact

If you need a packaged remediation PR (we'll auto-generate the PR body from the scanner output), reply and I'll add a small utility that generates the completed PR markdown file from `license-compliance-report.html`.
