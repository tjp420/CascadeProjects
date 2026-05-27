# Third-Party Notices

This repository previously tracked a large generated third-party notices file here.

To keep the working tree lightweight for dashboard and repository scans:
- Store full generated license notices in `reports/licenses/` as build artifacts.
- Regenerate notices from your package manager lockfiles during release packaging.

Minimum compliance checklist:
1. Include full third-party notices in distributed artifacts.
2. Keep license metadata in `package.json` and lockfiles current.
3. Re-run notice generation when dependencies change.
